"""
LUNA NAVIGATOR — Mission Energy Simulation Engine (Member 4 Ownership)
Simulates lander / rover Electrical Power System (EPS), solar array generation, and battery State-of-Charge (SoC).
Grounds all calculations in topocentric solar flux and LOLA terrain ray-traced shadows.
"""

import math
from typing import List
from app.core.constants import SOLAR_CONSTANT_1AU_W_M2
from app.core.sites_catalog import get_site_by_id
from app.engines.illumination.engine import illumination_engine
from app.schemas.illumination import IlluminationRequest
from app.schemas.simulation import (
    SimulationRequest,
    PowerPoint,
    SimulationResponse
)


class SimulationEngine:
    """
    Models solar power generation, battery charge/discharge cycles, and thermal heater power draw.
    Supports azimuth-tracking vertical towers, fixed arrays, horizontal decks, and tilted panels.
    """
    
    def simulate_mission_power(self, request: SimulationRequest) -> SimulationResponse:
        site = get_site_by_id(request.site_id)
        if not site:
            raise ValueError(f"Candidate site '{request.site_id}' not found.")
            
        # 1. Calculate illumination timeline using verified ephemeris and terrain engines
        illum_req = IlluminationRequest(
            latitude=site.latitude,
            longitude=site.longitude,
            elevation_m=site.elevation_m,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours
        )
        illum_res = illumination_engine.calculate_illumination(illum_req)
        
        # 2. Battery & Power state initialization
        battery_capacity_wh = request.battery_capacity_wh
        current_stored_wh = battery_capacity_wh * (request.initial_battery_soc_percent / 100.0)
        min_soc = 100.0
        max_soc = request.initial_battery_soc_percent
        battery_depleted = False
        
        total_gen_wh = 0.0
        total_load_wh = 0.0
        peak_gen_w = 0.0
        
        current_discharge_hours = 0.0
        max_discharge_hours = 0.0
        
        charge_eff = 0.95
        discharge_eff = 0.95
        
        time_series: List[PowerPoint] = []
        
        for pt in illum_res.time_series:
            is_sunlit = pt.is_sunlit_terrain
            sun_el = pt.sun_elevation_deg
            sun_az = pt.sun_azimuth_deg
            
            # Solar generation modeling based on orientation geometry
            if is_sunlit and sun_el > 0.0:
                rad_el = math.radians(sun_el)
                rad_az = math.radians(sun_az)
                
                if request.solar_tracking_type == "VERTICAL_AZIMUTH_TRACKING":
                    # Vertical cylindrical or azimuth-steered array
                    # Normal vector is horizontal (elevation 0°); angle to Sun is elevation angle
                    cos_inc = math.cos(rad_el)
                elif request.solar_tracking_type == "HORIZONTAL_FLAT":
                    # Array laid flat on lander top deck
                    # Normal vector is zenith (elevation 90°); angle to Sun is zenith angle
                    cos_inc = math.sin(rad_el)
                elif request.solar_tracking_type == "TILTED_OPTIMAL":
                    # Tilted array at 80° from horizontal (10° from vertical)
                    cos_inc = math.cos(math.radians(max(0.0, 10.0 - sun_el)))
                else:  # FIXED_VERTICAL facing South Pole mean meridian (0° Azimuth)
                    cos_inc = max(0.0, math.cos(rad_el) * math.cos(rad_az))
                    
                p_gen = SOLAR_CONSTANT_1AU_W_M2 * request.solar_array_area_m2 * request.solar_efficiency * max(0.0, cos_inc)
            else:
                p_gen = 0.0
                
            if p_gen > peak_gen_w:
                peak_gen_w = p_gen
                
            # Electrical load modeling: active daytime payloads vs survival heating in shadow
            if is_sunlit:
                p_load = request.base_hotel_load_w + request.payload_active_load_w
            else:
                p_load = request.base_hotel_load_w + request.survival_heater_load_w
                
            net_power = p_gen - p_load
            dt_hours = request.step_hours
            
            # Energy balance accounting
            total_gen_wh += p_gen * dt_hours
            total_load_wh += p_load * dt_hours
            
            if net_power >= 0:
                # Surplus generation: battery charging
                delta_wh = net_power * dt_hours * charge_eff
                current_stored_wh = min(battery_capacity_wh, current_stored_wh + delta_wh)
                current_discharge_hours = 0.0
            else:
                # Power deficit: battery discharging
                delta_wh = abs(net_power) * dt_hours / discharge_eff
                current_stored_wh = max(0.0, current_stored_wh - delta_wh)
                current_discharge_hours += dt_hours
                if current_discharge_hours > max_discharge_hours:
                    max_discharge_hours = current_discharge_hours
                
            soc = (current_stored_wh / battery_capacity_wh) * 100.0
            if soc < min_soc:
                min_soc = soc
            if soc > max_soc:
                max_soc = soc
            if soc < request.min_safe_soc_percent:
                battery_depleted = True
                
            time_series.append(PowerPoint(
                timestamp=pt.timestamp,
                sun_elevation_deg=sun_el,
                is_sunlit=is_sunlit,
                solar_generation_w=round(p_gen, 1),
                total_load_w=round(p_load, 1),
                net_power_w=round(net_power, 1),
                battery_soc_percent=round(soc, 1),
                battery_stored_wh=round(current_stored_wh, 1),
                is_deficit=(net_power < 0)
            ))
            
        total_mission_hours = request.duration_days * 24.0
        avg_gen_w = (total_gen_wh / total_mission_hours) if total_mission_hours > 0 else 0.0
        survival_margin = max(0.0, min_soc - request.min_safe_soc_percent)
        
        # Health status determination
        if battery_depleted:
            eps_status = "CRITICAL_DEPLETION"
        elif survival_margin < 15.0:
            eps_status = "DEGRADED_MARGIN"
        else:
            eps_status = "NOMINAL"
            
        return SimulationResponse(
            site_id=request.site_id,
            mission_duration_hours=total_mission_hours,
            min_battery_soc_percent=round(min_soc, 1),
            max_battery_soc_percent=round(max_soc, 1),
            battery_depleted=battery_depleted,
            total_energy_generated_kwh=round(total_gen_wh / 1000.0, 2),
            total_energy_consumed_kwh=round(total_load_wh / 1000.0, 2),
            net_energy_balance_kwh=round((total_gen_wh - total_load_wh) / 1000.0, 2),
            peak_solar_generation_w=round(peak_gen_w, 1),
            average_solar_generation_w=round(avg_gen_w, 1),
            max_continuous_discharge_hours=round(max_discharge_hours, 1),
            battery_survival_margin_percent=round(survival_margin, 1),
            eps_health_status=eps_status,
            time_series=time_series
        )


simulation_engine = SimulationEngine()
