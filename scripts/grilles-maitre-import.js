// Importateur des Grilles du maître (L16, phase 6, lot A).
//
// Usage (depuis la racine du projet, au moment du développement) :
//   node scripts/grilles-maitre-import.js [--sortie src/data/grilles-maitre.json] [--date AAAA-MM-JJ]
//
// LECTURE SEULE sur les disques sources : le script lit les 12 fichiers .ecw
// de scripts/grilles-maitre-selection.js (fs.readFileSync) et n'écrit que le
// fichier de sortie, refusé s'il est sur H: ou J:. Aucune grille n'est recréée,
// aucun .ecw n'est modifié.
//
// Pour chaque grille : empreinte SHA-256 du fichier comparée à celle du relevé
// du 2026-11-09 (arrêt si elle diffère), conversion cp1252 -> UTF-8,
// reconstruction, contrôle 0 conflit, recadrage, numérotation, corrections
// acceptées appliquées (texte d'origine conservé), puis vérification par
// verifyMasterCollection (src/utils/grillesMaitre.js). Rien n'est écrit si une
// seule grille échoue.

import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SELECTION, DATE_SELECTION } from './grilles-maitre-selection.js'
import { importGrid } from '../src/utils/grillesMaitreImport.js'
import { verifyMasterCollection } from '../src/utils/grillesMaitre.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = name => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const sortie = path.resolve(root, option('--sortie') || 'src/data/grilles-maitre.json')
const dateImport = option('--date') || new Date().toISOString().slice(0, 10)
if (/^[HJ]:/i.test(sortie)) {
  console.error('refus : aucune écriture sur H: ou J:')
  process.exit(1)
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(dateImport)) {
  console.error('date invalide (AAAA-MM-JJ attendu)')
  process.exit(1)
}

const grilles = []
const erreurs = []
for (const fiche of SELECTION) {
  const chemin = fiche.copies[0]
  try {
    const bytes = readFileSync(chemin)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== fiche.sha256) throw new Error(`empreinte différente du relevé : ${sha256} (attendu ${fiche.sha256})`)
    grilles.push(importGrid(bytes, fiche, { chemin, copies: fiche.copies, sha256, octets: bytes.length, dateImport }))
  } catch (e) {
    erreurs.push(`${fiche.id} (${chemin}) : ${e.message}`)
  }
}
if (erreurs.length) {
  console.error(`Import interrompu, rien n'est écrit :\n- ${erreurs.join('\n- ')}`)
  process.exit(1)
}

const collection = {
  format: 'dibie-grilles-maitre',
  version: 1,
  description: 'Grilles du maître (L16) importées des fichiers EclipseCrossword d\'Isaac. Généré par scripts/grilles-maitre-import.js : ne pas modifier à la main.',
  selection: `selection-lot0-v0.1.md (dépôt JARVIS), validée par Isaac le ${DATE_SELECTION}`,
  dateImport,
  grilles
}
const verification = verifyMasterCollection(collection)
if (!verification.ok) {
  console.error(`Vérification en échec, rien n'est écrit :\n- ${verification.errors.join('\n- ')}`)
  process.exit(1)
}

writeFileSync(sortie, JSON.stringify(collection, null, 2) + '\n', 'utf8')
for (const g of grilles) {
  console.log(`${g.id}  ${g.largeur}×${g.hauteur}  ${g.mots.length} mots  ${g.corrections.length} correction(s)  ${g.normalisations.length} normalisation(s)  ${g.titre}`)
}
console.log(`${grilles.length} grilles écrites dans ${path.relative(root, sortie)} ; vérification : ok`)
