// Échantillon lisible des Grilles du maître (L16, phase 6, lot A) pour
// lecture par l'educator puis Isaac. Lit seulement src/data/grilles-maitre.json
// (aucun accès aux disques sources).
//
// Usage (depuis la racine du projet) :
//   node scripts/grilles-maitre-echantillon.js <fichier.md>

import { readFileSync, writeFileSync } from 'node:fs'
import { verifyMasterCollection } from '../src/utils/grillesMaitre.js'

const out = process.argv[2]
if (!out) {
  console.error('usage : node scripts/grilles-maitre-echantillon.js <fichier.md>')
  process.exit(1)
}
if (/^[HJ]:/i.test(out)) {
  console.error('refus : aucune écriture sur H: ou J:')
  process.exit(1)
}

const data = JSON.parse(readFileSync(new URL('../src/data/grilles-maitre.json', import.meta.url), 'utf8'))
const verification = verifyMasterCollection(data)
const esc = s => String(s ?? '').replace(/\|/g, '\\|')

// Grille vide numérotée et grille remplie, en texte à chasse fixe
function gridText(g, filled) {
  const num = new Map(g.mots.map(w => [`${w.ligne},${w.colonne}`, w.numero]))
  const head = '     ' + Array.from({ length: g.largeur }, (_, c) => String(c + 1).padStart(3)).join('')
  const rows = g.lignes.map((line, r) => String(r + 1).padStart(3) + '  ' + [...line].map((ch, c) => {
    if (ch === '.') return '  ■'
    if (filled || ch === '-') return '  ' + ch
    const n = num.get(`${r},${c}`)
    return n ? String(n).padStart(3) : '  ·'
  }).join(''))
  return ['```', head, ...rows, '```'].join('\n')
}

const md = []
md.push('# Échantillon des Grilles du maître — lot A (phase 6, L16)', '')
md.push(`VERSION : V0.1 — STATUT : BROUILLON (à lire par l'educator, puis par Isaac) — DATE : ${data.dateImport}`, '')
md.push('Produit par `scripts/grilles-maitre-echantillon.js` (dépôt Dibiè, branche `feature/grilles-maitre-lot-a`) à partir de `src/data/grilles-maitre.json`, lui-même produit par l\'importateur en lecture seule sur les fichiers .ecw d\'Isaac. Aucune grille n\'a été recréée ; seules les corrections acceptées par Isaac le 2026-11-09 et la normalisation des espaces multiples (P5 a) ont été appliquées.', '')
md.push(`Vérification automatique du fichier de données : **${verification.ok ? 'ok' : 'ÉCHEC'}** (0 conflit de lettres, numérotation recalculée, corrections recalculées depuis le texte d'origine).`, '')
md.push('Lecture : dans la grille numérotée, « ■ » = case vide, « · » = case à remplir, nombre = début d\'un mot. Les réponses sont données avec leurs accents ; l\'élève les tape sans accents (comparaison sans accents, cadrage §2.4 point 8). Statut de chaque grille : BROUILLON ; aucune n\'est validée par un enseignant (D14).', '')
md.push('## Sommaire', '', '| N° | Id | Titre | Langue | Matière | Niveau | Taille recadrée | Mots | Corrections |', '|---|---|---|---|---|---|---|---|---|')
data.grilles.forEach((g, i) => md.push(`| ${i + 1} | ${g.id} | ${esc(g.titre)} | ${g.langue.toUpperCase()} | ${esc(g.matiere)} | ${g.niveau} (${esc(g.niveauStatut)}) | ${g.largeur} × ${g.hauteur} | ${g.mots.length} | ${g.corrections.length} |`))
md.push('')

data.grilles.forEach((g, i) => {
  md.push(`## ${i + 1}. ${g.id} — ${g.titre}`, '')
  md.push(`- Matière : ${g.matiere} ; thème : ${g.theme} ; langue : ${g.langue.toUpperCase()} ; niveau : ${g.niveau} (${g.niveauStatut})${g.classe ? ` ; classe : ${g.classe}` : ''}.`)
  md.push(`- Auteur (en-tête) : ${g.auteur} ; ${g.copyright || 'sans copyright'} ; droits : ${g.droits.statut} (${g.droits.date})${g.droits.remarque ? ` — ${g.droits.remarque}` : ''}.`)
  md.push(`- Source : \`${g.source.chemin}\` (${g.source.logiciel} ; taille déclarée ${g.source.tailleDeclaree.largeur} × ${g.source.tailleDeclaree.hauteur} ; recadrée ${g.largeur} × ${g.hauteur}) ; SHA-256 \`${g.source.sha256}\`.`)
  if (g.titre !== g.titreOrigine) md.push(`- Titre d'origine : « ${g.titreOrigine} » (espaces normalisées).`)
  md.push('', '**Grille à remplir**', '', gridText(g, false), '', '**Grille remplie**', '', gridText(g, true), '')
  for (const [dir, label] of [['across', 'Horizontalement'], ['down', 'Verticalement']]) {
    md.push(`**${label}**`, '')
    for (const w of g.mots.filter(m => m.direction === dir)) {
      const changed = g.corrections.some(c => c.mot === w.id) ? ' *(corrigée)*' : ''
      md.push(`${w.numero}. ${w.definition} (${w.longueur}) — **${w.reponse}**${changed}`)
    }
    md.push('')
  }
  md.push('**Corrections appliquées (avant → après)**', '')
  if (!g.corrections.length) md.push('Aucune.')
  for (const c of g.corrections) {
    const w = g.mots.find(m => m.id === c.mot)
    md.push(`- **${c.id}** — ${c.reponse} (${w.numero} ${w.direction === 'across' ? 'horizontal' : 'vertical'}, ${c.type}) : « ${c.avant} » → « ${c.apres} »${c.remarque ? ` (${c.remarque})` : ''}.`)
    md.push(`  - Définition d'origine : « ${w.definitionOrigine} »`)
    md.push(`  - Définition finale : « ${w.definition} »`)
  }
  if (g.normalisations.length) {
    md.push('', `Normalisation des espaces (automatique, journalisée) : ${g.normalisations.map(n => n.mot || n.champ).join(', ')}.`)
  }
  md.push('')
})

md.push('## Limites', '')
md.push('- Les niveaux des trois grilles de problèmes (G017 à G019) restent des propositions de l\'educator, à confirmer par Isaac.')
md.push('- Champs encore vides dans les données (à renseigner par Isaac ou l\'educator) : objectif, compétence, difficulté ; classe et sous-système pour la plupart des grilles.')
md.push('- Échantillon non relu par le reviewer à sa création.')
writeFileSync(out, md.join('\n') + '\n', 'utf8')
console.log(`${data.grilles.length} grilles écrites dans ${out} ; vérification : ${verification.ok ? 'ok' : 'ÉCHEC'}`)
