// Tests de la préparation des parties de l'intrus (phase 7, lot C ;
// docs/intrus.md §6 et §10) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GAME_TYPE_INTRUS,
  ITEMS_PER_GAME,
  INTRUS_PROMPT,
  whyPrompt,
  intrusPlayableItems,
  createIntrusGame,
  intrusSummary
} from './intrusGame.js'

const realCollection = JSON.parse(readFileSync(new URL('../data/intrus.json', import.meta.url), 'utf8'))
const VALIDATED = 'VALIDÉE PAR ISAAC'
const FRUITS = ['BANANE', 'MANGUE', 'PAPAYE', 'ANANAS', 'GOYAVE', 'CITRON', 'AVOCAT', 'PRUNE']

// 8 items par niveau : 6 validés, 1 BROUILLON, 1 À VÉRIFIER
const statusOf = (n) => (n < 6 ? VALIDATED : n === 6 ? 'BROUILLON' : 'À VÉRIFIER')
const ceItem = (n) => ({
  id: `T-CE-${n}`, niveau: 'CE1-CE2', statut: statusOf(n),
  fr: { consigne: `Consigne ${n}`, elements: [FRUITS[n], 'MANGUE ' + n, 'CAROTTE ' + n, 'PAPAYE ' + n], intrus: 'CAROTTE ' + n, raison: `Raison ${n}` },
  en: { consigne: `Instruction ${n}`, elements: ['banana ' + n, 'mango ' + n, 'carrot ' + n, 'papaya ' + n], intrus: 'carrot ' + n, raison: `Reason ${n}` }
})
const cmItem = (n) => ({
  id: `T-CM-${n}`, niveau: 'CM1-CM2', statut: statusOf(n),
  fr: { elements: ['fourmi ' + n, 'araignée ' + n, 'abeille ' + n, 'mouche ' + n], intrus: 'araignée ' + n, raison: `Juste ${n}`, raisonsFausses: [`Fausse A ${n}`, `Fausse B ${n}`] },
  en: { elements: ['ant ' + n, 'spider ' + n, 'bee ' + n, 'fly ' + n], intrus: 'spider ' + n, raison: `Right ${n}`, raisonsFausses: [`Wrong A ${n}`, `Wrong B ${n}`] }
})
const range = (n) => Array.from({ length: n }, (_, i) => i)
const fixture = () => ({ format: 'dibie-intrus', version: 1, items: [...range(8).map(ceItem), ...range(8).map(cmItem)] })
const hidden = new Set(['T-CE-6', 'T-CE-7', 'T-CM-6', 'T-CM-7'])

test('constantes : type de jeu, 6 items par partie aux deux niveaux', () => {
  assert.equal(GAME_TYPE_INTRUS, 'intrus')
  assert.deepEqual(ITEMS_PER_GAME, { 'CE1-CE2': 6, 'CM1-CM2': 6 })
  assert.ok(Object.isFrozen(ITEMS_PER_GAME))
  assert.deepEqual(INTRUS_PROMPT, { fr: 'Trouve l\'intrus.', en: 'Find the odd one out.' })
  assert.equal(whyPrompt('araignée', 'fr'), 'Pourquoi ARAIGNÉE est-il l\'intrus ?')
  assert.equal(whyPrompt('spider', 'en'), 'Why is SPIDER the odd one out?')
})

test('items non validés jamais présents, ni en partie ni en reprise', () => {
  for (const level of ['CE1-CE2', 'CM1-CM2']) {
    assert.equal(intrusPlayableItems(fixture(), level, 'fr').length, 6)
    for (let seed = 0; seed < 100; seed++) {
      const game = createIntrusGame(fixture(), level, seed)
      for (const q of game.questions) assert.ok(!hidden.has(q.itemId), `${level}, graine ${seed} : ${q.itemId}`)
    }
  }
})

test('même graine, même partie ; graine invalide et niveau non proposé refusés', () => {
  assert.deepEqual(createIntrusGame(fixture(), 'CM1-CM2', 42), createIntrusGame(fixture(), 'CM1-CM2', 42))
  assert.throws(() => createIntrusGame(fixture(), 'CE1-CE2', -1), RangeError)
  assert.throws(() => createIntrusGame(fixture(), 'SIL-CP', 1), RangeError)
})

test('CE1-CE2 : une question par item, consigne, 4 mots en majuscules, raison en retour', () => {
  const game = createIntrusGame(fixture(), 'CE1-CE2', 7)
  assert.equal(game.itemCount, 6)
  assert.equal(game.questions.length, 6)
  for (const q of game.questions) {
    const item = fixture().items.find(i => i.id === q.itemId)
    assert.equal(q.kind, 'intrus')
    assert.equal(q.id, item.id)
    assert.equal(q.prompt, item.fr.consigne)
    assert.equal(q.options.length, 4)
    for (const o of q.options) assert.equal(o.text, o.text.toLocaleUpperCase('fr-FR'))
    assert.equal(q.options.find(o => o.id === q.answerId).text, item.fr.intrus.toLocaleUpperCase('fr-FR'))
    assert.deepEqual(q.feedback, { intrus: item.fr.intrus.toLocaleUpperCase('fr-FR'), raison: item.fr.raison })
  }
})

test('CM1-CM2 : deux questions par item, intrus puis pourquoi, intrus nommé dans la seconde', () => {
  const game = createIntrusGame(fixture(), 'CM1-CM2', 3)
  assert.equal(game.itemCount, 6)
  assert.equal(game.questions.length, 12)
  for (let i = 0; i < 12; i += 2) {
    const [first, why] = [game.questions[i], game.questions[i + 1]]
    const item = fixture().items.find(it => it.id === first.itemId)
    assert.equal(first.kind, 'intrus')
    assert.equal(first.prompt, INTRUS_PROMPT.fr)
    assert.equal(first.options.length, 4)
    assert.equal(why.kind, 'pourquoi')
    assert.equal(why.itemId, first.itemId)
    assert.equal(why.id, `${item.id}:pourquoi`)
    assert.ok(why.prompt.includes(item.fr.intrus.toLocaleUpperCase('fr-FR')))
    assert.equal(why.options.length, 3)
    assert.equal(why.options.find(o => o.id === why.answerId).text, item.fr.raison)
    assert.deepEqual(why.options.map(o => o.text).sort(), [item.fr.raison, ...item.fr.raisonsFausses].sort())
  }
})

test('reprise : propositions toujours dans un autre ordre que la première fois', () => {
  for (let seed = 0; seed < 200; seed++) {
    for (const level of ['CE1-CE2', 'CM1-CM2']) {
      for (const q of createIntrusGame(fixture(), level, seed).questions) {
        assert.notDeepEqual(q.retryOptions.map(o => o.id), q.options.map(o => o.id), `${level}, graine ${seed}`)
        assert.deepEqual(q.retryOptions.map(o => o.id).sort(), q.options.map(o => o.id).sort())
      }
    }
  }
})

test('moins d’items validés que 6 : partie plus courte ; aucun : null', () => {
  const few = fixture()
  for (const item of few.items) if (item.niveau === 'CE1-CE2' && Number(item.id.slice(-1)) >= 3) item.statut = 'BROUILLON'
  const game = createIntrusGame(few, 'CE1-CE2', 1)
  assert.equal(game.itemCount, 3)
  assert.equal(game.questions.length, 3)
  for (const item of few.items) item.statut = 'BROUILLON'
  assert.equal(createIntrusGame(few, 'CE1-CE2', 1), null)
})

test('item mal formé écarté dans sa langue seulement', () => {
  const broken = fixture()
  broken.items[0].en.intrus = 'absent'
  assert.ok(intrusPlayableItems(broken, 'CE1-CE2', 'fr').some(i => i.id === 'T-CE-0'))
  assert.ok(!intrusPlayableItems(broken, 'CE1-CE2', 'en').some(i => i.id === 'T-CE-0'))
})

test('anglais : textes tirés de item.en', () => {
  const game = createIntrusGame(fixture(), 'CM1-CM2', 5, 'en')
  assert.equal(game.language, 'en')
  const [first, why] = game.questions
  const item = fixture().items.find(i => i.id === first.itemId)
  assert.equal(first.prompt, INTRUS_PROMPT.en)
  assert.ok(first.options.every(o => item.en.elements.map(e => e.toLocaleUpperCase('en')).includes(o.text)))
  assert.equal(why.prompt, whyPrompt(item.en.intrus, 'en'))
})

// Les 60 items gardés par l'enseignante (fiche du 20/11/2026) et validés
// par Isaac le 2026-11-28 (docs/intrus.md §8)
test('vrai fichier : tous les items au statut VALIDÉ', () => {
  assert.deepEqual(intrusSummary(realCollection), { 'CE1-CE2': { VALIDÉ: 30 }, 'CM1-CM2': { VALIDÉ: 30 } })
})
