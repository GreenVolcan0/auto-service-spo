from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.enums import AppointmentStatus, Role
from app.models import Appointment, User
from app.routers.appointments import list_page
from app.schemas import AppointmentOut, EmployeeCreate, EmployeeUpdate, Page, UserOut
from app.security import hash_password
from app.services.appointments import appointment_out, load_appointment, lock_appointment

router = APIRouter(prefix="/admin", tags=["admin"])

AdminUser = Depends(require_roles(Role.admin))


def _get_employee(db: Session, employee_id: int) -> User:
    employee = db.get(User, employee_id)
    if employee is None or employee.role != Role.employee:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Сотрудник не найден")
    return employee


def _email_taken(db: Session, email: str, exclude_id: Optional[int] = None) -> bool:
    stmt = select(User.id).where(User.email == email)
    if exclude_id is not None:
        stmt = stmt.where(User.id != exclude_id)
    return db.scalar(stmt) is not None


# ---------------------------------------------------------------- аккаунты сотрудников

@router.post("/employees", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_employee(data: EmployeeCreate, admin: User = AdminUser, db: Session = Depends(get_db)):
    if _email_taken(db, data.email):
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с таким email уже существует")
    employee = User(
        name=data.name.strip(),
        email=data.email,
        password_hash=hash_password(data.password),
        role=Role.employee,
    )
    db.add(employee)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь с таким email уже существует")
    return employee


@router.get("/employees", response_model=Page[UserOut])
def list_employees(
    is_active: Optional[bool] = None,
    q: Optional[str] = Query(None, description="Поиск по имени и email"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = AdminUser,
    db: Session = Depends(get_db),
):
    filters = [User.role == Role.employee]
    if is_active is not None:
        filters.append(User.is_active.is_(is_active))
    if q:
        filters.append(or_(User.name.icontains(q, autoescape=True), User.email.icontains(q, autoescape=True)))
    total = db.scalar(select(func.count(User.id)).where(*filters)) or 0
    items = db.scalars(select(User).where(*filters).order_by(User.name, User.id).offset(offset).limit(limit)).all()
    return Page[UserOut](items=items, total=total, limit=limit, offset=offset)


@router.get("/employees/{employee_id}", response_model=UserOut)
def get_employee(employee_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    return _get_employee(db, employee_id)


@router.patch("/employees/{employee_id}", response_model=UserOut)
def update_employee(employee_id: int, data: EmployeeUpdate, admin: User = AdminUser, db: Session = Depends(get_db)):
    employee = _get_employee(db, employee_id)
    changes = data.model_dump(exclude_none=True)
    if "email" in changes and _email_taken(db, changes["email"], exclude_id=employee.id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Этот email уже занят")
    if "password" in changes:
        employee.password_hash = hash_password(changes.pop("password"))
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    for field, value in changes.items():
        setattr(employee, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Этот email уже занят")
    return employee


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    """Удаляет аккаунт сотрудника. Если у него есть записи (в любом статусе), удалить нельзя —
    вместо этого деактивируйте: PATCH {"is_active": false}."""
    employee = _get_employee(db, employee_id)
    if db.scalar(select(Appointment.id).where(Appointment.employee_id == employee.id).limit(1)):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "У сотрудника есть записи, удалить нельзя. Деактивируйте аккаунт (is_active=false).",
        )
    db.delete(employee)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- расписания и отмена записей

@router.get("/schedule", response_model=Page[AppointmentOut])
def view_schedules(
    employee_id: Optional[int] = Query(None, description="Расписание конкретного сотрудника"),
    status_filter: Optional[AppointmentStatus] = Query(None, alias="status"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = AdminUser,
    db: Session = Depends(get_db),
):
    """Расписания сотрудников: всех сразу или одного (employee_id)."""
    filters = []
    if employee_id is not None:
        filters.append(Appointment.employee_id == employee_id)
    if status_filter is not None:
        filters.append(Appointment.status == status_filter)
    return list_page(db, filters, limit, offset, date_from, date_to)


@router.post("/appointments/{appointment_id}/cancel", response_model=AppointmentOut)
def cancel_appointment(appointment_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    """Отмена записи администратором (например, в случае ЧП): new/accepted → cancelled, время освобождается.
    Выполненную и оплаченную запись отменить нельзя."""
    appointment = lock_appointment(db, appointment_id)
    if appointment.status == AppointmentStatus.cancelled:
        raise HTTPException(status.HTTP_409_CONFLICT, "Запись уже отменена")
    if appointment.status in (AppointmentStatus.completed, AppointmentStatus.paid):
        raise HTTPException(status.HTTP_409_CONFLICT, "Выполненную или оплаченную запись отменить нельзя")
    appointment.status = AppointmentStatus.cancelled
    db.commit()
    return appointment_out(load_appointment(db, appointment.id))
