from datetime import datetime
from decimal import Decimal
from typing import Annotated, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, field_validator

from app.enums import AppointmentStatus, Role

T = TypeVar("T")

# Деньги в JSON отдаются числом (а не строкой, как Decimal по умолчанию)
Price = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


def _check_password(value: str) -> str:
    # bcrypt учитывает только первые 72 байта — длиннее не принимаем
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Пароль слишком длинный (максимум 72 байта)")
    return value


# ---------- Пользователи ----------

class RegisterIn(BaseModel):
    """Самостоятельная регистрация: роль всегда client, выбрать её нельзя."""

    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def _password_len(cls, v: str) -> str:
        return _check_password(v)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    role: Role
    is_active: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    email: Optional[EmailStr] = None

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: Optional[str]) -> Optional[str]:
        return v.lower() if v else v


class PasswordChange(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8)

    @field_validator("new_password")
    @classmethod
    def _password_len(cls, v: str) -> str:
        return _check_password(v)


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def _password_len(cls, v: str) -> str:
        return _check_password(v)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()


class EmployeeUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=150)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(default=None, min_length=8)
    is_active: Optional[bool] = None

    @field_validator("password")
    @classmethod
    def _password_len(cls, v: Optional[str]) -> Optional[str]:
        return _check_password(v) if v is not None else v

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: Optional[str]) -> Optional[str]:
        return v.lower() if v else v


class PersonBrief(ORMModel):
    id: int
    name: str


# ---------- Услуги и прайс-лист ----------

class ServiceIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    duration: int = Field(gt=0, le=1440, description="Длительность в минутах")
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class ServiceUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    duration: Optional[int] = Field(default=None, gt=0, le=1440)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class ServiceOut(ORMModel):
    id: int
    name: str
    description: Optional[str]
    duration: int
    price: Price


class PriceItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class PriceItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)


class PriceItemOut(ORMModel):
    id: int
    name: str
    price: Price


class PriceListOut(BaseModel):
    services: list[ServiceOut]
    price_items: list[PriceItemOut]


# ---------- Записи ----------

class AppointmentCreate(BaseModel):
    employee_id: int
    service_id: int
    start_time: datetime


class ExpenseCreate(BaseModel):
    price_item_id: int
    quantity: int = Field(default=1, ge=1, le=1000)


class ExtraExpenseOut(ORMModel):
    id: int
    price_item: PriceItemOut
    quantity: int
    total: Price


class AppointmentOut(ORMModel):
    id: int
    client: PersonBrief
    employee: PersonBrief
    service: ServiceOut
    start_time: datetime
    end_time: datetime
    status: AppointmentStatus
    created_at: datetime
    extra_expenses: list[ExtraExpenseOut] = []
    extras_total: Price = Decimal("0")
    total_cost: Price = Decimal("0")  # цена услуги + дополнительные расходы


class BusySlot(BaseModel):
    start_time: datetime
    end_time: datetime
