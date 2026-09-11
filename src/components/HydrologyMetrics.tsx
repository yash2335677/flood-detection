import React from 'react';
import {
  Waves,
  Gauge,
  CloudRain,
  Activity,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Droplet,
  BatteryCharging,
} from 'lucide-react';
import { TelemetryRecord, FloodConfig } from '../types';

interface HydrologyMetricsProps {
  latest: TelemetryRecord | null;
  config: FloodConfig;
}

export const HydrologyMetrics: React.FC<HydrologyMetricsProps> = ({ latest, config }) => {
  if (!latest) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-xs">
        <p className="text-slate-500 text-sm">Awaiting LoRa sensor payload from receiver...</p>
      </div>
    );
  }

  // Calculate percentage toward critical flood threshold
  const floodRiskPct = Math.min(
    100,
    Math.max(10, Math.round((latest.waterLevel / config.criticalThreshold) * 100))
  );

  const getStatusBadge = () => {
    switch (latest.status) {
      case 'critical':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 font-bold text-xs uppercase tracking-wider animate-pulse">
            <ShieldAlert className="w-4 h-4" />
            <span>CRITICAL FLOOD EVACUATION</span>
          </div>
        );
      case 'warning':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 font-bold text-xs uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>SEVERE FLOOD WARNING</span>
          </div>
        );
      case 'advisory':
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 font-medium text-xs uppercase tracking-wider">
            <Droplet className="w-4 h-4" />
            <span>ELEVATED WATER ADVISORY</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-medium text-xs uppercase tracking-wider">
            <span>NORMAL RIVER HYDROLOGY</span>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner with Overall Risk & Status */}
      <div
        className={`p-5 rounded-2xl border transition-all ${
          latest.status === 'critical'
            ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-200'
            : latest.status === 'warning'
            ? 'bg-amber-50/80 border-amber-300'
            : 'bg-white border-slate-200 shadow-xs'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-medium text-slate-500 uppercase tracking-wider">
                Monitoring Station: {latest.nodeId}
              </span>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-slate-600">
              Uplink delivered via Receiver <strong className="text-slate-900">{config.receiverName}</strong> at{' '}
              <span className="font-mono text-slate-800">{latest.timestamp}</span> (Packet #{latest.packetNumber})
            </p>
          </div>

          <div className="w-full sm:w-64 space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-slate-600">Flood Threat Index</span>
              <span
                className={`font-mono font-bold ${
                  latest.status === 'critical'
                    ? 'text-rose-600'
                    : latest.status === 'warning'
                    ? 'text-amber-600'
                    : 'text-blue-600'
                }`}
              >
                {floodRiskPct}%
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  latest.status === 'critical'
                    ? 'bg-rose-500'
                    : latest.status === 'warning'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${floodRiskPct}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Safe &lt; {config.normalThreshold}cm</span>
              <span>Warn: {config.warningThreshold}cm</span>
              <span>Crit: {config.criticalThreshold}cm</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Core Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Metric 1: Water Level */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <div className="flex items-center gap-1.5">
              <Waves className="w-4 h-4 text-blue-600" />
              <span>Water Depth / Stage</span>
            </div>
            <span className="text-[11px] text-slate-400">Ultrasonic</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {latest.waterLevel}
            </span>
            <span className="text-xs font-medium text-slate-500">cm</span>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs">
            {latest.rateOfRise > 0 ? (
              <span className="text-rose-600 font-medium flex items-center">
                <ArrowUpRight className="w-3.5 h-3.5" />
                +{latest.rateOfRise} cm/min
              </span>
            ) : (
              <span className="text-emerald-600 font-medium flex items-center">
                <ArrowDownRight className="w-3.5 h-3.5" />
                Receding
              </span>
            )}
            <span className="text-slate-400 text-[11px]">trend</span>
          </div>
        </div>

        {/* Metric 2: Flow Velocity */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <div className="flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-600" />
              <span>Flow Velocity</span>
            </div>
            <span className="text-[11px] text-slate-400">Doppler</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {latest.flowVelocity}
            </span>
            <span className="text-xs font-medium text-slate-500">m/s</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Discharge est:</span>
            <span className="font-mono text-slate-700 font-semibold">
              {(latest.flowVelocity * (latest.waterLevel / 100) * 4.2).toFixed(1)} m³/s
            </span>
          </div>
        </div>

        {/* Metric 3: Precipitation / Rain Rate */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <div className="flex items-center gap-1.5">
              <CloudRain className="w-4 h-4 text-indigo-600" />
              <span>Rainfall Rate</span>
            </div>
            <span className="text-[11px] text-slate-400">Tipping Bucket</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {latest.rainfall}
            </span>
            <span className="text-xs font-medium text-slate-500">mm/h</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Rain Intensity:</span>
            <span className={`font-medium ${latest.rainfall > 30 ? 'text-rose-600' : latest.rainfall > 15 ? 'text-amber-600' : 'text-slate-700'}`}>
              {latest.rainfall > 30 ? 'Torrential' : latest.rainfall > 15 ? 'Heavy Rain' : 'Moderate'}
            </span>
          </div>
        </div>

        {/* Metric 4: Turbidity & Water Quality */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Turbidity Analysis</span>
            </div>
            <span className="text-[11px] text-slate-400">Optical</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {latest.turbidity}
            </span>
            <span className="text-xs font-medium text-slate-500">NTU</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
            <span>Sediment:</span>
            <span className="text-slate-700 font-medium">
              {latest.turbidity > 100 ? 'High Runoff' : latest.turbidity > 50 ? 'Medium' : 'Clear Flow'}
            </span>
          </div>
        </div>

        {/* Metric 5: LoRa Telemetry Link */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2 font-medium">
            <div className="flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-violet-600" />
              <span>LoRa RF Link</span>
            </div>
            <span className="text-[11px] text-emerald-600 font-semibold">Active</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-slate-900">
              {latest.rssi}
            </span>
            <span className="text-xs font-medium text-slate-500">dBm</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs font-mono text-slate-500">
            <span>SNR: {latest.snr} dB</span>
            <span className="flex items-center gap-1 text-slate-700">
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-500" />
              {latest.battery}V
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
