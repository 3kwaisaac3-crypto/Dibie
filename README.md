# DIBIÈ - Jeux Éducatifs Bilingues Camerounais

Application web/mobile pour apprentissage ludique du vocabulaire en français et anglais, destinée aux écoles primaires camerounaises (SIL-CM2 / Form 1-6).

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 16+ 
- npm ou yarn

### Installation

```bash
# Cloner ou télécharger le projet
cd dibie-app

# Installer dépendances
npm install

# Démarrer en développement
npm run dev

# L'app s'ouvre automatiquement sur http://localhost:3000
```

### Build pour Production

```bash
npm run build
npm run preview
```

---

## 📱 Architecture

### Structure Projet
```
dibie-app/
├── src/
│   ├── components/        # Composants React réutilisables
│   ├── pages/            # Pages (Login, Dashboard, Games)
│   ├── stores/           # Zustand state management
│   ├── db/              # IndexedDB (offline database)
│   ├── data/            # Vocabulaire JSON
│   ├── styles/          # CSS par page
│   ├── App.jsx          # Composant principal
│   └── main.jsx         # Entry point
├── public/
│   └── service-worker.js # PWA offline support
├── index.html
├── vite.config.js
└── package.json
```

### Technologies Utilisées

| Technologie | Rôle |
|-------------|------|
| **React 18** | Framework UI |
| **Vite** | Build tool rapide |
| **Zustand** | State management global |
| **Dexie** | IndexedDB wrapper |
| **Tailwind CSS** | Styling (optionnel dans config) |
| **Service Worker** | PWA / Offline-first |

---

## 🎮 Fonctionnalités Principales

### 1. Authentification
- Login/Sign-up simple
- Sélection de rôle (Élève, Enseignant, Parent, Admin)
- Sauvegarde locale (localStorage)

### 2. Jeux
- **Mots Croisés Bilingues** : Vocabulaire français ↔ anglais
- **Anagrammes** : À implémenter
- Difficulté adaptative (3 niveaux)
- Indice intelligent via Anthropic API

### 3. Dashboards
- **Élève** : Score, badges, streaks, jeux disponibles
- **Enseignant** : Vue classe, progression élèves
- **Parent** : Synthétique des progrès
- **Admin** : Gestion vocabulaire

### 4. Offline-First
- App fonctionne 100% sans connexion
- Sync automatique quand réseau rétabli
- IndexedDB pour stockage local
- Service Worker pour caching

### 5. Bilingue FR/EN
- Interface en français/anglais
- Vocabulaire adapté par niveau (SIL-CM2 ↔ Form 1-6)
- Exercices bilingues

---

## 📊 Vocabulaire

### Structure des Données

```json
{
  "id": "vocab_0001",
  "mot_fr": "MAISON",
  "mot_en": "HOUSE",
  "def_fr": "Bâtiment où habitent les gens",
  "def_en": "Building where people live",
  "niveau_fr": "SIL-CP",
  "niveau_en": "Form 1-2",
  "sujet": "Maison",
  "difficulte": 2,
  "actif": true
}
```

### Sujets Disponibles (Fin Août)
- Maison (48 mots)
- Transport (24 mots)
- Alimentation (26 mots)
- Géométrie (29 mots)
- + 15 autres sujets

### Import Vocabulaire Personnalisé

**Admin Panel** :
```
1. Aller sur Dashboard Admin
2. Importer CSV
3. Format : mot_fr;mot_en;def_fr;def_en;niveau;sujet
4. Valider
```

---

## 🔌 Intégration IA (Anthropic API)

### Indices Intelligentes
```javascript
// Exemple : Générer indice pour mot "LION"
const indice = await generateHint("LION", "SIL-CP");
// → "Animal félin qui rugit" (FR)
// → "Feline animal that roars" (EN)
```

### Coût Estimé
- ~$0.001-0.01 par requête
- Caching local = 100x réduction coûts
- Budget mensuel : $10-20

### Setup
```javascript
// À créer : src/utils/anthropic.js
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.VITE_ANTHROPIC_API_KEY
});
```

---

## 📱 Tests Enseignants (Fin Septembre)

### Comment Accéder

**Option 1 : Lien Web**
```
https://dibie-app-demo.vercel.app/
```

**Option 2 : App Mobile (Android)**
- Télécharger APK depuis Capacitor
- Installer directement sur téléphone

### Feedback Google Form
```
https://forms.gle/[FORM_ID]
```

Inclure :
- Quels jeux ont marché ?
- Quels niveaux manquent ?
- Bugs rencontrés ?
- Suggestions pédagogiques ?

---

## 🔐 Sécurité & Données

### Stockage Local
- Aucune donnée sensible stockée en clair
- IndexedDB pour les scores/progrès
- localStorage pour auth token seulement

### Backend (Futur)
- PostgreSQL au Cameroun (recommandé)
- Chiffrement données utilisateur
- RGPD compliant

---

## 🐛 Troubleshooting

### App ne démarre pas
```bash
# 1. Vérifier Node version
node --version  # Doit être 16+

# 2. Supprimer cache
rm -rf node_modules package-lock.json
npm install

# 3. Redémarrer
npm run dev
```

### Offline ne fonctionne pas
- Vérifier que le Service Worker est activé
- Ouvrir DevTools → Application → Service Workers
- Activer "Offline" mode

### Vocabulaire n'apparaît pas
- Vérifier que `vocabulaire.json` existe
- Ouvrir DevTools → Console pour erreurs
- Vérifier IndexedDB (DevTools → Application → IndexedDB)

---

## 📚 Ressources

- **React Docs** : https://react.dev
- **Vite Docs** : https://vitejs.dev
- **Dexie** : https://dexie.org
- **Zustand** : https://github.com/pmndrs/zustand

---

## 👥 Support

Pour questions/bugs :
- **Email** : support@dibie-app.com
- **WhatsApp** : +237 [NUMÉRO]
- **Issues GitHub** : https://github.com/dibie/dibie-app/issues

---

## 📄 License

MIT © 2024 DIBIÈ
