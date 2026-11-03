// Tests de la préparation d'une partie d'anagrammes — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRandom, normalizeWord } from './wordSearchGenerator.js'
import { BLOCKED_WORDS } from './wordSearchGame.js'
import {
  createAnagramGame,
  buildAnswerIndex,
  scrambleWord,
  reshuffleOrder,
  findAnswer,
  correctPositions,
  firstLettersHint,
  definitionRevealsWord,
  gridTokens,
  letterKey,
  ANAGRAM_SETTINGS,
  ANAGRAM_LEVELS,
  MIN_WORD_LENGTH
} from './anagramGame.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const byId = new Map(vocabulary.map(v => [v.id, v]))
const englishForm = (v) => v.mot_en.split('/')[0].trim().toUpperCase()
const SEEDS = 300

// Ordre affiché d'un mot : première lettre placée (SIL-CP) puis tuiles
const shown = (item) => (item.firstLetter ?? '') + item.tiles.join('')

test('A1 — chaque niveau et chaque langue : 5 mots, longueurs du niveau, mélange jamais égal à une bonne réponse (longue série de graines)', () => {
  for (const language of ['fr', 'en']) {
    for (const level of ANAGRAM_LEVELS) {
      const { minLength, maxLength, wordCount, firstLetterGiven } = ANAGRAM_SETTINGS[level]
      for (let seed = 0; seed < SEEDS; seed++) {
        const { items } = createAnagramGame(vocabulary, level, seed, language)
        assert.equal(items.length, wordCount, `${language} ${level} graine ${seed}`)
        const keys = new Set()
        for (const item of items) {
          assert.ok(item.word.length >= Math.max(MIN_WORD_LENGTH, minLength) && item.word.length <= maxLength, item.word)
          assert.match(item.word, /^[A-Z]+$/)
          // Les tuiles et la lettre placée redonnent exactement les lettres du mot
          assert.equal(letterKey(shown(item)), letterKey(item.word))
          assert.equal(item.firstLetter, firstLetterGiven ? item.word[0] : null)
          assert.equal(item.tiles.length, item.word.length - (firstLetterGiven ? 1 : 0))
          // Jamais le mot lui-même ni une autre bonne réponse
          for (const a of item.answers) assert.notEqual(shown(item), a.word)
          // Le mot proposé garde son id et son orthographe dans les bonnes réponses
          assert.deepEqual(item.answers.find(a => a.word === item.word), { id: item.id, word: item.word, display: item.display })
          // Lettre déjà placée : seules les anagrammes qui commencent par elle sont acceptées
          if (item.firstLetter) for (const a of item.answers) assert.equal(a.word[0], item.firstLetter)
          assert.ok(new Set(item.word).size > 1, `lettres toutes identiques : ${item.word}`)
          keys.add(letterKey(item.word))
        }
        // Deux anagrammes l'une de l'autre ne sont jamais dans la même partie
        assert.equal(keys.size, items.length)
      }
    }
  }
})

test('A2 — langue : mot et définition dans la langue de la partie, orthographe exacte conservée', () => {
  for (const level of ANAGRAM_LEVELS) {
    for (let seed = 0; seed < 50; seed++) {
      for (const item of createAnagramGame(vocabulary, level, seed, 'fr').items) {
        const v = byId.get(item.id)
        assert.equal(item.display, v.mot_fr)
        assert.equal(item.word, normalizeWord(v.mot_fr))
        assert.equal(item.definition, v.def_fr.trim())
        assert.equal(v.niveau_fr, level)
        assert.notEqual(v.actif, false)
      }
      for (const item of createAnagramGame(vocabulary, level, seed, 'en').items) {
        const v = byId.get(item.id)
        assert.equal(item.display, englishForm(v))
        assert.equal(item.definition, v.def_en.trim())
        assert.ok(!/[\s'-]/.test(item.display), `forme composée : ${item.display}`)
      }
    }
  }
  // Français par défaut
  assert.deepEqual(createAnagramGame(vocabulary, 'CE1-CE2', 7), createAnagramGame(vocabulary, 'CE1-CE2', 7, 'fr'))
})

test('A3 — reproductibilité : même graine, niveau, langue et vocabulaire = même partie ; ordre du vocabulaire sans effet', () => {
  const shuffledVocabulary = [...vocabulary].reverse()
  for (const level of ANAGRAM_LEVELS) {
    for (const language of ['fr', 'en']) {
      for (const seed of [0, 1, 42, 2026, 123456789, 4294967295]) {
        const a = createAnagramGame(vocabulary, level, seed, language)
        assert.deepEqual(createAnagramGame(vocabulary, level, seed, language), a)
        assert.deepEqual(createAnagramGame(shuffledVocabulary, level, seed, language), a)
      }
    }
  }
  const a = createAnagramGame(vocabulary, 'CM1-CM2', 2026)
  const b = createAnagramGame(vocabulary, 'CM1-CM2', 2027)
  assert.notDeepEqual(a.items.map(i => i.id), b.items.map(i => i.id))
})

test('A4 — toutes les anagrammes réelles du vocabulaire sont acceptées (D9), même niveau et même langue seulement', () => {
  const fr = buildAnswerIndex(vocabulary, 'CE1-CE2', 'fr')
  const camion = fr.get(letterKey('CAMION')).map(a => a.word).sort()
  assert.deepEqual(camion, ['CAMION', 'MANIOC'])
  // Deux entrées (NDOLÉ, NDOLÈ) qui donnent le même mot normalisé : une seule réponse
  assert.equal(fr.get(letterKey('NDOLE')).length, 1)
  const en = buildAnswerIndex(vocabulary, 'CE1-CE2', 'en')
  assert.deepEqual(en.get(letterKey('LAMP')).map(a => a.word).sort(), ['LAMP', 'PALM'])
  // PIÈCES / ÉPICES n'existent pas en CM1-CM2 : pas de réponse croisée entre niveaux
  assert.equal(buildAnswerIndex(vocabulary, 'CM1-CM2', 'fr').get(letterKey('EPICES')), undefined)

  // Dans une partie, une autre anagramme est acceptée ; l'orthographe exacte est rendue
  let checked = 0
  for (let seed = 0; seed < 2000 && checked < 5; seed++) {
    for (const item of createAnagramGame(vocabulary, 'CE1-CE2', seed, 'fr').items) {
      if (item.answers.length < 2) continue
      for (const a of item.answers) {
        assert.equal(findAnswer(item, a.word), a)
        assert.equal(correctPositions(item, a.word), a.word.length)
      }
      checked++
    }
  }
  assert.ok(checked > 0, 'aucune partie CE1-CE2 ne contient un mot à plusieurs anagrammes')
})

test('A5 — vérification d\'un essai : bonne réponse avec ou sans accents, lettres bien placées, indice', () => {
  const vocab = [
    { id: 'p1', mot_fr: 'PIÈCES', mot_en: 'COINS', def_fr: 'Monnaie.', def_en: 'Money.', niveau_fr: 'CE1-CE2', actif: true },
    { id: 'p2', mot_fr: 'ÉPICES', mot_en: 'SPICES', def_fr: 'Pour cuisiner.', def_en: 'For cooking.', niveau_fr: 'CE1-CE2', actif: true },
    { id: 'p3', mot_fr: 'SPICEE', mot_en: 'X', def_fr: 'Inactif.', def_en: 'Inactive.', niveau_fr: 'CE1-CE2', actif: false }
  ]
  const { items } = createAnagramGame(vocab, 'CE1-CE2', 3)
  assert.equal(items.length, 1) // PIÈCES et ÉPICES : un seul des deux par partie
  const item = items[0]
  assert.deepEqual(item.answers.map(a => a.display).sort(), ['PIÈCES', 'ÉPICES'])
  assert.equal(findAnswer(item, 'epices').display, 'ÉPICES')
  assert.equal(findAnswer(item, 'PIÈCES').display, 'PIÈCES')
  assert.equal(findAnswer(item, 'SPICEE'), null) // entrée inactive : refusée
  assert.equal(findAnswer(item, 'CIPEES'), null)
  assert.equal(correctPositions(item, 'PIECSE'), 4) // P I E C bien placés pour PIECES
  // Indice pris dans l'orthographe exacte : accent conservé
  assert.equal(firstLettersHint(item), [...item.display][0])
  assert.ok(['P', 'É'].includes(firstLettersHint(item)))

  const sil = createAnagramGame([
    { id: 's1', mot_fr: 'SOLEIL', mot_en: 'SUN', def_fr: 'Astre.', def_en: 'Star.', niveau_fr: 'SIL-CP', actif: true }
  ], 'SIL-CP', 1, 'en').items[0]
  assert.equal(sil.firstLetter, 'S')
  assert.equal(firstLettersHint(sil), 'SU')

  // Ligature : Œ vaut deux lettres de grille, l'indice ne donne pas plus
  // de lettres que prévu et les écrit comme sur les tuiles
  assert.equal(firstLettersHint({ display: 'ŒUF', firstLetter: null }), 'O')
  assert.equal(firstLettersHint({ display: 'ŒUF', firstLetter: 'O' }), 'OE')
  assert.equal(firstLettersHint({ display: 'BŒUF', firstLetter: 'B' }), 'BO')
  assert.equal(firstLettersHint({ display: 'CHŒUR', firstLetter: null }), 'C')
  assert.equal(firstLettersHint({ display: 'ÉPICES', firstLetter: 'E' }), 'ÉP')
})

test('A6 — mots écartés : moins de 3 lettres, lettres toutes identiques, aucun mélange différent possible, sans définition, composés', () => {
  const r = createRandom(1)
  assert.equal(scrambleWord('AAA', [], r), null)
  // Première lettre placée : les tuiles « LL » n'ont qu'un ordre, qui redonne le mot
  assert.equal(scrambleWord('ALL', [], r, { firstLetterGiven: true }), null)
  // Lettres pas toutes identiques, sans lettre placée : un ordre différent du mot (BAB ou BBA) est trouvé
  assert.deepEqual(scrambleWord('ABB', [], createRandom(5)).tiles.join('') !== 'ABB', true)
  // Tous les ordres sont des bonnes réponses : mot écarté
  assert.equal(scrambleWord('AB', ['BA'], r), null)

  const vocab = [
    { id: 'a', mot_fr: 'NON', mot_en: 'NO', def_fr: 'Refus.', def_en: 'Refusal.', niveau_fr: 'SIL-CP', actif: true },
    { id: 'b', mot_fr: 'EAU', mot_en: 'WATER', def_fr: '', def_en: 'Liquid.', niveau_fr: 'SIL-CP', actif: true },
    { id: 'c', mot_fr: 'BÉBÉ', mot_en: 'BABY', def_fr: 'Petit enfant.', def_en: 'Small child.', niveau_fr: 'SIL-CP', actif: true },
    { id: 'd', mot_fr: 'ÎLE', mot_en: 'ICE CREAM', def_fr: 'Terre.', def_en: 'Cold food.', niveau_fr: 'SIL-CP', actif: true },
    { id: 'e', mot_fr: 'OS', mot_en: 'BONE', def_fr: 'Squelette.', def_en: 'Skeleton.', niveau_fr: 'SIL-CP', actif: true },
    { id: 'f', mot_fr: 'OEUF', mot_en: 'EGG', def_fr: 'Pondu.', def_en: 'Laid.', niveau_fr: 'SIL-CP', actif: true }
  ]
  // NON (première lettre placée : « ON » ou « NO » -> NNO seul possible) reste ;
  // EAU sans définition ; ÎLE ; OS trop court ; OEUF ; BÉBÉ
  assert.deepEqual(createAnagramGame(vocab, 'SIL-CP', 1).items.map(i => i.id).sort(), ['a', 'c', 'd', 'f'])
  // Anglais : NO trop court, ICE CREAM composé, EGG (tuiles « GG », un seul ordre) écarté
  assert.deepEqual(createAnagramGame(vocab, 'SIL-CP', 1, 'en').items.map(i => i.id).sort(), ['b', 'c', 'e'])
})

test('A7 — mots interdits (liste de test non vide) : jamais dans le mélange, mot qui en contient un écarté', () => {
  assert.deepEqual([...BLOCKED_WORDS], []) // liste réelle vide : jeu en démonstration
  const blockedWords = ['MA', 'ni', 'Té']
  const blocked = ['MA', 'NI', 'TE']
  for (const language of ['fr', 'en']) {
    for (const level of ANAGRAM_LEVELS) {
      for (let seed = 0; seed < 100; seed++) {
        const { items } = createAnagramGame(vocabulary, level, seed, language, { blockedWords })
        for (const item of items) {
          for (const b of blocked) {
            assert.ok(!shown(item).includes(b), `${shown(item)} contient ${b}`)
            assert.ok(!item.tiles.join('').includes(b), `${item.tiles.join('')} contient ${b}`)
            assert.ok(!item.word.includes(b), `${item.word} contient ${b}`)
          }
          for (let round = 0; round < 3; round++) {
            const order = reshuffleOrder(item, item.tiles, seed, 0, round, { blockedWords })
            const again = order.map(i => item.tiles[i]).join('')
            for (const b of blocked) assert.ok(!again.includes(b), `${again} contient ${b}`)
          }
        }
      }
    }
  }
  // Un mélange impossible sans mot interdit écarte le mot
  assert.equal(scrambleWord('ABC', [], createRandom(1), { blockedWords: ['A'] }), null)
})

test('A8 — « Mélanger à nouveau » : même règle, ordre changé si possible, reproductible', () => {
  for (const level of ANAGRAM_LEVELS) {
    for (let seed = 0; seed < 100; seed++) {
      const { items } = createAnagramGame(vocabulary, level, seed, 'fr')
      items.forEach((item, w) => {
        let tiles = item.tiles
        for (let round = 0; round < 5; round++) {
          const order = reshuffleOrder(item, tiles, seed, w, round)
          assert.deepEqual([...order].sort((a, b) => a - b), tiles.map((_, i) => i))
          const next = order.map(i => tiles[i])
          assert.deepEqual(reshuffleOrder(item, tiles, seed, w, round), order)
          const nextShown = (item.firstLetter ?? '') + next.join('')
          for (const a of item.answers) assert.notEqual(nextShown, a.word)
          if (new Set(tiles).size > 2 || tiles.length > 3) assert.notEqual(next.join(''), tiles.join(''))
          tiles = next
        }
      })
    }
  }
})

test('A9 — paramètres invalides refusés', () => {
  assert.throws(() => createAnagramGame(vocabulary, 'CM3', 1), RangeError)
  assert.throws(() => createAnagramGame(vocabulary, 'SIL-CP', -1), RangeError)
  assert.throws(() => createAnagramGame(vocabulary, 'SIL-CP', 1.5), RangeError)
  assert.deepEqual(createAnagramGame([], 'SIL-CP', 1).items, [])
})

test('A10 — aucune définition proposée ne contient le mot ni un mot qui commence par lui (1 000 graines, tous niveaux, deux langues)', () => {
  assert.deepEqual(gridTokens("S'arrête : les familles, œufs"), ['S', 'ARRETE', 'LES', 'FAMILLES', 'OEUFS'])
  assert.equal(definitionRevealsWord('Les familles du village.', 'FAMILLE'), true)
  assert.equal(definitionRevealsWord("Le bus s'arrête ici.", 'ARRET'), true)
  assert.equal(definitionRevealsWord('Ten milligrams.', 'MILLIGRAM'), true)
  assert.equal(definitionRevealsWord('Une salle de classe.', 'SEL'), false)
  for (const language of ['fr', 'en']) {
    for (const level of ANAGRAM_LEVELS) {
      for (let seed = 0; seed < 1000; seed++) {
        const { items } = createAnagramGame(vocabulary, level, seed, language)
        assert.equal(items.length, 5, `${language} ${level} graine ${seed}`)
        for (const item of items) {
          const revealing = gridTokens(item.definition).filter(token => token.startsWith(item.word))
          assert.deepEqual(revealing, [], `${item.word} : « ${item.definition} »`)
        }
      }
    }
  }
  // Mot écarté même si c'est le seul du niveau
  assert.deepEqual(createAnagramGame([
    { id: 'f', mot_fr: 'FAMILLE', mot_en: 'FAMILY', def_fr: 'Les familles.', def_en: 'Relatives.', niveau_fr: 'CE1-CE2', actif: true }
  ], 'CE1-CE2', 1).items, [])
})

test('A11 — lettre déjà placée (SIL-CP) : non comptée dans les lettres bien placées', () => {
  for (let seed = 0; seed < 200; seed++) {
    for (const item of createAnagramGame(vocabulary, 'SIL-CP', seed, 'fr').items) {
      assert.equal(correctPositions(item, item.word), item.word.length - 1)
      // Lettre placée seule, cases de l'élève toutes fausses : 0
      const wrong = item.firstLetter + 'Ø'.repeat(item.word.length - 1)
      assert.equal(correctPositions(item, wrong), 0)
    }
  }
  const item = createAnagramGame([
    { id: 's', mot_fr: 'SAC', mot_en: 'BAG', def_fr: 'Pour porter.', def_en: 'To carry.', niveau_fr: 'SIL-CP', actif: true }
  ], 'SIL-CP', 1).items[0]
  assert.equal(correctPositions(item, 'SCA'), 0)
  assert.equal(correctPositions(item, 'SAC'), 2)
  // Sans lettre placée, toutes les cases comptent
  const ce = createAnagramGame([
    { id: 'c', mot_fr: 'CAMION', mot_en: 'TRUCK', def_fr: 'Véhicule.', def_en: 'Vehicle.', niveau_fr: 'CE1-CE2', actif: true }
  ], 'CE1-CE2', 1).items[0]
  assert.equal(correctPositions(ce, 'CAMINO'), 4)
})

test('A12 — lettre déjà placée : seules les anagrammes qui commencent par elle sont acceptées (SON / NOS)', () => {
  const vocab = [
    { id: 'a', mot_fr: 'SON', mot_en: 'SOUND', def_fr: "Ce que l'on entend.", def_en: 'What you hear.', niveau_fr: 'SIL-CP', actif: true },
    { id: 'b', mot_fr: 'NOS', mot_en: 'OUR', def_fr: 'À nous.', def_en: 'Belonging to us.', niveau_fr: 'SIL-CP', actif: true }
  ]
  for (let seed = 0; seed < 50; seed++) {
    const [item] = createAnagramGame(vocab, 'SIL-CP', seed).items
    const other = item.word === 'SON' ? 'NOS' : 'SON'
    assert.deepEqual(item.answers.map(a => a.word), [item.word])
    assert.equal(findAnswer(item, other), null)
    assert.equal(findAnswer(item, item.word).id, item.id)
  }
  // Sans lettre placée (CE1-CE2), les deux restent acceptées
  const ce = vocab.map(v => ({ ...v, niveau_fr: 'CE1-CE2', mot_fr: v.mot_fr + 'T' }))
  ce[0].mot_fr = 'TONS'; ce[1].mot_fr = 'SONT'
  const [item] = createAnagramGame(ce, 'CE1-CE2', 1).items
  assert.deepEqual(item.answers.map(a => a.word).sort(), ['SONT', 'TONS'])
})

test("A13 — doublons normalisés (NDOLÉ / NDOLÈ) : id et orthographe de l'entrée proposée", () => {
  const vocab = [
    { id: 'n1', mot_fr: 'NDOLÉ', mot_en: 'NDOLE', def_fr: '', def_en: '', niveau_fr: 'CE1-CE2', actif: true },
    { id: 'n2', mot_fr: 'NDOLÈ', mot_en: 'NDOLE', def_fr: 'Plat camerounais.', def_en: 'Cameroonian dish.', niveau_fr: 'CE1-CE2', actif: true }
  ]
  const [item] = createAnagramGame(vocab, 'CE1-CE2', 1).items
  assert.equal(item.id, 'n2')
  assert.deepEqual(findAnswer(item, 'NDOLE'), { id: 'n2', word: 'NDOLE', display: 'NDOLÈ' })
})
