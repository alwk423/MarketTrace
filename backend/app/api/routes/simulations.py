from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.simulation import Simulation, Trade
from app.models.strategy import Strategy as StrategyModel
from app.schemas.simulation import SimulationRequest, SimulationResult
from app.services.backtester import run_backtest

router = APIRouter(prefix="/api/simulations", tags=["simulations"])


@router.post("", response_model=SimulationResult)
def create_simulation(payload: SimulationRequest, db: Session = Depends(get_db)):
    try:
        result = run_backtest(
            symbol=payload.stock_symbol,
            strategy_type=payload.strategy_type,
            parameters=payload.strategy_parameters,
            start_date=payload.start_date,
            end_date=payload.end_date,
            initial_capital=payload.initial_capital,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    strategy_record = StrategyModel(
        name=payload.strategy_type.value,
        type=payload.strategy_type,
        parameters=payload.strategy_parameters,
    )
    db.add(strategy_record)
    db.flush()

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
    db.flush()

    for trade in result["trades"]:
        db.add(Trade(simulation_id=simulation.id, **trade))

    db.commit()

    return SimulationResult(
        id=simulation.id,
        stock_symbol=simulation.stock_symbol,
        start_date=payload.start_date,
        end_date=payload.end_date,
        initial_capital=simulation.initial_capital,
        final_capital=simulation.final_capital,
        total_return_pct=simulation.total_return_pct,
        trades=result["trades"],
        equity_curve=result["equity_curve"],
    )


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
