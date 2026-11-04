// Tests des règles de validation des anagrammes mystères (§6 du document de
// conception) : pour chaque règle, un parcours valide l'accepte et un parcours
// altéré la fait échouer — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validatePath, isValidPath, revealsTheme, themeStems, wordInLabel } from './mysteryValidation.js'
import { generateMysteryWordPath, generateThemePath, generateCodedMessagePath } from './mysteryGenerators.js'
import { THEMES_MYSTERES } from '../data/themes-mysteres.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const clone = (v) => JSON.parse(JSON.stringify(v))
const rules = (path, context = { vocabulary }) => validatePath(path, context).map(e => e.rule)
const fails = (path, rule, context) => assert.ok(rules(path, context).includes(rule), `règle ${rule} attendue : ${JSON.stringify(validatePath(path, context ?? { vocabulary }))}`)

// Premier parcours généré qui vérifie la condition
function findWordPath(level, language, condition = () => true) {
  for (let seed = 0; seed < 500; seed++) {
    const p = generateMysteryWordPath(vocabulary, level, seed, language)
    if (p && condition(p)) return p
  }
  throw new Error(`aucun parcours ${level} ${language}`)
}

const word = findWordPath('CE1-CE2', 'fr', p => p.extraction.rule === 'last')
const sil = findWordPath('SIL-CP', 'fr')
const theme = generateThemePath(vocabulary, 'CE1-CE2', 3, 'fr', 'musique')

test('V0 — parcours générés valides (cas positifs), avec et sans vocabulaire', () => {
  for (const p of [word, sil, theme]) {
    assert.deepEqual(validatePath(p, { vocabulary }), [])
    assert.deepEqual(validatePath(p), [])
    assert.equal(isValidPath(p, { vocabulary }), true)
  }
  assert.deepEqual(rules(null), ['forme'])
  assert.deepEqual(rules({ steps: [] }), ['forme'])
  fails({ ...clone(word), level: 'CM3' }, 'forme')
  fails({ ...clone(word), game: 'syllables' }, 'forme')
  fails({ ...clone(word), status: 'inconnu' }, 'forme')
  fails({ ...clone(word), steps: [] }, 'forme')
})

test('V1 — §6.1 règle 1 : mêmes lettres, mélange différent de toute réponse, 3 lettres minimum, lettre placée', () => {
  const letters = clone(word)
  letters.steps[0].tiles[0] = letters.steps[0].tiles[0] === 'Z' ? 'Y' : 'Z'
  fails(letters, '6.1.1')
  const same = clone(word)
  same.steps[0].tiles = [...same.steps[0].word]
  fails(same, '6.1.1')
  const short = clone(word)
  short.steps[0] = { ...short.steps[0], word: 'AB', tiles: ['B', 'A'], answers: [{ id: 'x', word: 'AB', display: 'AB' }] }
  fails(short, '6.1.1', {})
  const given = clone(sil)
  given.steps[0].firstLetter = null
  fails(given, '6.1.1')
  // Les lettres gagnées, dans l'ordre des étapes, ne donnent pas déjà le mot mystère
  const ordered = clone(word)
  ordered.steps.sort((a, b) => a.slot - b.slot)
  fails(ordered, '6.1.1')
})

test('V2 — §6.1 règle 2 : toutes les réponses acceptées donnent le même élément secret', () => {
  const other = clone(word)
  const step = other.steps[0]
  // Anagramme ajoutée qui porte une autre dernière lettre
  const swapped = step.word.slice(-1) + step.word.slice(0, -1)
  step.answers.push({ id: 'autre', word: swapped, display: swapped })
  fails(other, '6.1.2', {})
  const position = clone(word)
  position.steps[0].secretIndex = 0
  fails(position, '6.1.2')
  // Jeu 4 : un mot à deux réponses donnerait deux mots gagnés différents
  const th = clone(theme)
  const w = th.steps[0].word
  const anagram = w.slice(1) + w[0]
  th.steps[0].answers.push({ id: 'autre', word: anagram, display: anagram })
  fails(th, '6.1.2', {})
})

test('V3 — §6.1 règle 3 : jamais deux mots aux mêmes lettres ; le mot mystère non plus', () => {
  const dup = clone(word)
  dup.steps[1] = { ...clone(dup.steps[0]), slot: dup.steps[1].slot, secret: dup.steps[1].secret }
  fails(dup, '6.1.3', {})
  const sol = clone(word)
  const s = sol.steps[0]
  sol.final.solution = s.word
  fails(sol, '6.1.3', {})
})

test('V4 — §6.1 règle 4 : les éléments reconstituent la solution, dans l\'ordre défini', () => {
  const wrong = clone(word)
  wrong.final.solution = [...wrong.final.solution].reverse().join('')
  fails(wrong, '6.1.4', {})
  const slots = clone(word)
  slots.steps[0].slot = slots.steps[1].slot
  fails(slots, '6.1.4', {})
  const missing = clone(theme)
  missing.steps[0].secret = ''
  missing.steps[0].answers[0].display = ''
  fails(missing, '6.1.4', {})
})

test('V5 — §6.1 règle 5 : solution unique ou variantes listées ; 4 propositions distinctes', () => {
  const absent = clone(word)
  absent.final.acceptedAnswers = absent.final.acceptedAnswers.map(a => ({ ...a, word: a.word + 'X' }))
  fails(absent, '6.1.5', {})
  // Anagramme du mot mystère dans le vocabulaire non acceptée (D9)
  const variants = clone(word)
  variants.final.acceptedAnswers = []
  fails(variants, '6.1.5')
  const three = clone(theme)
  three.final.options = three.final.options.slice(0, 3)
  fails(three, '6.1.5', {})
  const twice = clone(theme)
  twice.final.options[twice.final.options.indexOf(twice.final.solution) === 0 ? 1 : 0] = twice.final.solution
  fails(twice, '6.1.5', {})
})

test('V6 — §6.1 règle 6 : ni définition ni indice ne donne la solution ou le thème (formes dérivées comprises)', () => {
  const def = clone(word)
  def.steps[0].definition = `Comme les ${def.final.solution.toLowerCase()}s.`
  fails(def, '6.1.6', {})
  const hint = clone(word)
  hint.final.hints = [`Un ${hint.final.solution}.`]
  fails(hint, '6.1.6', {})
  const th = clone(theme)
  th.steps[0].definition = 'Un instrument de musique.'
  fails(th, '6.1.6', {})
  const derived = clone(theme)
  derived.steps[0].definition = 'Ce que joue un musicien.'
  fails(derived, '6.1.6', {})
  const badHint = clone(theme)
  badHint.final.hints = [badHint.final.solution]
  fails(badHint, '6.1.6', {})
  assert.deepEqual(themeStems('L\'agriculture'), ['AGRIC'])
  assert.deepEqual(themeStems('Les animaux'), ['ANIM'])
  assert.deepEqual(themeStems('La santé et l\'hygiène'), ['SANT', 'HYGI'])
  assert.equal(revealsTheme('Outil agricole.', 'L\'agriculture'), true)
  assert.equal(revealsTheme('Un tambour.', 'La musique'), false)
})

test('V7 — §6.1 règle 7 : mots interdits (liste de test) dans les mélanges, la solution et les lettres gagnées', () => {
  const step = word.steps[0]
  fails(word, '6.1.7', { blockedWords: [step.tiles.slice(0, 2).join('')] })
  fails(word, '6.1.7', { blockedWords: [word.final.solution] })
  const collected = word.steps.map(s => s.secret).join('')
  fails(word, '6.1.7', { blockedWords: [collected] })
  assert.deepEqual(validatePath(word, { blockedWords: [] }), [])
})

test('V8 — §6.1 règle 8 : en SIL-CP, jamais « first » ni de secret sur la lettre déjà placée', () => {
  const first = clone(sil)
  first.extraction = { rule: 'first' }
  fails(first, '6.1.8', {})
  const marked = clone(sil)
  marked.extraction = { rule: 'marked' }
  marked.steps[0].secretIndex = 0
  fails(marked, '6.1.8', {})
  // « first » reste permis en CE1-CE2
  const ce = findWordPath('CE1-CE2', 'fr', p => p.extraction.rule === 'first')
  assert.deepEqual(validatePath(ce, { vocabulary }), [])
})

test('V9 — §6.2 règle 1 : mot d\'étape présent, actif, du niveau et de la langue, définition exacte, anagrammes du vocabulaire acceptées', () => {
  const inactive = vocabulary.map(v => (v.id === word.steps[0].id ? { ...v, actif: false } : v))
  fails(word, '6.2.1', { vocabulary: inactive })
  const level = vocabulary.map(v => (v.id === word.steps[0].id ? { ...v, niveau_fr: 'CM1-CM2' } : v))
  fails(word, '6.2.1', { vocabulary: level })
  const def = clone(word)
  def.steps[0].definition = 'Autre définition.'
  fails(def, '6.2.1')
  const answers = clone(word)
  // Réponse inventée, absente du vocabulaire, qui garde la même dernière lettre
  const w0 = answers.steps[0].word
  const invented = [...w0.slice(0, -1)].reverse().join('') + w0.slice(-1)
  answers.steps[0].answers.push({ id: 'inventé', word: invented === w0 ? w0.slice(1, -1) + w0[0] + w0.slice(-1) : invented, display: 'X' })
  fails(answers, '6.2.1')
  const english = clone(word)
  english.language = 'en'
  fails(english, '6.2.1')
})

test('V10 — §6.2 règle 2 : le mot mystère est un mot du vocabulaire du niveau, différent des réponses', () => {
  const absent = vocabulary.filter(v => !word.final.acceptedAnswers.some(a => a.id === v.id))
  fails(word, '6.2.2', { vocabulary: absent })
})

test('V11 — §6.2 règle 3 : thème et propositions de la liste fixe (R3 : thèmes du même niveau), mots du thème, mots écartés, libellé absent des mots (R2)', () => {
  const unknown = clone(theme)
  unknown.theme = 'inconnu'
  fails(unknown, '6.2.3')
  const options = clone(theme)
  options.final.options[options.final.options.indexOf(options.final.hints[0])] = 'Les planètes'
  options.final.hints = options.final.hints.filter(h => options.final.options.includes(h))
  fails(options, '6.2.3')
  const outside = { ...THEMES_MYSTERES, 'CE1-CE2': THEMES_MYSTERES['CE1-CE2'].map(th => (th.id === 'musique' ? { ...th, sujets: ['Animaux'] } : th)) }
  fails(theme, '6.2.3', { vocabulary, themes: outside })
  const excluded = { ...THEMES_MYSTERES, 'CE1-CE2': THEMES_MYSTERES['CE1-CE2'].map(th => (th.id === 'musique' ? { ...th, excludedWords: { fr: [theme.steps[0].display], en: [] } } : th)) }
  fails(theme, '6.2.3', { vocabulary, themes: excluded })
  const r3 = { ...THEMES_MYSTERES, 'CE1-CE2': THEMES_MYSTERES['CE1-CE2'].map(th => (th.id === 'musique' ? { ...th, distractors: [{ fr: 'Le sport', en: 'Sport' }, ...th.distractors.slice(1)] } : th)) }
  fails(theme, '6.2.3', { vocabulary, themes: r3 })
  const status = clone(theme)
  status.themeStatus = 'validated'
  fails(status, '6.2.3')
  // R2 : PORT dans « transports », JEU dans « jeux », GAME dans « games »
  assert.equal(wordInLabel('PORT', 'Les transports'), true)
  assert.equal(wordInLabel('JEU', 'Les jeux et les jouets'), true)
  assert.equal(wordInLabel('GAME', 'Games and toys'), true)
  assert.equal(wordInLabel('TAXI', 'Les transports'), false)
  const label = clone(theme)
  label.final.solution = `La ${label.steps[0].word.toLowerCase()}tique`
  label.final.display = label.final.solution
  label.final.acceptedAnswers = [{ id: null, word: 'X', display: label.final.solution }]
  label.final.options[label.final.options.indexOf(theme.final.solution)] = label.final.solution
  fails(label, '6.2.3', {})
})

// Jeu 5 « Message codé » (lot 2) : premiers parcours générés qui vérifient la condition
function findCodePath(level, language, condition = () => true) {
  for (let seed = 0; seed < 500; seed++) {
    const p = generateCodedMessagePath(vocabulary, level, seed, language)
    if (p && condition(p)) return p
  }
  throw new Error(`aucun parcours codé ${level} ${language}`)
}

// Mot codé avec une lettre répétée (deux nombres identiques dans le message)
const code = findCodePath('CE1-CE2', 'fr', p => new Set(p.final.solution).size < p.final.solution.length)
const codeSil = findCodePath('SIL-CP', 'en')

test('V12 — jeu 5 : parcours valides ; forme du mot codé ; la clé a une ligne par lettre différente, nombres distincts de 1 à 26', () => {
  for (const p of [code, codeSil]) {
    assert.deepEqual(validatePath(p, { vocabulary }), [])
    assert.deepEqual(validatePath(p), [])
  }
  const kind = clone(code)
  kind.final.kind = 'word'
  fails(kind, 'forme', {})
  const accents = clone(code)
  accents.final.solution = accents.final.display.toLowerCase()
  fails(accents, 'forme', {})
  const sameCode = clone(code)
  sameCode.steps[1].code = sameCode.steps[0].code
  fails(sameCode, '6.2.4', {})
  for (const n of [0, 27, 1.5, '3', null]) {
    const range = clone(code)
    range.steps[0].code = n
    fails(range, '6.2.4', {})
  }
  // Ligne de clé manquante : une lettre du mot n'a pas de nombre
  const missing = clone(code)
  missing.steps.pop()
  fails(missing, '6.1.4', {})
})

test('V13 — jeu 5, §6.2 règle 4 : une seule lecture du message avec la clé complète', () => {
  // Nombre du message absent de la clé
  const unknown = clone(code)
  const used = new Set(unknown.steps.map(s => s.code))
  unknown.final.message[0] = [...Array(26).keys()].map(i => i + 1).find(n => !used.has(n))
  fails(unknown, '6.2.4', {})
  // Message qui se lit autrement que le mot codé
  const other = clone(code)
  const m = other.final.message
  const j = m.findIndex(n => n !== m[0])
  ;[m[0], m[j]] = [m[j], m[0]]
  fails(other, '6.2.4', {})
  // Un nombre de moins que de lettres
  const short = clone(code)
  short.final.message.pop()
  fails(short, '6.2.4', {})
})

test('V14 — jeu 5 : règles 1, 3, 5, 6, 7, 8 du §6.1 et règle 2 du §6.2 (mot du vocabulaire)', () => {
  // Règle 1 : les lettres gagnées, dans l'ordre des étapes, ne donnent pas le mot
  const distinct = findCodePath('CE1-CE2', 'fr', p => new Set(p.final.solution).size === p.final.solution.length)
  const ordered = clone(distinct)
  ordered.steps.sort((a, b) => distinct.final.solution.indexOf(a.secret) - distinct.final.solution.indexOf(b.secret))
  fails(ordered, '6.1.1', {})
  // Règle 3 : le mot codé n'a pas les mêmes lettres qu'un mot d'étape
  const same = clone(code)
  same.final.solution = same.steps[0].word
  fails(same, '6.1.3', {})
  // Règle 5 : une seule réponse acceptée, le mot codé ; orthographe exacte cohérente
  const two = clone(code)
  two.final.acceptedAnswers.push({ id: 'y', word: [...code.final.solution].reverse().join(''), display: 'Y' })
  fails(two, '6.1.5', {})
  const display = clone(code)
  display.final.display = 'AUTRE'
  fails(display, '6.1.5', {})
  // Règle 6 : définition qui donne le mot codé ; indices hors du mot ou en double
  const def = clone(code)
  def.steps[0].definition = `Comme une ${code.final.solution.toLowerCase()}.`
  fails(def, '6.1.6', {})
  const hint = clone(code)
  hint.final.hints = [...hint.final.hints.slice(0, -1), 'Z' === hint.final.solution[0] ? 'Y' : 'Z']
  fails(hint, '6.1.6', {})
  const hintTwice = clone(code)
  hintTwice.final.hints = [hintTwice.final.hints[0], hintTwice.final.hints[0]]
  fails(hintTwice, '6.1.6', {})
  // Règle 7 : mot interdit dans le mot codé ou dans les lettres gagnées
  fails(code, '6.1.7', { blockedWords: [code.final.solution] })
  fails(code, '6.1.7', { blockedWords: [code.steps.map(s => s.secret).join('')] })
  // Règle 8 : jamais « first » en SIL-CP
  const first = clone(codeSil)
  first.extraction = { rule: 'first' }
  fails(first, '6.1.8', {})
  // §6.2 règle 2 : le mot codé est l'entrée du vocabulaire du niveau et de la langue
  const absent = vocabulary.filter(v => v.id !== code.final.acceptedAnswers[0].id)
  fails(code, '6.2.2', { vocabulary: absent })
  const level = vocabulary.map(v => (v.id === code.final.acceptedAnswers[0].id ? { ...v, niveau_fr: 'CM1-CM2' } : v))
  fails(code, '6.2.2', { vocabulary: level })
  // Parcours mal formé : jamais d'exception, une erreur
  const broken = clone(code)
  broken.final.acceptedAnswers = null
  broken.final.message = 'texte'
  assert.ok(validatePath(broken, { vocabulary }).length > 0)
})
