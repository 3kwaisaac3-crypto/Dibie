// Défaut n° 3 de l'audit : après une seule visite en ligne, l'application doit
// fonctionner hors ligne. Projet « build » seulement (voir playwright.config.js).
import { createServer } from 'node:http'
import { cpSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { creerProfil, jouerMotsMeles, totalAffiche, suivreErreurs } from './outils.js'

const DIST = fileURLToPath(new URL('../dist', import.meta.url))
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain'
}

// Attend que le service worker soit actif et contrôle la page
async function attendreServiceWorker(page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }))
    }
  })
}

// Copie du build servie par un petit serveur de test qu'on peut réellement
// arrêter. bloquer(chemin) vrai : connexion coupée pour ce fichier.
async function servirCopie(bloquer = () => false) {
  const dossier = mkdtempSync(join(tmpdir(), 'dibie-sw-'))
  cpSync(DIST, dossier, { recursive: true })
  const serveur = createServer((req, res) => {
    const chemin = new URL(req.url, 'http://x').pathname
    if (bloquer(chemin)) {
      req.socket.destroy()
      return
    }
    try {
      const contenu = readFileSync(join(dossier, chemin === '/' ? 'index.html' : chemin))
      res.writeHead(200, { 'Content-Type': TYPES[extname(chemin)] || 'text/html', 'Cache-Control': 'no-cache' })
      res.end(contenu)
    } catch {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise(resolve => serveur.listen(0, '127.0.0.1', resolve))
  return {
    dossier,
    serveur,
    adresse: `http://127.0.0.1:${serveur.address().port}/`,
    fermer: () => {
      serveur.closeAllConnections()
      serveur.close()
      rmSync(dossier, { recursive: true, force: true })
    }
  }
}

const nomsDesCaches = page => page.evaluate(() => caches.keys())

test('Une seule visite, coupure, rechargement, partie complète de mots mêlés, score enregistré', async ({ page, context }) => {
  const erreurs = suivreErreurs(page)
  await page.goto('/')
  await expect(page.locator('.profiles')).toBeVisible()
  await attendreServiceWorker(page)

  // Tous les fichiers du build sont déjà là
  const fichiers = await page.evaluate(async () => {
    const [nom] = await caches.keys()
    const cache = await caches.open(nom)
    return (await cache.keys()).map(r => new URL(r.url).pathname)
  })
  expect(fichiers).toEqual(expect.arrayContaining(['/', '/index.html', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png']))
  expect(fichiers.some(f => /^\/assets\/.*\.js$/.test(f))).toBe(true)
  expect(fichiers.some(f => /^\/assets\/.*\.css$/.test(f))).toBe(true)

  await context.setOffline(true)
  await page.reload()
  await expect(page.locator('.offline-banner')).toBeVisible()
  await creerProfil(page, { pseudo: 'Horsligne', niveau: 'SIL-CP' })

  const mots = await jouerMotsMeles(page)
  await page.locator('.wordsearch-select__back').click()
  await totalAffiche(page, mots * 10)

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ gameType: 'wordsearch', score: mots * 10, niveau: 'SIL-CP' })

  // Toujours hors ligne : session et score après rechargement ; mots croisés disponibles
  await page.reload()
  await expect(page.locator('.student-dashboard')).toBeVisible()
  await totalAffiche(page, mots * 10)
  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  await page.getByRole('button', { name: 'Commencer' }).click()
  await expect(page.locator('.eclipse-board')).toBeVisible()
  expect(erreurs, erreurs.join('\n')).toEqual([])
  await context.setOffline(false)
})

test('Manifeste et icônes déclarés, disponibles hors ligne', async ({ page, context }) => {
  await page.goto('/')
  await attendreServiceWorker(page)
  const adresse = await page.locator('link[rel="manifest"]').getAttribute('href')
  await context.setOffline(true)
  const resultat = await page.evaluate(async url => {
    const manifeste = await (await fetch(url)).json()
    const icones = await Promise.all(manifeste.icons.map(async i => {
      const r = await fetch(i.src)
      return { src: i.src, sizes: i.sizes, ok: r.ok, type: r.headers.get('content-type') }
    }))
    return { nom: manifeste.short_name, debut: manifeste.start_url, affichage: manifeste.display, icones }
  }, adresse)
  await context.setOffline(false)
  expect(resultat).toMatchObject({ nom: 'DIBIÈ', debut: '/', affichage: 'standalone' })
  expect(resultat.icones.every(i => i.ok)).toBe(true)
  expect(resultat.icones.map(i => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']))
})

// Nouvelle version simulée sur une copie du build, servie par un petit serveur
// de test qu'on peut réellement arrêter (aucune dépendance au mode hors ligne du navigateur).
test('Nouvelle version : remplace l\'ancien cache, servie aussitôt, puis disponible serveur arrêté', async ({ page }) => {
  const { dossier, serveur, adresse, fermer } = await servirCopie()

  try {
    await page.goto(adresse)
    await attendreServiceWorker(page)
    const [ancien, ...autres] = await nomsDesCaches(page)
    expect(autres).toEqual([])
    expect(ancien).toMatch(/^dibie-[0-9a-f]{12}$/)
    await creerProfil(page, { pseudo: 'Fidele' })

    // Publication de la nouvelle version : script, liste et page changent
    const script = join(dossier, 'service-worker.js')
    const nouveau = 'dibie-000000000002'
    writeFileSync(join(dossier, 'version.txt'), '2')
    writeFileSync(script, readFileSync(script, 'utf8')
      .replace(ancien, nouveau)
      .replace('const urlsToCache = ["/",', 'const urlsToCache = ["/","/version.txt",'))
    const index = join(dossier, 'index.html')
    writeFileSync(index, readFileSync(index, 'utf8').replace('<head>', '<head><meta name="version-test" content="2">'))

    // Première visite suivante : page nouvelle sans attendre le service worker
    await page.reload()
    await expect(page.locator('meta[name="version-test"]')).toHaveAttribute('content', '2')
    await expect.poll(() => nomsDesCaches(page), { timeout: 20_000 }).toEqual([nouveau])
    await expect(page.locator('.student-dashboard')).toBeVisible()

    // Serveur vraiment arrêté : la nouvelle version répond, les données restent
    await new Promise(resolve => {
      serveur.close(resolve)
      serveur.closeAllConnections()
    })
    await page.reload()
    await expect(page.locator('meta[name="version-test"]')).toHaveAttribute('content', '2')
    await expect(page.locator('.student-dashboard__user')).toContainText('Fidele')
    expect(await page.evaluate(() => fetch('/version.txt').then(r => r.text()))).toBe('2')
  } finally {
    fermer()
  }
})

// Revue de la phase 0 : l'ancien service worker écrivait le nouveau HTML dans
// son cache ; si la mise à jour s'interrompait, page vide hors ligne.
test('Mise à jour interrompue : la v1 reste entière hors ligne ; réseau rétabli, seule la v2 reste', async ({ page, context }) => {
  let bloque = false
  let tentativesV2 = 0
  const { dossier, adresse, fermer } = await servirCopie(chemin => {
    if (!bloque || !chemin.startsWith('/assets/')) return false
    if (chemin.includes('indexV2')) tentativesV2++
    return true
  })
  try {
    await page.goto(adresse)
    await attendreServiceWorker(page)
    const [v1] = await nomsDesCaches(page)

    // Publication d'une v2 aux fichiers renommés, dont les /assets/ échouent
    const script = join(dossier, 'service-worker.js')
    const index = join(dossier, 'index.html')
    let textesScript = readFileSync(script, 'utf8')
    let texteIndex = readFileSync(index, 'utf8')
    for (const fichier of readdirSync(join(dossier, 'assets'))) {
      const renomme = fichier.replace('index', 'indexV2')
      renameSync(join(dossier, 'assets', fichier), join(dossier, 'assets', renomme))
      textesScript = textesScript.split(fichier).join(renomme)
      texteIndex = texteIndex.split(fichier).join(renomme)
    }
    const v2 = 'dibie-000000000002'
    writeFileSync(script, textesScript.replace(v1, v2))
    writeFileSync(index, texteIndex)
    bloque = true

    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {})
    // Preuve que la v2 a bien été tentée : ses fichiers ont été demandés, et coupés
    await expect.poll(() => tentativesV2, { timeout: 20_000 }).toBeGreaterThan(0)
    // Attend l'échec de l'installation de la v2
    await expect.poll(() => page.evaluate(async () => {
      const r = await navigator.serviceWorker.getRegistration()
      return Boolean(r && !r.installing)
    }), { timeout: 20_000 }).toBe(true)

    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('.profiles')).toBeVisible()
    expect(await page.locator('script[src]').first().getAttribute('src')).not.toContain('indexV2')

    await context.setOffline(false)
    bloque = false
    await page.reload()
    await expect(page.locator('.profiles')).toBeVisible()
    expect(await page.locator('script[src]').first().getAttribute('src')).toContain('indexV2')
    await expect.poll(() => nomsDesCaches(page), { timeout: 20_000 }).toEqual([v2])

    // La v2 complète répond hors ligne
    await context.setOffline(true)
    await page.reload()
    await expect(page.locator('.profiles')).toBeVisible()
    expect(await page.locator('script[src]').first().getAttribute('src')).toContain('indexV2')
    await context.setOffline(false)
  } finally {
    fermer()
  }
})

test('Script du service worker construit : version et liste réécrites', async ({ request }) => {
  const script = await (await request.get('/service-worker.js')).text()
  expect(script).not.toContain('dibie-dev')
  expect(script).toMatch(/const CACHE_NAME = "dibie-[0-9a-f]{12}"/)
  expect(script).toMatch(/const urlsToCache = \[.*"\/assets\/.*\.js"/)
})
