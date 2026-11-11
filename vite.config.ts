import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import type { Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import { CONFIG } from './src/config';

const CONNECT = [
  "'self'", 'https://*.helius-rpc.com', 'https://api.helius.xyz', 'https://api.mainnet-beta.solana.com',
  'https://api.dexscreener.com', 'https://api.devnet.solana.com',
];

function hostCovered(url: string): boolean {
  if (!url) return true;
  const u = new URL(url);
  return CONNECT.some((src) => {
    if (src === "'self'") return false;
    const host = new URL(src.replace('*.', 'wild.')).host;
    return src.includes('*.') ? u.host.endsWith(host.replace('wild.', '.')) : u.host === host;
  });
}

/** Build-only: CSP meta, canonical/OG url + sitemap when SITE_URL is known. Fails if an RPC host isn't allowed by the CSP. */
function inlineCss(): Plugin {
  return {
    name: 'lease-inline-css',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html;
        const preload = Object.keys(bundle)
          .filter((k) => /(archivo-latin-wdth-normal|archivo-black-latin-400-normal|courier-prime-latin-400-normal)[^/]*\.woff2$/.test(k))
          .map((k) => `<link rel="preload" as="font" type="font/woff2" crossorigin href="./${k}">`)
          .join('');
        html = html.replace('</head>', `${preload}</head>`);
        return html.replace(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"[^>]*>/g, (m, file: string) => {
          const asset = bundle[file];
          if (!asset || asset.type !== 'asset') return m;
          // font URLs inside the CSS are relative to /assets/, so rebase them for inlining in index.html
          const css = String(asset.source).replace(/url\(\.?\/?([^)"']+\.woff2?)\)/g, 'url(./assets/$1)');
          delete bundle[file];
          return `<style>${css}</style>`;
        });
      },
    },
  };
}

function hardening(): Plugin {
  const site = (process.env.SITE_URL ?? '').replace(/\/$/, '');
  return {
    name: 'lease-hardening',
    apply: 'build',
    buildStart() {
      for (const [k, v] of [['RPC_URL', CONFIG.RPC_URL], ['HELIUS_API_BASE', CONFIG.HELIUS_API_BASE], ['PUBLIC_RPC_FALLBACK', CONFIG.PUBLIC_RPC_FALLBACK], ['DEXSCREENER_BASE', CONFIG.DEXSCREENER_BASE]] as const) {
        if (!hostCovered(v)) this.error(`CONFIG.${k} host (${v}) is not allowed by the CSP in vite.config.ts. Add it to CONNECT.`);
      }
    },
    transformIndexHtml() {
      const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src ${CONNECT.join(' ')}; base-uri 'self'; form-action 'none'`;
      const tags: { tag: string; attrs: Record<string, string>; injectTo: 'head' }[] = [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head' },
      ];
      if (site) {
        tags.push({ tag: 'link', attrs: { rel: 'canonical', href: `${site}/` }, injectTo: 'head' });
        tags.push({ tag: 'meta', attrs: { property: 'og:url', content: `${site}/` }, injectTo: 'head' });
        tags.push({ tag: 'meta', attrs: { property: 'og:image', content: `${site}/og.png` }, injectTo: 'head' });
        tags.push({ tag: 'meta', attrs: { name: 'twitter:image', content: `${site}/og.png` }, injectTo: 'head' });
      }
      return tags;
    },
    generateBundle() {
      if (!site) return;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${site}/</loc></url></urlset>\n` });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [preact(), hardening(), inlineCss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/gsap')) return 'gsap';
          if (id.includes('@solana') || id.includes('bs58') || id.includes('@noble')) return 'web3';
          if (id.includes('/src/cards/')) return 'cards';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    alias: { '@solana/web3.js': fileURLToPath(new URL('./node_modules/@solana/web3.js/lib/index.browser.esm.js', import.meta.url)) },
    coverage: {
      provider: 'v8',
      include: ['src/lease/**', 'src/chain/memo.ts'],
      thresholds: { lines: 100, functions: 100, statements: 100, branches: 95 },
    },
  },
});
