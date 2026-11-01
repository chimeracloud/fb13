import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// One static page. No proxy, no env, no server. Tests run in jsdom because the
// parser uses DOMParser, the same API the browser gives the page.
//
// Cloudflare Pages hands every build the commit it is building as
// CF_PAGES_COMMIT_SHA. Its first seven characters are stamped into the page as
// __FB13_COMMIT__ (see src/build.js) so the footer and the diagnostics can say
// which build they come from. Outside a Pages build it is empty.
const commit = String(process.env.CF_PAGES_COMMIT_SHA || '').slice(0, 7);

export default defineConfig({
  plugins: [react()],
  define: {
    __FB13_COMMIT__: JSON.stringify(commit),
  },
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
