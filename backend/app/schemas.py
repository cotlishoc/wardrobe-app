from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- ITEM SCHEMAS ---
class ItemBase(BaseModel):
    name: str
    category: Optional[str] = None
    color: Optional[str] = None
    style: Optional[str] = None
    season: Optional[str] = None

class ItemCreate(ItemBase):
    pass # image_path добавляем вручную при загрузке

class ItemResponse(BaseModel):
    id: int
    name: str
    image_path: str
    # Эти поля будут автоматически заполняться строками из связанных моделей
    category: Optional[str] = None
    color: Optional[str] = None
    style: Optional[str] = None
    season: Optional[str] = None
    fit: Optional[str] = None

    class Config:
        from_attributes = True

    # Специальный метод для преобразования объекта БД в схему
    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            name=obj.name,
            image_path=obj.image_path,
            category=obj.category_rel.name if obj.category_rel else None,
            color=obj.color_rel.name if obj.color_rel else None,
            style=obj.style_rel.name if obj.style_rel else None,
            season=obj.season_rel.name if obj.season_rel else None,
            fit=obj.fit_rel.name if obj.fit_rel else None
        )

# --- CAPSULE SCHEMAS ---
class CapsuleBase(BaseModel):
    name: str
    goal: Optional[str] = None
    description: Optional[str] = None

class CapsuleCreate(CapsuleBase):
    item_ids: List[int] # Список ID вещей, которые входят в капсулу

class CapsuleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    image_path: Optional[str] = None # Добавили
    layout: Optional[str] = None     # Добавили
    created_at: datetime
    items: List[ItemResponse] = []

    class Config:
        from_attributes = True

# --- USER SCHEMAS ---
class UserCreate(BaseModel):
    email: str
    password: str
    name: str  # <--- Теперь обязательно требуем имя при регистрации

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = "User" # <--- Возвращаем имя

    class Config:
        from_attributes = True