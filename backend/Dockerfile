FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Applies any pending migrations before the server starts accepting traffic,
# so a deploy that adds a migration (like this one) can't land ahead of the
# schema it depends on - alembic no-ops if the DB is already at head.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
