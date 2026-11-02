// Import de vocabulaire depuis un fichier CSV (écran Administrateur).
// Module sans interface, testé par node --test.
// Deux formats acceptés :
// - mot_fr;mot_en;def_fr;def_en;niveau;sujet (avec ou sans en-tête) ;
// - N°;Mot en français;Mot en anglais;Définition en français;Définition en anglais;Niveau;Sujet,
//   avec BOM, en-tête répété et niveaux à tiret long (CM1–CM2).

// Correspondance des tranches francophones et anglophones du primaire (curriculum MINEDUB 2018)
const NIVEAU_EN = {
  'SIL-CP': 'Class 1-2',
  'CE1-CE2': 'Class 3-4',
  'CM1-CM2': 'Class 5-6'
}

// Noms de colonnes reconnus dans un en-tête (minuscules, sans accents)
const COLONNES = {
  'mot_fr': 'mot_fr',
  'mot en francais': 'mot_fr',
  'mot_en': 'mot_en',
  'mot en anglais': 'mot_en',
  'def_fr': 'def_fr',
  'definition en francais': 'def_fr',
  'def_en': 'def_en',
  'definition en anglais': 'def_en',
  'niveau': 'niveau',
  'sujet': 'sujet'
}
const OBLIGATOIRES = ['mot_fr', 'mot_en', 'def_fr', 'def_en']
const ORDRE_SIMPLE = { mot_fr: 0, mot_en: 1, def_fr: 2, def_en: 3, niveau: 4, sujet: 5 }
const ORDRE_AVEC_NUMERO = { mot_fr: 1, mot_en: 2, def_fr: 3, def_en: 4, niveau: 5, sujet: 6 }

const COLONNES_ATTENDUES = 'mot_fr;mot_en;def_fr;def_en;niveau;sujet'

// Erreur d'import en deux langues : message en français, en en anglais
export class ImportError extends Error {
  constructor(fr, en) {
    super(fr)
    this.en = en
  }
}

const sansAccents = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '')

// Séparateur lu sur la première ligne non vide : celui qui y apparaît le plus
// hors guillemets. On n'accepte plus les deux à la fois : une virgule dans une
// définition décalait les colonnes. À égalité (ou aucun des deux) : « ; ».
function detecterSeparateur(text) {
  let pointsVirgules = 0
  let virgules = 0
  let inQuotes = false
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes && ch === ';') pointsVirgules++
    else if (!inQuotes && ch === ',') virgules++
    else if (!inQuotes && (ch === '\n' || ch === '\r') && (pointsVirgules > 0 || virgules > 0)) break
  }
  return virgules > pointsVirgules ? ',' : ';'
}

// Lignes du fichier, avec leur numéro dans le fichier. Une valeur entre
// guillemets peut contenir le séparateur, un saut de ligne et "" pour un
// guillemet. Les lignes entièrement vides (dont ;;;;;;) sont retirées.
function lireLignes(text) {
  const source = text.replace(/^\uFEFF/, '')
  const separateur = detecterSeparateur(source)
  const lignes = []
  let cells = []
  let current = ''
  let inQuotes = false
  let ligne = 1
  let debutLigne = 1
  let debutGuillemet = 1

  const finCellule = () => {
    cells.push(current.trim())
    current = ''
  }
  const finLigne = () => {
    finCellule()
    if (cells.some(c => c !== '')) lignes.push({ cells, ligne: debutLigne })
    cells = []
  }

  for (let i = 0; i < source.length; i++) {
    const ch = source[i]
    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        if (ch === '\n') ligne++
        current += ch
      }
    } else if (ch === '"' && current.trim() === '') {
      // Guillemet en début de valeur seulement ; ailleurs, c'est un caractère ordinaire
      inQuotes = true
      current = ''
      debutGuillemet = ligne
    } else if (ch === separateur) {
      finCellule()
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++
      finLigne()
      ligne++
      debutLigne = ligne
    } else {
      current += ch
    }
  }
  if (inQuotes) throw new ImportError(`Ligne ${debutGuillemet} : guillemet non fermé`, `Line ${debutGuillemet}: unclosed quote`)
  finLigne()
  return lignes
}

// Parser CSV : tableau de lignes, chacune un tableau de valeurs
export function parseCSV(text) {
  return lireLignes(text).map(l => l.cells)
}

// Colonnes d'une ligne d'en-tête, ou null si ce n'est pas un en-tête. Une seule
// valeur reconnue sans mot_fr ne suffit pas : NIVEAU ou SUJET peuvent être des mots.
function colonnesEnTete(cells, ligne) {
  const noms = cells.map(c => COLONNES[sansAccents(c).toLowerCase().replace(/\s+/g, ' ')])
  if (!noms.includes('mot_fr') && noms.filter(Boolean).length < 2) return null

  // Colonne N° tolérée sous ses formes courantes ; un en-tête répété peut aussi
  // porter un numéro de ligne (« 49;Mot en français;… »), en première cellule seulement
  const inconnue = cells.find((c, i) => c !== '' && !noms[i] && !/^n(°|º|o\.?|um[ée]ro)$/i.test(c) && !(i === 0 && /^\d+$/.test(c)))
  if (inconnue) {
    throw new ImportError(
      `Ligne ${ligne} : colonne inconnue « ${inconnue} » (colonnes attendues : ${COLONNES_ATTENDUES})`,
      `Line ${ligne}: unknown column "${inconnue}" (expected columns: ${COLONNES_ATTENDUES})`
    )
  }
  const colonnes = {}
  noms.forEach((nom, i) => {
    if (nom) colonnes[nom] = i
  })
  return colonnes
}

// Tolère la casse, les espaces et les tirets longs : « cm1 – cm2 » → « CM1-CM2 »
function normaliserNiveau(niveau) {
  return niveau.toUpperCase().replace(/[‐-―−]/g, '-').replace(/\s+/g, '')
}

// Clé de comparaison : même mot_fr normalisé (casse, accents, ligatures,
// espaces, forme de l'apostrophe) et même niveau.
export function cleVocabulaire(entry) {
  const mot = sansAccents(String(entry.mot_fr ?? ''))
    .toUpperCase()
    .replace(/Œ/g, 'OE')
    .replace(/Æ/g, 'AE')
    .replace(/[’‘ʼ]/g, "'")
    .trim()
    .replace(/\s+/g, ' ')
  return `${mot}|${entry.niveau_fr}`
}

// Convertit un fichier CSV en entrées de vocabulaire. Une entrée déjà présente
// dans existing (ou plus haut dans le fichier) est ignorée et comptée, jamais
// écrasée. Toute ligne invalide arrête l'import : rien n'est ajouté à moitié.
export function prepareImport(text, existing = [], { now = Date.now() } = {}) {
  // Un fichier qui n'est pas en UTF-8 est décodé avec ce caractère de
  // remplacement : on refuse, plutôt que d'enregistrer « �COLE »
  if (text.includes('\uFFFD')) {
    throw new ImportError(
      'Ce fichier n\'est pas en UTF-8 et ses accents seraient abîmés. Enregistrez-le au format « CSV UTF-8 », puis importez-le à nouveau.',
      'This file is not UTF-8 and its accents would be damaged. Save it as "CSV UTF-8", then import it again.'
    )
  }
  const dejaVus = new Set(existing.map(cleVocabulaire))
  const entries = []
  let ignored = 0
  let total = 0
  let colonnes = null

  lireLignes(text).forEach(({ cells, ligne }, index) => {
    if (/^sep=/i.test(cells[0]) && cells.slice(1).every(c => c === '')) {
      throw new ImportError(
        `Ligne ${ligne} : la ligne « sep= » n'est pas acceptée. Retirez-la du fichier : le séparateur est détecté automatiquement.`,
        `Line ${ligne}: the "sep=" line is not accepted. Remove it from the file: the separator is detected automatically.`
      )
    }
    const enTete = colonnesEnTete(cells, ligne)
    if (enTete) {
      const absente = OBLIGATOIRES.find(nom => enTete[nom] === undefined)
      if (absente) {
        throw new ImportError(
          `Ligne ${ligne} : colonne ${absente} absente de l'en-tête (colonnes attendues : ${COLONNES_ATTENDUES})`,
          `Line ${ligne}: column ${absente} missing from the header (expected columns: ${COLONNES_ATTENDUES})`
        )
      }
      colonnes = enTete
      return
    }

    total++
    // Sans en-tête : colonne N° reconnue à 7 valeurs commençant par un nombre
    const ordre = colonnes || (cells.length >= 7 && /^\d+$/.test(cells[0]) ? ORDRE_AVEC_NUMERO : ORDRE_SIMPLE)
    const largeur = Math.max(...Object.values(ordre)) + 1
    let utilisees = cells.length
    while (utilisees > 0 && cells[utilisees - 1] === '') utilisees--
    if (utilisees > largeur) {
      throw new ImportError(
        `Ligne ${ligne} : trop de colonnes (une valeur contenant le séparateur doit être entre guillemets)`,
        `Line ${ligne}: too many columns (a value containing the separator must be in quotes)`
      )
    }

    const valeur = nom => (ordre[nom] === undefined ? '' : cells[ordre[nom]] || '')
    // Première ligne sans en-tête reconnu : c'est peut-être un en-tête inconnu
    const indiceFr = colonnes || total > 1 ? '' : ` Si c'est un en-tête, les colonnes attendues sont : ${COLONNES_ATTENDUES}.`
    const indiceEn = colonnes || total > 1 ? '' : ` If this is a header, the expected columns are: ${COLONNES_ATTENDUES}.`
    if (OBLIGATOIRES.some(nom => !valeur(nom))) {
      throw new ImportError(`Ligne ${ligne} incomplète.${indiceFr}`, `Line ${ligne} incomplete.${indiceEn}`)
    }

    const niveau_fr = normaliserNiveau(valeur('niveau') || 'CM1-CM2')
    if (!NIVEAU_EN[niveau_fr]) {
      throw new ImportError(
        `Ligne ${ligne} : niveau inconnu « ${valeur('niveau')} » (attendu : SIL-CP, CE1-CE2 ou CM1-CM2).${indiceFr}`,
        `Line ${ligne}: unknown level "${valeur('niveau')}" (expected: SIL-CP, CE1-CE2 or CM1-CM2).${indiceEn}`
      )
    }

    const entry = {
      id: `import_${now}_${index}`,
      mot_fr: valeur('mot_fr'),
      mot_en: valeur('mot_en'),
      def_fr: valeur('def_fr'),
      def_en: valeur('def_en'),
      niveau_fr,
      niveau_en: NIVEAU_EN[niveau_fr],
      sujet: valeur('sujet') || 'Importé',
      difficulte: 2,
      actif: true
    }
    const cle = cleVocabulaire(entry)
    if (dejaVus.has(cle)) {
      ignored++
      return
    }
    dejaVus.add(cle)
    entries.push(entry)
  })

  return { entries, added: entries.length, ignored, total }
}

// Message de fin d'import, avec les pluriels
export function messageImport(added, ignored, language = 'fr') {
  if (language === 'fr') {
    const ajout = added > 1 ? `${added} mots ajoutés` : `${added} mot ajouté`
    const ignore = ignored > 1 ? `${ignored} déjà présents ignorés` : `${ignored} déjà présent ignoré`
    return `${ajout}, ${ignore}.`
  }
  return `${added} ${added === 1 ? 'word' : 'words'} added, ${ignored} already present skipped.`
}

// Vocabulaire de base suivi des ajouts locaux. La base garde toujours son
// ordre et a priorité : un ajout devenu présent dans la base est écarté.
export function mergeVocab(base, local) {
  if (local.length === 0) return base
  const dejaVus = new Set(base.map(cleVocabulaire))
  return [...base, ...local.filter(e => !dejaVus.has(cleVocabulaire(e)))]
}
