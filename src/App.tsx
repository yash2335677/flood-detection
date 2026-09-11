import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { HydrologyMetrics } from './components/HydrologyMetrics';
import { VisualizationGraphs } from './components/VisualizationGraphs';
import { LoraGatewayPanel } from './components/LoraGatewayPanel';
import { AlertsAndSmsPanel } from './components/AlertsAndSmsPanel';
import { MobileAppView } from './components/MobileAppView';
import { GisCommandCenter } from './components/GisCommandCenter';
import { PredictiveAnalyticsPanel } from './components/PredictiveAnalyticsPanel';
import { HardwareDiagnosticsPanel } from './components/HardwareDiagnosticsPanel';
import { EmergencyBroadcastAndActuators } from './components/EmergencyBroadcastAndActuators';
import { PublicCitizenPortal } from './components/PublicCitizenPortal';
import { SystemLogsPanel } from './components/SystemLogsPanel';
import { floodAudio } from './utils/audioAlert';
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
} from './types';

const initialConfig: FloodConfig = {
  normalThreshold: 180,
  warningThreshold: 250,
  criticalThreshold: 340,
  evacuationThreshold: 420,
  autoSmsEnabled: true,
  receiverName: 'LoRa',
  gatewayId: 'GW-LORA-915-ALPHA',
  gatewayFrequency: '868.100 MHz / SF7 / BW 125kHz',
  gatewayStatus: 'ONLINE',
  lastPacketTime: new Date().toISOString(),
  packetsReceived: 1420,
};

const initialBroadcastStatus: BroadcastTriggerStatus = {
  active: false,
  smsSentCount: 0,
  telegramDelivered: false,
  whatsappDelivered: false,
  physicalSirenTriggered: false,
  lastTriggerTimestamp: null,
  targetMessage: '',
};

export default function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'mobile'>('dashboard');
  const [activeTab, setActiveTab] = useState<'gis' | 'predictive' | 'hardware' | 'broadcast' | 'citizen_mgmt' | 'logs' | 'telemetry'>('gis');
  const [userRole, setUserRole] = useState<'admin' | 'ndrf' | 'citizen'>('admin');

  const [config, setConfig] = useState<FloodConfig>(initialConfig);
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([]);
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [smsHistory, setSmsHistory] = useState<SmsRecord[]>([]);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [isStreamConnected, setIsStreamConnected] = useState(false);

  // SIH 5-Module States
  const [nodes, setNodes] = useState<PhysicalNode[]>([]);
  const [zones, setZones] = useState<FloodRiskZone[]>([]);
  const [actuators, setActuators] = useState<DamActuator[]>([]);
  const [broadcastStatus, setBroadcastStatus] = useState<BroadcastTriggerStatus>(initialBroadcastStatus);

  // 1. Initial Data Fetch
  const fetchInitialData = useCallback(async () => {
    try {
      const [statusRes, telRes, alertRes, smsRes, cfgRes, nodesRes, zonesRes, actRes] = await Promise.all([
        fetch('/api/status').then((r) => r.json()).catch(() => null),
        fetch('/api/telemetry').then((r) => r.json()).catch(() => null),
        fetch('/api/alerts').then((r) => r.json()).catch(() => null),
        fetch('/api/sms/history').then((r) => r.json()).catch(() => null),
        fetch('/api/config').then((r) => r.json()).catch(() => null),
        fetch('/api/gis/nodes').then((r) => r.json()).catch(() => null),
        fetch('/api/gis/zones').then((r) => r.json()).catch(() => null),
        fetch('/api/actuators').then((r) => r.json()).catch(() => null),
      ]);

      if (statusRes?.gateway) setConfig(statusRes.gateway);
      if (telRes?.records) {
        const uniqueTel = new Map<string, TelemetryRecord>();
        telRes.records.forEach((r: TelemetryRecord) => {
          if (r.id) uniqueTel.set(r.id, r);
        });
        setTelemetry(Array.from(uniqueTel.values()));
      }
      if (alertRes?.alerts) {
        const uniqueAlerts = new Map<string, AlertRecord>();
        alertRes.alerts.forEach((a: AlertRecord) => {
          if (a.id) uniqueAlerts.set(a.id, a);
        });
        setAlerts(Array.from(uniqueAlerts.values()));
      }
      if (smsRes?.history) {
        const uniqueSms = new Map<string, SmsRecord>();
        smsRes.history.forEach((s: SmsRecord) => {
          if (s.id) uniqueSms.set(s.id, s);
        });
        setSmsHistory(Array.from(uniqueSms.values()));
      }
      if (cfgRes?.emergencyContacts) setEmergencyContacts(cfgRes.emergencyContacts);
      if (nodesRes?.nodes) setNodes(nodesRes.nodes);
      if (zonesRes?.zones) setZones(zonesRes.zones);
      if (actRes?.actuators) setActuators(actRes.actuators);
    } catch (e) {
      console.warn('Initial data fetch error:', e);
    }
  }, []);

  // 2. Real-Time Server-Sent Events (SSE) Stream
  useEffect(() => {
    fetchInitialData();

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    function connectSSE() {
      eventSource = new EventSource('/api/stream');

      eventSource.onopen = () => {
        setIsStreamConnected(true);
      };

      eventSource.addEventListener('initial_state', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.config) setConfig(data.config);
          if (data.alerts) {
            const uniqueAlerts = new Map<string, AlertRecord>();
            data.alerts.forEach((a: AlertRecord) => {
              if (a.id) uniqueAlerts.set(a.id, a);
            });
            setAlerts(Array.from(uniqueAlerts.values()));
          }
          if (data.contacts) setEmergencyContacts(data.contacts);
          if (data.nodes) setNodes(data.nodes);
          if (data.zones) setZones(data.zones);
          if (data.actuators) setActuators(data.actuators);
          if (data.broadcastStatus) setBroadcastStatus(data.broadcastStatus);
        } catch (err) {
          console.error('Error parsing initial SSE state:', err);
        }
      });

      eventSource.addEventListener('telemetry_update', (e: MessageEvent) => {
        try {
          const record: TelemetryRecord = JSON.parse(e.data);
          setTelemetry((prev) => {
            if (prev.some((t) => t.id === record.id)) return prev;
            const next = [...prev, record];
            return next.slice(-60);
          });
          setConfig((prev) => ({
            ...prev,
            packetsReceived: prev.packetsReceived + 1,
            lastPacketTime: new Date().toISOString(),
          }));
        } catch (err) {
          console.error('Error handling telemetry update:', err);
        }
      });

      eventSource.addEventListener('gis_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.nodes) setNodes(data.nodes);
          if (data.zones) setZones(data.zones);
        } catch (err) {
          console.error('Error handling gis_update:', err);
        }
      });

      eventSource.addEventListener('actuator_updated', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data.allActuators) {
            setActuators(data.allActuators);
          } else if (data.actuator) {
            setActuators((prev) =>
              prev.map((a) => (a.id === data.actuator.id ? data.actuator : a))
            );
          }
        } catch (err) {
          console.error('Error handling actuator_updated:', err);
        }
      });

      eventSource.addEventListener('broadcast_triggered', (e: MessageEvent) => {
        try {
          const status: BroadcastTriggerStatus = JSON.parse(e.data);
          setBroadcastStatus(status);
        } catch (err) {
          console.error('Error handling broadcast_triggered:', err);
        }
      });

      eventSource.addEventListener('alert_created', (e: MessageEvent) => {
        try {
          const newAlert: AlertRecord = JSON.parse(e.data);
          setAlerts((prev) => {
            if (prev.some((a) => a.id === newAlert.id)) return prev;
            return [newAlert, ...prev.slice(0, 29)];
          });

          // Sound alarm
          floodAudio.playAlertSound(newAlert.level);

          // Native Web Notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`[FLOOD ALERT] ${newAlert.title}`, {
              body: `${newAlert.message} (Water level: ${newAlert.waterLevel}cm)`,
              icon: '/favicon.ico',
            });
          }
        } catch (err) {
          console.error('Error handling alert created:', err);
        }
      });

      eventSource.addEventListener('sms_dispatched', (e: MessageEvent) => {
        try {
          const newSms: SmsRecord = JSON.parse(e.data);
          setSmsHistory((prev) => {
            if (prev.some((s) => s.id === newSms.id)) return prev;
            return [newSms, ...prev.slice(0, 49)];
          });
        } catch (err) {
          console.error('Error handling sms dispatched:', err);
        }
      });

      eventSource.addEventListener('alert_acknowledged', (e: MessageEvent) => {
        try {
          const { id } = JSON.parse(e.data);
          setAlerts((prev) =>
            prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
          );
        } catch (err) {
          console.error('Error handling alert acknowledged:', err);
        }
      });

      eventSource.onerror = () => {
        setIsStreamConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [fetchInitialData]);

  // Action Handlers
  const handleAcknowledgeAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts/${id}/acknowledge`, { method: 'POST' });
      if (res.ok) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
        );
      }
    } catch (e) {
      console.error('Failed to acknowledge alert:', e);
    }
  };

  const handleSendSms = async (to: string, message: string, recipientName: string) => {
    const res = await fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, message, recipientName, alertLevel: 'warning' }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to dispatch SMS');
    if (data.sms) {
      setSmsHistory((prev) => {
        if (prev.some((s) => s.id === data.sms.id)) return prev;
        return [data.sms, ...prev].slice(0, 50);
      });
    }
  };

  const handleAddContact = async (contact: EmergencyContact) => {
    const updated = [...emergencyContacts, contact];
    setEmergencyContacts(updated);
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacts: updated }),
    });
  };

  const handleSendCustomPacket = async (data: {
    nodeId: string;
    waterLevel: number;
    flowVelocity: number;
    rainfall: number;
    turbidity: number;
  }) => {
    const res = await fetch('/api/lora/uplink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to ingest packet');
    }
  };

  const handleSimulateScenario = async (scenario: 'flash_flood' | 'warning_surge' | 'normal_recede') => {
    try {
      await fetch('/api/lora/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario }),
      });
    } catch (e) {
      console.error('Simulation error:', e);
    }
  };

  const handleFlushCulvert = async (nodeId: string) => {
    const res = await fetch(`/api/culverts/${nodeId}/flush`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to trigger flush');
    }
  };

  const handleControlActuator = async (actuatorId: string, openPercentage: number, pin: string) => {
    const res = await fetch(`/api/actuators/${actuatorId}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ openPercentage, pin }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Actuator control rejected');
    }
    const data = await res.json();
    if (data.actuator) {
      setActuators((prev) =>
        prev.map((a) => (a.id === data.actuator.id ? data.actuator : a))
      );
    }
  };

  const handleTriggerBroadcast = async (customMessage?: string) => {
    const res = await fetch('/api/broadcast/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: customMessage, priority: 'critical' }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Broadcast failed');
    }
  };

  const handleSilenceSiren = async () => {
    await fetch('/api/broadcast/silence-siren', { method: 'POST' });
    setBroadcastStatus((prev) => ({ ...prev, physicalSirenTriggered: false }));
  };

  const latestRecord = telemetry.length > 0 ? telemetry[telemetry.length - 1] : null;
  const activeAlertCount = alerts.filter((a) => !a.acknowledged).length;
  const latestSms = smsHistory.length > 0 ? smsHistory[0] : null;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-800 flex flex-col font-sans">
      {/* Top Navigation Bar with RBAC and Command Tabs */}
      <Navbar
        currentView={currentView}
        onViewChange={setCurrentView}
        config={config}
        activeAlertCount={activeAlertCount}
        isStreamConnected={isStreamConnected}
        onSimulateScenario={handleSimulateScenario}
        userRole={userRole}
        onRoleChange={setUserRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {userRole === 'citizen' ? (
          /* Public Citizen Mirror View */
          <PublicCitizenPortal
            zones={zones}
            config={config}
            currentRecord={latestRecord}
          />
        ) : currentView === 'mobile' ? (
          /* Mobile App View */
          <MobileAppView
            latest={latestRecord}
            config={config}
            alerts={alerts}
            latestSms={latestSms}
            onSendTestSms={handleSendSms}
          />
        ) : (
          /* Command Hub: Tabbed Architecture for High-Utility Modules */
          <>
            {/* Tab 1: GIS Command Center & Contours */}
            {activeTab === 'gis' && (
              <GisCommandCenter
                nodes={nodes}
                zones={zones}
                config={config}
                onFlushCulvert={handleFlushCulvert}
                userRole={userRole}
              />
            )}

            {/* Tab 2: Predictive Analytics & ML Modules */}
            {activeTab === 'predictive' && (
              <PredictiveAnalyticsPanel
                currentRecord={latestRecord}
                config={config}
                nodes={nodes}
                onFlushCulvert={handleFlushCulvert}
                userRole={userRole}
              />
            )}

            {/* Tab 3: LoRa RF & Hardware Diagnostics */}
            {activeTab === 'hardware' && (
              <HardwareDiagnosticsPanel
                nodes={nodes}
                telemetryHistory={telemetry}
                config={config}
              />
            )}

            {/* Tab 4: Multi-Channel Emergency Broadcast Hub & Actuators */}
            {activeTab === 'broadcast' && (
              <EmergencyBroadcastAndActuators
                actuators={actuators}
                broadcastStatus={broadcastStatus}
                contacts={emergencyContacts}
                onTriggerBroadcast={handleTriggerBroadcast}
                onControlActuator={handleControlActuator}
                onSilenceSiren={handleSilenceSiren}
                userRole={userRole}
              />
            )}

            {/* Tab 5: Public Citizen Portal & Municipality Management */}
            {activeTab === 'citizen_mgmt' && (
              <PublicCitizenPortal
                zones={zones}
                config={config}
                currentRecord={latestRecord}
                userRole={userRole}
              />
            )}

            {/* Tab 6: System Log & Compliance Audits */}
            {activeTab === 'logs' && (
              <SystemLogsPanel userRole={userRole} />
            )}

            {/* Tab 7: Real-time Hydrology Telemetry & LoRa Ingest */}
            {activeTab === 'telemetry' && (
              <div className="space-y-6">
                <HydrologyMetrics latest={latestRecord} config={config} />
                <VisualizationGraphs telemetry={telemetry} config={config} />
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  <LoraGatewayPanel
                    config={config}
                    latest={latestRecord}
                    onSendCustomPacket={handleSendCustomPacket}
                  />
                  <AlertsAndSmsPanel
                    alerts={alerts}
                    smsHistory={smsHistory}
                    emergencyContacts={emergencyContacts}
                    config={config}
                    onAcknowledgeAlert={handleAcknowledgeAlert}
                    onSendSms={handleSendSms}
                    onAddContact={handleAddContact}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">FloodGuard LoRa Hydrology System</span>
            <span>&bull;</span>
            <span>Receiver: <strong className="text-slate-800">{config.receiverName}</strong></span>
            <span>&bull;</span>
            <span>Role: <strong className="uppercase text-blue-700 font-mono">{userRole}</strong></span>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-mono text-slate-400">Gateway: {config.gatewayId}</span>
            <span>&bull;</span>
            <span className="text-emerald-600 font-medium">Auto-SMS Broadcast &amp; 120dB Siren Synced</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
