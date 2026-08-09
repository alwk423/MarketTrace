"""add custom strategies

Revision ID: 8a3f2c9e7d41
Revises: 1155943f59bd
Create Date: 2026-08-09 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '8a3f2c9e7d41'
down_revision = '1155943f59bd'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ADD VALUE can't run inside the transaction Alembic normally wraps
    # migrations in - autocommit_block() runs it outside that transaction.
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE strategytype ADD VALUE 'CUSTOM'")

    op.create_table(
        'custom_strategies',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('rules', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('custom_strategies')
    # Postgres has no ALTER TYPE ... DROP VALUE, so 'custom' stays a valid
    # strategytype value even after downgrade.
