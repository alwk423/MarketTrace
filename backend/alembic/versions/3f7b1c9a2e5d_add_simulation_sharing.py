"""add public sharing fields to simulations

Revision ID: 3f7b1c9a2e5d
Revises: 6ddc65c3074a
Create Date: 2026-08-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '3f7b1c9a2e5d'
down_revision = '6ddc65c3074a'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'simulations', sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.create_index(op.f('ix_simulations_is_public'), 'simulations', ['is_public'])

    # Snapshot of the chart-only fields the backtest computes but never
    # persists elsewhere (equity curve, indicators, regime split/periods,
    # sharpe) - captured once at run time so a shared report (or the owner's
    # own history detail view) can render the full chart without re-running
    # the backtest against live market data.
    op.add_column('simulations', sa.Column('report_data', postgresql.JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column('simulations', 'report_data')
    op.drop_index(op.f('ix_simulations_is_public'), table_name='simulations')
    op.drop_column('simulations', 'is_public')
