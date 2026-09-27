import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'
import { VitePWA } from 'vite-plugin-pwa'

const versionFilePath = path.resolve(__dirname, 'version.json')

function getOrBumpVersion(isBuild: boolean) {
  let data = {
    major: 1,
    minor: 0,
    build: 1,
    version: 'v.1.0.01',
    buildTime: new Date().toISOString(),
  }

  if (fs.existsSync(versionFilePath)) {
    try {
      const raw = fs.readFileSync(versionFilePath, 'utf-8')
      data = { ...data, ...JSON.parse(raw) }
    } catch {}
  }

  // If in build mode and hasn't been bumped yet by scripts/bump-version.js in this process
  if (isBuild && !process.env.VITE_VERSION_BUMPED) {
    process.env.VITE_VERSION_BUMPED = 'true'
    data.build = typeof data.build === 'number' && Number.isFinite(data.build) ? data.build + 1 : 1
    const buildStr = data.build < 100 ? String(data.build).padStart(2, '0') : String(data.build)
    data.version = `v.${data.major}.${data.minor}.${buildStr}`
    data.buildTime = new Date().toISOString()
    try {
      fs.writeFileSync(versionFilePath, JSON.stringify(data, null, 2) + '\n', 'utf-8')
      console.log(`[vite] Auto-bumped version to ${data.version} (build #${data.build})`)
    } catch {}
  }

  return data
}

export const APP_VERSION = getOrBumpVersion(false).version

function versionJsonPlugin(version: string, buildTime: string): Plugin {
  return {
    name: 'version-json-plugin',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          {
            version,
            buildTime,
          },
          null,
          2
        ),
      })
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/version.json' || req.url === '/app/version.json') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
          res.end(
            JSON.stringify({
              version,
              buildTime,
            })
          )
          return
        }
        next()
      })
    },
  }
}

export default defineConfig(({ command }) => {
  const isBuild = command === 'build'
  const versionInfo = getOrBumpVersion(isBuild)
  const appVersion = versionInfo.version
  const appBuildTime = versionInfo.buildTime

  return {
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_TIME__: JSON.stringify(appBuildTime),
    },
    plugins: [
      react(),
      versionJsonPlugin(appVersion, appBuildTime),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'service-worker.ts',
      includeAssets: ['icons/icon-180.png'],
      cleanupOutdatedCaches: true,
      manifest: {
        name: 'XPer Finance',
        short_name: 'XPer',
        description: 'Personal Finance Manager',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0d1017',
        orientation: 'portrait',
        icons: [
          {
            src: '/app/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/app/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['**/version.json'],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
        globIgnores: ['**/version.json'],
        navigateFallback: '/app/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  publicDir: 'public',
  server: {
    port: 3001,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  build: {
    outDir: '../web/public/app',
    sourcemap: true,
    emptyOutDir: true,
  },
  base: '/app/',
  }
})
