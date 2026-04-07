# backend/app/classifier.py
import tensorflow as tf
import numpy as np
from PIL import Image
import joblib
import os

# Пути к файлам (подправь, если папка называется иначе)
MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml_models", "efficientnet_model.keras")
ENCODER_PATH = os.path.join(os.path.dirname(__file__), "ml_models", "label_encoder.pkl")

class FashionClassifier:
    def __init__(self):
        # Загружаем модель
        self.model = tf.keras.models.load_model(MODEL_PATH)
        # Загружаем LabelEncoder, чтобы превратить цифры (0, 1...) в названия (MEN-Denim...)
        self.label_encoder = joblib.load(ENCODER_PATH)
        print("LOG: AI Model loaded successfully")

    def predict(self, image_path: str):
        # 1. Загружаем и готовим картинку
        img = Image.open(image_path).convert('RGB')
        # ВАЖНО: EfficientNet обычно требует размер 224x224. Проверь на чем обучали!
        img = img.resize((224, 224)) 
        
        img_array = tf.keras.preprocessing.image.img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0) # Делаем пакет из одной картинки
        
        # Если модель требовала нормализацию (деление на 255), добавь это:
        # img_array = img_array / 255.0 

        # 2. Делаем предсказание
        predictions = self.model.predict(img_array)
        class_idx = np.argmax(predictions[0]) # Берем индекс самого вероятного класса
        
        # 3. Декодируем индекс в название категории
        category_name = self.label_encoder.inverse_transform([class_idx])[0]
        return category_name

# Создаем один экземпляр при запуске
ai_classifier = FashionClassifier()