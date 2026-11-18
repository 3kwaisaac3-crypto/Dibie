// Familles et bornes du calcul mental (jeu M6 ; phase 7, lot B :
// docs/calcul-mental.md). Recopie case par case des tableaux §2.1 et §2.2 de
// DIBIE/pedagogie/calcul-mental-familles-lot0-v0.1.md (V0.3, dépôt JARVIS),
// questions 1 à 12 tranchées par Isaac le 2026-11-12.
//
// PROVISOIRE, SANS SOURCE, À VALIDER PAR UN ENSEIGNANT de chaque sous-système
// (décision D4 ; choix 1a : base provisoire, jeu marqué « démonstration »).
// Les programmes disent quelles notions sont étudiées, pas jusqu'où un élève
// calcule de tête : aucune de ces bornes n'a de source.
//
// Clés : className de src/data/reglages-maths.js. Pour chaque classe, ses
// familles (A à I) ; chaque famille, une ou plusieurs formes :
// - add       { a: [min, max], b: [min, max], maxResult }       a + b = ?
// - sub       { a, b }  (b < a, résultat ≥ 1)                     a − b = ?
// - complement { target, a, step } | { nextTen: true, a } | { targets: [min, max] }
//               a + ? = n (n fixe ; dizaine qui suit a, a non multiple de 10 ;
//               ou n dans un intervalle, a de 1 à n − 1)
// - double, triple, quadruple { a, maxResult }               Double de a
// - half, third, quarter      { of: [min, max] } (multiples seulement)
// - table     { tables: [...], b: [2, 10], maxResult }          a × b = ?
// - timesPow10 { powers: [...], a, maxResult }                  a × 100 = ?
// - divPow10  { powers: [...], result: [min, max] }             a ÷ 100 = ?
// - timesK    { ks: [...], a, maxResult }                       a × 25 = ?
// - missingFactor { a, answer, maxProduct }                     a × ? = c

const f = (forms) => Object.freeze(forms.map(form => Object.freeze(form)))
const cls = (families) => Object.freeze(Object.fromEntries(Object.entries(families).map(([k, v]) => [k, f(v)])))

// Formes communes à plusieurs classes (le lot 0 écrit « comme au CE2 », « comme Class 5 »…)
const TABLE_MULTIPLIER = [2, 10] // × 0 et × 1 écartés (choix 4a)
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

// Sous-système francophone (lot 0 §2.1)
const SIL = cls({
  A: [{ type: 'add', a: [1, 10], b: [1, 10], maxResult: 20 }],
  B: [{ type: 'sub', a: [2, 10], b: [1, 9] }],
  C: [{ type: 'complement', target: 10, a: [1, 9], step: 1 }],
  F: [{ type: 'table', tables: [2], b: TABLE_MULTIPLIER, maxResult: 20 }]
})
const CP = cls({
  A: [{ type: 'add', a: [2, 20], b: [2, 9], maxResult: 29 }],
  B: [{ type: 'sub', a: [3, 20], b: [2, 9] }],
  // « a + ? = 10 » (a de 1 à 9) et « dizaine qui suit a » (a de 11 à 99) : même forme
  C: [{ type: 'complement', nextTen: true, a: [1, 99] }],
  D: [{ type: 'double', a: [2, 20], maxResult: 40 }, { type: 'half', of: [4, 40] }],
  F: [{ type: 'table', tables: [2, 4, 5], b: TABLE_MULTIPLIER, maxResult: 50 }]
})
const CE1 = cls({
  A: [{ type: 'add', a: [10, 99], b: [2, 9], maxResult: 108 }],
  B: [{ type: 'sub', a: [11, 99], b: [2, 9] }],
  C: [{ type: 'complement', nextTen: true, a: [11, 99] }, { type: 'complement', target: 100, a: [10, 90], step: 10 }],
  D: [{ type: 'double', a: [5, 50], maxResult: 100 }, { type: 'half', of: [10, 100] }],
  E: [{ type: 'triple', a: [2, 10], maxResult: 30 }, { type: 'third', of: [6, 30] }],
  F: [{ type: 'table', tables: range(2, 5), b: TABLE_MULTIPLIER, maxResult: 50 }]
})
const D_CE2 = [{ type: 'double', a: [10, 100], maxResult: 200 }, { type: 'half', of: [20, 200] }]
const CE2 = cls({
  A: [{ type: 'add', a: [10, 99], b: [2, 20], maxResult: 119 }],
  B: [{ type: 'sub', a: [20, 99], b: [2, 20] }],
  C: [{ type: 'complement', target: 100, a: [5, 95], step: 5 }],
  D: D_CE2,
  E: [{ type: 'quadruple', a: [2, 10], maxResult: 40 }, { type: 'quarter', of: [8, 40] }],
  F: [{ type: 'table', tables: range(2, 8), b: TABLE_MULTIPLIER, maxResult: 80 }],
  G: [{ type: 'timesPow10', powers: [10, 100], a: [2, 99], maxResult: 9900 }]
})
const A_CM1 = [{ type: 'add', a: [10, 99], b: [10, 50], maxResult: 149 }]
const B_CM1 = [{ type: 'sub', a: [20, 99], b: [10, 50] }]
const A_CM2 = [{ type: 'add', a: [10, 99], b: [10, 99], maxResult: 198 }]
const B_CM2 = [{ type: 'sub', a: [20, 99], b: [10, 89] }]
const C_100 = { type: 'complement', target: 100, a: [1, 99], step: 1 }
const C_1000 = { type: 'complement', target: 1000, a: [50, 950], step: 50 }
const F_10 = [{ type: 'table', tables: range(2, 10), b: TABLE_MULTIPLIER, maxResult: 100 }]
const G_CM = [
  { type: 'timesPow10', powers: [10, 100, 1000], a: [2, 999], maxResult: 999000 },
  { type: 'divPow10', powers: [10, 100, 1000], result: [2, 999] }
]
const H_5 = { type: 'timesK', ks: [5, 50, 500], a: [2, 20], maxResult: 10000 }
const I_CM = [{ type: 'missingFactor', a: [2, 10], answer: [2, 10], maxProduct: 100 }]
const CM1 = cls({ A: A_CM1, B: B_CM1, C: [C_100], D: D_CE2, F: F_10, G: G_CM, H: [H_5], I: I_CM })
const CM2 = cls({
  A: A_CM2, B: B_CM2, C: [C_100, C_1000], D: D_CE2, F: F_10, G: G_CM,
  H: [
    { type: 'timesK', ks: [11, 12], a: [2, 10], maxResult: 120 },
    { type: 'timesK', ks: [25], a: [2, 12], maxResult: 300 },
    H_5
  ],
  I: I_CM
})

// Sous-système anglophone (lot 0 §2.2) ; « bonds » lus comme décompositions
// additives en Class 1-2, tables du code en Class 3-4 (lecture fragile, choix 6a)
const CLASS_1 = cls({
  A: [{ type: 'add', a: [1, 10], b: [1, 10], maxResult: 20 }],
  B: [{ type: 'sub', a: [2, 10], b: [1, 9] }],
  C: [{ type: 'complement', targets: [5, 10] }]
})
const CLASS_2 = cls({
  A: [{ type: 'add', a: [2, 20], b: [2, 9], maxResult: 29 }],
  B: [{ type: 'sub', a: [3, 20], b: [2, 9] }],
  C: [{ type: 'complement', targets: [10, 20] }, { type: 'complement', nextTen: true, a: [11, 99] }],
  D: [{ type: 'double', a: [2, 20], maxResult: 40 }, { type: 'half', of: [4, 40] }]
})
const CLASS_3 = cls({
  A: [{ type: 'add', a: [10, 99], b: [2, 9], maxResult: 108 }],
  B: [{ type: 'sub', a: [11, 99], b: [2, 9] }],
  C: [{ type: 'complement', nextTen: true, a: [11, 99] }, { type: 'complement', target: 100, a: [10, 90], step: 10 }],
  D: [{ type: 'double', a: [5, 50], maxResult: 100 }, { type: 'half', of: [10, 100] }],
  F: [{ type: 'table', tables: range(2, 7), b: TABLE_MULTIPLIER, maxResult: 70 }]
})
const CLASS_4 = cls({
  A: [{ type: 'add', a: [10, 99], b: [2, 20], maxResult: 119 }],
  B: [{ type: 'sub', a: [20, 99], b: [2, 20] }],
  C: [{ type: 'complement', target: 100, a: [5, 95], step: 5 }],
  D: D_CE2,
  F: [{ type: 'table', tables: range(2, 9), b: TABLE_MULTIPLIER, maxResult: 90 }]
})
const CLASS_5 = cls({ A: A_CM1, B: B_CM1, C: [C_100], D: D_CE2, F: F_10, I: I_CM })
const CLASS_6 = cls({ A: A_CM2, B: B_CM2, C: [C_100, C_1000], D: D_CE2, F: F_10, I: I_CM })

export const MENTAL_MATH_CLASSES = Object.freeze({
  SIL, CP, CE1, CE2, CM1, CM2,
  'Class 1': CLASS_1, 'Class 2': CLASS_2, 'Class 3': CLASS_3, 'Class 4': CLASS_4, 'Class 5': CLASS_5, 'Class 6': CLASS_6
})
