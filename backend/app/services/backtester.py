from datetime import date, timedelta
import math

import numpy as np
import pandas as pd
from pandas import isna

from app.models.strategy import StrategyType
from app.services.market_data import get_price_history
from app.services.strategies.base import Strategy
from app.services.strategies.custom import CustomStrategy
from app.services.strategies.rsi import RsiStrategy
from app.services.strategies.sma_crossover import SmaCrossoverStrategy

STRATEGY_REGISTRY: dict[StrategyType, type[Strategy]] = {
    StrategyType.SMA_CROSSOVER: SmaCrossoverStrategy,
    StrategyType.RSI: RsiStrategy,
    StrategyType.CUSTOM: CustomStrategy,
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


def _equity_series(equity_curve: list[dict]) -> pd.Series:
    # Reshapes one symbol's [{"date", "equity"}, ...] into a date-indexed
    # Series purely so _combine_equity_series can line multiple symbols up
    # by date and add them - no math happens here.
    if not equity_curve:
        return pd.Series(dtype=float)
    return pd.Series(
        [point["equity"] for point in equity_curve],
        index=pd.to_datetime([point["date"] for point in equity_curve]),
    ).sort_index()


def _combine_equity_series(series_list: list[pd.Series]) -> list[dict]:
    # Portfolio equity on a given date is just every symbol's dollar equity
    # on that date added together - this is the entire "combine" step.
    non_empty = [series for series in series_list if not series.empty]
    if not non_empty:
        return []

    # axis=1 concat lines the series up side by side by date, e.g.:
    #   date        AAPL    MSFT
    #   Day1        7000    3000
    #   Day2        7140    2970
    combined = pd.concat(non_empty, axis=1)
    # Forward/back-fill each symbol's equity across dates it didn't trade (e.g. a
    # different holiday calendar or listing date). Without this, a missing cell
    # is NaN and .sum(axis=1) below treats NaN as 0 - silently dropping that
    # symbol's capital from the total for that day instead of carrying it over.
    combined = combined.ffill().bfill()
    # Row-wise sum: Day1 -> 7000+3000=10000, Day2 -> 7140+2970=10110, etc.
    total = combined.sum(axis=1)
    return [{"date": timestamp, "equity": float(value)} for timestamp, value in total.items()]


def run_portfolio_backtest(
    symbols: list[str],
    weights: dict[str, float] | None,
    strategy_type: StrategyType,
    parameters: dict,
    start_date: date,
    end_date: date,
    initial_capital: float,
    fee_pct: float = 0.1,
    slippage_pct: float = 0.05,
    position_size_pct: float = 100.0,
) -> dict:
    """Run the same strategy independently across a basket of symbols, splitting
    initial capital across them by weight (equal split by default), then combine
    the per-symbol equity curves into one portfolio-level equity curve."""
    if not symbols:
        raise ValueError("At least one symbol is required")

    unique_symbols = list(dict.fromkeys(symbol.upper() for symbol in symbols))

    # Weights don't need to sum to 1 (or 100) coming in - dividing by their own
    # total normalizes whatever was supplied. No usable weights -> equal split.
    raw_weights = {symbol: max(0.0, (weights or {}).get(symbol, 0.0)) for symbol in unique_symbols}
    weight_total = sum(raw_weights.values())
    if weight_total <= 0:
        normalized_weights = {symbol: 1.0 / len(unique_symbols) for symbol in unique_symbols}
    else:
        normalized_weights = {symbol: weight / weight_total for symbol, weight in raw_weights.items()}

    symbol_results: list[dict] = []
    equity_series_list: list[pd.Series] = []
    buy_and_hold_series_list: list[pd.Series] = []

    for symbol in unique_symbols:
        weight = normalized_weights[symbol]
        # Each symbol is backtested independently with just its slice of
        # capital - fee/slippage/return math is all percentage-based, so a
        # symbol's total_return_pct/sharpe come out identical regardless of
        # how much capital it's given. That's what lets the same run double
        # as both the per-symbol comparison row AND a dollar-accurate input
        # to the combined curve below.
        allocated_capital = initial_capital * weight
        result = run_backtest(
            symbol=symbol,
            strategy_type=strategy_type,
            parameters=parameters,
            start_date=start_date,
            end_date=end_date,
            initial_capital=allocated_capital,
            fee_pct=fee_pct,
            slippage_pct=slippage_pct,
            position_size_pct=position_size_pct,
        )
        symbol_results.append(
            {
                "symbol": symbol,
                "weight": weight,
                "allocated_capital": allocated_capital,
                "final_capital": result["final_capital"],
                "total_return_pct": result["total_return_pct"],
                "return_before_costs_pct": result["return_before_costs_pct"],
                "sharpe": result["sharpe"],
                "buy_and_hold_return_pct": result["buy_and_hold_return_pct"],
                "trades": result["trades"],
                "equity_curve": result["equity_curve"],
            }
        )
        equity_series_list.append(_equity_series(result["equity_curve"]))
        buy_and_hold_series_list.append(_equity_series(result["buy_and_hold_equity_curve"]))

    combined_equity_curve = _combine_equity_series(equity_series_list)
    combined_buy_and_hold_curve = _combine_equity_series(buy_and_hold_series_list)

    final_capital = combined_equity_curve[-1]["equity"] if combined_equity_curve else initial_capital
    # Summing dollar curves then computing % return is equivalent to a
    # weight-average of each symbol's own total_return_pct.
    total_return_pct = (final_capital / initial_capital - 1) * 100
    # Sharpe is NOT a weighted average of the per-symbol Sharpes - it has to
    # be recomputed off the combined curve's own day-to-day % swings, since
    # symbols rarely move in lockstep (diversification changes volatility).
    sharpe = _calculate_sharpe_ratio(combined_equity_curve)

    final_buy_and_hold = combined_buy_and_hold_curve[-1]["equity"] if combined_buy_and_hold_curve else initial_capital
    buy_and_hold_return_pct = (final_buy_and_hold / initial_capital - 1) * 100

    return {
        "symbols": symbol_results,
        "initial_capital": initial_capital,
        "final_capital": final_capital,
        "total_return_pct": total_return_pct,
        "sharpe": sharpe,
        "combined_equity_curve": combined_equity_curve,
        "combined_buy_and_hold_equity_curve": combined_buy_and_hold_curve,
        "combined_buy_and_hold_return_pct": buy_and_hold_return_pct,
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
    price_history: pd.DataFrame | None = None,
) -> list[dict]:
    if strategy_type != StrategyType.SMA_CROSSOVER:
        raise ValueError("Parameter optimization is only available for the SMA crossover strategy")

    prices = price_history if price_history is not None else get_price_history(symbol, start_date, end_date)
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


def _split_equity_curve(equity_curve: list[dict], split_timestamp: pd.Timestamp) -> tuple[list[dict], list[dict]]:
    # Everything before the split is "train" (in-sample), everything from the
    # split date onward is "test" (out-of-sample) - one continuous run, just
    # sliced by date for reporting.
    train = [point for point in equity_curve if pd.Timestamp(point["date"]) < split_timestamp]
    test = [point for point in equity_curve if pd.Timestamp(point["date"]) >= split_timestamp]
    return train, test


def _summarize_window(points: list[dict], window_trades: list[dict]) -> dict:
    if not points:
        return {
            "start_date": None,
            "end_date": None,
            "total_return_pct": 0.0,
            "sharpe": 0.0,
            "final_capital": 0.0,
            "trade_count": len(window_trades),
        }

    first_equity = points[0]["equity"]
    last_equity = points[-1]["equity"]
    total_return_pct = (last_equity / first_equity - 1) * 100 if first_equity else 0.0

    return {
        "start_date": pd.Timestamp(points[0]["date"]).date(),
        "end_date": pd.Timestamp(points[-1]["date"]).date(),
        "total_return_pct": total_return_pct,
        "sharpe": _calculate_sharpe_ratio(points),
        "final_capital": last_equity,
        "trade_count": len(window_trades),
    }


def run_walk_forward_backtest(
    symbol: str,
    strategy_type: StrategyType,
    parameters: dict,
    start_date: date,
    end_date: date,
    initial_capital: float,
    fee_pct: float = 0.1,
    slippage_pct: float = 0.05,
    position_size_pct: float = 100.0,
    train_ratio: float = 0.7,
    optimize_on_train: bool = False,
    short_windows: list[int] | None = None,
    long_windows: list[int] | None = None,
) -> dict:
    """Run one continuous backtest over [start_date, end_date], then report
    performance separately for the "train" (in-sample) slice before the split
    and the "test" (out-of-sample) slice after it - answering "did this still
    work on data the strategy/parameters weren't tuned against?"

    If optimize_on_train is set (SMA crossover only), the short/long window
    grid is searched against just the train slice, and the winning pair (by
    Sharpe, then return) is what actually runs across the full period -
    mirroring how a trader would pick parameters using only data available
    up to the split, then find out how they held up afterward.
    """
    if not (0 < train_ratio < 1):
        raise ValueError("train_ratio must be between 0 and 1")
    if optimize_on_train and strategy_type != StrategyType.SMA_CROSSOVER:
        raise ValueError("Walk-forward parameter optimization is only available for the SMA crossover strategy")

    total_days = (end_date - start_date).days
    split_date = start_date + timedelta(days=round(total_days * train_ratio))
    if split_date <= start_date or split_date >= end_date:
        raise ValueError("train_ratio leaves an empty train or test window")

    prices = get_price_history(symbol, start_date, end_date)

    final_parameters = dict(parameters)
    optimized_parameters: dict | None = None
    if optimize_on_train:
        train_prices = prices.loc[pd.Timestamp(start_date):pd.Timestamp(split_date)]
        grid_results = optimize_parameter_grid(
            symbol=symbol,
            strategy_type=strategy_type,
            strategy_parameters=parameters,
            start_date=start_date,
            end_date=split_date,
            initial_capital=initial_capital,
            fee_pct=fee_pct,
            slippage_pct=slippage_pct,
            position_size_pct=position_size_pct,
            short_windows=short_windows,
            long_windows=long_windows,
            price_history=train_prices,
        )
        if grid_results:
            best = max(grid_results, key=lambda r: (r["sharpe"], r["return_pct"]))
            optimized_parameters = best["parameters"]
            final_parameters = {**parameters, **optimized_parameters}

    result = run_backtest(
        symbol=symbol,
        strategy_type=strategy_type,
        parameters=final_parameters,
        start_date=start_date,
        end_date=end_date,
        initial_capital=initial_capital,
        fee_pct=fee_pct,
        slippage_pct=slippage_pct,
        position_size_pct=position_size_pct,
        price_history=prices,
    )

    split_ts = pd.Timestamp(split_date)
    train_points, test_points = _split_equity_curve(result["equity_curve"], split_ts)
    train_trades = [trade for trade in result["trades"] if pd.Timestamp(trade["trade_date"]) < split_ts]
    test_trades = [trade for trade in result["trades"] if pd.Timestamp(trade["trade_date"]) >= split_ts]

    train_summary = _summarize_window(train_points, train_trades)
    test_summary = _summarize_window(test_points, test_trades)
    if train_summary["start_date"] is None or test_summary["start_date"] is None:
        raise ValueError("train_ratio leaves an empty train or test window - widen the backtest date range")

    return {
        "split_date": split_date,
        "optimized_parameters": optimized_parameters,
        "train": train_summary,
        "test": test_summary,
        "equity_curve": result["equity_curve"],
        "buy_and_hold_equity_curve": result["buy_and_hold_equity_curve"],
    }


def run_monte_carlo_simulation(
    symbol: str,
    strategy_type: StrategyType,
    parameters: dict,
    start_date: date,
    end_date: date,
    initial_capital: float,
    fee_pct: float = 0.1,
    slippage_pct: float = 0.05,
    position_size_pct: float = 100.0,
    num_simulations: int = 500,
) -> dict:
    """Bootstrap the strategy's own daily returns to see how much the single
    observed result could plausibly have varied by chance. Each simulation
    resamples len(daily_returns) days with replacement (so the same day can
    be drawn more than once, or not at all) and compounds them into one
    possible final return - repeated num_simulations times to build a
    distribution, against which the real observed return is ranked."""
    if num_simulations < 1:
        raise ValueError("num_simulations must be at least 1")

    result = run_backtest(
        symbol=symbol,
        strategy_type=strategy_type,
        parameters=parameters,
        start_date=start_date,
        end_date=end_date,
        initial_capital=initial_capital,
        fee_pct=fee_pct,
        slippage_pct=slippage_pct,
        position_size_pct=position_size_pct,
    )
    observed_return_pct = result["total_return_pct"]

    daily_returns = _equity_series(result["equity_curve"]).pct_change().dropna().to_numpy()

    if daily_returns.size == 0:
        flat_percentiles = {"p5": 0.0, "p25": 0.0, "p50": 0.0, "p75": 0.0, "p95": 0.0}
        return {
            "observed_return_pct": observed_return_pct,
            "observed_percentile": 50.0,
            "mean_return_pct": 0.0,
            "median_return_pct": 0.0,
            "std_dev_pct": 0.0,
            "percentiles": flat_percentiles,
            "simulated_returns_pct": [],
        }

    rng = np.random.default_rng()
    n_days = daily_returns.size
    samples = rng.choice(daily_returns, size=(num_simulations, n_days), replace=True)
    # Multiply each simulated path's daily growth factors together (not the
    # raw % returns) to compound correctly, same as _calculate_regime_returns.
    simulated_returns_pct = ((1 + samples).prod(axis=1) - 1) * 100

    observed_percentile = float((simulated_returns_pct <= observed_return_pct).mean() * 100)
    percentiles = {
        label: float(np.percentile(simulated_returns_pct, pct))
        for label, pct in (("p5", 5), ("p25", 25), ("p50", 50), ("p75", 75), ("p95", 95))
    }

    return {
        "observed_return_pct": observed_return_pct,
        "observed_percentile": observed_percentile,
        "mean_return_pct": float(simulated_returns_pct.mean()),
        "median_return_pct": float(np.median(simulated_returns_pct)),
        "std_dev_pct": float(simulated_returns_pct.std(ddof=0)),
        "percentiles": percentiles,
        "simulated_returns_pct": simulated_returns_pct.tolist(),
    }
