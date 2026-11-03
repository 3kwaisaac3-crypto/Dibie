import React, { useEffect, useRef } from 'react'
import '../styles/NumberPad.css'

// Pavé numérique réutilisable par les jeux de calcul (plan de migration §5.1).
// Aucune logique de jeu : il signale seulement les touches. Le nombre saisi
// est gardé et affiché par la page qui l'utilise.
// - Chiffres 0 à 9, effacement (⌫), valider (✓), grandes touches (≥ 44 px).
// - Au toucher ou à la souris, et au clavier physique (chiffres, pavé
//   numérique, Retour arrière ou Suppr, Entrée) tant que `keyboard` est vrai.
//   Entrée ne valide que si le focus est sur la page elle-même, sur une
//   touche du pavé ou sur un élément marqué data-numberpad-enter="true" (la
//   case déjà choisie dans le jeu) : sur un autre bouton (Retour, Nouvelle
//   partie, une autre case), Entrée garde son effet normal (activer ce bouton).
// - Pas de champ de saisie : le clavier du téléphone ne s'ouvre pas et ne
//   cache pas l'écran.
//
// Props :
// - onDigit(chiffre : texte '0' à '9'), onDelete(), onValidate() ;
// - disabled : tout le pavé inactif ; validateDisabled : seule la touche ✓ inactive ;
// - language : 'fr' ou 'en' (noms lus par les lecteurs d'écran) ;
// - label : nom du groupe pour les lecteurs d'écran (facultatif) ;
// - keyboard : écoute du clavier physique (vrai par défaut).
export default function NumberPad({
  onDigit,
  onDelete,
  onValidate,
  disabled = false,
  validateDisabled = false,
  language = 'fr',
  label,
  keyboard = true
}) {
  const t = (fr, en) => (language === 'fr' ? fr : en)

  // Dernières valeurs des props, lues par l'écouteur du clavier (posé une seule fois)
  const latest = useRef({})
  latest.current = { onDigit, onDelete, onValidate, disabled, validateDisabled }
  const padRef = useRef(null)

  useEffect(() => {
    if (!keyboard) return undefined
    const onKeyDown = (e) => {
      const { onDigit: digit, onDelete: del, onValidate: validate, disabled: off, validateDisabled: noValidate } = latest.current
      if (off || e.altKey || e.ctrlKey || e.metaKey) return
      // Un champ de saisie garde ses touches (numéro de partie, etc.)
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        digit?.(e.key)
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        del?.()
      } else if (e.key === 'Enter') {
        const target = e.target
        const onPage = !target || target === document.body || target === document.documentElement
        const onPad = padRef.current !== null && padRef.current.contains(target)
        const marked = target?.dataset?.numberpadEnter === 'true'
        if (!onPage && !onPad && !marked) return // autre bouton ou contrôle : comportement normal
        // Sur une touche du pavé, Entrée valide au lieu de cliquer la touche
        e.preventDefault()
        if (!noValidate) validate?.()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [keyboard])

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

  return (
    <div ref={padRef} className="number-pad" role="group" aria-label={label ?? t('Pavé numérique', 'Number pad')}>
      {digits.map(d => (
        <button key={d} type="button" className="number-pad__key" onClick={() => onDigit?.(d)} disabled={disabled}>
          {d}
        </button>
      ))}
      <button
        type="button"
        className="number-pad__key number-pad__key--delete"
        onClick={() => onDelete?.()}
        disabled={disabled}
        aria-label={t('Effacer un chiffre', 'Delete a digit')}
      >
        ⌫
      </button>
      <button type="button" className="number-pad__key" onClick={() => onDigit?.('0')} disabled={disabled}>
        0
      </button>
      <button
        type="button"
        className="number-pad__key number-pad__key--validate"
        onClick={() => onValidate?.()}
        disabled={disabled || validateDisabled}
        aria-label={t('Valider', 'Check')}
      >
        ✓
      </button>
    </div>
  )
}
