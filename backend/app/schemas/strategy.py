import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, model_validator

Indicator = Literal["sma", "rsi", "price"]
Operator = Literal["<", "<=", ">", ">=", "==", "!="]


class RuleCondition(BaseModel):
    indicator: Indicator
    period: int | None = None
    op: Operator
    value: float

    # A plain @field_validator on `period` would get skipped whenever the
    # client omits `period` entirely (Pydantic doesn't run field validators
    # for fields left at their default) - model_validator always runs, so
    # the "rsi/sma need a period" check can't be silently bypassed that way.
    @model_validator(mode="after")
    def period_required_unless_price(self) -> "RuleCondition":
        if self.indicator != "price" and (self.period is None or self.period < 1):
            raise ValueError("period is required and must be >= 1 for the sma/rsi indicators")
        return self


class RuleGroup(BaseModel):
    all: list[RuleCondition] = Field(default_factory=list)


class CustomStrategyRules(BaseModel):
    buy: RuleGroup = Field(default_factory=RuleGroup)
    sell: RuleGroup = Field(default_factory=RuleGroup)

    @model_validator(mode="after")
    def at_least_one_condition(self) -> "CustomStrategyRules":
        if not self.buy.all and not self.sell.all:
            raise ValueError("At least one buy or sell condition is required")
        return self


class CustomStrategyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    rules: CustomStrategyRules


class CustomStrategyRead(BaseModel):
    id: uuid.UUID
    name: str
    rules: CustomStrategyRules
    created_at: datetime

    model_config = {"from_attributes": True}
