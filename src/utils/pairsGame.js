// Moteur C « Paires » (catalogue des jeux v0.2, §5.2 étape 3 ; cadrage de la
// phase 4, DIBIE/pedagogie/cadrage-phase4-paires-v0.1.md, décisions P1 à P12
// validées par Isaac le 2026-11-06). Module pur : aucun accès au stockage ni à
// l'interface. Même modèle que les autres jeux : graine reproductible
// (createRandom, newSeed, isValidSeed).
//
// Le moteur est générique : il reçoit des « candidats » déjà préparés
//   { id, left: { text, lang }, right: { text, lang }, keys, restricted, ... }
// et sait les tirer, les mélanger, vérifier une association et suivre l'état
// d'une partie (paires trouvées ou montrées, erreurs par élément). Chaque jeu
// fournit sa préparation des candidats : ici L3 (mot ↔ traduction, lot A) ;
// plus tard L6 (mémoire), M7 (opération ↔ résultat) et L4 (mot ↔ définition).
//
// Règles de tirage (cadrage §5, décision P12 a, stricte) :
// - deux candidats d'une même partie ne partagent aucune clé (keys) : clés de
//   texte de toutes les formes affichables, clés de définition... Une collision
//   écarte l'un des deux candidats de la partie (jamais deux bonnes réponses) ;
// - au plus maxRestricted candidats « restreints » par partie (P11 b : au plus
//   une paire dont le mot FR et la première forme EN sont identiques sans
//   accents, ex. TOTAL / Total).
// Un sujet est jouable quand TOUTE graine donne une partie complète (voir
// guaranteedPairCount) : l'écran de choix grise les autres (P4).

import { createRandom } from './wordSearchGenerator.js'
import { newSeed, isValidSeed } from './wordSearchGame.js'
import { shuffled } from './anagramGame.js'

export { newSeed, isValidSeed }

// D10 et P7 a : 10 points par paire trouvée, sans pénalité ; pas d'étoiles
export const POINTS_PER_PAIR = 10
// P6 a : indice après 2 erreurs sur un même élément, « Voir la réponse » après 3
export const ERRORS_BEFORE_HINT = 2
export const ERRORS_BEFORE_ANSWER = 3

// gameType enregistré (saveUserProgress, saveScore). Un nom par jeu de paires
// (P7 a) ; seul L3 existe dans le lot A. Noms prévus, non utilisés à ce jour :
// pairsDefinition (L4), pairsMemory (L6), pairsMultiplication (M7).
export const GAME_TYPE_TRANSLATION = 'pairsTranslation'

// P3 c : nombre de paires de L3 par niveau (révision possible à 8 en CM1-CM2
// après essai sur un vrai téléphone). [HYPOTHÈSE — À VÉRIFIER] par un enseignant.
export const TRANSLATION_SETTINGS = Object.freeze({
  'SIL-CP': Object.freeze({ pairCount: 3 }),
  'CE1-CE2': Object.freeze({ pairCount: 5 }),
  'CM1-CM2': Object.freeze({ pairCount: 6 })
})
export const TRANSLATION_LEVELS = Object.freeze(Object.keys(TRANSLATION_SETTINGS))

// P11 b : au plus 1 paire « mot identique dans les deux langues » par partie
export const MAX_SAME_WORD_PAIRS = 1

// --- Textes ---------------------------------------------------------------

// Clé de comparaison : majuscules, sans accents, ligatures développées,
// seulement lettres et chiffres (casse, accents, espaces, tirets et
// apostrophes ignorés). « Mango tree » -> MANGOTREE ; « Œuf » -> OEUF.
// Sert aux comparaisons seulement, jamais à l'affichage.
export function pairKey(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
}

// Toutes les formes d'un texte « A / B » (formes vides retirées)
export function textForms(text) {
  if (typeof text !== 'string') return []
  return text.split('/').map(f => f.trim()).filter(Boolean)
}

// Texte affiché (P8 a) : première forme de « A / B », en majuscules, accents
// gardés, espaces et tirets gardés (mots composés). Pas sanitizeWord, qui
// rejette les mots composés. '' si aucune forme.
export function displayText(text) {
  const first = textForms(text)[0]
  return first ? first.replace(/\s+/g, ' ').toLocaleUpperCase('fr-FR') : ''
}

// --- Tirage générique -----------------------------------------------------

// Vrai si deux candidats ne peuvent pas être dans la même partie
const conflicts = (a, b) => a.keys.some(k => b.keys.includes(k))

// Composantes de candidats reliés par des clés communes (collisions directes
// ou en chaîne). Utilisé pour le nombre garanti de paires.
function components(candidates) {
  const parent = candidates.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  const byKey = new Map()
  candidates.forEach((c, i) => {
    for (const k of c.keys) {
      if (byKey.has(k)) parent[find(i)] = find(byKey.get(k))
      else byKey.set(k, i)
    }
  })
  const groups = new Map()
  candidates.forEach((c, i) => {
    const root = find(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root).push(c)
  })
  return [...groups.values()]
}

// Nombre de paires que le tirage obtient pour TOUTE graine (borne sûre) :
// une paire par composante qui contient un candidat non restreint, plus
// jusqu'à maxRestricted composantes faites uniquement de candidats restreints.
// Le tirage (selectPairs) atteint toujours au moins ce nombre.
export function guaranteedPairCount(candidates, { maxRestricted = Infinity } = {}) {
  let open = 0
  let restrictedOnly = 0
  for (const group of components(candidates)) {
    if (group.some(c => !c.restricted)) open++
    else restrictedOnly++
  }
  return open + Math.min(restrictedOnly, maxRestricted)
}

// Choix glouton dans l'ordre donné, en respectant les collisions et la limite
// de candidats restreints
function greedy(pool, count, maxRestricted) {
  const chosen = []
  let restricted = 0
  for (const c of pool) {
    if (chosen.length >= count) break
    if (c.restricted && restricted >= maxRestricted) continue
    if (chosen.some(o => conflicts(o, c))) continue
    chosen.push(c)
    if (c.restricted) restricted++
  }
  return chosen
}

// Tire count candidats selon la graine. Tri préalable par id : le résultat ne
// dépend que du contenu et de la graine, pas de l'ordre des données.
// 1. choix glouton dans l'ordre mélangé (un candidat restreint peut sortir) ;
// 2. si c'est insuffisant, même ordre mais candidats non restreints d'abord :
//    atteint toujours guaranteedPairCount.
// Renvoie la liste choisie (dans l'ordre du tirage), ou null si la partie ne
// peut pas avoir count paires.
export function selectPairs(candidates, count, random, { maxRestricted = Infinity } = {}) {
  const sorted = candidates.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const pool = shuffled(sorted, random)
  let chosen = greedy(pool, count, maxRestricted)
  if (chosen.length < count) {
    chosen = greedy([...pool.filter(c => !c.restricted), ...pool.filter(c => c.restricted)], count, maxRestricted)
    // Ordre d'affichage : celui du tirage
    const rank = new Map(pool.map((c, i) => [c.id, i]))
    chosen.sort((a, b) => rank.get(a.id) - rank.get(b.id))
  }
  return chosen.length >= count ? chosen : null
}

// Ordre de la colonne de droite : mélangé selon la graine ; s'il est identique
// à celui de gauche (paires alignées ligne à ligne, trouvables sans lire), il
// est décalé d'un cran.
export function rightOrder(ids, random) {
  const order = shuffled(ids, random)
  if (ids.length > 1 && order.every((id, i) => id === ids[i])) order.push(order.shift())
  return order
}

// Prépare une partie : { seed, pairs, leftOrder, rightOrder } ou null.
// pairs : les candidats choisis (avec left, right et les données du jeu) ;
// leftOrder / rightOrder : ids des paires dans l'ordre d'affichage.
export function createPairsGame(candidates, count, seed, { maxRestricted = Infinity } = {}) {
  if (!isValidSeed(seed)) throw new RangeError('createPairsGame : graine invalide')
  if (!Number.isInteger(count) || count < 1) throw new RangeError('createPairsGame : nombre de paires invalide')
  const random = createRandom(seed)
  const pairs = selectPairs(candidates, count, random, { maxRestricted })
  if (!pairs) return null
  const leftIds = pairs.map(p => p.id)
  return { seed, pairs, leftOrder: leftIds, rightOrder: rightOrder(leftIds, random) }
}

// --- État d'une partie ----------------------------------------------------

// Un élément affiché : côté ('left' | 'right') et id de sa paire
export const elementKey = (side, pairId) => `${side}:${pairId}`

// État initial : aucune paire résolue, aucune erreur.
// resolved : [{ id, status: 'found' | 'shown' }] dans l'ordre de résolution
// (l'indice dans ce tableau donne la couleur de la paire) ;
// errors : { [elementKey]: nombre d'associations fausses avec cet élément }.
export function createPairsState() {
  return { resolved: [], errors: {} }
}

export const pairStatus = (state, pairId) => state.resolved.find(r => r.id === pairId)?.status ?? null
export const isResolved = (state, pairId) => pairStatus(state, pairId) !== null
export const errorCount = (state, side, pairId) => state.errors[elementKey(side, pairId)] ?? 0

// Vrai si l'élément de gauche et celui de droite forment une paire. Le tirage
// strict (P12 a) garantit une seule bonne association par élément.
export const isMatch = (leftId, rightId) => leftId === rightId

// Association proposée par l'élève (élément de gauche, élément de droite,
// tous deux libres). Renvoie { state, correct }. Juste : la paire est trouvée
// (10 points). Fausse : une erreur de plus sur chacun des deux éléments, qui
// restent libres (P6 a, sans pénalité).
export function tryMatch(state, leftId, rightId) {
  if (isResolved(state, leftId) || isResolved(state, rightId)) return { state, correct: false, ignored: true }
  if (isMatch(leftId, rightId)) {
    return { state: { ...state, resolved: [...state.resolved, { id: leftId, status: 'found' }] }, correct: true }
  }
  const errors = { ...state.errors }
  for (const key of [elementKey('left', leftId), elementKey('right', rightId)]) errors[key] = (errors[key] ?? 0) + 1
  return { state: { ...state, errors }, correct: false }
}

// Indice (L3 : définition) proposé pour cet élément
export const canHint = (state, side, pairId) =>
  !isResolved(state, pairId) && errorCount(state, side, pairId) >= ERRORS_BEFORE_HINT

// « Voir la réponse » proposé pour cet élément
export const canShowAnswer = (state, side, pairId) =>
  !isResolved(state, pairId) && errorCount(state, side, pairId) >= ERRORS_BEFORE_ANSWER

// Paire montrée (0 point, enregistrée isCorrect: false). Seulement si un de
// ses éléments a atteint ERRORS_BEFORE_ANSWER erreurs.
export function showAnswer(state, pairId) {
  if (!canShowAnswer(state, 'left', pairId) && !canShowAnswer(state, 'right', pairId)) return state
  return { ...state, resolved: [...state.resolved, { id: pairId, status: 'shown' }] }
}

// Élément mis en avant après une association fausse : celui qui a le plus
// d'erreurs (celui de gauche à égalité). Ses aides sont proposées à l'élève.
export function focusAfterWrong(state, leftId, rightId) {
  return errorCount(state, 'right', rightId) > errorCount(state, 'left', leftId)
    ? { side: 'right', id: rightId }
    : { side: 'left', id: leftId }
}

export const isFinished = (game, state) => state.resolved.length >= game.pairs.length
export const foundCount = (state) => state.resolved.filter(r => r.status === 'found').length
export const pairsScore = (state) => foundCount(state) * POINTS_PER_PAIR

// Rang de couleur d'une paire résolue (0, 1, 2...), ou -1
export const colorIndex = (state, pairId) => state.resolved.findIndex(r => r.id === pairId)

// --- L3 : mot ↔ traduction (FR ↔ EN) --------------------------------------

// Candidat L3 d'une entrée du vocabulaire, ou null si elle n'est pas
// utilisable (inactive, mot manquant, texte vide). Le candidat ne dépend pas
// de la langue : la même graine donne les mêmes paires en français et en
// anglais ; les mots de chaque langue changent de colonne et d'ordre (P5 a).
// Clés (P12 a, cadrage §5 règles 1 et 2) :
// - « w: » toutes les formes FR et EN, dans un même espace : aucune forme
//   commune entre deux entrées, d'une langue à l'autre comprise (pas deux
//   cartes de même texte, ex. FR « COIN » et EN « coin ») ;
// - « dfr: » / « den: » les définitions : pas deux indices identiques.
// restricted (P11) : mot FR et première forme EN identiques sans accents.
export function translationCandidate(entry) {
  if (!entry || entry.actif === false) return null
  const fr = displayText(entry.mot_fr)
  const en = displayText(entry.mot_en)
  if (!fr || !en || !pairKey(fr) || !pairKey(en)) return null
  const wordKeys = [...textForms(entry.mot_fr), ...textForms(entry.mot_en)].map(pairKey).filter(Boolean)
  const keys = [...new Set(wordKeys)].map(k => `w:${k}`)
  if (pairKey(entry.def_fr)) keys.push(`dfr:${pairKey(entry.def_fr)}`)
  if (pairKey(entry.def_en)) keys.push(`den:${pairKey(entry.def_en)}`)
  return {
    id: entry.id,
    fr,
    en,
    defFr: typeof entry.def_fr === 'string' ? entry.def_fr : '',
    defEn: typeof entry.def_en === 'string' ? entry.def_en : '',
    keys,
    restricted: pairKey(fr) === pairKey(en)
  }
}

// Candidats L3 d'une liste d'entrées (un sujet d'un niveau)
export const translationCandidates = (entries) => entries.map(translationCandidate).filter(Boolean)

// Nombre de paires L3 d'un niveau (RangeError si niveau inconnu)
export function translationPairCount(level) {
  const settings = TRANSLATION_SETTINGS[level]
  if (!settings) throw new RangeError(`Paires : niveau inconnu (${level})`)
  return settings.pairCount
}

// Sujets de l'écran de choix pour un niveau, triés comme les mots croisés
// (sort() par défaut) : [{ subject, usable, playable }]. usable = nombre de
// paires garanti après les règles de tirage ; playable = usable suffit pour
// le nombre de paires du niveau (modèle crosswordSubjects).
export function translationSubjects(levelEntries, level) {
  const count = translationPairCount(level)
  const active = levelEntries.filter(v => v && v.actif !== false)
  const subjects = Array.from(new Set(active.map(v => v.sujet))).sort()
  return subjects.map(subject => {
    const usable = guaranteedPairCount(translationCandidates(active.filter(v => v.sujet === subject)), { maxRestricted: MAX_SAME_WORD_PAIRS })
    return { subject, usable, playable: usable >= count }
  })
}

// Partie L3 : entrées d'un sujet et d'un niveau, graine, langue de l'interface
// au lancement (colonne de gauche). Renvoie null si le sujet est injouable.
// Chaque paire : { id, left: { text, lang, definition }, right: {...} }.
export function createTranslationGame(entries, level, seed, language = 'fr') {
  const count = translationPairCount(level)
  const game = createPairsGame(translationCandidates(entries), count, seed, { maxRestricted: MAX_SAME_WORD_PAIRS })
  if (!game) return null
  const leftLang = language === 'en' ? 'en' : 'fr'
  const rightLang = leftLang === 'fr' ? 'en' : 'fr'
  const side = (c, lang) => ({ text: c[lang], lang, definition: lang === 'fr' ? c.defFr : c.defEn })
  return {
    ...game,
    level,
    language: leftLang,
    pairs: game.pairs.map(c => ({ id: c.id, restricted: c.restricted, left: side(c, leftLang), right: side(c, rightLang) }))
  }
}

// Paire d'une partie par son id
export const pairById = (game, pairId) => game.pairs.find(p => p.id === pairId) ?? null
