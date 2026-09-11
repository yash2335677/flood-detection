export type AlertLevel = 'normal' | 'advisory' | 'warning' | 'critical';
export type UserRole = 'admin' | 'ndrf' | 'citizen';

export interface TelemetryRecord {
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
  status: AlertLevel;
}

export interface AlertRecord {
  id: string;
  timestamp: string;
  level: AlertLevel;
  title: string;
  message: string;
  waterLevel: number;
  nodeId: string;
  smsDispatched: boolean;
  smsRecipientsCount: number;
  acknowledged: boolean;
}

export interface SmsRecord {
  id: string;
  timestamp: string;
  to: string;
  recipientName: string;
  message: string;
  status: 'sent' | 'delivered' | 'failed';
  gateway: string;
  alertLevel: AlertLevel | 'test';
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  role: string;
  notifyOn: AlertLevel[];
}

export interface FloodConfig {
  normalThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  evacuationThreshold: number;
  autoSmsEnabled: boolean;
  receiverName: string;
  gatewayId: string;
  gatewayFrequency: string;
  gatewayStatus: string;
  lastPacketTime: string;
  packetsReceived: number;
}

// GIS, Hardware & Node tracking
export interface PhysicalNode {
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
  // Culvert / Trash screen parameters
  upstreamWaterLevel?: number;
  downstreamWaterLevel?: number;
  trashScreenBlocked?: boolean;
  blockageRatio?: number; // 0 to 100%
}

// Risk Zones / Contours
export interface FloodRiskZone {
  id: string;
  name: string;
  wardNumber: string;
  riskLevel: 'safe' | 'beware' | 'danger';
  waterDepthCm: number;
  populationAtRisk: number;
  elevationMeters: number;
  evacuationHaven: string;
  evacuationDistanceKm: number;
  coordinates: [number, number][]; // Lat, Lng polygon
}

// Actuator / Dam Gates
export interface DamActuator {
  id: string;
  name: string;
  location: string;
  status: 'closed' | 'open' | 'adjusting';
  openPercentage: number; // 0 to 100%
  dischargeCapacityM3s: number; // cubic meters / sec
  locked: boolean;
  lastCommandTime: string;
  commandSource: string;
}

// Broadcast Trigger Payload
export interface BroadcastTriggerStatus {
  active: boolean;
  smsSentCount: number;
  telegramDelivered: boolean;
  whatsappDelivered: boolean;
  physicalSirenTriggered: boolean;
  lastTriggerTimestamp?: string;
  targetMessage?: string;
}

// Predictive Analytics State
export interface PredictiveModelData {
  timeToBreachMinutes: number | null; // null if stable/receding
  breachStatus: 'stable' | 'rising' | 'imminent' | 'breached';
  confidenceScore: number; // %
  projectedPeakCm: number;
  regressionSlope: number; // cm/min
  upstreamRainLagMinutes: number;
}

// Evacuation Route Vectors
export interface EvacuationRoute {
  id: string;
  name: string;
  destinationHaven: string;
  status: 'clear' | 'caution' | 'blocked';
  waypoints: [number, number][];
  distanceKm: number;
  criticalNodesAlongRoute: string[];
}

// System Event Logs (Tab 6)
export interface SystemEventLog {
  id: string;
  timestamp: string;
  eventType: 'threshold_breach' | 'sensor_uplink' | 'siren_triggered' | 'failover' | 'watchdog';
  severity: 'info' | 'warning' | 'critical';
  nodeId?: string;
  message: string;
  waterLevel?: number;
}

// Action Audit Trail (Human Overrides, Tab 6)
export interface ActionAuditLog {
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

// Field Maintenance Check (Tab 5)
export interface FieldMaintenanceLog {
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

// Public API Management (Tab 5)
export interface ApiKeyRecord {
  id: string;
  name: string;
  key: string;
  organization: string;
  createdAt: string;
  rateLimitPerMin: number;
  requestsCount: number;
  status: 'active' | 'revoked';
}

// Crowdsourced Citizen Incident Report (Tab 5)
export interface CrowdsourcedReport {
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

// Shelter & Relief Camp Directory (Tab 5)
export interface ReliefCampInfo {
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

