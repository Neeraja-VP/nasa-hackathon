import React, { useState } from 'react';
import Header, { NAVIGATION_TABS } from './components/layout/Header';
import MissionSidebar from './components/layout/MissionSidebar';
import LunarExplorer from './components/explorer/LunarExplorer';
import SiteDetailCard from './components/sites/SiteDetailCard';
import SiteComparison from './components/sites/SiteComparison';
import SolarVisualization from './components/visualization/SolarVisualization';
import EarthVisualization from './components/visualization/EarthVisualization';
import TerrainHorizonView from './components/visualization/TerrainHorizonView';
import SkyHorizonView from './components/visualization/SkyHorizonView';
import SiteRecommendation from './components/mcda/SiteRecommendation';
import PowerSimulation from './components/simulation/PowerSimulation';
import AIMissionAssistant from './components/assistant/AIMissionAssistant';
import MoonSurface3D from './components/visualization/MoonSurface3D';
import LROCQuickMapViewer from './components/visualization/LROCQuickMapViewer';
import LoadingState from './components/common/LoadingState';
import ErrorState from './components/common/ErrorState';
import { useSites } from './hooks/useSites';
import { useSiteAnalysis } from './hooks/useSiteAnalysis';
import { DEFAULT_MISSION_CONFIG } from './utils/constants';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global Mission Parameters
  const [missionConfig, setMissionConfig] = useState(DEFAULT_MISSION_CONFIG);

  // Candidate Sites Catalog hook
  const {
    sites,
    selectedSiteId,
    setSelectedSiteId,
    selectedSite,
    loading: sitesLoading,
    error: sitesError,
    apiOnline,
    refetch: refetchSites,
    addCustomSite,
  } = useSites();

  // Active Site Orbital & Terrain Analysis hook
  const {
    illuminationData,
    communicationData,
    terrainHorizonData,
    loading: analysisLoading,
    error: analysisError,
  } = useSiteAnalysis(selectedSite, missionConfig);

  return (
    <div className="flex h-screen w-full flex-col bg-luna-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. TOP SCIENTIFIC EXECUTIVE BAR */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        apiOnline={apiOnline}
        selectedSite={selectedSite}
        sidebarOpen={mobileSidebarOpen}
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
      />

      {/* Mobile Tab Navigation Bar */}
      <div className="lg:hidden flex items-center overflow-x-auto border-b border-luna-800 bg-luna-900/90 px-3 py-2 space-x-2 shrink-0 z-10">
        {NAVIGATION_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1.5 rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'text-slate-400 hover:text-white bg-luna-950'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. MAIN APPLICATION WORKSPACE */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 z-10 bg-black/70 backdrop-blur-sm md:hidden"
          />
        )}

        {/* LEFT MISSION CONFIGURATION & CANDIDATE REGION SIDEBAR */}
        <MissionSidebar
          missionConfig={missionConfig}
          onChangeMissionConfig={setMissionConfig}
          sites={sites}
          selectedSiteId={selectedSiteId}
          onSelectSite={setSelectedSiteId}
          onAddCustomSite={addCustomSite}
          loading={sitesLoading}
          isOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* MAIN ANALYSIS CANVAS */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Sites Loading State */}
          {sitesLoading && !sites.length && (
            <LoadingState
              title="Connecting to Lunar Navigator Telemetry..."
              subtitle="Fetching NASA candidate south-pole landing zones, selenographic coordinates, and baseline elevation models."
            />
          )}

          {/* Sites Error State */}
          {sitesError && !sites.length && (
            <ErrorState
              title="Backend Telemetry Unavailable"
              message={sitesError}
              onRetry={refetchSites}
            />
          )}

          {/* VIEW: 1. OVERVIEW & DOSSIER */}
          {!sitesLoading && sites.length > 0 && activeTab === 'overview' && (
            <SiteDetailCard
              site={selectedSite}
              illuminationData={illuminationData}
              communicationData={communicationData}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* VIEW: 2. LUNAR EXPLORER 2D POLAR MAP */}
          {!sitesLoading && sites.length > 0 && activeTab === 'explorer' && (
            <div className="h-[calc(100vh-140px)] w-full">
              <LunarExplorer
                sites={sites}
                selectedSiteId={selectedSiteId}
                onSelectSite={setSelectedSiteId}
                currentSite={selectedSite}
                onNavigateTab={setActiveTab}
              />
            </div>
          )}

          {/* VIEW: 2.5 3D MOON SURFACE VISUALIZATION */}
          {!sitesLoading && sites.length > 0 && activeTab === 'moon3d' && (
            <div className="h-[calc(100vh-140px)] w-full">
              <MoonSurface3D
                sites={sites}
                selectedSiteId={selectedSiteId}
                onSelectSite={setSelectedSiteId}
                currentSite={selectedSite}
                missionConfig={missionConfig}
                onNavigateTab={setActiveTab}
              />
            </div>
          )}

          {/* VIEW: 2.8 NASA LROC QUICKMAP VISUALIZATION */}
          {!sitesLoading && sites.length > 0 && activeTab === 'quickmap' && (
            <div className="h-[calc(100vh-140px)] w-full">
              <LROCQuickMapViewer
                sites={sites}
                selectedSiteId={selectedSiteId}
                onSelectSite={setSelectedSiteId}
                currentSite={selectedSite}
              />
            </div>
          )}

          {/* VIEW: 3. SOLAR ILLUMINATION */}
          {!sitesLoading && sites.length > 0 && activeTab === 'illumination' && (
            <SolarVisualization
              illuminationData={illuminationData}
              terrainHorizonData={terrainHorizonData}
              loading={analysisLoading}
              error={analysisError}
              onRetry={() => {}}
            />
          )}

          {/* VIEW: 4. EARTH COMMUNICATION (DTE) */}
          {!sitesLoading && sites.length > 0 && activeTab === 'communication' && (
            <EarthVisualization
              communicationData={communicationData}
              terrainHorizonData={terrainHorizonData}
              loading={analysisLoading}
              error={analysisError}
              onRetry={() => {}}
            />
          )}

          {/* VIEW: 5. TERRAIN HORIZON PROFILE */}
          {!sitesLoading && sites.length > 0 && activeTab === 'terrain' && (
            <TerrainHorizonView
              terrainData={terrainHorizonData}
              loading={analysisLoading}
              error={analysisError}
              onRetry={() => {}}
            />
          )}

          {/* VIEW: 5.5 COMBINED SKY HORIZON VIEW */}
          {!sitesLoading && sites.length > 0 && activeTab === 'skyhorizon' && (
            <SkyHorizonView
              currentSite={selectedSite}
              missionConfig={missionConfig}
              illuminationData={illuminationData}
              communicationData={communicationData}
              terrainHorizonData={terrainHorizonData}
              loading={analysisLoading}
              error={analysisError}
              onRetry={() => {}}
            />
          )}

          {/* VIEW: 6. MULTI-SITE COMPARISON */}
          {!sitesLoading && sites.length > 0 && activeTab === 'compare' && (
            <SiteComparison
              sites={sites}
              missionConfig={missionConfig}
              onSelectSite={(id) => {
                setSelectedSiteId(id);
                setActiveTab('overview');
              }}
              onAddCustomSite={addCustomSite}
            />
          )}

          {/* VIEW: 7. MCDA RANKING & RECOMMENDATION */}
          {!sitesLoading && sites.length > 0 && activeTab === 'ranking' && (
            <SiteRecommendation
              missionConfig={missionConfig}
              onSelectSite={(id) => {
                setSelectedSiteId(id);
                setActiveTab('overview');
              }}
            />
          )}

          {/* VIEW: 8. POWER & ENERGY SIMULATION */}
          {!sitesLoading && sites.length > 0 && activeTab === 'simulation' && (
            <PowerSimulation
              currentSite={selectedSite}
              missionConfig={missionConfig}
            />
          )}

          {/* VIEW: 9. AI MISSION ASSISTANT (Member 4 Integration) */}
          {!sitesLoading && sites.length > 0 && activeTab === 'assistant' && (
            <AIMissionAssistant
              currentSite={selectedSite}
              missionConfig={missionConfig}
            />
          )}
        </main>
      </div>
    </div>
  );
}
