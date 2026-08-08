from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.simulation import Simulation, Trade
from app.models.strategy import Strategy as StrategyModel
from app.schemas.simulation import SimulationRequest, SimulationResult
from app.services.backtester import run_backtest

router = APIRouter(prefix="/api/simulations", tags=["simulations"])


# Handles POST /api/simulations — this is what the frontend's runSimulation()
# (frontend/src/api/client.ts) calls. FastAPI parses the incoming JSON body
# into `payload` (validated against the SimulationRequest schema) before this
# function ever runs, and Depends(get_db) hands it a live database session.
@router.post("", response_model=SimulationResult)
def create_simulation(payload: SimulationRequest, db: Session = Depends(get_db)):
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

    db.commit()  # writes all of the above to Postgres in one transaction

    # This is the JSON object that becomes the HTTP response body — it's what
    # arrives back at the frontend as `data` in runSimulation(), and ends up
    # as the `result` state that SimulatorPage.tsx renders.
    return SimulationResult(
        id=simulation.id,
        stock_symbol=simulation.stock_symbol,
        start_date=payload.start_date,
        end_date=payload.end_date,
        initial_capital=simulation.initial_capital,
        final_capital=simulation.final_capital,
        total_return_pct=simulation.total_return_pct,
        return_before_costs_pct=result["return_before_costs_pct"],
        trades=result["trades"],
        equity_curve=result["equity_curve"],
    )


# Handles GET /api/simulations/{id} — re-fetches a previously saved simulation
# from Postgres by its id. Not currently called anywhere in the frontend, but
# available for e.g. a "view past run" feature.
@router.get("/{simulation_id}", response_model=SimulationResult)
def get_simulation(simulation_id: UUID, db: Session = Depends(get_db)):
    simulation = db.get(Simulation, simulation_id)
    if simulation is None:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return SimulationResult(
        id=simulation.id,
        stock_symbol=simulation.stock_symbol,
        start_date=simulation.start_date,
        end_date=simulation.end_date,
        initial_capital=simulation.initial_capital,
        final_capital=simulation.final_capital,
        total_return_pct=simulation.total_return_pct,
        return_before_costs_pct=0.0,
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
        # The equity curve isn't persisted (it's derivable from price history +
        # trades), so re-fetching a saved simulation returns trades only.
        equity_curve=[],
    )
