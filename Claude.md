# Dibiè — Contexte Projet

## 📋 Vue d'ensemble
**Dibiè** : Plateforme EdTech bilingue (FR/EN) de mots croisés interactifs pour le système scolaire camerounais (primaire SIL-CM2, section anglophone Form 1-Form 6).

**Cible** : 300 écoles, 40+ enseignants tests (fin septembre 2025), déploiement commercial octobre 2025.

**MVP** : Application web responsive + mobile-ready via Capacitor. Tests offline-first prioritaires.

---

## 🏗️ Stack Technique

### Frontend
- **React 18** + **Vite** (bundler rapide)
- **Zustand** (state management léger)
- **CSS3** natif (pas Tailwind, design custom)
- **localStorage** pour données (IndexedDB abandonné - bugs Windows)

### Mobile
- **Capacitor** : build iOS/Android depuis React
- Target : Android 10+ (prioritaire, 95% utilisateurs au Cameroun)

### Backend / Auth (À intégrer)
- Firebase Authentication (Google + Email)
- Firebase Realtime Database (scores, progress)
- Cloud Functions pour validation backend

### Infrastructure
- **Déploiement MVP** : Vercel (tests enseignants)
- **Infra longue durée** : Hetzner VPS ($5-10/mois) + PostgreSQL

### Algorithme Grille
- **Placement déterministe** : backtracking simple mais stable
- **Tailles** : 8x8 (SIL-CP), 10x10 (CE1-CE2), 12x12 (CM1-CM2) — **pas 15x15** (trop complexe MVP)
- **Intersections visuelles** : mots croisés type Eclipse (lettres communes affichées)
- **Validation** : vérification complète de la grille avant render

### Contenu (Vocabulaire)
- **Source** : CSV 869 mots nettoyés (mot_fr, mot_en, définitions, niveaux, sujets)
- **Définitions** : pré-généré une fois via Claude API (batch processing)
- **Storage** : vocabulaire.json statique embarqué (jamais généré au runtime)
- **Aucune dépendance réseau** pour accès vocabulaire en jeu

---

## 📁 Structure Projet

```
dibie-app/
├── src/
│   ├── components/
│   │   ├── EclipseGrid.jsx          ← Grille mots croisés pro
│   │   ├── CrosswordGridVisual.jsx  ← Alternative simple (fallback)
│   │   └── [autres composants]
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── RoleSelect.jsx
│   │   ├── StudentDashboard.jsx
│   │   ├── TeacherDashboard.jsx
│   │   ├── ParentDashboard.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── CrosswordGame.jsx        ← Orchestration jeu
│   │   └── [autres pages]
│   ├── stores/appStore.js           ← Zustand
│   ├── db/index.js                  ← localStorage wrapper
│   ├── data/vocabulaire.json        ← 869 mots (statique)
│   ├── styles/
│   │   ├── EclipseGrid.css
│   │   ├── CrosswordGame.css
│   │   └── [autres]
│   ├── App.jsx
│   └── main.jsx
├── public/service-worker.js         ← PWA offline
├── capacitor.config.json            ← Config mobile
├── vite.config.js
├── package.json
└── Claude.md                        ← Ce fichier
```

---

## 🎮 Flux de Jeu

1. **Sélection** : Élève choisit Type (Bilingue/FR/EN) → Niveau → Sujet
2. **Génération** : GridGenerator crée grille avec intersections
3. **Gameplay** :
   - Clic case → focus + numéro de clue
   - Tape lettre → validation temps réel, auto-avance case suivante
   - Mot complet = animation verte + score +10 pts
   - Navigation clavier (flèches, Tab)
4. **Résultat** : Score final, option "Continuer" ou "Retour sélection"

### 3 Types de Puzzles

- **Bilingue** : Mots alternent FR (horizontal) / EN (vertical) — pédagogiquement riche
- **Français 100%** : Tous mots en FR, définitions FR — pour francophones purs
- **Anglais 100%** : Tous mots en EN, définitions EN — pour anglophones purs

---

## 📋 Vocabulaire

### Source CSV
- **Fichier** : DOC_ED_TECH_DIBIE_2.csv (initial)
- **Nettoyage** : Suppression doublons, normalisation accents

### Format JSON (vocabulaire.json)
```json
{
  "id": "001",
  "mot_fr": "MAISON",
  "mot_en": "HOUSE",
  "def_fr": "Lieu d'habitation",
  "def_en": "Place where people live",
  "niveau_fr": "SIL-CP",
  "niveau_en": "Form 1",
  "sujet": "Maison",
  "difficulte": 1,
  "actif": true
}
```

### Récupération en Jeu
```javascript
const words = await getVocabByLevelAndSubject(level, subject)
// Jamais d'appel API en jeu → localStorage toujours
```

---

## 🎨 Conventions

### Commits Git
- Format : **français, impératif court**
- ✅ `Ajouter grille Eclipse avec intersections`
- ❌ `ajout de la grille` / `fix grid thing`

### Code React
- **Composants fonctionnels + hooks UNIQUEMENT**
- State : Zustand (global) ou `useState` (local)
- Pas de class components

### TypeScript (À implémenter)
- Typage strict : `-`  `strict: true` en tsconfig
- Pas de `any` sauf avec justification inline
- Types explicites pour props, state, retours fonctions

### Nomenclature
- Fichiers composants : `PascalCase.jsx`
- Fichiers utils : `camelCase.js`
- Classes/générateurs : `PascalCase`
- Constantes globales : `UPPER_SNAKE_CASE`

---

## 🚫 Ne Jamais Faire

### Réseau & Offline
- ❌ Appel API synchrone dans le flux de jeu (bloc d'attente)
- ❌ Dépendre d'une connexion réseau pour jouer
- ❌ Charger vocabulaire depuis API à runtime
- ✅ Pré-traiter tout (définitions, grilles) offline

### Data & State
- ❌ Stocker données utilisateur critiques en localStorage seul (Firebase à implémenter)
- ❌ État global complexe sans Zustand
- ❌ Props drilling > 3 niveaux (utiliser context si besoin)

### Code Quality
- ❌ `any` en TypeScript sans raison documentée
- ❌ Logique métier dans composants (extraire en utils)
- ❌ Imports circulaires
- ❌ Magic numbers : toujours extraire en constantes nommées

### Performance
- ❌ Rerender de grille à chaque keystroke (memoize)
- ❌ Images non optimisées (WebP prioritaire)
- ❌ Bundle > 500KB (gzip)

---

## ✅ Checklist Offline-First

- [ ] Vocabulaire chargé en mémoire au démarrage
- [ ] Grille générée côté client (jamais serveur)
- [ ] Score sauvegardé localement AVANT tentative sync
- [ ] Service Worker intercepte requests, fallback offline
- [ ] Aucun break utilisateur si réseau disparaît
- [ ] Sync en arrière-plan dès reconnexion (Firebase)

---

## 🧪 Testing (À formaliser)

### End-to-End
- Niveau + Sujet → Vocabulaire charge ✓
- Grille 8x8/10x10/12x12 génère correctement ✓
- Remplissage complet + validation ✓
- Score sauvegardé ✓

### Offline
- Disable WiFi → jeu continue ✓
- Reconnexion → scores synced ✓

### Navigateurs Cibles
- Chrome/Opera (99%+ Cameroun)
- Firefox Mobile
- Samsung Internet (Android natif)

---

## 🔮 Roadmap

### MVP (Fin août 2025)
- ✅ Grille Eclipse pro
- ✅ 3 types puzzles
- ✅ Offline-first 100%
- ✅ Tests Vercel

### Phase 2 (Septembre 2025)
- [ ] Firebase Auth + Backend
- [ ] Tableau scores enseignants
- [ ] Rapports progress élèves
- [ ] Tests 40 enseignants

### Phase 3 (Octobre-Novembre 2025)
- [ ] Capacitor build mobile
- [ ] Distribution Play Store
- [ ] Commercialisation 300 écoles

---

## 📞 Contacts Utiles

- **Isaac (Lead)** : isaac@dibie.cm
- **Tests enseignants** : Fin septembre 2025
- **Support utilisateurs** : WhatsApp (TBD)

---

## 📝 Notes

- **Langues** : Français + Anglais système + Français vocabulaire
- **Zones** : Primaire SIL-CM2 (équivalent Form 1-6 section anglophone)
- **Monétisation** : Licence annuelle $120-1000 par école
- **Infrastructure coût** : ~$3,750/an (infra + Claude API + support)

---

**Dernier update** : Septembre 2026
**Statut** : MVP en tests