from tests.conftest import PASSWORD, at, book


def test_register_client(client):
    """TC-01 | Регистрация клиента
    Ожидается: 201, роль client, пароль в ответе не возвращается."""
    resp = client.post("/api/auth/register", json={"name": "Анна", "email": "Anna@Example.com", "password": PASSWORD})
    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "client"
    assert body["email"] == "anna@example.com"  # email приводится к нижнему регистру
    assert "password" not in body and "password_hash" not in body


def test_register_cannot_choose_admin_role(client):
    """TC-02 | Через регистрацию нельзя получить роль admin или employee
    Ожидается: передача role игнорируется, создаётся client."""
    resp = client.post(
        "/api/auth/register",
        json={"name": "Хакер", "email": "hacker@example.com", "password": PASSWORD, "role": "admin"},
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "client"


def test_register_duplicate_email(client, client_user):
    """TC-03 | Регистрация с уже занятым email
    Ожидается: 409."""
    resp = client.post("/api/auth/register", json={"name": "Дубль", "email": "anna@example.com", "password": PASSWORD})
    assert resp.status_code == 409


def test_register_validation(client):
    """TC-04 | Валидация регистрации: короткий пароль и некорректный email
    Ожидается: 422 в обоих случаях."""
    short = client.post("/api/auth/register", json={"name": "А", "email": "a@example.com", "password": "123"})
    bad_email = client.post("/api/auth/register", json={"name": "А", "email": "not-an-email", "password": PASSWORD})
    assert short.status_code == 422
    assert bad_email.status_code == 422


def test_login_success_and_wrong_password(client, client_user):
    """TC-05 | Вход: верные и неверные данные
    Ожидается: 200 с access_token; при неверном пароле 401."""
    ok = client.post("/api/auth/login", json={"email": "anna@example.com", "password": PASSWORD})
    assert ok.status_code == 200
    assert ok.json()["access_token"]
    bad = client.post("/api/auth/login", json={"email": "anna@example.com", "password": "wrong-password"})
    assert bad.status_code == 401


def test_protected_endpoint_requires_token(client):
    """TC-06 | Доступ без токена к защищённому эндпоинту
    Ожидается: 401."""
    assert client.get("/api/appointments/my").status_code == 401
    assert client.get("/api/users/me").status_code == 401


def test_update_profile_and_change_password(client, client_user):
    """TC-07 | Редактирование профиля и смена пароля
    Ожидается: имя обновляется; после смены пароля вход возможен только с новым."""
    headers = client_user["headers"]
    resp = client.patch("/api/users/me", headers=headers, json={"name": "Анна Новая"})
    assert resp.status_code == 200 and resp.json()["name"] == "Анна Новая"

    wrong = client.post("/api/users/me/password", headers=headers,
                        json={"old_password": "wrong-password", "new_password": "newpassword1"})
    assert wrong.status_code == 400
    ok = client.post("/api/users/me/password", headers=headers,
                     json={"old_password": PASSWORD, "new_password": "newpassword1"})
    assert ok.status_code == 204
    assert client.post("/api/auth/login", json={"email": "anna@example.com", "password": PASSWORD}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "anna@example.com", "password": "newpassword1"}).status_code == 200


def test_roles_are_enforced(client, admin, employee, client_user, service):
    """TC-08 | Разграничение прав: клиент и сотрудник не могут выполнять админские и чужие операции
    Ожидается: 403 на каждый запрещённый запрос."""
    c, e = client_user["headers"], employee["headers"]
    assert client.post("/api/admin/employees", headers=c, json={"name": "X", "email": "x@example.com", "password": PASSWORD}).status_code == 403
    assert client.get("/api/admin/schedule", headers=e).status_code == 403
    assert client.post("/api/services", headers=c, json={"name": "Новая", "duration": 30, "price": 100}).status_code == 403
    assert client.post("/api/services", headers=e, json={"name": "Новая", "duration": 30, "price": 100}).status_code == 403
    # сотрудник не создаёт заявки, клиент не принимает
    assert book(client, e, employee["id"], service["id"], at()).status_code == 403
    assert client.get("/api/appointments/schedule", headers=c).status_code == 403

