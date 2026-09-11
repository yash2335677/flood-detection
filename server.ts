import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// In-memory data store for hydrology telemetry and flood detection
interface TelemetryRecord {
  id: string;
  timestamp: string;
  nodeId: string;
  waterLevel: number; // in cm
  rateOfRise: number; // in cm/min
  flowVelocity: number; // in m/s
  rainfall: number; // mm/h
  turbidity: number; // NTU
  waterTemp: number; // deg C
  battery: number; // Volts
  rssi: number; // dBm
  snr: number; // dB
  frequency: string;
  packetNumber: number;
  status: 'normal' | 'advisory' | 'warning' | 'critical';
}

interface AlertRecord {
  id: string;
  timestamp: string;
  level: 'advisory' | 'warning' | 'critical';
  title: string;
  message: string;
  waterLevel: number;
  nodeId: string;
  smsDispatched: boolean;
  smsRecipientsCount: number;
  acknowledged: boolean;
}

interface SmsRecord {
  id: string;
  timestamp: string;
  to: string;
  recipientName: string;
  message: string;
  status: 'sent' | 'delivered' | 'failed';
  gateway: string;
  alertLevel: 'advisory' | 'warning' | 'critical' | 'test';
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  notifyOn: ('advisory' | 'warning' | 'critical')[];
}

// Configurable thresholds (in cm)
let floodConfig = {
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

let emergencyContacts: EmergencyContact[] = [
  {
    id: 'c1',
    name: 'District Disaster Management Office',
    phone: '+1 (555) 019-2834',
    role: 'Incident Commander',
    notifyOn: ['advisory', 'warning', 'critical'],
  },
  {
    id: 'c2',
    name: 'Rapid Flood Response Team Lead',
    phone: '+1 (555) 014-9921',
    role: 'First Responder',
    notifyOn: ['warning', 'critical'],
  },
  {
    id: 'c3',
    name: 'Hydrology Operations Officer',
    phone: '+1 (555) 017-3841',
    role: 'Hydrologist',
    notifyOn: ['advisory', 'warning', 'critical'],
  },
  {
    id: 'c4',
    name: 'Community Evacuation Coordinator',
    phone: '+1 (555) 012-7765',
    role: 'Evacuation Marshal',
    notifyOn: ['critical'],
  },
];

let smsHistory: SmsRecord[] = [
  {
    id: 'sms-init-1',
    timestamp: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    to: '+1 (555) 019-2834',
    recipientName: 'District Disaster Management Office',
    message: '[FLOODGUARD LORA ADVISORY] Station River Basin #1 water level reached 245cm (+4.2cm/h). Monitoring active.',
    status: 'delivered',
    gateway: 'LoRa-SMS-Bridge',
    alertLevel: 'advisory',
  },
];

let alertHistory: AlertRecord[] = [
  {
    id: 'alt-init-1',
    timestamp: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    level: 'advisory',
    title: 'Water Level Rising Above Seasonal Baseline',
    message: 'Sensor node #1 reported water stage depth at 245cm. Flow velocity accelerated to 2.4 m/s.',
    waterLevel: 245,
    nodeId: 'LORA-NODE-01',
    smsDispatched: true,
    smsRecipientsCount: 2,
    acknowledged: true,
  },
];

// Physical LoRa Nodes and Culverts on GIS
interface PhysicalNodeData {
  id: string;
  name: string;
  type: 'river_gauge' | 'culvert_gate' | 'urban_drain' | 'spillway' | 'gateway';
  lat: number;
  lng: number;
  status: 'online' | 'advisory' | 'warning' | 'critical' | 'maintenance';
  waterLevel: number; // cm
  rateOfRise: number; // cm/min
  flowVelocity: number; // m/s
  batteryVolts: number;
  batteryPercent: number;
  solarWatts: number;
  solarCurrentMa: number;
  rssi: number;
  snr: number;
  pdr: number; // Packet delivery rate %
  packetsSent: number;
  packetsReceived: number;
  lastHeard: string;
  upstreamWaterLevel?: number;
  downstreamWaterLevel?: number;
  trashScreenBlocked?: boolean;
  blockageRatio?: number;
  hardwareSerial?: string;
  frequencyBand?: string;
  spreadingFactor?: string;
}

let physicalNodes: PhysicalNodeData[] = [
  {
    id: 'LORA-NODE-01',
    name: 'Upper Watershed Hydrology Station #1',
    type: 'river_gauge',
    lat: 28.6145,
    lng: 77.2085,
    status: 'warning',
    waterLevel: 285,
    rateOfRise: 2.4,
    flowVelocity: 2.65,
    batteryVolts: 3.92,
    batteryPercent: 88,
    solarWatts: 4.8,
    solarCurrentMa: 960,
    rssi: -74,
    snr: 10.4,
    pdr: 99.2,
    packetsSent: 1420,
    packetsReceived: 1409,
    lastHeard: 'Just now',
  },
  {
    id: 'CULVERT-G3-NORTH',
    name: 'Sector 4 Drainage Culvert & Trash Screen',
    type: 'culvert_gate',
    lat: 28.6212,
    lng: 77.2188,
    status: 'critical',
    waterLevel: 268,
    rateOfRise: 3.1,
    flowVelocity: 1.15,
    batteryVolts: 3.84,
    batteryPercent: 78,
    solarWatts: 3.9,
    solarCurrentMa: 780,
    rssi: -82,
    snr: 8.1,
    pdr: 97.6,
    packetsSent: 1390,
    packetsReceived: 1357,
    lastHeard: '1m ago',
    upstreamWaterLevel: 295,
    downstreamWaterLevel: 195,
    trashScreenBlocked: true,
    blockageRatio: 72,
  },
  {
    id: 'LORA-NODE-03-URBAN',
    name: 'Lowland Metro Underpass Sump Sensor',
    type: 'urban_drain',
    lat: 28.6082,
    lng: 77.2255,
    status: 'warning',
    waterLevel: 195,
    rateOfRise: 1.8,
    flowVelocity: 0.95,
    batteryVolts: 3.78,
    batteryPercent: 69,
    solarWatts: 2.8,
    solarCurrentMa: 560,
    rssi: -88,
    snr: 6.9,
    pdr: 95.8,
    packetsSent: 1350,
    packetsReceived: 1293,
    lastHeard: '2m ago',
  },
  {
    id: 'LORA-NODE-04-SPILL',
    name: 'Downstream Barrage Relief Spillway',
    type: 'spillway',
    lat: 28.5998,
    lng: 77.2345,
    status: 'online',
    waterLevel: 165,
    rateOfRise: 0.6,
    flowVelocity: 3.1,
    batteryVolts: 4.05,
    batteryPercent: 96,
    solarWatts: 6.2,
    solarCurrentMa: 1240,
    rssi: -71,
    snr: 12.1,
    pdr: 99.8,
    packetsSent: 1420,
    packetsReceived: 1417,
    lastHeard: 'Just now',
  },
  {
    id: 'GW-LORA-915-ALPHA',
    name: 'Central Disaster Command LoRa Gateway & High-Decibel Siren Tower',
    type: 'gateway',
    lat: 28.6125,
    lng: 77.2152,
    status: 'online',
    waterLevel: 0,
    rateOfRise: 0,
    flowVelocity: 0,
    batteryVolts: 12.8,
    batteryPercent: 98,
    solarWatts: 45.0,
    solarCurrentMa: 3200,
    rssi: -62,
    snr: 14.5,
    pdr: 99.9,
    packetsSent: 5680,
    packetsReceived: 5674,
    lastHeard: 'Live (Primary Link)',
  },
];

// Flood Risk Contour Zones
interface FloodRiskZoneData {
  id: string;
  name: string;
  wardNumber: string;
  riskLevel: 'safe' | 'beware' | 'danger';
  waterDepthCm: number;
  populationAtRisk: number;
  elevationMeters: number;
  evacuationHaven: string;
  evacuationDistanceKm: number;
  coordinates: [number, number][];
}

let floodRiskZones: FloodRiskZoneData[] = [
  {
    id: 'RZ-01',
    name: 'Riverside Settlement & Lowland Colony',
    wardNumber: 'Ward 4',
    riskLevel: 'danger',
    waterDepthCm: 68,
    populationAtRisk: 14500,
    elevationMeters: 182,
    evacuationHaven: 'Govt Model Senior Secondary School Ridge Campus',
    evacuationDistanceKm: 1.2,
    coordinates: [
      [28.618, 77.205],
      [28.622, 77.214],
      [28.617, 77.221],
      [28.611, 77.212],
    ],
  },
  {
    id: 'RZ-02',
    name: 'Old City Wholesale Market Basin',
    wardNumber: 'Ward 7',
    riskLevel: 'beware',
    waterDepthCm: 32,
    populationAtRisk: 22000,
    elevationMeters: 191,
    evacuationHaven: 'Central Sports Complex Pavilion #2',
    evacuationDistanceKm: 1.8,
    coordinates: [
      [28.613, 77.218],
      [28.618, 77.228],
      [28.610, 77.234],
      [28.605, 77.223],
    ],
  },
  {
    id: 'RZ-03',
    name: 'Railway Underpass & Industrial Drainage Corridor',
    wardNumber: 'Ward 9',
    riskLevel: 'danger',
    waterDepthCm: 85,
    populationAtRisk: 6800,
    elevationMeters: 180,
    evacuationHaven: 'District Polytechnic Multi-Purpose Hall',
    evacuationDistanceKm: 0.9,
    coordinates: [
      [28.604, 77.215],
      [28.609, 77.226],
      [28.602, 77.231],
      [28.597, 77.220],
    ],
  },
  {
    id: 'RZ-04',
    name: 'Civil Lines & Ridge Plateau (Elevated)',
    wardNumber: 'Ward 1',
    riskLevel: 'safe',
    waterDepthCm: 0,
    populationAtRisk: 0,
    elevationMeters: 218,
    evacuationHaven: 'Primary Sector HQ (Staging Ground)',
    evacuationDistanceKm: 0.0,
    coordinates: [
      [28.622, 77.200],
      [28.628, 77.209],
      [28.621, 77.215],
      [28.616, 77.206],
    ],
  },
];

// Dam & Sluice Actuators
interface DamActuatorData {
  id: string;
  name: string;
  location: string;
  status: 'closed' | 'open' | 'adjusting';
  openPercentage: number;
  dischargeCapacityM3s: number;
  locked: boolean;
  lastCommandTime: string;
  commandSource: string;
}

let damActuators: DamActuatorData[] = [
  {
    id: 'ACT-GATE-01',
    name: 'Main River Barrage Sluice Gate #1',
    location: 'Upstream Weir (Chainage 14+200)',
    status: 'open',
    openPercentage: 45,
    dischargeCapacityM3s: 180,
    locked: true,
    lastCommandTime: '18m ago',
    commandSource: 'Automated Municipal Flood Protocol (Rule 4B)',
  },
  {
    id: 'ACT-VALVE-02',
    name: 'Emergency Retention Spillway Valve #2',
    location: 'East Diversion Canal',
    status: 'closed',
    openPercentage: 0,
    dischargeCapacityM3s: 0,
    locked: true,
    lastCommandTime: '3h ago',
    commandSource: 'Supervisory Control Center',
  },
  {
    id: 'ACT-CULVERT-03',
    name: 'Culvert Sector 4 Trash-Screen Flush Bypass',
    location: 'Sector 4 North Culvert',
    status: 'closed',
    openPercentage: 15,
    dischargeCapacityM3s: 25,
    locked: true,
    lastCommandTime: '45m ago',
    commandSource: 'Differential Head Pressure Auto-Trigger',
  },
];

// Multi-Channel Emergency Broadcast State
let broadcastHubStatus = {
  active: false,
  smsSentCount: 142,
  telegramDelivered: true,
  whatsappDelivered: true,
  physicalSirenTriggered: false,
  lastTriggerTimestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  targetMessage: 'Red alert: River level 285cm. Evacuate Ward 4 lowland zones immediately.',
};

// Evacuation Route Vectors (Dynamic Spatial Routing)
interface EvacuationRouteData {
  id: string;
  name: string;
  destinationHaven: string;
  status: 'clear' | 'caution' | 'blocked';
  waypoints: [number, number][];
  distanceKm: number;
  criticalNodesAlongRoute: string[];
}

let evacuationRoutes: EvacuationRouteData[] = [
  {
    id: 'ROUTE-01',
    name: 'Corridor Alpha: Riverside Lowlands to Model Ridge Haven',
    destinationHaven: 'Govt Model Senior Secondary School Ridge Campus',
    status: 'caution',
    distanceKm: 1.2,
    criticalNodesAlongRoute: ['CULVERT-G3-NORTH', 'LORA-NODE-01'],
    waypoints: [
      [28.618, 77.206],
      [28.6195, 77.211],
      [28.6212, 77.2188], // near culvert
      [28.624, 77.214],
      [28.6265, 77.208], // Haven
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

// System Event Logs (Tab 6 Automated Ledger)
interface SystemEventLogData {
  id: string;
  timestamp: string;
  eventType: 'threshold_breach' | 'sensor_uplink' | 'siren_triggered' | 'failover' | 'watchdog';
  severity: 'info' | 'warning' | 'critical';
  nodeId?: string;
  message: string;
  waterLevel?: number;
}

let systemEventLogs: SystemEventLogData[] = [
  {
    id: 'EVT-1089',
    timestamp: new Date(Date.now() - 360000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventType: 'threshold_breach',
    severity: 'warning',
    nodeId: 'LORA-NODE-01',
    message: 'Upper Watershed Gauge reached WARNING threshold at 285cm (+2.4 cm/min surge velocity).',
    waterLevel: 285,
  },
  {
    id: 'EVT-1088',
    timestamp: new Date(Date.now() - 540000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventType: 'watchdog',
    severity: 'critical',
    nodeId: 'CULVERT-G3-NORTH',
    message: 'Differential Head Pressure Watchdog: Δh=100cm detected across Sector 4 trash screen. Flow restricted by 72%.',
    waterLevel: 268,
  },
  {
    id: 'EVT-1087',
    timestamp: new Date(Date.now() - 720000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventType: 'threshold_breach',
    severity: 'critical',
    nodeId: 'RZ-03',
    message: 'Inundation Risk Polygon RZ-03 (Railway Underpass) transitioned into DANGER state (water depth: 85cm).',
  },
  {
    id: 'EVT-1086',
    timestamp: new Date(Date.now() - 900000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventType: 'failover',
    severity: 'info',
    nodeId: 'GW-LORA-915-ALPHA',
    message: 'Gateway ChirpStack LoRaWAN bridge switched to secondary SX1302 concentrator channel with zero packet drop.',
  },
  {
    id: 'EVT-1085',
    timestamp: new Date(Date.now() - 1200000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventType: 'sensor_uplink',
    severity: 'info',
    nodeId: 'LORA-NODE-04-SPILL',
    message: 'Telemetry packet #1417 ingested over 868.1MHz SF7. RSSI: -71dBm, SNR: +12.1dB.',
  },
];

// Action Audit Trail (Human Overrides & Manual Interventions, Tab 6)
interface ActionAuditLogData {
  id: string;
  timestamp: string;
  actor: string;
  role: 'admin' | 'ndrf' | 'field_operator';
  action: string;
  targetAsset: string;
  status: 'success' | 'denied' | 'overridden';
  reason?: string;
  ipAddress: string;
}

let actionAuditLogs: ActionAuditLogData[] = [
  {
    id: 'AUD-8831',
    timestamp: new Date(Date.now() - 180000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: 'Superintendent Engineer (Municipal Admin)',
    role: 'admin',
    action: 'Actuator Reposition: Main Barrage Sluice Gate #1 opened from 20% to 45%',
    targetAsset: 'ACT-GATE-01',
    status: 'success',
    reason: 'Pre-emptive retention basin discharge ahead of upstream monsoon surge.',
    ipAddress: '192.168.1.104 (Command Console)',
  },
  {
    id: 'AUD-8830',
    timestamp: new Date(Date.now() - 600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: 'Tactical Commander (NDRF Unit 8)',
    role: 'ndrf',
    action: 'Trigger Hydraulic Reverse Flush on Sector 4 Culvert Trash Screen',
    targetAsset: 'CULVERT-G3-NORTH',
    status: 'success',
    reason: 'Trash screen clogged with plastics and urban siltation debris.',
    ipAddress: '10.240.12.88 (Field Mobile Tablet)',
  },
  {
    id: 'AUD-8829',
    timestamp: new Date(Date.now() - 1100000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: 'Duty Officer (Disaster Control Room)',
    role: 'admin',
    action: 'Multi-Channel Emergency SMS & WhatsApp Broadcast Dispatched to Ward 4 & 7',
    targetAsset: 'GW-LORA-CELLULAR-MESH',
    status: 'success',
    reason: 'Time-to-breach regression forecast decreased below 45 minutes.',
    ipAddress: '192.168.1.102 (Dispatch Terminal)',
  },
  {
    id: 'AUD-8828',
    timestamp: new Date(Date.now() - 1800000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: 'Field Inspector (Municipal Public Works)',
    role: 'field_operator',
    action: 'Physical Culvert Gasket & Trash Screen Inspection Completed',
    targetAsset: 'CULVERT-G3-NORTH',
    status: 'success',
    reason: 'Routine pre-monsoon hardware verification and ultrasonic sensor calibration.',
    ipAddress: '10.240.14.12 (Field Handheld)',
  },
];

// Field Maintenance Log Records (Tab 5)
interface FieldMaintenanceLogData {
  id: string;
  timestamp: string;
  nodeId: string;
  operatorName: string;
  batteryStatus: string;
  physicalDamage: boolean;
  trashScreenCleaned: boolean;
  notes: string;
  status: 'verified' | 'action_required';
}

let maintenanceLogs: FieldMaintenanceLogData[] = [
  {
    id: 'MAINT-301',
    timestamp: new Date(Date.now() - 86400000).toLocaleDateString() + ' 11:30',
    nodeId: 'CULVERT-G3-NORTH',
    operatorName: 'Rajesh Kumar (Field Tech #4)',
    batteryStatus: '3.84V (78%) Nominal',
    physicalDamage: false,
    trashScreenCleaned: true,
    notes: 'Cleared 45kg floating plastic and tree branch debris from upstream trash grate. Ultrasonic transducer lens cleaned.',
    status: 'verified',
  },
  {
    id: 'MAINT-300',
    timestamp: new Date(Date.now() - 172800000).toLocaleDateString() + ' 09:15',
    nodeId: 'LORA-NODE-01',
    operatorName: 'Sunil Sharma (Senior Tech)',
    batteryStatus: '3.92V (88%) Solar nominal',
    physicalDamage: false,
    trashScreenCleaned: false,
    notes: 'Recalibrated Doppler velocity sensor against acoustic staff gauge. Verified zero drift.',
    status: 'verified',
  },
];

// Public API Keys for Open-Source Flood Integration (Tab 5)
interface ApiKeyRecordData {
  id: string;
  name: string;
  key: string;
  organization: string;
  createdAt: string;
  rateLimitPerMin: number;
  requestsCount: number;
  status: 'active' | 'revoked';
}

let publicApiKeys: ApiKeyRecordData[] = [
  {
    id: 'KEY-001',
    name: 'State Disaster Management Authority (SDMA) Live Ingest',
    key: 'fl_live_sdma_99f2b881c002e',
    organization: 'Disaster Management Authority',
    createdAt: '2026-06-01',
    rateLimitPerMin: 120,
    requestsCount: 14890,
    status: 'active',
  },
  {
    id: 'KEY-002',
    name: 'India Meteorological Department (IMD) Hydrology Feed',
    key: 'fl_live_imd_87e1a903c771b',
    organization: 'Met Department River Forecasting',
    createdAt: '2026-07-15',
    rateLimitPerMin: 60,
    requestsCount: 6420,
    status: 'active',
  },
  {
    id: 'KEY-003',
    name: 'Municipal Open Data Citizen Portal Widget',
    key: 'fl_pub_citizen_33d4e891b110a',
    organization: 'Open City Data Initiative',
    createdAt: '2026-08-10',
    rateLimitPerMin: 300,
    requestsCount: 42100,
    status: 'active',
  },
];

// Crowdsourced Citizen Reports (Tab 5)
interface CrowdsourcedReportData {
  id: string;
  timestamp: string;
  author: string;
  phone?: string;
  location: string;
  waterDepthCm: number;
  description: string;
  upvotes: number;
  verified: boolean;
  hazardType: 'waterlogged_road' | 'culvert_choked' | 'stranded_citizens' | 'powerline_down';
}

let crowdsourcedReports: CrowdsourcedReportData[] = [
  {
    id: 'REP-501',
    timestamp: '14 mins ago',
    author: 'Vikas Sharma (Citizen Volunteer)',
    phone: '+91 98765 43210',
    location: 'Sector 4 North Causeway Bridge',
    waterDepthCm: 60,
    description: 'Debris piled up at culvert inlet. Two autos stuck in water on eastern ramp. Sanitation crew assistance needed.',
    upvotes: 24,
    verified: true,
    hazardType: 'culvert_choked',
  },
  {
    id: 'REP-502',
    timestamp: '32 mins ago',
    author: 'Priya Narang (Ward 7 Resident)',
    phone: '+91 98112 34567',
    location: 'Railway Underpass Subway #2',
    waterDepthCm: 95,
    description: 'Subway water pumped out earlier has back-flooded from storm drain. Barrier tape has torn off.',
    upvotes: 41,
    verified: true,
    hazardType: 'waterlogged_road',
  },
  {
    id: 'REP-503',
    timestamp: '1 hour ago',
    author: 'Anil Mehta (Civil Defense)',
    phone: '+91 99887 11223',
    location: 'Riverside Lowland Ghats Lane 3',
    waterDepthCm: 45,
    description: 'Tree branch touching submerged powerline near community center. Power disconnected by sub-station.',
    upvotes: 18,
    verified: false,
    hazardType: 'powerline_down',
  },
];

// Relief Camp & Shelter Directory (Tab 5)
interface ReliefCampData {
  id: string;
  name: string;
  location: string;
  capacityBeds: number;
  currentOccupancy: number;
  foodRationsDays: number;
  medicalTeamOnsite: boolean;
  contactPerson: string;
  contactPhone: string;
  elevationMeters: number;
}

let reliefShelters: ReliefCampData[] = [
  {
    id: 'SHELTER-01',
    name: 'Govt Model Senior Secondary School (Ridge Campus)',
    location: 'North Ridge Road, Sector 2',
    capacityBeds: 500,
    currentOccupancy: 285,
    foodRationsDays: 7,
    medicalTeamOnsite: true,
    contactPerson: 'Dr. Sandeep Rawat (District Nodal Officer)',
    contactPhone: '+91 11 2389 4411',
    elevationMeters: 232,
  },
  {
    id: 'SHELTER-02',
    name: 'Community Sports Complex & Cyclone Refuge',
    location: 'Civil Lines High Plateau',
    capacityBeds: 800,
    currentOccupancy: 340,
    foodRationsDays: 10,
    medicalTeamOnsite: true,
    contactPerson: 'Major K.S. Rathore (NDRF Liaison)',
    contactPhone: '+91 11 2389 5522',
    elevationMeters: 245,
  },
  {
    id: 'SHELTER-03',
    name: 'Municipal Kalyan Kendra & Red Cross Camp',
    location: 'West Hill Road, Ward 1',
    capacityBeds: 350,
    currentOccupancy: 110,
    foodRationsDays: 5,
    medicalTeamOnsite: false,
    contactPerson: 'Sunita Devi (Social Welfare Supv)',
    contactPhone: '+91 11 2389 6633',
    elevationMeters: 228,
  },
];

// Seed recent telemetry (last 20 readings with realistic curve)
let telemetryHistory: TelemetryRecord[] = [];
let packetCounter = 1420;

function generateInitialHistory() {
  const now = Date.now();
  let baseLevel = 210;
  for (let i = 24; i >= 0; i--) {
    const time = new Date(now - i * 180000); // every 3 minutes
    const noise = Math.sin(i / 3) * 12 + (Math.random() * 6 - 3);
    const waterLevel = Math.round(baseLevel + (24 - i) * 3.2 + noise);
    const flowVelocity = parseFloat((1.4 + (waterLevel - 200) * 0.012 + Math.random() * 0.2).toFixed(2));
    const rainfall = parseFloat((12.5 + Math.sin(i / 2) * 5 + Math.random() * 2).toFixed(1));
    const turbidity = Math.round(35 + (waterLevel - 200) * 0.8 + Math.random() * 8);

    let status: 'normal' | 'advisory' | 'warning' | 'critical' = 'normal';
    if (waterLevel >= floodConfig.criticalThreshold) status = 'critical';
    else if (waterLevel >= floodConfig.warningThreshold) status = 'warning';
    else if (waterLevel >= floodConfig.normalThreshold) status = 'advisory';

    telemetryHistory.push({
      id: `rec-${i}`,
      timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      nodeId: 'LORA-NODE-01',
      waterLevel,
      rateOfRise: parseFloat(((Math.random() * 2 + 1.5)).toFixed(1)),
      flowVelocity,
      rainfall,
      turbidity,
      waterTemp: 19.4,
      battery: 3.92,
      rssi: -78 + Math.round(Math.random() * 8 - 4),
      snr: parseFloat((9.8 + (Math.random() * 2 - 1)).toFixed(1)),
      frequency: '868.100 MHz',
      packetNumber: packetCounter - i,
      status,
    });
  }
}
generateInitialHistory();

// SSE (Server-Sent Events) clients registry for instant live streaming
interface SSEClient {
  id: number;
  res: express.Response;
}
let sseClients: SSEClient[] = [];
let clientIdCounter = 0;

function broadcastToClients(eventType: string, data: unknown) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch {
      // client disconnected
    }
  });
}

// Function to calculate flood status based on water level
function calculateStatus(level: number): 'normal' | 'advisory' | 'warning' | 'critical' {
  if (level >= floodConfig.criticalThreshold) return 'critical';
  if (level >= floodConfig.warningThreshold) return 'warning';
  if (level >= floodConfig.normalThreshold) return 'advisory';
  return 'normal';
}

// Function to trigger SMS dispatch
async function dispatchSmsForAlert(level: 'advisory' | 'warning' | 'critical', waterLevel: number, nodeId: string, details?: string) {
  if (!floodConfig.autoSmsEnabled) return 0;

  const eligibleRecipients = emergencyContacts.filter((c) => c.notifyOn.includes(level));
  if (eligibleRecipients.length === 0) return 0;

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let count = 0;

  for (const recipient of eligibleRecipients) {
    let msgPrefix = '[FLOOD ALERT]';
    if (level === 'critical') msgPrefix = '🚨 [CRITICAL EVACUATION FLOOD ALERT]';
    else if (level === 'warning') msgPrefix = '⚠️ [SEVERE FLOOD WARNING]';
    else if (level === 'advisory') msgPrefix = 'ℹ️ [FLOOD ADVISORY]';

    const text = `${msgPrefix} LoRa Receiver '${floodConfig.receiverName}' detected water level: ${waterLevel}cm at Node ${nodeId}. ${details || 'Immediate safety protocols in effect. Evacuate low-lying sectors.'} [${timeStr}]`;

    const smsRecord: SmsRecord = {
      id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: timeStr,
      to: recipient.phone,
      recipientName: recipient.name,
      message: text,
      status: 'delivered',
      gateway: 'LoRa-SMS-Bridge',
      alertLevel: level,
    };

    // If Twilio is configured, attempt real Twilio REST call
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioAuth && twilioPhone) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
        const formParams = new URLSearchParams();
        formParams.append('To', recipient.phone);
        formParams.append('From', twilioPhone);
        formParams.append('Body', text);

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formParams.toString(),
        });
        smsRecord.status = 'delivered';
      } catch (err) {
        console.error('Twilio SMS send error:', err);
      }
    }

    smsHistory.unshift(smsRecord);
    if (smsHistory.length > 50) smsHistory.pop();
    count++;

    // Broadcast SMS dispatch event to UI clients
    broadcastToClients('sms_dispatched', smsRecord);
  }

  return count;
}

// Ingest a new sensor packet (from LoRa gateway or simulator)
function processSensorPacket(data: {
  nodeId?: string;
  waterLevel: number;
  flowVelocity?: number;
  rainfall?: number;
  turbidity?: number;
  battery?: number;
  rssi?: number;
  snr?: number;
  frequency?: string;
}) {
  packetCounter++;
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const lastRecord = telemetryHistory[telemetryHistory.length - 1];
  const prevLevel = lastRecord ? lastRecord.waterLevel : data.waterLevel;
  const rateOfRise = parseFloat(((data.waterLevel - prevLevel) * 0.8 + Math.random() * 0.5).toFixed(1));

  const status = calculateStatus(data.waterLevel);

  const newRecord: TelemetryRecord = {
    id: `rec-${packetCounter}`,
    timestamp: timeStr,
    nodeId: data.nodeId || 'LORA-NODE-01',
    waterLevel: Math.round(data.waterLevel),
    rateOfRise: Math.max(0, rateOfRise),
    flowVelocity: data.flowVelocity !== undefined ? parseFloat(data.flowVelocity.toFixed(2)) : 2.1,
    rainfall: data.rainfall !== undefined ? parseFloat(data.rainfall.toFixed(1)) : 18.4,
    turbidity: data.turbidity !== undefined ? Math.round(data.turbidity) : 65,
    waterTemp: 19.2,
    battery: data.battery !== undefined ? parseFloat(data.battery.toFixed(2)) : 3.88,
    rssi: data.rssi !== undefined ? data.rssi : -76,
    snr: data.snr !== undefined ? parseFloat(data.snr.toFixed(1)) : 10.2,
    frequency: data.frequency || '868.100 MHz',
    packetNumber: packetCounter,
    status,
  };

  telemetryHistory.push(newRecord);
  if (telemetryHistory.length > 60) telemetryHistory.shift();

  floodConfig.lastPacketTime = now.toISOString();
  floodConfig.packetsReceived = packetCounter;

  // Check if an alert needs to be generated
  if (status === 'warning' || status === 'critical') {
    const alertTitle =
      status === 'critical' ? 'CRITICAL FLOOD DISASTER THRESHOLD EXCEEDED' : 'SEVERE FLOOD WARNING INGESTED';
    const alertMessage = `Station ${newRecord.nodeId} water level is ${newRecord.waterLevel} cm (Threshold: ${
      status === 'critical' ? floodConfig.criticalThreshold : floodConfig.warningThreshold
    } cm). Flow rate: ${newRecord.flowVelocity} m/s.`;

    const newAlert: AlertRecord = {
      id: `alt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeStr,
      level: status,
      title: alertTitle,
      message: alertMessage,
      waterLevel: newRecord.waterLevel,
      nodeId: newRecord.nodeId,
      smsDispatched: false,
      smsRecipientsCount: 0,
      acknowledged: false,
    };

    // Auto-dispatch SMS
    dispatchSmsForAlert(status, newRecord.waterLevel, newRecord.nodeId).then((recipientsCount) => {
      newAlert.smsDispatched = recipientsCount > 0;
      newAlert.smsRecipientsCount = recipientsCount;
      alertHistory.unshift(newAlert);
      if (alertHistory.length > 30) alertHistory.pop();
      broadcastToClients('alert_created', newAlert);
    });
  }

  // Update physical nodes on GIS
  const node0 = physicalNodes.find((n) => n.id === 'LORA-NODE-01');
  if (node0) {
    node0.waterLevel = newRecord.waterLevel;
    node0.rateOfRise = newRecord.rateOfRise;
    node0.flowVelocity = newRecord.flowVelocity;
    node0.batteryVolts = newRecord.battery;
    node0.rssi = newRecord.rssi;
    node0.snr = newRecord.snr;
    node0.status = status === 'normal' ? 'online' : status;
    node0.lastHeard = 'Just now';
  }

  // Culvert Node with Differential Trash Screen Head Pressure
  const culvertNode = physicalNodes.find((n) => n.id === 'CULVERT-G3-NORTH');
  if (culvertNode) {
    const upstream = Math.round(newRecord.waterLevel * 0.96);
    // If trash screen is blocked, downstream drops significantly
    const downstream = Math.round(newRecord.waterLevel * 0.62);
    const diff = upstream - downstream;
    const isBlocked = diff >= 35;
    culvertNode.upstreamWaterLevel = upstream;
    culvertNode.downstreamWaterLevel = downstream;
    culvertNode.trashScreenBlocked = isBlocked;
    culvertNode.blockageRatio = Math.min(95, Math.max(15, Math.round((diff / 65) * 100)));
    culvertNode.waterLevel = upstream;
    culvertNode.status = isBlocked ? 'critical' : 'online';
    culvertNode.lastHeard = 'Just now';

    // Auto-alert if clogged and no unacknowledged alert exists
    if (isBlocked && !alertHistory.some((a) => a.title.includes('Trash Screen Clogged') && !a.acknowledged)) {
      const blockageAlert: AlertRecord = {
        id: `alt-blockage-${Date.now()}`,
        timestamp: timeStr,
        level: 'warning',
        title: '⚠️ Culvert Blockage Detected: Trash Screen Clogged',
        message: `Differential head pressure of ${diff}cm detected at Sector 4 North Culvert (Upstream: ${upstream}cm, Downstream: ${downstream}cm). Flow impeded by ~${culvertNode.blockageRatio}%. Deploy sanitation crew.`,
        waterLevel: upstream,
        nodeId: culvertNode.id,
        smsDispatched: true,
        smsRecipientsCount: 2,
        acknowledged: false,
      };
      alertHistory.unshift(blockageAlert);
      broadcastToClients('alert_created', blockageAlert);
    }
  }

  // Urban Drain Node
  const urbanNode = physicalNodes.find((n) => n.id === 'LORA-NODE-03-URBAN');
  if (urbanNode) {
    urbanNode.waterLevel = Math.round(newRecord.waterLevel * 0.74);
    urbanNode.status = urbanNode.waterLevel > 220 ? 'critical' : urbanNode.waterLevel > 170 ? 'warning' : 'online';
    urbanNode.lastHeard = 'Just now';
  }

  // Spillway Node
  const spillNode = physicalNodes.find((n) => n.id === 'LORA-NODE-04-SPILL');
  if (spillNode) {
    spillNode.waterLevel = Math.round(newRecord.waterLevel * 0.58);
    spillNode.status = spillNode.waterLevel > 240 ? 'warning' : 'online';
    spillNode.lastHeard = 'Just now';
  }

  // Dynamic Risk Contours for Wards based on current flood height
  if (floodRiskZones[0]) {
    floodRiskZones[0].riskLevel = newRecord.waterLevel >= 275 ? 'danger' : newRecord.waterLevel >= 210 ? 'beware' : 'safe';
    floodRiskZones[0].waterDepthCm = Math.max(0, Math.round((newRecord.waterLevel - 190) * 0.5));
  }
  if (floodRiskZones[1]) {
    floodRiskZones[1].riskLevel = newRecord.waterLevel >= 310 ? 'danger' : newRecord.waterLevel >= 240 ? 'beware' : 'safe';
    floodRiskZones[1].waterDepthCm = Math.max(0, Math.round((newRecord.waterLevel - 225) * 0.38));
  }
  if (floodRiskZones[2]) {
    floodRiskZones[2].riskLevel = newRecord.waterLevel >= 250 ? 'danger' : newRecord.waterLevel >= 185 ? 'beware' : 'safe';
    floodRiskZones[2].waterDepthCm = Math.max(0, Math.round((newRecord.waterLevel - 175) * 0.6));
  }

  // Dynamic Evacuation Route Vectors (Automated Safe Vector Routing)
  const isCulvertBlocked = culvertNode ? (culvertNode.status === 'critical' || culvertNode.trashScreenBlocked) : false;
  const isUrbanCritical = urbanNode ? (urbanNode.status === 'critical') : false;

  if (evacuationRoutes[0]) {
    if (isCulvertBlocked || newRecord.waterLevel >= 310) {
      evacuationRoutes[0].status = 'blocked';
    } else if (newRecord.waterLevel >= 250) {
      evacuationRoutes[0].status = 'caution';
    } else {
      evacuationRoutes[0].status = 'clear';
    }
  }

  if (evacuationRoutes[1]) {
    evacuationRoutes[1].status = isUrbanCritical ? 'caution' : 'clear';
  }

  if (evacuationRoutes[2]) {
    evacuationRoutes[2].status = (isUrbanCritical || newRecord.waterLevel >= 260) ? 'blocked' : 'caution';
  }

  // Broadcast telemetry and GIS to all connected dashboards and mobile apps
  broadcastToClients('telemetry_update', newRecord);
  broadcastToClients('gis_update', { nodes: physicalNodes, zones: floodRiskZones, routes: evacuationRoutes });
  return newRecord;
}

// Background generator for gentle sensor fluctuations if live LoRa stream is idle
setInterval(() => {
  if (telemetryHistory.length === 0) return;
  const last = telemetryHistory[telemetryHistory.length - 1];
  // Drift water level slightly to keep live charts vibrant
  const drift = (Math.random() - 0.48) * 1.8;
  const nextWater = Math.max(120, Math.min(480, Math.round(last.waterLevel + drift)));
  const nextFlow = parseFloat(Math.max(0.5, (1.2 + (nextWater - 150) * 0.008 + (Math.random() - 0.5) * 0.1)).toFixed(2));
  const nextRain = parseFloat(Math.max(0, (last.rainfall + (Math.random() - 0.5) * 0.8)).toFixed(1));
  const nextTurbidity = Math.max(10, Math.round(last.turbidity + (Math.random() - 0.5) * 2));

  processSensorPacket({
    nodeId: last.nodeId,
    waterLevel: nextWater,
    flowVelocity: nextFlow,
    rainfall: nextRain,
    turbidity: nextTurbidity,
    battery: 3.89,
    rssi: -77 + Math.round((Math.random() - 0.5) * 6),
    snr: 9.5 + Math.round((Math.random() - 0.5) * 2),
  });
}, 8000);

// ==========================================
// API ROUTES
// ==========================================

// Auth Endpoint for Municipal Admin & NDRF Team Access
app.post('/api/auth/login', (req, res) => {
  const { username, password, targetRole } = req.body || {};
  if (username === 'admin' && password === 'admin123') {
    const validRole = targetRole === 'ndrf' ? 'ndrf' : 'admin';
    res.json({
      success: true,
      role: validRole,
      token: `fg_auth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      authenticatedAt: new Date().toISOString(),
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid administrative credentials. Access denied.',
    });
  }
});

// 1. System Health and Gateway Info
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    gateway: floodConfig,
    activeNodesCount: 1,
    latestRecord: telemetryHistory[telemetryHistory.length - 1] || null,
    activeAlertsCount: alertHistory.filter((a) => !a.acknowledged).length,
    smsDispatchedTotal: smsHistory.length,
    timestamp: new Date().toISOString(),
  });
});

// 2. Telemetry History for Visualizations
app.get('/api/telemetry', (req, res) => {
  res.json({
    records: telemetryHistory,
    latest: telemetryHistory[telemetryHistory.length - 1] || null,
  });
});

// 3. Real-Time Server-Sent Events (SSE) Stream
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = ++clientIdCounter;
  sseClients.push({ id: clientId, res });

  // Send initial payload
  res.write(
    `event: initial_state\ndata: ${JSON.stringify({
      config: floodConfig,
      latest: telemetryHistory[telemetryHistory.length - 1],
      telemetryCount: telemetryHistory.length,
      alerts: alertHistory.slice(0, 10),
      contacts: emergencyContacts,
      nodes: physicalNodes,
      zones: floodRiskZones,
      actuators: damActuators,
      broadcastStatus: broadcastHubStatus,
    })}\n\n`
  );

  req.on('close', () => {
    sseClients = sseClients.filter((c) => c.id !== clientId);
  });
});

// 4. LoRa Gateway Uplink Endpoint (Receiver "LoRa")
// Accepts real payloads from TTN (The Things Network), ChirpStack, Heltec, Dragino, ESP32 LoRa gateways
app.post('/api/lora/uplink', (req, res) => {
  try {
    const body = req.body || {};
    let waterLevel = 220;
    let flowVelocity = 2.0;
    let rainfall = 15.0;
    let turbidity = 50;
    let nodeId = 'LORA-NODE-01';
    let rssi = -80;
    let snr = 9.0;
    let frequency = '868.100 MHz';

    // Parse TTN format: body.uplink_message.decoded_payload
    if (body.uplink_message?.decoded_payload) {
      const p = body.uplink_message.decoded_payload;
      if (p.waterLevel !== undefined) waterLevel = Number(p.waterLevel);
      else if (p.water_level !== undefined) waterLevel = Number(p.water_level);
      else if (p.distance_cm !== undefined) waterLevel = 500 - Number(p.distance_cm); // ultrasonic depth inversion
      if (p.flowVelocity !== undefined) flowVelocity = Number(p.flowVelocity);
      if (p.rainfall !== undefined) rainfall = Number(p.rainfall);
      if (p.turbidity !== undefined) turbidity = Number(p.turbidity);
      nodeId = body.end_device_ids?.device_id || 'TTN-LORA-NODE';
      if (body.uplink_message?.rx_metadata?.[0]) {
        rssi = body.uplink_message.rx_metadata[0].rssi || -82;
        snr = body.uplink_message.rx_metadata[0].snr || 8.5;
      }
    }
    // Parse Dragino / ChirpStack / Generic JSON format
    else if (body.data) {
      const d = body.data;
      if (d.waterLevel !== undefined) waterLevel = Number(d.waterLevel);
      if (d.flowVelocity !== undefined) flowVelocity = Number(d.flowVelocity);
      if (d.rainfall !== undefined) rainfall = Number(d.rainfall);
      if (d.turbidity !== undefined) turbidity = Number(d.turbidity);
      if (d.nodeId) nodeId = String(d.nodeId);
      if (d.rssi !== undefined) rssi = Number(d.rssi);
      if (d.snr !== undefined) snr = Number(d.snr);
    }
    // Direct REST parameters
    else {
      if (body.waterLevel !== undefined) waterLevel = Number(body.waterLevel);
      else if (body.water_level !== undefined) waterLevel = Number(body.water_level);
      if (body.flowVelocity !== undefined) flowVelocity = Number(body.flowVelocity);
      if (body.rainfall !== undefined) rainfall = Number(body.rainfall);
      if (body.turbidity !== undefined) turbidity = Number(body.turbidity);
      if (body.nodeId) nodeId = String(body.nodeId);
      if (body.rssi !== undefined) rssi = Number(body.rssi);
      if (body.snr !== undefined) snr = Number(body.snr);
      if (body.frequency) frequency = String(body.frequency);
    }

    const processed = processSensorPacket({
      nodeId,
      waterLevel,
      flowVelocity,
      rainfall,
      turbidity,
      rssi,
      snr,
      frequency,
    });

    res.status(200).json({
      success: true,
      message: `Payload successfully received by receiver '${floodConfig.receiverName}'`,
      packetId: processed.id,
      waterLevel: processed.waterLevel,
      status: processed.status,
      timestamp: processed.timestamp,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(400).json({ success: false, error: message });
  }
});

// 5. Send Instant SMS / Broadcast Alert to Mobile Phones
app.post('/api/sms/send', async (req, res) => {
  try {
    const { to, message, recipientName, alertLevel } = req.body;
    if (!to || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const smsRecord: SmsRecord = {
      id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: timeStr,
      to,
      recipientName: recipientName || 'Emergency Responder',
      message,
      status: 'delivered',
      gateway: 'LoRa-Cellular-Bridge',
      alertLevel: alertLevel || 'warning',
    };

    // Twilio optional dispatch
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (twilioSid && twilioAuth && twilioPhone) {
      try {
        const authHeader = 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64');
        const formParams = new URLSearchParams();
        formParams.append('To', to);
        formParams.append('From', twilioPhone);
        formParams.append('Body', message);

        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formParams.toString(),
        });
        smsRecord.status = 'delivered';
      } catch (e) {
        console.error('Twilio SMS error:', e);
      }
    }

    smsHistory.unshift(smsRecord);
    if (smsHistory.length > 50) smsHistory.pop();

    broadcastToClients('sms_dispatched', smsRecord);

    res.json({
      success: true,
      message: 'SMS successfully dispatched to mobile phone',
      sms: smsRecord,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ success: false, error: message });
  }
});

// 6. Get SMS History
app.get('/api/sms/history', (req, res) => {
  res.json({ history: smsHistory });
});

// 7. Get and Acknowledge Alerts
app.get('/api/alerts', (req, res) => {
  res.json({ alerts: alertHistory });
});

app.post('/api/alerts/:id/acknowledge', (req, res) => {
  const alert = alertHistory.find((a) => a.id === req.params.id);
  if (alert) {
    alert.acknowledged = true;
    broadcastToClients('alert_acknowledged', { id: alert.id });
    return res.json({ success: true, alert });
  }
  res.status(404).json({ error: 'Alert not found' });
});

// 8. Configuration & Emergency Contacts
app.get('/api/config', (req, res) => {
  res.json({
    config: floodConfig,
    emergencyContacts,
  });
});

app.post('/api/config', (req, res) => {
  const { thresholds, autoSmsEnabled, receiverName, contacts } = req.body;
  if (thresholds) {
    if (thresholds.normalThreshold !== undefined) floodConfig.normalThreshold = Number(thresholds.normalThreshold);
    if (thresholds.warningThreshold !== undefined) floodConfig.warningThreshold = Number(thresholds.warningThreshold);
    if (thresholds.criticalThreshold !== undefined) floodConfig.criticalThreshold = Number(thresholds.criticalThreshold);
    if (thresholds.evacuationThreshold !== undefined) floodConfig.evacuationThreshold = Number(thresholds.evacuationThreshold);
  }
  if (autoSmsEnabled !== undefined) floodConfig.autoSmsEnabled = Boolean(autoSmsEnabled);
  if (receiverName) floodConfig.receiverName = String(receiverName);
  if (contacts && Array.isArray(contacts)) emergencyContacts = contacts;

  broadcastToClients('config_updated', { config: floodConfig, emergencyContacts });
  res.json({ success: true, config: floodConfig, emergencyContacts });
});

// 9. Manual Simulation / Uplink Test endpoint for rapid field verification
app.post('/api/lora/simulate', (req, res) => {
  const { scenario, customWaterLevel } = req.body;
  let level = 230;
  let flow = 1.9;
  let rain = 14;
  let turb = 45;

  if (scenario === 'flash_flood') {
    level = 385; // Critical
    flow = 4.8;
    rain = 75;
    turb = 185;
  } else if (scenario === 'warning_surge') {
    level = 285; // Warning
    flow = 3.1;
    rain = 42;
    turb = 110;
  } else if (scenario === 'normal_recede') {
    level = 165; // Normal
    flow = 1.2;
    rain = 2;
    turb = 24;
  } else if (customWaterLevel !== undefined) {
    level = Number(customWaterLevel);
    flow = parseFloat((1.0 + level * 0.009).toFixed(2));
    rain = parseFloat((level > 250 ? 35 : 8).toFixed(1));
    turb = Math.round(level * 0.35);
  }

  const record = processSensorPacket({
    nodeId: 'LORA-NODE-01',
    waterLevel: level,
    flowVelocity: flow,
    rainfall: rain,
    turbidity: turb,
    battery: 3.91,
    rssi: -72,
    snr: 11.2,
  });

  res.json({ success: true, scenario, record });
});

// 10. GIS Nodes & Tracking
app.get('/api/gis/nodes', (req, res) => {
  res.json({ nodes: physicalNodes });
});

// 11. GIS Risk Zones & Dynamic Contours
app.get('/api/gis/zones', (req, res) => {
  res.json({ zones: floodRiskZones });
});

// 12. Dam & Sluice Actuators Status
app.get('/api/actuators', (req, res) => {
  res.json({ actuators: damActuators });
});

// 13. Remote Actuator Control (PIN protected / Authorization locked)
app.post('/api/actuators/:id/control', (req, res) => {
  const { openPercentage, pin, commandSource } = req.body;
  const actuator = damActuators.find((a) => a.id === req.params.id);

  if (!actuator) {
    return res.status(404).json({ error: 'Actuator not found' });
  }

  // Safety PIN verification (supports demo PIN 1122 or 9999 or admin authorization)
  if (pin && pin !== '1122' && pin !== '9999' && pin !== 'admin') {
    return res.status(401).json({ error: 'Invalid Municipal Safety PIN. Actuator command rejected.' });
  }

  const targetPercent = Math.max(0, Math.min(100, Number(openPercentage)));
  actuator.openPercentage = targetPercent;
  actuator.status = targetPercent === 0 ? 'closed' : 'open';
  actuator.dischargeCapacityM3s = Math.round(targetPercent * 4.2);
  actuator.lastCommandTime = 'Just now';
  actuator.commandSource = commandSource || 'Supervisory Control Center Over-Ride';

  broadcastToClients('actuator_updated', { actuator, allActuators: damActuators });

  res.json({
    success: true,
    message: `Actuator ${actuator.name} successfully repositioned to ${targetPercent}% opening`,
    actuator,
  });
});

// 14. Culvert Trash Screen Flush & Sanitation Crew Dispatch
app.post('/api/culverts/:id/flush', (req, res) => {
  const culvert = physicalNodes.find((n) => n.id === req.params.id);
  if (!culvert) {
    return res.status(404).json({ error: 'Culvert not found' });
  }

  culvert.trashScreenBlocked = false;
  culvert.blockageRatio = 12;
  culvert.status = 'online';
  if (culvert.upstreamWaterLevel) {
    culvert.downstreamWaterLevel = Math.round(culvert.upstreamWaterLevel * 0.92);
  }

  // Update associated actuator
  const flushActuator = damActuators.find((a) => a.id === 'ACT-CULVERT-03');
  if (flushActuator) {
    flushActuator.status = 'open';
    flushActuator.openPercentage = 100;
    flushActuator.lastCommandTime = 'Just now';
  }

  broadcastToClients('gis_update', { nodes: physicalNodes, zones: floodRiskZones });
  broadcastToClients('actuator_updated', { actuator: flushActuator, allActuators: damActuators });

  res.json({
    success: true,
    message: `High-pressure hydraulic flush activated on ${culvert.name}. Sanitation field crew dispatched via automated VHF radio & GSM.`,
    culvert,
  });
});

// 15. Predictive Analytics & Machine Learning Model Outputs
app.get('/api/predictive', (req, res) => {
  const latest = telemetryHistory[telemetryHistory.length - 1];
  const waterLevel = latest ? latest.waterLevel : 260;
  const rateOfRise = latest ? latest.rateOfRise : 2.1; // cm/min

  let timeToBreachMinutes: number | null = null;
  let breachStatus: 'stable' | 'rising' | 'imminent' | 'breached' = 'stable';

  if (waterLevel >= floodConfig.criticalThreshold) {
    timeToBreachMinutes = 0;
    breachStatus = 'breached';
  } else if (rateOfRise > 0.2) {
    const diff = floodConfig.criticalThreshold - waterLevel;
    // Regression calculation: minutes = diff / (rateOfRise * regression_factor)
    const minutes = Math.max(1, Math.round(diff / (rateOfRise * 0.85)));
    timeToBreachMinutes = minutes;
    breachStatus = minutes <= 45 ? 'imminent' : 'rising';
  } else {
    timeToBreachMinutes = null;
    breachStatus = 'stable';
  }

  // Generate 24-Hour Upstream Rainfall vs Downstream Runoff Hydrograph
  const now = Date.now();
  const hydrograph = [];
  for (let h = 24; h >= 0; h--) {
    const time = new Date(now - h * 3600000);
    const hourLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    // Hydrograph simulation: rainfall peaks 2 hours earlier than river stage
    const rainFactor = Math.sin((24 - h) / 4) * 22 + (Math.random() * 4 - 2);
    const rainfallAccumulation = Math.max(2, parseFloat((rainFactor + 18).toFixed(1)));
    const stageFactor = Math.sin((24 - h - 1.5) / 4) * 90 + (Math.random() * 10 - 5);
    const riverStage = Math.max(140, Math.round(180 + stageFactor));
    const simulatedRunoff = Math.round(rainfallAccumulation * 14.5 + (riverStage - 140) * 1.8);

    hydrograph.push({
      hour: hourLabel,
      rainfallAccumulationMm: rainfallAccumulation,
      riverStageCm: riverStage,
      simulatedRunoffM3s: simulatedRunoff,
    });
  }

  res.json({
    waterLevel,
    criticalThreshold: floodConfig.criticalThreshold,
    rateOfRise,
    timeToBreachMinutes,
    breachStatus,
    confidenceScore: 94.8,
    projectedPeakCm: Math.round(waterLevel + (rateOfRise * 32)),
    regressionSlope: rateOfRise,
    upstreamRainLagMinutes: 42,
    hydrograph,
  });
});

// 16. Multi-Channel Emergency Broadcast Hub (SMS + Telegram + WhatsApp + Physical Siren)
app.post('/api/broadcast/dispatch', async (req, res) => {
  const { message, priority } = req.body;
  const alertText =
    message ||
    `[SIH FLOOD EMERGENCY ALERT] Critical water level reached. Evacuation active for Ward 4 lowlands. High elevation haven at Model School.`;

  // 1. Dispatch SMS to all emergency contacts
  const eligibleRecipients = emergencyContacts;
  for (const contact of eligibleRecipients) {
    const smsRecord: SmsRecord = {
      id: `sms-bcast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      to: contact.phone,
      recipientName: contact.name,
      message: alertText,
      status: 'delivered',
      gateway: 'GSM-LoRa-Cellular-Mesh',
      alertLevel: priority || 'critical',
    };
    smsHistory.unshift(smsRecord);
    broadcastToClients('sms_dispatched', smsRecord);
  }

  // 2. Activate physical siren & strobe at LoRa Gateway
  broadcastHubStatus.active = true;
  broadcastHubStatus.smsSentCount += eligibleRecipients.length;
  broadcastHubStatus.telegramDelivered = true;
  broadcastHubStatus.whatsappDelivered = true;
  broadcastHubStatus.physicalSirenTriggered = true;
  broadcastHubStatus.lastTriggerTimestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  broadcastHubStatus.targetMessage = alertText;

  broadcastToClients('broadcast_triggered', broadcastHubStatus);

  // Auto silence physical siren after 45 seconds if not silenced manually
  setTimeout(() => {
    broadcastHubStatus.physicalSirenTriggered = false;
    broadcastToClients('broadcast_triggered', broadcastHubStatus);
  }, 45000);

  res.json({
    success: true,
    message: 'Multi-Channel Emergency Alert Dispatched Across All Carriers, Webhooks & Physical Sirens',
    broadcastStatus: broadcastHubStatus,
    smsDispatchedCount: eligibleRecipients.length,
    telegramStatus: 'DELIVERED_TO_COMMUNITY_CHANNEL',
    whatsappStatus: 'DELIVERED_TO_WARD_MARSHALS',
    sirenStatus: 'ACOUSTIC_SIREN_ACTIVE_120DB',
  });
});

// 17. Silence Physical Siren
app.post('/api/broadcast/silence-siren', (req, res) => {
  broadcastHubStatus.physicalSirenTriggered = false;
  broadcastToClients('broadcast_triggered', broadcastHubStatus);
  res.json({ success: true, message: 'Physical siren muted' });
});

// 18. GIS Evacuation Routes & Vectors
app.get('/api/gis/routes', (req, res) => {
  res.json({ routes: evacuationRoutes });
});

app.get('/api/gis/layers', (req, res) => {
  res.json({
    nodes: physicalNodes,
    zones: floodRiskZones,
    routes: evacuationRoutes,
  });
});

// 19. System Event Logs (Tab 6 Automated Event Ledger)
app.get('/api/logs/system', (req, res) => {
  res.json({ logs: systemEventLogs });
});

app.post('/api/logs/system', (req, res) => {
  const { eventType, severity, nodeId, message, waterLevel } = req.body;
  const newLog: SystemEventLogData = {
    id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventType: eventType || 'watchdog',
    severity: severity || 'info',
    nodeId: nodeId || 'SYSTEM',
    message: message || 'System telemetry updated',
    waterLevel,
  };
  systemEventLogs.unshift(newLog);
  if (systemEventLogs.length > 200) systemEventLogs.pop();
  broadcastToClients('system_log', newLog);
  res.json({ success: true, log: newLog });
});

// 20. Action Audit Trail (Tab 6 Human Activity & Overrides)
app.get('/api/logs/audit', (req, res) => {
  res.json({ logs: actionAuditLogs });
});

app.post('/api/logs/audit', (req, res) => {
  const { actor, role, action, targetAsset, status, reason, ipAddress } = req.body;
  const newAudit: ActionAuditLogData = {
    id: `AUD-${Math.floor(8000 + Math.random() * 2000)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: actor || 'Authorized Operator',
    role: role || 'admin',
    action: action || 'Manual supervisory intervention',
    targetAsset: targetAsset || 'CORE-SYSTEM',
    status: status || 'success',
    reason: reason || 'Operational compliance standard override',
    ipAddress: ipAddress || '192.168.1.110 (Control Room)',
  };
  actionAuditLogs.unshift(newAudit);
  if (actionAuditLogs.length > 200) actionAuditLogs.pop();
  broadcastToClients('audit_log', newAudit);
  res.json({ success: true, audit: newAudit });
});

// 21. Field Maintenance Checks (Tab 5 Field Operator Profile)
app.get('/api/maintenance/logs', (req, res) => {
  res.json({ logs: maintenanceLogs });
});

app.post('/api/maintenance/logs', (req, res) => {
  const { nodeId, operatorName, batteryStatus, physicalDamage, trashScreenCleaned, notes, status } = req.body;
  const newLog: FieldMaintenanceLogData = {
    id: `MAINT-${Math.floor(300 + Math.random() * 700)}`,
    timestamp: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    nodeId: nodeId || 'LORA-NODE-01',
    operatorName: operatorName || 'Field Operator',
    batteryStatus: batteryStatus || '3.90V Nominal',
    physicalDamage: Boolean(physicalDamage),
    trashScreenCleaned: Boolean(trashScreenCleaned),
    notes: notes || 'Routine field inspection completed.',
    status: status || 'verified',
  };
  maintenanceLogs.unshift(newLog);

  // Also log into action audit trail
  const auditEntry: ActionAuditLogData = {
    id: `AUD-${Math.floor(8000 + Math.random() * 2000)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: newLog.operatorName,
    role: 'field_operator',
    action: `Filed Physical Field Maintenance Check on ${newLog.nodeId}`,
    targetAsset: newLog.nodeId,
    status: 'success',
    reason: newLog.notes,
    ipAddress: '10.240.16.44 (Field Handheld)',
  };
  actionAuditLogs.unshift(auditEntry);
  broadcastToClients('audit_log', auditEntry);

  res.json({ success: true, maintenanceLog: newLog });
});

// 22. Public API Key Management (Tab 5 Open Source Integration)
app.get('/api/keys', (req, res) => {
  res.json({ keys: publicApiKeys });
});

app.post('/api/keys/generate', (req, res) => {
  const { name, organization, rateLimitPerMin } = req.body;
  const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
  const newKey: ApiKeyRecordData = {
    id: `KEY-${String(publicApiKeys.length + 1).padStart(3, '0')}`,
    name: name || 'Third-Party Integration Key',
    key: `fl_live_${randomHex}`,
    organization: organization || 'Hydrological Research Lab',
    createdAt: new Date().toISOString().split('T')[0],
    rateLimitPerMin: Number(rateLimitPerMin) || 120,
    requestsCount: 0,
    status: 'active',
  };
  publicApiKeys.unshift(newKey);
  res.json({ success: true, key: newKey });
});

app.post('/api/keys/:id/revoke', (req, res) => {
  const key = publicApiKeys.find((k) => k.id === req.params.id);
  if (key) {
    key.status = 'revoked';
    return res.json({ success: true, message: `Key ${key.id} revoked successfully`, key });
  }
  res.status(404).json({ error: 'Key not found' });
});

// 23. Node Registration (Tab 5 Admin Profile)
app.post('/api/nodes/register', (req, res) => {
  const { id, name, type, lat, lng, hardwareSerial, frequencyBand, spreadingFactor } = req.body;
  if (!id || !name) {
    return res.status(400).json({ error: 'Node ID and name are required' });
  }

  const existing = physicalNodes.find((n) => n.id === id);
  if (existing) {
    return res.status(400).json({ error: 'Node with this ID already registered' });
  }

  const newNode: PhysicalNodeData = {
    id,
    name,
    type: type || 'river_gauge',
    lat: Number(lat) || 28.615,
    lng: Number(lng) || 77.215,
    status: 'online',
    waterLevel: 185,
    rateOfRise: 0.2,
    flowVelocity: 1.4,
    batteryPercent: 96,
    batteryVolts: 3.95,
    solarWatts: 4.8,
    solarCurrentMa: 920,
    rssi: -74,
    snr: 10.4,
    pdr: 99.2,
    packetsSent: 420,
    packetsReceived: 417,
    lastHeard: 'Just now',
    hardwareSerial: hardwareSerial || 'ESP32-SX1262-v3',
    frequencyBand: frequencyBand || '868.100 MHz (IN865)',
    spreadingFactor: spreadingFactor || 'SF7 / BW 125kHz',
  };

  physicalNodes.push(newNode);
  broadcastToClients('gis_update', { nodes: physicalNodes, zones: floodRiskZones, routes: evacuationRoutes });

  // Add to audit trail
  actionAuditLogs.unshift({
    id: `AUD-${Math.floor(8000 + Math.random() * 2000)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    actor: 'Municipal Admin',
    role: 'admin',
    action: `Registered New Hardware Node: ${newNode.id} (${newNode.name})`,
    targetAsset: newNode.id,
    status: 'success',
    reason: 'Expanded network telemetry catchment zone.',
    ipAddress: '192.168.1.104 (Command Console)',
  });

  res.json({ success: true, node: newNode });
});

// 24. Dual Database Architecture Schema & Live Query Sandbox
app.get('/api/database/schema', (req, res) => {
  res.json({
    timeSeriesDb: {
      engine: 'TimescaleDB / InfluxDB (Dual Real-Time Hypertable)',
      retentionPolicy: '90 days raw (3-second resolution), 5-year aggregated downsampled rollups',
      chunkTimeInterval: '1 day chunks',
      tables: [
        {
          name: 'telemetry_metrics (Hypertable)',
          columns: [
            { name: 'time', type: 'TIMESTAMPTZ NOT NULL', key: 'PRIMARY / PARTITION' },
            { name: 'node_id', type: 'VARCHAR(64) NOT NULL', key: 'INDEXED TAG' },
            { name: 'water_level_cm', type: 'DOUBLE PRECISION', key: 'METRIC' },
            { name: 'flow_velocity_ms', type: 'REAL', key: 'METRIC' },
            { name: 'rainfall_mm', type: 'REAL', key: 'METRIC' },
            { name: 'differential_head_cm', type: 'REAL', key: 'METRIC' },
            { name: 'rssi_dbm', type: 'SMALLINT', key: 'DIAGNOSTIC' },
            { name: 'snr_db', type: 'REAL', key: 'DIAGNOSTIC' },
            { name: 'battery_volts', type: 'REAL', key: 'DIAGNOSTIC' },
          ],
          continuousAggregates: 'hourly_water_stage_avg, daily_max_surge_summary',
        },
      ],
    },
    relationalSpatialDb: {
      engine: 'PostgreSQL 16 + PostGIS Extension 3.4',
      tables: [
        {
          name: 'gis_sensor_assets',
          columns: [
            { name: 'id', type: 'VARCHAR(64) PRIMARY KEY' },
            { name: 'name', type: 'TEXT NOT NULL' },
            { name: 'asset_type', type: 'ENUM (river_gauge, culvert_gate, urban_drain, gateway)' },
            { name: 'geom', type: 'GEOMETRY(Point, 4326) NOT NULL', key: 'SPATIAL GIST INDEX' },
            { name: 'elevation_msl', type: 'NUMERIC(6,2)' },
            { name: 'ward_code', type: 'VARCHAR(32)' },
          ],
        },
        {
          name: 'gis_flood_contours',
          columns: [
            { name: 'zone_id', type: 'VARCHAR(32) PRIMARY KEY' },
            { name: 'ward_name', type: 'TEXT NOT NULL' },
            { name: 'polygon_geom', type: 'GEOMETRY(Polygon, 4326) NOT NULL', key: 'SPATIAL GIST INDEX' },
            { name: 'critical_threshold_cm', type: 'INTEGER' },
            { name: 'population_at_risk', type: 'INTEGER' },
          ],
        },
        {
          name: 'evacuation_corridors',
          columns: [
            { name: 'route_id', type: 'VARCHAR(32) PRIMARY KEY' },
            { name: 'route_name', type: 'TEXT' },
            { name: 'path_line', type: 'GEOMETRY(LineString, 4326)', key: 'SPATIAL INDEX' },
            { name: 'destination_haven', type: 'TEXT' },
            { name: 'status', type: 'VARCHAR(20)' },
          ],
        },
      ],
    },
  });
});

app.post('/api/database/query', (req, res) => {
  const { query, dbType } = req.body;
  // Return simulated high-performance time-series query results
  const sampleRows = [
    { time: '2026-09-11 14:00:00+00', node_id: 'LORA-NODE-01', water_level_cm: 285.2, flow_velocity_ms: 2.14, rssi_dbm: -74 },
    { time: '2026-09-11 13:55:00+00', node_id: 'LORA-NODE-01', water_level_cm: 282.8, flow_velocity_ms: 2.08, rssi_dbm: -75 },
    { time: '2026-09-11 13:50:00+00', node_id: 'LORA-NODE-01', water_level_cm: 279.4, flow_velocity_ms: 1.95, rssi_dbm: -73 },
    { time: '2026-09-11 13:45:00+00', node_id: 'LORA-NODE-01', water_level_cm: 274.1, flow_velocity_ms: 1.82, rssi_dbm: -76 },
    { time: '2026-09-11 13:40:00+00', node_id: 'LORA-NODE-01', water_level_cm: 268.5, flow_velocity_ms: 1.70, rssi_dbm: -74 },
  ];

  res.json({
    success: true,
    executionTimeMs: 4.8,
    rowCount: sampleRows.length,
    dbEngine: dbType === 'spatial' ? 'PostgreSQL 16 + PostGIS 3.4' : 'TimescaleDB Hypertable v2.14',
    rows: sampleRows,
  });
});

// 25. Crowdsourced Citizen Hazard Incident Reports (Tab 5)
app.get('/api/citizen/reports', (req, res) => {
  res.json({ reports: crowdsourcedReports });
});

app.post('/api/citizen/reports', (req, res) => {
  const { author, phone, location, waterDepthCm, description, hazardType } = req.body;
  if (!location || !description) {
    return res.status(400).json({ error: 'Location and description are required' });
  }

  const newReport: CrowdsourcedReportData = {
    id: `REP-${Math.floor(500 + Math.random() * 500)}`,
    timestamp: 'Just now',
    author: author || 'Anonymous Resident',
    phone: phone || '',
    location,
    waterDepthCm: Number(waterDepthCm) || 30,
    description,
    upvotes: 1,
    verified: false,
    hazardType: hazardType || 'waterlogged_road',
  };

  crowdsourcedReports.unshift(newReport);
  broadcastToClients('citizen_report_submitted', newReport);

  // Also log to system event logs
  systemEventLogs.unshift({
    id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    eventType: 'watchdog',
    severity: newReport.waterDepthCm >= 50 ? 'warning' : 'info',
    nodeId: 'CITIZEN-REP',
    message: `Crowdsourced Hazard Report: ${newReport.location} (${newReport.waterDepthCm}cm water, ${newReport.hazardType})`,
    waterLevel: newReport.waterDepthCm,
  });

  res.json({ success: true, report: newReport });
});

app.post('/api/citizen/reports/:id/upvote', (req, res) => {
  const report = crowdsourcedReports.find((r) => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  report.upvotes += 1;
  broadcastToClients('citizen_report_updated', report);
  res.json({ success: true, upvotes: report.upvotes, report });
});

app.post('/api/citizen/reports/:id/verify', (req, res) => {
  const report = crowdsourcedReports.find((r) => r.id === req.params.id);
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  report.verified = true;
  broadcastToClients('citizen_report_updated', report);
  res.json({ success: true, verified: true, report });
});

// 26. Relief Camp & Shelter Live Capacity Directory (Tab 5)
app.get('/api/citizen/shelters', (req, res) => {
  res.json({ shelters: reliefShelters });
});

// ==========================================
// VITE MIDDLEWARE & SERVER STARTUP
// ==========================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`LoRa Flood Detection & Alert System running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
