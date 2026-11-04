// Parcours de référence des anagrammes mystères — lancer avec : npm test
// Empreintes des jeux 1 et 4 figées le 2026-11-04 AVANT la mise en commun du
// code avec le jeu 5 (lot 2, docs/anagrammes-mysteres.md §12) : un même numéro
// doit toujours donner le même parcours. Si l'un de ces tests échoue, les
// numéros de partie déjà donnés ne redonnent plus le même mystère.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { generateMysteryWordPath, generateThemePath, generateCodedMessagePath, availableThemes } from './mysteryGenerators.js'

const vocabulary = JSON.parse(readFileSync(new URL('../data/vocabulaire.json', import.meta.url), 'utf8'))
const LEVELS = ['SIL-CP', 'CE1-CE2', 'CM1-CM2']
const LANGUAGES = ['fr', 'en']

// Empreinte des parcours complets (objets JSON) : jeu 1, numéros 0 à 19 ;
// jeu 4, chaque thème disponible, numéros 0 à 4 ; 3 niveaux, 2 langues
function fingerprint() {
  const word = createHash('sha256')
  const theme = createHash('sha256')
  for (const level of LEVELS) {
    for (const language of LANGUAGES) {
      for (let seed = 0; seed < 20; seed++) word.update(JSON.stringify(generateMysteryWordPath(vocabulary, level, seed, language)))
      for (const th of availableThemes(vocabulary, level, language)) {
        for (let seed = 0; seed < 5; seed++) theme.update(JSON.stringify(generateThemePath(vocabulary, level, seed, language, th.id)))
      }
    }
  }
  return { word: word.digest('hex'), theme: theme.digest('hex') }
}

test('GR1 — jeux 1 et 4 inchangés par le lot 2 (empreintes figées avant la mise en commun du code)', () => {
  assert.deepEqual(fingerprint(), {
    word: '1d430224bf2d3b36befe846758007fe4a44f61fc004817b8384866339d0e638a',
    theme: '3c0eed3711fc4560ffde71589413e4bcb88358110d54b97e1b6fe194ecde84f2'
  })
})

// Jeu 5 « Message codé » (lot 2) : parcours de référence figés le 2026-11-04.
// [niveau, langue, numéro, mot codé, orthographe exacte, message, règle,
//  ordre des indices, [[id, mot, ordre affiché, lettre, position, nombre], ...]]
const CODED_REFERENCE = [
  ['SIL-CP', 'en', 777, 'ALARM', 'ALARM', [22, 15, 22, 4, 3], { rule: 'last' }, ['A', 'L', 'R', 'M'],
    [['vocab_0919', 'WALL', 'WLAL', 'L', 3, 15], ['vocab_0807', 'OKRA', 'OARK', 'A', 3, 22], ['vocab_0841', 'ARM', 'AMR', 'M', 2, 3], ['vocab_0883', 'FLOUR', 'FOULR', 'R', 4, 4]]],
  ['CE1-CE2', 'fr', 12345, 'DANSE', 'DANSE', [1, 8, 16, 17, 11], { rule: 'last' }, ['N', 'A', 'E', 'D', 'S'],
    [['vocab_0636', 'FENETRE', 'REFTENE', 'E', 6, 11], ['vocab_1485', 'LOURD', 'URDLO', 'D', 4, 1], ['vocab_0538', 'SAVON', 'NVAOS', 'N', 4, 16], ['vocab_0552', 'MARACAS', 'AASMCAR', 'S', 6, 17], ['vocab_0554', 'KORA', 'OAKR', 'A', 3, 8]]],
  ['CM1-CM2', 'fr', 2026, 'RETENUE', 'RETENUE', [20, 3, 12, 3, 24, 26, 3], { rule: 'position', position: 3 }, ['U', 'R', 'E', 'N', 'T'],
    [['vocab_0141', 'HAUTEUR', 'AHRUETU', 'U', 2, 26], ['vocab_0173', 'PERIMETRE', 'TRMEIEERP', 'R', 2, 20], ['vocab_0045', 'ENTIER', 'IENERT', 'T', 2, 12], ['vocab_0180', 'PENTAGONE', 'TNENAOPGE', 'N', 2, 24], ['vocab_0288', 'AMELIORER', 'EORERALIM', 'E', 2, 3]]],
  ['CM1-CM2', 'en', 0, 'MUSEUM', 'MUSEUM', [1, 13, 19, 9, 13, 1], { rule: 'marked' }, ['M', 'S', 'U', 'E'],
    [['vocab_0026', 'DECREASE', 'ERSCEEAD', 'S', 6, 19], ['vocab_1521', 'HONOUR', 'HOONRU', 'U', 4, 13], ['vocab_0122', 'CENTRE', 'ENCRTE', 'E', 5, 9], ['vocab_0390', 'SHOEMAKER', 'EMAOHERKS', 'M', 4, 1]]]
]

test('GR2 — Message codé : parcours de référence figés (3 niveaux, 2 langues)', () => {
  for (const [level, language, seed, solution, display, message, extraction, hints, steps] of CODED_REFERENCE) {
    const p = generateCodedMessagePath(vocabulary, level, seed, language)
    const where = `${level} ${language} n° ${seed}`
    assert.equal(p.final.solution, solution, where)
    assert.equal(p.final.display, display, where)
    assert.deepEqual(p.final.message, message, where)
    assert.deepEqual(p.extraction, extraction, where)
    assert.deepEqual(p.final.hints, hints, where)
    assert.deepEqual(p.steps.map(s => [s.id, s.word, (s.firstLetter ?? '') + s.tiles.join(''), s.secret, s.secretIndex, s.code]), steps, where)
  }
})
