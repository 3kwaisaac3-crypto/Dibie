// Placement des mots et numérotation de la grille de mots croisés de Dibiè.
// Extrait de components/EclipseGrid.jsx pour pouvoir être testé sous Node.js
// (crosswordLayout.test.js). Aucune dépendance externe ; seul import interne :
// normalizeWord de ./wordSearchGenerator.js (générateur des mots mêlés).
//
// Mots composés exclus (décision d'Isaac du 2026-10-05, comme pour les mots
// mêlés) : même règle de normalisation que wordSearchGenerator.normalizeWord.
//
// Règles d'une grille de mots croisés appliquées ici :
// - un mot n'est écrit dans la grille que si tout son placement est valide
//   (aucune lettre laissée par un essai raté) ;
// - deux mots ne se touchent que par un croisement : cases avant et après
//   un mot vides, pas de mot collé côte à côte ;
// - numéros attribués après le placement, de 1 à N dans l'ordre de lecture
//   (ligne par ligne, de gauche à droite) ; un horizontal et un vertical qui
//   commencent sur la même case portent le même numéro.

import { normalizeWord } from './wordSearchGenerator.js'

export const GRID_SIZE = 15
export const MAX_WORD_LENGTH = 13
export const MAX_WORDS = 10
// En dessous, la grille n'est pas proposée (sujet grisé dans l'écran de choix)
export const MIN_PLACED_WORDS = 2
// Entrées du vocabulaire proposées à une grille (qui en place au plus MAX_WORDS)
export const VOCAB_PER_GAME = 12

// Normalise un mot pour la grille. Prend la première alternative pour les
// entrées bilingues du type "Hallway / Corridor", puis : majuscules, sans
// accents, ligatures développées (Œ -> OE). Retourne '' (mot écarté) si le
// mot contient autre chose que des lettres : espace, tiret, apostrophe,
// chiffre... ("T-SHIRT", "arc-en-ciel", "PRISE USB2" sont écartés).
export function sanitizeWord(text) {
  if (!text) return ''
  // Première alternative avant "/"
  return normalizeWord(String(text).split('/')[0])
}

// Normalise une lettre tapée par l'élève : accents retirés, majuscule.
// Retourne '' si ce n'est pas une lettre A-Z (chiffre, signe...).
export function normalizeTypedLetter(value) {
  const letter = String(value ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(-1)
  return /^[A-Z]$/.test(letter) ? letter : ''
}

const STEP = { across: [0, 1], down: [1, 0] }

export class ProGridGenerator {
  constructor(words) {
    this.words = words
    this.grid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
    // Directions des mots qui occupent chaque case ('across', 'down')
    this.dirs = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null).map(() => []))
    this.placements = []
  }

  generate() {
    if (this.words.length === 0) return { grid: this.grid, placements: [] }

    // Placer 1er mot au centre horizontal
    const word0 = this.words[0]
    const row0 = Math.floor(GRID_SIZE / 2)
    const col0 = Math.floor((GRID_SIZE - word0.length) / 2)

    this.placeWordSafe(word0, row0, col0, 'across', 0)

    // Placer autres mots avec intersections
    const notPlaced = []
    for (let i = 1; i < Math.min(this.words.length, MAX_WORDS); i++) {
      if (!this.placeWithIntersection(this.words[i], i)) notPlaced.push(i)
    }
    // Second essai : un mot refusé peut croiser un mot placé après lui
    for (const i of notPlaced) this.placeWithIntersection(this.words[i], i)

    this.numberClues()
    return { grid: this.grid, placements: this.placements }
  }

  letterAt(row, col) {
    if (row < 0 || col < 0 || row >= GRID_SIZE || col >= GRID_SIZE) return null
    return this.grid[row][col]
  }

  // Vérifie le placement complet sans rien écrire dans la grille
  canPlace(word, row, col, dir) {
    const [dr, dc] = STEP[dir]
    const endRow = row + dr * (word.length - 1)
    const endCol = col + dc * (word.length - 1)

    // Vérifier limites
    if (row < 0 || col < 0 || endRow >= GRID_SIZE || endCol >= GRID_SIZE) return false

    // Cases juste avant et juste après le mot : vides
    if (this.letterAt(row - dr, col - dc) || this.letterAt(endRow + dr, endCol + dc)) return false

    let crossings = 0
    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i
      const c = col + dc * i
      const current = this.grid[r][c]
      if (current) {
        // Croisement seulement : même lettre, et aucun mot dans la même direction
        if (current !== word[i] || this.dirs[r][c].includes(dir)) return false
        crossings++
      } else if (this.letterAt(r + dc, c + dr) || this.letterAt(r - dc, c - dr)) {
        // Pas de contact côte à côte avec un autre mot
        return false
      }
    }

    // Après le premier mot, chaque mot doit en croiser un autre
    return this.placements.length === 0 || crossings > 0
  }

  placeWordSafe(word, row, col, dir, wordIdx) {
    if (!this.canPlace(word, row, col, dir)) return false

    const [dr, dc] = STEP[dir]
    const placement = {
      wordIdx,
      word,
      row,
      col,
      dir,
      clueNum: 0, // attribué par numberClues()
      cells: []
    }

    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i
      const c = col + dc * i
      this.grid[r][c] = word[i]
      this.dirs[r][c].push(dir)
      placement.cells.push([r, c])
    }

    this.placements.push(placement)
    return true
  }

  // Numéros 1..N dans l'ordre de lecture ; case de départ partagée = même numéro
  numberClues() {
    const starts = [...new Set(this.placements.map(p => p.row * GRID_SIZE + p.col))]
      .sort((a, b) => a - b)
    for (const p of this.placements) {
      p.clueNum = starts.indexOf(p.row * GRID_SIZE + p.col) + 1
    }
  }

  placeWithIntersection(word, wordIdx) {
    // Chercher toutes les intersections possibles
    const intersections = []

    for (let pIdx = 0; pIdx < this.placements.length; pIdx++) {
      const placed = this.placements[pIdx]

      for (let pCharIdx = 0; pCharIdx < placed.word.length; pCharIdx++) {
        for (let wCharIdx = 0; wCharIdx < word.length; wCharIdx++) {
          if (word[wCharIdx].toUpperCase() === placed.word[pCharIdx].toUpperCase()) {
            const [pRow, pCol] = placed.cells[pCharIdx]
            const newDir = placed.dir === 'across' ? 'down' : 'across'

            let newRow, newCol

            if (newDir === 'down') {
              newRow = pRow - wCharIdx
              newCol = pCol
            } else {
              newRow = pRow
              newCol = pCol - wCharIdx
            }

            intersections.push({ newRow, newCol, newDir })
          }
        }
      }
    }

    // Essayer chaque intersection
    for (const { newRow, newCol, newDir } of intersections) {
      if (this.placeWordSafe(word, newRow, newCol, newDir, wordIdx)) {
        return true
      }
    }

    return false
  }
}

// Choisit les mots d'une grille à partir des entrées du vocabulaire, dans
// l'ordre reçu : MAX_WORDS au plus, mots vides (écartés) ou trop longs
// ignorés ; Bilingue = alternance français / anglais selon la position.
export function selectCrosswordWords(entries, puzzleType) {
  const wordsData = []
  for (let idx = 0; idx < entries.length && wordsData.length < MAX_WORDS; idx++) {
    const w = entries[idx]
    let text, definition, wordLanguage

    if (puzzleType === 'Français') {
      text = sanitizeWord(w.mot_fr)
      definition = w.def_fr
      wordLanguage = 'FR'
    } else if (puzzleType === 'Anglais') {
      text = sanitizeWord(w.mot_en)
      definition = w.def_en
      wordLanguage = 'EN'
    } else {
      // Bilingue : alterne français / anglais
      const isFrench = idx % 2 === 0
      text = sanitizeWord(isFrench ? w.mot_fr : w.mot_en)
      definition = isFrench ? w.def_fr : w.def_en
      wordLanguage = isFrench ? 'FR' : 'EN'
    }

    // Ignorer les mots vides ou trop longs pour la grille
    if (!text || text.length > MAX_WORD_LENGTH) continue

    wordsData.push({ text, definition, wordId: w.id, wordLanguage })
  }
  return wordsData
}

// Nombre de mots que la grille placerait pour ces entrées (génération
// déterministe : c'est exactement la grille qui sera proposée).
export function countPlacedWords(entries, puzzleType) {
  const wordsData = selectCrosswordWords(entries, puzzleType)
  if (wordsData.length < 2) return 0
  return generateCrossword(wordsData.map(d => d.text)).placements.length
}

export function isPlayableCrossword(entries, puzzleType) {
  return countPlacedWords(entries, puzzleType) >= MIN_PLACED_WORDS
}

// Sujets de l'écran de choix pour un niveau : seulement ceux qui ont au moins
// une entrée active à ce niveau, triés comme db.getAllSubjects (sort() par
// défaut). playable : la grille proposée (VOCAB_PER_GAME premières entrées
// actives du sujet, dans l'ordre) place au moins MIN_PLACED_WORDS mots.
export function crosswordSubjects(levelEntries, puzzleType) {
  const active = levelEntries.filter(v => v.actif !== false)
  const subjects = Array.from(new Set(active.map(v => v.sujet))).sort()
  return subjects.map(subject => ({
    subject,
    playable: isPlayableCrossword(active.filter(v => v.sujet === subject).slice(0, VOCAB_PER_GAME), puzzleType)
  }))
}

// Sujet sélectionné au premier affichage et à chaque changement de niveau :
// le sujet courant s'il existe et reste jouable à ce niveau, sinon le premier
// sujet jouable dans l'ordre d'affichage, sinon '' (aucun sujet jouable).
export function defaultCrosswordSubject(subjectList, current) {
  if (subjectList.some(s => s.subject === current && s.playable)) return current
  return subjectList.find(s => s.playable)?.subject || ''
}

// Génère la grille pour une liste de mots déjà normalisés.
// Deux essais : ordre reçu, puis mots les plus longs d'abord ; on garde la
// grille qui place le plus de mots (à égalité, l'ordre reçu). Résultat
// déterministe. wordIdx renvoie toujours à l'index dans `words`.
export function generateCrossword(words) {
  const first = new ProGridGenerator(words).generate()

  const byLength = words.slice(0, MAX_WORDS)
    .map((word, idx) => idx)
    .sort((a, b) => words[b].length - words[a].length || a - b)
  const second = new ProGridGenerator(byLength.map(idx => words[idx])).generate()
  second.placements.forEach(p => { p.wordIdx = byLength[p.wordIdx] })

  return second.placements.length > first.placements.length ? second : first
}
