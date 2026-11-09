// Importation des grilles EclipseCrossword (.ecw) d'Isaac — Grilles du maître
// (L16, phase 6, lot A). Fonctions pures, sans accès aux fichiers : le script
// scripts/grilles-maitre-import.js lit les .ecw (lecture seule) et leur passe
// les octets. Utilisé au moment du développement, jamais dans l'application.
//
// Format .ecw (texte, cp1252), vérifié par le relevé du 2026-11-09 :
//   ; commentaires (dont « EclipseCrossword (1.3.63) »)
//   Title: … / Width: 15 / Height: 15 / CodePage: 0 / Author: … / Copyright: …
//   * Across words
//   MOT:  x, y:  définition        (x = colonne, y = ligne, base 1)
//   * Down words
//   …
// La grille et les numéros ne sont pas stockés : ils sont reconstruits ici.
// Chaque caractère de la réponse occupe une case, tiret compris (mode « cases »
// du relevé, 0 conflit sur les 184 .ecw analysés).
//
// Décisions appliquées (cadrage de la phase 6, P5 et P6, validé le 2026-11-09) :
// aucune recréation ; corrections de fond seulement si Isaac les a acceptées,
// texte d'origine conservé ; normalisation typographique journalisée.

import { MOJIBAKE } from './grillesMaitre.js'

const decoder = new TextDecoder('windows-1252')

export class EcwImportError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'EcwImportError'
    this.code = code
  }
}

// Octets cp1252 -> texte (UTF-8 une fois écrit en JSON). Refuse un texte qui
// contient un caractère de remplacement, un caractère de contrôle C1 (octet
// non défini en cp1252 : 0x81, 0x8D, 0x8F, 0x90, 0x9D) ou une suite typique
// d'un fichier déjà en UTF-8 lu en cp1252 (MOJIBAKE : « Ã© », « Ã‰ »).
export function decodeEcw(bytes) {
  const text = decoder.decode(bytes)
  if (text.includes('\ufffd')) throw new EcwImportError('encodage', 'caractère de remplacement (U+FFFD) après conversion')
  if (/[\u0080-\u009f]/.test(text)) throw new EcwImportError('encodage', 'octet non défini en cp1252')
  if (MOJIBAKE.test(text)) throw new EcwImportError('encodage', 'texte qui semble déjà en UTF-8 (lu en cp1252)')
  return text
}

// Texte .ecw -> { version, entete, mots[] }. Toute ligne non reconnue après
// le début des sections est une erreur (rien n'est ignoré en silence).
export function parseEcw(text) {
  if (!/^\s*;/.test(text)) throw new EcwImportError('format', 'pas un fichier .ecw texte (en-tête « ; » absent)')
  const entete = {}
  const mots = []
  let version = null
  let section = null
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    if (line.startsWith(';')) {
      const v = line.match(/EclipseCrossword\s*\(([^)]+)\)/i)
      if (v && !version) version = v[1]
      continue
    }
    const sec = line.match(/^\*\s*(Across|Down)\s+words/i)
    if (sec) { section = sec[1].toLowerCase() === 'across' ? 'across' : 'down'; continue }
    if (!section) {
      const h = line.match(/^(\w+):\s*(.*)$/)
      if (h) { entete[h[1]] = h[2].trim(); continue }
      throw new EcwImportError('format', `ligne d'en-tête non reconnue : ${line}`)
    }
    const m = line.match(/^([^:]+):\s*(\d+)\s*,\s*(\d+)\s*:\s*(.*)$/)
    if (!m) throw new EcwImportError('format', `ligne de mot non reconnue : ${line}`)
    mots.push({ reponse: m[1].trim(), x: Number(m[2]), y: Number(m[3]), direction: section, definition: m[4] })
  }
  const largeur = Number(entete.Width)
  const hauteur = Number(entete.Height)
  if (!Number.isInteger(largeur) || !Number.isInteger(hauteur) || largeur < 1 || hauteur < 1) {
    throw new EcwImportError('format', 'Width ou Height absent ou invalide')
  }
  if (!mots.length) throw new EcwImportError('format', 'aucun mot')
  return { version, entete, largeur, hauteur, mots }
}

// Réponse -> cases de la grille : majuscules sans accents ; le tiret occupe
// une case (case fixe, non saisie par l'élève). Toute autre forme (espace,
// apostrophe, chiffre, ligature Œ / Æ) est refusée au lot A : le comportement
// d'EclipseCrossword n'a été vérifié que pour le tiret (cadrage §10, point 5).
export function answerCells(reponse) {
  const cells = [...String(reponse).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()]
  const bad = cells.filter(ch => !/^[A-Z-]$/.test(ch))
  if (bad.length) throw new EcwImportError('caractere', `réponse « ${reponse} » : caractère non pris en charge (${[...new Set(bad)].join(' ')})`)
  if (!cells.some(ch => ch !== '-')) throw new EcwImportError('caractere', `réponse « ${reponse} » sans lettre`)
  return cells
}

const STEP = { across: [0, 1], down: [1, 0] }

// Reconstruit la grille aux positions du fichier, contrôle les croisements
// (0 conflit exigé) et les bords déclarés, recadre sur la zone occupée et
// numérote dans l'ordre de lecture (ligne par ligne, de gauche à droite ; un
// horizontal et un vertical qui partent de la même case ont le même numéro,
// comme numberClues des mots croisés).
// Retourne { largeur, hauteur, lignes[], mots[] } ; lignes : une chaîne par
// ligne, « . » = case vide, « - » = tiret, A-Z = lettre. Positions en base 0
// dans la grille recadrée.
export function buildGrid(parsed) {
  const cells = new Map()
  const conflits = []
  const placed = parsed.mots.map(w => {
    const lettres = answerCells(w.reponse)
    const [dr, dc] = STEP[w.direction]
    const positions = lettres.map((ch, i) => {
      const r = w.y - 1 + dr * i
      const c = w.x - 1 + dc * i
      if (r < 0 || c < 0 || r >= parsed.hauteur || c >= parsed.largeur) {
        throw new EcwImportError('hors-grille', `« ${w.reponse} » sort de la grille déclarée (${parsed.largeur} × ${parsed.hauteur})`)
      }
      const key = `${r},${c}`
      const prev = cells.get(key)
      if (prev && prev.ch !== ch) conflits.push(`ligne ${r + 1}, colonne ${c + 1} : ${prev.ch}/${ch} (${prev.mot} / ${w.reponse})`)
      else if (!prev) cells.set(key, { ch, mot: w.reponse })
      return [r, c]
    })
    return { ...w, lettres, positions }
  })
  if (conflits.length) throw new EcwImportError('conflit', `${conflits.length} conflit(s) de lettres : ${conflits.join(' ; ')}`)

  const all = [...cells.keys()].map(k => k.split(',').map(Number))
  const minR = Math.min(...all.map(p => p[0]))
  const minC = Math.min(...all.map(p => p[1]))
  const hauteur = Math.max(...all.map(p => p[0])) - minR + 1
  const largeur = Math.max(...all.map(p => p[1])) - minC + 1
  const rows = Array.from({ length: hauteur }, () => Array(largeur).fill('.'))
  for (const [key, { ch }] of cells) {
    const [r, c] = key.split(',').map(Number)
    rows[r - minR][c - minC] = ch
  }

  const starts = [...new Set(placed.map(w => (w.positions[0][0] - minR) * largeur + (w.positions[0][1] - minC)))].sort((a, b) => a - b)
  const mots = placed.map(w => {
    const ligne = w.positions[0][0] - minR
    const colonne = w.positions[0][1] - minC
    return {
      numero: starts.indexOf(ligne * largeur + colonne) + 1,
      direction: w.direction,
      ligne,
      colonne,
      reponse: w.reponse,
      grille: w.lettres.join(''),
      longueur: w.lettres.length,
      positionSource: { x: w.x, y: w.y },
      definitionOrigine: w.definition
    }
  })
  mots.sort((a, b) => (a.direction === b.direction ? 0 : a.direction === 'across' ? -1 : 1) || a.numero - b.numero)
  return { largeur, hauteur, lignes: rows.map(r => r.join('')), mots }
}

// Normalisation typographique automatique (P5 a) : espaces multiples réduites
// à une, espaces de début et de fin retirées. Rien d'autre.
export function normalizeTypography(text) {
  return String(text).replace(/[ \t\u00a0]{2,}/g, ' ').trim()
}

// Applique à une définition les corrections acceptées : chacune remplace un
// fragment exact (`avant`) par `apres`. Le fragment doit être présent UNE
// fois exactement dans le texte en cours, sinon erreur : aucune correction
// n'est improvisée. Retourne le texte corrigé (avant normalisation).
export function applyCorrections(text, corrections) {
  let current = String(text)
  for (const c of corrections) {
    const count = current.split(c.avant).length - 1
    if (count !== 1) {
      throw new EcwImportError('correction', `${c.id} : fragment « ${c.avant} » trouvé ${count} fois (1 attendu)`)
    }
    current = current.replace(c.avant, () => c.apres)
  }
  return current
}

// Identifiant d'un mot pour la progression (P12 a) : grille + numéro + sens.
export function wordId(gridId, numero, direction) {
  return `${gridId}-${numero}${direction === 'across' ? 'H' : 'V'}`
}

// Grille complète à partir des octets du .ecw et de sa fiche de sélection
// (scripts/grilles-maitre-selection.js). `source` : { chemin, sha256, octets,
// copies } calculés par le script. Toute anomalie lève EcwImportError.
export function importGrid(bytes, fiche, source) {
  const parsed = parseEcw(decodeEcw(bytes))
  const grid = buildGrid(parsed)

  const corrections = fiche.corrections || []
  for (const c of corrections) {
    const n = grid.mots.filter(w => w.reponse === c.mot && w.direction === c.direction).length
    if (n !== 1) throw new EcwImportError('correction', `${c.id} : mot ${c.mot} (${c.direction}) trouvé ${n} fois dans ${fiche.id}`)
  }

  const normalisations = []
  const mots = grid.mots.map(w => {
    const own = corrections.filter(c => c.mot === w.reponse && c.direction === w.direction)
    const corrige = applyCorrections(w.definitionOrigine, own)
    const definition = normalizeTypography(corrige)
    if (definition !== corrige) normalisations.push({ mot: wordId(fiche.id, w.numero, w.direction), regle: 'espaces multiples ou en bordure' })
    return { id: wordId(fiche.id, w.numero, w.direction), ...w, definition }
  })

  const titreOrigine = parsed.entete.Title || ''
  const titre = normalizeTypography(titreOrigine)
  if (titre !== titreOrigine) normalisations.push({ mot: null, champ: 'titre', regle: 'espaces multiples ou en bordure' })

  return {
    id: fiche.id,
    titre,
    titreOrigine,
    matiere: fiche.matiere,
    niveau: fiche.niveau,
    niveauStatut: fiche.niveauStatut,
    classe: fiche.classe ?? null,
    sous_systeme: fiche.sous_systeme ?? null,
    langue: fiche.langue,
    theme: fiche.theme,
    competence: fiche.competence ?? null,
    objectif: fiche.objectif ?? null,
    difficulte: fiche.difficulte ?? null,
    type_activite: 'mots croisés',
    ligne_programme: fiche.ligne_programme ?? null,
    auteur: parsed.entete.Author || null,
    copyright: parsed.entete.Copyright || null,
    droits: fiche.droits,
    statut: fiche.statut,
    source: {
      chemin: source.chemin,
      copies: source.copies,
      sha256: source.sha256,
      octets: source.octets,
      logiciel: parsed.version ? `EclipseCrossword ${parsed.version}` : null,
      tailleDeclaree: { largeur: parsed.largeur, hauteur: parsed.hauteur },
      dateImport: source.dateImport
    },
    largeur: grid.largeur,
    hauteur: grid.hauteur,
    lignes: grid.lignes,
    mots: mots.map(({ id, numero, direction, ligne, colonne, reponse, grille, longueur, definition, definitionOrigine, positionSource }) =>
      ({ id, numero, direction, ligne, colonne, reponse, grille, longueur, definition, definitionOrigine, positionSource })),
    corrections: corrections.map(c => {
      const w = mots.find(m => m.reponse === c.mot && m.direction === c.direction)
      return { id: c.id, mot: w.id, reponse: c.mot, type: c.type, avant: c.avant, apres: c.apres, decision: c.decision, ...(c.remarque ? { remarque: c.remarque } : {}) }
    }),
    normalisations
  }
}
