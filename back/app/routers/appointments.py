from datetime import date, datetime, time, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_roles
from app.enums import AppointmentStatus, Role
from app.models import Appointment, ExtraExpense, PriceItem, Service, User
from app.schemas import AppointmentCreate, AppointmentOut, ExpenseCreate, Page
from app.services.appointments import (
    appointment_options,
    appointment_out,
    as_utc,
    find_conflict,
    load_appointment,
    lock_appointment,
    lock_employee,
    utcnow,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


def list_page(
    db: Session,
    filters: list,
    limit: int,
    offset: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    newest_first: bool = False,
) -> Page[AppointmentOut]:
    """Общая выборка записей с фильтром по датам (UTC) и пагинацией."""
    filters = list(filters)
    if date_from is not None:
        filters.append(Appointment.start_time >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to is not None:
        filters.append(
            Appointment.start_time < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    total = db.scalar(select(func.count(Appointment.id)).where(*filters)) or 0
    order = (Appointment.start_time.desc(), Appointment.id.desc()) if newest_first else (
        Appointment.start_time, Appointment.id)
    rows = db.scalars(
        select(Appointment).where(*filters).options(*appointment_options()).order_by(*order).offset(offset).limit(limit)
    ).all()
    return Page[AppointmentOut](
        items=[appointment_out(a) for a in rows], total=total, limit=limit, offset=offset
    )


# ---------------------------------------------------------------- клиент

@router.post("", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED)
def create_appointment(
    data: AppointmentCreate,
    client: User = Depends(require_roles(Role.client)),
    db: Session = Depends(get_db),
):
    """Заявка на услугу: клиент выбирает услугу, сотрудника и время начала.
    Время окончания = начало + длительность услуги. Если сотрудник в это время занят
    (есть запись new/accepted с пересечением) — 409."""
    service = db.get(Service, data.service_id)
    if service is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Услуга не найдена")

    start = as_utc(data.start_time)
    if start <= utcnow():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Время записи должно быть в будущем")
    end = start + timedelta(minutes=service.duration)

    # Блокируем сотрудника: проверка пересечения и вставка идут как одна атомарная операция
    employee = lock_employee(db, data.employee_id)
    if find_conflict(db, employee.id, start, end) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Сотрудник занят в это время, выберите другое время")

    appointment = Appointment(
        client_id=client.id,
        employee_id=employee.id,
        service_id=service.id,
        start_time=start,
        end_time=end,
        status=AppointmentStatus.new,
    )
    db.add(appointment)
    db.commit()
    return appointment_out(load_appointment(db, appointment.id))


@router.get("/my", response_model=Page[AppointmentOut])
def my_appointments(
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    client: User = Depends(require_roles(Role.client)),
    db: Session = Depends(get_db),
):
    """Свои заявки клиента и их статусы."""
    filters = [Appointment.client_id == client.id]
    if status_filter is not None:
        filters.append(Appointment.status == status_filter)
    return list_page(db, filters, limit, offset, newest_first=True)


# ---------------------------------------------------------------- сотрудник

@router.get("/schedule", response_model=Page[AppointmentOut])
def my_schedule(
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    employee: User = Depends(require_roles(Role.employee)),
    db: Session = Depends(get_db),
):
    """Своё расписание сотрудника (новые заявки и принятые записи). Чужие расписания недоступны."""
    filters = [Appointment.employee_id == employee.id]
    if status_filter is not None:
        filters.append(Appointment.status == status_filter)
    return list_page(db, filters, limit, offset, date_from, date_to)


@router.post("/{appointment_id}/accept", response_model=AppointmentOut)
def accept_appointment(
    appointment_id: int,
    employee: User = Depends(require_roles(Role.employee)),
    db: Session = Depends(get_db),
):
    """new → accepted. Время принятой записи сотрудник изменить не может (такого метода в API нет)."""
    appointment = lock_appointment(db, appointment_id)
    if appointment.employee_id != employee.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это запись другого сотрудника")
    if appointment.status != AppointmentStatus.new:
        raise HTTPException(status.HTTP_409_CONFLICT, "Принять можно только новую заявку")
    if as_utc(appointment.start_time) <= utcnow():
        raise HTTPException(status.HTTP_409_CONFLICT, "Время записи уже наступило")
    # Страховка: на момент принятия пересечений с другими записями быть не должно
    if find_conflict(db, employee.id, appointment.start_time, appointment.end_time, exclude_id=appointment.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Запись пересекается с другой записью сотрудника")
    appointment.status = AppointmentStatus.accepted
    db.commit()
    return appointment_out(load_appointment(db, appointment.id))


@router.post("/{appointment_id}/complete", response_model=AppointmentOut)
def complete_appointment(
    appointment_id: int,
    employee: User = Depends(require_roles(Role.employee)),
    db: Session = Depends(get_db),
):
    """accepted → completed: сотрудник отмечает, что работа выполнена. После этого доп. расходы добавлять нельзя —
    итоговая сумма зафиксирована."""
    appointment = lock_appointment(db, appointment_id)
    if appointment.employee_id != employee.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это запись другого сотрудника")
    if appointment.status != AppointmentStatus.accepted:
        raise HTTPException(status.HTTP_409_CONFLICT, "Выполненной можно отметить только принятую запись")
    appointment.status = AppointmentStatus.completed
    db.commit()
    return appointment_out(load_appointment(db, appointment.id))


@router.post("/{appointment_id}/pay", response_model=AppointmentOut)
def pay_appointment(
    appointment_id: int,
    employee: User = Depends(require_roles(Role.employee)),
    db: Session = Depends(get_db),
):
    """completed → paid: сотрудник отмечает, что клиент оплатил итоговую сумму (total_cost)."""
    appointment = lock_appointment(db, appointment_id)
    if appointment.employee_id != employee.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это запись другого сотрудника")
    if appointment.status != AppointmentStatus.completed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Оплатить можно только выполненную запись")
    appointment.status = AppointmentStatus.paid
    db.commit()
    return appointment_out(load_appointment(db, appointment.id))


@router.post(
    "/{appointment_id}/expenses", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED
)
def add_expense(
    appointment_id: int,
    data: ExpenseCreate,
    employee: User = Depends(require_roles(Role.employee)),
    db: Session = Depends(get_db),
):
    """Дополнительный расход к принятой записи: сумма = цена позиции прайса × количество."""
    appointment = lock_appointment(db, appointment_id)
    if appointment.employee_id != employee.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это запись другого сотрудника")
    if appointment.status != AppointmentStatus.accepted:
        raise HTTPException(status.HTTP_409_CONFLICT, "Расходы можно добавлять только к принятой записи")
    item = db.get(PriceItem, data.price_item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция прайс-листа не найдена")

    db.add(
        ExtraExpense(
            appointment_id=appointment.id,
            price_item_id=item.id,
            quantity=data.quantity,
            total=item.price * data.quantity,
        )
    )
    db.commit()
    return appointment_out(load_appointment(db, appointment.id))


# ---------------------------------------------------------------- общий доступ

@router.get("/{appointment_id}", response_model=AppointmentOut)
def get_appointment(
    appointment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Запись видят: её клиент, назначенный сотрудник и администратор. Остальным — 404."""
    appointment = load_appointment(db, appointment_id)
    allowed = (
        user.role == Role.admin
        or appointment.client_id == user.id
        or appointment.employee_id == user.id
    )
    if not allowed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    return appointment_out(appointment)
