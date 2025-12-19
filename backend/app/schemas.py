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

class ItemResponse(ItemBase):
    id: int
    user_id: int
    image_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

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