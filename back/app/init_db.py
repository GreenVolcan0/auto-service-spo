import time
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401  — регистрирует таблицы в Base.metadata
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.enums import Role
from app.models import PriceItem, Service, User
from app.security import hash_password


def wait_for_db(attempts: int = 30, delay: float = 2.0) -> None:
    """БД в docker-compose может подняться позже бэкенда — ждём."""
    for _ in range(attempts):
        try:
            with engine.connect():
                return
        except OperationalError:
            time.sleep(delay)
    raise RuntimeError("Не удалось подключиться к базе данных")


def create_first_admin() -> None:
    """Первый администратор создаётся при инициализации БД (через регистрацию админом стать нельзя)."""
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == Role.admin).limit(1)):
            return
        db.add(
            User(
                name=settings.first_admin_name,
                email=settings.first_admin_email.lower(),
                password_hash=hash_password(settings.first_admin_password),
                role=Role.admin,
            )
        )
        db.commit()


def seed_demo_data() -> None:
    """Демо-данные для показа (SEED_DEMO_DATA=true): услуги, позиции прайса, два сотрудника."""
    with SessionLocal() as db:
        if db.scalar(select(Service.id).limit(1)):
            return
        db.add_all(
            [
                Service(name="Замена масла", description="Замена моторного масла и фильтра", duration=30, price=Decimal("1500")),
                Service(name="Диагностика подвески", description="Осмотр и проверка подвески", duration=60, price=Decimal("2000")),
                Service(name="Шиномонтаж", description="Сезонная замена шин, 4 колеса", duration=90, price=Decimal("3000")),
                PriceItem(name="Моторное масло, 1 л", price=Decimal("700")),
                PriceItem(name="Масляный фильтр", price=Decimal("450")),
                PriceItem(name="Тормозные колодки (комплект)", price=Decimal("3500")),
            ]
        )
        for name, email in (("Иван Петров", "ivan@example.com"), ("Пётр Сидоров", "petr@example.com")):
            if not db.scalar(select(User.id).where(User.email == email)):
                db.add(User(name=name, email=email, password_hash=hash_password("employee123"), role=Role.employee))
        db.commit()


def init_db() -> None:
    wait_for_db()
    Base.metadata.create_all(engine)
    create_first_admin()
    if settings.seed_demo_data:
        seed_demo_data()
