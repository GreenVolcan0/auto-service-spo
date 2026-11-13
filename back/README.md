# Backend — Автосервис (запись на услуги)

Python 3.12 + FastAPI + SQLAlchemy 2.0 + PostgreSQL. Аутентификация: JWT + bcrypt. Роли: `client`, `employee`, `admin`.
Главная идея: клиент записывается на услугу к сотруднику, система не допускает пересечений записей по времени у одного сотрудника.

## Запуск

Из корня репозитория (нужен Docker):

```bash
docker compose up --build
```

- API: http://localhost:8000/api
- Swagger (интерактивная документация): http://localhost:8000/docs
- Администратор создаётся при старте: `admin@example.com` / `admin12345` (меняется через `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`).
- В docker-compose включены демо-данные (`SEED_DEMO_DATA=true`): 3 услуги, 3 позиции прайса и 2 сотрудника
  (`ivan@example.com`, `petr@example.com`, пароль `employee123`). Отключить: `SEED_DEMO_DATA=false`.

Локально без Docker:

```bash
cd back
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # поправьте DATABASE_URL
uvicorn app.main:app --reload
```

## Тесты

```bash
cd back
pip install -r requirements-dev.txt
pytest -v
```

30 автотестов покрывают авторизацию, права ролей, CRUD услуг и сотрудников, проверку пересечений записей, принятие заявок, дополнительные расходы и отмену.
Тесты идут на SQLite в памяти, PostgreSQL не нужен. Таблица тест-кейсов: [`docs/test-cases.md`](../docs/test-cases.md).

## Структура

```
back/
├── Dockerfile
├── requirements.txt / requirements-dev.txt
├── pytest.ini
├── .env.example
├── tests/               # pytest: conftest.py (фикстуры) + test_auth, test_catalog, test_appointments
└── app/
    ├── main.py          # приложение, CORS, подключение роутеров
    ├── config.py        # настройки из переменных окружения
    ├── database.py      # engine, сессия, Base
    ├── enums.py         # Role, AppointmentStatus
    ├── models.py        # User, Service, PriceItem, Appointment, ExtraExpense
    ├── schemas.py       # Pydantic-схемы запросов и ответов (валидация)
    ├── security.py      # bcrypt, JWT
    ├── deps.py          # get_current_user, require_roles
    ├── init_db.py       # создание таблиц, первого администратора, демо-данных
    ├── routers/         # auth, users, price_list, employees, appointments, admin
    └── services/        # appointments: проверка пересечений, блокировки, расчёт сумм
```

## API (префикс `/api`)

| Метод и путь | Доступ | Что делает |
|---|---|---|
| `POST /auth/register` | все | регистрация клиента (роль всегда `client`) |
| `POST /auth/login` | все | вход, возвращает JWT и пользователя |
| `GET/PATCH /users/me` | авторизованные | свой профиль (имя, email) |
| `POST /users/me/password` | авторизованные | смена пароля |
| `GET /price-list` | все | прайс-лист: услуги и позиции доп. расходов |
| `GET /services`, `GET /services/{id}` | все | услуги |
| `POST/PATCH/DELETE /services[/{id}]` | admin | управление услугами |
| `GET /price-items` | все | позиции прайса для доп. расходов |
| `POST/PATCH/DELETE /price-items[/{id}]` | admin | управление позициями прайса |
| `GET /employees` | авторизованные | активные сотрудники (выбор при записи) |
| `GET /employees/{id}/busy?day=YYYY-MM-DD` | авторизованные | занятые интервалы сотрудника на день |
| `POST /appointments` | client | создать заявку (`employee_id`, `service_id`, `start_time`) |
| `GET /appointments/my` | client | свои заявки |
| `GET /appointments/schedule` | employee | своё расписание (фильтры `status`, `date_from`, `date_to`) |
| `POST /appointments/{id}/accept` | employee | принять заявку (`new → accepted`) |
| `POST /appointments/{id}/expenses` | employee | добавить доп. расход (`price_item_id`, `quantity`) |
| `GET /appointments/{id}` | client / employee записи / admin | карточка записи |
| `POST/GET/PATCH/DELETE /admin/employees[/{id}]` | admin | аккаунты сотрудников |
| `GET /admin/schedule` | admin | расписания всех сотрудников (фильтры `employee_id`, `status`, даты) |
| `POST /admin/appointments/{id}/cancel` | admin | отменить запись |

Списки записей и сотрудников возвращают `{items, total, limit, offset}`. Токен: `Authorization: Bearer <token>`.

## Правила из аналитики и как они реализованы

- **Нет пересечений у сотрудника.** Интервал записи `[start_time, end_time)`, где `end_time = start_time + длительность услуги`.
  Новая запись отклоняется (409), если у сотрудника есть запись в статусе `new` или `accepted`, пересекающаяся по времени. Записи «встык» разрешены.
  Проверка и вставка идут под блокировкой строки сотрудника (`SELECT ... FOR UPDATE`), поэтому два клиента не займут одно время одновременно.
- **Одна запись — одна услуга.** В заявке одно поле `service_id`.
- **Сотрудник видит только своё расписание** (`/appointments/schedule` фильтрует по текущему сотруднику, чужую запись открыть нельзя). Админ видит все.
- **Сотрудник не может изменить время принятой записи** — в API нет метода изменения времени записи.
- **Дополнительные расходы** добавляет только сотрудник, только к принятой записи; сумма = цена позиции прайса × количество и фиксируется на момент добавления.
- **Админ** управляет сотрудниками, услугами и прайсом, смотрит расписания, отменяет записи (время при этом освобождается).
- **Безопасность.** Пароли — bcrypt, права проверяются на сервере в каждом запросе, деактивированный пользователь теряет доступ сразу.

## Принятые решения там, где аналитика неоднозначна

1. **Сотрудника выбирает клиент** при создании заявки (в диаграмме классов у записи есть `employee_id`). Для этого есть `GET /employees` и `GET /employees/{id}/busy`.
2. **Заявка со статусом `new` уже занимает время сотрудника** — так клиент сразу узнаёт о конфликте, а не после отказа сотрудника.
3. **Отменять запись может только администратор** (так в матрице доступа). Клиент отменить сам не может.
4. **Удаление сотрудника** возможно, только если у него нет записей; иначе API предлагает деактивировать аккаунт (`is_active=false`). Услугу и позицию прайса, которые используются, тоже нельзя удалить (409).
5. В запись добавлено поле `end_time` (нет в диаграмме классов) — оно нужно для проверки пересечений и не меняется, если потом поменять длительность услуги.
6. Рабочие часы и выходные в аналитике не описаны, поэтому ограничений по ним нет.

## Что не сделано

- Миграции Alembic (таблицы создаются при старте через `create_all`).
- Удаление и правка дополнительных расходов, отмена записи клиентом, уведомления — их нет в аналитике.
