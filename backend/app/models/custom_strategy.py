import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CustomStrategyDefinition(Base):
    """A saved, named custom strategy built from user-defined buy/sell rules.

    Unlike `Strategy` (a per-run snapshot written once a simulation executes),
    rows here are the reusable templates that populate the strategy picker.
    """

    __tablename__ = "custom_strategies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    rules: Mapped[dict] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
