from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.custom_strategy import CustomStrategyDefinition
from app.models.strategy import StrategyType
from app.schemas.strategy import CustomStrategyCreate

router = APIRouter(prefix="/api/strategies", tags=["strategies"])

# Describes what the frontend needs to render a picker + parameter form.
# New strategies must be added here AND to STRATEGY_REGISTRY in services/backtester.py.
STRATEGY_CATALOG = [
    {
        "type": StrategyType.SMA_CROSSOVER,
        "label": "SMA Crossover",
        "description": (
            "Buy when the short moving average crosses above the long one, "
            "sell on the reverse cross."
        ),
        "parameters": [
            {"name": "short_window", "label": "Short window (days)", "default": 20},
            {"name": "long_window", "label": "Long window (days)", "default": 50},
        ],
    },
    {
        "type": StrategyType.RSI,
        "label": "RSI Mean Reversion",
        "description": (
            "Buy when RSI exits oversold territory, sell when it exits "
            "overbought territory."
        ),
        "parameters": [
            {"name": "period", "label": "RSI period (days)", "default": 14},
            {"name": "oversold", "label": "Oversold threshold", "default": 30},
            {"name": "overbought", "label": "Overbought threshold", "default": 70},
        ],
    },
]


def _custom_catalog_entry(row: CustomStrategyDefinition) -> dict:
    # Shaped like the built-in STRATEGY_CATALOG entries above so the frontend
    # can render saved custom strategies in the same picker, no special-casing
    # needed beyond the `is_custom` flag (used for the "Custom" badge).
    return {
        "type": StrategyType.CUSTOM,
        "id": str(row.id),
        "label": row.name,
        "description": "Custom strategy built from user-defined buy/sell rules.",
        "parameters": [],
        "is_custom": True,
        "rules": row.rules,
    }


@router.get("")
def list_strategies(db: Session = Depends(get_db)):
    custom_rows = db.query(CustomStrategyDefinition).order_by(CustomStrategyDefinition.created_at).all()
    return [*STRATEGY_CATALOG, *(_custom_catalog_entry(row) for row in custom_rows)]


# Handles POST /api/strategies/custom — saves a user-built rule set (from the
# strategy builder panel) so it shows up in future GET /api/strategies calls
# and can be selected/run just like a built-in strategy.
@router.post("/custom")
def create_custom_strategy(payload: CustomStrategyCreate, db: Session = Depends(get_db)):
    row = CustomStrategyDefinition(name=payload.name, rules=payload.rules.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return _custom_catalog_entry(row)
