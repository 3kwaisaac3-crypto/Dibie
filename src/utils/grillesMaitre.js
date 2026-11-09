// Vérificateur des Grilles du maître (L16, phase 6, lot A).
// Contrôle un fichier de données produit par scripts/grilles-maitre-import.js
// (src/data/grilles-maitre.json), sans réutiliser le code de l'importateur :
// les cases, la numérotation et les corrections sont recalculées ici.
// Ne lève jamais d'exception sur une entrée mal formée : { ok, errors }.

import { NIVEAU_EN } from '../data/niveaux.js'

// Statuts de validation (cadrage de la phase 6, §4.1 ; educator.md §48)
export const MASTER_GRID_STATUSES = ['BROUILLON', 'À VÉRIFIER', 'VALIDÉE PAR ISAAC', 'VALIDÉ', 'PUBLIÉ']
export const MASTER_GRID_LANGUAGES = ['fr', 'en']
const NIVEAUX = Object.keys(NIVEAU_EN)
const DIRECTIONS = { across: [0, 1], down: [1, 0] }

// Lettres de grille d'une réponse : majuscules, accents retirés (le tiret reste)
const gridLetters = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

// Texte mal converti : caractère de remplacement, contrôle C1, ou UTF-8 lu
// en cp1252 : octet de tête Â, Ã ou Å suivi d'un octet de continuation
// (0x80-0xBF) tel que cp1252 l'affiche (« Ã© » pour é, « Ã‰ » pour É).
export const MOJIBAKE = /[ÂÃÅ][\u00a0-\u00bf€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/
export function badEncoding(text) {
  return /\ufffd|[\u0080-\u009f]/.test(String(text)) || MOJIBAKE.test(String(text))
}

const isText = v => typeof v === 'string' && v.trim() !== ''

function checkCorrections(grid, word, errors) {
  // Recalcul : corrections du mot, dans l'ordre, puis espaces normalisées
  let text = word.definitionOrigine
  for (const c of grid.corrections.filter(x => x.mot === word.id)) {
    const parts = text.split(c.avant)
    if (parts.length !== 2) { errors.push(`${c.id} : fragment d'origine absent ou répété dans ${word.id}`); return }
    text = parts.join(c.apres)
  }
  const expected = text.replace(/[ \t\u00a0]{2,}/g, ' ').trim()
  if (expected !== word.definition) errors.push(`${word.id} : définition différente du texte d'origine corrigé`)
}

export function verifyMasterGrid(grid) {
  const errors = []
  if (!grid || typeof grid !== 'object') return { ok: false, errors: ['grille absente'] }
  const id = grid.id
  const e = msg => errors.push(`${id} : ${msg}`)

  // Métadonnées (cadrage §4.1)
  for (const f of ['id', 'titre', 'titreOrigine', 'matiere', 'theme', 'auteur', 'type_activite']) if (!isText(grid[f])) e(`champ ${f} absent`)
  if (!NIVEAUX.includes(grid.niveau)) e(`niveau inconnu : ${grid.niveau}`)
  if (!isText(grid.niveauStatut)) e('niveauStatut absent')
  if (!MASTER_GRID_LANGUAGES.includes(grid.langue)) e(`langue inconnue : ${grid.langue}`)
  if (!MASTER_GRID_STATUSES.includes(grid.statut)) e(`statut inconnu : ${grid.statut}`)
  if (!isText(grid.droits?.statut)) e('droits absents')
  for (const f of ['classe', 'sous_systeme', 'competence', 'objectif', 'difficulte', 'ligne_programme']) if (!(f in grid)) e(`champ ${f} manquant (null permis)`)
  const src = grid.source || {}
  if (!/^[0-9a-f]{64}$/.test(src.sha256 || '')) e('empreinte SHA-256 absente ou invalide')
  if (!isText(src.chemin) || !Array.isArray(src.copies) || !src.copies.includes(src.chemin)) e('chemin source absent')
  if (!isText(src.logiciel)) e('version du logiciel absente')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src.dateImport || '')) e('date d\'import absente')

  // Grille
  const { largeur, hauteur, lignes, mots } = grid
  if (!Number.isInteger(largeur) || !Number.isInteger(hauteur) || !Array.isArray(lignes) || lignes.length !== hauteur ||
      lignes.some(l => typeof l !== 'string' || l.length !== largeur || !/^[A-Z.-]+$/.test(l))) {
    e('lignes de la grille incohérentes avec largeur × hauteur')
    return { ok: false, errors }
  }
  if (!Array.isArray(mots) || !mots.length) { e('aucun mot'); return { ok: false, errors } }
  // Recadrage : bords non vides
  const colEmpty = c => lignes.every(l => l[c] === '.')
  if (!/[^.]/.test(lignes[0]) || !/[^.]/.test(lignes[hauteur - 1]) || colEmpty(0) || colEmpty(largeur - 1)) e('grille non recadrée')

  const covered = new Set()
  const ids = new Set()
  const startKeys = new Set()
  for (const w of mots) {
    const step = DIRECTIONS[w.direction]
    if (!step) { e(`sens inconnu : ${w.direction}`); continue }
    if (ids.has(w.id)) e(`identifiant de mot en double : ${w.id}`)
    ids.add(w.id)
    if (w.id !== `${id}-${w.numero}${w.direction === 'across' ? 'H' : 'V'}`) e(`identifiant de mot inattendu : ${w.id}`)
    const sk = `${w.ligne},${w.colonne},${w.direction}`
    if (startKeys.has(sk)) e(`deux mots au même départ dans le même sens : ${w.id}`)
    startKeys.add(sk)
    if (typeof w.grille !== 'string' || !/^[A-Z-]+$/.test(w.grille) || w.grille.length !== w.longueur) e(`${w.id} : cases de la réponse invalides`)
    if (gridLetters(w.reponse) !== w.grille) e(`${w.id} : réponse ${w.reponse} différente des cases ${w.grille}`)
    for (let i = 0; i < (w.grille || '').length; i++) {
      const r = w.ligne + step[0] * i
      const c = w.colonne + step[1] * i
      if (r < 0 || c < 0 || r >= hauteur || c >= largeur) { e(`${w.id} : sort de la grille`); break }
      if (lignes[r][c] !== w.grille[i]) e(`${w.id} : conflit ligne ${r + 1}, colonne ${c + 1} (${lignes[r][c]} / ${w.grille[i]})`)
      covered.add(`${r},${c}`)
    }
    for (const f of ['definition', 'definitionOrigine']) {
      if (!isText(w[f])) e(`${w.id} : ${f} absente`)
      else if (badEncoding(w[f])) e(`${w.id} : ${f} mal encodée`)
    }
    if (isText(w.definition) && w.definition !== w.definition.replace(/[ \t\u00a0]{2,}/g, ' ').trim()) e(`${w.id} : espaces non normalisées`)
  }
  for (const f of ['titre', 'titreOrigine']) if (badEncoding(grid[f])) e(`${f} mal encodé`)
  lignes.forEach((l, r) => [...l].forEach((ch, c) => {
    if (ch !== '.' && !covered.has(`${r},${c}`)) e(`case ligne ${r + 1}, colonne ${c + 1} occupée par aucun mot`)
  }))

  // Numérotation recalculée : départs distincts dans l'ordre de lecture
  const starts = [...new Set(mots.map(w => w.ligne * largeur + w.colonne))].sort((a, b) => a - b)
  for (const w of mots) {
    const expected = starts.indexOf(w.ligne * largeur + w.colonne) + 1
    if (w.numero !== expected) e(`${w.id} : numéro ${w.numero}, attendu ${expected}`)
  }

  // Corrections : texte d'origine conservé, corrections seules appliquées
  if (!Array.isArray(grid.corrections) || !Array.isArray(grid.normalisations)) e('liste des corrections ou des normalisations absente')
  else {
    for (const c of grid.corrections) {
      if (!/^C\d+$/.test(c.id || '') || !isText(c.avant) || typeof c.apres !== 'string' || !isText(c.decision)) e(`correction mal formée : ${JSON.stringify(c)}`)
      if (!mots.some(w => w.id === c.mot)) e(`${c.id} : mot ${c.mot} absent`)
    }
    for (const w of mots) if (isText(w.definitionOrigine) && isText(w.definition)) checkCorrections(grid, w, errors)
  }
  return { ok: errors.length === 0, errors }
}

export function verifyMasterCollection(collection) {
  if (!collection || collection.format !== 'dibie-grilles-maitre' || !Array.isArray(collection.grilles)) {
    return { ok: false, errors: ['pas un fichier de Grilles du maître'] }
  }
  const errors = []
  const seen = new Set()
  for (const g of collection.grilles) {
    if (seen.has(g?.id)) errors.push(`identifiant de grille en double : ${g.id}`)
    seen.add(g?.id)
    errors.push(...verifyMasterGrid(g).errors)
  }
  return { ok: errors.length === 0, errors }
}
