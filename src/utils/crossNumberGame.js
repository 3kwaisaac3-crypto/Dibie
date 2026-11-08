// Nombres croisés (fiche M1 du catalogue des jeux v0.2, moteur F) — lot A de
// la phase 5 : générateur et vérificateur, SANS interface. Module pur : aucun
// accès au stockage ni à l'interface.
//
// Source des règles : DIBIE/pedagogie/cadrage-phase5-nombres-croises-v0.1.md
// (dépôt JARVIS), décisions P1 à P12 validées par Isaac le 2026-11-08 :
// - P2 a : classes CP / Class 2 à CM2 / Class 6 ; SIL et Class 1 refusés ;
// - P3 a : gabarits fixes par classe, validés par programme (crossNumberGrid.js
//   et crossNumberGame.test.js), utilisés avec leurs 8 symétries, remplis
//   chiffre par chiffre par retour arrière ;
// - P4 a : tailles du §4.1 (3 × 3 à 7 × 7) ; nombres limités par la grille et
//   par maxNumber ;
// - P5 a : types de définitions du §4.3, champ `operations` de
//   src/data/reglages-maths.js (provisoire, D4) ;
// - P6 a : définitions fermées seulement (crossNumberDefinitions.js) ;
// - P12 a : même graine + même classe + même sous-système = même grille ; la
//   langue ne change que le texte (les deux textes sont produits) ; si aucune
//   grille valide n'est obtenue, aucune grille n'est rendue (CrossNumberError).
//
// Règles de qualité du §5 : toutes contrôlées par verifyCrossNumberGame, qui
// est exécuté sur chaque grille avant qu'elle soit rendue.

import { createRandom } from './wordSearchGenerator.js'
import { newSeed, isValidSeed } from './wordSearchGame.js'
import { shuffled } from './anagramGame.js'
import { mathClassSettings } from '../data/reglages-maths.js'
import { analyzeTemplate, applySymmetry, parseTemplate, templateEntries, SYMMETRY_COUNT } from './crossNumberGrid.js'
import {
  definitionContext,
  definitionOptions,
  canDefine,
  checkDefinition,
  evaluateDefinition,
  definitionTexts,
  isTableProduct
} from './crossNumberDefinitions.js'

export { newSeed, isValidSeed }

// Gabarits par taille. Trouvés par une recherche automatique (hors du dépôt)
// puis choisis par le developer ; leur validité pour chaque classe est
// contrôlée par analyzeTemplate et par les tests (au moins une grille obtenue
// pour chaque gabarit, chaque symétrie et chaque classe qui l'utilise).
// CHOIX PROVISOIRE : nombre et forme des gabarits (cadrage §9, point 7).
// weight : poids du tirage (1 par défaut). En 3 × 3, correction d'Isaac du
// 2026-11-08 : le carré et l'escalier (chaque nombre en croise un autre, grille
// d'un seul tenant) sont privilégiés ; les « deux coins » (deux morceaux, 2
// cases croisées sur 6) restent possibles une fois sur cinq, pour garder la
// seule forme à 6 cases.
export const CROSS_NUMBER_TEMPLATES = Object.freeze({
  3: Object.freeze([
    // Deux coins en « L » (essai 3 × 3 CP du developer : 4 nombres, 6 cases)
    Object.freeze({ id: 'T3-coins', rows: Object.freeze(['..#', '.#.', '#..']), weight: 1 }),
    // Carré 2 × 2 : 4 nombres, chaque case croisée (affiché au lot B comme une
    // grille 2 × 2 sans cadre)
    Object.freeze({ id: 'T3-carre', rows: Object.freeze(['..#', '..#', '###']), weight: 2 }),
    // Escalier : 4 nombres, 5 cases, d'un seul tenant
    Object.freeze({ id: 'T3-escalier', rows: Object.freeze(['##.', '#..', '..#']), weight: 2 })
  ]),
  4: Object.freeze([
    Object.freeze({ id: 'T4-a', rows: Object.freeze(['#...', '..#.', '...#', '.#..']) }),
    Object.freeze({ id: 'T4-b', rows: Object.freeze(['#...', '..#.', '.#..', '...#']) }),
    Object.freeze({ id: 'T4-c', rows: Object.freeze(['##..', '#...', '...#', '..##']) })
  ]),
  5: Object.freeze([
    Object.freeze({ id: 'T5-a', rows: Object.freeze(['#....', '...#.', '....#', '..#..', '.#...']) }),
    Object.freeze({ id: 'T5-b', rows: Object.freeze(['.#...', '...#.', '#....', '....#', '..#..']) }),
    Object.freeze({ id: 'T5-c', rows: Object.freeze(['###..', '#....', '...##', '.#...', '..#..']) })
  ]),
  6: Object.freeze([
    Object.freeze({ id: 'T6-a', rows: Object.freeze(['#.....', '....#.', '...#..', '..#...', '.#....', '.....#']) }),
    Object.freeze({ id: 'T6-b', rows: Object.freeze(['#..#..', '...#..', '..#..#', '#...##', '...#..', '.#....']) }),
    // Avec des nombres de 6 chiffres : CM1 seulement
    Object.freeze({ id: 'T6-c', rows: Object.freeze(['##....', '......', '..#..#', '##..##', '......', '..##..']) })
  ]),
  7: Object.freeze([
    Object.freeze({ id: 'T7-a', rows: Object.freeze(['.#.....', '.....#.', '...#...', '......#', '#......', '..#....', '....#..']) }),
    Object.freeze({ id: 'T7-b', rows: Object.freeze(['#..##..', '...#...', '..#..##', '.#..#..', '....#..', '..#...#', '..#....']) }),
    // Avec un nombre de 7 chiffres : CM2 seulement
    Object.freeze({ id: 'T7-c', rows: Object.freeze(['##..#..', '.......', '..#..##', '##..#..', '#..#...', '..#....', '....#..']) })
  ])
})

// Réglages par classe (cadrage §4.1, décision P4 a). PROVISOIRES (D4) :
// size = côté de la grille ; minDigits, maxDigits = chiffres par nombre.
// Corrections d'Isaac du 2026-11-08 (après lecture de l'échantillon) :
// - minTerm : chaque terme d'une addition et chaque nombre retiré d'une
//   soustraction vaut au moins 10 à partir du CE1 et de Class 3 ;
// - maxQuotientDigits : quotient d'au plus 4 chiffres au CM1 et en Class 5,
//   d'au plus 5 chiffres au CM2 et en Class 6 ;
// - tablesPerGrid : [min, max] produits des tables par grille (au moins 2 en
//   Class 3-4, au plus 2 au CM et en Class 5-6 ; null = sans limite) ;
// - featureTimes50 : un nombre de la grille est préparé pour « × 50 » ou
//   « × 500 » (CM1, CM2), voir planRequirements.
// Classes absentes (SIL, Class 1) : jeu non proposé (P2 a).
const setting = (size, minDigits, maxDigits, extra = {}) => Object.freeze({
  size,
  minDigits,
  maxDigits,
  minTerm: 1,
  maxQuotientDigits: null,
  tablesPerGrid: Object.freeze([0, null]),
  featureTimes50: false,
  ...extra
})
const ce = { minTerm: 10 }
const ceTables = { minTerm: 10, tablesPerGrid: Object.freeze([2, null]) }
const cm = (maxQuotientDigits, featureTimes50) => ({ minTerm: 10, maxQuotientDigits, tablesPerGrid: Object.freeze([0, 2]), featureTimes50 })
export const CROSS_NUMBER_SETTINGS = Object.freeze({
  fr: Object.freeze({
    CP: setting(3, 2, 2),
    CE1: setting(4, 2, 3, ce),
    CE2: setting(5, 2, 4, ce),
    CM1: setting(6, 2, 6, cm(4, true)),
    CM2: setting(7, 2, 7, cm(5, true))
  }),
  en: Object.freeze({
    'Class 2': setting(3, 2, 2),
    'Class 3': setting(4, 2, 3, ceTables),
    'Class 4': setting(5, 2, 4, ceTables),
    'Class 5': setting(6, 2, 5, cm(4, false)),
    'Class 6': setting(7, 2, 6, cm(5, false))
  })
})

// Règles communes à toutes les classes (corrections d'Isaac du 2026-11-08) :
// au plus 40 % de divisions par grille (arrondi à l'entier inférieur) ; au
// plus 3 divisions par un nombre de 2 chiffres par grille ; multiplication
// (type mul) par un nombre de 2 chiffres : multiplicande d'au plus 4 chiffres.
export const MAX_DIVISION_SHARE = 0.4
export const MAX_TWO_DIGIT_DIVISIONS = 3
export const MAX_TWO_DIGIT_MULTIPLICAND = 9999

// Modèle des mots mêlés (décision du 2026-10-06) : 20 essais au plus ; chaque
// essai = un gabarit et une symétrie tirés au hasard, puis un remplissage
// limité à MAX_FILL_NODES nœuds de recherche.
export const MAX_ATTEMPTS = 20
export const MAX_FILL_NODES = 20000

// Une grille de 4 nombres ou plus mélange au moins deux types de définitions
export const MIN_ENTRIES_FOR_MIX = 4

// Erreur explicite : aucune grille n'est rendue (P12 a, cadrage §5 règle 8).
// code : 'not-playable' (classe non proposée), 'invalid-seed',
// 'generation-failed' (aucune grille valide après MAX_ATTEMPTS essais).
export class CrossNumberError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'CrossNumberError'
    this.code = code
  }
}

// --- Réglages ----------------------------------------------------------------

// Gabarits utilisables par une classe : ceux de sa taille, valides pour ses
// nombres de chiffres
function templatesFor(size, minDigits, maxDigits) {
  return (CROSS_NUMBER_TEMPLATES[size] ?? []).filter(t =>
    analyzeTemplate(t.rows, { minDigits, maxDigits }).errors.length === 0)
}

// Réglages complets d'une classe, ou null si le jeu n'y est pas proposé.
export function crossNumberSettings(className, subsystem) {
  const cls = mathClassSettings(className, subsystem)
  const own = CROSS_NUMBER_SETTINGS[subsystem]?.[className]
  if (!cls || !own || !Array.isArray(cls.operations) || cls.operations.length === 0) return null
  return {
    className,
    subsystem,
    level: cls.level,
    size: own.size,
    minDigits: own.minDigits,
    maxDigits: own.maxDigits,
    maxNumber: cls.maxNumber,
    tables: cls.tables,
    maxOperand: cls.maxOperand,
    operations: cls.operations,
    minTerm: own.minTerm,
    maxQuotientDigits: own.maxQuotientDigits,
    maxTwoDigitMultiplicand: MAX_TWO_DIGIT_MULTIPLICAND,
    minTables: own.tablesPerGrid[0],
    maxTables: own.tablesPerGrid[1],
    featureTimes50: own.featureTimes50,
    templates: templatesFor(own.size, own.minDigits, own.maxDigits)
  }
}

export const isCrossNumberPlayable = (className, subsystem) => crossNumberSettings(className, subsystem) !== null

// Classes où le jeu est proposé, par sous-système
export const crossNumberClasses = (subsystem) => Object.keys(CROSS_NUMBER_SETTINGS[subsystem] ?? {})

// --- Remplissage -------------------------------------------------------------

const DIGITS = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

// Remplit un gabarit chiffre par chiffre (ordre de lecture) par retour arrière.
// Contraintes : aucun nombre ne commence par 0 ; chaque nombre ≤ maxNumber
// (contrôlé dès le début du nombre) ; chaque nombre complet a au moins une
// définition fermée valide ; deux nombres de la grille sont toujours différents
// (CHOIX PROVISOIRE) ; requirements (Map id → { predicate }) : condition
// supplémentaire sur certains nombres (voir planRequirements). Renvoie
// { digits (grille, null = case noire), nodes } ou { digits: null, nodes } si
// la limite de nœuds est atteinte.
export function fillTemplate(rows, settings, random, { maxNodes = MAX_FILL_NODES, requirements = null } = {}) {
  const white = parseTemplate(rows)
  const n = white.length
  const entries = templateEntries(rows)
  const ctx = definitionContext(settings)
  const grid = white.map(r => r.map(w => (w ? -1 : null)))
  const cellEntries = new Map()
  for (const e of entries) {
    e.cells.forEach(([r, c], i) => {
      const key = r * n + c
      if (!cellEntries.has(key)) cellEntries.set(key, [])
      cellEntries.get(key).push({ entry: e, index: i })
    })
  }
  // Chiffres imposés par les nombres préparés (requirements[].tail : derniers
  // chiffres, ex. [5, 0] pour un multiple de 50)
  const fixed = new Map()
  for (const e of entries) {
    const tail = requirements?.get(e.id)?.tail
    if (!tail) continue
    tail.forEach((d, i) => {
      const [r, c] = e.cells[e.length - tail.length + i]
      fixed.set(r * n + c, d)
    })
  }
  const order = []
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (white[r][c]) order.push([r, c])
  const defineCache = new Map()
  const definable = (value) => {
    if (!defineCache.has(value)) defineCache.set(value, canDefine(value, ctx))
    return defineCache.get(value)
  }
  const used = new Map() // valeur → nombre d'entrées complètes qui l'ont
  let nodes = 0

  const readValue = (entry, upTo) => {
    let v = 0
    for (let i = 0; i <= upTo; i++) v = v * 10 + grid[entry.cells[i][0]][entry.cells[i][1]]
    return v
  }

  const fits = (r, c, digit) => {
    const completed = []
    for (const { entry, index } of cellEntries.get(r * n + c) ?? []) {
      if (index === 0 && digit === 0) return false
      const prefix = readValue(entry, index)
      // Plus petit nombre possible avec ce début : préfixe suivi de zéros
      if (prefix * 10 ** (entry.length - 1 - index) > ctx.maxNumber) return false
      if (index === entry.length - 1) {
        if (!definable(prefix) || used.has(prefix) || completed.includes(prefix)) return false
        const req = requirements?.get(entry.id)
        if (req && !req.predicate(prefix)) return false
        completed.push(prefix)
      }
    }
    return true
  }
  const mark = (r, c, delta) => {
    for (const { entry, index } of cellEntries.get(r * n + c) ?? []) {
      if (index !== entry.length - 1) continue
      const v = readValue(entry, index)
      const count = (used.get(v) ?? 0) + delta
      if (count <= 0) used.delete(v); else used.set(v, count)
    }
  }

  const walk = (k) => {
    if (k === order.length) return true
    if (nodes >= maxNodes) return false
    const [r, c] = order[k]
    const fixedDigit = fixed.get(r * n + c)
    for (const d of (fixedDigit === undefined ? shuffled(DIGITS, random) : [fixedDigit])) {
      nodes++
      grid[r][c] = d
      if (fits(r, c, d)) {
        mark(r, c, +1)
        if (walk(k + 1)) return true
        mark(r, c, -1)
      }
      grid[r][c] = -1
      if (nodes >= maxNodes) return false
    }
    return false
  }
  const ok = walk(0)
  return { digits: ok ? grid.map(row => [...row]) : null, nodes }
}

// --- Définitions ---------------------------------------------------------------

// Nombres « préparés » d'une grille (corrections d'Isaac du 2026-11-08),
// choisis avant le remplissage, qui doit les respecter :
// - Class 3-4 (minTables = 2) : minTables nombres de 2 chiffres tirés au
//   hasard doivent être des produits des tables de la classe ; leur définition
//   est un produit des tables. S'il n'y a pas assez de nombres de 2 chiffres,
//   l'essai échoue (autre gabarit).
// - CM1, CM2 (featureTimes50) : un nombre d'au moins 3 chiffres, tiré au
//   hasard parmi ceux dont les deux derniers chiffres ne commencent aucun autre
//   nombre (un 0 y serait un 0 en tête), doit être un multiple de 50 : ses
//   deux derniers chiffres sont fixés d'avance à « 00 » ou « 50 » (au hasard),
//   ce qui évite de longues recherches ; sa définition est « × 50 » ou
//   « × 500 ». Sans nombre possible, rien n'est imposé (règle souple : « doit
//   pouvoir apparaître »).
// Renvoie Map(id → { predicate, type, filter, prefer?, tail? }) ou null si l'essai est impossible.
export function planRequirements(rows, settings, random) {
  const ctx = definitionContext(settings)
  const entries = templateEntries(rows)
  const requirements = new Map()
  if (settings.minTables > 0) {
    const eligible = shuffled(entries.filter(e => e.length === 2), random)
    if (eligible.length < settings.minTables) return null
    for (const e of eligible.slice(0, settings.minTables)) {
      requirements.set(e.id, {
        predicate: (n) => definitionOptions('mulTable', n, ctx).length > 0,
        type: 'mulTable',
        filter: null
      })
    }
  }
  if (settings.featureTimes50 && ctx.operations.includes('times5')) {
    const starts = new Set(entries.map(e => e.cells[0].join(',')))
    const eligible = entries.filter(e => e.length >= 3 && !requirements.has(e.id) &&
      e.cells.slice(-2).every(cell => !starts.has(cell.join(','))))
    if (eligible.length > 0) {
      const e = eligible[Math.floor(random() * eligible.length)]
      const filter = (d) => d.operands[1] >= 50
      requirements.set(e.id, {
        predicate: (n) => n % 50 === 0 && definitionOptions('times5', n, ctx).some(filter),
        type: 'times5',
        filter,
        prefer: (d) => d.operands[1] === 500,
        tail: random() < 0.5 ? [0, 0] : [5, 0]
      })
    }
  }
  return requirements
}

// Choisit une définition pour chaque nombre. Les nombres préparés
// (requirements) reçoivent d'abord leur type imposé. Ensuite, mélange des
// types (cadrage §4.3) : parmi les types possibles pour le nombre, le moins
// employé jusque-là dans la grille, à égalité au hasard ; nombres traités dans
// l'ordre de la grille (horizontaux puis verticaux). Limites par grille :
// divisions (MAX_DIVISION_SHARE, type div seulement), divisions par un nombre
// de 2 chiffres (MAX_TWO_DIGIT_DIVISIONS), produits des tables (maxTables,
// comptés avec isTableProduct : toute multiplication de deux facteurs de 2 à 10). Aucun opérande
// n'est égal à la réponse d'un autre nombre de la grille. Renvoie null si un
// nombre ne peut pas recevoir de définition (l'essai échoue).
function chooseDefinitions(answers, ids, ctx, settings, requirements, random) {
  const counts = new Map(ctx.operations.map(t => [t, 0]))
  const divMax = Math.floor(MAX_DIVISION_SHARE * answers.length)
  let twoDigitDivisions = 0
  let tableProducts = 0
  const result = new Array(answers.length).fill(null)
  const excludeFor = (i) => new Set(answers.filter((_, j) => j !== i))
  const take = (i, def) => {
    counts.set(def.type, counts.get(def.type) + 1)
    if (def.type === 'div' && def.operands[1] >= 10) twoDigitDivisions++
    if (isTableProduct(def)) tableProducts++
    result[i] = def
  }
  for (let i = 0; i < answers.length; i++) {
    const req = requirements?.get(ids[i])
    if (!req) continue
    let options = definitionOptions(req.type, answers[i], ctx, random, excludeFor(i)).filter(d => !req.filter || req.filter(d))
    if (options.length === 0) return null
    // × 500 préféré à × 50 quand il est possible (sinon presque jamais vu)
    if (req.prefer) options = options.filter(req.prefer).length > 0 ? options.filter(req.prefer) : options
    take(i, options[Math.floor(random() * options.length)])
  }
  for (let i = 0; i < answers.length; i++) {
    if (result[i]) continue
    const byType = new Map()
    for (const type of ctx.operations) {
      if (type === 'div' && counts.get('div') >= divMax) continue
      let options = definitionOptions(type, answers[i], ctx, random, excludeFor(i))
      if (type === 'div' && twoDigitDivisions >= MAX_TWO_DIGIT_DIVISIONS) options = options.filter(d => d.operands[1] < 10)
      // Limite des produits des tables : toute multiplication de deux facteurs de 2 à 10
      if (settings.maxTables !== null && tableProducts >= settings.maxTables) options = options.filter(d => !isTableProduct(d))
      if (options.length > 0) byType.set(type, options)
    }
    if (byType.size === 0) return null
    const types = [...byType.keys()]
    const least = Math.min(...types.map(t => counts.get(t)))
    const candidates = types.filter(t => counts.get(t) === least)
    const options = byType.get(candidates[Math.floor(random() * candidates.length)])
    take(i, options[Math.floor(random() * options.length)])
  }
  return result
}

// --- Partie ------------------------------------------------------------------

// Grille complète à partir d'un gabarit rempli, ou null si un nombre ne peut
// pas recevoir de définition
function buildGame({ seed, settings, templateId, symmetry, rows, digits, attempts, nodes, requirements }, random) {
  const ctx = definitionContext(settings)
  const shapes = templateEntries(rows)
  const answers = shapes.map(e => e.cells.reduce((v, [r, c]) => v * 10 + digits[r][c], 0))
  const definitions = chooseDefinitions(answers, shapes.map(e => e.id), ctx, settings, requirements, random)
  if (!definitions) return null
  const entries = shapes.map((e, i) => ({
    ...e,
    answer: answers[i],
    definition: definitions[i],
    text: definitionTexts(definitions[i])
  }))
  return {
    seed,
    className: settings.className,
    subsystem: settings.subsystem,
    level: settings.level,
    size: settings.size,
    templateId,
    symmetry,
    rows,
    cells: digits,
    entries,
    stats: { attempts, nodes }
  }
}

// Gabarit tiré au hasard selon son poids (weight, 1 par défaut)
export function pickWeighted(templates, random) {
  const weight = (t) => t.weight ?? 1
  const total = templates.reduce((sum, t) => sum + weight(t), 0)
  let r = random() * total
  for (const t of templates) {
    r -= weight(t)
    if (r < 0) return t
  }
  return templates[templates.length - 1]
}

// Graine du tirage : numéro de partie mêlé à la classe et au sous-système
// (hachage FNV-1a du texte « sous-système:classe »). Sans ce mélange, un même
// numéro donnait des grilles qui commençaient par les mêmes chiffres dans
// toutes les classes. Même numéro + même classe + même sous-système = même
// tirage (P12 a).
export function classSeed(seed, className, subsystem) {
  let h = 0x811c9dc5
  for (const ch of `${subsystem}:${className}`) {
    h ^= ch.codePointAt(0)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return (seed ^ h) >>> 0
}

// Prépare une grille. Même graine + même classe + même sous-système = même
// grille (P12 a) ; la langue n'intervient pas : chaque définition porte ses
// textes français et anglais (entries[].text.fr / .en).
// Lance une CrossNumberError si la classe n'est pas proposée, si la graine est
// invalide ou si aucune grille valide n'est obtenue (aucune grille rendue).
// Renvoie { seed, className, subsystem, level, size, templateId, symmetry,
// rows, cells, entries, stats } ; entries[] : { id, number, direction, cells,
// length, answer, definition: { type, operands }, text: { fr, en } }.
// maxNodes : limite de nœuds par remplissage (réglable pour les tests du cas
// d'échec seulement).
export function createCrossNumberGame({ className, subsystem, seed, maxNodes = MAX_FILL_NODES }) {
  const settings = crossNumberSettings(className, subsystem)
  if (!settings) throw new CrossNumberError('not-playable', `Nombres croisés non proposés en ${className} (${subsystem})`)
  if (!isValidSeed(seed)) throw new CrossNumberError('invalid-seed', 'createCrossNumberGame : graine invalide')
  if (settings.templates.length === 0) throw new CrossNumberError('generation-failed', `Aucun gabarit valide en ${className}`)
  const random = createRandom(classSeed(seed, className, subsystem))
  let nodes = 0
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const template = pickWeighted(settings.templates, random)
    const symmetry = Math.floor(random() * SYMMETRY_COUNT)
    const rows = applySymmetry(template.rows, symmetry)
    const requirements = planRequirements(rows, settings, random)
    if (!requirements) continue
    const fill = fillTemplate(rows, settings, random, { maxNodes, requirements })
    nodes += fill.nodes
    if (!fill.digits) continue
    const game = buildGame({ seed, settings, templateId: template.id, symmetry, rows, digits: fill.digits, attempts: attempt, nodes, requirements }, random)
    // Règle 7 du §5 : grille entière vérifiée avant d'être rendue
    if (game && verifyCrossNumberGame(game).ok) return game
  }
  throw new CrossNumberError('generation-failed', `Aucune grille valide en ${className} (${subsystem}) après ${MAX_ATTEMPTS} essais`)
}

// --- Vérification ------------------------------------------------------------

// Vérification complète d'une grille (cadrage §5), indépendante du générateur :
// tout est recalculé depuis le gabarit, les chiffres et la structure des
// définitions. Renvoie { ok, errors } ; errors : [{ code, entry?, detail? }].
// Codes : 'not-playable', 'bad-size', 'template' (règle 5), 'cells' (chiffres
// manquants ou case noire remplie), 'entries' (nombres différents de ceux du
// gabarit), 'answer' (réponse différente des chiffres), 'leading-zero'
// (règle 2), 'digits' (longueur hors réglages), 'max-number' (règle 4),
// 'duplicate' (même nombre deux fois), 'definition' (règles 1, 3, 4 et 6 :
// type permis, valeur recalculée, calcul dans le programme, non trivial, ne
// contient pas la réponse), 'text' (textes FR et EN absents ou différents de
// ceux tirés de la structure), 'single-type' (une seule sorte de définition),
// 'operand-is-answer' (un opérande égal à la réponse d'un autre nombre),
// 'division-share' (plus de 40 % de divisions), 'two-digit-divisions' (plus
// de 3 divisions par un nombre de 2 chiffres), 'tables-count' (produits des
// tables hors de [minTables, maxTables] ; produit des tables = toute
// multiplication de deux facteurs de 2 à 10, quel que soit son type), 'not-a-game' (entrée qui n'est pas
// un objet).
export function verifyCrossNumberGame(game) {
  const errors = []
  if (game === null || typeof game !== 'object') return { ok: false, errors: [{ code: 'not-a-game' }] }
  const settings = crossNumberSettings(game.className, game.subsystem)
  if (!settings) return { ok: false, errors: [{ code: 'not-playable' }] }
  const { size, minDigits, maxDigits } = settings
  let white
  try {
    white = parseTemplate(game.rows)
  } catch {
    return { ok: false, errors: [{ code: 'template', detail: 'gabarit illisible' }] }
  }
  if (white.length !== size) errors.push({ code: 'bad-size', detail: `${white.length} au lieu de ${size}` })
  for (const e of analyzeTemplate(game.rows, { minDigits, maxDigits }).errors) errors.push({ code: 'template', detail: e })

  const cells = game.cells
  const cellOk = Array.isArray(cells) && cells.length === white.length && white.every((row, r) =>
    Array.isArray(cells[r]) && cells[r].length === row.length && row.every((w, c) =>
      (w ? Number.isInteger(cells[r][c]) && cells[r][c] >= 0 && cells[r][c] <= 9 : cells[r][c] === null)))
  if (!cellOk) {
    errors.push({ code: 'cells' })
    return { ok: false, errors }
  }

  const shapes = templateEntries(game.rows)
  const entries = Array.isArray(game.entries) ? game.entries : []
  const sameShape = entries.length === shapes.length && shapes.every((s, i) =>
    entries[i] !== null && typeof entries[i] === 'object' && entries[i].id === s.id && entries[i].direction === s.direction && entries[i].number === s.number &&
    JSON.stringify(entries[i].cells) === JSON.stringify(s.cells))
  if (!sameShape) {
    errors.push({ code: 'entries' })
    return { ok: false, errors }
  }

  const ctx = definitionContext(settings)
  const seen = new Map()
  const values = shapes.map(s => s.cells.reduce((v, [r, c]) => v * 10 + cells[r][c], 0))
  const counts = new Map()
  let twoDigitDivisions = 0
  let tableProducts = 0
  entries.forEach((e, i) => {
    const shape = shapes[i]
    const digits = shape.cells.map(([r, c]) => cells[r][c])
    const value = values[i]
    if (e.answer !== value) errors.push({ code: 'answer', entry: e.id })
    if (digits[0] === 0) errors.push({ code: 'leading-zero', entry: e.id })
    if (shape.length < minDigits || shape.length > maxDigits) errors.push({ code: 'digits', entry: e.id })
    if (value > settings.maxNumber) errors.push({ code: 'max-number', entry: e.id })
    if (seen.has(value)) errors.push({ code: 'duplicate', entry: e.id, detail: seen.get(value) })
    seen.set(value, e.id)
    const defErrors = checkDefinition(e.definition, value, ctx)
    if (defErrors.length > 0 || evaluateDefinition(e.definition) !== value) {
      errors.push({ code: 'definition', entry: e.id, detail: defErrors })
    }
    const expected = defErrors.includes('bad-structure') ? null : definitionTexts(e.definition)
    const textOk = expected && e.text && typeof e.text.fr === 'string' && typeof e.text.en === 'string' &&
      e.text.fr.length > 0 && e.text.en.length > 0 && e.text.fr === expected.fr && e.text.en === expected.en
    if (!textOk) errors.push({ code: 'text', entry: e.id })
    // Correction d'Isaac du 2026-11-08 : aucun opérande égal à la réponse d'un
    // autre nombre de la grille
    const operands = Array.isArray(e.definition?.operands) ? e.definition.operands : []
    if (operands.some(x => values.some((v, j) => j !== i && v === x))) errors.push({ code: 'operand-is-answer', entry: e.id })
    const type = e.definition?.type
    counts.set(type, (counts.get(type) ?? 0) + 1)
    if (type === 'div' && operands[1] >= 10) twoDigitDivisions++
    if (isTableProduct(e.definition)) tableProducts++
  })
  // Limites par grille (corrections d'Isaac du 2026-11-08)
  const divisions = counts.get('div') ?? 0
  if (divisions > Math.floor(MAX_DIVISION_SHARE * entries.length)) errors.push({ code: 'division-share', detail: divisions })
  if (twoDigitDivisions > MAX_TWO_DIGIT_DIVISIONS) errors.push({ code: 'two-digit-divisions', detail: twoDigitDivisions })
  const tables = tableProducts
  if (tables < settings.minTables || (settings.maxTables !== null && tables > settings.maxTables)) {
    errors.push({ code: 'tables-count', detail: tables })
  }
  // Mélange des types (cadrage §4.3) : CHOIX PROVISOIRE, au moins deux types
  // de définitions dans une grille de MIN_ENTRIES_FOR_MIX nombres ou plus
  const types = new Set(entries.map(e => e.definition?.type))
  if (entries.length >= MIN_ENTRIES_FOR_MIX && types.size < 2) errors.push({ code: 'single-type' })
  return { ok: errors.length === 0, errors }
}

// --- Affichage texte (échantillons, contrôle) ---------------------------------

// Grille remplie en texte : chiffres, ■ pour une case noire
export const filledGridText = (game) =>
  game.cells.map(row => row.map(d => (d === null ? '■' : String(d))).join(' ')).join('\n')

// Numéro affiché dans chaque case (null si aucun nombre n'y commence)
export function cellNumbers(game) {
  const out = game.cells.map(row => row.map(() => null))
  for (const e of game.entries) out[e.cells[0][0]][e.cells[0][1]] = e.number
  return out
}

// Grille vide numérotée en texte (cases de 4 caractères ; #### = case noire)
export function emptyGridText(game) {
  const nums = cellNumbers(game)
  const line = '+' + Array(game.size).fill('----').join('+') + '+'
  const rows = game.cells.map((row, r) => '|' + row.map((d, c) => {
    if (d === null) return '####'
    return nums[r][c] === null ? '    ' : String(nums[r][c]).padEnd(4, ' ')
  }).join('|') + '|')
  return [line, ...rows.flatMap(r => [r, line])].join('\n')
}
