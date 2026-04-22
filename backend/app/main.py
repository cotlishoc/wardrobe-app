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
from sqlalchemy.orm import Session, joinedload
# Импорт классификатора
from .classifier import ai_classifier, get_dominant_color
from . import models, schemas, crud, database
import time
from sqlalchemy.orm import joinedload


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Создаем таблицы в БД
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

def seed_database(db: Session):
    # 1. Цвета (твои 60+ цветов)
    colors = [
        "Белый", "Молочный", "Айвори", "Бежевый", "Песочный", "Палевый", 
        "Тан / Светло-коричневый", "Верблюжий (Camel)", "Черный", "Антрацитовый", 
        "Графитовый", "Темно-серый", "Серый", "Серебристый", "Светло-серый", 
        "Грифельный", "Темно-синий (Midnight)", "Нави (Navy)", "Индиго", 
        "Королевский синий", "Классический деним", "Светло-голубой деним", 
        "Небесный", "Бирюзовый", "Морская волна", "Стальной синий", "Лазурный", 
        "Пыльная роза", "Светло-розовый", "Фуксия", "Пурпурный", "Малиновый", 
        "Лавандовый", "Фиолетовый", "Сливовый", "Пудровый", "Бордовый / Марсала", 
        "Винный", "Красный", "Алый", "Коралловый", "Оранжево-красный", 
        "Оранжевый", "Темно-оранжевый", "Кирпичный", "Темно-оливковый", 
        "Оливковый", "Болотный", "Темно-зеленый", "Лесной зеленый", "Лаймовый", 
        "Шалфей / Пыльно-зеленый", "Весенний зеленый", "Шоколадный", "Терракотовый", 
        "Коричневый", "Охристый", "Горчичный", "Золотистый", "Желтый", "Навахо / Кремовый"
    ]
    # 2. Категории
    categories = ["Футболки и майки", "Брюки", "Платья", "Кроссовки", "Обувь", "Куртки", "Свитеры", "Шорты", "Юбки", "Костюмы", "Сумки", "Аксессуары"]
    # 3. Стили
    styles = ["Повседневный", "Деловой", "Спортивный", "Вечерний", "Минимализм", "Уличный"]
    # 4. Сезоны
    seasons = ["Лето", "Зима", "Демисезон", "Всесезон"]
    # 5. Крой (Твое новое требование)
    fits = ["Базовый", "Приталенный (Slim)", "Оверсайз (Oversize)"]

    occasions = [
        {"name": "Свидание", "style": "Романтика"},
        {"name": "Деловая встреча", "style": "Деловой"},
        {"name": "Прогулка", "style": "Повседневный"},
        {"name": "Вечеринка", "style": "Вечерний"},
        {"name": "Спорт", "style": "Спортивный"},
        {"name": "Офис", "style": "Деловой"},
        {"name": "Путешествие", "style": "Уличный"}
    ]
    for occ in occasions:
        if not db.query(models.Occasion).filter_by(name=occ["name"]).first():
            db.add(models.Occasion(name=occ["name"], default_style=occ["style"]))
    db.commit()

    # Функция-помощник для вставки
    def insert_if_not_exists(model, data_list):
        for name in data_list:
            if not db.query(model).filter_by(name=name).first():
                db.add(model(name=name))
    
    insert_if_not_exists(models.Color, colors)
    insert_if_not_exists(models.Category, categories)
    insert_if_not_exists(models.Style, styles)
    insert_if_not_exists(models.Season, seasons)
    insert_if_not_exists(models.Fit, fits)
    db.commit()

@app.get("/occasions")
def get_occasions(db: Session = Depends(database.get_db)):
    return db.query(models.Occasion).all()

# Запускаем наполнение при старте приложения
@app.on_event("startup")
def on_startup():
    db = database.SessionLocal()
    try:
        seed_database(db)
        logger.info("Database seeded successfully")
    finally:
        db.close()

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
BASE_UPLOAD_DIR = "static"
UPLOAD_DIR = os.path.join(BASE_UPLOAD_DIR, "uploads")
TEMP_DIR = os.path.join(BASE_UPLOAD_DIR, "temp")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)
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

# --- ВЕЩИ (ITEMS) ---

@app.post("/items/")
async def create_item(
    name: str = Form(...),
    category: str = Form(None),
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    fit: str = Form(None), # Новое поле
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    # 1. Сохранение файла и удаление фона (логика rembg как раньше)
    file_content = await file.read()
    no_bg_bytes = remove(file_content)
    unique_filename = f"{uuid.uuid4()}.png"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    Image.open(io.BytesIO(no_bg_bytes)).convert('RGBA').save(file_path, format='PNG')

    # 2. Получение ID из текстовых названий
    cat_id = get_id_by_name(db, models.Category, category)
    col_id = get_id_by_name(db, models.Color, color)
    sty_id = get_id_by_name(db, models.Style, style)
    sea_id = get_id_by_name(db, models.Season, season)
    fit_id = get_id_by_name(db, models.Fit, fit)

    # 3. Сохранение в базу
    db_item = models.Item(
        name=name,
        user_id=current_user.id,
        image_path=f"static/uploads/{unique_filename}",
        category_id=cat_id,
        color_id=col_id,
        style_id=sty_id,
        season_id=sea_id,
        fit_id=fit_id
    )
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.get("/items/", response_model=List[schemas.ItemResponse])
def read_items(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Используем joinedload, чтобы вытащить связанные названия категорий, цветов и т.д.
    db_items = db.query(models.Item).options(
        joinedload(models.Item.category_rel),
        joinedload(models.Item.color_rel),
        joinedload(models.Item.style_rel),
        joinedload(models.Item.season_rel),
        joinedload(models.Item.fit_rel)
    ).filter(models.Item.user_id == current_user.id).all()

    # ВАЖНО: Мы должны прогнать каждый элемент через нашу схему, 
    # чтобы превратить объекты БД в красивые строки для фронтенда
    return [schemas.ItemResponse.from_orm(item) for item in db_items]

@app.get("/items/{item_id}", response_model=schemas.ItemResponse)
def read_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Используем joinedload для всех связей, чтобы вытащить названия вместо ID
    db_item = db.query(models.Item).options(
        joinedload(models.Item.category_rel),
        joinedload(models.Item.color_rel),
        joinedload(models.Item.style_rel),
        joinedload(models.Item.season_rel),
        joinedload(models.Item.fit_rel)
    ).filter(models.Item.id == item_id).first()

    if not db_item or db_item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # ВАЖНО: вызываем наш метод преобразования
    return schemas.ItemResponse.from_orm(db_item)

# --- ИСПРАВЛЕННЫЙ ПУТЬ РЕДАКТИРОВАНИЯ ---
@app.put("/items/{item_id}")
async def update_item(
    item_id: int,
    name: str = Form(...),
    category: str = Form(None),
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    fit: str = Form(None), # Новое поле
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item or db_item.user_id != current_user.id:
        raise HTTPException(status_code=403)

    # Обновляем ID, находя их по переданным строкам
    db_item.name = name
    db_item.category_id = get_id_by_name(db, models.Category, category)
    db_item.color_id = get_id_by_name(db, models.Color, color)
    db_item.style_id = get_id_by_name(db, models.Style, style)
    db_item.season_id = get_id_by_name(db, models.Season, season)
    db_item.fit_id = get_id_by_name(db, models.Fit, fit)
    
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
def create_capsule(
    name: str = Form(...), 
    layout: str = Form(...), 
    item_ids: str = Form(...), 
    occasion: str = Form(None), # Добавили
    file: UploadFile = File(None), 
    db: Session = Depends(database.get_db), 
    current_user: models.User = Depends(get_current_user)
):
    db_path = None
    if file:
        unique_filename = f"capsule_{uuid.uuid4()}.png"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        db_path = f"static/uploads/{unique_filename}"
    
    # Ищем ID события по имени
    occ_id = get_id_by_name(db, models.Occasion, occasion)

    db_capsule = models.Capsule(
        name=name, 
        layout=layout, 
        image_path=db_path, 
        user_id=current_user.id,
        occasion_id=occ_id # Сохраняем
    )
    
    ids_list = json.loads(item_ids)
    if ids_list:
        db_capsule.items = db.query(models.Item).filter(models.Item.id.in_(ids_list), models.Item.user_id == current_user.id).all()
    
    db.add(db_capsule)
    db.commit()
    db.refresh(db_capsule)
    return db_capsule

@app.get("/capsules/", response_model=List[schemas.CapsuleResponse])
def read_capsules(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_capsules = db.query(models.Capsule).options(
        joinedload(models.Capsule.occasion_rel), # Подгружаем связь с событием
        joinedload(models.Capsule.items)         # Подгружаем вещи
    ).filter(models.Capsule.user_id == current_user.id).all()
    
    return [schemas.CapsuleResponse.from_orm(c) for c in db_capsules]

@app.get("/images/last_update")
def images_last_update():
    return {"last_update": datetime.utcnow().isoformat()}


import time # Добавь в импорты в начало файла

@app.post("/items/analyze")
async def analyze_item(file: UploadFile = File(...)):
    try:
        # --- БЛОК ОЧИСТКИ СТАРЫХ ФАЙЛОВ ---
        now = time.time()
        for f in os.listdir(TEMP_DIR):
            f_path = os.path.join(TEMP_DIR, f)
            # Если файл в temp лежит дольше 15 минут (900 сек) — удаляем
            if os.stat(f_path).st_mtime < now - 900:
                try:
                    os.remove(f_path)
                except: pass
        # ----------------------------------

        file_content = await file.read()
        no_bg_bytes = remove(file_content)
        img = Image.open(io.BytesIO(no_bg_bytes)).convert('RGBA')
        
        unique_filename = f"temp_{uuid.uuid4()}.png"
        file_path = os.path.join(TEMP_DIR, unique_filename)
        img.save(file_path, format='PNG')

        predicted_category = ai_classifier.predict(file_path)
        predicted_color = get_dominant_color(file_path)

        return {
            "category": predicted_category,
            "color": predicted_color,
            "image_path": f"static/temp/{unique_filename}"
        }
    except Exception as e:
        logger.error(f"Analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

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

# Помощник для поиска ID по названию
def get_id_by_name(db: Session, model, name: str):
    if not name or name in ["null", "", "undefined"]: return None
    result = db.query(model).filter(model.name == name).first()
    if not result: # Если вдруг ИИ выдал новый цвет, которого нет в списке - добавим его
        new_obj = model(name=name)
        db.add(new_obj)
        db.commit()
        db.refresh(new_obj)
        return new_obj.id
    return result.id

@app.get("/categories")
def get_categories(db: Session = Depends(database.get_db)):
    return [c.name for c in db.query(models.Category).all()]

@app.get("/colors")
def get_colors(db: Session = Depends(database.get_db)):
    return [c.name for c in db.query(models.Color).all()]

@app.get("/styles")
def get_styles(db: Session = Depends(database.get_db)):
    return [c.name for c in db.query(models.Style).all()]

@app.get("/seasons")
def get_seasons(db: Session = Depends(database.get_db)):
    return [c.name for c in db.query(models.Season).all()]

@app.get("/fits")
def get_fits(db: Session = Depends(database.get_db)):
    return [c.name for c in db.query(models.Fit).all()]

@app.put("/capsules/{capsule_id}", response_model=schemas.CapsuleResponse)
async def update_capsule(
    capsule_id: int,
    name: str = Form(...),
    layout: str = Form(...),
    item_ids: str = Form(...),
    occasion: str = Form(None), # Добавили
    file: UploadFile = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id, models.Capsule.user_id == current_user.id).first()
    if not db_capsule:
        raise HTTPException(status_code=404, detail="Not found")

    db_capsule.name = name
    db_capsule.layout = layout
    db_capsule.occasion_id = get_id_by_name(db, models.Occasion, occasion) # Обновляем событие

    if file:
        # (логика удаления старого и сохранения нового файла остается такой же)
        unique_filename = f"capsule_{uuid.uuid4()}.png"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer: shutil.copyfileobj(file.file, buffer)
        db_capsule.image_path = f"static/uploads/{unique_filename}"

    ids_list = json.loads(item_ids)
    db_capsule.items = db.query(models.Item).filter(models.Item.id.in_(ids_list), models.Item.user_id == current_user.id).all()

    db.commit()
    db.refresh(db_capsule)
    return db_capsule