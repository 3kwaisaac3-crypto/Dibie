// Mot ↔ définition (lot C de la phase 4, jeu L4, moteur C « Paires ») : parties
// complètes en français et en anglais, mauvaise paire, indice (traduction du
// mot) après 2 erreurs, « Voir la réponse » après 3, score enregistré une seule
// fois, élève de SIL-CP, affichage à 375 px et 320 px sans débordement.
// La partie attendue est calculée par le module pur (src/utils/pairsGame.js)
// avec le vocabulaire lu sur le disque : l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { connecterEleve, suivreErreurs, totalAffiche, vocabulaire, echapper } from './outils.js'
import { NIVEAU_EN } from '../src/data/niveaux.js'
import { libelleSujet } from '../src/data/sujets-matieres.js'
import { createDefinitionGame, definitionSubjects, DEFINITION_LEVELS } from '../src/utils/pairsGame.js'

const entreesDuSujet = (niveau, sujet) => vocabulaire.filter(v => v.niveau_fr === niveau && v.sujet === sujet && v.actif !== false)
const partie = (niveau, sujet, numero, langue = 'fr') => createDefinitionGame(entreesDuSujet(niveau, sujet), niveau, numero, langue)
const paire = (p, id) => p.pairs.find(x => x.id === id)
const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
const COLONNES = ['.pairs-column--words', '.pairs-column--definitions']

// Élément d'une colonne (0 = mots, 1 = définitions), par son texte exact
const element = (page, colonne, texte) => page.locator(COLONNES[colonne])
  .locator('.pairs-item', { has: page.locator('.pairs-item__text', { hasText: new RegExp(`^${echapper(texte)}$`) }) })

async function lancer(page, { niveau, sujet, numero, langue = 'fr' }) {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Mot ↔ définition/ : /Word ↔ definition/ }).click()
  await expect(page.locator('.pairs-select__grid')).toBeVisible()
  await page.locator('.anagram-select__btn', { hasText: fr ? niveau : NIVEAU_EN[niveau] }).first().click()
  // Sujet jouable : son bouton porte exactement son nom (« Nombres » et non « Nombres décimaux »)
  await page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(libelleSujet(sujet, langue))}$`) }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.pairs-board--definitions')).toBeVisible()
}

async function controlerColonnes(page, attendue) {
  expect(await page.locator(COLONNES[0]).locator('.pairs-item__text').allTextContents())
    .toEqual(attendue.leftOrder.map(id => paire(attendue, id).left.text))
  expect(await page.locator(COLONNES[1]).locator('.pairs-item__text').allTextContents())
    .toEqual(attendue.rightOrder.map(id => paire(attendue, id).right.text))
}

async function relierTout(page, attendue, deja = []) {
  for (const id of attendue.leftOrder) {
    if (deja.includes(id)) continue
    const p = paire(attendue, id)
    await element(page, 0, p.left.text).click()
    await element(page, 1, p.right.text).click()
    await expect(element(page, 0, p.left.text)).toBeDisabled()
    await expect(element(page, 1, p.right.text)).toBeDisabled()
  }
}

const lireScores = (page) => page.evaluate(() =>
  (JSON.parse(localStorage.getItem('dibieScores')) || []).filter(s => s.gameType === 'pairsDefinition'))

test('Partie complète en français : mots en majuscules, définitions, score enregistré une seule fois dès la dernière paire', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Definitions FR', niveau: 'CE1-CE2' })
  const numero = 4242
  const attendue = partie('CE1-CE2', 'Commerce', numero)
  expect(attendue.pairs).toHaveLength(4)
  await lancer(page, { niveau: 'CE1-CE2', sujet: 'Commerce', numero })
  await expect(page.locator('.pairs-column__title')).toHaveText(['Mots', 'Définitions'])
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · Commerce`)
  await controlerColonnes(page, attendue)
  for (const p of attendue.pairs) {
    expect(p.left.text).toBe(p.left.text.toLocaleUpperCase('fr-FR'))
    expect(p.right.text).toBe(vocabulaire.find(v => v.id === p.id).def_fr.trim())
  }

  // Définition touchée d'abord, puis le mot : même couleur et même numéro
  const premiere = paire(attendue, attendue.rightOrder[0])
  await element(page, 1, premiere.right.text).click()
  await expect(element(page, 1, premiere.right.text)).toHaveAttribute('aria-pressed', 'true')
  await element(page, 0, premiere.left.text).click()
  await expect(element(page, 0, premiere.left.text)).toHaveClass(/pairs-color-0/)
  await expect(element(page, 1, premiere.right.text)).toHaveClass(/pairs-color-0/)
  await expect(page.locator('.pairs-game__feedback')).toHaveText(`Bravo ! ${premiere.left.text}`)
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 1 / 4 · 10 points')

  // Avant la dernière paire : rien d'enregistré ; dès la dernière : un score
  const derniere = attendue.leftOrder.filter(id => id !== premiere.id).at(-1)
  await relierTout(page, attendue, [premiere.id, derniere])
  expect(await lireScores(page)).toHaveLength(0)
  await relierTout(page, attendue, attendue.leftOrder.filter(id => id !== derniere))
  await expect.poll(async () => (await lireScores(page)).length).toBe(1)
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 4 / 4 · 40 points')

  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('40')
  await expect(page.locator('.pairs-recap li')).toHaveCount(4)
  await expect(page.locator('.pairs-recap li').first()).toContainText(`${paire(attendue, attendue.leftOrder[0]).left.text} : ${paire(attendue, attendue.leftOrder[0]).right.text}`)

  const scores = await lireScores(page)
  expect(scores).toHaveLength(1) // « Terminer » ne réenregistre pas
  expect(scores[0]).toMatchObject({ gameType: 'pairsDefinition', score: 40, niveau: 'CE1-CE2', seed: numero, language: 'fr', subject: 'Commerce', pairCount: 4 })
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  const lignes = progres.filter(p => p.gameType === 'pairsDefinition')
  expect(lignes).toHaveLength(4)
  expect(lignes.every(p => p.isCorrect === true)).toBe(true)
  expect(lignes.map(p => p.itemId).sort()).toEqual([...attendue.leftOrder].sort())

  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Mot ↔ définition/ })).toBeVisible()
  await totalAffiche(page, 40)
  expect(erreurs).toEqual([])
})

test('Partie complète en anglais (CM1-CM2) : mots et définitions en anglais', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Definitions EN', niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 2026
  const attendue = partie('CM1-CM2', 'Symétrie', numero, 'en')
  expect(attendue.pairs).toHaveLength(5)
  await lancer(page, { niveau: 'CM1-CM2', sujet: 'Symétrie', numero, langue: 'en' })
  await expect(page.locator('.pairs-column__title')).toHaveText(['Words', 'Definitions'])
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Game no. ${numero} · ${libelleSujet('Symétrie', 'en')}`)
  await controlerColonnes(page, attendue)
  for (const p of attendue.pairs) expect(p.right.text).toBe(vocabulaire.find(v => v.id === p.id).def_en.trim())
  await relierTout(page, attendue)
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('50')
  const scores = await lireScores(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 50, niveau: 'CM1-CM2', language: 'en', subject: 'Symétrie', pairCount: 5 })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /Word ↔ definition/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Mauvaise paire, indice (traduction) après 2 erreurs, « Voir la réponse » après 3 (0 point, isCorrect: false)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Erreurs def', niveau: 'CM1-CM2' })
  const numero = 99
  const attendue = partie('CM1-CM2', 'Nombres', numero)
  expect(attendue.pairs).toHaveLength(5)
  await lancer(page, { niveau: 'CM1-CM2', sujet: 'Nombres', numero })

  const cible = paire(attendue, attendue.leftOrder[0])
  const autres = attendue.rightOrder.filter(id => id !== cible.id).map(id => paire(attendue, id))
  const retour = page.locator('.pairs-game__feedback')

  await element(page, 0, cible.left.text).click()
  await element(page, 1, autres[0].right.text).click()
  await expect(retour).toHaveText('Ce mot et cette définition ne vont pas ensemble. Essaie encore.')
  await expect(element(page, 0, cible.left.text)).toHaveClass(/pairs-item--wrong/)
  await expect(element(page, 1, autres[0].right.text)).toHaveClass(/pairs-item--wrong/)
  await expect(element(page, 0, cible.left.text)).toBeEnabled()
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 0 / 5 · 0 points')
  await expect(page.locator('.pairs-game__hint')).toHaveCount(0)

  // Erreur 2 sur le même mot : indice = sa traduction en anglais
  await element(page, 0, cible.left.text).click()
  await element(page, 1, autres[1].right.text).click()
  await expect(page.locator('.pairs-game__hint')).toHaveText(`Indice pour « ${cible.left.text} » : en anglais, « ${cible.left.translation} »`)
  await expect(page.getByRole('button', { name: 'Voir la réponse' })).toHaveCount(0)

  // Erreur 3 : « Voir la réponse »
  await element(page, 0, cible.left.text).click()
  await element(page, 1, autres[2].right.text).click()
  await page.getByRole('button', { name: 'Voir la réponse' }).click()
  await expect(retour).toHaveText(`La réponse : ${cible.left.text} : ${cible.right.text}`)
  await expect(element(page, 0, cible.left.text)).toBeDisabled()
  await expect(element(page, 1, cible.right.text)).toHaveClass(/pairs-item--shown/)
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 1 / 5 · 0 points')
  let progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  expect(progres.at(-1)).toMatchObject({ wordId: cible.id, itemId: cible.id, isCorrect: false, gameType: 'pairsDefinition' })

  await relierTout(page, attendue, [cible.id])
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('40')
  await expect(page.locator('.pairs-recap__item--shown')).toHaveCount(1)
  progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  expect(progres.filter(p => p.gameType === 'pairsDefinition' && p.isCorrect === true)).toHaveLength(4)
  expect(await lireScores(page)).toHaveLength(1)
  expect(erreurs).toEqual([])
})

test('Élève de SIL-CP : carte visible, message, pas de niveau SIL-CP ; sujets grisés selon la langue', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Petit lecteur', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: /Mot ↔ définition/ }).click()
  await expect(page.locator('.pairs-select__empty')).toContainText('Ce jeu commence au CE1-CE2')
  const niveaux = page.locator('[aria-labelledby="definition-level-label"] .anagram-select__btn')
  await expect(niveaux).toHaveCount(DEFINITION_LEVELS.length)
  await expect(niveaux).toHaveText([/^CE1-CE2/, /^CM1-CM2/])
  await expect(niveaux.first()).toHaveAttribute('aria-pressed', 'true')
  // Sujets grisés du CE1-CE2 en français
  const grises = definitionSubjects(vocabulaire.filter(v => v.niveau_fr === 'CE1-CE2'), 'CE1-CE2', 'fr').filter(s => !s.playable)
  expect(grises.length).toBeGreaterThan(0)
  for (const { subject } of grises) {
    const bouton = page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(subject)}`) })
    await expect(bouton).toBeDisabled()
    await expect(bouton).toContainText('pas assez de mots')
  }
  // Numéro invalide refusé
  await page.locator('.pairs-select__subject', { hasText: /^Commerce/ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill('12a')
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('#definition-seed-hint')).toContainText('Numéro invalide')
  await expect(page.locator('.pairs-board')).toHaveCount(0)
  expect(erreurs).toEqual([])
})

// Partie dont les définitions sont les plus longues (toutes langues, niveaux, sujets)
function partieLaPlusLongue() {
  let meilleure = null
  for (const langue of ['fr', 'en']) {
    for (const niveau of DEFINITION_LEVELS) {
      for (const { subject, playable } of definitionSubjects(vocabulaire.filter(v => v.niveau_fr === niveau), niveau, langue)) {
        if (!playable) continue
        for (let numero = 0; numero < 10; numero++) {
          const p = partie(niveau, subject, numero, langue)
          const long = p.pairs.reduce((n, x) => n + x.right.text.length, 0)
          if (!meilleure || long > meilleure.long) meilleure = { langue, niveau, sujet: subject, numero, long }
        }
      }
    }
  }
  return meilleure
}

for (const largeur of [375, 320]) {
  test(`Téléphone ${largeur} px : partie aux définitions les plus longues, indice depuis une définition, fin, sans débordement`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 })
    const { langue, niveau, sujet, numero } = partieLaPlusLongue()
    const attendue = partie(niveau, sujet, numero, langue)
    const fr = langue === 'fr'
    await connecterEleve(page, { pseudo: `Tel def ${largeur}`, niveau })
    if (!fr) await page.getByRole('button', { name: 'English' }).click()
    await page.getByRole('button', { name: fr ? /Mot ↔ définition/ : /Word ↔ definition/ }).click()
    expect(await deborde(page)).toBe(false)
    await page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(libelleSujet(sujet, langue))}$`) }).click()
    await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
    await page.locator('.anagram-select__start').click()
    await expect(page.locator('.pairs-board--definitions')).toBeVisible()
    await controlerColonnes(page, attendue)
    expect(await deborde(page)).toBe(false)
    // Aucun texte ne dépasse de son bouton ; cible tactile d'au moins 44 px de haut
    const mesures = await page.locator('.pairs-item').evaluateAll(els => els.map(e => ({
      deborde: e.scrollWidth > e.clientWidth + 1, hauteur: e.getBoundingClientRect().height
    })))
    expect(mesures.every(m => !m.deborde)).toBe(true)
    expect(mesures.every(m => m.hauteur >= 44)).toBe(true)
    // Définitions pleine largeur sous les mots (disposition provisoire du téléphone)
    const boiteMots = await page.locator(COLONNES[0]).boundingBox()
    const boiteDefs = await page.locator(COLONNES[1]).boundingBox()
    expect(boiteDefs.y).toBeGreaterThanOrEqual(boiteMots.y + boiteMots.height - 1)

    // Deux erreurs sur une même définition : indice = traduction du mot à trouver
    const cible = paire(attendue, attendue.rightOrder[0])
    const autres = attendue.leftOrder.filter(id => id !== cible.id)
    for (const id of autres.slice(0, 2)) {
      await element(page, 1, cible.right.text).click()
      await element(page, 0, paire(attendue, id).left.text).click()
    }
    await expect(page.locator('.pairs-game__hint')).toContainText(cible.left.translation)
    await expect(page.locator('.pairs-game__hint')).toContainText(fr ? 'le mot de cette définition se dit' : 'the word for this definition is')
    expect(await deborde(page)).toBe(false)

    await relierTout(page, attendue)
    await page.getByRole('button', { name: fr ? 'Terminer' : 'Finish' }).click()
    await expect(page.locator('.pairs-recap')).toBeVisible()
    expect(await deborde(page)).toBe(false)
  })
}
