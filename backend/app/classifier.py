# backend/app/classifier.py
import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image
import joblib
import os
import re
from collections import OrderedDict

import numpy as np
from sklearn.cluster import KMeans
from PIL import Image
from skimage import color # Нужна для перевода в LAB

# РАСШИРЕННАЯ ФЭШН-ПАЛИТРА (100+ ОТТЕНКОВ)
COLOR_PALETTE_RGB = {
    # БЕЛЫЕ И БЕЖЕВЫЕ
    (255, 255, 255): "Белый", (245, 245, 245): "Молочный", (255, 253, 208): "Айвори",
    (245, 245, 220): "Бежевый", (225, 198, 153): "Песочный", (238, 232, 170): "Палевый",
    (210, 180, 140): "Тан / Светло-коричневый", (193, 154, 107): "Верблюжий (Camel)",
    # СЕРЫЕ И ЧЕРНЫЕ
    (0, 0, 0): "Черный", (28, 28, 28): "Антрацитовый", (47, 79, 79): "Графитовый",
    (105, 105, 105): "Темно-серый", (128, 128, 128): "Серый", (169, 169, 169): "Серебристый",
    (211, 211, 211): "Светло-серый", (112, 128, 144): "Грифельный",
    # СИНИЕ И ГОЛУБЫЕ (ДЕНИМ)
    (25, 25, 112): "Темно-синий (Midnight)", (0, 0, 128): "Нави (Navy)",
    (16, 52, 166): "Индиго", (65, 105, 225): "Королевский синий",
    (100, 149, 237): "Классический деним", (176, 196, 222): "Светло-голубой деним",
    (135, 206, 235): "Небесный", (0, 255, 255): "Бирюзовый", (95, 158, 160): "Морская волна",
    (70, 130, 180): "Стальной синий", (30, 144, 255): "Лазурный",
    # РОЗОВЫЕ И ФИОЛЕТОВЫЕ
    (230, 190, 195): "Пыльная роза", (255, 182, 193): "Светло-розовый",
    (255, 20, 147): "Фуксия", (219, 112, 147): "Пурпурный", (199, 21, 133): "Малиновый",
    (230, 230, 250): "Лавандовый", (128, 0, 128): "Фиолетовый", (75, 0, 130): "Индиго",
    (221, 160, 221): "Сливовый", (255, 192, 203): "Пудровый",
    # КРАСНЫЕ И ОРАНЖЕВЫЕ
    (128, 0, 0): "Бордовый / Марсала", (139, 0, 0): "Винный", (255, 0, 0): "Красный",
    (220, 20, 60): "Алый", (255, 127, 80): "Коралловый", (255, 69, 0): "Оранжево-красный",
    (255, 165, 0): "Оранжевый", (255, 140, 0): "Темно-оранжевый", (191, 79, 27): "Кирпичный",
    # ЗЕЛЕНЫЕ
    (85, 107, 47): "Темно-оливковый", (107, 142, 35): "Оливковый", (128, 128, 0): "Болотный",
    (0, 100, 0): "Темно-зеленый", (34, 139, 34): "Лесной зеленый", (50, 205, 50): "Лаймовый",
    (143, 188, 143): "Шалфей / Пыльно-зеленый", (0, 255, 127): "Весенний зеленый",
    # КОРИЧНЕВЫЕ И ЖЕЛТЫЕ
    (139, 69, 19): "Шоколадный", (160, 82, 45): "Терракотовый", (165, 42, 42): "Коричневый",
    (205, 133, 63): "Охристый", (218, 165, 32): "Горчичный", (255, 215, 0): "Золотистый",
    (255, 255, 0): "Желтый", (255, 222, 173): "Навахо / Кремовый"
}

# ПЕРЕВОДИМ ПАЛИТРУ В LAB ОДИН РАЗ ПРИ ЗАПУСКЕ
PALETTE_LAB = []
PALETTE_NAMES = []
for rgb, name in COLOR_PALETTE_RGB.items():
    # Нормализуем RGB и переводим в LAB
    rgb_norm = np.array(rgb) / 255.0
    lab = color.rgb2lab([[rgb_norm]])[0][0]
    PALETTE_LAB.append(lab)
    PALETTE_NAMES.append(name)

def get_dominant_color(image_path):
    try:
        img = Image.open(image_path).convert('RGBA')
        img = img.resize((150, 150)) # Увеличим точность выборки
        data = np.array(img)
        
        rgb = data[:, :, :3]
        alpha = data[:, :, 3]

        # Фильтруем: берем только одежду (прозрачность > 120)
        mask = (alpha > 120)
        pixels = rgb[mask]

        if len(pixels) < 100: return "Не определен"

        # Ищем 5 кластеров (так точнее выделим основной цвет ткани от теней)
        kmeans = KMeans(n_clusters=5, n_init=10)
        kmeans.fit(pixels)
        
        labels, counts = np.unique(kmeans.labels_, return_counts=True)
        centers = kmeans.cluster_centers_

        # Берем самый частый цвет, который НЕ является слишком темным (тенью)
        # Если самый частый - почти черный, проверим второй по популярности
        sorted_indices = np.argsort(counts)[::-1]
        
        best_rgb = centers[sorted_indices[0]]
        # Если первый цвет слишком темный (<30 по всем каналам), пробуем второй
        if np.mean(best_rgb) < 30 and len(sorted_indices) > 1:
            best_rgb = centers[sorted_indices[1]]

        # ПЕРЕВОДИМ НАЙДЕННЫЙ ЦВЕТ В LAB
        best_rgb_norm = best_rgb / 255.0
        best_lab = color.rgb2lab([[best_rgb_norm]])[0][0]

        # ИЩЕМ МИНИМАЛЬНОЕ РАССТОЯНИЕ В LAB (Delta E)
        min_dist = float('inf')
        color_name = "Разноцветный"

        for i, pal_lab in enumerate(PALETTE_LAB):
            # В LAB пространстве расстояние отражает реальную разницу для глаза
            dist = np.linalg.norm(best_lab - pal_lab)
            if dist < min_dist:
                min_dist = dist
                color_name = PALETTE_NAMES[i]
        
        return color_name
    except Exception as e:
        print(f"Color Error: {e}")
        return "Не определен"

# Пути к файлам
MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml_models", "problem_model.pth")
ENCODER_PATH = os.path.join(os.path.dirname(__file__), "ml_models", "problem_encoder.pkl")

class FashionClassifier:
    def __init__(self):
        # 1. Загружаем LabelEncoder
        self.label_encoder = joblib.load(ENCODER_PATH)
        num_classes = len(self.label_encoder.classes_)

        # 2. Инициализируем архитектуру EfficientNet-B3
        self.model = models.efficientnet_b3(weights=None)
        
        # Согласно ошибке в консоли, твой классификатор в файле сохранен как 'classifier.weight'
        # Это значит, что это один слой Linear, а не Sequential из 5 слоев.
        # Мы создаем его таким, каким его ждет файл весов:
        self.model.classifier = nn.Sequential(
            nn.Dropout(p=0.3, inplace=True),
            nn.Linear(in_features=1536, out_features=num_classes)
        )

        # 3. Загружаем веса с исправлением ключей
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        checkpoint = torch.load(MODEL_PATH, map_location=device)
        
        # Берем данные из словаря
        state_dict = checkpoint.get('model_state_dict', checkpoint)

        # --- МАГИЯ ЧИСТКИ КЛЮЧЕЙ ---
        # Убираем приставку "backbone.", если она есть, чтобы PyTorch узнал слои
        new_state_dict = OrderedDict()
        for k, v in state_dict.items():
            name = k.replace("backbone.", "") # удаляем лишнюю обертку
            
            # Исправляем нестыковку классификатора (если в файле 'classifier.weight', а модель ждет 'classifier.1.weight')
            if name == "classifier.weight":
                name = "classifier.1.weight"
            if name == "classifier.bias":
                name = "classifier.1.bias"
                
            new_state_dict[name] = v

        # Загружаем очищенные веса
        self.model.load_state_dict(new_state_dict, strict=False)
        self.model.to(device)
        self.model.eval()
        self.device = device

        # 4. Предобработка
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

        # 5. Словарь перевода (без изменений)
        self.translation_map = {
            # === ВЕРХНЯЯ ОДЕЖДА ===
            'mens-t-shirts-and-tank-tops': 'Футболки и майки',
            'womens-tops-tank-tops-and-t-shirts': 'Футболки и майки',
            'girls-t-shirts-and-shirts': 'Футболки и майки',
            'boys-t-shirts': 'Футболки и майки',
            
            'mens-shirts': 'Рубашки',
            'womens-blouses-and-shirts': 'Рубашки и блузки',
            
            'mens-sweaters': 'Свитеры',
            'womens-sweaters': 'Свитеры',
            'girls-sweaters': 'Свитеры',
            'mens-sweatshirts': 'Свитшоты и худи',
            'womens-sweatshirts': 'Свитшоты и худи',
            'boys-sweatshirts': 'Свитшоты и худи',
            'girls-sweatshirts': 'Свитшоты и худи',
            'mens-hoodies-and-sweatshirts': 'Свитшоты и худи',
            
            'mens-jackets-and-coats': 'Куртки и пальто',
            'womens-coats': 'Куртки и пальто',
            'mens-coats': 'Куртки и пальто',
            'mens-parkas': 'Куртки и пальто',
            'womens-parkas': 'Куртки и пальто',
            'mens-bombers': 'Бомберы',
            'womens-bombers': 'Бомберы',
            'mens-windbreakers': 'Ветровки',
            'womens-windbreakers': 'Ветровки',
            'boys-jackets-coats-and-vests': 'Детские куртки',
            'girls-jackets-coats-and-vests': 'Детские куртки',
            
            'mens-vests': 'Жилеты',
            'womens-vests': 'Жилеты',
            
            'mens-denim-jackets': 'Джинсовые куртки',
            'womens-denim-jackets': 'Джинсовые куртки',
            'mens-leather-jackets': 'Кожаные куртки',
            'womens-leather-jackets': 'Кожаные куртки',
            'mens-quilted-jacket': 'Стеганые куртки',
            'womens-quilted-jackets': 'Стеганые куртки',
            'mens-sport-jackets': 'Спортивные куртки',
            'womens-sport-jackets': 'Спортивные куртки',
            
            # === НИЖНЯЯ ОДЕЖДА ===
            'mens-pants': 'Брюки',
            'womens-pants': 'Брюки',
            'boys-pants': 'Брюки',
            'girls-pants': 'Брюки',
            'mens-trousers': 'Брюки',
            
            'mens-jeans': 'Джинсы',
            'womens-jeans': 'Джинсы',
            
            'mens-shorts': 'Шорты',
            'womens-shorts': 'Шорты',
            'women-s-shorts': 'Шорты',
            'boys-shorts': 'Шорты',
            'girls-shorts': 'Шорты',
            
            'womens-skirts': 'Юбки',
            
            'womens-leggings': 'Леггинсы',
            
            # === ПЛАТЬЯ И КОМБИНЕЗОНЫ ===
            'dresses': 'Платья',
            'womens-dresses': 'Платья',
            'women-s-dresses': 'Платья',
            'girls-dresses': 'Платья',
            
            'womens-jumpsuits': 'Комбинезоны',
            'girls-jump-suits': 'Комбинезоны',
            'women-co-ord-sets': 'Координированные костюмы',
            
            'one-piece-swimsuits': 'Купальники',
            'bikinis': 'Купальники',
            
            # === ОБУВЬ ===
            'mens-sneakers': 'Кроссовки',
            'womens-sneakers': 'Кроссовки',
            'mens-football-shoes': 'Спортивная обувь',
            'mens-outdoor-shoes': 'Спортивная обувь',
            'womens-outdoor-shoes': 'Спортивная обувь',
            
            'mens-boots': 'Ботинки',
            'womens-boots-and-booties': 'Ботинки',
            'womens-snow-boots': 'Зимние ботинки',
            'mens-snow-boots': 'Зимние ботинки',
            
            'mens-sandals': 'Сандалии',
            'womens-sandals': 'Сандалии',
            'mens-flip-flops': 'Шлепанцы',
            'womens-flip-flops': 'Шлепанцы',
            'mens-slides': 'Слайды',
            'womens-slides': 'Слайды',
            'mens-slippers': 'Домашние тапочки',
            'womens-slippers': 'Домашние тапочки',
            
            'mens-loafers-and-moccasins': 'Лоферы и мокасины',
            'womens-loafers-and-moccasins': 'Лоферы и мокасины',
            'men-dress-shoes': 'Классическая обувь',
            'women-dress-shoes': 'Классическая обувь',
            'womens-espadrilles': 'Эспадрильи',
            'womens-flats': 'Балетки',
            'womens-heels': 'Туфли на каблуке',
            'heels': 'Туфли на каблуке',
            'womens-mule': 'Мюли',
            
            'baby-shoes': 'Детская обувь',
            'girls-shoes': 'Детская обувь',
            'boys-shoes': 'Детская обувь',
            
            # === НИЖНЕЕ БЕЛЬЕ ===
            'womens-bras': 'Бюстгальтеры',
            'panties-and-thongs': 'Трусы',
            'underwear-sets': 'Бельевые наборы',
            'mens-undergarments': 'Мужское нижнее белье',
            'womens-lingerie': 'Белье',
            'womens-hosiery': 'Чулочно-носочные изделия',
            'girls-undergarments': 'Детское белье',
            
            'mens-sleepwear': 'Пижамы',
            'womens-pajamas': 'Пижамы',
            'women-s-nightgowns': 'Ночные рубашки',
            'girls-sleepwear': 'Детские пижамы',
            'womens-bathrobes': 'Халаты',
            
            # === АКСЕССУАРЫ ===
            'handbags': 'Сумки',
            'mens-bags': 'Сумки',
            'womens-backpacks': 'Рюкзаки',
            'mens-backpacks': 'Рюкзаки',
            'shoulder-bags': 'Сумки через плечо',
            'womens-fanny-packs': 'Поясные сумки',
            'womens-wallets': 'Кошельки',
            'mens-wallets': 'Кошельки',
            'womens-suitcase': 'Чемоданы',
            'mens-suitcases-and-travel-bags': 'Чемоданы',
            
            'womens-belts': 'Ремни',
            'mens-belts': 'Ремни',
            
            'womens-hats': 'Шляпы',
            'mens-headwear': 'Головные уборы',
            'womens-headwear': 'Головные уборы',
            
            'womens-scarves': 'Шарфы',
            'womens-shawls-and-scarves': 'Шарфы и палантины',
            
            'womens-sunglasses': 'Солнцезащитные очки',
            'mens-sunglasses': 'Солнцезащитные очки',
            'mens-eyeglasses': 'Очки',
            'womens-eyeglasses': 'Очки',
            
            'mens-ties': 'Галстуки',
            'mens-bow-ties': 'Бабочки',
            
            'womens-watches': 'Часы',
            'mens-watches': 'Часы',
            
            'womens-earrings': 'Серьги',
            'womens-necklaces': 'Ожерелья',
            'womens-pendants': 'Подвески',
            'womens-bracelets': 'Браслеты',
            'womens-rings': 'Кольца',
            'womens-chains': 'Цепочки',
            'womens-jewelry-sets': 'Ювелирные наборы',
            
            'womens-hair-accessories': 'Аксессуары для волос',
            
            # === СПОРТ ===
            'mens-swimwear': 'Плавки',
            'womens-swimwear': 'Купальники',
            'mens-tracksuits': 'Спортивные костюмы',
            'womens-tracksuits': 'Спортивные костюмы',
            'sport-and-outdoor': 'Спорт и активный отдых',
            
            # === ДОМ И ДЕКОР ===
            'bedroom': 'Спальня',
            'bed-linen': 'Постельное белье',
            'bathroom': 'Ванная комната',
            'kitchen': 'Кухня',
            'living-room': 'Гостиная',
            'office': 'Офис',
            'kids-room': 'Детская комната',
            'lighting': 'Освещение',
            'decor': 'Декор',
            
            # === ДЕТСКОЕ ===
            'baby-clothing': 'Детская одежда',
            'baby-accessories': 'Детские аксессуары',
            'girls-accessories': 'Детские аксессуары',
            'boys-accessories': 'Детские аксессуары',
            'girls-overalls': 'Детские комбинезоны',
            'boys-overalls': 'Детские комбинезоны',
            
            # === ОСТАЛЬНОЕ ===
            'unisex': 'Унисекс',
            'islamic-clothing': 'Исламская одежда',
            'mens-suiting': 'Костюмы',
            'men-s-suit': 'Костюмы',
            'womens-suit-jackets-and-blazers': 'Пиджаки и жакеты',
            'mens-vests': 'Жилеты',
            
            'womens-kaftans-and-sarongs': 'Кафтаны и саронги',
            'women-face-masks': 'Маски для лица',
            'womens-cosmetics': 'Косметика',
            'women-s-cosmetics': 'Косметика',
            
            'mens-boots': 'Ботинки',
            'womens-boots-and-booties': 'Ботинки',
        }

    def clean_and_translate(self, raw_label):
        raw_label_lower = raw_label.lower().strip()
        if raw_label_lower in self.translation_map:
            return self.translation_map[raw_label_lower]
        for key, value in self.translation_map.items():
            if key in raw_label_lower:
                return value
        clean = re.sub(r'^(mens|womens|girls|boys|baby|women-s|men-s|men|women)-', '', raw_label_lower)
        return clean.replace('-', ' ').capitalize()

    def predict(self, image_path: str):
        img = Image.open(image_path).convert('RGB')
        img_tensor = self.transform(img).unsqueeze(0).to(self.device)
        with torch.no_grad():
            outputs = self.model(img_tensor)
            _, predicted = torch.max(outputs, 1)
        raw_label = self.label_encoder.inverse_transform([predicted.item()])[0]
        return self.clean_and_translate(raw_label)

ai_classifier = FashionClassifier()