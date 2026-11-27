// Quiz « définition → mot » (phase 7, lot A, moteur D ; docs/quiz.md) : partie
// complète toute juste, reprise d'une question ratée, double toucher, partie en
// anglais, élève de SIL-CP, affichage à 375 px et 320 px sans débordement.
// La série attendue est calculée par le module pur (src/utils/choiceGames.js)
// avec le vocabulaire lu sur le disque : l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { connecterEleve, suivreErreurs, vocabulaire, echapper } from './outils.js'
import { NIVEAU_EN } from '../src/data/niveaux.js'
import { libelleSujet } from '../src/data/sujets-matieres.js'
import { createDefinitionQuiz, quizSubjects, QUIZ_LEVELS } from '../src/utils/choiceGames.js'

const entreesDuNiveau = (niveau) => vocabulaire.filter(v => v.niveau_fr === niveau)
const entreesDuSujet = (niveau, sujet) => entreesDuNiveau(niveau).filter(v => v.sujet === sujet && v.actif !== false)
const quiz = (niveau, sujet, numero, langue = 'fr') => createDefinitionQuiz(entreesDuSujet(niveau, sujet), niveau, numero, langue)
const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
const premierSujetJouable = (niveau, langue = 'fr') => quizSubjects(entreesDuNiveau(niveau), niveau, langue).find(s => s.playable).subject

const lireScores = (page) => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('dibieScores')) || []).filter(s => s.gameType === 'quizDefinition'))

async function lancer(page, { niveau, sujet, numero, langue = 'fr' }) {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Quiz des définitions/ : /Definition quiz/ }).click()
  await expect(page.locator('.pairs-select__grid')).toBeVisible()
  await page.locator('.anagram-select__btn', { hasText: fr ? niveau : NIVEAU_EN[niveau] }).first().click()
  await page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(libelleSujet(sujet, langue))}$`) }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.quiz-board')).toBeVisible()
}

// Touche une cible jusqu'à obtenir l'effet attendu : juste après « Suivant »,
// les touchers sont ignorés pendant un court délai (double toucher, docs/quiz.md)
async function toucher(cible, effet) {
  await expect(async () => {
    await cible.click()
    await effet()
  }).toPass()
}
const repondu = (page) => () => expect(page.locator('.quiz-feedback')).toHaveText(/.+/, { timeout: 300 })

const option = (page, texte) => page.locator('.quiz-option', { hasText: new RegExp(`^${echapper(texte)}$`) })

// Vérifie la question affichée, puis touche une proposition (bonne ou fausse)
async function repondre(page, question, options, { juste = true } = {}) {
  await expect(page.locator('.quiz-question')).toHaveText(question.prompt)
  await expect(page.locator('.quiz-option')).toHaveText(options.map(o => o.text))
  const choisie = juste ? options.find(o => o.id === question.answerId) : options.find(o => o.id !== question.answerId)
  await toucher(option(page, choisie.text), repondu(page))
  return choisie
}

// C3 : deux essais. Rate une question : deux mauvaises propositions, puis la
// bonne réponse est montrée
const ESSAIE_ENCORE = 'Essaie encore : il te reste un essai.'
const laReponse = (q) => `La réponse : ${q.feedback.word} : ${q.feedback.definition}`
async function rater(page, question, options) {
  await expect(page.locator('.quiz-question')).toHaveText(question.prompt)
  const [premiere, seconde] = options.filter(o => o.id !== question.answerId)
  await toucher(option(page, premiere.text), () => expect(page.locator('.quiz-feedback')).toHaveText(ESSAIE_ENCORE, { timeout: 300 }))
  await toucher(option(page, seconde.text), () => expect(page.locator('.quiz-feedback')).toHaveText(laReponse(question), { timeout: 300 }))
  return [premiere, seconde]
}

const suivant = (page, fr = true) => page.getByRole('button', { name: fr ? 'Suivant' : 'Next' }).click()

test('Partie complète en français (CE1-CE2), toutes justes : pas de reprise, score enregistré une seule fois', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Quiz FR', niveau: 'CE1-CE2' })
  const numero = 4242
  const sujet = premierSujetJouable('CE1-CE2')
  const attendu = quiz('CE1-CE2', sujet, numero)
  expect(attendu.questions).toHaveLength(6)
  await lancer(page, { niveau: 'CE1-CE2', sujet, numero })
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · ${libelleSujet(sujet, 'fr')}`)
  for (const [i, q] of attendu.questions.entries()) {
    await expect(page.locator('.quiz-progress')).toHaveText(`Question ${i + 1} / 6`)
    await expect(page.locator('.quiz-next')).toBeDisabled()
    await repondre(page, q, q.options)
    await expect(page.locator('.quiz-feedback')).toHaveText('Bravo !')
    await suivant(page)
  }
  await expect(page.locator('.quiz-retry')).toHaveCount(0)
  await expect(page.locator('.anagram-finished__score')).toHaveText('60')
  await expect(page.locator('.quiz-recap li')).toHaveCount(6)
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 60, niveau: 'CE1-CE2', language: 'fr', subject: sujet, seed: numero, questionCount: 6, correctCount: 6, firstTryCount: 6, secondTryCount: 0 })
  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Quiz des définitions/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Bonne réponse au second essai (CE1-CE2) : 5 points, pas de reprise', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Quiz second', niveau: 'CE1-CE2' })
  const numero = 31
  const sujet = premierSujetJouable('CE1-CE2')
  const attendu = quiz('CE1-CE2', sujet, numero)
  await lancer(page, { niveau: 'CE1-CE2', sujet, numero })
  const [premiere, ...autres] = attendu.questions
  const fausse = await repondre(page, premiere, premiere.options, { juste: false })
  await expect(page.locator('.quiz-feedback')).toHaveText(ESSAIE_ENCORE)
  await expect(option(page, fausse.text)).toHaveClass(/quiz-option--wrong/)
  await expect(option(page, fausse.text)).toBeDisabled()
  await expect(page.locator('.quiz-next')).toBeDisabled()
  await toucher(option(page, premiere.feedback.word), () => expect(page.locator('.quiz-feedback')).toHaveText('Bravo, au deuxième essai !', { timeout: 300 }))
  await expect(option(page, premiere.feedback.word)).toHaveClass(/quiz-option--correct/)
  await suivant(page)
  for (const q of autres) {
    await repondre(page, q, q.options)
    await suivant(page)
  }
  await expect(page.locator('.quiz-retry')).toHaveCount(0)
  await expect(page.locator('.anagram-finished__score')).toHaveText('55')
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 55, correctCount: 6, firstTryCount: 5, secondTryCount: 1 })
  expect(erreurs).toEqual([])
})

test('Question ratée (CM1-CM2) : deux erreurs, bonne réponse montrée, reprise en fin de série sans points', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Quiz reprise', niveau: 'CM1-CM2' })
  const numero = 77
  const sujet = premierSujetJouable('CM1-CM2')
  const attendu = quiz('CM1-CM2', sujet, numero)
  expect(attendu.questions).toHaveLength(8)
  await lancer(page, { niveau: 'CM1-CM2', sujet, numero })
  const [premiere, ...autres] = attendu.questions
  const fausses = await rater(page, premiere, premiere.options)
  for (const f of fausses) await expect(option(page, f.text)).toHaveClass(/quiz-option--wrong/)
  await expect(option(page, premiere.feedback.word)).toHaveClass(/quiz-option--correct/)
  await expect(page.locator('.quiz-option:enabled')).toHaveCount(0)
  await suivant(page)
  for (const q of autres) {
    await repondre(page, q, q.options)
    await suivant(page)
  }
  // Reprise : la question ratée revient, propositions remélangées
  await expect(page.locator('.quiz-retry')).toBeVisible()
  await repondre(page, premiere, premiere.retryOptions)
  await suivant(page)
  await expect(page.locator('.anagram-finished__score')).toHaveText('70')
  await expect(page.locator('.quiz-recap__item--missed')).toHaveCount(1)
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 70, questionCount: 8, correctCount: 7, firstTryCount: 7, secondTryCount: 0 })
  expect(erreurs).toEqual([])
})

test('Double toucher : une seule réponse comptée, propositions désactivées', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Quiz double', niveau: 'CE1-CE2' })
  const numero = 9
  const sujet = premierSujetJouable('CE1-CE2')
  const attendu = quiz('CE1-CE2', sujet, numero)
  await lancer(page, { niveau: 'CE1-CE2', sujet, numero })
  const [premiere, ...autres] = attendu.questions
  await option(page, premiere.feedback.word).dblclick()
  const boutons = page.locator('.quiz-option')
  for (let i = 0; i < premiere.options.length; i++) await expect(boutons.nth(i)).toBeDisabled()
  await expect(page.locator('.quiz-feedback')).toHaveText('Bravo !')
  await suivant(page)
  for (const q of autres) {
    await repondre(page, q, q.options)
    await suivant(page)
  }
  await expect(page.locator('.anagram-finished__score')).toHaveText('60')
  expect(await lireScores(page)).toHaveLength(1)
  expect(erreurs).toEqual([])
})

test('Double toucher sur « Suivant » : la question suivante reste sans réponse, la série continue', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Quiz suivant', niveau: 'CE1-CE2' })
  const sujet = premierSujetJouable('CE1-CE2')
  // Chaque question, avec une mauvaise réponse (correction longue, puis mise
  // en page qui change), sur plusieurs numéros
  for (const numero of [1, 2, 3]) {
    const attendu = quiz('CE1-CE2', sujet, numero)
    await lancer(page, { niveau: 'CE1-CE2', sujet, numero })
    for (const [i, q] of attendu.questions.slice(0, -1).entries()) {
      await rater(page, q, q.options)
      const boite = await page.locator('.quiz-next').boundingBox()
      await page.locator('.quiz-next').click()
      await expect(page.locator('.quiz-progress')).toHaveText(`Question ${i + 2} / 6`)
      // Second toucher aussitôt, au même endroit (points répartis sur toute la
      // largeur et la hauteur de « Suivant ») : sans effet
      const points = [0.15, 0.5, 0.85].flatMap(fx => [0.25, 0.75].map(fy => ({
        x: boite.x + boite.width * fx, y: boite.y + boite.height * fy
      })))
      for (const { x, y } of points) await page.mouse.click(x, y)
      await expect(page.locator('.quiz-board'), `question ${i + 2}, n° ${numero}`).toBeVisible()
      await expect(page.locator('.quiz-progress')).toHaveText(`Question ${i + 2} / 6`)
      await expect(page.locator('.quiz-feedback')).toHaveText('')
      await expect(page.locator('.quiz-option:disabled')).toHaveCount(0)
    }
    // Retour à l'écran de choix, puis au tableau de bord
    await toucher(page.getByRole('button', { name: 'Retour' }), () => expect(page.locator('.anagram-select__back')).toBeVisible({ timeout: 300 }))
    await page.locator('.anagram-select__back').click()
  }
  expect(erreurs).toEqual([])
})

test('Partie en anglais (CE1-CE2) : définitions et mots anglais', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Quiz EN', niveau: 'CE1-CE2' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 2026
  const sujet = premierSujetJouable('CE1-CE2', 'en')
  const attendu = quiz('CE1-CE2', sujet, numero, 'en')
  await lancer(page, { niveau: 'CE1-CE2', sujet, numero, langue: 'en' })
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Game no. ${numero} · ${libelleSujet(sujet, 'en')}`)
  for (const q of attendu.questions) {
    expect(q.prompt).toBe(vocabulaire.find(v => v.id === q.id).def_en.trim())
    await repondre(page, q, q.options)
    await expect(page.locator('.quiz-feedback')).toHaveText('Well done!')
    await suivant(page, false)
  }
  await expect(page.locator('.anagram-finished__score')).toHaveText('60')
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ language: 'en', subject: sujet })
  expect(erreurs).toEqual([])
})

test('Élève de SIL-CP : le quiz s\'ouvre en SIL-CP, message « avec un parent », 3 questions (C1 révisé)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Petit quiz', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: /Quiz des définitions/ }).click()
  await expect(page.locator('.pairs-select__empty')).toHaveText('En SIL-CP, joue avec un parent : il te lit les définitions.')
  const niveaux = page.locator('[aria-labelledby="quiz-level-label"] .anagram-select__btn')
  await expect(niveaux).toHaveCount(QUIZ_LEVELS.length)
  await expect(niveaux).toHaveText([/^SIL-CP/, /^CE1-CE2/, /^CM1-CM2/])
  await expect(niveaux.first()).toHaveAttribute('aria-pressed', 'true')
  // Le message ne concerne que le niveau SIL-CP
  await niveaux.nth(1).click()
  await expect(page.locator('.pairs-select__empty')).toHaveCount(0)
  const grises = quizSubjects(entreesDuNiveau('CE1-CE2'), 'CE1-CE2', 'fr').filter(s => !s.playable)
  expect(grises.length).toBeGreaterThan(0)
  for (const { subject } of grises) {
    const bouton = page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(subject)}`) })
    await expect(bouton).toBeDisabled()
    await expect(bouton).toContainText('pas assez de mots')
  }
  expect(erreurs).toEqual([])
})

// Série dont la question la plus longue est la plus longue (toutes langues et
// niveaux, numéros 0 à 49 du premier sujet jouable, plus tous les sujets au n° 0)
function serieLaPlusLongue() {
  let meilleure = null
  for (const langue of ['fr', 'en']) {
    for (const niveau of QUIZ_LEVELS) {
      for (const { subject, playable } of quizSubjects(entreesDuNiveau(niveau), niveau, langue)) {
        if (!playable) continue
        for (let numero = 0; numero < 10; numero++) {
          const q = quiz(niveau, subject, numero, langue)
          const long = Math.max(...q.questions.map(x => x.prompt.length + x.options.reduce((n, o) => n + o.text.length, 0)))
          if (!meilleure || long > meilleure.long) meilleure = { langue, niveau, sujet: subject, numero, long }
        }
      }
    }
  }
  return meilleure
}

for (const largeur of [375, 320]) {
  test(`Téléphone ${largeur} px : question la plus longue sans débordement, cibles d'au moins 44 px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 })
    const { langue, niveau, sujet, numero } = serieLaPlusLongue()
    const attendu = quiz(niveau, sujet, numero, langue)
    const fr = langue === 'fr'
    await connecterEleve(page, { pseudo: `Tel quiz ${largeur}`, niveau })
    if (!fr) await page.getByRole('button', { name: 'English' }).click()
    await lancer(page, { niveau, sujet, numero, langue })
    expect(await deborde(page)).toBe(false)
    for (const q of attendu.questions) {
      await expect(page.locator('.quiz-question')).toHaveText(q.prompt)
      expect(await deborde(page)).toBe(false)
      const mesures = await page.locator('.quiz-option').evaluateAll(els => els.map(e => ({
        deborde: e.scrollWidth > e.clientWidth + 1, hauteur: e.getBoundingClientRect().height
      })))
      expect(mesures.every(m => !m.deborde)).toBe(true)
      expect(mesures.every(m => m.hauteur >= 44)).toBe(true)
      await toucher(option(page, q.feedback.word), repondu(page))
      await suivant(page, fr)
    }
    await expect(page.locator('.anagram-finished__score')).toBeVisible()
    expect(await deborde(page)).toBe(false)
  })
}
