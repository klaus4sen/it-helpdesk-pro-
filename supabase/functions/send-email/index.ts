// Supabase Edge Function: send-email
// Deploy with: supabase functions deploy send-email
// Requires one secret to be set first:
//   supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxxxxx

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_ADDRESS = Deno.env.get('EMAIL_FROM') || 'Helpdisk <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function ticketUrl(ticket) {
  return `#IT-${ticket.num}`
}

function newTicketEmail(payload) {
  const { ticket } = payload
  const subject = payload.subject || `New ticket #IT-${ticket.num}: ${ticket.title}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0d3568;">New support ticket submitted</h2>
      <p><b>Ticket:</b> ${ticketUrl(ticket)} &mdash; ${ticket.title}</p>
      <p><b>From:</b> ${ticket.requester_name} (${ticket.requester_type || 'Internal'}, ${ticket.requester_department || 'N/A'})</p>
      <p><b>Contact:</b> ${ticket.requester_email || ''} ${ticket.requester_phone ? ' / ' + ticket.requester_phone : ''}</p>
      <p><b>Priority:</b> ${ticket.priority} &nbsp; <b>Category:</b> ${ticket.category}</p>
      <p><b>Details:</b><br/>${(ticket.description || 'No additional details provided.').replace(/\n/g, '<br/>')}</p>
      <p style="margin-top:24px;color:#64748b;font-size:12px;">This is an automated notification from your IT Helpdesk.</p>
    </div>`
  return { subject, html }
}

function replyEmail(payload) {
  const { ticket, replyBody, authorName } = payload
  const subject = payload.subject || `Update on your ticket #IT-${ticket.num}: ${ticket.title}`
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color:#0d3568;">Your IT ticket has an update</h2>
      <p><b>Ticket:</b> ${ticketUrl(ticket)} &mdash; ${ticket.title}</p>
      <p><b>${authorName}</b> replied:</p>
      <div style="background:#f1f5f9;border-radius:8px;padding:14px;margin:10px 0;">
        ${(replyBody || '').replace(/\n/g, '<br/>')}
      </div>
      <p><b>Status:</b> ${ticket.status}</p>
      <p style="margin-top:24px;color:#64748b;font-size:12px;">This is an automated notification from your IT Helpdesk. Reply directly to the person who helped you if you have follow-up questions.</p>
    </div>`
  return { subject, html }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY is not set on this function.' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload = await req.json()
    const to = Array.isArray(payload.to) ? payload.to : [payload.to]

    let built
    if (payload.type === 'new_ticket') built = newTicketEmail(payload)
    else if (payload.type === 'ticket_reply') built = replyEmail(payload)
    else built = { subject: payload.subject || 'Helpdesk notification', html: '<p>(no content)</p>' }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to,
        subject: built.subject,
        html: built.html,
      }),
    })

    const result = await resendRes.json()
    if (!resendRes.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: resendRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})