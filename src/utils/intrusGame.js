// L'intrus (fiche L9 ; phase 7, lot C : docs/intrus.md). Module pur : aucun
// accès au stockage ni à l'interface.
//
// Données : src/data/intrus.json, items rédigés à la main (jamais générés
// depuis le champ `sujet`, fiche L9), avec un statut par item. Seuls les items
// « VALIDÉE PAR ISAAC » ou plus sont proposés aux élèves (P6, même règle que
// les Grilles du maître). Les parties sont jouées par le moteur D
// (choiceGames.js), inchangé : une question par item en CE1-CE2, deux à la
// suite au CM1-CM2 (l'intrus, puis « pourquoi ? »), approche 1 de docs/intrus.md.

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
