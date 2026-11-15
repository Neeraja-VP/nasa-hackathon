"""
LUNA NAVIGATOR — Mission Energy Simulation Engine (Member 4 Ownership)
Simulates lander / rover Electrical Power System (EPS), solar array generation, and battery State-of-Charge (SoC).
Grounds all calculations in topocentric solar flux, incidence angle physics, and LOLA terrain ray-traced shadows.
"""

import math
from typing import List, Dict, Any, Optional
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
    Supports azimuth-tracking vertical towers, fixed arrays, horizontal decks, and tilted panels
    with full 3D vector incidence angle physics and battery C-rate limitations.
    """

    @staticmethod
    def calculate_solar_incidence(
        sun_el_deg: float,
        sun_az_deg: float,
        tracking_type: str,
        panel_tilt_deg: Optional[float] = None,
        panel_azimuth_deg: Optional[float] = None
    ) -> tuple[float, float]:
        """
        Calculates the angle of incidence between the solar vector and solar panel surface normal.
        
        Panel tilt beta: angle from horizontal (0° = flat horizontal, 90° = vertical mast).
        Panel azimuth alpha: surface normal compass heading (0° North, 90° East, 180° South, 270° West).
        
        Returns:
            (cos_incidence, incidence_angle_deg)
        """
        sun_el_rad = math.radians(sun_el_deg)
        sun_az_rad = math.radians(sun_az_deg)

        if tracking_type == "VERTICAL_AZIMUTH_TRACKING":
            # Panel is vertical (tilt 90°) and continuously tracks sun azimuth (alpha = sun_az)
            # Incidence angle equals the solar elevation angle relative to horizontal
            cos_inc = max(0.0, math.cos(sun_el_rad))
        elif tracking_type == "HORIZONTAL_FLAT":
            # Panel laid flat on top deck (tilt 0°). Normal points to zenith.
            cos_inc = max(0.0, math.sin(sun_el_rad))
        elif tracking_type == "TILTED_OPTIMAL":
            # Polar optimized array: tilted 80° from horizontal (10° from vertical) facing equator (azimuth 0°)
            tilt_rad = math.radians(80.0)
            az_rad = math.radians(0.0)
            cos_inc = max(0.0, math.sin(sun_el_rad) * math.cos(tilt_rad) +
                               math.cos(sun_el_rad) * math.sin(tilt_rad) * math.cos(sun_az_rad - az_rad))
        elif tracking_type == "CUSTOM_ORIENTED" or panel_tilt_deg is not None or panel_azimuth_deg is not None:
            tilt = 90.0 if panel_tilt_deg is None else panel_tilt_deg
            azimuth = 0.0 if panel_azimuth_deg is None else panel_azimuth_deg
            tilt_rad = math.radians(tilt)
            az_rad = math.radians(azimuth)
            cos_inc = max(0.0, math.sin(sun_el_rad) * math.cos(tilt_rad) +
                               math.cos(sun_el_rad) * math.sin(tilt_rad) * math.cos(sun_az_rad - az_rad))
        else:  # FIXED_VERTICAL facing South Pole mean meridian (0° Azimuth)
            tilt_rad = math.radians(90.0)
            az_rad = math.radians(0.0)
            cos_inc = max(0.0, math.cos(sun_el_rad) * math.cos(sun_az_rad - az_rad))

        clamped_cos = min(1.0, max(0.0, cos_inc))
        inc_angle_deg = round(math.degrees(math.acos(min(1.0, clamped_cos))), 2)
        return round(clamped_cos, 4), inc_angle_deg

    def simulate_mission_power(self, request: SimulationRequest) -> SimulationResponse:
        from app.services.geospatial.dem_loader import dem_loader

        site = get_site_by_id(request.site_id)
        if site:
            lat = site.latitude
            lon = site.longitude
            elev = site.elevation_m
        elif request.latitude is not None and request.longitude is not None:
            lat = request.latitude
            lon = request.longitude % 360.0
            elev = request.elevation_m if request.elevation_m is not None else dem_loader.sample_elevation(lat, lon)
        else:
            raise ValueError(f"Candidate site '{request.site_id}' not found and custom coordinates not provided.")

        # 1. Calculate illumination timeline using verified ephemeris and terrain engines
        mast_height = getattr(request, "mast_height_m", 2.0)
        illum_req = IlluminationRequest(
            latitude=lat,
            longitude=lon,
            elevation_m=elev,
            mast_height_m=mast_height,
            start_date=request.start_date,
            duration_days=request.duration_days,
            step_hours=request.step_hours
        )
        illum_res = illumination_engine.calculate_illumination(illum_req)

        # 2. Battery & Power state initialization
        battery_capacity_wh = request.battery_capacity_wh
        current_stored_wh = battery_capacity_wh * (request.initial_battery_soc_percent / 100.0)
        min_soc = (current_stored_wh / battery_capacity_wh) * 100.0
        max_soc = min_soc
        battery_depleted = False
        is_below_safe_soc = min_soc < request.min_safe_soc_percent
        first_depletion_hour: Optional[float] = None

        total_gen_wh = 0.0
        total_load_wh = 0.0
        peak_gen_w = 0.0

        current_discharge_hours = 0.0
        max_discharge_hours = 0.0
        current_darkness_hours = 0.0
        max_darkness_hours = 0.0

        charge_eff = getattr(request, "charging_efficiency", 0.95)
        discharge_eff = getattr(request, "discharging_efficiency", 0.95)
        dust_derate = getattr(request, "dust_degradation_factor", 0.95)
        temp_derate = getattr(request, "temperature_derate_factor", 0.92)
        max_charge_c = getattr(request, "max_charge_c_rate", 0.5)
        max_discharge_c = getattr(request, "max_discharge_c_rate", 1.0)

        max_charge_power_w = battery_capacity_wh * max_charge_c
        max_discharge_power_w = battery_capacity_wh * max_discharge_c

        time_series: List[PowerPoint] = []
        dt_hours = request.step_hours

        for idx, pt in enumerate(illum_res.time_series):
            is_sunlit = pt.is_sunlit_terrain
            sun_el = pt.sun_elevation_deg
            sun_az = pt.sun_azimuth_deg
            met_hours = idx * dt_hours

            # Track continuous darkness runs
            if not is_sunlit:
                current_darkness_hours += dt_hours
                if current_darkness_hours > max_darkness_hours:
                    max_darkness_hours = current_darkness_hours
            else:
                current_darkness_hours = 0.0

            # 3. Physically rigorous solar generation modeling
            cos_inc, inc_angle_deg = self.calculate_solar_incidence(
                sun_el_deg=sun_el,
                sun_az_deg=sun_az,
                tracking_type=request.solar_tracking_type,
                panel_tilt_deg=request.panel_tilt_deg,
                panel_azimuth_deg=request.panel_azimuth_deg
            )

            if is_sunlit and sun_el > 0.0 and cos_inc > 0.0:
                # P = S0 * Area * Efficiency * cos(incidence) * dust_factor * temp_factor
                p_gen = (
                    SOLAR_CONSTANT_1AU_W_M2
                    * request.solar_array_area_m2
                    * request.solar_efficiency
                    * cos_inc
                    * dust_derate
                    * temp_derate
                )
            else:
                p_gen = 0.0

            if p_gen > peak_gen_w:
                peak_gen_w = p_gen

            # 4. Electrical load modeling: active daytime payloads vs nighttime thermal heating
            if is_sunlit:
                p_load = request.base_hotel_load_w + request.payload_active_load_w
            else:
                p_load = request.base_hotel_load_w + request.survival_heater_load_w

            net_power = p_gen - p_load
            total_gen_wh += p_gen * dt_hours
            total_load_wh += p_load * dt_hours

            # 5. Battery Charging / Discharging with C-Rate Limits and Conversion Efficiencies
            bat_charge_w = 0.0
            bat_discharge_w = 0.0

            if net_power >= 0.0:
                # Power surplus: charge battery up to C-rate limit
                allowable_charge_w = min(net_power, max_charge_power_w)
                delta_wh = allowable_charge_w * dt_hours * charge_eff
                current_stored_wh = min(battery_capacity_wh, current_stored_wh + delta_wh)
                bat_charge_w = allowable_charge_w
                current_discharge_hours = 0.0
            else:
                # Power deficit: discharge battery up to C-rate limit
                needed_w = abs(net_power)
                allowable_discharge_w = min(needed_w, max_discharge_power_w)
                delta_wh = (allowable_discharge_w * dt_hours) / discharge_eff
                current_stored_wh = max(0.0, current_stored_wh - delta_wh)
                bat_discharge_w = allowable_discharge_w
                current_discharge_hours += dt_hours
                if current_discharge_hours > max_discharge_hours:
                    max_discharge_hours = current_discharge_hours

            soc = round((current_stored_wh / battery_capacity_wh) * 100.0, 1)
            if soc < min_soc:
                min_soc = soc
            if soc > max_soc:
                max_soc = soc

            if soc < request.min_safe_soc_percent:
                is_below_safe_soc = True

            if soc <= 0.0:
                battery_depleted = True
                if first_depletion_hour is None:
                    first_depletion_hour = met_hours

            time_series.append(PowerPoint(
                timestamp=pt.timestamp,
                sun_elevation_deg=round(sun_el, 2),
                sun_azimuth_deg=round(sun_az, 2),
                solar_incidence_angle_deg=inc_angle_deg,
                cos_incidence=cos_inc,
                is_sunlit=is_sunlit,
                solar_generation_w=round(p_gen, 1),
                total_load_w=round(p_load, 1),
                net_power_w=round(net_power, 1),
                battery_charge_w=round(bat_charge_w, 1),
                battery_discharge_w=round(bat_discharge_w, 1),
                battery_soc_percent=soc,
                battery_stored_wh=round(current_stored_wh, 1),
                is_deficit=(net_power < 0.0),
                is_below_safe_soc=(soc < request.min_safe_soc_percent)
            ))

        total_mission_hours = request.duration_days * 24.0
        avg_gen_w = (total_gen_wh / total_mission_hours) if total_mission_hours > 0 else 0.0
        survival_margin = max(0.0, min_soc - request.min_safe_soc_percent)

        # 6. Health status determination & Shortage Warnings
        if battery_depleted:
            eps_status = "CRITICAL_DEPLETION"
            warning = (
                f"CRITICAL POWER DEPLETION: Battery storage exhausted at MET +{first_depletion_hour:.1f}h. "
                f"Continuous shadow ({max_darkness_hours:.1f}h) exceeds electrical storage capacity."
            )
        elif is_below_safe_soc:
            eps_status = "DEGRADED_MARGIN"
            warning = (
                f"POWER SHORTAGE WARNING: Minimum battery State of Charge falls to {min_soc:.1f}%, "
                f"breaching configured safe cutoff limit of {request.min_safe_soc_percent:.1f}%."
            )
        elif survival_margin < 15.0:
            eps_status = "DEGRADED_MARGIN"
            warning = f"CAUTION: Low battery reserve margin (+{survival_margin:.1f}% above DoD limit)."
        else:
            eps_status = "NOMINAL"
            warning = None

        current_soc = time_series[-1].battery_soc_percent if time_series else request.initial_battery_soc_percent

        model_assumptions = {
            "solar_constant_w_m2": SOLAR_CONSTANT_1AU_W_M2,
            "dust_obscuration_derate": dust_derate,
            "temperature_efficiency_derate": temp_derate,
            "charging_efficiency": charge_eff,
            "discharging_efficiency": discharge_eff,
            "max_charge_c_rate": max_charge_c,
            "max_discharge_c_rate": max_discharge_c,
            "thermal_regime_model": "Isothermal insulated cell bay (cryogenic derating requires radioisotope heating unit qualification)"
        }

        return SimulationResponse(
            site_id=request.site_id,
            mission_duration_hours=total_mission_hours,
            min_battery_soc_percent=round(min_soc, 1),
            max_battery_soc_percent=round(max_soc, 1),
            current_battery_soc_percent=current_soc,
            battery_depleted=battery_depleted,
            is_below_safe_soc=is_below_safe_soc,
            total_energy_generated_kwh=round(total_gen_wh / 1000.0, 2),
            total_energy_consumed_kwh=round(total_load_wh / 1000.0, 2),
            net_energy_balance_kwh=round((total_gen_wh - total_load_wh) / 1000.0, 2),
            peak_solar_generation_w=round(peak_gen_w, 1),
            average_solar_generation_w=round(avg_gen_w, 1),
            max_continuous_discharge_hours=round(max_discharge_hours, 1),
            max_continuous_darkness_hours=round(max_darkness_hours, 1),
            estimated_survival_duration_hours=first_depletion_hour,
            battery_survival_margin_percent=round(survival_margin, 1),
            eps_health_status=eps_status,
            shortage_warning=warning,
            model_assumptions=model_assumptions,
            time_series=time_series
        )


simulation_engine = SimulationEngine()
