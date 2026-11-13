from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.enums import Role
from app.models import Appointment, ExtraExpense, PriceItem, Service, User
from app.schemas import PriceItemIn, PriceItemOut, PriceItemUpdate, PriceListOut, ServiceIn, ServiceOut, ServiceUpdate

# Прайс-лист состоит из двух частей: услуги (то, на что записываются) и
# позиции для дополнительных расходов (то, что сотрудник добавляет к записи).
router = APIRouter(tags=["price-list"])

AdminUser = Depends(require_roles(Role.admin))


@router.get("/price-list", response_model=PriceListOut)
def get_price_list(db: Session = Depends(get_db)):
    """Общий прайс-лист: услуги и позиции доп. расходов. Доступен без авторизации."""
    return PriceListOut(
        services=db.scalars(select(Service).order_by(Service.name)).all(),
        price_items=db.scalars(select(PriceItem).order_by(PriceItem.name)).all(),
    )


# ---------------------------------------------------------------- услуги

@router.get("/services", response_model=list[ServiceOut])
def list_services(db: Session = Depends(get_db)):
    return db.scalars(select(Service).order_by(Service.name)).all()


@router.get("/services/{service_id}", response_model=ServiceOut)
def get_service(service_id: int, db: Session = Depends(get_db)):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Услуга не найдена")
    return service


@router.post("/services", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
def create_service(data: ServiceIn, admin: User = AdminUser, db: Session = Depends(get_db)):
    service = Service(name=data.name.strip(), description=data.description, duration=data.duration, price=data.price)
    db.add(service)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Услуга с таким названием уже существует")
    return service


@router.patch("/services/{service_id}", response_model=ServiceOut)
def update_service(service_id: int, data: ServiceUpdate, admin: User = AdminUser, db: Session = Depends(get_db)):
    """Изменение услуги не затрагивает уже созданные записи: их время окончания зафиксировано."""
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Услуга не найдена")
    changes = data.model_dump(exclude_unset=True)
    for required in ("name", "duration", "price"):
        if required in changes and changes[required] is None:
            del changes[required]
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    for field, value in changes.items():
        setattr(service, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Услуга с таким названием уже существует")
    return service


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(service_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    service = db.get(Service, service_id)
    if service is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Услуга не найдена")
    if db.scalar(select(Appointment.id).where(Appointment.service_id == service_id).limit(1)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Услуга используется в записях, удалить нельзя")
    db.delete(service)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------- позиции прайса (доп. расходы)

@router.get("/price-items", response_model=list[PriceItemOut])
def list_price_items(db: Session = Depends(get_db)):
    return db.scalars(select(PriceItem).order_by(PriceItem.name)).all()


@router.post("/price-items", response_model=PriceItemOut, status_code=status.HTTP_201_CREATED)
def create_price_item(data: PriceItemIn, admin: User = AdminUser, db: Session = Depends(get_db)):
    item = PriceItem(name=data.name.strip(), price=data.price)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Позиция с таким названием уже существует")
    return item


@router.patch("/price-items/{item_id}", response_model=PriceItemOut)
def update_price_item(item_id: int, data: PriceItemUpdate, admin: User = AdminUser, db: Session = Depends(get_db)):
    """Новая цена действует для будущих расходов; уже добавленные сохраняют сумму."""
    item = db.get(PriceItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    changes = data.model_dump(exclude_none=True)
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    for field, value in changes.items():
        setattr(item, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Позиция с таким названием уже существует")
    return item


@router.delete("/price-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_price_item(item_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    item = db.get(PriceItem, item_id)
    if item is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Позиция не найдена")
    if db.scalar(select(ExtraExpense.id).where(ExtraExpense.price_item_id == item_id).limit(1)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Позиция используется в дополнительных расходах, удалить нельзя")
    db.delete(item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
