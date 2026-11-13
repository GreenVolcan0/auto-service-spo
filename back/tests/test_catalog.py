from tests.conftest import PASSWORD, at, book, login


def test_price_list_is_public(client, service, price_item):
    """TC-09 | Просмотр прайс-листа без авторизации
    Ожидается: 200, в ответе услуги и позиции дополнительных расходов."""
    resp = client.get("/api/price-list")
    assert resp.status_code == 200
    body = resp.json()
    assert [s["name"] for s in body["services"]] == ["Замена масла"]
    assert body["services"][0]["price"] == 1500
    assert [i["name"] for i in body["price_items"]] == ["Моторное масло, 1 л"]


def test_admin_service_crud(client, admin):
    """TC-10 | Админ: создание, изменение и удаление услуги
    Ожидается: 201 → 200 с новой ценой → 204 → 404 при повторном чтении."""
    created = client.post("/api/services", headers=admin, json={"name": "Шиномонтаж", "duration": 90, "price": 3000})
    assert created.status_code == 201
    sid = created.json()["id"]
    updated = client.patch(f"/api/services/{sid}", headers=admin, json={"price": 3200})
    assert updated.status_code == 200 and updated.json()["price"] == 3200
    assert client.delete(f"/api/services/{sid}", headers=admin).status_code == 204
    assert client.get(f"/api/services/{sid}").status_code == 404


def test_service_validation(client, admin):
    """TC-11 | Валидация услуги: отрицательная цена, нулевая длительность, дубль названия
    Ожидается: 422, 422, 409."""
    assert client.post("/api/services", headers=admin, json={"name": "A", "duration": 30, "price": -1}).status_code == 422
    assert client.post("/api/services", headers=admin, json={"name": "B", "duration": 0, "price": 100}).status_code == 422
    ok = {"name": "Уникальная", "duration": 30, "price": 100}
    assert client.post("/api/services", headers=admin, json=ok).status_code == 201
    assert client.post("/api/services", headers=admin, json=ok).status_code == 409


def test_cannot_delete_service_used_in_appointment(client, admin, employee, client_user, service):
    """TC-12 | Нельзя удалить услугу, на которую есть записи
    Ожидается: 409."""
    assert book(client, client_user["headers"], employee["id"], service["id"], at()).status_code == 201
    assert client.delete(f"/api/services/{service['id']}", headers=admin).status_code == 409


def test_admin_creates_employee_who_can_login(client, admin):
    """TC-13 | Админ создаёт сотрудника, сотрудник входит в систему
    Ожидается: 201, роль employee; вход успешен; повторный email → 409."""
    payload = {"name": "Иван", "email": "ivan@example.com", "password": PASSWORD}
    resp = client.post("/api/admin/employees", headers=admin, json=payload)
    assert resp.status_code == 201 and resp.json()["role"] == "employee"
    assert login(client, "ivan@example.com")
    assert client.post("/api/admin/employees", headers=admin, json=payload).status_code == 409


def test_deactivated_employee_cannot_login_or_be_booked(client, admin, employee, client_user, service):
    """TC-14 | Деактивированный сотрудник не входит и не доступен для записи
    Ожидается: вход 403; запись к нему 404; в списке сотрудников его нет."""
    resp = client.patch(f"/api/admin/employees/{employee['id']}", headers=admin, json={"is_active": False})
    assert resp.status_code == 200
    assert client.post("/api/auth/login", json={"email": "ivan@example.com", "password": PASSWORD}).status_code == 403
    assert book(client, client_user["headers"], employee["id"], service["id"], at()).status_code == 404
    assert client.get("/api/employees", headers=client_user["headers"]).json() == []


def test_delete_employee_rules(client, admin, employee, employee2, client_user, service):
    """TC-15 | Удаление сотрудника: с записями нельзя, без записей можно
    Ожидается: 409 для сотрудника с записью; 204 для свободного."""
    assert book(client, client_user["headers"], employee["id"], service["id"], at()).status_code == 201
    assert client.delete(f"/api/admin/employees/{employee['id']}", headers=admin).status_code == 409
    assert client.delete(f"/api/admin/employees/{employee2['id']}", headers=admin).status_code == 204
