// Anagrammes (phase 2 du plan de migration, §5.4) : parties complètes en
// français et en anglais, essais faux et retours, indice, solution après
// 3 essais, autre anagramme réelle acceptée, affichage à 320 px, score
// enregistré, reproductibilité par numéro de partie.
// La partie attendue est calculée par le module pur (src/utils/anagramGame.js)
// avec le vocabulaire lu sur le disque : l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { connecterEleve, suivreErreurs, totalAffiche, vocabulaire } from './outils.js'
import { createAnagramGame } from '../src/utils/anagramGame.js'

const partie = (niveau, numero, langue = 'fr') => createAnagramGame(vocabulaire, niveau, numero, langue)

// Premier numéro (à partir de 1) dont la partie vérifie la condition
function chercherNumero(niveau, langue, condition) {
  for (let numero = 1; numero < 5000; numero++) {
    const p = partie(niveau, numero, langue)
    if (condition(p)) return numero
  }
  return null
}

// Du tableau de bord jusqu'au premier mot d'une partie
async function lancer(page, { numero, langue = 'fr', niveau = null }) {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Anagrammes/ : /Anagrams/ }).click()
  if (niveau) await page.locator('.anagram-select__btn', { hasText: niveau }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.anagram-game')).toBeVisible()
}

// Écrit un mot (normalisé) en touchant les tuiles ; la lettre déjà placée
// (SIL-CP) est sautée
async function ecrire(page, mot, premiereDonnee) {
  for (const lettre of [...mot].slice(premiereDonnee ? 1 : 0)) {
    await page.locator('.anagram-tile:not(:disabled)', { hasText: new RegExp(`^${lettre}$`) }).first().click()
  }
}

async function valider(page, langue = 'fr') {
  await page.getByRole('button', { name: langue === 'fr' ? 'Valider' : 'Check', exact: true }).click()
}

// Joue tous les mots de la partie attendue, en contrôlant la définition et
// les tuiles affichées, puis termine. Renvoie le score attendu.
async function jouerPartie(page, attendue, langue = 'fr') {
  const fr = langue === 'fr'
  for (const [i, item] of attendue.items.entries()) {
    await expect(page.locator('.anagram-game__clue')).toHaveText(item.definition)
    expect(await page.locator('.anagram-tile').allTextContents()).toEqual(item.tiles)
    await ecrire(page, item.word, item.firstLetter !== null)
    await valider(page, langue)
    // Orthographe exacte (avec accents) montrée après le mot trouvé
    await expect(page.locator('.anagram-game__answer strong')).toHaveText(item.display)
    const dernier = i === attendue.items.length - 1
    await page.getByRole('button', { name: dernier ? (fr ? 'Terminer' : 'Finish') : (fr ? 'Mot suivant' : 'Next word') }).click()
  }
  await expect(page.locator('.anagram-finished')).toBeVisible()
  return attendue.items.length * 10
}

test('Partie complète en français : définitions, mélange, orthographe exacte, score enregistré et retour au tableau de bord', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Anagramme FR', niveau: 'CE1-CE2' })
  // Numéro dont la partie contient un mot accentué, pour vérifier l'orthographe exacte
  const numero = chercherNumero('CE1-CE2', 'fr', p => p.items.some(i => i.display !== i.word))
  expect(numero).not.toBeNull()
  await lancer(page, { numero })
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · français`)
  const score = await jouerPartie(page, partie('CE1-CE2', numero))
  await expect(page.locator('.anagram-finished .anagram-game__seed')).toContainText(`Partie n° ${numero} · français`)
  expect(score).toBe(50)
  await expect(page.locator('.anagram-finished__score')).toHaveText('50')
  await expect(page.locator('.anagram-finished__words li')).toHaveCount(5)

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'anagram', score: 50, niveau: 'CE1-CE2', seed: numero, language: 'fr' })
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  expect(progres.filter(p => p.gameType === 'anagram' && p.isCorrect === true)).toHaveLength(5)

  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Anagrammes/ })).toBeVisible()
  await totalAffiche(page, 50)
  expect(erreurs).toEqual([])
})

test('Partie complète en anglais (SIL-CP, première lettre placée) : mots et définitions en anglais', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Anagram EN', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 777
  const attendue = partie('SIL-CP', numero, 'en')
  expect(attendue.items).toHaveLength(5)
  await lancer(page, { numero, langue: 'en' })
  await expect(page.locator('.anagram-slot--given')).toHaveText(attendue.items[0].firstLetter)
  // Lettre donnée annoncée par les lecteurs d'écran
  await expect(page.getByRole('img', { name: `${attendue.items[0].firstLetter}, given letter` })).toBeVisible()
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Game no. ${numero} · English`)
  await expect(page.getByRole('button', { name: 'Shuffle again' })).toBeVisible()
  await jouerPartie(page, attendue, 'en')
  await expect(page.locator('.anagram-finished__score')).toHaveText('50')
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'anagram', score: 50, niveau: 'SIL-CP', language: 'en' })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /Anagrams/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Mauvais essais : lettres bien placées, puis indice, puis solution après 3 essais (mot non compté)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Essais', niveau: 'CM1-CM2' })
  const numero = 4242
  const attendue = partie('CM1-CM2', numero)
  const item = attendue.items[0]
  await lancer(page, { numero })

  // Valider est inactif tant que toutes les cases ne sont pas remplies
  await expect(page.getByRole('button', { name: 'Valider', exact: true })).toBeDisabled()

  // Essai faux : l'ordre mélangé lui-même (jamais une bonne réponse)
  const faux = item.tiles.join('')
  const bienPlacees = Math.max(...item.answers.map(a => [...a.word].filter((l, i) => faux[i] === l).length))
  const essaiFaux = async () => {
    // « Effacer » est inactif tant qu'aucune lettre n'est placée
    const effacer = page.getByRole('button', { name: 'Effacer' })
    if (await effacer.isEnabled()) await effacer.click()
    await ecrire(page, faux, false)
    await valider(page)
  }
  await essaiFaux()
  const retour = page.locator('.anagram-game__feedback')
  await expect(retour).toContainText(`Il y a ${bienPlacees} lettre`)
  await expect(retour).not.toContainText('Indice')
  await expect(page.getByRole('button', { name: 'Voir la solution' })).toHaveCount(0)

  // Case remplie touchée : la lettre revient parmi les tuiles
  await page.locator('.anagram-slot').first().click()
  await expect(page.locator('.anagram-slot--empty')).toHaveCount(1)
  await expect(page.locator('.anagram-tile:not(:disabled)')).toHaveCount(1)

  await essaiFaux()
  await expect(retour).toContainText(`Indice : le mot commence par « ${[...item.display][0]} »`)
  await expect(page.getByRole('button', { name: 'Voir la solution' })).toHaveCount(0)

  await essaiFaux()
  await page.getByRole('button', { name: 'Voir la solution' }).click()
  await expect(page.locator('.anagram-game__answer')).toContainText(`La solution était : ${item.display}`)
  await expect(page.locator('.anagram-game__progress')).toContainText('0 points')
  await page.getByRole('button', { name: 'Mot suivant' }).click()
  await expect(page.locator('.anagram-game__clue')).toHaveText(attendue.items[1].definition)

  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  expect(progres.at(-1)).toMatchObject({ wordId: item.id, isCorrect: false, gameType: 'anagram', itemId: item.id })
  expect(erreurs).toEqual([])
})

test('Mélanger à nouveau : les lettres placées restent, les tuiles changent d\'ordre', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Melange', niveau: 'CM1-CM2' })
  const numero = 99
  const item = partie('CM1-CM2', numero).items[0]
  await lancer(page, { numero })
  await page.locator('.anagram-tile').first().click()
  const avant = await page.locator('.anagram-tile').allTextContents()
  await page.getByRole('button', { name: 'Mélanger à nouveau' }).click()
  const apres = await page.locator('.anagram-tile').allTextContents()
  expect(apres).not.toEqual(avant)
  expect([...apres].sort()).toEqual([...avant].sort())
  await expect(page.locator('.anagram-slot').first()).toHaveText(item.tiles[0])
})

test('Autre anagramme réelle du vocabulaire acceptée (CAMION / MANIOC ou équivalent)', async ({ page }) => {
  const numero = chercherNumero('CE1-CE2', 'fr', p => p.items[0].answers.length > 1)
  expect(numero, 'aucune partie CE1-CE2 ne commence par un mot à plusieurs anagrammes').not.toBeNull()
  const item = partie('CE1-CE2', numero).items[0]
  const autre = item.answers.find(a => a.word !== item.word)
  await connecterEleve(page, { pseudo: 'Autre anagramme', niveau: 'CE1-CE2' })
  await lancer(page, { numero })
  await ecrire(page, autre.word, false)
  await valider(page)
  await expect(page.locator('.anagram-game__answer strong')).toHaveText(autre.display)
  await expect(page.locator('.anagram-game__other')).toContainText(item.display)
  await expect(page.locator('.anagram-game__progress')).toContainText('10 points')
})

test('Même numéro, même partie ; numéro invalide refusé', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Numero', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: /Anagrammes/ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill('12a')
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('#anagram-seed-hint')).toContainText('Numéro invalide')
  await page.getByRole('button', { name: 'Retour' }).click()

  const lire = async () => ({
    definition: await page.locator('.anagram-game__clue').textContent(),
    tuiles: await page.locator('.anagram-tile').allTextContents()
  })
  await lancer(page, { numero: 31415 })
  const premiere = await lire()
  await page.locator('.anagram-game__back').click()
  await page.locator('.anagram-select__start').click()
  expect(await lire()).toEqual(premiere)
  const item = partie('SIL-CP', 31415).items[0]
  expect(premiere).toEqual({ definition: item.definition, tuiles: item.tiles })
})

test('Pas de débordement horizontal à 320 px avec un mot de 10 lettres', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const numero = chercherNumero('CM1-CM2', 'fr', p => p.items[0].word.length === 10)
  expect(numero).not.toBeNull()
  await connecterEleve(page, { pseudo: 'Petit ecran', niveau: 'CM1-CM2' })
  await lancer(page, { numero })
  await expect(page.locator('.anagram-slot')).toHaveCount(10)
  const deborde = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(await deborde()).toBe(false)
  await ecrire(page, partie('CM1-CM2', numero).items[0].word, false)
  expect(await deborde()).toBe(false)
  await valider(page)
  expect(await deborde()).toBe(false)
})
