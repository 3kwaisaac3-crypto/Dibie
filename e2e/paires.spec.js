// Associations FR ↔ EN (lot A de la phase 4, moteur C « Paires ») : parties
// complètes en français et en anglais, mauvaise paire, indice après 2 erreurs,
// « Voir la réponse » après 3, sujets grisés, numéro de partie, affichage à
// 375 px et 320 px sans débordement.
// La partie attendue est calculée par le module pur (src/utils/pairsGame.js)
// avec le vocabulaire lu sur le disque : l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { connecterEleve, suivreErreurs, totalAffiche, vocabulaire, echapper } from './outils.js'
import { NIVEAU_EN } from '../src/data/niveaux.js'
import { createTranslationGame, translationSubjects, TRANSLATION_LEVELS } from '../src/utils/pairsGame.js'

const entreesDuSujet = (niveau, sujet) => vocabulaire.filter(v => v.niveau_fr === niveau && v.sujet === sujet && v.actif !== false)
const partie = (niveau, sujet, numero, langue = 'fr') => createTranslationGame(entreesDuSujet(niveau, sujet), niveau, numero, langue)
const paire = (p, id) => p.pairs.find(x => x.id === id)
const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

// Mot d'une colonne (0 = gauche, 1 = droite), par son texte exact
const mot = (page, colonne, texte) => page.locator('.pairs-column').nth(colonne)
  .locator('.pairs-item', { has: page.locator('.pairs-item__text', { hasText: new RegExp(`^${echapper(texte)}$`) }) })

// Du tableau de bord jusqu'à la partie
async function lancer(page, { niveau, sujet, numero, langue = 'fr' }) {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Associations FR ↔ EN/ : /Matching FR ↔ EN/ }).click()
  await expect(page.locator('.pairs-select__grid')).toBeVisible()
  // Niveau affiché : nom francophone, ou « Class … » en anglais
  await page.locator('.anagram-select__btn', { hasText: fr ? niveau : NIVEAU_EN[niveau] }).first().click()
  await page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(sujet)}`) }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.pairs-board')).toBeVisible()
}

// Colonnes affichées = colonnes de la partie attendue
async function controlerColonnes(page, attendue) {
  expect(await page.locator('.pairs-column').nth(0).locator('.pairs-item__text').allTextContents())
    .toEqual(attendue.leftOrder.map(id => paire(attendue, id).left.text))
  expect(await page.locator('.pairs-column').nth(1).locator('.pairs-item__text').allTextContents())
    .toEqual(attendue.rightOrder.map(id => paire(attendue, id).right.text))
}

// Relie toutes les paires encore libres (gauche puis droite)
async function relierTout(page, attendue, deja = []) {
  for (const id of attendue.leftOrder) {
    if (deja.includes(id)) continue
    const p = paire(attendue, id)
    await mot(page, 0, p.left.text).click()
    await mot(page, 1, p.right.text).click()
    await expect(mot(page, 0, p.left.text)).toBeDisabled()
    await expect(mot(page, 1, p.right.text)).toBeDisabled()
  }
}

test('Partie complète en français : colonnes, couleurs, récapitulatif, score enregistré et retour au tableau de bord', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Paires FR', niveau: 'CE1-CE2' })
  const numero = 4242
  const attendue = partie('CE1-CE2', 'Commerce', numero)
  expect(attendue.pairs).toHaveLength(5)
  await lancer(page, { niveau: 'CE1-CE2', sujet: 'Commerce', numero })
  await expect(page.locator('.pairs-column__title')).toHaveText(['Français', 'Anglais'])
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · Commerce`)
  await controlerColonnes(page, attendue)

  // Premier mot touché : sélectionné ; puis sa traduction : même couleur et même numéro
  const premiere = paire(attendue, attendue.leftOrder[0])
  await mot(page, 0, premiere.left.text).click()
  await expect(mot(page, 0, premiere.left.text)).toHaveAttribute('aria-pressed', 'true')
  await mot(page, 1, premiere.right.text).click()
  await expect(mot(page, 0, premiere.left.text)).toHaveClass(/pairs-color-0/)
  await expect(mot(page, 1, premiere.right.text)).toHaveClass(/pairs-color-0/)
  await expect(page.locator('.pairs-game__feedback')).toHaveText(`Bravo ! ${premiere.left.text} = ${premiere.right.text}`)
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 1 / 5 · 10 points')

  await relierTout(page, attendue, [premiere.id])
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 5 / 5 · 50 points')
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('50')
  await expect(page.locator('.pairs-recap li')).toHaveCount(5)
  await expect(page.locator('.pairs-recap__item--found')).toHaveCount(5)
  await expect(page.locator('.pairs-recap li').first()).toContainText(`${premiere.left.text} = ${premiere.right.text}`)

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'pairsTranslation', score: 50, niveau: 'CE1-CE2', seed: numero, language: 'fr', subject: 'Commerce', pairCount: 5 })
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  const lignes = progres.filter(p => p.gameType === 'pairsTranslation')
  expect(lignes).toHaveLength(5)
  expect(lignes.every(p => p.isCorrect === true)).toBe(true)
  expect(lignes.map(p => p.itemId).sort()).toEqual([...attendue.leftOrder].sort())

  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Associations FR ↔ EN/ })).toBeVisible()
  await totalAffiche(page, 50)
  expect(erreurs).toEqual([])
})

test('Partie complète en anglais (SIL-CP) : colonne de gauche en anglais, mêmes paires que le même numéro en français', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Pairs EN', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 777
  const attendue = partie('SIL-CP', 'Fruits', numero, 'en')
  const enFrancais = partie('SIL-CP', 'Fruits', numero, 'fr')
  expect(attendue.pairs).toHaveLength(3)
  expect(attendue.leftOrder).toEqual(enFrancais.leftOrder)
  await lancer(page, { niveau: 'SIL-CP', sujet: 'Fruit', numero, langue: 'en' })
  await expect(page.locator('.pairs-column__title')).toHaveText(['English', 'French'])
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Game no. ${numero} · Fruit`)
  await controlerColonnes(page, attendue)
  // Touché dans l'autre sens : droite puis gauche
  const p = paire(attendue, attendue.rightOrder[0])
  await mot(page, 1, p.right.text).click()
  await mot(page, 0, p.left.text).click()
  await expect(mot(page, 1, p.right.text)).toBeDisabled()
  await relierTout(page, attendue, [p.id])
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('30')
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'pairsTranslation', score: 30, niveau: 'SIL-CP', language: 'en', subject: 'Fruits' })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /Matching FR ↔ EN/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Mauvaise paire, indice après 2 erreurs, « Voir la réponse » après 3 (0 point, isCorrect: false)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Erreurs', niveau: 'CM1-CM2' })
  const numero = 99
  const attendue = partie('CM1-CM2', 'Géométrie', numero)
  expect(attendue.pairs).toHaveLength(6)
  await lancer(page, { niveau: 'CM1-CM2', sujet: 'Géométrie', numero })

  const cible = paire(attendue, attendue.leftOrder[0])
  const autres = attendue.rightOrder.filter(id => id !== cible.id).map(id => paire(attendue, id))
  const retour = page.locator('.pairs-game__feedback')

  // Erreur 1 : les deux mots tremblent et restent libres, sans pénalité
  await mot(page, 0, cible.left.text).click()
  await mot(page, 1, autres[0].right.text).click()
  await expect(retour).toHaveText('Ces deux mots ne vont pas ensemble. Essaie encore.')
  await expect(mot(page, 0, cible.left.text)).toHaveClass(/pairs-item--wrong/)
  await expect(mot(page, 1, autres[0].right.text)).toHaveClass(/pairs-item--wrong/)
  await expect(mot(page, 0, cible.left.text)).toBeEnabled()
  await expect(mot(page, 1, autres[0].right.text)).toBeEnabled()
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 0 / 6 · 0 points')
  await expect(page.locator('.pairs-game__hint')).toHaveCount(0)

  // Erreur 2 sur le même mot : indice = sa définition (en français)
  await mot(page, 0, cible.left.text).click()
  await mot(page, 1, autres[1].right.text).click()
  await expect(page.locator('.pairs-game__hint')).toContainText(`Indice pour « ${cible.left.text} »`)
  await expect(page.locator('.pairs-game__hint')).toContainText(cible.left.definition)
  await expect(page.getByRole('button', { name: 'Voir la réponse' })).toHaveCount(0)

  // Erreur 3 : « Voir la réponse »
  await mot(page, 0, cible.left.text).click()
  await mot(page, 1, autres[2].right.text).click()
  await page.getByRole('button', { name: 'Voir la réponse' }).click()
  await expect(retour).toHaveText(`La réponse : ${cible.left.text} = ${cible.right.text}`)
  await expect(mot(page, 0, cible.left.text)).toBeDisabled()
  await expect(mot(page, 1, cible.right.text)).toHaveClass(/pairs-item--shown/)
  await expect(page.locator('.anagram-game__progress')).toHaveText('Paires 1 / 6 · 0 points')
  let progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  expect(progres.at(-1)).toMatchObject({ wordId: cible.id, itemId: cible.id, isCorrect: false, gameType: 'pairsTranslation' })

  await relierTout(page, attendue, [cible.id])
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.anagram-finished__score')).toHaveText('50')
  await expect(page.locator('.pairs-recap__item--shown')).toHaveCount(1)
  await expect(page.locator('.pairs-recap__item--shown')).toContainText(`${cible.left.text} = ${cible.right.text}`)
  progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  expect(progres.filter(p => p.gameType === 'pairsTranslation' && p.isCorrect === true)).toHaveLength(5)
  expect(erreurs).toEqual([])
})

test("Score enregistré une seule fois dès la dernière paire, même si l'élève touche « Retour » sans « Terminer »", async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Score auto', niveau: 'SIL-CP' })
  const numero = 555
  const attendue = partie('SIL-CP', 'Fruits', numero)
  await lancer(page, { niveau: 'SIL-CP', sujet: 'Fruits', numero })
  const lireScores = () => page.evaluate(() =>
    (JSON.parse(localStorage.getItem('dibieScores')) || []).filter(s => s.gameType === 'pairsTranslation'))

  // Avant la dernière paire : rien d'enregistré
  const [derniere, ...premieres] = [...attendue.leftOrder].reverse()
  await relierTout(page, attendue, [derniere])
  expect(await lireScores()).toHaveLength(0)
  await relierTout(page, attendue, premieres)
  await expect.poll(async () => (await lireScores()).length).toBe(1)

  // « Retour » sans « Terminer » : le score reste, une seule fois
  await page.locator('.anagram-game__back').click()
  await expect(page.locator('.pairs-select__grid')).toBeVisible()
  const scores = await lireScores()
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 30, niveau: 'SIL-CP', seed: numero, subject: 'Fruits' })

  // Autre partie terminée puis « Terminer » : un enregistrement de plus, pas deux
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await relierTout(page, attendue)
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.pairs-recap li')).toHaveCount(3)
  await page.getByRole('button', { name: 'Retour' }).click()
  await totalAffiche(page, 60)
  expect(await lireScores()).toHaveLength(2)
  expect(erreurs).toEqual([])
})

test('Sujets grisés, numéro invalide refusé, même numéro = même partie', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Choix paires', niveau: 'CE1-CE2' })
  await page.getByRole('button', { name: /Associations FR ↔ EN/ }).click()
  const grises = translationSubjects(vocabulaire.filter(v => v.niveau_fr === 'CE1-CE2'), 'CE1-CE2').filter(s => !s.playable)
  expect(grises.length).toBeGreaterThan(0)
  for (const { subject } of grises) {
    const bouton = page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(subject)}`) })
    await expect(bouton).toBeDisabled()
    await expect(bouton).toContainText('pas assez de mots')
  }
  await page.locator('.pairs-select__subject', { hasText: /^Commerce/ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill('12a')
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('#pairs-seed-hint')).toContainText('Numéro invalide')
  await expect(page.locator('.pairs-board')).toHaveCount(0)

  await page.getByLabel('Numéro de partie (facultatif)').fill('31')
  await page.locator('.anagram-select__start').click()
  await controlerColonnes(page, partie('CE1-CE2', 'Commerce', 31))
  await page.locator('.anagram-game__back').click()
  await page.locator('.anagram-select__start').click()
  await controlerColonnes(page, partie('CE1-CE2', 'Commerce', 31))
})

// Partie dont les textes affichés sont les plus longs (mots composés)
function partieLaPlusLongue() {
  let meilleure = null
  for (const niveau of TRANSLATION_LEVELS) {
    for (const { subject, playable } of translationSubjects(vocabulaire.filter(v => v.niveau_fr === niveau), niveau)) {
      if (!playable) continue
      for (let numero = 0; numero < 30; numero++) {
        const p = partie(niveau, subject, numero)
        const long = Math.max(...p.pairs.flatMap(x => [x.left.text.length, x.right.text.length]))
        if (!meilleure || long > meilleure.long) meilleure = { niveau, sujet: subject, numero, long }
      }
    }
  }
  return meilleure
}

for (const largeur of [375, 320]) {
  test(`Téléphone ${largeur} px : choix, partie aux mots les plus longs, indice, fin, sans débordement`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: 700 })
    const { niveau, sujet, numero, long } = partieLaPlusLongue()
    expect(long).toBeGreaterThanOrEqual(20)
    const attendue = partie(niveau, sujet, numero)
    await connecterEleve(page, { pseudo: `Tel ${largeur}`, niveau })
    await page.getByRole('button', { name: /Associations FR ↔ EN/ }).click()
    expect(await deborde(page)).toBe(false)
    await page.locator('.pairs-select__subject', { hasText: new RegExp(`^${echapper(sujet)}`) }).click()
    await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
    await page.locator('.anagram-select__start').click()
    await expect(page.locator('.pairs-board')).toBeVisible()
    expect(await deborde(page)).toBe(false)
    // Aucun mot ne dépasse de son bouton ; cible tactile d'au moins 44 px de haut
    const mesures = await page.locator('.pairs-item').evaluateAll(els => els.map(e => ({
      deborde: e.scrollWidth > e.clientWidth + 1, hauteur: e.getBoundingClientRect().height
    })))
    expect(mesures.every(m => !m.deborde)).toBe(true)
    expect(mesures.every(m => m.hauteur >= 44)).toBe(true)

    // Deux erreurs : l'indice (définition longue) reste dans l'écran
    const cible = paire(attendue, attendue.leftOrder[0])
    const autres = attendue.rightOrder.filter(id => id !== cible.id)
    for (const id of autres.slice(0, 2)) {
      await mot(page, 0, cible.left.text).click()
      await mot(page, 1, paire(attendue, id).right.text).click()
    }
    await expect(page.locator('.pairs-game__hint')).toBeVisible()
    expect(await deborde(page)).toBe(false)

    await relierTout(page, attendue)
    await page.getByRole('button', { name: 'Terminer' }).click()
    await expect(page.locator('.pairs-recap')).toBeVisible()
    expect(await deborde(page)).toBe(false)
  })
}
