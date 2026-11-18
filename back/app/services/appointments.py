from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.enums import AppointmentStatus, Role
from app.models import Appointment, ExtraExpense, User
from app.schemas import AppointmentOut

# Записи, которые занимают время сотрудника: все, кроме отменённых
BLOCKING_STATUSES = tuple(s for s in AppointmentStatus if s != AppointmentStatus.cancelled)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """Наивное время считаем UTC, aware — приводим к UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def appointment_options():
    return (
        joinedload(Appointment.client),
        joinedload(Appointment.employee),
        joinedload(Appointment.service),
        selectinload(Appointment.extra_expenses).joinedload(ExtraExpense.price_item),
    )


def load_appointment(db: Session, appointment_id: int) -> Appointment:
    appointment = db.scalar(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .options(*appointment_options())
        .execution_options(populate_existing=True)
    )
    if appointment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    return appointment


def lock_appointment(db: Session, appointment_id: int) -> Appointment:
    """SELECT ... FOR UPDATE по записи: защита от одновременного принятия/отмены."""
    appointment = db.scalar(
        select(Appointment)
        .where(Appointment.id == appointment_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if appointment is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    return appointment


def lock_employee(db: Session, employee_id: int) -> User:
    """Блокирует строку сотрудника, чтобы две одновременные записи к нему шли по очереди
    (иначе обе могли бы пройти проверку пересечения)."""
    employee = db.scalar(
        select(User)
        .where(User.id == employee_id, User.role == Role.employee, User.is_active.is_(True))
        .with_for_update()
    )
    if employee is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Сотрудник не найден")
    return employee


def find_conflict(
    db: Session,
    employee_id: int,
    start: datetime,
    end: datetime,
    exclude_id: Optional[int] = None,
) -> Optional[Appointment]:
    """Запись сотрудника, пересекающаяся с интервалом [start, end).
    Интервалы пересекаются, если начало одного раньше конца другого и наоборот;
    записи «встык» (конец == начало следующей) не конфликтуют."""
    stmt = select(Appointment).where(
        Appointment.employee_id == employee_id,
        Appointment.status.in_(BLOCKING_STATUSES),
        Appointment.start_time < end,
        Appointment.end_time > start,
    )
    if exclude_id is not None:
        stmt = stmt.where(Appointment.id != exclude_id)
    return db.scalars(stmt.limit(1)).first()


def appointment_out(appointment: Appointment) -> AppointmentOut:
    out = AppointmentOut.model_validate(appointment)
    extras = sum((e.total for e in appointment.extra_expenses), Decimal("0"))
    out.extras_total = extras
    out.total_cost = appointment.service.price + extras
    return out
