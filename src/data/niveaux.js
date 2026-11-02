// Correspondance des tranches francophones et anglophones du primaire (curriculum MINEDUB 2018)
export const NIVEAU_EN = {
  'SIL-CP': 'Class 1-2',
  'CE1-CE2': 'Class 3-4',
  'CM1-CM2': 'Class 5-6'
}

// Niveau affiché (décision d'Isaac du 2026-11-02). La valeur interne reste le
// nom francophone : profil, scores et grilles ne changent pas.
export const libelleNiveau = (niveau, language) =>
  (language === 'fr' ? niveau : NIVEAU_EN[niveau] ?? niveau)
