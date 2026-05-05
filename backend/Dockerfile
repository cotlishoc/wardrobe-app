# Используем Python 3.12
FROM python:3.12-slim

# Устанавливаем системные зависимости для OpenCV и обработки изображений
# Мы заменили libgl1-mesa-glx на libgl1
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Создаем рабочую директорию
WORKDIR /code

# Копируем файл зависимостей
COPY ./requirements.txt /code/requirements.txt

# Устанавливаем зависимости
# Обязательно фиксируем numpy < 2.0 для совместимости с ИИ-библиотеками
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "numpy<2.0.0" && \
    pip install --no-cache-dir -r /code/requirements.txt && \
    pip install --no-cache-dir "rembg[cpu]"

# Создаем папку для весов нейросети
RUN mkdir -p /.u2net && chmod 777 /.u2net

# Копируем весь код приложения
COPY . .

# Настройка папок для бакета (вечный диск)
# Даем права root для создания и записи в /data
USER root
RUN mkdir -p /data/static/uploads /data/static/temp && chmod -R 777 /data

# Порт Hugging Face
EXPOSE 7860

# Запуск сервера. Убедись, что папка app находится в корне проекта
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]