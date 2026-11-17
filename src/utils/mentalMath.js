// Calcul mental (fiche M6 ; phase 7, lot B : docs/calcul-mental.md). Module
// pur : aucun accès au stockage ni à l'interface.
//
// Réglages : src/data/calcul-mental.js (familles et bornes par classe, recopie
// du lot 0, PROVISOIRES). Pour une famille, on énumère tous les calculs
// distincts permis par ses formes, puis on tire les séries selon la graine :
// jamais deux fois le même calcul, et le nombre de calculs possibles est connu.

import { MENTAL_MATH_CLASSES } from '../data/calcul-mental.js'

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
