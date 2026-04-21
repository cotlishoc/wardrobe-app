from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table, TIMESTAMP
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

# Связь "многие ко многим" для капсул
capsule_items = Table(
    'capsule_items',
    Base.metadata,
    Column('capsule_id', Integer, ForeignKey('capsules.id', ondelete="CASCADE"), primary_key=True),
    Column('item_id', Integer, ForeignKey('items.id', ondelete="CASCADE"), primary_key=True)
)

# --- ТАБЛИЦЫ-СПРАВОЧНИКИ ---
class Category(Base):
    __tablename__ = "categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    items = relationship("Item", back_populates="category_rel")

class Color(Base):
    __tablename__ = "colors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    items = relationship("Item", back_populates="color_rel")

class Style(Base):
    __tablename__ = "styles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    items = relationship("Item", back_populates="style_rel")

class Season(Base):
    __tablename__ = "seasons"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    items = relationship("Item", back_populates="season_rel")

class Fit(Base): # Базовый, Слим, Оверсайз
    __tablename__ = "fits"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    items = relationship("Item", back_populates="fit_rel")

# --- ОСНОВНЫЕ ТАБЛИЦЫ ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(100))
    items = relationship("Item", back_populates="owner")
    capsules = relationship("Capsule", back_populates="owner")

class Item(Base):
    __tablename__ = "items"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    image_path = Column(String(255))
    
    # Ссылки на ID (Foreign Keys)
    category_id = Column(Integer, ForeignKey("categories.id"))
    color_id = Column(Integer, ForeignKey("colors.id"))
    style_id = Column(Integer, ForeignKey("styles.id"))
    season_id = Column(Integer, ForeignKey("seasons.id"))
    fit_id = Column(Integer, ForeignKey("fits.id"))

    # Отношения (чтобы легко доставать названия вместо цифр)
    owner = relationship("User", back_populates="items")
    category_rel = relationship("Category", back_populates="items")
    color_rel = relationship("Color", back_populates="items")
    style_rel = relationship("Style", back_populates="items")
    season_rel = relationship("Season", back_populates="items")
    fit_rel = relationship("Fit", back_populates="items")
    capsules = relationship("Capsule", secondary=capsule_items, back_populates="items")

class Capsule(Base):
    __tablename__ = "capsules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    image_path = Column(String(255))
    layout = Column(Text)
    owner = relationship("User", back_populates="capsules")
    items = relationship("Item", secondary=capsule_items, back_populates="capsules")