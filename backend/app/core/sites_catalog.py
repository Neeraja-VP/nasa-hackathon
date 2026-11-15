"""
LUNA NAVIGATOR — Candidate Sites Data Access
"""

import json
import os
from typing import List, Optional, Dict
from app.core.config import settings
from app.schemas.sites import SiteSchema

# In-memory storage for user-defined custom landing sites
_CUSTOM_SITES: Dict[str, SiteSchema] = {}


def register_custom_site(site: SiteSchema) -> SiteSchema:
    """
    Register a user-defined custom landing site in the active catalog session.
    """
    _CUSTOM_SITES[site.id.lower()] = site
    return site


def get_custom_sites() -> List[SiteSchema]:
    """
    Retrieve all user-defined custom landing sites.
    """
    return list(_CUSTOM_SITES.values())


def clear_custom_sites() -> None:
    """
    Clear all custom sites (useful for testing resets).
    """
    _CUSTOM_SITES.clear()


def load_candidate_sites(include_custom: bool = True) -> List[SiteSchema]:
    """
    Load validated lunar south pole landing sites from local dataset file,
    plus any dynamically registered custom landing sites.
    """
    path = settings.CANDIDATE_SITES_PATH
    if not os.path.exists(path):
        # Fallback to absolute or relative scratch path
        alt_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "datasets", "sample", "candidate_sites.json")
        if os.path.exists(alt_path):
            path = alt_path
        else:
            raise FileNotFoundError(f"Candidate sites dataset not found at {path} or {alt_path}")
            
    with open(path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
        
    sites = [SiteSchema(**site) for site in raw_data]
    if include_custom and _CUSTOM_SITES:
        sites.extend(list(_CUSTOM_SITES.values()))
    return sites


def get_site_by_id(site_id: str) -> Optional[SiteSchema]:
    """
    Find candidate site by unique identifier (checking custom sites first).
    """
    if site_id.lower() in _CUSTOM_SITES:
        return _CUSTOM_SITES[site_id.lower()]

    sites = load_candidate_sites(include_custom=False)
    for s in sites:
        if s.id.lower() == site_id.lower():
            return s
    return None
