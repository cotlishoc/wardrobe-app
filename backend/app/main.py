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

# Импорт классификатора
from .classifier import ai_classifier, get_dominant_color
from . import models, schemas, crud, database


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Создаем таблицы в БД
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# --- НАСТРОЙКИ ---
SECRET_KEY = "my_super_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30000
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

# 1. Создаем жесткий обработчик заголовков
class CorsHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["Access-Control-Allow-Origin"] = "*"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        return response

app.add_middleware(CorsHeadersMiddleware)

# 2. Стандартный CORS (оставляем тоже)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- НАСТРОЙКА ПАПОК ---
# Локально BASE_UPLOAD_DIR будет "static"
BASE_DIR = "static"
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
TEMP_DIR = os.path.join(BASE_DIR, "temp")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=BASE_DIR), name="static")

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

# --- ВЕЩИ (ITEMS) ---

@app.post("/items/", response_model=schemas.ItemResponse)
async def create_item(
    background_tasks: BackgroundTasks,
    name: str = Form(...),
    category: str = Form(None),
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Читаем файл и СРАЗУ удаляем фон
    file_content = await file.read()
    try:
        # Удаляем фон через rembg
        no_bg_bytes = remove(file_content)
        img = Image.open(io.BytesIO(no_bg_bytes)).convert('RGBA')
    except Exception as e:
        logger.error(f"Rembg error: {e}")
        # Если не вышло - берем оригинал
        img = Image.open(io.BytesIO(file_content)).convert('RGBA')

    # 2. Сохраняем чистую картинку
    unique_filename = f"{uuid.uuid4()}.png"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    img.save(file_path, format='PNG', optimize=True)

    # 3. Теперь ИИ видит только одежду на прозрачном фоне!
    if not category or category in ["null", "", "undefined"]:
        category = ai_classifier.predict(file_path)

    if not color or color in ["null", "", "undefined"]:
        # Вызываем обновленную функцию цвета (код ниже)
        color = get_dominant_color(file_path)
        logger.info(f"AI Detected Color (No BG): {color}")

    db_path = f"static/uploads/{unique_filename}"
    item_data = schemas.ItemCreate(name=name, category=category, color=color, style=style, season=season)
    db_item = crud.create_item(db=db, item=item_data, user_id=current_user.id, image_path=db_path)
    
    return db_item

@app.get("/items/", response_model=List[schemas.ItemResponse])
def read_items(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_items(db, user_id=current_user.id)

@app.get("/items/{item_id}", response_model=schemas.ItemResponse)
def read_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item or item.user_id != current_user.id: raise HTTPException(status_code=403)
    return item

# --- ИСПРАВЛЕННЫЙ ПУТЬ РЕДАКТИРОВАНИЯ ---
@app.put("/items/{item_id}")
async def update_item(
    item_id: int,
    name: str = Form(...),
    category: str = Form(None),
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item or db_item.user_id != current_user.id:
        raise HTTPException(status_code=403)

    full_path = os.path.join(os.getcwd(), db_item.image_path)

    # Переопределение категории, если стерли
    if not category or category in ["null", "", "undefined"]:
        category = ai_classifier.predict(full_path)

    # Переопределение цвета, если стерли
    if not color or color in ["null", "", "undefined"]:
        color = get_dominant_color(full_path)

    db_item.name = name
    db_item.category = category
    db_item.color = color
    db_item.style = style
    db_item.season = season
    
    db.commit()
    return db_item

# --- ИСПРАВЛЕННОЕ УДАЛЕНИЕ ---
@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Находим вещь в базе
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    if db_item.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # 2. Удаляем файл с диска
    try:
        # Составляем полный путь (например C:/.../static/uploads/image.png)
        full_path = os.path.join(os.getcwd(), db_item.image_path)
        if os.path.exists(full_path):
            os.remove(full_path)
            logger.info(f"File deleted: {full_path}")
        else:
            logger.warning(f"File not found on disk, skipping: {full_path}")
    except Exception as e:
        logger.error(f"Error deleting file: {e}")

    # 3. Удаляем запись из базы данных
    db.delete(db_item)
    db.commit()
    
    return {"ok": True}

# --- УДАЛЕНИЕ ФОНА (BACKGROUND) ---
def process_image_background(file_path: str):
    try:
        with open(file_path, "rb") as f:
            input_bytes = f.read()
        output_bytes = remove(input_bytes)
        img = Image.open(io.BytesIO(output_bytes)).convert('RGBA')
        img.save(file_path, format='PNG', optimize=True)
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


@app.post("/items/analyze")
async def analyze_item(file: UploadFile = File(...)):
    """Эндпоинт для мгновенного анализа фото перед сохранением"""
    try:
        file_content = await file.read()
        
        # 1. СРАЗУ удаляем фон (чтобы пользователь видел результат)
        no_bg_bytes = remove(file_content)
        img = Image.open(io.BytesIO(no_bg_bytes)).convert('RGBA')
        
        # 2. Сохраняем во временную папку (static/temp)
        temp_dir = os.path.join(BASE_UPLOAD_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)
        unique_filename = f"temp_{uuid.uuid4()}.png"
        file_path = os.path.join(temp_dir, unique_filename)
        img.save(file_path, format='PNG')

        # 3. Запускаем ИИ (категория и цвет)
        predicted_category = ai_classifier.predict(file_path)
        predicted_color = get_dominant_color(file_path)

        # Возвращаем данные и путь к временному файлу
        return {
            "category": predicted_category,
            "color": predicted_color,
            "image_path": f"static/temp/{unique_filename}"
        }
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail="Ошибка при анализе фото")

@app.post("/items/{item_id}/reanalyze")
async def reanalyze_existing_item(
    item_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item or db_item.user_id != current_user.id:
        raise HTTPException(status_code=403)

    # Путь к файлу на диске
    full_path = os.path.join(os.getcwd(), db_item.image_path)
    
    if not os.path.exists(full_path):
        raise HTTPException(status_code=404, detail="Файл не найден")

    # Запускаем ИИ
    category = ai_classifier.predict(full_path)
    color = get_dominant_color(full_path)

    return {"category": category, "color": color}


# --- УДАЛЕНИЕ КАПСУЛЫ ---
@app.delete("/capsules/{capsule_id}")
def delete_capsule(
    capsule_id: int, 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    # 1. Ищем капсулу
    db_capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    
    if not db_capsule:
        raise HTTPException(status_code=404, detail="Капсула не найдена")
    
    # 2. Проверяем права (только владелец может удалить)
    if db_capsule.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Нет прав для удаления")
    
    # 3. Удаляем файл скриншота с диска
    if db_capsule.image_path:
        try:
            full_path = os.path.join(os.getcwd(), db_capsule.image_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                logger.info(f"Скриншот капсулы удален: {full_path}")
        except Exception as e:
            logger.error(f"Ошибка при удалении файла капсулы: {e}")

    # 4. Удаляем запись из базы
    db.delete(db_capsule)
    db.commit()
    
    return {"ok": True}