from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import shutil
import os
import uuid
import json

from . import models, schemas, crud, database

# Создаем таблицы автоматически (если их нет)
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# Разрешаем запросы с React (по умолчанию порт 3000 или 5173 для Vite)
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Или ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Папка для картинок
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Подключаем статику, чтобы картинки были доступны по URL
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- ЭНДПОИНТЫ ---

# 1. Создать пользователя (для теста)
@app.post("/users/", response_model=schemas.UserResponse)
def create_user(user: schemas.UserCreate, db: Session = Depends(database.get_db)):
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    return crud.create_user(db=db, user=user)

# 2. Загрузить вещь (С картинкой!)
@app.post("/items/", response_model=schemas.ItemResponse)
def create_item(
    name: str = Form(...),
    category: str = Form(None),
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(database.get_db)
):
    # Генерируем уникальное имя файла
    file_extension = file.filename.split(".")[-1]
    unique_filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    # Сохраняем файл на диск
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Ссылка для БД (например: static/uploads/filename.jpg)
    db_path = f"static/uploads/{unique_filename}"
    
    # Собираем данные
    item_data = schemas.ItemCreate(
        name=name, category=category, color=color, style=style, season=season
    )
    
    # TODO: Хардкод user_id=1 для MVP. В будущем брать из авторизации.
    return crud.create_item(db=db, item=item_data, user_id=1, image_path=db_path)

# 3. Получить все вещи
@app.get("/items/", response_model=List[schemas.ItemResponse])
def read_items(skip: int = 0, limit: int = 100, db: Session = Depends(database.get_db)):
    # TODO: Хардкод user_id=1
    return crud.get_items(db, user_id=1, skip=skip, limit=limit)

# 4. Создать капсулу

@app.post("/capsules/", response_model=schemas.CapsuleResponse)
def create_capsule(
    name: str = Form(...),
    layout: str = Form(...),       # JSON строка с координатами
    item_ids: str = Form(...),     # JSON строка со списком ID вещей [1, 2, 5]
    file: UploadFile = File(None), # Скриншот (может быть null при обновлении, но лучше всегда слать)
    db: Session = Depends(database.get_db)
):
    # 1. Обработка картинки (скриншота)
    db_path = None
    if file:
        file_extension = file.filename.split(".")[-1]
        unique_filename = f"capsule_{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        db_path = f"static/uploads/{unique_filename}"

    # 2. Создаем капсулу
    db_capsule = models.Capsule(
        name=name,
        layout=layout,
        image_path=db_path,
        user_id=1 # Хардкод для MVP
    )
    
    # 3. Привязываем вещи (парсим строку "[1,2,3]" в список)
    ids_list = json.loads(item_ids)
    if ids_list:
        items = db.query(models.Item).filter(models.Item.id.in_(ids_list)).all()
        db_capsule.items = items

    db.add(db_capsule)
    db.commit()
    db.refresh(db_capsule)
    return db_capsule

# 5. Получить капсулы
@app.get("/capsules/", response_model=List[schemas.CapsuleResponse])
def read_capsules(db: Session = Depends(database.get_db)):
    return crud.get_capsules(db, user_id=1)

# 6. Получить одну вещь по ID (для окна редактирования)
@app.get("/items/{item_id}", response_model=schemas.ItemResponse)
def read_item(item_id: int, db: Session = Depends(database.get_db)):
    # Ищем вещь
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

# 7. Обновить вещь (Редактирование)
@app.put("/items/{item_id}")
def update_item(
    item_id: int,
    name: str = Form(...),
    category: str = Form(None),
    color: str = Form(None),
    style: str = Form(None),
    season: str = Form(None),
    db: Session = Depends(database.get_db)
):
    # Находим вещь в БД
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Обновляем поля
    db_item.name = name
    db_item.category = category
    db_item.color = color
    db_item.style = style
    db_item.season = season
    
    db.commit()
    db.refresh(db_item)
    return db_item
    
# 8. Удаление вещи (понадобится в окне редактирования)
@app.delete("/items/{item_id}")
def delete_item(item_id: int, db: Session = Depends(database.get_db)):
    db_item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Удаляем файл с диска (опционально, но желательно)
    # if os.path.exists(db_item.image_path):
    #     os.remove(db_item.image_path)

    db.delete(db_item)
    db.commit()
    return {"ok": True}

# 8. ОБНОВЛЕНИЕ КАПСУЛЫ (PUT)
@app.put("/capsules/{capsule_id}", response_model=schemas.CapsuleResponse)
def update_capsule(
    capsule_id: int,
    name: str = Form(...),
    layout: str = Form(...),
    item_ids: str = Form(...),
    file: UploadFile = File(None), # Скриншот
    db: Session = Depends(database.get_db)
):
    # 1. Ищем капсулу
    db_capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not db_capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")

    # 2. Если прислали новый файл - сохраняем его
    if file:
        # Удаляем старый файл, если он есть (чтобы не засорять диск)
        if db_capsule.image_path and os.path.exists(db_capsule.image_path):
            try:
                os.remove(db_capsule.image_path)
            except:
                pass # Если не удалился - не страшно

        file_extension = file.filename.split(".")[-1]
        unique_filename = f"capsule_{uuid.uuid4()}.{file_extension}"
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        db_capsule.image_path = f"static/uploads/{unique_filename}"

    # 3. Обновляем поля
    db_capsule.name = name
    db_capsule.layout = layout
    
    # 4. Обновляем связи с вещами
    ids_list = json.loads(item_ids)
    if ids_list is not None:
        items = db.query(models.Item).filter(models.Item.id.in_(ids_list)).all()
        db_capsule.items = items

    db.commit()
    db.refresh(db_capsule)
    return db_capsule

# 9. УДАЛЕНИЕ КАПСУЛЫ (DELETE)
@app.delete("/capsules/{capsule_id}")
def delete_capsule(capsule_id: int, db: Session = Depends(database.get_db)):
    db_capsule = db.query(models.Capsule).filter(models.Capsule.id == capsule_id).first()
    if not db_capsule:
        raise HTTPException(status_code=404, detail="Capsule not found")
    
    # Удаляем файл картинки
    if db_capsule.image_path and os.path.exists(db_capsule.image_path):
        try:
            os.remove(db_capsule.image_path)
        except:
            pass

    db.delete(db_capsule)
    db.commit()
    return {"ok": True}