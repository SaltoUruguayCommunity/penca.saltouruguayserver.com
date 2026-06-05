// @ts-check
import { defineConfig, envField } from 'astro/config';
import preact from '@astrojs/preact';
import auth from 'auth-astro';
import tailwindcss from '@tailwindcss/vite';

import vercel from '@astrojs/vercel';

export default defineConfig({
  output: 'server',

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    preact({ compat: true }),
    auth(),
  ],

  env: {
    schema: {
      AUTH_SECRET: envField.string({ context: 'server', access: 'secret' }),
      SUS_OAUTH_CLIENT_ID: envField.string({ context: 'server', access: 'secret' }),
      SUS_OAUTH_CLIENT_SECRET: envField.string({ context: 'server', access: 'secret' }),
      SUS_OAUTH_ISSUER: envField.string({ context: 'server', access: 'public', default: 'https://saltouruguayserver.com' }),
      TURSO_DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
      TURSO_AUTH_TOKEN: envField.string({ context: 'server', access: 'secret' }),
      FOOTBALL_DATA_API_KEY: envField.string({ context: 'server', access: 'secret' }),
      CRON_SECRET: envField.string({ context: 'server', access: 'secret' }),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 3210
  },
  adapter: vercel(),
});