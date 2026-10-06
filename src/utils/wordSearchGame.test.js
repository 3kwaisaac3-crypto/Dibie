// Tests de la préparation d'une partie de mots mêlés — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  createWordSearchGame,
  selectWords,
  cellsBetween,
  findPlacement,
  placementCells,
  WORD_SEARCH_SETTINGS,
  WORD_SEARCH_LEVELS,
  BLOCKED_WORDS
} from './wordSearchGame.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))

test('G1 — chaque niveau : grille ok, taille du niveau, tous les mots choisis placés', () => {
  for (const level of WORD_SEARCH_LEVELS) {
    for (const seed of [0, 1, 42, 123456789, 4294967295]) {
      const { result, wordIds } = createWordSearchGame(vocabulary, level, seed)
      assert.equal(result.status, 'ok')
      assert.equal(result.size, WORD_SEARCH_SETTINGS[level].size)
      assert.equal(wordIds.length, WORD_SEARCH_SETTINGS[level].wordCount)
      assert.equal(result.placements.length, wordIds.length)
      assert.deepEqual(result.directions, ['across', 'down'])
    }
  }
})

test('G2 — même graine, même partie ; graine différente, liste différente', () => {
  const a = createWordSearchGame(vocabulary, 'CE1-CE2', 2026)
  const b = createWordSearchGame(vocabulary, 'CE1-CE2', 2026)
  const c = createWordSearchGame(vocabulary, 'CE1-CE2', 2027)
  assert.deepEqual(a, b)
  assert.notDeepEqual(a.wordIds, c.wordIds)
})

test('G3 — sélection : niveau respecté, mots simples, affichage = mot_fr tel quel', () => {
  const byId = new Map(vocabulary.map(v => [v.id, v]))
  for (const level of WORD_SEARCH_LEVELS) {
    for (let seed = 0; seed < 50; seed++) {
      for (const w of selectWords(vocabulary, level, seed)) {
        const v = byId.get(w.id)
        assert.equal(v.niveau_fr, level)
        assert.equal(w.affichage, v.mot_fr)
        assert.equal(w.grille, v.mot_fr)
        assert.doesNotMatch(w.affichage, /[\s\-'’]/)
      }
    }
  }
})

test('G4 — aucun mot choisi contenu dans un autre', () => {
  for (let seed = 0; seed < 200; seed++) {
    const { result } = createWordSearchGame(vocabulary, 'CM1-CM2', seed)
    const words = result.placements.map(p => p.word)
    for (const w of words) assert.ok(!words.some(o => o !== w && o.includes(w)), w)
  }
})

test('G5 — liste de mots interdits vide (aucune liste réelle n\'existe)', () => {
  assert.deepEqual([...BLOCKED_WORDS], [])
})

test('G6 — sélection dans la grille : segment → ou ↓, ordre des clics indifférent, jamais en biais non autorisé', () => {
  const dirs = ['across', 'down']
  assert.deepEqual(cellsBetween({ row: 1, col: 1 }, { row: 1, col: 3 }, dirs).cells.length, 3)
  const reversed = cellsBetween({ row: 4, col: 2 }, { row: 1, col: 2 }, dirs)
  assert.equal(reversed.direction, 'down')
  assert.deepEqual([reversed.row, reversed.col, reversed.length], [1, 2, 4])
  assert.equal(cellsBetween({ row: 0, col: 0 }, { row: 2, col: 2 }, dirs), null)
  assert.equal(cellsBetween({ row: 0, col: 0 }, { row: 2, col: 2 }, [...dirs, 'diagonal']).direction, 'diagonal')
  assert.equal(cellsBetween({ row: 0, col: 0 }, { row: 1, col: 2 }, dirs), null)
  assert.equal(cellsBetween({ row: 2, col: 2 }, { row: 2, col: 2 }, dirs), null)
})

test('G7 — chaque mot placé est retrouvé par sa sélection (début/fin, dans les deux ordres)', () => {
  const { result } = createWordSearchGame(vocabulary, 'CE1-CE2', 7)
  result.placements.forEach((p, i) => {
    const cells = placementCells(p)
    const first = cells[0]
    const last = cells[cells.length - 1]
    assert.equal(findPlacement(result.placements, cellsBetween(first, last, result.directions)), i)
    assert.equal(findPlacement(result.placements, cellsBetween(last, first, result.directions)), i)
    assert.equal(cells.map(c => result.grid[c.row][c.col]).join(''), p.word)
  })
  assert.equal(findPlacement(result.placements, null), -1)
})
