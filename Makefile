.PHONY: help setup backend-setup frontend-setup db-up db-down migrate migration backend frontend up down test lint

help:
	@echo "make setup          Install backend + frontend dependencies"
	@echo "make db-up          Start Postgres in Docker"
	@echo "make db-down        Stop Postgres"
	@echo "make migrate        Apply database migrations"
	@echo "make migration msg=\"add trades table\"  Generate a new migration"
	@echo "make backend        Run the FastAPI dev server (localhost:8000)"
	@echo "make frontend       Run the React dev server (localhost:5173)"
	@echo "make up             Run the full stack in Docker Compose"
	@echo "make down           Stop the Docker Compose stack"
	@echo "make test           Run backend tests"
	@echo "make lint           Lint backend + frontend"

setup: backend-setup frontend-setup

backend-setup:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt

frontend-setup:
	cd frontend && npm install

db-up:
	docker compose up -d db

db-down:
	docker compose stop db

migrate:
	cd backend && .venv/bin/alembic upgrade head

migration:
	cd backend && .venv/bin/alembic revision --autogenerate -m "$(msg)"

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

up:
	docker compose up --build

down:
	docker compose down

test:
	cd backend && .venv/bin/pytest

lint:
	cd backend && .venv/bin/ruff check .
	cd frontend && npm run lint
