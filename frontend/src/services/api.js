/**
 * LUNA NAVIGATOR — Frontend API Service Client (Member 1 Integration)
 * Matches shared REST contracts in docs/api-contracts.md
 */

import axios from 'axios';

const API_BASE = '/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Helper to format API error messages
export function getErrorMessage(error) {
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  if (error.response?.data?.detail) {
    if (typeof error.response.data.detail === 'string') {
      return error.response.data.detail;
    }
    return JSON.stringify(error.response.data.detail);
  }
  if (error.message) {
    return error.message;
  }
  return 'Unknown network or calculation error occurred.';
}

// 1. Candidate Sites Catalog
export const getSites = async () => {
  const response = await apiClient.get('/sites');
  return response.data;
};

export const getSite = async (siteId) => {
  const response = await apiClient.get(`/sites/${siteId}`);
  return response.data;
};

// 2. Ephemeris Engine
export const calculateEphemeris = async (params) => {
  const response = await apiClient.post('/ephemeris', params);
  return response.data;
};

// 3. Terrain Horizon Engine
export const getTerrainHorizon = async (params) => {
  const response = await apiClient.post('/terrain/horizon', params);
  return response.data;
};

// 4. Solar Illumination Engine
export const calculateIllumination = async (params) => {
  const response = await apiClient.post('/illumination', params);
  return response.data;
};

// 5. Earth Communication Engine
export const calculateCommunication = async (params) => {
  const response = await apiClient.post('/communication', params);
  return response.data;
};

// 6. Site Comparison
export const compareSites = async (params) => {
  const response = await apiClient.post('/compare', params);
  return response.data;
};

// 7. Site Recommendation & MCDA
export const recommendSites = async (params) => {
  const response = await apiClient.post('/recommend', params);
  return response.data;
};

// 8. Mission Energy Simulation
export const simulateMission = async (params) => {
  const response = await apiClient.post('/simulate', params);
  return response.data;
};

// 9. AI Mission Assistant (Member 4 Integration)
export const queryAssistant = async (params) => {
  const response = await apiClient.post('/assistant', params);
  return response.data;
};

// Health Check
export const checkHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};
