# Тест-кейсы бэкенда

Каждый тест-кейс реализован автотестом (pytest). Таблица собрана из описаний тестов в `back/tests/`.

Запуск: `cd back && pip install -r requirements-dev.txt && pytest -v`. Тесты работают на SQLite в памяти, PostgreSQL и Docker не нужны.

Колонку «Результат» заполните после прогона (пройден / не пройден, номер исправленной ошибки) — это основа отчёта о тестировании.

| ID | Что проверяем | Ожидаемый результат | Автотест | Результат |
|---|---|---|---|---|
| TC-01 | Регистрация клиента | 201, роль client, пароль в ответе не возвращается. | `test_auth.py::test_register_client` | |
| TC-02 | Через регистрацию нельзя получить роль admin или employee | передача role игнорируется, создаётся client. | `test_auth.py::test_register_cannot_choose_admin_role` | |
| TC-03 | Регистрация с уже занятым email | 409. | `test_auth.py::test_register_duplicate_email` | |
| TC-04 | Валидация регистрации: короткий пароль и некорректный email | 422 в обоих случаях. | `test_auth.py::test_register_validation` | |
| TC-05 | Вход: верные и неверные данные | 200 с access_token; при неверном пароле 401. | `test_auth.py::test_login_success_and_wrong_password` | |
| TC-06 | Доступ без токена к защищённому эндпоинту | 401. | `test_auth.py::test_protected_endpoint_requires_token` | |
| TC-07 | Редактирование профиля и смена пароля | имя обновляется; после смены пароля вход возможен только с новым. | `test_auth.py::test_update_profile_and_change_password` | |
| TC-08 | Разграничение прав: клиент и сотрудник не могут выполнять админские и чужие операции | 403 на каждый запрещённый запрос. | `test_auth.py::test_roles_are_enforced` | |
| TC-09 | Просмотр прайс-листа без авторизации | 200, в ответе услуги и позиции дополнительных расходов. | `test_catalog.py::test_price_list_is_public` | |
| TC-10 | Админ: создание, изменение и удаление услуги | 201 → 200 с новой ценой → 204 → 404 при повторном чтении. | `test_catalog.py::test_admin_service_crud` | |
| TC-11 | Валидация услуги: отрицательная цена, нулевая длительность, дубль названия | 422, 422, 409. | `test_catalog.py::test_service_validation` | |
| TC-12 | Нельзя удалить услугу, на которую есть записи | 409. | `test_catalog.py::test_cannot_delete_service_used_in_appointment` | |
| TC-13 | Админ создаёт сотрудника, сотрудник входит в систему | 201, роль employee; вход успешен; повторный email → 409. | `test_catalog.py::test_admin_creates_employee_who_can_login` | |
| TC-14 | Деактивированный сотрудник не входит и не доступен для записи | вход 403; запись к нему 404; в списке сотрудников его нет. | `test_catalog.py::test_deactivated_employee_cannot_login_or_be_booked` | |
| TC-15 | Удаление сотрудника: с записями нельзя, без записей можно | 409 для сотрудника с записью; 204 для свободного. | `test_catalog.py::test_delete_employee_rules` | |
| TC-16 | Клиент создаёт заявку на услугу | 201, статус new, время окончания = начало + длительность услуги (60 мин), итог = цена услуги. | `test_appointments.py::test_create_appointment_calculates_end_time` | |
| TC-17 | У одного сотрудника нельзя записать два пересекающихся по времени визита | запись 10:00–11:00 есть; 10:30 → 409; 09:30 → 409; 10:00 → 409. | `test_appointments.py::test_overlapping_appointment_is_rejected` | |
| TC-18 | Записи «встык» не конфликтуют | 10:00–11:00 и 11:00–12:00 у одного сотрудника создаются (201). | `test_appointments.py::test_back_to_back_appointments_are_allowed` | |
| TC-19 | Одно и то же время у разных сотрудников | обе записи создаются (201). | `test_appointments.py::test_same_time_with_different_employees_is_allowed` | |
| TC-20 | Валидация заявки: время в прошлом, несуществующая услуга/сотрудник | 422 для прошлого времени; 404 для несуществующих услуги и сотрудника. | `test_appointments.py::test_appointment_validation` | |
| TC-21 | Сотрудник принимает заявку | new → accepted; повторное принятие → 409. | `test_appointments.py::test_employee_accepts_appointment` | |
| TC-22 | Сотрудник не может принять запись другого сотрудника | 403, статус записи остаётся new. | `test_appointments.py::test_employee_cannot_accept_foreign_appointment` | |
| TC-23 | Сотрудник видит только своё расписание | в /appointments/schedule только записи этого сотрудника; чужую запись напрямую открыть нельзя (404). | `test_appointments.py::test_employee_sees_only_own_schedule` | |
| TC-24 | Клиент видит только свои записи | в /appointments/my только свои; чужую запись напрямую открыть нельзя (404). | `test_appointments.py::test_client_sees_only_own_appointments` | |
| TC-25 | Сотрудник добавляет дополнительный расход к принятой записи | сумма расхода = цена позиции × количество (700 × 3 = 2100); итог = 1500 + 2100 = 3600. | `test_appointments.py::test_employee_adds_extra_expense` | |
| TC-26 | Ограничения на дополнительные расходы | к непринятой записи 409; чужой сотрудник 403; клиент 403; количество 0 → 422. | `test_appointments.py::test_extra_expense_rules` | |
| TC-27 | Админ отменяет запись, время сотрудника освобождается | статус cancelled; повторная отмена 409; на то же время теперь можно записаться (201). | `test_appointments.py::test_admin_cancels_appointment_and_slot_is_freed` | |
| TC-28 | Отменять записи может только администратор | клиент и сотрудник получают 403. | `test_appointments.py::test_only_admin_can_cancel` | |
| TC-29 | Админ просматривает расписания всех сотрудников и фильтрует по сотруднику | без фильтра 2 записи; с employee_id — одна. | `test_appointments.py::test_admin_views_schedules` | |
| TC-30 | Занятые интервалы сотрудника на день (для выбора свободного времени) | после записи 10:00–11:00 интервал виден; отменённые не показываются. | `test_appointments.py::test_busy_slots` | |
