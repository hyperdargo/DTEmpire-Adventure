FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 WEB_PORT=8081 WEB_RELOADER=0
COPY requirements-adventure.txt ./
RUN pip install --no-cache-dir -r requirements-adventure.txt
COPY . .
EXPOSE 8081
CMD ["gunicorn", "--chdir", "web", "--bind", "0.0.0.0:8081", "--workers", "1", "--threads", "4", "--timeout", "120", "app:app"]
