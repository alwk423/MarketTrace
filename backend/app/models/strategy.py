import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class StrategyType(str, enum.Enum):
    SMA_CROSSOVER = "sma_crossover"
    RSI = "rsi"
    CUSTOM = "custom"


class Strategy(Base):
    """A strategy configuration used for one simulation run.

    A new row is written per run (rather than reused) so that a saved
    Simulation always points at the exact parameters that produced it.
    """

    __tablename__ = "strategies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[StrategyType] = mapped_column(Enum(StrategyType), nullable=False)
    parameters: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
