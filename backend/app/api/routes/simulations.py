from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.simulation import Simulation, Trade
from app.models.strategy import Strategy as StrategyModel
from app.models.user import User
from app.schemas.portfolio import PortfolioSimulationRequest, PortfolioSimulationResult
from app.schemas.robustness import (
    MonteCarloRequest,
    MonteCarloResult,
    WalkForwardRequest,
    WalkForwardResult,
)
from app.schemas.simulation import (
    OptimizationRequest,
    OptimizationResult,
    RegimeSplit,
    SimulationRequest,
    SimulationResult,
    SimulationShareUpdate,
    SimulationSummary,
)
from app.services.backtester import (
    optimize_parameter_grid,
    run_backtest,
    run_monte_carlo_simulation,
    run_portfolio_backtest,
    run_walk_forward_backtest,
)

router = APIRouter(prefix="/api/simulations", tags=["simulations"])


# Handles POST /api/simulations — this is what the frontend's runSimulation()
# (frontend/src/api/client.ts) calls. FastAPI parses the incoming JSON body
# into `payload` (validated against the SimulationRequest schema) before this
# function ever runs, and Depends(get_db) hands it a live database session.
@router.post("", response_model=SimulationResult)
def create_simulation(
    payload: SimulationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        # The actual backtest: fetches historical prices and simulates trades
        # using the chosen strategy (see app/services/backtester.py).
        result = run_backtest(
            symbol=payload.stock_symbol,
            strategy_type=payload.strategy_type,
            parameters=payload.strategy_parameters,
            start_date=payload.start_date,
            end_date=payload.end_date,
            initial_capital=payload.initial_capital,
            fee_pct=payload.fee_pct,
            slippage_pct=payload.slippage_pct,
            position_size_pct=payload.position_size_pct,
        )
    except ValueError as exc:
        # e.g. unknown ticker symbol -> respond 404 instead of 500.
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    # Persist what was run: the strategy config used...
    strategy_record = StrategyModel(
        name=payload.strategy_type.value,
        type=payload.strategy_type,
        parameters=payload.strategy_parameters,
    )
    db.add(strategy_record)
    db.flush()  # writes to the DB now so strategy_record.id is assigned, without committing yet

    # ...the simulation run itself (linked to that strategy)...
    simulation = Simulation(
        stock_symbol=payload.stock_symbol.upper(),
        strategy_id=strategy_record.id,
        user_id=current_user.id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        initial_capital=payload.initial_capital,
        final_capital=result["final_capital"],
        total_return_pct=result["total_return_pct"],
    )
    db.add(simulation)
    db.flush()  # assigns simulation.id, needed below for each Trade's foreign key

    # ...and every individual trade the backtest produced.
    for trade in result["trades"]:
        db.add(Trade(simulation_id=simulation.id, **trade))

    # This is the JSON object that becomes the HTTP response body — it's what
    # arrives back at the frontend as `data` in runSimulation(), and ends up
    # as the `result` state that SimulatorPage.tsx renders.
    simulation_result = SimulationResult(
        id=simulation.id,
        stock_symbol=simulation.stock_symbol,
        strategy_type=strategy_record.type,
        strategy_name=strategy_record.name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        initial_capital=simulation.initial_capital,
        final_capital=simulation.final_capital,
        total_return_pct=simulation.total_return_pct,
        sharpe=result["sharpe"],
        return_before_costs_pct=result["return_before_costs_pct"],
        regime_split=RegimeSplit(
            bull_market_return_pct=result["bull_market_return_pct"],
            bear_market_return_pct=result["bear_market_return_pct"],
        ),
        regime_periods=result["regime_periods"],
        trades=result["trades"],
        equity_curve=result["equity_curve"],
        buy_and_hold_equity_curve=result["buy_and_hold_equity_curve"],
        buy_and_hold_return_pct=result["buy_and_hold_return_pct"],
        indicators=result["indicators"],
    )

    # Everything above except `trades` (already its own rows) isn't stored
    # anywhere else - snapshot it now so this run's report (private detail
    # view, or a public share link) can be re-rendered later without
    # re-running the backtest against live market data.
    simulation.report_data = simulation_result.model_dump(
        mode="json",
        include={
            "sharpe",
            "return_before_costs_pct",
            "regime_split",
            "regime_periods",
            "equity_curve",
            "buy_and_hold_equity_curve",
            "buy_and_hold_return_pct",
            "indicators",
        },
    )

    db.commit()  # writes all of the above to Postgres in one transaction

    return simulation_result


@router.post("/optimize", response_model=OptimizationResult)
def optimize_simulation(payload: OptimizationRequest, current_user: User = Depends(get_current_user)):
    try:
        results = optimize_parameter_grid(
            symbol=payload.stock_symbol,
            strategy_type=payload.strategy_type,
            strategy_parameters=payload.strategy_parameters,
            start_date=payload.start_date,
            end_date=payload.end_date,
            initial_capital=payload.initial_capital,
            fee_pct=payload.fee_pct,
            slippage_pct=payload.slippage_pct,
            position_size_pct=payload.position_size_pct,
            short_windows=payload.short_windows,
            long_windows=payload.long_windows,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return OptimizationResult(results=results)


# Handles POST /api/simulations/portfolio — runs the same strategy across a
# basket of symbols, splitting initial_capital across them by weight (equal
# split if weights is empty), and returns both a per-symbol comparison and a
# combined portfolio-level equity curve. Not persisted, same as /optimize.
@router.post("/portfolio", response_model=PortfolioSimulationResult)
def create_portfolio_simulation(
    payload: PortfolioSimulationRequest, current_user: User = Depends(get_current_user)
):
    try:
        result = run_portfolio_backtest(
            symbols=payload.stock_symbols,
            weights=payload.weights,
            strategy_type=payload.strategy_type,
            parameters=payload.strategy_parameters,
            start_date=payload.start_date,
            end_date=payload.end_date,
            initial_capital=payload.initial_capital,
            fee_pct=payload.fee_pct,
            slippage_pct=payload.slippage_pct,
            position_size_pct=payload.position_size_pct,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return PortfolioSimulationResult(**result)


# Handles POST /api/simulations/walk-forward — runs one continuous backtest
# over the requested date range, then reports performance separately for the
# in-sample "train" slice and the out-of-sample "test" slice on either side
# of a split date, so a strategy's real robustness (not just an overall
# number) is visible. Not persisted, same as /optimize and /portfolio.
@router.post("/walk-forward", response_model=WalkForwardResult)
def walk_forward_simulation(payload: WalkForwardRequest, current_user: User = Depends(get_current_user)):
    try:
        result = run_walk_forward_backtest(
            symbol=payload.stock_symbol,
            strategy_type=payload.strategy_type,
            parameters=payload.strategy_parameters,
            start_date=payload.start_date,
            end_date=payload.end_date,
            initial_capital=payload.initial_capital,
            fee_pct=payload.fee_pct,
            slippage_pct=payload.slippage_pct,
            position_size_pct=payload.position_size_pct,
            train_ratio=payload.train_ratio,
            optimize_on_train=payload.optimize_on_train,
            short_windows=payload.short_windows,
            long_windows=payload.long_windows,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return WalkForwardResult(**result)


# Handles POST /api/simulations/monte-carlo — bootstraps the strategy's own
# daily returns hundreds of times to show the distribution of plausible
# outcomes around the single observed backtest result, instead of just that
# one number. Not persisted, same as /optimize and /portfolio.
@router.post("/monte-carlo", response_model=MonteCarloResult)
def monte_carlo_simulation(payload: MonteCarloRequest, current_user: User = Depends(get_current_user)):
    try:
        result = run_monte_carlo_simulation(
            symbol=payload.stock_symbol,
            strategy_type=payload.strategy_type,
            parameters=payload.strategy_parameters,
            start_date=payload.start_date,
            end_date=payload.end_date,
            initial_capital=payload.initial_capital,
            fee_pct=payload.fee_pct,
            slippage_pct=payload.slippage_pct,
            position_size_pct=payload.position_size_pct,
            num_simulations=payload.num_simulations,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return MonteCarloResult(**result)


# Handles GET /api/simulations — the current user's saved runs, newest first.
# Backs the History page.
@router.get("", response_model=list[SimulationSummary])
def list_simulations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(Simulation, StrategyModel)
        .join(StrategyModel, Simulation.strategy_id == StrategyModel.id)
        .filter(Simulation.user_id == current_user.id)
        .order_by(Simulation.created_at.desc())
        .all()
    )
    return [
        SimulationSummary(
            id=simulation.id,
            stock_symbol=simulation.stock_symbol,
            strategy_type=strategy.type,
            strategy_name=strategy.name,
            start_date=simulation.start_date,
            end_date=simulation.end_date,
            initial_capital=simulation.initial_capital,
            final_capital=simulation.final_capital,
            total_return_pct=simulation.total_return_pct,
            created_at=simulation.created_at,
            is_public=simulation.is_public,
        )
        for simulation, strategy in rows
    ]


# Shared by the owner-only detail endpoint and the public share endpoint -
# both render the same report, just gated by a different auth check.
def _simulation_to_result(simulation: Simulation) -> SimulationResult:
    strategy = simulation.strategy
    report = simulation.report_data or {}

    return SimulationResult(
        id=simulation.id,
        stock_symbol=simulation.stock_symbol,
        strategy_type=strategy.type if strategy else None,
        strategy_name=strategy.name if strategy else None,
        start_date=simulation.start_date,
        end_date=simulation.end_date,
        initial_capital=simulation.initial_capital,
        final_capital=simulation.final_capital,
        total_return_pct=simulation.total_return_pct,
        return_before_costs_pct=report.get("return_before_costs_pct", 0.0),
        sharpe=report.get("sharpe", 0.0),
        regime_split=report.get("regime_split")
        or RegimeSplit(bull_market_return_pct=0.0, bear_market_return_pct=0.0),
        regime_periods=report.get("regime_periods", []),
        trades=[
            {
                "trade_type": t.trade_type,
                "trade_date": t.trade_date,
                "price": t.price,
                "quantity": t.quantity,
                "reason": t.reason,
            }
            for t in simulation.trades
        ],
        # Older rows saved before report_data existed fall back to an empty
        # chart - everything else (stats, trade log) still renders fine.
        equity_curve=report.get("equity_curve", []),
        buy_and_hold_equity_curve=report.get("buy_and_hold_equity_curve", []),
        buy_and_hold_return_pct=report.get("buy_and_hold_return_pct"),
        indicators=report.get("indicators", {}),
        is_public=simulation.is_public,
    )


# Handles GET /api/simulations/{id} — re-fetches a previously saved simulation
# from Postgres by its id, scoped to whoever owns it. Backs the History page's
# detail view.
@router.get("/{simulation_id}", response_model=SimulationResult)
def get_simulation(
    simulation_id: UUID, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    simulation = db.get(Simulation, simulation_id)
    if simulation is None or simulation.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return _simulation_to_result(simulation)


# Handles PATCH /api/simulations/{id}/share — owner-only toggle for the
# public/private flag. Backs the "Share" button: flipping is_public true
# turns the permalink at /share/{id} (frontend) / GET /public/{id} (this
# router) live; flipping it back false takes the link down again without
# deleting anything.
@router.patch("/{simulation_id}/share", response_model=SimulationResult)
def set_simulation_visibility(
    simulation_id: UUID,
    payload: SimulationShareUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    simulation = db.get(Simulation, simulation_id)
    if simulation is None or simulation.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Simulation not found")

    simulation.is_public = payload.is_public
    db.commit()
    db.refresh(simulation)

    return _simulation_to_result(simulation)


# Handles GET /api/simulations/public/{id} — the permalink target. No auth:
# anyone with the link can view a report, but only if its owner has flagged
# it public (a 404, not a 403, for both "doesn't exist" and "not shared" -
# doesn't confirm private simulation ids exist).
@router.get("/public/{simulation_id}", response_model=SimulationResult)
def get_public_simulation(simulation_id: UUID, db: Session = Depends(get_db)):
    simulation = db.get(Simulation, simulation_id)
    if simulation is None or not simulation.is_public:
        raise HTTPException(status_code=404, detail="Report not found")

    return _simulation_to_result(simulation)
