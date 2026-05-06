import bcrypt
from sqlalchemy.orm import Session
from . import models, schemas

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (БЕЗ PASSLIB) ---

def get_password_hash(password: str) -> str:
    # Превращаем пароль в байты
    pwd_bytes = password.encode('utf-8')
    # Генерируем "соль" и хешируем
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    # Возвращаем строку для хранения в БД
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        # Сравниваем введенный пароль с хешем из базы
        return bcrypt.checkpw(
            plain_password.encode('utf-8'), 
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

# --- USER ---
def create_user(db: Session, user: schemas.UserCreate):
    # Используем нашу новую функцию хеширования
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        email=user.email, 
        password_hash=hashed_password, 
        name=user.name
    )
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
def get_capsules(db: Session, user_id: int):
    return db.query(models.Capsule).filter(models.Capsule.user_id == user_id).all()
