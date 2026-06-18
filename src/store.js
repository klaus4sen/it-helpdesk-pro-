// ============================================================
//  Supabase-backed data store.
//  Every function here is async (it's a network call now).
// ============================================================
import { supabase } from './supabaseClient'

function throwIfError(error) {
  if (error) throw new Error(error.message || 'Something went wrong talking to the database.')
}

/* ---- tickets ---- */
export async function getTickets() {
  const { data, error } = await supabase.from('tickets').select('*').order('created_at', { ascending: false })
  throwIfError(error)
  return data || []
}
export async function getTicket(id) {
  const { data, error } = await supabase.from('tickets').select('*').eq('id', id).maybeSingle()
  throwIfError(error)
  return data || null
}
export async function addTicket(data) {
  const payload = {
    assigned_to: '', tags: [], sentiment: 'Calm', summary: '',
    ai_triaged: false,
    requester_type: 'Internal', requester_department: '', requester_phone: '',
    ...data,
  }
  const { data: row, error } = await supabase.functions.invoke('submit-ticket', { body: payload })
  if (error) throw new Error(error.message || 'Couldn\u2019t submit your request.')
  if (row?.error) throw new Error(row.error)
  return row
}
export async function updateTicket(id, patch) {
  const next = { ...patch, updated_at: new Date().toISOString() }
  if (patch.status) {
    const nowResolved = ['Resolved', 'Closed'].includes(patch.status)
    next.resolved_at = nowResolved ? new Date().toISOString() : null
  }
  const { data, error } = await supabase.from('tickets').update(next).eq('id', id).select().single()
  throwIfError(error)
  return data
}
export async function deleteTicket(id) {
  const { error } = await supabase.from('tickets').delete().eq('id', id)
  throwIfError(error)
}

/* ---- comments ---- */
export async function getComments(ticketId) {
  const { data, error } = await supabase.from('comments').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true })
  throwIfError(error)
  return data || []
}
export async function addComment(ticketId, author, body, internal = false) {
  const { data, error } = await supabase.from('comments')
    .insert({ ticket_id: ticketId, author, body, internal }).select().single()
  throwIfError(error)
  return data
}
export async function getAllComments() {
  const { data, error } = await supabase.from('comments').select('*')
  throwIfError(error)
  return data || []
}

/* ---- departments ---- */
export async function getDepartments() {
  const { data, error } = await supabase.from('departments').select('*').order('name')
  throwIfError(error)
  return data || []
}
export async function addDepartment(data) {
  const { data: row, error } = await supabase.from('departments').insert(data).select().single()
  throwIfError(error)
  return row
}
export async function updateDepartment(id, patch) {
  const { error } = await supabase.from('departments').update(patch).eq('id', id)
  throwIfError(error)
}
export async function deleteDepartment(id) {
  const { error } = await supabase.from('departments').delete().eq('id', id)
  throwIfError(error)
}

/* ---- staff accounts (real Supabase Auth) ---- */
export const MAX_STAFF_SEATS = 10


export async function getAgents() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at')
  throwIfError(error)
  return data || []
}
export async function staffSeatsUsed() {
  const { count, error } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  throwIfError(error)
  return count || 0
}
export async function canAddStaff() {
  const used = await staffSeatsUsed()
  return used < MAX_STAFF_SEATS + 1
}
export async function addAgent({ name, email, password, role }) {
  const { data, error } = await supabase.functions.invoke('create-staff', {
    body: { name, email, password, role },
  })
  if (error) throw new Error(error.message || 'Couldn\u2019t create that account.')
  if (data?.error) throw new Error(data.error)
  return data
}
export async function updateAgent(id, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single()
  throwIfError(error)
  return data
}
export async function deleteAgent(id) {
  const { data: profiles, error: listErr } = await supabase.from('profiles').select('*')
  throwIfError(listErr)
  const target = (profiles || []).find(a => a.id === id)
  const adminCount = (profiles || []).filter(a => a.role === 'Admin').length
  if (target && target.role === 'Admin' && adminCount <= 1) {
    throw new Error('You can\u2019t remove the only admin account.')
  }
  const { error } = await supabase.from('profiles').delete().eq('id', id)
  throwIfError(error)
}

/* ---- session (real Supabase Auth session) ---- */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('That email or password is incorrect.')
  const { data: profile, error: profileErr } = await supabase.from('profiles').select('*').eq('id', data.user.id).maybeSingle()
  if (profileErr || !profile) throw new Error('Signed in, but no staff profile was found for this account.')
  if (profile.active === false) {
    await supabase.auth.signOut()
    throw new Error('This account has been deactivated. Ask your admin to reactivate it.')
  }
  return { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
}
export async function getSession() {
  const { data } = await supabase.auth.getSession()
  if (!data?.session) return null
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle()
  if (!profile) return null
  return { id: profile.id, name: profile.name, email: profile.email, role: profile.role }
}
export async function clearSession() {
  await supabase.auth.signOut()
}