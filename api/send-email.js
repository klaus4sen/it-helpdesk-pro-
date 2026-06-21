// api/send-email.js
// Vercel serverless function — replaces the old Supabase "send-email" edge
// function. Sends mail via Outlook SMTP using Nodemailer instead of Resend.

import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false, // STARTTLS
  auth: {
    user: process.env.SMTP_USER, // your full Outlook email address
    pass: process.env.SMTP_PASS, // your Outlook app password
  },
})

const FROM_ADDRESS = process.env.EMAIL_FROM || process.env.SMTP_USER

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({ error: 'SMTP_USER / SMTP_PASS are not set on this deployment.' })
    }

    const payload = req.body
    const to = Array.isArray(payload.to) ? payload.to : [payload.to]

    let built
    if (payload.type === 'new_ticket') built = newTicketEmail(payload)
    else if (payload.type === 'ticket_reply') built = replyEmail(payload)
    else built = { subject: payload.subject || 'Helpdesk notification', html: '<p>(no content)</p>' }

    const info = await transporter.sendMail({
      from: FROM_ADDRESS,
      to: to.join(','),
      subject: built.subject,
      html: built.html,
    })

    return res.status(200).json({ ok: true, result: info.messageId })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: e.message || String(e) })
  }
}
