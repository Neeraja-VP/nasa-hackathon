"""
LUNA NAVIGATOR — Recommendation Engine (Member 4 Ownership)
Implements explainable Multi-Criteria Decision Analysis (MCDA) for lunar landing site selection and ranking.
Adheres strictly to scientific evidence: does not fabricate data or treat a weighted score as NASA-certified safety.
"""

from typing import List, Dict, Optional, Tuple, Any
from app.core.sites_catalog import load_candidate_sites, get_site_by_id
from app.engines.illumination.engine import illumination_engine
from app.engines.communication.engine import communication_engine
from app.schemas.illumination import IlluminationRequest
from app.schemas.communication import CommunicationRequest
from app.schemas.compare import CompareRequest, SiteComparisonMetrics, CompareResponse
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

    def recommend_sites(self, request: RecommendRequest) -> RecommendResponse:
        all_sites = load_candidate_sites()
        target_sites = all_sites
        if request.site_ids:
            target_sites = [s for s in all_sites if s.id in request.site_ids]
            
        ranked_list: List[RankedSite] = []
        disqualified_list: List[DisqualifiedSite] = []
        
        w = request.weights
        c = request.constraints
        # Normalize weights
        weight_sum = w.solar_illumination + w.earth_communication + w.slope_safety + w.elevation_advantage
        if weight_sum <= 0:
            weight_sum = 1.0
        norm_w_illum = w.solar_illumination / weight_sum
        norm_w_comm = w.earth_communication / weight_sum
        norm_w_slope = w.slope_safety / weight_sum
        norm_w_elev = w.elevation_advantage / weight_sum
        
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
                
            # Component scores normalized [0 - 100]
            score_illum = metrics.illumination_percentage
            score_comm = metrics.communication_percentage
            score_slope = max(0.0, 100.0 - (metrics.slope_degrees / c.max_acceptable_slope_degrees) * 100.0)
            score_elev = min(100.0, max(0.0, (metrics.elevation_m + 1000.0) / 60.0))
            
            total_score = round(
                norm_w_illum * score_illum +
                norm_w_comm * score_comm +
                norm_w_slope * score_slope +
                norm_w_elev * score_elev,
                1
            )
            
            breakdown = {
                "solar_illumination": round(score_illum, 1),
                "earth_communication": round(score_comm, 1),
                "slope_safety": round(score_slope, 1),
                "elevation_advantage": round(score_elev, 1)
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
