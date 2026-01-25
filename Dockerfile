FROM python:3.10-slim

WORKDIR /app

COPY backend /app/backend
COPY frontend/dist /app/frontend/dist
COPY frontend/studio /app/frontend/studio

RUN mkdir -p /app/backend/data /app/backend/downloads

RUN pip install --no-cache-dir fastapi uvicorn requests pydantic python-jose passlib[bcrypt]

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
