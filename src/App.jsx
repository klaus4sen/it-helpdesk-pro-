import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabaseClient'
import logo from './assets/logo.png'
import {
  getTickets, addTicket, updateTicket, deleteTicket, getComments, addComment, getAllComments,
  getSession, signIn, clearSession,
  getAgents, addAgent, updateAgent, deleteAgent, MAX_STAFF_SEATS,
  getDepartments, addDepartment, deleteDepartment,
} from './store'
import {
  triage, summarize, matchKB, routeTo, generateReply, slaStatus, etaLabel, SLA_HOURS, KB,
} from './ai'
import { notifyNewTicket, notifyTicketReply } from './notifications'
import {
  LifeBuoy, Send, ShieldCheck, ArrowLeft, LogOut, Search, Clock, AlertTriangle,
  CheckCircle2, Circle, MessageSquare, X, Inbox, RefreshCw, Lock, ChevronRight,
  User, Loader2, Sparkles, BookOpen, Tag, BarChart3, Gauge, Zap, LayoutGrid,
  Lightbulb, Building2, Mail, Phone, Briefcase, Users,
  Plus, Trash2, UserPlus, EyeOff, Eye,
  StickyNote, Globe2, Building, Languages,
} from 'lucide-react'

/* =====================================================================
   CONFIG
===================================================================== */
const PRIORITIES = ['Low', 'Medium', 'High', 'Critical']
const STATUSES = ['Open', 'In Progress', 'Resolved', 'Closed']
const CATEGORIES = ['Hardware', 'Software', 'Network', 'Account', 'Email', 'Other']
const REQUESTER_TYPES = ['Internal', 'External']

// Arabic display labels for the public employee portal. The underlying
// value saved to the database stays in English (matches the agent
// console + AI engine), only the label shown to the employee changes.
const CATEGORY_LABELS_AR = {
  Hardware: '\u0623\u062c\u0647\u0632\u0629', Software: '\u0628\u0631\u0645\u062c\u064a\u0627\u062a', Network: '\u0627\u0644\u0627\u0646\u062a\u0631\u0646\u062a',
  Account: '\u0627\u0644\u062d\u0633\u0627\u0628', Email: '\u0627\u064a\u0645\u064a\u0644', Other: '\u0623\u062e\u0631\u0649',
}
const PRIORITY_LABELS_AR = {
  Low: '\u0639\u0627\u062f\u064a', Medium: '\u0645\u062a\u0648\u0633\u0637', High: '\u0639\u0627\u0644\u064a', Critical: '\u0645\u0647\u0645',
}
const DEPARTMENT_LABELS_AR = {
  Finance: '\u0627\u0644\u0645\u0627\u0644\u064a\u0629', 'Human Resources': '\u0627\u0644\u0645\u0648\u0627\u0631\u062f \u0627\u0644\u0628\u0634\u0631\u064a\u0629',
  IT: '\u062a\u0642\u0646\u064a\u0629 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a', Operations: '\u0627\u0644\u0639\u0645\u0644\u064a\u0627\u062a',
  Sales: '\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a', Other: '\u0623\u062e\u0631\u0649',
}

// Company / division picker for the public employee portal. Each company
// has its own list of sub-departments; the second dropdown re-populates
// based on which company is selected. "value" is what gets saved to the
// ticket (kept in English so it stays consistent for reporting), "en"/"ar"
// are only the display labels.
const COMPANIES = [
  { value: '1alrai', en: '1Alrai', ar: '\u0648\u0627\u062d\u062f \u0627\u0644\u0631\u0623\u064a' },
  { value: 'khadamati', en: 'Khadamati', ar: '\u062e\u062f\u0645\u0627\u062a\u064a' },
  { value: 'smart_decision', en: 'Smart Decision', ar: '\u0627\u0644\u0642\u0631\u0627\u0631 \u0627\u0644\u0630\u0643\u064a' },
  { value: 'executive_management', en: 'Executive Management', ar: '\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062a\u0646\u0641\u064a\u0630\u064a\u0629' },
]

const COMPANY_DIVISIONS = {
  wahed_alrai: [
    { value: 'banks_dept', en: 'Banks Department', ar: '\u0642\u0633\u0645 \u0627\u0644\u0628\u0646\u0648\u0643' },
    { value: 'corporates_individuals_dept', en: 'Corporates & Individuals Department', ar: '\u0642\u0633\u0645 \u0627\u0644\u0634\u0631\u0643\u0627\u062a \u0648\u0627\u0644\u0623\u0641\u0631\u0627\u062f' },
    { value: 'financial_management', en: 'Financial Management', ar: '\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629' },
  ],
  khadamaty: [
    { value: 'markets_management', en: 'Markets Management', ar: '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0623\u0633\u0648\u0627\u0642' },
    { value: 'central_management', en: 'Central Management', ar: '\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064a\u0629' },
    { value: 'consulting_services', en: 'Consulting Services', ar: '\u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0627\u0644\u0627\u0633\u062a\u0634\u0627\u0631\u064a\u0629' },
    { value: 'financial_management', en: 'Financial Management', ar: '\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629' },
  ],
  smart_decision: [
    { value: 'courses_dept', en: 'Training Courses Department', ar: '\u0642\u0633\u0645 \u0627\u0644\u062f\u0648\u0631\u0627\u062a' },
  ],
  executive_management: [
    { value: 'deputy_ceo', en: 'Deputy CEO', ar: '\u0646\u0627\u0626\u0628 \u0627\u0644\u0631\u0626\u064a\u0633 \u0627\u0644\u062a\u0646\u0641\u064a\u0630\u064a' },
    { value: 'business_project_development', en: 'Business & Project Development Management', ar: '\u0625\u062f\u0627\u0631\u0629 \u062a\u0637\u0648\u064a\u0631 \u0627\u0644\u0623\u0639\u0645\u0627\u0644 \u0648\u0627\u0644\u0645\u0634\u0627\u0631\u064a\u0639' },
    { value: 'financial_management', en: 'Financial Management', ar: '\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0627\u0644\u064a\u0629' },
  ],
}

const priorityChip = {
  Low: 'bg-slate-100 text-slate-600', Medium: 'bg-blue-50 text-blue-700',
  High: 'bg-amber-50 text-amber-700', Critical: 'bg-red-50 text-red-700',
}
const prioritySpine = { Low: 'bg-slate-300', Medium: 'bg-blue-400', High: 'bg-amber-400', Critical: 'bg-red-500' }
const statusChip = {
  Open: 'bg-emerald-50 text-emerald-700', 'In Progress': 'bg-amber-50 text-amber-700',
  Resolved: 'bg-violet-50 text-violet-700', Closed: 'bg-slate-100 text-slate-500',
}
const statusDot = { Open: 'bg-emerald-500', 'In Progress': 'bg-amber-500', Resolved: 'bg-violet-500', Closed: 'bg-slate-400' }
const sentimentChip = {
  Calm: 'bg-slate-100 text-slate-500', Concerned: 'bg-amber-50 text-amber-700', Urgent: 'bg-red-50 text-red-700',
}
const slaChip = {
  ok: 'bg-slate-100 text-slate-500', soon: 'bg-amber-50 text-amber-700', overdue: 'bg-red-50 text-red-700',
  met: 'bg-emerald-50 text-emerald-700', missed: 'bg-red-50 text-red-700',
}
const roleChip = { Admin: 'bg-navy-700 text-white', Agent: 'bg-brand-50 text-brand-700' }

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}
const initials = (n) => (n || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
const tkey = () => 'IT-Ticket'
function DonutChart({ slices, size = 168, thickness = 22, centerLabel = 'Tickets' }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0)
  const r = (size - thickness) / 2
  const cx = size / 2, cy = size / 2
  const circumference = 2 * Math.PI * r
  let offsetSoFar = 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef1f6" strokeWidth={thickness} />
          {total > 0 && slices.filter(s => s.value > 0).map((s, i) => {
            const frac = s.value / total
            const len = frac * circumference
            const dasharray = `${len} ${circumference - len}`
            const dashoffset = -offsetSoFar
            offsetSoFar += len
            return (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={thickness}
                strokeDasharray={dasharray} strokeDashoffset={dashoffset} strokeLinecap="butt" />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-extrabold text-ink">{total}</span>
          <span className="text-xs text-slate-400">{centerLabel}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-3">
        {slices.filter(s => s.value > 0).map((s, i) => (
          <span key={i} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label} <span className="font-semibold text-ink">({s.value})</span>
          </span>
        ))}
        {total === 0 && <span className="text-xs text-slate-400">No tickets yet</span>}
      </div>
    </div>
  )
}

function ProgressBreakdown({ rows }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  return (
    <div className="space-y-4">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-sm text-slate-500">{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: r.color }} />
          </div>
          <span className="w-6 shrink-0 text-right text-sm font-semibold text-ink">{r.value}</span>
        </div>
      ))}
    </div>
  )
}
function HorizontalBarChart({ rows, color = '#a855f7' }) {
  const max = Math.max(1, ...rows.map(r => r.value))
  if (!rows.length) return <p className="py-10 text-center text-sm text-slate-400">No data yet.</p>
  return (
    <div className="space-y-3.5">
      {rows.map(r => (
        <div key={r.label} className="flex items-center gap-3">
          <span className="w-32 shrink-0 truncate text-sm text-slate-600">{r.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
            <div className="flex h-full items-center justify-end rounded-md pr-2 text-[11px] font-semibold text-white"
              style={{ width: `${Math.max(8, (r.value / max) * 100)}%`, background: color }}>
              {r.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function FunnelStage({ label, big, sub, gradient, trend }) {
  return (
    <div className="min-w-[150px] flex-1">
      <div className={`rounded-t-lg px-3 py-2 text-center text-[13px] font-bold text-white ${gradient}`}>{label}</div>
      <div className="rounded-b-lg border border-t-0 border-slate-200 bg-white px-3 py-3 text-center">
        <div className="font-display text-2xl font-extrabold text-ink">{big}</div>
        {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
      </div>
    </div>
  )
}

/* =====================================================================
   TRANSLATIONS — public portal only (English / Arabic with RTL support)
===================================================================== */
const T = {
  en: {
    dir: 'ltr',
    badge: 'AI-assisted support',
    heading: 'How can we help?',
    sub: 'Describe the problem — we\u2019ll route it to the right place automatically, and you might fix it on the spot with a suggested article.',
    name: 'Your name', namePh: 'e.g. Sara Al-Mutairi',
    email: 'Your work email', emailPh: 'you@company.com',
    phone: 'Phone number', phoneOpt: '(optional)', phonePh: '+966 5x xxx xxxx',
    insideOutside: 'Are you inside or outside the company?',
    employee: 'Employee', external: 'External',
    deptLabel: 'Which department are you in?', extWhoLabel: 'Who are you / which company?',
    deptPh: 'Select your department\u2026', extPh: 'e.g. Acme Supplies (vendor), Contractor, Visitor\u2026',
    needHelp: 'What do you need help with?', needHelpPh: 'e.g. Laptop won\u2019t connect to WiFi',
    details: 'Details', optional: '(optional)', detailsPh: 'When did it start? Any error messages? What have you already tried?',
    mightFix: 'You might fix this now',
    category: 'Category', aiMayRefine: '(AI may refine)',
    urgency: 'Urgency',
    submit: 'Submit request', submitting: 'Analyzing & submitting\u2026',
    aiNote: 'AI runs on your device \u2014 nothing is sent to any third party.',
    staffBtn: 'IT staff',
    errName: 'Add your name and a short summary so we can route this.',
    errEmail: 'Add your work email so we can reach you and send updates.',
    errDept: 'Tell us which department you\u2019re in (or pick "Other" / "External").',
    errSubmit: 'Couldn\u2019t submit your request \u2014 check your connection and try again.',
    received: 'Request received', thanks: 'Thanks', ticketIs: 'Your ticket is',
    weEmail: 'We\u2019ll email you updates at',
    sortedByAI: 'Sorted automatically by AI', priorityWord: 'priority', assignedTo: 'Assigned to',
    expectedReply: 'Expected first response', another: 'Submit another request',
    companyLabel: 'Company', companyPh: 'Select the company\u2026',
    divisionLabel: 'Division / Section', divisionPh: 'Select the division\u2026',
    errCompany: 'Please select the company and its division.',
  },
  ar: {
    dir: 'rtl',
    badge: '\u062f\u0639\u0645 \u0628\u0645\u0633\u0627\u0639\u062f\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a',
    heading: '\u0643\u064a\u0641 \u064a\u0645\u0643\u0646\u0646\u0627 \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629\u061f',
    sub: '\u0627\u0648\u0635\u0641 \u0627\u0644\u0645\u0634\u0643\u0644\u0629 \u0648\u0633\u0646\u0642\u0648\u0645 \u0628\u062a\u0648\u062c\u064a\u0647\u0647\u0627 \u062a\u0644\u0642\u0627\u0626\u064a\u064b\u0627 \u0644\u0644\u062c\u0647\u0629 \u0627\u0644\u0645\u0646\u0627\u0633\u0628\u0629\u060c \u0648\u0642\u062f \u062a\u062c\u062f \u062d\u0644\u0627\u064b \u0641\u0648\u0631\u064a\u0627\u064b \u0645\u0646 \u0645\u0642\u0627\u0644 \u0645\u0642\u062a\u0631\u062d.',
    name: '\u0627\u0633\u0645\u0643', namePh: '\u0645\u062d\u0644: \u0633\u0627\u0631\u0629 \u0627\u0644\u0645\u0637\u064a\u0631\u064a',
    email: '\u0627\u0644\u0628\u0631\u064a\u062f \u0627\u0644\u0648\u0638\u064a\u0641\u064a', emailPh: 'you@company.com',
    phone: '\u0631\u0642\u0645 \u0627\u0644\u0647\u0627\u062a\u0641', phoneOpt: '(\u0627\u062e\u062a\u064a\u0627\u0631\u064a)', phonePh: '+966 5x xxx xxxx',
    insideOutside: '\u0647\u0644 \u0623\u0646\u062a \u062f\u0627\u062e\u0644 \u0627\u0644\u0634\u0631\u0643\u0629 \u0623\u0645 \u062e\u0627\u0631\u062c\u0647\u0627\u061f',
    employee: '\u0645\u0648\u0638\u0641', external: '\u062a\u0627\u0628\u0639 \u062e\u0627\u0631\u062c\u064a',
    deptLabel: '\u0645\u0627 \u0647\u064a \u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062a\u064a \u062a\u0639\u0645\u0644 \u0628\u0647\u0627\u061f', extWhoLabel: '\u0645\u0646 \u0623\u0646\u062a / \u0645\u0627 \u0647\u064a \u0627\u0644\u0634\u0631\u0643\u0629\u061f',
    deptPh: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645\u2026', extPh: '\u0645\u062d\u0644: \u0645\u0648\u0631\u062f (\u0645\u0648\u0631\u062f)\u060c \u0645\u062a\u0639\u0627\u0642\u062f\u060c \u0632\u0627\u0626\u0631\u2026',
    needHelp: '\u0628\u0645\u0627\u0630\u0627 \u062a\u062d\u062a\u0627\u062c \u0627\u0644\u0645\u0633\u0627\u0639\u062f\u0629\u061f', needHelpPh: '\u0645\u062d\u0644: \u0627\u0644\u0644\u0627\u0628\u062a\u0648\u0628 \u0644\u0627 \u064a\u062a\u0635\u0644 \u0628\u0627\u0644\u0648\u0627\u064a \u0641\u0627\u064a',
    details: '\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644', optional: '(\u0627\u062e\u062a\u064a\u0627\u0631\u064a)', detailsPh: '\u0645\u062a\u0649 \u0628\u062f\u0623\u062a \u0627\u0644\u0645\u0634\u0643\u0644\u0629\u061f \u0647\u0644 \u0647\u0646\u0627\u0643 \u0631\u0633\u0627\u0644\u0629 \u062e\u0637\u0623\u061f \u0645\u0627\u0630\u0627 \u062c\u0631\u0628\u062a \u0633\u0627\u0628\u0642\u0627\u064b\u061f',
    mightFix: '\u0642\u062f \u062a\u062a\u0645\u0643\u0646 \u0645\u0646 \u062d\u0644 \u0647\u0630\u0627 \u0627\u0644\u0622\u0646',
    category: '\u0627\u0644\u0641\u0626\u0629', aiMayRefine: '(\u0642\u062f \u064a\u0639\u062f\u0644\u0647\u0627 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a)',
    urgency: '\u0627\u0644\u0623\u0648\u0644\u0648\u064a\u0629',
    submit: '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0637\u0644\u0628', submitting: '\u062c\u0627\u0631\u064d \u0627\u0644\u062a\u062d\u0644\u064a\u0644 \u0648\u0627\u0644\u0625\u0631\u0633\u0627\u0644\u2026',
    aiNote: '\u064a\u0639\u0645\u0644 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a \u0639\u0644\u0649 \u062c\u0647\u0627\u0632\u0643 \u2014 \u0644\u0627 \u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0623\u064a \u0634\u064a\u0621 \u0644\u0623\u064a \u0637\u0631\u0641 \u062b\u0627\u0644\u062b.',
    staffBtn: '\u0645\u0648\u0638\u0641\u0648 \u0627\u0644\u062a\u0642\u0646\u064a\u0629',
    errName: '\u0623\u0636\u0641 \u0627\u0633\u0645\u0643 \u0648\u0648\u0635\u0641\u0627\u064b \u0645\u0648\u062c\u0632\u0627\u064b \u062d\u062a\u0649 \u0646\u0633\u062a\u0637\u064a\u0639 \u062a\u0648\u062c\u064a\u0647 \u0627\u0644\u0637\u0644\u0628.',
    errEmail: '\u0623\u0636\u0641 \u0628\u0631\u064a\u062f\u0643 \u0627\u0644\u0648\u0638\u064a\u0641\u064a \u062d\u062a\u0649 \u0646\u062a\u0645\u0643\u0646 \u0645\u0646 \u0627\u0644\u062a\u0648\u0627\u0635\u0644 \u0645\u0639\u0643 \u0648\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u062d\u062f\u064a\u0642\u0627\u062a.',
    errDept: '\u0623\u062e\u0628\u0631\u0646\u0627 \u0628\u0627\u0644\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062a\u064a \u062a\u0639\u0645\u0644 \u0628\u0647\u0627 (\u0623\u0648 \u0627\u062e\u062a\u0631 "\u0623\u062e\u0631\u0649" / "\u062e\u0627\u0631\u062c\u064a").',
    errSubmit: '\u062a\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628\u0643 \u2014 \u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0648\u062c\u0631\u0628 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649.',
    received: '\u062a\u0645 \u0627\u0633\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628', thanks: '\u0634\u0643\u0631\u0627\u064b', ticketIs: '\u0631\u0642\u0645 \u062a\u0630\u0643\u0631\u062a\u0643 \u0647\u0648',
    weEmail: '\u0633\u0646\u0631\u0633\u0644 \u0644\u0643 \u0627\u0644\u062a\u062d\u062f\u064a\u062b\u0627\u062a \u0639\u0644\u0649 \u0627\u0644\u0628\u0631\u064a\u062f',
    sortedByAI: '\u062a\u0645 \u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064a', priorityWord: '\u0627\u0644\u0623\u0648\u0644\u0648\u064a\u0629', assignedTo: '\u0645\u062e\u0635\u0651\u0635 \u0644\u0640',
    expectedReply: '\u0627\u0644\u0631\u062f \u0627\u0644\u0645\u062a\u0648\u0642\u0639', another: '\u0625\u0631\u0633\u0627\u0644 \u0637\u0644\u0628 \u0622\u062e\u0631',
    companyLabel: '\u0627\u0644\u0634\u0631\u0643\u0629', companyPh: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0634\u0631\u0643\u0629\u2026',
    divisionLabel: '\u0627\u0644\u0642\u0633\u0645', divisionPh: '\u0627\u062e\u062a\u0631 \u0627\u0644\u0642\u0633\u0645\u2026',
    errCompany: '\u064a\u0631\u062c\u0649 \u0627\u062e\u062a\u064a\u0627\u0631 \u0627\u0644\u0634\u0631\u0643\u0629 \u0648\u0627\u0644\u0642\u0633\u0645 \u0627\u0644\u062a\u0627\u0628\u0639 \u0644\u0647\u0627.',
  },
}

/* =====================================================================
   ROOT
===================================================================== */
export default function App() {
  const [session, setSess] = useState(null)
  const [checking, setChecking] = useState(true)
  const [view, setView] = useState('portal')

  useEffect(() => {
    getSession().then(s => { setSess(s); setChecking(false) }).catch(() => setChecking(false))
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') { setSess(null); return }
      // Token refreshes / other events: re-check, but never wipe an existing
      // session just because the profile lookup had a transient hiccup.
      getSession().then(s => { if (s) setSess(s) }).catch(() => {})
    })
    return () => sub?.subscription?.unsubscribe()
  }, [])

  const login = (s) => { setSess(s) }
  const logout = async () => { await clearSession(); setSess(null); setView('portal') }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-400">
        <Loader2 size={20} className="mr-2 animate-spin" /> Loading&hellip;
      </div>
    )
  }
  if (session) return <Console session={session} onLogout={logout} />
  if (view === 'login') return <Login onBack={() => setView('portal')} onLogin={login} />
  return <Portal onStaff={() => setView('login')} />
}

/* =====================================================================
   EMPLOYEE PORTAL  (public) — self-service KB + AI auto-triage
   Captures: department, internal/external requester type, and a
   phone number alongside email. Name, email, inside/outside,
   department, and "what do you need help with" are all required;
   phone, category, and urgency stay optional.
===================================================================== */
function Portal({ onStaff }) {
  const [lang, setLang] = useState('en')
  const t = T[lang]
  const [departments, setDepartments] = useState([])
  const empty = {
    requester_name: '', requester_email: '', requester_phone: '',
    requester_type: 'Internal', requester_department: '',
    company: '', company_division: '',
    title: '', description: '', category: 'Other', priority: 'Medium',
  }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [err, setErr] = useState('')
  const [openArticle, setOpenArticle] = useState(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    getDepartments().then(setDepartments).catch(() => setErr('Couldn\u2019t load departments \u2014 check your connection and try again.'))
  }, [])

  const suggestions = useMemo(
    () => matchKB({ title: form.title, description: form.description }, 2),
    [form.title, form.description]
  )

  const submit = async () => {
    setErr('')
    if (!form.requester_name || !form.title) {
      setErr(t.errName)
      return
    }
    if (!form.requester_email) {
      setErr(t.errEmail)
      return
    }
    if (!form.requester_department) {
      setErr(t.errDept)
      return
    }
    if (!form.company || !form.company_division) {
      setErr(t.errCompany)
      return
    }
    setBusy(true)
    try {
      const ai = triage(form)
      const [agents, allTickets] = await Promise.all([getAgents(), getTickets()])
      const openTickets = allTickets.filter(t => !['Resolved', 'Closed'].includes(t.status))
      const loadByAgent = {}
      openTickets.forEach(t => { if (t.assigned_to) loadByAgent[t.assigned_to] = (loadByAgent[t.assigned_to] || 0) + 1 })
      const newTicket = await addTicket({
        ...form,
        category: ai.confident ? ai.category : form.category,
        priority: ai.priority,
        tags: ai.tags,
        sentiment: ai.sentiment,
        summary: summarize(form),
        assigned_to: routeTo(ai.category, agents, loadByAgent),
        ai_triaged: true,
      })
      notifyNewTicket(newTicket).catch(() => {}) // best-effort; never blocks submission
      setSubmitted({ t: newTicket, ai })
    } catch (e) {
      setErr(e.message || t.errSubmit)
    } finally {
      setBusy(false)
    }
  }

  if (submitted) {
    const { t: tk, ai } = submitted
    return (
      <Shell onStaff={onStaff} lang={lang} setLang={setLang}>
        <div className="mx-auto max-w-md text-center pt-8" dir={t.dir}>
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50">
            <CheckCircle2 className="text-emerald-500" size={34} />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-ink">{t.received}</h2>
          <p className="mt-2 text-slate-500">
            {t.thanks}, {tk.requester_name.split(' ')[0]}. {t.ticketIs}{' '}
            <span className="font-mono font-semibold text-brand-700">#{tkey(tk.num)}</span>.{' '}
            {t.weEmail} {tk.requester_email}.
          </p>
          <div className="mt-5 rounded-2xl border border-brand-100 bg-brand-50/60 p-4 text-left" dir={t.dir}>
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
              <Sparkles size={14} /> {t.sortedByAI}
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`chip ${priorityChip[tk.priority]}`}>{tk.priority} {t.priorityWord}</span>
              <span className="chip bg-white text-slate-600 border border-slate-200">{tk.category}</span>
              {tk.assigned_to && <span className="chip bg-white text-slate-600 border border-slate-200">{t.assignedTo} {tk.assigned_to}</span>}
              {ai.sentiment !== 'Calm' && <span className={`chip ${sentimentChip[ai.sentiment]}`}>{ai.sentiment}</span>}
            </div>
            <p className="mt-3 text-xs text-brand-700/80">{t.expectedReply} {etaLabel(tk.priority)}.</p>
          </div>
          <button className="btn-primary mt-6" onClick={() => { setForm(empty); setSubmitted(null); setOpenArticle(null) }}>
            {t.another}
          </button>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onStaff={onStaff} lang={lang} setLang={setLang}>
      <div className="mx-auto max-w-2xl" dir={t.dir}>
        <div className="mb-7">
          <span className="chip bg-brand-50 text-brand-700 mb-3"><Sparkles size={13} /> {t.badge}</span>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink">{t.heading}</h2>
          <p className="mt-2 text-slate-500">{t.sub}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card sm:p-7">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label">{t.companyLabel} <span className="text-red-500">*</span></label>
              <div className="relative">
                <Building2 size={15} className={`absolute top-3 text-slate-400 ${t.dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
                <select
                  className={`input ${t.dir === 'rtl' ? 'pr-9' : 'pl-9'}`}
                  value={form.company}
                  onChange={e => setForm(f => ({ ...f, company: e.target.value, company_division: '' }))}
                >
                  <option value="">{t.companyPh}</option>
                  {COMPANIES.map(c => (
                    <option key={c.value} value={c.value}>{lang === 'ar' ? c.ar : c.en}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="label">{t.divisionLabel} <span className="text-red-500">*</span></label>
              <div className="relative">
                <Briefcase size={15} className={`absolute top-3 text-slate-400 ${t.dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
                <select
                  className={`input ${t.dir === 'rtl' ? 'pr-9' : 'pl-9'}`}
                  value={form.company_division}
                  onChange={e => set('company_division', e.target.value)}
                  disabled={!form.company}
                >
                  <option value="">{t.divisionPh}</option>
                  {(COMPANY_DIVISIONS[form.company] || []).map(d => (
                    <option key={d.value} value={d.value}>{lang === 'ar' ? d.ar : d.en}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label">{t.name} <span className="text-red-500">*</span></label>
              <input className="input" placeholder={t.namePh} value={form.requester_name} onChange={e => set('requester_name', e.target.value)} />
            </div>
            <div>
              <label className="label">{t.email} <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={15} className={`absolute top-3 text-slate-400 ${t.dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
                <input className={`input ${t.dir === 'rtl' ? 'pr-9' : 'pl-9'}`} type="email" placeholder={t.emailPh} value={form.requester_email} onChange={e => set('requester_email', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label">{t.phone} <span className="font-normal text-slate-400">{t.phoneOpt}</span></label>
              <div className="relative">
                <Phone size={15} className={`absolute top-3 text-slate-400 ${t.dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
                <input className={`input ${t.dir === 'rtl' ? 'pr-9' : 'pl-9'}`} type="tel" placeholder={t.phonePh} value={form.requester_phone} onChange={e => set('requester_phone', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">{t.insideOutside} <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2">
                {REQUESTER_TYPES.map(rt => (
                  <button key={rt} type="button" onClick={() => set('requester_type', rt)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      form.requester_type === rt ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}>
                    {rt === 'Internal' ? <Building2 size={15} /> : <Globe2 size={15} />} {rt === 'Internal' ? t.employee : t.external}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label className="label">
              {form.requester_type === 'Internal' ? t.deptLabel : t.extWhoLabel} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Briefcase size={15} className={`absolute top-3 text-slate-400 ${t.dir === 'rtl' ? 'right-3.5' : 'left-3.5'}`} />
              {form.requester_type === 'Internal' ? (
                <select className={`input ${t.dir === 'rtl' ? 'pr-9' : 'pl-9'}`} value={form.requester_department} onChange={e => set('requester_department', e.target.value)}>
                  <option value="">{t.deptPh}</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>
                      {lang === 'ar' ? (DEPARTMENT_LABELS_AR[d.name] || d.name) : d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={`input ${t.dir === 'rtl' ? 'pr-9' : 'pl-9'}`} placeholder={t.extPh}
                  value={form.requester_department} onChange={e => set('requester_department', e.target.value)} />
              )}
            </div>
          </div>

          <div className="mt-5">
            <label className="label">{t.needHelp} <span className="text-red-500">*</span></label>
            <input className="input" placeholder={t.needHelpPh} value={form.title} onChange={e => set('title', e.target.value)} />
          </div>

          <div className="mt-5">
            <label className="label">{t.details} <span className="font-normal text-slate-400">{t.optional}</span></label>
            <textarea className="input min-h-[110px] resize-y" placeholder={t.detailsPh} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          {suggestions.length > 0 && (
            <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Lightbulb size={14} /> {t.mightFix}
              </div>
              <div className="space-y-2">
                {suggestions.map(a => (
                  <div key={a.id} className="overflow-hidden rounded-xl border border-amber-200 bg-white">
                    <button type="button" onClick={() => setOpenArticle(openArticle === a.id ? null : a.id)}
                      className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left">
                      <span className="flex items-center gap-2 text-sm font-medium text-ink">
                        <BookOpen size={15} className="text-amber-500" /> {a.title}
                      </span>
                      <ChevronRight size={16} className={`shrink-0 text-slate-300 transition ${openArticle === a.id ? 'rotate-90' : ''}`} />
                    </button>
                    {openArticle === a.id && (
                      <ol className="list-decimal space-y-1.5 border-t border-amber-100 bg-amber-50/40 px-7 py-3 text-sm text-slate-600">
                        {a.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <div>
              <label className="label">{t.category} <span className="font-normal text-slate-400">{t.aiMayRefine}</span></label>
              <select className="input" value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{lang === 'ar' ? CATEGORY_LABELS_AR[c] : c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{t.urgency} <span className="font-normal text-slate-400">{t.aiMayRefine}</span></label>
              <select className="input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{lang === 'ar' ? PRIORITY_LABELS_AR[p] : p}</option>
                ))}
              </select>
            </div>
          </div>

          {err && (
            <div className="mt-5 flex items-start gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {err}
            </div>
          )}

          <button className="btn-primary mt-6 w-full py-3" onClick={submit} disabled={busy}>
            {busy ? <><Loader2 size={18} className="animate-spin" /> {t.submitting}</> : <><Send size={18} /> {t.submit}</>}
          </button>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">{t.aiNote}</p>
      </div>
    </Shell>
  )
}

function Shell({ children, onStaff, lang, setLang }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Helpdisk logo" className="h-9 w-9 rounded-xl object-cover shadow-sm" />
            <div className="leading-tight">
             <div className="font-display text-[15px] font-bold text-ink">Helpdisk</div>
             <div className="text-[11px] text-slate-400">IT Support Portal</div>
            </div>

          </div>
          <div className="flex items-center gap-2">
            {lang && setLang && (
              <button onClick={() => setLang(lang === 'en' ? 'ar' : 'en')} className="btn-ghost h-9 px-3 text-[13px]" title="Translate / ترجمة">
                <Languages size={15} /> {lang === 'en' ? 'العربية' : 'English'}
              </button>
            )}
            <button onClick={onStaff} className="btn-ghost h-9 px-3 text-[13px]"><ShieldCheck size={15} /> IT staff</button>
          </div>
        </div>
      </header>
      <main className="px-4 py-8 sm:py-12">{children}</main>
    </div>
  )
}

/* =====================================================================
   STAFF LOGIN — authenticates against real agent accounts (admin +
   up to 3 IT staff), not a single hardcoded login.
===================================================================== */
function Login({ onBack, onLogin }) {
  const [email, setEmail] = useState(''); const [p, setP] = useState('')
  const [showP, setShowP] = useState(false)
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const go = async () => {
    setErr('')
    if (!email || !p) { setErr('Enter your email and password.'); return }
    setBusy(true)
    try {
      const profile = await signIn(email.trim(), p)
      onLogin(profile)
    } catch (e) {
      setErr(e.message || 'Couldn\u2019t reach the server \u2014 check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="min-h-screen bg-ink">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
        <button onClick={onBack} className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} /> Back to the support form
        </button>
        <div className="rounded-2xl border border-white/10 bg-white p-7 shadow-lift">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-600 text-white"><ShieldCheck size={22} /></div>
            <div>
              <h1 className="font-display text-xl font-extrabold text-ink">Agent sign in</h1>
              <p className="text-sm text-slate-500">IT team access only</p>
            </div>
          </div>
          <label className="label">Email</label>
          <div className="relative mb-4">
            <Mail size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input className="input pl-10" type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
          </div>
          <label className="label">Password</label>
          <div className="relative mb-2">
            <Lock size={16} className="absolute left-3.5 top-3 text-slate-400" />
            <input className="input pl-10 pr-10" type={showP ? 'text' : 'password'} placeholder="********" value={p} onChange={e => setP(e.target.value)} onKeyDown={e => e.key === 'Enter' && go()} />
            <button type="button" onClick={() => setShowP(s => !s)} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">
              {showP ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {err && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <button className="btn-primary mt-3 w-full py-3" onClick={go} disabled={busy}>
            {busy ? <><Loader2 size={18} className="animate-spin" /> Signing in&hellip;</> : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* =====================================================================
   AGENT CONSOLE — Faveo-style persistent sidebar shell with
   Dashboard / Tickets / Departments / Staff / Knowledge base sections.
   Admin-only sections (Departments, Staff) are hidden from Agents.
===================================================================== */
function Console({ session, onLogout }) {
  const [tickets, setTickets] = useState([])
  const [active, setActive] = useState(null)
  const [tab, setTab] = useState('queue')
  const [queueFilter, setQueueFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState('')
  const refresh = () => {
    setLoadErr('')
    getTickets()
      .then(setTickets)
      .catch(e => setLoadErr(e.message || 'Couldn\u2019t load tickets \u2014 check your Supabase connection.'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])
  const onChanged = (updated) => { refresh(); if (updated) setActive(updated) }
  const isAdmin = session.role === 'Admin'

  const counts = {
    inbox: tickets.filter(t => !['Resolved', 'Closed'].includes(t.status)).length,
    mine: tickets.filter(t => t.assigned_to === session.name && !['Resolved', 'Closed'].includes(t.status)).length,
    unassigned: tickets.filter(t => !t.assigned_to && !['Resolved', 'Closed'].includes(t.status)).length,
    overdue: tickets.filter(t => slaStatus(t).state === 'overdue').length,
  }

  const NAV = [
    { id: 'queue', label: 'Dashboard', icon: LayoutGrid },
    { id: 'tickets', label: 'Tickets', icon: Inbox, badge: counts.inbox },
    { id: 'insights', label: 'Reports', icon: BarChart3 },
    { id: 'kb', label: 'Knowledge Base', icon: BookOpen },
    ...(isAdmin ? [
      { id: 'departments', label: 'Departments', icon: Building, admin: true },
      { id: 'staff', label: 'Staff Accounts', icon: Users, admin: true },
    ] : []),
  ]

  const openDetail = (t) => setActive(t)

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* ---------- Sidebar ---------- */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy-800 shadow-nav lg:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <img src={logo} alt="Helpdisk logo" className="h-9 w-9 rounded-lg object-cover" />
          <div className="leading-tight">
           <div className="font-display text-[14px] font-bold text-white">Helpdisk</div>
           <div className="text-[11px] text-navy-300">Agent Console</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 pt-2">
          <div className="px-3 pb-1.5 pt-3 text-[10px] font-bold uppercase tracking-wider text-navy-400">Workspace</div>
          {NAV.filter(n => !n.admin).map(n => (
            <button key={n.id} onClick={() => setTab(n.id)} className={`navlink w-full ${tab === n.id ? 'navlink-active' : ''}`}>
              <n.icon size={16} /> <span className="flex-1 text-left">{n.label}</span>
              {!!n.badge && <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[10px] font-bold text-white">{n.badge}</span>}
            </button>
          ))}
          {isAdmin && (
            <>
              <div className="px-3 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-wider text-navy-400">Administration</div>
              {NAV.filter(n => n.admin).map(n => (
                <button key={n.id} onClick={() => setTab(n.id)} className={`navlink w-full ${tab === n.id ? 'navlink-active' : ''}`}>
                  <n.icon size={16} /> <span className="flex-1 text-left">{n.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>

        <div className="m-3 rounded-xl bg-white/[0.06] p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{initials(session.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">{session.name}</div>
              <span className={`chip ${roleChip[session.role] || roleChip.Agent} mt-0.5 px-1.5 py-0.5 text-[10px]`}>{session.role}</span>
            </div>
          </div>
          <button onClick={onLogout} className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 py-2 text-[12px] font-semibold text-navy-200 transition hover:bg-white/10 hover:text-white">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex items-center gap-2 lg:hidden">
            <img src={logo} alt="Helpdisk logo" className="h-8 w-8 rounded-lg object-cover" />
            <span className="font-display text-sm font-bold text-ink">Helpdisk</span>
          </div>
          <div className="hidden items-center gap-1.5 text-sm font-semibold text-slate-500 lg:flex">
            {(() => { const cur = NAV.find(n => n.id === tab); const Icon = cur?.icon; return Icon ? <Icon size={16} className="text-brand-600" /> : null })()}
            {NAV.find(n => n.id === tab)?.label}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh} className="btn-ghost h-9 px-3 text-[13px]"><RefreshCw size={14} /> <span className="hidden sm:inline">Refresh</span></button>
            <button onClick={onLogout} className="btn-ghost h-9 px-3 text-[13px] lg:hidden"><LogOut size={14} /></button>
          </div>
        </header>

        {/* mobile nav tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 lg:hidden">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold transition ${tab === n.id ? 'text-brand-700' : 'text-slate-500'}`}>
              <n.icon size={14} /> {n.label}
              {tab === n.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          ))}
        </div>

        <main className="flex-1 px-4 py-6 lg:px-6">
          {loadErr && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span><b>Couldn&rsquo;t connect to Supabase.</b> {loadErr}</span>
              <button onClick={refresh} className="btn-ghost btn-sm shrink-0 border-red-200 bg-white">Retry</button>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-24 text-slate-400">
              <Loader2 size={20} className="mr-2 animate-spin" /> Loading tickets&hellip;
            </div>
          ) : (
            <>
              {tab === 'queue' && <DashboardHome tickets={tickets} session={session} onOpen={openDetail} goTickets={(f) => { setQueueFilter(f); setTab('tickets') }} />}
              {tab === 'tickets' && <Queue tickets={tickets} onOpen={openDetail} onRefresh={refresh} initialFilter={queueFilter} session={session} />}
              {tab === 'insights' && <Insights tickets={tickets} />}
              {tab === 'kb' && <KnowledgeBaseAdmin />}
              {tab === 'departments' && isAdmin && <DepartmentsAdmin />}
              {tab === 'staff' && isAdmin && <StaffAdmin session={session} />}
            </>
          )}
        </main>
      </div>

      {active && <Detail ticket={active} onClose={() => setActive(null)} onChanged={onChanged} onDeleted={() => { setActive(null); refresh() }} agent={session.name} />}
    </div>
  )
}

/* ---------------- DASHBOARD (Faveo-style widgets) ---------------- */
function DashboardHome({ tickets, session, onOpen, goTickets }) {
  const [teamCount, setTeamCount] = useState(null)
  useEffect(() => {
    getAgents().then(a => setTeamCount(a.filter(x => x.active !== false).length)).catch(() => setTeamCount(null))
  }, [])

  const open = tickets.filter(t => !['Resolved', 'Closed'].includes(t.status))
  const mine = open.filter(t => t.assigned_to === session.name)
  const unassigned = open.filter(t => !t.assigned_to)
  const overdue = tickets.filter(t => slaStatus(t).state === 'overdue')
  const onHold = tickets.filter(t => t.status === 'In Progress')
  const dueToday = open.filter(t => {
    const target = SLA_HOURS[t.priority] ?? 24
    const hoursElapsed = (Date.now() - new Date(t.created_at)) / 3600000
    const hoursLeft = target - hoursElapsed
    return hoursLeft > 0 && hoursLeft <= 24
  })
  const recent = tickets.slice(0, 6)

  const widgets = [
    { label: 'Overdue Tickets', value: overdue.length, tone: 'red', onClick: () => goTickets('overdue') },
    { label: 'Tickets Due Today', value: dueToday.length, tone: 'violet', onClick: () => goTickets('due') },
    { label: 'Open Tickets', value: open.length, tone: 'emerald', onClick: () => goTickets('Open') },
    { label: 'Tickets On Hold', value: onHold.length, tone: 'amber', onClick: () => goTickets('In Progress') },
    { label: 'Unassigned Tickets', value: unassigned.length, tone: 'brand', onClick: () => goTickets('unassigned') },
    { label: 'My Tickets', value: mine.length, tone: 'navy', onClick: () => goTickets('mine') },
  ]

  const priorityColors = { Low: '#cbd5e1', Medium: '#60a5fa', High: '#fbbf24', Critical: '#ef4444' }
  const priorityDonut = PRIORITIES.map(p => ({ label: p, value: tickets.filter(t => t.priority === p).length, color: priorityColors[p] }))

  const statusColors = { Open: '#1c7ce8', 'In Progress': '#fbbf24', Resolved: '#8b5cf6', Closed: '#34d399' }
  const statusDonut = STATUSES.map(s => ({ label: s, value: tickets.filter(t => t.status === s).length, color: statusColors[s] }))
  const statusBars = STATUSES.map(s => ({ label: s, value: tickets.filter(t => t.status === s).length, color: statusColors[s] }))

  const resolvedThisWeek = tickets.filter(t => t.resolved_at && (Date.now() - new Date(t.resolved_at)) < 7 * 86400000).length
  const slaConsidered = tickets.filter(t => ['met', 'missed'].includes(slaStatus(t).state)).length
  const slaMet = tickets.filter(t => slaStatus(t).state === 'met').length
  const slaPct = slaConsidered ? Math.round(100 * slaMet / slaConsidered) : 100

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-extrabold text-ink">Welcome back, {session.name.split(' ')[0]}</h2>
        <p className="text-sm text-slate-500">Here&rsquo;s what&rsquo;s happening across the helpdesk right now.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {widgets.map(w => (
          <button key={w.label} onClick={w.onClick} className="card p-4 text-left transition hover:border-brand-200 hover:shadow-lift">
            <div className="text-xs text-slate-500">{w.label}</div>
            <div className={`mt-2 font-display text-2xl font-extrabold ${w.tone === 'red' ? 'text-red-500' : w.tone === 'amber' ? 'text-amber-500' : 'text-ink'}`}>{w.value}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-4 font-display text-sm font-bold text-ink">All Tickets by Priority</h3>
          <DonutChart slices={priorityDonut} />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-display text-sm font-bold text-ink">All Tickets by Status</h3>
          <DonutChart slices={statusDonut} />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-display text-sm font-bold text-ink">All Tickets by Status</h3>
          <ProgressBreakdown rows={statusBars} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-1 font-display text-sm font-bold text-ink">Resolved this week</h3>
          <p className="mb-3 text-xs text-slate-400">Tickets marked Resolved or Closed in the last 7 days.</p>
          <div className="font-display text-3xl font-extrabold text-emerald-600">{resolvedThisWeek}</div>
        </div>
        <div className="card p-5">
          <h3 className="mb-1 font-display text-sm font-bold text-ink">SLA performance</h3>
          <p className="mb-3 text-xs text-slate-400">Share of resolved tickets that met their SLA target.</p>
          <div className="font-display text-3xl font-extrabold text-brand-600">{slaPct}%</div>
        </div>
        <div className="card p-5">
          <h3 className="mb-1 font-display text-sm font-bold text-ink">Team</h3>
          <p className="mb-3 text-xs text-slate-400">Active IT staff seats in use.</p>
          <div className="font-display text-3xl font-extrabold text-ink">{teamCount === null ? '\u2014' : teamCount}</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-bold text-ink">Recent tickets</h3>
          <button onClick={() => goTickets('All')} className="text-xs font-semibold text-brand-600 hover:text-brand-700">View all &rarr;</button>
        </div>
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">No tickets yet.</p>
        ) : (
          <div className="space-y-2">
            {recent.map(t => {
              const sla = slaStatus(t)
              return (
                <button key={t.id} onClick={() => onOpen(t)} className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left transition hover:border-brand-200 hover:bg-brand-50/30">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${prioritySpine[t.priority]}`} />
                  <span className="font-mono text-xs text-slate-400">#{tkey(t.num)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.title}</span>
                  <span className={`chip hidden sm:flex ${statusChip[t.status]}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot[t.status]}`} /> {t.status}</span>
                  {['overdue', 'soon'].includes(sla.state) && <span className={`chip hidden md:flex ${slaChip[sla.state]}`}>{sla.label}</span>}
                  <ChevronRight size={15} className="shrink-0 text-slate-300 transition group-hover:text-brand-500" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
function Stat({ label, value, tone, icon: Icon }) {
  const tones = {
    emerald: 'text-emerald-600 bg-emerald-50', amber: 'text-amber-600 bg-amber-50',
    violet: 'text-violet-600 bg-violet-50', red: 'text-red-600 bg-red-50', brand: 'text-brand-600 bg-brand-50',
  }
  return (
    <div className="card p-4 transition hover:border-brand-200 hover:shadow-lift">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{label}</span>
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${tones[tone]}`}><Icon size={15} /></span>
      </div>
      <div className="mt-2 font-display text-3xl font-extrabold text-ink">{value}</div>
    </div>
  )
}
function MetricCard({ label, value, sub, tone, icon: Icon, spine }) {
  const tones = {
    emerald: 'text-emerald-600 bg-emerald-50', amber: 'text-amber-600 bg-amber-50',
    violet: 'text-violet-600 bg-violet-50', red: 'text-red-600 bg-red-50', brand: 'text-brand-600 bg-brand-50',
  }
  const spines = {
    emerald: 'bg-emerald-400', amber: 'bg-amber-400', violet: 'bg-violet-400', red: 'bg-red-500', brand: 'bg-brand-500',
  }
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-brand-200 hover:shadow-lift">
      <span className={`absolute inset-y-0 left-0 w-1 ${spines[spine || tone]}`} />
      <div className="flex items-start justify-between pl-2">
        <div>
          <span className="text-xs font-medium text-slate-500">{label}</span>
          <div className="mt-1 font-display text-[28px] font-extrabold leading-none text-ink">{value}</div>
          {sub && <div className="mt-1.5 text-[11px] text-slate-400">{sub}</div>}
        </div>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tones[tone]}`}><Icon size={16} /></span>
      </div>
    </div>
  )
}

/* ---------------- QUEUE (Faveo-style ticket grid) ---------------- */
function Queue({ tickets, onOpen, onRefresh, initialFilter = 'All', session }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState(initialFilter)
  const [deptFilter, setDeptFilter] = useState('All')
  const [agentFilter, setAgentFilter] = useState('All')
  const [priFilter, setPriFilter] = useState('All')
  const [sortBy, setSortBy] = useState('newest')
  const [selected, setSelected] = useState(() => new Set())
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkErr, setBulkErr] = useState('')
  const [agents, setAgents] = useState([])
  useEffect(() => { setFilter(initialFilter) }, [initialFilter])
  useEffect(() => { getAgents().then(setAgents).catch(() => setAgents([])) }, [])

  const counts = {
    All: tickets.length,
    Open: tickets.filter(t => t.status === 'Open').length,
    'In Progress': tickets.filter(t => t.status === 'In Progress').length,
    Resolved: tickets.filter(t => t.status === 'Resolved').length,
    Closed: tickets.filter(t => t.status === 'Closed').length,
  }
  const openCritical = tickets.filter(t => t.priority === 'Critical' && !['Resolved', 'Closed'].includes(t.status)).length
  const overdue = tickets.filter(t => slaStatus(t).state === 'overdue').length
  const unassignedOpen = tickets.filter(t => !t.assigned_to && !['Resolved', 'Closed'].includes(t.status)).length
  const resolvedToday = tickets.filter(t => t.resolved_at && (Date.now() - new Date(t.resolved_at)) < 86400000).length

  const departments = ['All', ...new Set(tickets.map(t => t.department || t.category).filter(Boolean))]
  const assignees = ['All', 'Unassigned', ...new Set(tickets.map(t => t.assigned_to).filter(Boolean))]

  const matchesSpecialFilter = (t) => {
    if (filter === 'mine') return t.assigned_to === session.name && !['Resolved', 'Closed'].includes(t.status)
    if (filter === 'unassigned') return !t.assigned_to && !['Resolved', 'Closed'].includes(t.status)
    if (filter === 'overdue') return slaStatus(t).state === 'overdue'
    if (filter === 'due') {
      const target = SLA_HOURS[t.priority] ?? 24
      const hoursLeft = target - (Date.now() - new Date(t.created_at)) / 3600000
      return !['Resolved', 'Closed'].includes(t.status) && hoursLeft > 0 && hoursLeft <= 24
    }
    return filter === 'All' || t.status === filter
  }

  const sorters = {
    newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    oldest: (a, b) => new Date(a.created_at) - new Date(b.created_at),
    priority: (a, b) => PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority),
    sla: (a, b) => {
      const left = (t) => (SLA_HOURS[t.priority] ?? 24) - (Date.now() - new Date(t.created_at)) / 3600000
      return left(a) - left(b)
    },
  }

  const list = tickets
    .filter(t => {
      const blob = `${t.title} ${t.description} ${t.requester_name} ${t.requester_email} ${t.requester_phone} ${tkey(t.num)} ${(t.tags || []).join(' ')}`.toLowerCase()
      const deptOk = deptFilter === 'All' || (t.department || t.category) === deptFilter
      const agentOk = agentFilter === 'All' || (agentFilter === 'Unassigned' ? !t.assigned_to : t.assigned_to === agentFilter)
      const priOk = priFilter === 'All' || t.priority === priFilter
      return blob.includes(q.toLowerCase()) && matchesSpecialFilter(t) && deptOk && agentOk && priOk
    })
    .sort(sorters[sortBy])

  const specialLabel = { mine: 'My tickets', unassigned: 'Unassigned tickets', overdue: 'Overdue tickets', due: 'Due soon' }[filter]

  const toggleOne = (id) => setSelected(s => { const next = new Set(s); next.has(id) ? next.delete(id) : next.add(id); return next })
  const toggleAll = () => setSelected(s => s.size === list.length ? new Set() : new Set(list.map(t => t.id)))
  const clearSelection = () => setSelected(new Set())

  const bulkUpdate = async (patch) => {
    setBulkBusy(true); setBulkErr('')
    try {
      await Promise.all([...selected].map(id => updateTicket(id, patch)))
      clearSelection(); onRefresh()
    } catch (e) { setBulkErr(e.message || 'Some tickets couldn\u2019t be updated.') }
    finally { setBulkBusy(false) }
  }
  const bulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} ticket${selected.size === 1 ? '' : 's'}? This can\u2019t be undone.`)) return
    setBulkBusy(true); setBulkErr('')
    try {
      await Promise.all([...selected].map(id => deleteTicket(id)))
      clearSelection(); onRefresh()
    } catch (e) { setBulkErr(e.message || 'Some tickets couldn\u2019t be deleted.') }
    finally { setBulkBusy(false) }
  }

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Open" value={counts.Open} sub={`of ${counts.All} total tickets`} tone="emerald" icon={Circle} />
        <MetricCard label="In progress" value={counts['In Progress']} sub="actively being worked" tone="amber" icon={Clock} />
        <MetricCard label="Critical open" value={openCritical} sub={openCritical > 0 ? 'needs immediate attention' : 'all clear'} tone="red" icon={AlertTriangle} />
        <MetricCard label="SLA overdue" value={overdue} sub={overdue > 0 ? 'past their response target' : 'on track'} tone="red" icon={Gauge} />
        <MetricCard label="Unassigned" value={unassignedOpen} sub={unassignedOpen > 0 ? 'waiting for an owner' : 'fully staffed'} tone="brand" icon={User} />
        <MetricCard label="Resolved today" value={resolvedToday} sub="closed in the last 24h" tone="violet" icon={CheckCircle2} />
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={17} className="absolute left-3.5 top-3 text-slate-400" />
          <input className="input pl-10" placeholder="Search title, person, email, phone, tag, or #IT-key" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <button onClick={onRefresh} className="btn-ghost h-[42px] shrink-0"><RefreshCw size={15} /> Refresh</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input w-auto shrink-0 py-2 text-[13px]" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          {departments.map(d => <option key={d} value={d}>{d === 'All' ? 'All departments' : d}</option>)}
        </select>
        <select className="input w-auto shrink-0 py-2 text-[13px]" value={agentFilter} onChange={e => setAgentFilter(e.target.value)}>
          {assignees.map(a => <option key={a} value={a}>{a === 'All' ? 'All assignees' : a}</option>)}
        </select>
        <select className="input w-auto shrink-0 py-2 text-[13px]" value={priFilter} onChange={e => setPriFilter(e.target.value)}>
          <option value="All">All priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="input w-auto shrink-0 py-2 text-[13px]" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="priority">Highest priority first</option>
          <option value="sla">SLA due soonest</option>
        </select>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {['All', ...STATUSES].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`chip border px-3 py-1.5 transition ${filter === s ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
            {s} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span>
          </button>
        ))}
        {specialLabel && (
          <button onClick={() => setFilter('All')} className="chip border border-brand-300 bg-brand-100 px-3 py-1.5 text-brand-800">
            {specialLabel} <X size={12} />
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-semibold text-brand-800">{selected.size} selected</span>
          <span className="text-slate-300">|</span>
          <select className="input w-auto py-1.5 text-[13px]" disabled={bulkBusy} defaultValue=""
            onChange={e => { if (e.target.value) { bulkUpdate({ status: e.target.value }); e.target.value = '' } }}>
            <option value="" disabled>Set status&hellip;</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input w-auto py-1.5 text-[13px]" disabled={bulkBusy} defaultValue=""
            onChange={e => { if (e.target.value) { bulkUpdate({ assigned_to: e.target.value === '__unassign' ? '' : e.target.value }); e.target.value = '' } }}>
            <option value="" disabled>Assign to&hellip;</option>
            <option value="__unassign">Unassigned</option>
            {agents.filter(a => a.active !== false).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
          </select>
          <select className="input w-auto py-1.5 text-[13px]" disabled={bulkBusy} defaultValue=""
            onChange={e => { if (e.target.value) { bulkUpdate({ priority: e.target.value }); e.target.value = '' } }}>
            <option value="" disabled>Set priority&hellip;</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={bulkDelete} disabled={bulkBusy} className="btn-danger btn-sm"><Trash2 size={13} /> Delete</button>
          {bulkBusy && <Loader2 size={15} className="animate-spin text-brand-600" />}
          <button onClick={clearSelection} className="ml-auto text-xs font-medium text-brand-700 hover:text-brand-900">Clear selection</button>
        </div>
      )}
      {bulkErr && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{bulkErr}</p>}

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Inbox size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-600">No tickets here</p>
          <p className="text-sm text-slate-400">Try a different filter or clear the search.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <button onClick={toggleAll} className="flex items-center gap-2 px-1 text-xs font-medium text-slate-400 hover:text-slate-600">
            <span className={`grid h-4 w-4 place-items-center rounded border ${selected.size === list.length ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'}`}>
              {selected.size === list.length && <CheckCircle2 size={11} />}
            </span>
            {selected.size === list.length ? 'Deselect all' : `Select all ${list.length}`}
          </button>
          {list.map(t => {
            const sla = slaStatus(t)
            const isSelected = selected.has(t.id)
            return (
              <div key={t.id}
                className={`group flex w-full items-stretch overflow-hidden rounded-2xl border bg-white shadow-card transition hover:shadow-lift ${isSelected ? 'border-brand-300 ring-2 ring-brand-100' : 'border-slate-200 hover:border-brand-200'}`}>
                <span className={`w-1.5 shrink-0 ${prioritySpine[t.priority]}`} />
                <button onClick={(e) => { e.stopPropagation(); toggleOne(t.id) }} className="flex items-center px-3">
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${isSelected ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300'}`}>
                    {isSelected && <CheckCircle2 size={11} />}
                  </span>
                </button>
                <button onClick={() => onOpen(t)} className="flex flex-1 items-center gap-4 py-4 pr-4 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-400">#{tkey(t.num)}</span>
                      <h3 className="truncate font-semibold text-ink">{t.title}</h3>
                      {t.ai_triaged && <Sparkles size={13} className="shrink-0 text-brand-400" />}
                      {t.requester_type === 'External' && (
                        <span className="chip shrink-0 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"><Globe2 size={10} /> External</span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-slate-500">{t.summary || t.description || 'No additional details'}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                      <span className="font-medium text-slate-500">{t.requester_name}</span>
                      <span>&middot;</span><span>{t.requester_department || t.category}</span>
                      <span>&middot;</span><span>{timeAgo(t.created_at)}</span>
                      {t.assigned_to && <><span>&middot;</span><span className="inline-flex items-center gap-1"><User size={11} /> {t.assigned_to}</span></>}
                      {(t.tags || []).slice(0, 2).map(tag => (
                        <span key={tag} className="chip bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">#{tag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="hidden flex-col items-end gap-1.5 sm:flex">
                    <span className={`chip ${priorityChip[t.priority]}`}>{t.priority}</span>
                    <span className={`chip ${statusChip[t.status]}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot[t.status]}`} /> {t.status}</span>
                    {['overdue', 'soon'].includes(sla.state) && <span className={`chip ${slaChip[sla.state]}`}><Gauge size={11} /> {sla.label}</span>}
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

/* ---------------- INSIGHTS / REPORTS ---------------- */
function Insights({ tickets }) {
  const [comments, setComments] = useState([])
  const [agents, setAgents] = useState([])
  const [tab, setTab] = useState('category')
  useEffect(() => {
    getAllComments().then(setComments).catch(() => setComments([]))
    getAgents().then(setAgents).catch(() => setAgents([]))
  }, [])

  const total = tickets.length
  const automationRate = total ? Math.round(100 * tickets.filter(t => t.ai_triaged).length / total) : 0

  const firstResp = []
  for (const t of tickets) {
    const cs = comments.filter(c => c.ticket_id === t.id && !c.internal).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    if (cs[0]) firstResp.push((new Date(cs[0].created_at) - new Date(t.created_at)) / 3600000)
  }
  const avgFirstMins = firstResp.length ? Math.round((firstResp.reduce((a, b) => a + b, 0) / firstResp.length) * 60) : null
  const avgFirstLabel = avgFirstMins === null ? '\u2014'
    : avgFirstMins < 60 ? `${avgFirstMins}m`
    : `${Math.round(avgFirstMins / 60)}h`

  const respondedCount = firstResp.length
  const respondedPct = total ? Math.round(100 * respondedCount / total) : 0

  const slaMetCount = tickets.filter(t => slaStatus(t).state === 'met').length
  const slaConsidered = tickets.filter(t => ['met', 'missed'].includes(slaStatus(t).state)).length
  const slaPct = slaConsidered ? Math.round(100 * slaMetCount / slaConsidered) : 100

  const closedCount = tickets.filter(t => ['Resolved', 'Closed'].includes(t.status)).length
  const criticalCount = tickets.filter(t => t.priority === 'Critical').length

  const byCat = CATEGORIES.map(c => ({ label: c, value: tickets.filter(t => t.category === c).length })).filter(x => x.value)
  const byPri = PRIORITIES.map(p => ({ label: p, value: tickets.filter(t => t.priority === p).length })).filter(x => x.value)
  const byDept = [...new Set(tickets.map(t => t.requester_department).filter(Boolean))]
    .map(d => ({ label: d, value: tickets.filter(t => t.requester_department === d).length }))
    .sort((a, b) => b.value - a.value).slice(0, 8)
  const byAgent = agents.map(a => ({ label: a.name, value: tickets.filter(t => t.assigned_to === a.name).length })).filter(x => x.value)

  const TABS = [
    { id: 'category', label: 'Category', rows: byCat },
    { id: 'priority', label: 'Priority', rows: byPri },
    { id: 'department', label: 'Department', rows: byDept },
    { id: 'agent', label: 'Agent', rows: byAgent },
  ]
  const activeRows = TABS.find(x => x.id === tab)?.rows || []

  const priorityColors = { Low: '#cbd5e1', Medium: '#60a5fa', High: '#fbbf24', Critical: '#ef4444' }
  const priorityDonut = PRIORITIES.map(p => ({ label: p, value: tickets.filter(t => t.priority === p).length, color: priorityColors[p] }))
  const statusColors = { Open: '#1c7ce8', 'In Progress': '#fbbf24', Resolved: '#8b5cf6', Closed: '#34d399' }
  const statusDonut = STATUSES.map(s => ({ label: s, value: tickets.filter(t => t.status === s).length, color: statusColors[s] }))
  const reqTypeColors = { Internal: '#1c7ce8', External: '#cbd5e1' }
  const reqTypeDonut = REQUESTER_TYPES.map(rt => ({ label: rt, value: tickets.filter(t => (t.requester_type || 'Internal') === rt).length, color: reqTypeColors[rt] }))

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-navy-800 via-brand-700 to-emerald-600 px-5 py-4 shadow-lift">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-extrabold text-white">Helpdesk Analysis</h2>
          <span className="rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white">All-time report</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 sm:flex-nowrap">
        <FunnelStage label="Created" big={total} sub="total tickets" gradient="bg-gradient-to-r from-violet-500 to-violet-600" />
        <FunnelStage label="First Response" big={`${respondedPct}%`} sub={`${respondedCount} of ${total} replied to`} gradient="bg-gradient-to-r from-navy-700 to-navy-800" />
        <FunnelStage label="SLA Met" big={`${slaPct}%`} sub={`${slaMetCount} of ${slaConsidered} on time`} gradient="bg-gradient-to-r from-brand-600 to-brand-700" />
        <FunnelStage label="Critical" big={criticalCount} sub="critical priority" gradient="bg-gradient-to-r from-amber-500 to-amber-600" />
        <FunnelStage label="Closed" big={closedCount} sub={`${total ? Math.round(100 * closedCount / total) : 0}% of total`} gradient="bg-gradient-to-r from-emerald-500 to-emerald-600" />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total tickets" value={total} tone="brand" icon={Inbox} />
        <Stat label="Automation rate" value={`${automationRate}%`} tone="violet" icon={Zap} />
        <Stat label="Avg first reply" value={avgFirstLabel} tone="amber" icon={Clock} />
        <Stat label="SLA met" value={`${slaPct}%`} tone="emerald" icon={Gauge} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex gap-1 border-b border-slate-100 bg-slate-50 px-3 pt-2">
          {TABS.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`relative rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${tab === tb.id ? 'bg-white text-brand-700' : 'text-slate-500 hover:text-slate-700'}`}>
              {tb.label}
              {tab === tb.id && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-brand-600" />}
            </button>
          ))}
        </div>
        <div className="p-5">
          <h3 className="mb-4 font-display text-sm font-bold text-ink">Tickets by {TABS.find(x => x.id === tab)?.label}</h3>
          <HorizontalBarChart rows={activeRows} color="#a855f7" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5">
          <h3 className="mb-4 font-display text-sm font-bold text-ink">Tickets by Priority</h3>
          <DonutChart slices={priorityDonut} />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-display text-sm font-bold text-ink">Tickets by Status</h3>
          <DonutChart slices={statusDonut} />
        </div>
        <div className="card p-5">
          <h3 className="mb-4 font-display text-sm font-bold text-ink">Internal vs. External</h3>
          <DonutChart slices={reqTypeDonut} centerLabel="Requesters" />
        </div>
      </div>
    </div>
  )
}

/* ---------------- KNOWLEDGE BASE (read view for agents) ---------------- */
function KnowledgeBaseAdmin() {
  const [q, setQ] = useState('')
  const list = KB.filter(a => `${a.title} ${a.summary} ${a.category}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-extrabold text-ink">Knowledge base</h2>
        <p className="text-sm text-slate-500">These articles power employee self-service and the AI&rsquo;s suggested replies.</p>
      </div>
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
        <input className="input pl-9" placeholder="Search articles" value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map(a => (
          <div key={a.id} className="card p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium text-ink"><BookOpen size={15} className="shrink-0 text-brand-500" /> {a.title}</div>
              <span className="chip bg-slate-100 text-slate-500 shrink-0">{a.category}</span>
            </div>
            <p className="mt-1.5 text-sm text-slate-500">{a.summary}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-slate-500">
              {a.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>
        ))}
      </div>
    </div>
  )
}

/* =====================================================================
   DEPARTMENTS ADMIN — drives the dropdown employees pick from when
   filing a ticket ("what department he is").
===================================================================== */
function DepartmentsAdmin() {
  const [list, setList] = useState([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState('')
  const refresh = () => getDepartments().then(setList).catch(e => setErr(e.message))
  useEffect(() => { refresh() }, [])

  const save = async () => {
    setErr('')
    if (!name.trim()) { setErr('Give the department a name.'); return }
    if (list.some(d => d.name.toLowerCase() === name.trim().toLowerCase())) { setErr('That department already exists.'); return }
    try {
      await addDepartment({ name: name.trim(), description: desc.trim() })
      setName(''); setDesc(''); setAdding(false); refresh()
    } catch (e) { setErr(e.message) }
  }
  const remove = async (id) => {
    try { await deleteDepartment(id); refresh() } catch (e) { setErr(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink">Departments</h2>
          <p className="text-sm text-slate-500">Shown to employees on the request form so they can tell you where they sit in the company.</p>
        </div>
        <button onClick={() => setAdding(a => !a)} className="btn-primary"><Plus size={16} /> Add department</button>
      </div>

      {err && !adding && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {adding && (
        <div className="card anim-slide p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Department name</label>
              <input className="input" placeholder="e.g. Marketing" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Description <span className="font-normal text-slate-400">(optional)</span></label>
              <input className="input" placeholder="What this team covers" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={save}><CheckCircle2 size={16} /> Save department</button>
            <button className="btn-ghost" onClick={() => { setAdding(false); setErr('') }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr><th className="th">Department</th><th className="th">Description</th><th className="th text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(d => (
              <tr key={d.id} className="transition hover:bg-slate-50/60">
                <td className="td font-semibold text-ink">{d.name}</td>
                <td className="td text-slate-500">{d.description || '\u2014'}</td>
                <td className="td text-right">
                  <button onClick={() => remove(d.id)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* =====================================================================
   STAFF ADMIN — the admin can create up to MAX_STAFF_SEATS (3) IT
   staff accounts in addition to their own admin login.
===================================================================== */
function StaffAdmin({ session }) {
  const [agents, setAgents] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Agent' })
  const [err, setErr] = useState('')
  const refresh = () => getAgents().then(setAgents).catch(e => setErr(e.message))
  useEffect(() => { refresh() }, [])
  const used = agents.length
  const seatsLeft = Math.max(0, MAX_STAFF_SEATS + 1 - used)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const reset = () => { setForm({ name: '', email: '', password: '', role: 'Agent' }); setErr('') }

  const create = async () => {
    setErr('')
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      setErr('Name, email, and password are required.'); return
    }
    if (form.password.length < 8) { setErr('Password should be at least 8 characters.'); return }
    try {
      await addAgent({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role })
      reset(); setAdding(false); refresh()
    } catch (e) { setErr(e.message) }
  }

  const toggleActive = async (a) => {
    try { await updateAgent(a.id, { active: !a.active }); refresh() } catch (e) { setErr(e.message) }
  }
  const remove = async (a) => {
    try { await deleteAgent(a.id); refresh() } catch (e) { setErr(e.message) }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-extrabold text-ink">IT staff accounts</h2>
          <p className="text-sm text-slate-500">Your plan includes the admin account plus <b>{MAX_STAFF_SEATS}</b> IT staff seats.</p>
        </div>
        <button onClick={() => setAdding(a => !a)} disabled={seatsLeft <= 0} className="btn-primary">
          <UserPlus size={16} /> Add staff account
        </button>
      </div>

      <div className="card flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Users size={18} /></div>
        <div className="flex-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">Seats used</span>
            <span className="font-semibold text-slate-600">{used} / {MAX_STAFF_SEATS + 1}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(used / (MAX_STAFF_SEATS + 1)) * 100}%` }} />
          </div>
        </div>
        <span className={`chip ${seatsLeft > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
          {seatsLeft > 0 ? `${seatsLeft} seat${seatsLeft === 1 ? '' : 's'} left` : 'Seat limit reached'}
        </span>
      </div>

      {err && !adding && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      {adding && (
        <div className="card anim-slide p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Full name</label>
              <input className="input" placeholder="e.g. Yara Saleh" value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
            <div>
              <label className="label">Email (used to sign in)</label>
              <div className="relative"><Mail size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input className="input pl-9" type="email" placeholder="yara@company.com" value={form.email} onChange={e => set('email', e.target.value)} /></div>
            </div>
            <div>
              <label className="label">Temporary password</label>
              <div className="relative"><Lock size={15} className="absolute left-3.5 top-3 text-slate-400" />
                <input className="input pl-9" type="text" placeholder="At least 8 characters" value={form.password} onChange={e => set('password', e.target.value)} /></div>
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="Agent">Agent (IT staff)</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
          </div>
          {err && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button className="btn-primary" onClick={create}><CheckCircle2 size={16} /> Create account</button>
            <button className="btn-ghost" onClick={() => { setAdding(false); reset() }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="th">Name</th><th className="th">Email</th><th className="th">Role</th>
              <th className="th">Status</th><th className="th text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {agents.map(a => (
              <tr key={a.id} className="transition hover:bg-slate-50/60">
                <td className="td">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-700 text-[11px] font-bold text-white">{initials(a.name)}</span>
                    <div className="font-semibold text-ink">{a.name}{a.id === session.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}</div>
                  </div>
                </td>
                <td className="td text-slate-600">{a.email}</td>
                <td className="td"><span className={`chip ${roleChip[a.role] || roleChip.Agent}`}>{a.role}</span></td>
                <td className="td">
                  <button onClick={() => toggleActive(a)} className={`chip ${a.active === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${a.active === false ? 'bg-slate-400' : 'bg-emerald-500'}`} /> {a.active === false ? 'Inactive' : 'Active'}
                  </button>
                </td>
                <td className="td text-right">
                  <button onClick={() => remove(a)} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Staff sign in with their email and password. Passwords are securely hashed by Supabase Auth and are never visible to this app or anyone else.</p>
    </div>
  )
}

/* =====================================================================
   TICKET DETAIL — AI panel, suggested reply, SLA, activity.
   Shows full requester contact card (email/phone/type/department),
   assigns from real staff accounts, and supports internal notes
   (visible to agents only) vs. public replies — Faveo-style.
   Public replies trigger an email to the requester.
===================================================================== */
function Detail({ ticket, onClose, onChanged, onDeleted, agent }) {
  const [t, setT] = useState(ticket)
  const [comments, setComments] = useState([])
  const [note, setNote] = useState('')
  const [drafting, setDrafting] = useState(false)
  const [asInternal, setAsInternal] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [agents, setAgents] = useState([])
  const [err, setErr] = useState('')

  useEffect(() => {
    getAgents().then(setAgents).catch(() => setAgents([]))
  }, [])
  useEffect(() => {
    setT(ticket)
    getComments(ticket.id).then(setComments).catch(() => setComments([]))
  }, [ticket])

  const sla = slaStatus(t)
  const kbMatches = useMemo(() => matchKB(t, 2), [t.id, t.title, t.description])

  const change = async (field, value) => {
    setErr('')
    try {
      const u = await updateTicket(t.id, { [field]: value })
      setT(u); onChanged(u)
      if (field === 'status' && ['Resolved', 'Closed'].includes(value)) {
        notifyTicketReply(u, `Your ticket status was updated to "${value}".`, agent).catch(() => {})
      }
    } catch (e) { setErr(e.message || 'Couldn\u2019t save that change.') }
  }
  const post = async (text) => {
    const body = (text ?? note).trim()
    if (!body) return
    try {
      await addComment(t.id, agent, body, asInternal)
      setNote('')
      const fresh = await getComments(t.id)
      setComments(fresh)
      if (!asInternal) notifyTicketReply(t, body, agent).catch(() => {}) // best-effort; never blocks the reply
    } catch (e) { setErr(e.message || 'Couldn\u2019t post that reply.') }
  }
  const suggest = () => {
    setDrafting(true)
    setTimeout(() => { setNote(generateReply(t)); setAsInternal(false); setDrafting(false) }, 500)
  }
  const remove = async () => {
    try { await deleteTicket(t.id); onDeleted() } catch (e) { setErr(e.message || 'Couldn\u2019t delete this ticket.') }
  }

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-lg flex-col bg-slate-50 shadow-lift">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-semibold text-brand-700">#{tkey(t.num)}</span>
              <span className={`chip ${priorityChip[t.priority]}`}>{t.priority}</span>
              <span className={`chip ${statusChip[t.status]}`}><span className={`h-1.5 w-1.5 rounded-full ${statusDot[t.status]}`} /> {t.status}</span>
              <span className={`chip ${slaChip[sla.state]}`}><Gauge size={11} /> {sla.label}</span>
            </div>
            <h2 className="font-display text-lg font-bold leading-snug text-ink">{t.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => setConfirmDelete(true)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
            <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X size={18} /></button>
          </div>
        </div>

        {confirmDelete && (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            <p className="mb-2">Delete ticket #{tkey(t.num)} permanently? This can&rsquo;t be undone.</p>
            <div className="flex gap-2">
              <button onClick={remove} className="btn-danger btn-sm">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
        )}

        {err && !confirmDelete && (
          <div className="flex items-center justify-between gap-2 border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700">
            <span>{err}</span>
            <button onClick={() => setErr('')} className="shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/80 to-white p-4">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
              <Sparkles size={14} /> AI summary
            </div>
            <p className="text-sm text-slate-700">{t.summary || summarize(t)}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className={`chip ${sentimentChip[t.sentiment] || sentimentChip.Calm}`}>Sentiment: {t.sentiment || 'Calm'}</span>
              {(t.tags || []).map(tag => (
                <span key={tag} className="chip bg-white text-slate-600 border border-slate-200"><Tag size={11} /> {tag}</span>
              ))}
            </div>
          </div>

          {/* Requester contact card — name, email/phone, internal vs external, department */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-100 font-bold text-brand-700">{initials(t.requester_name)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold text-ink">{t.requester_name}</span>
                  <span className={`chip ${t.requester_type === 'External' ? 'bg-slate-100 text-slate-600' : 'bg-brand-50 text-brand-700'}`}>
                    {t.requester_type === 'External' ? <Globe2 size={11} /> : <Building2 size={11} />} {t.requester_type || 'Internal'}
                  </span>
                  {t.requester_department && <span className="chip border border-slate-200 bg-white text-slate-500"><Briefcase size={11} /> {t.requester_department}</span>}
                </div>
                <div className="mt-1.5 space-y-0.5 text-sm text-slate-500">
                  {t.requester_email && <div className="flex items-center gap-1.5"><Mail size={13} /> {t.requester_email}</div>}
                  {t.requester_phone && <div className="flex items-center gap-1.5"><Phone size={13} /> {t.requester_phone}</div>}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-400"><div>{t.category}</div><div>{timeAgo(t.created_at)}</div></div>
            </div>
          </div>

          {t.description && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</div>
              <p className="whitespace-pre-wrap text-sm text-slate-700">{t.description}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label text-xs">Status</label>
              <select className="input px-2 py-2 text-[13px]" value={t.status} onChange={e => change('status', e.target.value)}>
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Priority</label>
              <select className="input px-2 py-2 text-[13px]" value={t.priority} onChange={e => change('priority', e.target.value)}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label text-xs">Assignee</label>
              <select className="input px-2 py-2 text-[13px]" value={t.assigned_to || ''} onChange={e => change('assigned_to', e.target.value)}>
                <option value="">Unassigned</option>
                {agents.filter(a => a.active !== false).map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {kbMatches.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <BookOpen size={14} className="text-brand-500" /> Suggested knowledge-base articles
              </div>
              <div className="space-y-2">
                {kbMatches.map(a => (
                  <div key={a.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="text-sm font-medium text-ink">{a.title}</div>
                    <p className="mt-0.5 text-xs text-slate-500">{a.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <MessageSquare size={16} /> Activity &amp; replies <span className="text-slate-400">({comments.length})</span>
            </div>
            <div className="space-y-2.5">
              {comments.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-5 text-center text-sm text-slate-400">No replies yet. Generate one below or write your own.</p>
              )}
              {comments.map(c => (
                <div key={c.id} className={`rounded-xl border p-3.5 ${c.internal ? 'border-amber-200 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{initials(c.author)}</span>
                      {c.author}
                      {c.internal && <span className="chip bg-amber-100 text-amber-700"><StickyNote size={10} /> Internal note</span>}
                    </span>
                    <span className="text-xs text-slate-400">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="whitespace-pre-wrap pl-8 text-sm text-slate-600">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 bg-white px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <button onClick={suggest} disabled={drafting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-60">
              {drafting ? <><Loader2 size={13} className="animate-spin" /> Drafting reply&hellip;</> : <><Sparkles size={13} /> Suggest a reply</>}
            </button>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-500">
              <StickyNote size={13} className={asInternal ? 'text-amber-500' : 'text-slate-400'} />
              Internal note
              <span onClick={() => setAsInternal(v => !v)} className={`switch ${asInternal ? 'bg-amber-400' : 'bg-slate-200'}`}>
                <span className={`switch-knob ${asInternal ? 'translate-x-[24px]' : 'translate-x-1'}`} />
              </span>
            </label>
          </div>
          <div className="flex items-end gap-2">
            <textarea className="input min-h-[44px] max-h-44 resize-none py-2.5" rows={1}
              placeholder={asInternal ? 'Write a note only agents can see\u2026' : 'Write a reply, or let AI draft one\u2026'}
              value={note} onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }} />
            <button className="btn-primary h-[44px] px-3.5" onClick={() => post()} disabled={!note.trim()}><Send size={16} /></button>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">Enter to post &middot; Shift+Enter for a new line &middot; toggle &ldquo;Internal note&rdquo; to keep a reply hidden from the requester</p>
        </div>
      </aside>
    </div>
  )
}
