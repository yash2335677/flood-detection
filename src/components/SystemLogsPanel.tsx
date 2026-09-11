import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  Database,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Terminal,
  Server,
  Layers,
  Zap,
  Activity,
  UserCheck,
  Lock,
} from 'lucide-react';
import { SystemEventLog, ActionAuditLog } from '../types';

interface SystemLogsPanelProps {
  userRole: 'admin' | 'ndrf' | 'citizen';
}

export const SystemLogsPanel: React.FC<SystemLogsPanelProps> = ({ userRole }) => {
  const [activeSubTab, setActiveSubTab] = useState<'events' | 'audit' | 'database'>('events');
  const [systemLogs, setSystemLogs] = useState<SystemEventLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<ActionAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  // Database sandbox query state
  const [sqlQuery, setSqlQuery] = useState<string>(
    `SELECT time_bucket('5 minutes', time) AS bucket_5m, node_id, ROUND(AVG(water_level_cm)::numeric, 1) as avg_level_cm, MAX(flow_velocity_ms) as peak_velocity_ms FROM telemetry_metrics WHERE time > NOW() - INTERVAL '1 hour' GROUP BY bucket_5m, node_id ORDER BY bucket_5m DESC LIMIT 6;`
  );
  const [queryResult, setQueryResult] = useState<any[] | null>(null);
  const [queryExecutionTimeMs, setQueryExecutionTimeMs] = useState<number | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [sysRes, audRes] = await Promise.all([
        fetch('/api/logs/system'),
        fetch('/api/logs/audit'),
      ]);

      if (sysRes.ok) {
        const data = await sysRes.json();
        setSystemLogs(data.logs || []);
      }
      if (audRes.ok) {
        const data = await audRes.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 8000);
    return () => clearInterval(interval);
  }, []);

  // Filtered system event logs
  const filteredSystemLogs = systemLogs.filter((log) => {
    const matchesSearch =
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.nodeId && log.nodeId.toLowerCase().includes(searchQuery.toLowerCase())) ||
      log.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesType = eventTypeFilter === 'all' || log.eventType === eventTypeFilter;
    return matchesSearch && matchesSeverity && matchesType;
  });

  // Filtered audit logs
  const filteredAuditLogs = auditLogs.filter((audit) => {
    const matchesSearch =
      audit.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      audit.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      audit.targetAsset.toLowerCase().includes(searchQuery.toLowerCase()) ||
      audit.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Run simulated TimescaleDB SQL query
  const handleExecuteQuery = () => {
    setIsQuerying(true);
    setTimeout(() => {
      const now = Date.now();
      const mockRows = [
        {
          bucket_5m: new Date(now - 300000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          node_id: 'LORA-NODE-01',
          avg_level_cm: 284.2,
          peak_velocity_ms: 3.4,
        },
        {
          bucket_5m: new Date(now - 600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          node_id: 'LORA-NODE-01',
          avg_level_cm: 279.8,
          peak_velocity_ms: 3.1,
        },
        {
          bucket_5m: new Date(now - 900000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          node_id: 'CULVERT-G3-NORTH',
          avg_level_cm: 268.5,
          peak_velocity_ms: 2.8,
        },
        {
          bucket_5m: new Date(now - 1200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          node_id: 'LORA-NODE-01',
          avg_level_cm: 264.0,
          peak_velocity_ms: 2.5,
        },
        {
          bucket_5m: new Date(now - 1500000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          node_id: 'LORA-NODE-04-SPILL',
          avg_level_cm: 198.3,
          peak_velocity_ms: 1.9,
        },
      ];
      setQueryResult(mockRows);
      setQueryExecutionTimeMs(1.42);
      setIsQuerying(false);
    }, 450);
  };

  // Export CSV
  const exportLogsAsCsv = () => {
    const dataToExport = activeSubTab === 'audit' ? auditLogs : systemLogs;
    const headers = Object.keys(dataToExport[0] || {}).join(',');
    const rows = dataToExport.map((row) =>
      Object.values(row)
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `floodguard_${activeSubTab}_logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-mono uppercase tracking-wider text-emerald-400 font-semibold">
                Tab 6: System Log, Compliance &amp; Architecture
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Audit Trails, Event Logs &amp; Time-Series Ledger
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Tamper-evident operational logging for statutory disaster audits (NDMA / SDMA). Tracks automated watchdog triggers, human actuator interventions, and dual database hypertable health.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              onClick={fetchLogs}
              disabled={loading}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={exportLogsAsCsv}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Status Indicators Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Compliance Standard</div>
              <div className="text-xs font-bold text-slate-200">NDMA Standard SOP v4.2</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Background Watchdog</div>
              <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>Autonomous Daemon Active</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] text-slate-400">Time-Series Hypertable</div>
              <div className="text-xs font-bold text-purple-300 font-mono">TimescaleDB + PostGIS</div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('events')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeSubTab === 'events'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>1. Automated System Events ({systemLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('audit')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeSubTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>2. Human Action Audit Trail ({auditLogs.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('database')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
              activeSubTab === 'database'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>3. Database Architecture &amp; SQL Sandbox</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: AUTOMATED SYSTEM EVENT LEDGER */}
      {activeSubTab === 'events' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Automated Sensor &amp; Gateway Event Log</h2>
              <p className="text-xs text-slate-500">
                Chronological ledger of threshold alarms, LoRa uplinks, RF failover transitions, and differential pressure watchdog triggers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search logs or node..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                />
              </div>

              {/* Severity Filter */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical Only</option>
                <option value="warning">Warning Only</option>
                <option value="info">Info Only</option>
              </select>

              {/* Event Type Filter */}
              <select
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="all">All Event Types</option>
                <option value="threshold_breach">Threshold Breach</option>
                <option value="watchdog">Watchdog Trigger</option>
                <option value="failover">Failover / RF</option>
                <option value="sensor_uplink">Sensor Uplink</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-4">Event ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Origin Asset</th>
                  <th className="py-2.5 px-4">Description / Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {filteredSystemLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No system event records matching the current filter.
                    </td>
                  </tr>
                ) : (
                  filteredSystemLogs.map((log) => {
                    const isCrit = log.severity === 'critical';
                    const isWarn = log.severity === 'warning';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-2.5 px-4 font-bold text-slate-900">{log.id}</td>
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-sans ${
                              isCrit
                                ? 'bg-rose-100 text-rose-700'
                                : isWarn
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {log.severity}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-sans text-slate-700 font-medium">
                          {log.eventType.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-blue-700">{log.nodeId || 'SYSTEM'}</td>
                        <td className="py-2.5 px-4 font-sans text-slate-800 max-w-md truncate">
                          {log.message}
                          {log.waterLevel !== undefined && (
                            <span className="ml-2 font-mono font-semibold text-rose-600">
                              [{log.waterLevel} cm]
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: HUMAN ACTION & AUDIT TRAIL */}
      {activeSubTab === 'audit' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-slate-900 text-base">Supervisory Action &amp; Compliance Audit Trail</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">
                  Immutable
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Non-repudiation audit ledger recording every manual barrier actuation, broadcast dispatch, and maintenance verification with operator IP.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search actor or asset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-4">Audit ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Authorized Operator</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Action Performed</th>
                  <th className="py-2.5 px-4">Target Asset</th>
                  <th className="py-2.5 px-4">Terminal IP</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No audit records found matching query.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((audit) => (
                    <tr key={audit.id} className="hover:bg-slate-50/70 transition font-sans">
                      <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{audit.id}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-500 whitespace-nowrap">{audit.timestamp}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{audit.actor}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono ${
                            audit.role === 'admin'
                              ? 'bg-purple-100 text-purple-700'
                              : audit.role === 'ndrf'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {audit.role}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">
                        <div className="font-medium">{audit.action}</div>
                        {audit.reason && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5">
                            Reason: {audit.reason}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-semibold text-blue-700">{audit.targetAsset}</td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {audit.ipAddress}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-700 flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>{audit.status}</span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: DATABASE ARCHITECTURE & SQL SANDBOX */}
      {activeSubTab === 'database' && (
        <div className="space-y-6">
          {/* Architecture Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* TimescaleDB / InfluxDB Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Time-Series Database</h3>
                    <p className="text-[11px] text-slate-500">TimescaleDB / InfluxDB Hypertable</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">
                  Online (3s Ingest)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-1 text-slate-600">
                <div><strong>Hypertable:</strong> telemetry_metrics</div>
                <div><strong>Partition Interval:</strong> 1 day chunks</div>
                <div><strong>Retention Policy:</strong> 90 days raw, 5-yr downsampled</div>
                <div><strong>Compression:</strong> Segment-by node_id (93.4% ratio)</div>
              </div>
            </div>

            {/* PostGIS Card */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Relational &amp; Spatial Database</h3>
                    <p className="text-[11px] text-slate-500">PostgreSQL 16 + PostGIS 3.4</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 font-mono">
                  Online (GiST Indexed)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono space-y-1 text-slate-600">
                <div><strong>Spatial Tables:</strong> gis_sensor_assets, flood_contours</div>
                <div><strong>Geometry SRID:</strong> EPSG:4326 (WGS 84 GeoCoords)</div>
                <div><strong>Spatial Queries:</strong> ST_DWithin, ST_Contains, ST_Buffer</div>
                <div><strong>Routing Vector:</strong> pgRouting dynamic cost topology</div>
              </div>
            </div>
          </div>

          {/* Interactive SQL Query Sandbox */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-600" />
                <h3 className="font-bold text-slate-900 text-sm">Live SQL Analytical Query Sandbox</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">Dialect: PostgreSQL / TimescaleDB SQL</span>
            </div>

            <p className="text-xs text-slate-500">
              Direct analytical interface into continuous aggregate hypertables. Execute real-time window rollups, moving averages, and hydrologic regression slopes.
            </p>

            {/* Query Input */}
            <div className="space-y-2">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                rows={3}
                className="w-full p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs border border-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 leading-relaxed"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSqlQuery(
                        `SELECT time_bucket('5 minutes', time) AS bucket_5m, node_id, ROUND(AVG(water_level_cm)::numeric, 1) as avg_level_cm, MAX(flow_velocity_ms) as peak_velocity_ms FROM telemetry_metrics WHERE time > NOW() - INTERVAL '1 hour' GROUP BY bucket_5m, node_id ORDER BY bucket_5m DESC LIMIT 6;`
                      )
                    }
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium"
                  >
                    Preset: 5-min Aggregates
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setSqlQuery(
                        `SELECT node_id, MAX(water_level_cm) - MIN(water_level_cm) AS surge_delta_cm, (MAX(water_level_cm) - MIN(water_level_cm)) / 60.0 AS surge_rate_cm_per_min FROM telemetry_metrics WHERE time > NOW() - INTERVAL '1 hour' GROUP BY node_id;`
                      )
                    }
                    className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium"
                  >
                    Preset: Surge Velocity
                  </button>
                </div>

                <button
                  onClick={handleExecuteQuery}
                  disabled={isQuerying}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5"
                >
                  <Zap className={`w-3.5 h-3.5 ${isQuerying ? 'animate-spin' : ''}`} />
                  <span>{isQuerying ? 'Executing Query...' : 'Run Query'}</span>
                </button>
              </div>
            </div>

            {/* Query Results Table */}
            {queryResult && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Results: {queryResult.length} rows</span>
                  <span>Execution Time: {queryExecutionTimeMs} ms</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                      <tr>
                        {Object.keys(queryResult[0]).map((key) => (
                          <th key={key} className="py-2.5 px-4">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {queryResult.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          {Object.values(row).map((val: any, cidx) => (
                            <td key={cidx} className="py-2 px-4 text-slate-800">{String(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
