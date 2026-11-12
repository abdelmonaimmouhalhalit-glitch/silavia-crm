import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Autorise le domaine des tunnels Cloudflare utilisés pour les démos
    // (le contrôle d'hôte de Vite bloque tout autre domaine).
    allowedHosts: ['localhost', '.trycloudflare.com'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    env: {
      // Valeurs factices : les appels réseau sont remplacés par un faux client
      // Supabase dans les tests de composants.
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'cle-anon-de-test',
    },
  },
})
