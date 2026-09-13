import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  const buildId = command === 'build' ? new Date().toISOString() : 'development';
  const siteUrl = /^https:\/\//.test(process.env.URL ?? '') ? process.env.URL?.replace(/\/+$/, '') : undefined;
  return {
    plugins: [react(), tailwindcss(), {
      name: 'app-build-id',
      transformIndexHtml: () => [
        { tag: 'meta', attrs: { name: 'app-build', content: buildId }, injectTo: 'head-prepend' },
        ...(siteUrl ? [
          { tag: 'meta', attrs: { property: 'og:url', content: `${siteUrl}/` }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:image', content: `${siteUrl}/og-image.png` }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:image:height', content: '630' }, injectTo: 'head' as const },
          { tag: 'meta', attrs: { property: 'og:image:alt', content: 'School 미리보기' }, injectTo: 'head' as const },
        ] : []),
      ],
    }],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: process.env.NETLIFY_DEV_API_URL ?? 'http://localhost:8888',
          changeOrigin: true,
        },
      },
    },
  };
});
