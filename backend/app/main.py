from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, simulations, stocks, strategies
from app.core.config import settings

# The actual server object — this is what `uvicorn app.main:app` runs and
# listens with on port 8000 (started via `make backend`). Freshly created,
# it doesn't know about any routes yet.
app = FastAPI(title="MarketTrace API")

# Lets a browser page served from a different origin (e.g. a deployed
# frontend, not the same host:port) call this API without being blocked.
# Not needed for local dev, since Vite's proxy makes every request look
# same-origin from the browser's point of view.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Each imported module defines its own `router` with its own path prefix
# (e.g. simulations.py's router has prefix="/api/simulations"). Nothing in
# those files is reachable until it's registered here — this is the step
# that actually wires "POST /api/simulations" to create_simulation() etc.
app.include_router(auth.router)
app.include_router(stocks.router)
app.include_router(strategies.router)
app.include_router(simulations.router)


# A tiny route defined directly on `app` instead of in its own router file —
# fine for something this small. Useful for checking "is the backend up" (used
# by Docker Compose/CI, not called from the frontend UI).
@app.get("/api/health")
def health_check():
    return {"status": "ok"}
