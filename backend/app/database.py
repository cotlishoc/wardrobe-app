from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

# Проверяем, находимся ли мы на сервере Hugging Face (есть ли папка бакета)
IS_CLOUD = os.path.exists("/data")

if IS_CLOUD:
    # Настройки для Hugging Face
    SQLALCHEMY_DATABASE_URL = "sqlite:////data/wardrobe.db"
    # Для SQLite нужен специальный аргумент для потоков
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
    print("LOG: Using Cloud SQLite Connection on /data")
else:
    # Твои локальные настройки (MySQL)
    DB_USER = os.getenv("DB_USER", "root")
    DB_PASSWORD = os.getenv("DB_PASSWORD", "")
    DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
    DB_PORT = os.getenv("DB_PORT", "3306")
    DB_NAME = os.getenv("DB_NAME", "wardrobe")
    
    SQLALCHEMY_DATABASE_URL = f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    print("LOG: Using Local MySQL Connection")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()