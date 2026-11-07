// Parties de référence des anagrammes classiques — lancer avec : npm test
// Figées le 2026-11-03 AVANT l'extraction de createAnagramItem (lot 1 des
// anagrammes mystères, docs/anagrammes-mysteres.md §4) : un même numéro doit
// toujours donner la même partie. Si l'un de ces tests échoue, les numéros de
// partie déjà donnés aux classes ne redonnent plus la même partie.
// Mise à jour du 2026-11-06 (lot C de la phase 4) : les 14 définitions du lot 0
// validées par Isaac changent les mots retenus (definitionRevealsWord) et les
// définitions affichées : CM1-CM2 en anglais (3 parties de R1), R2 et R3
// recalculés. Code inchangé : avec le vocabulaire de main (1dcb203), les
// anciennes valeurs passaient encore. Les numéros déjà donnés en CM1-CM2 en
// anglais ne redonnent plus la même partie (docs/paires.md §16).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createAnagramGame } from './anagramGame.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']

// [niveau, langue, numéro, [[id, mot, ordre affiché (lettre placée + tuiles)], ...]]
const REFERENCE = [
  ['SIL-CP', 'fr', 0, [['vocab_0947', 'BANC', 'BNAC'], ['vocab_0958', 'BECHE', 'BEHCE'], ['vocab_0898', 'FOUET', 'FUTEO'], ['vocab_1379', 'NON', 'NNO'], ['vocab_0924', 'REGLE', 'RGELE']]],
  ['SIL-CP', 'fr', 12345, [['vocab_0914', 'CHIEN', 'CHENI'], ['vocab_1382', 'SOUS', 'SUOS'], ['vocab_0819', 'PULL', 'PLUL'], ['vocab_0835', 'TETE', 'TTEE'], ['vocab_0884', 'SOUPE', 'SEPOU']]],
  ['SIL-CP', 'fr', 4294967295, [['vocab_0793', 'POMME', 'PMOME'], ['vocab_0938', 'BEIGE', 'BEEIG'], ['vocab_1338', 'SAUT', 'STUA'], ['vocab_0843', 'JAMBE', 'JBAME'], ['vocab_1408', 'POCHE', 'PECOH']]],
  ['SIL-CP', 'en', 0, [['vocab_0762', 'SHEEP', 'SEHPE'], ['vocab_0942', 'EAT', 'ETA'], ['vocab_0841', 'ARM', 'AMR'], ['vocab_0826', 'BALL', 'BLAL'], ['vocab_0922', 'GLOVE', 'GVLEO']]],
  ['SIL-CP', 'en', 12345, [['vocab_0856', 'LADLE', 'LDALE'], ['vocab_0733', 'BASIN', 'BIASN'], ['vocab_0822', 'BELT', 'BLTE'], ['vocab_0765', 'HORSE', 'HREOS'], ['vocab_0776', 'BAG', 'BGA']]],
  ['SIL-CP', 'en', 4294967295, [['vocab_0807', 'OKRA', 'OAKR'], ['vocab_0796', 'LEMON', 'LEMNO'], ['vocab_0751', 'STOOL', 'SOLTO'], ['vocab_0845', 'BELLY', 'BLEYL'], ['vocab_0860', 'GLASS', 'GSALS']]],
  ['CE1-CE2', 'fr', 0, [['vocab_1086', 'CHANSON', 'ANNHOSC'], ['vocab_0665', 'SEMER', 'EERMS'], ['vocab_0423', 'PAINT', 'PTAIN'], ['vocab_1458', 'ROCHE', 'HOCER'], ['vocab_1079', 'SEMENCE', 'MCESEEN']]],
  // Exemple du document de conception (§4)
  ['CE1-CE2', 'fr', 12345, [['vocab_0637', 'PORTE', 'EOPTR'], ['vocab_1033', 'SINGE', 'ENIGS'], ['vocab_1011', 'ROBOT', 'BOTRO'], ['vocab_0628', 'HARICOT', 'ATOHRIC'], ['vocab_1084', 'CEREALE', 'RELCAEE']]],
  ['CE1-CE2', 'fr', 4294967295, [['vocab_0643', 'TAPIS', 'APSIT'], ['vocab_0699', 'CHANTER', 'HTCRNEA'], ['vocab_0615', 'CHAMP', 'HPCAM'], ['vocab_0436', 'EMAIL', 'AIEML'], ['vocab_1035', 'SERPENT', 'ESTPREN']]],
  ['CE1-CE2', 'en', 0, [['vocab_0462', 'DRIVER', 'VRIEDR'], ['vocab_1068', 'STADIUM', 'AUMSTDI'], ['vocab_0541', 'VACCINE', 'AICENVC'], ['vocab_1102', 'POLICE', 'PLIECO'], ['vocab_1104', 'MONTH', 'MTONH']]],
  ['CE1-CE2', 'en', 12345, [['vocab_1436', 'DENTIST', 'STIEDNT'], ['vocab_1026', 'FOREST', 'ROTFSE'], ['vocab_1348', 'SINGING', 'SIGIGNN'], ['vocab_0624', 'GOAT', 'GTAO'], ['vocab_0466', 'SQUARE', 'UQSRAE']]],
  ['CE1-CE2', 'en', 4294967295, [['vocab_1112', 'BIKUTSI', 'UITBKSI'], ['vocab_0616', 'FENCE', 'FEENC'], ['vocab_0550', 'BALAFON', 'BFNAOLA'], ['vocab_0499', 'FLINT', 'TLINF'], ['vocab_0573', 'SELL', 'ELLS']]],
  ['CM1-CM2', 'fr', 0, [['vocab_0170', 'SURFACE', 'CESUFRA'], ['vocab_1491', 'TEINTURIER', 'NTIERIUERT'], ['vocab_0329', 'REPERTOIRE', 'EPRREIOERT'], ['vocab_1251', 'PATRIE', 'PATERI'], ['vocab_0187', 'SOLIDE', 'LESIOD']]],
  ['CM1-CM2', 'fr', 12345, [['vocab_0139', 'DISTINCTS', 'STCTISNDI'], ['vocab_0353', 'PEPINIERE', 'ERPEEPIIN'], ['vocab_0354', 'PLANTEUR', 'RLPEUTNA'], ['vocab_0123', 'CENTRALE', 'ANETELRC'], ['vocab_0320', 'RESEAU', 'RAUESE']]],
  ['CM1-CM2', 'fr', 4294967295, [['vocab_1280', 'DJEMBE', 'EMBEDJ'], ['vocab_1216', 'DROITE', 'EIOTRD'], ['vocab_1247', 'COMMUNAUTE', 'AOTUNUMMEC'], ['vocab_0032', 'CROISSANT', 'SCNSIOTAR'], ['vocab_0200', 'ICOSAEDRE', 'IOADSRECE']]],
  ['CM1-CM2', 'en', 0, [['vocab_0280', 'VALIDATE', 'DAALEVTI'], ['vocab_1193', 'PURCHASE', 'HRASCPUE'], ['vocab_1183', 'BROWSER', 'RWBEORS'], ['vocab_1238', 'COFFEE', 'OFCFEE'], ['vocab_0271', 'REFUTE', 'UEFTRE']]],
  ['CM1-CM2', 'en', 12345, [['vocab_0279', 'EXPERIMENT', 'IRENTMEEPX'], ['vocab_0112', 'COMMON', 'MOMNCO'], ['vocab_0398', 'TOURISM', 'RISUMTO'], ['vocab_1225', 'CONTINENT', 'NCENONITT'], ['vocab_0268', 'CONCLUDE', 'CELCONUD']]],
  ['CM1-CM2', 'en', 4294967295, [['vocab_1222', 'OCTAGON', 'ONAOGCT'], ['vocab_1183', 'BROWSER', 'RERWSOB'], ['vocab_0349', 'FERTILIZER', 'RILEFZTREI'], ['vocab_1289', 'ELECTION', 'LNIEECTO'], ['vocab_1226', 'COUNTRY', 'ROYCTNU']]]
]

test('R1 — parties de référence figées : 3 niveaux × 2 langues × 3 numéros (dont CE1-CE2 n° 12345 : PORTE → EOPTR, SINGE → ENIGS, ROBOT → BOTRO, HARICOT → ATOHRIC, CÉRÉALE → RELCAEE)', () => {
  for (const [level, language, seed, expected] of REFERENCE) {
    const { items } = createAnagramGame(vocabulary, level, seed, language)
    const actual = items.map(i => [i.id, i.word, (i.firstLetter ?? '') + i.tiles.join('')])
    assert.deepEqual(actual, expected, `${level} ${language} n° ${seed}`)
  }
})

// Empreinte de toutes les parties (objets complets : mots, définitions,
// réponses acceptées, tuiles), calculée avant la refonte
const fingerprint = (seeds, options) => {
  const hash = createHash('sha256')
  for (const level of LEVELS) {
    for (const language of ['fr', 'en']) {
      for (let seed = 0; seed < seeds; seed++) {
        hash.update(JSON.stringify(createAnagramGame(vocabulary, level, seed, language, options)))
      }
    }
  }
  return hash.digest('hex')
}

test('R2 — 1 800 parties complètes inchangées (numéros 0 à 299, 3 niveaux, 2 langues)', () => {
  assert.equal(fingerprint(300), '0d409a025849cd638fdf0376e80ef96536c220b6c133750c00590717ec023e95')
})

test('R3 — 600 parties inchangées avec une liste de mots interdits de test (mots écartés : mêmes tirages consommés)', () => {
  assert.equal(fingerprint(100, { blockedWords: ['MA', 'NI', 'TE'] }), 'e9bec3cc44aa5654dbfe5f8911fd3d711f945d15b7b9e7524acf4aa462d1ebb7')
})
