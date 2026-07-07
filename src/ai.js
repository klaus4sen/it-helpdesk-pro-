// ============================================================
//  ON-DEVICE AI ENGINE  (no API key, no cost, nothing leaves
//  the browser). Powers auto-triage, summaries, suggested
//  replies, sentiment, knowledge-base matching, and SLAs.
//
//  Want fully generative AI later? Every function below is a
//  clean seam — swap the body for a call to Claude/OpenAI/etc.
//  See generateReply() for the marked hook.
// ============================================================

/* ---------------- Knowledge base ---------------- */
export const KB = [
  {
    id: 'wifi', title: 'Wi-Fi keeps dropping or won\u2019t connect', category: 'Network',
    keywords: ['wifi', 'wi-fi', 'wireless', 'internet', 'connection', 'drops', 'dropping', 'disconnect', 'network'],
    summary: 'Reconnect to the network and reset the laptop\u2019s wireless adapter.',
    steps: [
      'Toggle Wi-Fi off and on, then forget the office network and rejoin it.',
      'Restart the laptop \u2014 this clears most adapter glitches.',
      'If others nearby are also affected, it\u2019s likely the access point, not your device.',
    ],
  },
  {
    id: 'password', title: 'Locked out / need a password reset', category: 'Account',
    keywords: ['password', 'reset', 'locked', 'login', 'log in', 'account', 'access', 'sign in', 'mfa', '2fa', 'otp'],
    summary: 'Reset the password through the self-service portal or have IT unlock the account.',
    steps: [
      'Use the \u201cForgot password\u201d link on the sign-in page first.',
      'If the account is locked, IT can unlock it within a few minutes.',
      'Re-enroll your MFA device if prompts stop arriving.',
    ],
  },
  {
    id: 'vpn', title: 'VPN won\u2019t connect', category: 'Network',
    keywords: ['vpn', 'remote', 'tunnel', 'connect remotely', 'work from home', 'wfh'],
    summary: 'Check credentials, switch networks, and reinstall the VPN client if needed.',
    steps: [
      'Confirm your username/password are current (a recent password change breaks VPN).',
      'Try a different network (phone hotspot) to rule out your local Wi-Fi.',
      'Quit and relaunch the VPN client; reinstall if it still fails.',
    ],
  },
  {
    id: 'printer', title: 'Printer not printing', category: 'Hardware',
    keywords: ['printer', 'print', 'printing', 'scanner', 'paper', 'toner', 'queue'],
    summary: 'Clear the print queue and confirm the right printer is selected.',
    steps: [
      'Open the print queue and cancel any stuck jobs.',
      'Make sure the correct printer (not \u201cPDF\u201d) is selected.',
      'Power-cycle the printer; check for paper or toner warnings.',
    ],
  },
  {
    id: 'email', title: 'Email or signature issues', category: 'Email',
    keywords: ['email', 'outlook', 'signature', 'mailbox', 'inbox', 'spam', 'mail', 'send', 'receive'],
    summary: 'Restart the mail app and re-save the signature; check junk filters.',
    steps: [
      'Fully close and reopen Outlook / the mail app.',
      'Re-save the signature and send a test message to yourself.',
      'Check the Junk/Spam folder and safe-senders list for missing mail.',
    ],
  },
  {
    id: 'slow', title: 'Computer running slow', category: 'Hardware',
    keywords: ['slow', 'lagging', 'freezing', 'freeze', 'hang', 'performance', 'frozen'],
    summary: 'Restart, close heavy apps, and check for pending updates.',
    steps: [
      'Restart the machine \u2014 uptime of many days is a common cause.',
      'Close memory-heavy apps and browser tabs you aren\u2019t using.',
      'Install any pending OS updates, then restart again.',
    ],
  },
  {
    id: 'install', title: 'Request to install software', category: 'Software',
    keywords: ['install', 'software', 'application', 'app', 'license', 'adobe', 'office', 'program', 'download'],
    summary: 'IT will push the approved app or provide a licensed installer.',
    steps: [
      'Confirm the exact app name and version you need.',
      'IT verifies licensing and deploys it remotely \u2014 no action needed from you.',
      'Restart the app launcher if the new software doesn\u2019t appear right away.',
    ],
  },
  {
    id: 'display', title: 'Monitor / display not working', category: 'Hardware',
    keywords: ['monitor', 'display', 'screen', 'hdmi', 'second screen', 'dock', 'no signal', 'black screen'],
    summary: 'Reseat the cable and dock, then pick the right input/source.',
    steps: [
      'Unplug and firmly reseat the video cable at both ends.',
      'If you use a dock, disconnect and reconnect it.',
      'Use the monitor\u2019s source button to select the correct input.',
    ],
  },
]

/* ---------------- helpers ---------------- */
const norm = (s) => (s || '').toLowerCase()
const hits = (text, words) => words.filter(w => text.includes(w))

const CATEGORY_WORDS = {
  Network: ['wifi', 'wi-fi', 'wireless', 'internet', 'network', 'vpn', 'connection', 'ethernet', 'dns', 'remote'],
  Hardware: ['laptop', 'monitor', 'screen', 'display', 'mouse', 'keyboard', 'printer', 'battery', 'charger', 'dock', 'device', 'hardware', 'slow', 'freezing'],
  Software: ['install', 'software', 'application', 'app', 'license', 'adobe', 'office', 'excel', 'word', 'update', 'program', 'crash'],
  Account: ['password', 'login', 'log in', 'account', 'locked', 'access', 'reset', 'mfa', '2fa', 'permission', 'sign in'],
  Email: ['email', 'outlook', 'mailbox', 'signature', 'spam', 'inbox', 'mail'],
}

const CRITICAL_WORDS = ['down', 'outage', 'breach', 'hacked', 'security', 'can\u2019t work', 'cant work', 'cannot work', 'whole team', 'everyone', 'server down', 'data loss', 'ransomware']
const HIGH_WORDS = ['urgent', 'asap', 'immediately', 'critical', 'blocking', 'deadline', 'important', 'broken', 'not working', 'won\u2019t', 'cannot', 'can\u2019t', 'cant']
const LOW_WORDS = ['whenever', 'no rush', 'when you can', 'question', 'request', 'would like', 'sometime', 'low priority']
const FRUSTRATED_WORDS = ['urgent', 'asap', 'immediately', 'again', 'still', 'frustrated', 'angry', 'ridiculous', 'unacceptable', 'third time', 'keeps', 'over and over', '!!!']

/* ---------------- public API ---------------- */

// Auto-triage a new request: category, priority, tags, sentiment.
export function triage({ title = '', description = '' }) {
  const text = norm(title + ' ' + description)

  // category = best keyword match
  let category = 'Other', best = 0
  for (const [cat, words] of Object.entries(CATEGORY_WORDS)) {
    const n = hits(text, words).length
    if (n > best) { best = n; category = cat }
  }

  // priority
  let priority = 'Medium'
  if (hits(text, CRITICAL_WORDS).length) priority = 'Critical'
  else if (hits(text, HIGH_WORDS).length) priority = 'High'
  else if (hits(text, LOW_WORDS).length) priority = 'Low'

  // tags = matched keywords across categories + KB
  const allWords = [...new Set(Object.values(CATEGORY_WORDS).flat())]
  const tags = [...new Set(hits(text, allWords))].slice(0, 4)

  // sentiment
  const f = hits(text, FRUSTRATED_WORDS).length
  const sentiment = f >= 2 ? 'Urgent' : f === 1 ? 'Concerned' : 'Calm'

  return { category, priority, tags, sentiment, confident: best > 0 }
}

// One-line summary of a ticket (extractive + cleaned).
export function summarize({ title = '', description = '' }) {
  const d = description.trim()
  if (!d) return title.trim()
  const firstSentence = d.split(/(?<=[.!?])\s+/)[0]
  let s = firstSentence.length > 18 ? firstSentence : d
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length > 120) s = s.slice(0, 117).trimEnd() + '\u2026'
  return s
}

// Find the most relevant knowledge-base articles.
export function matchKB({ title = '', description = '' }, limit = 3) {
  const text = norm(title + ' ' + description)
  if (!text.trim()) return []
  return KB
    .map(a => ({ a, score: hits(text, a.keywords).length }))
    .filter(x => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map(x => x.a)
}

// Suggested assignee \u2014 picks the agent with the fewest open tickets right now
// (a simple load-balancing router; swap for skills-based routing later).
export function routeTo(department, agents = [], openCountByAgent = {}) {
  let pool = agents.filter(a => a.active !== false)

  // فلترة الموظفين حسب القسم
  if (department) {
    const departmentAgents = pool.filter(
      a => a.department === department
    )

    // إذا وجد موظفين في القسم نستخدمهم
    if (departmentAgents.length) {
      pool = departmentAgents
    }
  }

  if (!pool.length) return ''

  // توزيع عادل على موظفي القسم
  const sorted = pool.slice().sort(
    (a, b) =>
      (openCountByAgent[a.name] || 0) -
      (openCountByAgent[b.name] || 0)
  )

  return sorted[0].name
}

// ---- Suggested reply -------------------------------------------------
// This is the seam for real generative AI. To use Claude/OpenAI/Groq/etc,
// replace the body with a fetch to your model and return its text.
export function generateReply(ticket) {
  const first = (ticket.requester_name || 'there').trim().split(/\s+/)[0]
  const matches = matchKB(ticket, 1)
  const kb = matches[0]

  const opener = `Hi ${first},\n\nThanks for reaching out about \u201c${(ticket.title || 'your issue').trim()}\u201d.`

  let middle
  if (kb) {
    const steps = kb.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    middle = ` This looks like a ${kb.category.toLowerCase()} issue. A few quick things that usually fix it:\n\n${steps}`
  } else {
    middle = ` I\u2019m looking into this now. To help me narrow it down, could you tell me when it started and whether it affects just you or others nearby?`
  }

  const closer = `\n\nI\u2019ll keep this ticket (#IT-${ticket.num}) updated. Reply here if anything changes.\n\n\u2014 IT Support`
  return opener + middle + closer
}

/* ---------------- SLA ---------------- */
// Target first-response/resolution windows per priority (hours).
export const SLA_HOURS = { Critical: 2, High: 8, Medium: 24, Low: 72 }

export function slaStatus(ticket) {
  const target = SLA_HOURS[ticket.priority] ?? 24
  const due = new Date(ticket.created_at).getTime() + target * 3600000
  const resolved = ['Resolved', 'Closed'].includes(ticket.status)
  const end = resolved && ticket.resolved_at ? new Date(ticket.resolved_at).getTime() : Date.now()
  const msLeft = due - end
  const met = msLeft >= 0

  if (resolved) return { state: met ? 'met' : 'missed', label: met ? 'SLA met' : 'SLA missed', target }

  // active ticket
  const hLeft = msLeft / 3600000
  if (msLeft < 0) return { state: 'overdue', label: 'Overdue', target }
  if (hLeft <= 1) return { state: 'soon', label: 'Due <1h', target }
  if (hLeft < 24) return { state: 'ok', label: `Due in ${Math.round(hLeft)}h`, target }
  return { state: 'ok', label: `Due in ${Math.round(hLeft / 24)}d`, target }
}

// Friendly response-time estimate shown to the employee right after submitting.
export function etaLabel(priority) {
  const h = SLA_HOURS[priority] ?? 24
  if (h <= 2) return 'within about 2 hours'
  if (h <= 8) return 'within the same business day'
  if (h <= 24) return 'within 1 business day'
  return 'within 2\u20133 business days'
}
