from datetime import datetime, timedelta

from tests.conftest import at, book


def test_create_appointment_calculates_end_time(client, employee, client_user, service):
    """TC-16 | Клиент создаёт заявку на услугу
    Ожидается: 201, статус new, время окончания = начало + длительность услуги (60 мин), итог = цена услуги."""
    resp = book(client, client_user["headers"], employee["id"], service["id"], at(hour=10))
    assert resp.status_code == 201
    body = resp.json()
    assert body["status"] == "new"
    assert body["client"]["id"] == client_user["id"] and body["employee"]["id"] == employee["id"]
    start, end = datetime.fromisoformat(body["start_time"]), datetime.fromisoformat(body["end_time"])
    assert end - start == timedelta(minutes=60)
    assert body["total_cost"] == 1500


def test_overlapping_appointment_is_rejected(client, employee, client_user, client_user2, service):
    """TC-17 | У одного сотрудника нельзя записать два пересекающихся по времени визита
    Ожидается: запись 10:00–11:00 есть; 10:30 → 409; 09:30 → 409; 10:00 → 409."""
    h = client_user["headers"]
    assert book(client, h, employee["id"], service["id"], at(hour=10)).status_code == 201
    other = client_user2["headers"]
    assert book(client, other, employee["id"], service["id"], at(hour=10, minute=30)).status_code == 409
    assert book(client, other, employee["id"], service["id"], at(hour=9, minute=30)).status_code == 409
    assert book(client, other, employee["id"], service["id"], at(hour=10)).status_code == 409


def test_back_to_back_appointments_are_allowed(client, employee, client_user, client_user2, service):
    """TC-18 | Записи «встык» не конфликтуют
    Ожидается: 10:00–11:00 и 11:00–12:00 у одного сотрудника создаются (201)."""
    assert book(client, client_user["headers"], employee["id"], service["id"], at(hour=10)).status_code == 201
    assert book(client, client_user2["headers"], employee["id"], service["id"], at(hour=11)).status_code == 201


def test_same_time_with_different_employees_is_allowed(client, employee, employee2, client_user, client_user2, service):
    """TC-19 | Одно и то же время у разных сотрудников
    Ожидается: обе записи создаются (201)."""
    assert book(client, client_user["headers"], employee["id"], service["id"], at(hour=10)).status_code == 201
    assert book(client, client_user2["headers"], employee2["id"], service["id"], at(hour=10)).status_code == 201


def test_appointment_validation(client, employee, client_user, service):
    """TC-20 | Валидация заявки: время в прошлом, несуществующая услуга/сотрудник
    Ожидается: 422 для прошлого времени; 404 для несуществующих услуги и сотрудника."""
    h = client_user["headers"]
    assert book(client, h, employee["id"], service["id"], at(days=-1)).status_code == 422
    assert book(client, h, employee["id"], 9999, at()).status_code == 404
    assert book(client, h, 9999, service["id"], at()).status_code == 404


def test_employee_accepts_appointment(client, employee, client_user, service):
    """TC-21 | Сотрудник принимает заявку
    Ожидается: new → accepted; повторное принятие → 409."""
    appt = book(client, client_user["headers"], employee["id"], service["id"], at()).json()
    resp = client.post(f"/api/appointments/{appt['id']}/accept", headers=employee["headers"])
    assert resp.status_code == 200 and resp.json()["status"] == "accepted"
    again = client.post(f"/api/appointments/{appt['id']}/accept", headers=employee["headers"])
    assert again.status_code == 409


def test_employee_cannot_accept_foreign_appointment(client, employee, employee2, client_user, service):
    """TC-22 | Сотрудник не может принять запись другого сотрудника
    Ожидается: 403, статус записи остаётся new."""
    appt = book(client, client_user["headers"], employee["id"], service["id"], at()).json()
    resp = client.post(f"/api/appointments/{appt['id']}/accept", headers=employee2["headers"])
    assert resp.status_code == 403
    check = client.get(f"/api/appointments/{appt['id']}", headers=client_user["headers"]).json()
    assert check["status"] == "new"


def test_employee_sees_only_own_schedule(client, employee, employee2, client_user, client_user2, service):
    """TC-23 | Сотрудник видит только своё расписание
    Ожидается: в /appointments/schedule только записи этого сотрудника; чужую запись напрямую открыть нельзя (404)."""
    mine = book(client, client_user["headers"], employee["id"], service["id"], at(hour=10)).json()
    foreign = book(client, client_user2["headers"], employee2["id"], service["id"], at(hour=10)).json()
    schedule = client.get("/api/appointments/schedule", headers=employee["headers"]).json()
    assert schedule["total"] == 1
    assert [a["id"] for a in schedule["items"]] == [mine["id"]]
    assert client.get(f"/api/appointments/{foreign['id']}", headers=employee["headers"]).status_code == 404


def test_client_sees_only_own_appointments(client, employee, client_user, client_user2, service):
    """TC-24 | Клиент видит только свои записи
    Ожидается: в /appointments/my только свои; чужую запись напрямую открыть нельзя (404)."""
    mine = book(client, client_user["headers"], employee["id"], service["id"], at(hour=10)).json()
    other = book(client, client_user2["headers"], employee["id"], service["id"], at(hour=12)).json()
    listing = client.get("/api/appointments/my", headers=client_user["headers"]).json()
    assert [a["id"] for a in listing["items"]] == [mine["id"]]
    assert client.get(f"/api/appointments/{other['id']}", headers=client_user["headers"]).status_code == 404


def test_employee_adds_extra_expense(client, employee, client_user, service, price_item):
    """TC-25 | Сотрудник добавляет дополнительный расход к принятой записи
    Ожидается: сумма расхода = цена позиции × количество (700 × 3 = 2100); итог = 1500 + 2100 = 3600."""
    appt = book(client, client_user["headers"], employee["id"], service["id"], at()).json()
    client.post(f"/api/appointments/{appt['id']}/accept", headers=employee["headers"])
    resp = client.post(
        f"/api/appointments/{appt['id']}/expenses",
        headers=employee["headers"],
        json={"price_item_id": price_item["id"], "quantity": 3},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["extra_expenses"][0]["total"] == 2100
    assert body["extras_total"] == 2100
    assert body["total_cost"] == 3600


def test_extra_expense_rules(client, employee, employee2, client_user, service, price_item):
    """TC-26 | Ограничения на дополнительные расходы
    Ожидается: к непринятой записи 409; чужой сотрудник 403; клиент 403; количество 0 → 422."""
    appt = book(client, client_user["headers"], employee["id"], service["id"], at()).json()
    url = f"/api/appointments/{appt['id']}/expenses"
    body = {"price_item_id": price_item["id"], "quantity": 1}
    assert client.post(url, headers=employee["headers"], json=body).status_code == 409  # ещё не принята
    client.post(f"/api/appointments/{appt['id']}/accept", headers=employee["headers"])
    assert client.post(url, headers=employee2["headers"], json=body).status_code == 403
    assert client.post(url, headers=client_user["headers"], json=body).status_code == 403
    assert client.post(url, headers=employee["headers"], json={**body, "quantity": 0}).status_code == 422


def test_admin_cancels_appointment_and_slot_is_freed(client, admin, employee, client_user, client_user2, service):
    """TC-27 | Админ отменяет запись, время сотрудника освобождается
    Ожидается: статус cancelled; повторная отмена 409; на то же время теперь можно записаться (201)."""
    appt = book(client, client_user["headers"], employee["id"], service["id"], at(hour=10)).json()
    resp = client.post(f"/api/admin/appointments/{appt['id']}/cancel", headers=admin)
    assert resp.status_code == 200 and resp.json()["status"] == "cancelled"
    assert client.post(f"/api/admin/appointments/{appt['id']}/cancel", headers=admin).status_code == 409
    assert book(client, client_user2["headers"], employee["id"], service["id"], at(hour=10)).status_code == 201


def test_only_admin_can_cancel(client, employee, client_user, service):
    """TC-28 | Отменять записи может только администратор
    Ожидается: клиент и сотрудник получают 403."""
    appt = book(client, client_user["headers"], employee["id"], service["id"], at()).json()
    url = f"/api/admin/appointments/{appt['id']}/cancel"
    assert client.post(url, headers=client_user["headers"]).status_code == 403
    assert client.post(url, headers=employee["headers"]).status_code == 403


def test_admin_views_schedules(client, admin, employee, employee2, client_user, client_user2, service):
    """TC-29 | Админ просматривает расписания всех сотрудников и фильтрует по сотруднику
    Ожидается: без фильтра 2 записи; с employee_id — одна."""
    book(client, client_user["headers"], employee["id"], service["id"], at(hour=10))
    book(client, client_user2["headers"], employee2["id"], service["id"], at(hour=10))
    everyone = client.get("/api/admin/schedule", headers=admin).json()
    assert everyone["total"] == 2
    one = client.get("/api/admin/schedule", params={"employee_id": employee["id"]}, headers=admin).json()
    assert one["total"] == 1 and one["items"][0]["employee"]["id"] == employee["id"]


def test_busy_slots(client, employee, client_user, service):
    """TC-30 | Занятые интервалы сотрудника на день (для выбора свободного времени)
    Ожидается: после записи 10:00–11:00 интервал виден; отменённые не показываются."""
    start = at(days=3, hour=10)
    book(client, client_user["headers"], employee["id"], service["id"], start)
    resp = client.get(f"/api/employees/{employee['id']}/busy", params={"day": start.date().isoformat()},
                      headers=client_user["headers"])
    assert resp.status_code == 200
    slots = resp.json()
    assert len(slots) == 1
    assert datetime.fromisoformat(slots[0]["end_time"]) - datetime.fromisoformat(slots[0]["start_time"]) == timedelta(minutes=60)
    other_day = (start + timedelta(days=1)).date().isoformat()
    assert client.get(f"/api/employees/{employee['id']}/busy", params={"day": other_day},
                      headers=client_user["headers"]).json() == []
