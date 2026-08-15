from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://markettrace:markettrace@localhost:5432/markettrace"
    cors_origins: list[str] = ["http://localhost:5173"]

    # Self-managed signing secret for issuing JWTs - not a third-party API
    # key. Override via .env for anything beyond local dev.
    jwt_secret_key: str = "dev-secret-change-me"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days


settings = Settings()
