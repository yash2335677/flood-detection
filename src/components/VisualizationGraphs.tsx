import React, { useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { TelemetryRecord, FloodConfig } from '../types';
import { LineChart as LineChartIcon, BarChart3, Radio } from 'lucide-react';

interface VisualizationGraphsProps {
  telemetry: TelemetryRecord[];
  config: FloodConfig;
}

export const VisualizationGraphs: React.FC<VisualizationGraphsProps> = ({ telemetry, config }) => {
  const [activeTab, setActiveTab] = useState<'waterLevel' | 'hydrograph' | 'loraRf'>('waterLevel');
  const [sampleCount, setSampleCount] = useState<number>(20);

  // Slice data based on selected sample window
  const displayedData = telemetry.slice(-sampleCount);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5">
      {/* Header with Graph Tabs & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="font-bold text-slate-900 text-base tracking-tight flex items-center gap-2">
            <LineChartIcon className="w-5 h-5 text-blue-600" />
            Hydrological Visualization &amp; Flood Forecast Analysis
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time stage-discharge trends, precipitation correlation, and LoRa transmission telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Chart Type Tabs */}
          <div className="flex p-0.5 bg-slate-100 rounded-lg text-xs font-medium border border-slate-200">
            <button
              onClick={() => setActiveTab('waterLevel')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'waterLevel'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Water Stage Depth
            </button>
            <button
              onClick={() => setActiveTab('hydrograph')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'hydrograph'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hydrograph (Rain / Velocity)
            </button>
            <button
              onClick={() => setActiveTab('loraRf')}
              className={`px-3 py-1.5 rounded-md transition ${
                activeTab === 'loraRf'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Turbidity &amp; LoRa RF
            </button>
          </div>

          {/* Sample History Filter */}
          <div className="flex items-center gap-1 text-xs text-slate-500 pl-2">
            <span>Points:</span>
            <select
              value={sampleCount}
              onChange={(e) => setSampleCount(Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-md px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              <option value={10}>Last 10</option>
              <option value={20}>Last 20</option>
              <option value={35}>Last 35</option>
              <option value={50}>All (50)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="mt-4 pt-2">
        {activeTab === 'waterLevel' && (
          <div>
            <div className="flex items-center justify-between text-xs mb-3 text-slate-600 px-2">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium text-blue-700">
                  <span className="w-3 h-0.5 bg-blue-600 inline-block rounded"></span>
                  Water Stage Level (cm)
                </span>
                <span className="flex items-center gap-1.5 text-amber-700">
                  <span className="w-3 h-0.5 bg-amber-500 inline-block border-t border-dashed"></span>
                  Warning Level ({config.warningThreshold}cm)
                </span>
                <span className="flex items-center gap-1.5 text-rose-700 font-semibold">
                  <span className="w-3 h-0.5 bg-rose-600 inline-block"></span>
                  Critical Flood Evacuation ({config.criticalThreshold}cm)
                </span>
              </div>
              <span className="font-mono text-slate-400 text-[11px] hidden md:inline">
                Node: LORA-NODE-01
              </span>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={displayedData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="waterLevelGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    domain={['auto', 'auto']}
                    unit=" cm"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      border: 'none',
                    }}
                    formatter={(value: any) => [`${value} cm`, 'Water Depth']}
                    labelFormatter={(label) => `Time: ${label}`}
                  />
                  <ReferenceLine
                    y={config.warningThreshold}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={1.5}
                    label={{
                      value: 'Warning Threshold',
                      fill: '#d97706',
                      fontSize: 10,
                      position: 'top',
                    }}
                  />
                  <ReferenceLine
                    y={config.criticalThreshold}
                    stroke="#ef4444"
                    strokeWidth={2}
                    label={{
                      value: 'CRITICAL EVACUATE',
                      fill: '#dc2626',
                      fontSize: 10,
                      position: 'top',
                      fontWeight: 'bold',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="waterLevel"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#waterLevelGrad)"
                    activeDot={{ r: 5, fill: '#1d4ed8' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'hydrograph' && (
          <div>
            <div className="flex items-center justify-between text-xs mb-3 text-slate-600 px-2">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium text-cyan-700">
                  <span className="w-3 h-0.5 bg-cyan-600 inline-block"></span>
                  Flow Velocity (m/s)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-indigo-700">
                  <span className="w-3 h-2 bg-indigo-500 inline-block rounded-xs"></span>
                  Rainfall Rate (mm/h)
                </span>
              </div>
              <span className="text-slate-400 text-[11px] hidden md:inline">
                Precipitation vs Stream Velocity
              </span>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={displayedData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#0891b2" fontSize={11} tickLine={false} unit=" m/s" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#6366f1"
                    fontSize={11}
                    tickLine={false}
                    unit=" mm"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Legend />
                  <Bar
                    yAxisId="right"
                    dataKey="rainfall"
                    name="Rainfall (mm/h)"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    opacity={0.8}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="flowVelocity"
                    name="Flow Velocity (m/s)"
                    stroke="#0891b2"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#0891b2' }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === 'loraRf' && (
          <div>
            <div className="flex items-center justify-between text-xs mb-3 text-slate-600 px-2">
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                  <span className="w-3 h-0.5 bg-emerald-600 inline-block"></span>
                  Turbidity Index (NTU)
                </span>
                <span className="flex items-center gap-1.5 font-medium text-violet-700">
                  <span className="w-3 h-0.5 bg-violet-600 inline-block"></span>
                  LoRa RSSI Signal (dBm)
                </span>
              </div>
              <span className="text-slate-400 text-[11px] font-mono">
                Receiver: {config.receiverName} Link
              </span>
            </div>

            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayedData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="timestamp" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis yAxisId="left" stroke="#059669" fontSize={11} tickLine={false} unit=" NTU" />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    stroke="#7c3aed"
                    fontSize={11}
                    tickLine={false}
                    domain={[-105, -55]}
                    unit=" dBm"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      border: 'none',
                    }}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="turbidity"
                    name="Turbidity (NTU)"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#059669' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="rssi"
                    name="LoRa RSSI (dBm)"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#7c3aed' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
