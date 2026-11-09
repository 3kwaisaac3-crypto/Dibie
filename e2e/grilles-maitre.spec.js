// Grilles du maître (fiche L16, phase 6, lot B) : carte du tableau de bord
// (FR et EN), liste filtrée par le niveau du profil et par matière, partie
// complète (10 points par mot, score enregistré une fois avec le gameType
// masterGrid, progression par mot), accents, effacement, flèches dans une
// grille rectangulaire, affichage à 320 px des plus grandes grilles (13 × 15
// et 11 × 15), et non-régression de la taille des cases des mots croisés.
// La grille attendue est lue dans src/data/grilles-maitre.json : l'écran doit
// montrer la même.
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { creerProfil, ouvrirMotsCroises, choisir, suivreErreurs, totalAffiche } from './outils.js'

const collection = JSON.parse(readFileSync(new URL('../src/data/grilles-maitre.json', import.meta.url), 'utf8'))
const grille = id => collection.grilles.find(g => g.id === id)

const TITRE_FR = 'Grilles du maître — Préparation aux examens'
const TITRE_EN = 'Teacher\'s grids — Exam preparation'

const scoresL16 = async (page) =>
  (await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores') || '[]'))).filter(s => s.gameType === 'masterGrid')
const lignesL16 = async (page) =>
  (await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress') || '[]'))).filter(l => l.gameType === 'masterGrid')

const caseGrille = (page, r, c) => page.locator(`.eclipse-input[aria-label="Ligne ${r + 1}, colonne ${c + 1}"]`)

async function entrer(page, niveau, pseudo = 'Eleve L16') {
  await page.goto('/')
  await creerProfil(page, { pseudo, niveau })
}

async function ouvrirGrilles(page, langue = 'fr') {
  await page.getByRole('button', { name: langue === 'fr' ? /Grilles du maître/ : /Teacher's grids/ }).click()
  await expect(page.getByRole('heading', { name: langue === 'fr' ? TITRE_FR : TITRE_EN })).toBeVisible()
}

async function lancerGrille(page, id) {
  await page.locator(`.master-grid-list__item[data-grid="${id}"]`).click()
  await expect(page.locator('.eclipse-board')).toBeVisible()
}

// Écrit une lettre dans une case (frappe à vitesse humaine, voir mots-croises.spec.js)
async function ecrire(page, r, c, lettre) {
  await caseGrille(page, r, c).click()
  await page.keyboard.type(lettre, { delay: 60 })
}

test('Carte « Grilles du maître » au tableau de bord, en français et en anglais', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await entrer(page, 'CM1-CM2')
  await expect(page.locator('.game-card', { hasText: 'Grilles du maître' })).toBeVisible()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.locator('.game-card', { hasText: 'Teacher\'s grids' })).toBeVisible()
  await ouvrirGrilles(page, 'en')
  await expect(page.locator('.master-grid-select__level')).toContainText('Class 5-6')
  await expect(page.locator('.master-grid-list__item[data-grid="G153"] .master-grid-list__meta')).toHaveText('English · 19 words · in English')
  // Les grilles dans la langue de l'interface viennent d'abord
  await expect(page.locator('.master-grid-list__item').first()).toHaveAttribute('data-grid', 'G153')
  expect(erreurs, erreurs.join('\n')).toEqual([])
})

test('Liste CM1-CM2 : 7 grilles avec leurs matières, filtre par matière, aucun examen nommé', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await entrer(page, 'CM1-CM2')
  await ouvrirGrilles(page)
  const items = page.locator('.master-grid-list__item')
  await expect(items).toHaveCount(7)
  await expect(page.locator('.master-grid-list__item[data-grid="G173"]')).toContainText('pluriels des mots 3')
  await expect(page.locator('.master-grid-list__item[data-grid="G173"] .master-grid-list__meta')).toHaveText('Français · 10 mots · en français')
  await expect(page.locator('.master-grid-list__item[data-grid="G183"] .master-grid-list__meta')).toHaveText('Sciences (santé) / vocabulaire · 10 mots · en français')
  await expect(page.locator('.master-grid-list__item[data-grid="G153"] .master-grid-list__meta')).toHaveText('Anglais · 19 mots · en anglais')
  // Grille en anglais en dernier, message sur la langue des grilles
  await expect(items.last()).toHaveAttribute('data-grid', 'G153')
  await expect(page.locator('.master-grid-select')).toContainText('Chaque grille reste dans la langue où son auteur l\'a écrite.')

  const filtres = page.locator('.master-grid-select__matieres')
  await filtres.getByRole('button', { name: 'Anglais' }).click()
  await expect(items).toHaveCount(1)
  await filtres.getByRole('button', { name: 'Sciences (santé) / vocabulaire' }).click()
  await expect(items).toHaveCount(1)
  await filtres.getByRole('button', { name: 'Français' }).click()
  await expect(items).toHaveCount(5)
  await filtres.getByRole('button', { name: 'Toutes' }).click()
  await expect(items).toHaveCount(7)

  await expect(page.locator('body')).not.toContainText(/CEP|FSLC/)
  expect(erreurs, erreurs.join('\n')).toEqual([])
})

test('SIL-CP : message « pas encore de grille », retour au tableau de bord', async ({ page }) => {
  await entrer(page, 'SIL-CP')
  await ouvrirGrilles(page)
  await expect(page.getByRole('status')).toHaveText('Pas encore de grille pour ton niveau.')
  await expect(page.locator('.master-grid-list__item')).toHaveCount(0)
  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Mots Croisés/ })).toBeVisible()
})

test('Partie complète (G017, CE1-CE2) : 10 points par mot, score enregistré une fois, progression par mot', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  const mg = grille('G017')
  await entrer(page, 'CE1-CE2')
  await ouvrirGrilles(page)
  await expect(page.locator('.master-grid-list__item')).toHaveCount(5)
  await lancerGrille(page, 'G017')

  // Grille affichée : même taille et mêmes cases que les données
  await expect(page.locator('.eclipse-row')).toHaveCount(mg.hauteur)
  await expect(page.locator('.eclipse-row').first().locator('.eclipse-cell')).toHaveCount(mg.largeur)
  const ouvertes = mg.lignes.join('').replace(/\./g, '').length
  await expect(page.locator('.eclipse-input')).toHaveCount(ouvertes)
  await expect(page.locator('.eclipse-header h2')).toHaveText(mg.titre)
  await expect(page.locator('.clue')).toHaveCount(mg.mots.length)
  await expect(page.getByTestId('mg-progress')).toHaveText(`0 / ${mg.mots.length} mots`)

  for (let r = 0; r < mg.hauteur; r++) {
    for (let c = 0; c < mg.largeur; c++) {
      if (mg.lignes[r][c] !== '.') await ecrire(page, r, c, mg.lignes[r][c].toLowerCase())
    }
  }
  await expect(page.getByTestId('mg-progress')).toHaveText(`${mg.mots.length} / ${mg.mots.length} mots`)
  await expect(page.getByTestId('mg-score')).toHaveText(String(mg.mots.length * 10))
  await expect(page.locator('.master-grid-game__done')).toHaveText(`Grille terminée ! ${mg.mots.length * 10} points enregistrés.`)

  const scores = await scoresL16(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ gameType: 'masterGrid', score: 100, niveau: 'CE1-CE2', gridId: 'G017', langue: 'en', statut: 'VALIDÉE PAR ISAAC', wordCount: 10, wordsFound: 10 })
  const lignes = await lignesL16(page)
  expect(lignes.map(l => l.itemId).sort()).toEqual(mg.mots.map(m => m.id).sort())
  expect(lignes.every(l => l.isCorrect === true && l.wordId === null)).toBe(true)

  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.locator('.crossword-finished__score-value')).toHaveText('100')
  await expect(page.locator('.master-grid-finished__count')).toHaveText('10 mots trouvés sur 10')
  // « Terminer » ne réenregistre pas le score
  expect(await scoresL16(page)).toHaveLength(1)
  await page.getByRole('button', { name: 'Retour' }).click()
  await totalAffiche(page, 100)
  expect(erreurs, erreurs.join('\n')).toEqual([])
})

test('Saisie comme les mots croisés : lettres accentuées acceptées, mot perdu si une lettre est effacée (G085)', async ({ page }) => {
  const mg = grille('G085')
  const mot = mg.mots.find(m => m.reponse === 'MÈTRE')
  await entrer(page, 'CM1-CM2')
  await ouvrirGrilles(page)
  await lancerGrille(page, 'G085')
  const [dr, dc] = mot.direction === 'down' ? [1, 0] : [0, 1]
  const lettres = [...mot.reponse.toLowerCase()]
  for (let i = 0; i < lettres.length; i++) await ecrire(page, mot.ligne + dr * i, mot.colonne + dc * i, lettres[i])
  await expect(page.getByTestId('mg-score')).toHaveText('10')
  await expect(caseGrille(page, mot.ligne + dr, mot.colonne + dc)).toHaveValue('E')
  await caseGrille(page, mot.ligne, mot.colonne).click()
  await page.keyboard.press('Backspace')
  await expect(page.getByTestId('mg-score')).toHaveText('0')
  await expect(page.getByTestId('mg-progress')).toHaveText(`0 / ${mg.mots.length} mots`)
  // Aucun score enregistré tant que la partie n'est pas finie ; la ligne de progression reste
  expect(await scoresL16(page)).toHaveLength(0)
  expect((await lignesL16(page)).map(l => l.itemId)).toEqual([mot.id])
})

test('Flèches du clavier bornées par la taille réelle de la grille (G093, 13 × 10)', async ({ page }) => {
  await entrer(page, 'CM1-CM2')
  await ouvrirGrilles(page)
  await lancerGrille(page, 'G093')
  // Ligne 5, colonne 2 (T de TRAVAILLE) : flèche bas -> ligne 7, colonne 2 (R de REVEILLE)
  await caseGrille(page, 4, 1).click()
  await page.keyboard.press('ArrowDown')
  await expect(caseGrille(page, 6, 1)).toBeFocused()
  // Dernière ligne (10) : flèche bas sans effet
  await caseGrille(page, 9, 11).click()
  await page.keyboard.press('ArrowDown')
  await expect(caseGrille(page, 9, 11)).toBeFocused()
  // Dernière colonne (13) : flèche droite sans effet
  await caseGrille(page, 8, 12).click()
  await page.keyboard.press('ArrowRight')
  await expect(caseGrille(page, 8, 12)).toBeFocused()
})

for (const id of ['G085', 'G140']) {
  test(`À 320 × 640 : ${id} sans débordement, taille des cases mesurée, un mot joué au toucher`, async ({ page }, testInfo) => {
    const erreurs = suivreErreurs(page)
    const mg = grille(id)
    await page.setViewportSize({ width: 320, height: 640 })
    await entrer(page, 'CM1-CM2', `Petit ${id}`)
    await ouvrirGrilles(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    await lancerGrille(page, id)
    const m = await page.evaluate(() => {
      const b = document.querySelector('.eclipse-board').getBoundingClientRect()
      const c = document.querySelector('.eclipse-cell').getBoundingClientRect()
      return {
        cellW: c.width, cellH: c.height, boardLeft: b.left, boardRight: b.right,
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      }
    })
    testInfo.annotations.push({ type: 'mesure', description: `${id} (${mg.largeur} × ${mg.hauteur}) à 320 px : case ${m.cellW.toFixed(2)} × ${m.cellH.toFixed(2)} px` })
    console.log(`MESURE ${testInfo.project.name} ${id} ${mg.largeur}x${mg.hauteur} case=${m.cellW.toFixed(2)}x${m.cellH.toFixed(2)} grille=${m.boardLeft.toFixed(1)}-${m.boardRight.toFixed(1)}`)
    expect(m.overflow).toBe(false)
    expect(m.boardLeft).toBeGreaterThanOrEqual(0)
    expect(m.boardRight).toBeLessThanOrEqual(320)
    // Calcul attendu (EclipseGrid.css) : min(26, (320 − 32 − 12) / colonnes)
    expect(m.cellW).toBeCloseTo(Math.min(26, 276 / mg.largeur), 1)
    expect(m.cellH).toBeCloseTo(m.cellW, 1)

    // Premier mot joué au toucher à cette largeur
    const mot = mg.mots[0]
    const [dr, dc] = mot.direction === 'down' ? [1, 0] : [0, 1]
    for (let i = 0; i < mot.grille.length; i++) await ecrire(page, mot.ligne + dr * i, mot.colonne + dc * i, mot.grille[i])
    await expect(page.getByTestId('mg-score')).toHaveText('10')
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    expect(erreurs, erreurs.join('\n')).toEqual([])
  })
}

// Non-régression : tailles des cases des mots croisés mesurées sur main
// (603393b) avant le lot B (sujet Digestion, CM1-CM2, type Français ;
// mêmes valeurs sur les 3 projets).
const CASES_MOTS_CROISES = [
  { largeur: 320, hauteur: 640, caseAttendue: 18.39 },
  { largeur: 375, hauteur: 812, caseAttendue: 22.06 },
  { largeur: 768, hauteur: 1024, caseAttendue: 26 },
  { largeur: 1280, hauteur: 800, caseAttendue: 40 }
]
for (const { largeur, hauteur, caseAttendue } of CASES_MOTS_CROISES) {
  test(`Non-régression mots croisés à ${largeur} px : grille 15 × 15, cases de ${caseAttendue} px`, async ({ page }) => {
    await page.setViewportSize({ width: largeur, height: hauteur })
    await ouvrirMotsCroises(page)
    await choisir(page, { type: 'Français', niveau: 'CM1-CM2', sujet: 'Digestion' })
    await page.getByRole('button', { name: 'Commencer' }).click()
    await expect(page.locator('.eclipse-header')).toContainText('Mots croisés — DIGESTION')
    await expect(page.locator('.eclipse-row')).toHaveCount(15)
    await expect(page.locator('.eclipse-cell')).toHaveCount(225)
    const m = await page.evaluate(() => {
      const c = document.querySelector('.eclipse-cell').getBoundingClientRect()
      return { w: c.width, h: c.height, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }
    })
    expect(m.w).toBeCloseTo(caseAttendue, 1)
    expect(m.h).toBeCloseTo(caseAttendue, 1)
    expect(m.overflow).toBe(false)
  })
}
