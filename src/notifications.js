// ============================================================
//  Email notifications.
// ============================================================
import { supabase } from './supabaseClient'
 
export const TICKET_ALERT_RECIPIENTS = [
  'ICT@1alrai.sa',
]
 
async function callSendEmail(payload) {
  const { data, error } = await supabase.functions.invoke('send-email', { body: payload })
  if (error) throw new Error(error.message || 'Email function failed.')
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
 










































