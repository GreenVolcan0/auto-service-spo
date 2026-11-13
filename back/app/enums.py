import enum


class Role(enum.StrEnum):
    client = "client"
    employee = "employee"
    admin = "admin"


class AppointmentStatus(enum.StrEnum):
    new = "new"              # создана клиентом, ждёт принятия сотрудником
    accepted = "accepted"    # принята сотрудником
    cancelled = "cancelled"  # отменена администратором
