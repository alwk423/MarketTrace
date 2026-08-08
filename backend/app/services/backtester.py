from datetime import date

from pandas import isna

from app.models.strategy import StrategyType
from app.services.market_data import get_price_history
from app.services.strategies.base import Strategy
from app.services.strategies.rsi import RsiStrategy
from app.services.strategies.sma_crossover import SmaCrossoverStrategy

STRATEGY_REGISTRY: dict[StrategyType, type[Strategy]] = {
    StrategyType.SMA_CROSSOVER: SmaCrossoverStrategy,
    StrategyType.RSI: RsiStrategy,
}


def build_strategy(strategy_type: StrategyType, parameters: dict) -> Strategy:
    strategy_cls = STRATEGY_REGISTRY[strategy_type]
    return strategy_cls(**parameters)


def run_backtest(
    symbol: str,
    strategy_type: StrategyType,
    parameters: dict,
    start_date: date,
    end_date: date,
    initial_capital: float,
) -> dict:
    """Simulate a strategy over historical prices.

    Trading rule: on a buy signal, put all cash into the position; on a sell
    signal, liquidate the entire position. This keeps the simulation and its
    trade log easy to reason about — position sizing/partial fills are a
    natural next step, not something this scaffold needs yet.
    """
    prices = get_price_history(symbol, start_date, end_date)
    strategy = build_strategy(strategy_type, parameters)
    signals = strategy.generate_signals(prices)
    # Allow strategies to expose their computed indicator series (optional).
    indicators = {}
    compute_indicators = getattr(strategy, "compute_indicators", None)
    if callable(compute_indicators):
        indicators = compute_indicators(prices)

    cash = initial_capital
    shares = 0.0
    trades: list[dict] = []
    equity_curve: list[dict] = []

    for timestamp, signal in signals.items():
        price = float(prices.loc[timestamp, "close"])

        if signal == 1 and cash > 0:
            shares = cash / price
            cash = 0.0
            trades.append(
                {
                    "trade_type": "buy",
                    "trade_date": timestamp,
                    "price": price,
                    "quantity": shares,
                    "reason": "Entry signal from strategy",
                }
            )
        elif signal == -1 and shares > 0:
            cash = shares * price
            trades.append(
                {
                    "trade_type": "sell",
                    "trade_date": timestamp,
                    "price": price,
                    "quantity": shares,
                    "reason": "Exit signal from strategy",
                }
            )
            shares = 0.0

        equity = cash + shares * price
        equity_curve.append({"date": timestamp, "price": price, "equity": equity})

    final_price = float(prices["close"].iloc[-1])
    final_capital = cash + shares * final_price
    total_return_pct = (final_capital / initial_capital - 1) * 100

    # Buy-and-hold benchmark: buy at first close, hold until each timestamp.
    first_price = float(prices["close"].iloc[0])
    buy_shares = initial_capital / first_price
    buy_and_hold_curve = []
    for timestamp in prices.index:
        p = float(prices.loc[timestamp, "close"])
        buy_and_hold_curve.append({"date": timestamp, "price": p, "equity": buy_shares * p})
    final_bh = buy_shares * final_price
    buy_and_hold_return_pct = (final_bh / initial_capital - 1) * 100

    # Convert any indicator Series objects into serializable lists of (date, value)
    serial_indicators: dict[str, list[dict]] = {}
    for name, series in indicators.items():
        # `series` is expected to be a pandas Series indexed by timestamps
        serial_indicators[name] = [
            {"date": ts, "value": (None if isna(val) else float(val))}
            for ts, val in series.items()
        ]

    return {
        "trades": trades,
        "equity_curve": equity_curve,
        "final_capital": final_capital,
        "total_return_pct": total_return_pct,
        "buy_and_hold_equity_curve": buy_and_hold_curve,
        "buy_and_hold_return_pct": buy_and_hold_return_pct,
        "indicators": serial_indicators,
    }
