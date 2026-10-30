// Outils communs aux tests de bout en bout : connexion simulée, navigation
// jusqu'aux mots croisés, contrôle d'une grille affichée.
import { readFileSync } from 'node:fs'
import { expect } from '@playwright/test'

export const NIVEAUX = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
export const TYPES = ['Français', 'Anglais', 'Bilingue']

// Vocabulaire lu sur le disque, tel que le serveur le sert
export const vocabulaire = JSON.parse(
  readFileSync(new URL('../src/data/vocabulaire.json', import.meta.url), 'utf8')
)

// Ressources absentes déjà connues, signalées dans le rapport d'audit du
// 2026-10-29 et tolérées ici pour ne pas masquer les autres erreurs :
// A-04 : aucune icône de site déclarée, le navigateur demande /favicon.ico (404).
const ABSENCES_CONNUES = [/\/favicon\.ico$/]

// Collecte les erreurs JavaScript et les ressources en échec (à vérifier en
// fin de test). Le message générique « Failed to load resource » de la console
// est remplacé par l'adresse exacte de la ressource, connue par la réponse.
export function suivreErreurs(page) {
  const erreurs = []
  page.on('pageerror', e => erreurs.push(e.message))
  page.on('console', m => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) erreurs.push(m.text())
  })
  page.on('requestfailed', r => erreurs.push(`échec de chargement : ${r.url()}`))
  page.on('response', r => {
    if (r.status() >= 400 && !ABSENCES_CONNUES.some(re => re.test(r.url()))) {
      erreurs.push(`ressource ${r.status()} : ${r.url()}`)
    }
  })
  return erreurs
}

// Connexion simulée localement (compte de test, aucune donnée réelle)
export async function connecterEleve(page) {
  await page.goto('/')
  await page.getByPlaceholder('Email').fill('eleve.e2e@dibie.test')
  await page.getByPlaceholder('Mot de passe').fill('e2e-test-local')
  await page.getByRole('button', { name: 'Connexion' }).click()
  await page.getByRole('button', { name: /Élève/ }).click()
  await expect(page.getByRole('button', { name: /Mots Croisés/ })).toBeVisible()
}

export async function ouvrirMotsCroises(page) {
  await connecterEleve(page)
  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  await expect(page.getByRole('heading', { name: 'Mots croisés' })).toBeVisible()
}

// Choisit type, niveau et sujet sur l'écran de choix
export async function choisir(page, { type, niveau, sujet }) {
  const choix = page.locator('.crossword-select')
  await choix.getByRole('button', { name: type, exact: true }).click()
  await choix.getByRole('button', { name: niveau, exact: true }).click()
  await page.locator('.crossword-select__grid button', { hasText: new RegExp(`^${echapper(sujet)}`) }).first().click()
}

export function echapper(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Lit la grille affichée et vérifie sa structure et ses définitions.
// Renvoie { mots, anomalies } ; les anomalies sont des textes lisibles.
export async function controlerGrille(page, { type, niveau, sujet }) {
  const lue = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.eclipse-board .eclipse-row')]
      .map(r => [...r.querySelectorAll('.eclipse-cell')].map(c => ({
        ouverte: !c.classList.contains('empty'),
        num: c.querySelector('.eclipse-number')?.textContent.trim() || null
      })))
    const indices = []
    document.querySelectorAll('.eclipse-clues .clues-col').forEach((col, i) => {
      col.querySelectorAll('.clue').forEach(cl => {
        const t = cl.querySelector('.clue-text').textContent.trim()
        const m = t.match(/^(.*)\s\((\d+)\)$/)
        indices.push({
          num: cl.querySelector('.clue-num').textContent.trim(),
          sens: i === 0 ? 'across' : 'down',
          def: m ? m[1] : t,
          long: m ? Number(m[2]) : null
        })
      })
    })
    return { rows, indices }
  })

  const { rows, indices } = lue
  const H = rows.length, W = rows[0]?.length || 0
  const ouverte = (r, c) => r >= 0 && c >= 0 && r < H && c < W && rows[r][c].ouverte
  const depart = {}
  rows.forEach((row, r) => row.forEach((cell, c) => { if (cell.num) depart[cell.num] = [r, c] }))
  const champs = type === 'Anglais' ? ['def_en'] : type === 'Français' ? ['def_fr'] : ['def_fr', 'def_en']
  const entrees = vocabulaire.filter(e => e.niveau_fr === niveau && e.sujet === sujet && e.actif !== false)
  const anomalies = []
  const couvertes = new Set()

  for (const k of indices) {
    const p = depart[k.num]
    if (!p) { anomalies.push(`indice ${k.num} sans case numérotée`); continue }
    const [dr, dc] = k.sens === 'across' ? [0, 1] : [1, 0]
    if (ouverte(p[0] - dr, p[1] - dc)) anomalies.push(`indice ${k.num} : case ouverte avant le début`)
    let L = 0, r = p[0], c = p[1]
    while (ouverte(r, c)) { couvertes.add(`${r},${c}`); L++; r += dr; c += dc }
    if (L !== k.long) anomalies.push(`indice ${k.num} : ${L} cases pour (${k.long})`)
    if (!entrees.some(e => champs.some(f => e[f] === k.def))) {
      anomalies.push(`indice ${k.num} : définition absente du sujet « ${k.def.slice(0, 60)} »`)
    }
  }
  rows.forEach((row, r) => row.forEach((cell, c) => {
    if (cell.ouverte && !couvertes.has(`${r},${c}`)) anomalies.push(`case ${r + 1},${c + 1} hors de tout mot`)
  }))
  if (indices.length < 2) anomalies.push('moins de 2 mots placés')
  return { mots: indices.length, anomalies }
}
