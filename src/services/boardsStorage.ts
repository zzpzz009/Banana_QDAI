import type { Board, Element, Point, HistoryBoardSnapshot, ImageElement } from '@/types'
const dbName = 'BananaPodDB'
const dbVersion = 3
let dbPromise: Promise<IDBDatabase> | null = null
function remoteEnabled(): boolean {
  try { return typeof window !== 'undefined' && (localStorage.getItem('BANANAPOD_REMOTE_HISTORY') === 'true'); } catch { return false }
}
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('lastSession')) db.createObjectStore('lastSession')
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'savedAt' })
      if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'hash' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}
function sha256HexFallback(ab: ArrayBuffer): string {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ])
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])
  const bytes = new Uint8Array(ab)
  const bitLen = bytes.length * 8
  const withOne = new Uint8Array(bytes.length + 1)
  withOne.set(bytes)
  withOne[bytes.length] = 0x80
  let padLen = (64 - ((withOne.length + 8) % 64)) % 64
  const padded = new Uint8Array(withOne.length + padLen + 8)
  padded.set(withOne)
  const dv = new DataView(padded.buffer)
  const hi = Math.floor(bitLen / 0x100000000)
  const lo = bitLen >>> 0
  dv.setUint32(padded.length - 8, hi)
  dv.setUint32(padded.length - 4, lo)
  const w = new Uint32Array(64)
  for (let i = 0; i < padded.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (
        (padded[i + t * 4] << 24) |
        (padded[i + t * 4 + 1] << 16) |
        (padded[i + t * 4 + 2] << 8) |
        (padded[i + t * 4 + 3])
      ) >>> 0
    }
    for (let t = 16; t < 64; t++) {
      const s0 = ((w[t - 15] >>> 7) | (w[t - 15] << (32 - 7))) ^ ((w[t - 15] >>> 18) | (w[t - 15] << (32 - 18))) ^ (w[t - 15] >>> 3)
      const s1 = ((w[t - 2] >>> 17) | (w[t - 2] << (32 - 17))) ^ ((w[t - 2] >>> 19) | (w[t - 2] << (32 - 19))) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7]
    for (let t = 0; t < 64; t++) {
      const S1 = ((e >>> 6) | (e << (32 - 6))) ^ ((e >>> 11) | (e << (32 - 11))) ^ ((e >>> 25) | (e << (32 - 25)))
      const ch = (e & f) ^ (~e & g)
      const temp1 = (h + S1 + ch + K[t] + w[t]) >>> 0
      const S0 = ((a >>> 2) | (a << (32 - 2))) ^ ((a >>> 13) | (a << (32 - 13))) ^ ((a >>> 22) | (a << (32 - 22)))
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) >>> 0
      h = g
      g = f
      f = e
      e = (d + temp1) >>> 0
      d = c
      c = b
      b = a
      a = (temp1 + temp2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0
    H[1] = (H[1] + b) >>> 0
    H[2] = (H[2] + c) >>> 0
    H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0
    H[5] = (H[5] + f) >>> 0
    H[6] = (H[6] + g) >>> 0
    H[7] = (H[7] + h) >>> 0
  }
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += H[i].toString(16).padStart(8, '0')
  }
  return out
}
async function sha256Hex(ab: ArrayBuffer): Promise<string> {
  try {
    const subtle = (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) ? globalThis.crypto.subtle : null
    if (subtle && typeof subtle.digest === 'function') {
      const digest = await subtle.digest('SHA-256', ab)
      const bytes = new Uint8Array(digest)
      let hex = ''
      for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
      return hex
    }
  } catch (err) { void err }
  return sha256HexFallback(ab)
}

async function hrefToBlob(href: string, expectedMime?: string): Promise<Blob> {
  if (href.startsWith('data:')) {
    const comma = href.indexOf(',')
    const meta = href.substring(0, comma)
    const b64 = href.substring(comma + 1)
    const mimeMatch = /data:(.*?)(;base64)?$/i.exec(meta)
    const mime = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : (expectedMime || 'application/octet-stream')
    const bin = atob(b64)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    return new Blob([arr.buffer], { type: mime })
  }
  const res = await fetch(href)
  const blob = await res.blob()
  if (expectedMime && blob.type && expectedMime !== blob.type) return new Blob([await blob.arrayBuffer()], { type: expectedMime })
  return blob
}

async function putImageBlob(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer()
  let hash: string
  try {
    hash = await sha256Hex(ab)
  } catch {
    const bytes = new Uint8Array(ab)
    let h1 = 0x811c9dc5 >>> 0
    let h2 = 0xdeadbeef >>> 0
    for (let i = 0; i < bytes.length; i++) {
      h1 = (((h1 ^ bytes[i]) * 0x1000193) >>> 0)
      h2 = (((h2 << 5) ^ bytes[i] ^ (h2 >>> 2)) >>> 0)
    }
    hash = (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
  }
  const size = ab.byteLength
  const db = await openDB()
  const tryStore = async (record: Record<string, unknown>): Promise<boolean> => {
    return await new Promise<boolean>((resolve) => {
      const tx = db.transaction('images', 'readwrite')
      const store = tx.objectStore('images')
      const getReq = store.get(hash)
      getReq.onsuccess = () => {
        if (!getReq.result) store.put(record)
      }
      tx.oncomplete = () => resolve(true)
      tx.onerror = () => resolve(false)
    })
  }
  const okBlob = await tryStore({ hash, blob, mimeType: blob.type, size, savedAt: Date.now() })
  if (!okBlob) {
    const dataUrl = await blobToDataUrl(new Blob([ab], { type: blob.type }))
    await tryStore({ hash, dataUrl, mimeType: blob.type, size, savedAt: Date.now() })
  }
  return hash
}

async function getImageBlob(hash: string): Promise<Blob | null> {
  const db = await openDB()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction('images', 'readonly')
    const store = tx.objectStore('images')
    const req = store.get(hash)
    req.onsuccess = () => {
      const rec = req.result
      if (!rec) { resolve(null); return }
      const r = rec as { blob?: Blob; dataUrl?: string }
      if (r.blob) { resolve(r.blob as Blob); return }
      if (r.dataUrl && typeof r.dataUrl === 'string') {
        try {
          const comma = r.dataUrl.indexOf(',')
          const meta = r.dataUrl.substring(0, comma)
          const b64 = r.dataUrl.substring(comma + 1)
          const mimeMatch = /data:(.*?);base64/.exec(meta)
          const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
          const bin = atob(b64)
          const arr = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
          resolve(new Blob([arr.buffer], { type: mime }))
          return
        } catch { resolve(null); return }
      }
      resolve(null)
    }
    req.onerror = () => reject(req.error)
  })
}

async function slimElement(el: Element): Promise<Element> {
  if ((el as ImageElement).type === 'image') {
    const img = el as ImageElement
    let href = img.href
    if (!href.startsWith('image:')) {
      try {
        const blob = await hrefToBlob(href, img.mimeType)
        const hash = await putImageBlob(blob)
        href = `image:${hash}`
      } catch {
        href = img.href
      }
    }
    const next: ImageElement = {
      id: img.id,
      type: 'image',
      x: img.x,
      y: img.y,
      href,
      width: img.width,
      height: img.height,
      mimeType: img.mimeType,
      name: img.name,
      isVisible: img.isVisible,
      isLocked: img.isLocked,
      parentId: img.parentId,
      borderRadius: img.borderRadius,
      opacity: img.opacity,
    }
    return next
  }
  return { ...el }
}


async function blobToDataUrl(blob: Blob): Promise<string> {
  const ab = await blob.arrayBuffer()
  const bytes = new Uint8Array(ab)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)
  const mime = blob.type || 'application/octet-stream'
  return `data:${mime};base64,${b64}`
}

async function inflateElementToDataUrl(el: Element): Promise<Element> {
  if ((el as ImageElement).type === 'image') {
    const img = el as ImageElement
    if (img.href.startsWith('image:')) {
      const hash = img.href.slice('image:'.length)
      const blob = await getImageBlob(hash)
      if (blob) {
        const dataUrl = await blobToDataUrl(blob)
        return { ...img, href: dataUrl, mimeType: blob.type || img.mimeType }
      }
    }
  }
  return el
}

async function slimBoardAsync(board: Board): Promise<Board> {
  const elements = board.elements.map(el => {
    return el
  })
  const resolved = await Promise.all(elements.map(slimElement))
  const slim: Board = {
    id: board.id,
    name: board.name,
    elements: resolved,
    history: [resolved],
    historyIndex: 0,
    panOffset: board.panOffset,
    zoom: board.zoom,
    canvasBackgroundColor: board.canvasBackgroundColor,
  }
  return slim
}

export async function saveLastSession(payload: { boards: Board[]; activeBoardId: string }) {
  const db = await openDB()
  const slimmed = await Promise.all(payload.boards.map(b => slimBoardAsync(b)))
  try {
    if (!remoteEnabled()) throw new Error('remote disabled')
    const headers = new Headers()
    headers.set('Accept', 'application/json')
    headers.set('Content-Type', 'application/json')
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '') : ''
      const userId = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_USER_ID') || '') : ''
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (userId) headers.set('New-API-User', userId)
    } catch (err) { void err }
    const resp = await fetch('/api/bananapod/session', { method: 'PUT', headers, body: JSON.stringify({ boards: slimmed, activeBoardId: payload.activeBoardId }) })
    if (!resp.ok) throw new Error('remote save failed')
  } catch (err) { console.warn('saveLastSession remote failed', err) }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('lastSession', 'readwrite')
    const store = tx.objectStore('lastSession')
    try {
      store.put({ timestamp: Date.now(), boards: slimmed, activeBoardId: payload.activeBoardId }, 'data')
    } catch (err) {
      console.error('saveLastSession structured clone failed:', err)
      try {
        const json = JSON.stringify({ timestamp: Date.now(), boards: slimmed, activeBoardId: payload.activeBoardId })
        store.put(json, 'data-json')
      } catch (err2) {
        return reject(err2 as Error)
      }
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
let lastSessionTimer: number | null = null
let lastSessionPending: { boards: Board[]; activeBoardId: string } | null = null
let lastSessionIdleHandle: number | null = null
export function touchLastSessionPending(payload: { boards: Board[]; activeBoardId: string }) {
  lastSessionPending = payload
  saveLastSessionDebounced(payload)
}
export function saveLastSessionDebounced(payload: { boards: Board[]; activeBoardId: string }, delay: number = 800) {
  lastSessionPending = payload
  if (lastSessionTimer != null) {
    clearTimeout(lastSessionTimer)
  }
  lastSessionTimer = setTimeout(async () => {
    const p = lastSessionPending
    lastSessionPending = null
    lastSessionTimer = null
    if (!p) return
    await saveLastSession(p)
  }, delay) as unknown as number

  const ric = window.requestIdleCallback
  if (ric && lastSessionIdleHandle == null) {
    lastSessionIdleHandle = ric(async () => {
      lastSessionIdleHandle = null
      const p = lastSessionPending
      lastSessionPending = null
      if (!p) return
      await saveLastSession(p)
    }, { timeout: 2000 })
  }
}
export async function flushLastSessionSave() {
  if (lastSessionTimer != null) {
    clearTimeout(lastSessionTimer)
    lastSessionTimer = null
  }
  const cic = window.cancelIdleCallback
  if (cic && lastSessionIdleHandle != null) {
    cic(lastSessionIdleHandle)
    lastSessionIdleHandle = null
  }
  if (lastSessionPending) {
    const p = lastSessionPending
    lastSessionPending = null
    await saveLastSession(p)
  }
}
export async function loadLastSession(): Promise<{ boards: Board[]; activeBoardId: string; timestamp: number } | null> {
  try {
    if (!remoteEnabled()) throw new Error('remote disabled')
    const headers = new Headers()
    headers.set('Accept', 'application/json')
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '') : ''
      const userId = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_USER_ID') || '') : ''
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (userId) headers.set('New-API-User', userId)
    } catch (err) { void err }
    const resp = await fetch('/api/bananapod/session', { method: 'GET', headers })
    if (resp.ok) {
      const obj = await resp.json() as { boards: Board[]; activeBoardId: string; timestamp: number }
      const boards: Board[] = await Promise.all((obj.boards || []).map(async (b: Board) => {
        const inflatedEls = await Promise.all((b.elements || []).map(inflateElementToDataUrl))
        return { ...b, elements: inflatedEls, history: [inflatedEls], historyIndex: 0 }
      }))
      return { boards, activeBoardId: obj.activeBoardId, timestamp: obj.timestamp || Date.now() }
    }
  } catch (err) { console.warn('loadLastSession remote failed', err) }
  let raw: { boards: Board[]; activeBoardId: string; timestamp: number } | null = null
  try {
    const db = await openDB()
    raw = await new Promise<{ boards: Board[]; activeBoardId: string; timestamp: number } | null>((resolve, reject) => {
      const tx = db.transaction('lastSession', 'readonly')
      const store = tx.objectStore('lastSession')
      const req = store.get('data')
      req.onsuccess = () => {
        const data = req.result
        if (data) { resolve(data as { boards: Board[]; activeBoardId: string; timestamp: number }); return }
        const req2 = store.get('data-json')
        req2.onsuccess = () => {
          const j = req2.result
          if (!j) { resolve(null); return }
          try { resolve(JSON.parse(j as string) as { boards: Board[]; activeBoardId: string; timestamp: number }) } catch { resolve(null) }
        }
        req2.onerror = () => reject(req2.error)
      }
      req.onerror = () => reject(req.error)
    })
  } catch (err) {
    try {
      const name = (err && (err as { name?: string }).name) || ''
      if (String(name).includes('UnknownError')) {
        await new Promise<void>((resolve) => {
          const delReq = indexedDB.deleteDatabase(dbName)
          delReq.onsuccess = () => resolve()
          delReq.onerror = () => resolve()
          delReq.onblocked = () => resolve()
        })
      }
    } catch (e) { void e }
    raw = null
  }
  if (!raw) return null
  const boards: Board[] = await Promise.all((raw.boards || []).map(async (b: Board) => {
    const inflatedEls = await Promise.all((b.elements || []).map(inflateElementToDataUrl))
    return { ...b, elements: inflatedEls, history: [inflatedEls], historyIndex: 0 }
  }))
  return { boards, activeBoardId: raw.activeBoardId, timestamp: raw.timestamp }
}
export async function pushHistoryBoard(board: Board) {
  const db = await openDB()
  const elementsSlim = await Promise.all(board.elements.map(slimElement))
  const snapshot: {
    id: string
    name: string
    elements: Element[]
    panOffset: Point
    zoom: number
    canvasBackgroundColor: string
    savedAt: number
    thumbnail?: string
  } = {
    id: board.id,
    name: board.name,
    elements: elementsSlim,
    panOffset: board.panOffset,
    zoom: board.zoom,
    canvasBackgroundColor: board.canvasBackgroundColor,
    savedAt: Date.now()
  }
  try {
    if (!remoteEnabled()) throw new Error('remote disabled')
    const headers = new Headers()
    headers.set('Accept', 'application/json')
    headers.set('Content-Type', 'application/json')
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '') : ''
      const userId = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_USER_ID') || '') : ''
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (userId) headers.set('New-API-User', userId)
    } catch (err) { void err }
    await fetch('/api/bananapod/history', { method: 'POST', headers, body: JSON.stringify(snapshot) })
  } catch (err) { console.warn('pushHistoryBoard remote failed', err) }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite')
    const store = tx.objectStore('history')
    const req = store.getAll()
    req.onsuccess = () => {
      const all = (req.result || []) as HistoryBoardSnapshot[]
      for (const rec of all) {
        if (rec && rec.id === board.id && rec.savedAt != null) {
          store.delete(rec.savedAt)
        }
      }
      store.put(snapshot)
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
export async function getHistoryBoards(): Promise<HistoryBoardSnapshot[]> {
  try {
    if (!remoteEnabled()) throw new Error('remote disabled')
    const headers = new Headers()
    headers.set('Accept', 'application/json')
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '') : ''
      const userId = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_USER_ID') || '') : ''
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (userId) headers.set('New-API-User', userId)
    } catch (err) { void err }
    const resp = await fetch('/api/bananapod/history', { method: 'GET', headers })
    if (resp.ok) {
      const rawRemote = await resp.json() as HistoryBoardSnapshot[]
      const sortedRemote = rawRemote.sort((a: HistoryBoardSnapshot, b: HistoryBoardSnapshot) => b.savedAt - a.savedAt)
      const inflatedRemote = await Promise.all(sortedRemote.map(async (rec: HistoryBoardSnapshot) => {
        const els = await Promise.all((rec.elements || []).map(inflateElementToDataUrl))
        return { ...rec, elements: els }
      }))
      return inflatedRemote as HistoryBoardSnapshot[]
    }
  } catch (err) { console.warn('getHistoryBoards remote failed', err) }
  const db = await openDB()
  const raw = await new Promise<HistoryBoardSnapshot[]>((resolve, reject) => {
    const tx = db.transaction('history', 'readonly')
    const store = tx.objectStore('history')
    const req = store.getAll()
    req.onsuccess = () => resolve((req.result || []) as HistoryBoardSnapshot[])
    req.onerror = () => reject(req.error)
  })
  const sorted = raw.sort((a: HistoryBoardSnapshot, b: HistoryBoardSnapshot) => b.savedAt - a.savedAt)
  const inflated = await Promise.all(sorted.map(async (rec: HistoryBoardSnapshot) => {
    const els = await Promise.all((rec.elements || []).map(inflateElementToDataUrl))
    return { ...rec, elements: els }
  }))
  return inflated as HistoryBoardSnapshot[]
}
export async function updateHistoryThumbnail(savedAt: number, thumbnail: string) {
  const db = await openDB()
  try {
    if (!remoteEnabled()) throw new Error('remote disabled')
    const headers = new Headers()
    headers.set('Accept', 'application/json')
    headers.set('Content-Type', 'application/json')
    try {
      const token = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_SYSTEM_TOKEN') || '') : ''
      const userId = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_USER_ID') || '') : ''
      if (token) headers.set('Authorization', `Bearer ${token}`)
      if (userId) headers.set('New-API-User', userId)
    } catch (err) { void err }
    await fetch(`/api/bananapod/history/${savedAt}`, { method: 'PATCH', headers, body: JSON.stringify({ thumbnail }) })
  } catch (err) { console.warn('updateHistoryThumbnail remote failed', err) }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite')
    const store = tx.objectStore('history')
    const getReq = store.get(savedAt)
    getReq.onsuccess = () => {
      const rec = getReq.result
      if (!rec) { resolve(); return }
      rec.thumbnail = thumbnail
      store.put(rec)
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
export async function pruneHistory(max: number = 5) {
  const db = await openDB()
  const all = await getHistoryBoards()
  const toDelete = all.slice(max)
  if (toDelete.length === 0) return
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite')
    const store = tx.objectStore('history')
    toDelete.forEach(item => store.delete(item.savedAt))
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
