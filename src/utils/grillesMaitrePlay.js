// Grilles du maître (L16, phase 6, lot B) : liste des grilles et préparation
// d'une grille pour l'affichage des mots croisés (EclipseGrid).
// Données : src/data/grilles-maitre.json (lot A, vérifié par grillesMaitre.js).
// Fonctions pures, sans React ni stockage : testées par grillesMaitrePlay.test.js.
// Décisions d'Isaac du 2026-11-09 (cadrage de la phase 6, P7, P9, P10, P11, P12
// option a) ; choix provisoires du developer : docs/grilles-du-maitre.md §8.

import { MASTER_GRID_STATUSES } from './grillesMaitre.js'

// Type de jeu propre à L16 dans les scores et la progression (P12 a ; nom :
// choix provisoire du developer, distinct de `crossword`)
export const GAME_TYPE_MASTER_GRID = 'masterGrid'
// 10 points par mot trouvé, comme les mots croisés (P10 a, D10)
export const POINTS_PER_WORD = 10
// Part des mots à trouver pour afficher « Terminer », comme les mots croisés
export const FINISH_RATIO = 0.7

// Libellés des matières des grilles (valeur interne en français, comme les
// données ; traduction anglaise : choix provisoire du developer)
const MATIERE_EN = {
  'Français': 'French',
  'Anglais': 'English',
  'Mathématiques': 'Mathematics',
  'Sciences (santé) / vocabulaire': 'Science (health) / vocabulary'
}
export const libelleMatiereGrille = (matiere, language) =>
  (language === 'fr' ? matiere : MATIERE_EN[matiere] ?? matiere)

// Langue d'une grille, dite dans la langue de l'interface
const LANGUE_LABEL = {
  fr: { fr: 'en français', en: 'in French' },
  en: { fr: 'en anglais', en: 'in English' }
}
export const libelleLangueGrille = (langue, language) =>
  LANGUE_LABEL[langue]?.[language === 'fr' ? 'fr' : 'en'] ?? langue

// Une grille est jouable à l'écran si chaque case est une lettre ou vide :
// les cases fixes (tiret) ne sont pas encore prises en charge par EclipseGrid
// (aucune dans le premier lot). Une telle grille n'est pas proposée.
export const isPlayableMasterGrid = (grid) =>
  Array.isArray(grid?.lignes) && grid.lignes.every(l => /^[A-Z.]+$/.test(l)) &&
  Array.isArray(grid.mots) && grid.mots.length > 0

// Statut minimal pour qu'une grille soit proposée aux élèves : « validée par
// Isaac » (auteur), ou plus loin dans la chaîne BROUILLON → À VÉRIFIER →
// VALIDÉE PAR ISAAC → VALIDÉ → PUBLIÉ (cadrage §4.1, P12 ; décision d'Isaac du
// 2026-11-09). BROUILLON et À VÉRIFIER ne sont jamais montrées.
export const MIN_VISIBLE_STATUS = 'VALIDÉE PAR ISAAC'
export const isVisibleStatus = (statut) => {
  const i = MASTER_GRID_STATUSES.indexOf(statut)
  return i >= 0 && i >= MASTER_GRID_STATUSES.indexOf(MIN_VISIBLE_STATUS)
}

// Grilles proposées à un profil : celles de son niveau, jouables, au statut
// « validée par Isaac » ou plus, quelle que soit leur langue. Les grilles
// dans la langue de l'interface viennent d'abord, puis par matière et titre
// (ordre stable, indépendant de l'ordre du fichier).
export function masterGridsForLevel(collection, level, language) {
  const grids = (collection?.grilles || []).filter(g => g.niveau === level && isVisibleStatus(g.statut) && isPlayableMasterGrid(g))
  const lang = language === 'fr' ? 'fr' : 'en'
  return grids.slice().sort((a, b) =>
    (a.langue === lang ? 0 : 1) - (b.langue === lang ? 0 : 1) ||
    a.matiere.localeCompare(b.matiere, 'fr') ||
    a.titre.localeCompare(b.titre, 'fr', { numeric: true }) ||
    a.id.localeCompare(b.id))
}

// Matières présentes dans une liste de grilles (ordre de la liste)
export const matieresOf = (grids) => [...new Set(grids.map(g => g.matiere))]

// Prépare une grille pour EclipseGrid : { wordsData, grid, placements, width,
// height, gridId }, même forme que createCrosswordGame (crosswordLayout.js).
// grid : tableau hauteur × largeur, lettre sans accent ou null ; placements :
// { word, row, col, dir, cells, clueNum, wordIdx } ; wordsData[wordIdx] :
// { definition, wordId (identifiant de progression, ex. G017-2V), wordLanguage }.
export function toEclipseGame(masterGrid) {
  if (!isPlayableMasterGrid(masterGrid)) return null
  const grid = masterGrid.lignes.map(l => [...l].map(ch => (ch === '.' ? null : ch)))
  const wordsData = masterGrid.mots.map(m => ({
    definition: m.definition,
    wordId: m.id,
    wordLanguage: masterGrid.langue,
    answer: m.reponse
  }))
  const placements = masterGrid.mots.map((m, wordIdx) => {
    const [dr, dc] = m.direction === 'down' ? [1, 0] : [0, 1]
    return {
      word: m.grille,
      row: m.ligne,
      col: m.colonne,
      dir: m.direction,
      cells: [...m.grille].map((_, i) => [m.ligne + dr * i, m.colonne + dc * i]),
      clueNum: m.numero,
      wordIdx
    }
  })
  return { gridId: masterGrid.id, width: masterGrid.largeur, height: masterGrid.hauteur, wordsData, grid, placements }
}

// Score d'une partie : 10 points par mot trouvé
export const masterGridScore = (foundCount) => foundCount * POINTS_PER_WORD

// « Terminer » visible à partir de 70 % des mots, comme les mots croisés
export const canFinish = (foundCount, wordCount) =>
  wordCount > 0 && foundCount >= Math.floor(wordCount * FINISH_RATIO)
