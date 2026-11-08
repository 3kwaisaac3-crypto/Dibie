// Nombres croisés (fiche M1, phase 5, lot B) : parties complètes en français
// et en anglais, sélection (horizontal d'abord, second toucher = vertical),
// pavé au toucher et au clavier, ⌫, vérification à la demande, chiffre révélé
// après 2 erreurs, « Voir la réponse » après 3, score enregistré une seule
// fois (même sans « Terminer »), même numéro = même grille, langue qui ne
// change que les définitions, classes non jouables, affichage à 320 et 375 px.
// Lot C : CM1, CM2, Class 5, Class 6 jouables (grilles 6 × 6 et 7 × 7, à 320
// et 375 px), expressions avec priorité (BODMAS) en Class 4.
// La grille attendue est calculée par le module pur (src/utils/crossNumberGame.js) :
// l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { suivreErreurs, totalAffiche } from './outils.js'
import { createCrossNumberGame } from '../src/utils/crossNumberGame.js'
import { visibleArea } from '../src/utils/crossNumberPlay.js'

// Crée un profil avec sous-système et classe, puis ouvre le tableau de bord
async function creerProfilComplet(page, { pseudo, niveau, sousSysteme = 'fr', classe = '' }) {
  await page.goto('/')
  await page.getByLabel('Pseudonyme').fill(pseudo)
  await page.getByLabel('Niveau').selectOption(niveau)
  await page.getByLabel('Sous-système').selectOption(sousSysteme)
  await page.getByLabel('Classe (facultatif)').selectOption(classe)
  await page.getByRole('button', { name: 'Créer et jouer' }).click()
  await expect(page.getByRole('button', { name: /Nombres croisés/ })).toBeVisible()
}

// Du tableau de bord jusqu'à la grille
async function lancer(page, { numero, langue = 'fr' }) {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Nombres croisés/ : /Number crossword/ }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.pyramid-select__start').click()
  await expect(page.locator('.cn-game')).toBeVisible()
}

const caseGrille = (page, [r, c]) => page.locator(`.cn-grid [data-cell="${r}-${c}"]`)
const nomNombre = (e, langue = 'fr') => `${e.number} ${e.direction === 'across' ? (langue === 'fr' ? 'horizontal' : 'across') : (langue === 'fr' ? 'vertical' : 'down')}`
const lignes = async (page) =>
  (await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress') || '[]'))).filter(l => l.gameType === 'crossNumber')
const scoresM1 = async (page) =>
  (await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores') || '[]'))).filter(s => s.gameType === 'crossNumber')

async function touche(page, chiffre) {
  await page.locator('.number-pad').getByRole('button', { name: chiffre, exact: true }).click()
}
async function valider(page, langue = 'fr') {
  await page.locator('.number-pad').getByRole('button', { name: langue === 'fr' ? 'Valider' : 'Check' }).click()
}

// Choisit un nombre en touchant sa première case (une seconde fois si le
// nombre horizontal passe d'abord)
async function choisirParCase(page, e, langue = 'fr') {
  const courant = page.getByTestId('cn-current')
  for (let k = 0; k < 2; k++) {
    await caseGrille(page, e.cells[0]).click()
    if ((await courant.textContent()).startsWith(nomNombre(e, langue))) return
  }
  throw new Error(`nombre ${e.id} non choisi`)
}

// Écrit les chiffres d'un nombre dans ses cases encore modifiables
async function ecrireNombre(page, e, chiffres) {
  for (const [i, cell] of e.cells.entries()) {
    const classe = await caseGrille(page, cell).getAttribute('class')
    if (/cn-cell--(found|shown|revealed)/.test(classe)) continue
    await touche(page, String(chiffres[i]))
  }
}

const chiffresJustes = (g, e) => e.cells.map(([r, c]) => g.cells[r][c])

// Joue toute la grille sans erreur, en touchant les cases
async function jouerGrille(page, g, langue = 'fr') {
  for (const e of g.entries) {
    await choisirParCase(page, e, langue)
    await ecrireNombre(page, e, chiffresJustes(g, e))
    await valider(page, langue)
    for (const cell of e.cells) await expect(caseGrille(page, cell)).toHaveClass(/cn-cell--found/)
  }
}

test('Partie complète (CE1, francophone) : grille du générateur, score enregistré une fois, progrès, retour', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Croises CE1', niveau: 'CE1-CE2', classe: 'CE1' })
  const numero = 2024
  const g = createCrossNumberGame({ className: 'CE1', subsystem: 'fr', seed: numero })
  await lancer(page, { numero })
  await expect(page.locator('.cn-header h1')).toHaveText('Nombres croisés - CE1')
  await expect(page.getByTestId('cn-seed-line')).toHaveText(`Partie n° ${numero} · CE1 · CE1-CE2`)
  // Aucun champ de saisie dans la partie : le clavier du téléphone ne s'ouvre pas
  await expect(page.locator('.cn-game input, .cn-game textarea')).toHaveCount(0)
  // Grille : cases noires et numéros comme la grille attendue
  const a = visibleArea(g)
  await expect(page.locator('.cn-grid > *')).toHaveCount(a.rows * a.cols)
  for (const e of g.entries) {
    await expect(caseGrille(page, e.cells[0]).locator('.cn-cell__num')).toHaveText(String(e.number))
  }
  // Pavé dans l'écran dès l'ouverture, quelle que soit la taille du projet
  // (ordinateur 1280 × 800, tablette, téléphone)
  const m = await mesurer(page)
  expect(m.overflow).toBe(false)
  expect(m.padTop).toBeGreaterThanOrEqual(0)
  expect(m.padBottom).toBeLessThanOrEqual(m.viewport + 0.5)
  // Premier nombre choisi d'office, sa définition affichée
  const premier = g.entries[0]
  await expect(page.getByTestId('cn-current')).toHaveText(`${nomNombre(premier)} : ${premier.text.fr}`)

  await jouerGrille(page, g)
  const points = g.entries.length * 10
  await expect(page.getByTestId('cn-progress')).toHaveText(`Nombres ${g.entries.length} / ${g.entries.length} · ${points} points`)
  // Score enregistré dès le dernier nombre, avant « Terminer »
  let scores = await scoresM1(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({
    gameType: 'crossNumber', score: points, niveau: 'CE1-CE2', seed: numero, className: 'CE1', subsystem: 'fr',
    templateId: g.templateId, numberCount: g.entries.length, shown: [], revealed: [], errors: 0
  })
  expect(scores[0].found).toHaveLength(g.entries.length)
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.getByTestId('cn-final-score')).toHaveText(String(points))
  scores = await scoresM1(page)
  expect(scores).toHaveLength(1)
  const progres = await lignes(page)
  expect(progres).toHaveLength(g.entries.length)
  expect(progres.every(l => l.isCorrect === true && l.wordId === null)).toBe(true)
  expect(progres[0].itemId).toBe(`fr:CE1:${numero}:${g.entries[0].id}`)

  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Nombres croisés/ })).toBeVisible()
  await totalAffiche(page, points)
  expect(erreurs).toEqual([])
})

test('Partie complète en anglais (Class 3, anglophone), nombres choisis dans la liste des définitions', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Cross Class 3', niveau: 'CE1-CE2', sousSysteme: 'en', classe: 'Class 3' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 77
  const g = createCrossNumberGame({ className: 'Class 3', subsystem: 'en', seed: numero })
  await lancer(page, { numero, langue: 'en' })
  await expect(page.locator('.cn-header h1')).toHaveText('Number crossword - Class 3')
  // Liste repliée au départ ; ouverte, elle donne toutes les définitions
  await expect(page.getByTestId('cn-list')).toHaveCount(0)
  await page.getByRole('button', { name: `All the clues (${g.entries.length})` }).click()
  for (const e of g.entries) {
    await expect(page.locator(`.cn-list [data-entry="${e.id}"]`)).toContainText(e.text.en)
  }
  for (const e of g.entries) {
    await page.locator(`.cn-list button[data-entry="${e.id}"]`).click()
    await expect(page.getByTestId('cn-current')).toHaveText(`${nomNombre(e, 'en')}: ${e.text.en}`)
    await ecrireNombre(page, e, chiffresJustes(g, e))
    await valider(page, 'en')
    await expect(page.locator(`.cn-list [data-entry="${e.id}"]`)).toContainText(`= ${e.answer}`)
  }
  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.locator('.cn-finished')).toContainText('Wrong answers during the game: 0')
  const scores = await scoresM1(page)
  expect(scores.at(-1)).toMatchObject({ score: g.entries.length * 10, className: 'Class 3', subsystem: 'en', niveau: 'CE1-CE2' })
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /Number crossword/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Erreurs : nombre laissé à corriger, chiffre révélé à la 2e erreur, « Voir la réponse » à la 3e (0 point)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Erreurs CP', niveau: 'SIL-CP', classe: 'CP' })
  const numero = 12
  const g = createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed: numero })
  await lancer(page, { numero })
  const e = g.entries[0]
  const justes = chiffresJustes(g, e)
  // Chiffres tous faux (chaque chiffre décalé de 1, jamais 0 en tête)
  const faux = justes.map(d => (d + 1) % 10 === 0 ? 1 : (d + 1) % 10)
  const valeur = (cell) => caseGrille(page, cell).locator('.cn-cell__digit')

  await ecrireNombre(page, e, faux)
  await valider(page)
  const message = page.locator('.cn-feedback')
  await expect(message).toContainText(`Pas encore. ${nomNombre(e)} : ${e.text.fr}.`)
  for (const [i, cell] of e.cells.entries()) await expect(valeur(cell)).toHaveText(String(faux[i]))
  await expect(caseGrille(page, e.cells[0])).toHaveClass(/cn-cell--wrong/)
  await expect(page.getByRole('button', { name: 'Voir la réponse' })).toHaveCount(0)

  // 2e erreur : la première case fausse est révélée
  await valider(page)
  await expect(message).toContainText('Un chiffre est révélé.')
  await expect(caseGrille(page, e.cells[0])).toHaveClass(/cn-cell--revealed/)
  await expect(valeur(e.cells[0])).toHaveText(String(justes[0]))

  // 3e erreur : « Voir la réponse »
  await valider(page)
  await expect(message).toContainText('Tu peux essayer encore ou voir la réponse.')
  await page.getByRole('button', { name: 'Voir la réponse' }).click()
  await expect(message).toContainText(`La réponse était ${e.answer}. Ce nombre ne compte pas de points.`)
  for (const [i, cell] of e.cells.entries()) {
    await expect(caseGrille(page, cell)).toHaveClass(/cn-cell--shown/)
    await expect(valeur(cell)).toHaveText(String(justes[i]))
  }
  await expect(page.getByTestId('cn-progress')).toHaveText(`Nombres 1 / ${g.entries.length} · 0 points`)
  let progres = await lignes(page)
  expect(progres.map(l => l.isCorrect)).toEqual([false, false, false, false])
  expect(progres.every(l => l.itemId === `fr:CP:${numero}:${e.id}`)).toBe(true)

  // Le reste de la grille sans erreur ; le nombre montré ne compte pas
  for (const x of g.entries.slice(1)) {
    await choisirParCase(page, x)
    await ecrireNombre(page, x, chiffresJustes(g, x))
    await valider(page)
  }
  const points = (g.entries.length - 1) * 10
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.getByTestId('cn-final-score')).toHaveText(String(points))
  await expect(page.locator('.cn-finished')).toContainText('Réponses fausses pendant la partie : 3')
  await expect(page.locator('.cn-finished')).toContainText('Réponses montrées (sans points) : 1')
  await expect(page.locator('.cn-finished')).toContainText('Nombres avec un chiffre révélé : 1')
  await expect(page.locator(`.cn-finished [data-entry="${e.id}"]`)).toContainText('(réponse montrée)')
  const scores = await scoresM1(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: points, shown: [e.id], revealed: [e.id], errors: 3 })
  progres = await lignes(page)
  expect(progres).toHaveLength(4 + g.entries.length - 1)
  expect(erreurs).toEqual([])
})

test('Sélection et saisie : horizontal d\'abord, second toucher = vertical, avance automatique, ⌫, clavier physique et Entrée', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Saisie CE2', niveau: 'CE1-CE2', classe: 'CE2' })
  const numero = 5
  const g = createCrossNumberGame({ className: 'CE2', subsystem: 'fr', seed: numero })
  await lancer(page, { numero })
  // Une case de croisement : un horizontal et un vertical y passent
  const across = g.entries.filter(e => e.direction === 'across')
  let croisement = null
  for (const h of across) {
    for (const cell of h.cells) {
      const v = g.entries.find(e => e.direction === 'down' && e.cells.some(([r, c]) => r === cell[0] && c === cell[1]))
      // Pas la case active du départ (un toucher y changerait déjà de sens)
      const depart = g.entries[0].cells[0]
      const estDepart = cell[0] === depart[0] && cell[1] === depart[1]
      if (v && !croisement && !estDepart) croisement = { h, v, cell }
    }
  }
  expect(croisement).not.toBeNull()
  const { h, v, cell } = croisement
  const courant = page.getByTestId('cn-current')
  await caseGrille(page, cell).click()
  await expect(courant).toHaveText(`${nomNombre(h)} : ${h.text.fr}`)
  await caseGrille(page, cell).click()
  await expect(courant).toHaveText(`${nomNombre(v)} : ${v.text.fr}`)
  await caseGrille(page, cell).click()
  await expect(courant).toHaveText(`${nomNombre(h)} : ${h.text.fr}`)

  // Avance automatique au pavé, puis ⌫ : case remplie effacée, case vide : recul
  await choisirParCase(page, h)
  const chiffre = (k) => caseGrille(page, h.cells[k]).locator('.cn-cell__digit')
  await touche(page, '1')
  await touche(page, '2')
  await expect(chiffre(0)).toHaveText('1')
  await expect(chiffre(1)).toHaveText('2')
  await expect(caseGrille(page, h.cells[2] ?? h.cells[1])).toHaveAttribute('aria-pressed', 'true')
  await page.locator('.number-pad').getByRole('button', { name: 'Effacer un chiffre' }).click()
  if (h.cells.length > 2) {
    // Case active vide (3e case) : recule et efface la 2e
    await expect(chiffre(1)).toHaveText('')
    await expect(caseGrille(page, h.cells[1])).toHaveAttribute('aria-pressed', 'true')
  } else {
    // Dernière case remplie : effacée sur place
    await expect(chiffre(1)).toHaveText('')
  }
  await expect(chiffre(0)).toHaveText('1')

  // Clavier physique : chiffres, Retour arrière, Entrée sur une case du nombre
  // (la première case, touchée : elle a le focus)
  await choisirParCase(page, h)
  const justes = chiffresJustes(g, h).join('')
  await page.keyboard.type(justes)
  await page.keyboard.press('Backspace') // dernière case remplie : effacée
  await expect(caseGrille(page, h.cells.at(-1)).locator('.cn-cell__digit')).toHaveText('')
  await page.keyboard.type(justes.slice(-1))
  await page.keyboard.press('Enter')
  for (const c of h.cells) await expect(caseGrille(page, c)).toHaveClass(/cn-cell--found/)
  await expect(page.locator('.cn-feedback')).toContainText(`Bravo ! ${nomNombre(h)} : ${g.entries.find(e => e.id === h.id).answer}`)
  // Chiffre de trop ignoré après la dernière case
  const suivant = g.entries.find(e => e.id !== h.id && e.cells.every(([r, c]) => !h.cells.some(([a, b]) => a === r && b === c)))
  if (suivant) {
    await choisirParCase(page, suivant)
    await page.keyboard.type('1'.repeat(suivant.length + 2))
    for (const c of suivant.cells) await expect(caseGrille(page, c).locator('.cn-cell__digit')).toHaveText('1')
  }
  expect(erreurs).toEqual([])
})

test('Même numéro, même grille ; la langue ne change que les définitions ; numéro invalide refusé', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Graine CP', niveau: 'SIL-CP', classe: 'CP' })
  const numero = 4242
  const g = createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed: numero })
  await lancer(page, { numero })
  const lireGrille = () => page.evaluate(() => [...document.querySelectorAll('.cn-grid > *')]
    .map(c => (c.classList.contains('cn-cell--black') ? '#' : (c.querySelector('.cn-cell__num')?.textContent ?? '.'))).join(''))
  const avant = await lireGrille()
  const e = g.entries[0]
  await expect(page.getByTestId('cn-current')).toHaveText(`${nomNombre(e)} : ${e.text.fr}`)
  // Changement de langue en cours de partie : même grille, définitions en anglais
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.getByTestId('cn-current')).toHaveText(`${nomNombre(e, 'en')}: ${e.text.en}`)
  expect(await lireGrille()).toBe(avant)
  await page.getByRole('button', { name: 'Français' }).click()

  // Nouvelle partie avec le même numéro : même grille
  await page.locator('.cn-game .pyramid-game__back').click()
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.pyramid-select__start').click()
  expect(await lireGrille()).toBe(avant)

  // Numéro invalide : refusé, pas de partie
  await page.locator('.cn-game .pyramid-game__back').click()
  await page.getByLabel('Numéro de partie (facultatif)').fill('12a')
  await page.locator('.pyramid-select__start').click()
  await expect(page.locator('#cn-seed-hint')).toHaveText('Numéro invalide : un nombre entier de 0 à 4294967295.')
  await expect(page.locator('.cn-game')).toHaveCount(0)
  expect(erreurs).toEqual([])
})

test('Classes non jouables : SIL et Class 1 (jeu non proposé) ; depuis le lot C, plus de message « Bientôt » en CM1 et Class 5', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  // Lot C : CM1 et Class 5 ont un bouton « Commencer », aucun message « Bientôt »
  for (const c of [
    { pseudo: 'Ouvert CM1', niveau: 'CM1-CM2', sousSysteme: 'fr', classe: 'CM1' },
    { pseudo: 'Ouvert Class 5', niveau: 'CM1-CM2', sousSysteme: 'en', classe: 'Class 5' }
  ]) {
    await creerProfilComplet(page, c)
    await page.getByRole('button', { name: /Nombres croisés/ }).click()
    await expect(page.locator('.pyramid-select__start')).toBeVisible()
    await expect(page.getByTestId('cn-soon')).toHaveCount(0)
    await expect(page.getByTestId('cn-not-offered')).toHaveCount(0)
    await expect(page.locator('.pyramid-select')).not.toContainText('Bientôt')
    await page.evaluate(() => localStorage.clear())
  }
  const cas = [
    { pseudo: 'Croises SIL', niveau: 'SIL-CP', sousSysteme: 'fr', classe: 'SIL', id: 'cn-not-offered', texte: 'Pas encore de nombres croisés pour ta classe (SIL)' },
    { pseudo: 'Croises Class 1', niveau: 'SIL-CP', sousSysteme: 'en', classe: 'Class 1', id: 'cn-not-offered', texte: 'à partir de la classe Class 2' }
  ]
  for (const c of cas) {
    await creerProfilComplet(page, c)
    await page.getByRole('button', { name: /Nombres croisés/ }).click()
    await expect(page.getByTestId(c.id)).toContainText(c.texte)
    await expect(page.locator('.pyramid-select__start')).toHaveCount(0)
    await expect(page.getByLabel('Numéro de partie (facultatif)')).toHaveCount(0)
    await page.getByRole('button', { name: 'Retour' }).click()
    await expect(page.getByRole('button', { name: /Nombres croisés/ })).toBeVisible()
    await page.evaluate(() => localStorage.clear())
  }
  // En anglais
  await creerProfilComplet(page, { pseudo: 'Cross SIL', niveau: 'SIL-CP', classe: 'SIL' })
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: /Number crossword/ }).click()
  await expect(page.getByTestId('cn-not-offered')).toHaveText('No number crossword yet for your class (SIL): the numbers you study are still small. This game will open from CP.')
  expect(erreurs).toEqual([])
})

test('Score gardé si l\'élève quitte sans « Terminer » ; Nouvelle partie n\'en ajoute pas', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Quitte Class 2', niveau: 'SIL-CP', sousSysteme: 'en', classe: 'Class 2' })
  const numero = 9
  const g = createCrossNumberGame({ className: 'Class 2', subsystem: 'en', seed: numero })
  await lancer(page, { numero })
  await jouerGrille(page, g)
  // « Nouvelle partie » sans « Terminer » : score déjà enregistré, rien d'ajouté
  await page.locator('.cn-game').getByRole('button', { name: 'Nouvelle partie' }).click()
  await expect(page.getByTestId('cn-progress')).toContainText('Nombres 0 /')
  expect(await scoresM1(page)).toHaveLength(1)
  await page.locator('.cn-game .pyramid-game__back').click()
  await page.getByRole('button', { name: 'Retour' }).click()
  await totalAffiche(page, g.entries.length * 10)
  const scores = await scoresM1(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ className: 'Class 2', subsystem: 'en', score: g.entries.length * 10 })
  expect(erreurs).toEqual([])
})

// Mesures de la disposition : débordement horizontal, cases, pavé dans l'écran
async function mesurer(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const cells = [...document.querySelectorAll('.cn-grid button.cn-cell')].map(c => c.getBoundingClientRect())
    const grid = document.querySelector('.cn-grid').getBoundingClientRect()
    const card = document.querySelector('.cn-card').getBoundingClientRect()
    const pad = document.querySelector('.number-pad').getBoundingClientRect()
    const bottom = document.querySelector('.cn-bottom').getBoundingClientRect()
    const keys = [...document.querySelectorAll('.number-pad__key')].map(k => k.getBoundingClientRect())
    return {
      overflow: doc.scrollWidth > doc.clientWidth,
      minCell: Math.min(...cells.map(r => Math.min(r.width, r.height))),
      gridInCard: grid.left >= card.left - 0.5 && grid.right <= card.right + 0.5,
      padBottom: pad.bottom,
      padTop: pad.top,
      gridBottom: grid.bottom,
      bottomTop: bottom.top,
      scrollY: window.scrollY,
      viewport: window.innerHeight,
      minKey: Math.min(...keys.map(k => Math.min(k.width, k.height)))
    }
  })
}

for (const largeur of [320, 375]) {
  test(`À ${largeur} px : grille 5 × 5 (CE2) sans débordement, cases et touches tactiles, pavé visible en bas`, async ({ page }) => {
    const erreurs = suivreErreurs(page)
    await page.setViewportSize({ width: largeur, height: largeur === 320 ? 640 : 812 })
    await creerProfilComplet(page, { pseudo: `Petit ${largeur}`, niveau: 'CE1-CE2', classe: 'CE2' })
    const numero = 31
    const g = createCrossNumberGame({ className: 'CE2', subsystem: 'fr', seed: numero })
    await lancer(page, { numero })
    await page.evaluate(() => window.scrollTo(0, 0))
    const m = await mesurer(page)
    expect(m.overflow).toBe(false)
    expect(m.gridInCard).toBe(true)
    // Toute la grille visible au-dessus du bas d'écran fixé, sans défilement
    expect(m.scrollY).toBe(0)
    expect(m.gridBottom).toBeLessThanOrEqual(m.bottomTop)
    expect(m.minCell).toBeGreaterThanOrEqual(40)
    expect(m.minKey).toBeGreaterThanOrEqual(44)
    // Pavé entièrement dans l'écran dès l'ouverture (bas collant)
    expect(m.padTop).toBeGreaterThanOrEqual(0)
    expect(m.padBottom).toBeLessThanOrEqual(m.viewport + 0.5)
    // Liste ouverte : toujours pas de débordement, pavé toujours visible après défilement
    await page.getByRole('button', { name: /Toutes les définitions/ }).click()
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    const m2 = await mesurer(page)
    expect(m2.overflow).toBe(false)
    expect(m2.padBottom).toBeLessThanOrEqual(m2.viewport + 0.5)
    expect(m2.padTop).toBeGreaterThanOrEqual(0)
    // Un nombre joué au toucher à cette largeur
    const e = g.entries[0]
    await page.locator(`.cn-list button[data-entry="${e.id}"]`).click()
    await ecrireNombre(page, e, chiffresJustes(g, e))
    await valider(page)
    await expect(caseGrille(page, e.cells[0])).toHaveClass(/cn-cell--found/)
    // Fin de partie à cette largeur : grille et liste sans débordement
    for (const x of g.entries.slice(1)) {
      await page.locator(`.cn-list button[data-entry="${x.id}"]`).click()
      await ecrireNombre(page, x, chiffresJustes(g, x))
      await valider(page)
    }
    await page.getByRole('button', { name: 'Terminer' }).click()
    await expect(page.locator('.cn-finished .cn-grid')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    expect(erreurs).toEqual([])
  })
}

test('À 320 px, carré 3 × 3 affiché en grille 2 × 2 sans cadre (CP)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  // Premier numéro dont la grille est le carré
  let numero = 1
  while (createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed: numero }).templateId !== 'T3-carre') numero++
  await creerProfilComplet(page, { pseudo: 'Carre CP', niveau: 'SIL-CP', classe: 'CP' })
  await lancer(page, { numero })
  await expect(page.locator('.cn-grid > *')).toHaveCount(4)
  await expect(page.locator('.cn-grid .cn-cell--black')).toHaveCount(0)
  const m = await mesurer(page)
  expect(m.overflow).toBe(false)
  expect(m.minCell).toBeGreaterThanOrEqual(44)
})

test('Décision d\'Isaac (choix n° 8) : carré CP, deux horizontaux montrés : verticaux remplis sans l\'élève, montrés d\'office, 0 point', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  let numero = 1
  while (createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed: numero }).templateId !== 'T3-carre') numero++
  const g = createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed: numero })
  await creerProfilComplet(page, { pseudo: 'Montre CP', niveau: 'SIL-CP', classe: 'CP' })
  await lancer(page, { numero })
  const across = g.entries.filter(e => e.direction === 'across')
  const down = g.entries.filter(e => e.direction === 'down')
  for (const e of across) {
    await choisirParCase(page, e)
    const faux = chiffresJustes(g, e).map(d => (d + 1) % 10 === 0 ? 1 : (d + 1) % 10)
    await ecrireNombre(page, e, faux)
    for (let k = 0; k < 3; k++) await valider(page)
    await page.getByRole('button', { name: 'Voir la réponse' }).click()
  }
  // Les deux verticaux sont entièrement fixés par des nombres montrés et un
  // chiffre révélé : l'un dès le chiffre révélé du 2e horizontal, l'autre à
  // la réponse montrée
  await expect(page.locator('.cn-feedback')).toContainText('Rempli sans toi (sans points) : ')
  for (const e of down) for (const cell of e.cells) await expect(caseGrille(page, cell)).toHaveClass(/cn-cell--shown/)
  await expect(page.locator('.cn-feedback')).toContainText('Grille terminée !')
  await expect(page.getByTestId('cn-progress')).toHaveText('Nombres 4 / 4 · 0 points')
  const scores = await scoresM1(page)
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ score: 0, found: [] })
  expect([...scores[0].shown].sort()).toEqual(g.entries.map(e => e.id).sort())
  // 6 vérifications fausses, 2 réponses montrées, 2 nombres montrés d'office
  const progres = await lignes(page)
  expect(progres).toHaveLength(10)
  expect(progres.every(l => l.isCorrect === false)).toBe(true)
  await page.getByRole('button', { name: 'Terminer' }).click()
  await expect(page.getByTestId('cn-final-score')).toHaveText('0')
  await expect(page.locator('.cn-finished')).toContainText('Réponses montrées (sans points) : 4')
  expect(erreurs).toEqual([])
})

// --- Lot C : CM1, CM2, Class 5, Class 6 (grilles 6 × 6 et 7 × 7) --------------

const LOT_C = [
  { classe: 'CM1', sousSysteme: 'fr', taille: 6 },
  { classe: 'CM2', sousSysteme: 'fr', taille: 7 },
  { classe: 'Class 5', sousSysteme: 'en', taille: 6 },
  { classe: 'Class 6', sousSysteme: 'en', taille: 7 }
]

// Disposition à l'ouverture (numéro 3 : définition courante sur une ligne dans
// les quatre classes) : grille entière au-dessus du bas d'écran fixé, cases
// d'au moins 36 px, touches d'au moins 44 px, pavé dans l'écran ; liste ouverte
// et page défilée : pavé toujours visible, aucun débordement horizontal.
// En 6 × 6 et 7 × 7, la page défile d'elle-même jusqu'au haut du jeu à
// l'ouverture (sous 768 px, le sélecteur de langue est en haut de la page) :
// la grille et l'en-tête sont visibles sans geste de l'élève.
for (const largeur of [320, 375]) {
  test(`Lot C à ${largeur} px : grilles 6 × 6 et 7 × 7 (CM1, CM2, Class 5, Class 6) entières, cases ≥ 36 px, pavé fixé en bas`, async ({ page }) => {
    const erreurs = suivreErreurs(page)
    await page.setViewportSize({ width: largeur, height: largeur === 320 ? 640 : 812 })
    for (const c of LOT_C) {
      await creerProfilComplet(page, { pseudo: `Grand ${c.classe}`, niveau: 'CM1-CM2', sousSysteme: c.sousSysteme, classe: c.classe })
      const numero = 3
      const g = createCrossNumberGame({ className: c.classe, subsystem: c.sousSysteme, seed: numero })
      expect(g.size).toBe(c.taille)
      await lancer(page, { numero })
      await expect(page.locator('.cn-header h1')).toHaveText(`Nombres croisés - ${c.classe}`)
      // Grille entière, cases noires comprises
      const a = visibleArea(g)
      expect(a.rows * a.cols).toBe(c.taille * c.taille)
      await expect(page.locator('.cn-grid > *')).toHaveCount(c.taille * c.taille)
      await expect(page.locator('.cn-game input, .cn-game textarea')).toHaveCount(0)
      await expect.poll(async () => {
        const x = await mesurer(page)
        return x.gridBottom <= x.bottomTop
      }, { message: `${c.classe} : grille sous le bas d'écran` }).toBe(true)
      const m = await mesurer(page)
      expect(m.overflow).toBe(false)
      expect(m.gridInCard).toBe(true)
      const hauts = await page.evaluate(() => ({
        grille: document.querySelector('.cn-grid').getBoundingClientRect().top,
        titre: document.querySelector('.cn-header h1').getBoundingClientRect().top
      }))
      expect(hauts.titre).toBeGreaterThanOrEqual(-0.5)
      expect(hauts.grille).toBeGreaterThanOrEqual(0)
      expect(m.gridBottom, `${c.classe} : grille sous le bas d'écran`).toBeLessThanOrEqual(m.bottomTop)
      expect(m.minCell, `${c.classe} : cases`).toBeGreaterThanOrEqual(36)
      expect(m.minKey).toBeGreaterThanOrEqual(44)
      expect(m.padTop).toBeGreaterThanOrEqual(0)
      expect(m.padBottom).toBeLessThanOrEqual(m.viewport + 0.5)
      // Définition courante affichée en bas, liste repliée au départ
      await expect(page.getByTestId('cn-current')).toHaveText(`${nomNombre(g.entries[0])} : ${g.entries[0].text.fr}`)
      await expect(page.getByTestId('cn-list')).toHaveCount(0)
      await page.getByRole('button', { name: `Toutes les définitions (${g.entries.length})` }).click()
      for (const e of g.entries) await expect(page.locator(`.cn-list [data-entry="${e.id}"]`)).toContainText(e.text.fr)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      const m2 = await mesurer(page)
      expect(m2.overflow).toBe(false)
      expect(m2.padTop).toBeGreaterThanOrEqual(0)
      expect(m2.padBottom).toBeLessThanOrEqual(m2.viewport + 0.5)
      await page.locator('.cn-game .pyramid-game__back').click()
      await page.evaluate(() => localStorage.clear())
    }
    expect(erreurs).toEqual([])
  })
}

// Une partie complète par classe du lot C, au toucher, à 320 ou 375 px :
// nombres choisis dans la liste, score enregistré une fois, fin sans débordement
const PARTIES_LOT_C = [
  { ...LOT_C[0], largeur: 320, numero: 11 },
  { ...LOT_C[1], largeur: 320, numero: 12 },
  { ...LOT_C[2], largeur: 375, numero: 13 },
  { ...LOT_C[3], largeur: 375, numero: 14 }
]
for (const p of PARTIES_LOT_C) {
  test(`Lot C : partie complète ${p.classe} (${p.taille} × ${p.taille}) à ${p.largeur} px, score enregistré une fois`, async ({ page }) => {
    const erreurs = suivreErreurs(page)
    await page.setViewportSize({ width: p.largeur, height: p.largeur === 320 ? 640 : 812 })
    await creerProfilComplet(page, { pseudo: `Partie ${p.classe}`, niveau: 'CM1-CM2', sousSysteme: p.sousSysteme, classe: p.classe })
    const g = createCrossNumberGame({ className: p.classe, subsystem: p.sousSysteme, seed: p.numero })
    await lancer(page, { numero: p.numero })
    await expect(page.getByTestId('cn-seed-line')).toHaveText(`Partie n° ${p.numero} · ${p.classe} · CM1-CM2`)
    await page.getByRole('button', { name: /Toutes les définitions/ }).click()
    for (const e of g.entries) {
      const bouton = page.locator(`.cn-list button[data-entry="${e.id}"]`)
      // Nombre déjà complété par ses croisements et résolu : bouton désactivé
      if (await bouton.isDisabled()) continue
      await bouton.click()
      await expect(page.getByTestId('cn-current')).toHaveText(`${nomNombre(e)} : ${e.text.fr}`)
      await ecrireNombre(page, e, chiffresJustes(g, e))
      await valider(page)
      for (const cell of e.cells) await expect(caseGrille(page, cell)).toHaveClass(/cn-cell--found/)
    }
    const points = g.entries.length * 10
    await expect(page.getByTestId('cn-progress')).toHaveText(`Nombres ${g.entries.length} / ${g.entries.length} · ${points} points`)
    let scores = await scoresM1(page)
    expect(scores).toHaveLength(1)
    expect(scores[0]).toMatchObject({
      score: points, niveau: 'CM1-CM2', seed: p.numero, className: p.classe, subsystem: p.sousSysteme,
      templateId: g.templateId, numberCount: g.entries.length, shown: [], revealed: [], errors: 0
    })
    await page.getByRole('button', { name: 'Terminer' }).click()
    await expect(page.getByTestId('cn-final-score')).toHaveText(String(points))
    await expect(page.locator('.cn-finished .cn-grid > *')).toHaveCount(p.taille * p.taille)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false)
    scores = await scoresM1(page)
    expect(scores).toHaveLength(1)
    expect(erreurs).toEqual([])
  })
}

test('Lot C : nombre rempli par les aides en CM2 (7 × 7) : montré d\'office, 0 point (choix n° 8)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  // Premier numéro dont un vertical de 2 chiffres a toutes ses cases dans des horizontaux
  let numero = 1
  let g
  let cible
  for (; numero < 200; numero++) {
    g = createCrossNumberGame({ className: 'CM2', subsystem: 'fr', seed: numero })
    const across = g.entries.filter(e => e.direction === 'across')
    const dans = (e, [r, c]) => e.cells.some(([a, b]) => a === r && b === c)
    cible = g.entries.find(v => v.direction === 'down' && v.length === 2 && v.cells.every(cell => across.some(h => dans(h, cell))))
    if (cible) break
  }
  expect(cible).toBeTruthy()
  const across = g.entries.filter(e => e.direction === 'across' && e.cells.some(([r, c]) => cible.cells.some(([a, b]) => a === r && b === c)))
  await page.setViewportSize({ width: 375, height: 812 })
  await creerProfilComplet(page, { pseudo: 'Aides CM2', niveau: 'CM1-CM2', classe: 'CM2' })
  await lancer(page, { numero })
  await page.getByRole('button', { name: /Toutes les définitions/ }).click()
  for (const h of across) {
    await page.locator(`.cn-list button[data-entry="${h.id}"]`).click()
    const faux = chiffresJustes(g, h).map(d => (d + 1) % 10)
    await ecrireNombre(page, h, faux)
    for (let k = 0; k < 3; k++) await valider(page)
    await page.getByRole('button', { name: 'Voir la réponse' }).click()
  }
  for (const cell of cible.cells) await expect(caseGrille(page, cell)).toHaveClass(/cn-cell--shown/)
  await expect(page.locator(`.cn-list [data-entry="${cible.id}"]`)).toContainText('(réponse montrée)')
  await expect(page.getByTestId('cn-progress')).toContainText('· 0 points')
  const progres = await lignes(page)
  expect(progres.filter(l => l.itemId === `fr:CM2:${numero}:${cible.id}`).map(l => l.isCorrect)).toEqual([false])
  expect(erreurs).toEqual([])
})

test('Class 4 : expression avec priorité (BODMAS) affichée sans parenthèses, juste quand la multiplication est faite d\'abord', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  const estExpression = (e) => e.definition.type === 'addProduct' || e.definition.type === 'subProduct'
  let numero = 1
  while (!createCrossNumberGame({ className: 'Class 4', subsystem: 'en', seed: numero }).entries.some(estExpression)) numero++
  const g = createCrossNumberGame({ className: 'Class 4', subsystem: 'en', seed: numero })
  const e = g.entries.find(estExpression)
  const [a, b, c] = e.definition.operands
  expect(e.answer).toBe(e.definition.type === 'addProduct' ? a + b * c : a - b * c)
  await creerProfilComplet(page, { pseudo: 'Bodmas Class 4', niveau: 'CE1-CE2', sousSysteme: 'en', classe: 'Class 4' })
  await page.getByRole('button', { name: 'English' }).click()
  await lancer(page, { numero, langue: 'en' })
  await page.getByRole('button', { name: /All the clues/ }).click()
  await page.locator(`.cn-list button[data-entry="${e.id}"]`).click()
  await expect(page.getByTestId('cn-current')).toHaveText(`${nomNombre(e, 'en')}: ${e.text.en}`)
  expect(e.text.en).toMatch(/^[\d,]+ [+−] \d+ × \d+$/)
  await page.locator(`.cn-list button[data-entry="${e.id}"]`).click()
  await ecrireNombre(page, e, chiffresJustes(g, e))
  await valider(page, 'en')
  for (const cell of e.cells) await expect(caseGrille(page, cell)).toHaveClass(/cn-cell--found/)
  expect(erreurs).toEqual([])
})
