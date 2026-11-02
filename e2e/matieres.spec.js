// Accès par matière aux mots croisés (phase 1), sur les trois tailles d'écran.
import { test, expect } from '@playwright/test'
import { connecterEleve, ouvrirMotsCroises, choisir, controlerGrille, suivreErreurs, vocabulaire } from './outils.js'
import { libelleSujet, matiereDuSujet, SUJET_EN } from '../src/data/sujets-matieres.js'
import { createCrosswordGame, matchesDomain } from '../src/utils/crosswordLayout.js'
import { normalizeWord } from '../src/utils/wordSearchGenerator.js'

const MATIERES_FR = [
  { id: 'maths', nom: 'Mathématiques' },
  { id: 'sciences', nom: 'Sciences et santé' },
  { id: 'tic', nom: 'Informatique et TIC' },
  { id: 'autres', nom: 'Autres' }
]

const filtre = page => page.locator('.crossword-select__matieres')
const sujetsAffiches = page => page.locator('.crossword-select__grid button').evaluateAll(bs =>
  bs.map(b => b.textContent.replace(/bientôt disponible|coming soon/, '').trim()))
const sujetActif = page => page.locator('.crossword-select__grid button.active')

async function choisirMatiere(page, nom) {
  await filtre(page).getByRole('button', { name: nom, exact: true }).click()
}

async function choisirNiveau(page, niveau) {
  await page.locator('.crossword-select').getByRole('button', { name: niveau, exact: true }).click()
}

// Sujets jouables ou grisés du vocabulaire pour un niveau et une matière
const sujetsAttendus = (niveau, matiere) => [...new Set(vocabulaire
  .filter(e => e.niveau_fr === niveau && e.actif !== false && (matiere === null || matiereDuSujet(e.sujet) === matiere))
  .map(e => e.sujet))].sort()

// Empreinte d'une grille : cases, numéros et définitions
const empreinte = page => page.evaluate(() => ({
  cases: [...document.querySelectorAll('.eclipse-board .eclipse-cell')].map(c =>
    `${c.classList.contains('empty') ? '#' : '.'}${c.querySelector('.eclipse-number')?.textContent.trim() || ''}`),
  indices: [...document.querySelectorAll('.eclipse-clues .clue')].map(c => c.textContent.trim())
}))

async function pasDeDebordement(page) {
  const { large, ecran } = await page.evaluate(() => ({ large: document.documentElement.scrollWidth, ecran: innerWidth }))
  expect(large).toBeLessThanOrEqual(ecran + 1)
  const depassent = await page.evaluate(() => [...document.querySelectorAll('.crossword-select__matieres button')]
    .filter(b => b.getBoundingClientRect().right > innerWidth + 1).map(b => b.textContent))
  expect(depassent).toEqual([])
}

// Textes français de l'interface qui ne doivent pas rester en anglais
const TEXTES_FRANCAIS = /\b(Mots|Type de Puzzle|Niveau|Matière|Sujet|Numéro|Laisser|Commencer|Retour|Bilingue|Français|Anglais|Toutes|Mathématiques|Sciences et santé|Informatique|Autres|bientôt|Avec la même|Grille|Terminer|Nouvelle|HORIZONTALEMENT|VERTICALEMENT|Bonjour|Jeux|Par matière|Profil|Série|Bientôt|SIL-CP|CE1-CE2|CM1-CM2)\b/

async function sansTexteFrancais(page) {
  const texte = await page.locator('.app').innerText()
  expect(texte.match(TEXTES_FRANCAIS)?.[0] ?? null, texte.slice(0, 400)).toBeNull()
}

test('Filtre : Toutes par défaut, chaque matière montre exactement ses sujets', async ({ page }) => {
  await connecterEleve(page, { niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  await expect(filtre(page).getByRole('button', { name: 'Toutes', exact: true })).toHaveClass(/active/)
  await expect.poll(() => sujetsAffiches(page)).toEqual(sujetsAttendus('CM1-CM2', null))
  await pasDeDebordement(page)

  for (const { id, nom } of MATIERES_FR) {
    await choisirMatiere(page, nom)
    await expect.poll(() => sujetsAffiches(page)).toEqual(sujetsAttendus('CM1-CM2', id))
    await expect(filtre(page).getByRole('button', { name: nom, exact: true })).toHaveClass(/active/)
    await pasDeDebordement(page)
  }

  await choisirMatiere(page, 'Toutes')
  await expect.poll(() => sujetsAffiches(page)).toEqual(sujetsAttendus('CM1-CM2', null))
})

test('Filtre à 320 px : aucun bouton ne dépasse en largeur, Commencer visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await ouvrirMotsCroises(page)
  await pasDeDebordement(page)
  await expect(page.getByRole('button', { name: 'Commencer' })).toBeInViewport()
})

for (const { id, nom } of MATIERES_FR) {
  test(`Matière ${nom} : le sujet par défaut en fait partie, grille jouable et cohérente`, async ({ page }) => {
    const erreurs = suivreErreurs(page)
    await connecterEleve(page, { niveau: 'CM1-CM2' })
    await page.getByRole('button', { name: /Mots Croisés/ }).click()
    await choisirMatiere(page, nom)
    await expect(sujetActif(page)).toHaveCount(1)
    const sujet = (await sujetActif(page).textContent()).trim()
    expect(matiereDuSujet(sujet)).toBe(id)

    await page.locator('.crossword-select').getByRole('button', { name: 'Français', exact: true }).click()
    await page.getByRole('button', { name: 'Commencer' }).click()
    await expect(page.locator('.eclipse-board')).toBeVisible()
    const { mots, anomalies } = await controlerGrille(page, { type: 'Français', niveau: 'CM1-CM2', sujet })
    expect(anomalies, anomalies.join('\n')).toEqual([])
    expect(mots).toBeGreaterThanOrEqual(2)

    // Retour interne : filtre et sujet gardés
    await page.locator('.eclipse-back-btn').click()
    await expect(filtre(page).getByRole('button', { name: nom, exact: true })).toHaveClass(/active/)
    await expect(sujetActif(page)).toHaveText(sujet)
    expect(erreurs, erreurs.join('\n')).toEqual([])
  })
}

test('Même numéro, même sujet : même grille avec ou sans filtre', async ({ page }) => {
  await ouvrirMotsCroises(page)
  const lancer = async () => {
    await page.getByLabel('Numéro de grille (facultatif)').fill('12345')
    await page.getByRole('button', { name: 'Commencer' }).click()
    await expect(page.locator('.eclipse-board')).toBeVisible()
    const resultat = await empreinte(page)
    await page.locator('.eclipse-back-btn').click()
    return resultat
  }

  await choisir(page, { type: 'Français', niveau: 'CM1-CM2', sujet: 'Digestion' })
  const sansFiltre = await lancer()
  expect(sansFiltre.indices.length).toBeGreaterThanOrEqual(2)

  await choisirMatiere(page, 'Sciences et santé')
  await page.locator('.crossword-select__grid button', { hasText: /^Digestion/ }).click()
  expect(await lancer()).toEqual(sansFiltre)

  // Et l'interface en anglais ne change pas non plus la grille
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByLabel('Grid number (optional)').fill('12345')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.eclipse-board')).toBeVisible()
  expect(await empreinte(page)).toEqual(sansFiltre)
})

test('Sujet courant gardé s\'il reste dans la matière, remplacé sinon ; changement de niveau', async ({ page }) => {
  await ouvrirMotsCroises(page)
  await choisir(page, { type: 'Français', niveau: 'CM1-CM2', sujet: 'Digestion' })
  await choisirMatiere(page, 'Sciences et santé')
  await expect(sujetActif(page)).toHaveText('Digestion')

  await choisirMatiere(page, 'Mathématiques')
  await expect.poll(async () => matiereDuSujet((await sujetActif(page).textContent()).trim())).toBe('maths')

  await choisirNiveau(page, 'CE1-CE2')
  await expect.poll(() => sujetsAffiches(page)).toEqual(sujetsAttendus('CE1-CE2', 'maths'))
  await expect.poll(async () => matiereDuSujet((await sujetActif(page).textContent()).trim())).toBe('maths')
})

for (const { nom, profil } of [{ nom: 'Mathématiques', profil: 'SIL-CP' }, { nom: 'Informatique et TIC', profil: 'SIL-CP' }]) {
  test(`Matière vide : ${nom} en ${profil}, message clair, Commencer désactivé, page intacte`, async ({ page }) => {
    const erreurs = suivreErreurs(page)
    await connecterEleve(page, { niveau: profil })
    await page.getByRole('button', { name: /Mots Croisés/ }).click()
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled()

    await choisirMatiere(page, nom)
    const message = page.locator('.crossword-select__empty')
    await expect(message).toContainText(`Aucun sujet en ${nom} pour le niveau ${profil}`)
    await expect(page.locator('.crossword-select__grid button')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeDisabled()

    await page.getByRole('button', { name: 'English' }).click()
    await expect(message).toContainText('No topics in')
    await expect(message).toContainText('Class 1-2')
    await expect(page.getByRole('button', { name: 'Start' })).toBeDisabled()
    await sansTexteFrancais(page)
    await page.getByRole('button', { name: 'Français' }).click()

    // On en sort en changeant de matière ou de niveau
    await choisirMatiere(page, 'Toutes')
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled()
    await choisirMatiere(page, nom)
    await choisirNiveau(page, 'CM1-CM2')
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled()
    await expect(message).toHaveCount(0)
    expect(erreurs, erreurs.join('\n')).toEqual([])
  })
}

test('Raccourcis du tableau de bord : filtre déjà réglé, non conservé au rechargement', async ({ page }) => {
  await connecterEleve(page, { niveau: 'CM1-CM2' })
  for (const { id, nom } of MATIERES_FR.filter(m => m.id !== 'autres')) {
    await page.locator('.student-dashboard__matieres').getByRole('button', { name: nom, exact: true }).click()
    await expect(filtre(page).getByRole('button', { name: nom, exact: true })).toHaveClass(/active/)
    await expect.poll(() => sujetsAffiches(page)).toEqual(sujetsAttendus('CM1-CM2', id))
    await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled()
    await page.locator('.crossword-select__back').click()
  }

  // La carte de jeu repart de « Toutes », même après un raccourci
  await page.locator('.student-dashboard__matieres').getByRole('button', { name: 'Mathématiques', exact: true }).click()
  await page.locator('.crossword-select__back').click()
  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  await expect(filtre(page).getByRole('button', { name: 'Toutes', exact: true })).toHaveClass(/active/)
  await page.locator('.crossword-select__back').click()

  // Rechargement : la page reste, la matière ne reste pas
  await page.locator('.student-dashboard__matieres').getByRole('button', { name: 'Mathématiques', exact: true }).click()
  await page.reload()
  await expect(filtre(page).getByRole('button', { name: 'Toutes', exact: true })).toHaveClass(/active/)
  expect(await page.evaluate(() => localStorage.getItem('dibieSession'))).not.toMatch(/maths/)
})

test('Raccourci en SIL-CP : matière vide, message, retour possible', async ({ page }) => {
  await connecterEleve(page, { niveau: 'SIL-CP' })
  await page.locator('.student-dashboard__matieres').getByRole('button', { name: 'Mathématiques', exact: true }).click()
  await expect(page.locator('.crossword-select__empty')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Commencer' })).toBeDisabled()
  await page.locator('.crossword-select__back').click()
  await expect(page.locator('.student-dashboard')).toBeVisible()
})

test('Anglais : sujets, types et matières traduits, grille jouable, aucun texte français d\'interface', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: 'English' }).click()
  await sansTexteFrancais(page)
  await expect(page.locator('.student-dashboard__matieres')).toContainText('Mathematics')

  await page.locator('.student-dashboard__matieres').getByRole('button', { name: 'Science and health', exact: true }).click()
  await expect(filtre(page).getByRole('button', { name: 'Science and health', exact: true })).toHaveClass(/active/)
  await sansTexteFrancais(page)

  await choisirMatiere(page, 'All')
  const attendus = sujetsAttendus('CM1-CM2', null).map(s => libelleSujet(s, 'en')).sort((a, b) => a.localeCompare(b, 'en'))
  await expect.poll(() => sujetsAffiches(page)).toEqual(attendus)
  await sansTexteFrancais(page)
  const sansTraduction = (await sujetsAffiches(page)).filter(s => SUJET_EN.has(s) && SUJET_EN.get(s) !== s)
  expect(sansTraduction).toEqual([])

  const types = page.locator('.crossword-select__section').first().getByRole('button')
  await expect(types).toHaveText(['Bilingual', 'French', 'English'])

  await page.locator('.crossword-select').getByRole('button', { name: 'English', exact: true }).click()
  await page.locator('.crossword-select__grid button', { hasText: /^Digestion/ }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.eclipse-board')).toBeVisible()
  await expect(page.locator('.crossword-game__header')).toContainText('Class 5-6 (English)')
  await expect(page.locator('.crossword-game__score')).toContainText('Score')
  await sansTexteFrancais(page)

  expect(erreurs, erreurs.join('\n')).toEqual([])
})

// Graine de la grille Géométrie (CM1-CM2, anglais) où GEOMETRY est placé ou non
function graineGeometrie(placee) {
  const entrees = vocabulaire.filter(e => e.niveau_fr === 'CM1-CM2' && e.sujet === 'Géométrie' && e.actif !== false)
  for (let graine = 1; graine < 5000; graine++) {
    const game = createCrosswordGame(entrees, 'Anglais', graine)
    if (game && game.placements.some(p => matchesDomain(p.word, 'Geometry')) === placee) return graine
  }
  return null
}

for (const { placee, titre } of [
  { placee: true, titre: /Crossword$/ },
  { placee: false, titre: /Crossword — GEOMETRY$/ }
]) {
  test(`Titre en anglais : ${placee ? 'domaine retiré si le mot GEOMETRY est dans la grille' : 'domaine traduit sinon'}`, async ({ page }) => {
    const graine = graineGeometrie(placee)
    test.skip(graine === null, 'aucune graine dans ce cas')
    await connecterEleve(page, { niveau: 'CM1-CM2' })
    await page.getByRole('button', { name: 'English' }).click()
    await page.locator('.student-dashboard__matieres').getByRole('button', { name: 'Mathematics', exact: true }).click()
    await page.locator('.crossword-select').getByRole('button', { name: 'English', exact: true }).click()
    await page.locator('.crossword-select__grid button', { hasText: /^Geometry/ }).click()
    await page.getByLabel('Grid number (optional)').fill(String(graine))
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.locator('.eclipse-board')).toBeVisible()
    await expect(page.locator('.eclipse-header h2')).toHaveText(titre)
    await sansTexteFrancais(page)
  })
}

// Écrit les mots de la grille d'après ses indices, jusqu'à pouvoir terminer
async function remplirGrille(page, { niveau, sujet }) {
  const entrees = vocabulaire.filter(e => e.niveau_fr === niveau && e.sujet === sujet && e.actif !== false)
  const { rows, indices } = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.eclipse-board .eclipse-row')].map(r =>
      [...r.querySelectorAll('.eclipse-cell')].map(c => c.querySelector('.eclipse-number')?.textContent.trim() || null)),
    indices: [...document.querySelectorAll('.eclipse-clues .clues-col')].flatMap((col, i) =>
      [...col.querySelectorAll('.clue')].map(c => ({
        num: c.querySelector('.clue-num').textContent.trim(),
        sens: i === 0 ? [0, 1] : [1, 0],
        def: c.querySelector('.clue-text').textContent.trim().replace(/\s\(\d+\)$/, '')
      })))
  }))
  const lignes = page.locator('.eclipse-board .eclipse-row')
  for (const { num, sens, def } of indices) {
    const entree = entrees.find(e => e.def_en === def)
    expect(entree, `définition inconnue : ${def}`).toBeTruthy()
    const mot = normalizeWord(entree.mot_en.split('/')[0])
    const r0 = rows.findIndex(l => l.includes(num))
    const c0 = rows[r0].indexOf(num)
    for (let i = 0; i < mot.length; i++) {
      await lignes.nth(r0 + sens[0] * i).locator('.eclipse-cell').nth(c0 + sens[1] * i).locator('input').click()
      await page.keyboard.press(mot[i].toLowerCase())
    }
  }
}

test('Partie terminée en anglais sur Symétrie : valeurs internes enregistrées, affichage anglais', async ({ page }) => {
  test.setTimeout(120_000)
  await connecterEleve(page, { niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: /Crossword$/ }).click()
  await page.locator('.crossword-select').getByRole('button', { name: 'English', exact: true }).click()
  await page.locator('.crossword-select__grid button', { hasText: /^Symmetry/ }).click()
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.locator('.eclipse-board')).toBeVisible()
  await remplirGrille(page, { niveau: 'CM1-CM2', sujet: 'Symétrie' })

  await page.getByRole('button', { name: 'Finish' }).click()
  await expect(page.locator('.crossword-finished')).toContainText('Symmetry')
  await sansTexteFrancais(page)

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores).toHaveLength(1)
  expect(scores[0]).toMatchObject({ gameType: 'crossword', subject: 'Symétrie', puzzleType: 'Anglais', niveau: 'CM1-CM2' })
  expect(scores[0].score).toBeGreaterThan(0)
})

test('Niveaux en anglais : Class partout, valeurs internes inchangées', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /English/ }).click()
  await expect(page.getByLabel('Level').locator('option')).toHaveText(['Class 1-2', 'Class 3-4', 'Class 5-6'])
  await page.getByLabel('Nickname').fill('Classe')
  await page.getByLabel('Level').selectOption('CE1-CE2')
  await page.getByRole('button', { name: 'Create and play' }).click()
  await expect(page.locator('.student-dashboard__level')).toHaveText('Class 3-4')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProfiles'))[0].level)).toBe('CE1-CE2')

  // Mots croisés
  await page.getByRole('button', { name: /Crossword$/ }).click()
  await expect(page.locator('.crossword-select').getByRole('button', { name: 'Class 3-4', exact: true })).toHaveClass(/active/)
  await sansTexteFrancais(page)
  await page.locator('.crossword-select__back').click()

  // Mots mêlés : choix, partie
  await page.getByRole('button', { name: /Word Search/ }).click()
  await expect(page.getByRole('button', { name: /Class 3-4/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.wordsearch-select')).not.toContainText('CE1-CE2')
  await page.locator('.wordsearch-select__start').click()
  await expect(page.locator('.wordsearch-game__header')).toContainText('Word Search - Class 3-4')

  // Liste des profils
  await page.locator('.wordsearch-game__btn--secondary').click()
  await page.locator('.wordsearch-select__back').click()
  await page.locator('.student-dashboard__back').click()
  await expect(page.locator('.profiles__card')).toContainText('Class 3-4')
})

// Revue : pendant le calcul de la liste, un message d'indisponibilité faux
// apparaissait brièvement. Processeur ralenti par CDP (Chromium seulement).
test('Changement de matière ou de niveau : aucun message faux, même processeur ralenti', async ({ page, context }) => {
  test.setTimeout(120_000)
  await connecterEleve(page, { niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  await expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 })
  await page.evaluate(() => {
    window.messagesVus = []
    const lire = () => {
      for (const e of document.querySelectorAll('.crossword-select__empty, .crossword-select__container > .crossword-select__hint')) {
        window.messagesVus.push(e.textContent)
      }
    }
    new MutationObserver(lire).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true })
  })
  const prets = () => expect(page.getByRole('button', { name: 'Commencer' })).toBeEnabled({ timeout: 30_000 })

  for (const nom of ['Sciences et santé', 'Mathématiques', 'Informatique et TIC', 'Autres', 'Toutes', 'Mathématiques']) {
    await choisirMatiere(page, nom)
    await prets()
  }
  for (const niveau of ['CE1-CE2', 'CM1-CM2', 'CE1-CE2']) {
    await choisirNiveau(page, niveau)
    await prets()
  }
  expect(await page.evaluate(() => window.messagesVus)).toEqual([])

  // Témoin : le message vrai, lui, est bien observé
  await choisirNiveau(page, 'SIL-CP')
  await expect(page.locator('.crossword-select__empty')).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => page.evaluate(() => window.messagesVus.length)).toBeGreaterThan(0)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
})
