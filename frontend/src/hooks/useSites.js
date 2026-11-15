import { useState, useEffect, useCallback } from 'react';
import { getSites, checkHealth } from '../services/api';

export function useSites() {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    setError(null);

    // First check health
    try {
      const health = await checkHealth();
      if (health.status === 'HEALTHY') {
        setApiOnline(true);
      }
    } catch {
      setApiOnline(false);
    }

    // Then load candidate sites
    try {
      const data = await getSites();
      if (Array.isArray(data) && data.length > 0) {
        setSites(data);
        setSelectedSiteId((prev) => prev || data[0].id);
        setApiOnline(true);
      } else {
        throw new Error('Candidate sites catalog returned empty list.');
      }
    } catch (err) {
      console.error('Failed to load candidate landing sites:', err);
      setError(err.response?.data?.error?.message || err.message || 'Failed to connect to Luna Navigator backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  const addCustomSite = useCallback((newSite) => {
    setSites((prev) => [newSite, ...prev.filter((s) => s.id !== newSite.id)]);
    setSelectedSiteId(newSite.id);
  }, []);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) || sites[0] || null;

  return {
    sites,
    selectedSiteId,
    setSelectedSiteId,
    selectedSite,
    loading,
    error,
    apiOnline,
    refetch: fetchSites,
    addCustomSite,
  };
}
