import React from 'react';
import {
  Award,
  Calendar,
  Clock,
  Battery,
  BatteryCharging,
  Sun,
  Radio,
  Zap,
  Copy,
  Trash2,
  Edit3,
  ShieldCheck,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { formatLatitude, formatLongitude } from '../../utils/coordinates';

export default function ScenarioCard({
  scenario,
  result,
  onEdit,
  onDuplicate,
  onDelete,
  canDelete = true,
  isActive = false,
  onSelect,
}) {
  const isEvaluated = !!result;
  const rank = result?.rank || result?.overall_rank;
  const isTopRank = rank === 1;
  const isSecondRank = rank === 2;
  const isThirdRank = rank === 3;
  const survived = result?.power_survival_status === 'SURVIVED';

  // Format landing start date
  let dateFormatted = '2026-12-01';
  try {
    if (scenario.start_date) {
      const d = new Date(scenario.start_date);
      dateFormatted = d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    }
  } catch {
    dateFormatted = String(scenario.start_date);
  }

  const rankBadge = () => {
    if (!rank) return null;
    if (isTopRank) {
      return (
        <span className="flex items-center space-x-1 rounded-full border border-amber-400/60 bg-amber-500/20 px-2.5 py-0.5 text-[11px] font-bold text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.25)]">
          <Award className="h-3 w-3 text-amber-400" />
          <span>RANK #1 (LEADER)</span>
        </span>
      );
    }
    if (isSecondRank) {
      return (
        <span className="flex items-center space-x-1 rounded-full border border-slate-400/50 bg-slate-500/20 px-2 py-0.5 text-[11px] font-medium text-slate-300">
          <span>RANK #2</span>
        </span>
      );
    }
    if (isThirdRank) {
      return (
        <span className="flex items-center space-x-1 rounded-full border border-amber-700/50 bg-amber-800/20 px-2 py-0.5 text-[11px] font-medium text-amber-200">
          <span>RANK #3</span>
        </span>
      );
    }
    return (
      <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] font-mono text-slate-400">
        RANK #{rank}
      </span>
    );
  };

  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-200 p-4 ${
        isActive
          ? 'border-cyan-500/70 bg-luna-900/90 shadow-[0_0_20px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/30'
          : isTopRank
          ? 'border-amber-500/40 bg-luna-900/70 hover:border-amber-400/60 shadow-[0_0_15px_rgba(245,158,11,0.08)]'
          : 'border-luna-800/90 bg-luna-900/60 hover:border-luna-700 hover:bg-luna-850/70'
      }`}
    >
      {/* Top Header: Scenario Name + Rank / Actions */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="truncate font-mono text-sm font-bold text-white group-hover:text-cyan-200">
                {scenario.name || 'Unnamed Scenario'}
              </h3>
            </div>
            <p className="mt-0.5 truncate text-xs text-cyan-400/90 font-medium">
              {scenario.site_name || 'Custom Target'}
            </p>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0">
            {rankBadge()}
            {isEvaluated && (
              <span
                className={`flex items-center space-x-1 rounded px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${
                  survived
                    ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-400'
                    : 'border border-rose-500/40 bg-rose-950/40 text-rose-400 animate-pulse'
                }`}
              >
                {survived ? (
                  <>
                    <ShieldCheck className="h-3 w-3" />
                    <span>SURVIVED</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3" />
                    <span>DEPLETED</span>
                  </>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Location & Mission Epoch Metadata */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-luna-800/80 bg-luna-950/60 p-2.5 text-[11px] font-mono text-slate-300">
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-slate-400">
              <Compass className="h-3 w-3 text-cyan-400" />
              <span>COORDINATES</span>
            </div>
            <div className="font-semibold text-slate-200">
              {formatLatitude(scenario.latitude)}, {formatLongitude(scenario.longitude)}
            </div>
            <div className="text-[10px] text-slate-400">
              Elev: <span className="text-cyan-300 font-semibold">{scenario.elevation_m != null ? `${scenario.elevation_m}m` : 'DEM sampled'}</span>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-slate-400">
              <Calendar className="h-3 w-3 text-amber-400" />
              <span>EPOCH & HORIZON</span>
            </div>
            <div className="font-semibold text-slate-200 truncate" title={dateFormatted}>
              {dateFormatted}
            </div>
            <div className="text-[10px] text-slate-400">
              Duration: <span className="text-amber-300 font-semibold">{scenario.duration_days}d</span> ({scenario.step_hours}h step)
            </div>
          </div>
        </div>

        {/* Hardware Architecture Summary */}
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-slate-400">
          <div className="flex items-center space-x-1">
            <Sun className="h-3 w-3 text-amber-400" />
            <span>Array: <span className="text-slate-200">{scenario.solar_array_area_m2}m²</span></span>
          </div>
          <div className="flex items-center space-x-1">
            <Battery className="h-3 w-3 text-emerald-400" />
            <span>Battery: <span className="text-slate-200">{scenario.battery_capacity_wh}Wh</span></span>
          </div>
        </div>

        {/* Evaluated Metric Highlights */}
        {isEvaluated && (
          <div className="space-y-2 pt-2 border-t border-luna-800/70">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-slate-400">Suitability Score</span>
              <span
                className={`font-mono text-sm font-extrabold ${
                  isTopRank
                    ? 'text-amber-300'
                    : result.overall_suitability_score >= 70
                    ? 'text-emerald-400'
                    : result.overall_suitability_score >= 50
                    ? 'text-cyan-300'
                    : 'text-rose-400'
                }`}
              >
                {result.overall_suitability_score?.toFixed(1)} / 100
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-[10px]">
              <div className="rounded-lg bg-luna-950/80 p-1.5 border border-luna-800/80">
                <div className="text-slate-400 text-[9px] uppercase">Sunlight</div>
                <div className="mt-0.5 font-bold text-amber-300">
                  {result.illumination_percentage?.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg bg-luna-950/80 p-1.5 border border-luna-800/80">
                <div className="text-slate-400 text-[9px] uppercase">Earth Comm</div>
                <div className="mt-0.5 font-bold text-cyan-300">
                  {result.communication_percentage?.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg bg-luna-950/80 p-1.5 border border-luna-800/80">
                <div className="text-slate-400 text-[9px] uppercase">Min SoC</div>
                <div
                  className={`mt-0.5 font-bold ${
                    result.min_battery_soc_percent > 30
                      ? 'text-emerald-300'
                      : result.min_battery_soc_percent > 20
                      ? 'text-amber-300'
                      : 'text-rose-400'
                  }`}
                >
                  {result.min_battery_soc_percent?.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg bg-luna-950/80 p-1.5 border border-luna-800/80">
                <div className="text-slate-400 text-[9px] uppercase">Solar Energy</div>
                <div className="mt-0.5 font-bold text-emerald-400">
                  {(result.total_energy_generated_kwh ?? result.total_generated_energy_kwh ?? 0).toFixed(1)} kWh
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Action Buttons */}
      <div className="mt-4 flex items-center justify-between border-t border-luna-800/80 pt-3 text-xs">
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(scenario);
            }}
            className="flex items-center space-x-1 rounded-lg border border-luna-700 bg-luna-800/70 px-2.5 py-1 text-slate-300 hover:border-cyan-500/50 hover:bg-cyan-950/40 hover:text-cyan-200 transition-colors"
            title="Edit scenario parameters"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(scenario);
            }}
            className="flex items-center space-x-1 rounded-lg border border-luna-700 bg-luna-800/70 px-2.5 py-1 text-slate-300 hover:border-amber-500/50 hover:bg-amber-950/40 hover:text-amber-200 transition-colors"
            title="Duplicate scenario"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(scenario.id);
          }}
          disabled={!canDelete}
          className="flex items-center space-x-1 rounded-lg border border-luna-800 bg-transparent px-2.5 py-1 text-slate-500 hover:border-rose-500/50 hover:bg-rose-950/40 hover:text-rose-400 transition-colors disabled:opacity-30 disabled:hover:border-luna-800 disabled:hover:bg-transparent disabled:hover:text-slate-500"
          title={canDelete ? 'Remove scenario' : 'At least 2 scenarios required for comparison'}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Remove</span>
        </button>
      </div>
    </div>
  );
}
