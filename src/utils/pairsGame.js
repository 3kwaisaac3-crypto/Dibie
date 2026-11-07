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
// fournit sa préparation des candidats : L3 (mot ↔ traduction, lot A), L6
// (mémoire FR ↔ EN, lot B, mêmes candidats que L3), M7 (mémoire opération ↔
// résultat, lot B), L4 (mot ↔ définition, lot C). Deux présentations :
// colonnes (L3 et L4 : createPairsGame, tryMatch) et cartes face cachée (L6, M7 :
// createMemoryBoard, flipCard) ; le tirage et le score sont communs.
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
import { shuffled, gridTokens, definitionRevealsWord } from './anagramGame.js'
import { mathClassSettings } from '../data/reglages-maths.js'

export { newSeed, isValidSeed }

// D10 et P7 a : 10 points par paire trouvée, sans pénalité ; pas d'étoiles
// (L3, L6 et M7)
export const POINTS_PER_PAIR = 10
// P6 a : indice après 2 erreurs sur un même élément, « Voir la réponse » après 3
export const ERRORS_BEFORE_HINT = 2
export const ERRORS_BEFORE_ANSWER = 3

// gameType enregistré (saveUserProgress, saveScore). P7 a prévoyait 3 noms
// (traduction, définition, mémoire, variante dans details) ; M7 est ici séparé
// de L6 (4 noms), pour ne pas mêler langue et mathématiques dans les scores :
// CHOIX PROVISOIRE, à trancher par Isaac (docs/paires.md §11). L4 (lot C) :
// pairsDefinition.
export const GAME_TYPE_TRANSLATION = 'pairsTranslation'
export const GAME_TYPE_DEFINITION = 'pairsDefinition'
export const GAME_TYPE_MEMORY = 'pairsMemory'
export const GAME_TYPE_MULTIPLICATION = 'pairsMultiplication'

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

// Contrôle des paramètres et tirage commun à toutes les parties (colonnes de
// L3, cartes de L6 et M7) : { random, pairs }, pairs = null si impossible.
// Le générateur est renvoyé pour que la suite de la préparation (ordre des
// colonnes, place des cartes) dépende de la même graine.
function drawPairs(caller, candidates, count, seed, maxRestricted) {
  if (!isValidSeed(seed)) throw new RangeError(`${caller} : graine invalide`)
  if (!Number.isInteger(count) || count < 1) throw new RangeError(`${caller} : nombre de paires invalide`)
  const random = createRandom(seed)
  return { random, pairs: selectPairs(candidates, count, random, { maxRestricted }) }
}

// Prépare une partie : { seed, pairs, leftOrder, rightOrder } ou null.
// pairs : les candidats choisis (avec left, right et les données du jeu) ;
// leftOrder / rightOrder : ids des paires dans l'ordre d'affichage.
export function createPairsGame(candidates, count, seed, { maxRestricted = Infinity } = {}) {
  const { random, pairs } = drawPairs('createPairsGame', candidates, count, seed, maxRestricted)
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

// Indice (L3 : définition ; L4 : traduction du mot) proposé pour cet élément
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
  return vocabularySubjects(levelEntries, translationPairCount(level))
}

// Sujets d'un niveau pour un nombre de paires donné (L3 et L6 : mêmes
// candidats, mêmes règles de tirage ; seul le nombre de paires change)
export function vocabularySubjects(levelEntries, count) {
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

// --- L4 : mot ↔ définition ------------------------------------------------
//
// Lot C (cadrage §4.1, §4.2, §5, §6 ; fiche L4 du catalogue v0.2 ; définitions
// du lot 0 validées par Isaac le 2026-11-06, règle L0-T). Présentation en
// colonnes comme L3 : les mots d'un côté (left), les définitions de l'autre
// (right). Mots et définitions dans la langue de l'interface au lancement
// (mot_fr et def_fr en français, mot_en et def_en en anglais). Contrairement à
// L3, les candidats dépendent donc de la langue : un même numéro ne donne pas
// forcément les mêmes paires en français et en anglais.

// P3 b : pas de L4 en SIL-CP ; 4 paires en CE1-CE2, 5 en CM1-CM2.
// [HYPOTHÈSE — À VÉRIFIER] par un enseignant.
export const DEFINITION_SETTINGS = Object.freeze({
  'CE1-CE2': Object.freeze({ pairCount: 4 }),
  'CM1-CM2': Object.freeze({ pairCount: 5 })
})
export const DEFINITION_LEVELS = Object.freeze(Object.keys(DEFINITION_SETTINGS))

// Nombre de paires de L4 d'un niveau (RangeError si niveau absent, SIL-CP compris)
export function definitionPairCount(level) {
  const settings = DEFINITION_SETTINGS[level]
  if (!settings) throw new RangeError(`Mot ↔ définition : niveau non proposé (${level})`)
  return settings.pairCount
}

// Critère de la règle automatique du cadrage §6.2 (CHOIX PROVISOIRE du
// developer, mesuré sur le vocabulaire : docs/paires.md §15) : une définition
// « contient » un mot quand on y trouve ce mot ENTIER, après normalisation
// (gridTokens : majuscules, sans accents, ligatures développées, découpage sur
// tout ce qui n'est pas une lettre), ou au pluriel simple (S, X : « faces »
// pour FACE). Pas de féminin (E, ES) : « demi-droites » aurait été pris pour
// DROIT (angle droit). Un mot composé (« hôtel de ville ») doit s'y trouver en
// entier, dans l'ordre. Mots de moins de 3 lettres ignorés (DO, RÉ...). Ainsi
// ARE n'est trouvé ni dans « aire » ni dans « hectare » (mots entiers).
export const MENTION_MIN_LETTERS = 3
const MENTION_ENDINGS = ['', 'S', 'X']

// Vrai si la suite de mots words se trouve dans tokens à partir de start ;
// lastMatches dit si le dernier mot de la définition convient au dernier mot
function sequenceAt(tokens, start, words, lastMatches) {
  for (let j = 0; j < words.length; j++) {
    const token = tokens[start + j]
    const ok = j === words.length - 1 ? lastMatches(token, words[j]) : token === words[j]
    if (!ok) return false
  }
  return true
}

function containsSequence(text, form, lastMatches) {
  const tokens = gridTokens(text)
  const words = gridTokens(form)
  if (words.length === 0) return false
  for (let i = 0; i + words.length <= tokens.length; i++) {
    if (sequenceAt(tokens, i, words, lastMatches)) return true
  }
  return false
}

// Règle §6.2 : la définition contient-elle le mot form (critère ci-dessus) ?
export function definitionMentions(definition, form) {
  if (typeof definition !== 'string' || typeof form !== 'string') return false
  if (gridTokens(form).join('').length < MENTION_MIN_LETTERS) return false
  return containsSequence(definition, form, (token, word) => MENTION_ENDINGS.some(e => token === word + e))
}

// Règle existante (décision du 2026-11-02, definitionRevealsWord) : la
// définition donne-t-elle son propre mot (le mot ou un mot qui commence par
// lui : « familles » pour FAMILLE) ? Étendue aux mots composés (tous les mots,
// le dernier pouvant être le début d'un mot de la définition) et appliquée à
// TOUTES les formes « A / B » (ÉCART : « Gap / Difference »).
export function definitionRevealsForm(definition, form) {
  if (typeof definition !== 'string' || typeof form !== 'string') return false
  const words = gridTokens(form)
  if (words.length === 1) return definitionRevealsWord(definition, words[0])
  return containsSequence(definition, form, (token, word) => token.startsWith(word))
}

const wordOf = (entry, lang) => (lang === 'en' ? entry.mot_en : entry.mot_fr)
const definitionOf = (entry, lang) => {
  const text = lang === 'en' ? entry.def_en : entry.def_fr
  return typeof text === 'string' ? text.trim() : ''
}

// Candidat L4 d'une entrée dans une langue (sans les liens §6.2, ajoutés par
// definitionCandidates), ou null si l'entrée n'est pas utilisable : inactive,
// mot ou définition vide, ou définition qui donne son propre mot.
// Clés (P12 a strict, règle L0-T confirmée par Isaac le 2026-11-06) :
// - « w: » toutes les formes FR et EN, comme L3 : deux entrées qui partagent
//   une forme (synonymes : ADDITIONNER / AJOUTER → Add) ne sont jamais tirées
//   ensemble, même si seuls les mots d'une langue sont affichés ;
// - « d: » la définition affichée : jamais deux définitions identiques.
// P11 (mots identiques FR = EN) ne s'applique pas : restricted toujours faux.
export function definitionCandidate(entry, language = 'fr') {
  if (!entry || entry.actif === false) return null
  const lang = language === 'en' ? 'en' : 'fr'
  const other = lang === 'fr' ? 'en' : 'fr'
  const word = displayText(wordOf(entry, lang))
  const definition = definitionOf(entry, lang)
  if (!word || !pairKey(word) || !pairKey(definition)) return null
  if (textForms(wordOf(entry, lang)).some(form => definitionRevealsForm(definition, form))) return null
  const wordKeys = [...textForms(entry.mot_fr), ...textForms(entry.mot_en)].map(pairKey).filter(Boolean)
  return {
    id: entry.id,
    lang,
    word,
    // Forme affichée, utilisée par la règle §6.2
    form: textForms(wordOf(entry, lang))[0],
    definition,
    // Indice (P6 a) : la traduction du mot dans l'autre langue (première forme)
    translation: displayText(wordOf(entry, other)),
    translationLang: other,
    keys: [...[...new Set(wordKeys)].map(k => `w:${k}`), `d:${pairKey(definition)}`],
    restricted: false
  }
}

// Clé commune à deux candidats liés par la règle §6.2
const mentionKey = (a, b) => `m:${[String(a), String(b)].sort().join('↔')}`

// Candidats L4 d'une liste d'entrées (un sujet d'un niveau) dans une langue,
// avec la règle automatique du cadrage §6.2 : quand la définition de A contient
// le mot affiché de B (definitionMentions), A et B reçoivent une clé commune et
// ne sont jamais tirés ensemble (les deux entrées restent dans le vocabulaire).
// Chaque candidat garde la liste des mots qui l'ont lié (mentions), pour les
// contrôles et la documentation.
export function definitionCandidates(entries, language = 'fr') {
  const candidates = entries.map(e => definitionCandidate(e, language)).filter(Boolean)
    .map(c => ({ ...c, keys: [...c.keys], mentions: [] }))
  for (const a of candidates) {
    for (const b of candidates) {
      if (a === b || !definitionMentions(a.definition, b.form)) continue
      a.mentions.push(b.id)
      const key = mentionKey(a.id, b.id)
      if (!a.keys.includes(key)) a.keys.push(key)
      if (!b.keys.includes(key)) b.keys.push(key)
    }
  }
  return candidates
}

// Sujets de l'écran de choix pour un niveau et une langue, triés comme L3 :
// [{ subject, usable, playable }] (usable : nombre de paires garanti pour toute
// graine, après toutes les règles de tirage).
export function definitionSubjects(levelEntries, level, language = 'fr') {
  const count = definitionPairCount(level)
  const active = levelEntries.filter(v => v && v.actif !== false)
  const subjects = Array.from(new Set(active.map(v => v.sujet))).sort()
  return subjects.map(subject => {
    const usable = guaranteedPairCount(definitionCandidates(active.filter(v => v.sujet === subject), language))
    return { subject, usable, playable: usable >= count }
  })
}

// Partie L4 : entrées d'un sujet et d'un niveau, graine, langue de l'interface
// au lancement. Renvoie null si le sujet est injouable. RangeError en SIL-CP.
// Chaque paire : { id, left: { text, lang, kind: 'word', translation,
// translationLang }, right: { text, lang, kind: 'definition' } } ; left.text en
// majuscules (P8), right.text en casse normale.
export function createDefinitionGame(entries, level, seed, language = 'fr') {
  const count = definitionPairCount(level)
  const lang = language === 'en' ? 'en' : 'fr'
  const game = createPairsGame(definitionCandidates(entries, lang), count, seed)
  if (!game) return null
  return {
    ...game,
    level,
    language: lang,
    pairs: game.pairs.map(c => ({
      id: c.id,
      left: { text: c.word, lang, kind: 'word', translation: c.translation, translationLang: c.translationLang },
      right: { text: c.definition, lang, kind: 'definition' }
    }))
  }
}

// --- Mémoire (cartes face cachée) : L6 et M7 ------------------------------
//
// Lot B (cadrage §4.1 à §4.4, fiches L6 et M7 du catalogue v0.2). Chaque paire
// donne deux cartes, une par « côté » (L6 : 'fr' et 'en' ; M7 : 'op' et
// 'res'), placées selon la graine. L'élève retourne deux cartes : si elles
// forment une paire, elles restent ouvertes ; sinon elles se referment (par
// l'interface, après un court délai, ou au toucher suivant). Pas d'aide
// (P6 vise L3 et L4 seulement), pas de pénalité ; le nombre de coups (paires
// de cartes retournées) est affiché pour information, sans étoiles (P7 a,
// cadrage §4.3).

// P3 b / c : nombre de paires de L6 et de M7 par niveau (8 en CM1-CM2 seulement
// après essai sur un vrai téléphone). [HYPOTHÈSE — À VÉRIFIER] par un enseignant.
export const MEMORY_SETTINGS = Object.freeze({
  'SIL-CP': Object.freeze({ pairCount: 4 }),
  'CE1-CE2': Object.freeze({ pairCount: 6 }),
  'CM1-CM2': Object.freeze({ pairCount: 6 })
})
export const MEMORY_LEVELS = Object.freeze(Object.keys(MEMORY_SETTINGS))

// Délai avant que deux cartes qui ne vont pas ensemble se referment (utilisé
// par l'interface ; toucher une carte les referme plus tôt). CHOIX PROVISOIRE.
export const MISMATCH_DELAY_MS = 1200

// Nombre de paires de L6 et de M7 d'un niveau (RangeError si niveau inconnu)
export function memoryPairCount(level) {
  const settings = MEMORY_SETTINGS[level]
  if (!settings) throw new RangeError(`Mémoire : niveau inconnu (${level})`)
  return settings.pairCount
}

// Cartes d'une partie, mélangées selon la graine : [{ key, pairId, side }].
// key = elementKey(side, pairId), unique dans la partie.
export function memoryCards(pairIds, sides, random) {
  const cards = pairIds.flatMap(pairId => sides.map(side => ({ key: elementKey(side, pairId), pairId, side })))
  return shuffled(cards, random)
}

// Prépare un plateau de mémoire : { seed, pairs, cards } ou null.
// pairs : les candidats choisis ; sides : les deux côtés de chaque paire.
export function createMemoryBoard(candidates, count, seed, sides, { maxRestricted = Infinity } = {}) {
  if (!Array.isArray(sides) || sides.length !== 2 || sides[0] === sides[1]) {
    throw new RangeError('createMemoryBoard : il faut deux côtés différents')
  }
  const { random, pairs } = drawPairs('createMemoryBoard', candidates, count, seed, maxRestricted)
  if (!pairs) return null
  return { seed, pairs, cards: memoryCards(pairs.map(p => p.id), sides, random) }
}

// État initial d'une mémoire : celui des colonnes (resolved, errors, pour
// réutiliser isResolved, isFinished, pairsScore, colorIndex), plus les cartes
// ouvertes non résolues (0, 1 ou 2) et le nombre de coups.
export function createMemoryState() {
  return { ...createPairsState(), open: [], moves: 0 }
}

// Vrai si la carte est visible (paire trouvée ou carte ouverte)
export const isFaceUp = (state, card) => isResolved(state, card.pairId) || state.open.some(o => o.key === card.key)

// Deux cartes ouvertes qui ne vont pas ensemble : on les referme
export const closeMismatch = (state) => (state.open.length === 2 ? { ...state, open: [] } : state)

// L'élève touche une carte. Renvoie { state, result } :
// - 'ignored' : carte déjà trouvée, ou déjà ouverte seule ;
// - 'closed'  : deux cartes ouvertes qui ne vont pas ensemble, et l'élève a
//               touché l'une d'elles : elles se referment ;
// - 'first'   : première carte d'un coup (deux cartes ouvertes qui ne vont pas
//               ensemble sont d'abord refermées) ;
// - 'match'   : deuxième carte, de la même paire : paire trouvée (10 points) ;
// - 'mismatch': deuxième carte, d'une autre paire : les deux restent ouvertes
//               jusqu'au délai ou au toucher suivant, sans pénalité.
// Un coup = une deuxième carte retournée (match ou mismatch).
export function flipCard(state, card) {
  if (!card || isResolved(state, card.pairId)) return { state, result: 'ignored' }
  let current = state
  if (current.open.length === 2) {
    const wasOpen = current.open.some(o => o.key === card.key)
    current = closeMismatch(current)
    if (wasOpen) return { state: current, result: 'closed' }
  }
  if (current.open.some(o => o.key === card.key)) return { state: current, result: 'ignored' }
  const opened = { key: card.key, pairId: card.pairId }
  if (current.open.length === 0) return { state: { ...current, open: [opened] }, result: 'first' }
  const moves = current.moves + 1
  const [first] = current.open
  if (first.pairId === card.pairId) {
    return {
      state: { ...current, open: [], moves, resolved: [...current.resolved, { id: card.pairId, status: 'found' }] },
      result: 'match'
    }
  }
  return { state: { ...current, open: [first, opened], moves }, result: 'mismatch' }
}

// --- L6 : mémoire FR ↔ EN -------------------------------------------------

// Côtés des cartes de L6 : une carte en français, une en anglais. Les côtés ne
// dépendent pas de la langue de l'interface : un même numéro donne les mêmes
// cartes aux mêmes places en français et en anglais (comme L3, P5 a) ; seule
// la carte dans la langue de l'interface est mise en avant à l'écran.
export const MEMORY_SIDES = Object.freeze(['fr', 'en'])

// Sujets de L6 pour un niveau (mêmes règles que L3, avec 4 / 6 / 6 paires)
export const memorySubjects = (levelEntries, level) => vocabularySubjects(levelEntries, memoryPairCount(level))

// Partie L6 : entrées d'un sujet et d'un niveau, graine, langue de l'interface
// au lancement. Mêmes candidats et mêmes règles de tirage que L3 (P11 b,
// P12 a : pas deux cartes de même texte, au plus une paire FR = EN).
// Renvoie null si le sujet est injouable.
// { seed, level, language, primarySide, sideOrder, pairs, cards } ; chaque
// paire : { id, restricted, sides: { fr: { text, lang }, en: { text, lang } } }.
export function createVocabularyMemoryGame(entries, level, seed, language = 'fr') {
  const count = memoryPairCount(level)
  const board = createMemoryBoard(translationCandidates(entries), count, seed, MEMORY_SIDES, { maxRestricted: MAX_SAME_WORD_PAIRS })
  if (!board) return null
  const primary = language === 'en' ? 'en' : 'fr'
  return {
    ...board,
    level,
    language: primary,
    primarySide: primary,
    sideOrder: [primary, primary === 'fr' ? 'en' : 'fr'],
    pairs: board.pairs.map(c => ({
      id: c.id,
      restricted: c.restricted,
      sides: { fr: { text: c.fr, lang: 'fr' }, en: { text: c.en, lang: 'en' } }
    }))
  }
}

// --- M7 : mémoire des tables de multiplication (opération ↔ résultat) -----

// Facteurs de 1 à 10 (cadrage §4.4). [HYPOTHÈSE — À VÉRIFIER]
export const MULTIPLICATION_FACTORS = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

// Opérations « triviales » : un facteur vaut 1 (le résultat recopie l'autre
// facteur). CHOIX PROVISOIRE du developer : au plus 1 par partie, par le même
// mécanisme que les mots identiques de L3 (candidats restreints).
export const MAX_TRIVIAL_OPERATIONS = 1

// Côtés des cartes de M7 : l'opération et son résultat
export const MULTIPLICATION_SIDES = Object.freeze(['op', 'res'])

// Candidat M7 « table × facteur » (ex. 3 × 4 ↔ 12). id = le fait (« 3×4 »),
// enregistré comme itemId pour reproposer plus tard les faits ratés (cadrage
// §4.2). Clé « p: » le produit (P12 a strict, cadrage §5 règle 3 : jamais deux
// opérations de même résultat dans une partie, donc ni 2 × 6 avec 3 × 4, ni
// 3 × 4 avec 4 × 3 ; pas deux cartes « résultat » identiques ; une opération
// et un résultat n'ont jamais le même texte).
export function multiplicationCandidate(table, factor) {
  return {
    id: `${table}×${factor}`,
    table,
    factor,
    product: table * factor,
    operation: `${table} × ${factor}`,
    result: String(table * factor),
    keys: [`p:${table * factor}`],
    restricted: table === 1 || factor === 1
  }
}

// Candidats M7 pour une liste de tables (facteurs 1 à 10)
export function multiplicationCandidates(tables) {
  return [...new Set(tables)].sort((a, b) => a - b)
    .flatMap(t => MULTIPLICATION_FACTORS.map(f => multiplicationCandidate(t, f)))
}

// Tables proposées dans l'option « une seule table » : celles de la classe
// sauf la table de 1 (CHOIX PROVISOIRE : toutes ses opérations sont triviales,
// elle ne donnerait qu'une paire avec la règle ci-dessus). Chaque autre table
// donne 10 produits distincts, dont une seule opération triviale : 10 paires
// garanties, plus que les 6 demandées.
export const singleTableOptions = (tables) => [...new Set(tables)].filter(t => t >= 2).sort((a, b) => a - b)

// Préparation d'une partie M7 pour une classe et un sous-système
// (reglages-maths.js, champ tables, provisoire D4) : toutes les tables de la
// classe mêlées (table = null, P10 a) ou une seule table de la classe.
// Renvoie :
// - { status: 'no-table', ... } : classe sans table (Class 1-2, P10 a) ;
// - { status: 'ok', className, subsystem, level, tables, table, count, candidates }.
// RangeError si la classe est inconnue ou la table non proposée.
export function multiplicationSetup({ className, subsystem, table = null }) {
  const cls = mathClassSettings(className, subsystem)
  if (!cls) throw new RangeError(`Mémoire des tables : classe inconnue (${className}, ${subsystem})`)
  if (cls.tables.length === 0) return { status: 'no-table', className, subsystem, level: cls.level, tables: [] }
  if (table !== null && !singleTableOptions(cls.tables).includes(table)) {
    throw new RangeError(`Mémoire des tables : table ${table} non proposée en ${className}`)
  }
  const tables = table === null ? [...cls.tables] : [table]
  return {
    status: 'ok',
    className,
    subsystem,
    level: cls.level,
    tables,
    table,
    count: memoryPairCount(cls.level),
    candidates: multiplicationCandidates(tables)
  }
}

// Nombre de paires garanti pour un réglage (contrôle : toujours au moins count)
export const multiplicationGuaranteed = (setup) =>
  guaranteedPairCount(setup.candidates, { maxRestricted: MAX_TRIVIAL_OPERATIONS })

// Partie M7, ou null si la classe n'a pas de table (ou si le tirage échoue,
// ce que les règles ci-dessus excluent). Chaque paire :
// { id, table, factor, product, restricted, sides: { op: { text }, res: { text } } }.
export function createMultiplicationMemoryGame({ className, subsystem, table = null, seed }) {
  const setup = multiplicationSetup({ className, subsystem, table })
  if (setup.status !== 'ok') return null
  const board = createMemoryBoard(setup.candidates, setup.count, seed, MULTIPLICATION_SIDES, { maxRestricted: MAX_TRIVIAL_OPERATIONS })
  if (!board) return null
  return {
    ...board,
    className,
    subsystem,
    level: setup.level,
    tables: setup.tables,
    table,
    primarySide: 'op',
    sideOrder: ['op', 'res'],
    pairs: board.pairs.map(c => ({
      id: c.id,
      table: c.table,
      factor: c.factor,
      product: c.product,
      restricted: c.restricted,
      sides: { op: { text: c.operation, lang: null }, res: { text: c.result, lang: null } }
    }))
  }
}

// Texte d'une paire de mémoire, côté mis en avant d'abord (« 3 × 4 = 12 »,
// « TOTAL = TOTAL »)
export const memoryPairText = (game, pair) => `${pair.sides[game.sideOrder[0]].text} = ${pair.sides[game.sideOrder[1]].text}`
