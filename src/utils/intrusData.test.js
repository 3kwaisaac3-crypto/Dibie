// Tests des données de l'intrus (phase 7, lot C ; docs/intrus.md §5 et §10)
// — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { INTRUS_LEVELS, ELEMENTS_PER_ITEM, WRONG_REASONS_PER_ITEM, intrusItemErrors } from './intrusGame.js'
import { MASTER_GRID_STATUSES } from './grillesMaitre.js'

const collection = JSON.parse(readFileSync(new URL('../data/intrus.json', import.meta.url), 'utf8'))
const ITEMS_PER_LEVEL = 30 // lot 0 : 30 items par niveau (cadrage P6)
const LANGUAGES = ['fr', 'en']

test('constantes : niveaux, 4 éléments, 2 raisons fausses', () => {
  assert.deepEqual(INTRUS_LEVELS, ['CE1-CE2', 'CM1-CM2'])
  assert.ok(Object.isFrozen(INTRUS_LEVELS))
  assert.equal(ELEMENTS_PER_ITEM, 4)
  assert.equal(WRONG_REASONS_PER_ITEM, 2)
})

test('fichier : format, identifiants uniques, 30 items par niveau, statuts connus', () => {
  assert.equal(collection.format, 'dibie-intrus')
  assert.equal(collection.version, 1)
  const ids = collection.items.map(i => i.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const level of INTRUS_LEVELS) {
    assert.equal(collection.items.filter(i => i.niveau === level).length, ITEMS_PER_LEVEL, level)
  }
  for (const item of collection.items) assert.ok(MASTER_GRID_STATUSES.includes(item.statut), `${item.id} : ${item.statut}`)
})

test('fichier : chaque item est bien formé dans les deux langues', () => {
  for (const item of collection.items) {
    for (const lang of LANGUAGES) assert.deepEqual(intrusItemErrors(item, lang), [], `${item.id} (${lang})`)
  }
})

// Items fabriqués : un défaut à la fois
const ce = () => ({
  id: 'T-CE', niveau: 'CE1-CE2', statut: 'VALIDÉE PAR ISAAC',
  fr: { consigne: 'Trouve ce qui n’est pas un fruit.', elements: ['BANANE', 'MANGUE', 'CAROTTE', 'PAPAYE'], intrus: 'CAROTTE', raison: 'La carotte est un légume.' },
  en: { consigne: 'Find the one that is not a fruit.', elements: ['banana', 'mango', 'carrot', 'papaya'], intrus: 'carrot', raison: 'A carrot is a vegetable.' }
})
const cm = () => ({
  id: 'T-CM', niveau: 'CM1-CM2', statut: 'VALIDÉE PAR ISAAC',
  fr: { elements: ['FOURMI', 'ARAIGNÉE', 'ABEILLE', 'MOUCHE'], intrus: 'ARAIGNÉE', raison: 'Les trois autres ont 6 pattes.', raisonsFausses: ['Elle est plus grosse.', 'Elle vit dehors.'] },
  en: { elements: ['ant', 'spider', 'bee', 'fly'], intrus: 'spider', raison: 'The other three have 6 legs.', raisonsFausses: ['It is bigger.', 'It lives outside.'] }
})

test('item bien formé : aucune erreur', () => {
  assert.deepEqual(intrusItemErrors(ce(), 'fr'), [])
  assert.deepEqual(intrusItemErrors(cm(), 'en'), [])
})

test('item mal formé : au moins une erreur pour chaque défaut', () => {
  const cases = {
    'trois éléments': (i) => { i.fr.elements = i.fr.elements.slice(0, 3) },
    'deux éléments égaux (casse)': (i) => { i.fr.elements[1] = 'banane' },
    'intrus absent': (i) => { i.fr.intrus = 'POMME' },
    'raison vide': (i) => { i.fr.raison = '  ' },
    'CE sans consigne': (i) => { delete i.fr.consigne },
    'niveau inconnu': (i) => { i.niveau = 'SIL-CP' }
  }
  for (const [name, spoil] of Object.entries(cases)) {
    const item = ce()
    spoil(item)
    assert.ok(intrusItemErrors(item, 'fr').length > 0, name)
  }
  const cmCases = {
    'une seule raison fausse': (i) => { i.fr.raisonsFausses = ['Elle est plus grosse.'] },
    'raison fausse égale à la juste': (i) => { i.fr.raisonsFausses[0] = i.fr.raison },
    'raisons fausses égales': (i) => { i.fr.raisonsFausses[1] = i.fr.raisonsFausses[0] }
  }
  for (const [name, spoil] of Object.entries(cmCases)) {
    const item = cm()
    spoil(item)
    assert.ok(intrusItemErrors(item, 'fr').length > 0, name)
  }
})

test('langue absente : erreur', () => {
  const item = ce()
  delete item.en
  assert.ok(intrusItemErrors(item, 'en').length > 0)
  assert.deepEqual(intrusItemErrors(item, 'fr'), [])
})

// Relecture finale (2026-11-17) : contenus corrigés avant validation
const byId = (id) => collection.items.find(i => i.id === id)
test('I-CM-26 FR : un seul critère sépare les mots (pluriel en -aux), pas animal / objet', () => {
  assert.deepEqual(byId('I-CM-26').fr.elements, ['CHEVAL', 'ANIMAL', 'JOURNAL', 'LIVRE'])
  assert.equal(byId('I-CM-26').fr.intrus, 'LIVRE')
})
test('raisons fausses qui ne sont pas défendables (I-CM-03, I-CM-04)', () => {
  const defendables = ['Le requin est le plus gros des quatre.', 'The shark is the biggest of the four.',
    'L\'araignée est plus grosse que les trois autres.', 'The spider is bigger than the other three.']
  for (const id of ['I-CM-03', 'I-CM-04']) {
    for (const lang of LANGUAGES) {
      for (const r of byId(id)[lang].raisonsFausses) assert.ok(!defendables.includes(r), `${id} (${lang}) : ${r}`)
    }
  }
})
