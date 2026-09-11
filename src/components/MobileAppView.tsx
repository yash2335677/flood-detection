import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Tablet,
  Maximize2,
  Bell,
  Radio,
  Waves,
  ShieldAlert,
  MapPin,
  PhoneCall,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Map,
  Brain,
  Send,
  Activity,
  Users,
  FileText,
  Zap,
  Volume2,
  BellOff,
  ExternalLink,
  Shield,
  Compass,
  ArrowUpRight,
} from 'lucide-react';
import {
  TelemetryRecord,
  AlertRecord,
  SmsRecord,
  EmergencyContact,
  FloodConfig,
  PhysicalNode,
  FloodRiskZone,
  DamActuator,
  BroadcastTriggerStatus,
} from '../types';
import { GisCommandCenter } from './GisCommandCenter';
import { HydrologyMetrics } from './HydrologyMetrics';
import { VisualizationGraphs } from './VisualizationGraphs';
import { LoraGatewayPanel } from './LoraGatewayPanel';
import { AlertsAndSmsPanel } from './AlertsAndSmsPanel';
import { PredictiveAnalyticsPanel } from './PredictiveAnalyticsPanel';
import { HardwareDiagnosticsPanel } from './HardwareDiagnosticsPanel';
import { EmergencyBroadcastAndActuators } from './EmergencyBroadcastAndActuators';
import { PublicCitizenPortal } from './PublicCitizenPortal';
import { SystemLogsPanel } from './SystemLogsPanel';
import { floodAudio } from '../utils/audioAlert';

interface MobileAppViewProps {
  latest: TelemetryRecord | null;
  config: FloodConfig;
  alerts: AlertRecord[];
  latestSms: SmsRecord | null;
  smsHistory: SmsRecord[];
  emergencyContacts: EmergencyContact[];
  nodes: PhysicalNode[];
  zones: FloodRiskZone[];
  actuators: DamActuator[];
  broadcastStatus: BroadcastTriggerStatus;
  userRole: 'admin' | 'ndrf' | 'citizen';
  telemetry: TelemetryRecord[];
  isStreamConnected: boolean;
  onFlushCulvert: (nodeId: string) => Promise<void>;
  onControlActuator: (actuatorId: string, openPercentage: number, pin: string) => Promise<void>;
  onTriggerBroadcast: (customMessage?: string) => Promise<void>;
  onSilenceSiren: () => Promise<void>;
  onSimulateScenario: (scenario: 'flash_flood' | 'warning_surge' | 'normal_recede') => void;
  onSendCustomPacket: (data: {
    nodeId: string;
    waterLevel: number;
    flowVelocity: number;
    rainfall: number;
    turbidity: number;
  }) => Promise<void>;
  onAcknowledgeAlert: (id: string) => Promise<void>;
  onSendTestSms: (phone: string, msg: string, name: string) => Promise<void>;
  onAddContact: (contact: EmergencyContact) => Promise<void>;
  onOpenAuthModal?: (role: 'admin' | 'ndrf') => void;
}

export const MobileAppView: React.FC<MobileAppViewProps> = ({
  latest,
  config,
  alerts,
  latestSms,
  smsHistory,
  emergencyContacts,
  nodes,
  zones,
  actuators,
  broadcastStatus,
  userRole,
  telemetry,
  isStreamConnected,
  onFlushCulvert,
  onControlActuator,
  onTriggerBroadcast,
  onSilenceSiren,
  onSimulateScenario,
  onSendCustomPacket,
  onAcknowledgeAlert,
  onSendTestSms,
  onAddContact,
  onOpenAuthModal,
}) => {
  // Mobile/Tablet viewport frame modes
  const [viewportMode, setViewportMode] = useState<'responsive' | 'tablet' | 'mobile'>('responsive');
  const [mobileTab, setMobileTab] = useState<
    'gis' | 'telemetry' | 'predictive' | 'broadcast' | 'hardware' | 'citizen_mgmt' | 'logs'
  >('gis');

  const [sosSent, setSosSent] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const requestNativeNotification = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setPushPermission(perm);
      if (perm === 'granted') {
        new Notification('FloodGuard LoRa Mobile Command Hub', {
          body: `Live link established with ${config.receiverName}. You will receive instant flood alert dispatches.`,
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleSendSos = () => {
    setSosSent(true);
    floodAudio.playAlertSound('critical');
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([400, 200, 400]);
    }
    setTimeout(() => setSosSent(false), 5000);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    floodAudio.setMuted(next);
  };

  const waterLevel = latest ? latest.waterLevel : 230;
  const status = latest ? latest.status : 'normal';
  const activeAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  // The core Command Hub UI optimized for mobile & tablet screens
  const commandHubContent = (
    <div className="bg-slate-100/90 min-h-screen text-slate-800 flex flex-col font-sans">
      
      {/* 1. Mobile & Tablet Command Hub Top App Bar */}
      <div className="bg-white border-b border-slate-200 px-3.5 py-3 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Status */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0 ring-2 ring-blue-100">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 truncate">
                <h1 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight truncate">
                  FloodGuard <span className="text-blue-600">Mobile Hub</span>
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Command Hub &bull; {config.gatewayId} &bull;{' '}
                <span className="uppercase font-mono text-blue-700 font-semibold">{userRole}</span>
              </p>
            </div>
          </div>

          {/* Quick Actions for Mobile/Tablet */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* SOS Emergency Distress */}
            <button
              id="mobile-sos-btn"
              onClick={handleSendSos}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition shadow-xs ${
                sosSent
                  ? 'bg-emerald-600 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 active:scale-95 text-white'
              }`}
              title="One-Tap Emergency Distress Beacon"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{sosSent ? 'SOS Dispatched!' : 'SOS'}</span>
            </button>

            {/* Audio Mute/Chime */}
            <button
              id="mobile-mute-btn"
              onClick={toggleMute}
              className={`p-2 rounded-lg border transition ${
                isMuted
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title={isMuted ? 'Unmute Audio Siren' : 'Mute Audio Siren'}
            >
              {isMuted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
            </button>

            {/* Role Authentication Trigger if Citizen */}
            {userRole === 'citizen' && onOpenAuthModal && (
              <button
                id="mobile-admin-login-btn"
                onClick={() => onOpenAuthModal('admin')}
                className="py-1.5 px-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold flex items-center gap-1 hover:bg-blue-100 transition"
                title="Sign In as Municipal Admin or NDRF"
              >
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Admin Login</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Hydrology Quick Stats Ribbon */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 grid grid-cols-4 gap-1.5 text-center text-xs">
          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 block truncate">Water Stage</span>
            <span
              className={`font-mono font-bold text-xs sm:text-sm ${
                status === 'critical'
                  ? 'text-rose-600'
                  : status === 'warning'
                  ? 'text-amber-600'
                  : 'text-blue-600'
              }`}
            >
              {waterLevel} cm
            </span>
          </div>

          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 block truncate">Flow Velocity</span>
            <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
              {latest?.flowVelocity ?? 2.1} m/s
            </span>
          </div>

          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 block truncate">Rain Rate</span>
            <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">
              {latest?.rainfall ?? 18} mm/h
            </span>
          </div>

          <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
            <span className="text-[10px] text-slate-400 block truncate">Active Alerts</span>
            <span
              className={`font-mono font-bold text-xs sm:text-sm ${
                activeAlertsCount > 0 ? 'text-rose-600' : 'text-emerald-600'
              }`}
            >
              {activeAlertsCount}
            </span>
          </div>
        </div>

        {/* 2. Mobile & Tablet Command Tab Bar (Scrollable Finger-Friendly Pills) */}
        <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-semibold">
          <button
            id="mobile-tab-gis"
            onClick={() => setMobileTab('gis')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
              mobileTab === 'gis'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Map className="w-3.5 h-3.5" />
            <span>GIS Map</span>
          </button>

          <button
            id="mobile-tab-telemetry"
            onClick={() => setMobileTab('telemetry')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
              mobileTab === 'telemetry'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Telemetry</span>
            {activeAlertsCount > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>

          <button
            id="mobile-tab-predictive"
            onClick={() => setMobileTab('predictive')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
              mobileTab === 'predictive'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>AI Predict</span>
          </button>

          <button
            id="mobile-tab-broadcast"
            onClick={() => setMobileTab('broadcast')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
              mobileTab === 'broadcast'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>Broadcast &amp; Sluice</span>
          </button>

          <button
            id="mobile-tab-hardware"
            onClick={() => setMobileTab('hardware')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
              mobileTab === 'hardware'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>LoRa RF</span>
          </button>

          <button
            id="mobile-tab-citizen"
            onClick={() => setMobileTab('citizen_mgmt')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
              mobileTab === 'citizen_mgmt'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Citizen Portal</span>
          </button>

          <button
            id="mobile-tab-logs"
            onClick={() => setMobileTab('logs')}
            className={`py-2 px-3 rounded-xl whitespace-nowrap flex items-center gap-1.5 transition ${
              mobileTab === 'logs'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Audit Logs</span>
          </button>
        </div>
      </div>

      {/* 3. Main Active Content View (Matches the Command Hub exactly, styled for mobile & tablet) */}
      <div className="flex-1 p-3 sm:p-5 space-y-4">
        {mobileTab === 'gis' && (
          <div className="space-y-4">
            <GisCommandCenter
              nodes={nodes}
              zones={zones}
              config={config}
              onFlushCulvert={onFlushCulvert}
              userRole={userRole}
            />
          </div>
        )}

        {mobileTab === 'telemetry' && (
          <div className="space-y-4">
            <HydrologyMetrics latest={latest} config={config} />
            <VisualizationGraphs telemetry={telemetry} config={config} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <LoraGatewayPanel
                config={config}
                latest={latest}
                onSendCustomPacket={onSendCustomPacket}
              />
              <AlertsAndSmsPanel
                alerts={alerts}
                smsHistory={smsHistory}
                emergencyContacts={emergencyContacts}
                config={config}
                onAcknowledgeAlert={onAcknowledgeAlert}
                onSendSms={onSendTestSms}
                onAddContact={onAddContact}
              />
            </div>
          </div>
        )}

        {mobileTab === 'predictive' && (
          <div className="space-y-4">
            <PredictiveAnalyticsPanel
              currentRecord={latest}
              config={config}
              nodes={nodes}
              onFlushCulvert={onFlushCulvert}
              userRole={userRole}
            />
          </div>
        )}

        {mobileTab === 'broadcast' && (
          <div className="space-y-4">
            <EmergencyBroadcastAndActuators
              actuators={actuators}
              broadcastStatus={broadcastStatus}
              contacts={emergencyContacts}
              onTriggerBroadcast={onTriggerBroadcast}
              onControlActuator={onControlActuator}
              onSilenceSiren={onSilenceSiren}
              userRole={userRole}
            />
          </div>
        )}

        {mobileTab === 'hardware' && (
          <div className="space-y-4">
            <HardwareDiagnosticsPanel
              nodes={nodes}
              telemetryHistory={telemetry}
              config={config}
            />
          </div>
        )}

        {mobileTab === 'citizen_mgmt' && (
          <div className="space-y-4">
            <PublicCitizenPortal
              zones={zones}
              config={config}
              currentRecord={latest}
              userRole={userRole}
            />
          </div>
        )}

        {mobileTab === 'logs' && (
          <div className="space-y-4">
            <SystemLogsPanel userRole={userRole} />
          </div>
        )}
      </div>

      {/* 4. Mobile Bottom Quick Action / Scenario Dock */}
      <div className="sticky bottom-0 z-30 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shadow-lg text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            LoRa Ingest:
          </span>
          <button
            onClick={() => onSimulateScenario('flash_flood')}
            className="py-1 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-[11px] whitespace-nowrap transition border border-rose-200"
          >
            🚨 Flash Flood (385cm)
          </button>
          <button
            onClick={() => onSimulateScenario('warning_surge')}
            className="py-1 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-[11px] whitespace-nowrap transition border border-amber-200"
          >
            ⚠️ Inflow Surge (285cm)
          </button>
          <button
            onClick={() => onSimulateScenario('normal_recede')}
            className="py-1 px-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] whitespace-nowrap transition border border-emerald-200"
          >
            💧 Recede (165cm)
          </button>
        </div>

        <a
          href={`https://www.google.com/maps/dir/${nodes.map((n) => `${n.lat},${n.lng}`).join('/')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="py-1 px-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 transition shadow-xs whitespace-nowrap shrink-0"
        >
          <Compass className="w-3 h-3" />
          <span className="hidden sm:inline">Google Maps All</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-80" />
        </a>
      </div>

    </div>
  );

  return (
    <div className="space-y-4">
      
      {/* Viewport Control Bar: Lets users toggle between Responsive, Tablet (iPad), and Phone (iOS/Android) frames */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900 text-sm sm:text-base tracking-tight flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-blue-600" />
            <span>Mobile &amp; Tablet Command Hub Interface</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase font-mono">
              Live Synchronized
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Full Command Hub capabilities redesigned for touch, phones, and tablets with synchronized GIS, AI predictions, and actuators.
          </p>
        </div>

        {/* Frame Toggle Controls */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start sm:self-auto">
          <button
            id="viewport-responsive-btn"
            onClick={() => setViewportMode('responsive')}
            className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition ${
              viewportMode === 'responsive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Fluid layout fitting your current screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Adaptive</span>
          </button>

          <button
            id="viewport-tablet-btn"
            onClick={() => setViewportMode('tablet')}
            className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition ${
              viewportMode === 'tablet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Preview in Tablet / iPad format (768px)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span>Tablet (iPad)</span>
          </button>

          <button
            id="viewport-mobile-btn"
            onClick={() => setViewportMode('mobile')}
            className={`py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition ${
              viewportMode === 'mobile'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Preview in Mobile Phone format (390px)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Phone</span>
          </button>
        </div>
      </div>

      {/* Render selected viewport mode */}
      {viewportMode === 'responsive' ? (
        <div className="w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
          {commandHubContent}
        </div>
      ) : viewportMode === 'tablet' ? (
        <div className="flex justify-center py-4 bg-slate-200/60 rounded-2xl p-4">
          <div className="w-[780px] max-w-full rounded-[32px] bg-slate-900 p-4 shadow-2xl ring-8 ring-slate-800 border-4 border-slate-700 overflow-hidden">
            {/* Tablet Camera Hole */}
            <div className="w-2.5 h-2.5 bg-slate-800 rounded-full mx-auto mb-3"></div>
            <div className="rounded-[24px] overflow-hidden max-h-[860px] overflow-y-auto">
              {commandHubContent}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center py-4 bg-slate-200/60 rounded-2xl p-4">
          <div className="w-[390px] max-w-full rounded-[38px] bg-slate-950 p-3.5 shadow-2xl ring-8 ring-slate-800 border-4 border-slate-700 overflow-hidden">
            {/* Phone Notch */}
            <div className="w-28 h-4 bg-slate-900 rounded-full mx-auto mb-2.5 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800"></div>
            </div>
            <div className="rounded-[26px] overflow-hidden max-h-[820px] overflow-y-auto">
              {commandHubContent}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
