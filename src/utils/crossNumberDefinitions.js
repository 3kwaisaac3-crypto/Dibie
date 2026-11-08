// Nombres croisés (fiche M1, moteur F) — définitions FERMÉES (décision P6 a :
// pas de définition ouverte du type « un multiple de 5 »). Module pur.
//
// Méthode (cadrage de la phase 5, §4.3) : le nombre est choisi d'abord (par le
// remplissage de la grille), puis une définition fermée qui le donne par un
// calcul est écrite. Une définition fermée a une seule réponse : celle du calcul.
//
// Une définition est une STRUCTURE { type, operands } ; les textes français et
// anglais en sont tirés par definitionText (pas de traduction libre). La
// réponse est toujours recalculée depuis la structure (evaluateDefinition).
//
// Types (identifiants du champ `operations` de src/data/reglages-maths.js) :
//   add        a + b
//   sub        a − b (jamais négatif)
//   mulTable   a × b, un facteur pris dans les tables de la classe (sauf 1),
//              l'autre de 2 à 10 (« 4 × 7 »)
//   mul        a × b, b de 2 à maxOperand (« par un nombre d'un chiffre » = 9)
//   div        a ÷ b, division exacte, b de 2 à maxOperand
//   double, half, triple, third, quadruple, quarter   (« le double de 23 »…)
//   placeValue c centaines, d dizaines et u unités
//   times10    a × 10, a × 100 (CE2)
//   times5     a × 5, a × 50, a × 500 (CM1, CM2)
//   times11_12 a × 11, a × 12, a de 2 à 12 (CM2 : « quelques multiplications
//              par 11 et 12 »)
//   times25    a × 25 (CM2)
// Types ajoutés au lot C (niveau 3 et Class 4, cadrage §3 et §4.3) :
//   next       le nombre qui suit a (a + 1) ; prev : le nombre qui précède a
//              (a − 1). CHOIX PROVISOIRE : seulement pour une réponse d'au
//              moins 4 chiffres, avec une retenue (4 599 → 4 600 ; 4 600 → 4 599)
//   decomposition  décomposition par rang (« 4 centaines de mille et 3
//              unités ») ; opérandes = chiffres du nombre, du plus grand rang
//              au plus petit. CHOIX PROVISOIRE : nombre de 4 à 9 chiffres, au
//              plus 3 rangs non nuls (donc au moins un zéro à placer)
//   timesPow10 a × 10, a × 100, a × 1 000 (CM1, CM2)
//   divPow10   a ÷ 10, a ÷ 100, a ÷ 1 000, division exacte (CM1, CM2)
//   addProduct a + b × c et subProduct a − b × c (Class 4, BODMAS : la
//              multiplication d'abord) ; b × c est un produit des tables de la
//              classe et vaut au moins minTerm (10 en Class 4, décision
//              d'Isaac du 2026-11-08) ; pas de parenthèses, aucun résultat négatif
//
// Règles de qualité (cadrage §5 et corrections d'Isaac du 2026-11-08 après
// lecture de l'échantillon) contrôlées par checkDefinition :
// - calcul dans le programme : opérandes et résultat entiers, ≤ maxNumber,
//   tables et maxOperand respectés, aucun résultat négatif, divisions exactes ;
// - pas de définition triviale (+ 0, − 0, × 0, × 1, ÷ 1) ;
// - pas de définition qui contient sa réponse en chiffres : aucun opérande ne
//   contient l'écriture de la réponse (ex. « 145 − 100 » pour 45 est refusé).
//   Exceptions : placeValue et decomposition, dont les opérandes sont les
//   chiffres eux-mêmes (types prévus par le cadrage), et divPow10, dont le
//   dividende contient toujours le quotient suivi de zéros (« 45 000 ÷ 100 ») :
//   c'est la règle même de la division par 10, 100, 1 000 (programme du CM1) ;
// - réglages du contexte (corrections d'Isaac du 2026-11-08) : minTerm (chaque
//   terme d'une addition et chaque nombre retiré ≥ 10 à partir du CE1 et de
//   Class 3 ; code 'too-small') ; maxQuotientDigits (quotient d'au plus 4 ou 5
//   chiffres au CM et en Class 5-6) ; maxTwoDigitMultiplicand (type mul : par
//   un nombre de 2 chiffres, multiplicande d'au plus 4 chiffres).

// CHOIX PROVISOIRE (à valider, D4) : quand la classe n'a pas de limite écrite
// pour le nombre par lequel on multiplie ou divise (maxOperand: null), ce
// nombre est limité à 99 dans les définitions.
export const DEFAULT_OPERAND_CAP = 99

const TIMES_FACTORS = Object.freeze({
  times10: Object.freeze([10, 100]),
  times5: Object.freeze([5, 50, 500]),
  times11_12: Object.freeze([11, 12]),
  times25: Object.freeze([25]),
  timesPow10: Object.freeze([10, 100, 1000])
})
// Diviseurs de divPow10 (CM1 : « ×/÷ par 10, 100, 1 000 »)
const POW10_DIVISORS = Object.freeze([10, 100, 1000])
// Types sans contrôle « contient sa réponse » (voir l'en-tête)
const NO_REVEAL_CHECK = Object.freeze(['placeValue', 'decomposition', 'divPow10'])
// next, prev : réponse d'au moins NEXT_MIN_DIGITS chiffres (CHOIX PROVISOIRE)
export const NEXT_MIN_DIGITS = 4
// decomposition : de 4 à 9 chiffres, au plus 3 rangs non nuls (CHOIX PROVISOIRE)
export const DECOMPOSITION_MIN_DIGITS = 4
export const DECOMPOSITION_MAX_DIGITS = 9
export const DECOMPOSITION_MAX_PARTS = 3
// times11_12 : multiplicande limité à 12 (prolongement des tables, CHOIX PROVISOIRE)
const TIMES_MAX_MULTIPLICAND = Object.freeze({ times11_12: 12 })

const UNARY = Object.freeze({
  double: { factor: 2, kind: 'times' },
  triple: { factor: 3, kind: 'times' },
  quadruple: { factor: 4, kind: 'times' },
  half: { factor: 2, kind: 'part' },
  third: { factor: 3, kind: 'part' },
  quarter: { factor: 4, kind: 'part' }
})

export const DEFINITION_TYPES = Object.freeze([
  'add', 'sub', 'mulTable', 'mul', 'div',
  'double', 'half', 'triple', 'third', 'quadruple', 'quarter',
  'placeValue', 'times10', 'times5', 'times11_12', 'times25',
  'next', 'prev', 'decomposition', 'timesPow10', 'divPow10', 'addProduct', 'subProduct'
])

// Contexte de calcul d'une classe à partir de ses réglages (reglages-maths.js)
// (champs facultatifs : minTerm, maxQuotientDigits, maxTwoDigitMultiplicand)
export function definitionContext(classSettings) {
  return {
    maxNumber: classSettings.maxNumber,
    tables: classSettings.tables.filter(t => t > 1),
    operandCap: classSettings.maxOperand ?? DEFAULT_OPERAND_CAP,
    operations: classSettings.operations ?? [],
    minTerm: classSettings.minTerm ?? 1,
    maxQuotientDigits: classSettings.maxQuotientDigits ?? null,
    maxTwoDigitMultiplicand: classSettings.maxTwoDigitMultiplicand ?? null
  }
}

// --- Calcul ------------------------------------------------------------------

// Valeur d'une définition, recalculée depuis sa structure ; NaN si la
// structure est inconnue ou si le calcul ne donne pas un entier
export function evaluateDefinition(def) {
  if (!def || !Array.isArray(def.operands) || !def.operands.every(Number.isInteger)) return NaN
  const [a, b, c] = def.operands
  switch (def.type) {
    case 'add': return a + b
    case 'sub': return a - b
    case 'mulTable':
    case 'mul':
    case 'times10':
    case 'times5':
    case 'times11_12':
    case 'times25':
    case 'timesPow10': return a * b
    case 'div':
    case 'divPow10': return b !== 0 && a % b === 0 ? a / b : NaN
    case 'placeValue': return a * 100 + b * 10 + c
    case 'next': return a + 1
    case 'prev': return a - 1
    case 'decomposition': return def.operands.reduce((v, d) => v * 10 + d, 0)
    case 'addProduct': return a + b * c
    case 'subProduct': return a - b * c
    default: {
      const u = UNARY[def.type]
      if (!u) return NaN
      if (u.kind === 'times') return a * u.factor
      return a % u.factor === 0 ? a / u.factor : NaN
    }
  }
}

const arity = (type) => (type === 'placeValue' || type === 'addProduct' || type === 'subProduct' ? 3
  : UNARY[type] || type === 'next' || type === 'prev' ? 1 : 2)
// Nombre d'opérandes permis (decomposition : un chiffre par rang)
const arityOk = (type, ops) => (type === 'decomposition'
  ? ops.length >= DECOMPOSITION_MIN_DIGITS && ops.length <= DECOMPOSITION_MAX_DIGITS
  : ops.length === arity(type))

// Erreurs d'une définition pour la réponse `answer` dans le contexte `ctx`
// (tableau vide = définition valide). Codes : 'type-not-allowed',
// 'bad-structure', 'wrong-value', 'out-of-range', 'trivial', 'not-in-programme',
// 'reveals-answer', 'too-small', 'too-long' (décomposition de plus de 3 rangs
// non nuls).
export function checkDefinition(def, answer, ctx) {
  const errors = []
  if (!def || !DEFINITION_TYPES.includes(def.type)) return ['bad-structure']
  if (!ctx.operations.includes(def.type)) errors.push('type-not-allowed')
  const ops = def.operands
  if (!Array.isArray(ops) || !arityOk(def.type, ops) || !ops.every(n => Number.isInteger(n) && n >= 0)) {
    return [...errors, 'bad-structure']
  }
  const value = evaluateDefinition(def)
  if (value !== answer) errors.push('wrong-value')
  if (ops.some(n => n > ctx.maxNumber) || !(value >= 0) || value > ctx.maxNumber) errors.push('out-of-range')
  const [a, b, c] = ops
  const inTable = (x, y) => ctx.tables.includes(x) && y >= 2 && y <= 10
  switch (def.type) {
    case 'add':
      if (a === 0 || b === 0) errors.push('trivial')
      else if (a < ctx.minTerm || b < ctx.minTerm) errors.push('too-small')
      break
    case 'sub':
      if (b === 0) errors.push('trivial')
      else if (b < ctx.minTerm) errors.push('too-small')
      if (a < b) errors.push('out-of-range')
      break
    case 'mulTable':
      if (a <= 1 || b <= 1) errors.push('trivial')
      if (!inTable(a, b) && !inTable(b, a)) errors.push('not-in-programme')
      break
    case 'mul':
    case 'div':
      if (a <= 1 || b <= 1) errors.push('trivial')
      if (b > ctx.operandCap) errors.push('not-in-programme')
      if (def.type === 'mul' && b >= 10 && ctx.maxTwoDigitMultiplicand !== null && a > ctx.maxTwoDigitMultiplicand) errors.push('not-in-programme')
      if (def.type === 'div' && ctx.maxQuotientDigits !== null && String(value).length > ctx.maxQuotientDigits) errors.push('not-in-programme')
      break
    case 'placeValue':
      if (![a, b, c].every(d => d <= 9) || a + b + c === 0) errors.push('bad-structure')
      break
    case 'times10':
    case 'times5':
    case 'times11_12':
    case 'times25':
    case 'timesPow10': {
      if (a <= 1) errors.push('trivial')
      if (!TIMES_FACTORS[def.type].includes(b)) errors.push('not-in-programme')
      const maxA = TIMES_MAX_MULTIPLICAND[def.type]
      if (maxA !== undefined && a > maxA) errors.push('not-in-programme')
      break
    }
    case 'divPow10':
      if (!POW10_DIVISORS.includes(b)) errors.push('not-in-programme')
      if (!(value > 1)) errors.push('trivial')
      break
    case 'next':
    case 'prev': {
      // Réponse d'au moins 4 chiffres, avec une retenue (sinon trop facile)
      const n = def.type === 'next' ? a + 1 : a - 1
      if (String(n).length < NEXT_MIN_DIGITS || (def.type === 'next' ? n % 10 !== 0 : n % 10 !== 9)) errors.push('trivial')
      break
    }
    case 'decomposition':
      if (!ops.every(d => d <= 9) || ops[0] === 0) errors.push('bad-structure')
      else if (ops.filter(d => d !== 0).length > DECOMPOSITION_MAX_PARTS) errors.push('too-long')
      break
    case 'addProduct':
    case 'subProduct':
      // b × c : produit des tables de la classe (BODMAS, Class 4)
      if (b <= 1 || c <= 1) errors.push('trivial')
      if (!inTable(b, c) && !inTable(c, b)) errors.push('not-in-programme')
      // Décision d'Isaac du 2026-11-08 (réserve R1 du reviewer, lot C) : le
      // produit b × c, ajouté ou retiré, vaut lui aussi au moins minTerm (10
      // dès le CE1 / Class 3), comme les termes et le nombre retiré
      if (b > 1 && c > 1 && b * c < ctx.minTerm) errors.push('too-small')
      if (def.type === 'addProduct') {
        if (a === 0) errors.push('trivial')
        else if (a < ctx.minTerm) errors.push('too-small')
      } else if (a < b * c) errors.push('out-of-range')
      break
    default:
      if (a <= 1) errors.push('trivial')
  }
  if (!NO_REVEAL_CHECK.includes(def.type) && revealsAnswer(ops, answer)) errors.push('reveals-answer')
  return [...new Set(errors)]
}

// Produit des tables « vu par l'élève » (correction du reviewer, 2026-11-08) :
// toute multiplication (mulTable, mul, times10, times5, times11_12, times25,
// timesPow10) dont les deux facteurs sont entre 2 et 10, quel que soit son type
// (« 9 × 5 » en times5, « 3 × 8 » en mul comptent comme « 3 × 8 » en mulTable).
// Le produit placé dans une expression (addProduct, subProduct) n'est pas compté.
const MULTIPLICATION_TYPES = Object.freeze(['mulTable', 'mul', 'times10', 'times5', 'times11_12', 'times25', 'timesPow10'])
export const isTableProduct = (def) =>
  Boolean(def) && MULTIPLICATION_TYPES.includes(def.type) && Array.isArray(def.operands) &&
  def.operands.length === 2 && def.operands.every(x => Number.isInteger(x) && x >= 2 && x <= 10)

// Vrai si l'écriture d'un opérande contient celle de la réponse
export const revealsAnswer = (operands, answer) =>
  operands.some(n => String(n).includes(String(answer)))

// --- Choix d'une définition ----------------------------------------------------

const randomInt = (random, min, max) => min + Math.floor(random() * (max - min + 1))

// Définitions possibles d'un type pour le nombre n. Types à grand nombre de
// possibilités (add, sub) : quelques tirages au hasard (random) puis, à
// défaut, une recherche dans l'ordre ; sans random, seule la recherche dans
// l'ordre est faite (sert à savoir si le type est possible). Chaque définition
// renvoyée est valide (checkDefinition vide). exclude : ensemble de nombres
// interdits comme opérandes (réponses des autres nombres de la grille).
export function definitionOptions(type, n, ctx, random = null, exclude = null) {
  if (!ctx.operations.includes(type) || !Number.isInteger(n) || n < 1 || n > ctx.maxNumber) return []
  const valid = (operands) => checkDefinition({ type, operands }, n, ctx).length === 0 &&
    !(exclude && operands.some(x => exclude.has(x)))
  const out = []
  const push = (operands) => { if (valid(operands)) out.push({ type, operands }) }
  switch (type) {
    case 'add': {
      // CHOIX PROVISOIRE : chaque terme entre 20 % et 80 % du nombre quand
      // c'est possible (pas de « 2 + 345 674 ») ; toujours ≥ minTerm
      const min = ctx.minTerm
      if (n - min < min) return []
      let lo = Math.max(min, Math.ceil(n * 0.2))
      let hi = Math.min(n - min, Math.floor(n * 0.8))
      if (lo > hi) { lo = min; hi = n - min }
      if (random) {
        for (let t = 0; t < 5; t++) { const a = randomInt(random, lo, hi); push([a, n - a]) }
      }
      for (let a = lo; out.length === 0 && a <= Math.min(hi, lo + 300); a++) push([a, n - a])
      return out
    }
    case 'sub': {
      // CHOIX PROVISOIRE : nombre retiré de max(2, minTerm) à n (au plus
      // maxNumber − n) ; 1 seulement si minTerm vaut 1 et qu'il n'y a pas
      // d'autre possibilité
      const maxB = ctx.maxNumber - n
      const minB = Math.max(2, ctx.minTerm)
      const hi = Math.min(maxB, Math.max(minB, n))
      if (random && hi >= minB) {
        for (let t = 0; t < 5; t++) { const b = randomInt(random, minB, hi); push([n + b, b]) }
      }
      for (let b = minB; out.length === 0 && b <= Math.min(maxB, minB + 300); b++) push([n + b, b])
      if (out.length === 0 && ctx.minTerm <= 1 && maxB >= 1) push([n + 1, 1])
      return out
    }
    case 'mulTable':
      for (const t of ctx.tables) {
        if (n % t !== 0) continue
        const k = n / t
        if (k >= 2 && k <= 10) { push([t, k]); push([k, t]) }
      }
      return out
    case 'mul':
      for (let b = 2; b <= Math.min(ctx.operandCap, Math.floor(n / 2)); b++) {
        if (n % b === 0) push([n / b, b])
      }
      return out
    case 'div':
      for (let b = 2; b <= Math.min(ctx.operandCap, Math.floor(ctx.maxNumber / n)); b++) push([n * b, b])
      return out
    case 'placeValue':
      if (n <= 999) push([Math.floor(n / 100), Math.floor(n / 10) % 10, n % 10])
      return out
    case 'times10':
    case 'times5':
    case 'times11_12':
    case 'times25':
    case 'timesPow10':
      for (const f of TIMES_FACTORS[type]) if (n % f === 0) push([n / f, f])
      return out
    case 'divPow10':
      for (const f of POW10_DIVISORS) if (n * f <= ctx.maxNumber) push([n * f, f])
      return out
    case 'next':
      push([n - 1])
      return out
    case 'prev':
      push([n + 1])
      return out
    case 'decomposition':
      push(String(n).split('').map(Number))
      return out
    case 'addProduct':
    case 'subProduct':
      // Tous les produits des tables b × c (b dans les tables de la classe,
      // c de 2 à 10, dans les deux ordres), puis a = n − b × c ou n + b × c
      for (const t of ctx.tables) {
        for (let k = 2; k <= 10; k++) {
          const a = type === 'addProduct' ? n - t * k : n + t * k
          push([a, t, k])
          if (k !== t) push([a, k, t])
        }
      }
      return out
    default: {
      const u = UNARY[type]
      if (u.kind === 'times') { if (n % u.factor === 0) push([n / u.factor]) } else push([n * u.factor])
      return out
    }
  }
}

// Types de définition possibles pour n dans le contexte (ordre de ctx.operations)
export const possibleTypes = (n, ctx) => ctx.operations.filter(type => definitionOptions(type, n, ctx).length > 0)

// Vrai si au moins une définition fermée valide existe pour n
export const canDefine = (n, ctx) => ctx.operations.some(type => definitionOptions(type, n, ctx).length > 0)

// --- Textes ------------------------------------------------------------------

// Écriture d'un nombre : groupes de trois chiffres à partir de 1 000.
// CHOIX PROVISOIRE : espace insécable en français (« 12 345 »), virgule en
// anglais (« 12,345 »), à confirmer pour les classes anglophones.
export function formatNumber(n, language) {
  const s = String(n)
  if (s.length < 4) return s
  const sep = language === 'en' ? ',' : ' '
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, sep)
}

const SYMBOL = { add: '+', sub: '−', div: '÷', divPow10: '÷' }

// Rangs de la décomposition, du plus petit au plus grand (unités = rang 0).
// CHOIX PROVISOIRE : libellés à confirmer par un enseignant (cadrage §9, point 5)
const RANK_WORDS = {
  fr: [['unité', 'unités'], ['dizaine', 'dizaines'], ['centaine', 'centaines'],
    ['unité de mille', 'unités de mille'], ['dizaine de mille', 'dizaines de mille'], ['centaine de mille', 'centaines de mille'],
    ['million', 'millions'], ['dizaine de millions', 'dizaines de millions'], ['centaine de millions', 'centaines de millions']],
  en: [['unit', 'units'], ['ten', 'tens'], ['hundred', 'hundreds'],
    ['thousand', 'thousands'], ['ten thousand', 'ten thousands'], ['hundred thousand', 'hundred thousands'],
    ['million', 'millions'], ['ten million', 'ten millions'], ['hundred million', 'hundred millions']]
}

// CHOIX PROVISOIRE (cadrage §9, point 5 : « the number after » à confirmer)
const NEXT_TEXT = {
  fr: { next: 'le nombre qui suit', prev: 'le nombre qui précède' },
  en: { next: 'the number after', prev: 'the number before' }
}

const UNARY_TEXT = {
  fr: { double: 'le double de', half: 'la moitié de', triple: 'le triple de', third: 'le tiers de', quadruple: 'le quadruple de', quarter: 'le quart de' },
  // CHOIX PROVISOIRE (cadrage §9, point 5 : libellés à confirmer au Cameroun)
  en: { double: 'twice', half: 'half of', triple: 'three times', third: 'one third of', quadruple: 'four times', quarter: 'one quarter of' }
}

const PLACE_WORDS = {
  fr: [['centaine', 'centaines'], ['dizaine', 'dizaines'], ['unité', 'unités']],
  en: [['hundred', 'hundreds'], ['ten', 'tens'], ['unit', 'units']]
}

function joinParts(parts, language) {
  if (parts.length === 1) return parts[0]
  const last = parts[parts.length - 1]
  return `${parts.slice(0, -1).join(', ')} ${language === 'en' ? 'and' : 'et'} ${last}`
}

// Texte d'une définition dans une langue ('fr' ou 'en')
export function definitionText(def, language) {
  const lang = language === 'en' ? 'en' : 'fr'
  const f = (n) => formatNumber(n, lang)
  const [a, b] = def.operands
  if (UNARY[def.type]) return `${UNARY_TEXT[lang][def.type]} ${f(a)}`
  if (def.type === 'next' || def.type === 'prev') return `${NEXT_TEXT[lang][def.type]} ${f(a)}`
  if (def.type === 'decomposition') {
    const top = def.operands.length - 1
    const parts = def.operands
      .map((count, i) => (count === 0 ? null : `${count} ${RANK_WORDS[lang][top - i][count === 1 ? 0 : 1]}`))
      .filter(Boolean)
    return joinParts(parts, lang)
  }
  if (def.type === 'addProduct' || def.type === 'subProduct') {
    return `${f(a)} ${def.type === 'addProduct' ? '+' : '−'} ${f(b)} × ${f(def.operands[2])}`
  }
  if (def.type === 'placeValue') {
    const parts = def.operands
      .map((count, i) => (count === 0 ? null : `${count} ${PLACE_WORDS[lang][i][count === 1 ? 0 : 1]}`))
      .filter(Boolean)
    return joinParts(parts, lang)
  }
  const symbol = SYMBOL[def.type] ?? '×'
  return `${f(a)} ${symbol} ${f(b)}`
}

// Textes dans les deux langues, tirés de la même structure (décision P12 a)
export const definitionTexts = (def) => ({ fr: definitionText(def, 'fr'), en: definitionText(def, 'en') })
