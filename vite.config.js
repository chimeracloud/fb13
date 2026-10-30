import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// One static page. No proxy, no env, no server. Tests run in jsdom because the
// parser uses DOMParser, the same API the browser gives the page.
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
