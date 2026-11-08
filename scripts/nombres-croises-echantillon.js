// Échantillon lisible des nombres croisés (phase 5, lot A) pour lecture par
// l'educator puis Isaac, et mesure du temps de génération.
//
// Usage (depuis la racine du projet) :
//   node scripts/nombres-croises-echantillon.js <fichier.md> [--graines 1,2]
//   node scripts/nombres-croises-echantillon.js --mesure 200
//
// Le fichier Markdown contient, pour chaque classe où le jeu est proposé, une
// grille par graine (numéro de partie) : grille vide numérotée, définitions
// (français et anglais, tirées de la même structure), grille remplie.
// Aucune interface, aucun serveur : simple appel du générateur.

import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import {
  createCrossNumberGame,
  crossNumberClasses,
  crossNumberSettings,
  filledGridText,
  emptyGridText
} from '../src/utils/crossNumberGame.js'
import { formatNumber } from '../src/utils/crossNumberDefinitions.js'

const TYPE_LABELS = {
  add: 'addition',
  sub: 'soustraction',
  mulTable: 'produit des tables',
  mul: 'multiplication',
  div: 'division exacte',
  double: 'double',
  half: 'moitié',
  triple: 'triple',
  third: 'tiers',
  quadruple: 'quadruple',
  quarter: 'quart',
  placeValue: 'centaines, dizaines, unités',
  times10: '× 10, × 100',
  times5: '× 5, × 50, × 500',
  times11_12: '× 11, × 12',
  times25: '× 25'
}

const SUBSYSTEM_LABEL = { fr: 'francophone', en: 'anglophone' }

function classes() {
  return ['fr', 'en'].flatMap(subsystem => crossNumberClasses(subsystem).map(className => ({ className, subsystem })))
}

function entryTable(entries) {
  const lines = ['| N° | Définition (FR) | Definition (EN) | Réponse |', '|---|---|---|---|']
  for (const e of entries) lines.push(`| ${e.number} | ${e.text.fr} | ${e.text.en} | ${e.answer} |`)
  return lines.join('\n')
}

function sample(outFile, seeds) {
  const out = []
  out.push('# Échantillon de grilles « Nombres croisés » — lot A de la phase 5 de Dibiè')
  out.push('')
  out.push('**Pôle DIBIÈ — contenu généré par programme**')
  out.push('')
  out.push(`VERSION : V0.1 — STATUT : BROUILLON, NON VALIDÉ (à lire par l'educator puis Isaac ; aucun enseignant n'a validé ces grilles, D14 / Q7) — DATE : ${new Date().toISOString().slice(0, 10)}`)
  out.push('')
  out.push('Produit par : `node scripts/nombres-croises-echantillon.js <fichier.md>` dans le dépôt de l\'application Dibiè, branche `feature/nombres-croises-lot-a` (générateur `src/utils/crossNumberGame.js`). Rien n\'est rédigé à la main : grilles, nombres et définitions sortent du générateur, et chaque grille a passé le vérificateur (`verifyCrossNumberGame`) avant d\'être écrite ici.')
  out.push('')
  out.push('Règles appliquées : cadrage de la phase 5 (`DIBIE/pedagogie/cadrage-phase5-nombres-croises-v0.1.md`), décisions P1 à P12 validées par Isaac le 2026-11-08. Toutes les valeurs par classe (taille, chiffres, types de définitions) sont des **hypothèses à vérifier** avec un enseignant (D4).')
  out.push('')
  out.push('Lecture :')
  out.push('- **Partie n°** : numéro de la grille (graine). Même numéro + même classe = même grille ; la langue ne change que le texte des définitions (P12 a). Les deux langues sont donc montrées pour chaque grille.')
  out.push('- **Grille vide** : ce que verrait l\'élève ; `####` = case noire ; le numéro est celui de la case où commence un nombre.')
  out.push('- **Définitions** : A = horizontalement (across), D = verticalement (down). La colonne « Réponse » est pour le lecteur, pas pour l\'élève.')
  out.push('- **Grille remplie** : la solution ; ■ = case noire.')
  out.push('- SIL et Class 1 : jeu non proposé (P2 a), donc absents.')
  out.push('')
  for (const { className, subsystem } of classes()) {
    const s = crossNumberSettings(className, subsystem)
    out.push(`## ${className} (${SUBSYSTEM_LABEL[subsystem]})`)
    out.push('')
    const digits = s.minDigits === s.maxDigits ? `${s.minDigits}` : `${s.minDigits} à ${s.maxDigits}`
    const usesOperand = s.operations.includes('mul') || s.operations.includes('div')
    const operand = usesOperand ? ` ; multiplicateur ou diviseur jusqu'à ${s.maxOperand ?? '99 (non précisé par le programme, choix provisoire)'}` : ''
    out.push(`Grille ${s.size} × ${s.size} ; nombres de ${digits} chiffres, au plus ${formatNumber(s.maxNumber, 'fr')} ; tables : ${s.tables.length ? s.tables.join(', ') : 'aucune'}${operand}.`)
    out.push('')
    out.push(`Types de définitions permis : ${s.operations.map(t => TYPE_LABELS[t] ?? t).join(' ; ')}.`)
    out.push('')
    for (const seed of seeds) {
      const game = createCrossNumberGame({ className, subsystem, seed })
      const across = game.entries.filter(e => e.direction === 'across')
      const down = game.entries.filter(e => e.direction === 'down')
      out.push(`### ${className} — Partie n° ${seed}`)
      out.push('')
      out.push(`Gabarit ${game.templateId}, symétrie ${game.symmetry} ; ${game.entries.length} nombres.`)
      out.push('')
      out.push('Grille vide numérotée :')
      out.push('')
      out.push('```text')
      out.push(emptyGridText(game))
      out.push('```')
      out.push('')
      out.push('Horizontalement :')
      out.push('')
      out.push(entryTable(across))
      out.push('')
      out.push('Verticalement :')
      out.push('')
      out.push(entryTable(down))
      out.push('')
      out.push('Grille remplie (solution) :')
      out.push('')
      out.push('```text')
      out.push(filledGridText(game))
      out.push('```')
      out.push('')
    }
  }
  writeFileSync(outFile, out.join('\n'), 'utf8')
  console.log(`Échantillon écrit : ${outFile}`)
}

function measure(count) {
  console.log(`Temps de génération (ms) sur ${count} graines par classe — machine de développement, PAS un téléphone`)
  console.log('classe | moyenne | médiane | 95e centile | max | essais max')
  for (const { className, subsystem } of classes()) {
    createCrossNumberGame({ className, subsystem, seed: 999999 }) // préchauffage
    const times = []
    let attempts = 0
    for (let seed = 0; seed < count; seed++) {
      const t0 = performance.now()
      const game = createCrossNumberGame({ className, subsystem, seed })
      times.push(performance.now() - t0)
      attempts = Math.max(attempts, game.stats.attempts)
    }
    times.sort((a, b) => a - b)
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const at = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))]
    console.log(`${className} | ${avg.toFixed(1)} | ${at(0.5).toFixed(1)} | ${at(0.95).toFixed(1)} | ${times[times.length - 1].toFixed(1)} | ${attempts}`)
  }
}

const args = process.argv.slice(2)
const m = args.indexOf('--mesure')
if (m !== -1) {
  measure(Number(args[m + 1]) || 200)
} else if (args[0] && !args[0].startsWith('--')) {
  const g = args.indexOf('--graines')
  const seeds = g !== -1 ? args[g + 1].split(',').map(Number) : [1, 2]
  sample(args[0], seeds)
} else {
  console.error('Usage : node scripts/nombres-croises-echantillon.js <fichier.md> [--graines 1,2] | --mesure 200')
  process.exit(1)
}
