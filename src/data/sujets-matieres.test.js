// Tests de la table sujet → matière et des traductions : npm test (node --test)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MATIERES, MATIERE_AUTRES, MATIERE_TOUTES, SUJET_EN,
  filtrerParMatiere, libelleMatiere, libelleSujet, matiereDuSujet, sujetsDeLaTable, titreDeGrille
} from './sujets-matieres.js'
import { createCrosswordGame, matchesDomain } from '../utils/crosswordLayout.js'
import { NIVEAU_EN, libelleNiveau } from './niveaux.js'

const vocabulaire = JSON.parse(readFileSync(new URL('./vocabulaire.json', import.meta.url), 'utf8'))
const sujets = new Set(vocabulaire.map(e => e.sujet))

test('Tous les sujets de la table existent dans le vocabulaire, à l\'orthographe exacte', () => {
  assert.deepEqual(sujetsDeLaTable().filter(s => !sujets.has(s)), [])
  assert.equal(new Set(sujetsDeLaTable()).size, sujetsDeLaTable().length)
  assert.ok(sujets.has('Utilisation de l’ordinateur'))
  assert.equal(matiereDuSujet('Utilisation de l’ordinateur'), 'tic')
})

test('Comptes de l\'annexe A : 324, 243, 116 entrées, 41 sujets sous « Autres »', () => {
  const compte = matiere => vocabulaire.filter(e => matiereDuSujet(e.sujet) === matiere).length
  assert.equal(compte('maths'), 324)
  assert.equal(compte('sciences'), 243)
  assert.equal(compte('tic'), 116)
  assert.equal(compte('autres'), vocabulaire.length - 324 - 243 - 116)
  assert.equal([...sujets].filter(s => matiereDuSujet(s) === MATIERE_AUTRES).length, 41)
})

test('Répartition par niveau de l\'annexe A : aucune entrée de maths ni de TIC en SIL-CP', () => {
  const compte = (matiere, niveau) => vocabulaire.filter(e => matiereDuSujet(e.sujet) === matiere && e.niveau_fr === niveau).length
  assert.deepEqual(['SIL-CP', 'CE1-CE2', 'CM1-CM2'].map(n => compte('maths', n)), [0, 14, 310])
  assert.deepEqual(['SIL-CP', 'CE1-CE2', 'CM1-CM2'].map(n => compte('sciences', n)), [26, 110, 107])
  assert.deepEqual(['SIL-CP', 'CE1-CE2', 'CM1-CM2'].map(n => compte('tic', n)), [0, 59, 57])
})

test('Les 94 sujets ont une traduction, et aucune traduction ne vise un sujet absent', () => {
  assert.equal(sujets.size, 94)
  assert.deepEqual([...sujets].filter(s => !SUJET_EN.has(s)), [])
  assert.deepEqual([...SUJET_EN.keys()].filter(s => !sujets.has(s)), [])
  assert.ok([...SUJET_EN.values()].every(t => /^[A-Za-z /-]+$/.test(t)), 'pas d\'accent français dans une traduction')
})

test('Sujet absent : sous « Autres », nom français en repli, y compris un nom hérité d\'objet', () => {
  assert.equal(matiereDuSujet('Importé'), MATIERE_AUTRES)
  assert.equal(matiereDuSujet('constructor'), MATIERE_AUTRES)
  assert.equal(libelleSujet('Importé', 'en'), 'Importé')
  assert.equal(libelleSujet('constructor', 'en'), 'constructor')
  assert.equal(libelleSujet('Maison', 'en'), 'Home')
  assert.equal(libelleSujet('Maison', 'fr'), 'Maison')
})

test('Filtre : ne change que la liste, objets et valeurs internes intacts', () => {
  const liste = [{ subject: 'Fractions', playable: true }, { subject: 'Maison', playable: false }, { subject: 'TIC', playable: true }]
  assert.equal(filtrerParMatiere(liste, MATIERE_TOUTES), liste)
  assert.deepEqual(filtrerParMatiere(liste, 'maths'), [liste[0]])
  assert.deepEqual(filtrerParMatiere(liste, MATIERE_AUTRES), [liste[1]])
  assert.deepEqual(filtrerParMatiere(liste, 'sciences'), [])
})

test('Libellés des matières en français et en anglais', () => {
  assert.equal(MATIERES.length, 5)
  assert.equal(libelleMatiere('tic', 'fr'), 'Informatique et TIC')
  assert.equal(libelleMatiere('tic', 'en'), 'Computing and ICT')
})

test('Titre de grille : aucun mot placé ne correspond au titre transmis (tous sujets × niveaux × types × langues × 100 graines)', () => {
  const actifs = vocabulaire.filter(e => e.actif !== false)
  const couples = new Map()
  for (const e of actifs) {
    const cle = `${e.niveau_fr}|${e.sujet}`
    if (!couples.has(cle)) couples.set(cle, [])
    couples.get(cle).push(e)
  }
  let grilles = 0
  let titresRetires = 0
  const fautes = []
  for (const [cle, entrees] of couples) {
    const sujet = entrees[0].sujet
    for (const type of ['Français', 'Anglais', 'Bilingue']) {
      for (let graine = 1; graine <= 100; graine++) {
        const game = createCrosswordGame(entrees, type, graine)
        if (!game) continue
        grilles++
        // Français : grille déjà protégée, le titre ne change jamais
        if (titreDeGrille(game, sujet, 'fr') !== sujet) fautes.push(`fr changé : ${cle} ${type} ${graine}`)
        for (const langue of ['fr', 'en']) {
          const titre = titreDeGrille(game, sujet, langue)
          if (titre === undefined) {
            titresRetires++
            continue
          }
          const mot = game.placements.find(p => matchesDomain(p.word, titre))
          if (mot) fautes.push(`${cle} ${type} ${langue} ${graine} : ${mot.word}`)
        }
      }
    }
  }
  assert.deepEqual(fautes.slice(0, 10), [])
  assert.ok(grilles > 10000, `${grilles} grilles`)
  assert.ok(titresRetires > 0, 'le cas du titre retiré est bien rencontré')
})

test('Titre de grille : retiré seulement si un mot correspond', () => {
  const game = { placements: [{ word: 'GEOMETRY' }, { word: 'LINE' }] }
  assert.equal(titreDeGrille(game, 'Géométrie', 'en'), undefined)
  assert.equal(titreDeGrille(game, 'Géométrie', 'fr'), 'Géométrie')
  assert.equal(titreDeGrille({ placements: [{ word: 'LINE' }] }, 'Géométrie', 'en'), 'Geometry')
})

test('Niveaux affichés : Class en anglais, valeur interne en français', () => {
  assert.deepEqual(Object.keys(NIVEAU_EN).map(n => libelleNiveau(n, 'en')), ['Class 1-2', 'Class 3-4', 'Class 5-6'])
  assert.equal(libelleNiveau('CE1-CE2', 'fr'), 'CE1-CE2')
  assert.equal(libelleNiveau('Inconnu', 'en'), 'Inconnu')
  const correspondance = new Map(vocabulaire.map(e => [e.niveau_fr, e.niveau_en]))
  for (const [fr, en] of correspondance) assert.equal(libelleNiveau(fr, 'en'), en)
})
