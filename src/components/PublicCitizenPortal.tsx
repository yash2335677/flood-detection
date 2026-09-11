import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  MapPin,
  PhoneCall,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Info,
  Radio,
  ExternalLink,
  LifeBuoy,
  PlusCircle,
  ThumbsUp,
  Wrench,
  Key,
  Copy,
  Users,
  Building2,
  Send,
  Calendar,
  Check,
  Zap,
  Compass,
} from 'lucide-react';
import {
  FloodRiskZone,
  FloodConfig,
  TelemetryRecord,
  CrowdsourcedReport,
  ReliefCampInfo,
  FieldMaintenanceLog,
  ApiKeyRecord,
} from '../types';

interface PublicCitizenPortalProps {
  zones: FloodRiskZone[];
  config: FloodConfig;
  currentRecord: TelemetryRecord | null;
  userRole?: 'admin' | 'ndrf' | 'citizen';
}

export const PublicCitizenPortal: React.FC<PublicCitizenPortalProps> = ({
  zones,
  config,
  currentRecord,
  userRole = 'citizen',
}) => {
  const [activeTab, setActiveTab] = useState<'risk' | 'crowdsource' | 'shelters' | 'maintenance' | 'api'>('risk');
  const [searchQuery, setSearchQuery] = useState('');

  // Crowdsource state
  const [reports, setReports] = useState<CrowdsourcedReport[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportAuthor, setReportAuthor] = useState('');
  const [reportPhone, setReportPhone] = useState('');
  const [reportLocation, setReportLocation] = useState('');
  const [reportDepth, setReportDepth] = useState<number>(35);
  const [reportHazard, setReportHazard] = useState<'waterlogged_road' | 'culvert_choked' | 'stranded_citizens' | 'powerline_down'>('waterlogged_road');
  const [reportDesc, setReportDesc] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);

  // Shelters state
  const [shelters, setShelters] = useState<ReliefCampInfo[]>([]);

  // Maintenance state
  const [maintenanceLogs, setMaintenanceLogs] = useState<FieldMaintenanceLog[]>([]);
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [maintNodeId, setMaintNodeId] = useState('CULVERT-G3-NORTH');
  const [maintOperator, setMaintOperator] = useState('Field Tech Unit 3');
  const [maintBattery, setMaintBattery] = useState('3.92V (88%) Nominal');
  const [maintTrashCleaned, setMaintTrashCleaned] = useState(true);
  const [maintDamage, setMaintDamage] = useState(false);
  const [maintNotes, setMaintNotes] = useState('Debris cleared from intake trash screen. Ultrasonic transducer wiped.');

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyOrg, setNewKeyOrg] = useState('');
  const [newKeyName, setNewKeyName] = useState('');
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [repRes, sheRes, mainRes, keyRes] = await Promise.all([
        fetch('/api/citizen/reports'),
        fetch('/api/citizen/shelters'),
        fetch('/api/maintenance/logs'),
        fetch('/api/keys'),
      ]);

      if (repRes.ok) {
        const data = await repRes.json();
        setReports(data.reports || []);
      }
      if (sheRes.ok) {
        const data = await sheRes.json();
        setShelters(data.shelters || []);
      }
      if (mainRes.ok) {
        const data = await mainRes.json();
        setMaintenanceLogs(data.logs || []);
      }
      if (keyRes.ok) {
        const data = await keyRes.json();
        setApiKeys(data.keys || []);
      }
    } catch (e) {
      console.error('Error loading citizen portal data:', e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleUpvote = async (id: string) => {
    try {
      const res = await fetch(`/api/citizen/reports/${id}/upvote`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, upvotes: data.upvotes } : r)));
      }
    } catch (e) {
      console.error('Upvote error:', e);
    }
  };

  const handleVerifyReport = async (id: string) => {
    try {
      const res = await fetch(`/api/citizen/reports/${id}/verify`, { method: 'POST' });
      if (res.ok) {
        setReports((prev) => prev.map((r) => (r.id === id ? { ...r, verified: true } : r)));
      }
    } catch (e) {
      console.error('Verify error:', e);
    }
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportLocation || !reportDesc) return;

    try {
      setSubmittingReport(true);
      const res = await fetch('/api/citizen/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: reportAuthor || 'Concerned Citizen',
          phone: reportPhone,
          location: reportLocation,
          waterDepthCm: reportDepth,
          hazardType: reportHazard,
          description: reportDesc,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReports((prev) => [data.report, ...prev]);
        setReportFeedback('Incident observation submitted and broadcast to municipal response teams!');
        setShowReportModal(false);
        setReportDesc('');
        setReportLocation('');
        setTimeout(() => setReportFeedback(null), 6000);
      }
    } catch (err) {
      setReportFeedback('Error submitting report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSubmitMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/maintenance/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: maintNodeId,
          operatorName: maintOperator,
          batteryStatus: maintBattery,
          physicalDamage: maintDamage,
          trashScreenCleaned: maintTrashCleaned,
          notes: maintNotes,
          status: 'verified',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMaintenanceLogs((prev) => [data.maintenanceLog, ...prev]);
        setShowMaintForm(false);
      }
    } catch (e) {
      console.error('Maintenance submit error:', e);
    }
  };

  const handleGenerateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName || !newKeyOrg) return;

    try {
      const res = await fetch('/api/keys/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newKeyName,
          organization: newKeyOrg,
          rateLimitPerMin: 120,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setApiKeys((prev) => [data.key, ...prev]);
        setNewKeyName('');
        setNewKeyOrg('');
      }
    } catch (e) {
      console.error('Key gen error:', e);
    }
  };

  const handleCopyKey = (keyString: string, id: string) => {
    navigator.clipboard.writeText(keyString);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 3000);
  };

  const filteredZones = zones.filter(
    (z) =>
      z.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      z.wardNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const waterLevel = currentRecord ? currentRecord.waterLevel : 265;
  const isOverallCritical = waterLevel >= config.criticalThreshold;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Low-Bandwidth Citizen Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider font-semibold">
              Tab 5: Public Citizen Portal &amp; Municipality Management
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Offline-Ready Mirror • LoRa Gateway Synced</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          Public Flood Emergency Advisory &amp; Field Coordination
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
          Autonomous public portal designed to load instantaneously on 2G/EDGE networks during regional cellular blackouts. Includes crowdsourced hazard reporting, real-time shelter bed counts, technician maintenance ledgers, and open developer APIs.
        </p>

        {/* Current Basin Stage Alert */}
        <div
          className={`mt-4 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
            isOverallCritical
              ? 'bg-rose-950/80 border-rose-700 text-rose-200'
              : 'bg-slate-800/80 border-slate-700 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isOverallCritical ? 'bg-rose-600 text-white animate-pulse' : 'bg-blue-600 text-white'}`}>
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-white">
                Main River Basin Stage: <span className="font-mono text-lg">{waterLevel} cm</span>
              </div>
              <p className="text-xs opacity-80">
                Critical Danger Line is {config.criticalThreshold} cm. Rate of rise: +{currentRecord?.rateOfRise || 2.1} cm/min.
              </p>
            </div>
          </div>

          <span
            className={`px-3 py-1 rounded-full text-xs font-bold uppercase font-mono ${
              isOverallCritical ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white'
            }`}
          >
            {isOverallCritical ? 'RED ALERT: EVACUATION' : 'MONITORING ACTIVE'}
          </span>
        </div>
      </div>

      {reportFeedback && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{reportFeedback}</span>
        </div>
      )}

      {/* Tab Selector */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 pb-2 text-xs font-semibold scrollbar-none">
        <button
          onClick={() => setActiveTab('risk')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'risk' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Neighborhood Flood Risk</span>
        </button>

        <button
          onClick={() => setActiveTab('crowdsource')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'crowdsource' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Crowdsourced Reports ({reports.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('shelters')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'shelters' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Relief Shelters ({shelters.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('maintenance')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'maintenance' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Field Maintenance ({maintenanceLogs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'api' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Public APIs &amp; Webhooks</span>
        </button>
      </div>

      {/* SECTION 1: NEIGHBORHOOD RISK & EVACUATION HAVENS */}
      {activeTab === 'risk' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Check Your Neighborhood / Ward Risk</h2>
              <p className="text-xs text-slate-500">
                Type your ward number or colony name to view immediate inundation depth and designated safe havens.
              </p>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                placeholder="Search Ward 4, Riverside, Model Town, Industrial Sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
              />
            </div>

            {/* Neighborhood Risk Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {filteredZones.map((zone) => {
                const isDanger = zone.riskLevel === 'danger';
                const isBeware = zone.riskLevel === 'beware';

                return (
                  <div
                    key={zone.id}
                    className={`p-4 rounded-xl border transition ${
                      isDanger
                        ? 'border-rose-300 bg-rose-50/70 shadow-xs'
                        : isBeware
                        ? 'border-amber-300 bg-amber-50/70'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                          {zone.wardNumber}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm mt-1">{zone.name}</h3>
                        <p className="text-xs text-slate-500">Ground Elevation: {zone.elevationMeters}m</p>
                      </div>

                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase font-mono ${
                          isDanger
                            ? 'bg-rose-600 text-white animate-pulse'
                            : isBeware
                            ? 'bg-amber-500 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        {zone.riskLevel}
                      </span>
                    </div>

                    <div className="mt-3 p-3 rounded-lg bg-white/90 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Expected Street Water Depth:</span>
                        <strong className={`font-mono text-sm ${isDanger ? 'text-rose-600 font-extrabold' : 'text-slate-800'}`}>
                          {zone.waterDepthCm} cm
                        </strong>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        <span>Designated Evacuation Haven:</span>
                      </div>
                      <div className="font-medium text-slate-900 pl-5">{zone.evacuationHaven}</div>
                      <div className="text-[11px] text-slate-500 pl-5 flex items-center gap-2">
                        <span>Distance: <strong>{zone.evacuationDistanceKm} km</strong></span>
                        <span>•</span>
                        <span className="text-emerald-700 font-medium">Safe Highland Zone</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emergency Helpline Contacts */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-rose-600" />
              <span>One-Touch Emergency Helplines &amp; Disaster Centers</span>
            </h2>
            <p className="text-xs text-slate-500">
              Toll-free emergency numbers accessible 24x7. Satellite backup links active.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <a
                href="tel:112"
                className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-semibold text-rose-600 uppercase">National Helpline</span>
                  <div className="text-xl font-black font-mono text-slate-900 mt-0.5">112</div>
                </div>
                <span className="text-[11px] text-rose-700 font-medium mt-2 flex items-center gap-1">
                  Tap to Dial <PhoneCall className="w-3 h-3" />
                </span>
              </a>

              <a
                href="tel:1077"
                className="p-3.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 transition flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-semibold text-blue-600 uppercase">District Disaster Control</span>
                  <div className="text-xl font-black font-mono text-slate-900 mt-0.5">1077</div>
                </div>
                <span className="text-[11px] text-blue-700 font-medium mt-2 flex items-center gap-1">
                  Tap to Dial <PhoneCall className="w-3 h-3" />
                </span>
              </a>

              <a
                href="tel:108"
                className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-semibold text-emerald-600 uppercase">Emergency Ambulance</span>
                  <div className="text-xl font-black font-mono text-slate-900 mt-0.5">108</div>
                </div>
                <span className="text-[11px] text-emerald-700 font-medium mt-2 flex items-center gap-1">
                  Tap to Dial <PhoneCall className="w-3 h-3" />
                </span>
              </a>

              <a
                href="tel:1070"
                className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition flex flex-col justify-between"
              >
                <div>
                  <span className="text-[11px] font-semibold text-amber-700 uppercase">State Disaster Response</span>
                  <div className="text-xl font-black font-mono text-slate-900 mt-0.5">1070</div>
                </div>
                <span className="text-[11px] text-amber-800 font-medium mt-2 flex items-center gap-1">
                  Tap to Dial <PhoneCall className="w-3 h-3" />
                </span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CROWDSOURCED HAZARD REPORTING */}
      {activeTab === 'crowdsource' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Crowdsourced Field Hazard Observations</h2>
              <p className="text-xs text-slate-500">
                Citizen volunteers and ward wardens submit ground observations. Verified by municipal responders.
              </p>
            </div>

            <button
              onClick={() => setShowReportModal(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Report Local Inundation / Choke</span>
            </button>
          </div>

          {/* Submission Modal Form */}
          {showReportModal && (
            <form
              onSubmit={handleSubmitReport}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Submit Field Observation</h3>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Your Name / Call Sign:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Chandra (Civil Defense)"
                    value={reportAuthor}
                    onChange={(e) => setReportAuthor(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number (Optional):</label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={reportPhone}
                    onChange={(e) => setReportPhone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Exact Location / Landmark:</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Underpass Bridge, Sector 4 East Ramp"
                    value={reportLocation}
                    onChange={(e) => setReportLocation(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Water Depth (cm):</label>
                  <input
                    type="number"
                    min={0}
                    max={500}
                    value={reportDepth}
                    onChange={(e) => setReportDepth(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Hazard Category:</label>
                  <select
                    value={reportHazard}
                    onChange={(e) => setReportHazard(e.target.value as any)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="waterlogged_road">Waterlogged Roadway / Causeway Submerged</option>
                    <option value="culvert_choked">Culvert Trash Screen Blocked / Choked Drain</option>
                    <option value="stranded_citizens">Stranded Citizens / Need Boat Evacuation</option>
                    <option value="powerline_down">Submerged Powerline / Transformer Hazard</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Observation Description:</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Describe vehicle blockages, rate of rise, or trapped citizens..."
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
                >
                  {submittingReport ? 'Submitting...' : 'Transmit Report'}
                </button>
              </div>
            </form>
          )}

          {/* Reports List */}
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{report.location}</span>
                      {report.verified ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Verified by NDRF</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                          Pending Field Verification
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Reported by {report.author} &bull; {report.timestamp}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-mono text-rose-600 font-extrabold text-sm">{report.waterDepthCm} cm depth</span>
                  </div>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{report.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                    Type: <span className="text-slate-800">{report.hazardType.replace('_', ' ')}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(report.location)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-semibold flex items-center gap-1 transition"
                      title="Locate Hazard on Google Maps"
                    >
                      <Compass className="w-3 h-3" />
                      <span>Google Maps</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>

                    {userRole !== 'citizen' && !report.verified && (
                      <button
                        onClick={() => handleVerifyReport(report.id)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[11px] font-semibold transition"
                      >
                        Verify Report
                      </button>
                    )}

                    <button
                      onClick={() => handleUpvote(report.id)}
                      className="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1 transition"
                    >
                      <ThumbsUp className="w-3 h-3 text-blue-600" />
                      <span>{report.upvotes} Confirmations</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: RELIEF SHELTERS & RELIEF CAMPS */}
      {activeTab === 'shelters' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Relief Camps &amp; Highland Evacuation Shelters</h2>
            <p className="text-xs text-slate-500">
              Live capacity monitoring, bed occupancy rates, medical staff availability, and food ration buffer status.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {shelters.map((shelter) => {
              const occupancyRatio = Math.round((shelter.currentOccupancy / shelter.capacityBeds) * 100);
              const isFull = occupancyRatio >= 90;

              return (
                <div
                  key={shelter.id}
                  className="p-5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700">
                        Elev: {shelter.elevationMeters}m MSL
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isFull ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {isFull ? 'Near Capacity' : 'Beds Open'}
                      </span>
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{shelter.name}</h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{shelter.location}</span>
                    </p>

                    {/* Bed Capacity Progress */}
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600">Bed Occupancy:</span>
                        <strong className="font-mono text-slate-900">
                          {shelter.currentOccupancy} / {shelter.capacityBeds} beds ({occupancyRatio}%)
                        </strong>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isFull ? 'bg-rose-500' : occupancyRatio > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${occupancyRatio}%` }}
                        ></div>
                      </div>
                    </div>

                    {/* Supply Stats */}
                    <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase">Food Rations</span>
                        <div className="font-bold text-slate-800">{shelter.foodRationsDays} Days Stock</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        <span className="text-[10px] text-slate-400 uppercase">Medical Team</span>
                        <div className="font-bold text-slate-800">
                          {shelter.medicalTeamOnsite ? 'Onsite (24x7)' : 'On Call'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Nodal Officer Contact & Google Maps Directions */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="text-[11px] text-slate-500">
                      Nodal: <strong className="text-slate-700">{shelter.contactPerson}</strong>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <a
                        href={`tel:${shelter.contactPhone.replace(/\s+/g, '')}`}
                        className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Call</span>
                      </a>
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(shelter.location + ', ' + shelter.name)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Directions</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 4: FIELD TECHNICIAN MAINTENANCE LOGGING */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-slate-900 text-base">Field Hardware Maintenance Ledger</h2>
              <p className="text-xs text-slate-500">
                Log physical culvert trash grate clearance, sensor lens cleaning, and battery health inspections.
              </p>
            </div>

            <button
              onClick={() => setShowMaintForm(true)}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Log Field Inspection</span>
            </button>
          </div>

          {showMaintForm && (
            <form
              onSubmit={handleSubmitMaintenance}
              className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">New Field Technician Inspection Entry</h3>
                <button
                  type="button"
                  onClick={() => setShowMaintForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Node ID:</label>
                  <select
                    value={maintNodeId}
                    onChange={(e) => setMaintNodeId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  >
                    <option value="CULVERT-G3-NORTH">CULVERT-G3-NORTH (Sector 4 Culvert)</option>
                    <option value="LORA-NODE-01">LORA-NODE-01 (Upper Watershed Gauge)</option>
                    <option value="LORA-NODE-04-SPILL">LORA-NODE-04-SPILL (East Retention Spillway)</option>
                    <option value="GW-LORA-915-ALPHA">GW-LORA-915-ALPHA (Central Gateway Tower)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Inspector / Technician Name:</label>
                  <input
                    type="text"
                    required
                    value={maintOperator}
                    onChange={(e) => setMaintOperator(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Battery Condition:</label>
                  <input
                    type="text"
                    value={maintBattery}
                    onChange={(e) => setMaintBattery(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={maintTrashCleaned}
                      onChange={(e) => setMaintTrashCleaned(e.target.checked)}
                      className="rounded text-blue-600 w-4 h-4"
                    />
                    <span>Trash Screen Cleared</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={maintDamage}
                      onChange={(e) => setMaintDamage(e.target.checked)}
                      className="rounded text-rose-600 w-4 h-4"
                    />
                    <span>Damage Detected</span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">Technician Notes:</label>
                  <textarea
                    rows={2}
                    value={maintNotes}
                    onChange={(e) => setMaintNotes(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                >
                  Save Log Entry
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-4">Log ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Hardware Node</th>
                  <th className="py-2.5 px-4">Technician</th>
                  <th className="py-2.5 px-4">Battery Health</th>
                  <th className="py-2.5 px-4">Screen Cleaned</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {maintenanceLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{log.id}</td>
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{log.timestamp}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-700">{log.nodeId}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{log.operatorName}</td>
                    <td className="py-2.5 px-4 text-slate-600">{log.batteryStatus}</td>
                    <td className="py-2.5 px-4">
                      {log.trashScreenCleaned ? (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-slate-400">No</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate">{log.notes}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 5: PUBLIC APIS & WEBHOOKS */}
      {activeTab === 'api' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-6">
          <div>
            <h2 className="font-bold text-slate-900 text-base">Public Municipal API &amp; Developer Integration</h2>
            <p className="text-xs text-slate-500">
              Generate bearer tokens for open-source flood early warning feeds, IMD hydrology integration, and news broadcast feeds.
            </p>
          </div>

          {/* New API Key Form */}
          <form
            onSubmit={handleGenerateApiKey}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-end gap-3 text-xs"
          >
            <div className="flex-1 w-full">
              <label className="block font-semibold text-slate-700 mb-1">Key Description / Purpose:</label>
              <input
                type="text"
                required
                placeholder="e.g. University Hydrology Research Lab Ingest"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              />
            </div>

            <div className="flex-1 w-full">
              <label className="block font-semibold text-slate-700 mb-1">Organization / Developer:</label>
              <input
                type="text"
                required
                placeholder="e.g. IIT Delhi Flood Study Group"
                value={newKeyOrg}
                onChange={(e) => setNewKeyOrg(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 bg-white"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold whitespace-nowrap shadow-xs"
            >
              Generate Live API Key
            </button>
          </form>

          {/* Existing Keys Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600">
                <tr>
                  <th className="py-2.5 px-4">Key ID</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Organization</th>
                  <th className="py-2.5 px-4">Bearer Key Secret</th>
                  <th className="py-2.5 px-4">Rate Limit</th>
                  <th className="py-2.5 px-4">Requests Count</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {apiKeys.map((key) => (
                  <tr key={key.id} className="hover:bg-slate-50 font-sans">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{key.id}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">{key.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{key.organization}</td>
                    <td className="py-2.5 px-4 font-mono text-[11px] text-slate-700">
                      <div className="flex items-center gap-2">
                        <span>{key.key}</span>
                        <button
                          type="button"
                          onClick={() => handleCopyKey(key.key, key.id)}
                          className="text-slate-400 hover:text-blue-600 p-1"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        {copiedKeyId === key.id && (
                          <span className="text-emerald-600 text-[10px] font-bold">Copied</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{key.rateLimitPerMin} req/min</td>
                    <td className="py-2.5 px-4 font-mono">{key.requestsCount.toLocaleString()}</td>
                    <td className="py-2.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {key.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* cURL Example */}
          <div className="p-4 rounded-xl bg-slate-900 text-slate-100 text-xs font-mono space-y-2 border border-slate-800">
            <div className="text-emerald-400 font-bold">Public Telemetry Ingest Endpoint (cURL Example):</div>
            <pre className="text-slate-300 overflow-x-auto text-[11px]">
{`curl -X GET "https://floodguard.sih.gov.in/api/telemetry/latest" \\
  -H "Authorization: Bearer fl_live_sdma_99f2b881c002e" \\
  -H "Accept: application/json"`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
