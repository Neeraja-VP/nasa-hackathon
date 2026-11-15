import { useState, useEffect, useRef } from 'react';
import {
  calculateIllumination,
  calculateCommunication,
  getTerrainHorizon,
} from '../services/api';

export function useSiteAnalysis(currentSite, missionConfig) {
  const [illuminationData, setIlluminationData] = useState(null);
  const [communicationData, setCommunicationData] = useState(null);
  const [terrainHorizonData, setTerrainHorizonData] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const activeRequestId = useRef(0);

  useEffect(() => {
    if (!currentSite) return;

    const reqId = ++activeRequestId.current;
    setLoading(true);
    setError(null);

    const payloadBase = {
      latitude: currentSite.latitude,
      longitude: currentSite.longitude,
      elevation_m: currentSite.elevation_m,
      start_date: new Date(missionConfig.startDate).toISOString(),
      duration_days: Number(missionConfig.durationDays),
      step_hours: Number(missionConfig.stepHours),
      use_live_horizons: Boolean(missionConfig.useLiveHorizons),
    };

    async function loadAnalysis() {
      try {
        const [illumRes, commRes, terrRes] = await Promise.allSettled([
          calculateIllumination({
            ...payloadBase,
            use_terrain_horizon: missionConfig.useTerrainHorizon,
            mast_height_m: missionConfig.mastHeightM,
          }),
          calculateCommunication({
            ...payloadBase,
            min_comm_elevation_deg: missionConfig.minCommElevationDeg,
            use_terrain_horizon: missionConfig.useTerrainHorizon,
            antenna_height_m: missionConfig.antennaHeightM || 2.5,
          }),
          getTerrainHorizon({
            latitude: currentSite.latitude,
            longitude: currentSite.longitude,
            elevation_m: currentSite.elevation_m,
            azimuth_step_deg: 5.0,
            observer_height_m: missionConfig.mastHeightM,
          }),
        ]);

        if (reqId !== activeRequestId.current) return;

        let hasError = false;
        let errMsg = '';

        if (illumRes.status === 'fulfilled') {
          setIlluminationData(illumRes.value);
        } else {
          hasError = true;
          errMsg = illumRes.reason?.response?.data?.error?.message || illumRes.reason?.message;
        }

        if (commRes.status === 'fulfilled') {
          setCommunicationData(commRes.value);
        } else {
          console.error('Earth Communication calculation failed:', commRes.reason);
          if (!hasError) {
            hasError = true;
            errMsg = commRes.reason?.response?.data?.error?.message || commRes.reason?.message || 'Earth communication telemetry failed.';
          }
        }

        if (terrRes.status === 'fulfilled') {
          setTerrainHorizonData(terrRes.value);
        }

        if (hasError && !illumRes.value && !commRes.value) {
          setError(errMsg || 'Telemetry calculation failed.');
        }
      } catch (err) {
        if (reqId === activeRequestId.current) {
          setError(err.message || 'Analysis error');
        }
      } finally {
        if (reqId === activeRequestId.current) {
          setLoading(false);
        }
      }
    }

    loadAnalysis();
  }, [
    currentSite?.id,
    missionConfig.startDate,
    missionConfig.durationDays,
    missionConfig.stepHours,
    missionConfig.useTerrainHorizon,
    missionConfig.mastHeightM,
    missionConfig.minCommElevationDeg,
    missionConfig.antennaHeightM,
    missionConfig.useLiveHorizons,
  ]);

  return {
    illuminationData,
    communicationData,
    terrainHorizonData,
    loading,
    error,
  };
}
