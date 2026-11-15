"""
LUNA NAVIGATOR — Recommendation Engine & MCDA Unit Tests (Member 4 Ownership)
Tests multi-criteria scoring, constraints violations, explainability narratives,
and safety boundaries (no fabricated safety certification).
"""

from datetime import datetime, timezone
import pytest
from app.schemas.recommend import RecommendRequest, WeightsConfig, ConstraintsConfig
from app.engines.recommendation.engine import recommendation_engine, SAFETY_DISCLAIMER_TEXT


def test_mcda_recommendation_ranking_order():
    """Verify recommendation engine ranks sites descending by composite score."""
    req = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=3.0,
        weights=WeightsConfig(
            solar_illumination=0.35,
            earth_communication=0.30,
            slope_safety=0.20,
            elevation_advantage=0.15
        )
    )
    res = recommendation_engine.recommend_sites(req)
    assert len(res.ranking) > 0
    
    # Verify rankings are strictly 1, 2, 3...
    for i, ranked in enumerate(res.ranking, start=1):
        assert ranked.rank == i

    # Verify scores are monotonically non-increasing
    scores = [r.total_score for r in res.ranking]
    assert scores == sorted(scores, reverse=True)


def test_mcda_hard_constraints_disqualification():
    """Verify that sites violating operational limits are properly disqualified."""
    # Impose extremely strict slope limit of 5.0 degrees
    # Sites with slope > 5.0° (e.g. Shackleton at 8.5°, Haworth at 7.8°) must be disqualified
    strict_req = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=3.0,
        constraints=ConstraintsConfig(
            min_illumination_percentage=20.0,
            min_communication_percentage=20.0,
            max_acceptable_slope_degrees=5.0,  # Strict cutoff
            max_continuous_shadow_hours=500.0
        )
    )
    res = recommendation_engine.recommend_sites(strict_req)
    disqualified_ids = [d.site_id for d in res.disqualified_sites]
    
    # Shackleton (8.5° slope) must be disqualified
    assert "shackleton-rim" in disqualified_ids
    
    # Verify violation explanation mentions slope
    shackleton_disq = next(d for d in res.disqualified_sites if d.site_id == "shackleton-rim")
    assert any("Slope" in v for v in shackleton_disq.violations)


def test_mcda_weight_normalization_invariance():
    """Verify that scaling all weights by a constant factor does not change scores."""
    req_base = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=3.0,
        weights=WeightsConfig(solar_illumination=0.4, earth_communication=0.3, slope_safety=0.2, elevation_advantage=0.1)
    )
    res_base = recommendation_engine.recommend_sites(req_base)

    req_scaled = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=3.0,
        weights=WeightsConfig(solar_illumination=0.8, earth_communication=0.6, slope_safety=0.4, elevation_advantage=0.2)
    )
    res_scaled = recommendation_engine.recommend_sites(req_scaled)

    for r_b, r_s in zip(res_base.ranking, res_scaled.ranking):
        assert r_b.site_id == r_s.site_id
        assert abs(r_b.total_score - r_s.total_score) < 0.1


def test_explainability_and_safety_disclaimer():
    """Verify explainability breakdown, risk categorization, and mandatory safety notices."""
    req = RecommendRequest(
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=3.0
    )
    res = recommendation_engine.recommend_sites(req)
    assert len(res.scientific_disclaimer) > 50
    assert "NASA" in res.scientific_disclaimer
    assert "NOT constitute NASA certification" in res.scientific_disclaimer

    for ranked in res.ranking:
        # Check decomposition
        assert "solar_illumination" in ranked.scores_breakdown
        assert "earth_communication" in ranked.scores_breakdown
        assert "slope_safety" in ranked.scores_breakdown
        assert "elevation_advantage" in ranked.scores_breakdown
        
        # Check explainability narrative
        assert len(ranked.explanation) > 20
        assert len(ranked.key_strengths) > 0
        assert len(ranked.key_risks) > 0
        assert ranked.risk_level in ("LOW_RISK", "MODERATE_RISK", "HIGH_RISK")
        assert "NASA" in ranked.safety_disclaimer
