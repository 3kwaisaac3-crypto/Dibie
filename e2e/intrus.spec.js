// L'intrus (phase 7, lot C, moteur D ; docs/intrus.md) : élève de SIL-CP,
// niveau sans item validé, parties complètes CE1-CE2 et CM1-CM2 avec reprise,
// double toucher sur « Suivant », partie en anglais, affichage à 375 et 320 px.
// La partie attendue est calculée par le module pur (src/utils/intrusGame.js)
// avec le fichier lu sur le disque : l'écran doit montrer la même.
// Les parties complètes demandent des items validés par Isaac (P6) : elles
// sont sautées tant qu'un niveau n'en a pas assez (docs/intrus.md §8 et §10).
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { connecterEleve, suivreErreurs, echapper } from './outils.js'
import { NIVEAU_EN } from '../src/data/niveaux.js'
import { createIntrusGame, intrusPlayableItems, INTRUS_LEVELS, ITEMS_PER_GAME } from '../src/utils/intrusGame.js'

const collection = JSON.parse(readFileSync(new URL('../src/data/intrus.json', import.meta.url), 'utf8'))
const partie = (niveau, numero, langue = 'fr') => createIntrusGame(collection, niveau, numero, langue)
const jouables = (niveau, langue = 'fr') => intrusPlayableItems(collection, niveau, langue).length
const assezPour = (niveau, langue = 'fr') => jouables(niveau, langue) >= ITEMS_PER_GAME[niveau]
const ATTENTE = 'pas assez d\'items validés par Isaac pour une partie complète (docs/intrus.md §8)'
const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
const lireScores = (page) => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('dibieScores')) || []).filter(s => s.gameType === 'intrus'))

const carte = (page, fr = true) => page.getByRole('button', { name: fr ? /L'intrus/ : /Odd one out/ })

async function lancer(page, { niveau, numero, langue = 'fr' }) {
  const fr = langue === 'fr'
  await carte(page, fr).click()
  await page.locator('.anagram-select__btn', { hasText: fr ? niveau : NIVEAU_EN[niveau] }).first().click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.quiz-board')).toBeVisible()
}

// Juste après « Suivant », les touchers sont ignorés pendant un court délai
async function toucher(cible, effet) {
  await expect(async () => {
    await cible.click()
    await effet()
  }).toPass()
}
const repondu = (page) => () => expect(page.locator('.quiz-feedback')).toHaveText(/.+/, { timeout: 300 })
const option = (page, texte) => page.locator('.quiz-option', { hasText: new RegExp(`^${echapper(texte)}$`) })
const bonne = (q, options) => options.find(o => o.id === q.answerId)

async function repondre(page, q, options) {
  await expect(page.locator('.quiz-question')).toHaveText(q.prompt)
  await expect(page.locator('.quiz-option')).toHaveText(options.map(o => o.text))
  await toucher(option(page, bonne(q, options).text), repondu(page))
}

const ESSAIE_ENCORE = 'Essaie encore : il te reste un essai.'
async function rater(page, q, options, attendu) {
  await expect(page.locator('.quiz-question')).toHaveText(q.prompt)
  const [premiere, seconde] = options.filter(o => o.id !== q.answerId)
  await toucher(option(page, premiere.text), () => expect(page.locator('.quiz-feedback')).toHaveText(ESSAIE_ENCORE, { timeout: 300 }))
  await toucher(option(page, seconde.text), () => expect(page.locator('.quiz-feedback')).toHaveText(attendu, { timeout: 300 }))
}

const suivant = (page, fr = true) => page.getByRole('button', { name: fr ? 'Suivant' : 'Next' }).click()

test('Élève de SIL-CP : carte visible, message, pas de niveau SIL-CP', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Petit intrus', niveau: 'SIL-CP' })
  await carte(page).click()
  await expect(page.locator('.pairs-select__empty').first()).toHaveText('Ce jeu commence au CE1-CE2 : il faut lire des phrases. Tu peux essayer avec un adulte.')
  const niveaux = page.locator('[aria-labelledby="intrus-level-label"] .anagram-select__btn')
  await expect(niveaux).toHaveCount(INTRUS_LEVELS.length)
  await expect(niveaux).toHaveText([/^CE1-CE2/, /^CM1-CM2/])
  await expect(niveaux.first()).toHaveAttribute('aria-pressed', 'true')
  expect(erreurs).toEqual([])
})

test('Niveau sans item validé : message, « Commencer » désactivé', async ({ page }) => {
  test.skip(jouables('CE1-CE2') > 0, 'le CE1-CE2 a des items validés')
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Intrus vide', niveau: 'CE1-CE2' })
  await carte(page).click()
  await expect(page.locator('.intrus-empty')).toHaveText('Pas encore d\'intrus validés pour ce niveau.')
  await expect(page.locator('.anagram-select__start')).toBeDisabled()
  await page.locator('.anagram-select__back').click()
  await page.getByRole('button', { name: 'English' }).click()
  await carte(page, false).click()
  await expect(page.locator('.intrus-empty')).toHaveText('No validated odd-one-out items for this level yet.')
  expect(erreurs).toEqual([])
})

test('Partie complète CE1-CE2, toutes justes : raison affichée, score enregistré une seule fois', async ({ page }) => {
  test.skip(!assezPour('CE1-CE2'), ATTENTE)
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Intrus CE', niveau: 'CE1-CE2' })
  const numero = 4242
  const attendu = partie('CE1-CE2', numero)
  expect(attendu.questions).toHaveLength(6)
  await lancer(page, { niveau: 'CE1-CE2', numero })
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero}`)
  for (const [i, q] of attendu.questions.entries()) {
    await expect(page.locator('.quiz-progress')).toHaveText(`Question ${i + 1} / 6`)
    await repondre(page, q, q.options)
    await expect(page.locator('.quiz-feedback')).toHaveText('Bravo !')
    await expect(page.locator('.intrus-reason')).toHaveText(q.feedback.raison)
    await suivant(page)
  }
  await expect(page.locator('.quiz-retry')).toHaveCount(0)
  await expect(page.locator('.anagram-finished__score')).toHaveText('60')
  await expect(page.locator('.quiz-recap li')).toHaveCount(6)
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 60, niveau: 'CE1-CE2', language: 'fr', seed: numero, itemCount: 6, questionCount: 6, correctCount: 6, firstTryCount: 6, secondTryCount: 0 })
  expect(erreurs).toEqual([])
})

test('CM1-CM2 : intrus raté, « pourquoi ? » qui le nomme, reprise sans points', async ({ page }) => {
  test.skip(!assezPour('CM1-CM2'), ATTENTE)
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Intrus CM', niveau: 'CM1-CM2' })
  const numero = 77
  const attendu = partie('CM1-CM2', numero)
  expect(attendu.questions).toHaveLength(12)
  await lancer(page, { niveau: 'CM1-CM2', numero })
  const [intrus, pourquoi, ...autres] = attendu.questions
  await rater(page, intrus, intrus.options, `L'intrus était : ${intrus.feedback.intrus}`)
  await expect(page.locator('.intrus-reason')).toHaveText('')
  await suivant(page)
  await expect(page.locator('.quiz-question')).toContainText(intrus.feedback.intrus)
  await repondre(page, pourquoi, pourquoi.options)
  await expect(page.locator('.intrus-reason')).toHaveText(pourquoi.feedback.raison)
  await suivant(page)
  for (const q of autres) {
    await repondre(page, q, q.options)
    await suivant(page)
  }
  await expect(page.locator('.quiz-retry')).toBeVisible()
  await repondre(page, intrus, intrus.retryOptions)
  await suivant(page)
  await expect(page.locator('.anagram-finished__score')).toHaveText('110')
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 110, itemCount: 6, questionCount: 12, correctCount: 11, firstTryCount: 11, secondTryCount: 0 })
  expect(erreurs).toEqual([])
})

test('Double toucher sur « Suivant » entre l’intrus et « pourquoi ? » : sans réponse', async ({ page }) => {
  test.skip(!assezPour('CM1-CM2'), ATTENTE)
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Intrus double', niveau: 'CM1-CM2' })
  const numero = 5
  const [intrus] = partie('CM1-CM2', numero).questions
  await lancer(page, { niveau: 'CM1-CM2', numero })
  await rater(page, intrus, intrus.options, `L'intrus était : ${intrus.feedback.intrus}`)
  const boite = await page.locator('.quiz-next').boundingBox()
  await page.locator('.quiz-next').click()
  await expect(page.locator('.quiz-progress')).toHaveText('Question 2 / 12')
  for (const fx of [0.15, 0.5, 0.85]) {
    for (const fy of [0.25, 0.75]) await page.mouse.click(boite.x + boite.width * fx, boite.y + boite.height * fy)
  }
  await expect(page.locator('.quiz-board')).toBeVisible()
  await expect(page.locator('.quiz-progress')).toHaveText('Question 2 / 12')
  await expect(page.locator('.quiz-feedback')).toHaveText('')
  await expect(page.locator('.quiz-option:disabled')).toHaveCount(0)
  expect(erreurs).toEqual([])
})

test('Partie en anglais (CE1-CE2) : consignes et mots anglais', async ({ page }) => {
  test.skip(!assezPour('CE1-CE2', 'en'), ATTENTE)
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Intrus EN', niveau: 'CE1-CE2' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 2026
  const attendu = partie('CE1-CE2', numero, 'en')
  await lancer(page, { niveau: 'CE1-CE2', numero, langue: 'en' })
  for (const q of attendu.questions) {
    expect(q.prompt).toBe(collection.items.find(i => i.id === q.itemId).en.consigne)
    await repondre(page, q, q.options)
    await expect(page.locator('.quiz-feedback')).toHaveText('Well done!')
    await suivant(page, false)
  }
  await expect(page.locator('.anagram-finished__score')).toHaveText('60')
  expect((await lireScores(page))[0]).toMatchObject({ language: 'en' })
  expect(erreurs).toEqual([])
})

for (const largeur of [375, 320]) {
  test(`Téléphone ${largeur} px : CM1-CM2 sans débordement, cibles d'au moins 44 px`, async ({ page }) => {
    test.skip(!assezPour('CM1-CM2'), ATTENTE)
    await page.setViewportSize({ width: largeur, height: 700 })
    const numero = 3
    const attendu = partie('CM1-CM2', numero)
    await connecterEleve(page, { pseudo: `Tel intrus ${largeur}`, niveau: 'CM1-CM2' })
    await lancer(page, { niveau: 'CM1-CM2', numero })
    for (const q of attendu.questions) {
      await expect(page.locator('.quiz-question')).toHaveText(q.prompt)
      expect(await deborde(page)).toBe(false)
      const hauteurs = await page.locator('.quiz-option').evaluateAll(els => els.map(e => e.getBoundingClientRect().height))
      expect(hauteurs.every(h => h >= 44)).toBe(true)
      await toucher(option(page, bonne(q, q.options).text), repondu(page))
      expect(await deborde(page)).toBe(false)
      await suivant(page)
    }
    await expect(page.locator('.anagram-finished__score')).toBeVisible()
    expect(await deborde(page)).toBe(false)
  })
}
