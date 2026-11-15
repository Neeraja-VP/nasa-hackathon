"""
LUNA NAVIGATOR — Earth Communication Engine (Joint Member 2 & 3 Integration)
Calculates Direct-to-Earth (DTE) visibility, libration dynamics, antenna pointing constraints,
and physical RF telecommunication link budgets accounting for LOLA terrain obstruction.
"""

import math
from datetime import datetime
from typing import List, Optional, Dict, Any
from app.core.constants import EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG
from app.engines.ephemeris.engine import ephemeris_engine
from app.engines.terrain.horizon import terrain_engine
from app.schemas.ephemeris import EphemerisRequest
from app.schemas.terrain import TerrainHorizonRequest
from app.schemas.communication import (
    CommunicationRequest,
    CommunicationPoint,
    CommunicationWindow,
    CommunicationResponse
)


class CommunicationEngine:
    """
    Evaluates Earth line-of-sight, antenna pointing limits, and physical RF link feasibility.
    """

    @staticmethod
    def calculate_link_budget(
        distance_km: float,
        tx_power_w: float,
        tx_gain_dbi: float,
        frequency_ghz: float,
        rx_gain_dbi: float,
        system_losses_db: float,
        rx_sensitivity_dbm: float
    ) -> tuple[float, float, float]:
        """
        Computes Free Space Path Loss (FSPL), Received Power (Prx in dBm), and Link Margin (dB).
        
        FSPL = 92.45 + 20*log10(d_km) + 20*log10(f_ghz)
        Prx = Ptx(dBm) + Gtx(dBi) - FSPL + Grx(dBi) - Lsys(dB)
        Margin = Prx - Sensitivity(dBm)
        """
        d = max(1000.0, distance_km)
        f = max(0.1, frequency_ghz)

        # Free space path loss in dB
        fspl_db = 92.45 + 20.0 * math.log10(d) + 20.0 * math.log10(f)

        # Transmitter power in dBm: P(dBm) = 10 * log10(P_watts * 1000)
        p_tx_dbm = 10.0 * math.log10(max(0.001, tx_power_w) * 1000.0)

        # Received isotropic power at ground station receiver in dBm
        p_rx_dbm = p_tx_dbm + tx_gain_dbi - fspl_db + rx_gain_dbi - system_losses_db

        # Link margin over threshold in dB
        margin_db = p_rx_dbm - rx_sensitivity_dbm

        return round(fspl_db, 2), round(p_rx_dbm, 2), round(margin_db, 2)

    def calculate_communication(self, request: CommunicationRequest) -> CommunicationResponse:
        # 1. Ephemeris series (topocentric Earth vectors)
        eph_req = EphemerisRequest(
            latitude=request.latitude,
            longitude=request.longitude,
            elevation_m=request.elevation_m,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            use_live_horizons=request.use_live_horizons
        )
        eph_res = ephemeris_engine.calculate_ephemeris_series(eph_req)

        # 2. Local terrain horizon mask from LOLA DEM
        terrain_horizon = None
        if request.use_terrain_horizon:
            terr_req = TerrainHorizonRequest(
                latitude=request.latitude,
                longitude=request.longitude,
                elevation_m=request.elevation_m,
                observer_height_m=request.antenna_height_m
            )
            terrain_horizon = terrain_engine.generate_horizon_profile(terr_req)

        time_series: List[CommunicationPoint] = []
        visible_count = 0
        feasible_count = 0
        current_comm_run = 0.0
        max_comm_run = 0.0
        current_blackout_run = 0.0
        max_blackout_run = 0.0

        margins_list: List[float] = []

        # Antenna gimbal limits
        min_gimbal = getattr(request, "antenna_min_elevation_deg", request.min_comm_elevation_deg)
        max_gimbal = getattr(request, "antenna_max_elevation_deg", 85.0)

        for pt in eph_res.time_series:
            earth_az = pt.earth_azimuth_deg
            earth_el = pt.earth_elevation_deg
            earth_dist_km = getattr(pt, "earth_distance_km", 384400.0)

            horizon_el = 0.0
            if terrain_horizon:
                horizon_el = terrain_engine.get_horizon_elevation_at_azimuth(terrain_horizon, earth_az)

            clearance = round(earth_el - horizon_el, 2)

            # 1. Geometric Line-of-Sight Criteria
            effective_cutoff = max(horizon_el, request.min_comm_elevation_deg)
            is_visible = earth_el > effective_cutoff

            # 2. Antenna pointing limitations
            is_antenna_in_limits = (min_gimbal <= earth_el <= max_gimbal)

            # 3. Optional RF Link Budget Assessment
            fspl_db: Optional[float] = None
            p_rx_dbm: Optional[float] = None
            margin_db: Optional[float] = None
            is_link_feasible = is_visible and is_antenna_in_limits

            if request.enable_link_budget:
                fspl_db, p_rx_dbm, margin_db = self.calculate_link_budget(
                    distance_km=earth_dist_km,
                    tx_power_w=request.tx_power_w,
                    tx_gain_dbi=request.tx_antenna_gain_dbi,
                    frequency_ghz=request.carrier_frequency_ghz,
                    rx_gain_dbi=request.rx_antenna_gain_dbi,
                    system_losses_db=request.system_losses_db,
                    rx_sensitivity_dbm=request.rx_sensitivity_dbm
                )
                margins_list.append(margin_db)
                req_margin = getattr(request, "required_margin_db", 3.0)
                if margin_db < req_margin:
                    is_link_feasible = False

            # Classify link status string
            if is_visible:
                if not is_antenna_in_limits:
                    link_status = "POINTING_LIMIT_EXCEEDED"
                elif request.enable_link_budget and not is_link_feasible:
                    link_status = "INSUFFICIENT_MARGIN"
                else:
                    link_status = "DIRECT_LINE_OF_SIGHT"
            else:
                if earth_el <= horizon_el:
                    link_status = "TERRAIN_BLOCKED"
                else:
                    link_status = "BELOW_MIN_ELEVATION"

            if is_visible:
                visible_count += 1
                current_comm_run += request.step_hours
                if current_comm_run > max_comm_run:
                    max_comm_run = current_comm_run
                current_blackout_run = 0.0
            else:
                current_blackout_run += request.step_hours
                if current_blackout_run > max_blackout_run:
                    max_blackout_run = current_blackout_run
                current_comm_run = 0.0

            if is_link_feasible:
                feasible_count += 1

            time_series.append(CommunicationPoint(
                timestamp=pt.timestamp,
                earth_azimuth_deg=earth_az,
                earth_elevation_deg=earth_el,
                earth_distance_km=earth_dist_km,
                terrain_horizon_elevation_deg=round(horizon_el, 2),
                terrain_clearance_deg=clearance,
                is_earth_visible=is_visible,
                is_antenna_in_limits=is_antenna_in_limits,
                link_status=link_status,
                earth_apparent_diameter_deg=round(EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG * 2.0, 2),
                free_space_path_loss_db=fspl_db,
                received_power_dbm=p_rx_dbm,
                link_margin_db=margin_db,
                is_link_feasible=is_link_feasible
            ))

        total_steps = len(time_series)
        comm_pct = round((visible_count / total_steps * 100.0), 1) if total_steps > 0 else 0.0
        feasible_pct = round((feasible_count / total_steps * 100.0), 1) if total_steps > 0 else 0.0
        total_visible_hours = round(visible_count * request.step_hours, 1)
        total_blocked_hours = round((total_steps - visible_count) * request.step_hours, 1)
        total_feasible_hours = round(feasible_count * request.step_hours, 1)

        # 4. Extract Contiguous Communication Windows (Task 4)
        windows: List[CommunicationWindow] = []
        win_idx = 0
        in_window = False
        win_start: Optional[datetime] = None
        win_max_el = -90.0
        win_margins: List[float] = []
        win_steps = 0

        for pt in time_series:
            active = pt.is_earth_visible if not request.enable_link_budget else pt.is_link_feasible
            if active:
                if not in_window:
                    in_window = True
                    win_start = pt.timestamp
                    win_max_el = pt.earth_elevation_deg
                    win_margins = [pt.link_margin_db] if pt.link_margin_db is not None else []
                    win_steps = 1
                else:
                    win_steps += 1
                    win_max_el = max(win_max_el, pt.earth_elevation_deg)
                    if pt.link_margin_db is not None:
                        win_margins.append(pt.link_margin_db)
            else:
                if in_window:
                    win_idx += 1
                    avg_m = round(sum(win_margins) / len(win_margins), 1) if win_margins else None
                    windows.append(CommunicationWindow(
                        window_index=win_idx,
                        start_time=win_start,
                        end_time=pt.timestamp,
                        duration_hours=round(win_steps * request.step_hours, 1),
                        max_elevation_deg=round(win_max_el, 2),
                        avg_link_margin_db=avg_m
                    ))
                    in_window = False

        if in_window:
            win_idx += 1
            avg_m = round(sum(win_margins) / len(win_margins), 1) if win_margins else None
            windows.append(CommunicationWindow(
                window_index=win_idx,
                start_time=win_start,
                end_time=time_series[-1].timestamp,
                duration_hours=round(win_steps * request.step_hours, 1),
                max_elevation_deg=round(win_max_el, 2),
                avg_link_margin_db=avg_m
            ))

        next_win_start = windows[0].start_time if windows else None
        next_win_dur = windows[0].duration_hours if windows else None

        # Blackout Warning
        blackout_warning: Optional[str] = None
        if max_blackout_run >= 48.0:
            blackout_warning = (
                f"CRITICAL COMM BLACKOUT: Longest Direct-to-Earth blackout is {max_blackout_run:.1f} hours. "
                f"Autonomous lander operation or orbital relay (e.g. Lunar Gateway) required during blackout intervals."
            )
        elif max_blackout_run >= 24.0:
            blackout_warning = (
                f"ELEVATED BLACKOUT WARNING: Communication blackout up to {max_blackout_run:.1f} hours detected."
            )

        avg_margin = round(sum(margins_list) / len(margins_list), 1) if margins_list else None

        link_summary = None
        if request.enable_link_budget:
            link_summary = {
                "carrier_frequency_ghz": request.carrier_frequency_ghz,
                "tx_power_w": request.tx_power_w,
                "tx_antenna_gain_dbi": request.tx_antenna_gain_dbi,
                "rx_antenna_gain_dbi": request.rx_antenna_gain_dbi,
                "average_fspl_db": round(sum(p.free_space_path_loss_db for p in time_series if p.free_space_path_loss_db) / max(1, total_steps), 1),
                "average_link_margin_db": avg_margin,
                "min_link_margin_db": min(margins_list) if margins_list else None,
                "required_margin_db": request.required_margin_db,
                "is_margin_compliant": (min(margins_list) >= request.required_margin_db) if margins_list else False
            }

        terrain_source = terrain_horizon.terrain_data_source if terrain_horizon else "GEOMETRIC HORIZON (NO TERRAIN)"
        dem_res = terrain_horizon.dem_resolution_m if terrain_horizon else 0.0

        return CommunicationResponse(
            latitude=request.latitude,
            longitude=request.longitude,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            communication_availability_percentage=comm_pct,
            total_visible_hours=total_visible_hours,
            total_blocked_hours=total_blocked_hours,
            longest_continuous_comm_window_hours=round(max_comm_run, 1),
            longest_continuous_blackout_hours=round(max_blackout_run, 1),
            num_communication_windows=len(windows),
            communication_windows=windows,
            next_window_start=next_win_start,
            next_window_duration_hours=next_win_dur,
            rf_link_feasible_percentage=feasible_pct,
            total_rf_feasible_hours=total_feasible_hours,
            link_budget_enabled=request.enable_link_budget,
            average_link_margin_db=avg_margin,
            blackout_warning=blackout_warning,
            link_budget_summary=link_summary,
            data_source=eph_res.data_source,
            data_source_type=eph_res.data_source_type,
            terrain_data_source=terrain_source,
            dem_resolution_m=dem_res,
            data_quality_warning=eph_res.data_quality_warning or (terrain_horizon.data_quality_warning if terrain_horizon else None),
            time_series=time_series
        )


communication_engine = CommunicationEngine()
