import type { Board, Element, Point, HistoryBoardSnapshot, ImageElement } from '@/types'
const dbName = 'BananaPodDB'
const dbVersion = 2
let dbPromise: Promise<IDBDatabase> | null = null
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
async function sha256Hex(ab: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', ab)
  const bytes = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0')
  return hex
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
  const hash = await sha256Hex(ab)
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('images', 'readwrite')
    const store = tx.objectStore('images')
    const getReq = store.get(hash)
    getReq.onsuccess = () => {
      if (!getReq.result) store.put({ hash, blob, mimeType: blob.type, size: ab.byteLength, savedAt: Date.now() })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
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
      resolve(rec.blob as Blob)
    }
    req.onerror = () => reject(req.error)
  })
}

async function slimElement(el: Element): Promise<Element> {
  if ((el as ImageElement).type === 'image') {
    const img = el as ImageElement
    let href = img.href
    if (!href.startsWith('image:')) {
      const blob = await hrefToBlob(href, img.mimeType)
      const hash = await putImageBlob(blob)
      href = `image:${hash}`
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

async function inflateElement(el: Element): Promise<Element> {
  if ((el as ImageElement).type === 'image') {
    const img = el as ImageElement
    if (img.href.startsWith('image:')) {
      const hash = img.href.slice('image:'.length)
      const blob = await getImageBlob(hash)
      if (blob) {
        const url = URL.createObjectURL(blob)
        return { ...img, href: url, mimeType: blob.type || img.mimeType }
      }
    }
  }
  return el
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
  const db = await openDB()
  const raw = await new Promise<any>((resolve, reject) => {
    const tx = db.transaction('lastSession', 'readonly')
    const store = tx.objectStore('lastSession')
    const req = store.get('data')
    req.onsuccess = () => {
      const data = req.result
      if (data) { resolve(data); return }
      const req2 = store.get('data-json')
      req2.onsuccess = () => {
        const j = req2.result
        if (!j) { resolve(null); return }
        try { resolve(JSON.parse(j as string)) } catch { resolve(null) }
      }
      req2.onerror = () => reject(req2.error)
    }
    req.onerror = () => reject(req.error)
  })
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
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('history', 'readwrite')
    const store = tx.objectStore('history')
    store.put(snapshot)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
export async function getHistoryBoards(): Promise<HistoryBoardSnapshot[]> {
  const db = await openDB()
  const raw = await new Promise<any[]>((resolve, reject) => {
    const tx = db.transaction('history', 'readonly')
    const store = tx.objectStore('history')
    const req = store.getAll()
    req.onsuccess = () => resolve((req.result || []) as any[])
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