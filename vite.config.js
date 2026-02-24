import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: './', // Wichtig für GitHub Pages, damit relative Pfade funktionieren
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['vite.svg'],
      manifest: {
        name: 'Bundesbank Menü',
        short_name: 'Menü',
        description: 'Wochenkarte für Fraunhofer, Tafelwerk und Bio-City',
        theme_color: '#0f172a', // Passt zum Dark Mode (slate-900)
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [
          {
            src: 'vite.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'vite.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
})
