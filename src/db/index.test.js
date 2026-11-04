// Tests du stockage local : npm test (node --test), avec une simulation de localStorage.
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const stockage = new Map()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: key => (stockage.has(key) ? stockage.get(key) : null),
    setItem: (key, value) => { stockage.set(key, String(value)) },
    removeItem: key => { stockage.delete(key) }
  }
})

const db = await import('./index.js')
const vocabulaire = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const lire = key => JSON.parse(stockage.get(key) ?? 'null')
const BASE = [
  { id: 'v1', mot_fr: 'CHAT', mot_en: 'Cat', niveau_fr: 'SIL-CP', sujet: 'Animaux', actif: true },
  { id: 'v2', mot_fr: 'DELTA', mot_en: 'Delta', niveau_fr: 'SIL-CP', sujet: 'Animaux', actif: false }
]
const CSV = 'mot_fr;mot_en;def_fr;def_en;niveau;sujet\nCHIEN;Dog;Il aboie;It barks;SIL-CP;Animaux\nchat;Cat;Doublon;Dup;SIL-CP;Animaux'

beforeEach(() => stockage.clear())

test('Profil : identité fixe, champs du dictionnaire, relu à l\'identique', () => {
  const { profile } = db.createProfile({ name: '  Étoile ', level: 'CE1-CE2', class: 'CE1', subsystem: 'fr' })
  assert.match(profile.id, /^prof_/)
  assert.equal(profile.name, 'Étoile')
  assert.equal(profile.level, 'CE1-CE2')
  assert.equal(profile.class, 'CE1')
  assert.equal(profile.subsystem, 'fr')
  assert.ok(!Number.isNaN(Date.parse(profile.createdAt)))
  assert.deepEqual(db.getProfile(profile.id), profile)
  db.createProfile({ name: 'Lune', level: 'SIL-CP' })
  assert.deepEqual(db.getProfile(profile.id), profile, 'un autre profil ne change pas l\'identité')
})

test('Profil : valeurs par défaut, refus des saisies invalides, rien d\'enregistré', () => {
  const { profile } = db.createProfile({ name: 'Lune', level: 'SIL-CP' })
  assert.equal(profile.class, null)
  assert.equal(profile.subsystem, 'fr')
  const avant = db.getProfiles()
  assert.equal(db.createProfile({ name: '  ', level: 'SIL-CP' }).error, 'name-empty')
  assert.equal(db.createProfile({ name: 'lune', level: 'SIL-CP' }).error, 'name-taken')
  assert.equal(db.createProfile({ name: 'X', level: 'CM3' }).error, 'invalid')
  assert.equal(db.createProfile({ name: 'X', level: 'SIL-CP', class: 'CM1' }).error, 'invalid')
  assert.equal(db.createProfile({ name: 'X', level: 'SIL-CP', subsystem: 'de' }).error, 'invalid')
  assert.deepEqual(db.getProfiles(), avant)
})

test('Profil : classes selon le sous-système ; liste illisible = aucun profil', () => {
  assert.deepEqual(db.classesOf('CE1-CE2', 'fr'), ['CE1', 'CE2'])
  assert.deepEqual(db.classesOf('CE1-CE2', 'en'), ['Class 3', 'Class 4'])
  stockage.set('dibieProfiles', '{illisible')
  assert.deepEqual(db.getProfiles(), [])
  assert.equal(db.getProfile('x'), null)
})

test('Statistiques : le total d\'un profil se cumule et ne se mêle pas aux autres', async () => {
  const a = db.createProfile({ name: 'A', level: 'SIL-CP' }).profile
  const b = db.createProfile({ name: 'B', level: 'SIL-CP' }).profile
  await db.saveScore(a.id, 'wordsearch', 50, 'SIL-CP')
  await db.saveScore(a.id, 'crossword', 100, 'SIL-CP', { seed: 3 })
  await db.saveScore(b.id, 'wordsearch', 70, 'SIL-CP')
  const stats = await db.getUserStats(a.id)
  assert.equal(stats.score, 150)
  assert.equal(stats.games, 2)
  assert.equal(stats.streak, 1)
  assert.deepEqual(stats.badges, ['🌟', '⭐', '🎯'])
  assert.equal((await db.getUserStats(b.id)).score, 70)
})

test('Anciens scores : conservés, affichés sous « Ancien profil », jamais rattachés', async () => {
  const anciens = [
    { userId: 'k3j9x2', gameType: 'crossword', score: 30, niveau: 'SIL-CP', date: '2026-10-01T10:00:00.000Z' },
    { userId: 'k3j9x2', gameType: 'wordsearch', score: 20, niveau: 'SIL-CP', date: '2026-10-02T10:00:00.000Z' }
  ]
  stockage.set('dibieScores', JSON.stringify(anciens))
  const { profile } = db.createProfile({ name: 'Étoile', level: 'SIL-CP' })
  await db.saveScore(profile.id, 'wordsearch', 50, 'SIL-CP')

  const liste = await db.getAllUsersWithScores()
  assert.deepEqual(liste.map(u => [u.name, u.legacy, u.score, u.games]), [
    ['Ancien profil', true, 50, 2],
    ['Étoile', false, 50, 1]
  ])
  assert.equal(lire('dibieScores').length, 3, 'aucun score effacé')
  assert.deepEqual(lire('dibieScores').slice(0, 2), anciens)
  assert.equal((await db.getUserStats(profile.id)).score, 50)
})

test('saveUserProgress : ancien appel inchangé ; gameType et itemId facultatifs', async () => {
  await db.saveUserProgress('p', 'vocab_1', true, 30)
  await db.saveUserProgress('p', 'vocab_2', false, null, { gameType: 'quiz', itemId: 'q7' })
  const [ancien, nouveau] = lire('dibieProgress')
  assert.deepEqual(Object.keys(ancien).sort(), ['date', 'isCorrect', 'timeTaken', 'userId', 'wordId'])
  assert.equal(nouveau.gameType, 'quiz')
  assert.equal(nouveau.itemId, 'q7')
  assert.equal(nouveau.isCorrect, false)
  assert.equal((await db.getUserProgress('p')).length, 2)
})

test('Aucun plafond : scores et progrès conservés au-delà de 50 lignes', async () => {
  for (let i = 0; i < 120; i++) {
    await db.saveScore('p', 'wordsearch', 10, 'SIL-CP')
    await db.saveUserProgress('p', `v${i}`, true, null)
  }
  assert.equal(lire('dibieScores').length, 120)
  assert.equal(lire('dibieProgress').length, 120)
  assert.equal((await db.getUserStats('p')).score, 1200)
})

test('Import : mots disponibles sans recharger, écrits seulement dans dibieLocalVocab', async () => {
  await db.loadVocabulaire(BASE)
  assert.deepEqual(db.importLocalVocab(CSV), { added: 1, ignored: 1, total: 2 })
  assert.deepEqual((await db.getVocabByLevel('SIL-CP')).map(v => v.mot_fr), ['CHAT', 'CHIEN'])
  assert.deepEqual(lire('dibieLocalVocab').map(v => v.mot_fr), ['CHIEN'])
  assert.deepEqual(lire('dibieVocab'), BASE)
})

test('Import : fusion à chaque démarrage (équivaut au rechargement), jamais d\'écrasement', async () => {
  await db.loadVocabulaire(BASE)
  db.importLocalVocab(CSV)
  await db.loadVocabulaire([...BASE])
  await db.loadVocabulaire([...BASE])
  const tous = await db.getVocabByLevelAndSubject('SIL-CP', 'Animaux')
  assert.deepEqual(tous.map(v => v.mot_fr), ['CHAT', 'CHIEN'])
  assert.equal(tous[0].id, 'v1')
  assert.deepEqual(lire('dibieVocab'), BASE, 'la base réécrite ne reçoit pas les ajouts')
  assert.equal(lire('dibieLocalVocab').length, 1)
})

test('Import : un second import ne duplique rien ; un mot inactif de la base reste ignoré', async () => {
  await db.loadVocabulaire(BASE)
  db.importLocalVocab(CSV)
  assert.deepEqual(db.importLocalVocab(CSV), { added: 0, ignored: 2, total: 2 })
  assert.deepEqual(db.importLocalVocab('DELTA;Delta;D;D;SIL-CP;X'), { added: 0, ignored: 1, total: 1 })
  assert.equal(lire('dibieLocalVocab').length, 1)
})

test('Import invalide : rien d\'écrit, cache intact ; ajouts illisibles : la base reste utilisable', async () => {
  await db.loadVocabulaire(BASE)
  assert.throws(() => db.importLocalVocab('NOUVEAU;New;d;d;SIL-CP;X\nCASSÉ;Broken;;'), /Ligne 2 incomplète/)
  assert.equal(stockage.has('dibieLocalVocab'), false)
  assert.equal((await db.getVocabByLevel('SIL-CP')).length, 1)

  stockage.set('dibieLocalVocab', '{illisible')
  await db.loadVocabulaire([...BASE])
  assert.equal((await db.getVocabByLevel('SIL-CP')).length, 1)
})

test('Sans ajout local : le vocabulaire réel reste identique, dans le même ordre (mêmes grilles)', async () => {
  await db.loadVocabulaire(vocabulaire)
  const attendu = vocabulaire.filter(v => v.niveau_fr === 'CM1-CM2' && v.actif !== false)
  assert.deepEqual(await db.getVocabByLevel('CM1-CM2'), attendu)
  assert.deepEqual(lire('dibieVocab'), vocabulaire)
})

test('Stockage abîmé : éléments non objets et profils sans identité écartés, sans plantage', async () => {
  stockage.set('dibieProfiles', JSON.stringify([null, 3, 'x', [], {}, { id: 'p1', name: 'Lune', level: 'SIL-CP' }]))
  assert.deepEqual(db.getProfiles().map(p => p.id), ['p1'])
  assert.equal(db.getProfile(undefined), null)
  const { profile } = db.createProfile({ name: 'Soleil', level: 'SIL-CP' })
  assert.deepEqual(lire('dibieProfiles').slice(0, 6), [null, 3, 'x', [], {}, { id: 'p1', name: 'Lune', level: 'SIL-CP' }], 'contenu d\'origine conservé')
  assert.deepEqual(lire('dibieProfiles')[6], profile)

  const ajoutsAbimes = [null, 'x', {}, { id: 'l1', mot_fr: 'CHIEN', niveau_fr: 'SIL-CP', actif: true }]
  stockage.set('dibieLocalVocab', JSON.stringify(ajoutsAbimes))
  await db.loadVocabulaire([...BASE])
  assert.deepEqual((await db.getVocabByLevel('SIL-CP')).map(v => v.mot_fr), ['CHAT', 'CHIEN'])
  assert.deepEqual(db.importLocalVocab('LION;Lion;D;E;SIL-CP;Animaux'), { added: 1, ignored: 0, total: 1 })
  assert.deepEqual(lire('dibieLocalVocab').slice(0, 4), ajoutsAbimes, 'contenu d\'origine conservé')
  assert.equal(lire('dibieLocalVocab')[4].mot_fr, 'LION')
})

for (const contenu of ['{illisible', '{"pas":"un tableau"}', 'null', '3', '']) {
  test(`Clé au contenu ${JSON.stringify(contenu)} : jamais écrasée, échec signalé`, async () => {
    stockage.set('dibieProfiles', contenu)
    assert.equal(db.createProfile({ name: 'Soleil', level: 'SIL-CP' }).error, 'storage')
    assert.equal(stockage.get('dibieProfiles'), contenu)

    await db.loadVocabulaire(BASE)
    stockage.set('dibieLocalVocab', contenu)
    assert.throws(() => db.importLocalVocab('LION;Lion;D;E;SIL-CP;Animaux'), e => {
      assert.match(e.message, /illisibles. Rien n'a été modifié/)
      assert.match(e.en, /cannot be read/)
      return true
    })
    assert.equal(stockage.get('dibieLocalVocab'), contenu)
    assert.equal((await db.getVocabByLevel('SIL-CP')).some(v => v.mot_fr === 'LION'), false)
  })
}

test('Stockage plein : import refusé avec un message clair, cache intact ; profil refusé', async () => {
  await db.loadVocabulaire(BASE)
  const original = localStorage.setItem
  localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  try {
    assert.throws(() => db.importLocalVocab('LION;Lion;D;E;SIL-CP;Animaux'), /stockage de cet appareil est plein/)
    assert.equal(db.createProfile({ name: 'Soleil', level: 'SIL-CP' }).error, 'storage')
  } finally {
    localStorage.setItem = original
  }
  assert.equal((await db.getVocabByLevel('SIL-CP')).some(v => v.mot_fr === 'LION'), false)
})

test('Anagrammes mystères — reprise : un enregistrement par profil, relu, remplacé, effacé', () => {
  const p1 = { formatVersion: 1, path: { id: 'a' }, state: { phase: 'steps' } }
  assert.equal(db.getMysteryInProgress('u1'), null)
  assert.equal(db.saveMysteryInProgress('u1', p1), true)
  assert.equal(db.saveMysteryInProgress('u2', { ...p1, path: { id: 'b' } }), true)
  assert.equal(db.saveMysteryInProgress('u1', { ...p1, path: { id: 'c' } }), true)
  const enregistre = lire('dibieMysteryInProgress')
  assert.equal(enregistre.length, 2, 'un seul enregistrement par profil')
  assert.equal(db.getMysteryInProgress('u1').path.id, 'c')
  assert.equal(db.getMysteryInProgress('u2').path.id, 'b')
  assert.ok(!Number.isNaN(Date.parse(db.getMysteryInProgress('u1').savedAt)))
  assert.equal(db.clearMysteryInProgress('u1'), true)
  assert.equal(db.getMysteryInProgress('u1'), null)
  assert.equal(db.getMysteryInProgress('u2').path.id, 'b', 'les autres profils sont gardés')
  assert.equal(db.clearMysteryInProgress('absent'), true)
  assert.equal(db.saveMysteryInProgress(undefined, p1), false, 'jamais sans profil')
})

test('Anagrammes mystères — reprise : donnée illisible jamais écrasée', () => {
  for (const illisible of ['{illisible', '{"pas":"un tableau"}']) {
    stockage.set('dibieMysteryInProgress', illisible)
    assert.equal(db.getMysteryInProgress('u1'), null)
    assert.equal(db.saveMysteryInProgress('u1', { formatVersion: 1 }), false)
    assert.equal(db.clearMysteryInProgress('u1'), false)
    assert.equal(stockage.get('dibieMysteryInProgress'), illisible)
  }
  // Entrées étrangères conservées à la réécriture
  stockage.set('dibieMysteryInProgress', JSON.stringify([null, 'texte', { userId: 'u9', path: {} }]))
  assert.equal(db.saveMysteryInProgress('u1', { formatVersion: 1 }), true)
  assert.equal(lire('dibieMysteryInProgress').length, 4)
})

test('Badges par famille d\'anagrammes : classiques et mystères, sans changer les autres badges', async () => {
  await db.saveScore('u1', 'wordsearch', 20, 'SIL-CP')
  assert.deepEqual((await db.getUserStats('u1')).badges, ['🎯'])
  await db.saveScore('u1', 'anagram', 10, 'SIL-CP')
  assert.deepEqual((await db.getUserStats('u1')).badges, ['🎯', '🔤'])
  await db.saveScore('u1', 'anagramMystery', 40, 'SIL-CP', { game: 'mysteryWord', language: 'fr', seed: 1, stars: 3, hintsUsed: 0 })
  const stats = await db.getUserStats('u1')
  assert.deepEqual(stats.badges, ['🌟', '🎯', '🔤', '🕵️'])
  assert.equal(stats.score, 70)
  assert.deepEqual((await db.getUserStats('u2')).badges, [])
})
