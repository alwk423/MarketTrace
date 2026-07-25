from fastapi import APIRouter

from app.models.strategy import StrategyType

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


@router.get("")
def list_strategies():
    return STRATEGY_CATALOG
