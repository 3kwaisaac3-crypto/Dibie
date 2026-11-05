// Anagrammes mystères (lots 1, 2 et 3, docs/anagrammes-mysteres.md) : accueil des
// deux familles, jeu classique toujours accessible, mot mystère complet en
// français et en anglais, mystère des thèmes complet, message codé complet
// (lot 2), casse-tête des syllabes et phrase secrète (lot 3, parcours
// préconçus), mauvaise réponse finale, indices, étoiles, reprise après
// rechargement, score et progrès enregistrés, retour au tableau de bord,
// affichage à 320 px.
// Le parcours attendu est calculé par les générateurs purs avec le vocabulaire
// lu sur le disque : l'écran doit montrer le même.
import { test, expect } from '@playwright/test'
import { connecterEleve, suivreErreurs, totalAffiche, vocabulaire } from './outils.js'
import { generateMysteryWordPath, generateThemePath, generateCodedMessagePath, availableThemes } from '../src/utils/mysteryGenerators.js'
import { generatePresetPath } from '../src/utils/mysteryPresets.js'
import { codeKey, LETTER_GAMES } from '../src/utils/mysteryEngine.js'
import { normalizeWord } from '../src/utils/wordSearchGenerator.js'

const motMystere = (niveau, numero, langue = 'fr') => generateMysteryWordPath(vocabulaire, niveau, numero, langue)
const themes = (niveau, langue = 'fr') => availableThemes(vocabulaire, niveau, langue)
const messageCode = (niveau, numero, langue = 'fr') => generateCodedMessagePath(vocabulaire, niveau, numero, langue)

// Premier numéro (à partir de 1) dont le message codé vérifie la condition
function chercherNumeroCode(niveau, langue, condition) {
  for (let numero = 1; numero < 2000; numero++) {
    const p = messageCode(niveau, numero, langue)
    if (p && condition(p)) return numero
  }
  return null
}

// Élément gagné tel qu'affiché : une lettre, un mot, ou une ligne de clé (jeu 5)
const elementAffiche = (parcours, etape) =>
  parcours.game === 'codedMessage' ? `${etape.code} = ${etape.secret}` : etape.secret

// Premier numéro (à partir de 1) dont le parcours vérifie la condition
function chercherNumero(niveau, langue, condition) {
  for (let numero = 1; numero < 2000; numero++) {
    const p = motMystere(niveau, numero, langue)
    if (p && condition(p)) return numero
  }
  return null
}

const deborde = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)

// Du tableau de bord à l'écran de choix des mystères
async function ouvrirMysteres(page, langue = 'fr') {
  const fr = langue === 'fr'
  await page.getByRole('button', { name: fr ? /Anagrammes/ : /Anagrams/ }).first().click()
  await page.getByRole('button', { name: fr ? /Anagrammes mystères/ : /Mystery anagrams/ }).click()
  await expect(page.locator('.mystery-games')).toBeVisible()
}

// Choisit le jeu (et la série de thème), saisit le numéro, commence, passe la mission
async function lancer(page, { jeu = 1, numero, langue = 'fr', serie = null }) {
  const fr = langue === 'fr'
  await page.locator('.mystery-games__btn', { hasText: new RegExp(`^${jeu}\\.`) }).click()
  if (serie !== null) await page.getByRole('button', { name: fr ? `Série ${serie}` : `Set ${serie}`, exact: true }).click()
  await page.getByLabel(fr ? 'Numéro de partie (facultatif)' : 'Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toBeVisible()
  await page.getByRole('button', { name: fr ? 'C\'est parti !' : 'Let\'s go!' }).click()
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

// Résout les étapes à partir de `debut`, en contrôlant définition, tuiles,
// case de la lettre secrète et élément gagné
async function jouerEtapes(page, parcours, { langue = 'fr', debut = 0 } = {}) {
  const fr = langue === 'fr'
  // Jeux 1 et 5 : chaque étape donne une lettre (case marquée)
  const motJeu = LETTER_GAMES.includes(parcours.game)
  for (let i = debut; i < parcours.steps.length; i++) {
    const etape = parcours.steps[i]
    await expect(page.locator('.anagram-game__clue')).toHaveText(etape.definition)
    expect(await page.locator('.anagram-tile').allTextContents()).toEqual(etape.tiles)
    if (motJeu) {
      // Une seule case marquée : celle de la lettre secrète
      await expect(page.locator('.anagram-slot--marked')).toHaveCount(1)
      const decalage = etape.firstLetter ? 1 : 0
      await expect(page.locator('button.anagram-slot').nth(etape.secretIndex - decalage)).toHaveClass(/anagram-slot--marked/)
    }
    await ecrire(page, etape.word, etape.firstLetter !== null)
    await valider(page, langue)
    await expect(page.locator('.mystery-won strong')).toHaveText(elementAffiche(parcours, etape))
    await expect(page.locator('.mystery-elements__item').nth(i)).toHaveText(elementAffiche(parcours, etape))
    const derniere = i === parcours.steps.length - 1
    await page.getByRole('button', { name: derniere ? (fr ? 'Vers le mystère' : 'To the mystery') : (fr ? 'Anagramme suivante' : 'Next anagram') }).click()
  }
}

// Contrôles communs de la victoire et des enregistrements
async function controlerVictoire(page, parcours, { score, etoiles, aides, langue = 'fr', solution = parcours.final.display }) {
  const fr = langue === 'fr'
  await expect(page.locator('.anagram-finished')).toBeVisible()
  await expect(page.locator('.mystery-victory__solution strong')).toHaveText(solution)
  await expect(page.getByRole('img', { name: fr ? `${etoiles} étoile${etoiles > 1 ? 's' : ''} sur 3` : `${etoiles} star${etoiles > 1 ? 's' : ''} out of 3` })).toBeVisible()
  await expect(page.locator('.anagram-finished__score')).toHaveText(String(score))
  await expect(page.locator('.mystery-skills li')).toHaveCount(3)
  const scores = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieScores')))
  expect(scores.at(-1)).toMatchObject({
    gameType: 'anagramMystery', score, niveau: parcours.level,
    game: parcours.game, language: parcours.language, seed: parcours.seed, stars: etoiles, hintsUsed: aides
  })
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  const lignes = progres.filter(p => p.gameType === 'anagramMystery')
  expect(lignes).toHaveLength(parcours.steps.length + 1)
  expect(lignes.at(-1)).toMatchObject({ wordId: null, itemId: 'final' })
  // Partie terminée : la reprise est effacée
  const reprise = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieMysteryInProgress') || '[]'))
  expect(reprise).toEqual([])
}

test('Accueil du module : deux familles, jeu classique inchangé, six jeux mystères dont 5 disponibles, niveau du profil par défaut', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Accueil', niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: /Anagrammes/ }).click()
  await expect(page.getByRole('button', { name: /Anagrammes classiques/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Anagrammes mystères/ })).toBeVisible()
  // Retour de l'accueil : tableau de bord
  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Mots Croisés/ })).toBeVisible()

  // Famille A : le même écran de choix qu'avant
  await page.getByRole('button', { name: /Anagrammes/ }).click()
  await page.getByRole('button', { name: /Anagrammes classiques/ }).click()
  await expect(page.getByRole('heading', { name: 'Anagrammes' })).toBeVisible()
  await expect(page.getByLabel('Numéro de partie (facultatif)')).toBeVisible()
  await expect(page.locator('.anagram-select__btn')).toHaveCount(3)
  await page.getByRole('button', { name: 'Retour' }).click()

  // Famille B
  await page.getByRole('button', { name: /Anagrammes mystères/ }).click()
  const jeux = page.locator('.mystery-games__btn')
  await expect(jeux).toHaveCount(6)
  await expect(page.locator('.mystery-games__btn:not(:disabled)')).toHaveCount(5)
  for (const n of [6]) {
    const bouton = page.locator('.mystery-games__btn', { hasText: new RegExp(`^${n}\\.`) })
    await expect(bouton).toBeDisabled()
    await expect(bouton).toContainText('Bientôt')
  }
  await expect(page.getByRole('button', { name: 'CM1-CM2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.mystery-demo')).toContainText('Démonstration')
  // Jeu 4 : séries de thèmes de la liste fixe, sans dévoiler le thème
  await page.locator('.mystery-games__btn', { hasText: /^4\./ }).click()
  await expect(page.getByRole('button', { name: /^Série \d$/ })).toHaveCount(themes('CM1-CM2').length)
  // Retour : accueil du module
  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Anagrammes classiques/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Mot mystère complet en français : étapes, case marquée, lettres gagnées, finale, 3 étoiles, score, retour au tableau de bord', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Mystere FR', niveau: 'CE1-CE2' })
  const numero = 12345
  const parcours = motMystere('CE1-CE2', numero)
  await ouvrirMysteres(page)
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toContainText(`Résous ${parcours.steps.length} anagrammes`)
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · français · Démonstration`)
  await page.getByRole('button', { name: 'C\'est parti !' }).click()
  await expect(page.locator('.mystery-elements__item')).toHaveCount(parcours.steps.length)
  await expect(page.locator('.mystery-elements__item--hidden')).toHaveCount(parcours.steps.length)
  await jouerEtapes(page, parcours)

  // Finale : les tuiles sont les lettres gagnées, dans l'ordre des étapes
  expect(await page.locator('.anagram-tile').allTextContents()).toEqual(parcours.steps.map(s => s.secret))
  await ecrire(page, parcours.final.solution, false)
  await valider(page)
  await expect(page.locator('.anagram-game__answer strong')).toHaveText(parcours.final.display)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  const score = (parcours.steps.length + 1) * 10
  await controlerVictoire(page, parcours, { score, etoiles: 3, aides: 0 })
  await expect(page.locator('.anagram-finished h1')).toHaveText('Mystère résolu !')

  await page.getByRole('button', { name: 'Retour' }).click()
  await expect(page.getByRole('button', { name: /Mots Croisés/ })).toBeVisible()
  await totalAffiche(page, score)
  expect(erreurs).toEqual([])
})

test('Mot mystère complet en anglais (SIL-CP, première lettre placée, jamais la règle « first »)', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Mystery EN', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 777
  const parcours = motMystere('SIL-CP', numero, 'en')
  expect(parcours.extraction.rule).not.toBe('first')
  await ouvrirMysteres(page, 'en')
  await lancer(page, { numero, langue: 'en' })
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Game no. ${numero} · English · Demonstration`)
  await expect(page.locator('.anagram-slot--given')).toHaveText(parcours.steps[0].firstLetter)
  await jouerEtapes(page, parcours, { langue: 'en' })
  await ecrire(page, parcours.final.solution, false)
  await valider(page, 'en')
  await page.getByRole('button', { name: 'See my result' }).click()
  await controlerVictoire(page, parcours, { score: (parcours.steps.length + 1) * 10, etoiles: 3, aides: 0, langue: 'en' })
  await expect(page.locator('.anagram-finished h1')).toHaveText('Mystery solved!')
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: /Anagrams/ })).toBeVisible()
  expect(erreurs).toEqual([])
})

test('Mystère des thèmes complet : mots gagnés, choix parmi 4 propositions, 3 étoiles, score', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Themes', niveau: 'CE1-CE2' })
  const liste = themes('CE1-CE2')
  const serie = liste.findIndex(th => th.id === 'musique') + 1
  expect(serie).toBeGreaterThan(0)
  const numero = 4242
  const parcours = generateThemePath(vocabulaire, 'CE1-CE2', numero, 'fr', 'musique')
  await ouvrirMysteres(page)
  await lancer(page, { jeu: 4, numero, serie })
  await jouerEtapes(page, parcours)
  await expect(page.locator('.mystery-options__btn')).toHaveText(parcours.final.options)
  await page.getByRole('button', { name: parcours.final.solution, exact: true }).click()
  await expect(page.locator('.anagram-game__answer strong')).toHaveText(parcours.final.solution)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await controlerVictoire(page, parcours, { score: 60, etoiles: 3, aides: 0 })
  await page.getByRole('button', { name: 'Retour' }).click()
  await totalAffiche(page, 60)
  expect(erreurs).toEqual([])
})

test('Mauvaise réponse finale et indice du mot mystère : retour sur les lettres, définition en indice, 2 étoiles', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Indices', niveau: 'CE1-CE2' })
  const numero = 31
  const parcours = motMystere('CE1-CE2', numero)
  await ouvrirMysteres(page)
  await lancer(page, { numero })
  await jouerEtapes(page, parcours)
  // Essai faux : les lettres gagnées dans l'ordre (jamais une bonne réponse)
  await ecrire(page, parcours.steps.map(s => s.secret).join(''), false)
  await valider(page)
  await expect(page.locator('.anagram-game__feedback')).toContainText('bien placée')
  await page.getByRole('button', { name: 'Effacer' }).click()
  await page.getByRole('button', { name: 'Indice', exact: true }).click()
  await expect(page.locator('.mystery-final__hint')).toContainText(parcours.final.hints[0])
  await ecrire(page, parcours.final.solution, false)
  await valider(page)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await controlerVictoire(page, parcours, { score: (parcours.steps.length + 1) * 10, etoiles: 2, aides: 1 })
  expect(erreurs).toEqual([])
})

test('Thème : proposition fausse éliminée, indice progressif, solution d\'étape montrée = 1 étoile', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Etoiles', niveau: 'SIL-CP' })
  const liste = themes('SIL-CP')
  const numero = 8
  const parcours = generateThemePath(vocabulaire, 'SIL-CP', numero, 'fr', liste[0].id)
  await ouvrirMysteres(page)
  await lancer(page, { jeu: 4, numero, serie: 1 })

  // Étape 1 : 3 essais faux (indice au 2e), solution montrée, l'élément est quand même gagné
  const etape = parcours.steps[0]
  const faux = etape.tiles.join('')
  for (let essai = 1; essai <= 3; essai++) {
    const effacer = page.getByRole('button', { name: 'Effacer' })
    if (await effacer.isEnabled()) await effacer.click()
    await ecrire(page, etape.firstLetter + faux, true)
    await valider(page)
    if (essai === 2) await expect(page.locator('.anagram-game__feedback')).toContainText('Indice : le mot commence par')
  }
  await page.getByRole('button', { name: 'Voir la solution' }).click()
  await expect(page.locator('.mystery-won strong')).toHaveText(etape.secret)
  await page.getByRole('button', { name: 'Anagramme suivante' }).click()
  await jouerEtapes(page, parcours, { debut: 1 })

  // Finale : une proposition fausse est rayée, puis un indice en élimine une autre
  const fausse = parcours.final.options.find(o => o !== parcours.final.solution && !parcours.final.hints.includes(o))
  await page.getByRole('button', { name: fausse, exact: true }).click()
  await expect(page.locator('.anagram-game__feedback')).toContainText(`Ce n'est pas « ${fausse} »`)
  await expect(page.getByRole('button', { name: fausse, exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Indice', exact: true }).click()
  await expect(page.getByRole('button', { name: parcours.final.hints[0], exact: true })).toBeDisabled()
  await page.getByRole('button', { name: parcours.final.solution, exact: true }).click()
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  // 4 anagrammes trouvées + le mystère : 50 points ; solution montrée : 1 étoile
  await controlerVictoire(page, parcours, { score: 50, etoiles: 1, aides: 2 })
  await expect(page.locator('.mystery-encouragement')).toContainText('jusqu\'au bout')
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  expect(progres.filter(p => p.gameType === 'anagramMystery')[0]).toMatchObject({ wordId: etape.id, isCorrect: false, itemId: etape.id })
  expect(erreurs).toEqual([])
})

test('Reprise après rechargement : même parcours, lettres gagnées, essais et points conservés ; effacée à la fin', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Reprise', niveau: 'CM1-CM2' })
  const numero = 2026
  const parcours = motMystere('CM1-CM2', numero)
  await ouvrirMysteres(page)
  await lancer(page, { numero })
  // Deux étapes résolues, puis un essai faux sur la troisième
  for (let i = 0; i < 2; i++) {
    await ecrire(page, parcours.steps[i].word, false)
    await valider(page)
    await page.getByRole('button', { name: 'Anagramme suivante' }).click()
  }
  await ecrire(page, parcours.steps[2].tiles.join(''), false)
  await valider(page)
  const enregistre = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieMysteryInProgress')))
  expect(enregistre).toHaveLength(1)
  expect(enregistre[0]).toMatchObject({ formatVersion: 1, path: { id: parcours.id, seed: numero }, state: { phase: 'steps', current: 2 } })

  await page.reload()
  await expect(page.getByText('Tu as un mystère en cours')).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre' }).click()
  await expect(page.locator('.anagram-game__clue')).toHaveText(parcours.steps[2].definition)
  await expect(page.locator('.anagram-game__progress')).toContainText('20 points')
  await expect(page.locator('.mystery-elements__item').nth(0)).toHaveText(parcours.steps[0].secret)
  await expect(page.locator('.mystery-elements__item').nth(1)).toHaveText(parcours.steps[1].secret)
  // L'essai faux est conservé : le 2e essai faux donne l'indice
  await ecrire(page, parcours.steps[2].tiles.join(''), false)
  await valider(page)
  await expect(page.locator('.anagram-game__feedback')).toContainText('Indice : le mot commence par')
  await page.getByRole('button', { name: 'Effacer' }).click()
  await jouerEtapes(page, parcours, { debut: 2 })
  await ecrire(page, parcours.final.solution, false)
  await valider(page)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await controlerVictoire(page, parcours, { score: (parcours.steps.length + 1) * 10, etoiles: 2, aides: 1 })
  // Après rechargement, plus rien à reprendre
  await page.reload()
  await expect(page.locator('.mystery-games')).toBeVisible()
  await expect(page.getByText('Tu as un mystère en cours')).toHaveCount(0)
  expect(erreurs).toEqual([])
})

test('Reprise : donnée illisible ignorée et jamais écrasée', async ({ page }) => {
  await connecterEleve(page, { pseudo: 'Illisible', niveau: 'SIL-CP' })
  await page.evaluate(() => localStorage.setItem('dibieMysteryInProgress', '{illisible'))
  await ouvrirMysteres(page)
  await lancer(page, { numero: 5 })
  await expect(page.locator('.anagram-tile').first()).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('dibieMysteryInProgress'))).toBe('{illisible')
})

test('Reprise : partie lisible mais mal formée ignorée, sans plantage', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Malforme', niveau: 'CM1-CM2' })
  const numero = 2026
  const parcours = motMystere('CM1-CM2', numero)
  await ouvrirMysteres(page)
  await lancer(page, { numero })
  await ecrire(page, parcours.steps[0].tiles.join(''), false)
  await valider(page)
  // Réponses d'étape remplacées par null : JSON lisible, parcours mal formé
  await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('dibieMysteryInProgress'))
    data[0].path.steps[0].answers = [null]
    localStorage.setItem('dibieMysteryInProgress', JSON.stringify(data))
  })
  await page.reload()
  await expect(page.locator('.mystery-games')).toBeVisible()
  await expect(page.getByText('Tu as un mystère en cours')).toHaveCount(0)
  expect(erreurs).toEqual([])
})

test('Pas de débordement horizontal à 320 px : choix, mission, étape de 10 lettres, éléments, finale, victoire', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const numero = chercherNumero('CM1-CM2', 'fr', p => p.steps.length === 7 && p.steps.some(s => s.word.length >= 9))
  expect(numero).not.toBeNull()
  const parcours = motMystere('CM1-CM2', numero)
  await connecterEleve(page, { pseudo: 'Petit mystere', niveau: 'CM1-CM2' })
  await ouvrirMysteres(page)
  expect(await deborde(page)).toBe(false)
  await page.locator('.mystery-games__btn', { hasText: /^1\./ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toBeVisible()
  expect(await deborde(page)).toBe(false)
  await page.getByRole('button', { name: 'C\'est parti !' }).click()
  await jouerEtapes(page, parcours)
  expect(await deborde(page)).toBe(false)
  await ecrire(page, parcours.final.solution, false)
  await valider(page)
  expect(await deborde(page)).toBe(false)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await expect(page.locator('.anagram-finished')).toBeVisible()
  expect(await deborde(page)).toBe(false)

  // Finale à choix à 320 px
  await page.getByRole('button', { name: 'Autre mystère' }).click()
  await page.locator('.mystery-games__btn', { hasText: /^4\./ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill('9')
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toBeVisible()
  expect(await deborde(page)).toBe(false)
})

// --- Jeu 5 : Message codé (lot 2) ---

// Résolution finale du jeu 5 : écrit, case par case, les lettres attendues
// dans les cases encore vides (une lettre se reporte sous les nombres identiques)
async function decoder(page, parcours) {
  const cases = page.locator('.mystery-code__input')
  for (let i = 0; i < parcours.final.message.length; i++) {
    if (await cases.nth(i).inputValue() === '') await cases.nth(i).fill(parcours.final.solution[i])
  }
}

const lignesCle = (parcours) => codeKey(parcours).map(l => `${l.number} = ${l.letter}`)

test('Message codé complet en français : clé gagnée, nombres identiques remplis ensemble, mot exact avec accents, 3 étoiles, score', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Code FR', niveau: 'CE1-CE2' })
  // Un mot accentué avec une lettre répétée (deux nombres identiques)
  const numero = chercherNumeroCode('CE1-CE2', 'fr', p =>
    p.final.display !== p.final.solution && new Set(p.final.solution).size < p.final.solution.length)
  expect(numero).not.toBeNull()
  const parcours = messageCode('CE1-CE2', numero)
  await ouvrirMysteres(page)
  await page.locator('.mystery-games__btn', { hasText: /^5\./ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toContainText(`Résous ${parcours.steps.length} anagrammes`)
  await expect(page.locator('.mystery-code-message')).toHaveText(parcours.final.message.join(' · '))
  await page.getByRole('button', { name: 'C\'est parti !' }).click()
  await expect(page.locator('.mystery-elements__item--hidden')).toHaveCount(parcours.steps.length)
  await jouerEtapes(page, parcours)

  // Finale : la clé complète reste affichée, rangée par nombre ; une case sous chaque nombre
  expect(await page.locator('.mystery-elements__item').allTextContents()).toEqual(lignesCle(parcours))
  expect(await page.locator('.mystery-code__number').allTextContents()).toEqual(parcours.final.message.map(String))
  const cases = page.locator('.mystery-code__input')
  // La lettre répétée, tapée une fois, est écrite sous tous ses nombres
  const repete = [...parcours.final.solution].findIndex((l, i) => parcours.final.solution.indexOf(l) !== i)
  const lettre = parcours.final.solution[repete]
  await cases.nth(repete).fill(lettre.toLowerCase())
  for (let i = 0; i < parcours.final.message.length; i++) {
    await expect(cases.nth(i)).toHaveValue(parcours.final.solution[i] === lettre ? lettre : '')
  }
  await expect(page.getByRole('button', { name: 'Valider', exact: true })).toBeDisabled()
  await decoder(page, parcours)
  await page.getByRole('button', { name: 'Valider', exact: true }).click()
  // Le mot exact, avec ses accents, est montré à la fin
  await expect(page.locator('.anagram-game__answer strong')).toHaveText(parcours.final.display)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  const score = (parcours.steps.length + 1) * 10
  await controlerVictoire(page, parcours, { score, etoiles: 3, aides: 0 })
  await expect(page.locator('.anagram-finished h1')).toHaveText('Mystère résolu !')
  await expect(page.locator('.mystery-victory__solution')).toContainText('Le message décodé')
  await page.getByRole('button', { name: 'Retour' }).click()
  await totalAffiche(page, score)
  expect(erreurs).toEqual([])
})

test('Message codé en anglais (SIL-CP) : réponse fausse, indice qui révèle une lettre partout, 2 étoiles', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Code EN', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = 777
  const parcours = messageCode('SIL-CP', numero, 'en')
  expect(parcours.extraction.rule).not.toBe('first')
  await ouvrirMysteres(page, 'en')
  await lancer(page, { jeu: 5, numero, langue: 'en' })
  await expect(page.locator('.anagram-slot--given')).toHaveText(parcours.steps[0].firstLetter)
  await jouerEtapes(page, parcours, { langue: 'en' })
  await expect(page.getByRole('heading', { name: 'The coded message' })).toBeVisible()

  // Réponse fausse : une lettre absente du mot partout
  const fausse = [...'ZQXJKV'].find(l => !parcours.final.solution.includes(l))
  const cases = page.locator('.mystery-code__input')
  for (let i = 0; i < parcours.final.message.length; i++) await cases.nth(i).fill(fausse)
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await expect(page.locator('.anagram-game__feedback')).toContainText('0 box is right')

  // Indice : la première lettre prévue est écrite sous tous ses nombres, cases verrouillées
  const revelee = parcours.final.hints[0]
  await page.getByRole('button', { name: /^Hint/ }).click()
  await expect(page.locator('.anagram-game__feedback')).toContainText(`the letter ${revelee}`)
  const attendues = [...parcours.final.solution].filter(l => l === revelee).length
  await expect(page.locator('.mystery-code__box--revealed')).toHaveCount(attendues)
  for (let i = 0; i < parcours.final.message.length; i++) {
    if (parcours.final.solution[i] === revelee) {
      await expect(cases.nth(i)).toHaveValue(revelee)
      await expect(cases.nth(i)).toHaveAttribute('readonly', '')
    }
  }
  // Les autres cases : la bonne lettre (elle remplace la fausse)
  for (let i = 0; i < parcours.final.message.length; i++) {
    if (parcours.final.solution[i] !== revelee) await cases.nth(i).fill(parcours.final.solution[i])
  }
  await page.getByRole('button', { name: 'Check', exact: true }).click()
  await page.getByRole('button', { name: 'See my result' }).click()
  await controlerVictoire(page, parcours, { score: (parcours.steps.length + 1) * 10, etoiles: 2, aides: 1, langue: 'en' })
  await expect(page.locator('.anagram-finished h1')).toHaveText('Mystery solved!')
  expect(erreurs).toEqual([])
})

test('Message codé : reprise après rechargement pendant la résolution finale, lettre révélée conservée', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Code reprise', niveau: 'CM1-CM2' })
  const numero = 2026
  const parcours = messageCode('CM1-CM2', numero)
  await ouvrirMysteres(page)
  await lancer(page, { jeu: 5, numero })
  await jouerEtapes(page, parcours)
  await page.getByRole('button', { name: /^Indice/ }).click()
  const enregistre = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieMysteryInProgress')))
  expect(enregistre[0]).toMatchObject({ formatVersion: 1, path: { id: parcours.id, game: 'codedMessage' }, state: { phase: 'final', final: { hints: 1 } } })
  const revelee = enregistre[0].state.final.revealed[0]
  expect(parcours.final.solution).toContain(revelee)

  await page.reload()
  await expect(page.getByText('Tu as un mystère en cours')).toBeVisible()
  await expect(page.getByText('Message codé')).toBeVisible()
  await page.getByRole('button', { name: 'Reprendre' }).click()
  expect(await page.locator('.mystery-elements__item').allTextContents()).toEqual(lignesCle(parcours))
  await expect(page.locator('.mystery-code__box--revealed')).toHaveCount([...parcours.final.solution].filter(l => l === revelee).length)
  await expect(page.locator('.anagram-game__progress')).toContainText(`${parcours.steps.length * 10} points`)
  await decoder(page, parcours)
  await page.getByRole('button', { name: 'Valider', exact: true }).click()
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await controlerVictoire(page, parcours, { score: (parcours.steps.length + 1) * 10, etoiles: 2, aides: 1 })
  expect(erreurs).toEqual([])
})

test('Message codé : pas de débordement horizontal à 320 px (mot de 7 lettres, clé, cases, victoire)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const numero = chercherNumeroCode('CM1-CM2', 'fr', p => p.final.solution.length === 7 && p.steps.some(s => s.word.length >= 9))
  expect(numero).not.toBeNull()
  const parcours = messageCode('CM1-CM2', numero)
  await connecterEleve(page, { pseudo: 'Petit code', niveau: 'CM1-CM2' })
  await ouvrirMysteres(page)
  await page.locator('.mystery-games__btn', { hasText: /^5\./ }).click()
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toBeVisible()
  expect(await deborde(page)).toBe(false)
  await page.getByRole('button', { name: 'C\'est parti !' }).click()
  await jouerEtapes(page, parcours)
  await expect(page.locator('.mystery-code__input')).toHaveCount(7)
  expect(await deborde(page)).toBe(false)
  await decoder(page, parcours)
  await page.getByRole('button', { name: 'Valider', exact: true }).click()
  expect(await deborde(page)).toBe(false)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await expect(page.locator('.anagram-finished')).toBeVisible()
  expect(await deborde(page)).toBe(false)
})

// --- Jeux 2 et 3 : Casse-tête des syllabes, Phrase secrète (lot 3, parcours préconçus) ---

const preconcu = (jeu, niveau, numero, langue = 'fr') => generatePresetPath(jeu, vocabulaire, niveau, numero, langue)

// Premier numéro (à partir de 1) qui choisit le parcours `id` du contenu
function numeroDuParcours(jeu, niveau, langue, id) {
  for (let numero = 1; numero < 500; numero++) {
    if (preconcu(jeu, niveau, numero, langue)?.id === id) return numero
  }
  return null
}

// Pose les étiquettes de la finale dans l'ordre des textes donnés (mots ou
// syllabes comparés en lettres de grille ; une étiquette déjà posée est sautée)
async function poserEtiquettes(page, parcours, textes) {
  const libres = parcours.final.labels.map((l, i) => ({ l, i }))
  for (const texte of textes) {
    const k = libres.findIndex(x => normalizeWord(x.l) === normalizeWord(texte))
    const { i } = libres.splice(k, 1)[0]
    await page.locator('.mystery-labels__pool button').nth(i).click()
  }
}

const motsDe = (phrase) => phrase.replace(/[,.]/g, '').split(' ')

test('Casse-tête des syllabes complet en français : syllabes gagnées signalées, étiquettes remises dans l\'ordre, 3 étoiles, score, brouillon affiché', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Syllabes FR', niveau: 'CE1-CE2' })
  const numero = numeroDuParcours('syllables', 'CE1-CE2', 'fr', 'syllabes-fr-ce1-ce2-01')
  expect(numero).not.toBeNull()
  const parcours = preconcu('syllables', 'CE1-CE2', numero)
  await ouvrirMysteres(page)
  await page.locator('.mystery-games__btn', { hasText: /^2\./ }).click()
  await expect(page.locator('.mystery-demo')).toContainText('brouillon')
  await page.getByLabel('Numéro de partie (facultatif)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toContainText(`Résous ${parcours.steps.length} anagrammes. Chaque mot trouvé te donne une syllabe.`)
  await expect(page.locator('.anagram-game__seed')).toHaveText(`Partie n° ${numero} · français · Démonstration (brouillon)`)
  await page.getByRole('button', { name: 'C\'est parti !' }).click()
  for (let i = 0; i < parcours.steps.length; i++) {
    const etape = parcours.steps[i]
    await expect(page.locator('.anagram-game__clue')).toHaveText(etape.definition)
    expect(await page.locator('.anagram-tile').allTextContents()).toEqual(etape.tiles)
    await ecrire(page, etape.word, false)
    await valider(page)
    await expect(page.locator('.mystery-won')).toContainText('Syllabe gagnée')
    await expect(page.locator('.mystery-won strong')).toHaveText(etape.secret)
    // La syllabe gagnée est signalée dans la syllabation du mot trouvé (I11)
    await expect(page.locator('.mystery-syllables__won')).toHaveText(etape.secret)
    await expect(page.locator('.mystery-syllables')).toHaveText(etape.syllables.join('-'))
    await expect(page.locator('.mystery-elements__item').nth(i)).toHaveText(etape.secret)
    await page.getByRole('button', { name: i === parcours.steps.length - 1 ? 'Vers le mystère' : 'Anagramme suivante' }).click()
  }
  // Finale : les syllabes gagnées, dans l'ordre des étapes, en étiquettes
  await expect(page.getByRole('heading', { name: 'Le mot mystère' })).toBeVisible()
  expect(await page.locator('.mystery-labels__pool button').allTextContents()).toEqual(parcours.final.labels)
  await expect(page.getByRole('button', { name: 'Valider', exact: true })).toBeDisabled()
  await poserEtiquettes(page, parcours, parcours.final.syllables)
  await valider(page)
  await expect(page.locator('.anagram-game__answer strong')).toHaveText('TÉLÉPHONE')
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  const score = (parcours.steps.length + 1) * 10
  await controlerVictoire(page, parcours, { score, etoiles: 3, aides: 0 })
  await expect(page.locator('.mystery-victory__solution')).toContainText('Le mot mystère')
  const progres = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieProgress')))
  // CÔTÉ : autre sens dans le vocabulaire, non relié (I10)
  const cote = parcours.steps.find(s => s.word === 'COTE')
  expect(progres.find(p => p.itemId === cote.id)).toMatchObject({ wordId: null, isCorrect: true })
  await page.getByRole('button', { name: 'Retour' }).click()
  await totalAffiche(page, score)
  expect(erreurs).toEqual([])
})

test('Casse-tête des syllabes en anglais (SIL-CP) : réponse fausse, indices (définition puis première syllabe), « Sunday » à la fin, 2 étoiles', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Syllables EN', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = numeroDuParcours('syllables', 'SIL-CP', 'en', 'syllabes-en-sil-cp-01')
  const parcours = preconcu('syllables', 'SIL-CP', numero, 'en')
  await ouvrirMysteres(page, 'en')
  await lancer(page, { jeu: 2, numero, langue: 'en' })
  await expect(page.locator('.anagram-slot--given')).toHaveText(parcours.steps[0].firstLetter)
  await jouerEtapes(page, parcours, { langue: 'en' })
  // Réponse fausse : les syllabes dans l'ordre des étapes (jamais la solution)
  await poserEtiquettes(page, parcours, parcours.final.labels)
  await valider(page, 'en')
  await expect(page.locator('.anagram-game__feedback')).toContainText('0 syllables are in the right place')
  await page.getByRole('button', { name: 'Clear' }).click()
  await page.getByRole('button', { name: /^Hint/ }).click()
  await expect(page.locator('.mystery-final__hint')).toHaveText(`Hint: ${parcours.final.hints[0]}`)
  await page.getByRole('button', { name: /^Hint/ }).click()
  await expect(page.locator('.mystery-final__hint').nth(1)).toHaveText('Hint: The word begins with SUN.')
  await expect(page.getByRole('button', { name: /^Hint/ })).toHaveCount(0)
  await poserEtiquettes(page, parcours, ['SUN', 'DAY'])
  await valider(page, 'en')
  await expect(page.locator('.anagram-game__answer strong')).toHaveText('Sunday')
  await page.getByRole('button', { name: 'See my result' }).click()
  await controlerVictoire(page, parcours, { score: 30, etoiles: 2, aides: 2, langue: 'en' })
  expect(erreurs).toEqual([])
})

test('Phrase secrète complète en français (CE1-CE2) : mots donnés d\'office, étiquettes en capitales, variante acceptée avec sa phrase correcte, indice, 2 étoiles', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Phrase FR', niveau: 'CE1-CE2' })
  const numero = numeroDuParcours('secretSentence', 'CE1-CE2', 'fr', 'phrase-secrete-fr-ce1-ce2-03')
  expect(numero).not.toBeNull()
  const parcours = preconcu('secretSentence', 'CE1-CE2', numero)
  await ouvrirMysteres(page)
  await lancer(page, { jeu: 3, numero })
  await jouerEtapes(page, parcours)
  await expect(page.getByRole('heading', { name: 'La phrase secrète' })).toBeVisible()
  // Mots donnés d'office (I4), étiquettes en capitales (I5)
  expect(await page.locator('.mystery-given__word').allTextContents()).toEqual(['LES', 'DANS', 'LA'])
  expect(await page.locator('.mystery-labels__pool button').allTextContents()).toEqual(parcours.final.labels)
  for (const l of parcours.final.labels) expect(l).toBe(l.toUpperCase())
  // Indice 1 : le premier mot
  await page.getByRole('button', { name: /^Indice/ }).click()
  await expect(page.locator('.mystery-final__hint')).toHaveText('Indice : La phrase commence par Les.')
  // Variante acceptée (I7) : complément en tête ; la phrase correcte s'affiche (I6)
  const variante = 'Dans la cour, les enfants jouent.'
  await poserEtiquettes(page, parcours, motsDe(variante))
  await valider(page)
  await expect(page.locator('.anagram-game__answer strong')).toHaveText(variante)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await controlerVictoire(page, parcours, { score: 40, etoiles: 2, aides: 1, solution: variante })
  await expect(page.locator('.mystery-victory__solution')).toContainText('La phrase secrète')
  expect(erreurs).toEqual([])
})

test('Phrase secrète : sujet inversé refusé en CE1-CE2 (I13), mots bien placés, solution montrée après 3 essais = 1 étoile', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Phrase refus', niveau: 'CE1-CE2' })
  const numero = numeroDuParcours('secretSentence', 'CE1-CE2', 'fr', 'phrase-secrete-fr-ce1-ce2-03')
  const parcours = preconcu('secretSentence', 'CE1-CE2', numero)
  await ouvrirMysteres(page)
  await lancer(page, { jeu: 3, numero })
  await jouerEtapes(page, parcours)
  for (let essai = 1; essai <= 3; essai++) {
    const effacer = page.getByRole('button', { name: 'Effacer' })
    if (await effacer.isEnabled()) await effacer.click()
    await poserEtiquettes(page, parcours, motsDe('Dans la cour jouent les enfants.'))
    await valider(page)
    await expect(page.locator('.anagram-game__feedback')).toContainText('bien placé')
  }
  await page.getByRole('button', { name: 'Voir la solution' }).click()
  await expect(page.locator('.anagram-game__answer strong')).toHaveText(parcours.final.display)
  await page.getByRole('button', { name: 'Voir mon résultat' }).click()
  await controlerVictoire(page, parcours, { score: 30, etoiles: 1, aides: 0 })
  await expect(page.locator('.anagram-finished h1')).toHaveText('Parcours terminé')
  expect(erreurs).toEqual([])
})

test('Phrase secrète en anglais (SIL-CP) : étiquettes avec la majuscule du premier mot, reprise après rechargement pendant la finale', async ({ page }) => {
  const erreurs = suivreErreurs(page)
  await connecterEleve(page, { pseudo: 'Sentence EN', niveau: 'SIL-CP' })
  await page.getByRole('button', { name: 'English' }).click()
  const numero = numeroDuParcours('secretSentence', 'SIL-CP', 'en', 'phrase-secrete-en-sil-cp-02')
  const parcours = preconcu('secretSentence', 'SIL-CP', numero, 'en')
  await ouvrirMysteres(page, 'en')
  await lancer(page, { jeu: 3, numero, langue: 'en' })
  await jouerEtapes(page, parcours, { langue: 'en' })
  // I5 : en SIL-CP, les étiquettes gardent l'écriture de la phrase
  expect([...await page.locator('.mystery-labels__pool button').allTextContents()].sort()).toEqual(['Mum', 'cooks', 'rice'])
  await page.getByRole('button', { name: /^Hint/ }).click()
  const enregistre = await page.evaluate(() => JSON.parse(localStorage.getItem('dibieMysteryInProgress')))
  expect(enregistre[0]).toMatchObject({ path: { id: parcours.id, game: 'secretSentence', status: 'draft' }, state: { phase: 'final', final: { hints: 1 } } })
  await page.reload()
  await expect(page.getByText('You have a mystery in progress')).toBeVisible()
  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.locator('.mystery-final__hint')).toHaveText('Hint: The sentence begins with Mum.')
  await poserEtiquettes(page, parcours, ['Mum', 'cooks', 'rice'])
  await valider(page, 'en')
  await expect(page.locator('.anagram-game__answer strong')).toHaveText('Mum cooks rice.')
  await page.getByRole('button', { name: 'See my result' }).click()
  await controlerVictoire(page, parcours, { score: 40, etoiles: 2, aides: 1, langue: 'en' })
  expect(erreurs).toEqual([])
})

test('Jeux 2 et 3 : pas de débordement horizontal à 320 px (phrase de 10 mots, étiquettes longues, victoire)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  const numero = numeroDuParcours('secretSentence', 'CM1-CM2', 'en', 'phrase-secrete-en-cm1-cm2-03')
  const parcours = preconcu('secretSentence', 'CM1-CM2', numero, 'en')
  await connecterEleve(page, { pseudo: 'Small sentence', niveau: 'CM1-CM2' })
  await page.getByRole('button', { name: 'English' }).click()
  await ouvrirMysteres(page, 'en')
  await page.locator('.mystery-games__btn', { hasText: /^3\./ }).click()
  expect(await deborde(page)).toBe(false)
  await page.getByLabel('Game number (optional)').fill(String(numero))
  await page.locator('.anagram-select__start').click()
  await expect(page.locator('.mystery-mission')).toBeVisible()
  expect(await deborde(page)).toBe(false)
  await page.getByRole('button', { name: 'Let\'s go!' }).click()
  await jouerEtapes(page, parcours, { langue: 'en' })
  await expect(page.locator('.mystery-labels__pool button')).toHaveCount(10)
  expect(await deborde(page)).toBe(false)
  await poserEtiquettes(page, parcours, motsDe(parcours.final.display))
  expect(await deborde(page)).toBe(false)
  await valider(page, 'en')
  expect(await deborde(page)).toBe(false)
  await page.getByRole('button', { name: 'See my result' }).click()
  await expect(page.locator('.anagram-finished')).toBeVisible()
  expect(await deborde(page)).toBe(false)

  // Jeu 2 à 320 px : CM1-CM2, SUBTRACTION (11 lettres), finale par syllabes
  await page.getByRole('button', { name: 'Another mystery' }).click()
  const n2 = numeroDuParcours('syllables', 'CM1-CM2', 'en', 'syllabes-en-cm1-cm2-02')
  const p2 = preconcu('syllables', 'CM1-CM2', n2, 'en')
  await lancer(page, { jeu: 2, numero: n2, langue: 'en' })
  await jouerEtapes(page, p2, { langue: 'en' })
  expect(await deborde(page)).toBe(false)
  await poserEtiquettes(page, p2, p2.final.syllables)
  await valider(page, 'en')
  await expect(page.locator('.anagram-game__answer strong')).toHaveText('SUBTRACTION')
  expect(await deborde(page)).toBe(false)
})
