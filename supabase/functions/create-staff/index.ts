import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const MAX_STAFF_SEATS = 11

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') || ''
    const callerToken = authHeader.replace('Bearer ', '')

    const callerClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY'), {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: callerUser, error: callerErr } = await callerClient.auth.getUser(callerToken)
    if (callerErr || !callerUser?.user) {
      return json({ error: 'Not signed in.' }, 401)
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', callerUser.user.id).maybeSingle()
    if (!callerProfile || callerProfile.role !== 'Admin') {
      return json({ error: 'Only Admins can create staff accounts.' }, 403)
    }

    const { count } = await admin.from('profiles').select('*', { count: 'exact', head: true })
    if ((count || 0) >= MAX_STAFF_SEATS) {
      return json({ error: `Seat limit reached — your plan allows ${MAX_STAFF_SEATS} accounts total.` }, 400)
    }

    const { name, email, password, role } = await req.json()
    if (!name || !email || !password) return json({ error: 'Name, email, and password are required.' }, 400)
    if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (createErr) return json({ error: createErr.message }, 400)

    const { error: profileErr } = await admin.from('profiles').insert({
      id: created.user.id, name, email, role: role === 'Admin' ? 'Admin' : 'Agent', active: true,
    })
    if (profileErr) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: profileErr.message }, 400)
    }

    return json({ ok: true, id: created.user.id })
  } catch (e) {
    return json({ error: e.message || String(e) }, 500)
  }
})

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}