/**
 * LUNA NAVIGATOR — Scientific Unit & Date Formatters
 */

export function formatDateTime(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return isoString;
  }
}

export function formatDateShort(isoString) {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

export function formatPercent(value, decimals = 1) {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return `${Number(value).toFixed(decimals)}%`;
}

export function formatAngle(deg, decimals = 1) {
  if (deg === null || deg === undefined || isNaN(deg)) return '—';
  return `${Number(deg).toFixed(decimals)}°`;
}

export function formatElevationM(m) {
  if (m === null || m === undefined || isNaN(m)) return '—';
  const val = Number(m);
  return val >= 1000 ? `${(val / 1000).toFixed(2)} km` : `${val.toFixed(0)} m`;
}

export function formatPowerW(w, decimals = 1) {
  if (w === null || w === undefined || isNaN(w)) return '—';
  return `${Number(w).toFixed(decimals)} W`;
}

export function formatEnergyKWh(kwh, decimals = 2) {
  if (kwh === null || kwh === undefined || isNaN(kwh)) return '—';
  return `${Number(kwh).toFixed(decimals)} kWh`;
}

export function formatHours(h, decimals = 1) {
  if (h === null || h === undefined || isNaN(h)) return '—';
  return `${Number(h).toFixed(decimals)} h`;
}

/**
 * Ensures a date string is parsed in UTC without local timezone drift.
 */
export function toUtcIsoString(dateInput) {
  if (!dateInput) return '2026-12-01T00:00:00.000Z';
  if (typeof dateInput === 'string') {
    if (dateInput.endsWith('Z')) {
      const d = new Date(dateInput);
      return isNaN(d.getTime()) ? '2026-12-01T00:00:00.000Z' : d.toISOString();
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateInput)) {
      return `${dateInput}:00.000Z`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateInput)) {
      return `${dateInput}.000Z`;
    }
  }
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? '2026-12-01T00:00:00.000Z' : d.toISOString();
}
