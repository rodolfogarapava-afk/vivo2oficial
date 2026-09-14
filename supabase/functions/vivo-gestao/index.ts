import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const API = 'https://vivogestao.vivoempresas.com.br/Portal/api'
const BASE = `${API}/datapackcompanyinfo`

const ENDPOINTS: Record<string, string> = {
  companyinfo: `${API}/datapackcompanyinfo`,
  consumption: `${API}/datapackconsumption`,
  voiceconsumption: `${API}/voiceconsumption`,
  managergroup: `${API}/datapackmanagergroup`,
  blockgroup: `${API}/datapackblockgroup`,
  packages: `${API}/datapackpackages`,
  consumption5G: `${API}/datapackconsumption5G`,
  vivosync: `${API}/datapackvivosync`,
}

const ALLOWED_ACTIONS = new Set([
  'login',
  'welcome',
  'listLines',
  'listGroups',
  'loadingLines',
  'getAbbreviatedData',
  'loadView',
  'probe',
  'listLines',
  'loadViewVivoSync',
  'loadLinesVivoSync',
  'loadViewBlockVoice',
  'loadLinesBlockVoice',
  'listGroups',
  'getLines',
  'lines',
  'listClients',
  'consultaLinhas',
  'linhas',
])

function collectCookies(res: Response, jar: Record<string, string>) {
  const raw = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? []
  for (const c of raw) {
    const [pair] = c.split(';')
    const idx = pair.indexOf('=')
    if (idx > 0) jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
  }
}

function cookieHeader(jar: Record<string, string>) {
  return Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ')
}

async function get(url: string, jar: Record<string, string>) {
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Referer': 'https://vivogestao.vivoempresas.com.br/Portal/data/',
      Cookie: cookieHeader(jar),
    },
  })
  collectCookies(res, jar)
  const text = await res.text()
  let json: unknown = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, json, text: text.slice(0, 6000) }
}

async function call(action: string, body: Record<string, unknown>, jar: Record<string, string>, url: string = BASE) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      'Origin': 'https://vivogestao.vivoempresas.com.br',
      'Referer': 'https://vivogestao.vivoempresas.com.br/Portal/data/login',
      ...(Object.keys(jar).length ? { Cookie: cookieHeader(jar) } : {}),
    },
    body: JSON.stringify({ ...body, action }),
  })
  collectCookies(res, jar)
  const text = await res.text()
  let json: unknown = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, json, text: text.slice(0, 4000) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const user = Deno.env.get('VIVO_GESTAO_USER')
    const password = Deno.env.get('VIVO_GESTAO_PASSWORD')
    if (!user || !password) {
      return new Response(JSON.stringify({ error: 'Credenciais do Vivo Gestao nao configuradas' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let payload: { action?: string; endpoint?: string; method?: string; extra?: Record<string, unknown> } = {}
    if (req.method === 'POST') {
      try { payload = await req.json() } catch { payload = {} }
    }
    const action = payload.action ?? 'login'
    if (!ALLOWED_ACTIONS.has(action)) {
      return new Response(JSON.stringify({ error: `acao nao permitida: ${action}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jar: Record<string, string> = {}
    // establish a session cookie first (some flows bind the session to the initial JSESSIONID)
    const boot = await fetch('https://vivogestao.vivoempresas.com.br/Portal/data/login', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
    })
    collectCookies(boot, jar)
    await boot.body?.cancel()

    const login = await call('login', { user, password }, jar)
    const welcome = await call('welcome', {}, jar)

    const result: Record<string, unknown> = {
      login: { status: login.status, body: login.json ?? login.text },
      welcome: { status: welcome.status, body: welcome.json ?? welcome.text },
      cookies: Object.keys(jar),
    }

    if (action === 'probe') {
      const out: Array<Record<string, unknown>> = []
      const gv = await call('loadViewBlockVoice', { startRow: 1, fetchSize: 10 }, jar, ENDPOINTS.blockgroup)
      const groups = (gv.json as { groups?: Array<Record<string, unknown>> } | null)?.groups ?? []
      const raio = groups.find((g) => String(g.name).toUpperCase() === 'RAIO') ?? groups[0]
      const attempts: Array<[string, string, Record<string, unknown>]> = [
        ['blockgroup', 'loadLinesBlockVoice', { group: raio, startRow: 1, fetchSize: 10, filter: 'all_lines' }],
        ['blockgroup', 'listLines', { group: raio, startRow: 1, fetchSize: 10, filter: 'all_lines' }],
        ['blockgroup', 'listLines', { groupId: (raio as { id: number }).id, startRow: 1, fetchSize: 10, filter: 'all_lines' }],
        ['voiceconsumption', 'listLines', { group: raio, startRow: 1, fetchSize: 10 }],
        ['voiceconsumption', 'loadingLines', { group: raio, startRow: 1, fetchSize: 10, hasOverBalanceMonetaryVoice: true, hasHibridService: false, lineTypeFilter: 'T' }],
      ]
      for (const [ep, act, body] of attempts) {
        const r = await call(act, body, jar, ENDPOINTS[ep])
        out.push({ ep, act, status: r.status, preview: JSON.stringify(r.json ?? r.text).slice(0, 900) })
      }
      result.probes = out
    } else if (action !== 'login') {
      const base = ENDPOINTS[payload.endpoint ?? 'consumption'] ?? BASE
      let next
      if ((payload.method ?? 'POST').toUpperCase() === 'GET') {
        const qs = new URLSearchParams({ action })
        for (const [k, v] of Object.entries(payload.extra ?? {})) qs.set(k, String(v))
        next = await get(`${base}?${qs.toString()}`, jar)
      } else {
        next = await call(action, payload.extra ?? {}, jar, base)
      }
      result.data = { status: next.status, body: next.json ?? next.text }
      const after = await call('welcome', {}, jar)
      result.sessionStillValid = after.status === 200
    }


    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
