from datetime import date, datetime, time, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.enums import Role
from app.models import Appointment, User
from app.schemas import BusySlot, PersonBrief
from app.services.appointments import BLOCKING_STATUSES

router = APIRouter(prefix="/employees", tags=["employees"])


@router.get("", response_model=list[PersonBrief])
def list_employees(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Активные сотрудники — клиент выбирает, к кому записаться."""
    return db.scalars(
        select(User).where(User.role == Role.employee, User.is_active.is_(True)).order_by(User.name)
    ).all()


@router.get("/{employee_id}/busy", response_model=list[BusySlot])
def get_busy_slots(
    employee_id: int,
    day: date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Занятые интервалы сотрудника на день (UTC) — без данных о клиентах. Помогает выбрать свободное время."""
    employee = db.get(User, employee_id)
    if employee is None or employee.role != Role.employee or not employee.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Сотрудник не найден")
    day_start = datetime.combine(day, time.min, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)
    rows = db.scalars(
        select(Appointment)
        .where(
            Appointment.employee_id == employee_id,
            Appointment.status.in_(BLOCKING_STATUSES),
            Appointment.start_time < day_end,
            Appointment.end_time > day_start,
        )
        .order_by(Appointment.start_time)
    ).all()
    return [BusySlot(start_time=a.start_time, end_time=a.end_time) for a in rows]
