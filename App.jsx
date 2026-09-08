import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, Bell, ChevronDown, ChevronRight, ChevronUp, Home, CreditCard, FileText,
  RefreshCw, BarChart3, Settings, Clock, Users, ArrowUp, Plus, Trash2,
  Copy, Check, Mail, Landmark, AlertTriangle, Send, X, Link2, Briefcase, User,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

const NAVY = '#0A162B';
const GREEN = '#00BF72';
const GREEN_DARK = '#00A863';
const TEXT_SECONDARY = '#6B7280';
const BG = '#F9FAFB';
const BORDER = '#F3F4F6';

function Logo({ size = 28, mono = null }) {
  const c1 = mono || NAVY;
  const c2 = mono || GREEN;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <path d="M8 20C8 14 12 9 18 9C22 9 25 11 27 14L34 22" stroke={c2} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M40 28C40 34 36 39 30 39C26 39 23 37 21 34L14 26" stroke={c1} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M14 22L20 28L34 14" stroke={c2} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: Home },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'transactions', label: 'Transactions', icon: RefreshCw },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
];

const CURRENCIES = { INR: '\u20B9', USD: '$', EUR: '\u20AC', GBP: '\u00A3', CAD: 'CA$' };

function formatMoney(amount, code) {
  try {
    return new Intl.NumberFormat(code === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency', currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch (e) {
    return `${CURRENCIES[code] || '$'}${(amount || 0).toFixed(2)}`;
  }
}
function daysBetween(dateStr) {
  if (!dateStr) return null;
  const due = new Date(dateStr + 'T00:00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}
function uid() { return Math.random().toString(36).slice(2, 10); }

const STORAGE_KEY = 'settlify_invoices_v1';
function loadInvoices() {
  try { const raw = window.localStorage.getItem(STORAGE_KEY); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
}

const SEED_INVOICES = [
  {
    id: 'seed1', number: 'INV-1043', client: { name: 'Acme Corp', email: 'billing@acme.com' },
    project: 'Brand identity package', currency: 'INR', dueDate: '2026-08-20', lateFeePct: 5,
    items: [{ id: uid(), desc: 'Logo design & brand marks', qty: 1, price: 38000 }],
    stripeLink: '', paypalHandle: '', bank: { bankName: '', accountName: '', iban: '', swift: '' },
    status: 'paid',
  },
  {
    id: 'seed2', number: 'INV-1042', client: { name: 'Bright Media', email: 'hello@brightmedia.com' },
    project: 'Website build', currency: 'INR', dueDate: '2026-09-15', lateFeePct: 5,
    items: [{ id: uid(), desc: 'Homepage + 3 pages', qty: 1, price: 32000 }],
    stripeLink: '', paypalHandle: '', bank: { bankName: '', accountName: '', iban: '', swift: '' },
    status: 'sent',
  },
];

const TEMPLATES = {
  gentle: { label: 'Gentle reminder', icon: Clock,
    build: (d) => `Hi ${d.clientName || 'there'},\n\nJust a friendly heads up that invoice for "${d.projectName || 'our project'}" (${d.amount}) is due on ${d.dueDateLabel}.\n\nNo action needed if it's already scheduled \u2014 otherwise you can pay securely here: ${d.payLink}\n\nThanks so much for working with me!\n\nBest,\n${d.freelancerName || 'Your name'}` },
  dueDay: { label: 'Due-day alert', icon: AlertTriangle,
    build: (d) => `Hi ${d.clientName || 'there'},\n\nThis is a quick note that invoice for "${d.projectName || 'our project'}" (${d.amount}) is due today.\n\nYou can settle it in under a minute here: ${d.payLink}\n\nLet me know if you have any questions about the invoice.\n\nBest,\n${d.freelancerName || 'Your name'}` },
  overdue: { label: 'Overdue escalation', icon: Send,
    build: (d) => `Hi ${d.clientName || 'there'},\n\nI wanted to flag that the invoice for "${d.projectName || 'our project'}" (${d.amount}) is now ${d.overdueDays} day${d.overdueDays === 1 ? '' : 's'} past due.\n\nCould you take care of it in the next couple of days? You can pay directly here: ${d.payLink}\n\nIf something's holding this up on your end, just let me know and we'll sort it out.\n\nThanks,\n${d.freelancerName || 'Your name'}` },
};

function StatusPill({ status }) {
  const styles = {
    paid: { bg: '#E7FBF3', color: GREEN_DARK, label: 'Paid' },
    sent: { bg: '#EAF2FE', color: '#2563EB', label: 'Sent' },
    draft: { bg: '#F3F4F6', color: TEXT_SECONDARY, label: 'Draft' },
    overdue: { bg: '#FDECEC', color: '#DC2626', label: 'Overdue' },
  };
  const s = styles[status] || styles.draft;
  return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
}

const inputClass = 'w-full bg-white border rounded-lg px-3 py-2 text-sm outline-none transition-colors';
const inputStyle = { borderColor: '#E5E7EB', color: NAVY };

function Field({ label, children }) {
  return <div className="mb-4"><label className="block text-xs font-medium mb-1.5" style={{ color: TEXT_SECONDARY }}>{label}</label>{children}</div>;
}

// ---------------- DASHBOARD PAGE ----------------
const chartData = [
  { date: 'Apr 26', settled: 168000, pending: 42000 },
  { date: 'May 03', settled: 179000, pending: 38000 },
  { date: 'May 10', settled: 195000, pending: 51000 },
  { date: 'May 17', settled: 248750, pending: 73420 },
  { date: 'May 24', settled: 231000, pending: 60000 },
];
const paymentMethods = [
  { name: 'UPI', value: 62, color: GREEN },
  { name: 'Bank Transfer', value: 23, color: NAVY },
  { name: 'Cards', value: 10, color: '#D1D5DB' },
  { name: 'Others', value: 5, color: '#E5E7EB' },
];
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const settled = payload.find((p) => p.dataKey === 'settled');
  const pending = payload.find((p) => p.dataKey === 'pending');
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-4 py-3 text-sm">
      <div className="font-medium mb-2" style={{ color: NAVY }}>{label}, 2025</div>
      <div className="flex items-center gap-2 mb-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: GREEN }} /><span style={{ color: TEXT_SECONDARY }}>Settled</span><span className="font-medium ml-auto" style={{ color: NAVY }}>\u20B9{settled?.value.toLocaleString('en-IN')}</span></div>
      <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: NAVY }} /><span style={{ color: TEXT_SECONDARY }}>Pending</span><span className="font-medium ml-auto" style={{ color: NAVY }}>\u20B9{pending?.value.toLocaleString('en-IN')}</span></div>
    </div>
  );
}

function DashboardPage({ invoices, goToInvoices }) {
  const paidTotal = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.items.reduce((a, it) => a + it.qty * it.price, 0), 0);
  const pendingTotal = invoices.filter(i => i.status === 'sent').reduce((s, i) => s + i.items.reduce((a, it) => a + it.qty * it.price, 0), 0);
  const recent = invoices.slice(0, 5);

  return (
    <>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ color: NAVY }}>Good morning, Dev <span>\uD83D\uDC4B</span></h1>
          <p className="text-sm mt-1" style={{ color: TEXT_SECONDARY }}>Here's what's happening with your settlements today.</p>
        </div>
        <button onClick={goToInvoices} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-transform active:scale-95" style={{ backgroundColor: GREEN }}>
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#E7FBF3' }}><Logo size={18} /></div>
            <span className="text-sm" style={{ color: TEXT_SECONDARY }}>Settled This Month</span>
          </div>
          <div className="flex items-end gap-2 mt-4">
            <span className="text-3xl font-semibold" style={{ color: GREEN }}>{formatMoney(paidTotal || 248750, 'INR')}</span>
            <span className="flex items-center gap-0.5 text-xs font-medium mb-1" style={{ color: GREEN_DARK }}><ArrowUp size={12} /> 12%</span>
          </div>
          <div className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>vs. last month</div>
        </div>
        <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: BORDER }}><Clock size={18} style={{ color: NAVY }} /></div>
            <span className="text-sm" style={{ color: TEXT_SECONDARY }}>Awaiting Settlement</span>
          </div>
          <div className="flex items-end gap-2 mt-4"><span className="text-3xl font-semibold" style={{ color: NAVY }}>{formatMoney(pendingTotal || 73420, 'INR')}</span></div>
          <div className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>{invoices.filter(i => i.status === 'sent').length} invoices</div>
        </div>
        <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: BORDER }}><Users size={18} style={{ color: NAVY }} /></div>
            <span className="text-sm" style={{ color: TEXT_SECONDARY }}>Total Invoices</span>
          </div>
          <div className="flex items-end gap-2 mt-4">
            <span className="text-3xl font-semibold" style={{ color: NAVY }}>{invoices.length}</span>
            <span className="flex items-center gap-0.5 text-xs font-medium mb-1" style={{ color: GREEN_DARK }}><ArrowUp size={12} /> 8%</span>
          </div>
          <div className="text-xs mt-1" style={{ color: TEXT_SECONDARY }}>vs. last month</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mb-6">
        <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Settlement Overview</h3>
            <div className="flex items-center gap-4 text-xs" style={{ color: TEXT_SECONDARY }}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: GREEN }} /> Settled</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: NAVY }} /> Pending</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs><linearGradient id="settledFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.25} /><stop offset="100%" stopColor={GREEN} stopOpacity={0} /></linearGradient></defs>
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: TEXT_SECONDARY }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: TEXT_SECONDARY }} axisLine={false} tickLine={false} tickFormatter={(v) => `\u20B9${v / 100000}L`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="settled" stroke={GREEN} strokeWidth={2.5} fill="url(#settledFill)" />
              <Area type="monotone" dataKey="pending" stroke={NAVY} strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: NAVY }}>Payment Methods</h3>
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height={160}>
              <PieChart><Pie data={paymentMethods} dataKey="value" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">{paymentMethods.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie></PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center pointer-events-none"><span className="text-lg font-semibold" style={{ color: NAVY }}>\u20B93,22,170</span><span className="text-xs" style={{ color: TEXT_SECONDARY }}>Total Volume</span></div>
          </div>
          <div className="mt-4 space-y-2.5">{paymentMethods.map((m) => <div key={m.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2" style={{ color: TEXT_SECONDARY }}><span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} /> {m.name}</span><span className="font-medium" style={{ color: NAVY }}>{m.value}%</span></div>)}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg" style={{ border: `1px solid ${BORDER}` }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <h3 className="text-sm font-semibold" style={{ color: NAVY }}>Recent Invoices</h3>
          <button onClick={goToInvoices} className="text-sm font-medium flex items-center gap-1" style={{ color: GREEN_DARK }}>View all <ChevronRight size={14} /></button>
        </div>
        <table className="w-full text-sm">
          <thead><tr style={{ color: TEXT_SECONDARY }}><th className="text-left font-medium px-5 py-3">Invoice</th><th className="text-left font-medium px-5 py-3">Client</th><th className="text-left font-medium px-5 py-3">Due</th><th className="text-left font-medium px-5 py-3">Amount</th><th className="text-left font-medium px-5 py-3">Status</th></tr></thead>
          <tbody>
            {recent.map((inv) => {
              const total = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
              return (
                <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" style={{ borderTop: `1px solid ${BORDER}` }} onClick={goToInvoices}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: NAVY }}>{inv.number}</td>
                  <td className="px-5 py-3.5" style={{ color: NAVY }}>{inv.client.name}</td>
                  <td className="px-5 py-3.5" style={{ color: TEXT_SECONDARY }}>{inv.dueDate || '\u2014'}</td>
                  <td className="px-5 py-3.5 font-medium" style={{ color: NAVY }}>{formatMoney(total, inv.currency)}</td>
                  <td className="px-5 py-3.5"><StatusPill status={inv.status} /></td>
                </tr>
              );
            })}
            {recent.length === 0 && <tr><td colSpan={5} className="text-center py-10" style={{ color: TEXT_SECONDARY }}>No invoices yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------- INVOICES PAGE ----------------
function InvoiceListPage({ invoices, onNew, onOpen }) {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-semibold" style={{ color: NAVY }}>Invoices</h1><p className="text-sm mt-1" style={{ color: TEXT_SECONDARY }}>{invoices.length} invoice{invoices.length === 1 ? '' : 's'}</p></div>
        <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-transform active:scale-95" style={{ backgroundColor: GREEN }}><Plus size={16} /> New Invoice</button>
      </div>
      <div className="bg-white rounded-lg" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead><tr style={{ color: TEXT_SECONDARY }}><th className="text-left font-medium px-5 py-3">Invoice</th><th className="text-left font-medium px-5 py-3">Client</th><th className="text-left font-medium px-5 py-3">Project</th><th className="text-left font-medium px-5 py-3">Due</th><th className="text-left font-medium px-5 py-3">Amount</th><th className="text-left font-medium px-5 py-3">Status</th></tr></thead>
          <tbody>
            {invoices.map((inv) => {
              const total = inv.items.reduce((s, it) => s + it.qty * it.price, 0);
              return (
                <tr key={inv.id} className="hover:bg-gray-50 cursor-pointer" style={{ borderTop: `1px solid ${BORDER}` }} onClick={() => onOpen(inv.id)}>
                  <td className="px-5 py-3.5 font-medium" style={{ color: NAVY }}>{inv.number}</td>
                  <td className="px-5 py-3.5" style={{ color: NAVY }}>{inv.client.name}</td>
                  <td className="px-5 py-3.5" style={{ color: TEXT_SECONDARY }}>{inv.project}</td>
                  <td className="px-5 py-3.5" style={{ color: TEXT_SECONDARY }}>{inv.dueDate || '\u2014'}</td>
                  <td className="px-5 py-3.5 font-medium" style={{ color: NAVY }}>{formatMoney(total, inv.currency)}</td>
                  <td className="px-5 py-3.5"><StatusPill status={inv.status} /></td>
                </tr>
              );
            })}
            {invoices.length === 0 && <tr><td colSpan={6} className="text-center py-16" style={{ color: TEXT_SECONDARY }}>No invoices yet \u2014 create your first one.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function InvoiceEditorPage({ invoice, onChange, onBack, onDelete }) {
  const [bankOpen, setBankOpen] = useState(false);
  const [previewBankOpen, setPreviewBankOpen] = useState(false);
  const [chaserOpen, setChaserOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState('gentle');
  const [copied, setCopied] = useState(false);

  const inv = invoice;
  const set = (patch) => onChange({ ...inv, ...patch });
  const setClient = (patch) => onChange({ ...inv, client: { ...inv.client, ...patch } });
  const setBank = (patch) => onChange({ ...inv, bank: { ...inv.bank, ...patch } });
  const updateItem = (id, patch) => onChange({ ...inv, items: inv.items.map((it) => (it.id === id ? { ...it, ...patch } : it)) });
  const addItem = () => onChange({ ...inv, items: [...inv.items, { id: uid(), desc: '', qty: 1, price: 0 }] });
  const removeItem = (id) => onChange({ ...inv, items: inv.items.filter((it) => it.id !== id) });

  const subtotal = useMemo(() => inv.items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.price) || 0), 0), [inv.items]);
  const dayDiff = daysBetween(inv.dueDate);
  const isOverdue = dayDiff !== null && dayDiff < 0 && inv.status !== 'paid';
  const overdueDays = isOverdue ? Math.abs(dayDiff) : 0;
  const lateFeeAmount = isOverdue ? subtotal * ((Number(inv.lateFeePct) || 0) / 100) : 0;
  const total = subtotal + lateFeeAmount;
  const dueDateLabel = inv.dueDate ? new Date(inv.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '\u2014';
  const payLink = inv.stripeLink || (inv.paypalHandle ? `https://paypal.me/${inv.paypalHandle}` : '');

  const templateData = { clientName: inv.client.name, projectName: inv.project, amount: formatMoney(total, inv.currency), dueDateLabel, overdueDays, payLink: payLink || '[add a payment link]', freelancerName: 'You' };
  const emailText = TEMPLATES[activeTemplate].build(templateData);
  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(emailText).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="text-sm font-medium flex items-center gap-1" style={{ color: TEXT_SECONDARY }}>&larr; Back to invoices</button>
        <div className="flex items-center gap-2">
          <select value={inv.status} onChange={(e) => set({ status: e.target.value })} className="text-sm font-medium rounded-lg px-3 py-2 border" style={{ borderColor: '#E5E7EB', color: NAVY }}>
            <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option>
          </select>
          <button onClick={() => setChaserOpen(true)} className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#E5E7EB', color: NAVY }}><Mail size={15} style={{ color: GREEN_DARK }} /> Chaser</button>
          <button onClick={() => window.print()} className="px-3.5 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#E5E7EB', color: NAVY }}>Download PDF</button>
          <button onClick={onDelete} className="p-2 rounded-lg border" style={{ borderColor: '#FCA5A5' }}><Trash2 size={15} style={{ color: '#DC2626' }} /></button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: NAVY }}><User size={15} style={{ color: GREEN_DARK }} /> Client & project</h2>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Client name"><input className={inputClass} style={inputStyle} value={inv.client.name} onChange={(e) => setClient({ name: e.target.value })} /></Field>
              <Field label="Client email"><input className={inputClass} style={inputStyle} value={inv.client.email} onChange={(e) => setClient({ email: e.target.value })} /></Field>
            </div>
            <Field label="Project name"><input className={inputClass} style={inputStyle} value={inv.project} onChange={(e) => set({ project: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Due date"><input type="date" className={inputClass} style={inputStyle} value={inv.dueDate} onChange={(e) => set({ dueDate: e.target.value })} /></Field>
              <Field label="Currency"><select className={inputClass} style={inputStyle} value={inv.currency} onChange={(e) => set({ currency: e.target.value })}>{Object.keys(CURRENCIES).map((c) => <option key={c} value={c}>{c} ({CURRENCIES[c]})</option>)}</select></Field>
            </div>
            <Field label="Late fee if overdue (%)"><input type="number" min="0" className={inputClass + ' w-28'} style={inputStyle} value={inv.lateFeePct} onChange={(e) => set({ lateFeePct: e.target.value })} /></Field>
          </div>

          <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: NAVY }}><Briefcase size={15} style={{ color: GREEN_DARK }} /> Line items</h2>
              <button onClick={addItem} className="flex items-center gap-1 text-xs font-medium" style={{ color: GREEN_DARK }}><Plus size={14} /> Add item</button>
            </div>
            <div className="space-y-2">
              {inv.items.map((item) => (
                <div key={item.id} className="grid grid-cols-[1fr_56px_90px_28px] gap-2 items-center">
                  <input className={inputClass} style={inputStyle} placeholder="Description" value={item.desc} onChange={(e) => updateItem(item.id, { desc: e.target.value })} />
                  <input type="number" min="0" className={inputClass + ' text-center px-1'} style={inputStyle} value={item.qty} onChange={(e) => updateItem(item.id, { qty: e.target.value })} />
                  <input type="number" min="0" step="0.01" className={inputClass + ' px-2'} style={inputStyle} value={item.price} onChange={(e) => updateItem(item.id, { price: e.target.value })} />
                  <button onClick={() => removeItem(item.id)} style={{ color: TEXT_SECONDARY }}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 flex justify-end" style={{ borderTop: `1px solid ${BORDER}` }}>
              <div className="text-right"><div className="text-xs" style={{ color: TEXT_SECONDARY }}>Subtotal</div><div className="text-lg font-semibold" style={{ color: NAVY }}>{formatMoney(subtotal, inv.currency)}</div></div>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5" style={{ border: `1px solid ${BORDER}` }}>
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: NAVY }}><Link2 size={15} style={{ color: GREEN_DARK }} /> Payout options</h2>
            <Field label="Stripe / Dodo payment link"><input className={inputClass} style={inputStyle} value={inv.stripeLink} onChange={(e) => set({ stripeLink: e.target.value })} placeholder="https://..." /></Field>
            <Field label="PayPal.me handle"><div className="flex items-center gap-2"><span className="text-sm" style={{ color: TEXT_SECONDARY }}>paypal.me/</span><input className={inputClass} style={inputStyle} value={inv.paypalHandle} onChange={(e) => set({ paypalHandle: e.target.value })} /></div></Field>
            <button onClick={() => setBankOpen(!bankOpen)} className="w-full flex items-center justify-between text-sm font-medium rounded-lg px-3.5 py-2.5 border" style={{ borderColor: '#E5E7EB', color: NAVY }}>
              <span className="flex items-center gap-2"><Landmark size={15} style={{ color: GREEN_DARK }} /> Bank wire / SWIFT details</span>{bankOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {bankOpen && (
              <div className="mt-3 grid sm:grid-cols-2 gap-x-4">
                <Field label="Bank name"><input className={inputClass} style={inputStyle} value={inv.bank.bankName} onChange={(e) => setBank({ bankName: e.target.value })} /></Field>
                <Field label="Account name"><input className={inputClass} style={inputStyle} value={inv.bank.accountName} onChange={(e) => setBank({ accountName: e.target.value })} /></Field>
                <Field label="IBAN / account number"><input className={inputClass} style={inputStyle} value={inv.bank.iban} onChange={(e) => setBank({ iban: e.target.value })} /></Field>
                <Field label="SWIFT / BIC"><input className={inputClass} style={inputStyle} value={inv.bank.swift} onChange={(e) => setBank({ swift: e.target.value })} /></Field>
              </div>
            )}
          </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <div className="bg-white rounded-lg p-6 sm:p-7" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-2"><Logo size={22} /><span className="font-semibold" style={{ color: NAVY }}>settlify</span></div>
              {dayDiff !== null && inv.status !== 'paid' && (isOverdue ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: '#DC2626', backgroundColor: '#FDECEC' }}><AlertTriangle size={12} /> Overdue by {overdueDays}d</span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: GREEN_DARK, backgroundColor: '#E7FBF3' }}><Clock size={12} /> {dayDiff === 0 ? 'Due today' : `Due in ${dayDiff}d`}</span>
              ))}
              {inv.status === 'paid' && <StatusPill status="paid" />}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
              <div><div className="text-xs mb-1" style={{ color: TEXT_SECONDARY }}>Billed to</div><div className="font-medium" style={{ color: NAVY }}>{inv.client.name || '\u2014'}</div><div className="text-xs" style={{ color: TEXT_SECONDARY }}>{inv.client.email}</div></div>
              <div><div className="text-xs mb-1" style={{ color: TEXT_SECONDARY }}>Due</div><div className="font-medium" style={{ color: NAVY }}>{dueDateLabel}</div></div>
            </div>
            <div className="text-xs mb-1" style={{ color: TEXT_SECONDARY }}>Project</div>
            <div className="font-medium mb-5" style={{ color: NAVY }}>{inv.project || '\u2014'}</div>
            <table className="w-full text-sm" style={{ borderTop: `1px solid ${BORDER}` }}>
              <thead><tr style={{ color: TEXT_SECONDARY }}><th className="text-left font-medium py-2">Item</th><th className="text-center font-medium py-2 w-12">Qty</th><th className="text-right font-medium py-2 w-24">Amount</th></tr></thead>
              <tbody>{inv.items.map((item) => <tr key={item.id} style={{ borderTop: `1px solid ${BORDER}` }}><td className="py-2" style={{ color: NAVY }}>{item.desc || 'Untitled item'}</td><td className="py-2 text-center" style={{ color: TEXT_SECONDARY }}>{item.qty}</td><td className="py-2 text-right" style={{ color: NAVY }}>{formatMoney((Number(item.qty) || 0) * (Number(item.price) || 0), inv.currency)}</td></tr>)}</tbody>
            </table>
            <div className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between" style={{ color: TEXT_SECONDARY }}><span>Subtotal</span><span>{formatMoney(subtotal, inv.currency)}</span></div>
              {isOverdue && lateFeeAmount > 0 && <div className="flex justify-between" style={{ color: '#DC2626' }}><span>Late fee ({inv.lateFeePct}%)</span><span>{formatMoney(lateFeeAmount, inv.currency)}</span></div>}
              <div className="flex justify-between font-semibold text-base pt-2" style={{ color: NAVY, borderTop: `1px solid ${BORDER}` }}><span>Total due</span><span>{formatMoney(total, inv.currency)}</span></div>
            </div>
            <div className="mt-6 space-y-2.5">
              <a href={inv.stripeLink || '#'} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full font-semibold text-sm py-2.5 rounded-lg text-white transition-transform active:scale-95" style={{ backgroundColor: GREEN }}><CreditCard size={16} /> Pay now</a>
              {inv.paypalHandle && <a href={`https://paypal.me/${inv.paypalHandle}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full font-semibold text-sm py-2.5 rounded-lg border transition-transform active:scale-95" style={{ borderColor: '#E5E7EB', color: NAVY }}>Pay via PayPal</a>}
              <button onClick={() => setPreviewBankOpen(!previewBankOpen)} className="w-full flex items-center justify-between text-xs px-1 py-1.5" style={{ color: TEXT_SECONDARY }}><span className="flex items-center gap-1.5"><Landmark size={13} /> Bank wire details</span>{previewBankOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
              {previewBankOpen && <div className="text-xs rounded-lg p-3 space-y-1" style={{ color: TEXT_SECONDARY, backgroundColor: BG, border: `1px solid ${BORDER}` }}><div>Bank: {inv.bank.bankName || '\u2014'}</div><div>Account name: {inv.bank.accountName || '\u2014'}</div><div>IBAN: {inv.bank.iban || '\u2014'}</div><div>SWIFT: {inv.bank.swift || '\u2014'}</div></div>}
            </div>
          </div>
        </div>
      </div>

      {chaserOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(10,22,43,0.5)' }}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold flex items-center gap-2" style={{ color: NAVY }}><Mail size={16} style={{ color: GREEN_DARK }} /> Payment chaser</h3>
              <button onClick={() => setChaserOpen(false)} style={{ color: TEXT_SECONDARY }}><X size={18} /></button>
            </div>
            <p className="text-xs mb-4" style={{ color: TEXT_SECONDARY }}>Pick a tone, copy, and send.</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {Object.entries(TEMPLATES).map(([key, t]) => {
                const Icon = t.icon;
                const isActive = activeTemplate === key;
                return <button key={key} onClick={() => setActiveTemplate(key)} className="flex flex-col items-center gap-1.5 py-2.5 rounded-lg text-xs font-medium border" style={{ backgroundColor: isActive ? '#E7FBF3' : '#FFF', borderColor: isActive ? GREEN : '#E5E7EB', color: isActive ? GREEN_DARK : TEXT_SECONDARY }}><Icon size={15} />{t.label}</button>;
              })}
            </div>
            <textarea readOnly value={emailText} rows={9} className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none leading-relaxed" style={{ backgroundColor: BG, border: `1px solid ${BORDER}`, color: NAVY }} />
            <button onClick={handleCopy} className="mt-4 w-full flex items-center justify-center gap-2 font-semibold text-sm py-2.5 rounded-lg transition-transform active:scale-95" style={{ backgroundColor: copied ? '#E7FBF3' : GREEN, color: copied ? GREEN_DARK : '#fff', border: copied ? `1px solid ${GREEN}` : 'none' }}>
              {copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy to clipboard</>}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function ComingSoonPage({ label }) {
  return (
    <div className="bg-white rounded-lg p-16 flex flex-col items-center justify-center text-center" style={{ border: `1px solid ${BORDER}` }}>
      <h2 className="text-lg font-semibold mb-1" style={{ color: NAVY }}>{label}</h2>
      <p className="text-sm" style={{ color: TEXT_SECONDARY }}>This page isn't built yet \u2014 ask Claude to add it next.</p>
    </div>
  );
}

// ---------------- APP SHELL ----------------
export default function App() {
  const [active, setActive] = useState('dashboard');
  const [invoices, setInvoices] = useState(() => loadInvoices() ?? SEED_INVOICES);
  const [openInvoiceId, setOpenInvoiceId] = useState(null);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices)); } catch (e) {}
  }, [invoices]);

  const goToInvoices = () => { setActive('invoices'); setOpenInvoiceId(null); };
  const openInvoice = (id) => setOpenInvoiceId(id);
  const newInvoice = () => {
    const inv = {
      id: uid(), number: `INV-${String(1044 + invoices.length).padStart(4, '0')}`,
      client: { name: '', email: '' }, project: '', currency: 'INR',
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      lateFeePct: 5, items: [{ id: uid(), desc: '', qty: 1, price: 0 }],
      stripeLink: '', paypalHandle: '', bank: { bankName: '', accountName: '', iban: '', swift: '' }, status: 'draft',
    };
    setInvoices((prev) => [inv, ...prev]);
    setOpenInvoiceId(inv.id);
  };
  const updateInvoice = (updated) => setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  const deleteInvoice = (id) => { setInvoices((prev) => prev.filter((i) => i.id !== id)); setOpenInvoiceId(null); };

  const openInvoiceObj = invoices.find((i) => i.id === openInvoiceId);

  return (
    <div className="min-h-screen w-full flex" style={{ backgroundColor: BG, fontFamily: "'Inter', 'Public Sans', sans-serif" }}>
      <aside className="hidden lg:flex flex-col shrink-0" style={{ width: 280, backgroundColor: NAVY }}>
        <div className="flex items-center gap-2.5 px-6 py-6"><Logo size={28} /><span className="text-xl font-semibold text-white tracking-tight">settlify</span></div>
        <nav className="flex-1 px-4 mt-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = active === item.key;
            return (
              <button key={item.key} onClick={() => { setActive(item.key); setOpenInvoiceId(null); }} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium relative transition-colors" style={{ backgroundColor: isActive ? 'rgba(0,191,114,0.12)' : 'transparent', color: '#FFFFFF' }}>
                <Icon size={18} color={isActive ? GREEN : 'rgba(255,255,255,0.7)'} />
                <span style={{ opacity: isActive ? 1 : 0.85 }}>{item.label}</span>
                {isActive && <span className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-full" style={{ backgroundColor: GREEN }} />}
              </button>
            );
          })}
        </nav>
        <div className="mx-4 mb-6 rounded-2xl p-5" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Logo size={26} />
          <h4 className="text-white font-semibold text-[15px] mt-3 leading-snug">Faster Settlements. Healthier Business.</h4>
          <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>Automate payments, track invoices, and get settled \u2014 all in one place.</p>
          <button className="mt-4 w-full text-sm font-medium py-2.5 rounded-lg" style={{ backgroundColor: GREEN, color: '#FFFFFF' }}>Upgrade Plan</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <main className="flex-1 min-w-0 px-8 py-6 max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex-1 relative max-w-xl">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: TEXT_SECONDARY }} />
              <input placeholder="Search invoices, transactions, or clients..." className="w-full pl-11 pr-4 py-2.5 rounded-lg text-sm border outline-none" style={{ borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' }} />
            </div>
            <button className="relative w-10 h-10 rounded-lg flex items-center justify-center border" style={{ borderColor: '#E5E7EB' }}><Bell size={18} style={{ color: NAVY }} /><span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-red-500" /></button>
            <button className="flex items-center gap-2.5 pl-1">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ backgroundColor: NAVY }}>DK</div>
              <div className="text-left hidden sm:block"><div className="text-sm font-medium" style={{ color: NAVY }}>Dev Kumar</div><div className="text-xs" style={{ color: TEXT_SECONDARY }}>Business Owner</div></div>
              <ChevronDown size={16} style={{ color: TEXT_SECONDARY }} />
            </button>
          </div>

          {active === 'dashboard' && <DashboardPage invoices={invoices} goToInvoices={goToInvoices} />}
          {active === 'invoices' && !openInvoiceObj && <InvoiceListPage invoices={invoices} onNew={newInvoice} onOpen={openInvoice} />}
          {active === 'invoices' && openInvoiceObj && <InvoiceEditorPage invoice={openInvoiceObj} onChange={updateInvoice} onBack={() => setOpenInvoiceId(null)} onDelete={() => deleteInvoice(openInvoiceObj.id)} />}
          {!['dashboard', 'invoices'].includes(active) && <ComingSoonPage label={NAV_ITEMS.find((n) => n.key === active)?.label} />}
        </main>
      </div>
    </div>
  );
}
