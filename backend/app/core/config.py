"""
LUNA NAVIGATOR — Application Configuration
"""
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="LUNA_",
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "LUNA NAVIGATOR"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: Union[bool, str] = True
    
    # CORS Origins
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:80",
        "http://localhost"
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",") if i.strip()]
        return v
    
    # NASA JPL Horizons API
    HORIZONS_API_BASE_URL: str = "https://ssd.jpl.nasa.gov/api/horizons.api"
    HORIZONS_TIMEOUT_SECONDS: float = 30.0
    
    # Geospatial Datasets Paths
    DATASETS_DIR: str = "datasets"
    LOLA_DEM_PATH: str = "datasets/dem/lola_south_pole_100m.tif"
    CANDIDATE_SITES_PATH: str = "datasets/sample/candidate_sites.json"
    
    # Database
    DATABASE_URL: str = "postgresql://luna_user:luna_password@localhost:5432/luna_navigator"


settings = Settings()
