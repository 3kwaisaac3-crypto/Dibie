// Tests de l'état d'une partie de nombres croisés (fiche M1, phase 5, lot B) :
// sélection, saisie, ⌫, vérification, chiffre révélé, « Voir la réponse »,
// points — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createCrossNumberGame } from './crossNumberGame.js'
import {
  createPlayState,
  selectCell,
  selectEntry,
  inputDigit,
  deleteDigit,
  canCheck,
  checkEntry,
  canShowAnswer,
  showAnswer,
  showAnswerResult,
  crossNumberScore,
  isFinished,
  entriesAt,
  entryById,
  cellKind,
  visibleArea,
  playSummary,
  crossNumberItemId,
  crossNumberAvailability,
  POINTS_PER_NUMBER,
  GAME_TYPE_CROSS_NUMBER
} from './crossNumberPlay.js'

// Grille fabriquée à la main (forme de l'escalier 3 × 3), pour des tests
// indépendants du générateur :
//   # # 8      1D = 80 (8 puis 0), 2A = 60, 2D = 69, 3A = 19
//   # 6 0
//   1 9 #
function stairGame() {
  return {
    seed: 7,
    className: 'CP',
    subsystem: 'fr',
    level: 'SIL-CP',
    size: 3,
    rows: ['##.', '#..', '..#'],
    cells: [[null, null, 8], [null, 6, 0], [1, 9, null]],
    entries: [
      { id: '2A', number: 2, direction: 'across', cells: [[1, 1], [1, 2]], length: 2, answer: 60, text: { fr: '6 dizaines', en: '6 tens' } },
      { id: '3A', number: 3, direction: 'across', cells: [[2, 0], [2, 1]], length: 2, answer: 19, text: { fr: '22 − 3', en: '22 − 3' } },
      { id: '1D', number: 1, direction: 'down', cells: [[0, 2], [1, 2]], length: 2, answer: 80, text: { fr: '42 + 38', en: '42 + 38' } },
      { id: '2D', number: 2, direction: 'down', cells: [[1, 1], [2, 1]], length: 2, answer: 69, text: { fr: '6 dizaines et 9 unités', en: '6 tens and 9 units' } }
    ]
  }
}

const type = (state, game, text) => [...text].reduce((s, d) => inputDigit(s, game, d), state)

test('NP1 état initial : toutes les cases vides, premier nombre choisi', () => {
  const g = stairGame()
  const s = createPlayState(g)
  assert.deepEqual(s.selected, { id: '2A', cell: [1, 1] })
  assert.ok(s.values.flat().every(v => v === null))
  assert.equal(crossNumberScore(s), 0)
  assert.equal(isFinished(s), false)
  assert.equal(canCheck(s, g), false)
})

test('NP2 sélection : horizontal d\'abord, second toucher = vertical, troisième = horizontal', () => {
  const g = stairGame()
  let s = createPlayState(g)
  assert.deepEqual(entriesAt(g, 1, 1).map(e => e.id), ['2A', '2D'])
  s = selectCell(s, g, 2, 1)
  assert.deepEqual(s.selected, { id: '3A', cell: [2, 1], tapped: [2, 1] })
  s = selectCell(s, g, 2, 1)
  assert.deepEqual(s.selected, { id: '2D', cell: [2, 1], tapped: [2, 1] })
  s = selectCell(s, g, 2, 1)
  assert.equal(s.selected.id, '3A')
  // Case d'un seul nombre (vertical seulement) : ce nombre
  s = selectCell(s, g, 0, 2)
  assert.deepEqual(s.selected, { id: '1D', cell: [0, 2], tapped: [0, 2] })
  s = selectCell(s, g, 0, 2)
  assert.equal(s.selected.id, '1D')
  // Case noire : rien ne change
  assert.equal(selectCell(s, g, 0, 0), s)
})

test('NP3 sélection par la définition : première case vide', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = selectEntry(s, g, '2D')
  assert.deepEqual(s.selected, { id: '2D', cell: [1, 1] })
  s = inputDigit(s, g, '6')
  s = selectEntry(s, g, '2A')
  assert.deepEqual(s.selected, { id: '2A', cell: [1, 2] }, 'case [1,1] déjà remplie par le vertical')
  assert.equal(selectEntry(s, g, 'XX'), s)
})

test('NP4 saisie : avance automatique ; après la dernière case, chiffres ignorés ; toucher une case permet de la récrire', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = inputDigit(s, g, '5')
  assert.deepEqual(s.selected.cell, [1, 2])
  s = inputDigit(s, g, '1')
  assert.deepEqual(s.selected, { id: '2A', cell: [1, 2], atEnd: true })
  assert.equal(inputDigit(s, g, '0'), s, 'chiffre de trop ignoré')
  s = selectCell(s, g, 1, 2) // case active touchée de nouveau : 1D (vertical), même case
  assert.equal(s.selected.id, '1D')
  s = selectCell(s, g, 1, 2)
  assert.deepEqual(s.selected, { id: '2A', cell: [1, 2], tapped: [1, 2] })
  s = inputDigit(s, g, '0')
  assert.equal(s.values[1][1], 5)
  assert.equal(s.values[1][2], 0)
  assert.equal(canCheck(s, g), true)
  // Un chiffre déjà fixé n'est pas écrasé par un élève qui tape tout le nombre
  let t = checkEntry(type(createPlayState(g), g, '60'), g).state // 2A trouvé : [1,2] = 0 fixé
  t = selectEntry(t, g, '1D')
  t = type(t, g, '80')
  assert.equal(t.values[0][2], 8)
  assert.equal(t.values[1][2], 0)
  // Entrée invalide ignorée
  assert.equal(inputDigit(s, g, 'a'), s)
})

test('NP5 ⌫ : case remplie effacée ; case vide : recul et effacement', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = type(s, g, '6') // case active : [1,2], vide
  s = deleteDigit(s, g)
  assert.equal(s.values[1][1], null, 'case vide : recule et efface la précédente')
  assert.deepEqual(s.selected.cell, [1, 1])
  s = type(s, g, '60') // case active reste [1,2], remplie
  s = deleteDigit(s, g)
  assert.equal(s.values[1][2], null, 'case remplie : effacée sur place')
  assert.equal(s.values[1][1], 6)
  assert.deepEqual(s.selected.cell, [1, 2])
  // Première case vide : rien à effacer
  s = deleteDigit(deleteDigit(s, g), g)
  assert.equal(deleteDigit(s, g), s)
})

test('NP6 nombre juste : verrouillé, 10 points, chiffres gardés pour le nombre croisé, nombre suivant choisi', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = type(s, g, '60')
  const r = checkEntry(s, g)
  assert.equal(r.result, 'correct')
  s = r.state
  assert.equal(s.status['2A'], 'found')
  assert.equal(crossNumberScore(s), POINTS_PER_NUMBER)
  assert.ok(s.fixed[1][1] && s.fixed[1][2])
  assert.equal(s.selected.id, '3A')
  // Nombre verrouillé : la case [1,2] (aussi dans 1D) choisit 1D, case active
  // = la case modifiable [0,2]
  s = selectCell(s, g, 1, 2)
  assert.deepEqual(s.selected, { id: '1D', cell: [0, 2], tapped: [1, 2] })
  // Saisie : la case fixée [1,2] est sautée ; ⌫ ne l'efface pas
  s = inputDigit(s, g, '8')
  assert.deepEqual(s.selected.cell, [0, 2])
  assert.equal(canCheck(s, g), true)
  s = deleteDigit(s, g)
  assert.equal(s.values[0][2], null)
  assert.equal(s.values[1][2], 0)
  // Le nombre trouvé ne peut plus être choisi
  assert.equal(selectEntry(s, g, '2A'), s)
})

test('NP7 nombre faux : laissé à corriger ; chiffre révélé à la 2e erreur ; « Voir la réponse » à la 3e', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = selectEntry(s, g, '3A')
  s = type(s, g, '18')
  let r = checkEntry(s, g)
  assert.equal(r.result, 'wrong')
  assert.equal(r.revealedCell, null)
  s = r.state
  assert.equal(s.errors['3A'], 1)
  assert.equal(s.values[2][0], 1, 'chiffres laissés à corriger')
  assert.deepEqual(s.selected, { id: '3A', cell: [2, 0] })
  assert.equal(canShowAnswer(s, '3A'), false)

  r = checkEntry(s, g)
  assert.equal(r.result, 'wrong')
  assert.deepEqual(r.revealedCell, [2, 1], 'première case modifiable fausse')
  s = r.state
  assert.equal(s.values[2][1], 9)
  assert.ok(s.fixed[2][1])
  assert.equal(cellKind(s, g, 2, 1), 'revealed')
  assert.deepEqual(s.selected.cell, [2, 0])

  // 3e essai faux : pas de second chiffre révélé ; « Voir la réponse »
  s = type(s, g, '2')
  r = checkEntry(s, g)
  assert.equal(r.result, 'wrong')
  assert.equal(r.revealedCell, null)
  s = r.state
  assert.equal(Object.keys(s.revealed).length, 1)
  assert.equal(canShowAnswer(s, '3A'), true)

  s = showAnswer(s, g)
  assert.equal(s.status['3A'], 'shown')
  assert.equal(s.values[2][0], 1)
  assert.equal(crossNumberScore(s), 0, 'nombre montré : 0 point')
  assert.notEqual(s.selected.id, '3A')
  assert.equal(cellKind(s, g, 2, 0), 'shown')
})

test('NP8 trouvé après un chiffre révélé : 10 points quand même, aide notée dans le résumé', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = type(s, g, '11')
  s = checkEntry(s, g).state
  s = checkEntry(s, g).state // 2e erreur : [1,1] révélé (6)
  assert.equal(s.values[1][1], 6)
  s = type(s, g, '0')
  const r = checkEntry(s, g)
  assert.equal(r.result, 'correct')
  s = r.state
  assert.equal(crossNumberScore(s), 10)
  assert.deepEqual(playSummary(s), { found: ['2A'], shown: [], revealed: ['2A'], errors: 2 })
})

test('NP9 ✓ sans effet si le nombre est incomplet ; « Voir la réponse » refusé avant 3 erreurs', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = type(s, g, '6')
  const r = checkEntry(s, g)
  assert.equal(r.result, null)
  assert.equal(r.state, s)
  assert.equal(showAnswer(s, g), s)
})

test('NP10 partie finie : tous les nombres résolus ; plus aucun nombre choisi', () => {
  const g = stairGame()
  let s = createPlayState(g)
  for (const e of g.entries) {
    s = selectEntry(s, g, e.id)
    if (s.selected?.id !== e.id) continue // déjà résolu
    // Seules les cases modifiables reçoivent un chiffre (les cases fixées sont sautées)
    s = e.cells.reduce((st, [r, c]) => (st.fixed[r][c] ? st : inputDigit(st, g, String(g.cells[r][c]))), s)
    s = checkEntry(s, g).state
  }
  assert.equal(isFinished(s), true)
  assert.equal(s.selected, null)
  assert.equal(crossNumberScore(s), 40)
  assert.equal(inputDigit(s, g, '1'), s)
  assert.equal(deleteDigit(s, g), s)
  assert.equal(selectCell(s, g, 1, 1), s)
})

test('NP11 nombre dont toutes les cases sont fixées par les croisements : ✓ possible et juste', () => {
  const g = stairGame()
  let s = createPlayState(g)
  // 2A (60) puis 3A (19) trouvés : 2D (69) est entièrement fixé
  s = checkEntry(type(s, g, '60'), g).state
  s = checkEntry(type(selectEntry(s, g, '3A'), g, '19'), g).state
  s = selectEntry(s, g, '2D')
  assert.equal(canCheck(s, g), true)
  assert.equal(inputDigit(s, g, '5'), s, 'aucune case modifiable')
  assert.equal(checkEntry(s, g).result, 'correct')
})

test('NP12 grilles générées (CP à CE2, Class 2 à 4) : partie jouée en entier, score = 10 × nombres', () => {
  for (const [className, subsystem] of [['CP', 'fr'], ['CE1', 'fr'], ['CE2', 'fr'], ['Class 2', 'en'], ['Class 3', 'en'], ['Class 4', 'en']]) {
    for (let seed = 1; seed <= 30; seed++) {
      const g = createCrossNumberGame({ className, subsystem, seed })
      let s = createPlayState(g)
      for (const e of g.entries) {
        s = selectEntry(s, g, e.id)
        if (s.selected?.id !== e.id) continue
        // Cases modifiables remplies dans l'ordre (les cases fixées sont sautées)
        s = e.cells.reduce((st, [r, c]) => (st.fixed[r][c] ? st : inputDigit(st, g, String(g.cells[r][c]))), s)
        const r = checkEntry(s, g)
        assert.equal(r.result, 'correct', `${className} n° ${seed} ${e.id}`)
        s = r.state
      }
      assert.ok(isFinished(s), `${className} n° ${seed}`)
      assert.equal(crossNumberScore(s), g.entries.length * POINTS_PER_NUMBER)
    }
  }
})

test('NP13 zone affichée : carré 2 × 2 sans cadre ; autres gabarits entiers', () => {
  const square = { cells: [[1, 2, null], [3, 4, null], [null, null, null]] }
  assert.deepEqual(visibleArea(square), { top: 0, bottom: 1, left: 0, right: 1, rows: 2, cols: 2 })
  const sq2 = { cells: [[null, null, null], [null, 1, 2], [null, 3, 4]] }
  assert.deepEqual(visibleArea(sq2), { top: 1, bottom: 2, left: 1, right: 2, rows: 2, cols: 2 })
  assert.deepEqual(visibleArea(stairGame()), { top: 0, bottom: 2, left: 0, right: 2, rows: 3, cols: 3 })
  // Sur des grilles générées : toutes les cases blanches restent dans la zone
  let squares = 0
  for (let seed = 1; seed <= 200; seed++) {
    const g = createCrossNumberGame({ className: 'CP', subsystem: 'fr', seed })
    const a = visibleArea(g)
    if (g.templateId === 'T3-carre') {
      squares++
      assert.equal(a.rows, 2)
      assert.equal(a.cols, 2)
    }
    g.cells.forEach((row, r) => row.forEach((d, c) => {
      if (d !== null) assert.ok(r >= a.top && r <= a.bottom && c >= a.left && c <= a.right)
    }))
  }
  assert.ok(squares > 0, 'au moins un carré parmi 200 graines')
})

test('NP16 chiffre révélé sur une case de croisement : deux touchers sur cette case passent au vertical', () => {
  const g = stairGame()
  let s = createPlayState(g)
  // 2A faux deux fois (« 11 ») : [1,1] révélé (6), case de croisement de 2A et 2D, tous deux ouverts
  s = type(s, g, '11')
  s = checkEntry(s, g).state
  s = checkEntry(s, g).state
  assert.deepEqual(s.revealed['2A'], [1, 1])
  assert.ok(s.fixed[1][1])
  s = selectEntry(s, g, '3A') // autre nombre choisi d'abord
  s = selectCell(s, g, 1, 1)
  assert.equal(s.selected.id, '2A', 'premier toucher : horizontal')
  assert.deepEqual(s.selected.cell, [1, 2], 'case fixée : la case active avance')
  s = selectCell(s, g, 1, 1)
  assert.equal(s.selected.id, '2D', 'second toucher : vertical')
  assert.deepEqual(s.selected.cell, [2, 1])
  s = selectCell(s, g, 1, 1)
  assert.equal(s.selected.id, '2A', 'troisième toucher : de nouveau horizontal')
})

// Trois vérifications fausses puis « Voir la réponse » sur un nombre
function showAfterThreeErrors(s, g, id, wrongDigits) {
  s = type(selectEntry(s, g, id), g, wrongDigits)
  for (let k = 0; k < 3; k++) s = checkEntry(s, g).state
  assert.equal(canShowAnswer(s, id), true)
  return showAnswerResult(s, g)
}

test('NP17 décision d\'Isaac (choix n° 8) : nombre complété par des nombres montrés : montré d\'office, 0 point, pas de double comptage', () => {
  const g = stairGame()
  let s = createPlayState(g)
  let r = showAfterThreeErrors(s, g, '2A', '11')
  assert.deepEqual(r.autoShown, [])
  s = r.state
  r = showAfterThreeErrors(s, g, '3A', '28')
  // 2D (cases [1,1] et [2,1]) entièrement fixé par 2A et 3A montrés : montré d'office
  assert.deepEqual(r.autoShown, ['2D'])
  s = r.state
  assert.equal(s.status['2D'], 'shown')
  assert.equal(s.selected.id, '1D', 'nombre suivant non résolu')
  assert.equal(cellKind(s, g, 2, 1), 'shown')
  // 1D trouvé : 10 points en tout ; résumé sans doublon
  s = checkEntry(type(s, g, '8'), g).state
  assert.equal(isFinished(s), true)
  assert.equal(crossNumberScore(s), 10)
  assert.deepEqual(playSummary(s), { found: ['1D'], shown: ['2A', '3A', '2D'], revealed: ['2A', '3A'], errors: 6 })
})

test('NP18 nombre complété avec au moins un nombre trouvé : reste ouvert, 10 points après ✓', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = checkEntry(type(s, g, '60'), g).state // 2A trouvé
  const r = showAfterThreeErrors(s, g, '3A', '28') // 3A montré
  assert.deepEqual(r.autoShown, [])
  s = selectEntry(r.state, g, '2D')
  assert.equal(s.status['2D'], 'open')
  const c = checkEntry(s, g)
  assert.equal(c.result, 'correct')
  assert.equal(crossNumberScore(c.state), 20)
})

test('NP19 chiffre révélé qui complète un nombre avec un nombre montré : montré d\'office', () => {
  const g = stairGame()
  let s = createPlayState(g)
  s = showAfterThreeErrors(s, g, '3A', '28').state // [2,1] fixé (montré)
  // 2D faux deux fois : [1,1] révélé ; 2D entièrement fixé sans l'élève
  s = type(selectEntry(s, g, '2D'), g, '1')
  s = checkEntry(s, g).state
  const r = checkEntry(s, g)
  assert.deepEqual(r.revealedCell, [1, 1])
  assert.deepEqual(r.autoShown, ['2D'])
  assert.equal(r.state.status['2D'], 'shown')
  assert.equal(r.state.status['2A'], 'open', '2A : [1,2] encore libre')
})

test('NP15 disponibilité par classe (lot C) : CP à CM2 et Class 2 à Class 6 jouables, SIL et Class 1 non proposés', () => {
  for (const c of ['CP', 'CE1', 'CE2', 'CM1', 'CM2']) assert.equal(crossNumberAvailability(c, 'fr'), 'playable', c)
  for (const c of ['Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6']) assert.equal(crossNumberAvailability(c, 'en'), 'playable', c)
  assert.equal(crossNumberAvailability('SIL', 'fr'), 'not-offered')
  assert.equal(crossNumberAvailability('Class 1', 'en'), 'not-offered')
  assert.equal(crossNumberAvailability('CP', 'en'), 'not-offered', 'classe d\'un autre sous-système')
  assert.equal(crossNumberAvailability('Inconnue', 'fr'), 'not-offered')
})

// Classes ouvertes à l'écran au lot C (grilles 6 × 6 et 7 × 7)
const LOT_C_CLASSES = [['CM1', 'fr'], ['CM2', 'fr'], ['Class 5', 'en'], ['Class 6', 'en']]

test('NP20 lot C (CM1, CM2, Class 5, Class 6) : 30 parties jouées en entier par classe, score = 10 × nombres', () => {
  for (const [className, subsystem] of LOT_C_CLASSES) {
    for (let seed = 1; seed <= 30; seed++) {
      const g = createCrossNumberGame({ className, subsystem, seed })
      assert.equal(g.size, className === 'CM1' || className === 'Class 5' ? 6 : 7)
      // Grille entière affichée (aucune rangée ni colonne noire au bord retirée)
      const a = visibleArea(g)
      g.cells.forEach((row, r) => row.forEach((d, c) => {
        if (d !== null) assert.ok(r >= a.top && r <= a.bottom && c >= a.left && c <= a.right)
      }))
      let s = createPlayState(g)
      for (const e of g.entries) {
        s = selectEntry(s, g, e.id)
        if (s.selected?.id !== e.id) continue
        s = e.cells.reduce((st, [r, c]) => (st.fixed[r][c] ? st : inputDigit(st, g, String(g.cells[r][c]))), s)
        const r = checkEntry(s, g)
        assert.equal(r.result, 'correct', `${className} n° ${seed} ${e.id}`)
        s = r.state
      }
      assert.ok(isFinished(s), `${className} n° ${seed}`)
      assert.equal(crossNumberScore(s), g.entries.length * POINTS_PER_NUMBER)
    }
  }
})

test('NP21 lot C : tous les horizontaux montrés ; un vertical rempli seulement par les aides est montré d\'office, 0 point (choix n° 8)', () => {
  for (const [className, subsystem] of LOT_C_CLASSES) {
    let autoTotal = 0
    for (let seed = 1; seed <= 30; seed++) {
      const g = createCrossNumberGame({ className, subsystem, seed })
      let s = createPlayState(g)
      const across = g.entries.filter(e => e.direction === 'across')
      for (const e of across) {
        if (s.status[e.id] !== 'open') continue
        s = selectEntry(s, g, e.id)
        // Chiffres faux dans les cases modifiables
        s = e.cells.reduce((st, [r, c]) => (st.fixed[r][c] ? st : inputDigit(st, g, String((g.cells[r][c] + 1) % 10))), s)
        while (s.status[e.id] === 'open' && !canShowAnswer(s, e.id)) {
          const r = checkEntry(s, g)
          s = r.state
          if (r.result === 'correct') break
        }
        if (canShowAnswer(s, e.id)) s = showAnswerResult(selectEntry(s, g, e.id), g).state
      }
      assert.equal(crossNumberScore(s), 0, `${className} n° ${seed}`)
      // Un vertical dont toutes les cases sont dans des horizontaux (montrés) est montré d'office
      // (un horizontal devenu juste par le chiffre révélé compte comme trouvé)
      const inAcross = (r, c) => across.some(x => s.status[x.id] === 'shown' && x.cells.some(([a, b]) => a === r && b === c))
      let open = 0
      for (const e of g.entries.filter(x => x.direction === 'down')) {
        const covered = e.cells.every(([r, c]) => inAcross(r, c))
        assert.equal(s.status[e.id], covered ? 'shown' : 'open', `${className} n° ${seed} ${e.id}`)
        if (covered) autoTotal++
        else open++
      }
      // Les verticaux restants, trouvés par l'élève : 10 points chacun, rien de plus
      for (const e of g.entries.filter(x => x.direction === 'down' && s.status[x.id] === 'open')) {
        s = selectEntry(s, g, e.id)
        s = e.cells.reduce((st, [r, c]) => (st.fixed[r][c] ? st : inputDigit(st, g, String(g.cells[r][c]))), s)
        s = checkEntry(s, g).state
      }
      assert.ok(isFinished(s))
      assert.equal(crossNumberScore(s), open * POINTS_PER_NUMBER, `${className} n° ${seed}`)
    }
    assert.ok(autoTotal > 0, `${className} : au moins un vertical montré d'office sur 30 parties`)
  }
})

test('NP14 identifiant de progrès et type de jeu propres à M1', () => {
  const g = stairGame()
  assert.equal(crossNumberItemId(g, '3A'), 'fr:CP:7:3A')
  assert.equal(GAME_TYPE_CROSS_NUMBER, 'crossNumber')
  assert.equal(entryById(g, '1D').answer, 80)
})
