import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Award,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  TrendingUp,
  BatteryCharging,
  WifiOff,
} from 'lucide-react';
import { recommendSites } from '../../services/api';
import {
  DEFAULT_MCDA_WEIGHTS,
  DEFAULT_CONSTRAINTS,
  MCDA_WEIGHT_PRESETS,
} from '../../utils/constants';
import LoadingState from '../common/LoadingState';
import ErrorState from '../common/ErrorState';

export default function SiteRecommendation({
  missionConfig,
  onSelectSite,
}) {
  const [weights, setWeights] = useState(DEFAULT_MCDA_WEIGHTS);
  const [constraints, setConstraints] = useState(DEFAULT_CONSTRAINTS);
  const [rankingData, setRankingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCalculateRanking = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await recommendSites({
        start_date: new Date(missionConfig.startDate).toISOString(),
        duration_days: Number(missionConfig.durationDays),
        step_hours: Math.max(3.0, Number(missionConfig.stepHours) * 2), // multi-site compute optimization
        weights,
        constraints,
      });
      setRankingData(res);
    } catch (err) {
      console.error('Failed to run MCDA ranking:', err);
      setError(err.response?.data?.error?.message || err.message || 'MCDA recommendation calculation failed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleCalculateRanking();
  }, [missionConfig.startDate, missionConfig.durationDays]);

  const applyPreset = (presetKey) => {
    const p = MCDA_WEIGHT_PRESETS[presetKey];
    if (p) {
      setWeights(p.weights);
    }
  };

  // Sum of raw weights for normalization display
  const totalWeight =
    (weights.solar_illumination || 0) +
    (weights.earth_communication || 0) +
    (weights.slope_safety || 0) +
    (weights.elevation_advantage || 0) +
    (weights.power_survival || 0) +
    (weights.blackout_risk || 0);

  const getNormPercent = (val) => {
    if (totalWeight <= 0) return 0;
    return Math.round(((val || 0) / totalWeight) * 100);
  };

  // Rank medal colors
  const getRankBadge = (rank) => {
    if (rank === 1) {
      return (
        <span className="flex items-center space-x-1 rounded-full bg-amber-500/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-300 border border-amber-500/40">
          <Award className="h-3.5 w-3.5 text-amber-400" />
          <span>RANK #1</span>
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="flex items-center space-x-1 rounded-full bg-slate-300/20 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-200 border border-slate-300/40">
          <span>RANK #2</span>
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="flex items-center space-x-1 rounded-full bg-amber-700/20 px-2.5 py-0.5 font-mono text-xs font-bold text-amber-500 border border-amber-700/40">
          <span>RANK #3</span>
        </span>
      );
    }
    return <span className="font-mono text-xs font-semibold text-slate-400">RANK #{rank}</span>;
  };

  return (
    <div className="space-y-6">
      {/* 1. MCDA CONFIGURATION CARD */}
      <div className="rounded-2xl border border-luna-800 bg-luna-900/60 p-5 space-y-5 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-luna-800">
          <div>
            <h2 className="font-mono text-sm font-semibold uppercase tracking-wider text-cyan-400 flex items-center space-x-2">
              <Sliders className="h-4 w-4" />
              <span>Multi-Criteria Decision Analysis (MCDA) Scoring Engine</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Weight operational criteria to evaluate and rank candidate landing sites. Weights automatically normalize to 100%.
            </p>
          </div>

          <button
            onClick={handleCalculateRanking}
            disabled={loading}
            className="flex items-center space-x-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3.5 py-1.5 font-mono text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition-all shadow-sm disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{loading ? 'COMPUTING...' : 'RE-CALCULATE RANKINGS'}</span>
          </button>
        </div>

        {/* Preset Strategies */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Mission Strategy Presets:</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MCDA_WEIGHT_PRESETS).map(([k, preset]) => (
              <button
                key={k}
                onClick={() => applyPreset(k)}
                className="rounded-lg border border-luna-800 bg-luna-950 px-2.5 py-1 text-xs font-mono text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* 6 Criteria Weights Sliders */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {/* 1. Solar Sunlight */}
          <div className="rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Solar Sunlight</span>
              <span className="text-amber-400 font-bold">{getNormPercent(weights.solar_illumination)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.solar_illumination}
              onChange={(e) => setWeights({ ...weights, solar_illumination: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>

          {/* 2. Earth Comm (DTE) */}
          <div className="rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Earth Comm (DTE)</span>
              <span className="text-cyan-400 font-bold">{getNormPercent(weights.earth_communication)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.earth_communication}
              onChange={(e) => setWeights({ ...weights, earth_communication: Number(e.target.value) })}
              className="w-full accent-cyan-500"
            />
          </div>

          {/* 3. Slope Safety */}
          <div className="rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Slope Safety</span>
              <span className="text-emerald-400 font-bold">{getNormPercent(weights.slope_safety)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.slope_safety}
              onChange={(e) => setWeights({ ...weights, slope_safety: Number(e.target.value) })}
              className="w-full accent-emerald-500"
            />
          </div>

          {/* 4. Elevation Relief */}
          <div className="rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">Elevation Relief</span>
              <span className="text-purple-400 font-bold">{getNormPercent(weights.elevation_advantage)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.elevation_advantage}
              onChange={(e) => setWeights({ ...weights, elevation_advantage: Number(e.target.value) })}
              className="w-full accent-purple-500"
            />
          </div>

          {/* 5. Power Survival */}
          <div className="rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center space-x-1">
                <BatteryCharging className="h-3 w-3 text-yellow-400" />
                <span>Power Survival</span>
              </span>
              <span className="text-yellow-400 font-bold">{getNormPercent(weights.power_survival)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.power_survival ?? 0}
              onChange={(e) => setWeights({ ...weights, power_survival: Number(e.target.value) })}
              className="w-full accent-yellow-500"
            />
          </div>

          {/* 6. Comm Blackout Risk */}
          <div className="rounded-xl border border-luna-800 bg-luna-950/60 p-3 space-y-1.5">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center space-x-1">
                <WifiOff className="h-3 w-3 text-sky-400" />
                <span>Blackout Resilience</span>
              </span>
              <span className="text-sky-400 font-bold">{getNormPercent(weights.blackout_risk)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.blackout_risk ?? 0}
              onChange={(e) => setWeights({ ...weights, blackout_risk: Number(e.target.value) })}
              className="w-full accent-sky-500"
            />
          </div>
        </div>

        {/* Operational Constraint Cutoffs */}
        <div className="pt-3 border-t border-luna-800/80 space-y-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase">Operational Constraint Limits:</span>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
            <div>
              <label className="text-slate-500 block text-[10px]">Min Illumination (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={constraints.min_illumination_percentage}
                onChange={(e) => setConstraints({ ...constraints, min_illumination_percentage: Number(e.target.value) })}
                className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-500 block text-[10px]">Min Earth Comm (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={constraints.min_communication_percentage}
                onChange={(e) => setConstraints({ ...constraints, min_communication_percentage: Number(e.target.value) })}
                className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-500 block text-[10px]">Max Slope Angle (°)</label>
              <input
                type="number"
                min="1"
                max="30"
                value={constraints.max_acceptable_slope_degrees}
                onChange={(e) => setConstraints({ ...constraints, max_acceptable_slope_degrees: Number(e.target.value) })}
                className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-500 block text-[10px]">Max Shadow Hours</label>
              <input
                type="number"
                min="0"
                max="300"
                value={constraints.max_continuous_shadow_hours}
                onChange={(e) => setConstraints({ ...constraints, max_continuous_shadow_hours: Number(e.target.value) })}
                className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-500 block text-[10px]">Min Battery SoC (%)</label>
              <input
                type="number"
                min="0"
                max="80"
                value={constraints.min_battery_soc_percent ?? 20}
                onChange={(e) => setConstraints({ ...constraints, min_battery_soc_percent: Number(e.target.value) })}
                className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
              />
            </div>
            <div>
              <label className="text-slate-500 block text-[10px]">Max Comm Blackout (h)</label>
              <input
                type="number"
                min="0"
                max="200"
                value={constraints.max_comm_blackout_hours ?? 48}
                onChange={(e) => setConstraints({ ...constraints, max_comm_blackout_hours: Number(e.target.value) })}
                className="w-full rounded bg-luna-950 border border-luna-700 px-2 py-1 text-slate-200"
              />
            </div>
          </div>
        </div>
      </div>

      {loading && <LoadingState title="Computing Multi-Attribute Site Scoring..." subtitle="Evaluating normalization functions across solar flux, DTE availability, surface slopes, topographic elevation, power storage, and blackout risk." />}

      {error && <ErrorState title="MCDA Ranking Error" message={error} onRetry={handleCalculateRanking} />}

      {/* 2. RANKED LEADERBOARD */}
      {!loading && !error && rankingData && rankingData.ranking && (
        <div className="space-y-4">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-slate-300">
            Compliant Candidate Sites Leaderboard ({rankingData.ranking.length})
          </h3>

          {rankingData.ranking.length === 0 ? (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 text-center text-xs font-mono text-amber-300 space-y-1">
              <div className="font-bold uppercase">No Candidate Sites Met All Hard Constraints</div>
              <p className="text-amber-200/80">
                All candidate sites were disqualified based on current operational constraint thresholds. Relax the constraint limits above or review the Disqualified Candidates list below.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rankingData.ranking.map((item) => (
                <div
                  key={item.site_id}
                  onClick={() => onSelectSite && onSelectSite(item.site_id)}
                  className="group rounded-2xl border border-luna-800 bg-luna-900/60 p-4 transition-all hover:border-cyan-500/50 hover:bg-luna-850/60 cursor-pointer shadow-md"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3">
                      {getRankBadge(item.rank)}
                      <div>
                        <h4 className="font-mono text-base font-bold text-white group-hover:text-cyan-300 transition-colors">
                          {item.name}
                        </h4>
                        <p className="text-xs text-slate-400 mt-0.5 max-w-2xl font-sans">
                          {item.explanation}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 self-end md:self-center font-mono">
                      <div className="text-right">
                        <span className="text-[10px] uppercase text-slate-500 block">Total Score</span>
                        <span className="text-2xl font-black text-amber-300">{item.total_score}</span>
                      </div>
                    </div>
                  </div>

                  {/* Score Breakdown Bars (6 Criteria) */}
                  {item.scores_breakdown && (
                    <div className="mt-3 pt-3 border-t border-luna-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs font-mono">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Solar</span>
                          <span className="text-amber-400">{item.scores_breakdown.solar_illumination}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-luna-950 overflow-hidden">
                          <div
                            className="h-full bg-amber-400 rounded-full"
                            style={{ width: `${Math.min(100, item.scores_breakdown.solar_illumination)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Earth Comm</span>
                          <span className="text-cyan-400">{item.scores_breakdown.earth_communication}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-luna-950 overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full"
                            style={{ width: `${Math.min(100, item.scores_breakdown.earth_communication)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Slope Safety</span>
                          <span className="text-emerald-400">{item.scores_breakdown.slope_safety}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-luna-950 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${Math.min(100, item.scores_breakdown.slope_safety)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Elevation</span>
                          <span className="text-purple-400">{item.scores_breakdown.elevation_advantage}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-luna-950 overflow-hidden">
                          <div
                            className="h-full bg-purple-400 rounded-full"
                            style={{ width: `${Math.min(100, item.scores_breakdown.elevation_advantage)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Power Survival</span>
                          <span className="text-yellow-400">{item.scores_breakdown.power_survival ?? 100}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-luna-950 overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 rounded-full"
                            style={{ width: `${Math.min(100, item.scores_breakdown.power_survival ?? 100)}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span className="text-slate-400">Blackout Risk</span>
                          <span className="text-sky-400">{item.scores_breakdown.blackout_risk ?? 100}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-luna-950 overflow-hidden">
                          <div
                            className="h-full bg-sky-400 rounded-full"
                            style={{ width: `${Math.min(100, item.scores_breakdown.blackout_risk ?? 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. DISQUALIFIED SITES (IF CONSTRAINTS VIOLATED) */}
      {!loading && !error && rankingData && rankingData.disqualified_sites && rankingData.disqualified_sites.length > 0 && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5 space-y-3">
          <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-rose-400 flex items-center space-x-1.5">
            <ShieldAlert className="h-4 w-4" />
            <span>Disqualified Landing Candidates ({rankingData.disqualified_sites.length})</span>
          </h3>

          <div className="space-y-2">
            {rankingData.disqualified_sites.map((disq) => (
              <div
                key={disq.site_id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-rose-500/20 bg-luna-950/60 p-3 text-xs"
              >
                <span className="font-mono font-bold text-slate-200">{disq.name}</span>
                <div className="flex flex-wrap gap-1 mt-1 sm:mt-0">
                  {disq.violations.map((v, i) => (
                    <span
                      key={i}
                      className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-[11px] text-rose-300"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
