from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import AppointmentStatus, Role


def _enum(enum_cls):
    # Храним как VARCHAR (не нативный enum PostgreSQL) — проще менять значения.
    return SAEnum(enum_cls, native_enum=False, length=20, validate_strings=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(150))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(_enum(Role), index=True)
    # Деактивированный сотрудник не может войти и не доступен для записи
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Service(Base):
    """Услуга автосервиса."""

    __tablename__ = "services"
    __table_args__ = (
        CheckConstraint("duration > 0", name="ck_services_duration_positive"),
        CheckConstraint("price >= 0", name="ck_services_price_non_negative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)
    duration: Mapped[int] = mapped_column(Integer)  # в минутах
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))


class PriceItem(Base):
    """Позиция прайс-листа для дополнительных расходов (масло, фильтр, колодки и т. п.)."""

    __tablename__ = "price_items"
    __table_args__ = (CheckConstraint("price >= 0", name="ck_price_items_price_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))


class Appointment(Base):
    """Запись клиента на услугу к конкретному сотруднику."""

    __tablename__ = "appointments"
    __table_args__ = (Index("ix_appointments_employee_time", "employee_id", "start_time", "end_time"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    employee_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    service_id: Mapped[int] = mapped_column(ForeignKey("services.id"), index=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # start_time + длительность услуги на момент записи (нужно для проверки пересечений)
    end_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[AppointmentStatus] = mapped_column(
        _enum(AppointmentStatus), default=AppointmentStatus.new, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    client: Mapped["User"] = relationship(foreign_keys=[client_id])
    employee: Mapped["User"] = relationship(foreign_keys=[employee_id])
    service: Mapped["Service"] = relationship()
    extra_expenses: Mapped[list["ExtraExpense"]] = relationship(
        back_populates="appointment", order_by="ExtraExpense.id"
    )


class ExtraExpense(Base):
    """Дополнительный расход, добавленный сотрудником к записи."""

    __tablename__ = "extra_expenses"
    __table_args__ = (CheckConstraint("quantity > 0", name="ck_extra_expenses_quantity_positive"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    appointment_id: Mapped[int] = mapped_column(ForeignKey("appointments.id"), index=True)
    price_item_id: Mapped[int] = mapped_column(ForeignKey("price_items.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # цена позиции × количество на момент добавления

    appointment: Mapped["Appointment"] = relationship(back_populates="extra_expenses")
    price_item: Mapped["PriceItem"] = relationship()
