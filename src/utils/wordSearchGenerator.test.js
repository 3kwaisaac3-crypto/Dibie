// Tests du générateur de mots mêlés — lancer avec : node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generateWordSearch,
  normalizeWord,
  countOccurrences,
  DEFAULT_SIZE,
  DEFAULT_DIRECTIONS,
  DIRECTIONS,
  GRID_SIZES_BY_LEVEL,
  GENERATOR_VERSION
} from './wordSearchGenerator.js'

const EXAMPLE = ['chat', 'élève', 'forêt', 'école', 'maïs']
// Liste FACTICE et neutre, pour les tests seulement. La vraie liste sera
// établie par Isaac et un enseignant (décision 9) : ne pas la mettre ici.
const FAKE_BLOCKED = ['ZUT', 'BOF']
const STEP = { across: [0, 1], down: [1, 0], diagonal: [1, 1] }

// Vérifie les invariants d'une grille générée
function assertValidGrid(result, directions = DEFAULT_DIRECTIONS) {
  const { size, grid, placements } = result
  assert.equal(result.status, 'ok')
  assert.equal(grid.length, size, 'nombre de lignes')
  for (const row of grid) {
    assert.equal(row.length, size, 'grille carrée')
    for (const cell of row) assert.match(cell, /^[A-Z]$/, 'chaque case = une lettre A-Z')
  }
  for (const p of placements) {
    assert.ok(directions.includes(p.direction), `direction ${p.direction} activée`)
    const [dr, dc] = STEP[p.direction]
    for (let i = 0; i < p.word.length; i++) {
      assert.equal(grid[p.row + dr * i][p.col + dc * i], p.word[i], `lettre ${i} de ${p.word}`)
    }
  }
}

// Oracle indépendant du code testé : lignes de la grille dans une
// direction, en chaînes (cases hors grille exclues).
function linesFor(grid, [dr, dc]) {
  const n = grid.length
  const lines = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const pr = r - dr
      const pc = c - dc
      if (pr >= 0 && pc >= 0 && pr < n && pc < n) continue // pas un début de ligne
      let s = ''
      for (let i = 0; r + dr * i < n && c + dc * i < n && c + dc * i >= 0; i++) s += grid[r + dr * i][c + dc * i]
      lines.push(s)
    }
  }
  return lines
}
const countIn = (text, w) => {
  let n = 0
  for (let i = 0; i + w.length <= text.length; i++) if (text.startsWith(w, i)) n++
  return n
}
const oracleCount = (grid, word, directions) =>
  directions.reduce((n, d) => n + linesFor(grid, STEP[d]).reduce((m, l) => m + countIn(l, word), 0), 0)

// Chaque mot placé est trouvable exactement une fois dans les directions
// activées (oracle indépendant ; comptage chevauchant).
function assertEachWordOnce(result, directions = DEFAULT_DIRECTIONS) {
  for (const p of result.placements) {
    assert.equal(oracleCount(result.grid, p.word, directions), 1, `${p.word} (graine ${result.seed})`)
  }
}

// Vrai si un mot interdit apparaît dans la grille sur les 4 axes, dans les
// deux sens (oracle indépendant de containsBlockedWord).
function gridHasBlocked(grid, blocked) {
  const lines = [[0, 1], [1, 0], [1, 1], [1, -1]].flatMap(s => linesFor(grid, s))
  return blocked.some(b => {
    const r = [...b].reverse().join('')
    return lines.some(l => l.includes(b) || l.includes(r))
  })
}

// ---------------------------------------------------------------------------
// Tests d'origine (adaptés aux décisions 4 et 7 quand nécessaire)

test('C1 — exemple d\'Isaac : grille 10x10 par défaut, 5 mots placés', () => {
  const result = generateWordSearch(EXAMPLE, { seed: 42 })
  assert.equal(result.size, DEFAULT_SIZE)
  assert.equal(result.size, 10)
  assert.deepEqual(result.placements.map(p => p.word).sort(), ['CHAT', 'ECOLE', 'ELEVE', 'FORET', 'MAIS'])
  assert.deepEqual(result.rejected, [])
  assertValidGrid(result)
})

test('C2 — accents retirés et ligatures développées', () => {
  assert.equal(normalizeWord('élève'), 'ELEVE')
  assert.equal(normalizeWord('forêt'), 'FORET')
  assert.equal(normalizeWord('maïs'), 'MAIS')
  assert.equal(normalizeWord('École'), 'ECOLE')
  assert.equal(normalizeWord('garçon'), 'GARCON')
  assert.equal(normalizeWord('cœur'), 'COEUR')
  assert.equal(normalizeWord('Æsope'), 'AESOPE')
  assert.equal(normalizeWord('ex æquo'), '')
  assert.equal(normalizeWord('élève'.normalize('NFD')), 'ELEVE')
  assert.equal(normalizeWord("l'école"), '')
  assert.equal(normalizeWord('  chat '), 'CHAT')
  assert.equal(normalizeWord('pomme de terre'), '')
  assert.equal(normalizeWord('arc-en-ciel'), '')
  assert.equal(normalizeWord(''), '')
  assert.equal(normalizeWord(12), '')
})

test('C3 — même graine, même grille (reproductible)', () => {
  const a = generateWordSearch(EXAMPLE, { seed: 2026 })
  const b = generateWordSearch(EXAMPLE, { seed: 2026 })
  assert.deepEqual(a, b)
})

test('C3 bis — graines différentes, grilles différentes', () => {
  const a = generateWordSearch(EXAMPLE, { seed: 1 })
  const b = generateWordSearch(EXAMPLE, { seed: 2 })
  assert.notDeepEqual(a.grid, b.grid)
})

test('C3 ter — sans graine : une graine est tirée et renvoyée', () => {
  const a = generateWordSearch(EXAMPLE)
  assert.ok(Number.isInteger(a.seed))
  assert.deepEqual(generateWordSearch(EXAMPLE, { seed: a.seed }), a)
})

test('C4 — mot trop long : écarté et signalé, jamais tronqué', () => {
  const result = generateWordSearch(['chat', 'anticonstitutionnellement'], { seed: 7 })
  assert.deepEqual(result.placements.map(p => p.word), ['CHAT'])
  assert.deepEqual(result.rejected, [{ original: 'anticonstitutionnellement', reason: 'too_long' }])
  assertValidGrid(result)
})

test('C5 — mot invalide, trop court ou en double : signalé', () => {
  const result = generateWordSearch(['chat', 'Chat', 'élève', 'eleve', 'pomme de terre', 'a', 'le', ''], { seed: 3 })
  assert.deepEqual(result.placements.map(p => p.word).sort(), ['CHAT', 'ELEVE'])
  assert.deepEqual(result.rejected, [
    { original: 'Chat', reason: 'duplicate' },
    { original: 'eleve', reason: 'duplicate' },
    { original: 'pomme de terre', reason: 'invalid' },
    { original: 'a', reason: 'too_short' },
    { original: 'le', reason: 'too_short' },
    { original: '', reason: 'invalid' }
  ])
})

test('C6 — trop de mots pour la grille : les mots en trop sont signalés, pas de plantage', () => {
  const words = ['abcd', 'efgh', 'ijkl', 'mnop', 'qrst', 'uvwx', 'yzab', 'cdef', 'ghij', 'klmn']
  const result = generateWordSearch(words, { size: 4, seed: 5 })
  assert.equal(result.placements.length + result.rejected.length, words.length)
  assert.ok(result.rejected.length > 0)
  assert.ok(result.rejected.every(r => ['no_space', 'ambiguous'].includes(r.reason)))
  assertValidGrid(result)
})

// Réserve n° 1 de la première revue : deux mots côte à côte en forment un
// troisième. Version 3 lettres (décision 4) : ABC + DEF forment CDE.
test('C6 bis — [abc, def, cde] en 6x6 : jamais d\'erreur, CDE trouvable une seule fois (200 graines)', () => {
  for (let seed = 0; seed < 200; seed++) {
    const result = generateWordSearch(['abc', 'def', 'cde'], { size: 6, seed })
    assert.equal(result.placements.length, 3, `graine ${seed}`)
    assertValidGrid(result)
    assertEachWordOnce(result)
  }
})

test('C6 ter — mots courts (3 lettres, 6 en 10x10, 10 en 20x20) : jamais d\'erreur (200 graines)', () => {
  const cases = [
    [['sol', 'mur', 'lit', 'bus', 'riz', 'feu'], 10],
    [['sol', 'mur', 'lit', 'bus', 'riz', 'feu', 'nez', 'dos', 'pot', 'roi'], 20]
  ]
  for (const [words, size] of cases) {
    for (let seed = 0; seed < 200; seed++) {
      const result = generateWordSearch(words, { size, seed })
      assert.equal(result.placements.length, words.length, `taille ${size}, graine ${seed}`)
      assertValidGrid(result)
      assertEachWordOnce(result)
    }
  }
})

test('C6 quater — chemin « ambiguous » : mot écarté et signalé, pas d\'erreur', () => {
  // cas trouvé par sondage (find-ambiguous.mjs, 2026-10-06), mots de 4 lettres
  const result = generateWordSearch(['cacc', 'babc', 'aabb', 'abaa', 'accb', 'aaac'], { size: 4, seed: 1 })
  assert.deepEqual(result.rejected, [{ original: 'accb', reason: 'ambiguous' }])
  assert.equal(result.placements.length, 5)
  assertValidGrid(result)
  assertEachWordOnce(result)
})

test('C7 — chaque mot apparaît une seule fois dans la grille', () => {
  const result = generateWordSearch(EXAMPLE, { seed: 99 })
  for (const p of result.placements) assert.equal(countOccurrences(result.grid, p.word), 1, p.word)
})

test('C7 bis — CHAT / CHATON : CHAT rejeté (contained), CHATON placé, pas de blocage', () => {
  for (let seed = 0; seed < 50; seed++) {
    const result = generateWordSearch(['chaton', 'chat'], { size: 6, seed })
    assert.deepEqual(result.placements.map(p => p.word), ['CHATON'], `graine ${seed}`)
    assert.deepEqual(result.rejected, [{ original: 'chat', reason: 'contained', containedIn: 'chaton' }])
    assertValidGrid(result)
  }
})

test('C8 — entrées incorrectes : erreur explicite', () => {
  assert.throws(() => generateWordSearch('chat'), TypeError)
  assert.throws(() => generateWordSearch(null), TypeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { size: 3 }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { size: 21 }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { size: 10.5 }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { size: null }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { seed: 'abc' }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { seed: -1 }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { seed: 4294967296 }), RangeError)
  assert.equal(generateWordSearch(EXAMPLE, { seed: 4294967295 }).seed, 4294967295)
  assert.equal(generateWordSearch(EXAMPLE, { seed: 0 }).seed, 0)
})

test('C8 bis — options absentes ou null : valeurs par défaut', () => {
  assert.equal(generateWordSearch(EXAMPLE, null).size, DEFAULT_SIZE)
  assert.equal(generateWordSearch(EXAMPLE).size, DEFAULT_SIZE)
  assert.deepEqual(generateWordSearch(EXAMPLE).directions, ['across', 'down'])
})

test('C8 ter — liste vide : grille de lettres, aucun mot, aucune erreur', () => {
  const result = generateWordSearch([], { seed: 1 })
  assert.deepEqual(result.placements, [])
  assert.deepEqual(result.rejected, [])
  assertValidGrid(result)
})

test('C9 — la liste fournie n\'est pas modifiée', () => {
  const words = [...EXAMPLE, { affichage: 'le chat', grille: 'chat' }]
  const copy = JSON.parse(JSON.stringify(words))
  generateWordSearch(words, { seed: 1, blockedWords: [...FAKE_BLOCKED] })
  assert.deepEqual(words, copy)
})

test('C10 — invariants sur 500 graines et 3 tailles (8, 10, 12)', () => {
  for (const size of [8, 10, 12]) {
    for (let seed = 0; seed < 500; seed++) {
      const result = generateWordSearch(EXAMPLE, { size, seed })
      assertValidGrid(result)
      assert.equal(result.placements.length, 5, `taille ${size}, graine ${seed}`)
      assertEachWordOnce(result)
    }
  }
})

// ---------------------------------------------------------------------------
// Décisions d'Isaac du 2026-10-05 (MEMORY/dibie/DECISIONS.md)

test('D1 — accents : grille sans accents, affichage = orthographe exacte', () => {
  const result = generateWordSearch(['élève', 'cœur', { affichage: "l'école", grille: 'école' }], { seed: 4 })
  const byWord = Object.fromEntries(result.placements.map(p => [p.word, p]))
  assert.equal(byWord.ELEVE.affichage, 'élève')
  assert.equal(byWord.ELEVE.original, 'élève')
  assert.equal(byWord.COEUR.affichage, 'cœur')
  assert.equal(byWord.ECOLE.affichage, "l'école")
  assert.equal(byWord.ECOLE.original, "l'école")
  assertValidGrid(result)
})

test('D2 — directions : → et ↓ par défaut, jamais de diagonale ni d\'envers (300 graines)', () => {
  for (let seed = 0; seed < 300; seed++) {
    const result = generateWordSearch(EXAMPLE, { seed })
    assert.ok(result.placements.every(p => ['across', 'down'].includes(p.direction)))
  }
  assert.deepEqual(DIRECTIONS, ['across', 'down', 'diagonal'])
})

test('D2 bis — ↘ activé : invariants, chaque mot une fois dans les 3 directions (300 graines x 3 tailles)', () => {
  const directions = ['across', 'down', 'diagonal']
  const seen = new Set()
  for (const size of [8, 10, 12]) {
    for (let seed = 0; seed < 300; seed++) {
      const result = generateWordSearch(EXAMPLE, { size, seed, directions })
      assert.equal(result.placements.length, 5, `taille ${size}, graine ${seed}`)
      assertValidGrid(result, directions)
      assertEachWordOnce(result, directions)
      for (const p of result.placements) seen.add(p.direction)
    }
  }
  assert.deepEqual([...seen].sort(), ['across', 'diagonal', 'down'], 'les 3 directions sont utilisées')
})

test('D2 ter — ↘ seule : tout est en diagonale ; countOccurrences suit les directions', () => {
  for (let seed = 0; seed < 100; seed++) {
    const result = generateWordSearch(['sol', 'mur', 'lit'], { size: 8, seed, directions: ['diagonal'] })
    assert.equal(result.placements.length, 3)
    assertValidGrid(result, ['diagonal'])
    assertEachWordOnce(result, ['diagonal'])
    for (const p of result.placements) {
      assert.equal(countOccurrences(result.grid, p.word, ['diagonal']), oracleCount(result.grid, p.word, ['diagonal']))
    }
  }
})

test('D2 quater — directions invalides : erreur explicite', () => {
  for (const directions of [[], ['up'], ['reverse'], 'across', ['across', 'across'], [null], {}]) {
    assert.throws(() => generateWordSearch(EXAMPLE, { directions }), RangeError, JSON.stringify(directions))
  }
})

test('D3 — formats par niveau (Claude.md du projet, l. 35) et 8x8 au niveau de base CE1-CE2', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(GRID_SIZES_BY_LEVEL)), {
    'SIL-CP': { default: 8, allowed: [8] },
    'CE1-CE2': { default: 10, allowed: [10, 8] },
    'CM1-CM2': { default: 12, allowed: [12] }
  })
  assert.equal(generateWordSearch(EXAMPLE, { level: 'SIL-CP', seed: 1 }).size, 8)
  assert.equal(generateWordSearch(EXAMPLE, { level: 'CE1-CE2', seed: 1 }).size, 10)
  assert.equal(generateWordSearch(EXAMPLE, { level: 'CE1-CE2', size: 8, seed: 1 }).size, 8)
  assert.equal(generateWordSearch(EXAMPLE, { level: 'CM1-CM2', seed: 1 }).size, 12)
  assert.equal(generateWordSearch(EXAMPLE, { level: 'CE1-CE2', seed: 1 }).level, 'CE1-CE2')
  assert.throws(() => generateWordSearch(EXAMPLE, { level: 'CE1-CE2', size: 12 }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { level: 'CE1-CE2', size: 15 }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { level: 'CE2' }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { level: 'toString' }), RangeError)
  // sans niveau : bornes techniques 4 à 20 seulement
  assert.equal(generateWordSearch(EXAMPLE, { size: 20, seed: 1 }).level, null)
  assert.equal(generateWordSearch(['sol'], { size: 4, seed: 1 }).size, 4)
})

test('D4 — longueur minimale 3 lettres', () => {
  const result = generateWordSearch(['le', 'sol', 'on'], { seed: 2 })
  assert.deepEqual(result.placements.map(p => p.word), ['SOL'])
  assert.deepEqual(result.rejected.map(r => r.reason), ['too_short', 'too_short'])
})

test('D5 — mot trop long : écarté, la grille du niveau n\'est jamais agrandie', () => {
  const result = generateWordSearch(['chat', 'dromadaire'], { level: 'SIL-CP', seed: 3 })
  assert.equal(result.size, 8)
  assert.equal(result.grid.length, 8)
  assert.deepEqual(result.rejected, [{ original: 'dromadaire', reason: 'too_long' }])
})

test('D6 — entrée en objets { affichage, grille }, chaînes toujours acceptées', () => {
  const result = generateWordSearch([{ affichage: 'le chat', grille: 'chat' }, 'forêt'], { seed: 5 })
  assert.deepEqual(result.placements.map(p => [p.word, p.affichage]).sort(), [['CHAT', 'le chat'], ['FORET', 'forêt']])
  assert.deepEqual(result.rejected, [])
})

test('D6 bis — objets mal formés, article jamais retiré, mots composés refusés', () => {
  const bad = [
    [null, 'invalid'],
    [[], 'invalid'],
    [{}, 'invalid'],
    [{ affichage: 'le chat' }, 'invalid'], // pas de champ grille : l'article n'est pas retiré
    [{ grille: 'chat' }, 'invalid'],
    [{ affichage: '', grille: 'chat' }, 'invalid'],
    [{ affichage: '   ', grille: 'chat' }, 'invalid'],
    [{ affichage: 12, grille: 'chat' }, 'invalid'],
    [{ affichage: 'le chat', grille: 12 }, 'invalid'],
    [{ affichage: 'le chat', grille: 'le chat' }, 'invalid'],
    [{ affichage: 'chien', grille: 'chat' }, 'mismatch'],
    [{ affichage: 'arc-en-ciel', grille: 'arcenciel' }, 'mismatch'],
    [{ affichage: 'pomme de terre', grille: 'pommedeterre' }, 'mismatch'],
    ['arc-en-ciel', 'invalid'],
    [42, 'invalid']
  ]
  const result = generateWordSearch(bad.map(([item]) => item), { seed: 6 })
  assert.deepEqual(result.placements, [])
  assert.deepEqual(result.rejected.map(r => r.reason), bad.map(([, reason]) => reason))
  assertValidGrid(result)
})

test('D7 — mot contenu dans un autre : rejeté avant placement, quel que soit l\'ordre', () => {
  for (const words of [['chat', 'chaton'], ['chaton', 'chat']]) {
    const result = generateWordSearch(words, { seed: 1 })
    assert.deepEqual(result.placements.map(p => p.word), ['CHATON'])
    assert.deepEqual(result.rejected, [{ original: 'chat', reason: 'contained', containedIn: 'chaton' }])
  }
  // chaîne : SOL dans SOLEIL, SOLEIL dans SOLEILS
  const chain = generateWordSearch(['sol', 'soleil', 'soleils'], { seed: 1 })
  assert.deepEqual(chain.placements.map(p => p.word), ['SOLEILS'])
  assert.deepEqual(chain.rejected.map(r => [r.original, r.reason]), [['sol', 'contained'], ['soleil', 'contained']])
  // contenu à l'envers seulement (LOS dans SOLEIL lu à l'envers) : pas un piège, gardé
  const rev = generateWordSearch(['los', 'soleil'], { seed: 1 })
  assert.equal(rev.placements.length, 2)
  // via l'objet : grille comparée, pas l'affichage
  const obj = generateWordSearch([{ affichage: 'le chat', grille: 'chat' }, 'chaton'], { seed: 1 })
  assert.deepEqual(obj.rejected, [{ original: { affichage: 'le chat', grille: 'chat' }, reason: 'contained', containedIn: 'chaton' }])
})

test('D8 — reproductibilité : graine, liste, version du générateur et de la liste interdite', () => {
  const words = ['chat', { affichage: 'la forêt', grille: 'forêt' }]
  const result = generateWordSearch(words, { seed: 11, blockedWords: FAKE_BLOCKED, blockedWordsVersion: 'factice-1' })
  assert.equal(result.generatorVersion, GENERATOR_VERSION)
  assert.equal(result.blockedWordsVersion, 'factice-1')
  assert.equal(result.requestedSeed, 11)
  assert.equal(result.seed, 11)
  assert.deepEqual(result.words, words)
  assert.notEqual(result.words, words, 'copie, pas la même référence')
  assert.notEqual(result.words[1], words[1])
  assert.equal(generateWordSearch(words, { seed: 11 }).blockedWordsVersion, null)
  // la liste interdite elle-même n'est pas recopiée dans le résultat
  assert.ok(!('blockedWords' in result))
  assert.ok(!JSON.stringify(result).includes('ZUT'))
})

test('D9 — mot de la liste contenant un mot interdit (à l\'endroit ou à l\'envers) : rejeté', () => {
  const words = ['zut', 'tuz', 'azute', 'fob', { affichage: 'bof chat', grille: 'chat' }, 'Zût', 'sol']
  const result = generateWordSearch(words, { seed: 1, blockedWords: FAKE_BLOCKED })
  assert.deepEqual(result.placements.map(p => p.word), ['SOL'])
  assert.deepEqual(result.rejected.map(r => r.reason), ['blocked', 'blocked', 'blocked', 'blocked', 'blocked', 'blocked'])
  // mot interdit de 2 lettres (rejeté « blocked », pas « too_short »)
  const two = generateWordSearch(['zu'], { seed: 1, blockedWords: ['ZU'] })
  assert.deepEqual(two.rejected, [{ original: 'zu', reason: 'blocked' }])
})

test('D9 bis — grille finale sans mot interdit, 4 axes, deux sens (300 graines x 2 jeux de directions)', () => {
  const blocked = ['ZUT', 'BOF', 'QX', 'WK']
  for (const directions of [['across', 'down'], ['across', 'down', 'diagonal']]) {
    for (let seed = 0; seed < 300; seed++) {
      const result = generateWordSearch(EXAMPLE, { seed, size: 8, directions, blockedWords: blocked })
      assertValidGrid(result, directions)
      assert.ok(!gridHasBlocked(result.grid, blocked), `graine ${seed}`)
      assert.equal(result.attempts, 1, `remplissage qui évite les mots interdits, graine ${seed}`)
    }
  }
})

test('D9 ter — mot interdit formé par les mots placés : régénération, graine finale reproductible', () => {
  // cas trouvé par sondage (find-regen.mjs, 2026-10-06) ; AD = suite factice
  let regenerated = 0
  for (let seed = 0; seed < 100; seed++) {
    const result = generateWordSearch(['abc', 'def', 'ghi', 'jkl'], { size: 4, seed, blockedWords: ['AD'] })
    assert.equal(result.status, 'ok', `graine ${seed}`)
    assert.ok(!gridHasBlocked(result.grid, ['AD']))
    assert.equal(result.requestedSeed, seed)
    if (result.attempts > 1) {
      regenerated++
      assert.notEqual(result.seed, seed)
      const again = generateWordSearch(['abc', 'def', 'ghi', 'jkl'], { size: 4, seed: result.seed, blockedWords: ['AD'] })
      assert.deepEqual(again.grid, result.grid)
      assert.equal(again.attempts, 1)
    }
  }
  assert.ok(regenerated > 0, 'au moins une régénération réelle')
})

test('D9 quater — mot interdit inévitable : aucune grille, statut explicite, auteur averti', () => {
  const allLetters = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']
  const result = generateWordSearch(['sol'], { seed: 1, blockedWords: allLetters, blockedWordsVersion: 'factice-2' })
  assert.equal(result.status, 'blocked_word_limit')
  assert.equal(result.grid, null)
  assert.deepEqual(result.placements, [])
  assert.equal(result.seed, null)
  assert.equal(result.attempts, 20)
  assert.match(result.message, /Aucune grille/)
  assert.equal(result.blockedWordsVersion, 'factice-2')
  assert.deepEqual(result.rejected, [{ original: 'sol', reason: 'blocked' }])
  // déterministe
  assert.deepEqual(generateWordSearch(['sol'], { seed: 1, blockedWords: allLetters }).status, 'blocked_word_limit')
})

test('D9 quinquies — liste interdite vide ou absente : même grille qu\'avant', () => {
  const a = generateWordSearch(EXAMPLE, { seed: 8 })
  const b = generateWordSearch(EXAMPLE, { seed: 8, blockedWords: [] })
  assert.deepEqual(b.grid, a.grid)
  assert.equal(b.status, 'ok')
  assert.equal(b.attempts, 1)
})

test('D9 sexies — options blockedWords incorrectes : erreur explicite', () => {
  assert.throws(() => generateWordSearch(EXAMPLE, { blockedWords: 'ZUT' }), TypeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { blockedWords: [12] }), TypeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { blockedWords: [null] }), TypeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { blockedWords: ['--'] }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { blockedWords: [''] }), RangeError)
  assert.throws(() => generateWordSearch(EXAMPLE, { blockedWordsVersion: 3 }), TypeError)
  // accents et espaces dans un mot interdit : comparés en lettres de grille
  const r = generateWordSearch(['zütable'], { seed: 1, blockedWords: ['z u t'] })
  assert.deepEqual(r.rejected, [{ original: 'zütable', reason: 'blocked' }])
})
