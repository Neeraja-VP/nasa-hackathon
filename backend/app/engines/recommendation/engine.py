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
    ScenarioInput,
    ScenarioTimelinePoint,
    ScenarioResult,
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

    def evaluate_single_scenario(self, scenario: ScenarioInput) -> ScenarioResult:
        """
        Calculates all 12 operational metrics for an independent mission scenario
        using actual existing scientific calculation engines.
        """
        # 1. Coordinate & Geomorphic resolution
        site = get_site_by_id(scenario.site_id) if scenario.site_id else None
        if site:
            site_name = scenario.site_name or site.name
            lat = site.latitude
            lon = site.longitude
            elev = site.elevation_m if scenario.elevation_m is None else scenario.elevation_m
            slope = site.slope_degrees
        else:
            site_name = scenario.site_name or scenario.name
            lat = scenario.latitude
            lon = scenario.longitude % 360.0
            elev = scenario.elevation_m if scenario.elevation_m is not None else dem_loader.sample_elevation(lat, lon)
            slope = dem_loader.calculate_surface_slope_deg(lat, lon)

        # 2. Solar Illumination Calculation
        illum_req = IlluminationRequest(
            latitude=lat,
            longitude=lon,
            elevation_m=elev,
            mast_height_m=scenario.mast_height_m,
            start_date=scenario.start_date,
            duration_days=scenario.duration_days,
            step_hours=scenario.step_hours
        )
        illum_res = illumination_engine.calculate_illumination(illum_req)
        sun_elevations = [p.sun_elevation_deg for p in illum_res.time_series]
        max_sun_el = max(sun_elevations) if sun_elevations else 0.0
        min_sun_el = min(sun_elevations) if sun_elevations else 0.0

        # 3. Direct-to-Earth Communication Calculation
        comm_req = CommunicationRequest(
            latitude=lat,
            longitude=lon,
            elevation_m=elev,
            antenna_height_m=scenario.mast_height_m,
            start_date=scenario.start_date,
            duration_days=scenario.duration_days,
            step_hours=scenario.step_hours
        )
        comm_res = communication_engine.calculate_communication(comm_req)

        # Count contiguous communication windows
        num_windows = 0
        in_win = False
        for pt in comm_res.time_series:
            if pt.is_earth_visible:
                if not in_win:
                    num_windows += 1
                    in_win = True
            else:
                in_win = False

        # 4. Electrical Power System (EPS) Simulation
        sim_req = SimulationRequest(
            site_id="custom",
            latitude=lat,
            longitude=lon,
            elevation_m=elev,
            mast_height_m=scenario.mast_height_m,
            start_date=scenario.start_date,
            duration_days=scenario.duration_days,
            step_hours=scenario.step_hours,
            solar_array_area_m2=scenario.solar_array_area_m2,
            solar_efficiency=scenario.solar_efficiency,
            solar_tracking_type=scenario.solar_tracking_type,
            battery_capacity_wh=scenario.battery_capacity_wh,
            initial_battery_soc_percent=scenario.initial_battery_soc_percent,
            min_safe_soc_percent=scenario.min_safe_soc_percent,
            base_hotel_load_w=scenario.base_hotel_load_w,
            payload_active_load_w=scenario.payload_active_load_w,
            survival_heater_load_w=scenario.survival_heater_load_w
        )
        sim_res = simulation_engine.simulate_mission_power(sim_req)

        # 5. Composite Suitability Score (0 to 100)
        s_illum = illum_res.illumination_percentage
        s_comm = comm_res.communication_availability_percentage
        s_slope = max(0.0, 100.0 - (slope / 15.0) * 100.0)
        
        if sim_res.battery_depleted:
            s_power = 0.0
        else:
            margin = max(0.0, sim_res.min_battery_soc_percent - scenario.min_safe_soc_percent)
            s_power = min(100.0, 50.0 + margin * 1.5)

        composite = round(
            0.30 * s_illum +
            0.25 * s_comm +
            0.25 * s_power +
            0.20 * s_slope,
            1
        )
        if sim_res.battery_depleted:
            composite = min(composite, 30.0)

        # 6. Timeline sample points for charts (max 80 points)
        timeline: List[ScenarioTimelinePoint] = []
        n_pts = len(illum_res.time_series)
        step_stride = max(1, n_pts // 80)
        for i in range(0, n_pts, step_stride):
            i_p = illum_res.time_series[i]
            c_p = comm_res.time_series[i] if i < len(comm_res.time_series) else comm_res.time_series[-1]
            p_p = sim_res.time_series[i] if i < len(sim_res.time_series) else sim_res.time_series[-1]
            timeline.append(ScenarioTimelinePoint(
                timestamp=i_p.timestamp,
                is_sunlit=i_p.is_sunlit_terrain,
                sun_elevation_deg=i_p.sun_elevation_deg,
                is_earth_visible=c_p.is_earth_visible,
                earth_elevation_deg=c_p.earth_elevation_deg,
                battery_soc_percent=p_p.battery_soc_percent,
                net_power_w=p_p.net_power_w
            ))

        return ScenarioResult(
            scenario_id=scenario.id,
            name=scenario.name,
            site_name=site_name,
            latitude=round(lat, 4),
            longitude=round(lon, 4),
            elevation_m=round(elev, 1),
            slope_degrees=round(slope, 1),
            start_date=scenario.start_date,
            duration_days=scenario.duration_days,
            step_hours=scenario.step_hours,
            max_solar_elevation_deg=round(max_sun_el, 2),
            min_solar_elevation_deg=round(min_sun_el, 2),
            total_sunlight_hours=round(illum_res.total_sunlit_hours, 1),
            total_darkness_hours=round(illum_res.total_shadow_hours, 1),
            illumination_percentage=round(illum_res.illumination_percentage, 1),
            longest_continuous_sunlight_hours=round(illum_res.longest_continuous_sunlight_hours, 1),
            longest_continuous_darkness_hours=round(illum_res.longest_continuous_shadow_hours, 1),
            earth_visibility_hours=round(comm_res.total_visible_hours, 1),
            communication_percentage=round(comm_res.communication_availability_percentage, 1),
            longest_comm_blackout_hours=round(comm_res.longest_continuous_blackout_hours, 1),
            num_comm_windows=num_windows,
            min_battery_soc_percent=round(sim_res.min_battery_soc_percent, 1),
            total_energy_generated_kwh=round(sim_res.total_energy_generated_kwh, 2),
            total_energy_consumed_kwh=round(sim_res.total_energy_consumed_kwh, 2),
            net_energy_balance_kwh=round(sim_res.net_energy_balance_kwh, 2),
            battery_depleted=sim_res.battery_depleted,
            power_survival_status="SURVIVED" if not sim_res.battery_depleted else "BATTERY_DEPLETED",
            eps_health_status=sim_res.eps_health_status,
            overall_suitability_score=composite,
            timeline=timeline
        )

    def compare_scenarios(self, request: MultiScenarioCompareRequest) -> MultiScenarioCompareResponse:
        """
        Evaluate and compare multiple independent scenarios, each with distinct sites, dates, and power systems.
        """
        results: List[ScenarioResult] = []
        for scen in request.scenarios:
            res = self.evaluate_single_scenario(scen)
            results.append(res)

        # Sort descending by overall suitability score
        results.sort(key=lambda x: x.overall_suitability_score, reverse=True)
        for i, r in enumerate(results, start=1):
            r.rank = i

        best_id = results[0].scenario_id if results else ""

        # Identify metric leaders
        leaders: Dict[str, str] = {}
        if results:
            leaders["illumination"] = max(results, key=lambda s: s.illumination_percentage).scenario_id
            leaders["communication"] = max(results, key=lambda s: s.communication_percentage).scenario_id
            leaders["min_soc"] = max(results, key=lambda s: s.min_battery_soc_percent).scenario_id
            leaders["energy_generated"] = max(results, key=lambda s: s.total_energy_generated_kwh).scenario_id
            leaders["slope"] = min(results, key=lambda s: s.slope_degrees).scenario_id
            leaders["longest_sunlight"] = max(results, key=lambda s: s.longest_continuous_sunlight_hours).scenario_id
            leaders["suitability"] = best_id

        return MultiScenarioCompareResponse(
            mode=request.mode,
            comparison_timestamp=datetime.now(timezone.utc),
            total_scenarios=len(results),
            scenarios=results,
            best_scenario_id=best_id,
            metric_leaders=leaders
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

        # Normalize weights across all 6 criteria (Task 6)
        w_power = getattr(w, "power_survival", 0.0)
        w_blackout = getattr(w, "blackout_risk", 0.0)
        weight_sum = (
            w.solar_illumination
            + w.earth_communication
            + w.slope_safety
            + w.elevation_advantage
            + w_power
            + w_blackout
        )
        if weight_sum <= 0:
            weight_sum = 1.0

        norm_w_illum = w.solar_illumination / weight_sum
        norm_w_comm = w.earth_communication / weight_sum
        norm_w_slope = w.slope_safety / weight_sum
        norm_w_elev = w.elevation_advantage / weight_sum
        norm_w_power = w_power / weight_sum
        norm_w_blackout = w_blackout / weight_sum
        
        c_max_blackout = getattr(c, "max_comm_blackout_hours", 72.0)
        c_min_soc = getattr(c, "min_battery_soc_percent", 20.0)

        for site in target_sites:
            metrics = self.evaluate_site_metrics(
                site_id=site.id,
                start_date=request.start_date,
                duration_days=request.duration_days,
                step_hours=request.step_hours
            )
            if not metrics:
                continue

            # Run baseline Electrical Power System (EPS) simulation for site
            sim_req = SimulationRequest(
                site_id=site.id,
                start_date=request.start_date,
                duration_days=request.duration_days,
                step_hours=request.step_hours
            )
            sim_res = simulation_engine.simulate_mission_power(sim_req)
                
            violations = []
            if metrics.illumination_percentage < c.min_illumination_percentage:
                violations.append(f"Illumination {metrics.illumination_percentage}% < minimum threshold {c.min_illumination_percentage}%")
            if metrics.communication_percentage < c.min_communication_percentage:
                violations.append(f"Communication {metrics.communication_percentage}% < minimum threshold {c.min_communication_percentage}%")
            if metrics.slope_degrees > c.max_acceptable_slope_degrees:
                violations.append(f"Slope {metrics.slope_degrees}° exceeds maximum limit {c.max_acceptable_slope_degrees}°")
            if metrics.max_shadow_hours > c.max_continuous_shadow_hours:
                violations.append(f"Longest shadow {metrics.max_shadow_hours}h exceeds allowable {c.max_continuous_shadow_hours}h")
            if metrics.max_comm_blackout_hours > c_max_blackout:
                violations.append(f"DTE Blackout {metrics.max_comm_blackout_hours}h exceeds allowable {c_max_blackout}h")
            if sim_res.min_battery_soc_percent < c_min_soc:
                violations.append(f"Minimum battery SoC {sim_res.min_battery_soc_percent}% < minimum safe cutoff {c_min_soc}%")
            if sim_res.battery_depleted:
                violations.append("Battery energy storage depleted (0.0% SoC) during mission shadow")
                
            # Component scores normalized [0 - 100]
            score_illum = metrics.illumination_percentage
            score_comm = metrics.communication_percentage
            score_slope = max(0.0, 100.0 - (metrics.slope_degrees / c.max_acceptable_slope_degrees) * 100.0)
            score_elev = min(100.0, max(0.0, (metrics.elevation_m + 1000.0) / 60.0))
            score_power = 0.0 if sim_res.battery_depleted else min(100.0, max(0.0, 50.0 + (sim_res.min_battery_soc_percent - 20.0) * 1.5))
            score_blackout = max(0.0, 100.0 - (metrics.max_comm_blackout_hours / max(1.0, c_max_blackout)) * 100.0)
            
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
                "elevation_m": metrics.elevation_m,
                "min_battery_soc_percent": sim_res.min_battery_soc_percent,
                "total_energy_generated_kwh": sim_res.total_energy_generated_kwh,
                "battery_depleted": 1.0 if sim_res.battery_depleted else 0.0
            }
            
            # Explainability: Extract key strengths & operational risks
            strengths = []
            if metrics.illumination_percentage >= 80.0:
                strengths.append(f"High cumulative solar availability ({metrics.illumination_percentage}%)")
            if metrics.communication_percentage >= 75.0:
                strengths.append(f"Extended Direct-to-Earth communication link ({metrics.communication_percentage}%)")
            if sim_res.min_battery_soc_percent >= 40.0:
                strengths.append(f"Robust battery storage reserve ({sim_res.min_battery_soc_percent}% minimum SoC)")
            if metrics.slope_degrees <= 6.0:
                strengths.append(f"Gentle landing surface gradient ({metrics.slope_degrees}°)")
            if metrics.elevation_m >= 1000.0:
                strengths.append(f"Elevated topographic vantage ({metrics.elevation_m:.0f} m) mitigating horizon occultation")
            if not strengths:
                strengths.append("Balanced operational baseline across evaluated criteria")

            risks = []
            if sim_res.battery_depleted:
                risks.append("CRITICAL: Battery storage exhausts during extended shadows")
            elif sim_res.min_battery_soc_percent < 30.0:
                risks.append(f"Marginal battery reserve ({sim_res.min_battery_soc_percent}% minimum SoC)")
            if metrics.max_shadow_hours > 36.0:
                risks.append(f"Extended continuous shadow of {metrics.max_shadow_hours}h requiring high battery capacity")
            if metrics.max_comm_blackout_hours > 36.0:
                risks.append(f"DTE communication blackout up to {metrics.max_comm_blackout_hours}h during unfavorable libration")
            if metrics.slope_degrees > 8.0:
                risks.append(f"Local slope gradient ({metrics.slope_degrees}°) increases touchdown stability hazard")
            if not risks:
                risks.append("Benign regional topography within standard mission margins")

            # Risk level categorization
            if sim_res.battery_depleted or metrics.slope_degrees > 10.0 or metrics.max_shadow_hours > 50.0:
                risk_level = "HIGH_RISK"
            elif metrics.slope_degrees > 7.0 or metrics.max_shadow_hours > 30.0 or metrics.max_comm_blackout_hours > 30.0 or sim_res.min_battery_soc_percent < 30.0:
                risk_level = "MODERATE_RISK"
            else:
                risk_level = "LOW_RISK"

            # Formulate structured explanation
            drivers = [
                ("solar illumination", norm_w_illum),
                ("Earth communication", norm_w_comm),
                ("slope safety", norm_w_slope),
                ("power survival", norm_w_power),
                ("blackout risk", norm_w_blackout)
            ]
            primary_driver = max(drivers, key=lambda d: d[1])[0]
            
            explanation = (
                f"Suitability score of {total_score}/100 driven predominantly by {primary_driver} weighting. "
                f"Solar availability is {metrics.illumination_percentage}% (max shadow {metrics.max_shadow_hours}h), "
                f"Direct-to-Earth coverage is {metrics.communication_percentage}%, minimum battery SoC is {sim_res.min_battery_soc_percent}%, "
                f"and local terrain slope is {metrics.slope_degrees}°."
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
