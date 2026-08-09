from datetime import date
import math

import pandas as pd
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


def _calculate_sharpe_ratio(equity_curve: list[dict]) -> float:
    if len(equity_curve) < 2:
        return 0.0

    equity_series = pd.Series(
        [point["equity"] for point in equity_curve],
        index=pd.to_datetime([point["date"] for point in equity_curve]),
    ).sort_index()
    daily_returns = equity_series.pct_change().dropna()
    if daily_returns.empty:
        return 0.0

    volatility = daily_returns.std(ddof=0)
    if volatility == 0 or pd.isna(volatility):
        return 0.0

    # Assumes 0% risk-free rate; sqrt(252) annualizes the daily Sharpe (252 trading days/year).
    return float((daily_returns.mean() / volatility) * math.sqrt(252))


def _build_regime_series(prices: pd.DataFrame) -> pd.Series:
    close = prices["close"]
    sma200 = close.rolling(200).mean()
    regime = pd.Series(index=prices.index, dtype="object")

    # First 199 rows have no 200-day SMA yet, so their regime stays undefined (NaN).
    known_regime = sma200.notna()
    regime.loc[known_regime & (close >= sma200)] = "bull"
    regime.loc[known_regime & (close < sma200)] = "bear"
    return regime


def _build_regime_periods(regime_series: pd.Series) -> list[dict]:
    # Collapses day-by-day bull/bear labels into contiguous start/end date ranges.
    periods: list[dict] = []
    current_regime = None
    start_date = None
    end_date = None

    for timestamp, regime in regime_series.dropna().items():
        if current_regime is None:
            current_regime = regime
            start_date = timestamp
            end_date = timestamp
            continue

        if regime == current_regime:
            end_date = timestamp
            continue

        periods.append(
            {
                "regime": current_regime,
                "start_date": start_date,
                "end_date": end_date,
            }
        )
        current_regime = regime
        start_date = timestamp
        end_date = timestamp

    if current_regime is not None:
        periods.append(
            {
                "regime": current_regime,
                "start_date": start_date,
                "end_date": end_date,
            }
        )

    return periods


def _calculate_regime_returns(prices: pd.DataFrame, equity_curve: list[dict]) -> dict:
    if len(equity_curve) < 2:
        return {"bull_market_return_pct": 0.0, "bear_market_return_pct": 0.0, "regime_periods": []}

    regime_series = _build_regime_series(prices)
    regime_periods = _build_regime_periods(regime_series)

    # Rebuild the strategy's equity curve as a date-indexed Series so pct_change/reindex line up by date.
    equity_series = pd.Series(
        [point["equity"] for point in equity_curve],
        index=pd.to_datetime([point["date"] for point in equity_curve]),
    ).sort_index()
    # Day-over-day % change in equity (vs. the prior day, not the starting balance).
    daily_returns = equity_series.pct_change().dropna()
    # Align both series to the same dates before masking (regime is undefined for the first 199 days).
    aligned_regimes = regime_series.reindex(daily_returns.index).dropna()
    daily_returns = daily_returns.reindex(aligned_regimes.index)

    def compound_return(label: str) -> float:
        # Chains only the days matching this regime, as if those returns happened back-to-back
        # (not literal chronological compounding, since the excluded days are skipped over).
        regime_returns = daily_returns[aligned_regimes == label]
        if regime_returns.empty:
            return 0.0
        # Multiply growth factors (1 + r), not the raw percentages, then subtract 1 to compound correctly.
        return float((1 + regime_returns).prod() - 1)

    return {
        "bull_market_return_pct": compound_return("bull"),
        "bear_market_return_pct": compound_return("bear"),
        "regime_periods": regime_periods,
    }


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
    price_history: pd.DataFrame | None = None,
) -> dict:
    """Simulate a strategy over historical prices with realistic execution costs."""
    prices = price_history if price_history is not None else get_price_history(symbol, start_date, end_date)
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
    # Fraction of available cash committed per buy signal (risk sizing lever); clamp to [0%, 100%]
    # so a bad input can't push the simulation into borrowing cash or negative sizing.
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
                # Deploy only position_fraction of cash, leaving the rest in reserve rather than going all-in.
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
    sharpe_ratio = _calculate_sharpe_ratio(equity_curve)
    regime_analysis = _calculate_regime_returns(prices, equity_curve)

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
        "sharpe": sharpe_ratio,
        "return_before_costs_pct": return_before_costs_pct,
        "buy_and_hold_equity_curve": buy_and_hold_curve,
        "buy_and_hold_return_pct": buy_and_hold_return_pct,
        "indicators": serial_indicators,
        "bull_market_return_pct": regime_analysis["bull_market_return_pct"],
        "bear_market_return_pct": regime_analysis["bear_market_return_pct"],
        "regime_periods": regime_analysis["regime_periods"],
    }


def optimize_parameter_grid(
    symbol: str,
    strategy_type: StrategyType,
    strategy_parameters: dict,
    start_date: date,
    end_date: date,
    initial_capital: float,
    fee_pct: float = 0.1,
    slippage_pct: float = 0.05,
    position_size_pct: float = 100.0,
    short_windows: list[int] | None = None,
    long_windows: list[int] | None = None,
) -> list[dict]:
    if strategy_type != StrategyType.SMA_CROSSOVER:
        raise ValueError("Parameter optimization is only available for the SMA crossover strategy")

    prices = get_price_history(symbol, start_date, end_date)
    short_windows = short_windows or [5, 10, 15, 20, 25, 30]
    long_windows = long_windows or [20, 30, 40, 50, 60, 80]

    results: list[dict] = []
    for short_window in short_windows:
        for long_window in long_windows:
            # A crossover is meaningless if the "long" average reacts faster than the "short" one.
            if long_window <= short_window:
                continue

            parameters = {
                **strategy_parameters,
                "short_window": short_window,
                "long_window": long_window,
            }
            run_result = run_backtest(
                symbol=symbol,
                strategy_type=strategy_type,
                parameters=parameters,
                start_date=start_date,
                end_date=end_date,
                initial_capital=initial_capital,
                fee_pct=fee_pct,
                slippage_pct=slippage_pct,
                position_size_pct=position_size_pct,
                price_history=prices,
            )
            results.append(
                {
                    "parameters": {"short_window": short_window, "long_window": long_window},
                    "return_pct": run_result["total_return_pct"],
                    "sharpe": run_result["sharpe"],
                }
            )

    return results
