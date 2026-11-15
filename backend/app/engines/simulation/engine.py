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
        lat = None
        lon = None
        elev = 0.0
        site_id_label = request.site_id or "custom-site"
        
        if request.site_id:
            site = get_site_by_id(request.site_id)
            if site:
                lat = site.latitude
                lon = site.longitude
                elev = site.elevation_m
                site_id_label = site.id
                
        if lat is None:
            if request.latitude is not None and request.longitude is not None:
                lat = request.latitude
                lon = request.longitude
                from app.services.geospatial.dem_loader import dem_loader
                elev = request.elevation_m if request.elevation_m is not None else dem_loader.sample_elevation(lat, lon)
            else:
                raise ValueError("Either valid 'site_id' or 'latitude' and 'longitude' must be provided.")
            
        # 1. Calculate illumination timeline using verified ephemeris and terrain engines
        illum_req = IlluminationRequest(
            latitude=lat,
            longitude=lon,
            elevation_m=elev,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours,
            use_live_horizons=getattr(request, "use_live_horizons", False)
        )
        illum_res = illumination_engine.calculate_illumination(illum_req)
        
        # 2. Battery & Power state initialization
        battery_capacity_wh = request.battery_capacity_wh
        current_stored_wh = battery_capacity_wh * (request.initial_battery_soc_percent / 100.0)
        min_soc = 100.0
        max_soc = request.initial_battery_soc_percent
        battery_depleted = False
        hours_below_safe = 0.0
        first_depletion_hour = None
        
        total_gen_wh = 0.0
        total_load_wh = 0.0
        peak_gen_w = 0.0
        
        current_discharge_hours = 0.0
        max_discharge_hours = 0.0
        current_darkness_hours = 0.0
        max_darkness_hours = 0.0
        
        charge_eff = getattr(request, "charging_efficiency", 0.94)
        discharge_eff = getattr(request, "discharging_efficiency", 0.95)
        dust_factor = getattr(request, "dust_degradation_factor", 0.98)
        wiring_factor = getattr(request, "wiring_loss_factor", 0.97)
        environmental_derate = dust_factor * wiring_factor
        
        # C-rate battery power limitations
        max_charge_p_w = request.max_charge_power_w if request.max_charge_power_w is not None else (1.0 * battery_capacity_wh)
        max_discharge_p_w = request.max_discharge_power_w if request.max_discharge_power_w is not None else (2.0 * battery_capacity_wh)
        
        panel_tilt_deg = getattr(request, "panel_tilt_deg", 90.0)
        panel_az_deg = getattr(request, "panel_azimuth_deg", 0.0)
        
        time_series: List[PowerPoint] = []
        dt_hours = request.step_hours
        
        for idx, pt in enumerate(illum_res.time_series):
            is_sunlit = pt.is_sunlit_terrain
            sun_el = pt.sun_elevation_deg
            sun_az = pt.sun_azimuth_deg
            elapsed_t = idx * dt_hours
            
            # Track darkness run
            if is_sunlit:
                current_darkness_hours = 0.0
            else:
                current_darkness_hours += dt_hours
                if current_darkness_hours > max_darkness_hours:
                    max_darkness_hours = current_darkness_hours
            
            # Solar generation modeling based on 3D orientation & incidence geometry
            cos_inc = 0.0
            inc_angle_deg = 90.0
            
            if is_sunlit and sun_el > -0.267:
                rad_el = math.radians(max(0.0, sun_el))
                rad_az = math.radians(sun_az)
                
                if request.solar_tracking_type == "DUAL_AXIS_TRACKING":
                    # Fully articulated gimbal pointing directly at Sun
                    cos_inc = 1.0
                    inc_angle_deg = 0.0
                elif request.solar_tracking_type == "VERTICAL_AZIMUTH_TRACKING":
                    # Vertical panel steered continuously in azimuth (normal at elevation 0°)
                    # cos(theta_inc) = cos(el)
                    cos_inc = math.cos(rad_el)
                    inc_angle_deg = max(0.0, math.degrees(math.acos(min(1.0, max(0.0, cos_inc)))))
                elif request.solar_tracking_type == "HORIZONTAL_FLAT":
                    # Panel mounted flat on horizontal rover / lander deck (normal at zenith 90°)
                    # cos(theta_inc) = sin(el)
                    cos_inc = math.sin(rad_el)
                    inc_angle_deg = max(0.0, math.degrees(math.acos(min(1.0, max(0.0, cos_inc)))))
                elif request.solar_tracking_type == "TILTED_OPTIMAL":
                    # Steered in azimuth with optimal 80° tilt from horizontal (10° from vertical)
                    # cos(theta_inc) = cos(el - 10°)
                    cos_inc = math.cos(math.radians(max(0.0, 10.0 - sun_el)))
                    inc_angle_deg = abs(10.0 - sun_el)
                elif request.solar_tracking_type == "TILTED_FIXED":
                    # Fixed tilt beta and fixed azimuth gamma:
                    # cos(inc) = cos(el)*sin(beta)*cos(az - gamma) + sin(el)*cos(beta)
                    r_beta = math.radians(panel_tilt_deg)
                    r_gamma = math.radians(panel_az_deg)
                    cos_val = math.cos(rad_el) * math.sin(r_beta) * math.cos(rad_az - r_gamma) + math.sin(rad_el) * math.cos(r_beta)
                    cos_inc = max(0.0, cos_val)
                    inc_angle_deg = math.degrees(math.acos(min(1.0, max(0.0, cos_inc))))
                else:
                    # FIXED_VERTICAL (default facing North toward mean equator, az=0°)
                    r_gamma = math.radians(panel_az_deg)
                    cos_val = math.cos(rad_el) * math.cos(rad_az - r_gamma)
                    cos_inc = max(0.0, cos_val)
                    inc_angle_deg = math.degrees(math.acos(min(1.0, max(0.0, cos_inc))))
                    
                p_gen = (
                    SOLAR_CONSTANT_1AU_W_M2 *
                    request.solar_array_area_m2 *
                    request.solar_efficiency *
                    cos_inc *
                    environmental_derate
                )
            else:
                p_gen = 0.0
                inc_angle_deg = 90.0
                
            if p_gen > peak_gen_w:
                peak_gen_w = p_gen
                
            # Electrical load modeling: active daytime payloads vs survival heating in shadow
            if is_sunlit:
                p_load = request.base_hotel_load_w + request.payload_active_load_w
            else:
                p_load = request.base_hotel_load_w + request.survival_heater_load_w
                
            net_power = p_gen - p_load
            curtailed_w = 0.0
            
            # Energy balance accounting with C-rate constraints
            total_gen_wh += p_gen * dt_hours
            total_load_wh += p_load * dt_hours
            
            if net_power >= 0:
                # Surplus generation: battery charging
                usable_charge_p = min(net_power, max_charge_p_w)
                curtailed_w = net_power - usable_charge_p
                
                delta_wh = usable_charge_p * dt_hours * charge_eff
                new_stored_wh = current_stored_wh + delta_wh
                if new_stored_wh > battery_capacity_wh:
                    curtailed_w += (new_stored_wh - battery_capacity_wh) / (dt_hours * charge_eff)
                    current_stored_wh = battery_capacity_wh
                else:
                    current_stored_wh = new_stored_wh
                    
                current_discharge_hours = 0.0
            else:
                # Power deficit: battery discharging
                p_discharge_req = abs(net_power)
                actual_discharge_p = min(p_discharge_req, max_discharge_p_w)
                delta_wh = actual_discharge_p * dt_hours / discharge_eff
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
                hours_below_safe += dt_hours
                if first_depletion_hour is None:
                    first_depletion_hour = elapsed_t
                
            time_series.append(PowerPoint(
                timestamp=pt.timestamp,
                sun_elevation_deg=round(sun_el, 2),
                is_sunlit=is_sunlit,
                solar_incidence_angle_deg=round(inc_angle_deg, 1),
                solar_generation_w=round(p_gen, 1),
                total_load_w=round(p_load, 1),
                net_power_w=round(net_power, 1),
                battery_soc_percent=round(soc, 1),
                battery_stored_wh=round(current_stored_wh, 1),
                curtailed_power_w=round(curtailed_w, 1),
                is_deficit=(net_power < 0)
            ))
            
        total_mission_hours = request.duration_days * 24.0
        avg_gen_w = (total_gen_wh / total_mission_hours) if total_mission_hours > 0 else 0.0
        survival_margin = max(0.0, min_soc - request.min_safe_soc_percent)
        
        # Estimated survival duration
        estimated_survival = first_depletion_hour if first_depletion_hour is not None else total_mission_hours
        
        # Generate engineering power warnings
        warnings: List[str] = []
        if battery_depleted:
            warnings.append(
                f"CRITICAL POWER DEFICIT: Battery state of charge fell to {min_soc:.1f}% at T+{first_depletion_hour:.1f}h, "
                f"violating the configured {request.min_safe_soc_percent:.1f}% minimum safe DoD threshold."
            )
            eps_status = "CRITICAL_DEPLETION"
        elif survival_margin < 15.0:
            warnings.append(
                f"DEGRADED POWER MARGIN: Minimum battery SoC reached {min_soc:.1f}% (safety margin of only {survival_margin:.1f}% above cutoff)."
            )
            eps_status = "DEGRADED_MARGIN"
        else:
            warnings.append(
                f"NOMINAL POWER SYSTEM: Battery remained healthy throughout {total_mission_hours:.0f}h mission with a minimum SoC of {min_soc:.1f}% (+{survival_margin:.1f}% reserve margin)."
            )
            eps_status = "NOMINAL"
            
        if max_darkness_hours > 48.0:
            warnings.append(
                f"EXTENDED TOPOGRAPHIC SHADOW: Longest continuous darkness interval of {max_darkness_hours:.1f}h requires battery operation beyond nominal single-day storage."
            )
            
        if total_gen_wh < total_load_wh:
            warnings.append(
                f"NEGATIVE NET ENERGY BALANCE: Cumulative generation ({total_gen_wh/1000.0:.1f} kWh) is less than consumption ({total_load_wh/1000.0:.1f} kWh). Mission relies on initial stored battery reserves."
            )
            
        return SimulationResponse(
            site_id=site_id_label,
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
            max_continuous_darkness_hours=round(max_darkness_hours, 1),
            battery_survival_margin_percent=round(survival_margin, 1),
            estimated_survival_duration_hours=round(estimated_survival, 1),
            hours_below_safe_soc=round(hours_below_safe, 1),
            power_shortage_warnings=warnings,
            eps_health_status=eps_status,
            ephemeris_source=illum_res.ephemeris_source,
            terrain_source=illum_res.terrain_source,
            dem_resolution_m=illum_res.dem_resolution_m,
            calculation_status=illum_res.calculation_status,
            data_quality_warning=illum_res.data_quality_warning,
            time_series=time_series
        )


simulation_engine = SimulationEngine()
