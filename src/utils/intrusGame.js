// L'intrus (fiche L9 ; phase 7, lot C : docs/intrus.md). Module pur : aucun
// accès au stockage ni à l'interface.
//
// Données : src/data/intrus.json, items rédigés à la main (jamais générés
// depuis le champ `sujet`, fiche L9), avec un statut par item. Seuls les items
// « VALIDÉE PAR ISAAC » ou plus sont proposés aux élèves (P6, même règle que
// les Grilles du maître). Les parties sont jouées par le moteur D
// (choiceGames.js), inchangé : une question par item en CE1-CE2, deux à la
// suite au CM1-CM2 (l'intrus, puis « pourquoi ? »), approche 1 de docs/intrus.md.

import { createRandom } from './wordSearchGenerator.js'
import { shuffled } from './anagramGame.js'
import { isValidSeed } from './pairsGame.js'
import { isVisibleStatus } from './grillesMaitrePlay.js'

export const GAME_TYPE_INTRUS = 'intrus'

// I1 : pas de SIL-CP (lecture de phrases)
export const INTRUS_LEVELS = Object.freeze(['CE1-CE2', 'CM1-CM2'])
export const ELEMENTS_PER_ITEM = 4
export const WRONG_REASONS_PER_ITEM = 2

const LEVEL_WITH_INSTRUCTION = 'CE1-CE2' // critère annoncé (P7 a, I4)

const isText = (s) => typeof s === 'string' && s.trim() !== ''
const normalized = (s, language) => s.trim().toLocaleUpperCase(language === 'en' ? 'en' : 'fr-FR')

// Défauts d'un item dans une langue (liste vide si l'item est jouable)
export function intrusItemErrors(item, language) {
  const errors = []
  if (!INTRUS_LEVELS.includes(item?.niveau)) errors.push(`niveau inconnu : ${item?.niveau}`)
  const t = item?.[language]
  if (!t) return [...errors, `langue absente : ${language}`]
  const elements = Array.isArray(t.elements) ? t.elements : []
  if (elements.length !== ELEMENTS_PER_ITEM || !elements.every(isText)) errors.push(`${ELEMENTS_PER_ITEM} éléments attendus`)
  const keys = elements.filter(isText).map(e => normalized(e, language))
  if (new Set(keys).size !== keys.length) errors.push('deux éléments identiques')
  if (!isText(t.intrus) || keys.filter(k => k === normalized(t.intrus, language)).length !== 1) errors.push('intrus absent des éléments')
  if (!isText(t.raison)) errors.push('raison vide')
  if (item.niveau === LEVEL_WITH_INSTRUCTION) {
    if (!isText(t.consigne)) errors.push('consigne absente')
  } else if (item.niveau) {
    const wrong = Array.isArray(t.raisonsFausses) ? t.raisonsFausses : []
    const reasons = [t.raison, ...wrong].filter(isText).map(r => r.trim())
    if (wrong.length !== WRONG_REASONS_PER_ITEM || !wrong.every(isText)) errors.push(`${WRONG_REASONS_PER_ITEM} raisons fausses attendues`)
    else if (new Set(reasons).size !== reasons.length) errors.push('raisons identiques')
  }
  return errors
}

// I2 : 6 items par partie (6 questions en CE1-CE2, 12 au CM1-CM2) ; moins s'il
// y a moins d'items validés. [HYPOTHÈSE — À VÉRIFIER] par un enseignant.
export const ITEMS_PER_GAME = Object.freeze({ 'CE1-CE2': 6, 'CM1-CM2': 6 })

// Consigne unique du CM1-CM2 (critère à découvrir, P7 a) et question « pourquoi ? »
export const INTRUS_PROMPT = Object.freeze({ fr: 'Trouve l\'intrus.', en: 'Find the odd one out.' })
const WHY_SUFFIX = ':pourquoi'

const lang = (language) => (language === 'en' ? 'en' : 'fr')
const upper = (text, language) => text.trim().toLocaleUpperCase(language === 'en' ? 'en' : 'fr-FR')

// « Pourquoi X est-il l'intrus ? » : l'intrus est écrit dans la question, pour
// qu'elle reste juste même après un intrus raté (I6)
export function whyPrompt(intrus, language) {
  const word = upper(intrus, language)
  return lang(language) === 'en' ? `Why is ${word} the odd one out?` : `Pourquoi ${word} est-il l'intrus ?`
}

// Items proposés aux élèves : niveau, statut « VALIDÉE PAR ISAAC » ou plus,
// aucun défaut dans la langue demandée
export function intrusPlayableItems(collection, level, language = 'fr') {
  const l = lang(language)
  return (collection?.items || []).filter(item =>
    item?.niveau === level && isVisibleStatus(item.statut) && intrusItemErrors(item, l).length === 0)
}

// Ordre de la reprise : mélangé selon la graine, décalé d'un cran s'il est
// identique au premier. Même règle que retryOrder de choiceGames.js (non
// exporté ; ce module ne modifie pas le moteur).
function retryOrder(order, random) {
  const retry = shuffled(order, random)
  if (retry.length > 1 && retry.every((c, i) => c === order[i])) retry.push(retry.shift())
  return retry
}

function choiceQuestion({ id, itemId, kind, prompt, choices, answerId, feedback }, random) {
  const order = shuffled(choices, random)
  return { id, itemId, kind, prompt, options: order, retryOptions: retryOrder(order, random), answerId, feedback }
}

// Questions d'un item : une en CE1-CE2 (consigne), deux au CM1-CM2 (intrus,
// puis « pourquoi ? »). Identifiants : propositions `${id}:${index}` pour les
// mots, `${id}:r${index}` pour les raisons (r0 = la raison juste).
function itemQuestions(item, l, random) {
  const t = item[l]
  const intrus = upper(t.intrus, l)
  const words = t.elements.map((e, i) => ({ id: `${item.id}:${i}`, text: upper(e, l) }))
  const intrusId = words.find(w => w.text === intrus).id
  const feedback = { intrus, raison: t.raison }
  const withInstruction = item.niveau === LEVEL_WITH_INSTRUCTION
  const first = choiceQuestion({
    id: item.id, itemId: item.id, kind: 'intrus',
    prompt: withInstruction ? t.consigne : INTRUS_PROMPT[l],
    choices: words, answerId: intrusId, feedback
  }, random)
  if (withInstruction) return [first]
  const reasons = [t.raison, ...t.raisonsFausses].map((text, i) => ({ id: `${item.id}:r${i}`, text }))
  const why = choiceQuestion({
    id: `${item.id}${WHY_SUFFIX}`, itemId: item.id, kind: 'pourquoi',
    prompt: whyPrompt(t.intrus, l), choices: reasons, answerId: reasons[0].id, feedback
  }, random)
  return [first, why]
}

// Partie : collection, niveau, graine, langue de l'interface au lancement.
// Renvoie { seed, level, language, itemCount, questions }, ou null s'il n'y a
// aucun item jouable. RangeError si graine invalide ou niveau non proposé.
export function createIntrusGame(collection, level, seed, language = 'fr') {
  if (!INTRUS_LEVELS.includes(level)) throw new RangeError(`Intrus : niveau non proposé (${level})`)
  if (!isValidSeed(seed)) throw new RangeError('createIntrusGame : graine invalide')
  const l = lang(language)
  const playable = intrusPlayableItems(collection, level, l)
  if (playable.length === 0) return null
  const random = createRandom(seed)
  // Tri préalable par id : le résultat ne dépend que du contenu et de la graine
  const sorted = playable.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))
  const items = shuffled(sorted, random).slice(0, ITEMS_PER_GAME[level])
  const questions = items.flatMap(item => itemQuestions(item, l, random))
  return { seed, level, language: l, itemCount: items.length, questions }
}

// Nombre d'items par niveau et par statut (fiche de validation, tests)
export function intrusSummary(collection) {
  const summary = {}
  for (const item of collection?.items || []) {
    summary[item.niveau] ??= {}
    summary[item.niveau][item.statut] = (summary[item.niveau][item.statut] ?? 0) + 1
  }
  return summary
}
