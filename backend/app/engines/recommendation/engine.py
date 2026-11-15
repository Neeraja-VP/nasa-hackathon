"""
LUNA NAVIGATOR — Recommendation Engine (Member 4 Ownership)
Implements explainable Multi-Criteria Decision Analysis (MCDA) for lunar landing site selection and ranking.
Adheres strictly to scientific evidence: does not fabricate data or treat a weighted score as NASA-certified safety.
"""

from datetime import datetime, timezone
from typing import List, Dict, Optional, Tuple, Any
from app.core.sites_catalog import load_candidate_sites, get_site_by_id
from app.engines.illumination.engine import illumination_engine
from app.engines.communication.engine import communication_engine
from app.engines.simulation.engine import simulation_engine
from app.services.geospatial.dem_loader import dem_loader
from app.schemas.illumination import IlluminationRequest
from app.schemas.communication import CommunicationRequest
from app.schemas.simulation import SimulationRequest
from app.schemas.compare import (
    CompareRequest,
    SiteComparisonMetrics,
    CompareResponse,
    ScenarioConfig,
    CompactTimelinePoint,
    ScenarioMetrics,
    ScenarioComparisonSummary,
    MultiScenarioCompareRequest,
    MultiScenarioCompareResponse
)
from app.schemas.recommend import (
    RecommendRequest,
    RankedSite,
    DisqualifiedSite,
    RecommendResponse
)

SAFETY_DISCLAIMER_TEXT = (
    "SCIENTIFIC NOTICE: This ranking is an algorithmic Multi-Criteria Decision Analysis (MCDA) heuristic "
    "based on orbital ephemerides (JPL DE440) and gridded LOLA topographic models. A high score reflects "
    "mathematical alignment with user criteria weights and DOES NOT constitute NASA certification of landing "
    "safety. Operational flight safety requires sub-meter obstacle detection, hazard avoidance, regolith "
    "geotechnical bearing capacity assessment, landing gear touchdown dynamics, and terminal descent propellant margins."
)


class RecommendationEngine:
    """
    Ranks candidate landing sites using multi-criteria weighted scoring and operational constraints.
    Provides transparent, evidence-based explainability and explicit risk demarcations.
    """
    
    def __init__(self):
        self._metrics_cache: Dict[Tuple[str, str, float, float], SiteComparisonMetrics] = {}

    def _get_cache_key(self, site_id: str, start_date, duration_days: float, step_hours: float) -> Tuple[str, str, float, float]:
        start_str = start_date.isoformat() if hasattr(start_date, "isoformat") else str(start_date)
        return (site_id, start_str, float(duration_days), float(step_hours))

    def evaluate_site_metrics(
        self,
        site_id: str,
        start_date,
        duration_days: float,
        step_hours: float = 2.0
    ) -> Optional[SiteComparisonMetrics]:
        site = get_site_by_id(site_id)
        if not site:
            return None

        cache_key = self._get_cache_key(site_id, start_date, duration_days, step_hours)
        if cache_key in self._metrics_cache:
            return self._metrics_cache[cache_key]
            
        # 1. Illumination metrics
        illum_req = IlluminationRequest(
            latitude=site.latitude,
            longitude=site.longitude,
            elevation_m=site.elevation_m,
            start_date=start_date,
            duration_days=duration_days,
            step_hours=step_hours
        )
        illum_res = illumination_engine.calculate_illumination(illum_req)
        
        # 2. Communication metrics
        comm_req = CommunicationRequest(
            latitude=site.latitude,
            longitude=site.longitude,
            elevation_m=site.elevation_m,
            start_date=start_date,
            duration_days=duration_days,
            step_hours=step_hours
        )
        comm_res = communication_engine.calculate_communication(comm_req)
        
        # Baseline composite score (equal weights)
        slope_score = max(0.0, 100.0 - (site.slope_degrees / 15.0) * 100.0)
        elev_score = min(100.0, max(0.0, (site.elevation_m + 1000.0) / 60.0))
        composite = (
            0.35 * illum_res.illumination_percentage +
            0.30 * comm_res.communication_availability_percentage +
            0.20 * slope_score +
            0.15 * elev_score
        )
        
        metrics = SiteComparisonMetrics(
            site_id=site.id,
            name=site.name,
            latitude=site.latitude,
            longitude=site.longitude,
            elevation_m=site.elevation_m,
            slope_degrees=site.slope_degrees,
            illumination_percentage=illum_res.illumination_percentage,
            max_shadow_hours=illum_res.longest_continuous_shadow_hours,
            communication_percentage=comm_res.communication_availability_percentage,
            max_comm_blackout_hours=comm_res.longest_continuous_blackout_hours,
            overall_suitability_score=round(composite, 1)
        )
        self._metrics_cache[cache_key] = metrics
        return metrics

    def compare_sites(self, request: CompareRequest) -> CompareResponse:
        results: List[SiteComparisonMetrics] = []
        for s_id in request.site_ids:
            metrics = self.evaluate_site_metrics(
                site_id=s_id,
                start_date=request.start_date,
                duration_days=request.duration_days,
                step_hours=request.step_hours
            )
            if metrics:
                results.append(metrics)
                
        # Sort descending by suitability score
        results.sort(key=lambda x: x.overall_suitability_score, reverse=True)
        return CompareResponse(
            start_date=request.start_date,
            duration_days=request.duration_days,
            sites_evaluated=results
        )

    def compare_scenarios(self, request: MultiScenarioCompareRequest) -> MultiScenarioCompareResponse:
        """
        Evaluate multiple independent mission scenarios across varying landing sites,
        coordinates, dates, durations, and EPS configurations.
        Calculates all TASK 4 required metrics using verified scientific engines.
        """
        evaluated_scenarios: List[ScenarioMetrics] = []

        for sc in request.scenarios:
            lat = sc.latitude
            lon = sc.longitude % 360.0
            if lon < 0:
                lon += 360.0
            
            # Extract elevation and slope
            site = get_site_by_id(sc.site_id) if sc.site_id else None
            if sc.elevation_m is not None:
                elev = sc.elevation_m
            elif site:
                elev = site.elevation_m
            else:
                elev = dem_loader.sample_elevation(lat, lon)
                
            slope_deg = site.slope_degrees if site else dem_loader.calculate_surface_slope_deg(lat, lon)

            # 1. Illumination Engine calculation
            illum_req = IlluminationRequest(
                latitude=lat,
                longitude=lon,
                elevation_m=elev,
                start_date=sc.start_date,
                duration_days=sc.duration_days,
                step_hours=sc.step_hours,
                use_live_horizons=sc.use_live_horizons
            )
            illum_res = illumination_engine.calculate_illumination(illum_req)

            # 2. Communication Engine calculation
            comm_req = CommunicationRequest(
                latitude=lat,
                longitude=lon,
                elevation_m=elev,
                start_date=sc.start_date,
                duration_days=sc.duration_days,
                step_hours=sc.step_hours,
                use_live_horizons=sc.use_live_horizons
            )
            comm_res = communication_engine.calculate_communication(comm_req)

            # 3. Mission Energy Simulation
            sim_req = SimulationRequest(
                site_id=sc.site_id,
                latitude=lat,
                longitude=lon,
                elevation_m=elev,
                start_date=sc.start_date,
                duration_days=sc.duration_days,
                step_hours=sc.step_hours,
                solar_array_area_m2=sc.solar_array_area_m2,
                solar_efficiency=sc.solar_efficiency,
                solar_tracking_type=sc.solar_tracking_type,
                battery_capacity_wh=sc.battery_capacity_wh,
                initial_battery_soc_percent=sc.initial_battery_soc_percent,
                min_safe_soc_percent=sc.min_safe_soc_percent,
                base_hotel_load_w=sc.base_hotel_load_w,
                payload_active_load_w=sc.payload_active_load_w,
                survival_heater_load_w=sc.survival_heater_load_w,
                use_live_horizons=sc.use_live_horizons
            )
            sim_res = simulation_engine.simulate_mission_power(sim_req)

            # Extract metrics (TASK 4)
            sunlit_pts = [pt.sun_elevation_deg for pt in illum_res.time_series if pt.is_sunlit_terrain]
            mean_sun_el = sum(sunlit_pts) / len(sunlit_pts) if sunlit_pts else 0.0
            max_sun_el = max([pt.sun_elevation_deg for pt in illum_res.time_series], default=0.0)

            total_mission_hours = sc.duration_days * 24.0
            total_darkness_hours = max(0.0, total_mission_hours - illum_res.total_sunlit_hours)

            # Count comm windows (transitions from False to True)
            comm_windows = 0
            in_window = False
            for pt in comm_res.time_series:
                if pt.is_earth_visible:
                    if not in_window:
                        comm_windows += 1
                        in_window = True
                else:
                    in_window = False

            # Power survival status
            if sim_res.battery_depleted:
                status_label = "BATTERY_DEPLETED"
            elif sim_res.min_battery_soc_percent < sc.min_safe_soc_percent + 10.0:
                status_label = "SURVIVED_WITH_MARGIN"
            elif sim_res.min_battery_soc_percent < 40.0:
                status_label = "DEGRADED_MARGIN"
            else:
                status_label = "NOMINAL"

            # Composite suitability score (0-100)
            solar_term = illum_res.illumination_percentage
            comm_term = comm_res.communication_availability_percentage
            battery_term = max(0.0, sim_res.min_battery_soc_percent * 0.4) if sim_res.battery_depleted else min(100.0, sim_res.min_battery_soc_percent * 1.05)
            slope_term = max(0.0, 100.0 - (slope_deg / 15.0) * 100.0)
            elev_term = min(100.0, max(0.0, (elev + 1000.0) / 60.0))

            suitability_score = round(
                0.30 * solar_term +
                0.25 * comm_term +
                0.25 * battery_term +
                0.10 * slope_term +
                0.10 * elev_term,
                1
            )

            # Extract strengths and risks
            strengths = []
            if illum_res.illumination_percentage >= 70.0:
                strengths.append(f"Extended solar visibility ({illum_res.illumination_percentage}% sunlight, {illum_res.total_sunlit_hours:.0f}h)")
            if comm_res.communication_availability_percentage >= 65.0:
                strengths.append(f"Strong Earth DTE coverage ({comm_res.communication_availability_percentage}% link, {comm_windows} windows)")
            if sim_res.min_battery_soc_percent >= sc.min_safe_soc_percent + 15.0:
                strengths.append(f"Robust EPS safety margin (min SoC {sim_res.min_battery_soc_percent}%)")
            if slope_deg <= 6.0:
                strengths.append(f"Gentle touchdown surface gradient ({slope_deg:.1f}°)")
            if not strengths:
                strengths.append("Acceptable preliminary baseline across operational parameters")

            risks = []
            if sim_res.battery_depleted:
                risks.append("CRITICAL: Battery capacity depleted below safety cutoff in shadow blackout")
            elif sim_res.min_battery_soc_percent < sc.min_safe_soc_percent + 10.0:
                risks.append(f"Narrow battery survival margin (reaches {sim_res.min_battery_soc_percent}%, near {sc.min_safe_soc_percent}% cutoff)")
            if illum_res.longest_continuous_shadow_hours > 36.0:
                risks.append(f"Protracted continuous darkness ({illum_res.longest_continuous_shadow_hours:.0f}h) requiring high heater energy")
            if comm_res.longest_continuous_blackout_hours > 36.0:
                risks.append(f"Prolonged direct communication blackout ({comm_res.longest_continuous_blackout_hours:.0f}h) due to lunar libration")
            if slope_deg > 8.0:
                risks.append(f"Landing terrain slope ({slope_deg:.1f}°) exceeds optimal lander stability thresholds")
            if not risks:
                risks.append("No critical thermal, communication, or power hazards identified")

            # Sample timeline points for synchronized frontend charting (max ~60 points)
            timeline: List[CompactTimelinePoint] = []
            total_pts = len(illum_res.time_series)
            stride = max(1, total_pts // 60)
            comm_map = {pt.timestamp: pt for pt in comm_res.time_series}
            sim_map = {pt.timestamp: pt for pt in sim_res.time_series}

            for i in range(0, total_pts, stride):
                ipt = illum_res.time_series[i]
                cpt = comm_map.get(ipt.timestamp)
                spt = sim_map.get(ipt.timestamp)
                
                h_from_start = (ipt.timestamp - sc.start_date).total_seconds() / 3600.0
                timeline.append(CompactTimelinePoint(
                    timestamp=ipt.timestamp,
                    hours_from_start=round(h_from_start, 1),
                    is_sunlit=ipt.is_sunlit_terrain,
                    sun_elevation_deg=round(ipt.sun_elevation_deg, 2),
                    is_earth_visible=cpt.is_earth_visible if cpt else False,
                    earth_elevation_deg=round(cpt.earth_elevation_deg, 2) if cpt else 0.0,
                    battery_soc_percent=round(spt.battery_soc_percent, 1) if spt else 100.0,
                    solar_generation_w=round(spt.solar_generation_w, 1) if spt else 0.0,
                    net_power_w=round(spt.net_power_w, 1) if spt else 0.0
                ))

            evaluated_scenarios.append(ScenarioMetrics(
                id=sc.id,
                name=sc.name,
                site_id=sc.site_id,
                latitude=round(lat, 4),
                longitude=round(lon, 4),
                elevation_m=round(elev, 1),
                slope_degrees=round(slope_deg, 1),
                observer_height_m=sc.observer_height_m,
                start_date=sc.start_date,
                duration_days=sc.duration_days,
                step_hours=sc.step_hours,
                solar_array_area_m2=sc.solar_array_area_m2,
                battery_capacity_wh=sc.battery_capacity_wh,
                mean_sun_elevation_deg=round(mean_sun_el, 2),
                max_sun_elevation_deg=round(max_sun_el, 2),
                total_sunlit_hours=round(illum_res.total_sunlit_hours, 1),
                total_darkness_hours=round(total_darkness_hours, 1),
                longest_sunlight_hours=round(illum_res.longest_continuous_sunlight_hours, 1),
                longest_darkness_hours=round(illum_res.longest_continuous_shadow_hours, 1),
                illumination_percentage=round(illum_res.illumination_percentage, 1),
                earth_visibility_hours=round(comm_res.total_visible_hours, 1),
                communication_percentage=round(comm_res.communication_availability_percentage, 1),
                longest_comm_blackout_hours=round(comm_res.longest_continuous_blackout_hours, 1),
                longest_comm_window_hours=round(comm_res.longest_continuous_comm_window_hours, 1),
                comm_windows_count=comm_windows,
                min_battery_soc_percent=round(sim_res.min_battery_soc_percent, 1),
                max_battery_soc_percent=round(sim_res.max_battery_soc_percent, 1),
                total_energy_generated_kwh=round(sim_res.total_energy_generated_kwh, 2),
                total_energy_consumed_kwh=round(sim_res.total_energy_consumed_kwh, 2),
                net_energy_balance_kwh=round(sim_res.net_energy_balance_kwh, 2),
                power_survival_status=status_label,
                battery_depleted=sim_res.battery_depleted,
                overall_suitability_score=suitability_score,
                rank=1,
                strengths=strengths,
                risks=risks,
                timeline=timeline,
                ephemeris_source=illum_res.ephemeris_source,
                terrain_source=illum_res.terrain_source,
                dem_resolution_m=illum_res.dem_resolution_m,
                calculation_status=illum_res.calculation_status
            ))

        # Sort descending by suitability score and assign ranks
        evaluated_scenarios.sort(key=lambda s: s.overall_suitability_score, reverse=True)
        for idx, sc in enumerate(evaluated_scenarios, start=1):
            sc.rank = idx

        # Determine best scenarios by key criteria
        best_overall = evaluated_scenarios[0].id
        best_illum = max(evaluated_scenarios, key=lambda s: s.illumination_percentage).id
        best_comm = max(evaluated_scenarios, key=lambda s: s.communication_percentage).id
        best_power = max(evaluated_scenarios, key=lambda s: s.min_battery_soc_percent).id

        mode_descs = {
            "DIFFERENT_SITES_SAME_DATE": "Cross-Site Spatial Comparison at Unified Mission Epoch",
            "SAME_SITE_DIFFERENT_DATES": "Temporal Window & Libration Cycle Trade-off for Site",
            "DIFFERENT_SITES_AND_DATES": "Global Multi-Variable Mission Scenario Optimization Matrix"
        }

        top_scenario = evaluated_scenarios[0]
        worst_scenario = evaluated_scenarios[-1]
        findings = [
            f"Top ranked scenario '{top_scenario.name}' achieved overall suitability score of {top_scenario.overall_suitability_score}/100.",
            f"Solar illumination ranges between {worst_scenario.illumination_percentage}% and {max(s.illumination_percentage for s in evaluated_scenarios)}% across evaluated scenarios.",
            f"Direct-to-Earth communication coverage varies from {min(s.communication_percentage for s in evaluated_scenarios)}% to {max(s.communication_percentage for s in evaluated_scenarios)}%."
        ]
        if any(s.battery_depleted for s in evaluated_scenarios):
            depleted_names = [s.name for s in evaluated_scenarios if s.battery_depleted]
            findings.append(f"WARNING: Battery depletion detected in scenario(s): {', '.join(depleted_names)} due to continuous shadow exceeding battery DoD reserve.")

        summary = ScenarioComparisonSummary(
            best_overall_scenario_id=best_overall,
            best_illumination_scenario_id=best_illum,
            best_communication_scenario_id=best_comm,
            best_power_scenario_id=best_power,
            mode_description=mode_descs.get(request.mode, "Multi-Scenario Trade-off Analysis"),
            key_findings=findings
        )

        return MultiScenarioCompareResponse(
            mode=request.mode,
            total_scenarios=len(evaluated_scenarios),
            scenarios=evaluated_scenarios,
            summary=summary,
            evaluated_at=datetime.now(timezone.utc)
        )

    def recommend_sites(self, request: RecommendRequest) -> RecommendResponse:
        all_sites = load_candidate_sites()
        target_sites = all_sites
        if request.site_ids:
            target_sites = [s for s in all_sites if s.id in request.site_ids]
            
        ranked_list: List[RankedSite] = []
        disqualified_list: List[DisqualifiedSite] = []
        
        w = request.weights
        c = request.constraints
        # Normalize weights across all 6 criteria
        w_power = getattr(w, "power_survival", 0.0)
        w_blackout = getattr(w, "blackout_risk", 0.0)
        weight_sum = (
            w.solar_illumination +
            w.earth_communication +
            w.slope_safety +
            w.elevation_advantage +
            w_power +
            w_blackout
        )
        if weight_sum <= 0:
            weight_sum = 1.0
        norm_w_illum = w.solar_illumination / weight_sum
        norm_w_comm = w.earth_communication / weight_sum
        norm_w_slope = w.slope_safety / weight_sum
        norm_w_elev = w.elevation_advantage / weight_sum
        norm_w_power = w_power / weight_sum
        norm_w_blackout = w_blackout / weight_sum
        
        for site in target_sites:
            metrics = self.evaluate_site_metrics(
                site_id=site.id,
                start_date=request.start_date,
                duration_days=request.duration_days,
                step_hours=request.step_hours
            )
            if not metrics:
                continue
                
            violations = []
            if metrics.illumination_percentage < c.min_illumination_percentage:
                violations.append(f"Illumination {metrics.illumination_percentage}% < minimum threshold {c.min_illumination_percentage}%")
            if metrics.communication_percentage < c.min_communication_percentage:
                violations.append(f"Communication {metrics.communication_percentage}% < minimum threshold {c.min_communication_percentage}%")
            if metrics.slope_degrees > c.max_acceptable_slope_degrees:
                violations.append(f"Slope {metrics.slope_degrees}° exceeds maximum limit {c.max_acceptable_slope_degrees}°")
            if metrics.max_shadow_hours > c.max_continuous_shadow_hours:
                violations.append(f"Longest shadow {metrics.max_shadow_hours}h exceeds allowable {c.max_continuous_shadow_hours}h")
            if getattr(c, "max_comm_blackout_hours", None) is not None and metrics.max_comm_blackout_hours > c.max_comm_blackout_hours:
                violations.append(f"Communication blackout {metrics.max_comm_blackout_hours}h exceeds allowable {c.max_comm_blackout_hours}h")
                
            # Component scores normalized [0 - 100]
            score_illum = metrics.illumination_percentage
            score_comm = metrics.communication_percentage
            score_slope = max(0.0, 100.0 - (metrics.slope_degrees / c.max_acceptable_slope_degrees) * 100.0)
            score_elev = min(100.0, max(0.0, (metrics.elevation_m + 1000.0) / 60.0))
            score_blackout = max(0.0, 100.0 - (metrics.max_comm_blackout_hours / 72.0) * 100.0)
            
            # Power survival component score
            score_power = 100.0
            min_soc_val = 100.0
            if norm_w_power > 0 or getattr(c, "min_battery_soc_percent", None) is not None:
                safe_cutoff = min(50.0, max(5.0, getattr(c, "min_battery_soc_percent", 20.0) or 20.0))
                sim_req = SimulationRequest(
                    site_id=site.id,
                    start_date=request.start_date,
                    duration_days=request.duration_days,
                    step_hours=request.step_hours,
                    solar_array_area_m2=4.0,
                    battery_capacity_wh=5000.0,
                    min_safe_soc_percent=safe_cutoff
                )
                sim_res = simulation_engine.simulate_mission_power(sim_req)
                min_soc_val = sim_res.min_battery_soc_percent
                score_power = max(0.0, min(100.0, min_soc_val))
                if getattr(c, "min_battery_soc_percent", None) is not None and sim_res.min_battery_soc_percent < c.min_battery_soc_percent:
                    violations.append(f"Minimum battery charge {sim_res.min_battery_soc_percent:.1f}% violates cutoff {c.min_battery_soc_percent}%")
            
            total_score = round(
                norm_w_illum * score_illum +
                norm_w_comm * score_comm +
                norm_w_slope * score_slope +
                norm_w_elev * score_elev +
                norm_w_power * score_power +
                norm_w_blackout * score_blackout,
                1
            )
            
            breakdown = {
                "solar_illumination": round(score_illum, 1),
                "earth_communication": round(score_comm, 1),
                "slope_safety": round(score_slope, 1),
                "elevation_advantage": round(score_elev, 1),
                "power_survival": round(score_power, 1),
                "blackout_risk": round(score_blackout, 1)
            }
            raw = {
                "illumination_percentage": metrics.illumination_percentage,
                "longest_shadow_hours": metrics.max_shadow_hours,
                "communication_percentage": metrics.communication_percentage,
                "longest_blackout_hours": metrics.max_comm_blackout_hours,
                "slope_degrees": metrics.slope_degrees,
                "elevation_m": metrics.elevation_m
            }
            
            # Explainability: Extract key strengths & operational risks
            strengths = []
            if metrics.illumination_percentage >= 80.0:
                strengths.append(f"High cumulative solar availability ({metrics.illumination_percentage}%)")
            if metrics.communication_percentage >= 75.0:
                strengths.append(f"Extended Direct-to-Earth communication link ({metrics.communication_percentage}%)")
            if metrics.slope_degrees <= 6.0:
                strengths.append(f"Gentle landing surface gradient ({metrics.slope_degrees}°)")
            if metrics.elevation_m >= 1000.0:
                strengths.append(f"Elevated topographic vantage ({metrics.elevation_m:.0f} m) mitigating horizon occultation")
            if not strengths:
                strengths.append(f"Balanced operational baseline across evaluated criteria")

            risks = []
            if metrics.max_shadow_hours > 36.0:
                risks.append(f"Extended continuous shadow of {metrics.max_shadow_hours}h requiring high battery capacity")
            if metrics.max_comm_blackout_hours > 36.0:
                risks.append(f"DTE communication blackout up to {metrics.max_comm_blackout_hours}h during unfavorable libration")
            if metrics.slope_degrees > 8.0:
                risks.append(f"Local slope gradient ({metrics.slope_degrees}°) increases touchdown stability hazard")
            if not risks:
                risks.append("Benign regional topography within standard mission margins")

            # Risk level categorization
            if metrics.slope_degrees > 10.0 or metrics.max_shadow_hours > 50.0:
                risk_level = "HIGH_RISK"
            elif metrics.slope_degrees > 7.0 or metrics.max_shadow_hours > 30.0 or metrics.max_comm_blackout_hours > 30.0:
                risk_level = "MODERATE_RISK"
            else:
                risk_level = "LOW_RISK"

            # Formulate structured explanation
            primary_driver = "solar illumination" if norm_w_illum >= max(norm_w_comm, norm_w_slope, norm_w_elev) else \
                             ("Earth communication" if norm_w_comm >= max(norm_w_illum, norm_w_slope, norm_w_elev) else "slope safety")
            
            explanation = (
                f"Suitability score of {total_score}/100 driven predominantly by {primary_driver} weighting. "
                f"Solar availability is {metrics.illumination_percentage}% (max shadow {metrics.max_shadow_hours}h), "
                f"Direct-to-Earth coverage is {metrics.communication_percentage}%, and local terrain slope is {metrics.slope_degrees}°."
            )
            
            if violations:
                disqualified_list.append(DisqualifiedSite(
                    site_id=site.id,
                    name=site.name,
                    violations=violations
                ))
            else:
                ranked_list.append(RankedSite(
                    rank=0,  # Assigned after sorting
                    site_id=site.id,
                    name=site.name,
                    total_score=total_score,
                    is_compliant=True,
                    scores_breakdown=breakdown,
                    raw_metrics=raw,
                    explanation=explanation,
                    key_strengths=strengths,
                    key_risks=risks,
                    risk_level=risk_level,
                    safety_disclaimer=SAFETY_DISCLAIMER_TEXT
                ))
                
        # Sort ranked sites descending by composite score
        ranked_list.sort(key=lambda x: x.total_score, reverse=True)
        for i, s in enumerate(ranked_list, start=1):
            s.rank = i
            
        return RecommendResponse(
            start_date=request.start_date,
            duration_days=request.duration_days,
            weights_applied=w,
            ranking=ranked_list,
            disqualified_sites=disqualified_list,
            scientific_disclaimer=SAFETY_DISCLAIMER_TEXT
        )


recommendation_engine = RecommendationEngine()
