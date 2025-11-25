import React, { useEffect, useRef, useState } from 'react';

interface BananaSidebarProps {
  t: (key: string, ...args: unknown[]) => unknown;
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
  /** 从 PromptBar 中心到香蕉按钮的水平偏移（px），用于让面板按 PromptBar 轴居中 */
  promptBarOffsetPx?: number;
  buttonSize?: number;
}

// Base URL helper to support dev ("/") and electron build ("./")
const BASE_URL = ((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL) || '/';
const withBase = (p: string) => {
  const normalized = p.startsWith('/') ? p.slice(1) : p;
  return `${BASE_URL}${normalized}`;
};

const BananaIcon: React.FC<{ size?: number }> = ({ size = 40 }) => {
  const primary = withBase('logo/icons8-banana-100.png');
  const fallback = withBase('logo/BA-color.png');
  const svgFallback = withBase('logo/OpenMoji-color_1F34C.svg');
  return (
    <img
      src={primary}
      width={size}
      height={size}
      alt="banana"
      style={{ display: 'block' }}
      onError={(e) => {
        const t = e.currentTarget;
        t.onerror = null;
        t.src = fallback;
        setTimeout(() => { if (t.naturalWidth === 0) t.src = svgFallback; }, 0);
      }}
    />
  );
};

// Create a simple SVG data URL thumbnail using the preset name
const makeSvgDataUrl = (label: string) => {
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<?xml version='1.0' encoding='UTF-8'?>\n` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'>\n` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#F9E76D'/><stop offset='100%' stop-color='#F5DF4D'/></linearGradient></defs>\n` +
    `<rect width='100%' height='100%' rx='8' ry='8' fill='url(#g)'/>\n` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-size='12' fill='#3b2f1e'>${safe}</text>\n` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

// Photo URLs for weather cards (optimized Unsplash sizes)
const PHOTO_URLS: Record<string, string> = {
  // Chinese
  '晴天': 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=360&q=80',
  '清晨': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=360&q=80',
  '黄昏': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80',
  '夜景': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  '阴天': 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=80',
  '雨天': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=360&q=80',
  '雪景': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
  // English
  'Sunny': 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=360&q=80',
  'Morning': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=360&q=80',
  'Dusk': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80',
  'Night Scene': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  'Overcast': 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=80',
  'Rainy': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=360&q=80',
  'Snowy': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
};

// Normalize label for robust matching (trim, lowercase, remove spaces)
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

// Try resolve photo url by normalized comparison across keys
const resolvePhotoUrl = (label: string): string | null => {
  const n = normalize(label);
  for (const key in PHOTO_URLS) {
    if (normalize(key) === n) return PHOTO_URLS[key];
  }
  return null;
};

// Map localized card names to local weather icon assets
const ICON_MAP: Record<string, string> = {
  // Chinese
  '晴天': withBase('weather/sun.svg'),
  '清晨': withBase('weather/sunrise.svg'),
  '黄昏': withBase('weather/sunset.svg'),
  '夜景': withBase('weather/night_city.svg'),
  '阴天': withBase('weather/cloud.svg'),
  '雨天': withBase('weather/rain.svg'),
  '雪景': withBase('weather/snow.svg'),
  // English
  'Sunny': withBase('weather/sun.svg'),
  'Morning': withBase('weather/sunrise.svg'),
  'Dusk': withBase('weather/sunset.svg'),
  'Night Scene': withBase('weather/night_city.svg'),
  'Overcast': withBase('weather/cloud.svg'),
  'Rainy': withBase('weather/rain.svg'),
  'Snowy': withBase('weather/snow.svg'),
};

const resolveIconUrl = (label: string): string | null => {
  const n = normalize(label);
  for (const key in ICON_MAP) {
    if (normalize(key) === n) return ICON_MAP[key];
  }
  return null;
};

const getCardImageSrc = (label: string) => {
  const photo = resolvePhotoUrl(label);
  if (photo) return photo;
  const icon = resolveIconUrl(label);
  if (icon) return icon;
  return makeSvgDataUrl(label);
};

// Local icon fallback mapping (runtime image error handler will use this)
const getLocalIconSrc = (label: string): string | null => resolveIconUrl(label);

export const BananaSidebar: React.FC<BananaSidebarProps> = ({ t, setPrompt, onGenerate, disabled = false, promptBarOffsetPx = 0, buttonSize }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const builtInPrompts = t('bananaCards') as { name: string; value: string }[];
  void onGenerate;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSelect = (value: string) => {
    if (disabled) return;
    setPrompt(value);
    setIsOpen(false);
    // Do not auto-generate; leave control to user.
    // Uncomment to auto-generate on click:
    // onGenerate();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Gradient glass circle button styled like PodUI copy.html */}
      <button
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        aria-label="Banana Presets"
        title="Banana Presets"
        className="banana-circle pod-inner-gradient-ring"
        style={{
          position: 'relative',
          cursor: disabled ? 'not-allowed' : 'pointer',
          height: buttonSize || 40,
          width: buttonSize || 40,
          aspectRatio: '1 / 1',
          flex: '0 0 auto',
          boxSizing: 'border-box',
          padding: 0,
          border: 0,
          borderRadius: 9999,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #ff6fb3 0%, #3ba6ff 50%, #ffb36b 100%)',
          boxShadow:
            '0 8px 24px rgba(59,166,255,0.35), 0 2px 6px rgba(0,0,0,0.25)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.6 : 1,
          ['--pod-ring-width' as unknown as string]: '1.5px',
        }}
      >
        {/* Inner glass */}
          <span
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              borderRadius: '9999px',
              overflow: 'hidden',
              background: 'rgba(255, 255, 255, 0.12)',
              boxShadow:
                'inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -8px 18px rgba(59, 166, 255, 0.22)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              padding: 6,
              boxSizing: 'border-box',
              color: 'rgba(255,255,255,0.95)',
            }}
          >
          {/* Soft highlight sweep */}
          <span
            style={{
              content: "''",
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(-65deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 70%)',
              backgroundSize: '200% 100%',
              backgroundRepeat: 'no-repeat',
              animation: 'banana_sheen 4.8s ease-in-out infinite',
              pointerEvents: 'none',
              borderRadius: 'inherit',
              mixBlendMode: 'screen',
            }}
          />

          {/* Gentle top rim glow */}
          <span
            style={{
              content: "''",
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(120% 60% at 50% -10%, rgba(255,255,255,0.35), transparent 55%)',
              pointerEvents: 'none',
              borderRadius: 'inherit',
            }}
          />

          {/* Icon centered for circular button */}
          <span style={{ position: 'relative', zIndex: 1 }}>
            <BananaIcon size={Math.max(18, (buttonSize || 40) - 8)} />
          </span>
        </span>
      </button>
      {/* Scoped styles for hover/active and sheen animation */}
      <style>{`
        @keyframes banana_sheen {
          0% { background-position: 130% 0; opacity: 1; }
          100% { background-position: -160% 0; opacity: 0; }
        }
        .banana-circle:hover > span {
          background: rgba(255, 255, 255, 0.13);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.5),
            inset 0 -10px 20px rgba(59,166,255,0.3);
        }
        .banana-circle:hover {
          transform: translateY(-1px);
          box-shadow:
            0 10px 28px rgba(59, 166, 255, 0.4),
            0 4px 10px rgba(0,0,0,0.28);
        }
        .banana-circle:active {
          transform: translateY(1px);
          box-shadow:
            0 6px 16px rgba(59, 166, 255, 0.28),
            0 2px 6px rgba(0,0,0,0.28);
        }
      `}</style>
      {isOpen && (
        <div
          className="absolute bottom-full mb-3 sm:w-full md:w-[48rem] lg:w-[64rem] max-w-[90vw] pod-panel pod-panel-transparent pod-panel-rounded-xl p-3 overflow-x-auto overflow-y-hidden pod-scrollbar-x"
          style={{ left: '50%', transform: `translateX(calc(-50% + ${Number(promptBarOffsetPx || 0)}px))` }}
        >
          <div className="flex flex-row gap-2 justify-center flex-wrap md:flex-nowrap">
            {(builtInPrompts || []).slice(0, 7).map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(item.value)}
                title={item.name}
                className="group relative cursor-pointer transform transition-all duration-500 hover:scale-105 hover:-translate-y-1 flex-shrink-0 w-32"
                style={{ padding: 0 }}
              >
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-500 hover:bg-white/15">
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={getCardImageSrc(item.name)}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      onError={(e) => {
                        const fb = getLocalIconSrc(item.name);
                        e.currentTarget.src = fb ?? makeSvgDataUrl(item.name);
                      }}
                    />
                    {/* bottom gradient overlay for readability */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"></div>
                    {/* centered title overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <h3
                        className="font-semibold text-white text-base leading-tight drop-shadow-md text-center px-2"
                        style={{
                          fontFamily:
                            "'阿里妈妈数黑体 Bold', 'Alimama ShuHeiTi', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'Heiti SC', Arial, sans-serif",
                          fontSize: '1.2em',
                          textShadow:
                            '0 2px 6px rgba(0,0,0,0.45), 0 1px 2px rgba(0,0,0,0.35)',
                          letterSpacing: '0.06em'
                        }}
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                    </div>
                    {/* content area */}
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-white/40 rounded-full"/>
                          <span className="w-1.5 h-1.5 bg-white/30 rounded-full"/>
                          <span className="w-1.5 h-1.5 bg-white/20 rounded-full"/>
                          <span className="w-1.5 h-1.5 bg-white/10 rounded-full"/>
                          <span className="w-1.5 h-1.5 bg-white/5 rounded-full"/>
                        </div>
                        <span className="text-[10px] text-white/80 bg-white/15 backdrop-blur-xl px-1.5 py-0.5 rounded-lg">
                          {t('bananaSidebar.presetLabel')}
                        </span>
                      </div>
                      {/* 移除CTA按钮：卡片底部不再显示“使用” */}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BananaSidebar;
