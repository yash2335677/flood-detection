import React, { useState } from 'react';
import {
  Bell,
  MessageSquare,
  Send,
  ShieldAlert,
  CheckCircle2,
  Phone,
  UserCheck,
  AlertTriangle,
  Clock,
  Radio,
  Plus,
  Trash2,
} from 'lucide-react';
import { AlertRecord, SmsRecord, EmergencyContact, FloodConfig } from '../types';

interface AlertsAndSmsPanelProps {
  alerts: AlertRecord[];
  smsHistory: SmsRecord[];
  emergencyContacts: EmergencyContact[];
  config: FloodConfig;
  onAcknowledgeAlert: (id: string) => Promise<void>;
  onSendSms: (to: string, message: string, recipientName: string) => Promise<void>;
  onAddContact: (contact: EmergencyContact) => Promise<void>;
}

export const AlertsAndSmsPanel: React.FC<AlertsAndSmsPanelProps> = ({
  alerts,
  smsHistory,
  emergencyContacts,
  config,
  onAcknowledgeAlert,
  onSendSms,
  onAddContact,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'alerts' | 'smsLog' | 'contacts'>('alerts');

  // Manual SMS Form
  const [targetPhone, setTargetPhone] = useState('+1 (555) 019-2834');
  const [targetName, setTargetName] = useState('District Disaster Management');
  const [customMsg, setCustomMsg] = useState(
    `[FLOODGUARD EMERGENCY] LoRa Receiver '${config.receiverName}' detected hazardous water rise at Node 01. Immediate evacuation advisory in effect.`
  );
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSuccessNotice, setSmsSuccessNotice] = useState<string | null>(null);

  // New Contact Form
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRole, setNewContactRole] = useState('First Responder');

  const handleManualSmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPhone || !customMsg) return;
    setIsSendingSms(true);
    setSmsSuccessNotice(null);
    try {
      await onSendSms(targetPhone, customMsg, targetName);
      setSmsSuccessNotice(`Emergency SMS successfully dispatched to ${targetPhone}`);
      setTimeout(() => setSmsSuccessNotice(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'SMS dispatch failed';
      alert(`Error sending SMS: ${msg}`);
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleAddContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName || !newContactPhone) return;
    const contact: EmergencyContact = {
      id: `c-${Date.now()}`,
      name: newContactName,
      phone: newContactPhone,
      role: newContactRole,
      notifyOn: ['warning', 'critical'],
    };
    await onAddContact(contact);
    setNewContactName('');
    setNewContactPhone('');
    setShowAddContact(false);
  };

  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
      
      {/* Tab Switcher & Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 bg-slate-100 rounded-lg text-xs font-medium border border-slate-200">
            <button
              onClick={() => setActiveSubTab('alerts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                activeSubTab === 'alerts'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-rose-500" />
              <span>Real-Time Alerts</span>
              {unacknowledgedCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                  {unacknowledgedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveSubTab('smsLog')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                activeSubTab === 'smsLog'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
              <span>Instant SMS Log</span>
              <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                {smsHistory.length}
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('contacts')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition ${
                activeSubTab === 'contacts'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>Emergency Mobile List</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                {emergencyContacts.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
          <span>Auto-SMS Dispatch:</span>
          <span className="font-semibold text-emerald-600 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            ACTIVE
          </span>
        </div>
      </div>

      {/* SUBTAB 1: REAL-TIME ALERTS */}
      {activeSubTab === 'alerts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Active &amp; Historic Flood Detection Warnings
            </h4>
            <span className="text-xs text-slate-400">Triggered by LoRa Telemetry Thresholds</span>
          </div>

          {alerts.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <p className="text-slate-700 font-medium text-sm">No Active Flood Threats</p>
              <p className="text-xs text-slate-400 mt-1">Water level readings are within safe hydrologic baselines.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {alerts.map((alert, index) => (
                <div
                  key={alert.id ? `${alert.id}-${index}` : `alert-${index}`}
                  className={`p-4 rounded-xl border transition ${
                    alert.level === 'critical'
                      ? 'bg-rose-50/60 border-rose-200'
                      : alert.level === 'warning'
                      ? 'bg-amber-50/60 border-amber-200'
                      : 'bg-blue-50/60 border-blue-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                            alert.level === 'critical'
                              ? 'bg-rose-600 text-white'
                              : alert.level === 'warning'
                              ? 'bg-amber-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {alert.level}
                        </span>
                        <h5 className="font-bold text-slate-900 text-sm">{alert.title}</h5>
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {alert.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">{alert.message}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {alert.smsDispatched && (
                        <span className="text-[11px] font-medium px-2 py-1 rounded-md bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          SMS Dispatched ({alert.smsRecipientsCount})
                        </span>
                      )}

                      {!alert.acknowledged ? (
                        <button
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-3 py-1 rounded-md bg-white border border-slate-300 text-slate-700 text-xs font-medium hover:bg-slate-50 transition shadow-xs"
                        >
                          Acknowledge
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Acknowledged
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: INSTANT SMS DISPATCH LOG & MANUAL SENDER */}
      {activeSubTab === 'smsLog' && (
        <div className="space-y-6">
          {/* Manual Quick SMS Dispatcher */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-blue-600" />
                Broadcast Instant SMS to Mobile Device
              </h5>
              <span className="text-[11px] text-slate-400">Direct Cellular Gateway</span>
            </div>

            {smsSuccessNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{smsSuccessNotice}</span>
              </div>
            )}

            <form onSubmit={handleManualSmsSubmit} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Recipient Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    value={targetPhone}
                    onChange={(e) => setTargetPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-600 block mb-1">
                    Recipient Designation / Name
                  </label>
                  <input
                    type="text"
                    value={targetName}
                    onChange={(e) => setTargetName(e.target.value)}
                    placeholder="Field Officer / Citizen"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Alert SMS Message Body
                </label>
                <textarea
                  rows={2}
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSendingSms}
                  className="py-1.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition disabled:opacity-60"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSendingSms ? 'Transmitting SMS...' : 'Dispatch Instant SMS'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* SMS History Log Table */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Live SMS Dispatch &amp; Delivery Receipts
            </h5>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3">Mobile Recipient</th>
                    <th className="py-2.5 px-3">Message Content</th>
                    <th className="py-2.5 px-3">Delivery Status</th>
                    <th className="py-2.5 px-3">Gateway</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {smsHistory.map((sms, index) => (
                    <tr key={sms.id ? `${sms.id}-${index}` : `sms-${index}`} className="hover:bg-slate-50/70 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                        {sms.timestamp}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{sms.recipientName}</div>
                        <div className="font-mono text-slate-400 text-[11px]">{sms.to}</div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                        {sms.message}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          {sms.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                        {sms.gateway}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: EMERGENCY MOBILE LIST */}
      {activeSubTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Authorized Emergency Mobile Broadcast Directory
              </h4>
              <p className="text-xs text-slate-400">
                These mobile numbers receive automated instant SMS alerts the second water analysis exceeds safety thresholds.
              </p>
            </div>

            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Recipient</span>
            </button>
          </div>

          {showAddContact && (
            <form onSubmit={handleAddContactSubmit} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h5 className="text-xs font-bold text-slate-800">Register New Mobile Contact</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Officer / Agency Name"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <input
                  type="tel"
                  placeholder="Mobile Phone Number (+1...)"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
                <input
                  type="text"
                  placeholder="Role (e.g. Evacuation Lead)"
                  value={newContactRole}
                  onChange={(e) => setNewContactRole(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContact(false)}
                  className="px-3 py-1 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
                >
                  Save to Emergency Broadcast
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {emergencyContacts.map((contact, index) => (
              <div
                key={contact.id ? `${contact.id}-${index}` : `contact-${index}`}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-xs text-slate-900">{contact.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                      {contact.role}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-blue-600 font-medium">{contact.phone}</div>
                  <div className="text-[10px] text-slate-400">
                    Triggers: {contact.notifyOn.join(', ')}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setTargetPhone(contact.phone);
                      setTargetName(contact.name);
                      setActiveSubTab('smsLog');
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                    title="Send instant SMS"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
