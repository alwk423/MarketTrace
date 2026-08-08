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
    fee_pct: float = 0.1,
    slippage_pct: float = 0.05,
    position_size_pct: float = 100.0,
) -> dict:
    """Simulate a strategy over historical prices with realistic execution costs."""
    prices = get_price_history(symbol, start_date, end_date)
    strategy = build_strategy(strategy_type, parameters)
    signals = strategy.generate_signals(prices)
    # Allow strategies to expose their computed indicator series (optional).
    indicators = {}
    compute_indicators = getattr(strategy, "compute_indicators", None)
    if callable(compute_indicators):
        indicators = compute_indicators(prices)

    # Convert user-facing percentages into decimal values for the math below.
    fee_rate = fee_pct / 100.0
    slippage_rate = slippage_pct / 100.0
    # Clamp position size to a sensible range so it never exceeds 100% or goes below 0%.
    position_fraction = max(0.0, min(position_size_pct / 100.0, 1.0))

    def simulate(apply_costs: bool) -> tuple[list[dict], list[dict], float, float]:
        # Start each simulation with the same initial cash and no holdings.
        cash = initial_capital
        shares = 0.0
        trades: list[dict] = []
        equity_curve: list[dict] = []

        for timestamp, signal in signals.items():
            price = float(prices.loc[timestamp, "close"])

            if signal == 1 and cash > 0:
                # Use only a portion of available cash for the buy, based on position sizing.
                buy_amount = cash * position_fraction
                if buy_amount <= 0:
                    continue

                # Apply slippage to the fill price so the trade is slightly worse than the quoted price.
                execution_price = price * (1 + slippage_rate if apply_costs else 1.0)
                quantity = buy_amount / execution_price
                cost = quantity * execution_price
                # Charge a trading fee on the buy when cost modeling is enabled.
                fee = cost * fee_rate if apply_costs else 0.0
                cash -= cost + fee
                shares += quantity
                trades.append(
                    {
                        "trade_type": "buy",
                        "trade_date": timestamp,
                        "price": execution_price,
                        "quantity": quantity,
                        "reason": "Entry signal from strategy",
                    }
                )
            elif signal == -1 and shares > 0:
                # Sell execution is also slightly worse than the quoted price due to slippage.
                execution_price = price * (1 - slippage_rate if apply_costs else 1.0)
                proceeds = shares * execution_price
                # Charge a trading fee on the sell when cost modeling is enabled.
                fee = proceeds * fee_rate if apply_costs else 0.0
                cash += proceeds - fee
                trades.append(
                    {
                        "trade_type": "sell",
                        "trade_date": timestamp,
                        "price": execution_price,
                        "quantity": shares,
                        "reason": "Exit signal from strategy",
                    }
                )
                shares = 0.0

            # Track portfolio equity after each step using the current cash and holdings.
            equity = cash + shares * price
            equity_curve.append({"date": timestamp, "price": price, "equity": equity})

        final_price = float(prices["close"].iloc[-1])
        final_capital = cash + shares * final_price
        return trades, equity_curve, final_capital, (final_capital / initial_capital - 1) * 100

    trades, equity_curve, final_capital, total_return_pct = simulate(apply_costs=True)
    _, _, _, return_before_costs_pct = simulate(apply_costs=False)

    # Buy-and-hold benchmark: buy at first close, hold until each timestamp.
    first_price = float(prices["close"].iloc[0])
    final_price = float(prices["close"].iloc[-1])
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
        "return_before_costs_pct": return_before_costs_pct,
        "buy_and_hold_equity_curve": buy_and_hold_curve,
        "buy_and_hold_return_pct": buy_and_hold_return_pct,
        "indicators": serial_indicators,
    }
