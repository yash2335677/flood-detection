import React, { useState } from 'react';
import {
  Radio,
  Bell,
  BellOff,
  Smartphone,
  LayoutDashboard,
  Volume2,
  Signal,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Map,
  Brain,
  Sliders,
  Users,
  Shield,
  Activity,
  Send,
  Eye,
  FileText,
} from 'lucide-react';
import { floodAudio } from '../utils/audioAlert';
import { FloodConfig } from '../types';

interface NavbarProps {
  currentView: 'dashboard' | 'mobile';
  onViewChange: (view: 'dashboard' | 'mobile') => void;
  config: FloodConfig;
  activeAlertCount: number;
  isStreamConnected: boolean;
  onSimulateScenario: (scenario: 'flash_flood' | 'warning_surge' | 'normal_recede') => void;
  userRole: 'admin' | 'ndrf' | 'citizen';
  onRoleChange: (role: 'admin' | 'ndrf' | 'citizen') => void;
  activeTab: 'gis' | 'predictive' | 'hardware' | 'broadcast' | 'citizen_mgmt' | 'logs' | 'telemetry';
  onTabChange: (tab: 'gis' | 'predictive' | 'hardware' | 'broadcast' | 'citizen_mgmt' | 'logs' | 'telemetry') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentView,
  onViewChange,
  config,
  activeAlertCount,
  isStreamConnected,
  onSimulateScenario,
  userRole,
  onRoleChange,
  activeTab,
  onTabChange,
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [simMenuOpen, setSimMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    floodAudio.setMuted(next);
  };

  const testAudio = () => {
    floodAudio.playAlertSound('warning');
  };

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Receiver Identifier */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-lg tracking-tight">
                  FloodGuard <span className="text-blue-600">LoRa</span>
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  Receiver: <strong className="font-semibold text-emerald-900">{config.receiverName}</strong>
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Autonomous GIS Command Center, Predictive AI &amp; LoRa Mesh Telemetry
              </p>
            </div>
          </div>

          {/* Quick Telemetry & Status Badges */}
          <div className="hidden xl:flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              <Signal className="w-3.5 h-3.5 text-blue-500" />
              <span>Gateway:</span>
              <span className="font-semibold text-slate-800">{config.gatewayId}</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Uplinks:</span>
              <span className="font-semibold text-slate-800">{config.packetsReceived} pkts</span>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
              {isStreamConnected ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Live Mesh Stream</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                  <span className="text-amber-700 font-medium">Syncing...</span>
                </>
              )}
            </div>
          </div>

          {/* Controls, RBAC Role Switch & View Selector */}
          <div className="flex items-center gap-2">
            
            {/* RBAC Multi-Tenant Role Switcher */}
            <div className="relative">
              <button
                id="role-switch-btn"
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
              >
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span className="capitalize hidden sm:inline">
                  {userRole === 'admin' ? '🏛️ Municipal Admin' : userRole === 'ndrf' ? '🦺 NDRF Commander' : '👥 Citizen Portal'}
                </span>
                <span className="sm:hidden uppercase font-mono">{userRole}</span>
              </button>

              {roleMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-xl bg-white shadow-xl border border-slate-200 p-2 z-50 text-xs">
                  <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Role-Based Access (RBAC)
                  </div>
                  <button
                    onClick={() => {
                      onRoleChange('admin');
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg font-medium flex items-center justify-between ${
                      userRole === 'admin' ? 'bg-blue-50 text-blue-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">🏛️ Municipal Admin</div>
                      <div className="text-[10px] text-slate-500">Full actuator &amp; broadcast override</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onRoleChange('ndrf');
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg font-medium flex items-center justify-between ${
                      userRole === 'ndrf' ? 'bg-amber-50 text-amber-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">🦺 NDRF / SDMA Tactical</div>
                      <div className="text-[10px] text-slate-500">Rescue logistics &amp; culvert teams</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      onRoleChange('citizen');
                      setRoleMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg font-medium flex items-center justify-between ${
                      userRole === 'citizen' ? 'bg-emerald-50 text-emerald-800' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div>
                      <div className="font-bold">👥 Citizen Public Mirror</div>
                      <div className="text-[10px] text-slate-500">Low-bandwidth ward advisory</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Scenario Tester Dropdown */}
            <div className="relative">
              <button
                id="scenario-test-btn"
                onClick={() => setSimMenuOpen(!simMenuOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition"
                title="Inject LoRa Field Test Packets"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span className="hidden md:inline">LoRa Test Ingest</span>
              </button>

              {simMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white shadow-xl border border-slate-200 p-2 z-50 text-xs">
                  <div className="px-2 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Simulate Sensor Ingest
                  </div>
                  <button
                    onClick={() => {
                      onSimulateScenario('flash_flood');
                      setSimMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-rose-50 text-rose-700 font-medium flex items-center justify-between"
                  >
                    <span>🚨 Flash Flood Surge (385cm)</span>
                    <span className="text-[10px] bg-rose-100 px-1.5 py-0.5 rounded">Critical</span>
                  </button>
                  <button
                    onClick={() => {
                      onSimulateScenario('warning_surge');
                      setSimMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-amber-50 text-amber-800 font-medium flex items-center justify-between"
                  >
                    <span>⚠️ Heavy Inflow Surge (285cm)</span>
                    <span className="text-[10px] bg-amber-100 px-1.5 py-0.5 rounded">Warning</span>
                  </button>
                  <button
                    onClick={() => {
                      onSimulateScenario('normal_recede');
                      setSimMenuOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-emerald-50 text-emerald-700 font-medium flex items-center justify-between"
                  >
                    <span>💧 Water Receding (165cm)</span>
                    <span className="text-[10px] bg-emerald-100 px-1.5 py-0.5 rounded">Normal</span>
                  </button>
                </div>
              )}
            </div>

            {/* Audio Alarm Mute / Test */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
              <button
                id="test-audio-btn"
                onClick={testAudio}
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-white transition"
                title="Test Alert Chime"
              >
                <Volume2 className="w-4 h-4" />
              </button>
              <button
                id="toggle-mute-btn"
                onClick={toggleMute}
                className={`p-1.5 rounded-md transition ${
                  isMuted
                    ? 'text-rose-600 bg-rose-50'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
                title={isMuted ? 'Sound Alarms Muted' : 'Sound Alarms Active'}
              >
                {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
              </button>
            </div>

            {/* View Switcher: Desktop Command vs Mobile App */}
            <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-100">
              <button
                id="view-dashboard-btn"
                onClick={() => onViewChange('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  currentView === 'dashboard'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Command Hub</span>
              </button>
              <button
                id="view-mobile-btn"
                onClick={() => onViewChange('mobile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition relative ${
                  currentView === 'mobile'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Mobile App</span>
                {activeAlertCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 absolute -top-0.5 -right-0.5 animate-pulse"></span>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Sub-Navigation Tabs in Command Hub */}
        {currentView === 'dashboard' && (
          <div className="flex items-center gap-1 overflow-x-auto py-2 border-t border-slate-100 scrollbar-none text-xs">
            <button
              onClick={() => onTabChange('gis')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'gis'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Map className="w-3.5 h-3.5" />
              <span>GIS &amp; Risk Heatmap</span>
            </button>

            <button
              onClick={() => onTabChange('predictive')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'predictive'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Predictive AI &amp; Breaches</span>
            </button>

            <button
              onClick={() => onTabChange('hardware')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'hardware'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>LoRa RF &amp; Hardware</span>
            </button>

            <button
              onClick={() => onTabChange('broadcast')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'broadcast'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Multi-Channel Hub &amp; Actuators</span>
            </button>

            <button
              onClick={() => onTabChange('citizen_mgmt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'citizen_mgmt'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Citizen &amp; Municipality</span>
            </button>

            <button
              onClick={() => onTabChange('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'logs'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Audit Logs &amp; DB</span>
            </button>

            <button
              onClick={() => onTabChange('telemetry')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap ${
                activeTab === 'telemetry'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Telemetry &amp; Alerts</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
