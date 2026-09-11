import React, { useState } from 'react';
import {
  Radio,
  Copy,
  Check,
  Send,
  Terminal,
  Cpu,
  RefreshCw,
  ExternalLink,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { FloodConfig, TelemetryRecord } from '../types';

interface LoraGatewayPanelProps {
  config: FloodConfig;
  latest: TelemetryRecord | null;
  onSendCustomPacket: (data: {
    nodeId: string;
    waterLevel: number;
    flowVelocity: number;
    rainfall: number;
    turbidity: number;
  }) => Promise<void>;
}

export const LoraGatewayPanel: React.FC<LoraGatewayPanelProps> = ({
  config,
  latest,
  onSendCustomPacket,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Custom test packet form state
  const [nodeId, setNodeId] = useState('LORA-NODE-01');
  const [waterLevel, setWaterLevel] = useState(260);
  const [flowVelocity, setFlowVelocity] = useState(2.3);
  const [rainfall, setRainfall] = useState(22);
  const [turbidity, setTurbidity] = useState(65);

  const endpointUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/lora/uplink` : '/api/lora/uplink';

  const sampleCurl = `curl -X POST ${endpointUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "nodeId": "${nodeId}",
    "waterLevel": ${waterLevel},
    "flowVelocity": ${flowVelocity},
    "rainfall": ${rainfall},
    "turbidity": ${turbidity},
    "rssi": -76,
    "snr": 9.8,
    "frequency": "868.100 MHz"
  }'`;

  const copyToClipboard = (text: string, isCurl = false) => {
    navigator.clipboard.writeText(text);
    if (isCurl) {
      setCopiedCurl(true);
      setTimeout(() => setCopiedCurl(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessNotice(null);
    try {
      await onSendCustomPacket({
        nodeId,
        waterLevel: Number(waterLevel),
        flowVelocity: Number(flowVelocity),
        rainfall: Number(rainfall),
        turbidity: Number(turbidity),
      });
      setSuccessNotice(`Sensor packet successfully processed by Receiver '${config.receiverName}'!`);
      setTimeout(() => setSuccessNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Transmission failed';
      alert(`Ingest error: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              LoRa Gateway Integration &amp; Receiver Ingest
            </h3>
            <p className="text-xs text-slate-500">
              Active Receiver: <span className="font-semibold text-slate-700">{config.receiverName}</span> | Hardware Gateway: <span className="font-mono text-slate-700">{config.gatewayId}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            Receiver '{config.receiverName}' Ready
          </span>
        </div>
      </div>

      {/* Two Column Layout: Webhook URL & Receiver Info / Test Packet Ingest Tool */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 cols: Gateway Endpoint & Hardware Connection Info */}
        <div className="lg:col-span-7 space-y-4">
          
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                LoRa Gateway Uplink Webhook Endpoint
              </label>
              <button
                onClick={() => copyToClipboard(endpointUrl, false)}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedUrl ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            
            <div className="bg-slate-900 text-emerald-400 font-mono text-xs p-2.5 rounded-lg overflow-x-auto border border-slate-800 selection:bg-emerald-800">
              {endpointUrl}
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Configure your LoRa receiver ({config.receiverName}), ESP32 SX1276/SX1262 gateway, Dragino LPS8, or TTN Webhook to forward telemetry payloads to this HTTP POST URL.
            </p>
          </div>

          {/* Quick cURL Example */}
          <div className="p-4 rounded-xl bg-slate-900 text-slate-200 font-mono text-xs space-y-2 border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800">
              <span className="flex items-center gap-1 text-[11px]">
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                Direct Gateway Ingest cURL
              </span>
              <button
                onClick={() => copyToClipboard(sampleCurl, true)}
                className="text-emerald-400 hover:text-emerald-300 text-[11px] flex items-center gap-1"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedCurl ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="overflow-x-auto text-[11px] leading-snug text-slate-300 whitespace-pre">
              {sampleCurl}
            </pre>
          </div>

          {/* Receiver Specifications Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Receiver ID</span>
              <span className="font-semibold text-slate-800">{config.receiverName}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px]">RF Frequency</span>
              <span className="font-mono text-slate-800">868 / 915 MHz</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Spreading Factor</span>
              <span className="font-mono text-slate-800">SF7 - SF12</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-400 block text-[10px]">Active Uplinks</span>
              <span className="font-mono text-slate-800">{config.packetsReceived} pkts</span>
            </div>
          </div>

        </div>

        {/* Right 5 cols: Interactive Live Ingest Test Tool */}
        <div className="lg:col-span-5 bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-blue-600" />
              <h4 className="font-bold text-slate-900 text-xs">
                LoRa Ingest Simulator &amp; Field Tester
              </h4>
            </div>
            <span className="text-[10px] text-slate-400">Direct Ingest</span>
          </div>

          <p className="text-xs text-slate-500">
            Inject sensor telemetry directly into the LoRa gateway to test flood alerts, hydrograph curves, and instant SMS broadcasts.
          </p>

          {successNotice && (
            <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          <form onSubmit={handleTestSubmit} className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Water Level (cm)</span>
                <span className={`font-mono font-bold ${
                  waterLevel >= config.criticalThreshold
                    ? 'text-rose-600'
                    : waterLevel >= config.warningThreshold
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}>
                  {waterLevel} cm
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="480"
                step="5"
                value={waterLevel}
                onChange={(e) => setWaterLevel(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-0.5">
                <span>Normal (&lt;{config.normalThreshold})</span>
                <span>Warn ({config.warningThreshold})</span>
                <span>Critical ({config.criticalThreshold}+)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Flow Velocity (m/s)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={flowVelocity}
                  onChange={(e) => setFlowVelocity(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Rainfall (mm/h)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={rainfall}
                  onChange={(e) => setRainfall(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Turbidity (NTU)
                </label>
                <input
                  type="number"
                  value={turbidity}
                  onChange={(e) => setTurbidity(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Node Identifier
                </label>
                <input
                  type="text"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition disabled:opacity-60"
            >
              {isSubmitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Transmit Packet to LoRa Gateway</span>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
