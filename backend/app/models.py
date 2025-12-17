from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

# Промежуточная таблица для связи "Многие ко многим" (Капсула <-> Одежда)
capsule_items = Table(
    'capsule_items',
    Base.metadata,
    Column('capsule_id', Integer, ForeignKey('capsules.id', ondelete="CASCADE"), primary_key=True),
    Column('item_id', Integer, ForeignKey('items.id', ondelete="CASCADE"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

    items = relationship("Item", back_populates="owner")
    capsules = relationship("Capsule", back_populates="owner")

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50))
    color = Column(String(50))
    style = Column(String(50))
    season = Column(String(50))
    image_path = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.now())

    owner = relationship("User", back_populates="items")
    # Связь с капсулами через промежуточную таблицу
    capsules = relationship("Capsule", secondary=capsule_items, back_populates="items")

class Capsule(Base):
    __tablename__ = "capsules"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    
    # НОВЫЕ ПОЛЯ
    image_path = Column(String(255)) # Скриншот капсулы
    layout = Column(Text)            # JSON с координатами (храним как длинный текст)
    
    description = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())

    owner = relationship("User", back_populates="capsules")
    items = relationship("Item", secondary=capsule_items, back_populates="capsules")