import { createClient } from 'npm:@supabase/supabase-js@2'
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

const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '')

const normalizeLabel = (value: unknown) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/\b(PAINEL|TELECOM|REVENDA)\b/g, '')
  .replace(/[^A-Z0-9]/g, '')

const displayName = (value: unknown) => {
  const clean = String(value ?? '').trim().replace(/\s+/g, ' ')
  if (!clean) return 'LIVRE'
  const lowerWords = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])
  return clean.toLocaleLowerCase('pt-BR').split(' ').map((word, index) => {
    if (index > 0 && lowerWords.has(word)) return word
    return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
  }).join(' ')
}

const quotaFromRaw = (raw?: Record<string, unknown>) => {
  if (!raw) return 0
  const candidates = ['dataGb', 'dataGB', 'quotaGb', 'quotaGB', 'packageGb', 'packageSizeGb', 'franchiseGb']
  for (const key of candidates) {
    const value = Number(String(raw[key] ?? '').replace(',', '.'))
    if (Number.isFinite(value) && value > 0) return value
  }
  return 0
}

const dataValue = (value: unknown) => {
  if (!value || typeof value !== 'object') return 0
  const raw = (value as Record<string, unknown>).value
  const parsed = Number(String(raw ?? '').replace(',', '.'))
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

type ConsumptionLine = {
  phone: string
  usedGb: number
  quotaGb: number
  percentage: number
}

async function fetchConsumptionLines(jar: Record<string, string>) {
  const response = await call('loadView', { startRow: 1, fetchSize: 1000 }, jar, ENDPOINTS.consumption)
  const body = response.json as { groupList?: Array<Record<string, unknown>> } | null
  const groups = Array.isArray(body?.groupList) ? body.groupList : []
  const lines: ConsumptionLine[] = []

  for (const group of groups) {
    const rows = Array.isArray(group.lines) ? group.lines as Array<Record<string, unknown>> : []
    for (const row of rows) {
      const phone = digits(row.lineNumber)
      if (phone.length < 10) continue
      const usedGb = dataValue(row.quotaConsumption)
      const individualQuota = dataValue(row.quota) || dataValue(row.limitIndividual) || dataValue(row.limit)
      const percentageText = String(row.percentageConsumedQuotaIndividual ?? row.percentageConsumedQuota ?? '0')
      const percentage = Math.min(100, Math.max(0, Number(percentageText.replace('%', '').replace(',', '.')) || 0))
      const calculatedQuota = usedGb > 0 && percentage > 0
        ? Math.round((usedGb * 100 / percentage) * 100) / 100
        : 0
      lines.push({ phone, usedGb, quotaGb: individualQuota || calculatedQuota, percentage })
    }
  }

  return lines
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

const isPlaceholderName = (value?: string | null) => {
  const n = String(value ?? '').trim().toLowerCase().replace(/^rev\s+/i, '')
  return !n || n.startsWith('livre') || /^\d+$/.test(n)
}
// Never overwrite a name typed in the app; only fill empty/LIVRE names with a real name from the Gestor
const shouldReplaceName = (current?: string | null, next?: string | null) =>
  isPlaceholderName(current) && !isPlaceholderName(next)

// Reseller panel clients always carry the REV prefix
const revName = (value: unknown, isPartner: boolean) => {
  const base = displayName(value)
  if (!isPartner) return base
  if (base.toUpperCase().startsWith('REV')) return base
  return `REV ${base}`
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

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const backend = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const { data: authData } = token ? await backend.auth.getUser(token) : { data: { user: null } }
    const appUser = authData.user
    if (!appUser) {
      return new Response(JSON.stringify({ error: 'NOT_AUTHENTICATED' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: adminRole } = await backend.from('user_roles')
      .select('id').eq('user_id', appUser.id).eq('role', 'admin').maybeSingle()
    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'NOT_ALLOWED' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    if (action === 'sync' || action === 'lines' || action === 'listLines' || action === 'auto_sync') {
      // The Vivo portal keeps the active screen in the session. Consumption must be
      // loaded before visiting the voice/block screen used to enumerate every line.
      const consumptionLines = action === 'auto_sync' ? await fetchConsumptionLines(jar) : []
      const { groups, lines } = await fetchAllLines(jar, Boolean(payload.verbose) || action === 'auto_sync')
      result.groups = groups
      result.lines = lines.map(({ raw: _raw, ...line }) => line)
      result.total = lines.length
      if (action === 'auto_sync') {
        const consumptionByPhone = new Map(consumptionLines.map((line) => [line.phone, line]))
        result.consumption = consumptionLines
        const { data: links, error: linksError } = await backend.from('panel_links')
          .select('owner_user_id, partner_user_id, partner_label')
          .or(`owner_user_id.eq.${appUser.id},partner_user_id.eq.${appUser.id}`)
        if (linksError) throw linksError

        const targetIds = new Set<string>([appUser.id])
        for (const link of links ?? []) {
          targetIds.add(link.owner_user_id === appUser.id ? link.partner_user_id : link.owner_user_id)
        }
        const { data: names, error: namesError } = await backend.from('panel_names')
          .select('user_id, label').in('user_id', [...targetIds])
        if (namesError) throw namesError

        const targets = [...targetIds].map((userId) => {
          const saved = (names ?? []).find((item) => item.user_id === userId)?.label
          const linked = (links ?? []).find((item) => item.partner_user_id === userId || item.owner_user_id === userId)
          const fallback = userId === appUser.id ? 'RAIO' : linked?.partner_label ?? ''
          return { userId, label: saved || fallback }
        })
        const targetForGroup = (group: string) => {
          const normalizedGroup = normalizeLabel(group)
          return targets.find((target) => {
            const normalizedTarget = normalizeLabel(target.label)
            return normalizedGroup && normalizedTarget && (
              normalizedGroup === normalizedTarget ||
              normalizedGroup.includes(normalizedTarget) ||
              normalizedTarget.includes(normalizedGroup)
            )
          })
        }

        const { data: existing, error: clientsError } = await backend.from('clients')
          .select('id, user_id, phone, name, blocked, data_gb, data_used_gb').in('user_id', [...targetIds])
        if (clientsError) throw clientsError
        const byTargetPhone = new Map((existing ?? []).map((client) => [`${client.user_id}:${digits(client.phone)}`, client]))
        const knownPhoneOwners = new Map((existing ?? []).map((client) => [digits(client.phone), client]))
        let added = 0
        let updated = 0
        let transferred = 0
        const unmatchedGroups = new Set<string>()

        for (const line of lines) {
          const phone = digits(line.phone)
          const target = targetForGroup(line.group)
          if (!target) {
            if (line.group) unmatchedGroups.add(line.group)
            continue
          }
          if (phone.length < 10) continue
          const current = byTargetPhone.get(`${target.userId}:${phone}`)
          const usage = consumptionByPhone.get(phone)
          const quota = usage?.quotaGb || quotaFromRaw(line.raw)
          if (!current) {
            const previousOwner = knownPhoneOwners.get(phone)
            if (previousOwner) {
              const nextName = revName(line.name, target.userId !== appUser.id)
              const changes: Record<string, unknown> = {
                user_id: target.userId,
                blocked: line.blocked,
              }
              if (shouldReplaceName(previousOwner.name, nextName)) changes.name = nextName
              if (quota > 0) changes.data_gb = quota
              if (usage) changes.data_used_gb = usage.usedGb

              const { data: moved, error: moveError } = await backend.from('clients')
                .update(changes)
                .eq('id', previousOwner.id)
                .in('user_id', [...targetIds])
                .select('id, user_id, phone, name, blocked, data_gb, data_used_gb')
                .single()
              if (moveError) throw moveError

              byTargetPhone.delete(`${previousOwner.user_id}:${phone}`)
              byTargetPhone.set(`${target.userId}:${phone}`, moved)
              knownPhoneOwners.set(phone, moved)
              transferred += 1
              continue
            }
            const { data: inserted, error: insertError } = await backend.from('clients').insert({
              user_id: target.userId,
              name: revName(line.name, target.userId !== appUser.id),
              phone,
              value_paid: 0,
              due_day: 10,
              blocked: line.blocked,
              data_gb: quota,
              data_used_gb: usage?.usedGb ?? 0,
              company: 'omega',
            }).select('id, user_id, phone, name, blocked, data_gb, data_used_gb').single()
            if (insertError?.code === '23505') {
              const { data: concurrent, error: concurrentError } = await backend.from('clients')
                .select('id, user_id, phone, name, blocked, data_gb, data_used_gb')
                .eq('phone', phone)
                .maybeSingle()
              if (concurrentError) throw concurrentError
              if (concurrent) {
                byTargetPhone.set(`${concurrent.user_id}:${phone}`, concurrent)
                knownPhoneOwners.set(phone, concurrent)
                continue
              }
            }
            if (insertError) throw insertError
            byTargetPhone.set(`${target.userId}:${phone}`, inserted)
            knownPhoneOwners.set(phone, inserted)
            added += 1
            continue
          }

          const nextName = revName(line.name, target.userId !== appUser.id)
          const changes: Record<string, unknown> = {}
          if (current.name !== nextName && shouldReplaceName(current.name, nextName)) changes.name = nextName
          if (Boolean(current.blocked) !== line.blocked) changes.blocked = line.blocked
          if (quota > 0 && Number(current.data_gb ?? 0) !== quota) changes.data_gb = quota
          if (usage && Number((current as Record<string, unknown>).data_used_gb ?? 0) !== usage.usedGb) changes.data_used_gb = usage.usedGb
          if (Object.keys(changes).length > 0) {
            const { error: updateError } = await backend.from('clients').update(changes).eq('id', current.id)
            if (updateError) throw updateError
            updated += 1
          }
        }
        result.sync = { added, updated, transferred, unmatchedGroups: [...unmatchedGroups] }
      }
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
