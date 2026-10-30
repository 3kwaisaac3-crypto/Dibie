// Tests de bout en bout (navigateur) de Dibiè.
// Utilise Microsoft Edge déjà installé sur le poste (channel « msedge ») :
// aucun navigateur n'est téléchargé. Lancement : npm run test:e2e
// Pour tester un serveur déjà lancé : $env:DIBIE_URL="http://localhost:3000"
import { defineConfig } from '@playwright/test'

const PORT = 4173
const externalUrl = process.env.DIBIE_URL

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: externalUrl || `http://localhost:${PORT}`,
    channel: 'msedge',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'ordinateur', use: { viewport: { width: 1280, height: 800 } } },
    { name: 'tablette', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'telephone', use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } }
  ],
  webServer: externalUrl ? undefined : {
    command: `node node_modules/vite/bin/vite.js --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Jamais de réutilisation : un serveur resté ouvert sur une autre branche
    // ferait tester la mauvaise version. Pour un serveur déjà lancé : DIBIE_URL.
    reuseExistingServer: false,
    env: { BROWSER: 'none' },
    timeout: 60_000
  }
})
