"""add users and scope simulations to a user

Revision ID: 6ddc65c3074a
Revises: 8a3f2c9e7d41
Create Date: 2026-08-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '6ddc65c3074a'
down_revision = '8a3f2c9e7d41'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)

    # Nullable: pre-existing simulations predate accounts and have no owner.
    # They stay in the DB but won't show up in anyone's history. Every row
    # created from here on always gets a user_id, since creating a
    # simulation now requires being logged in.
    op.add_column('simulations', sa.Column('user_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_simulations_user_id'), 'simulations', ['user_id'])
    op.create_foreign_key(
        'fk_simulations_user_id_users', 'simulations', 'users', ['user_id'], ['id'], ondelete='CASCADE'
    )


def downgrade() -> None:
    op.drop_constraint('fk_simulations_user_id_users', 'simulations', type_='foreignkey')
    op.drop_index(op.f('ix_simulations_user_id'), table_name='simulations')
    op.drop_column('simulations', 'user_id')

    op.drop_index(op.f('ix_users_email'), table_name='users')
    op.drop_table('users')
