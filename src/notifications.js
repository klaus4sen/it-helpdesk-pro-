// ============================================================
//  Email notifications.
// ============================================================
 
export const TICKET_ALERT_RECIPIENTS = [
  'altayeb@1alrai.sa',
]
 
async function callSendEmail(payload) {
  const res = await fetch('/api/send-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok || data.error) throw new Error(data.error?.message || data.error || 'Email function failed.')
  return data
}
 
export async function notifyNewTicket(ticket) {
  return callSendEmail({
    type: 'new_ticket',
    to: TICKET_ALERT_RECIPIENTS,
    subject: `New ticket #IT-${ticket.num}: ${ticket.title}`,
    ticket,
  })
}
 
export async function notifyTicketReply(ticket, replyBody, authorName) {
  if (!ticket.requester_email) return null
  return callSendEmail({
    type: 'ticket_reply',
    to: [ticket.requester_email],
    subject: `Update on your ticket #IT-${ticket.num}: ${ticket.title}`,
    ticket,
    replyBody,
    authorName,
  })
}