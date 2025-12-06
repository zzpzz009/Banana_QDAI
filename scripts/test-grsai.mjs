const BASE = process.env.GRSAI_BASE_URL || 'https://grsai.dakka.com.cn'
const KEY = process.env.GRSAI_API_KEY || ''
const USE_PROXY = !KEY
const ORIGIN = USE_PROXY ? 'http://localhost:3001/proxy-grsai' : BASE

const headers = KEY ? { Authorization: `Bearer ${KEY}`, Accept: 'application/json' } : { Accept: 'application/json' }

async function postJson(path, body) {
  const r = await fetch(`${ORIGIN}${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json', 'Accept-Language': 'en;q=0.8,zh;q=0.7' }, body: JSON.stringify(body) })
  const ct = r.headers.get('content-type') || ''
  const text = await r.text()
  if (!ct.includes('application/json')) throw new Error(`HTTP ${r.status} ${ct} ${text.slice(0,200)}`)
  return JSON.parse(text)
}

async function fetchImage(url) {
  const r = await fetch(url)
  const ct = r.headers.get('content-type') || ''
  const blob = await r.blob()
  return { ok: ct.startsWith('image/'), size: blob.size, mime: blob.type || ct }
}

async function main() {
  console.log('base', ORIGIN, 'useProxy', USE_PROXY, 'hasKey', Boolean(KEY))
  const gen1 = await postJson('/v1/draw/nano-banana', { model: 'nano-banana', prompt: 'a banana on a desk', aspectRatio: '3:4', webHook: '-1' })
  console.log('resp1', { keys: Object.keys(gen1 || {}), code: gen1?.code, status: gen1?.status, error: gen1?.error, hasResults: Array.isArray(gen1?.results) })
  let item1 = Array.isArray(gen1?.results) ? gen1.results[0] : undefined
  const taskId = String((gen1 && (gen1.id || gen1.task_id)) || '')
  if (!item1 && taskId) {
    for (let i = 0; i < 8; i++) {
      const res = await postJson('/v1/draw/result', { id: taskId })
      console.log('poll', { code: res?.code, status: res?.data?.status, progress: res?.data?.progress, error: res?.error, hasResults: Array.isArray(res?.data?.results) })
      if (res && res.code === 0 && res.data && Array.isArray(res.data.results) && res.data.results.length > 0) { item1 = res.data.results[0]; break }
      await new Promise(resolve => setTimeout(resolve, 1200))
    }
  }
  const chk1 = item1 && item1.url ? await fetchImage(String(item1.url)) : null
  console.log('draw:nano-banana', { url: item1 && item1.url, ok: chk1 && chk1.ok, mime: chk1 && chk1.mime, size: chk1 && chk1.size })
}

main().catch(e => { console.error('test failed', String(e && e.message || e)); process.exit(1) })
