import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Layers,
  Wifi,
  WifiOff,
  Battery,
  Sun,
  AlertTriangle,
  RefreshCw,
  ShieldAlert,
  ArrowUpRight,
  Radio,
  Sliders,
  CheckCircle,
  ExternalLink,
  Info,
  Camera,
  Eye,
  Clock,
  Gauge,
  Navigation,
  Sparkles,
  Hospital,
  Compass,
} from 'lucide-react';
import { PhysicalNode, FloodRiskZone, FloodConfig, EvacuationRoute } from '../types';
import { GoogleMapsFloodLayer, defaultReliefHavens, ReliefHaven } from './GoogleMapsFloodLayer';

interface GisCommandCenterProps {
  nodes: PhysicalNode[];
  zones: FloodRiskZone[];
  config: FloodConfig;
  routes?: EvacuationRoute[];
  onFlushCulvert?: (nodeId: string) => Promise<void>;
  onTriggerNodeSiren?: (nodeId: string) => void;
  userRole: 'admin' | 'ndrf' | 'citizen';
}

const defaultEvacuationRoutes: EvacuationRoute[] = [
  {
    id: 'ROUTE-01',
    name: 'Corridor Alpha: Lowland Riverbend to Model Ridge Haven',
    destinationHaven: 'Govt Model Senior Secondary School Ridge Campus',
    status: 'caution',
    distanceKm: 1.2,
    criticalNodesAlongRoute: ['CULVERT-G3-NORTH', 'LORA-NODE-01'],
    waypoints: [
      [28.618, 77.206],
      [28.6195, 77.211],
      [28.6212, 77.2188],
      [28.624, 77.214],
      [28.6265, 77.208],
    ],
  },
  {
    id: 'ROUTE-02',
    name: 'Corridor Beta: Market Basin Elevated Flyover Route',
    destinationHaven: 'Central Sports Complex Pavilion #2',
    status: 'clear',
    distanceKm: 1.8,
    criticalNodesAlongRoute: ['LORA-NODE-03-URBAN'],
    waypoints: [
      [28.6115, 77.214],
      [28.6148, 77.2215],
      [28.6182, 77.228],
      [28.621, 77.230],
    ],
  },
  {
    id: 'ROUTE-03',
    name: 'Corridor Gamma: Industrial Underpass Bypass (Low Elevation)',
    destinationHaven: 'District Polytechnic Multi-Purpose Hall',
    status: 'blocked',
    distanceKm: 0.9,
    criticalNodesAlongRoute: ['LORA-NODE-03-URBAN'],
    waypoints: [
      [28.6045, 77.216],
      [28.6078, 77.2235],
      [28.6025, 77.227],
      [28.599, 77.2255],
    ],
  },
];

export const GisCommandCenter: React.FC<GisCommandCenterProps> = ({
  nodes,
  zones,
  config,
  routes = defaultEvacuationRoutes,
  onFlushCulvert,
  onTriggerNodeSiren,
  userRole,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapEngine, setMapEngine] = useState<'google' | 'leaflet'>('google');
  const [offlineMode, setOfflineMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<PhysicalNode | null>(null);
  const [selectedZone, setSelectedZone] = useState<FloodRiskZone | null>(null);
  const [selectedHaven, setSelectedHaven] = useState<ReliefHaven | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'culverts' | 'gauges' | 'alarms'>('all');
  const [showAllAssetDirectory, setShowAllAssetDirectory] = useState(true);
  const [assetDirectoryFilter, setAssetDirectoryFilter] = useState<'all' | 'nodes' | 'zones' | 'routes' | 'havens'>('all');
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushSuccessMsg, setFlushSuccessMsg] = useState<string | null>(null);

  // Station Camera Mirror State
  const [cameraNightVision, setCameraNightVision] = useState(false);
  const [cameraSnapshotTaken, setCameraSnapshotTaken] = useState(false);
  const [cameraFeedTime, setCameraFeedTime] = useState<string>('');

  useEffect(() => {
    const timer = setInterval(() => {
      setCameraFeedTime(new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC+05:30');
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Leaflet Map when leaflet engine is selected
  useEffect(() => {
    if (mapEngine !== 'leaflet') {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      return;
    }

    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [28.6135, 77.2185],
        zoom: 14,
        zoomControl: true,
      });

      // Default Online Tile Layer
      const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors | LoRa Hydrology Mesh',
      }).addTo(map);

      tileLayerRef.current = tile;
      layerGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapEngine]);

  // Handle Offline / Online Tile Mode
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (offlineMode) {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      // Offline fallback: use high-contrast canvas tile generator or local cached pattern
      const offlineTile = L.tileLayer(
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="%230f172a"/><path d="M0 64h256M0 128h256M0 192h256M64 0v256M128 0v256M192 0v256" stroke="%231e293b" stroke-width="1"/><text x="12" y="24" fill="%23334155" font-family="monospace" font-size="10">LOCAL VECTOR TILE (OFFLINE MESH)</text></svg>',
        { maxZoom: 18 }
      ).addTo(map);
      tileLayerRef.current = offlineTile;
    } else {
      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }
      const onlineTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap | LoRa Mesh',
      }).addTo(map);
      tileLayerRef.current = onlineTile;
    }
  }, [offlineMode]);

  // Update Markers & Contours whenever telemetry or filter changes
  useEffect(() => {
    if (!mapInstanceRef.current || !layerGroupRef.current) return;
    const group = layerGroupRef.current;
    group.clearLayers();

    // 1. Draw Risk Zone Contours / Heatmap Polygons
    zones.forEach((zone) => {
      let fillColor = '#10b981'; // safe
      let strokeColor = '#059669';
      let fillOpacity = 0.22;

      if (zone.riskLevel === 'danger') {
        fillColor = '#ef4444';
        strokeColor = '#b91c1c';
        fillOpacity = 0.55;
      } else if (zone.riskLevel === 'beware') {
        fillColor = '#f59e0b';
        strokeColor = '#d97706';
        fillOpacity = 0.38;
      }

      const polygon = L.polygon(zone.coordinates, {
        color: strokeColor,
        weight: zone.riskLevel === 'danger' ? 3 : 2,
        dashArray: zone.riskLevel === 'danger' ? '6, 6' : undefined,
        fillColor,
        fillOpacity,
      });

      polygon.on('click', () => {
        setSelectedZone(zone);
        setSelectedNode(null);
      });

      polygon.bindTooltip(
        `<div class="text-xs font-semibold p-1">
          <div><strong>${zone.name}</strong> (${zone.wardNumber})</div>
          <div class="capitalize text-${zone.riskLevel === 'danger' ? 'red' : zone.riskLevel === 'beware' ? 'amber' : 'green'}-600">
            Risk: ${zone.riskLevel.toUpperCase()} • Inundation: ${zone.waterDepthCm}cm
          </div>
          <div class="text-[10px] text-slate-500">Pop: ${zone.populationAtRisk.toLocaleString()}</div>
        </div>`,
        { sticky: true }
      );

      group.addLayer(polygon);
    });

    // 2. Draw Physical LoRa Nodes & Culverts
    const filteredNodes = nodes.filter((node) => {
      if (activeFilter === 'culverts') return node.type === 'culvert_gate';
      if (activeFilter === 'gauges') return node.type === 'river_gauge' || node.type === 'urban_drain';
      if (activeFilter === 'alarms') return node.status === 'warning' || node.status === 'critical' || node.trashScreenBlocked;
      return true;
    });

    filteredNodes.forEach((node) => {
      let badgeColor = 'bg-blue-600';
      let borderClass = 'border-white';
      let pulseAnim = '';

      if (node.status === 'critical' || node.trashScreenBlocked) {
        badgeColor = 'bg-rose-600';
        borderClass = 'border-rose-200';
        pulseAnim = 'animate-bounce';
      } else if (node.status === 'warning') {
        badgeColor = 'bg-amber-500';
        borderClass = 'border-amber-200';
      }

      let typeIcon = '📡';
      if (node.type === 'culvert_gate') typeIcon = '🚪';
      else if (node.type === 'river_gauge') typeIcon = '🌊';
      else if (node.type === 'spillway') typeIcon = '⚡';
      else if (node.type === 'gateway') typeIcon = '🗼';

      const customIcon = L.divIcon({
        className: 'custom-lora-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer transform -translate-x-1/2 -translate-y-1/2">
            ${
              node.status === 'critical' || node.trashScreenBlocked
                ? '<span class="absolute w-10 h-10 rounded-full bg-rose-500/40 animate-ping"></span>'
                : ''
            }
            <div class="${badgeColor} ${borderClass} ${pulseAnim} text-white shadow-lg w-8 h-8 rounded-xl border-2 flex items-center justify-center text-sm font-bold">
              ${typeIcon}
            </div>
            <div class="absolute -bottom-5 bg-slate-900/90 text-white text-[9px] px-1.5 py-0.5 rounded shadow whitespace-nowrap font-mono">
              ${node.waterLevel ? `${node.waterLevel}cm` : node.id}
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([node.lat, node.lng], { icon: customIcon });
      marker.on('click', () => {
        setSelectedNode(node);
        setSelectedZone(null);
      });

      group.addLayer(marker);
    });

    // 3. Draw Dynamic Evacuation Route Vectors (Dynamic green/amber/red vector paths)
    routes.forEach((route) => {
      let routeColor = '#10b981'; // Green: Safe open route
      let dashPattern: string | undefined = undefined;
      let opacity = 0.85;

      if (route.status === 'blocked') {
        routeColor = '#ef4444'; // Red: Route compromised by floodwaters
        dashPattern = '8, 8';
        opacity = 0.95;
      } else if (route.status === 'caution') {
        routeColor = '#f59e0b'; // Amber: Near-threshold rising water
        dashPattern = '6, 6';
      }

      const polyline = L.polyline(route.waypoints, {
        color: routeColor,
        weight: 4,
        dashArray: dashPattern,
        opacity,
      });

      polyline.bindTooltip(
        `<div class="p-1 text-xs font-semibold">
          <div class="text-slate-900">${route.name}</div>
          <div class="capitalize text-${route.status === 'blocked' ? 'rose' : route.status === 'caution' ? 'amber' : 'emerald'}-600 font-bold">
            Vector Status: ${route.status.toUpperCase()} (${route.distanceKm} km)
          </div>
          <div class="text-[10px] text-slate-500 font-normal">Haven: ${route.destinationHaven}</div>
        </div>`,
        { sticky: true }
      );

      group.addLayer(polyline);

      // Add Haven destination marker pin
      const destinationPoint = route.waypoints[route.waypoints.length - 1];
      const havenBadge = L.divIcon({
        className: 'haven-pin-badge',
        html: `
          <div class="cursor-pointer transform -translate-x-1/2 -translate-y-1/2">
            <div class="px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md ${
              route.status === 'blocked' ? 'bg-rose-700 text-white' : 'bg-emerald-600 text-white'
            } border-2 border-white flex items-center gap-1 whitespace-nowrap font-mono">
              <span>🏥 Haven (${route.distanceKm}km)</span>
            </div>
          </div>
        `,
        iconSize: [80, 24],
        iconAnchor: [40, 12],
      });
      const havenMarker = L.marker(destinationPoint, { icon: havenBadge });
      group.addLayer(havenMarker);
    });
  }, [nodes, zones, routes, activeFilter]);

  const handleFlush = async (nodeId: string) => {
    if (!onFlushCulvert) return;
    try {
      setIsFlushing(true);
      await onFlushCulvert(nodeId);
      setFlushSuccessMsg('Hydraulic flush triggered! Sanitation crew alerted.');
      setTimeout(() => setFlushSuccessMsg(null), 5000);
    } catch {
      setFlushSuccessMsg('Failed to trigger flush');
    } finally {
      setIsFlushing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Map Engine & Provider Switcher Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>Geospatial GIS Command Center</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono">
                {nodes.length} Physical LoRa Nodes &bull; {zones.length} Risk Zones
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Live spatial GIS tracking of watersheds, culvert trash screens, and low-lying inundation zones.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Map Engine Switcher: Google Maps vs Leaflet */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setMapEngine('google')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                mapEngine === 'google'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Google Maps Live</span>
            </button>
            <button
              onClick={() => setMapEngine('leaflet')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                mapEngine === 'leaflet'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Leaflet (Offline Mesh)</span>
            </button>
          </div>

          {/* Quick Category Filters (when on leaflet) */}
          {mapEngine === 'leaflet' && (
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-md transition ${activeFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                All ({nodes.length})
              </button>
              <button
                onClick={() => setActiveFilter('culverts')}
                className={`px-2.5 py-1 rounded-md transition ${activeFilter === 'culverts' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Culverts
              </button>
              <button
                onClick={() => setActiveFilter('gauges')}
                className={`px-2.5 py-1 rounded-md transition ${activeFilter === 'gauges' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Gauges
              </button>
            </div>
          )}

          {/* Offline Tile Caching Mode Toggle (for Leaflet) */}
          {mapEngine === 'leaflet' && (
            <button
              onClick={() => setOfflineMode(!offlineMode)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                offlineMode
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Toggle between online OpenStreetMap tiles and municipal offline vector mesh cache"
            >
              {offlineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
              <span>{offlineMode ? 'Offline Cache' : 'Online Mapnik'}</span>
            </button>
          )}

          {/* Toggle All Assets Directory */}
          <button
            onClick={() => setShowAllAssetDirectory(!showAllAssetDirectory)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
              showAllAssetDirectory
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Show All of Them ({nodes.length + zones.length + routes.length + defaultReliefHavens.length})</span>
          </button>
        </div>
      </div>

      {/* Offline Alert Banner if Active */}
      {mapEngine === 'leaflet' && offlineMode && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div>
              <strong>Municipal Offline Deployment Mode Active:</strong> Cellular and public cloud map servers bypassed. Map is rendering from cached local geo-coordinates and high-contrast vector grid over local LoRa base station.
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono px-2 py-0.5 bg-amber-200 text-amber-800 rounded font-bold">
            Autonomous Grid
          </span>
        </div>
      )}

      {/* Main Map Canvas & Interactive Sidebar Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Map Frame: Google Maps or Leaflet */}
        <div className="lg:col-span-2">
          {mapEngine === 'google' ? (
            <GoogleMapsFloodLayer
              nodes={nodes}
              zones={zones}
              routes={routes}
              config={config}
              havens={defaultReliefHavens}
              selectedNodeId={selectedNode?.id}
              onSelectNode={(n) => {
                setSelectedNode(n);
                setSelectedZone(null);
                setSelectedHaven(null);
              }}
              onSelectZone={(z) => {
                setSelectedZone(z);
                setSelectedNode(null);
                setSelectedHaven(null);
              }}
              onSelectHaven={(h) => {
                setSelectedHaven(h);
                setSelectedNode(null);
                setSelectedZone(null);
              }}
              height="580px"
            />
          ) : (
            <div className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-200 shadow-sm relative min-h-[580px] h-full">
              <div ref={mapContainerRef} className="w-full h-full min-h-[580px] z-0" />

              {/* Map Legend Overlay */}
              <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-xl p-2.5 shadow-md border border-slate-200 text-[11px] z-10 max-w-xs space-y-1.5 pointer-events-auto">
                <div className="font-semibold text-slate-800 flex items-center justify-between">
                  <span>Hydrological Risk Legend</span>
                  <span className="text-[10px] text-slate-400 font-mono">LoRa SF7</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
                  <span className="text-slate-600">Safe Inundation (&lt;{config.normalThreshold}cm)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-amber-500"></span>
                  <span className="text-slate-600">Beware / Overflow Risk ({config.warningThreshold}cm)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-rose-500 animate-pulse"></span>
                  <span className="text-slate-600 font-semibold text-rose-700">Danger / Evacuate (&gt;{config.criticalThreshold}cm)</span>
                </div>
                <div className="pt-1 border-t border-slate-100 flex items-center gap-2 text-slate-500 text-[10px]">
                  <span>🚪 Culvert Sluice</span>
                  <span>🌊 River Gauge</span>
                  <span>🗼 Gateway</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected Asset Telemetry Drawer */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold uppercase">
                    {selectedNode.type.replace('_', ' ')}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base mt-1">{selectedNode.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">Node ID: {selectedNode.id}</p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase ${
                    selectedNode.status === 'critical'
                      ? 'bg-rose-100 text-rose-800'
                      : selectedNode.status === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {selectedNode.status}
                </span>
              </div>

              {/* Live Metric Stream: Depth, Velocity, and Atmospheric Pressure */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-medium">Water Stage</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    {selectedNode.waterLevel} <span className="text-[10px] text-slate-500 font-normal">cm</span>
                  </div>
                  <span className="text-[9px] text-slate-500">+{selectedNode.rateOfRise} cm/min</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-medium">Stream Velocity</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    {selectedNode.flowVelocity} <span className="text-[10px] text-slate-500 font-normal">m/s</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Doppler Acoustic</span>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-medium">Barometric Press.</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5 font-mono">
                    1008.4 <span className="text-[10px] text-slate-500 font-normal">hPa</span>
                  </div>
                  <span className="text-[9px] text-rose-500 font-medium">-0.8 hPa/hr</span>
                </div>
              </div>

              {/* Time-to-Breach Countdown Alert Card */}
              {(() => {
                const isBreached = (selectedNode.waterLevel || 0) >= config.criticalThreshold;
                const diff = config.criticalThreshold - (selectedNode.waterLevel || 0);
                const rate = Math.max(0.2, selectedNode.rateOfRise || 0.5);
                const minutesToBreach = Math.max(1, Math.round(diff / rate));

                return (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                      isBreached
                        ? 'bg-rose-50 border-rose-300 text-rose-900'
                        : diff < 60
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-2 rounded-lg ${
                          isBreached
                            ? 'bg-rose-600 text-white animate-pulse'
                            : diff < 60
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-600 text-white'
                        }`}
                      >
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wider">
                          {isBreached
                            ? 'CRITICAL BREACH IN PROGRESS'
                            : diff < 60
                            ? 'Predicted Time to Overflow'
                            : 'Safe Operational Margin'}
                        </div>
                        <div className="text-xs text-slate-700">
                          {isBreached
                            ? `Level exceeds ${config.criticalThreshold}cm crest limit`
                            : diff < 60
                            ? `Surging towards ${config.criticalThreshold}cm crest threshold`
                            : 'Stable head - no breach projected within 12 hrs'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      {isBreached ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600 text-white animate-bounce">
                          BREACHED
                        </span>
                      ) : diff < 60 ? (
                        <div className="font-mono font-black text-base text-amber-700">
                          ~{minutesToBreach} <span className="text-[10px]">MINS</span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          &gt;12h Buffer
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Station Camera Mirror: Visual Confirmation Stream */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-white space-y-2 relative overflow-hidden">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Camera className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    <span className="font-bold text-slate-200">
                      LIVE RTMP MIRROR: CAM-{selectedNode.id.substring(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCameraNightVision(!cameraNightVision)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition ${
                        cameraNightVision
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                      title="Toggle Night Vision / Infrared"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{cameraNightVision ? 'IR: ON' : 'IR: OFF'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setCameraSnapshotTaken(true);
                        setTimeout(() => setCameraSnapshotTaken(false), 2000);
                      }}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                      title="Save Audit Frame"
                    >
                      {cameraSnapshotTaken ? 'Captured!' : 'Snap'}
                    </button>
                  </div>
                </div>

                {/* Video Feed Viewport with Real-Time Staff Gauge Markings */}
                <div
                  className={`relative h-32 rounded-lg overflow-hidden border border-slate-800 flex items-end p-2 ${
                    cameraNightVision
                      ? 'bg-emerald-950/60 ring-1 ring-emerald-500/50'
                      : 'bg-gradient-to-t from-slate-900 via-slate-800 to-slate-950'
                  }`}
                >
                  {/* Simulated Water Wave / Horizon */}
                  <div
                    className="absolute inset-x-0 bottom-0 transition-all duration-700 pointer-events-none"
                    style={{
                      height: `${Math.min(95, Math.max(15, ((selectedNode.waterLevel || 100) / 450) * 100))}%`,
                      backgroundColor: cameraNightVision ? 'rgba(16, 185, 129, 0.35)' : 'rgba(30, 64, 175, 0.45)',
                      borderTop: cameraNightVision ? '2px solid #34d399' : '2px solid #60a5fa',
                    }}
                  >
                    <div className="absolute top-1 left-2 text-[9px] font-mono text-white/80">
                      Water Line: {selectedNode.waterLevel || 150}cm
                    </div>
                  </div>

                  {/* Staff Gauge Vertical Calibration Ruler Overlay */}
                  <div className="absolute right-3 top-2 bottom-2 w-6 border-l border-white/30 flex flex-col justify-between text-[8px] font-mono text-white/60 pointer-events-none">
                    <div className="pl-1 border-b border-rose-500 text-rose-400 font-bold">4.0m</div>
                    <div className="pl-1 border-b border-amber-400 text-amber-300">3.0m</div>
                    <div className="pl-1 border-b border-white/40">2.0m</div>
                    <div className="pl-1 border-b border-white/40">1.0m</div>
                  </div>

                  {/* Camera OSD Watermark */}
                  <div className="relative z-10 w-full flex items-center justify-between text-[9px] font-mono text-slate-400 drop-shadow">
                    <div>
                      <span className="text-rose-500 font-bold">REC ● </span>
                      <span>{cameraFeedTime || '2026-09-11 14:02:18 UTC'}</span>
                    </div>
                    <span className="text-slate-400">1080p | 25fps</span>
                  </div>
                </div>
              </div>

              {/* Culvert / Trash Screen Specialized Diagnostics */}
              {selectedNode.type === 'culvert_gate' && (
                <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Trash Screen Head Differential
                    </span>
                    <span className="text-rose-600 font-mono font-bold">
                      {selectedNode.trashScreenBlocked ? 'CLOGGED' : 'CLEAR'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500">Upstream Head</span>
                      <div className="font-bold text-slate-800">{selectedNode.upstreamWaterLevel || selectedNode.waterLevel} cm</div>
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-500">Downstream Head</span>
                      <div className="font-bold text-slate-800">{selectedNode.downstreamWaterLevel || 195} cm</div>
                    </div>
                  </div>

                  {selectedNode.trashScreenBlocked && (
                    <div className="text-[11px] text-amber-800">
                      <strong>Differential:</strong>{' '}
                      {(selectedNode.upstreamWaterLevel || selectedNode.waterLevel) - (selectedNode.downstreamWaterLevel || 195)}cm drop across gate. Sediment/debris constriction estimated at {selectedNode.blockageRatio}%.
                    </div>
                  )}

                  {userRole !== 'citizen' && (
                    <button
                      onClick={() => handleFlush(selectedNode.id)}
                      disabled={isFlushing}
                      className="w-full mt-1.5 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-xs transition flex items-center justify-center gap-2"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isFlushing ? 'animate-spin' : ''}`} />
                      <span>{isFlushing ? 'Triggering Flush...' : 'Trigger Hydraulic Flush & Alert Crew'}</span>
                    </button>
                  )}
                  {flushSuccessMsg && (
                    <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      {flushSuccessMsg}
                    </div>
                  )}
                </div>
              )}

              {/* Hardware Health & RF Quality */}
              <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Hardware &amp; RF Diagnostics
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                    <Battery className="w-4 h-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold text-slate-800">{selectedNode.batteryVolts}V ({selectedNode.batteryPercent}%)</div>
                      <span className="text-[10px] text-slate-400">LiFePO4 Cell</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                    <Sun className="w-4 h-4 text-amber-500" />
                    <div>
                      <div className="font-semibold text-slate-800">{selectedNode.solarWatts}W</div>
                      <span className="text-[10px] text-slate-400">{selectedNode.solarCurrentMa} mA Charge</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                    <Wifi className="w-4 h-4 text-blue-500" />
                    <div>
                      <div className="font-semibold text-slate-800">{selectedNode.rssi} dBm</div>
                      <span className="text-[10px] text-slate-400">SNR: {selectedNode.snr} dB</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50">
                    <Radio className="w-4 h-4 text-indigo-500" />
                    <div>
                      <div className="font-semibold text-slate-800">{selectedNode.pdr}% PDR</div>
                      <span className="text-[10px] text-slate-400">Delivery Rate</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Siren Actuation */}
              {userRole === 'admin' && (
                <button
                  onClick={() => onTriggerNodeSiren && onTriggerNodeSiren(selectedNode.id)}
                  className="w-full py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold flex items-center justify-center gap-2 transition"
                >
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Actuate Node Strobe Beacon &amp; Local Siren</span>
                </button>
              )}

              {/* Google Maps Actions for Selected Station */}
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Google Maps Quick Actions
                </span>
                <div className="flex items-center gap-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedNode.lat},${selectedNode.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1 border border-blue-200 transition"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>View Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${selectedNode.lat},${selectedNode.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 transition"
                  >
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Navigate</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selectedNode.lat},${selectedNode.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-1.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 transition"
                    title="Open Google Street View"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ) : selectedZone ? (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                  {selectedZone.wardNumber}
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-1">{selectedZone.name}</h3>
                <p className="text-xs text-slate-500">Elevation: {selectedZone.elevationMeters}m Above Sea Level</p>
              </div>

              <div
                className={`p-3 rounded-xl border ${
                  selectedZone.riskLevel === 'danger'
                    ? 'bg-rose-50 border-rose-200 text-rose-900'
                    : selectedZone.riskLevel === 'beware'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <div className="font-bold text-xs uppercase">Risk Status: {selectedZone.riskLevel}</div>
                <div className="text-xl font-extrabold mt-1">
                  {selectedZone.waterDepthCm} <span className="text-xs font-normal">cm Inundation</span>
                </div>
                <p className="text-xs mt-1 opacity-90">
                  Population at risk: <strong>{selectedZone.populationAtRisk.toLocaleString()} residents</strong>
                </p>
              </div>

              <div className="space-y-2 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                <span className="font-semibold text-slate-700 block">Designated Evacuation Haven:</span>
                <p className="text-slate-800 font-medium">{selectedZone.evacuationHaven}</p>
                <div className="flex items-center justify-between text-slate-500 pt-1 text-[11px]">
                  <span>Safe Elevation: 215m+</span>
                  <span className="font-mono font-bold text-blue-600">{selectedZone.evacuationDistanceKm} km Away</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedZone.coordinates[0][0]},${selectedZone.coordinates[0][1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 px-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition border border-blue-200"
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>Inspect Zone in Google Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          ) : selectedHaven ? (
            <div className="space-y-4">
              <div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">
                  Highland Relief Shelter
                </span>
                <h3 className="font-bold text-slate-900 text-base mt-1">{selectedHaven.name}</h3>
                <p className="text-xs text-slate-500">Elevation: {selectedHaven.elevationMsl}m Above MSL</p>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
                <div className="font-bold text-xs uppercase">Shelter Capacity</div>
                <div className="text-xl font-extrabold mt-1">
                  {selectedHaven.currentOccupancy} / {selectedHaven.bedCapacity}{' '}
                  <span className="text-xs font-normal">Beds Occupied</span>
                </div>
                <div className="text-xs mt-2 space-y-1">
                  <div>Nodal Officer: <strong>{selectedHaven.nodalOfficer}</strong></div>
                  <div>Ration Buffer: <strong>{selectedHaven.suppliesDays} Days Remaining</strong></div>
                  <div>Emergency Dispatch: <strong className="font-mono">{selectedHaven.phone}</strong></div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedHaven.lat},${selectedHaven.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Google Directions</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selectedHaven.lat},${selectedHaven.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 border border-slate-200 transition"
                  title="Open in Google Maps"
                >
                  <Compass className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-700 text-sm">Interactive Spatial Inspection</h4>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Click on any LoRa river sensor, drainage culvert, or neighborhood contour polygon on the map to view real-time hydraulic diagnostics.
                </p>
              </div>
            </div>
          )}

          {/* Bottom GPS Coordination & Gateway Link Status */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="font-mono">Lat: 28.613° N | Lng: 77.218° E</span>
            <span className="font-medium text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              LoRa Gateway Locked
            </span>
          </div>
        </div>
      </div>

      {/* SHOW ALL OF THEM: Complete Hydrological Watershed & Evacuation Network Directory */}
      {showAllAssetDirectory && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1 rounded-md bg-blue-100 text-blue-700 font-mono text-[10px] font-bold uppercase">
                  GIS Layer Inventory
                </span>
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  All Watershed Assets &amp; Google Maps Links
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing all {nodes.length + zones.length + routes.length + defaultReliefHavens.length} active stations, inundation contours, evacuation vectors, and relief havens across the municipal mesh.
              </p>
            </div>

            {/* Multi-point Google Maps Itinerary Link */}
            <a
              href={`https://www.google.com/maps/dir/${nodes.map((n) => `${n.lat},${n.lng}`).join('/')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-2 whitespace-nowrap"
            >
              <Compass className="w-4 h-4" />
              <span>Open All Stations in Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Directory Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs scrollbar-none font-semibold">
            <button
              onClick={() => setAssetDirectoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                assetDirectoryFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Show All of Them ({nodes.length + zones.length + routes.length + defaultReliefHavens.length})
            </button>
            <button
              onClick={() => setAssetDirectoryFilter('nodes')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
                assetDirectoryFilter === 'nodes'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Radio className="w-3 h-3" />
              <span>Physical LoRa Nodes ({nodes.length})</span>
            </button>
            <button
              onClick={() => setAssetDirectoryFilter('zones')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
                assetDirectoryFilter === 'zones'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>Inundation Zones ({zones.length})</span>
            </button>
            <button
              onClick={() => setAssetDirectoryFilter('routes')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
                assetDirectoryFilter === 'routes'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span>Evacuation Routes ({routes.length})</span>
            </button>
            <button
              onClick={() => setAssetDirectoryFilter('havens')}
              className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap flex items-center gap-1.5 ${
                assetDirectoryFilter === 'havens'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Hospital className="w-3 h-3" />
              <span>Relief Havens ({defaultReliefHavens.length})</span>
            </button>
          </div>

          {/* Asset Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* Physical Nodes */}
            {(assetDirectoryFilter === 'all' || assetDirectoryFilter === 'nodes') &&
              nodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between space-y-2.5 ${
                    selectedNode?.id === node.id
                      ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        <span className="font-bold text-slate-900 text-xs">{node.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        {node.lat.toFixed(4)}°N, {node.lng.toFixed(4)}°E
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        node.status === 'critical'
                          ? 'bg-rose-100 text-rose-800'
                          : node.status === 'warning'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {node.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-[11px] bg-slate-50 p-2 rounded-lg">
                    <div>
                      <span className="text-slate-400 text-[10px]">Water Stage</span>
                      <div className="font-mono font-bold text-slate-800">{node.waterLevel} cm</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Telemetry</span>
                      <div className="font-mono font-bold text-slate-800">
                        {node.batteryPercent}% &bull; {node.rssi}dBm
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => {
                        setSelectedNode(node);
                        setSelectedZone(null);
                        setSelectedHaven(null);
                      }}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition text-center"
                    >
                      Inspect
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${node.lat},${node.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-[11px] flex items-center gap-1 transition"
                      title="Open in Google Maps"
                    >
                      <Compass className="w-3 h-3" />
                      <span>Maps</span>
                    </a>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${node.lat},${node.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1 transition"
                      title="Google Directions"
                    >
                      <Navigation className="w-3 h-3 text-blue-600" />
                      <span>Route</span>
                    </a>
                  </div>
                </div>
              ))}

            {/* Flood Risk Zones */}
            {(assetDirectoryFilter === 'all' || assetDirectoryFilter === 'zones') &&
              zones.map((zone) => (
                <div
                  key={zone.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between space-y-2.5 ${
                    selectedZone?.id === zone.id
                      ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        <span className="font-bold text-slate-900 text-xs">{zone.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">{zone.wardNumber}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        zone.riskLevel === 'danger'
                          ? 'bg-rose-100 text-rose-800'
                          : zone.riskLevel === 'beware'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {zone.riskLevel}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-[11px] bg-slate-50 p-2 rounded-lg">
                    <div>
                      <span className="text-slate-400 text-[10px]">Inundation</span>
                      <div className="font-mono font-bold text-slate-800">{zone.waterDepthCm} cm</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Population</span>
                      <div className="font-mono font-bold text-slate-800">
                        {zone.populationAtRisk.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => {
                        setSelectedZone(zone);
                        setSelectedNode(null);
                        setSelectedHaven(null);
                      }}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition text-center"
                    >
                      Inspect
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${zone.coordinates[0][0]},${zone.coordinates[0][1]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-[11px] flex items-center gap-1 transition"
                      title="Open Zone in Google Maps"
                    >
                      <Compass className="w-3 h-3" />
                      <span>Maps</span>
                    </a>
                  </div>
                </div>
              ))}

            {/* Evacuation Corridors */}
            {(assetDirectoryFilter === 'all' || assetDirectoryFilter === 'routes') &&
              routes.map((route) => (
                <div
                  key={route.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex flex-col justify-between space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        <span className="font-bold text-slate-900 text-xs">{route.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Destination: {route.destinationHaven}</p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        route.status === 'blocked'
                          ? 'bg-rose-100 text-rose-800'
                          : route.status === 'caution'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {route.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-[11px] bg-slate-50 p-2 rounded-lg">
                    <div>
                      <span className="text-slate-400 text-[10px]">Distance</span>
                      <div className="font-mono font-bold text-slate-800">{route.distanceKm} km</div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Waypoints</span>
                      <div className="font-mono font-bold text-slate-800">{route.waypoints.length} coords</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
                    {route.waypoints.length > 0 && (
                      <a
                        href={`https://www.google.com/maps/dir/${route.waypoints[0][0]},${route.waypoints[0][1]}/${route.waypoints[route.waypoints.length - 1][0]},${route.waypoints[route.waypoints.length - 1][1]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-1 px-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] flex items-center justify-center gap-1 transition"
                      >
                        <Navigation className="w-3 h-3 text-blue-600" />
                        <span>Google Turn-by-Turn Route</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}

            {/* Relief Havens */}
            {(assetDirectoryFilter === 'all' || assetDirectoryFilter === 'havens') &&
              defaultReliefHavens.map((haven) => (
                <div
                  key={haven.id}
                  className={`p-3.5 rounded-xl border transition flex flex-col justify-between space-y-2.5 ${
                    selectedHaven?.id === haven.id
                      ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="font-bold text-slate-900 text-xs">{haven.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Elev: {haven.elevationMsl}m MSL</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Highland Shelter
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-[11px] bg-slate-50 p-2 rounded-lg">
                    <div>
                      <span className="text-slate-400 text-[10px]">Bed Occupancy</span>
                      <div className="font-mono font-bold text-slate-800">
                        {haven.currentOccupancy} / {haven.bedCapacity}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[10px]">Rations</span>
                      <div className="font-mono font-bold text-slate-800">{haven.suppliesDays} Days</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 text-xs">
                    <button
                      onClick={() => {
                        setSelectedHaven(haven);
                        setSelectedNode(null);
                        setSelectedZone(null);
                      }}
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-[11px] transition text-center"
                    >
                      Inspect
                    </button>
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${haven.lat},${haven.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] flex items-center gap-1 transition"
                      title="Google Directions"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Directions</span>
                    </a>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
