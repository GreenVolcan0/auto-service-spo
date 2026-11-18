import enum


class Role(enum.StrEnum):
    client = "client"
    employee = "employee"
    admin = "admin"


class AppointmentStatus(enum.StrEnum):
    new = "new"              # создана клиентом, ждёт принятия сотрудником
    accepted = "accepted"    # принята сотрудником
    completed = "completed"  # выполнена (работа сделана)
    paid = "paid"            # оплачена
    cancelled = "cancelled"  # отменена администратором
