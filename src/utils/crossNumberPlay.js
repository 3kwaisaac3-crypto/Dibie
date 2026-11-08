// Nombres croisés (fiche M1, moteur F) — lot B de la phase 5 : état d'une
// partie en cours (sélection, saisie, vérification, aides, points). Module pur :
// aucun accès au stockage ni à l'interface ; chaque fonction rend un nouvel
// état sans modifier l'ancien. La grille vient de createCrossNumberGame
// (crossNumberGame.js, lot A).
//
// Décisions d'Isaac du 2026-11-08 (cadrage DIBIE/pedagogie/cadrage-phase5-
// nombres-croises-v0.1.md, option a partout) :
// - P7 : vérification à la demande (✓) du nombre choisi, quand ses cases sont
//   remplies ; un nombre juste se verrouille, ses chiffres restent pour les
//   nombres qui le croisent ; un nombre faux reste à corriger ;
// - P8 : un chiffre révélé par nombre après 2 erreurs sur ce nombre ;
//   « Voir la réponse » pour ce nombre après 3 essais faux (0 point) ;
// - P9 : 10 points par nombre trouvé, même après une erreur ou un chiffre
//   révélé ; pas d'étoiles ;
// - P10 : toucher une case (horizontal d'abord, second toucher sur la même
//   case = vertical) ou une définition ; avance automatique ; ⌫ comme aux mots
//   croisés (case remplie : effacée ; case vide : recul et effacement).
//
// État : { values, fixed, status, errors, revealed, selected }
// - values[r][c] : chiffre écrit (ou fixé), null si vide ou case noire ;
// - fixed[r][c] : vrai si la case ne peut plus changer (nombre trouvé ou
//   montré qui y passe, chiffre révélé) ; une case fixée porte toujours le bon
//   chiffre ;
// - fixedBy[r][c] : origine d'une case fixée, 'found' (un nombre trouvé par
//   l'élève y passe), 'shown' (nombre montré) ou 'revealed' (chiffre révélé) ;
//   'found' l'emporte sur les autres, puis 'shown' ;
// - status[id] : 'open', 'found' (trouvé par l'élève) ou 'shown' (réponse
//   montrée, ou nombre complété sans l'élève : voir resolveFilledByAids) ;
// - errors[id] : vérifications fausses de ce nombre ;
// - revealed[id] : case [r, c] révélée pour ce nombre (au plus une) ;
// - selected : { id, cell: [r, c], tapped?, atEnd? } (nombre choisi, case
//   active, case touchée par selectCell, saisie arrivée au bout) ou null.

import { isCrossNumberPlayable } from './crossNumberGame.js'

// Disponibilité du jeu pour une classe : 'playable' (toutes les classes où le
// générateur est réglé : CP à CM2, Class 2 à Class 6, depuis le lot C ; au
// lot B, CM1-CM2 et Class 5-6 affichaient « bientôt ») ou 'not-offered' (SIL,
// Class 1 : jeu non proposé, P2 a ; classe inconnue)
export function crossNumberAvailability(className, subsystem) {
  return isCrossNumberPlayable(className, subsystem) ? 'playable' : 'not-offered'
}

export const POINTS_PER_NUMBER = 10
export const ERRORS_BEFORE_DIGIT = 2
export const TRIES_BEFORE_ANSWER = 3
export const GAME_TYPE_CROSS_NUMBER = 'crossNumber'

const sameCell = (a, b) => a !== null && b !== null && a[0] === b[0] && a[1] === b[1]
const copyGrid = (grid) => grid.map(row => row.slice())

export const entryById = (game, id) => game.entries.find(e => e.id === id) ?? null

// Nombres qui passent par une case, horizontaux d'abord
export const entriesAt = (game, r, c) => game.entries
  .filter(e => e.cells.some(cell => cell[0] === r && cell[1] === c))
  .sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'across' ? -1 : 1))

export const isResolved = (state, id) => state.status[id] === 'found' || state.status[id] === 'shown'

export function createPlayState(game) {
  const values = game.cells.map(row => row.map(() => null))
  const fixed = game.cells.map(row => row.map(() => false))
  const fixedBy = game.cells.map(row => row.map(() => null))
  const status = {}
  const errors = {}
  for (const e of game.entries) {
    status[e.id] = 'open'
    errors[e.id] = 0
  }
  const first = game.entries[0] ?? null
  return {
    values,
    fixed,
    fixedBy,
    status,
    errors,
    revealed: {},
    selected: first ? { id: first.id, cell: first.cells[0] } : null
  }
}

const isEditable = (state, [r, c]) => !state.fixed[r][c]

// Case active quand un nombre est choisi : la case voulue si elle est
// modifiable, sinon la prochaine case modifiable du nombre, sinon la première
// case modifiable ; à défaut (toutes fixées), la première case.
function cursorFor(state, entry, wanted = null) {
  const cells = entry.cells
  const start = wanted ? Math.max(0, cells.findIndex(cell => sameCell(cell, wanted))) : 0
  for (let k = start; k < cells.length; k++) if (isEditable(state, cells[k])) return cells[k]
  for (let k = 0; k < start; k++) if (isEditable(state, cells[k])) return cells[k]
  return cells[0]
}

// Toucher une case : horizontal d'abord ; second toucher sur la case active =
// l'autre nombre qui y passe (vertical). Les nombres déjà résolus sont ignorés ;
// une case dont tous les nombres sont résolus ne change rien.
export function selectCell(state, game, r, c) {
  const candidates = entriesAt(game, r, c).filter(e => !isResolved(state, e.id))
  if (candidates.length === 0) return state
  let entry = candidates[0]
  const sel = state.selected
  // Second toucher : sur la case active, ou sur la case touchée juste avant
  // (une case fixée, ex. chiffre révélé, déplace la case active ; sans
  // `tapped`, le vertical serait inaccessible par cette case)
  const again = sel && (sameCell(sel.cell, [r, c]) || sameCell(sel.tapped ?? null, [r, c]))
  if (again && candidates.length > 1) {
    const i = candidates.findIndex(e => e.id === sel.id)
    entry = candidates[(i + 1) % candidates.length]
  }
  return { ...state, selected: { id: entry.id, cell: cursorFor(state, entry, [r, c]), tapped: [r, c] } }
}

// Toucher une définition : son nombre est choisi, case active = première case
// vide modifiable (sinon première case modifiable)
export function selectEntry(state, game, id) {
  const entry = entryById(game, id)
  if (!entry || isResolved(state, id)) return state
  const empty = entry.cells.find(cell => isEditable(state, cell) && state.values[cell[0]][cell[1]] === null)
  return { ...state, selected: { id, cell: empty ?? cursorFor(state, entry) } }
}

// Chiffre du pavé : écrit dans la case active (ou la prochaine case modifiable
// du nombre), puis la case active avance à la case modifiable suivante. Les
// cases fixées sont sautées. Après la dernière case modifiable, la case active
// reste en place (selected.atEnd) et les chiffres suivants sont ignorés, comme
// la longueur limitée des pyramides : un élève qui tape « 80 » alors que le 0
// est déjà fixé n'écrase pas son 8. Toucher une case ou ⌫ lève ce blocage.
export function inputDigit(state, game, digit) {
  const sel = state.selected
  if (!sel || sel.atEnd || isResolved(state, sel.id) || !/^[0-9]$/.test(String(digit))) return state
  const entry = entryById(game, sel.id)
  const cell = cursorFor(state, entry, sel.cell)
  if (!isEditable(state, cell)) return state
  const values = copyGrid(state.values)
  values[cell[0]][cell[1]] = Number(digit)
  const k = entry.cells.findIndex(x => sameCell(x, cell))
  const next = entry.cells.slice(k + 1).find(x => isEditable(state, x))
  return { ...state, values, selected: next ? { id: sel.id, cell: next } : { id: sel.id, cell, atEnd: true } }
}

// ⌫ (règle des mots croisés du 2026-10-07) : case active modifiable et
// remplie : effacée ; sinon : recul à la case modifiable précédente du nombre,
// qui est effacée.
export function deleteDigit(state, game) {
  const sel = state.selected
  if (!sel || isResolved(state, sel.id)) return state
  const entry = entryById(game, sel.id)
  const [r, c] = sel.cell
  if (isEditable(state, sel.cell) && state.values[r][c] !== null) {
    const values = copyGrid(state.values)
    values[r][c] = null
    return { ...state, values, selected: { id: sel.id, cell: sel.cell } }
  }
  const k = entry.cells.findIndex(x => sameCell(x, sel.cell))
  const previous = entry.cells.slice(0, Math.max(0, k)).reverse().find(x => isEditable(state, x))
  if (!previous) return state
  const values = copyGrid(state.values)
  values[previous[0]][previous[1]] = null
  return { ...state, values, selected: { id: sel.id, cell: previous } }
}

// Chiffres écrits d'un nombre (null pour une case vide)
export const entryDigits = (state, entry) => entry.cells.map(([r, c]) => state.values[r][c])

export const isEntryComplete = (state, entry) => entryDigits(state, entry).every(d => d !== null)

// ✓ possible : un nombre choisi, non résolu, toutes ses cases remplies
export function canCheck(state, game) {
  const sel = state.selected
  if (!sel || isResolved(state, sel.id)) return false
  return isEntryComplete(state, entryById(game, sel.id))
}

const ORIGIN_RANK = { revealed: 1, shown: 2, found: 3 }

// Fixe une case avec le bon chiffre ; l'origine la plus forte est gardée
function fixCell(values, fixed, fixedBy, [r, c], game, origin) {
  values[r][c] = game.cells[r][c]
  fixed[r][c] = true
  if ((ORIGIN_RANK[fixedBy[r][c]] ?? 0) < ORIGIN_RANK[origin]) fixedBy[r][c] = origin
}

// Fixe les cases d'un nombre avec les bons chiffres
function fixEntry(values, fixed, fixedBy, entry, game, origin) {
  for (const cell of entry.cells) fixCell(values, fixed, fixedBy, cell, game, origin)
}

// Décision d'Isaac du 2026-11-08 (choix n° 8 du lot B, « Non, 0 point ») : un
// nombre ouvert dont toutes les cases sont fixées par des nombres montrés et
// des chiffres révélés, sans aucune case fixée par un nombre trouvé par
// l'élève, passe aussitôt à l'état 'shown' (résolu, 0 point), sans ✓. Un
// nombre rempli par au moins un nombre trouvé garde ses 10 points après ✓.
// Renvoie { state, autoShown } ; autoShown : identifiants passés à 'shown'.
export function resolveFilledByAids(state, game) {
  const autoShown = []
  let status = state.status
  for (const e of game.entries) {
    if (status[e.id] !== 'open') continue
    const allFixed = e.cells.every(([r, c]) => state.fixed[r][c])
    const byStudent = e.cells.some(([r, c]) => state.fixedBy[r][c] === 'found')
    if (allFixed && !byStudent) {
      status = { ...status, [e.id]: 'shown' }
      autoShown.push(e.id)
    }
  }
  if (autoShown.length === 0) return { state, autoShown }
  let next = { ...state, status }
  if (next.selected && isResolved(next, next.selected.id)) next = { ...next, selected: nextOpenSelection(next, game, next.selected.id) }
  return { state: next, autoShown }
}

// Prochain nombre à résoudre après `id` (ordre de la liste, en boucle)
function nextOpenSelection(state, game, id) {
  const list = game.entries
  const i = list.findIndex(e => e.id === id)
  for (let k = 1; k <= list.length; k++) {
    const e = list[(i + k) % list.length]
    if (!isResolved(state, e.id)) {
      const empty = e.cells.find(cell => isEditable(state, cell) && state.values[cell[0]][cell[1]] === null)
      return { id: e.id, cell: empty ?? cursorFor(state, e) }
    }
  }
  return null
}

// ✓ : vérifie le nombre choisi. Renvoie { state, result, entry, revealedCell } :
// - result 'correct' : nombre verrouillé (statut 'found'), nombre suivant choisi ;
// - result 'wrong' : une erreur de plus ; à la 2e erreur (ERRORS_BEFORE_DIGIT),
//   un chiffre est révélé (revealedCell) : la première case modifiable dont le
//   chiffre écrit est faux, et la case active revient à la première case
//   modifiable du nombre ;
// - result null : rien à vérifier (aucun nombre choisi, nombre incomplet ou
//   déjà résolu), état inchangé.
export function checkEntry(state, game) {
  if (!canCheck(state, game)) return { state, result: null, entry: null, revealedCell: null, autoShown: [] }
  const entry = entryById(game, state.selected.id)
  const digits = entryDigits(state, entry)
  const correct = entry.cells.every(([r, c], i) => digits[i] === game.cells[r][c])
  if (correct) {
    const values = copyGrid(state.values)
    const fixed = copyGrid(state.fixed)
    const fixedBy = copyGrid(state.fixedBy)
    fixEntry(values, fixed, fixedBy, entry, game, 'found')
    const next = { ...state, values, fixed, fixedBy, status: { ...state.status, [entry.id]: 'found' } }
    return { state: { ...next, selected: nextOpenSelection(next, game, entry.id) }, result: 'correct', entry, revealedCell: null, autoShown: [] }
  }
  const wrongCount = state.errors[entry.id] + 1
  let next = { ...state, errors: { ...state.errors, [entry.id]: wrongCount } }
  let revealedCell = null
  if (wrongCount >= ERRORS_BEFORE_DIGIT && !state.revealed[entry.id]) {
    // Une case fixée porte toujours le bon chiffre : un nombre faux a donc au
    // moins une case modifiable fausse
    revealedCell = entry.cells.find(([r, c]) => isEditable(state, [r, c]) && state.values[r][c] !== game.cells[r][c])
    const values = copyGrid(state.values)
    const fixed = copyGrid(state.fixed)
    const fixedBy = copyGrid(state.fixedBy)
    fixCell(values, fixed, fixedBy, revealedCell, game, 'revealed')
    next = { ...next, values, fixed, fixedBy, revealed: { ...state.revealed, [entry.id]: revealedCell } }
  }
  next = { ...next, selected: { id: entry.id, cell: cursorFor(next, entry) } }
  // Le chiffre révélé peut compléter un nombre sans l'élève (choix n° 8)
  const { state: resolved, autoShown } = resolveFilledByAids(next, game)
  return { state: resolved, result: 'wrong', entry, revealedCell, autoShown }
}

// « Voir la réponse » proposé pour un nombre non résolu après 3 essais faux
export const canShowAnswer = (state, id) =>
  id !== null && id !== undefined && !isResolved(state, id) && (state.errors[id] ?? 0) >= TRIES_BEFORE_ANSWER

// « Voir la réponse » : le nombre choisi est montré (statut 'shown', 0 point)
// et verrouillé ; les nombres qu'il complète sans l'élève passent aussi à
// 'shown' (choix n° 8) ; nombre suivant choisi. Renvoie { state, entry,
// autoShown } ; showAnswer renvoie l'état seul.
export function showAnswerResult(state, game) {
  const sel = state.selected
  if (!sel || !canShowAnswer(state, sel.id)) return { state, entry: null, autoShown: [] }
  const entry = entryById(game, sel.id)
  const values = copyGrid(state.values)
  const fixed = copyGrid(state.fixed)
  const fixedBy = copyGrid(state.fixedBy)
  fixEntry(values, fixed, fixedBy, entry, game, 'shown')
  let next = { ...state, values, fixed, fixedBy, status: { ...state.status, [entry.id]: 'shown' } }
  next = { ...next, selected: nextOpenSelection(next, game, entry.id) }
  const { state: resolved, autoShown } = resolveFilledByAids(next, game)
  return { state: resolved, entry, autoShown }
}

export const showAnswer = (state, game) => showAnswerResult(state, game).state

export const foundIds = (state) => Object.keys(state.status).filter(id => state.status[id] === 'found')
export const shownIds = (state) => Object.keys(state.status).filter(id => state.status[id] === 'shown')
export const revealedIds = (state) => Object.keys(state.revealed)
export const totalErrors = (state) => Object.values(state.errors).reduce((n, k) => n + k, 0)

// Points : 10 par nombre trouvé par l'élève (même après erreur ou chiffre
// révélé) ; un nombre montré ne rapporte rien
export const crossNumberScore = (state) => foundIds(state).length * POINTS_PER_NUMBER

export const isFinished = (state) => Object.keys(state.status).every(id => isResolved(state, id))

// Identifiant d'un nombre dans dibieProgress : sous-système, classe, graine,
// numéro et direction (« fr:CE1:2024:3A »)
export const crossNumberItemId = (game, id) => `${game.subsystem}:${game.className}:${game.seed}:${id}`

// Aspect d'une case : 'black', 'found' (un nombre trouvé y passe), 'shown'
// (un nombre montré y passe), 'revealed' (chiffre révélé), 'open'
export function cellKind(state, game, r, c) {
  if (game.cells[r][c] === null) return 'black'
  const through = entriesAt(game, r, c)
  if (through.some(e => state.status[e.id] === 'found')) return 'found'
  if (through.some(e => state.status[e.id] === 'shown')) return 'shown'
  if (state.fixed[r][c]) return 'revealed'
  return 'open'
}

// Lignes et colonnes affichées : les rangées et colonnes entièrement noires du
// bord sont retirées (le carré 2 × 2 du gabarit 3 × 3 s'affiche en 2 × 2 sans
// cadre, docs/nombres-croises.md §4 bis, point 8)
export function visibleArea(game) {
  const n = game.cells.length
  const whiteRow = (r) => game.cells[r].some(d => d !== null)
  const whiteCol = (c) => game.cells.some(row => row[c] !== null)
  let top = 0, bottom = n - 1, left = 0, right = n - 1
  while (top < bottom && !whiteRow(top)) top++
  while (bottom > top && !whiteRow(bottom)) bottom--
  while (left < right && !whiteCol(left)) left++
  while (right > left && !whiteCol(right)) right--
  return { top, bottom, left, right, rows: bottom - top + 1, cols: right - left + 1 }
}

// Résumé de la partie pour saveScore (aides notées dans details, P9 a)
export const playSummary = (state) => ({
  found: foundIds(state),
  shown: shownIds(state),
  revealed: revealedIds(state),
  errors: totalErrors(state)
})
