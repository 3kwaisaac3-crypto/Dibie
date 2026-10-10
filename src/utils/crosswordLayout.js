// Placement des mots et numérotation de la grille de mots croisés de Dibiè.
// Extrait de components/EclipseGrid.jsx pour pouvoir être testé sous Node.js
// (crosswordLayout.test.js). Aucune dépendance externe ; seuls imports internes :
// normalizeWord et createRandom (générateur pseudo-aléatoire déterministe) de
// ./wordSearchGenerator.js (générateur des mots mêlés, non modifié).
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

import { normalizeWord, createRandom } from './wordSearchGenerator.js'

export const GRID_SIZE = 15
export const MAX_WORD_LENGTH = 13
// Comme les mots mêlés (décision d'Isaac du 2026-10-05) : 3 lettres minimum
export const MIN_WORD_LENGTH = 3
export const MAX_WORDS = 10
// En dessous, la grille n'est pas proposée (sujet grisé dans l'écran de choix)
export const MIN_PLACED_WORDS = 2
// Tirages essayés pour une graine avant de déclarer la grille indisponible
export const MAX_GRID_ATTEMPTS = 20
// Graine fixe du contrôle de grisage (voir isPlayableCrossword)
export const PLAYABILITY_SEED = 0

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

// Touche Retour arrière sur la case (row, col), sens de saisie `direction` :
// case remplie -> l'effacer, rester sur place ; case vide -> reculer d'une
// case dans le sens du mot et l'effacer ; début de mot -> ne rien faire.
// Retourne { clear: [r, c] | null, select: [r, c] | null }.
export function backspaceAction(grid, answers, row, col, direction) {
  if (answers[`${row}-${col}`]) return { clear: [row, col], select: null }
  const [dr, dc] = STEP[direction] || STEP.across
  const r = row - dr
  const c = col - dc
  if (!grid[r]?.[c]) return { clear: null, select: null }
  return { clear: [r, c], select: [r, c] }
}

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

// Mots du domaine (sujet) affiché dans le titre « Mots croisés — DOMAINE »,
// sous forme de grille : le sujet est coupé aux « / », espaces, tirets et
// apostrophes, chaque morceau normalisé comme un mot de grille (majuscules,
// sans accents) ; morceaux de moins de MIN_WORD_LENGTH lettres ignorés
// (« de », « la »...). « Matière / Mélanges » -> MATIERE, MELANGES.
export function domainWords(subject) {
  if (!subject) return []
  return String(subject)
    .split(/[/\s'’-]+/)
    .map(part => normalizeWord(part))
    .filter(word => word.length >= MIN_WORD_LENGTH)
}

// Vrai si le mot de grille donnerait la réponse via le titre : identique à
// un mot du domaine, au pluriel simple près, dans les deux sens : « S »
// final (MELANGE / MELANGES), « X » final (JEU / JEUX) ou « -AL » devenu
// « -AUX » (DECIMAL / DECIMAUX) (décision du 2026-10-09).
// Un mot qui n'en est qu'un début (JARDIN / JARDINAGE) n'est pas concerné.
export function matchesDomain(text, subject) {
  return domainWords(subject).some(d =>
    text === d || text + 'S' === d || d + 'S' === text ||
    text + 'X' === d || d + 'X' === text ||
    (text.endsWith('AL') && text.slice(0, -2) + 'AUX' === d) ||
    (d.endsWith('AL') && d.slice(0, -2) + 'AUX' === text))
}

// Choisit les mots d'une grille à partir des entrées du vocabulaire, dans
// l'ordre reçu : MAX_WORDS au plus ; mots vides (écartés), trop courts
// (moins de MIN_WORD_LENGTH lettres), trop longs ou déjà retenus (doublon
// après normalisation, décision du 2026-10-07) ou identiques au domaine
// du titre (matchesDomain, décision du 2026-10-07) ignorés ; Bilingue =
// alternance français / anglais selon la position.
export function selectCrosswordWords(entries, puzzleType) {
  const wordsData = []
  const seen = new Set()
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

    // Ignorer les mots vides, trop courts, trop longs ou en double
    if (!text || text.length < MIN_WORD_LENGTH || text.length > MAX_WORD_LENGTH) continue
    if (seen.has(text)) continue
    // Le titre « Mots croisés — DOMAINE » donnerait la réponse
    if (matchesDomain(text, w.sujet)) continue
    seen.add(text)

    wordsData.push({ text, definition, wordId: w.id, wordLanguage })
  }
  return wordsData
}

// Mention du nombre de lettres d'une définition : le nombre seul entre
// parenthèses, « (7) », quel que soit le type de grille ; une légende sous
// les définitions l'explique (décision d'Isaac du 2026-10-07).
export function letterCountLabel(count) {
  return `(${count})`
}

// Un mot est trouvé quand toutes ses cases portent ses lettres
export function isWordComplete(placement, answers) {
  return placement.cells.every(([r, c], i) => answers[`${r}-${c}`] === placement.word[i])
}

// Mots dont l'état change quand la case (row, col) passe de before à after :
// found = devenus complets, lost = complets avant et plus maintenant (lettre
// effacée ou remplacée ; une case de croisement peut en toucher deux).
export function answerChanges(placements, before, after, row, col) {
  const found = []
  const lost = []
  for (const p of placements) {
    if (!p.cells.some(([r, c]) => r === row && c === col)) continue
    const was = isWordComplete(p, before)
    const now = isWordComplete(p, after)
    if (!was && now) found.push(p)
    if (was && !now) lost.push(p)
  }
  return { found, lost }
}

// Mélange des entrées selon la graine (Fisher-Yates, générateur des mots
// mêlés). Tri préalable par id : le résultat ne dépend pas de l'ordre des
// données, seulement de leur contenu et de la graine.
function shuffleEntries(entries, seed) {
  const pool = entries.slice().sort((x, y) => String(x.id).localeCompare(String(y.id)))
  const random = createRandom(seed)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool
}

// Prépare une grille à partir de TOUTES les entrées actives d'un sujet :
// tirage au hasard selon la graine (même graine, mêmes entrées -> même
// grille), puis sélection (selectCrosswordWords) et placement. Si le tirage
// place moins de MIN_PLACED_WORDS mots, nouveaux tirages déterministes
// dérivés de la graine (MAX_GRID_ATTEMPTS au plus, comme les mots mêlés).
// Retourne { requestedSeed, seed, attempts, wordsData, grid, placements }
// (seed = graine du tirage retenu, celle affichée « Grille n° »), ou null.
export function createCrosswordGame(entries, puzzleType, seed) {
  const active = entries.filter(v => v && v.actif !== false)
  if (active.length < MIN_PLACED_WORDS) return null
  const nextSeed = createRandom(seed ^ 0x9e3779b9)
  let attemptSeed = seed
  for (let attempt = 1; attempt <= MAX_GRID_ATTEMPTS; attempt++) {
    const wordsData = selectCrosswordWords(shuffleEntries(active, attemptSeed), puzzleType)
    if (wordsData.length >= MIN_PLACED_WORDS) {
      const { grid, placements } = generateCrossword(wordsData.map(d => d.text))
      if (placements.length >= MIN_PLACED_WORDS) {
        return { requestedSeed: seed, seed: attemptSeed, attempts: attempt, wordsData, grid, placements }
      }
    }
    // graine suivante : entier de 0 à 2^32-1, comme newSeed() des mots mêlés
    attemptSeed = Math.floor(nextSeed() * 4294967296)
  }
  return null
}

// Sujet jouable : ses entrées actives donnent une grille d'au moins
// MIN_PLACED_WORDS mots pour la graine de contrôle PLAYABILITY_SEED (avec
// ses tirages de secours). Un sujet ayant moins de 2 mots utilisables
// (3 lettres minimum, mots composés et doublons écartés) n'est jamais jouable.
export function isPlayableCrossword(entries, puzzleType) {
  return createCrosswordGame(entries, puzzleType, PLAYABILITY_SEED) !== null
}

// Sujets de l'écran de choix pour un niveau : seulement ceux qui ont au moins
// une entrée active à ce niveau, triés comme db.getAllSubjects (sort() par
// défaut). playable : voir isPlayableCrossword (toutes les entrées actives).
export function crosswordSubjects(levelEntries, puzzleType) {
  const active = levelEntries.filter(v => v.actif !== false)
  const subjects = Array.from(new Set(active.map(v => v.sujet))).sort()
  return subjects.map(subject => ({
    subject,
    playable: isPlayableCrossword(active.filter(v => v.sujet === subject), puzzleType)
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
