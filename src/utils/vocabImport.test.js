// Tests de l'import CSV : npm test (node --test)
// Données synthétiques de même structure que le fichier réel d'Isaac.
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { parseCSV, prepareImport, mergeVocab, cleVocabulaire, messageImport } from './vocabImport.js'

const EN_TETE = 'N°;Mot en français;Mot en anglais;Définition en français;Définition en anglais;Niveau;Sujet'

test('parseCSV : guillemets, séparateur dans une valeur, guillemet doublé, saut de ligne', () => {
  const rows = parseCSV('a;"b;c";"d ""e"" f";"g\nh"\r\ni;j;k;l')
  assert.deepEqual(rows, [['a', 'b;c', 'd "e" f', 'g\nh'], ['i', 'j', 'k', 'l']])
})

test('parseCSV : retire le BOM et les lignes entièrement vides', () => {
  assert.deepEqual(parseCSV('\uFEFFa;b\n;;;\n\nc;d\n'), [['a', 'b'], ['c', 'd']])
})

test('Séparateur « ; » : une virgule dans une définition non guillemetée ne décale rien', () => {
  const { entries } = prepareImport('mot_fr;mot_en;def_fr;def_en;niveau;sujet\nCHAT;Cat;Un animal, petit;An animal, small;SIL-CP;Animaux', [])
  assert.equal(entries[0].def_fr, 'Un animal, petit')
  assert.equal(entries[0].def_en, 'An animal, small')
  assert.equal(entries[0].niveau_fr, 'SIL-CP')
})

test('Séparateur « , » détecté depuis la première ligne, avec guillemets', () => {
  const { entries } = prepareImport('mot_fr,mot_en,def_fr,def_en,niveau,sujet\nCHAT,Cat,"Un animal, petit; doux",An animal,SIL-CP,Animaux', [])
  assert.equal(entries[0].def_fr, 'Un animal, petit; doux')
  assert.equal(entries[0].sujet, 'Animaux')
})

test('Format actuel sans en-tête : valeurs par défaut conservées', () => {
  const { entries } = prepareImport('CHAT;Cat;Un animal;An animal', [], { now: 42 })
  assert.deepEqual(entries[0], {
    id: 'import_42_0',
    mot_fr: 'CHAT',
    mot_en: 'Cat',
    def_fr: 'Un animal',
    def_en: 'An animal',
    niveau_fr: 'CM1-CM2',
    niveau_en: 'Class 5-6',
    sujet: 'Importé',
    difficulte: 2,
    actif: true
  })
})

test('Format réel : BOM, N°, en-tête répété, tiret long, apostrophe, guillemets, lignes vides', () => {
  const csv = [
    `\uFEFF${EN_TETE}`,
    '1;CHAT;Cat;L’animal qui miaule.;"A pet; it purrs.";SIL–CP;Animaux',
    ';;;;;;',
    EN_TETE,
    '2;JET D’EAU;Fountain;Eau projetée.;Water thrown up.;CM1–CM2;Eau',
    ';;;;;;',
    EN_TETE,
    '3;CHIEN;Dog;Il aboie.;It barks.;CE1–CE2;Animaux'
  ].join('\r\n')
  const { entries, added, ignored, total } = prepareImport(csv, [])
  assert.equal(total, 3)
  assert.equal(added, 3)
  assert.equal(ignored, 0)
  assert.deepEqual(entries.map(e => e.mot_fr), ['CHAT', 'JET D’EAU', 'CHIEN'])
  assert.deepEqual(entries.map(e => e.niveau_fr), ['SIL-CP', 'CM1-CM2', 'CE1-CE2'])
  assert.equal(entries[0].def_en, 'A pet; it purrs.')
  assert.equal(entries[0].def_fr, 'L’animal qui miaule.')
  assert.equal(entries[2].niveau_en, 'Class 3-4')
  assert.equal(new Set(entries.map(e => e.id)).size, 3)
})

test('Colonne N° reconnue sans en-tête', () => {
  const { entries } = prepareImport('7;CHAT;Cat;Un animal;An animal;SIL-CP;Animaux', [])
  assert.equal(entries[0].mot_fr, 'CHAT')
  assert.equal(entries[0].sujet, 'Animaux')
})

test('Doublons : base et fichier ignorés et comptés, jamais écrasés ; le niveau distingue', () => {
  const existant = [{ id: 'vocab_1', mot_fr: 'ÉCOLE', niveau_fr: 'SIL-CP', def_fr: 'Originale' }]
  const csv = [
    'mot_fr;mot_en;def_fr;def_en;niveau;sujet',
    'ecole;School;Remplaçante;New;SIL-CP;X',
    'ÉCOLE;School;Autre niveau;Other;CM1-CM2;X',
    'ÉCOLE;School;Doublon du fichier;Dup;CM1-CM2;X'
  ].join('\n')
  const { entries, added, ignored } = prepareImport(csv, existant)
  assert.equal(added, 1)
  assert.equal(ignored, 2)
  assert.equal(entries[0].def_fr, 'Autre niveau')
  assert.equal(existant[0].def_fr, 'Originale')
})

test('Clé : même forme pour apostrophes, ligatures, casse et espaces', () => {
  const cle = (mot_fr) => cleVocabulaire({ mot_fr, niveau_fr: 'SIL-CP' })
  assert.equal(cle('JET D’ENCRE'), cle("jet  d'encre "))
  assert.equal(cle('CŒUR'), cle('coeur'))
})

test('Erreurs : ligne incomplète, niveau inconnu, colonnes en trop, guillemet non fermé, en-tête sans colonne', () => {
  assert.throws(() => prepareImport('mot_fr;mot_en;def_fr;def_en\nCHAT;Cat;;', []), /Ligne 2 incomplète/)
  assert.throws(() => prepareImport('CHAT;Cat;Déf;Def;CM3;X', []), /Ligne 1 : niveau inconnu/)
  assert.throws(() => prepareImport('mot_fr;mot_en;def_fr;def_en;niveau;sujet\nCHAT;Cat;a;b;c;SIL-CP;X', []), /Ligne 2 : trop de colonnes/)
  assert.throws(() => prepareImport('CHAT;Cat;"Déf;Def;SIL-CP;X', []), /Ligne 1 : guillemet non fermé/)
  assert.throws(() => prepareImport('mot_fr;niveau\nCHAT;SIL-CP', []), /colonne mot_en absente/)
})

test('Numéro de ligne exact après une valeur sur deux lignes', () => {
  assert.throws(() => prepareImport('A;B;"C\nD";E;SIL-CP;F\nCHAT;Cat;;', []), /Ligne 3 incomplète/)
})

test('Fichier sans données : rien à ajouter', () => {
  assert.deepEqual(prepareImport(`\uFEFF${EN_TETE}\n;;;;;;\n`, []), { entries: [], added: 0, ignored: 0, total: 0 })
})

test('mergeVocab : base inchangée et prioritaire, ajouts à la fin', () => {
  const base = [{ mot_fr: 'A', niveau_fr: 'SIL-CP', id: 'b1' }]
  assert.equal(mergeVocab(base, []), base)
  const merged = mergeVocab(base, [{ mot_fr: 'a', niveau_fr: 'SIL-CP', id: 'l1' }, { mot_fr: 'B', niveau_fr: 'SIL-CP', id: 'l2' }])
  assert.deepEqual(merged.map(e => e.id), ['b1', 'l2'])
})

test('Fichier mal encodé (\\uFFFD après décodage d\'un Windows-1252) : refusé en français et en anglais', () => {
  const texte = new TextDecoder('utf-8').decode(Buffer.from('mot_fr;mot_en;def_fr;def_en;niveau;sujet\nECOLE;School;Lieu d\xe9di\xe9;Place;SIL-CP;X', 'latin1'))
  assert.ok(texte.includes('\uFFFD'))
  assert.throws(() => prepareImport(texte, []), e => {
    assert.match(e.message, /CSV UTF-8/)
    assert.match(e.en, /CSV UTF-8/)
    return true
  })
})

test('Erreurs traduites en anglais', () => {
  assert.throws(() => prepareImport('mot_fr;mot_en;def_fr;def_en\nCHAT;Cat;;', []), e => e.en === 'Line 2 incomplete.')
  assert.throws(() => prepareImport('CHAT;Cat;"D;E', []), e => e.en === 'Line 1: unclosed quote')
})

test('Messages clairs : ligne sep=, colonne inconnue, en-tête non reconnu', () => {
  assert.throws(() => prepareImport('sep=;\nCHAT;Cat;D;E;SIL-CP;X', []), /Ligne 1 : la ligne « sep= » n'est pas acceptée/)
  assert.throws(() => prepareImport('mot_fr;mot_en;def_fr;def_en;niveau;classe\nCHAT;Cat;D;E;SIL-CP;CP', []), /colonne inconnue « classe »/)
  assert.throws(() => prepareImport('mot;trad;d1;d2;niveau;sujet\nCHAT;Cat;D;E;SIL-CP;X', []), /colonne inconnue « mot »/)
  assert.throws(() => prepareImport('Word;Translation;A;B;Level;Topic', []), /niveau inconnu « Level ».*Si c'est un en-tête/)
})

test('Un mot NIVEAU ou SUJET n\'est pas pris pour un en-tête', () => {
  const { entries } = prepareImport('NIVEAU;Level;D;E;SIL-CP;Ecole', [])
  assert.equal(entries[0].mot_fr, 'NIVEAU')
})

test('Messages de fin d\'import : pluriels', () => {
  assert.equal(messageImport(1, 1), '1 mot ajouté, 1 déjà présent ignoré.')
  assert.equal(messageImport(0, 4), '0 mot ajouté, 4 déjà présents ignorés.')
  assert.equal(messageImport(3, 0), '3 mots ajoutés, 0 déjà présent ignoré.')
  assert.equal(messageImport(1, 2, 'en'), '1 word added, 2 already present skipped.')
})

test('En-tête répété et numéroté (« 49;Mot en français;… ») : reconnu et ignoré ; Nº accepté', () => {
  const csv = [
    '\uFEFFNº;Mot en français;Mot en anglais;Définition en français;Définition en anglais;Niveau;Sujet',
    '48;ÉCHELLE;Ladder;Elle sert à monter.;We climb it.;SIL–CP;Maison',
    '49;Mot en français;Mot en anglais;Définition en français;Définition en anglais;Niveau;Sujet',
    '50;COQ;Rooster;Un oiseau.;A bird.;SIL–CP;Animaux'
  ].join('\r\n')
  const { entries, total } = prepareImport(csv, [])
  assert.equal(total, 2)
  assert.deepEqual(entries.map(e => e.mot_fr), ['ÉCHELLE', 'COQ'])
})

test('Un nombre n\'est toléré dans un en-tête qu\'en première cellule', () => {
  assert.throws(() => prepareImport('mot_fr;49;mot_en;def_fr;def_en', []), /colonne inconnue « 49 »/)
})

// Fichiers réels, en lecture seule ; dossier indiqué par DIBIE_CSV_DIR, tests
// ignorés explicitement sans cette variable ou si le fichier est absent
const dossierCsv = process.env.DIBIE_CSV_DIR
const lireSiPresent = (chemin) => {
  try {
    return readFileSync(chemin, 'utf8')
  } catch {
    return null
  }
}
const base = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
for (const nom of ['DOC ED TECH DIBIE 2.csv', 'DOC ED TECH DIBIE.csv']) {
  const texte = dossierCsv ? lireSiPresent(`${dossierCsv}/${nom}`) : null
  test(`Fichier réel ${nom}`, { skip: texte === null && 'DIBIE_CSV_DIR non défini ou fichier absent' }, () => {
    const { added, ignored, total } = prepareImport(texte, base)
    assert.deepEqual({ added, ignored, total }, { added: 3, ignored: 967, total: 970 })
  })
}
