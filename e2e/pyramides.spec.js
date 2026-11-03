// Pyramides (phase 3 du plan de migration, §5.1) : parties complètes additive
// et multiplicative, case fausse et aide, « Voir la réponse » après 3 essais,
// pavé numérique au toucher et au clavier (Entrée sur un autre bouton laissée
// à ce bouton), reproductibilité par numéro, réglage selon la classe et le
// sous-système du profil, grands nombres groupés par milliers à 320 px, score
// enregistré.
// La partie attendue est calculée par le module pur (src/utils/pyramidGame.js) :
// l'écran doit montrer la même.
import { test, expect } from '@playwright/test'
import { suivreErreurs, totalAffiche } from './outils.js'
import { createPyramidGame, cellHint } from '../src/utils/pyramidGame.js'

// Crée un profil avec sous-système et classe (facultative), puis ouvre le tableau de bord
async function creerProfilComplet(page, { pseudo, niveau, sousSysteme = 'fr', classe = '' }) {
  await page.goto('/')
  await page.getByLabel('Pseudonyme').fill(pseudo)
  await page.getByLabel('Niveau').selectOption(niveau)
  await page.getByLabel('Sous-système').selectOption(sousSysteme)
  await page.getByLabel('Classe (facultatif)').selectOption(classe)
  await page.getByRole('button', { name: 'Créer et jouer' }).click()
  await expect(page.getByRole('button', { name: /Pyramides/ })).toBeVisible()
}

// Du tableau de bord jusqu'à la première pyramide
async function lancer(page, { numero, operation = 'add', langue = 'fr' }) {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Pyramides/ : /Pyramids/ }).click()
  if (operation === 'mul') await page.locator('.pyramid-select__btn', { hasText: 'Multiplication' }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.pyramid-select__start').click()
  await expect(page.locator('.pyramid-game')).toBeVisible()
}

const caseCachee = (page, i) => page.locator(`button.pyramid-cell[data-cell="${i}"]`)

// Nombre affiché, sans les séparateurs de milliers (espaces fines, virgules)
const sansSeparateurs = (texte) => texte.replace(/[\s,]/g, '')

// Attend qu'une case affiche ce nombre (séparateurs de milliers retirés)
async function attendreNombre(locator, nombre) {
  await expect.poll(async () => sansSeparateurs(await locator.textContent())).toBe(String(nombre))
}

// Lignes de progrès des pyramides
const lignesPyramide = async (page) =>
  (await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress') || '[]'))).filter(l => l.gameType === 'pyramid')

// Écrit un nombre au pavé (au toucher) et valide
async function repondreAuPave(page, nombre, langue = 'fr') {
  for (const chiffre of String(nombre)) {
    await page.locator('.number-pad').getByRole('button', { name: chiffre, exact: true }).click()
  }
  await page.locator('.number-pad').getByRole('button', { name: langue === 'fr' ? 'Valider' : 'Check' }).click()
}

// Contrôle la pyramide affichée : cases données (valeurs) et cases cachées (vides)
async function controlerPyramide(page, p) {
  for (const [i, v] of p.values.entries()) {
    if (p.given[i]) await attendreNombre(page.locator(`span.pyramid-cell[data-cell="${i}"]`), v)
    else await expect(caseCachee(page, i)).toBeVisible()
  }
}

// Joue les cases d'une pyramide sans erreur
async function jouerPyramide(page, p, cases = p.hidden, langue = 'fr') {
  for (const cell of cases) {
    await caseCachee(page, cell).click()
    await repondreAuPave(page, p.values[cell], langue)
    await attendreNombre(page.locator(`span.pyramid-cell--found[data-cell="${cell}"]`), p.values[cell])
  }
}

// Joue toutes les pyramides de la partie attendue, sans erreur, puis termine
async function jouerPartie(page, attendue, langue = 'fr') {
  const fr = langue === 'fr'
  for (const [k, p] of attendue.pyramids.entries()) {
    await controlerPyramide(page, p)
    await jouerPyramide(page, p, p.hidden, langue)
    const dernier = k === attendue.pyramids.length - 1
    await page.getByRole('button', { name: dernier ? (fr ? 'Terminer' : 'Finish') : (fr ? 'Pyramide suivante' : 'Next pyramid') }).click()
  }
  await expect(page.locator('.pyramid-finished')).toBeVisible()
  return attendue.pyramids.reduce((n, p) => n + p.hidden.length, 0) * 10
}

test('Partie additive complète (CE1, francophone) : score enregistré, progrès et retour au tableau de bord', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Pyramide CE1', niveau: 'CE1-CE2', classe: 'CE1' })
  const numero = 2024
  const attendue = createPyramidGame({ className: 'CE1', subsystem: 'fr', operation: 'add', seed: numero })
  await lancer(page, { numero })
  await expect(page.locator('.pyramid-game__header h1')).toHaveText('Pyramides additives - CE1')
  await expect(page.locator('.pyramid-game__seed')).toHaveText(`Partie n° ${numero} · CE1-CE2`)
  const score = await jouerPartie(page, attendue)
  expect(score).toBe(180) // 3 pyramides × 6 cases cachées × 10 points
  await expect(page.locator('.pyramid-finished__score')).toHaveText(String(score))

  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'pyramid', score, niveau: 'CE1-CE2', seed: numero, operation: 'add', className: 'CE1', subsystem: 'fr' })
  const lignes = await lignesPyramide(page)
  expect(lignes).toHaveLength(18)
  expect(lignes.every(p => p.isCorrect === true && p.wordId === null)).toBe(true)
  expect(lignes[0].itemId).toBe(`add:fr:CE1:${numero}:0:${attendue.pyramids[0].hidden[0]}`)

  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Pyramides/ })).toBeVisible()
  await totalAffiche(page, score)
  expect(erreurs).toEqual([])
})

test('Partie multiplicative complète en anglais (Class 4, anglophone)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Pyramid Class 4', niveau: 'CE1-CE2', sousSysteme: 'en', classe: 'Class 4' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 31
  const attendue = createPyramidGame({ className: 'Class 4', subsystem: 'en', operation: 'mul', seed: numero })
  await lancer(page, { numero, operation: 'mul', langue: 'en' })
  await expect(page.locator('.pyramid-game__header h1')).toHaveText('Multiplication pyramids - Class 4')
  await expect(page.locator('.pyramid-game__rule')).toHaveText('Each box = the product of the two boxes below.')
  const score = await jouerPartie(page, attendue, 'en')
  expect(score).toBe(90) // 3 pyramides × 3 cases cachées
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'pyramid', score: 90, niveau: 'CE1-CE2', operation: 'mul', className: 'Class 4', subsystem: 'en' })
  await expect(page.locator('.pyramid-finished')).toContainText('Wrong answers during the game: 0')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /Pyramids/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Case fausse : aide avec les deux cases dont elle dépend, puis nouvelle tentative', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Erreur SIL', niveau: 'SIL-CP', classe: 'SIL' })
  const numero = 5
  const p = createPyramidGame({ className: 'SIL', subsystem: 'fr', operation: 'add', seed: numero }).pyramids[0]
  await lancer(page, { numero })
  // Première case à trouver (déjà choisie) : une case de la 2e rangée, calculée depuis la base
  const cell = p.hidden[0]
  const step = p.steps[0]
  expect(step.op).toBe('+')
  await expect(caseCachee(page, cell)).toHaveAttribute('aria-pressed', 'true')
  // Valider est inactif tant que rien n'est écrit
  await expect(page.getByRole('button', { name: 'Valider' })).toBeDisabled()
  await repondreAuPave(page, p.values[cell] + 1)
  const retour = page.locator('.pyramid-game__feedback')
  await expect(retour).toHaveText(`Pas encore. Calcule : ${step.a} + ${step.b} = ?`)
  // Les deux cases dont elle dépend sont montrées
  for (const i of step.inputs) await expect(page.locator(`[data-cell="${i}"]`)).toHaveClass(/pyramid-cell--hint/)
  await expect(caseCachee(page, cell)).toHaveClass(/pyramid-cell--wrong/)
  await expect(caseCachee(page, cell)).toHaveText('')
  // Pas de « Voir la réponse » après un seul essai faux
  await expect(page.getByRole('button', { name: 'Voir la réponse' })).toHaveCount(0)
  // Une autre case choisie : l'aide colorée et le message s'effacent
  await caseCachee(page, p.hidden[1]).click()
  await expect(page.locator('.pyramid-cell--hint')).toHaveCount(0)
  await expect(retour).toHaveText('')
  // Retour à la première case, nouvelle tentative : juste
  await caseCachee(page, cell).click()
  await repondreAuPave(page, p.values[cell])
  await expect(retour).toHaveText('Bravo !')
  await expect(page.locator('.pyramid-cell--hint')).toHaveCount(0)
  await expect(page.locator('.pyramid-game__progress')).toContainText('10 points')

  // Le sommet (dernière case de la résolution en SIL), choisi avant la seconde
  // case du dessous : l'aide demande de compléter d'abord les cases vides
  expect(p.hidden.at(-1)).toBe(0)
  await caseCachee(page, 0).click()
  await repondreAuPave(page, p.values[0] + 1)
  await expect(retour).toHaveText('Pas encore. Cette case se calcule avec les deux cases en couleur : complète d\'abord celles qui sont encore vides.')
  for (const i of p.steps.at(-1).inputs) await expect(page.locator(`[data-cell="${i}"]`)).toHaveClass(/pyramid-cell--hint/)

  const lignes = await lignesPyramide(page)
  expect(lignes[0]).toMatchObject({ isCorrect: false, itemId: `add:fr:SIL:${numero}:0:${cell}` })
  expect(lignes[1]).toMatchObject({ isCorrect: true, itemId: `add:fr:SIL:${numero}:0:${cell}` })
  expect(erreurs).toEqual([])
})

test('Voir la réponse après 3 essais faux : case montrée sans points, enregistrée fausse', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await creerProfilComplet(page, { pseudo: 'Reponse SIL', niveau: 'SIL-CP', classe: 'SIL' })
  const numero = 5
  const attendue = createPyramidGame({ className: 'SIL', subsystem: 'fr', operation: 'add', seed: numero })
  const p = attendue.pyramids[0]
  await lancer(page, { numero })
  const cell = p.hidden[0]
  const voir = page.getByRole('button', { name: 'Voir la réponse' })
  for (let essai = 1; essai <= 3; essai++) {
    await expect(voir).toHaveCount(0)
    await repondreAuPave(page, p.values[cell] + essai)
  }
  await expect(page.locator('.pyramid-game__feedback')).toContainText('Tu peux essayer encore ou voir la réponse.')
  await voir.click()
  await attendreNombre(page.locator(`span.pyramid-cell--shown[data-cell="${cell}"]`), p.values[cell])
  await expect(page.locator('.pyramid-game__feedback')).toHaveText(`La réponse était ${p.values[cell]}. Cette case ne compte pas de points.`)
  await expect(page.locator('.pyramid-game__progress')).toContainText('0 points')
  await expect(voir).toHaveCount(0)

  // 3 réponses fausses + la réponse montrée : 4 lignes isCorrect: false pour cette case
  const lignes = await lignesPyramide(page)
  expect(lignes).toHaveLength(4)
  expect(lignes.every(l => l.isCorrect === false && l.itemId === `add:fr:SIL:${numero}:0:${cell}`)).toBe(true)

  // Fin de la partie sans erreur : la case montrée ne compte pas
  await jouerPyramide(page, p, p.hidden.slice(1))
  await page.getByRole('button', { name: 'Pyramide suivante' }).click()
  for (const [k, q] of attendue.pyramids.slice(1).entries()) {
    await jouerPyramide(page, q)
    await page.getByRole('button', { name: k === attendue.pyramids.length - 2 ? 'Terminer' : 'Pyramide suivante' }).click()
  }
  const total = attendue.pyramids.reduce((n, q) => n + q.hidden.length, 0)
  await expect(page.locator('.pyramid-finished__score')).toHaveText(String((total - 1) * 10))
  await expect(page.locator('.pyramid-finished')).toContainText('Réponses fausses pendant la partie : 3')
  await expect(page.locator('.pyramid-finished')).toContainText('Réponses montrées (sans points) : 1')
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({ gameType: 'pyramid', score: (total - 1) * 10 })
  expect(erreurs).toEqual([])
})

test('Pavé au clavier physique : chiffres, effacement et Entrée', async ({ page }) => {
  await creerProfilComplet(page, { pseudo: 'Clavier', niveau: 'CE1-CE2', classe: 'CE2' })
  const numero = 77
  const p = createPyramidGame({ className: 'CE2', subsystem: 'fr', operation: 'add', seed: numero }).pyramids[0]
  await lancer(page, { numero })
  const cell = p.hidden[0]
  const valeur = String(p.values[cell])
  // Un chiffre de trop, effacé avec Retour arrière
  await page.keyboard.type(`${valeur}9`)
  await attendreNombre(caseCachee(page, cell), `${valeur}9`)
  await page.keyboard.press('Backspace')
  await attendreNombre(caseCachee(page, cell), valeur)
  await page.keyboard.press('Enter')
  await attendreNombre(page.locator(`span.pyramid-cell--found[data-cell="${cell}"]`), valeur)
  await expect(page.locator('.pyramid-game__feedback')).toHaveText('Bravo !')
  // La case suivante est choisie toute seule
  await expect(caseCachee(page, p.hidden[1])).toHaveAttribute('aria-pressed', 'true')
  // Touches du pavé : au moins 44 px
  for (const box of await page.locator('.number-pad__key').evaluateAll(keys => keys.map(k => k.getBoundingClientRect()))) {
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  // Aucun champ de saisie pendant la partie (pas de clavier système)
  await expect(page.locator('.pyramid-game input')).toHaveCount(0)
})

test('Entrée sur le bouton Retour : retour effectif, aucune réponse enregistrée', async ({ page }) => {
  await creerProfilComplet(page, { pseudo: 'Entree Retour', niveau: 'CE1-CE2', classe: 'CE1' })
  await lancer(page, { numero: 12 })
  // Un nombre est écrit : une validation par erreur enregistrerait une ligne
  await page.keyboard.type('7')
  await page.locator('.pyramid-game__back').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.pyramid-select')).toBeVisible()
  expect(await lignesPyramide(page)).toHaveLength(0)

  // Entrée sur une case de la pyramide : la case est choisie, rien n'est validé
  await page.locator('.pyramid-select__start').click()
  await expect(page.locator('.pyramid-game')).toBeVisible()
  const p = createPyramidGame({ className: 'CE1', subsystem: 'fr', operation: 'add', seed: 12 }).pyramids[0]
  await page.keyboard.type('7')
  await caseCachee(page, p.hidden[1]).focus()
  await page.keyboard.press('Enter')
  await expect(caseCachee(page, p.hidden[1])).toHaveAttribute('aria-pressed', 'true')
  expect(await lignesPyramide(page)).toHaveLength(0)
})

test('Clic sur une case, chiffres, Entrée : la réponse est validée', async ({ page }) => {
  await creerProfilComplet(page, { pseudo: 'Entree Case', niveau: 'CE1-CE2', classe: 'CE1' })
  await lancer(page, { numero: 12 })
  const p = createPyramidGame({ className: 'CE1', subsystem: 'fr', operation: 'add', seed: 12 }).pyramids[0]
  const cell = p.hidden[0]
  await caseCachee(page, cell).click()
  await expect(caseCachee(page, cell)).toHaveAttribute('aria-pressed', 'true')
  // Le focus reste sur la case choisie : Entrée doit valider, pas la re-cliquer
  await page.keyboard.type(String(p.values[cell]))
  await page.keyboard.press('Enter')
  await expect.poll(async () => (await lignesPyramide(page)).length).toBe(1)
  expect((await lignesPyramide(page))[0].isCorrect).toBe(true)
})

test('Même numéro, même partie ; numéro invalide refusé', async ({ page }) => {
  await creerProfilComplet(page, { pseudo: 'Numero pyramide', niveau: 'CM1-CM2', classe: 'CM1' })
  await page.getByRole('button', { name: /Pyramides/ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill('12a')
  await page.locator('.pyramid-select__start').click()
  await expect(page.locator('#pyramid-seed-hint')).toContainText('Numéro invalide')
  await page.getByRole('button', { name: 'Retour' }).click()

  const lire = () => page.locator('.pyramid-cell').evaluateAll(cells => cells.map(c => c.textContent.replace(/[\s,]/g, '')))
  await lancer(page, { numero: 31415 })
  const premiere = await lire()
  await page.locator('.pyramid-game__back').click()
  await page.locator('.pyramid-select__start').click()
  expect(await lire()).toEqual(premiere)
  const p = createPyramidGame({ className: 'CM1', subsystem: 'fr', operation: 'add', seed: 31415 }).pyramids[0]
  expect(premiere).toEqual(p.values.map((v, i) => (p.given[i] ? String(v) : '')))
})

test('Réglage selon la classe et le sous-système du profil ; classe par défaut ; pas de multiplication en SIL-CP', async ({ page }) => {
  // Anglophone, Class 3 : sommet jusqu'à 500 en addition, 100 en multiplication
  await creerProfilComplet(page, { pseudo: 'Reglage EN', niveau: 'CE1-CE2', sousSysteme: 'en', classe: 'Class 3' })
  await page.getByRole('button', { name: /Pyramides/ }).click()
  await expect(page.getByTestId('pyramid-class')).toHaveText('CE1-CE2 · Réglé pour : Class 3 (sous-système anglophone).')
  await expect(page.locator('.pyramid-select__btn', { hasText: 'Addition' })).toContainText('4 étages, sommet jusqu\'à 500')
  await expect(page.locator('.pyramid-select__btn', { hasText: 'Multiplication' })).toContainText('3 étages, sommet jusqu\'à 100')
  await page.getByRole('button', { name: 'Retour' }).click()

  // Francophone sans classe : la première de la tranche (CM1), signalée
  await page.getByRole('button', { name: 'Profil' }).click()
  await creerProfilComplet(page, { pseudo: 'Sans classe', niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: /Pyramides/ }).click()
  await expect(page.getByTestId('pyramid-class')).toHaveText('CM1-CM2 · Réglé pour : CM1 (sous-système francophone), classe par défaut : le profil n\'a pas de classe.')
  await expect(page.locator('.pyramid-select__btn', { hasText: 'Addition' })).toContainText('sommet jusqu\'à 1 000 000')
  const attendue = createPyramidGame({ className: 'CM1', subsystem: 'fr', operation: 'add', seed: 9 })
  await page.getByLabel('Numéro de partie (facultatif)').fill('9')
  await page.locator('.pyramid-select__start').click()
  await controlerPyramide(page, attendue.pyramids[0])
  await page.locator('.pyramid-game__back').click()
  await page.getByRole('button', { name: 'Retour' }).click()

  // SIL-CP : multiplication non proposée
  await page.getByRole('button', { name: 'Profil' }).click()
  await creerProfilComplet(page, { pseudo: 'Petit CP', niveau: 'SIL-CP', classe: 'CP' })
  await page.getByRole('button', { name: /Pyramides/ }).click()
  await expect(page.locator('.pyramid-select__btn', { hasText: 'Multiplication' })).toBeDisabled()
  await expect(page.locator('.pyramid-select__btn', { hasText: 'Multiplication' })).toContainText('pas dans cette classe')
  await expect(page.locator('.pyramid-select__btn', { hasText: 'Addition' })).toContainText('3 étages, sommet jusqu\'à 100')
})

test('Classe du profil qui ne correspond pas à son niveau (ancienne donnée) : classe par défaut, raison exacte', async ({ page }) => {
  await creerProfilComplet(page, { pseudo: 'Classe ancienne', niveau: 'SIL-CP', classe: 'CP' })
  // Donnée enregistrée avant une correction : classe CE2 dans un profil SIL-CP
  await page.evaluate(() => {
    const session = JSON.parse(localStorage.getItem('dibieSession'))
    session.state.user.class = 'CE2'
    localStorage.setItem('dibieSession', JSON.stringify(session))
    const profils = JSON.parse(localStorage.getItem('dibieProfiles'))
    profils.find(p => p.id === session.state.user.id).class = 'CE2'
    localStorage.setItem('dibieProfiles', JSON.stringify(profils))
  })
  await page.reload()
  await page.getByRole('button', { name: /Pyramides/ }).click()
  await expect(page.getByTestId('pyramid-class')).toHaveText(
    'SIL-CP · Réglé pour : SIL (sous-système francophone), classe par défaut : la classe du profil (CE2) ne correspond pas à son niveau ou à son sous-système.')
})

test('À 320 px, grands nombres du CM2 groupés par milliers, coupés seulement entre deux groupes', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await creerProfilComplet(page, { pseudo: 'Petit ecran', niveau: 'CM1-CM2', classe: 'CM2' })
  const numero = 8
  const p = createPyramidGame({ className: 'CM2', subsystem: 'fr', operation: 'add', seed: numero }).pyramids[0]
  await lancer(page, { numero })
  const deborde = () => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(await deborde()).toBe(false)
  await controlerPyramide(page, p)

  // Chaque case reste dans la carte ; chaque groupe de chiffres tient sur une
  // ligne et reste dans sa case ; les groupes ont 3 chiffres (sauf le premier)
  const controle = () => page.evaluate(() => {
    const carte = document.querySelector('.pyramid-game__card').getBoundingClientRect()
    const anomalies = []
    for (const c of document.querySelectorAll('.pyramid-cell')) {
      const r = c.getBoundingClientRect()
      if (r.left < carte.left - 0.5 || r.right > carte.right + 0.5) anomalies.push(`case ${c.dataset.cell} hors de la carte`)
      const groupes = [...c.querySelectorAll('.pyramid-num__group')]
      groupes.forEach((g, i) => {
        const gr = g.getBoundingClientRect()
        if (g.getClientRects().length !== 1) anomalies.push(`case ${c.dataset.cell} : groupe ${g.textContent} coupé`)
        if (gr.left < r.left - 0.5 || gr.right > r.right + 0.5) anomalies.push(`case ${c.dataset.cell} : groupe ${g.textContent} déborde`)
        if (!/^\d{1,3}$/.test(g.textContent) || (i > 0 && g.textContent.length !== 3)) anomalies.push(`case ${c.dataset.cell} : groupe ${g.textContent}`)
      })
    }
    return anomalies
  })
  expect(await controle()).toEqual([])

  // Réponse à 9 chiffres écrite au pavé : groupée pendant la saisie, puis case trouvée
  const cell = p.hidden[0]
  expect(String(p.values[cell])).toHaveLength(9)
  for (const chiffre of String(p.values[cell])) {
    await page.locator('.number-pad').getByRole('button', { name: chiffre, exact: true }).click()
  }
  await expect(caseCachee(page, cell).locator('.pyramid-num__group')).toHaveCount(3)
  await page.locator('.number-pad').getByRole('button', { name: 'Valider' }).click()
  await attendreNombre(page.locator(`span.pyramid-cell--found[data-cell="${cell}"]`), p.values[cell])
  expect(await controle()).toEqual([])
  expect(await deborde()).toBe(false)

  // Aide groupée par milliers (espace insécable fine) : « 380 359 238 − 188 918 578 = ? »
  const suivante = p.hidden[1]
  await caseCachee(page, suivante).click()
  await repondreAuPave(page, 1)
  const fr = (n) => n.toLocaleString('fr-FR')
  const visibles = p.values.map((_, i) => p.given[i] || i === cell)
  const aide = cellHint(p, suivante, visibles, { floors: 4, operation: 'add' })
  expect(aide.known).toBe(true)
  await expect(page.locator('.pyramid-game__feedback')).toHaveText(`Pas encore. Calcule : ${fr(aide.a)} ${aide.op} ${fr(aide.b)} = ?`)
  expect(await page.locator('.pyramid-game__feedback').textContent()).toMatch(/\d \d{3}/)
  await expect(page.locator('.number-pad')).toBeVisible()
  expect(await deborde()).toBe(false)
})
