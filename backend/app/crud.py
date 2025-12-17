from sqlalchemy.orm import Session
from . import models, schemas

# --- USER ---
def create_user(db: Session, user: schemas.UserCreate):
    # В MVP пока храним пароль как есть, в проде нужен хеш!
    fake_hashed_password = user.password + "notreallyhashed" 
    db_user = models.User(email=user.email, password_hash=fake_hashed_password)
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
    # 1. Создаем саму капсулу
    db_capsule = models.Capsule(
        name=capsule.name,
        goal=capsule.goal,
        description=capsule.description,
        user_id=user_id
    )
    
    # 2. Находим вещи по ID и добавляем их (связь многие-ко-многим)
    if capsule.item_ids:
        items = db.query(models.Item).filter(models.Item.id.in_(capsule.item_ids)).all()
        db_capsule.items = items

    db.add(db_capsule)
    db.commit()
    db.refresh(db_capsule)
    return db_capsule

def get_capsules(db: Session, user_id: int):
    return db.query(models.Capsule).filter(models.Capsule.user_id == user_id).all()