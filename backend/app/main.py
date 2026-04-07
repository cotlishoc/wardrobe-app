from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from jose import JWTError, jwt
from datetime import datetime, timedelta
import shutil
import os
import uuid
import json
import logging
from rembg import remove
from PIL import Image
import io

# ИМПОРТ ТВОЕГО НОВОГО КЛАССИФИКАТОРА
from .classifier import ai_classifier
from . import models, schemas, crud, database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- СЛОВАРЬ ДЛЯ ПЕРЕВОДА КАТЕГОРИЙ (МАППИНГ) ---
# ИИ вернет "MEN-Denim", а в приложении сохранится "Джинсы (муж)"
CATEGORY_MAP = {
    "MEN-Denim": "Джинсы (муж)",
    "MEN-Jackets_Vests": "Верхняя одежда (муж)",
    "MEN-Pants": "Брюки (муж)",
    "MEN-Shirts_Polos": "Рубашки и Поло",
    "MEN-Shorts": "Шорты (муж)",
    "MEN-Suiting": "Костюмы",
    "MEN-Sweaters": "Свитера",
    "MEN-Sweatshirts_Hoodies": "Толстовки и Худи",
    "MEN-Tees_Tanks": "Футболки и Майки",
    "WOMEN-Blouses_Shirts": "Блузки и Рубашки",
    "WOMEN-Cardigans": "Кардиганы",
    "WOMEN-Denim": "Джинсы (жен)",
    "WOMEN-Dresses": "Платья",
    "WOMEN-Graphic_Tees": "Футболки с принтом",
    "WOMEN-Jackets_Coats": "Верхняя одежда (жен)",
    "WOMEN-Leggings": "Легинсы",
    "WOMEN-Pants": "Брюки (жен)",
    "WOMEN-Rompers_Jumpsuits": "Комбинезоны",
    "WOMEN-Shorts": "Шорты (жен)",
    "WOMEN-Skirts": "Юбки",
    "WOMEN-Sweaters": "Свитера (жен)",
    "WOMEN-Sweatshirts_Hoodies": "Толстовки (жен)",
    "WOMEN-Tees_Tanks": "Футболки (жен)"
}

# Создаем таблицы в БД
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# --- НАСТРОЙКИ JWT ---
SECRET_KEY = "my_super_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30000
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- НАСТРОЙКА ПАПОК ---
if os.path.exists("/data"):
    BASE_UPLOAD_DIR = "/data"
else:
    BASE_UPLOAD_DIR = "static"

UPLOAD_DIR = os.path.join(BASE_UPLOAD_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=BASE_UPLOAD_DIR), name="static")

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None: raise HTTPException(status_code=401)
        user = crud.get_user_by_email(db, email=email)
        if user is None: raise HTTPException(status_code=401)
        return user
    except JWTError:
        raise HTTPException(status_code=401)

# --- ЭНДПОИНТЫ ПОЛЬЗОВАТЕЛЕЙ ---
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user: raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

@app.post("/login")
def login(login_data: LoginRequest, db: Session = Depends(database.get_db)):
    user = crud.get_user_by_email(db, email=login_data.email)
    if not user or not crud.verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверная почта или пароль")
    return {"access_token": create_access_token(data={"sub": user.email}), "token_type": "bearer", "user_id": user.id, "name": user.name, "email": user.email}

# --- ВЕЩИ (С ИНТЕГРАЦИЕЙ ИИ) ---

@app.post("/items/", response_model=schemas.ItemResponse)
async def create_item(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    category: str = Form(None), # Сюда может прийти пустота
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Сохраняем файл временно
    file_content = await file.read()
    unique_filename = f"{uuid.uuid4()}.png"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, 'wb') as buffer:
        buffer.write(file_content)

    # 2. ВЫЗОВ ИИ ДЛЯ ОПРЕДЕЛЕНИЯ КАТЕГОРИИ
    # Если категория не выбрана вручную (null, "" или None)
    final_category = category
    if not category or category in ["null", "", "undefined"]:
        try:
            logger.info("Starting AI Category Prediction...")
            # Получаем сырое имя (например, WOMEN-Dresses)
            raw_pred = ai_classifier.predict(file_path)
            # Переводим на русский (например, Платья)
            final_category = CATEGORY_MAP.get(raw_pred, raw_pred)
            logger.info(f"AI Prediction: {final_category}")
        except Exception as e:
            logger.error(f"AI Prediction ERROR: {e}")
            final_category = "Другое"

    # 3. Сохраняем в базу данных
    db_path = f"static/uploads/{unique_filename}"
    item_data = schemas.ItemCreate(
        name=name, 
        category=final_category, # Используем результат ИИ
        color=color, 
        style=style, 
        season=season
    )
    db_item = crud.create_item(db=db, item=item_data, user_id=current_user.id, image_path=db_path)

    # 4. В фоне запускаем удаление фона (rembg)
    background_tasks.add_task(process_image_background, file_path)

    return db_item

@app.get("/items/", response_model=List[schemas.ItemResponse])
def read_items(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_items(db, user_id=current_user.id)

@app.get("/items/{item_id}", response_model=schemas.ItemResponse)
def read_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item or item.user_id != current_user.id: raise HTTPException(status_code=403)
    return item

@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item or db_item.user_id != current_user.id: raise HTTPException(status_code=403)
    if os.path.exists(db_item.image_path): os.remove(db_item.image_path)
    db.delete(db_item)
    db.commit()
    return {"ok": True}

# --- ФУНКЦИЯ УДАЛЕНИЯ ФОНА ---
def process_image_background(file_path: str):
    try:
        with open(file_path, "rb") as f:
            input_bytes = f.read()
        output_bytes = remove(input_bytes)
        img = Image.open(io.BytesIO(output_bytes)).convert('RGBA')
        img.save(file_path, format='PNG', optimize=True)
        logger.info(f"Background removed for: {file_path}")
    except Exception as e:
        logger.error(f"Rembg error: {e}")

# --- КАПСУЛЫ ---
@app.post("/capsules/", response_model=schemas.CapsuleResponse)
def create_capsule(name: str = Form(...), layout: str = Form(...), item_ids: str = Form(...), file: UploadFile = File(None), db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_path = None
    if file:
        unique_filename = f"capsule_{uuid.uuid4()}.png"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        db_path = f"static/uploads/{unique_filename}"
    db_capsule = models.Capsule(name=name, layout=layout, image_path=db_path, user_id=current_user.id)
    ids_list = json.loads(item_ids)
    if ids_list:
        db_capsule.items = db.query(models.Item).filter(models.Item.id.in_(ids_list), models.Item.user_id == current_user.id).all()
    db.add(db_capsule)
    db.commit()
    db.refresh(db_capsule)
    return db_capsule

@app.get("/capsules/", response_model=List[schemas.CapsuleResponse])
def read_capsules(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_capsules(db, user_id=current_user.id)

@app.get("/images/last_update")
def images_last_update():
    return {"last_update": datetime.utcnow().isoformat()}