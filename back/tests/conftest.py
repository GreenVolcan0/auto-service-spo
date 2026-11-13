"""Общие фикстуры. Тесты идут на SQLite в памяти — PostgreSQL и Docker для них не нужны."""
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.enums import Role
from app.main import app
from app.models import User
from app.security import hash_password

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin12345"
PASSWORD = "password123"


def at(days: int = 2, hour: int = 10, minute: int = 0) -> datetime:
    """Момент в будущем (UTC): через `days` дней в hour:minute."""
    base = datetime.now(timezone.utc) + timedelta(days=days)
    return base.replace(hour=hour, minute=minute, second=0, microsecond=0)


@pytest.fixture()
def session_factory():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    yield sessionmaker(bind=engine, expire_on_commit=False)
    engine.dispose()


@pytest.fixture()
def client(session_factory):
    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Без `with` lifespan (инициализация PostgreSQL) не запускается
    yield TestClient(app)
    app.dependency_overrides.clear()


def login(client: TestClient, email: str, password: str = PASSWORD) -> dict:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.fixture()
def admin(client, session_factory) -> dict:
    with session_factory() as db:
        db.add(User(name="Админ", email=ADMIN_EMAIL, password_hash=hash_password(ADMIN_PASSWORD), role=Role.admin))
        db.commit()
    return login(client, ADMIN_EMAIL, ADMIN_PASSWORD)


def _make_employee(client, admin, name, email) -> dict:
    resp = client.post("/api/admin/employees", headers=admin, json={"name": name, "email": email, "password": PASSWORD})
    assert resp.status_code == 201, resp.text
    return {"id": resp.json()["id"], "headers": login(client, email)}


@pytest.fixture()
def employee(client, admin) -> dict:
    return _make_employee(client, admin, "Иван Петров", "ivan@example.com")


@pytest.fixture()
def employee2(client, admin) -> dict:
    return _make_employee(client, admin, "Пётр Сидоров", "petr@example.com")


def _make_client(client, name, email) -> dict:
    resp = client.post("/api/auth/register", json={"name": name, "email": email, "password": PASSWORD})
    assert resp.status_code == 201, resp.text
    return {"id": resp.json()["id"], "headers": login(client, email)}


@pytest.fixture()
def client_user(client) -> dict:
    return _make_client(client, "Анна Клиент", "anna@example.com")


@pytest.fixture()
def client_user2(client) -> dict:
    return _make_client(client, "Олег Клиент", "oleg@example.com")


@pytest.fixture()
def service(client, admin) -> dict:
    """Услуга длительностью 60 минут, цена 1500."""
    resp = client.post("/api/services", headers=admin,
                       json={"name": "Замена масла", "description": "Масло и фильтр", "duration": 60, "price": 1500})
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def price_item(client, admin) -> dict:
    """Позиция прайса: моторное масло, 700 за единицу."""
    resp = client.post("/api/price-items", headers=admin, json={"name": "Моторное масло, 1 л", "price": 700})
    assert resp.status_code == 201, resp.text
    return resp.json()


def book(client, headers, employee_id, service_id, start: datetime):
    """Создать запись клиентом; возвращает Response."""
    return client.post(
        "/api/appointments",
        headers=headers,
        json={"employee_id": employee_id, "service_id": service_id, "start_time": start.isoformat()},
    )
