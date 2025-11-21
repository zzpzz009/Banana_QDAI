import { withRetry } from "@/utils/retry";

// whatai.cc 统一 API 配置
const WHATAI_BASE_URL = process.env.WHATAI_BASE_URL || 'https://api.whatai.cc';
const WHATAI_API_KEY = process.env.WHATAI_API_KEY;
const WHATAI_TEXT_MODEL = process.env.WHATAI_TEXT_MODEL || 'gemini-2.0-flash-exp';
function getWhataiImageModel(): string {
  try {
    const v = typeof window !== 'undefined' ? (localStorage.getItem('WHATAI_IMAGE_MODEL') || undefined) : undefined;
    return v || (process.env.WHATAI_IMAGE_MODEL as string) || 'gemini-2.5-flash-image';
  } catch {
    return (process.env.WHATAI_IMAGE_MODEL as string) || 'gemini-2.5-flash-image';
  }
}
const WHATAI_VIDEO_MODEL = process.env.WHATAI_VIDEO_MODEL || 'vidu-1';
const PROXY_VIA_VITE = (process.env.PROXY_VIA_VITE || 'true') === 'true';
// 严格尺寸校验（true 时若服务端返回尺寸与首图不一致则报错）
const WHATAI_STRICT_SIZE = (process.env.WHATAI_STRICT_SIZE || 'false') === 'true';

const IS_BROWSER = typeof window !== 'undefined';
function normalizeBase64(b64: string): string {
  let s = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad !== 0) {
    while (s.length % 4 !== 0) s += '=';
  }
  return s;
}
function stripBase64Header(input: string): string {
  const idx = input.indexOf('base64,');
  if (idx >= 0) return input.substring(idx + 7);
  return input.replace(/^data:.*?;base64,?/i, '');
}
function detectMimeFromBase64(b64: string): string {
  try {
    const bin = atob(b64.slice(0, 64));
    if (bin.length >= 4) {
      const sig = [bin.charCodeAt(0), bin.charCodeAt(1), bin.charCodeAt(2), bin.charCodeAt(3)];
      if (sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4e && sig[3] === 0x47) return 'image/png';
      if (sig[0] === 0xff && sig[1] === 0xd8 && sig[2] === 0xff) return 'image/jpeg';
      if (bin.startsWith('GIF8')) return 'image/gif';
      if (bin.startsWith('RIFF')) return 'image/webp';
    }
  } catch { void 0; }
  return 'image/png';
}

function extractDataUrlFromText(input: string): { base64: string; mime: string } | null {
  const m = input.match(/data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=_-]+)/);
  if (!m) return null;
  const mime = m[1];
  const raw = m[2];
  const b64 = normalizeBase64(raw);
  const outMime = mime.startsWith('image/') ? mime : detectMimeFromBase64(b64);
  return { base64: b64, mime: outMime };
}

function extractInlineData(part: unknown): { base64: string; mime: string } | null {
  const p = part as { inline_data?: { data?: unknown; mime_type?: unknown }; inlineData?: { data?: unknown; mimeType?: unknown } };
  const data = p?.inline_data?.data ?? p?.inlineData?.data;
  const mime = p?.inline_data?.mime_type ?? p?.inlineData?.mimeType;
  if (!data) return null;
  const b64 = normalizeBase64(stripBase64Header(String(data)));
  const outMime = (mime && String(mime).startsWith('image/')) ? String(mime) : detectMimeFromBase64(b64);
  return { base64: b64, mime: outMime };
}

function extractFirstHttpUrl(input: string): string | null {
  const s = String(input);
  const m1 = s.match(/!\[[^\]]*\]\((https?:[^)\s]+)\)/i);
  if (m1 && m1[1]) return m1[1];
  const m2 = s.match(/!\{image\}\((https?:[^)\s]+)\)/i);
  if (m2 && m2[1]) return m2[1];
  const m3 = s.match(/(https?:\/\/[^\s)'"<>]+)/i);
  if (m3 && m3[1]) return m3[1];
  return null;
}

async function tryLoadImageBase64(url: string): Promise<{ base64: string; mime: string } | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image load failed'));
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    const base64 = normalizeBase64(dataUrl.split(',')[1] || '');
    return { base64, mime: 'image/png' };
  } catch {
    return null;
  }
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function readUInt16BE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] << 8) | bytes[offset + 1];
}
function readUInt32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function getImageSizeFromBytes(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    const width = readUInt32BE(bytes, 16);
    const height = readUInt32BE(bytes, 20);
    if (width && height) return { width, height };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const length = readUInt16BE(bytes, i + 2);
      const isSOF = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSOF) {
        const height = readUInt16BE(bytes, i + 5);
        const width = readUInt16BE(bytes, i + 7);
        if (width && height) return { width, height };
        break;
      }
      if (length < 2) break;
      i += 2 + length;
    }
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
    const width = bytes[6] | (bytes[7] << 8);
    const height = bytes[8] | (bytes[9] << 8);
    if (width && height) return { width, height };
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    let pos = 12;
    while (pos + 8 <= bytes.length) {
      const id0 = bytes[pos], id1 = bytes[pos + 1], id2 = bytes[pos + 2], id3 = bytes[pos + 3];
      const chunkSize = readUInt32BE(bytes, pos + 4);
      if (id0 === 0x56 && id1 === 0x50 && id2 === 0x38 && id3 === 0x58) {
        const w = (bytes[pos + 8 + 4] | (bytes[pos + 8 + 5] << 8) | (bytes[pos + 8 + 6] << 16)) + 1;
        const h = (bytes[pos + 8 + 7] | (bytes[pos + 8 + 8] << 8) | (bytes[pos + 8 + 9] << 16)) + 1;
        if (w && h) return { width: w >>> 0, height: h >>> 0 };
      }
      pos += 8 + chunkSize + (chunkSize % 2);
    }
  }
  return null;
}

async function getImageSize(base64: string, mimeType?: string): Promise<{ width: number; height: number } | null> {
  const s = await getBase64ImageSize(base64, mimeType);
  if (s) return s;
  const b64 = normalizeBase64(stripBase64Header(base64));
  const bytes = decodeBase64ToBytes(b64);
  return getImageSizeFromBytes(bytes);
}

function isWhataiEnabled(): boolean {
  try {
    const clientKey = IS_BROWSER ? (localStorage.getItem('WHATAI_API_KEY') || '') : '';
    return Boolean(clientKey || WHATAI_API_KEY || PROXY_VIA_VITE);
  } catch {
    return Boolean(WHATAI_API_KEY || PROXY_VIA_VITE);
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const meta = parts[0];
  const base64 = normalizeBase64(parts[1] ?? parts[0]);
  const mimeMatch = /data:(.*?);base64/.exec(meta);
  const mimeType = mimeMatch ? mimeMatch[1] : "application/octet-stream";
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// 计算 base64 图片的长宽比（简化为最简分数），返回形如 "W:H"
async function computeAspectRatioFromBase64(base64: string, mimeType?: string): Promise<string | null> {
  if (!IS_BROWSER) return null;
  try {
    const rawInAr = stripBase64Header(base64);
    const normInAr = normalizeBase64(rawInAr);
    const detectedAr = detectMimeFromBase64(normInAr);
    const useMimeAr = (mimeType && mimeType.startsWith('image/')) ? mimeType : detectedAr;
    const url = `data:${useMimeAr};base64,${normInAr}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const loaded = await new Promise<HTMLImageElement>((resolve, reject) => {
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load base64 image for aspect ratio'));
      img.src = url;
    });
    let w = loaded.naturalWidth || loaded.width;
    let h = loaded.naturalHeight || loaded.height;
    if (!w || !h) return null;
    // 化简比例
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const g = gcd(w, h);
    const ar = `${Math.round(w / g)}:${Math.round(h / g)}`;
    return ar;
  } catch (err) {
    console.warn('计算图片长宽比失败，回退默认:', err);
    return null;
  }
}

// 获取 base64 图片尺寸
async function getBase64ImageSize(base64: string, mimeType?: string): Promise<{ width: number; height: number } | null> {
  if (!IS_BROWSER) return null;
  const raw = stripBase64Header(base64);
  const b64 = normalizeBase64(raw);
  const detected = detectMimeFromBase64(b64);
  const useMime = (mimeType && mimeType.startsWith('image/')) ? mimeType : detected;
  const dataUrl = `data:${useMime};base64,${b64}`;
  const tryLoad = async (src: string): Promise<HTMLImageElement> => {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load base64 image for size'));
      img.src = src;
    });
  };
  try {
    const loaded = await tryLoad(dataUrl);
    const w = loaded.naturalWidth || loaded.width;
    const h = loaded.naturalHeight || loaded.height;
    if (!w || !h) return null;
    return { width: w, height: h };
  } catch {
    return null;
  }
}

// 按比例缩小到不超过 maxWidth/maxHeight（不放大）
async function resizeBase64ToMax(base64: string, mimeType?: string, maxWidth = 2048, maxHeight = 2048): Promise<{ base64: string; width: number; height: number; scale: number } | null> {
  const size = await getImageSize(base64, mimeType);
  if (!size) return null;
  const { width, height } = size;
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  if (scale >= 1) return { base64, width, height, scale: 1 };
  const targetW = Math.max(1, Math.floor(width * scale));
  const targetH = Math.max(1, Math.floor(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const url = `data:${mimeType || 'image/png'};base64,${normalizeBase64(stripBase64Header(base64))}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image during resize'));
    i.src = url;
  });
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const out = canvas.toDataURL(mimeType || 'image/png').split(',')[1] || base64;
  return { base64: out, width: targetW, height: targetH, scale };
}

// 按指定因子缩放（用于与基图保持一致比例）
async function scaleBase64ByFactor(base64: string, mimeType: string | undefined, factor: number): Promise<{ base64: string; width: number; height: number } | null> {
  if (factor === 1) {
    const size = await getImageSize(base64, mimeType);
    if (!size) return { base64, width: 0, height: 0 };
    return { base64, width: size.width, height: size.height };
  }
  const size = await getImageSize(base64, mimeType);
  if (!size) return null;
  const targetW = Math.max(1, Math.floor(size.width * factor));
  const targetH = Math.max(1, Math.floor(size.height * factor));
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const url = `data:${mimeType || 'image/png'};base64,${base64}`;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load image during scale'));
    i.src = url;
  });
  ctx.drawImage(img, 0, 0, targetW, targetH);
  const out = canvas.toDataURL(mimeType || 'image/png').split(',')[1] || base64;
  return { base64: out, width: targetW, height: targetH };
}

// whatai.cc 统一 API 调用函数
async function whataiFetch(path: string, init: RequestInit): Promise<Response> {
  const useDevProxy = IS_BROWSER && PROXY_VIA_VITE;
  const proxyUrl = `/proxy-whatai${path}`;
  const directUrl = `${WHATAI_BASE_URL}${path}`;
  const headers = new Headers(init.headers || {});
  const clientKey = IS_BROWSER ? localStorage.getItem('WHATAI_API_KEY') || '' : '';
  if (clientKey) headers.set('Authorization', `Bearer ${clientKey}`);
  else if (!useDevProxy && WHATAI_API_KEY) headers.set('Authorization', `Bearer ${WHATAI_API_KEY}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const finalInit: RequestInit = { ...init, headers };
  let resp: Response | null = null;
  let firstError: unknown = null;
  const primaryUrl = useDevProxy ? proxyUrl : directUrl;
  try {
    resp = await withRetry(() => fetch(primaryUrl, finalInit), { retries: 3, baseDelayMs: 800 });
    if (useDevProxy && (!resp.ok && resp.status === 404)) {
      resp = null;
      throw new Error('proxy 404');
    }
  } catch (err) {
    firstError = err;
  }
  if (!resp) {
    try {
      resp = await withRetry(() => fetch(directUrl, finalInit), { retries: 3, baseDelayMs: 800 });
    } catch (err2) {
      const e = firstError || err2;
      throw e instanceof Error ? e : new Error(String(e));
    }
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`whatai API Error: ${resp.status} ${resp.statusText} ${text}`);
  }
  return resp;
}

// 统一的 OpenAI 格式聊天完成 API
async function whataiChatCompletions(body: unknown): Promise<ChatCompletionResponse> {
  const resp = await whataiFetch('/v1/chat/completions', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  
  const contentType = resp.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await resp.text();
    throw new Error(`whatai returned non-JSON (${contentType}): ${text.substring(0, 200)}`);
  }
  
  return await resp.json();
}


type ImageInput = {
  href: string;
  mimeType: string;
};

type ChatContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };
const isImageUrlPart = (p: ChatContentPart): p is { type: 'image_url'; image_url: { url: string } } => {
  return p.type === 'image_url' && typeof (p as { image_url: { url: string } }).image_url.url === 'string';
};
interface ChatMessage {
  content: string | Array<{ type?: string; image_url?: { url?: string }; inlineData?: { data?: string }; b64_json?: string }>;
}
interface ChatCompletionResponse {
  choices?: Array<{ message?: ChatMessage }>;
}
type VideoGenBody = {
  model: string;
  prompt: string;
  aspect_ratio: '16:9' | '9:16';
  duration: number;
  image?: string;
};

function isNanoBananaModel(m: string): boolean {
  const x = (m || '').toLowerCase();
  return x === 'nano-banana' || x === 'nano-banana-hd' || x === 'nano-banana-2';
}

interface ImageGenResponseItem { b64_json?: string; url?: string }
interface ImageGenResponse { data?: ImageGenResponseItem[] }

const SUPPORTED_ASPECT_RATIOS = ['1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'] as const;
function isSupportedAspectRatioText(r: string | null | undefined): boolean {
  if (!r) return false;
  const t = r.trim();
  return SUPPORTED_ASPECT_RATIOS.includes(t as (typeof SUPPORTED_ASPECT_RATIOS)[number]);
}
function nearestSupportedAspectRatioBySize(w?: number | null, h?: number | null): string | null {
  if (!w || !h || w <= 0 || h <= 0) return null;
  const target = w / h;
  let best: string | null = null;
  let diffBest = Number.POSITIVE_INFINITY;
  for (const cand of SUPPORTED_ASPECT_RATIOS) {
    const [a, b] = cand.split(':').map((x) => Number(x));
    if (!a || !b) continue;
    const val = a / b;
    const d = Math.abs(val - target);
    if (d < diffBest) { diffBest = d; best = cand; }
  }
  return best;
}

// 文本生成图像
export async function generateImageFromText(prompt: string, model?: string, opts?: { aspectRatio?: string }): Promise<{ 
  newImageBase64: string | null; 
  newImageMimeType: string | null; 
  textResponse: string | null; 
}> {
  if (!isWhataiEnabled()) {
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: "whatai API 未配置或未启用"
    };
  }

  try {
    const usedModel = model || getWhataiImageModel();
    if (isNanoBananaModel(usedModel)) {
      const body = {
        model: usedModel,
        prompt: prompt,
        response_format: 'b64_json',
        ...(opts?.aspectRatio ? { aspect_ratio: opts.aspectRatio } : {})
      } as Record<string, unknown>;
      const resp = await whataiFetch('/v1/images/generations', { method: 'POST', body: JSON.stringify(body) });
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const tx = await resp.text();
        throw new Error(`images/generations 返回非 JSON (${ct}): ${tx.substring(0, 200)}`);
      }
      const json: ImageGenResponse = await resp.json();
      const item = json?.data && json.data[0];
      if (item?.b64_json) {
        const base64 = normalizeBase64(stripBase64Header(String(item.b64_json)));
        const mime = detectMimeFromBase64(base64);
        return { newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
      }
      if (item?.url) {
        const r = await fetch(String(item.url));
        const ct2 = r.headers.get('content-type') || '';
        if (!ct2.startsWith('image/')) {
          return { newImageBase64: null, newImageMimeType: null, textResponse: `图像获取失败：非图像内容(${ct2 || 'unknown'})` };
        }
        const blob = await r.blob();
        const reader = new FileReader();
        return await new Promise((resolve) => {
          reader.onload = () => {
            let base64 = (reader.result as string).split(',')[1];
            base64 = normalizeBase64(base64);
            const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
            resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` });
          };
          reader.readAsDataURL(blob);
        });
      }
      return { newImageBase64: null, newImageMimeType: null, textResponse: '图像生成失败：未找到输出' };
    }
    const content: ChatContentPart[] = [];
    const outputInstr = '只输出一行 data:image/png;base64,<...> 不要输出其它文字';
    const textPayload = opts?.aspectRatio ? `${prompt}\n[aspect_ratio:${opts.aspectRatio}]\n${outputInstr}` : `${prompt}\n${outputInstr}`;
    content.push({ type: "text", text: textPayload });
    const chat = await whataiChatCompletions({ model: usedModel, messages: [{ role: "user", content }], max_tokens: 1000 });
    const msg = chat && chat.choices && chat.choices[0] && chat.choices[0].message;
    if (msg) {
      const mc = msg.content;
      if (typeof mc === 'string') {
        const s = mc as string;
        const ex = extractDataUrlFromText(s);
        if (ex) {
          return { newImageBase64: ex.base64, newImageMimeType: ex.mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
        }
        const urlFromText = extractFirstHttpUrl(s);
        if (urlFromText) {
          try {
            const r = await fetch(urlFromText);
            const ct = r.headers.get('content-type') || '';
            if (ct.startsWith('image/')) {
              const blob = await r.blob();
              const reader = new FileReader();
              return await new Promise((resolve) => {
                reader.onload = () => {
                  let base64 = (reader.result as string).split(',')[1];
                  base64 = normalizeBase64(base64);
                  const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
                  resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` });
                };
                reader.readAsDataURL(blob);
              });
            }
            const viaImg = await tryLoadImageBase64(urlFromText);
            if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
            return { newImageBase64: null, newImageMimeType: null, textResponse: `图像获取失败：非图像内容(${ct || 'unknown'})` };
          } catch {
            const viaImg = await tryLoadImageBase64(urlFromText);
            if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
            return { newImageBase64: null, newImageMimeType: null, textResponse: '图像获取失败：无法创建画布' };
          }
        }
      } else if (Array.isArray(mc)) {
        for (const part of mc) {
          const inl = extractInlineData(part);
          if (inl) {
            return { newImageBase64: inl.base64, newImageMimeType: inl.mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
          }
          if (part && part.type === 'image_url' && part.image_url && part.image_url.url) {
            const url = part.image_url.url as string;
            if (url.startsWith('data:image/')) {
              const ex2 = extractDataUrlFromText(url);
              if (ex2) return { newImageBase64: ex2.base64, newImageMimeType: ex2.mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
            } else {
              try {
                const r = await fetch(url);
                const ct2 = r.headers.get('content-type') || '';
                if (ct2.startsWith('image/')) {
                  const blob = await r.blob();
                  const reader = new FileReader();
                  return await new Promise((resolve) => {
                    reader.onload = () => {
                      let base64 = (reader.result as string).split(',')[1];
                      base64 = normalizeBase64(base64);
                      const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
                      resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功生成图像` });
                    };
                    reader.readAsDataURL(blob);
                  });
                }
                const viaImg = await tryLoadImageBase64(url);
                if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
                return { newImageBase64: null, newImageMimeType: null, textResponse: `图像获取失败：非图像内容(${ct2 || 'unknown'})` };
              } catch {
                const viaImg = await tryLoadImageBase64(url);
                if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功生成图像` };
                return { newImageBase64: null, newImageMimeType: null, textResponse: '图像获取失败：无法创建画布' };
              }
            }
          }
        }
      }
    }
    return { newImageBase64: null, newImageMimeType: null, textResponse: "图像生成失败：未找到输出" };
    
  } catch (error) {
    console.error('whatai 图像生成失败:', error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error)));
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: `图像生成失败: ${error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error))}`
    };
  }
}

// 图像编辑
export async function editImage(
  images: ImageInput[], 
  prompt: string,
  mask?: ImageInput,
  imageSize?: '1K' | '2K' | '4K'
): Promise<{ 
  newImageBase64: string | null; 
  newImageMimeType: string | null; 
  textResponse: string | null; 
}> {
  if (!isWhataiEnabled()) {
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: "whatai API 未配置或未启用"
    };
  }

  if (!images || images.length === 0) {
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: "图像编辑失败：未提供输入图像"
    };
  }

  try {
    // 处理所有输入图片（无遮罩时用于多图组合；有遮罩时只取首图作为基底）
    const first = images[0];
    const firstBase64 = first.href.includes('base64,')
      ? first.href.split('base64,')[1]
      : first.href;

    // 计算首图长宽比（用于保持编辑输出比例一致）
    const aspectRatioFromImage = await computeAspectRatioFromBase64(firstBase64, first.mimeType);

    // 逐张图片按最大 2048 边进行预处理缩放（无遮罩路径会全部传入）
    const preparedImagesBase64: string[] = [];
    let preparedMaskBase64 = mask ? (mask.href.includes('base64,') ? mask.href.split('base64,')[1] : mask.href) : undefined;
    let firstResizeScale: number | null = null;
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imgBase64 = img.href.includes('base64,') ? img.href.split('base64,')[1] : img.href;
      let prepared = imgBase64;
      const resizedImg = await resizeBase64ToMax(imgBase64, img.mimeType, 2048, 2048);
      if (resizedImg && resizedImg.scale < 1) {
        prepared = resizedImg.base64;
        // 记录首图的缩放比例用于遮罩同步缩放
        if (i === 0) firstResizeScale = resizedImg.scale;
        console.debug('[editImage] 输入图过大，已按比例缩放', {
          index: i,
          original: await getBase64ImageSize(imgBase64, img.mimeType),
          resized: { width: resizedImg.width, height: resizedImg.height },
          scale: resizedImg.scale,
        });
      }
      preparedImagesBase64.push(prepared);
    }

    // 如果有遮罩，需与首图缩放比例保持一致
    if (preparedMaskBase64 && firstResizeScale && firstResizeScale < 1) {
      const maskScaled = await scaleBase64ByFactor(preparedMaskBase64, mask?.mimeType, firstResizeScale);
      preparedMaskBase64 = maskScaled?.base64 ?? preparedMaskBase64;
    }

    // 计算目标尺寸为首图（预处理后）的实际像素尺寸
  const baseSize = await getImageSize(preparedImagesBase64[0], first.mimeType);
    const targetW = baseSize?.width;
    const targetH = baseSize?.height;

    const usedModel = getWhataiImageModel();
    if (isNanoBananaModel(usedModel)) {
      const form = new FormData();
      form.append('model', usedModel);
      form.append('prompt', prompt);
      form.append('response_format', 'b64_json');
      const aspectToSend = isSupportedAspectRatioText(aspectRatioFromImage) ? aspectRatioFromImage : nearestSupportedAspectRatioBySize(targetW, targetH);
      if (aspectToSend) form.append('aspect_ratio', aspectToSend);
      if (targetW && targetH) form.append('size', `${targetW}x${targetH}`);
      if ((usedModel || '').toLowerCase() === 'nano-banana-2') {
        form.append('image_size', imageSize || '4K');
      }
      for (let i = 0; i < preparedImagesBase64.length; i++) {
        const mime = images[i]?.mimeType || 'image/png';
        const dataUrl = `data:${mime};base64,${preparedImagesBase64[i]}`;
        const blob = dataUrlToBlob(dataUrl);
        form.append('image', blob, `image${i}.${mime.split('/')[1] || 'png'}`);
      }
      const resp = await whataiFetch('/v1/images/edits', { method: 'POST', body: form });
      const ct = resp.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const tx = await resp.text();
        throw new Error(`images/edits 返回非 JSON (${ct}): ${tx.substring(0, 200)}`);
      }
      const json: ImageGenResponse = await resp.json();
      const item = json?.data && json.data[0];
      if (item?.b64_json) {
        const base64 = normalizeBase64(stripBase64Header(String(item.b64_json)));
        const mime = detectMimeFromBase64(base64);
        if (targetW && targetH) {
          try {
            const outSize = await getImageSize(base64, mime);
            const ok = outSize && outSize.width === targetW && outSize.height === targetH;
            if (!ok && WHATAI_STRICT_SIZE) {
              return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：服务端未按尺寸输出（期望 ${targetW}x${targetH}）` };
            }
          } catch { void 0; }
        }
        return { newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
      }
      if (item?.url) {
        const r = await fetch(String(item.url));
        const ct2 = r.headers.get('content-type') || '';
        if (!ct2.startsWith('image/')) {
          return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：非图像内容(${ct2 || 'unknown'})` };
        }
        const blob = await r.blob();
        const reader = new FileReader();
        return await new Promise((resolve) => {
          reader.onload = async () => {
            let base64 = (reader.result as string).split(',')[1];
            base64 = normalizeBase64(base64);
            const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
            if (targetW && targetH) {
              try {
                const outSize = await getImageSize(base64, mime);
                const ok = outSize && outSize.width === targetW && outSize.height === targetH;
                if (!ok && WHATAI_STRICT_SIZE) {
                  resolve({ newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：服务端未按尺寸输出（期望 ${targetW}x${targetH}）` });
                  return;
                }
              } catch { void 0; }
            }
            resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` });
          };
          reader.readAsDataURL(blob);
        });
      }
      return { newImageBase64: null, newImageMimeType: null, textResponse: '图像编辑失败：未找到输出' };
    }
    const parts: ChatContentPart[] = [];
    const arText = aspectRatioFromImage ? `[aspect_ratio:${aspectRatioFromImage}]` : '';
    const sizeText = targetW && targetH ? `[size:${targetW}x${targetH}]` : '';
    const outputInstr = '只输出一行 data:image/png;base64,<...> 不要输出其它文字';
    const ptext = mask ? `${prompt}\n${arText} ${sizeText} [mask:provided]\n${outputInstr}` : `${prompt}\n${arText}\n${outputInstr}`;
    parts.push({ type: "text", text: ptext.trim() });
    for (let i = 0; i < preparedImagesBase64.length; i++) {
      const mime = images[i]?.mimeType || 'image/png';
      const url = `data:${mime};base64,${preparedImagesBase64[i]}`;
      parts.push({ type: "image_url", image_url: { url } });
    }
    if (preparedMaskBase64) {
      const maskUrl = `data:${mask?.mimeType || 'image/png'};base64,${preparedMaskBase64}`;
      parts.push({ type: "image_url", image_url: { url: maskUrl } });
    }
    console.log('[editImage] 路径: chat/completions(修改图片)', { model: usedModel, partsCount: parts.length });
    const hasText = parts.some(p => p && p.type === 'text');
    const imgCount = parts.filter(p => isImageUrlPart(p)).length;
    const firstImg = parts.find(isImageUrlPart);
    const previewUrl = firstImg ? String(firstImg.image_url.url).slice(0, 80) : undefined;
    console.log('[editImage] chat content', { hasText, imageCount: imgCount, preview: previewUrl });
    const chat = await whataiChatCompletions({ model: usedModel, messages: [{ role: "user", content: parts }], max_tokens: 1500 });
    const msg = chat && chat.choices && chat.choices[0] && chat.choices[0].message;
    if (msg) {
      try {
        let kind = 'unknown';
        let hint: string | undefined = undefined;
        const mc0: unknown = msg.content;
        if (typeof mc0 === 'string') {
          kind = 'string';
          hint = mc0.slice(0, 80);
        } else if (Array.isArray(mc0)) {
          kind = 'array';
          const first = mc0[0];
          if (first && first.type === 'image_url' && first.image_url && first.image_url.url) {
            hint = String(first.image_url.url).slice(0, 80);
          } else if (first && first.b64_json) {
            hint = String(first.b64_json).slice(0, 80);
          } else if (first && first.inlineData && first.inlineData.data) {
            hint = String(first.inlineData.data).slice(0, 80);
          }
        }
        console.log('[editImage] chat content preview', { kind, hint });
      } catch { void 0; }
      const mc = msg.content;
      if (typeof mc === 'string') {
        const s = mc as string;
        const ex = extractDataUrlFromText(s);
        if (ex) {
          let b64 = ex.base64;
          const mime = ex.mime;
          if (targetW && targetH) {
            try {
            const outSize = await getImageSize(b64, mime);
              const ok = outSize && outSize.width === targetW && outSize.height === targetH;
              if (!ok) {
                if (WHATAI_STRICT_SIZE) {
                  return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：服务端未按尺寸输出（期望 ${targetW}x${targetH}）` };
                }
              }
            } catch { void 0; }
          }
          return { newImageBase64: b64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
        }
        if (s.includes('http')) {
          try {
            const urlText = extractFirstHttpUrl(s) || s;
            const r = await fetch(urlText);
            const blob = await r.blob();
            const reader = new FileReader();
            return await new Promise((resolve) => {
              reader.onload = async () => {
                let base64 = (reader.result as string).split(',')[1];
                base64 = normalizeBase64(base64);
                const mime = blob.type || detectMimeFromBase64(base64);
                if (targetW && targetH) {
                  try {
                    const outSize = await getImageSize(base64, mime);
                    const ok = outSize && outSize.width === targetW && outSize.height === targetH;
                    if (!ok) {
                      if (WHATAI_STRICT_SIZE) {
                        resolve({ newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：服务端未按尺寸输出（期望 ${targetW}x${targetH}）` });
                        return;
                      }
                    }
                  } catch { void 0; }
                }
                resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` });
              };
              reader.readAsDataURL(blob);
            });
          } catch {
            const urlText = extractFirstHttpUrl(s);
            const viaImg = urlText ? await tryLoadImageBase64(urlText) : null;
            if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
            return { newImageBase64: null, newImageMimeType: null, textResponse: '图像获取失败：无法创建画布' };
          }
        }
      }
      if (Array.isArray(mc)) {
        for (const part of mc) {
          if (part && part.type === 'image_url' && part.image_url && part.image_url.url) {
            const url = part.image_url.url as string;
            if (url.startsWith('data:image/')) {
              const ex2 = extractDataUrlFromText(url);
              if (!ex2) {
                continue;
              }
              return { newImageBase64: ex2.base64, newImageMimeType: ex2.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
            } else {
              try {
                const r = await fetch(url);
                const ct3 = r.headers.get('content-type') || '';
                if (ct3.startsWith('image/')) {
                  const blob = await r.blob();
                  const reader = new FileReader();
                  return await new Promise((resolve) => {
                    reader.onload = () => {
                      let base64 = (reader.result as string).split(',')[1];
                      base64 = normalizeBase64(base64);
                      const mime = (blob.type && blob.type.startsWith('image/')) ? blob.type : detectMimeFromBase64(base64);
                      resolve({ newImageBase64: base64, newImageMimeType: mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` });
                    };
                    reader.readAsDataURL(blob);
                  });
                }
                const viaImg = await tryLoadImageBase64(url);
                if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
                return { newImageBase64: null, newImageMimeType: null, textResponse: `图像编辑失败：非图像内容(${ct3 || 'unknown'})` };
              } catch {
                const viaImg = await tryLoadImageBase64(url);
                if (viaImg) return { newImageBase64: viaImg.base64, newImageMimeType: viaImg.mime, textResponse: `使用 ${usedModel} 模型成功编辑图像` };
                return { newImageBase64: null, newImageMimeType: null, textResponse: '图像获取失败：无法创建画布' };
              }
            }
          }
        }
      }
    }
    return { newImageBase64: null, newImageMimeType: null, textResponse: "图像编辑失败：未找到输出" };
    
  } catch (error) {
    console.error('whatai 图像编辑失败:', error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error)));
    return {
      newImageBase64: null,
      newImageMimeType: null,
      textResponse: `图像编辑失败: ${error instanceof Error ? error.message : (typeof error === 'string' ? error : JSON.stringify(error))}`
    };
  }
}

// 视频生成
export async function generateVideo(
  prompt: string,
  aspectRatio: '16:9' | '9:16',
  onProgress: (message: string) => void,
  image?: ImageInput
): Promise<{ videoBlob: Blob; mimeType: string }> {
  if (!isWhataiEnabled()) {
    throw new Error("whatai API 未配置或未启用");
  }

  try {
    onProgress("正在使用 whatai 统一 API 生成视频...");

    const body: VideoGenBody = {
      model: WHATAI_VIDEO_MODEL,
      prompt: prompt,
      aspect_ratio: aspectRatio,
      duration: 5 // 默认 5 秒
    };

    // 如果提供了参考图像
    if (image) {
      const imageBase64 = image.href.includes('base64,') 
        ? image.href.split('base64,')[1] 
        : image.href;
      body.image = imageBase64;
    }

    onProgress("正在发送视频生成请求...");
    
    // 使用聊天完成 API 进行视频生成
    const result = await whataiChatCompletions({
      model: WHATAI_VIDEO_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: `生成视频：${prompt}，宽高比：${aspectRatio}` },
            ...(image ? [{ 
              type: "image_url", 
              image_url: { url: image.href } 
            }] : [])
          ]
        }
      ],
      max_tokens: 1000
    });

    onProgress("视频生成完成，正在处理结果...");

    // 这里需要根据实际的 whatai 视频生成 API 响应格式进行调整
    if (result.choices && result.choices[0] && result.choices[0].message) {
      const content = result.choices[0].message.content;
      if (typeof content === 'string') {
        if (content.includes('data:video/') || content.includes('http')) {
          const videoData = content.includes('data:video/') ? content : await fetch(content).then(r => r.blob());
          const blob = typeof videoData === 'string' ? dataUrlToBlob(videoData) : videoData;
          return { videoBlob: blob, mimeType: "video/mp4" };
        }
      }
    }

    throw new Error("视频生成失败：API 返回格式异常");
    
  } catch (error) {
    console.error('whatai 视频生成失败:', error);
    throw new Error(`视频生成失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// 文本生成（聊天完成）
type SimpleMessage = { role: 'system' | 'user'; content: string };

export async function generateText(
  prompt: string,
  systemPrompt?: string
): Promise<string> {
  if (!isWhataiEnabled()) {
    throw new Error("whatai API 未配置或未启用");
  }

  try {
    const messages: SimpleMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }
    
    messages.push({ role: "user", content: prompt });

    const body = {
      model: WHATAI_TEXT_MODEL,
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7
    };

    const result = await whataiChatCompletions(body);
    
    if (result.choices && result.choices[0] && result.choices[0].message) {
      const c = result.choices[0].message.content;
      if (typeof c === 'string') return c;
      if (Array.isArray(c)) {
        const arr = c as Array<{ type?: string; text?: string }>;
        const textPart = arr.find((p) => p && p.type === 'text' && typeof p.text === 'string');
        if (textPart && textPart.text) return textPart.text;
        return JSON.stringify(c);
      }
    }
    
    throw new Error("文本生成失败：API 返回格式异常");
    
  } catch (error) {
    console.error('whatai 文本生成失败:', error);
    throw new Error(`文本生成失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runSizeProbe(): Promise<{ png: { width: number; height: number } | null }> {
  const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YbODXcAAAAASUVORK5CYII=';
  const size = await getImageSize(pngB64, 'image/png');
  return { png: size || null };
}
