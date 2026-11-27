// Tests du quiz « définition → mot » (phase 7, lot A, moteur D ; docs/quiz.md
// §6 et §7) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  QUIZ_SETTINGS,
  QUIZ_LEVELS,
  GAME_TYPE_QUIZ_DEFINITION,
  quizSettings,
  quizSubjects,
  createDefinitionQuiz
} from './choiceGames.js'
import { definitionCandidates, definitionRevealsForm, textForms } from './pairsGame.js'

const vocabulaire = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const SEEDS = 20 // graines de contrôle par sujet (durée des tests)
const LANGUAGES = ['fr', 'en']

const entry = (id, fr, en, defFr, defEn, extra = {}) => ({
  id, mot_fr: fr, mot_en: en, def_fr: defFr, def_en: defEn ?? `def ${id}`, niveau_fr: 'CE1-CE2', sujet: 'Test', actif: true, ...extra
})

test('réglages : 3 questions / 3 propositions en SIL-CP (C1 révisé), 6 / 3 en CE1-CE2, 8 / 4 en CM1-CM2', () => {
  assert.equal(GAME_TYPE_QUIZ_DEFINITION, 'quizDefinition')
  assert.deepEqual(QUIZ_LEVELS, ['SIL-CP', 'CE1-CE2', 'CM1-CM2'])
  assert.deepEqual(quizSettings('SIL-CP'), { questionCount: 3, optionCount: 3 })
  assert.deepEqual(quizSettings('CE1-CE2'), { questionCount: 6, optionCount: 3 })
  assert.deepEqual(quizSettings('CM1-CM2'), { questionCount: 8, optionCount: 4 })
  assert.deepEqual(QUIZ_SETTINGS['CM1-CM2'], { questionCount: 8, optionCount: 4 })
  assert.throws(() => quizSettings('CM3'), RangeError)
  assert.ok(Object.isFrozen(QUIZ_SETTINGS))
})

// Petit vocabulaire : ADDITIONNER et AJOUTER partagent la forme anglaise « Add » ;
// MARCHÉ et FOIRE ont la même définition française
const petit = [
  entry('t01', 'ADDITIONNER', 'Add', 'Calculer une somme avec le signe plus.'),
  entry('t02', 'AJOUTER', 'Add / Put in', 'Mettre une quantité en plus.'),
  entry('t03', 'MARCHÉ', 'Market', 'Lieu où l’on vend des produits.'),
  entry('t04', 'FOIRE', 'Fair', 'Lieu où l’on vend des produits.'),
  entry('t05', 'MAISON', 'House', 'Lieu où habite une famille.'),
  entry('t06', 'ÉCOLE', 'School', 'Lieu où les enfants apprennent.'),
  entry('t07', 'CRAIE', 'Chalk', 'Bâton blanc pour écrire au tableau.'),
  entry('t08', 'CAHIER', 'Exercise book', 'Feuilles reliées pour écrire.'),
  entry('t09', 'RÈGLE', 'Ruler', 'Outil droit pour tracer des traits.'),
  entry('t10', 'GOMME', 'Eraser', 'Objet qui efface le crayon.')
]

test('petit vocabulaire : synonymes jamais proposés ensemble, questions toutes différentes', () => {
  for (let seed = 0; seed < 50; seed++) {
    const quiz = createDefinitionQuiz(petit, 'CE1-CE2', seed)
    assert.ok(quiz, `graine ${seed} : quiz attendu`)
    assert.equal(quiz.questions.length, 6)
    const prompts = quiz.questions.map(q => q.prompt)
    assert.equal(new Set(prompts).size, prompts.length, `graine ${seed} : deux questions identiques`)
    for (const q of quiz.questions) {
      const ids = q.options.map(o => o.id)
      assert.ok(!(ids.includes('t01') && ids.includes('t02')), `graine ${seed} : ADDITIONNER et AJOUTER ensemble`)
    }
  }
})

test('même graine, même quiz ; graine invalide refusée ; niveau non proposé refusé', () => {
  assert.deepEqual(createDefinitionQuiz(petit, 'CE1-CE2', 123), createDefinitionQuiz(petit, 'CE1-CE2', 123))
  assert.throws(() => createDefinitionQuiz(petit, 'CE1-CE2', -1), RangeError)
  assert.throws(() => createDefinitionQuiz(petit, 'CM3', 1), RangeError)
})

test('forme d’une question : prompt = définition, options en majuscules, réponse et retour', () => {
  const quiz = createDefinitionQuiz(petit, 'CE1-CE2', 7)
  assert.equal(quiz.seed, 7)
  assert.equal(quiz.level, 'CE1-CE2')
  assert.equal(quiz.language, 'fr')
  for (const q of quiz.questions) {
    const source = petit.find(e => e.id === q.id)
    assert.equal(q.answerId, q.id)
    assert.equal(q.prompt, source.def_fr)
    assert.deepEqual(q.feedback, { word: source.mot_fr, definition: source.def_fr })
    for (const o of q.options) assert.equal(o.text, o.text.toLocaleUpperCase('fr-FR'))
  }
})

test('reprise : propositions toujours dans un autre ordre que la première fois', () => {
  for (let seed = 0; seed < 200; seed++) {
    const quiz = createDefinitionQuiz(petit, 'CE1-CE2', seed)
    for (const q of quiz.questions) {
      assert.notDeepEqual(q.retryOptions.map(o => o.id), q.options.map(o => o.id), `graine ${seed} : même ordre en reprise`)
    }
  }
})

// C8 (Isaac, 2026-11-17) : un même mot n'est jamais la réponse de deux
// questions d'une série (deux entrées SWAP aux définitions presque identiques)
const doublons = [
  ...petit,
  entry('t11', 'GOMME', 'Rubber', 'Petit bloc souple qui enlève les traits de crayon.'),
  entry('t12', 'CRAIE', 'Chalk stick', 'Petit bâton qui écrit en blanc sur l’ardoise.')
]

test('C8 : jamais deux fois le même mot réponse dans une série', () => {
  for (let seed = 0; seed < 200; seed++) {
    const quiz = createDefinitionQuiz(doublons, 'CE1-CE2', seed)
    const words = quiz.questions.map(q => q.feedback.word)
    assert.equal(new Set(words).size, words.length, `graine ${seed} : ${words.join(', ')}`)
  }
})

test('sujet trop petit : non jouable, pas de quiz', () => {
  const trois = petit.slice(4, 7)
  const [info] = quizSubjects(trois, 'CE1-CE2')
  assert.equal(info.playable, false)
  assert.equal(createDefinitionQuiz(trois, 'CE1-CE2', 1), null)
})

// Balayage de toute la base : tout sujet déclaré jouable donne une série
// complète, conforme aux règles du §6.2, pour chaque graine de contrôle
for (const language of LANGUAGES) {
  for (const level of QUIZ_LEVELS) {
    test(`toute la base, ${language}, ${level} : séries complètes et sans deuxième bonne réponse`, () => {
      const { questionCount, optionCount } = quizSettings(level)
      const levelEntries = vocabulaire.filter(v => v.niveau_fr === level)
      const subjects = quizSubjects(levelEntries, level, language)
      let playable = 0
      for (const info of subjects) {
        assert.equal(info.playable, info.questions >= questionCount && info.groups >= optionCount)
        if (!info.playable) continue
        playable++
        const entries = levelEntries.filter(v => v.sujet === info.subject)
        const candidates = new Map(definitionCandidates(entries.filter(v => v.actif !== false), language).map(c => [c.id, c]))
        for (let seed = 0; seed < SEEDS; seed++) {
          const quiz = createDefinitionQuiz(entries, level, seed, language)
          const where = `${info.subject}, graine ${seed}`
          assert.ok(quiz, `${where} : quiz attendu`)
          assert.equal(quiz.questions.length, questionCount, where)
          const prompts = quiz.questions.map(q => q.prompt)
          assert.equal(new Set(prompts).size, questionCount, `${where} : définitions répétées`)
          const words = quiz.questions.map(q => q.feedback.word)
          assert.equal(new Set(words).size, questionCount, `${where} : même mot réponse deux fois (C8)`)
          for (const q of quiz.questions) {
            const ids = q.options.map(o => o.id)
            assert.equal(ids.length, optionCount, where)
            assert.deepEqual([...q.retryOptions.map(o => o.id)].sort(), [...ids].sort(), where)
            assert.equal(ids.filter(id => id === q.answerId).length, 1, `${where} : une seule bonne réponse`)
            for (const id of ids) {
              const source = entries.find(v => v.id === id)
              assert.ok(source && source.actif !== false, `${where} : entrée ${id} hors sujet ou inactive`)
            }
            for (let i = 0; i < ids.length; i++) {
              for (let j = i + 1; j < ids.length; j++) {
                const a = candidates.get(ids[i])
                const b = candidates.get(ids[j])
                assert.ok(!a.keys.some(k => b.keys.includes(k)), `${where} : ${a.word} et ${b.word} partagent une clé`)
              }
            }
            const answer = entries.find(v => v.id === q.answerId)
            const word = language === 'en' ? answer.mot_en : answer.mot_fr
            for (const form of textForms(word)) {
              assert.ok(!definitionRevealsForm(q.prompt, form), `${where} : la définition donne ${form}`)
            }
          }
        }
      }
      // Mesure informative, recopiée dans docs/quiz.md §6
      console.log(`Quiz ${language} ${level} : ${playable}/${subjects.length} sujets jouables`)
      assert.ok(playable > 0)
    })
  }
}
