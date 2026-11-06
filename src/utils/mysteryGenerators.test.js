// Tests des générateurs des anagrammes mystères (jeux 1, 4 et 5) et de la liste
// fixe des thèmes — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizeWord } from './wordSearchGenerator.js'
import { ANAGRAM_SETTINGS, ANAGRAM_LEVELS, letterKey } from './anagramGame.js'
import {
  generateMysteryWordPath,
  generateThemePath,
  generateMysteryPath,
  generateCodedMessagePath,
  availableThemes,
  themeCandidates,
  MYSTERY_WORD_SETTINGS,
  THEME_STEP_COUNT
} from './mysteryGenerators.js'
import { validatePath } from './mysteryValidation.js'
import {
  assembleSolution,
  createMysteryState,
  startSteps,
  recordStepFound,
  advance,
  recordFinalHint,
  isValidState,
  decodeMessage,
  CODE_MAX_NUMBER,
  MYSTERY_FORMAT_VERSION
} from './mysteryEngine.js'
import { THEMES_MYSTERES, THEME_STATUSES } from '../data/themes-mysteres.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const byId = new Map(vocabulary.map(v => [v.id, v]))
const LANGUAGES = ['fr', 'en']
const SEEDS = 120

test('G1 — Mot mystère : longue série de graines, 3 niveaux, 2 langues : toujours un parcours, toujours valide', () => {
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      const { minLength, maxLength } = MYSTERY_WORD_SETTINGS[level]
      const rules = new Set()
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = generateMysteryWordPath(vocabulary, level, seed, language)
        assert.ok(p, `${language} ${level} graine ${seed} : aucun parcours`)
        assert.deepEqual(validatePath(p, { vocabulary }), [], `${language} ${level} graine ${seed}`)
        assert.equal(p.status, 'generated')
        assert.equal(p.formatVersion, MYSTERY_FORMAT_VERSION)
        assert.equal(p.language, language)
        assert.equal(p.level, level)
        rules.add(p.extraction.rule)
        // Une étape par lettre ; toutes les lettres sont obtenues et reconstituent le mot
        const solution = p.final.solution
        assert.ok(solution.length >= minLength && solution.length <= maxLength, solution)
        assert.equal(p.steps.length, solution.length)
        assert.equal(assembleSolution(p), solution)
        // Le mot mystère est un mot du vocabulaire du niveau et de la langue
        const entry = byId.get(p.final.acceptedAnswers.find(a => a.word === solution).id)
        assert.equal(entry.niveau_fr, level)
        // Aucune anagramme d'étape n'a les mêmes lettres que le mot mystère
        for (const step of p.steps) {
          assert.notEqual(letterKey(step.word), letterKey(solution))
          const { minLength: min, maxLength: max } = ANAGRAM_SETTINGS[level]
          assert.ok(step.word.length >= Math.max(3, min) && step.word.length <= max)
        }
        // SIL-CP : jamais « first », jamais le secret sur la lettre déjà placée
        if (level === 'SIL-CP') {
          assert.notEqual(p.extraction.rule, 'first')
          for (const step of p.steps) assert.ok(step.secretIndex >= 1)
        }
      }
      // Les règles varient d'une graine à l'autre
      assert.ok(rules.size >= 2, `${language} ${level} : ${[...rules]}`)
      if (level === 'SIL-CP') assert.ok(!rules.has('first'))
    }
  }
})

test('G2 — Mystère des thèmes : chaque thème disponible, longue série de graines, 2 langues : parcours valides tirés de la liste fixe', () => {
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      for (const theme of availableThemes(vocabulary, level, language)) {
        for (let seed = 0; seed < 40; seed++) {
          const p = generateThemePath(vocabulary, level, seed, language, theme.id)
          assert.ok(p, `${language} ${level} ${theme.id} graine ${seed}`)
          assert.deepEqual(validatePath(p, { vocabulary }), [])
          assert.equal(p.steps.length, THEME_STEP_COUNT)
          assert.equal(p.final.solution, theme.label[language])
          assert.deepEqual([...p.final.options].sort(), [theme.label[language], ...theme.distractors.map(d => d[language])].sort())
          assert.equal(p.themeStatus, theme.status)
          for (const step of p.steps) {
            assert.ok(theme.sujets.includes(byId.get(step.id).sujet))
            assert.equal(step.answers.length, 1, 'R1 : aucun mot à plusieurs anagrammes')
            assert.equal(step.secret, step.display)
          }
        }
      }
    }
  }
  // Thème inconnu ou jeu inconnu : aucun parcours. Les jeux 2, 3 et 6 (lot 3)
  // passent par le même point d'entrée (parcours préconçus)
  assert.equal(generateThemePath(vocabulary, 'CE1-CE2', 1, 'fr', 'inconnu'), null)
  assert.equal(generateMysteryPath('inconnu', vocabulary, 'CE1-CE2', 1, 'fr'), null)
  assert.equal(generateMysteryPath('grandRiddle', vocabulary, 'CE1-CE2', 1, 'fr')?.game, 'grandRiddle')
  assert.equal(generateMysteryPath('syllables', vocabulary, 'CE1-CE2', 1, 'fr')?.game, 'syllables')
  assert.equal(generateMysteryPath('secretSentence', vocabulary, 'CE1-CE2', 1, 'fr')?.game, 'secretSentence')
})

test('G3 — reproductibilité : même graine, niveau, langue (et thème) = même parcours ; ordre du vocabulaire sans effet', () => {
  const reversed = [...vocabulary].reverse()
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      for (const seed of [0, 7, 12345, 4294967295]) {
        const a = generateMysteryWordPath(vocabulary, level, seed, language)
        assert.deepEqual(generateMysteryWordPath(vocabulary, level, seed, language), a)
        assert.deepEqual(generateMysteryWordPath(reversed, level, seed, language), a)
        assert.deepEqual(generateMysteryPath('mysteryWord', vocabulary, level, seed, language), a)
        const theme = availableThemes(vocabulary, level, language)[0]
        const t = generateThemePath(vocabulary, level, seed, language, theme.id)
        assert.deepEqual(generateThemePath(reversed, level, seed, language, theme.id), t)
        assert.deepEqual(generateMysteryPath('theme', vocabulary, level, seed, language, { themeId: theme.id }), t)
      }
    }
  }
  const words = new Set()
  for (let seed = 0; seed < 20; seed++) words.add(generateMysteryWordPath(vocabulary, 'CE1-CE2', seed, 'fr').final.solution)
  assert.ok(words.size > 10, 'les mots mystères varient')
  assert.throws(() => generateMysteryWordPath(vocabulary, 'CM3', 1), RangeError)
  assert.throws(() => generateMysteryWordPath(vocabulary, 'SIL-CP', -1), RangeError)
  assert.throws(() => generateThemePath(vocabulary, 'SIL-CP', 1.5, 'fr', 'ecole'), RangeError)
})

test('G4 — mots interdits (liste de test) : jamais dans les mélanges, la solution ni les lettres gagnées', () => {
  const blockedWords = ['MA', 'NI', 'TE']
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      for (let seed = 0; seed < 15; seed++) {
        const p = generateMysteryWordPath(vocabulary, level, seed, language, { blockedWords })
        assert.ok(p)
        assert.deepEqual(validatePath(p, { vocabulary, blockedWords }), [])
        const texts = [p.final.solution, p.steps.map(s => s.secret).join(''), ...p.steps.flatMap(s => [s.word, (s.firstLetter ?? '') + s.tiles.join('')])]
        for (const text of texts) for (const b of blockedWords) assert.ok(!text.includes(b), `${text} contient ${b}`)
      }
    }
  }
})

test('G5 — liste fixe des thèmes (validée par Isaac le 2026-11-03) : 22 thèmes, format, sujets existants, R3', () => {
  assert.deepEqual(ANAGRAM_LEVELS.map(l => THEMES_MYSTERES[l].length), [8, 7, 7])
  for (const level of ANAGRAM_LEVELS) {
    const list = THEMES_MYSTERES[level]
    assert.equal(new Set(list.map(th => th.id)).size, list.length, 'identifiants uniques')
    const subjects = new Set(vocabulary.filter(v => v.niveau_fr === level && v.actif !== false).map(v => v.sujet))
    for (const th of list) {
      assert.match(th.id, /^[a-z-]+$/)
      assert.equal(th.status, 'isaac-validated')
      assert.ok(THEME_STATUSES.includes(th.status))
      assert.ok(th.label.fr && th.label.en)
      for (const s of th.sujets) assert.ok(subjects.has(s), `${level} ${th.id} : sujet absent du vocabulaire : ${s}`)
      assert.equal(th.distractors.length, 3)
      // R3 : chaque proposition fausse est le libellé d'un autre thème du même niveau
      for (const d of th.distractors) {
        assert.ok(list.some(o => o.id !== th.id && o.label.fr === d.fr && o.label.en === d.en), `${level} ${th.id} : ${d.fr}`)
      }
      for (const language of LANGUAGES) {
        for (const w of th.excludedWords[language]) assert.equal(normalizeWord(w), w, 'mots écartés déjà normalisés')
      }
    }
  }
})

test('G6 — un thème qui n\'a pas assez de mots utilisables pour un parcours est retiré automatiquement', () => {
  const transports = THEMES_MYSTERES['CE1-CE2'].find(th => th.id === 'transports')
  const fake = {
    'CE1-CE2': [
      { ...THEMES_MYSTERES['CE1-CE2'].find(th => th.id === 'musique') },
      // Sujet réel mais assez de mots écartés pour qu'il en reste un de moins
      // que la longueur d'un parcours : retiré
      {
        ...transports,
        excludedWords: {
          fr: [...transports.excludedWords.fr, ...themeCandidates(vocabulary, 'CE1-CE2', 'fr', transports).map(c => c.word).slice(0, -(THEME_STEP_COUNT - 1))],
          en: []
        }
      },
      // Sujet inexistant : retiré
      { id: 'vide', sujets: ['Sujet inexistant'], label: { fr: 'Le vide', en: 'Nothing' }, distractors: [], excludedWords: { fr: [], en: [] }, status: 'draft' }
    ]
  }
  const ids = availableThemes(vocabulary, 'CE1-CE2', 'fr', { themes: fake }).map(th => th.id)
  assert.deepEqual(ids, ['musique'])
  assert.equal(generateThemePath(vocabulary, 'CE1-CE2', 1, 'fr', 'vide', { themes: fake }), null)
  // Dans la liste réelle : les thèmes retirés n'ont jamais assez de mots, les autres en ont assez
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      const available = new Set(availableThemes(vocabulary, level, language).map(th => th.id))
      for (const th of THEMES_MYSTERES[level]) {
        const count = new Set(themeCandidates(vocabulary, level, language, th).map(c => letterKey(c.word))).size
        assert.equal(available.has(th.id), count >= THEME_STEP_COUNT, `${level} ${language} ${th.id} : ${count} mots`)
      }
    }
  }
})

test('G7 — reprise : le parcours enregistré (JSON) reste valide sans le vocabulaire, l\'état aussi', () => {
  for (const language of LANGUAGES) {
    const p = generateMysteryWordPath(vocabulary, 'CM1-CM2', 99, language)
    let s = startSteps(createMysteryState(p))
    s = recordStepFound(s, p.steps[0].answers[0])
    const stored = JSON.parse(JSON.stringify({ formatVersion: MYSTERY_FORMAT_VERSION, path: p, state: s }))
    assert.deepEqual(stored.path, p)
    assert.deepEqual(validatePath(stored.path), [])
    assert.equal(isValidState(stored.state, stored.path), true)
    // Un vocabulaire changé depuis (import local) n'empêche pas la reprise :
    // le parcours complet est enregistré, pas seulement son numéro
    const altered = vocabulary.filter(v => v.id !== p.steps[0].id)
    assert.notDeepEqual(generateMysteryWordPath(altered, 'CM1-CM2', 99, language), p)
    assert.deepEqual(validatePath(stored.path), [])
  }
})

test('G8 — Message codé : longue série de graines, 3 niveaux, 2 langues : toujours un parcours valide, une ligne de clé par lettre différente, lecture unique', () => {
  let notAlphabet = 0
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      const { minLength, maxLength } = MYSTERY_WORD_SETTINGS[level]
      const rules = new Set()
      for (let seed = 0; seed < SEEDS; seed++) {
        const p = generateCodedMessagePath(vocabulary, level, seed, language)
        assert.ok(p, `${language} ${level} graine ${seed} : aucun parcours`)
        assert.deepEqual(validatePath(p, { vocabulary }), [], `${language} ${level} graine ${seed}`)
        assert.equal(p.game, 'codedMessage')
        assert.equal(p.status, 'generated')
        assert.equal(p.formatVersion, MYSTERY_FORMAT_VERSION)
        assert.equal(p.final.kind, 'code')
        rules.add(p.extraction.rule)
        // C4 : un mot du vocabulaire du niveau, codé sans accents, au moins 2 lettres différentes
        const solution = p.final.solution
        assert.match(solution, /^[A-Z]+$/)
        assert.ok(solution.length >= minLength && solution.length <= maxLength, solution)
        const letters = new Set(solution)
        assert.ok(letters.size >= 2)
        const entry = byId.get(p.final.acceptedAnswers[0].id)
        assert.equal(entry.niveau_fr, level)
        assert.equal(normalizeWord(p.final.display), solution)
        assert.equal(p.final.acceptedAnswers.length, 1, 'seule réponse : le mot codé')
        // C2 : une étape par lettre différente ; C1 : nombres distincts de 1 à 26
        assert.equal(p.steps.length, letters.size)
        assert.deepEqual(new Set(p.steps.map(s => s.secret)), letters)
        const codes = p.steps.map(s => s.code)
        assert.equal(new Set(codes).size, codes.length)
        for (const n of codes) assert.ok(Number.isInteger(n) && n >= 1 && n <= CODE_MAX_NUMBER)
        if (p.steps.some(s => s.code !== s.secret.charCodeAt(0) - 64)) notAlphabet++
        // C3 : clé complète, lecture unique
        assert.equal(p.final.message.length, solution.length)
        assert.equal(decodeMessage(p), solution)
        for (const step of p.steps) {
          assert.notEqual(letterKey(step.word), letterKey(solution))
          assert.equal(step.slot, null)
        }
        // SIL-CP : jamais « first », jamais le secret sur la lettre déjà placée
        if (level === 'SIL-CP') {
          assert.notEqual(p.extraction.rule, 'first')
          for (const step of p.steps) assert.ok(step.secretIndex >= 1)
        }
      }
      assert.ok(rules.size >= 2, `${language} ${level} : ${[...rules]}`)
    }
  }
  // C1 : nombres tirés au hasard, pas A = 1
  assert.ok(notAlphabet >= SEEDS * 6 - 1, 'les nombres ne suivent pas l\'alphabet')
})

test('G9 — Message codé : reproductibilité, ordre du vocabulaire sans effet, mots et nombres qui varient, mots interdits', () => {
  const reversed = [...vocabulary].reverse()
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      for (const seed of [0, 7, 12345, 4294967295]) {
        const a = generateCodedMessagePath(vocabulary, level, seed, language)
        assert.deepEqual(generateCodedMessagePath(vocabulary, level, seed, language), a)
        assert.deepEqual(generateCodedMessagePath(reversed, level, seed, language), a)
        assert.deepEqual(generateMysteryPath('codedMessage', vocabulary, level, seed, language), a)
      }
    }
  }
  const words = new Set()
  const messages = new Set()
  for (let seed = 0; seed < 20; seed++) {
    const p = generateCodedMessagePath(vocabulary, 'CE1-CE2', seed, 'fr')
    words.add(p.final.solution)
    messages.add(p.final.message.join(','))
  }
  assert.ok(words.size > 10, 'les mots codés varient')
  assert.ok(messages.size > 10, 'les messages varient')
  assert.throws(() => generateCodedMessagePath(vocabulary, 'CM3', 1), RangeError)
  assert.throws(() => generateCodedMessagePath(vocabulary, 'SIL-CP', -1), RangeError)
  const blockedWords = ['MA', 'NI', 'TE']
  for (const language of LANGUAGES) {
    for (const level of ANAGRAM_LEVELS) {
      for (let seed = 0; seed < 10; seed++) {
        const p = generateCodedMessagePath(vocabulary, level, seed, language, { blockedWords })
        assert.ok(p)
        assert.deepEqual(validatePath(p, { vocabulary, blockedWords }), [])
        const texts = [p.final.solution, p.steps.map(s => s.secret).join(''), ...p.steps.flatMap(s => [s.word, (s.firstLetter ?? '') + s.tiles.join('')])]
        for (const text of texts) for (const b of blockedWords) assert.ok(!text.includes(b), `${text} contient ${b}`)
      }
    }
  }
})

test('G10 — Message codé : reprise, le parcours enregistré (JSON) et l\'état avec indice restent valides sans le vocabulaire', () => {
  for (const language of LANGUAGES) {
    const p = generateCodedMessagePath(vocabulary, 'SIL-CP', 42, language)
    let s = startSteps(createMysteryState(p))
    for (let i = 0; i < p.steps.length; i++) s = advance(recordStepFound(s, p.steps[i].answers[0]))
    s = recordFinalHint(s, p)
    const stored = JSON.parse(JSON.stringify({ formatVersion: MYSTERY_FORMAT_VERSION, path: p, state: s }))
    assert.deepEqual(stored.path, p)
    assert.deepEqual(validatePath(stored.path), [])
    assert.equal(isValidState(stored.state, stored.path), true)
    assert.equal(stored.state.final.revealed.length, 1)
  }
})
