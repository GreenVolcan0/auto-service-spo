from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas import PasswordChange, ProfileUpdate, UserOut
from app.security import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: ProfileUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Редактирование своего профиля (любая роль): имя и email."""
    changes = data.model_dump(exclude_none=True)
    if "email" in changes and changes["email"] != user.email:
        if db.scalar(select(User.id).where(User.email == changes["email"])):
            raise HTTPException(status.HTTP_409_CONFLICT, "Этот email уже занят")
    if "name" in changes:
        changes["name"] = changes["name"].strip()
    for field, value in changes.items():
        setattr(user, field, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Этот email уже занят")
    return user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(data: PasswordChange, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not verify_password(data.old_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Старый пароль указан неверно")
    user.password_hash = hash_password(data.new_password)
    db.commit()
