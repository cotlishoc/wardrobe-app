from pydantic import BaseModel
from typing import List, Optional

# --- ITEM SCHEMAS ---
class ItemBase(BaseModel):
    name: str
    category: Optional[str] = None
    color: Optional[str] = None
    style: Optional[str] = None
    season: Optional[str] = None
    fit: Optional[str] = None

class ItemCreate(ItemBase):
    pass

class ItemResponse(BaseModel):
    id: int
    name: str
    image_path: str
    category: Optional[str] = None
    color: Optional[str] = None
    style: Optional[str] = None
    season: Optional[str] = None
    fit: Optional[str] = None

    class Config:
        from_attributes = True

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

class CapsuleCreate(CapsuleBase):
    item_ids: List[int]
    occasion: Optional[str] = None 

class CapsuleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    image_path: Optional[str] = None
    layout: Optional[str] = None
    occasion: Optional[str] = None
    items: List[ItemResponse] = []

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, obj):
        return cls(
            id=obj.id,
            user_id=obj.user_id,
            name=obj.name,
            image_path=obj.image_path,
            layout=obj.layout,
            occasion=obj.occasion_rel.name if obj.occasion_rel else None,
            items=[ItemResponse.from_orm(item) for item in obj.items]
        )

# --- USER SCHEMAS ---
class UserCreate(BaseModel):
    email: str
    password: str
    name: str

class UserResponse(BaseModel):
    id: int
    email: str
    name: Optional[str] = "User"

    class Config:
        from_attributes = True

# --- OCCASION SCHEMAS ---
class OccasionResponse(BaseModel):
    id: int
    name: str
    default_style: Optional[str] = None
    class Config:
        from_attributes = True