import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isElectron = env.BUILD_TARGET === 'electron' || env.VITE_ELECTRON === 'true';
  return {
      base: isElectron ? './' : '/',
      server: {
        port: 3001,
        host: '0.0.0.0',
        // hmr: {
        //   host: 'localhost',
        //   port: 3001,
        //   clientPort: 3001,
        //   protocol: 'ws',
        // },
        proxy: {
          '/proxy-whatai': {
            target: env.WHATAI_BASE_URL || 'https://api.whatai.cc',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/proxy-whatai/, ''),
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq, req) => {
                const existingAuth = proxyReq.getHeader('Authorization') || req.headers['authorization'];
                if (!existingAuth) {
                  const key = env.WHATAI_API_KEY;
                  if (key) {
                    proxyReq.setHeader('Authorization', `Bearer ${key}`);
                  }
                }
                if (!proxyReq.getHeader('Accept')) {
                  proxyReq.setHeader('Accept', 'application/json');
                }
              });
            },
          },
          ...(env.BANANAPOD_API_BASE_URL ? {
            '/api/bananapod': {
              target: env.BANANAPOD_API_BASE_URL,
              changeOrigin: true,
              secure: false,
            }
          } : {})
        }
      },
      plugins: [react()],
      define: {
        'process.env.WHATAI_BASE_URL': JSON.stringify(env.WHATAI_BASE_URL || 'https://api.whatai.cc'),
        'process.env.WHATAI_API_KEY': JSON.stringify(env.WHATAI_API_KEY),
        'process.env.WHATAI_TEXT_MODEL': JSON.stringify(env.WHATAI_TEXT_MODEL || 'gemini-2.0-flash-exp'),
        'process.env.WHATAI_IMAGE_MODEL': JSON.stringify(env.WHATAI_IMAGE_MODEL || 'gemini-2.5-flash-image'),
        'process.env.WHATAI_IMAGE_GENERATION_MODEL': JSON.stringify(env.WHATAI_IMAGE_GENERATION_MODEL || env.WHATAI_IMAGE_MODEL || 'gemini-2.5-flash-image'),
        'process.env.WHATAI_IMAGE_EDIT_MODEL': JSON.stringify(env.WHATAI_IMAGE_EDIT_MODEL || env.WHATAI_IMAGE_MODEL || 'gemini-2.5-flash-image'),
        'process.env.WHATAI_VIDEO_MODEL': JSON.stringify(env.WHATAI_VIDEO_MODEL || 'vidu-1'),
        'process.env.PROXY_VIA_VITE': JSON.stringify(isElectron ? 'false' : (env.PROXY_VIA_VITE || 'true')),
        'process.env.BANANAPOD_API_BASE_URL': JSON.stringify(env.BANANAPOD_API_BASE_URL || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
