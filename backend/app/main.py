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
from rembg import remove
from PIL import Image
import io
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from . import models, schemas, crud, database

# Создаем таблицы
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()



# --- НАСТРОЙКИ JWT (Секретный ключ) ---
SECRET_KEY = "my_super_secret_key_change_me_in_production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30000 # Долгоживущий токен для удобства

# Эта штука говорит FastAPI, где искать токен (в заголовке Authorization)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

# --- CORS ---
origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://wardrobe-app-cotlishoc.amvera.io",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,        # явно разрешаем перечисленные origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Дополнительный middleware: явно добавляем Access-Control-Allow-Origin для статики.
# Некоторые среды (CDN/фронт) могут возвращать статические файлы без нужных CORS заголовков,
# поэтому здесь безопасно эхо origin, если он разрешён.
@app.middleware("http")
async def add_cors_for_static(request, call_next):
    response = await call_next(request)
    try:
        path = request.url.path
        origin = request.headers.get("origin")
        if path.startswith("/static"):
            if origin and origin in origins:
                response.headers["Access-Control-Allow-Origin"] = origin
            else:
                # на случай запросов без Origin или неразрешённых origin — разрешаем localhost для dev
                response.headers["Access-Control-Allow-Origin"] = "http://localhost:5173"
            response.headers["Access-Control-Allow-Methods"] = "GET,OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "*"
    except Exception:
        pass
    return response

# Статика
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
# Статические файлы будут монтироваться ниже после определения BASE_UPLOAD_DIR
# чтобы избежать конфликтов при работе в разных окружениях (локально / в Amvera)

# --- НАСТРОЙКА ПАПОК ДЛЯ КАРТИНОК ---

# Проверяем, есть ли папка /data (она есть только в Amvera)
if os.path.exists("/data"):
    # МЫ В ОБЛАКЕ
    BASE_UPLOAD_DIR = "/data"
else:
    # МЫ ДОМА (Windows/Mac)
    BASE_UPLOAD_DIR = "static"

# Полный путь: /data/uploads или static/uploads
UPLOAD_DIR = os.path.join(BASE_UPLOAD_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# --- ВАЖНО: Подключаем статику ---
# Мы говорим FastAPI: "Когда просят /static, смотри в папку BASE_UPLOAD_DIR"
# То есть ссылка http://.../static/uploads/foto.png будет смотреть в /data/uploads/foto.png
app.mount("/static", StaticFiles(directory=BASE_UPLOAD_DIR), name="static")

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ AUTH ---

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ГЛАВНАЯ ФУНКЦИЯ: Определяет, кто делает запрос
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    return user

# --- ЭНДПОИНТЫ ---

class LoginRequest(BaseModel):
    email: str
    password: str

# 1. РЕГИСТРАЦИЯ
@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

# 2. ВХОД (Возвращает ТОКЕН)
@app.post("/login")
def login(login_data: LoginRequest, db: Session = Depends(database.get_db)):
    user = crud.get_user_by_email(db, email=login_data.email)
    if not user or not crud.verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Неверная почта или пароль")
    
    # Создаем токен
    access_token = create_access_token(data={"sub": user.email})
    
    # Возвращаем токен и ID (для удобства фронта)
    return {
        "access_token": access_token, 
        "token_type": "bearer", 
        "user_id": user.id,
        "name": user.name,   # <--- Добавили
        "email": user.email  # <--- Добавили
    }

# --- ВЕЩИ (ТЕПЕРЬ С ПРОВЕРКОЙ current_user) ---

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
    # Быстро сохраняем файл в PNG (конвертация через PIL без rembg) чтобы не блокировать запрос
    file_content = await file.read()
    try:
        input_image = Image.open(io.BytesIO(file_content))
        unique_filename = f"{uuid.uuid4()}.png"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        input_image.convert('RGBA').save(file_path, format='PNG')
    except Exception:
        # fallback: просто запишем байты как файл
        unique_filename = f"{uuid.uuid4()}.png"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, 'wb') as buffer:
            buffer.write(file_content)

    try:
        os.chmod(file_path, 0o644)
    except Exception:
        pass
    logger.info(f"Saved item image to: {file_path} (exists={os.path.exists(file_path)})")

    db_path = f"static/uploads/{unique_filename}"

    item_data = schemas.ItemCreate(
        name=name, category=category, color=color, style=style, season=season
    )
    db_item = crud.create_item(db=db, item=item_data, user_id=current_user.id, image_path=db_path)

    # Запускаем тяжелую обработку фоном, если это не облако (/data)
    if BASE_UPLOAD_DIR != "/data":
        background_tasks.add_task(process_image_background, file_path)

    return db_item

@app.get("/items/", response_model=List[schemas.ItemResponse])
def read_items(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    # Запрашиваем вещи ТОЛЬКО этого юзера
    return crud.get_items(db, user_id=current_user.id)

@app.get("/items/{item_id}", response_model=schemas.ItemResponse)
def read_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    # Проверка: принадлежит ли вещь этому юзеру?
    if item.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    return item

@app.put("/items/{item_id}")
async def update_item(
    item_id: int,
    name: str = Form(...),
    category: str = Form(None),
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    file: UploadFile = File(None), # Если прислали новый файл
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    if db_item.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    # Если загрузили новую картинку - удаляем фон
    if file:
        # Удаляем старую картинку с диска
        if db_item.image_path and os.path.exists(db_item.image_path):
            try: os.remove(db_item.image_path)
            except: pass

        file_content = await file.read()
        try:
            input_image = Image.open(io.BytesIO(file_content))
            unique_filename = f"{uuid.uuid4()}.png"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            input_image.convert('RGBA').save(file_path, format='PNG')
        except Exception:
            unique_filename = f"{uuid.uuid4()}.png"
            file_path = os.path.join(UPLOAD_DIR, unique_filename)
            with open(file_path, 'wb') as buffer:
                buffer.write(file_content)

        try:
            os.chmod(file_path, 0o644)
        except Exception:
            pass
        logger.info(f"Saved updated item image to: {file_path} (exists={os.path.exists(file_path)})")
        db_item.image_path = f"static/uploads/{unique_filename}"
        # Фоновая обработка, если локально
        if BASE_UPLOAD_DIR != "/data":
            BackgroundTasks().add_task(process_image_background, file_path)

    # Обновляем остальные поля
    db_item.name = name
    db_item.category = category
    db_item.color = color
    db_item.style = style
    db_item.season = season
    
    db.commit()
    db.refresh(db_item)
    return db_item

@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    if db_item.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    if os.path.exists(db_item.image_path):
        try: os.remove(db_item.image_path)
        except: pass

    db.delete(db_item)
    db.commit()
    return {"ok": True}

# --- КАПСУЛЫ (ТОЖЕ С ПРОВЕРКОЙ) ---

@app.post("/capsules/", response_model=schemas.CapsuleResponse)
def create_capsule(
    name: str = Form(...),
    layout: str = Form(...),
    item_ids: str = Form(...),
    file: UploadFile = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user) # <-- Auth
):
    db_path = None
    if file:
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"capsule_{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        try:
            os.chmod(file_path, 0o644)
        except Exception:
            pass
        logger.info(f"Saved capsule image to: {file_path} (exists={os.path.exists(file_path)})")
        db_path = f"static/uploads/{unique_filename}"

    db_capsule = models.Capsule(
        name=name,
        layout=layout,
        image_path=db_path,
        user_id=current_user.id # Используем ID из токена
    )
    
    ids_list = json.loads(item_ids)
    if ids_list:
        # Важно: берем вещи только если они принадлежат этому юзеру
        items = db.query(models.Item).filter(models.Item.id.in_(ids_list), models.Item.user_id == current_user.id).all()
        db_capsule.items = items

    db.add(db_capsule)
    db.commit()
    db.refresh(db_capsule)
    return db_capsule

@app.get("/capsules/", response_model=List[schemas.CapsuleResponse])
def read_capsules(db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    return crud.get_capsules(db, user_id=current_user.id)

@app.put("/capsules/{capsule_id}", response_model=schemas.CapsuleResponse)
def update_capsule(
    capsule_id: int,
    name: str = Form(...),
    layout: str = Form(...),
    item_ids: str = Form(...),
    file: UploadFile = File(None),
    db: Session = Depends(database.get_db),
    current_user: models.User = Depends(get_current_user)
):
    db_capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not db_capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
    if db_capsule.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")

    if file:
        if db_capsule.image_path and os.path.exists(db_capsule.image_path):
            try: os.remove(db_capsule.image_path)
            except: pass

        file_extension = file.filename.split(".")[-1]
        unique_filename = f"capsule_{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        try:
            os.chmod(file_path, 0o644)
        except Exception:
            pass
        logger.info(f"Saved updated capsule image to: {file_path} (exists={os.path.exists(file_path)})")
        db_capsule.image_path = f"static/uploads/{unique_filename}"

    db_capsule.name = name
    db_capsule.layout = layout
    
    ids_list = json.loads(item_ids)
    if ids_list is not None:
        items = db.query(models.Item).filter(models.Item.id.in_(ids_list), models.Item.user_id == current_user.id).all()
        db_capsule.items = items

    db.commit()
    db.refresh(db_capsule)
    return db_capsule

@app.delete("/capsules/{capsule_id}")
def delete_capsule(capsule_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    db_capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not db_capsule:
        raise HTTPException(status_code=404, detail="Not found")
    if db_capsule.user_id != current_user.id:
         raise HTTPException(status_code=403, detail="Not authorized")
    
    if db_capsule.image_path and os.path.exists(db_capsule.image_path):
        try: os.remove(db_capsule.image_path)
        except: pass

    db.delete(db_capsule)
    db.commit()
    return {"ok": True}

def process_image_background(file_path: str):
    """Фоновая обработка изображения: попытаться удалить фон с помощью rembg и перезаписать файл."""
    try:
        logger.info(f"Background processing started for {file_path}")
        img = Image.open(file_path)
        try:
            processed = remove(img)
            processed.save(file_path, format='PNG')
            try:
                os.chmod(file_path, 0o644)
            except Exception:
                pass
            logger.info(f"Background processing finished for {file_path}")
        except Exception as e:
            logger.exception(f"rembg failed: {e}")
    except Exception as e:
        logger.exception(f"Background image task error: {e}")