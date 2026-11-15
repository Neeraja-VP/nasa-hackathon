"""
LUNA NAVIGATOR — AI Mission Assistant Unit Tests (Member 4 Ownership)
Tests intent recognition, grounded scientific evidence synthesis, explainability,
and mandatory safety disclaimers (no fabricated safety certification).
"""

from datetime import datetime, timezone
import pytest
from app.schemas.assistant import AssistantQueryRequest
from app.engines.assistant.engine import assistant_engine


def test_assistant_recommendation_intent():
    """Verify assistant correctly identifies recommendation queries and returns ranked evidence."""
    req = AssistantQueryRequest(
        query="Which landing site is optimal for an Artemis III 14-day surface stay in December 2026?",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=14.0,
        step_hours=3.0
    )
    res = assistant_engine.process_query(req)
    assert res.intent == "RECOMMEND_OPTIMAL_SITE"
    assert res.focused_site_id is not None
    assert len(res.summary) > 20
    assert "NASA" in res.safety_disclaimer
    assert "NOT constitute NASA certification" in res.safety_disclaimer
    assert res.scientific_evidence.suitability_score is not None
    assert len(res.suggested_followups) >= 2


def test_assistant_power_simulation_intent():
    """Verify assistant processes power generation and battery survival inquiries."""
    req = AssistantQueryRequest(
        query="Can a 4.5 m2 solar array with 5000 Wh battery survive shadow at Shackleton?",
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=2.0
    )
    res = assistant_engine.process_query(req)
    assert res.intent == "POWER_SIMULATION"
    assert res.focused_site_id == "shackleton-rim"
    assert "SoC" in res.detailed_analysis or "State-of-Charge" in res.detailed_analysis
    assert "NASA" in res.safety_disclaimer


def test_assistant_communication_intent():
    """Verify assistant evaluates Direct-to-Earth communication and libration."""
    req = AssistantQueryRequest(
        query="What is the Earth communication line of sight and libration blackout at Malapert?",
        site_id="malapert-mountain",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=10.0,
        step_hours=3.0
    )
    res = assistant_engine.process_query(req)
    assert res.intent == "COMMUNICATION_ANALYSIS"
    assert res.focused_site_id == "malapert-mountain"
    assert res.scientific_evidence.communication_percentage is not None
    assert res.scientific_evidence.communication_percentage > 50.0


def test_assistant_site_comparison_intent():
    """Verify assistant creates comparison matrix when asked to compare sites."""
    req = AssistantQueryRequest(
        query="Compare Shackleton Rim versus Connecting Ridge versus Malapert Mountain",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=3.0
    )
    res = assistant_engine.process_query(req)
    assert res.intent == "SITE_COMPARISON"
    assert "Comparison Matrix" in res.detailed_analysis
    assert len(res.scientific_evidence.data_sources) >= 2


def test_assistant_safety_hazard_inquiry():
    """Verify assistant addresses landing slope hazards with explicit non-certification notice."""
    req = AssistantQueryRequest(
        query="What are the landing hazards and slope risks at Shackleton Crater Rim?",
        site_id="shackleton-rim",
        start_date=datetime(2026, 12, 1, 0, 0, 0, tzinfo=timezone.utc),
        duration_days=7.0,
        step_hours=3.0
    )
    res = assistant_engine.process_query(req)
    assert res.intent == "SAFETY_HAZARD_INQUIRY"
    assert res.scientific_evidence.slope_degrees is not None
    assert abs(res.scientific_evidence.slope_degrees - 8.5) < 0.1
    # Verify non-fabrication of safety certification
    assert "NOT constitute NASA certification" in res.safety_disclaimer
