// Nombres croisés (fiche M1, moteur F) — géométrie des gabarits.
// Module pur : aucun accès au stockage ni à l'interface.
//
// Un gabarit est un tableau de lignes de même longueur (grille carrée) :
// '.' = case blanche (un chiffre), '#' = case noire. Exemple 3 × 3 :
//   ['..#', '.#.', '#..']
//
// Règles d'un gabarit valide (cadrage de la phase 5, §4.1 et §5 règle 5) :
// - une suite de cases blanches de 2 cases ou plus (horizontale ou verticale)
//   est un nombre ; une suite d'une seule case n'est pas un nombre ;
// - longueur de chaque nombre ≤ nombre de chiffres permis dans la classe ;
// - chaque case blanche appartient à au moins un nombre ;
// - chaque nombre croise au moins un autre nombre (des cases non croisées
//   restent tolérées, comme dans l'essai 3 × 3 CP du developer).
// Numérotation des nombres : comme aux mots croisés (crosswordLayout.js),
// numéros 1..N dans l'ordre de lecture ; un horizontal et un vertical qui
// commencent sur la même case ont le même numéro.

export const WHITE = '.'
export const BLACK = '#'

// Grille de booléens (vrai = case blanche) à partir des lignes du gabarit
export function parseTemplate(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new TypeError('gabarit vide')
  const size = rows.length
  return rows.map(row => {
    if (typeof row !== 'string' || row.length !== size || /[^.#]/.test(row)) {
      throw new TypeError(`gabarit non carré ou caractère inconnu : ${JSON.stringify(rows)}`)
    }
    return [...row].map(ch => ch === WHITE)
  })
}

const toRows = (white) => white.map(r => r.map(w => (w ? WHITE : BLACK)).join(''))

// Les 8 symétries du carré (identité, 3 rotations, 2 miroirs, 2 diagonales).
// Elles conservent les longueurs des suites : un gabarit valide reste valide.
const SYMMETRIES = [
  (r, c) => [r, c],
  (r, c, n) => [c, n - 1 - r],
  (r, c, n) => [n - 1 - r, n - 1 - c],
  (r, c, n) => [n - 1 - c, r],
  (r, c, n) => [r, n - 1 - c],
  (r, c, n) => [n - 1 - r, c],
  (r, c) => [c, r],
  (r, c, n) => [n - 1 - c, n - 1 - r]
]
export const SYMMETRY_COUNT = SYMMETRIES.length

// Gabarit transformé par la symétrie numéro k (0 = identité)
export function applySymmetry(rows, k) {
  const white = parseTemplate(rows)
  const n = white.length
  const out = Array.from({ length: n }, () => Array(n).fill(false))
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const [r2, c2] = SYMMETRIES[k](r, c, n)
      out[r2][c2] = white[r][c]
    }
  }
  return toRows(out)
}

// Symétries distinctes d'un gabarit (sans doublon), dans l'ordre des symétries
export function distinctSymmetries(rows) {
  const seen = new Set()
  const list = []
  for (let k = 0; k < SYMMETRY_COUNT; k++) {
    const t = applySymmetry(rows, k)
    const key = t.join('/')
    if (!seen.has(key)) { seen.add(key); list.push(t) }
  }
  return list
}

// Nombres (suites de 2 cases ou plus) d'un gabarit, numérotés dans l'ordre de
// lecture. Chaque nombre : { id, number, direction: 'across' | 'down', cells:
// [[r, c], ...], length }. id = `${number}${A|D}` (ex. '3A', '3D').
// Ordre du tableau : horizontaux par numéro, puis verticaux par numéro.
export function templateEntries(rows) {
  const white = parseTemplate(rows)
  const n = white.length
  const isWhite = (r, c) => r >= 0 && c >= 0 && r < n && c < n && white[r][c]
  const across = []
  const down = []
  let next = 1
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!white[r][c]) continue
      const startsAcross = !isWhite(r, c - 1) && isWhite(r, c + 1)
      const startsDown = !isWhite(r - 1, c) && isWhite(r + 1, c)
      if (!startsAcross && !startsDown) continue
      const number = next++
      if (startsAcross) {
        const cells = []
        for (let k = c; isWhite(r, k); k++) cells.push([r, k])
        across.push({ id: `${number}A`, number, direction: 'across', cells, length: cells.length })
      }
      if (startsDown) {
        const cells = []
        for (let k = r; isWhite(k, c); k++) cells.push([k, c])
        down.push({ id: `${number}D`, number, direction: 'down', cells, length: cells.length })
      }
    }
  }
  return [...across, ...down]
}

// Analyse complète d'un gabarit. Renvoie { size, entries, whiteCount,
// crossedCount, lengths, errors } ; errors vide = gabarit valide pour des
// nombres de minDigits à maxDigits chiffres. Codes d'erreur :
// 'cell-alone' (case blanche dans aucun nombre), 'too-long', 'too-short',
// 'not-crossed' (nombre qui ne croise aucun autre), 'no-entry'.
export function analyzeTemplate(rows, { minDigits = 2, maxDigits = Infinity } = {}) {
  const white = parseTemplate(rows)
  const n = white.length
  const entries = templateEntries(rows)
  const owners = Array.from({ length: n }, () => Array.from({ length: n }, () => []))
  for (const e of entries) for (const [r, c] of e.cells) owners[r][c].push(e.id)
  const errors = []
  let whiteCount = 0
  let crossedCount = 0
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!white[r][c]) continue
      whiteCount++
      if (owners[r][c].length === 0) errors.push({ code: 'cell-alone', cell: [r, c] })
      if (owners[r][c].length === 2) crossedCount++
    }
  }
  if (entries.length === 0) errors.push({ code: 'no-entry' })
  for (const e of entries) {
    if (e.length > maxDigits) errors.push({ code: 'too-long', entry: e.id, length: e.length })
    if (e.length < minDigits) errors.push({ code: 'too-short', entry: e.id, length: e.length })
    if (!e.cells.some(([r, c]) => owners[r][c].length === 2)) errors.push({ code: 'not-crossed', entry: e.id })
  }
  return {
    size: n,
    entries,
    whiteCount,
    crossedCount,
    lengths: entries.map(e => e.length),
    errors
  }
}
