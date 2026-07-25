from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import simulations, stocks, strategies
from app.core.config import settings

app = FastAPI(title="MarketTrace API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stocks.router)
app.include_router(strategies.router)
app.include_router(simulations.router)


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
