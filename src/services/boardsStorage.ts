import type { Board, Element, Point, HistoryBoardSnapshot } from '@/types'
const dbName = 'BananaPodDB'
const dbVersion = 1
let dbPromise: Promise<IDBDatabase> | null = null
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, dbVersion)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('lastSession')) db.createObjectStore('lastSession')
      if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { keyPath: 'savedAt' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}
export async function saveLastSession(payload: { boards: Board[]; activeBoardId: string }) {
  const db = await openDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('lastSession', 'readwrite')
    const store = tx.objectStore('lastSession')
    store.put({ timestamp: Date.now(), boards: payload.boards, activeBoardId: payload.activeBoardId }, 'data')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}
let lastSessionTimer: number | null = null
let lastSessionPending: { boards: Board[]; activeBoardId: string } | null = null
let lastSessionIdleHandle: number | null = null
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
  return await new Promise((resolve, reject) => {
    const tx = db.transaction('lastSession', 'readonly')
    const store = tx.objectStore('lastSession')
    const req = store.get('data')
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error)
  })
}
export async function pushHistoryBoard(board: Board) {
  const db = await openDB()
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
    elements: board.elements,
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
  return await new Promise((resolve, reject) => {
    const tx = db.transaction('history', 'readonly')
    const store = tx.objectStore('history')
    const req = store.getAll()
    req.onsuccess = () => {
      const list = (req.result || []).sort((a: HistoryBoardSnapshot, b: HistoryBoardSnapshot) => b.savedAt - a.savedAt)
      resolve(list as HistoryBoardSnapshot[])
    }
    req.onerror = () => reject(req.error)
  })
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