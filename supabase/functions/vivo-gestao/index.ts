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

type PanelLine = {
  group: string
  groupId: number | null
  name: string
  phone: string
  blocked: boolean
  raw?: Record<string, unknown>
}

async function fetchAllLines(jar: Record<string, string>, includeRaw = false) {
  const gv = await call('loadViewBlockVoice', { startRow: 1, fetchSize: 10 }, jar, ENDPOINTS.blockgroup)
  const groups = (gv.json as { groups?: Array<{ id: number; name: string; totalLines: number }> } | null)?.groups ?? []
  const all: PanelLine[] = []
  for (const g of groups) {
    const pageSize = 10
    const pages = Math.max(1, Math.ceil((g.totalLines || 0) / pageSize))
    for (let page = 1; page <= pages; page++) {
      const startRow = (page - 1) * pageSize + 1
      const r = await call('listLines', { groupId: g.id, startRow, fetchSize: pageSize, filter: 'all_lines' }, jar, ENDPOINTS.blockgroup)
      const rows = Array.isArray(r.json) ? r.json as Array<Record<string, unknown>> : []
      if (!rows.length) break
      for (const row of rows) {
        all.push({
          group: g.name,
          groupId: g.id ?? null,
          name: String(row.userName ?? '').trim(),
          phone: String(row.lineNumber ?? '').replace(/\D/g, ''),
          blocked: Boolean(row.blocked || row.blockedManager),
          ...(includeRaw ? { raw: row } : {}),
        })
      }
    }
  }
  return { groups: groups.map((g) => ({ id: g.id, name: g.name, totalLines: g.totalLines })), lines: all }
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

    let payload: {
      action?: string
      endpoint?: string
      method?: string
      extra?: Record<string, unknown>
      verbose?: boolean
    } = {}
    if (req.method === 'POST') {
      try { payload = await req.json() } catch { payload = {} }
    }
    const action = payload.action ?? 'sync'
    if (!/^[A-Za-z0-9_]{1,40}$/.test(action)) {
      return new Response(JSON.stringify({ error: 'acao invalida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const jar: Record<string, string> = {}
    const boot = await fetch('https://vivogestao.vivoempresas.com.br/Portal/data/login', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' },
    })
    collectCookies(boot, jar)
    await boot.body?.cancel()

    const login = await call('login', { user, password }, jar)
    const welcome = await call('welcome', {}, jar)

    const result: Record<string, unknown> = {}
    if (payload.verbose || action === 'login' || action === 'probe') {
      result.login = { status: login.status, body: login.json ?? login.text }
      result.welcome = { status: welcome.status, body: welcome.json ?? welcome.text }
      result.cookies = Object.keys(jar)
    }

    if (action === 'sync' || action === 'lines' || action === 'listLines') {
      const { groups, lines } = await fetchAllLines(jar, Boolean(payload.verbose))
      result.groups = groups
      result.lines = lines
      result.total = lines.length
    } else if (action === 'probe') {
      const base = ENDPOINTS[payload.endpoint ?? 'consumption'] ?? BASE
      const probeAction = String(payload.extra?.probeAction ?? 'loadView')
      const extra = { ...(payload.extra ?? {}) }
      delete extra.probeAction
      let next
      if ((payload.method ?? 'POST').toUpperCase() === 'GET') {
        const qs = new URLSearchParams({ action: probeAction })
        for (const [k, v] of Object.entries(extra)) qs.set(k, String(v))
        next = await get(`${base}?${qs.toString()}`, jar)
      } else {
        next = await call(probeAction, extra, jar, base)
      }
      result.data = { status: next.status, body: next.json ?? next.text }
      const after = await call('welcome', {}, jar)
      result.sessionStillValid = after.status === 200
    } else if (action !== 'login') {
      const base = ENDPOINTS[payload.endpoint ?? 'consumption'] ?? BASE
      const next = await call(action, payload.extra ?? {}, jar, base)
      result.data = { status: next.status, body: next.json ?? next.text }
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
