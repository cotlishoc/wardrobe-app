FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /code

COPY ./requirements.txt /code/requirements.txt

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir "numpy<2.0.0" && \
    pip install --no-cache-dir -r /code/requirements.txt && \
    pip install --no-cache-dir "rembg[cpu]"

RUN mkdir -p /.u2net && chmod 777 /.u2net

COPY . .

USER root
RUN mkdir -p /data/static/uploads /data/static/temp && chmod -R 777 /data

EXPOSE 7860

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]