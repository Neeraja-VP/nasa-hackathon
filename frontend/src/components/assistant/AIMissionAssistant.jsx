import React, { useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Database,
  ArrowRight,
  RefreshCw,
  Sun,
  Radio,
  Mountain,
  BatteryCharging
} from 'lucide-react';
import { queryAssistant, getErrorMessage } from '../../services/api';

const QUICK_PROMPTS = [
  {
    label: 'Optimal Artemis Site',
    icon: Compass,
    query: 'Which landing site is optimal for an Artemis III 14-day surface stay in December 2026?'
  },
  {
    label: 'Power Survival at Shackleton',
    icon: BatteryCharging,
    query: 'Can a 4.5 m2 solar array with 5000 Wh battery survive shadow at Shackleton Rim?'
  },
  {
    label: 'Compare Top 3 Candidates',
    icon: Mountain,
    query: 'Compare Shackleton Rim versus Connecting Ridge versus Malapert Mountain'
  },
  {
    label: 'Earth Comm at Malapert',
    icon: Radio,
    query: 'What is the Earth communication availability and libration blackout at Malapert Mountain?'
  },
  {
    label: 'Landing Slope Safety',
    icon: ShieldAlert,
    query: 'What are the landing hazards and slope risks at Shackleton Crater Rim?'
  }
];

export default function AIMissionAssistant({ currentSite, missionConfig }) {
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [conversation, setConversation] = useState([
    {
      role: 'assistant',
      data: {
        query: 'System Initialization',
        intent: 'GENERAL_SCIENCE',
        summary: 'Welcome to the Luna Navigator AI Mission Assistant. I synthesize verified NASA JPL Horizons ephemerides, LOLA digital elevation models, multi-criteria site rankings, and electrical power simulations into explainable engineering briefings.',
        detailed_analysis: 'Ask me to rank candidate sites, evaluate solar array power survival, compare topographic trade-offs, or assess terrain slope hazards. All findings cite empirical NASA datasets and include explicit safety non-certification boundaries.',
        scientific_evidence: {
          data_sources: ['NASA JPL Horizons DE440', 'NASA LOLA LDEM_80S_100M', 'IAU Mean Earth / Polar Axis Frame']
        },
        risk_assessment: {
          risk_level: 'LOW_RISK',
          primary_risks: ['Polar low sun elevation (0°–1.8°)', 'Cryogenic PSR thermal sinks (<40K)', 'Libration communication blackouts'],
          recommended_mitigations: ['Perform multi-variable trade studies using Luna Navigator prior to mission architecture lockdown.']
        },
        safety_disclaimer: 'SCIENTIFIC NOTICE: This evaluation is an algorithmic decision-support heuristic based on gridded LOLA elevation (100m/px) and orbital mechanics. It DOES NOT constitute NASA certification of landing safety. Formal qualification requires sub-meter obstacle detection, regolith geotechnical testing, and terminal descent propellant margins.',
        suggested_followups: [
          'Which landing site is optimal for an Artemis III 14-day stay?',
          'Can a 4.5 m2 solar array survive shadow at Shackleton Rim?',
          'Compare Shackleton Rim versus Connecting Ridge versus Malapert Mountain'
        ]
      }
    }
  ]);

  const handleSendQuery = async (queryText) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || loading) return;

    setError(null);
    setLoading(true);

    // Optimistically append user message
    const userMsg = { role: 'user', text: textToSend };
    setConversation((prev) => [...prev, userMsg]);
    setInputQuery('');

    try {
      const response = await queryAssistant({
        query: textToSend,
        site_id: currentSite?.id,
        start_date: missionConfig?.startDate || '2026-12-01T00:00:00Z',
        duration_days: missionConfig?.durationDays || 14.0,
        step_hours: missionConfig?.stepHours || 2.0
      });

      setConversation((prev) => [...prev, { role: 'assistant', data: response }]);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] w-full max-w-6xl mx-auto space-y-4">
      {/* Top Banner */}
      <div className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-luna-900/80 p-4 backdrop-blur-md">
        <div className="flex items-center space-x-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/40 text-cyan-400">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white flex items-center space-x-2">
              <span>AI Scientific Mission Assistant</span>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300 border border-cyan-500/40">
                JPL Horizons & LOLA Grounded
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Explainable lunar landing site evaluation, energy simulations, and trade-off analysis.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center space-x-2 text-xs text-slate-400">
          <Database className="h-4 w-4 text-cyan-400" />
          <span>Active Epoch: <strong className="text-slate-200">{missionConfig?.startDate?.slice(0, 10) || '2026-12-01'}</strong> ({missionConfig?.durationDays || 14}d)</span>
        </div>
      </div>

      {/* Preset Quick Prompts */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 shrink-0">
        {QUICK_PROMPTS.map((p, idx) => {
          const Icon = p.icon;
          return (
            <button
              key={idx}
              onClick={() => handleSendQuery(p.query)}
              disabled={loading}
              className="flex items-center space-x-1.5 whitespace-nowrap rounded-lg border border-luna-700/80 bg-luna-850/80 px-3 py-1.5 text-xs text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 hover:bg-luna-800 transition-all disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5 text-cyan-400" />
              <span>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* Conversation Stream */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {conversation.map((msg, index) => {
          if (msg.role === 'user') {
            return (
              <div key={index} className="flex justify-end">
                <div className="max-w-xl rounded-xl bg-cyan-600/30 border border-cyan-500/40 px-4 py-3 text-sm text-cyan-100 shadow-md">
                  {msg.text}
                </div>
              </div>
            );
          }

          const data = msg.data;
          const riskColor =
            data.risk_assessment?.risk_level === 'HIGH_RISK'
              ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
              : data.risk_assessment?.risk_level === 'MODERATE_RISK'
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

          return (
            <div key={index} className="space-y-4 rounded-xl border border-luna-800 bg-luna-900/90 p-5 shadow-lg backdrop-blur-md">
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-luna-800/80 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-xs font-mono font-medium text-cyan-300 border border-cyan-500/40">
                    INTENT: {data.intent}
                  </span>
                  {data.focused_site_id && (
                    <span className="rounded-md bg-luna-800 px-2 py-0.5 text-xs font-mono text-slate-300 border border-luna-700">
                      SITE: {data.focused_site_id}
                    </span>
                  )}
                </div>
                {data.risk_assessment && (
                  <span className={`flex items-center space-x-1 rounded-md px-2 py-0.5 text-xs font-medium border ${riskColor}`}>
                    <ShieldAlert className="h-3.5 w-3.5" />
                    <span>{data.risk_assessment.risk_level.replace('_', ' ')}</span>
                  </span>
                )}
              </div>

              {/* Executive Summary */}
              <div className="rounded-lg bg-luna-850/80 p-3 text-sm text-slate-200 border-l-4 border-cyan-400 leading-relaxed">
                {data.summary}
              </div>

              {/* Detailed Technical Analysis */}
              <div className="text-xs text-slate-300 whitespace-pre-line leading-relaxed space-y-2 bg-luna-950/40 rounded-lg p-3 border border-luna-800/50">
                {data.detailed_analysis}
              </div>

              {/* Scientific Evidence Grid */}
              {data.scientific_evidence && (
                <div className="rounded-lg border border-luna-800 bg-luna-950/70 p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                    <Database className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Empirical Scientific Evidence</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                    {data.scientific_evidence.illumination_percentage != null && (
                      <div className="rounded bg-luna-900 p-2 border border-luna-800">
                        <span className="text-slate-400 block">Illumination</span>
                        <strong className="text-amber-400">{data.scientific_evidence.illumination_percentage}%</strong>
                      </div>
                    )}
                    {data.scientific_evidence.communication_percentage != null && (
                      <div className="rounded bg-luna-900 p-2 border border-luna-800">
                        <span className="text-slate-400 block">Earth Comm</span>
                        <strong className="text-cyan-400">{Number(data.scientific_evidence.communication_percentage).toFixed(1)}%</strong>
                      </div>
                    )}
                    {data.scientific_evidence.slope_degrees != null && (
                      <div className="rounded bg-luna-900 p-2 border border-luna-800">
                        <span className="text-slate-400 block">Slope</span>
                        <strong className="text-slate-200">{Number(data.scientific_evidence.slope_degrees).toFixed(1)}°</strong>
                      </div>
                    )}
                    {data.scientific_evidence.elevation_m != null && (
                      <div className="rounded bg-luna-900 p-2 border border-luna-800">
                        <span className="text-slate-400 block">Elevation</span>
                        <strong className="text-slate-200">{Number(data.scientific_evidence.elevation_m).toFixed(0)} m</strong>
                      </div>
                    )}
                  </div>
                  {data.scientific_evidence.data_sources?.length > 0 && (
                    <div className="text-[10px] text-slate-400 pt-1">
                      Data Sources: <span className="text-slate-300">{data.scientific_evidence.data_sources.join(' • ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Mandatory NASA Safety Disclaimer */}
              {data.safety_disclaimer && (
                <div className="flex items-start space-x-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-[11px] text-amber-200">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="leading-snug">{data.safety_disclaimer}</div>
                </div>
              )}

              {/* Suggested Follow-up Actions */}
              {data.suggested_followups?.length > 0 && (
                <div className="pt-2 border-t border-luna-800/80 space-y-1.5">
                  <span className="text-[11px] font-medium text-slate-400 block">Suggested Inquiries:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {data.suggested_followups.map((f, fIdx) => (
                      <button
                        key={fIdx}
                        onClick={() => handleSendQuery(f)}
                        disabled={loading}
                        className="flex items-center space-x-1 rounded bg-luna-800 px-2.5 py-1 text-[11px] text-cyan-300 hover:bg-luna-750 hover:text-white transition-colors"
                      >
                        <span>{f}</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="flex items-center space-x-2 text-xs text-cyan-400 animate-pulse p-4 rounded-xl border border-cyan-500/30 bg-luna-900/60">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Consulting JPL Horizons ephemerides and LOLA ray tracer...</span>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendQuery();
        }}
        className="flex items-center space-x-2 pt-2 border-t border-luna-800 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask AI Mission Assistant (e.g. Which landing site is best for an Artemis III surface stay?)"
          disabled={loading}
          className="flex-1 rounded-xl border border-luna-700 bg-luna-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="flex items-center space-x-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-medium text-white hover:bg-cyan-500 transition-colors disabled:opacity-40"
        >
          <span>Send</span>
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
