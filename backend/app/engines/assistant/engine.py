"""
LUNA NAVIGATOR — AI Mission Assistant Engine (Member 4 Ownership)
Synthesizes verified orbital ephemeris, LOLA terrain ray tracing, MCDA ranking,
and EPS electrical power simulations into explainable engineering briefings.
Adheres strictly to scientific evidence: never fabricates results and never treats
an algorithmic score as NASA-certified landing safety.
"""

import re
from typing import List, Dict, Optional, Tuple, Any
from datetime import datetime, timezone

from app.core.sites_catalog import load_candidate_sites, get_site_by_id
from app.engines.recommendation.engine import recommendation_engine, SAFETY_DISCLAIMER_TEXT
from app.engines.simulation.engine import simulation_engine
from app.schemas.recommend import RecommendRequest, WeightsConfig, ConstraintsConfig
from app.schemas.simulation import SimulationRequest
from app.schemas.compare import CompareRequest
from app.schemas.assistant import (
    AssistantQueryRequest,
    AssistantQueryResponse,
    ScientificEvidence,
    RiskAssessment
)

# Known site aliases for natural query detection
SITE_ALIASES: Dict[str, str] = {
    "shackleton": "shackleton-rim",
    "connecting": "connecting-ridge",
    "connecting ridge": "connecting-ridge",
    "malapert": "malapert-mountain",
    "malapert mountain": "malapert-mountain",
    "malapert massif": "malapert-mountain",
    "de gerlache": "de-gerlache-rim-1",
    "de-gerlache": "de-gerlache-rim-1",
    "haworth": "haworth-crater-rim",
    "nobile": "nobile-rim-1",
    "viper": "nobile-rim-1",
    "amundsen": "amundsen-rim",
    "leibnitz": "leibnitz-plateau",
    "leibnitz plateau": "leibnitz-plateau"
}


class AIMissionAssistantEngine:
    """
    Intelligent Scientific Decision-Support Assistant for Lunar South Pole Mission Planners.
    """

    def process_query(self, request: AssistantQueryRequest) -> AssistantQueryResponse:
        q_lower = request.query.lower()
        
        # 1. Detect target site ID from request or query text
        target_site_id = request.site_id
        if not target_site_id:
            for alias, s_id in SITE_ALIASES.items():
                if alias in q_lower:
                    target_site_id = s_id
                    break

        # 2. Identify primary query intent
        intent = self._classify_intent(q_lower, target_site_id)

        # 3. Route to dedicated scientific synthesis handler
        if intent == "RECOMMEND_OPTIMAL_SITE":
            return self._handle_recommendation(request, q_lower)
        elif intent == "POWER_SIMULATION":
            return self._handle_power_simulation(request, target_site_id or "shackleton-rim")
        elif intent == "SITE_COMPARISON":
            return self._handle_comparison(request, q_lower)
        elif intent in ("SITE_DOSSIER", "SAFETY_HAZARD_INQUIRY"):
            return self._handle_site_dossier(request, target_site_id or "shackleton-rim", intent)
        elif intent == "COMMUNICATION_ANALYSIS":
            return self._handle_communication(request, target_site_id or "malapert-mountain")
        else:
            return self._handle_general_science(request, target_site_id)

    def _classify_intent(self, q: str, target_site_id: Optional[str]) -> str:
        if any(w in q for w in ["best", "rank", "optimal", "recommend", "highest score", "top site", "which site"]):
            return "RECOMMEND_OPTIMAL_SITE"
        if any(w in q for w in ["power", "battery", "energy", "watt", "solar array", "soc", "charge", "deplet", "survive"]):
            return "POWER_SIMULATION"
        if any(w in q for w in ["compare", "versus", " vs ", "difference between"]):
            return "SITE_COMPARISON"
        if any(w in q for w in ["safe", "safety", "hazard", "slope", "steep", "risk", "certif", "boulder"]):
            return "SAFETY_HAZARD_INQUIRY"
        if any(w in q for w in ["earth", "comm", "dte", "radio", "libration", "blackout", "direct-to-earth", "los"]):
            return "COMMUNICATION_ANALYSIS"
        if target_site_id is not None:
            return "SITE_DOSSIER"
        return "GENERAL_SCIENCE"

    def _handle_recommendation(self, req: AssistantQueryRequest, q: str) -> AssistantQueryResponse:
        # Determine weighting priorities from query text
        weights = req.weights or WeightsConfig()
        if "comm" in q or "earth" in q:
            weights = WeightsConfig(solar_illumination=0.20, earth_communication=0.50, slope_safety=0.15, elevation_advantage=0.15)
        elif "solar" in q or "illumination" in q or "sun" in q:
            weights = WeightsConfig(solar_illumination=0.55, earth_communication=0.20, slope_safety=0.15, elevation_advantage=0.10)
        elif "slope" in q or "safety" in q or "flat" in q:
            weights = WeightsConfig(solar_illumination=0.25, earth_communication=0.20, slope_safety=0.45, elevation_advantage=0.10)

        rec_req = RecommendRequest(
            start_date=req.start_date,
            duration_days=req.duration_days,
            step_hours=req.step_hours,
            weights=weights
        )
        rec_res = recommendation_engine.recommend_sites(rec_req)

        top_site = rec_res.ranking[0] if rec_res.ranking else None
        top_name = top_site.name if top_site else "Unknown"
        top_score = top_site.total_score if top_site else 0.0

        summary = (
            f"Based on Multi-Criteria Decision Analysis (MCDA) for a {req.duration_days:.0f}-day mission window starting "
            f"{req.start_date.strftime('%Y-%m-%d')}, **{top_name}** ranks #1 with a suitability score of {top_score:.1f}/100."
        )

        detailed = (
            f"### Mission Recommendation Summary\n\n"
            f"1. **Rank 1: {top_site.name}** ({top_site.total_score:.1f}/100)\n"
            f"   - **Solar Illumination**: {top_site.raw_metrics.get('illumination_percentage', 0):.1f}% (longest shadow: {top_site.raw_metrics.get('longest_shadow_hours', 0):.1f}h)\n"
            f"   - **Earth DTE Coverage**: {top_site.raw_metrics.get('communication_percentage', 0):.1f}% (max blackout: {top_site.raw_metrics.get('longest_blackout_hours', 0):.1f}h)\n"
            f"   - **Topographic Slope**: {top_site.raw_metrics.get('slope_degrees', 0):.1f}° at elevation {top_site.raw_metrics.get('elevation_m', 0):.0f} m\n"
            f"   - **Rationale**: {top_site.explanation}\n\n"
        )
        if len(rec_res.ranking) > 1:
            second = rec_res.ranking[1]
            detailed += (
                f"2. **Rank 2: {second.name}** ({second.total_score:.1f}/100)\n"
                f"   - Key trade-off: Illumination {second.raw_metrics.get('illumination_percentage', 0):.1f}%, Comm {second.raw_metrics.get('communication_percentage', 0):.1f}%, Slope {second.raw_metrics.get('slope_degrees', 0):.1f}°.\n\n"
            )

        evidence = ScientificEvidence(
            data_sources=["NASA JPL Horizons DE440", "NASA LOLA 100m Polar DEM", "Selenographic IAU ME Frame"],
            site_id=top_site.site_id if top_site else None,
            site_name=top_site.name if top_site else None,
            illumination_percentage=top_site.raw_metrics.get("illumination_percentage") if top_site else None,
            communication_percentage=top_site.raw_metrics.get("communication_percentage") if top_site else None,
            slope_degrees=top_site.raw_metrics.get("slope_degrees") if top_site else None,
            elevation_m=top_site.raw_metrics.get("elevation_m") if top_site else None,
            max_continuous_shadow_hours=top_site.raw_metrics.get("longest_shadow_hours") if top_site else None,
            suitability_score=top_score
        )

        risks = RiskAssessment(
            risk_level=top_site.risk_level if top_site else "LOW_RISK",
            primary_risks=top_site.key_risks if top_site else ["Shadow intervals requiring battery buffer"],
            recommended_mitigations=[
                "Size rover battery to endure worst-case continuous shadow interval.",
                "Conduct sub-meter slope and boulder field hazard mapping via LROC NAC prior to landing lock.",
                "Establish communication protocol for periods of unfavorable lunar libration."
            ]
        )

        return AssistantQueryResponse(
            query=req.query,
            intent="RECOMMEND_OPTIMAL_SITE",
            focused_site_id=top_site.site_id if top_site else None,
            summary=summary,
            detailed_analysis=detailed,
            scientific_evidence=evidence,
            risk_assessment=risks,
            safety_disclaimer=SAFETY_DISCLAIMER_TEXT,
            suggested_followups=[
                f"Simulate power and battery survival for {top_name}",
                "Compare top 3 sites side-by-side",
                f"What are the landing slope hazards at {top_name}?"
            ]
        )

    def _handle_site_dossier(self, req: AssistantQueryRequest, site_id: str, intent: str) -> AssistantQueryResponse:
        site = get_site_by_id(site_id)
        if not site:
            site = get_site_by_id("shackleton-rim")
            site_id = "shackleton-rim"

        metrics = recommendation_engine.evaluate_site_metrics(
            site_id=site_id,
            start_date=req.start_date,
            duration_days=req.duration_days,
            step_hours=req.step_hours
        )

        summary = (
            f"**{site.name}** is located at Selenographic ({site.latitude:.2f}°, {site.longitude:.2f}°) at an elevation "
            f"of {site.elevation_m:.0f} m with a regional slope gradient of {site.slope_degrees:.1f}°. Over the "
            f"{req.duration_days:.0f}-day window, solar availability is {metrics.illumination_percentage:.1f}% "
            f"and Earth DTE line-of-sight is {metrics.communication_percentage:.1f}%."
        )

        hazard_note = (
            f"\n\n### Safety & Terrain Hazard Assessment\n"
            f"- **Touchdown Slope**: {site.slope_degrees:.1f}° (nominal limit for Artemis human-landing systems is 10°–12°).\n"
            f"- **Maximum Shadow Duration**: {metrics.max_shadow_hours:.1f} hours.\n"
            f"- **Maximum Communication Outage**: {metrics.max_comm_blackout_hours:.1f} hours.\n"
            f"- **Scientific Interest**: {site.scientific_interest}\n"
        )

        detailed = (
            f"### Candidate Site Characterization: {site.name}\n\n"
            f"{site.description}\n\n"
            f"#### Key Advantages\n"
            f"- " + "\n- ".join(site.primary_advantages) + "\n\n"
            f"#### Key Operational Challenges\n"
            f"- " + "\n- ".join(site.primary_challenges) +
            hazard_note
        )

        risk_level = "HIGH_RISK" if site.slope_degrees > 8.0 or metrics.max_shadow_hours > 40.0 else \
                     ("MODERATE_RISK" if site.slope_degrees > 6.0 or metrics.max_shadow_hours > 24.0 else "LOW_RISK")

        evidence = ScientificEvidence(
            data_sources=["NASA JPL Horizons DE440", "NASA LOLA LDEM_80S_100M", "NASA Diviner PSR Archive"],
            site_id=site.id,
            site_name=site.name,
            coordinates={"latitude": site.latitude, "longitude": site.longitude},
            illumination_percentage=metrics.illumination_percentage,
            communication_percentage=metrics.communication_percentage,
            slope_degrees=site.slope_degrees,
            elevation_m=site.elevation_m,
            max_continuous_shadow_hours=metrics.max_shadow_hours,
            max_continuous_blackout_hours=metrics.max_comm_blackout_hours,
            suitability_score=metrics.overall_suitability_score
        )

        risks = RiskAssessment(
            risk_level=risk_level,
            primary_risks=site.primary_challenges,
            recommended_mitigations=[
                f"Model solar array power generation for {site.name} to confirm thermal survival.",
                "Employ terrain relative navigation (TRN) to avoid crater rim drop-offs.",
                "Maintain secondary relay communication buffer for libration blackouts."
            ]
        )

        return AssistantQueryResponse(
            query=req.query,
            intent=intent,
            focused_site_id=site.id,
            summary=summary,
            detailed_analysis=detailed,
            scientific_evidence=evidence,
            risk_assessment=risks,
            safety_disclaimer=SAFETY_DISCLAIMER_TEXT,
            suggested_followups=[
                f"Simulate power generation for {site.name}",
                f"Compare {site.name} with Malapert Mountain",
                "What is the longest shadow duration at this site?"
            ]
        )

    def _handle_power_simulation(self, req: AssistantQueryRequest, site_id: str) -> AssistantQueryResponse:
        site = get_site_by_id(site_id) or get_site_by_id("shackleton-rim")
        sim_req = SimulationRequest(
            site_id=site.id,
            start_date=req.start_date,
            duration_days=req.duration_days,
            step_hours=req.step_hours,
            solar_array_area_m2=req.solar_array_area_m2 or 4.5,
            battery_capacity_wh=req.battery_capacity_wh or 5000.0
        )
        sim_res = simulation_engine.simulate_mission_power(sim_req)

        status_str = "SUCCESS (Nominal Margin)" if not sim_res.battery_depleted else "CRITICAL DEFICIT (Battery Depletion)"
        summary = (
            f"Power simulation for **{site.name}** over {req.duration_days:.0f} days: Minimum battery State-of-Charge "
            f"reached **{sim_res.min_battery_soc_percent:.1f}%** with {sim_res.total_energy_generated_kwh:.1f} kWh generated "
            f"and {sim_res.total_energy_consumed_kwh:.1f} kWh consumed. Overall EPS Health Status: **{sim_res.eps_health_status}**."
        )

        detailed = (
            f"### Mission Electrical Power System (EPS) Simulation\n\n"
            f"- **Site**: {site.name}\n"
            f"- **Solar Array Area**: {sim_req.solar_array_area_m2} m² (Triple-junction GaAs, 30% efficiency)\n"
            f"- **Tracking Architecture**: Vertical Azimuth-Tracking (optimal for polar low-elevation Sun)\n"
            f"- **Battery Storage**: {sim_req.battery_capacity_wh:.0f} Wh capacity\n\n"
            f"#### Performance Breakdown\n"
            f"- **Peak Generation**: {sim_res.peak_solar_generation_w:.1f} W\n"
            f"- **Average Generation**: {sim_res.average_solar_generation_w:.1f} W\n"
            f"- **Net Energy Balance**: {sim_res.net_energy_balance_kwh:+.2f} kWh\n"
            f"- **Lowest Battery SoC**: {sim_res.min_battery_soc_percent:.1f}% (Minimum Safe Threshold: {sim_req.min_safe_soc_percent:.0f}%)\n"
            f"- **Longest Consecutive Discharge**: {sim_res.max_continuous_discharge_hours:.1f} hours\n"
            f"- **Battery Depleted**: {'YES — MISSION THREAT' if sim_res.battery_depleted else 'NO — POWER SURVIVAL VERIFIED'}\n"
        )

        risk_level = "HIGH_RISK" if sim_res.battery_depleted else ("MODERATE_RISK" if sim_res.battery_survival_margin_percent < 15.0 else "LOW_RISK")

        evidence = ScientificEvidence(
            data_sources=["NASA LOLA Ray-Tracing Horizon", "Solar Constant 1361 W/m²", "JPL Horizons Ephemeris"],
            site_id=site.id,
            site_name=site.name,
            elevation_m=site.elevation_m,
            max_continuous_shadow_hours=sim_res.max_continuous_discharge_hours
        )

        risks = RiskAssessment(
            risk_level=risk_level,
            primary_risks=[
                f"Peak shadow interval demands {sim_res.max_continuous_discharge_hours:.1f}h of continuous battery supply.",
                "Thermal heater survival draw in deep shadow reduces available margin."
            ],
            recommended_mitigations=[
                f"Increase battery capacity above {sim_req.battery_capacity_wh:.0f} Wh if mission margin < 20%.",
                "Utilize mast-mounted azimuth-tracking solar arrays to harvest low-elevation polar sunlight.",
                "Reduce scientific instrument payload duty cycle during terrain-induced shadow passages."
            ]
        )

        return AssistantQueryResponse(
            query=req.query,
            intent="POWER_SIMULATION",
            focused_site_id=site.id,
            summary=summary,
            detailed_analysis=detailed,
            scientific_evidence=evidence,
            risk_assessment=risks,
            safety_disclaimer=SAFETY_DISCLAIMER_TEXT,
            suggested_followups=[
                "What happens if we reduce solar array area to 2.5 m²?",
                f"How does {site.name} power survival compare to Connecting Ridge?",
                "What is the minimum safe battery capacity for this mission?"
            ]
        )

    def _handle_comparison(self, req: AssistantQueryRequest, q: str) -> AssistantQueryResponse:
        # Detect sites to compare
        detected_sites = []
        for alias, s_id in SITE_ALIASES.items():
            if alias in q and s_id not in detected_sites:
                detected_sites.append(s_id)
        if len(detected_sites) < 2:
            detected_sites = ["shackleton-rim", "connecting-ridge", "malapert-mountain"]

        cmp_req = CompareRequest(
            site_ids=detected_sites[:4],
            start_date=req.start_date,
            duration_days=req.duration_days,
            step_hours=req.step_hours
        )
        cmp_res = recommendation_engine.compare_sites(cmp_req)

        summary = f"Side-by-side evaluation of {len(cmp_res.sites_evaluated)} candidate landing zones over a {req.duration_days:.0f}-day epoch:"

        detailed = "### Multi-Site Engineering Comparison Matrix\n\n"
        detailed += "| Candidate Site | Illumination (%) | Longest Shadow (h) | Earth Comm (%) | Slope (°) | Elevation (m) | Suitability |\n"
        detailed += "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |\n"
        for s in cmp_res.sites_evaluated:
            detailed += f"| **{s.name}** | {s.illumination_percentage:.1f}% | {s.max_shadow_hours:.1f}h | {s.communication_percentage:.1f}% | {s.slope_degrees:.1f}° | {s.elevation_m:.0f} m | **{s.overall_suitability_score:.1f}** |\n"
        detailed += "\n#### Comparative Key Takeaway\n"
        top = cmp_res.sites_evaluated[0]
        detailed += f"- Highest scoring site: **{top.name}** ({top.overall_suitability_score:.1f}/100) due to its balanced combination of visibility and topographic safety.\n"

        evidence = ScientificEvidence(
            data_sources=["NASA JPL Horizons Ephemerides", "NASA LOLA 100m DEM Grid"],
            site_id=top.site_id,
            site_name=top.name,
            suitability_score=top.overall_suitability_score
        )

        risks = RiskAssessment(
            risk_level="MODERATE_RISK",
            primary_risks=["Site-specific trade-offs between illumination and Earth communication."],
            recommended_mitigations=["Align site selection with primary mission objective (power vs continuous telemetry)."]
        )

        return AssistantQueryResponse(
            query=req.query,
            intent="SITE_COMPARISON",
            focused_site_id=top.site_id,
            summary=summary,
            detailed_analysis=detailed,
            scientific_evidence=evidence,
            risk_assessment=risks,
            safety_disclaimer=SAFETY_DISCLAIMER_TEXT,
            suggested_followups=[
                f"Simulate power at {top.name}",
                "Rank all 8 candidate sites with equal weights",
                "What are the communication outages during southern libration?"
            ]
        )

    def _handle_communication(self, req: AssistantQueryRequest, site_id: str) -> AssistantQueryResponse:
        site = get_site_by_id(site_id) or get_site_by_id("malapert-mountain")
        metrics = recommendation_engine.evaluate_site_metrics(
            site_id=site.id,
            start_date=req.start_date,
            duration_days=req.duration_days,
            step_hours=req.step_hours
        )

        summary = (
            f"**{site.name}** provides **{metrics.communication_percentage:.1f}%** Direct-to-Earth (DTE) radio contact "
            f"over the {req.duration_days:.0f}-day epoch, with a maximum continuous blackout duration of **{metrics.max_comm_blackout_hours:.1f}** hours."
        )

        detailed = (
            f"### Earth Telecommunications & Libration Analysis\n\n"
            f"- **Target Site**: {site.name} ({site.latitude:.2f}°, {site.longitude:.2f}°)\n"
            f"- **Elevation Vantage**: {site.elevation_m:.0f} m relative to lunar datum (R=1737.4 km)\n"
            f"- **DTE Availability**: {metrics.communication_percentage:.1f}%\n"
            f"- **Worst-case Comm Outage**: {metrics.max_comm_blackout_hours:.1f} hours\n\n"
            f"#### Physical Mechanism of Comm Outages\n"
            f"At the Lunar South Pole, the Earth oscillates in the sky due to lunar orbital eccentricity (e=0.0549) "
            f"and orbit inclination. Libration in latitude causes the Earth elevation to swing by ±6.7°. When Earth dips "
            f"below the local topographic horizon (ray-traced from LOLA DEM data), line-of-sight telemetry is interrupted.\n"
        )

        evidence = ScientificEvidence(
            data_sources=["NASA JPL Horizons DE440", "NASA LOLA 100m Ray-Traced Horizon"],
            site_id=site.id,
            site_name=site.name,
            communication_percentage=metrics.communication_percentage,
            max_continuous_blackout_hours=metrics.max_comm_blackout_hours,
            elevation_m=site.elevation_m
        )

        risks = RiskAssessment(
            risk_level="LOW_RISK" if metrics.communication_percentage >= 80.0 else "MODERATE_RISK",
            primary_risks=[f"Libration-induced communication blackout up to {metrics.max_comm_blackout_hours:.1f}h."],
            recommended_mitigations=[
                "Schedule high-bandwidth science telemetry downlinks during favorable Earth libration peaks.",
                "Equip surface lander with local data storage buffer for blackout periods.",
                "Utilize high-elevation relay nodes (such as Malapert Mountain) for proximal landers."
            ]
        )

        return AssistantQueryResponse(
            query=req.query,
            intent="COMMUNICATION_ANALYSIS",
            focused_site_id=site.id,
            summary=summary,
            detailed_analysis=detailed,
            scientific_evidence=evidence,
            risk_assessment=risks,
            safety_disclaimer=SAFETY_DISCLAIMER_TEXT,
            suggested_followups=[
                f"Compare Earth communication between Malapert and Shackleton",
                "What is the maximum lunar libration in latitude?",
                "Simulate solar power for this mission window"
            ]
        )

    def _handle_general_science(self, req: AssistantQueryRequest, target_site_id: Optional[str]) -> AssistantQueryResponse:
        summary = (
            "Luna Navigator is an interactive decision-support platform designed to evaluate candidate lunar south-pole "
            "landing zones using empirical NASA JPL Horizons ephemerides and LOLA digital elevation models."
        )

        detailed = (
            "### Scientific Decision Support Capabilities\n\n"
            "- **Topocentric Solar Ephemerides**: Calculates solar azimuth and low-elevation angles (0°–1.8°) using DE440 high-precision ephemeris.\n"
            r"- **Terrain Horizon Ray Tracing**: Traces 360-degree local horizons from NASA LOLA gridded DEMs with spherical lunar curvature correction ($\Delta h = s^2 / 2R_{moon}$)." "\n"
            r"- **Libration Dynamics**: Tracks Earth line-of-sight (DTE) availability through $\pm 6.7°$ latitude and $\pm 7.9°$ longitude librations." "\n"
            "- **Multi-Criteria Decision Analysis (MCDA)**: Transparent, explainable ranking weighting illumination, comm, slope safety, and elevation.\n"
            "- **Electrical Power Simulation (EPS)**: Models solar generation, thermal survival heater loads, and battery State-of-Charge (SoC).\n\n"
            "Ask me to analyze any candidate site (Shackleton Rim, Connecting Ridge, Malapert Mountain, etc.), run an energy simulation, or recommend the best site for your mission parameters."
        )

        evidence = ScientificEvidence(
            data_sources=["NASA JPL Horizons DE440", "NASA LOLA GDR (PDS)", "IAU Mean Earth / Polar Axis (ME) Frame"]
        )

        risks = RiskAssessment(
            risk_level="LOW_RISK",
            primary_risks=["Polar operational hazards (cryogenic PSR temperatures, low sun angles, steep crater walls)"],
            recommended_mitigations=["Perform multi-variable trade studies using Luna Navigator prior to final landing site selection."]
        )

        return AssistantQueryResponse(
            query=req.query,
            intent="GENERAL_SCIENCE",
            focused_site_id=target_site_id,
            summary=summary,
            detailed_analysis=detailed,
            scientific_evidence=evidence,
            risk_assessment=risks,
            safety_disclaimer=SAFETY_DISCLAIMER_TEXT,
            suggested_followups=[
                "Which landing site is optimal for a 14-day mission in Dec 2026?",
                "Tell me about Shackleton Crater Rim",
                "Simulate power survival at Connecting Ridge"
            ]
        )


# Global singleton instance
assistant_engine = AIMissionAssistantEngine()
