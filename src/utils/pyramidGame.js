// Pyramides additives et multiplicatives (fiches M2 et M3 du catalogue des
// jeux v0.2, moteur F ; plan de migration §5.1, phase 3). Module pur : aucun
// accès au stockage ni à l'interface. Même modèle que les anagrammes : graine
// reproductible (createRandom, newSeed, isValidSeed).
//
// Une pyramide de n étages a n cases à la base. Chaque case est la somme
// (additive) ou le produit (multiplicative) des deux cases sur lesquelles elle
// repose. Cases numérotées de haut en bas, de gauche à droite : étage 0 = le
// sommet (1 case), étage n - 1 = la base (n cases).
//
// Règles de qualité M2 et M3 appliquées (et vérifiées par pyramidGame.test.js) :
// - une seule solution : les cases données déterminent toutes les autres par
//   une résolution complète, case par case (solvePyramid) ; chaque déduction
//   est forcée, donc la solution est unique ;
// - le sommet (la plus grande case) est calculé avant affichage et ne dépasse
//   pas la limite de la classe (src/data/reglages-maths.js) ;
// - aucun résultat négatif ni décimal : nombres entiers positifs, soustractions
//   et divisions faites sur les vraies valeurs, divisions toujours exactes ;
// - multiplicatif : pas de 0, au plus un 1 dans la base, facteurs pris dans les
//   tables de la classe ; pas de pyramide multiplicative en SIL-CP / Class 1-2 ;
// - aucune case donnée ne rend le calcul inutile : exactement n cases données
//   (autant que de cases à la base), toutes nécessaires ; retirer l'une d'elles
//   empêche la résolution.
//
// Décisions d'Isaac : Q5 (réglage par classe et sous-système), D4 (bornes à
// valider par un enseignant), D5 (pas de chronomètre), D10 (10 points).

import { createRandom } from './wordSearchGenerator.js'
import { newSeed, isValidSeed } from './wordSearchGame.js'
import { mathClassSettings } from '../data/reglages-maths.js'

export { newSeed, isValidSeed }

export const OPERATIONS = Object.freeze(['add', 'mul'])

// D10 (2026-10-11) : 10 points par réponse. Décision d'Isaac du 2026-11-03 :
// 10 points par case cachée trouvée par l'élève, même après une erreur ; après
// TRIES_BEFORE_ANSWER essais faux sur une case, « Voir la réponse » est proposé :
// la case montrée ne rapporte pas de points. Les erreurs et les cases montrées
// sont gardées dans dibieProgress (isCorrect: false).
export const POINTS_PER_CELL = 10
export const TRIES_BEFORE_ANSWER = 3

// Points d'une partie : seules les cases trouvées par l'élève comptent
export const pyramidScore = (cellsFound) => cellsFound * POINTS_PER_CELL

// « Voir la réponse » est proposé après TRIES_BEFORE_ANSWER essais faux
export const canShowAnswer = (wrongTries) => wrongTries >= TRIES_BEFORE_ANSWER

// CHOIX PROVISOIRE (hypothèse, à valider par un enseignant) : 3 pyramides par partie
export const PYRAMIDS_PER_GAME = 3

// Réglages par tranche. CHOIX PROVISOIRES, hypothèses des fiches M2 et M3
// (« [HYPOTHÈSE — À VÉRIFIER] »), à valider par un enseignant :
// - floors : nombre d'étages ; M2 : 3 en SIL-CP, 4 en CE1-CE2, « 4 ou 5 » en
//   CM1-CM2 (4 retenu : les grands nombres tiennent à 320 px) ; M3 : 3 en
//   CE1-CE2, « 3 ou 4 » en CM1-CM2 (3 retenu : à 4 étages, sommet ≤ 1 000 ne
//   laisse presque que des bases de 2) ;
// - hiddenBase : [min, max] de cases cachées dans la base. SIL-CP : 0 (seules
//   les cases du haut, addition directe) ; CE1-CE2 : 1 (une soustraction ou
//   une division) ; CM1-CM2 : 2 ou 3 en addition, 2 en multiplication
//   (« quelques cases dispersées données ») ;
// - maxTop (multiplicatif seulement) : M3, « sommet ne dépasse pas 100 » en
//   CE1-CE2, « proposition : 1 000 au plus » en CM1-CM2 ; toujours borné aussi
//   par le plus grand nombre de la classe.
// Sommet additif = plus grand nombre de la classe (reglages-maths.js), et NON
// les hypothèses de la fiche M2 (« jusqu'à 10 puis 20 » en SIL-CP, « 100, puis
// 1 000 » en CE1-CE2) : décision d'Isaac du 2026-11-03, fondée sur les livres
// d'exercices de ces classes (information déclarée par Isaac, livres non
// consultés), à confirmer par un enseignant (D4).
// Nombre de cases cachées : le reste de la pyramide (3 sur 6 à 3 étages,
// 6 sur 10 à 4 étages), puisque n cases sont données.
// mul: null : pas de pyramide multiplicative (M3 : « pas au niveau 1 »).
export const PYRAMID_SETTINGS = Object.freeze({
  'SIL-CP': Object.freeze({
    add: Object.freeze({ floors: 3, hiddenBase: Object.freeze([0, 0]) }),
    mul: null
  }),
  'CE1-CE2': Object.freeze({
    add: Object.freeze({ floors: 4, hiddenBase: Object.freeze([1, 1]) }),
    mul: Object.freeze({ floors: 3, hiddenBase: Object.freeze([1, 1]), maxTop: 100 })
  }),
  'CM1-CM2': Object.freeze({
    add: Object.freeze({ floors: 4, hiddenBase: Object.freeze([2, 3]) }),
    mul: Object.freeze({ floors: 3, hiddenBase: Object.freeze([2, 2]), maxTop: 1000 })
  })
})

// Au plus un 1 dans la base multiplicative (M3 : « le 1 est limité »). CHOIX PROVISOIRE.
export const MAX_ONES = 1

// Plus petite valeur d'une case de la base additive. CHOIX PROVISOIRE : pas de 0,
// qui rend une case égale à sa voisine (calcul inutile).
export const MIN_ADD_BASE = 1

// Nombre maximal de bases tirées pour une pyramide avant d'abandonner (jamais
// atteint sur les séries de graines testées)
const MAX_BASE_TRIES = 500

// --- Géométrie de la pyramide ---------------------------------------------

export const cellCount = (floors) => (floors * (floors + 1)) / 2
export const cellIndex = (row, col) => (row * (row + 1)) / 2 + col

export function cellPosition(index) {
  let row = 0
  while (cellIndex(row + 1, 0) <= index) row++
  return { row, col: index - cellIndex(row, 0) }
}

// Triangles (case, gauche, droite) : la case repose sur gauche et droite
function triangles(floors) {
  const list = []
  for (let row = 0; row < floors - 1; row++) {
    for (let col = 0; col <= row; col++) {
      list.push([cellIndex(row, col), cellIndex(row + 1, col), cellIndex(row + 1, col + 1)])
    }
  }
  return list
}

const combine = (operation, a, b) => (operation === 'add' ? a + b : a * b)

// Toutes les cases à partir de la base
export function buildPyramid(base, operation) {
  const floors = base.length
  const values = new Array(cellCount(floors))
  base.forEach((v, col) => { values[cellIndex(floors - 1, col)] = v })
  for (let row = floors - 2; row >= 0; row--) {
    for (let col = 0; col <= row; col++) {
      values[cellIndex(row, col)] = combine(operation, values[cellIndex(row + 1, col)], values[cellIndex(row + 1, col + 1)])
    }
  }
  return values
}

// --- Opérations permises ---------------------------------------------------

// Un calcul est permis s'il ne dépasse pas ce que la classe sait faire :
// multiplier ou diviser par un nombre au plus égal à maxOperand (null : pas de
// limite). L'addition et la soustraction sont toujours permises (nombres de la
// classe, résultat jamais négatif).
function allowed(operation, op, a, b, maxOperand) {
  if (operation === 'add' || maxOperand === null || maxOperand === undefined) return true
  if (op === '×') return Math.min(a, b) <= maxOperand
  return b <= maxOperand // ÷ : b est le diviseur
}

// Calcul qui donne une case à partir d'un triangle : { op, a, b, inputs, value }
// ou null s'il n'est pas faisable (case d'entrée inconnue, résultat négatif ou
// division non exacte, opération non permise).
function deduce(operation, values, target, [top, left, right], maxOperand) {
  const known = (i) => values[i] !== null && values[i] !== undefined
  let step = null
  if (target === top && known(left) && known(right)) {
    step = { op: operation === 'add' ? '+' : '×', a: values[left], b: values[right], inputs: [left, right] }
    step.value = combine(operation, step.a, step.b)
  } else if (target !== top && known(top)) {
    const sibling = target === left ? right : left
    if (!known(sibling)) return null
    const p = values[top]
    const s = values[sibling]
    if (operation === 'add') {
      if (p - s < 0) return null
      step = { op: '−', a: p, b: s, inputs: [top, sibling], value: p - s }
    } else {
      if (s === 0 || p % s !== 0) return null
      step = { op: '÷', a: p, b: s, inputs: [top, sibling], value: p / s }
    }
  }
  if (step === null || !allowed(operation, step.op, step.a, step.b, maxOperand)) return null
  return step
}

// Résolution complète à partir des cases données (tableau de même longueur que
// la pyramide, null pour une case cachée). Déduit les cases une à une tant que
// c'est possible ; chaque déduction est forcée, donc si toutes les cases sont
// trouvées, la solution est unique. Renvoie { values, steps } ou null si la
// pyramide ne peut pas être entièrement résolue avec les opérations permises.
// steps : dans l'ordre, { cell, op, a, b, inputs, value }.
export function solvePyramid(floors, operation, known, { maxOperand = null } = {}) {
  const values = known.map(v => (v === undefined ? null : v))
  const steps = []
  const list = triangles(floors)
  let progress = true
  while (progress) {
    progress = false
    for (const tri of list) {
      for (const target of tri) {
        if (values[target] !== null) continue
        const step = deduce(operation, values, target, tri, maxOperand)
        if (step === null) continue
        values[target] = step.value
        steps.push({ cell: target, ...step })
        progress = true
      }
    }
  }
  return values.every(v => v !== null) ? { values, steps } : null
}

// --- Réglages d'une partie -------------------------------------------------

// Réglages effectifs d'une pyramide pour une classe et une opération, ou null
// si l'opération n'est pas proposée dans cette classe.
export function pyramidSettings(className, subsystem, operation) {
  const cls = mathClassSettings(className, subsystem)
  if (!cls || !OPERATIONS.includes(operation)) return null
  const level = PYRAMID_SETTINGS[cls.level]?.[operation]
  if (!level) return null
  if (operation === 'add') {
    return { ...level, operation, className, subsystem, level: cls.level, maxTop: cls.maxNumber, maxOperand: null, factors: null }
  }
  const factors = cls.tables.filter(f => f > 0)
  if (factors.filter(f => f > 1).length < 2) return null
  return {
    ...level,
    operation,
    className,
    subsystem,
    level: cls.level,
    maxTop: Math.min(level.maxTop, cls.maxNumber),
    maxOperand: cls.maxOperand,
    factors
  }
}

// Opérations proposées dans une classe
export const availableOperations = (className, subsystem) =>
  OPERATIONS.filter(op => pyramidSettings(className, subsystem, op) !== null)

// --- Génération -----------------------------------------------------------

const randomInt = (random, min, max) => min + Math.floor(random() * (max - min + 1))

// Base additive : chaque case entre MIN_ADD_BASE et un maximum, sommet ≤ maxTop.
// Tirage au hasard puis rejet ; repli sûr (maximum réduit pour que le sommet
// ne puisse pas dépasser la limite) après 200 rejets.
function drawAddBase(settings, random) {
  const { floors, maxTop } = settings
  const top = (base) => buildPyramid(base, 'add')[0]
  const wide = Math.max(MIN_ADD_BASE, Math.floor(maxTop / (floors - 1)))
  for (let t = 0; t < 200; t++) {
    const base = Array.from({ length: floors }, () => randomInt(random, MIN_ADD_BASE, wide))
    if (top(base) <= maxTop) return base
  }
  const safe = Math.max(MIN_ADD_BASE, Math.floor(maxTop / 2 ** (floors - 1)))
  return Array.from({ length: floors }, () => randomInt(random, MIN_ADD_BASE, safe))
}

// Toutes les bases multiplicatives valides d'une classe (facteurs de ses
// tables, au plus MAX_ONES fois le 1, sommet ≤ maxTop), dans un ordre fixe
const mulBasesCache = new Map()
export function multiplicativeBases(settings) {
  const key = `${settings.floors}|${settings.maxTop}|${settings.factors.join(',')}`
  if (mulBasesCache.has(key)) return mulBasesCache.get(key)
  const bases = []
  const walk = (prefix) => {
    if (prefix.length === settings.floors) {
      if (prefix.filter(f => f === 1).length <= MAX_ONES && buildPyramid(prefix, 'mul')[0] <= settings.maxTop) {
        bases.push([...prefix])
      }
      return
    }
    for (const f of settings.factors) walk([...prefix, f])
  }
  walk([])
  mulBasesCache.set(key, bases)
  return bases
}

// Combinaisons de k éléments parmi 0..n-1, dans l'ordre lexicographique
function combinations(n, k) {
  const out = []
  const walk = (start, chosen) => {
    if (chosen.length === k) { out.push([...chosen]); return }
    for (let i = start; i < n; i++) walk(i + 1, [...chosen, i])
  }
  walk(0, [])
  return out
}

// Choix des cases données pour une base : exactement `floors` cases, nombre de
// cases cachées dans la base dans [min, max], résolution complète avec les
// opérations permises. Renvoie la liste des choix valides (indices des cases données).
export function validGivenSets(values, settings) {
  const { floors, operation, hiddenBase: [minHidden, maxHidden], maxOperand } = settings
  const total = cellCount(floors)
  const baseStart = cellIndex(floors - 1, 0)
  return combinations(total, floors).filter(given => {
    const givenInBase = given.filter(i => i >= baseStart).length
    const hiddenInBase = floors - givenInBase
    if (hiddenInBase < minHidden || hiddenInBase > maxHidden) return false
    const known = values.map((v, i) => (given.includes(i) ? v : null))
    return solvePyramid(floors, operation, known, { maxOperand }) !== null
  })
}

// Prépare une partie. Même graine + même classe + même sous-système + même
// opération = même partie. Lance une RangeError si l'opération n'est pas
// proposée dans cette classe ou si la graine est invalide.
// Renvoie { seed, operation, className, subsystem, level, floors, maxTop, pyramids }.
// Chaque pyramide : { values, given (booléens), hidden (indices), steps, top }.
export function createPyramidGame({ className, subsystem, operation, seed, count = PYRAMIDS_PER_GAME }) {
  const settings = pyramidSettings(className, subsystem, operation)
  if (!settings) throw new RangeError(`createPyramidGame : opération ${operation} non proposée en ${className} (${subsystem})`)
  if (!isValidSeed(seed)) throw new RangeError('createPyramidGame : graine invalide')
  const random = createRandom(seed)
  const bases = operation === 'mul' ? multiplicativeBases(settings) : null
  if (bases !== null && bases.length === 0) throw new RangeError(`createPyramidGame : aucune base possible en ${className}`)

  const pyramids = []
  const seen = new Set()
  for (let t = 0; pyramids.length < count && t < MAX_BASE_TRIES; t++) {
    const base = bases ? bases[Math.floor(random() * bases.length)] : drawAddBase(settings, random)
    const key = base.join(',')
    if (seen.has(key)) continue
    const values = buildPyramid(base, operation)
    if (values[0] > settings.maxTop) continue // contrôle du sommet avant affichage
    const choices = validGivenSets(values, settings)
    if (choices.length === 0) continue
    const givenSet = choices[Math.floor(random() * choices.length)]
    const given = values.map((_, i) => givenSet.includes(i))
    const { steps } = solvePyramid(settings.floors, operation, values.map((v, i) => (given[i] ? v : null)), { maxOperand: settings.maxOperand })
    seen.add(key)
    pyramids.push({ values, given, hidden: steps.map(s => s.cell), steps, top: values[0] })
  }
  if (pyramids.length < count) throw new RangeError(`createPyramidGame : partie impossible en ${className} (${operation})`)
  return {
    seed,
    operation,
    className,
    subsystem,
    level: settings.level,
    floors: settings.floors,
    maxTop: settings.maxTop,
    pyramids
  }
}

// --- Pendant la partie ------------------------------------------------------

// Aide pour une case fausse : les deux cases dont elle dépend, avec le calcul
// (« 5 + 4 = ? », « 12 − 5 = ? », « 3 × 4 = ? », « 12 ÷ 3 = ? »). `shown` :
// tableau de booléens, vrai pour une case visible (donnée ou déjà trouvée).
// Choisit d'abord un calcul dont les deux cases sont visibles et permis dans
// la classe ; sinon, celui de la résolution, avec known: false (il faut
// d'abord trouver une des deux cases).
// Renvoie { op, inputs: [i, j], a, b, known }.
export function cellHint(pyramid, cell, shown, { floors, operation, maxOperand = null }) {
  const values = pyramid.values.map((v, i) => (shown[i] ? v : null))
  values[cell] = null
  for (const tri of triangles(floors)) {
    if (!tri.includes(cell)) continue
    const step = deduce(operation, values, cell, tri, maxOperand)
    if (step) return { op: step.op, inputs: step.inputs, a: step.a, b: step.b, known: true }
  }
  const step = pyramid.steps.find(s => s.cell === cell)
  return { op: step.op, inputs: step.inputs, a: pyramid.values[step.inputs[0]], b: pyramid.values[step.inputs[1]], known: false }
}

// Identifiant d'une case pour dibieProgress (itemId) : assez pour retrouver la
// case, la partie se reproduisant par son numéro
export const pyramidCellId = (game, pyramidIndex, cell) =>
  `${game.operation}:${game.subsystem}:${game.className}:${game.seed}:${pyramidIndex}:${cell}`

// Groupes de trois chiffres d'un nombre écrit en chiffres, de gauche à droite
// (« 380359238 » → ['380', '359', '238'] ; « 38035 » → ['38', '035']).
// Sert à l'affichage groupé par milliers, aussi pendant la saisie.
export function digitGroups(text) {
  const s = String(text)
  const groups = []
  for (let end = s.length; end > 0; end -= 3) groups.unshift(s.slice(Math.max(0, end - 3), end))
  return groups
}

// Nombre de chiffres de la plus grande réponse possible (pour le pavé numérique)
export const maxDigits = (game) => String(game.maxTop).length
