from sqlalchemy.orm import Session
from . import models, schemas
from passlib.context import CryptContext

# Настройка шифрования
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# --- USER ---
def create_user(db: Session, user: schemas.UserCreate):
    # ТЕПЕРЬ ШИФРУЕМ ПАРОЛЬ ПО-НАСТОЯЩЕМУ
    hashed_password = get_password_hash(user.password)
    db_user = models.User(email=user.email, password_hash=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

# --- ITEMS ---
def create_item(db: Session, item: schemas.ItemCreate, user_id: int, image_path: str):
    db_item = models.Item(
        **item.dict(),
        user_id=user_id,
        image_path=image_path
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

def get_items(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Item).filter(models.Item.user_id == user_id).offset(skip).limit(limit).all()

# --- CAPSULES ---
def create_capsule(db: Session, capsule: schemas.CapsuleCreate, user_id: int):
    # ... старая логика, если используется ...
    # Но сейчас мы используем логику в main.py, так что тут можно оставить заглушку
    pass 

def get_capsules(db: Session, user_id: int):
    return db.query(models.Capsule).filter(models.Capsule.user_id == user_id).all()