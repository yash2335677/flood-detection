import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  ExternalLink,
  Navigation,
  Layers,
  Radio,
  Eye,
  AlertTriangle,
  CheckCircle,
  ShieldAlert,
  Hospital,
  ArrowUpRight,
  Maximize2,
  Minimize2,
  Compass,
  Key,
  Info,
  Sparkles,
} from 'lucide-react';
import { PhysicalNode, FloodRiskZone, FloodConfig, EvacuationRoute } from '../types';

export interface ReliefHaven {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevationMsl: number;
  bedCapacity: number;
  currentOccupancy: number;
  nodalOfficer: string;
  phone: string;
  status: 'active_accepting' | 'near_capacity' | 'standby';
  suppliesDays: number;
}

export const defaultReliefHavens: ReliefHaven[] = [
  {
    id: 'HAVEN-01',
    name: 'Govt Model Senior Secondary School (Ridge Campus)',
    lat: 28.6265,
    lng: 77.208,
    elevationMsl: 184,
    bedCapacity: 450,
    currentOccupancy: 180,
    nodalOfficer: 'Shri R. K. Verma (SDM Central)',
    phone: '+91 98765 43210',
    status: 'active_accepting',
    suppliesDays: 8,
  },
  {
    id: 'HAVEN-02',
    name: 'Central Sports Complex Indoor Pavilion #2',
    lat: 28.621,
    lng: 77.23,
    elevationMsl: 172,
    bedCapacity: 800,
    currentOccupancy: 320,
    nodalOfficer: 'Dr. Neha Sharma (Health Dept)',
    phone: '+91 98111 22334',
    status: 'active_accepting',
    suppliesDays: 12,
  },
  {
    id: 'HAVEN-03',
    name: 'District Polytechnic Multi-Purpose Hall',
    lat: 28.599,
    lng: 77.2255,
    elevationMsl: 165,
    bedCapacity: 300,
    currentOccupancy: 95,
    nodalOfficer: 'Capt. A. Sen (Civil Defence)',
    phone: '+91 98222 33445',
    status: 'active_accepting',
    suppliesDays: 5,
  },
  {
    id: 'HAVEN-04',
    name: 'Red Cross Flood Transit Shelter (Sector 9)',
    lat: 28.6295,
    lng: 77.215,
    elevationMsl: 191,
    bedCapacity: 250,
    currentOccupancy: 40,
    nodalOfficer: 'Ms. Sunita Roy (Red Cross Lead)',
    phone: '+91 98333 44556',
    status: 'active_accepting',
    suppliesDays: 14,
  },
];

interface GoogleMapsFloodLayerProps {
  nodes: PhysicalNode[];
  zones: FloodRiskZone[];
  routes: EvacuationRoute[];
  config: FloodConfig;
  havens?: ReliefHaven[];
  selectedNodeId?: string | null;
  onSelectNode?: (node: PhysicalNode) => void;
  onSelectZone?: (zone: FloodRiskZone) => void;
  onSelectHaven?: (haven: ReliefHaven) => void;
  height?: string;
}

// Helper component to programmatically pan/fit bounds
const MapBoundsController: React.FC<{
  fitAllTrigger: number;
  nodes: PhysicalNode[];
  zones: FloodRiskZone[];
  routes: EvacuationRoute[];
  havens: ReliefHaven[];
}> = ({ fitAllTrigger, nodes, zones, routes, havens }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (fitAllTrigger > 0) {
      if (typeof window !== 'undefined' && (window as any).google?.maps?.LatLngBounds) {
        const bounds = new (window as any).google.maps.LatLngBounds();

        // Add all node coordinates
        nodes.forEach((n) => bounds.extend({ lat: n.lat, lng: n.lng }));

        // Add all zone coordinates
        zones.forEach((z) => {
          z.coordinates.forEach((coord) => bounds.extend({ lat: coord[0], lng: coord[1] }));
        });

        // Add all evacuation route waypoints
        routes.forEach((r) => {
          r.waypoints.forEach((wp) => bounds.extend({ lat: wp[0], lng: wp[1] }));
        });

        // Add all havens
        havens.forEach((h) => bounds.extend({ lat: h.lat, lng: h.lng }));

        map.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 });
      }
    }
  }, [fitAllTrigger, map, nodes, zones, routes, havens]);

  return null;
};

export const GoogleMapsFloodLayer: React.FC<GoogleMapsFloodLayerProps> = ({
  nodes,
  zones,
  routes,
  config,
  havens = defaultReliefHavens,
  selectedNodeId,
  onSelectNode,
  onSelectZone,
  onSelectHaven,
  height = '620px',
}) => {
  // Read API Key from environment or local storage fallback
  const envApiKey = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GOOGLE_MAPS_API_KEY as string) || '';
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('floodguard_gmaps_key') || envApiKey;
    }
    return envApiKey;
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState(userApiKey);

  // Map settings
  const [mapTypeId, setMapTypeId] = useState<'hybrid' | 'roadmap' | 'satellite' | 'terrain'>('hybrid');
  const [activeOverlayType, setActiveOverlayType] = useState<'all' | 'nodes' | 'zones' | 'routes' | 'havens'>('all');
  const [fitAllCounter, setFitAllCounter] = useState(1);

  // Layer filter switches
  const [showNodesLayer, setShowNodesLayer] = useState(true);
  const [showZonesLayer, setShowZonesLayer] = useState(true);
  const [showRoutesLayer, setShowRoutesLayer] = useState(true);
  const [showHavensLayer, setShowHavensLayer] = useState(true);

  // InfoWindow selected items
  const [activeInfoNode, setActiveInfoNode] = useState<PhysicalNode | null>(null);
  const [activeInfoHaven, setActiveInfoHaven] = useState<ReliefHaven | null>(null);
  const [activeInfoZone, setActiveInfoZone] = useState<FloodRiskZone | null>(null);
  const [activeInfoRoute, setActiveInfoRoute] = useState<EvacuationRoute | null>(null);

  // Center on watershed
  const defaultCenter = useMemo(() => ({ lat: 28.6145, lng: 77.2185 }), []);

  // Update selection from props
  useEffect(() => {
    if (selectedNodeId) {
      const match = nodes.find((n) => n.id === selectedNodeId);
      if (match) setActiveInfoNode(match);
    }
  }, [selectedNodeId, nodes]);

  // Master "SHOW ALL OF THEM" handler
  const handleShowAllOfThem = useCallback(() => {
    setShowNodesLayer(true);
    setShowZonesLayer(true);
    setShowRoutesLayer(true);
    setShowHavensLayer(true);
    setActiveOverlayType('all');
    setFitAllCounter((prev) => prev + 1);
  }, []);

  const saveApiKey = (key: string) => {
    const trimmed = key.trim();
    setUserApiKey(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('floodguard_gmaps_key', trimmed);
    }
    setShowKeyModal(false);
  };

  // Construct a Google Maps Directions URL linking all critical nodes & safe haven
  const multiPointGoogleMapsUrl = useMemo(() => {
    const origin = `${nodes[0]?.lat || 28.6145},${nodes[0]?.lng || 77.2085}`;
    const destination = `${havens[0]?.lat || 28.6265},${havens[0]?.lng || 77.208}`;
    const waypoints = nodes
      .slice(1, 4)
      .map((n) => `${n.lat},${n.lng}`)
      .join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
  }, [nodes, havens]);

  // Total assets count
  const totalAssetsCount = nodes.length + zones.length + routes.length + havens.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Top Header Controls Bar */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                Google Maps Live Command Grid
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                {totalAssetsCount} Assets Synced
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live photorealistic satellite, topographic contours, and instant turn-by-turn routing navigation.
            </p>
          </div>
        </div>

        {/* Master "SHOW ALL OF THEM" button & Map Style Selectors */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleShowAllOfThem}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold shadow-sm hover:from-blue-700 hover:to-indigo-700 transition"
            title="Fit bounds and show all nodes, risk zones, evacuation routes, and relief havens"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>SHOW ALL OF THEM</span>
          </button>

          {/* Map Type Buttons */}
          <div className="bg-white border border-slate-200 rounded-xl p-0.5 flex items-center text-xs font-medium">
            <button
              onClick={() => setMapTypeId('hybrid')}
              className={`px-2.5 py-1 rounded-lg transition ${
                mapTypeId === 'hybrid' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Hybrid
            </button>
            <button
              onClick={() => setMapTypeId('satellite')}
              className={`px-2.5 py-1 rounded-lg transition ${
                mapTypeId === 'satellite' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapTypeId('terrain')}
              className={`px-2.5 py-1 rounded-lg transition ${
                mapTypeId === 'terrain' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terrain
            </button>
            <button
              onClick={() => setMapTypeId('roadmap')}
              className={`px-2.5 py-1 rounded-lg transition ${
                mapTypeId === 'roadmap' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Roadmap
            </button>
          </div>

          {/* External Google Maps Itinerary Link */}
          <a
            href={multiPointGoogleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-2xs transition"
            title="Open comprehensive watershed route in Google Maps app"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
            <span>Open in Google Maps</span>
          </a>

          {/* API Key Configure Button */}
          <button
            onClick={() => setShowKeyModal(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            title="Configure Google Maps API Key or Demo Key"
          >
            <Key className="w-3.5 h-3.5 text-amber-600" />
            <span>{userApiKey ? 'Key Configured' : 'Maps Key'}</span>
          </button>
        </div>
      </div>

      {/* Layer Toggles & Status Sub-strip */}
      <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-600 uppercase tracking-wider text-[10px]">Layers:</span>

          <button
            onClick={() => setShowNodesLayer(!showNodesLayer)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition flex items-center gap-1.5 ${
              showNodesLayer
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : 'bg-white border-slate-200 text-slate-400 line-through'
            }`}
          >
            <Radio className="w-3 h-3 text-blue-600" />
            <span>LoRa Nodes ({nodes.length})</span>
          </button>

          <button
            onClick={() => setShowZonesLayer(!showZonesLayer)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition flex items-center gap-1.5 ${
              showZonesLayer
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-white border-slate-200 text-slate-400 line-through'
            }`}
          >
            <ShieldAlert className="w-3 h-3 text-amber-600" />
            <span>Risk Zones ({zones.length})</span>
          </button>

          <button
            onClick={() => setShowRoutesLayer(!showRoutesLayer)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition flex items-center gap-1.5 ${
              showRoutesLayer
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-white border-slate-200 text-slate-400 line-through'
            }`}
          >
            <Navigation className="w-3 h-3 text-emerald-600" />
            <span>Evac Corridors ({routes.length})</span>
          </button>

          <button
            onClick={() => setShowHavensLayer(!showHavensLayer)}
            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition flex items-center gap-1.5 ${
              showHavensLayer
                ? 'bg-purple-50 border-purple-200 text-purple-800'
                : 'bg-white border-slate-200 text-slate-400 line-through'
            }`}
          >
            <Hospital className="w-3 h-3 text-purple-600" />
            <span>Relief Havens ({havens.length})</span>
          </button>
        </div>

        {/* Rapid Stat Indicator */}
        <div className="flex items-center gap-3 text-slate-500 text-[11px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            Critical: {nodes.filter((n) => n.status === 'critical' || n.trashScreenBlocked).length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Warning: {nodes.filter((n) => n.status === 'warning').length}
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Safe: {nodes.filter((n) => n.status === 'online').length}
          </span>
        </div>
      </div>

      {/* Main Map Container */}
      <div className="relative w-full" style={{ height }}>
        {userApiKey ? (
          <APIProvider apiKey={userApiKey}>
            <Map
              style={{ width: '100%', height: '100%' }}
              defaultCenter={defaultCenter}
              defaultZoom={14}
              mapTypeId={mapTypeId}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              gestureHandling="greedy"
              disableDefaultUI={false}
            >
              {/* Automated Bounds Controller */}
              <MapBoundsController
                fitAllTrigger={fitAllCounter}
                nodes={nodes}
                zones={zones}
                routes={routes}
                havens={havens}
              />

              {/* 1. PHYSICAL LORA NODES */}
              {showNodesLayer &&
                nodes.map((node) => {
                  const isCrit = node.status === 'critical' || node.trashScreenBlocked;
                  const isWarn = node.status === 'warning';
                  const pinBg = isCrit ? '#ef4444' : isWarn ? '#f59e0b' : '#3b82f6';
                  const pinGlyph = isCrit ? '⚠️' : node.type === 'culvert_gate' ? '🚪' : '🌊';

                  return (
                    <AdvancedMarker
                      key={node.id}
                      position={{ lat: node.lat, lng: node.lng }}
                      title={`${node.name} (${node.waterLevel}cm)`}
                      onClick={() => {
                        setActiveInfoNode(node);
                        setActiveInfoHaven(null);
                        setActiveInfoZone(null);
                        if (onSelectNode) onSelectNode(node);
                      }}
                    >
                      <Pin
                        background={pinBg}
                        borderColor="#ffffff"
                        glyphColor="#ffffff"
                        glyph={pinGlyph}
                        scale={isCrit ? 1.25 : 1.1}
                      />
                    </AdvancedMarker>
                  );
                })}

              {/* 2. RELIEF HAVENS & SHELTERS */}
              {showHavensLayer &&
                havens.map((haven) => (
                  <AdvancedMarker
                    key={haven.id}
                    position={{ lat: haven.lat, lng: haven.lng }}
                    title={`Relief Haven: ${haven.name}`}
                    onClick={() => {
                      setActiveInfoHaven(haven);
                      setActiveInfoNode(null);
                      setActiveInfoZone(null);
                      if (onSelectHaven) onSelectHaven(haven);
                    }}
                  >
                    <Pin
                      background="#8b5cf6"
                      borderColor="#ffffff"
                      glyphColor="#ffffff"
                      glyph="🏥"
                      scale={1.2}
                    />
                  </AdvancedMarker>
                ))}

              {/* 3. EVACUATION ROUTE DESTINATION WAYPOINTS */}
              {showRoutesLayer &&
                routes.map((route) => {
                  const dest = route.waypoints[route.waypoints.length - 1];
                  const isCompromised = route.status === 'blocked';
                  return (
                    <AdvancedMarker
                      key={route.id}
                      position={{ lat: dest[0], lng: dest[1] }}
                      title={`Route Haven: ${route.destinationHaven}`}
                      onClick={() => {
                        setActiveInfoRoute(route);
                      }}
                    >
                      <Pin
                        background={isCompromised ? '#dc2626' : '#10b981'}
                        borderColor="#ffffff"
                        glyphColor="#ffffff"
                        glyph="📍"
                        scale={1.0}
                      />
                    </AdvancedMarker>
                  );
                })}

              {/* InfoWindow for Selected Node */}
              {activeInfoNode && (
                <InfoWindow
                  position={{ lat: activeInfoNode.lat, lng: activeInfoNode.lng }}
                  onCloseClick={() => setActiveInfoNode(null)}
                >
                  <div className="p-2 max-w-xs text-slate-900 font-sans">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1.5 mb-2">
                      <div>
                        <span className="text-[10px] font-mono text-slate-500 uppercase">{activeInfoNode.id}</span>
                        <h4 className="font-bold text-xs text-slate-900 leading-snug">{activeInfoNode.name}</h4>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                          activeInfoNode.status === 'critical' || activeInfoNode.trashScreenBlocked
                            ? 'bg-red-100 text-red-700'
                            : activeInfoNode.status === 'warning'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {activeInfoNode.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Water Level</span>
                        <span className="font-bold text-slate-900 text-sm">{activeInfoNode.waterLevel} cm</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Rate of Rise</span>
                        <span className="font-bold text-slate-900 text-sm">+{activeInfoNode.rateOfRise} cm/m</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Flow Velocity</span>
                        <span className="font-semibold text-slate-800">{activeInfoNode.flowVelocity} m/s</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Battery & RF</span>
                        <span className="font-semibold text-slate-800">
                          {activeInfoNode.batteryPercent}% ({activeInfoNode.rssi}dBm)
                        </span>
                      </div>
                    </div>

                    {activeInfoNode.trashScreenBlocked && (
                      <div className="mb-2 p-1.5 bg-red-50 border border-red-200 rounded text-[10px] text-red-700 font-medium flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                        <span>Trash screen choked (blockage {activeInfoNode.blockageRatio}%).</span>
                      </div>
                    )}

                    {/* Google Maps Actions */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${activeInfoNode.lat},${activeInfoNode.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center px-2 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open in GMaps</span>
                      </a>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${activeInfoNode.lat},${activeInfoNode.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-semibold transition flex items-center gap-1"
                        title="Get turn-by-turn driving directions to this sensor"
                      >
                        <Navigation className="w-3 h-3 text-emerald-400" />
                        <span>Directions</span>
                      </a>

                      <a
                        href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${activeInfoNode.lat},${activeInfoNode.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                        title="View Street View 360 panorama"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </InfoWindow>
              )}

              {/* InfoWindow for Selected Haven */}
              {activeInfoHaven && (
                <InfoWindow
                  position={{ lat: activeInfoHaven.lat, lng: activeInfoHaven.lng }}
                  onCloseClick={() => setActiveInfoHaven(null)}
                >
                  <div className="p-2 max-w-xs text-slate-900 font-sans">
                    <div className="flex items-center justify-between gap-1 border-b border-purple-100 pb-1.5 mb-2">
                      <div className="flex items-center gap-1.5">
                        <Hospital className="w-4 h-4 text-purple-600" />
                        <h4 className="font-bold text-xs text-slate-900">{activeInfoHaven.name}</h4>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                        Haven
                      </span>
                    </div>

                    <div className="text-[11px] space-y-1 mb-2.5">
                      <div className="flex justify-between text-slate-600">
                        <span>Elevation (MSL):</span>
                        <span className="font-bold text-emerald-700">+{activeInfoHaven.elevationMsl}m (High Ground)</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Occupancy:</span>
                        <span className="font-semibold text-slate-900">
                          {activeInfoHaven.currentOccupancy} / {activeInfoHaven.bedCapacity} Beds
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Dry Food & Medical Rations:</span>
                        <span className="font-semibold text-slate-900">{activeInfoHaven.suppliesDays} Days</span>
                      </div>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
                        Officer: {activeInfoHaven.nodalOfficer} ({activeInfoHaven.phone})
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${activeInfoHaven.lat},${activeInfoHaven.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Navigate to Haven</span>
                      </a>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${activeInfoHaven.lat},${activeInfoHaven.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Maps</span>
                      </a>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>
        ) : (
          /* High-Utility Hybrid Satellite Fallback with Direct Google Maps Synchronization */
          <div className="w-full h-full bg-slate-900 text-white flex flex-col justify-between p-6 relative overflow-hidden">
            {/* Background Map Graphic / Satellite Simulator */}
            <div
              className="absolute inset-0 opacity-30 bg-cover bg-center pointer-events-none"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 50% 50%, #1e293b 10%, #0f172a 90%), linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                backgroundSize: '100% 100%, 40px 40px, 40px 40px',
              }}
            ></div>

            {/* Top Overlay with Direct Google Maps Launchers */}
            <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-800/90 backdrop-blur-md p-4 rounded-xl border border-slate-700 shadow-xl">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <h4 className="font-bold text-white text-sm">
                    Google Maps Direct Coordinates &amp; Live Satellite Sync
                  </h4>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  All {totalAssetsCount} physical LoRa telemetry nodes, culverts, flood risk contours, and relief havens are ready to explore in Google Maps.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={multiPointGoogleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5"
                >
                  <Navigation className="w-3.5 h-3.5 text-white" />
                  <span>Open Full Network in Google Maps</span>
                </a>
                <button
                  onClick={() => setShowKeyModal(true)}
                  className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition flex items-center gap-1"
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Activate Live Maps API</span>
                </button>
              </div>
            </div>

            {/* Center Interactive Asset Grid: "Show All of Them" Table/Cards */}
            <div className="relative z-10 my-4 overflow-y-auto max-h-[380px] bg-slate-800/60 rounded-xl border border-slate-700/80 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 px-2 py-1 font-semibold uppercase tracking-wider">
                <span>Asset ({totalAssetsCount} Total)</span>
                <span>Coordinates</span>
                <span>Status / Risk</span>
                <span>Google Maps Actions</span>
              </div>

              {/* LoRa Nodes */}
              {nodes.map((n) => (
                <div
                  key={n.id}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-700/60 flex items-center justify-between text-xs hover:border-blue-500/50 transition gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{n.type === 'culvert_gate' ? '🚪' : '🌊'}</span>
                    <div>
                      <div className="font-bold text-slate-200">{n.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {n.id} • Depth: <span className="text-blue-400 font-bold">{n.waterLevel}cm</span> (+{n.rateOfRise}cm/m)
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    {n.lat.toFixed(4)}, {n.lng.toFixed(4)}
                  </span>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                      n.status === 'critical' || n.trashScreenBlocked
                        ? 'bg-rose-950 text-rose-300 border border-rose-800'
                        : n.status === 'warning'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                    }`}
                  >
                    {n.trashScreenBlocked ? 'Choked' : n.status}
                  </span>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${n.lat},${n.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[10px] flex items-center gap-1 transition"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                      <span>View</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium text-[10px] flex items-center gap-1 transition"
                    >
                      <Navigation className="w-2.5 h-2.5 text-emerald-400" />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              ))}

              {/* Relief Havens */}
              {havens.map((h) => (
                <div
                  key={h.id}
                  className="p-2.5 rounded-lg bg-slate-900/80 border border-purple-900/40 flex items-center justify-between text-xs hover:border-purple-500/50 transition gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">🏥</span>
                    <div>
                      <div className="font-bold text-purple-300">{h.name}</div>
                      <div className="text-[10px] text-slate-400">
                        Cap: {h.bedCapacity} beds • Elevation: <span className="text-emerald-400 font-semibold">+{h.elevationMsl}m MSL</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
                    {h.lat.toFixed(4)}, {h.lng.toFixed(4)}
                  </span>

                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 font-semibold">
                    Safe Haven
                  </span>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] flex items-center gap-1 transition"
                    >
                      <Navigation className="w-2.5 h-2.5" />
                      <span>Navigate</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Tip for zero-cost Maps Demo Key */}
            <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800 pt-3">
              <span className="flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-400" />
                Want the live interactive WebGL Google Maps canvas? Click &quot;Activate Live Maps API&quot; and paste any key or free Maps Demo Key.
              </span>
              <a
                href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline font-semibold flex items-center gap-1"
              >
                <span>Get Free Demo Key (No Credit Card)</span>
                <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>

      {/* API Key Modal */}
      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Google Maps API Key</h4>
                  <p className="text-xs text-slate-500">Enable live interactive WebGL tiles and markers</p>
                </div>
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                className="text-slate-400 hover:text-slate-700 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              You can obtain a zero-cost <strong>Maps Demo Key</strong> without providing a credit card:
            </p>

            <a
              href="https://mapsplatform.google.com/maps-demo-key?utm_campaign=gmp_mcp_codeassist_v1_aistudio"
              target="_blank"
              rel="noopener noreferrer"
              className="mb-4 block p-3 rounded-xl bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-blue-900 text-xs font-semibold transition"
            >
              <div className="flex items-center justify-between">
                <span>1. Generate Free Maps Demo Key</span>
                <ArrowUpRight className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-[10px] text-blue-700 font-normal block mt-0.5">
                Takes 10 seconds via your Google Account — no billing setup required.
              </span>
            </a>

            <label className="block text-xs font-bold text-slate-700 mb-1">
              Enter / Paste Google Maps API Key or Demo Key:
            </label>
            <input
              type="text"
              value={tempKeyInput}
              onChange={(e) => setTempKeyInput(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => saveApiKey(tempKeyInput)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
              >
                Save &amp; Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
