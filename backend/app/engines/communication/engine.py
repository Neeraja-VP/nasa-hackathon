"""
LUNA NAVIGATOR — Earth Communication Engine (Joint Member 2 & 3 Integration)
Calculates Direct-to-Earth (DTE) visibility, antenna pointing limits, discrete communication windows,
and physics-based RF link budget feasibility accounting for lunar libration and LOLA terrain obstruction.
"""

import math
from typing import List, Optional
from datetime import datetime, timezone
from app.core.constants import EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG
from app.engines.ephemeris.engine import ephemeris_engine
from app.engines.terrain.horizon import terrain_engine
from app.schemas.ephemeris import EphemerisRequest
from app.schemas.terrain import TerrainHorizonRequest
from app.schemas.communication import (
    CommunicationRequest,
    CommunicationPoint,
    CommWindow,
    LinkBudgetSummary,
    CommunicationResponse
)

# Physical constants for RF Link Budget
SPEED_OF_LIGHT_M_S = 299792458.0
BOLTZMANN_CONSTANT_DBW_K_HZ = -228.60  # 10 * log10(1.380649e-23)
TYPICAL_DSN_TSYS_K = 135.0  # Cryogenic LNA noise temperature at 34m ground station


class CommunicationEngine:
    """
    Evaluates Earth line-of-sight, antenna pointing limits, communication windows,
    and physics-grounded RF link margins.
    """
    
    def calculate_link_budget(
        self,
        request: CommunicationRequest,
        earth_distance_km: float = 384400.0
    ) -> LinkBudgetSummary:
        """
        Calculate free space path loss, received Eb/N0, and link margin using the Friis transmission equation.
        Separates geometric line of sight from actual RF link feasibility.
        """
        freq_hz = request.carrier_frequency_ghz * 1e9
        dist_m = earth_distance_km * 1000.0
        
        # Free Space Path Loss (FSPL) in dB: 20 * log10(4 * pi * d * f / c)
        fspl_db = 20.0 * math.log10(max(1.0, 4.0 * math.pi * dist_m * freq_hz / SPEED_OF_LIGHT_M_S))
        
        # Transmitter EIRP in dBW
        p_tx_dbw = 10.0 * math.log10(max(0.01, request.tx_power_w))
        eirp_dbw = p_tx_dbw + request.tx_antenna_gain_dbi - 1.0  # 1 dB internal harness loss
        
        # Receiver Noise Spectral Density N0 (dBW/Hz)
        n0_dbw_hz = BOLTZMANN_CONSTANT_DBW_K_HZ + 10.0 * math.log10(TYPICAL_DSN_TSYS_K)
        
        # Received Carrier Power C (dBW)
        c_rx_dbw = eirp_dbw - fspl_db - request.system_losses_db + request.rx_antenna_gain_dbi
        
        # Carrier-to-Noise Density C/N0 (dB-Hz)
        c_n0_db_hz = c_rx_dbw - n0_dbw_hz
        
        # Energy per bit to noise density Eb/N0 (dB)
        data_rate_bps = request.data_rate_kbps * 1000.0
        eb_n0_db = c_n0_db_hz - 10.0 * math.log10(max(1.0, data_rate_bps))
        
        # Link Margin (dB)
        link_margin_db = eb_n0_db - request.required_eb_n0_db
        is_feasible = link_margin_db >= request.min_link_margin_db
        
        return LinkBudgetSummary(
            carrier_frequency_ghz=request.carrier_frequency_ghz,
            transmitter_power_w=request.tx_power_w,
            tx_power_w=request.tx_power_w,
            tx_antenna_gain_dbi=request.tx_antenna_gain_dbi,
            rx_antenna_gain_dbi=request.rx_antenna_gain_dbi,
            free_space_path_loss_db=round(fspl_db, 2),
            eirp_dbw=round(eirp_dbw, 2),
            received_eb_n0_db=round(eb_n0_db, 2),
            required_eb_n0_db=round(request.required_eb_n0_db, 2),
            link_margin_db=round(link_margin_db, 2),
            min_link_margin_db=round(link_margin_db, 2),
            is_link_feasible=is_feasible
        )

    def calculate_communication(self, request: CommunicationRequest) -> CommunicationResponse:
        # 1. Ephemeris series
        eph_req = EphemerisRequest(
            latitude=request.latitude,
            longitude=request.longitude,
            elevation_m=request.elevation_m,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            use_live_horizons=getattr(request, "use_live_horizons", False)
        )
        eph_res = ephemeris_engine.calculate_ephemeris_series(eph_req)
        
        # 2. Local terrain horizon mask
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
        current_comm_run = 0.0
        max_comm_run = 0.0
        current_blackout_run = 0.0
        max_blackout_run = 0.0
        
        # Evaluate baseline link budget
        link_summary = None
        if request.enable_link_budget:
            mean_dist_km = getattr(eph_res.time_series[0], "earth_distance_km", 384400.0) if eph_res.time_series else 384400.0
            link_summary = self.calculate_link_budget(request, earth_distance_km=mean_dist_km)
            
        # Point-by-point evaluation
        active_window_start = None
        window_elevations = []
        comm_windows: List[CommWindow] = []
        window_counter = 0
        
        max_el_limit = getattr(request, "max_comm_elevation_deg", 90.0)
        az_min_limit = getattr(request, "antenna_azimuth_min_deg", None)
        az_max_limit = getattr(request, "antenna_azimuth_max_deg", None)
        
        for idx, pt in enumerate(eph_res.time_series):
            earth_az = pt.earth_azimuth_deg
            earth_el = pt.earth_elevation_deg
            earth_dist = getattr(pt, "earth_distance_km", 384400.0)
            
            horizon_el = 0.0
            if terrain_horizon:
                horizon_el = terrain_engine.get_horizon_elevation_at_azimuth(terrain_horizon, earth_az)
                
            # Line of Sight Criteria:
            # 1. Earth center must be above local terrain horizon
            # 2. Earth elevation must satisfy minimum ground station mask
            effective_cutoff = max(horizon_el, request.min_comm_elevation_deg)
            is_geom_visible = (earth_el > effective_cutoff) and (earth_el <= max_el_limit)
            
            # Check antenna azimuth gimbal limits if configured
            in_azimuth_gimbal = True
            if az_min_limit is not None and az_max_limit is not None:
                if az_min_limit <= az_max_limit:
                    in_azimuth_gimbal = az_min_limit <= earth_az <= az_max_limit
                else:
                    in_azimuth_gimbal = (earth_az >= az_min_limit) or (earth_az <= az_max_limit)
            elif az_min_limit is not None:
                in_azimuth_gimbal = earth_az >= az_min_limit
            elif az_max_limit is not None:
                in_azimuth_gimbal = earth_az <= az_max_limit
                
            if not in_azimuth_gimbal or earth_el > max_el_limit:
                is_geom_visible = False
                
            # Link budget feasibility check
            pt_link_margin = None
            pt_link_feasible = is_geom_visible
            if request.enable_link_budget and link_summary:
                pt_budget = self.calculate_link_budget(request, earth_distance_km=earth_dist)
                pt_link_margin = pt_budget.link_margin_db
                pt_link_feasible = is_geom_visible and pt_budget.is_link_feasible
                
            is_visible = is_geom_visible and (pt_link_feasible if request.enable_link_budget else True)
            
            if is_visible:
                link_status = "DIRECT_LINE_OF_SIGHT"
                visible_count += 1
                current_comm_run += request.step_hours
                if current_comm_run > max_comm_run:
                    max_comm_run = current_comm_run
                current_blackout_run = 0.0
                
                # Window tracking
                if active_window_start is None:
                    active_window_start = pt.timestamp
                    window_elevations = [earth_el]
                else:
                    window_elevations.append(earth_el)
            else:
                if not in_azimuth_gimbal or earth_el > max_el_limit:
                    link_status = "OUTSIDE_ANTENNA_GIMBAL"
                elif earth_el <= horizon_el:
                    link_status = "TERRAIN_BLOCKED"
                elif earth_el <= request.min_comm_elevation_deg:
                    link_status = "BELOW_MIN_ELEVATION"
                elif is_geom_visible and not pt_link_feasible:
                    link_status = "INSUFFICIENT_LINK_MARGIN"
                else:
                    link_status = "TERRAIN_BLOCKED"
                    
                current_blackout_run += request.step_hours
                if current_blackout_run > max_blackout_run:
                    max_blackout_run = current_blackout_run
                current_comm_run = 0.0
                
                # Close active window if open
                if active_window_start is not None:
                    window_counter += 1
                    win_duration = len(window_elevations) * request.step_hours
                    comm_windows.append(CommWindow(
                        window_id=window_counter,
                        start_time=active_window_start,
                        end_time=pt.timestamp,
                        duration_hours=round(win_duration, 1),
                        mean_earth_elevation_deg=round(sum(window_elevations) / len(window_elevations), 2),
                        mean_link_margin_db=link_summary.link_margin_db if link_summary else None
                    ))
                    active_window_start = None
                    window_elevations = []
                
            time_series.append(CommunicationPoint(
                timestamp=pt.timestamp,
                earth_azimuth_deg=round(earth_az, 2),
                earth_elevation_deg=round(earth_el, 2),
                terrain_horizon_elevation_deg=round(horizon_el, 2),
                is_earth_visible=is_visible,
                is_geometrically_visible=is_geom_visible,
                link_status=link_status,
                earth_apparent_diameter_deg=round(EARTH_ANGULAR_RADIUS_LUNAR_SKY_DEG * 2.0, 2),
                link_margin_db=round(pt_link_margin, 1) if pt_link_margin is not None else None,
                is_link_feasible=pt_link_feasible
            ))
            
        # Close trailing window if mission ended while visible
        if active_window_start is not None and eph_res.time_series:
            window_counter += 1
            win_duration = len(window_elevations) * request.step_hours
            comm_windows.append(CommWindow(
                window_id=window_counter,
                start_time=active_window_start,
                end_time=eph_res.time_series[-1].timestamp,
                duration_hours=round(win_duration, 1),
                mean_earth_elevation_deg=round(sum(window_elevations) / len(window_elevations), 2),
                mean_link_margin_db=link_summary.link_margin_db if link_summary else None
            ))
            
        total_steps = len(time_series)
        comm_pct = round((visible_count / total_steps * 100.0), 1) if total_steps > 0 else 0.0
        total_visible_hours = round(visible_count * request.step_hours, 1)
        total_blocked_hours = round((total_steps - visible_count) * request.step_hours, 1)
        
        # Calculate next available communication window
        next_window_start = None
        next_window_hours = None
        if comm_windows:
            if not time_series[0].is_earth_visible:
                # Mission started in blackout: next window is window 1
                next_window_start = comm_windows[0].start_time
                delta_sec = (comm_windows[0].start_time - request.start_date).total_seconds()
                next_window_hours = round(delta_sec / 3600.0, 1)
            elif len(comm_windows) > 1:
                # Mission started in a window: next window is window 2
                next_window_start = comm_windows[1].start_time
                delta_sec = (comm_windows[1].start_time - request.start_date).total_seconds()
                next_window_hours = round(delta_sec / 3600.0, 1)
        
        ephem_source = eph_res.data_source
        terr_source = terrain_horizon.terrain_source if terrain_horizon else "GEOMETRIC HORIZON (NO TERRAIN)"
        dem_res = terrain_horizon.dem_resolution_m if terrain_horizon else None
        calc_status = eph_res.calculation_status
        warning = eph_res.data_quality_warning

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
            num_comm_windows=len(comm_windows),
            comm_windows=comm_windows,
            next_comm_window_start=next_window_start,
            next_comm_window_hours_from_start=next_window_hours,
            link_budget_summary=link_summary,
            ephemeris_source=ephem_source,
            terrain_source=terr_source,
            dem_resolution_m=dem_res,
            calculation_status=calc_status,
            data_quality_warning=warning,
            time_series=time_series
        )


communication_engine = CommunicationEngine()
