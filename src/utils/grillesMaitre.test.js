// Tests de l'importateur et du vérificateur des Grilles du maître (L16,
// phase 6, lot A) — lancer avec : node --test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import {
  decodeEcw, parseEcw, buildGrid, answerCells, applyCorrections,
  normalizeTypography, importGrid, wordId, EcwImportError
} from './grillesMaitreImport.js'
import { verifyMasterGrid, verifyMasterCollection, badEncoding } from './grillesMaitre.js'
import { normalizeTypedLetter } from './crosswordLayout.js'
import { SELECTION } from '../../scripts/grilles-maitre-selection.js'

const DATA = JSON.parse(readFileSync(new URL('../data/grilles-maitre.json', import.meta.url), 'utf8'))
const byId = id => DATA.grilles.find(g => g.id === id)
const clone = o => JSON.parse(JSON.stringify(o))

// Encodeur cp1252 minimal pour les fichiers de test (Node n'en fournit pas)
const CP1252 = { '€': 0x80, '’': 0x92, '“': 0x93, '”': 0x94, 'Œ': 0x8c, 'œ': 0x9c, '–': 0x96 }
const cp1252 = s => Buffer.from([...s].map(ch => CP1252[ch] ?? ch.charCodeAt(0)))

const ecw = (words, { width = 10, height = 10 } = {}) => [
  '; EclipseCrossword (1.3.63)',
  '; test',
  'Title: Essai',
  `Width: ${width}`,
  `Height: ${height}`,
  'CodePage: 0',
  'Author: KWA ISAAC',
  'Copyright: © 2022',
  '',
  '* Across words',
  ...words.filter(w => w[3] === 'H').map(([m, x, y, , d]) => `${m}:  ${x}, ${y}:  ${d}`),
  '',
  '* Down words',
  ...words.filter(w => w[3] === 'V').map(([m, x, y, , d]) => `${m}:  ${x}, ${y}:  ${d}`),
  ''
].join('\r\n')

const codeOf = fn => { try { fn() } catch (e) { return e instanceof EcwImportError ? e.code : 'autre' } return null }

// ---------------------------------------------------------------- encodage

test('cp1252 -> texte : accents, apostrophe et guillemets typographiques, ², ©, Œ', () => {
  const text = decodeEcw(cp1252('é è ê ç à ’ “ ” ² © Œ'))
  assert.equal(text, 'é è ê ç à ’ “ ” ² © Œ')
})

test('encodage : un fichier déjà en UTF-8 ou un octet non défini en cp1252 est refusé', () => {
  assert.equal(codeOf(() => decodeEcw(Buffer.from('; CARRÉ', 'utf8'))), 'encodage')
  assert.equal(codeOf(() => decodeEcw(Buffer.from([0x3b, 0x20, 0x81]))), 'encodage')
  assert.equal(badEncoding('Ã©'), true)
  assert.equal(badEncoding('é ’ ²'), false)
})

test('données : aucun texte mal converti, accents conservés', () => {
  for (const g of DATA.grilles) {
    for (const s of [g.titre, g.titreOrigine, ...g.mots.flatMap(w => [w.definition, w.definitionOrigine, w.reponse])]) {
      assert.equal(badEncoding(s), false, `${g.id} : ${s}`)
    }
  }
  assert.ok(byId('G183').mots.some(w => w.definitionOrigine.includes('qu’on')), 'apostrophe typographique conservée')
  assert.equal(byId('G183').titre, 'Symptômes et sensations')
})

// ---------------------------------------------------------------- lecture et reconstruction

test('lecture .ecw : en-tête, sens, positions et définition avec deux-points', () => {
  const p = parseEcw(decodeEcw(cp1252(ecw([['CHAT', 1, 1, 'H', 'Animal : il miaule.'], ['CHIEN', 1, 1, 'V', 'Il aboie.']]))))
  assert.equal(p.version, '1.3.63')
  assert.equal(p.entete.Author, 'KWA ISAAC')
  assert.equal(p.largeur, 10)
  assert.deepEqual(p.mots.map(w => [w.reponse, w.direction, w.x, w.y]), [['CHAT', 'across', 1, 1], ['CHIEN', 'down', 1, 1]])
  assert.equal(p.mots[0].definition, 'Animal : il miaule.')
})

test('lecture .ecw : ligne non reconnue ou fichier non .ecw refusé', () => {
  assert.equal(codeOf(() => parseEcw('<html>')), 'format')
  assert.equal(codeOf(() => parseEcw(ecw([['CHAT', 1, 1, 'H', 'x']]) + 'ligne bizarre\r\n')), 'format')
})

test('tiret : il occupe une case de la grille (case fixe), croisements contrôlés', () => {
  // CERF-VOLANT horizontal ; OSE vertical croise le O ; NE vertical croise le N
  const p = parseEcw(ecw([['CERF-VOLANT', 2, 3, 'H', 'Jouet volant.'], ['OSE', 8, 3, 'V', 'Il ... parler.'], ['UNE', 11, 2, 'V', 'Article.']], { width: 15, height: 15 }))
  const g = buildGrid(p)
  assert.equal(g.lignes[1], 'CERF-VOLANT')
  assert.equal(g.mots.find(w => w.reponse === 'CERF-VOLANT').grille, 'CERF-VOLANT')
  assert.equal(g.mots.find(w => w.reponse === 'CERF-VOLANT').longueur, 11)
  assert.deepEqual(answerCells('CERF-VOLANT')[4], '-')
})

test('accents : réponse gardée avec accents, cases sans accents, croisement É / E sans conflit', () => {
  const g = buildGrid(parseEcw(ecw([['CARRÉ', 1, 1, 'H', 'Quadrilatère.'], ['ÉTÉ', 5, 1, 'V', 'Saison.']])))
  assert.equal(g.lignes[0], 'CARRE')
  const carre = g.mots.find(w => w.reponse === 'CARRÉ')
  assert.equal(carre.grille, 'CARRE')
  // La lettre tapée est comparée sans accents, comme aux mots croisés
  assert.equal(normalizeTypedLetter('é'), carre.grille[4])
})

test('conflit de lettres, sortie de la grille et caractère non pris en charge refusés', () => {
  assert.equal(codeOf(() => buildGrid(parseEcw(ecw([['CHAT', 1, 1, 'H', 'a'], ['DOS', 1, 1, 'V', 'b']])))), 'conflit')
  assert.equal(codeOf(() => buildGrid(parseEcw(ecw([['ELEPHANT', 5, 1, 'H', 'a']], { width: 10 })))), 'hors-grille')
  assert.equal(codeOf(() => answerCells('POMME DE TERRE')), 'caractere')
  assert.equal(codeOf(() => answerCells('AUJOURD\'HUI')), 'caractere')
  assert.equal(codeOf(() => answerCells('ŒUF')), 'caractere')
})

test('recadrage et numérotation : ordre de lecture, départ partagé = même numéro', () => {
  // Comme FOUR (vertical) et FOURTEEN (horizontal) dans G017
  const g = buildGrid(parseEcw(ecw([['FOUR', 3, 4, 'V', 'a'], ['FOURTEEN', 3, 4, 'H', 'b'], ['RAT', 3, 7, 'H', 'c'], ['NO', 10, 4, 'V', 'd']], { width: 12, height: 12 })))
  assert.equal(g.largeur, 8)
  assert.equal(g.hauteur, 4)
  assert.deepEqual(g.lignes, ['FOURTEEN', 'O......O', 'U.......', 'RAT.....'])
  const num = r => g.mots.filter(w => w.reponse === r).map(w => w.numero)
  assert.deepEqual(num('FOUR'), [1])
  assert.deepEqual(num('FOURTEEN'), [1])
  assert.deepEqual(num('NO'), [2])
  assert.deepEqual(num('RAT'), [3])
  assert.equal(wordId('G017', 2, 'down'), 'G017-2V')
})

// ---------------------------------------------------------------- corrections et normalisation

test('corrections : fragment absent ou répété refusé, aucune improvisation', () => {
  assert.equal(applyCorrections('Le chat dort.', [{ id: 'C0', avant: 'chat', apres: 'chien' }]), 'Le chien dort.')
  assert.equal(codeOf(() => applyCorrections('Le chat dort.', [{ id: 'C0', avant: 'lapin', apres: 'x' }])), 'correction')
  assert.equal(codeOf(() => applyCorrections('chat et chat', [{ id: 'C0', avant: 'chat', apres: 'x' }])), 'correction')
  // « $& » n'est pas interprété comme motif de remplacement
  assert.equal(applyCorrections('a b', [{ id: 'C0', avant: 'b', apres: '$&$&' }]), 'a $&$&')
})

test('normalisation typographique : espaces multiples et bordures seulement', () => {
  assert.equal(normalizeTypography('  Le  ....  est  un. '), 'Le .... est un.')
  assert.equal(normalizeTypography('Est-ce que je peux lui parler? Non'), 'Est-ce que je peux lui parler? Non')
})

test('importGrid : correction sur un mot introuvable refusée', () => {
  const bytes = cp1252(ecw([['CHAT', 1, 1, 'H', 'Il miaule.']]))
  const fiche = { id: 'GX', corrections: [{ id: 'C0', mot: 'CHIEN', direction: 'across', avant: 'a', apres: 'b' }] }
  assert.equal(codeOf(() => importGrid(bytes, fiche, {})), 'correction')
})

// ---------------------------------------------------------------- données du premier lot

const EXPECTED_SIZES = {
  G173: [12, 13], G172: [11, 14], G093: [13, 10], G085: [13, 15], G140: [11, 15], G183: [12, 13],
  G180: [12, 13], G153: [12, 15], G168: [11, 12], G017: [10, 10], G018: [8, 12], G019: [9, 10]
}

test('12 grilles présentes, tailles recadrées du lot 0, toutes ≤ 15 × 15, vérification ok', () => {
  assert.deepEqual(DATA.grilles.map(g => g.id).sort(), Object.keys(EXPECTED_SIZES).sort())
  for (const g of DATA.grilles) {
    assert.deepEqual([g.largeur, g.hauteur], EXPECTED_SIZES[g.id], g.id)
    assert.ok(g.largeur <= 15 && g.hauteur <= 15)
  }
  const v = verifyMasterCollection(DATA)
  assert.deepEqual(v.errors, [])
})

test('0 conflit et numérotation : chaque mot relu dans la grille, numéros 1..N sans trou', () => {
  for (const g of DATA.grilles) {
    for (const w of g.mots) {
      const letters = [...w.grille].map((_, i) => w.direction === 'across' ? g.lignes[w.ligne][w.colonne + i] : g.lignes[w.ligne + i][w.colonne]).join('')
      assert.equal(letters, w.grille, w.id)
    }
    const numbers = [...new Set(g.mots.map(w => w.numero))].sort((a, b) => a - b)
    assert.deepEqual(numbers, numbers.map((_, i) => i + 1), g.id)
  }
  // Départ partagé de G017 : FOUR (vertical) et FOURTEEN (horizontal)
  const g017 = byId('G017')
  assert.equal(g017.mots.find(w => w.reponse === 'FOUR').numero, g017.mots.find(w => w.reponse === 'FOURTEEN').numero)
})

test('tirets : aucune réponse à tiret dans les 12 grilles (cas couvert par le test synthétique)', () => {
  assert.equal(DATA.grilles.flatMap(g => g.mots).filter(w => w.grille.includes('-')).length, 0)
})

test('accents dans les données : réponse accentuée, cases sans accents', () => {
  const regals = byId('G173').mots.find(w => w.reponse === 'RÉGALS')
  assert.equal(regals.grille, 'REGALS')
  const accented = DATA.grilles.flatMap(g => g.mots).filter(w => w.reponse !== w.grille)
  assert.ok(accented.length > 0)
  for (const w of accented) assert.match(w.grille, /^[A-Z]+$/)
})

const EXPECTED_CORRECTIONS = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14',
  'C15', 'C16', 'C17', 'C18', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30', 'C31', 'C32']

test('corrections acceptées : liste exacte (C1 à C18, C25 à C32 ; C9 sur deux mots), aucune hors lot', () => {
  const ids = DATA.grilles.flatMap(g => g.corrections.map(c => c.id))
  const order = id => Number(id.slice(1))
  assert.deepEqual(ids.slice().sort((a, b) => order(a) - order(b)), EXPECTED_CORRECTIONS)
  for (const out of ['C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C33', 'C34']) assert.ok(!ids.includes(out), out)
})

for (const fiche of SELECTION) {
  for (const c of fiche.corrections) {
    test(`correction ${c.id} (${fiche.id}, ${c.mot}) appliquée, texte d'origine conservé`, () => {
      const g = byId(fiche.id)
      const w = g.mots.find(m => m.reponse === c.mot && m.direction === c.direction)
      assert.ok(w, 'mot présent')
      assert.ok(w.definitionOrigine.includes(c.avant), 'fragment d\'origine conservé')
      assert.ok(w.definition.includes(normalizeTypography(c.apres)), 'correction présente')
      if (!c.apres.includes(c.avant)) assert.ok(!w.definition.includes(c.avant), 'fragment d\'origine remplacé')
      assert.ok(g.corrections.some(x => x.id === c.id && x.mot === w.id && x.avant === c.avant && x.apres === c.apres), 'correction journalisée')
    })
  }
}

test('quelques définitions finales et d\'origine, relues mot pour mot', () => {
  const def = (id, rep) => byId(id).mots.find(w => w.reponse === rep)
  assert.equal(def('G172', 'CHEVAL').definition, 'Ces chevaux, ce ______________.')
  assert.equal(def('G172', 'CHEVAL').definitionOrigine, 'Ce cheval, ces ______________.')
  assert.equal(def('G183', 'FATIGUE').definition, 'Quand on manque de force et qu’on a besoin de repos.')
  assert.equal(def('G153', 'THREW').definitionOrigine, 'trhow')
  assert.equal(def('G153', 'THREW').definition, 'throw')
  assert.equal(def('G018', 'NINE').definitionOrigine, 'Peterson has four elder sisters and five younger sisters. Find  the number of sisters Peterson has?')
  assert.equal(def('G018', 'NINE').definition, 'Peterson has four elder sisters and five younger sisters. How many sisters does Peterson have?')
  assert.equal(def('G085', 'AIRE').definition, 'L\'........ d\'un rectangle est le produit de sa longueur par sa largeur.')
  // Mot sans correction : seulement la normalisation des espaces
  assert.equal(def('G085', 'MÛRE').definition, 'Après .......... réflexion, j\'ai refusé.')
})

test('métadonnées (§4.1) : statut VALIDÉE PAR ISAAC (2026-11-09), droits déclarés par Isaac, source tracée', () => {
  for (const g of DATA.grilles) {
    assert.equal(g.statut, 'VALIDÉE PAR ISAAC')
    assert.deepEqual(g.validation, { par: 'Isaac', date: '2026-11-09', mention: 'validé par Isaac', reference: '« Je valide les 12 » (décision d\'Isaac du 2026-11-09)' })
    assert.equal(g.droits.statut, 'déclarés par Isaac')
    assert.equal(g.type_activite, 'mots croisés')
    assert.match(g.auteur, /kwa isaac/i)
    assert.match(g.source.logiciel, /^EclipseCrossword 1\.(2\.61|3\.63)$/)
  }
  assert.equal(byId('G017').niveauStatut, 'proposé par l\'educator, à confirmer par Isaac')
  assert.equal(byId('G173').niveauStatut, 'confirmé par Isaac le 2026-11-09')
})

test('empreintes : celles du relevé du 2026-11-09 (fiches de sélection)', () => {
  for (const fiche of SELECTION) assert.equal(byId(fiche.id).source.sha256, fiche.sha256, fiche.id)
})

// Seulement si les disques sources sont branchés (lecture seule) : empreinte
// recalculée et import refait à l'identique.
const sourcesPresentes = SELECTION.every(f => existsSync(f.copies[0]))
test('sources (si J: est branché) : empreinte recalculée et import identique', { skip: !sourcesPresentes && 'fichiers sources absents' }, () => {
  for (const fiche of SELECTION) {
    const bytes = readFileSync(fiche.copies[0])
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    assert.equal(sha256, fiche.sha256, fiche.id)
    const again = importGrid(bytes, fiche, { chemin: fiche.copies[0], copies: fiche.copies, sha256, octets: bytes.length, dateImport: DATA.dateImport })
    assert.deepEqual(again, byId(fiche.id), fiche.id)
  }
})

// ---------------------------------------------------------------- le vérificateur détecte les altérations

test('vérificateur : altérations détectées, jamais d\'exception', () => {
  const base = byId('G085')
  assert.deepEqual(verifyMasterGrid(base).errors, [])
  const altered = []
  let g = clone(base); g.lignes[g.mots[0].ligne] = g.lignes[g.mots[0].ligne].replace(/[A-Z]/, 'Q'); altered.push(['lettre changée', g])
  g = clone(base); g.mots[0].definition += ' (modifié)'; altered.push(['définition changée sans correction', g])
  g = clone(base); g.corrections = g.corrections.slice(1); altered.push(['correction retirée du journal', g])
  g = clone(base); g.mots[0].definitionOrigine = g.mots[0].definition + '!'; altered.push(['texte d\'origine perdu', g])
  g = clone(base); g.mots[0].numero += 1; altered.push(['numéro faux', g])
  g = clone(base); g.mots[1].definition = 'Ã©t\ufffd'; altered.push(['encodage', g])
  g = clone(base); g.statut = 'FINI'; altered.push(['statut inconnu', g])
  g = clone(base); g.source.sha256 = 'abc'; altered.push(['empreinte', g])
  g = clone(base); g.lignes = g.lignes.map(l => '.' + l); g.largeur += 1; altered.push(['non recadrée', g])
  for (const [label, grid] of altered) assert.equal(verifyMasterGrid(grid).ok, false, label)
  for (const bad of [null, 3, {}, { lignes: 'x' }]) assert.equal(verifyMasterGrid(bad).ok, false)
  assert.equal(verifyMasterCollection(null).ok, false)
  assert.equal(verifyMasterCollection({ format: 'dibie-grilles-maitre', grilles: [base, base] }).ok, false)
})
