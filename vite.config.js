import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Tous les fichiers d'un dossier, chemins triés pour un résultat reproductible
function listFiles(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap(e => (e.isDirectory() ? listFiles(join(dir, e.name)) : [join(dir, e.name)]))
    .sort()
}

// Réécrit dist/service-worker.js à partir de public/service-worker.js, avec la
// liste des fichiers du build et un nom de cache tiré de leur contenu : toute
// nouvelle version change le script, donc le navigateur la détecte.
function dibieServiceWorker() {
  let outDir
  let template
  return {
    name: 'dibie-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      template = join(config.publicDir, 'service-worker.js')
    },
    closeBundle() {
      const source = readFileSync(template, 'utf8')
      const output = join(outDir, 'service-worker.js')
      const files = listFiles(outDir).filter(file => file !== output)
      const hash = createHash('sha256').update(source)
      const urls = ['/']
      for (const file of files) {
        const url = `/${relative(outDir, file).split(sep).join('/')}`
        urls.push(url)
        hash.update(url).update(readFileSync(file))
      }
      const cacheName = `dibie-${hash.digest('hex').slice(0, 12)}`

      const cacheLine = /^const CACHE_NAME = .*$/m
      const urlsLine = /^const urlsToCache = .*$/m
      if (!cacheLine.test(source) || !urlsLine.test(source)) {
        throw new Error('public/service-worker.js : lignes CACHE_NAME ou urlsToCache introuvables')
      }
      writeFileSync(output, source
        .replace(cacheLine, `const CACHE_NAME = ${JSON.stringify(cacheName)}`)
        .replace(urlsLine, `const urlsToCache = ${JSON.stringify(urls)}`))
    }
  }
}

export default defineConfig({
  plugins: [react(), dibieServiceWorker()],
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
