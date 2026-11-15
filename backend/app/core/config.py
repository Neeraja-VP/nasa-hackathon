"""
LUNA NAVIGATOR — Application Configuration
"""
from typing import List, Union
from pydantic import field_validator, Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        case_sensitive=False,
        extra="ignore"
    )

    PROJECT_NAME: str = Field(default="LUNA NAVIGATOR", validation_alias=AliasChoices("PROJECT_NAME", "LUNA_PROJECT_NAME"))
    VERSION: str = Field(default="1.0.0", validation_alias=AliasChoices("VERSION", "LUNA_VERSION"))
    API_V1_STR: str = Field(default="/api/v1", validation_alias=AliasChoices("API_V1_STR", "LUNA_API_V1_STR"))
    
    # Environment
    ENVIRONMENT: str = Field(default="development", validation_alias=AliasChoices("ENVIRONMENT", "LUNA_ENVIRONMENT"))
    DEBUG: Union[bool, str] = Field(default=True, validation_alias=AliasChoices("DEBUG", "LUNA_DEBUG"))
    
    # CORS Origins
    ALLOWED_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:80",
            "http://localhost"
        ],
        validation_alias=AliasChoices("ALLOWED_ORIGINS", "LUNA_ALLOWED_ORIGINS")
    )

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return []
    
    # NASA JPL Horizons API
    HORIZONS_API_BASE_URL: str = Field(
        default="https://ssd.jpl.nasa.gov/api/horizons.api",
        validation_alias=AliasChoices("HORIZONS_API_BASE_URL", "LUNA_HORIZONS_API_BASE_URL")
    )
    HORIZONS_TIMEOUT_SECONDS: float = Field(
        default=30.0,
        validation_alias=AliasChoices("HORIZONS_TIMEOUT_SECONDS", "LUNA_HORIZONS_TIMEOUT_SECONDS")
    )
    
    # Geospatial Datasets Paths
    DATASETS_DIR: str = Field(default="datasets", validation_alias=AliasChoices("DATASETS_DIR", "LUNA_DATASETS_DIR"))
    LOLA_DEM_PATH: str = Field(default="datasets/dem/lola_south_pole_100m.tif", validation_alias=AliasChoices("LOLA_DEM_PATH", "LUNA_LOLA_DEM_PATH"))
    CANDIDATE_SITES_PATH: str = Field(default="datasets/sample/candidate_sites.json", validation_alias=AliasChoices("CANDIDATE_SITES_PATH", "LUNA_CANDIDATE_SITES_PATH"))
    
    # Database
    DATABASE_URL: str = Field(
        default="postgresql://luna_user:luna_password@localhost:5432/luna_navigator",
        validation_alias=AliasChoices("DATABASE_URL", "LUNA_DATABASE_URL")
    )


settings = Settings()
