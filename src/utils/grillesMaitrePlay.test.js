// Tests des Grilles du maître à l'écran (L16, phase 6, lot B) et de la
// non-régression des mots croisés générés — lancer avec : node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  GAME_TYPE_MASTER_GRID,
  POINTS_PER_WORD,
  masterGridsForLevel,
  matieresOf,
  libelleMatiereGrille,
  libelleLangueGrille,
  isPlayableMasterGrid,
  isVisibleStatus,
  MIN_VISIBLE_STATUS,
  toEclipseGame,
  masterGridScore,
  canFinish
} from './grillesMaitrePlay.js'
import { createCrosswordGame, answerChanges, isWordComplete, GRID_SIZE } from './crosswordLayout.js'

const collection = JSON.parse(readFileSync(new URL('../data/grilles-maitre.json', import.meta.url), 'utf8'))
const vocab = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const byId = id => collection.grilles.find(g => g.id === id)

test('gameType propre à L16, 10 points par mot (P10 a, P12 a)', () => {
  assert.equal(GAME_TYPE_MASTER_GRID, 'masterGrid')
  assert.notEqual(GAME_TYPE_MASTER_GRID, 'crossword')
  assert.equal(POINTS_PER_WORD, 10)
  assert.equal(masterGridScore(0), 0)
  assert.equal(masterGridScore(7), 70)
})

test('« Terminer » à partir de 70 % des mots, comme les mots croisés', () => {
  assert.equal(canFinish(0, 0), false)
  assert.equal(canFinish(6, 10), false)
  assert.equal(canFinish(7, 10), true)
  assert.equal(canFinish(15, 23), false) // floor(23 × 0,7) = 16
  assert.equal(canFinish(16, 23), true)
})

test('Liste par niveau du profil : SIL-CP 0, CE1-CE2 5, CM1-CM2 7 grilles', () => {
  assert.deepEqual(masterGridsForLevel(collection, 'SIL-CP', 'fr'), [])
  const ce = masterGridsForLevel(collection, 'CE1-CE2', 'fr').map(g => g.id)
  assert.deepEqual([...ce].sort(), ['G017', 'G018', 'G019', 'G168', 'G180'])
  const cm = masterGridsForLevel(collection, 'CM1-CM2', 'fr').map(g => g.id)
  assert.deepEqual([...cm].sort(), ['G085', 'G093', 'G140', 'G153', 'G172', 'G173', 'G183'])
  assert.deepEqual(masterGridsForLevel(collection, undefined, 'fr'), [])
  assert.deepEqual(masterGridsForLevel(null, 'CM1-CM2', 'fr'), [])
})

test('Grilles de la langue de l\'interface d\'abord, puis matière et titre', () => {
  const fr = masterGridsForLevel(collection, 'CE1-CE2', 'fr')
  assert.deepEqual(fr.map(g => g.id), ['G180', 'G168', 'G017', 'G018', 'G019'])
  const en = masterGridsForLevel(collection, 'CE1-CE2', 'en')
  assert.deepEqual(en.map(g => g.id), ['G168', 'G017', 'G018', 'G019', 'G180'])
  // Ordre indépendant de celui du fichier
  const reversed = { ...collection, grilles: [...collection.grilles].reverse() }
  assert.deepEqual(masterGridsForLevel(reversed, 'CM1-CM2', 'fr').map(g => g.id),
    masterGridsForLevel(collection, 'CM1-CM2', 'fr').map(g => g.id))
  assert.deepEqual(matieresOf(fr), ['Sciences (santé) / vocabulaire', 'Anglais', 'Mathématiques'])
})

test('Matières et langues traduites pour toutes les grilles du fichier', () => {
  for (const g of collection.grilles) {
    assert.equal(libelleMatiereGrille(g.matiere, 'fr'), g.matiere)
    assert.notEqual(libelleMatiereGrille(g.matiere, 'en'), g.matiere, `${g.id} : matière sans traduction`)
    assert.match(libelleLangueGrille(g.langue, 'fr'), /^en (français|anglais)$/)
    assert.match(libelleLangueGrille(g.langue, 'en'), /^in (French|English)$/)
  }
})

test('Les 12 grilles tiennent dans 15 × 15 et sont jouables à l\'écran', () => {
  assert.equal(collection.grilles.length, 12)
  for (const g of collection.grilles) {
    assert.ok(g.largeur <= 15 && g.hauteur <= 15, `${g.id} : ${g.largeur} × ${g.hauteur}`)
    assert.ok(isPlayableMasterGrid(g), g.id)
  }
  // Plus grande grille : 13 colonnes (G085, 13 × 15)
  assert.equal(Math.max(...collection.grilles.map(g => g.largeur)), 13)
  assert.deepEqual([byId('G085').largeur, byId('G085').hauteur], [13, 15])
})

test('Seules les grilles « validée par Isaac » ou plus sont proposées (décision d\'Isaac du 2026-11-09)', () => {
  assert.equal(MIN_VISIBLE_STATUS, 'VALIDÉE PAR ISAAC')
  assert.deepEqual(['BROUILLON', 'À VÉRIFIER', 'VALIDÉE PAR ISAAC', 'VALIDÉ', 'PUBLIÉ'].map(isVisibleStatus), [false, false, true, true, true])
  assert.equal(isVisibleStatus(undefined), false)
  assert.equal(isVisibleStatus('FINI'), false)
  // Les 12 grilles du fichier sont validées par Isaac
  assert.ok(collection.grilles.every(g => g.statut === 'VALIDÉE PAR ISAAC'))
  // Une grille repassée en BROUILLON ou À VÉRIFIER disparaît de la liste ; VALIDÉ et PUBLIÉ restent
  const withStatus = (id, statut) => ({ ...collection, grilles: collection.grilles.map(g => (g.id === id ? { ...g, statut } : g)) })
  const ids = (coll) => masterGridsForLevel(coll, 'CE1-CE2', 'fr').map(g => g.id)
  for (const statut of ['BROUILLON', 'À VÉRIFIER']) {
    assert.deepEqual(ids(withStatus('G017', statut)), ['G180', 'G168', 'G018', 'G019'])
  }
  for (const statut of ['VALIDÉ', 'PUBLIÉ']) {
    assert.deepEqual(ids(withStatus('G017', statut)), ['G180', 'G168', 'G017', 'G018', 'G019'])
  }
})

test('Une grille avec une case fixe (tiret) n\'est pas proposée', () => {
  const g = structuredClone(byId('G017'))
  g.lignes[0] = g.lignes[0].replace(/[A-Z]/, '-')
  assert.equal(isPlayableMasterGrid(g), false)
  assert.equal(toEclipseGame(g), null)
  const coll = { ...collection, grilles: [g] }
  assert.deepEqual(masterGridsForLevel(coll, 'CE1-CE2', 'fr'), [])
})

test('toEclipseGame : même forme que createCrosswordGame, taille et cases exactes', () => {
  for (const mg of collection.grilles) {
    const game = toEclipseGame(mg)
    assert.equal(game.gridId, mg.id)
    assert.equal(game.grid.length, mg.hauteur)
    assert.ok(game.grid.every(row => row.length === mg.largeur))
    assert.equal(game.width, mg.largeur)
    assert.equal(game.height, mg.hauteur)
    mg.lignes.forEach((l, r) => [...l].forEach((ch, c) => assert.equal(game.grid[r][c], ch === '.' ? null : ch)))
    assert.equal(game.placements.length, mg.mots.length)
    game.placements.forEach((p, i) => {
      const m = mg.mots[i]
      assert.equal(p.wordIdx, i)
      assert.equal(p.clueNum, m.numero)
      assert.equal(p.dir, m.direction)
      assert.equal(p.word, m.grille)
      assert.deepEqual(p.cells[0], [m.ligne, m.colonne])
      p.cells.forEach(([r, c], k) => assert.equal(game.grid[r][c], p.word[k], `${m.id} case ${k}`))
      // Identifiant de progression : grille + numéro + sens (P12 a)
      assert.equal(game.wordsData[p.wordIdx].wordId, m.id)
      assert.match(m.id, new RegExp(`^${mg.id}-${m.numero}[HV]$`))
      assert.equal(game.wordsData[p.wordIdx].definition, m.definition)
      assert.equal(game.wordsData[p.wordIdx].answer, m.reponse)
      assert.equal(game.wordsData[p.wordIdx].wordLanguage, mg.langue)
    })
  }
})

test('Saisie comme les mots croisés : chaque mot rempli est trouvé, une lettre effacée le perd', () => {
  for (const mg of collection.grilles) {
    const { placements, grid } = toEclipseGame(mg)
    let answers = {}
    const found = new Set()
    grid.forEach((row, r) => row.forEach((ch, c) => {
      if (!ch) return
      const after = { ...answers, [`${r}-${c}`]: ch }
      answerChanges(placements, answers, after, r, c).found.forEach(p => found.add(placements[p.wordIdx].clueNum + p.dir))
      answers = after
    }))
    assert.equal(found.size, placements.length, mg.id)
    assert.ok(placements.every(p => isWordComplete(p, answers)))
    // Effacer la première lettre du premier mot : ce mot est perdu
    const p0 = placements[0]
    const [r0, c0] = p0.cells[0]
    const erased = { ...answers, [`${r0}-${c0}`]: '' }
    const { lost } = answerChanges(placements, answers, erased, r0, c0)
    assert.ok(lost.includes(p0))
  }
})

test('Accents : les cases sont sans accents, la réponse affichée les garde (G085)', () => {
  const mg = byId('G085')
  const game = toEclipseGame(mg)
  const accented = game.wordsData.filter(w => /[À-ÿ]/.test(w.answer))
  assert.equal(accented.length, 6) // MAÎTRE, MÛR, MÈTRE, LÀ, MÛRE, ÈRE
  for (const w of accented) {
    const p = game.placements.find(x => game.wordsData[x.wordIdx] === w)
    assert.match(p.word, /^[A-Z]+$/)
  }
})

// --- Non-régression des mots croisés générés ----------------------------------
// Empreinte des grilles générées pour tous les sujets de chaque niveau, les
// 3 types et la graine 12345, calculée sur main (603393b) avant le lot B
// (même valeur après : crosswordLayout.js n'est pas modifié par le lot B).
// Si ce test échoue, les mots croisés générés ont changé.
const CROSSWORD_FINGERPRINT = 'b7a7f07e6c26d8e4ea438eb22233f511455492ca24f8e53e34da71373dbafe18'
const CROSSWORD_GAMES = 321

test('Non-régression : les mots croisés générés sont identiques à ceux d\'avant le lot B', () => {
  const h = createHash('sha256')
  let n = 0
  for (const level of ['SIL-CP', 'CE1-CE2', 'CM1-CM2']) {
    const subjects = [...new Set(vocab.filter(v => v.niveau_fr === level).map(v => v.sujet))].sort()
    for (const s of subjects) {
      for (const t of ['Bilingue', 'Français', 'Anglais']) {
        const g = createCrosswordGame(vocab.filter(v => v.niveau_fr === level && v.sujet === s), t, 12345)
        if (g) n++
        h.update(JSON.stringify(g && { seed: g.seed, grid: g.grid, placements: g.placements, w: g.wordsData.map(d => [d.wordId, d.definition]) }))
      }
    }
  }
  assert.equal(n, CROSSWORD_GAMES)
  assert.equal(h.digest('hex'), CROSSWORD_FINGERPRINT)
})

test('Non-régression : les mots croisés générés restent 15 × 15 (colonnes du CSS inchangées)', () => {
  assert.equal(GRID_SIZE, 15)
  for (const level of ['SIL-CP', 'CE1-CE2', 'CM1-CM2']) {
    const subjects = [...new Set(vocab.filter(v => v.niveau_fr === level).map(v => v.sujet))].sort()
    for (const s of subjects) {
      const g = createCrosswordGame(vocab.filter(v => v.niveau_fr === level && v.sujet === s), 'Bilingue', 7)
      if (!g) continue
      assert.equal(g.grid.length, GRID_SIZE, s)
      assert.ok(g.grid.every(row => row.length === GRID_SIZE), s)
    }
  }
})
