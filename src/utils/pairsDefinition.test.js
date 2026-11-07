// Tests du lot C de la phase 4 : définitions du lot 0 appliquées au
// vocabulaire, et jeu L4 « mot ↔ définition » (moteur C) — lancer avec : npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  pairKey,
  textForms,
  displayText,
  guaranteedPairCount,
  createPairsState,
  tryMatch,
  canHint,
  canShowAnswer,
  showAnswer,
  isFinished,
  pairsScore,
  pairStatus,
  definitionMentions,
  definitionRevealsForm,
  definitionCandidate,
  definitionCandidates,
  definitionSubjects,
  definitionPairCount,
  createDefinitionGame,
  DEFINITION_SETTINGS,
  DEFINITION_LEVELS,
  MENTION_MIN_LETTERS,
  POINTS_PER_PAIR,
  ERRORS_BEFORE_HINT,
  ERRORS_BEFORE_ANSWER,
  GAME_TYPE_DEFINITION
} from './pairsGame.js'

const vocabulaire = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const SEEDS = 20 // graines de contrôle par sujet (durée des tests, cadrage §7)

const entry = (id, fr, en, defFr, defEn, extra = {}) => ({
  id, mot_fr: fr, mot_en: en, def_fr: defFr, def_en: defEn ?? `def ${id}`, niveau_fr: 'CE1-CE2', sujet: 'Test', actif: true, ...extra
})
const sharesKey = (a, b) => a.keys.some(k => b.keys.includes(k))
const byId = (id) => vocabulaire.find(v => v.id === id)

// --- 1. Définitions du lot 0 (DIBIE/contenus/definitions-ambigues-lot0-v0.1.md,
// bloc JSON « decision: valide », validé par Isaac le 2026-11-06) -------------

const LOT0 = [
  { id: 'vocab_0177', mot_fr: 'PAVÉ', def_fr: "Forme en volume qui ressemble à une brique ou à une boîte d'allumettes.", def_en: 'A 3D shape like a brick or a matchbox.' },
  { id: 'vocab_0146', mot_fr: 'PARALLÉLÉPIPÈDE', def_en: 'A 3D shape with six faces, all of them parallelograms.' },
  { id: 'vocab_0012', mot_fr: 'ADDITIONNER', def_fr: 'Calculer combien font plusieurs nombres mis ensemble, avec le signe +.', def_en: 'To work out how much several numbers make together, using the + sign.' },
  { id: 'vocab_0019', mot_fr: 'AJOUTER', def_fr: "Mettre une quantité en plus d'une autre : 5 billes, et encore 3.", def_en: 'To put one amount with another to make more: 5 marbles, and 3 more.' },
  { id: 'vocab_0113', mot_fr: 'AXIALE', def_fr: 'Se dit de la symétrie par rapport à une droite.', def_en: 'Describes symmetry about a line.' },
  { id: 'vocab_0123', mot_fr: 'CENTRALE', def_fr: 'Se dit de la symétrie par rapport à un point.', def_en: 'Describes symmetry about a point.' },
  { id: 'vocab_0045', mot_fr: 'ENTIER', def_fr: 'Se dit de 0, 7 ou 152 : ni virgule, ni fraction.', def_en: 'Describes 0, 7 or 152: no decimal point and no fraction.' },
  { id: 'vocab_0016', mot_fr: 'CARDINAL', def_fr: "Se dit de un, deux, trois… quand ils disent combien il y a d'objets.", def_en: 'Describes one, two, three… when they tell how many things there are.' },
  { id: 'vocab_0025', mot_fr: 'ÉCART', def_fr: 'Ce qui sépare deux valeurs : entre 7 et 10, il est de 3.', def_en: 'How far apart two values are: between 7 and 10, it is 3.' },
  { id: 'vocab_0469', mot_fr: 'MAGASIN', def_fr: "Grande salle fermée, pleine d'étagères, où l'on fait ses courses.", def_en: 'A big indoor room with long shelves full of products.' },
  { id: 'vocab_0632', mot_fr: 'DOUCHE', def_fr: "Installation où l'eau coule sur tout le corps, quand on est debout.", def_en: 'A place where water runs over your body while you stand.' },
  { id: 'vocab_0739', mot_fr: 'DOUCHE', def_fr: "On s'y lave debout, tout le corps.", def_en: 'We stand in it to wash our whole body.' },
  { id: 'vocab_0704', mot_fr: 'GROUPE', def_fr: "Petite équipe d'artistes qui, avec leurs instruments, se produisent ensemble sur scène.", def_en: 'A small team of performers with instruments, on stage together.' },
  { id: 'vocab_0476', mot_fr: 'TROTTOIR', def_fr: 'Bord un peu plus haut que la route, où marchent les piétons.', def_en: 'The slightly raised edge of the road where people walk.' }
]

test('Vocabulaire : les 14 définitions validées du lot 0 sont appliquées (id et mot vérifiés)', () => {
  assert.equal(LOT0.length, 14)
  for (const d of LOT0) {
    const v = byId(d.id)
    assert.ok(v, `${d.id} absent`)
    assert.equal(v.mot_fr, d.mot_fr)
    if (d.def_fr !== undefined) assert.equal(v.def_fr, d.def_fr, `${d.id} def_fr`)
    if (d.def_en !== undefined) assert.equal(v.def_en, d.def_en, `${d.id} def_en`)
  }
  // PARALLÉLÉPIPÈDE : def_fr inchangée ; RANGER : aucune correction (option a)
  assert.equal(byId('vocab_0146').def_fr, 'Solide ayant six faces en forme de parallélogrammes.')
  assert.equal(byId('vocab_0079').mot_fr, 'RANGER')
  assert.equal(byId('vocab_0079').def_fr, "Mettre des objets ou des nombres chacun à sa place, l’un après l’autre.")
  // Les définitions identiques du cadrage §5 (règle 2) ont disparu
  assert.notEqual(byId('vocab_0177').def_fr, byId('vocab_0146').def_fr)
  assert.notEqual(byId('vocab_0012').def_fr, byId('vocab_0019').def_fr)
  assert.notEqual(byId('vocab_0113').def_fr, byId('vocab_0123').def_fr)
})

// --- 2. Réglages ----------------------------------------------------------

test('Réglages L4 : pas de SIL-CP, 4 paires en CE1-CE2, 5 en CM1-CM2 (P3 b), 10 points, aides à 2 et 3 erreurs', () => {
  assert.deepEqual(DEFINITION_LEVELS, ['CE1-CE2', 'CM1-CM2'])
  assert.deepEqual(DEFINITION_LEVELS.map(definitionPairCount), [4, 5])
  assert.equal(DEFINITION_SETTINGS['SIL-CP'], undefined)
  assert.throws(() => definitionPairCount('SIL-CP'), RangeError)
  assert.throws(() => definitionSubjects([], 'SIL-CP'), RangeError)
  const sil = vocabulaire.filter(v => v.niveau_fr === 'SIL-CP' && v.sujet === 'Fruits')
  assert.throws(() => createDefinitionGame(sil, 'SIL-CP', 1), RangeError)
  assert.equal(POINTS_PER_PAIR, 10)
  assert.equal(ERRORS_BEFORE_HINT, 2)
  assert.equal(ERRORS_BEFORE_ANSWER, 3)
  assert.equal(GAME_TYPE_DEFINITION, 'pairsDefinition')
})

// --- 3. Critères de texte -------------------------------------------------

test('Règle §6.2 : mot entier normalisé ou pluriel simple, mots composés, moins de 3 lettres ignorés', () => {
  assert.equal(MENTION_MIN_LETTERS, 3)
  assert.equal(definitionMentions('Un solide a des faces planes.', 'FACE'), true) // pluriel
  assert.equal(definitionMentions('Le côté du carré.', 'CÔTÉ'), true)
  assert.equal(definitionMentions('Le cote du carre.', 'CÔTÉ'), true) // accents ignorés
  assert.equal(definitionMentions('Des œufs frais.', 'ŒUF'), true) // ligature
  assert.equal(definitionMentions('Des bijoux en or.', 'BIJOU'), true) // pluriel en X
  assert.equal(definitionMentions('Bâtiment de la mairie, ou hôtel de ville.', 'HÔTEL DE VILLE'), true)
  assert.equal(definitionMentions('Un hôtel en ville.', 'HÔTEL DE VILLE'), false)
  // Faux positifs écartés : sous-chaînes (ARE dans AIRE, HECTARE), féminin, dérivés
  assert.equal(definitionMentions("Unité d'aire égale à 1 hm².", 'ARE'), false)
  assert.equal(definitionMentions('Cent ares font un hectare.', 'ARE'), true)
  assert.equal(definitionMentions('Formé par deux demi-droites.', 'DROIT'), false)
  assert.equal(definitionMentions('Instrument à cordes.', 'COR'), false)
  assert.equal(definitionMentions('A drum played with the hands.', 'PLAY'), false)
  // Mots de moins de 3 lettres
  assert.equal(definitionMentions('Do, ré, mi : la gamme.', 'DO'), false)
  assert.equal(definitionMentions(undefined, 'FACE'), false)
})

test('Règle existante (definitionRevealsWord) : définition qui donne son propre mot, mots composés, toutes les formes', () => {
  assert.equal(definitionRevealsForm('Les familles du village.', 'FAMILLE'), true)
  assert.equal(definitionRevealsForm("Le bus s'arrête ici.", 'ARRÊT'), true)
  assert.equal(definitionRevealsForm('Une salle de classe.', 'SEL'), false)
  assert.equal(definitionRevealsForm('Se laver les mains avec du savon.', 'LAVAGE DES MAINS'), false)
  assert.equal(definitionRevealsForm('Le lavage des mains avant le repas.', 'LAVAGE DES MAINS'), true)
  // Toutes les formes « A / B » : une ancienne définition d'ÉCART contenait « difference »
  const ecart = entry('e', 'ÉCART', 'Gap / Difference', 'Distance entre deux valeurs.', 'The difference between two numbers.')
  assert.equal(definitionCandidate(ecart, 'en'), null)
  assert.ok(definitionCandidate(ecart, 'fr'))
})

// --- 4. Candidats ---------------------------------------------------------

test('Candidat L4 : mot et définition de la langue, indice = traduction, clés de toutes les formes FR et EN (L0-T)', () => {
  const e = entry('a', 'COULOIR', 'Hallway / Corridor', 'Passage étroit dans une maison.', 'A narrow passage in a house.')
  const fr = definitionCandidate(e, 'fr')
  assert.equal(fr.word, 'COULOIR')
  assert.equal(fr.definition, 'Passage étroit dans une maison.')
  assert.equal(fr.translation, 'HALLWAY')
  assert.equal(fr.translationLang, 'en')
  assert.ok(['w:COULOIR', 'w:HALLWAY', 'w:CORRIDOR'].every(k => fr.keys.includes(k)))
  assert.ok(fr.keys.includes(`d:${pairKey('Passage étroit dans une maison.')}`))
  assert.equal(fr.restricted, false) // P11 ne s'applique pas à L4
  const en = definitionCandidate(e, 'en')
  assert.equal(en.word, 'HALLWAY')
  assert.equal(en.definition, 'A narrow passage in a house.')
  assert.equal(en.translation, 'COULOIR')
  assert.equal(en.translationLang, 'fr')
  // Mot identique dans les deux langues : gardé (P11 hors L4)
  assert.ok(definitionCandidate(entry('t', 'TOTAL', 'Total', 'Le résultat final.', 'The final result.'), 'fr'))
  // Inutilisables : inactive, définition vide, définition qui donne le mot
  assert.equal(definitionCandidate(entry('x', 'X', 'Y', 'déf', 'def', { actif: false })), null)
  assert.equal(definitionCandidate(entry('y', 'MOT', 'Word', '  ', 'A word.'), 'fr'), null)
  assert.equal(definitionCandidate(entry('z', 'FAMILLE', 'Family', 'Les familles du village.', 'People.'), 'fr'), null)
  assert.equal(definitionCandidate(null), null)
})

test('Tirage L4 : synonymes (forme partagée, L0-T), définitions identiques, définition qui cite un autre mot (§6.2)', () => {
  // L0-T : ADDITIONNER / AJOUTER partagent « Add » même dans un jeu de définitions
  const add1 = definitionCandidate(entry('1', 'ADDITIONNER', 'Add', 'Calculer une somme.', 'To find a sum.'), 'fr')
  const add2 = definitionCandidate(entry('2', 'AJOUTER', 'Add / Put in', 'Mettre en plus.', 'To put more.'), 'fr')
  assert.ok(sharesKey(add1, add2))
  // Définitions identiques
  const p1 = definitionCandidate(entry('3', 'PAVÉ', 'Box', 'Solide à six faces.', 'A box.'), 'fr')
  const p2 = definitionCandidate(entry('4', 'PRISME', 'Prism', 'Solide à six faces.', 'A prism.'), 'fr')
  assert.ok(sharesKey(p1, p2))
  // §6.2 : la définition de TROTTOIR cite RUE -> jamais ensemble ; les autres restent libres
  const entries = [
    entry('r', 'RUE', 'Street', 'Voie bordée de maisons.', 'A road with houses.'),
    entry('t', 'TROTTOIR', 'Pavement', 'Partie de la rue pour les piétons.', 'The edge of the road for people.'),
    entry('b', 'BANC', 'Bench', 'Siège long.', 'A long seat.'),
    entry('p', 'PONT', 'Bridge', 'Passage au-dessus de l’eau.', 'A way over water.')
  ]
  const fr = definitionCandidates(entries, 'fr')
  const [rue, trottoir, banc] = ['r', 't', 'b'].map(id => fr.find(c => c.id === id))
  assert.deepEqual(trottoir.mentions, ['r'])
  assert.ok(sharesKey(rue, trottoir))
  assert.ok(!sharesKey(banc, trottoir) && !sharesKey(banc, rue))
  assert.equal(guaranteedPairCount(fr), 3)
  // En anglais, la définition de TROTTOIR ne cite pas STREET : pas de lien
  assert.equal(guaranteedPairCount(definitionCandidates(entries, 'en')), 4)
  for (let seed = 0; seed < 100; seed++) {
    assert.equal(createDefinitionGame(entries, 'CE1-CE2', seed, 'fr'), null) // 4 paires impossibles en français
    const game = createDefinitionGame(entries, 'CE1-CE2', seed, 'en')
    assert.equal(game.pairs.length, 4)
  }
})

// --- 5. Parties -----------------------------------------------------------

test('Partie L4 reproductible : même graine, même partie ; mots en majuscules, définitions telles quelles', () => {
  const entries = vocabulaire.filter(v => v.niveau_fr === 'CE1-CE2' && v.sujet === 'Commerce' && v.actif !== false)
  const a = createDefinitionGame(entries, 'CE1-CE2', 4242, 'fr')
  const b = createDefinitionGame(entries, 'CE1-CE2', 4242, 'fr')
  assert.deepEqual(a, b)
  assert.equal(a.pairs.length, 4)
  assert.equal(a.language, 'fr')
  assert.notDeepEqual(a.rightOrder, a.leftOrder)
  assert.notDeepEqual(createDefinitionGame(entries, 'CE1-CE2', 4243, 'fr'), a)
  for (const p of a.pairs) {
    const v = byId(p.id)
    assert.equal(p.left.text, displayText(v.mot_fr))
    assert.equal(p.left.text, p.left.text.toLocaleUpperCase('fr-FR'))
    assert.equal(p.left.kind, 'word')
    assert.equal(p.right.text, v.def_fr.trim())
    assert.equal(p.right.kind, 'definition')
    // Indice : la traduction du mot dans l'autre langue (première forme, majuscules)
    assert.equal(p.left.translation, displayText(v.mot_en))
    assert.equal(p.left.translationLang, 'en')
  }
  const en = createDefinitionGame(entries, 'CE1-CE2', 4242, 'en')
  assert.equal(en.language, 'en')
  for (const p of en.pairs) {
    const v = byId(p.id)
    assert.equal(p.left.text, displayText(v.mot_en))
    assert.equal(p.right.text, v.def_en.trim())
    assert.equal(p.left.translation, displayText(v.mot_fr))
    assert.equal(p.left.translationLang, 'fr')
  }
})

test('Vocabulaire réel : chaque sujet jouable (FR et EN) donne une partie complète et sûre pour toutes les graines de contrôle', () => {
  for (const language of ['fr', 'en']) {
    for (const level of DEFINITION_LEVELS) {
      const levelEntries = vocabulaire.filter(v => v.niveau_fr === level)
      const count = definitionPairCount(level)
      for (const { subject, playable, usable } of definitionSubjects(levelEntries, level, language)) {
        assert.equal(playable, usable >= count)
        if (!playable) continue
        const entries = levelEntries.filter(v => v.sujet === subject && v.actif !== false)
        for (let seed = 0; seed < SEEDS; seed++) {
          const where = `${language} / ${level} / ${subject} / graine ${seed}`
          const game = createDefinitionGame(entries, level, seed, language)
          assert.ok(game, where)
          assert.equal(game.pairs.length, count, where)
          const chosen = game.pairs.map(p => byId(p.id))
          const word = (v) => (language === 'fr' ? v.mot_fr : v.mot_en)
          const forms = chosen.map(v => [...textForms(v.mot_fr), ...textForms(v.mot_en)].map(pairKey))
          for (let i = 0; i < chosen.length; i++) {
            const def = game.pairs[i].right.text
            // La définition ne donne pas son propre mot
            assert.ok(!textForms(word(chosen[i])).some(f => definitionRevealsForm(def, f)), `${where} : ${def}`)
            for (let j = 0; j < chosen.length; j++) {
              if (i === j) continue
              // L0-T : aucune forme FR ou EN commune
              assert.ok(!forms[i].some(f => forms[j].includes(f)), `${where} : ${chosen[i].mot_fr} / ${chosen[j].mot_fr}`)
              // §6.2 : aucune définition ne cite le mot affiché d'une autre paire
              assert.ok(!definitionMentions(def, textForms(word(chosen[j]))[0]), `${where} : « ${def} » cite ${game.pairs[j].left.text}`)
            }
          }
          // Jamais deux définitions identiques
          const defs = game.pairs.map(p => pairKey(p.right.text))
          assert.equal(new Set(defs).size, defs.length, where)
        }
      }
    }
  }
})

test('Vocabulaire réel : sujets jouables par niveau et par langue (mesure du lot C, docs/paires.md §15)', () => {
  const playable = (level, language) => definitionSubjects(vocabulaire.filter(v => v.niveau_fr === level), level, language)
  const summary = {}
  for (const language of ['fr', 'en']) {
    for (const level of DEFINITION_LEVELS) {
      const list = playable(level, language)
      summary[`${language} ${level}`] = `${list.filter(s => s.playable).length}/${list.length}`
    }
  }
  assert.deepEqual(summary, {
    'fr CE1-CE2': '31/33',
    'fr CM1-CM2': '32/51',
    'en CE1-CE2': '31/33',
    'en CM1-CM2': '32/51'
  })
  // Sujets des définitions corrigées : Commerce, Hygiène, Musique, Ville (CE1-CE2), Symétrie et Nombres (CM1-CM2) jouables
  for (const [level, subject] of [['CE1-CE2', 'Commerce'], ['CE1-CE2', 'Hygiène'], ['CE1-CE2', 'Musique'], ['CE1-CE2', 'Ville'], ['CM1-CM2', 'Symétrie'], ['CM1-CM2', 'Nombres']]) {
    for (const language of ['fr', 'en']) {
      assert.ok(playable(level, language).find(s => s.subject === subject)?.playable, `${language} ${level} ${subject}`)
    }
  }
})

test('Vocabulaire réel : synonymes du lot 0 jamais ensemble (MAGASIN / BOUTIQUE ; L0-T), ni TROTTOIR avec un mot que sa définition cite', () => {
  const entries = vocabulaire.filter(v => v.niveau_fr === 'CE1-CE2' && v.sujet === 'Commerce' && v.actif !== false)
  assert.ok(['MAGASIN', 'BOUTIQUE'].every(w => entries.some(e => e.mot_fr === w)))
  for (const language of ['fr', 'en']) {
    for (let seed = 0; seed < 200; seed++) {
      const ids = createDefinitionGame(entries, 'CE1-CE2', seed, language).pairs.map(p => byId(p.id).mot_fr)
      assert.ok(!(ids.includes('MAGASIN') && ids.includes('BOUTIQUE')), `${language} / graine ${seed}`)
    }
  }
  // Les quatre couples de synonymes du lot 0 (§1) partagent bien une forme anglaise :
  // ADDITIONNER / AJOUTER, PAVÉ / PARALLÉLÉPIPÈDE, RANGER / ORDONNER, MAGASIN / BOUTIQUE
  const pairsOfSynonyms = [['vocab_0012', 'vocab_0019'], ['vocab_0177', 'vocab_0146'], ['vocab_0079', 'vocab_0097'], ['vocab_0469', 'vocab_0592']]
  for (const [a, b] of pairsOfSynonyms) {
    assert.ok(sharesKey(definitionCandidate(byId(a), 'fr'), definitionCandidate(byId(b), 'fr')), `${a} / ${b}`)
  }
})

// --- 6. Déroulement : aides, points, fin ----------------------------------

test('Partie L4 jouée : indice à 2 erreurs, « Voir la réponse » à 3 (0 point), 10 points par paire, fin à la dernière paire', () => {
  const entries = vocabulaire.filter(v => v.niveau_fr === 'CM1-CM2' && v.sujet === 'Symétrie' && v.actif !== false)
  const game = createDefinitionGame(entries, 'CM1-CM2', 7, 'fr')
  assert.equal(game.pairs.length, 5)
  const [a, b, c, ...rest] = game.leftOrder
  let state = createPairsState()
  state = tryMatch(state, a, b).state
  assert.equal(canHint(state, 'left', a), false)
  state = tryMatch(state, a, c).state
  assert.equal(canHint(state, 'left', a), true)
  assert.equal(canShowAnswer(state, 'left', a), false)
  state = tryMatch(state, a, rest[0]).state
  assert.equal(canShowAnswer(state, 'left', a), true)
  assert.equal(pairsScore(state), 0) // sans pénalité
  state = showAnswer(state, a)
  assert.equal(pairStatus(state, a), 'shown')
  assert.equal(pairsScore(state), 0)
  const others = game.leftOrder.filter(id => id !== a)
  others.forEach((id, i) => {
    assert.equal(isFinished(game, state), false)
    const r = tryMatch(state, id, id)
    assert.equal(r.correct, true)
    state = r.state
    assert.equal(pairsScore(state), (i + 1) * POINTS_PER_PAIR)
  })
  // Fin dès la dernière paire (le score est enregistré à ce moment-là, une fois) ;
  // aucun essai n'est plus pris en compte ensuite
  assert.equal(isFinished(game, state), true)
  assert.equal(pairsScore(state), 40)
  assert.equal(tryMatch(state, a, a).ignored, true)
  assert.equal(showAnswer(state, b), state)
})
