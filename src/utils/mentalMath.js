// Calcul mental (fiche M6 ; phase 7, lot B : docs/calcul-mental.md). Module
// pur : aucun accès au stockage ni à l'interface.
//
// Réglages : src/data/calcul-mental.js (familles et bornes par classe, recopie
// du lot 0, PROVISOIRES). Pour une famille, on énumère tous les calculs
// distincts permis par ses formes, puis on tire les séries selon la graine :
// jamais deux fois le même calcul, et le nombre de calculs possibles est connu.

import { MENTAL_MATH_CLASSES } from '../data/calcul-mental.js'
import { createRandom } from './wordSearchGenerator.js'
import { shuffled } from './anagramGame.js'
import { isValidSeed } from './pairsGame.js'

export const FAMILY_IDS = Object.freeze(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])

// Noms à l'écran ; libellés anglais à valider par un enseignant (choix 11a)
const FAMILY_NAMES = Object.freeze({
  A: { fr: 'Additions', en: 'Additions' },
  B: { fr: 'Soustractions', en: 'Subtractions' },
  C: { fr: 'Compléments', en: 'Number bonds' },
  D: { fr: 'Doubles et moitiés', en: 'Doubles and halves' },
  E: { fr: 'Triples, quadruples, tiers, quarts', en: 'Triples, quadruples, thirds, quarters' },
  F: { fr: 'Tables', en: 'Times tables' },
  G: { fr: '× et ÷ par 10, 100, 1 000', en: '× and ÷ by 10, 100, 1,000' },
  H: { fr: 'Produits particuliers', en: 'Special products' },
  I: { fr: 'Facteur manquant', en: 'Missing factor' }
})

const lang = (language) => (language === 'en' ? 'en' : 'fr')

export const familyName = (id, language) => FAMILY_NAMES[id]?.[lang(language)] ?? ''

// Familles d'une classe, dans l'ordre A à I ([] pour une classe inconnue)
export function classFamilies(className) {
  const families = MENTAL_MATH_CLASSES[className]
  return families ? FAMILY_IDS.filter(id => families[id]) : []
}

const span = ([min, max], step = 1) => {
  const out = []
  for (let n = min; n <= max; n += step) out.push(n)
  return out
}
const TEN = 10

// Un calcul : { id, family, type, a, b, k, answer, shown } ; shown = nombres
// affichés (énoncé et réponse), pour le contrôle du plafond de la classe
function calc(family, type, { a, b = null, k = null, answer }) {
  const shown = [a, b, k, answer].filter(n => n !== null)
  return { id: `${type}:${a}:${b ?? ''}:${k ?? ''}`, family, type, a, b, k, answer, shown }
}

const underMax = (value, max) => max === undefined || value <= max

// Calculs d'une forme (voir l'en-tête de src/data/calcul-mental.js)
function formCalcs(family, form) {
  const out = []
  const push = (fields) => out.push(calc(family, form.type, fields))
  switch (form.type) {
    case 'add':
      for (const a of span(form.a)) for (const b of span(form.b)) if (underMax(a + b, form.maxResult)) push({ a, b, answer: a + b })
      break
    case 'sub':
      for (const a of span(form.a)) for (const b of span(form.b)) if (b < a) push({ a, b, answer: a - b })
      break
    case 'complement':
      if (form.targets) {
        for (const n of span(form.targets)) for (const a of span([1, n - 1])) push({ a, b: n, answer: n - a })
      } else if (form.nextTen) {
        for (const a of span(form.a)) {
          if (a % TEN === 0) continue
          const n = Math.ceil(a / TEN) * TEN
          push({ a, b: n, answer: n - a })
        }
      } else {
        for (const a of span(form.a, form.step)) push({ a, b: form.target, answer: form.target - a })
      }
      break
    case 'double':
    case 'triple':
    case 'quadruple': {
      const factor = { double: 2, triple: 3, quadruple: 4 }[form.type]
      for (const a of span(form.a)) if (underMax(a * factor, form.maxResult)) push({ a, answer: a * factor })
      break
    }
    case 'half':
    case 'third':
    case 'quarter': {
      const divisor = { half: 2, third: 3, quarter: 4 }[form.type]
      for (const a of span(form.of)) if (a % divisor === 0) push({ a, answer: a / divisor })
      break
    }
    case 'table':
      for (const a of form.tables) for (const b of span(form.b)) if (underMax(a * b, form.maxResult)) push({ a, b, answer: a * b })
      break
    case 'timesPow10':
      for (const k of form.powers) for (const a of span(form.a)) if (underMax(a * k, form.maxResult)) push({ a, k, answer: a * k })
      break
    case 'divPow10':
      for (const k of form.powers) for (const r of span(form.result)) push({ a: r * k, k, answer: r })
      break
    case 'timesK':
      for (const k of form.ks) for (const a of span(form.a)) if (underMax(a * k, form.maxResult)) push({ a, k, answer: a * k })
      break
    case 'missingFactor':
      for (const a of span(form.a)) for (const x of span(form.answer)) if (a * x <= form.maxProduct) push({ a, b: a * x, answer: x })
      break
    default:
      throw new Error(`Calcul mental : forme inconnue (${form.type})`)
  }
  return out
}

// Tous les calculs distincts d'une famille, triés par id
export function familyCalcs(className, familyId) {
  const forms = MENTAL_MATH_CLASSES[className]?.[familyId] ?? []
  const byId = new Map()
  for (const form of forms) for (const c of formCalcs(familyId, form)) if (!byId.has(c.id)) byId.set(c.id, c)
  return [...byId.values()].sort((x, y) => x.id.localeCompare(y.id))
}

// Nombres groupés par trois avec une espace insécable, dans les deux langues (M9)
const GROUP = /\B(?=(\d{3})+(?!\d))/g
export const formatNumber = (n) => String(n).replace(GROUP, ' ')

const MINUS = '−'
const WORDS = Object.freeze({
  double: { fr: 'Double de', en: 'Double of' },
  half: { fr: 'Moitié de', en: 'Half of' },
  triple: { fr: 'Triple de', en: 'Triple of' },
  third: { fr: 'Tiers de', en: 'A third of' },
  quadruple: { fr: 'Quadruple de', en: 'Quadruple of' },
  quarter: { fr: 'Quart de', en: 'A quarter of' }
})

// Énoncé affiché (docs/calcul-mental.md §6.1)
export function calcText(c, language) {
  const [a, b, k] = [c.a, c.b, c.k].map(n => (n === null ? null : formatNumber(n)))
  switch (c.type) {
    case 'add': return `${a} + ${b} = ?`
    case 'sub': return `${a} ${MINUS} ${b} = ?`
    case 'complement': return `${a} + ? = ${b}`
    case 'table': return `${a} × ${b} = ?`
    case 'timesPow10':
    case 'timesK': return `${a} × ${k} = ?`
    case 'divPow10': return `${a} ÷ ${k} = ?`
    case 'missingFactor': return `${a} × ? = ${b}`
    default: return `${WORDS[c.type][lang(language)]} ${a}`
  }
}

// --- Séries (docs/calcul-mental.md §6.2) ------------------------------------

export const GAME_TYPE_MENTAL_MATH = 'mentalMath'
// M2 : 10 calculs (fiche M6, sans source) ; moins si la famille en a moins
export const SERIES_LENGTH = 10
export const MIXED = 'mix'

// Série : classe, famille (ou MIXED), graine. RangeError si la graine est
// invalide, la classe inconnue ou la famille absente de la classe.
export function createMentalSeries(className, family, seed) {
  if (!isValidSeed(seed)) throw new RangeError('createMentalSeries : graine invalide')
  const families = classFamilies(className)
  if (families.length === 0) throw new RangeError(`Calcul mental : classe inconnue (${className})`)
  if (family !== MIXED && !families.includes(family)) throw new RangeError(`Calcul mental : famille ${family} absente de ${className}`)
  const random = createRandom(seed)
  let calcs
  if (family === MIXED) {
    // Familles mélangées, prises à tour de rôle ; dans chacune, le prochain
    // calcul de sa liste mélangée
    const order = shuffled(families, random)
    const pools = Object.fromEntries(order.map(f => [f, shuffled(familyCalcs(className, f), random)]))
    calcs = []
    for (let turn = 0; calcs.length < SERIES_LENGTH; turn++) {
      if (order.every(x => pools[x].length === 0)) break
      const next = pools[order[turn % order.length]].shift()
      if (next) calcs.push(next)
    }
  } else {
    calcs = shuffled(familyCalcs(className, family), random).slice(0, SERIES_LENGTH)
  }
  return { seed, className, family, calcs }
}

// Nombre de chiffres de la plus grande réponse (longueur de saisie)
export const maxDigits = (series) => Math.max(...series.calcs.map(c => String(c.answer).length))

// --- Réponses et points (P10, docs/calcul-mental.md §6.3) --------------------

// M4 et M5 : 10 points par calcul trouvé, même après des erreurs ; indice
// après 2 erreurs ; « Voir la réponse » après 3, et alors 0 point
export const POINTS_PER_CALC = 10
export const HINT_AFTER_ERRORS = 2
export const REVEAL_AFTER_ERRORS = 3

const PHASE_MAIN = 'main'
const PHASE_RETRY = 'retry'
const PHASE_DONE = 'done'

// État : entries = un élément par calcul tenté et par phase
// { calcId, phase, position, errors, found, revealed }
export function createMentalState(series) {
  return { phase: series.calcs.length > 0 ? PHASE_MAIN : PHASE_DONE, position: 0, retryIds: [], entries: [] }
}

const calcById = (series, id) => series.calcs.find(c => c.id === id) ?? null

export function currentCalc(series, state) {
  if (state.phase === PHASE_MAIN) return series.calcs[state.position] ?? null
  if (state.phase === PHASE_RETRY) return calcById(series, state.retryIds[state.position])
  return null
}

const sameSlot = (state) => (e) => e.phase === state.phase && e.position === state.position

export function currentEntry(state) {
  return state.entries.find(sameSlot(state)) ??
    { calcId: null, phase: state.phase, position: state.position, errors: 0, found: false, revealed: false }
}

export const isResolved = (entry) => entry.found || entry.revealed
export const showHint = (entry) => entry.errors >= HINT_AFTER_ERRORS
export const canReveal = (entry) => entry.errors >= REVEAL_AFTER_ERRORS && !isResolved(entry)
export const isRetry = (state) => state.phase === PHASE_RETRY
export const isDone = (state) => state.phase === PHASE_DONE

function withEntry(series, state, change) {
  const before = currentEntry(state)
  const entry = { ...before, calcId: currentCalc(series, state).id, ...change(before) }
  return { ...state, entries: [...state.entries.filter(e => !sameSlot(state)(e)), entry] }
}

// Saisie d'une réponse ; même objet si le calcul est résolu ou la série finie
export function submitAnswer(series, state, value) {
  const c = currentCalc(series, state)
  if (!c || isResolved(currentEntry(state))) return state
  return withEntry(series, state, e => (value === c.answer ? { found: true } : { errors: e.errors + 1 }))
}

// « Voir la réponse » ; même objet tant qu'elle n'est pas proposée
export function revealAnswer(series, state) {
  if (!currentCalc(series, state) || !canReveal(currentEntry(state))) return state
  return withEntry(series, state, () => ({ revealed: true }))
}

const mainEntries = (state) => state.entries.filter(e => e.phase === PHASE_MAIN)

// Calcul suivant (seulement une fois le calcul résolu). Fin de la série
// principale : les calculs dont la réponse a été vue reviennent une fois,
// sans points (M6), sinon fin.
export function nextCalc(series, state) {
  if (isDone(state) || !isResolved(currentEntry(state))) return state
  const position = state.position + 1
  if (state.phase === PHASE_MAIN) {
    if (position < series.calcs.length) return { ...state, position }
    const retryIds = mainEntries(state).filter(e => e.revealed).sort((x, y) => x.position - y.position).map(e => e.calcId)
    return { ...state, phase: retryIds.length > 0 ? PHASE_RETRY : PHASE_DONE, position: 0, retryIds }
  }
  if (position < state.retryIds.length) return { ...state, position }
  return { ...state, phase: PHASE_DONE, position: 0 }
}

export const foundCount = (state) => mainEntries(state).filter(e => e.found).length
export const revealedCount = (state) => mainEntries(state).filter(e => e.revealed).length
export const errorCount = (state) => mainEntries(state).reduce((n, e) => n + e.errors, 0)
export const mentalScore = (state) => foundCount(state) * POINTS_PER_CALC

// Énoncé complété, montré avec « Voir la réponse » et dans le récapitulatif
export function solvedText(c, language) {
  const text = calcText(c, language)
  const answer = formatNumber(c.answer)
  return text.includes('?') ? text.replace('?', answer) : `${text} = ${answer}`
}

// --- Indices (premier jet, à valider par un enseignant ; §6.4) --------------

const ZEROS = Object.freeze({
  10: { fr: 'un 0', en: 'one 0' },
  100: { fr: 'deux 0', en: 'two 0s' },
  1000: { fr: 'trois 0', en: 'three 0s' }
})
const HALF_BASE = Object.freeze({ 5: 10, 50: 100, 500: 1000 })
// En anglais, les milliers s'écrivent ici avec une virgule (« 1,000 ») dans
// les phrases d'indice ; les calculs gardent l'espace (M9)
const enNumber = (n) => String(n).replace(GROUP, ',')

export function calcHint(c, language) {
  const en = lang(language) === 'en'
  const [a, b, k] = [c.a, c.b, c.k].map(n => (n === null ? null : formatNumber(n)))
  switch (c.type) {
    case 'add': {
      const [big, small] = c.a >= c.b ? [a, b] : [b, a]
      return en ? `Start from the bigger number, ${big}, and count on ${small}.` : `Pars du plus grand nombre, ${big}, et avance de ${small}.`
    }
    case 'sub': return en ? `Start from ${a} and count back ${b}.` : `Pars de ${a} et recule de ${b}.`
    case 'complement': return en ? `How much do you add to ${a} to make ${b}?` : `Combien faut-il ajouter à ${a} pour arriver à ${b} ?`
    case 'double': return en ? `Double ${a} means ${a} + ${a}.` : `Le double de ${a}, c'est ${a} + ${a}.`
    case 'half': return en ? `Find the number that, added to itself, makes ${a}.` : `Cherche le nombre qui, ajouté à lui-même, donne ${a}.`
    case 'triple': return en ? `Triple ${a} means ${a} + ${a} + ${a}.` : `Le triple de ${a}, c'est ${a} + ${a} + ${a}.`
    case 'third': return en ? `Share ${a} into three equal parts.` : `Partage ${a} en trois parts égales.`
    case 'quadruple': return en ? 'Quadruple means double, then double again.' : 'Le quadruple, c’est le double du double.'
    case 'quarter': return en ? 'A quarter is half of a half.' : 'Le quart, c’est la moitié de la moitié.'
    case 'table': {
      const first = [1, 2, 3].map(i => formatNumber(c.a * i)).join(', ')
      return en ? `Count in ${a}s: ${first}…` : `Compte de ${a} en ${a} : ${first}…`
    }
    case 'timesPow10':
      return en ? `Multiplying by ${enNumber(c.k)} adds ${ZEROS[c.k].en} on the right.` : `Multiplier par ${k}, c'est écrire ${ZEROS[c.k].fr} à droite.`
    case 'divPow10':
      return en ? `Dividing by ${enNumber(c.k)} removes ${ZEROS[c.k].en} on the right.` : `Diviser par ${k}, c'est enlever ${ZEROS[c.k].fr} à droite.`
    case 'timesK':
      if (HALF_BASE[c.k]) {
        return en ? `Multiply by ${enNumber(HALF_BASE[c.k])}, then take half.` : `Multiplie par ${formatNumber(HALF_BASE[c.k])}, puis prends la moitié.`
      }
      if (c.k === 11) return en ? `${a} × 11 is ${a} × 10 + ${a}.` : `${a} × 11, c'est ${a} × 10 + ${a}.`
      if (c.k === 12) return en ? `${a} × 12 is ${a} × 10 + ${a} × 2.` : `${a} × 12, c'est ${a} × 10 + ${a} × 2.`
      return en ? `${a} × 25 is ${a} × 100, then a quarter.` : `${a} × 25, c'est ${a} × 100, puis le quart.`
    case 'missingFactor': return en ? `Say the ${a} times table until you reach ${b}.` : `Récite la table de ${a} jusqu'à trouver ${b}.`
    default: return ''
  }
}
