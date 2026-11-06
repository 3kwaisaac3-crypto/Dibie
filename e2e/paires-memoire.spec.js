// Mémoire FR ↔ EN (L6, lot B de la phase 4, moteur C « Paires ») : parties
// complètes en français et en anglais, cartes qui se referment seules ou au
// toucher, carte de la langue de l'interface mise en avant, score enregistré
// une seule fois, téléphone 375 px et 320 px sans débordement, animation
// coupée si l'élève réduit les animations.
// La partie attendue est calculée par le module pur (src/utils/pairsGame.js)
// avec le vocabulaire lu sur le disque : l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { connecterEleve, suivreErreurs, totalAffiche, vocabulaire, echapper } from './outils.js'
import { NIVEAU_EN } from '../src/data/niveaux.js'
import { createVocabularyMemoryGame, memorySubjects, memoryPairText, MEMORY_LEVELS } from '../src/utils/pairsGame.js'

const entreesDuSujet = (niveau, sujet) => vocabulaire.filter(v => v.niveau_fr === niveau && v.sujet === sujet && v.actif !== false)
const partie = (niveau, sujet, numero, langue = 'fr') => createVocabularyMemoryGame(entreesDuSujet(niveau, sujet), niveau, numero, langue)
const paire = (p, id) => p.pairs.find(x => x.id === id)
const texte = (p, carte) => paire(p, carte.pairId).sides[carte.side].text
const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
const cartes = (page) => page.locator('.memory-card')

// Indices (dans l'ordre affiché) des deux cartes d'une paire
const indices = (p, id) => p.cards.map((c, i) => (c.pairId === id ? i : -1)).filter(i => i >= 0)

async function lancer(page, { niveau, sujet, numero, langue = 'fr' }) {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Mémoire FR ↔ EN/ : /Memory FR ↔ EN/ }).click()
  await expect(page.locator('.pairs-select__grid')).toBeVisible()
  await page.locator('.anagram-select__btn', { hasText: fr ? niveau : NIVEAU_EN[niveau] }).first().click()
  await page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(sujet)}`) }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.memory-board')).toBeVisible()
}

// Retourne toutes les paires encore cachées, sans erreur
async function trouverTout(page, attendue, deja = []) {
  for (const p of attendue.pairs) {
    if (deja.includes(p.id)) continue
    const [a, b] = indices(attendue, p.id)
    await cartes(page).nth(a).click()
    await cartes(page).nth(b).click()
    await expect(cartes(page).nth(a)).toBeDisabled()
    await expect(cartes(page).nth(b)).toBeDisabled()
  }
}

test('Partie complète en français : cartes cachées, mauvaise paire refermée seule, paires trouvées côte à côte, score enregistré', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Memoire FR', niveau: 'CE1-CE2' })
  const numero = 4242
  const attendue = partie('CE1-CE2', 'Commerce', numero)
  expect(attendue.pairs).toHaveLength(6)
  await lancer(page, { niveau: 'CE1-CE2', sujet: 'Commerce', numero })
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · Commerce`)
  await expect(cartes(page)).toHaveCount(12)
  await expect(page.locator('.memory-card--down')).toHaveCount(12)
  await expect(cartes(page).first()).toContainText('Carte 1, face cachée')
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 0 / 6 · 0 points · Coups : 0')

  // Mauvaise paire : deux cartes de paires différentes, ouvertes puis refermées seules
  const [p1, p2] = attendue.pairs
  const i1 = indices(attendue, p1.id)[0]
  const i2 = indices(attendue, p2.id)[0]
  await cartes(page).nth(i1).click()
  await expect(cartes(page).nth(i1).locator('.memory-card__text')).toHaveText(texte(attendue, attendue.cards[i1]))
  await expect(page.locator('.pairs-game__feedback')).toContainText('Carte retournée')
  await cartes(page).nth(i2).click()
  await expect(cartes(page).nth(i2)).toHaveClass(/memory-card--wrong/)
  await expect(page.locator('.pairs-game__feedback')).toContainText('ces deux cartes ne vont pas ensemble')
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 0 / 6 · 0 points · Coups : 1')
  await expect(page.locator('.memory-card--down')).toHaveCount(12, { timeout: 4000 })

  // Carte de la langue de l'interface (français) mise en avant, étiquette FR
  const iFr = attendue.cards.findIndex(c => c.side === 'fr')
  const iEn = attendue.cards.findIndex(c => c.side === 'en' && c.pairId !== attendue.cards[iFr].pairId)
  await cartes(page).nth(iFr).click()
  await expect(cartes(page).nth(iFr)).toHaveClass(/memory-card--primary/)
  await expect(cartes(page).nth(iFr).locator('.memory-card__tag')).toHaveText('FR')
  await cartes(page).nth(iEn).click()
  await expect(cartes(page).nth(iEn)).not.toHaveClass(/memory-card--primary/)
  await expect(cartes(page).nth(iEn).locator('.memory-card__tag')).toHaveText('EN')
  await expect(page.locator('.memory-card--down')).toHaveCount(12, { timeout: 4000 })

  // Première paire : même couleur, même numéro, ajoutée à la liste
  const [a, b] = indices(attendue, p1.id)
  await cartes(page).nth(a).click()
  await cartes(page).nth(b).click()
  await expect(cartes(page).nth(a)).toHaveClass(/pairs-color-0/)
  await expect(cartes(page).nth(b)).toHaveClass(/pairs-color-0/)
  await expect(cartes(page).nth(a)).toContainText('trouvée, paire 1')
  await expect(page.locator('.pairs-game__feedback')).toHaveText(`Bravo ! ${memoryPairText(attendue, p1)}`)
  await expect(page.locator('.memory-found li')).toHaveCount(1)
  await expect(page.locator('.memory-found li').first()).toContainText(`${p1.sides.fr.text} = ${p1.sides.en.text}`)
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 1 / 6 · 10 points · Coups : 3')

  await trouverTout(page, attendue, [p1.id])
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 6 / 6 · 60 points · Coups : 8')
  await expect(page.locator('.memory-found li')).toHaveCount(6)
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('60')
  await expect(page.locator('.memory-finished__moves')).toHaveText('Coups : 8')
  await expect(page.locator('.memory-recap li')).toHaveCount(6)

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.filter(s => s.gameType === 'pairsMemory')).toHaveLength(1)
  expect(scores.at(-1)).toMatchObject({ gameType: 'pairsMemory', score: 60, niveau: 'CE1-CE2', seed: numero, language: 'fr', subject: 'Commerce', pairCount: 6, moves: 8 })
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  const lignes = progres.filter(p => p.gameType === 'pairsMemory')
  expect(lignes).toHaveLength(6)
  expect(lignes.every(p => p.isCorrect === true)).toBe(true)
  expect(lignes.map(p => p.itemId).sort()).toEqual(attendue.pairs.map(p => p.id).sort())

  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Mémoire FR ↔ EN/ })).toBeVisible()
  await totalAffiche(page, 60)
  expect(erreurs).toEqual([])
})

test('Partie complète en anglais (SIL-CP) : mêmes cartes aux mêmes places, carte anglaise mise en avant, toucher pour refermer plus tôt', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Memory EN', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 777
  const attendue = partie('SIL-CP', 'Fruits', numero, 'en')
  expect(attendue.cards).toEqual(partie('SIL-CP', 'Fruits', numero, 'fr').cards)
  expect(attendue.pairs).toHaveLength(4)
  await lancer(page, { niveau: 'SIL-CP', sujet: 'Fruit', numero, langue: 'en' })
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Game no. ${numero} · Fruit`)
  await expect(cartes(page)).toHaveCount(8)

  // Mauvaise paire puis toucher une des deux cartes : elles se referment tout de suite
  const [p1, p2] = attendue.pairs
  const i1 = indices(attendue, p1.id)[0]
  const i2 = indices(attendue, p2.id)[1]
  await cartes(page).nth(i1).click()
  await cartes(page).nth(i2).click()
  await expect(page.locator('.pairs-game__feedback')).toContainText('these two cards do not match')
  await cartes(page).nth(i1).click()
  await expect(page.locator('.memory-card--down')).toHaveCount(8, { timeout: 500 })
  await expect(page.locator('.pairs-game__feedback')).toHaveText('Cards turned back.')

  // Carte anglaise mise en avant
  const iEn = attendue.cards.findIndex(c => c.side === 'en')
  await cartes(page).nth(iEn).click()
  await expect(cartes(page).nth(iEn)).toHaveClass(/memory-card--primary/)
  await expect(cartes(page).nth(iEn).locator('.memory-card__text')).toHaveAttribute('lang', 'en')
  const autre = indices(attendue, attendue.cards[iEn].pairId).find(i => i !== iEn)
  await cartes(page).nth(autre).click()
  await expect(cartes(page).nth(autre)).toBeDisabled()
  const trouvee = attendue.cards[iEn].pairId
  // Liste : mot anglais d'abord
  await expect(page.locator('.memory-found li').first()).toContainText(`${paire(attendue, trouvee).sides.en.text} = ${paire(attendue, trouvee).sides.fr.text}`)

  await trouverTout(page, attendue, [trouvee])
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('40')
  await expect(page.locator('.memory-finished__moves')).toHaveText('Moves: 5')
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'pairsMemory', score: 40, niveau: 'SIL-CP', language: 'en', subject: 'Fruits', moves: 5 })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /Memory FR ↔ EN/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test("Score enregistré une seule fois dès la dernière paire, même si l'élève touche « Retour » sans « Terminer »", async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Memoire score', niveau: 'SIL-CP' })
  const numero = 555
  const attendue = partie('SIL-CP', 'Fruits', numero)
  await lancer(page, { niveau: 'SIL-CP', sujet: 'Fruits', numero })
  const lireScores = () => page.evaluate(() =>
    (JSON.parse(localStorage.getItem('dibieScores')) || []).filter(s => s.gameType === 'pairsMemory'))
  const derniere = attendue.pairs.at(-1).id
  await trouverTout(page, attendue, [derniere])
  expect(await lireScores()).toHaveLength(0)
  await trouverTout(page, attendue, attendue.pairs.slice(0, -1).map(p => p.id))
  await expect.poll(async () => (await lireScores()).length).toBe(1)
  // Cartes trouvées touchées encore : rien de plus
  await cartes(page).first().click({ force: true })
  await page.locator('.anagram-game__back').click()
  await expect(page.locator('.pairs-select__grid')).toBeVisible()
  const scores = await lireScores()
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 40, niveau: 'SIL-CP', seed: numero, subject: 'Fruits', moves: 4 })
  expect(erreurs).toEqual([])
})

// Partie dont les cartes ont les textes les plus longs (mots composés)
function partieLaPlusLongue() {
  let meilleure = null
  for (const niveau of MEMORY_LEVELS) {
    for (const { subject, playable } of memorySubjects(vocabulaire.filter(v => v.niveau_fr === niveau), niveau)) {
      if (!playable) continue
      for (let numero = 0; numero < 30; numero++) {
        const p = partie(niveau, subject, numero)
        const long = Math.max(...p.pairs.flatMap(x => [x.sides.fr.text.length, x.sides.en.text.length]))
        if (!meilleure || long > meilleure.long) meilleure = { niveau, sujet: subject, numero, long }
      }
    }
  }
  return meilleure
}

for (const largeur of [375, 320]) {
  test(`Téléphone ${largeur} px : partie aux mots les plus longs, toutes les cartes ouvertes, sans débordement, animation réduite`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    const { niveau, sujet, numero, long } = partieLaPlusLongue()
    expect(long).toBeGreaterThanOrEqual(15)
    const attendue = partie(niveau, sujet, numero)
    await connecterEleve(page, { pseudo: `Memoire ${largeur}`, niveau })
    await page.getByRole('button', { name: /Mémoire FR ↔ EN/ }).click()
    expect(await deborde(page)).toBe(false)
    await page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(sujet)}`) }).click()
    await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
    await page.locator('.anagram-select__start').click()
    await expect(page.locator('.memory-board')).toBeVisible()
    expect(await deborde(page)).toBe(false)
    // Cibles tactiles d'au moins 44 px
    const hauteurs = await cartes(page).evaluateAll(els => els.map(e => e.getBoundingClientRect()))
    expect(hauteurs.every(r => r.height >= 44 && r.width >= 44)).toBe(true)

    // Toutes les paires trouvées : tous les mots visibles, aucun ne dépasse de sa carte
    await trouverTout(page, attendue)
    expect(await deborde(page)).toBe(false)
    const mesures = await cartes(page).evaluateAll(els => els.map(e => ({
      deborde: e.scrollWidth > e.clientWidth + 1, animation: getComputedStyle(e).animationName
    })))
    expect(mesures.every(m => !m.deborde)).toBe(true)
    // prefers-reduced-motion : pas d'animation de retournement
    expect(mesures.every(m => m.animation === 'none')).toBe(true)
    await page.getByRole('button', { name: 'Terminer' }).click()
    await expect(page.locator('.memory-recap')).toBeVisible()
    expect(await deborde(page)).toBe(false)
  })
}
