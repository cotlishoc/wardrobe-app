from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT") # Важно: в .env дома должно быть 3306, в облаке 5432
DB_NAME = os.getenv("DB_NAME")

# --- УМНЫЙ ВЫБОР БАЗЫ ДАННЫХ ---
if str(DB_PORT) == "5432":
    # Если порт 5432 - это PostgreSQL (для Amvera)
    SQLALCHEMY_DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    print("LOG: Using PostgreSQL Connection")
else:
    # Во всех остальных случаях (3306) - это MySQL (для дома)
    SQLALCHEMY_DATABASE_URL = f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    print("LOG: Using MySQL Connection")

# Создание движка
engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()