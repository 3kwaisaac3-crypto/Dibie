# DIBIÈ - Prototype de démonstration de jeux éducatifs bilingues camerounais

Prototype web/mobile pour démontrer un apprentissage ludique du vocabulaire en français et anglais, destiné aux écoles primaires camerounaises (SIL-CM2 / Class 1-6).

> **Mode démonstration uniquement** : cette application fonctionne localement sans backend. Les profils et les rôles sont simulés et ne sont pas sécurisés. N’utilisez aucune donnée sensible ou réelle. L’application n’est pas prête pour la production.

## 🚀 Démarrage Rapide

### Prérequis
- Node.js 21+ (les tests unitaires utilisent un motif qui demande Node 21 ou plus récent)
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

### Build de démonstration

```bash
npm run build
npm run preview
```

Cette commande prépare uniquement le prototype pour une démonstration locale. Elle ne constitue pas un déploiement de production.

Le service worker n'est enregistré que sur le build, jamais avec `npm run dev`. Le build écrit `dist/service-worker.js` avec la liste de ses fichiers et un nom de cache propre à la version.

**Retour arrière si un service worker pose problème** : annuler le changement (`git revert`), reconstruire et republier. Le nouveau script remplace l'ancien à la visite suivante, en ligne, et supprime l'ancien cache. Sur un appareil précis : outils du navigateur, Application, Service Workers, *Unregister*. Effacer toutes les données du site supprimerait aussi les profils et les scores.

### Tests

Les tests sur les fichiers CSV réels ne s'exécutent que si la variable d'environnement `DIBIE_CSV_DIR` indique leur dossier ; sinon ils sont ignorés.

```bash
npm test
```

Lance les tests unitaires (`src/**/*.test.js`) avec le lanceur intégré de Node (`node --test`), sans dépendance supplémentaire. Le motif `src/**/*.test.js` demande **Node 21 ou plus récent**.

```bash
npm run test:e2e
```

Lance les tests navigateur avec Microsoft Edge : serveur de développement (port 4173) pour ordinateur, tablette et téléphone ; build (port 4174) pour le fonctionnement hors ligne.

---

## 📱 Architecture

### Structure Projet
```
dibie-app/
├── src/
│   ├── components/        # Composants React réutilisables
│   ├── pages/            # Pages (Profiles, Dashboard, Games)
│   ├── stores/           # Zustand state management
│   ├── db/              # Vocabulaire, profils, scores (localStorage)
│   ├── data/            # Vocabulaire JSON
│   ├── styles/          # CSS par page
│   ├── App.jsx          # Composant principal
│   └── main.jsx         # Entry point
├── public/
│   ├── service-worker.js # PWA offline support (réécrit au build)
│   ├── manifest.webmanifest
│   └── icons/
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
| **localStorage** | Stockage des données sur l'appareil |
| **CSS natif** | Styling, un fichier par page |
| **Service Worker** | PWA / Offline-first |

---

## 🎮 Fonctionnalités Principales

### 1. Authentification
- Profils locaux à pseudonyme, sans courriel ni mot de passe, enregistrés sur l'appareil
- L'élève choisit son profil et arrive sur son tableau de bord ; session conservée au rechargement
- Espace adulte (Enseignant, Parent, Admin) derrière une simple question, qui **n'est pas une sécurité réelle** ; un rechargement ramène aux profils et la question est reposée
- Sauvegarde locale (localStorage)

### 2. Jeux
- **Mots Croisés Bilingues** : Vocabulaire français ↔ anglais
  - filtre par matière (Mathématiques, Sciences et santé, Informatique et TIC, Autres) et raccourcis au tableau de bord ; classement à valider par un enseignant
  - en anglais, sujets et types traduits (traductions à valider) ; le filtre ne change pas les grilles : même numéro, même niveau, même type et même sujet donnent la même grille
- **Mots Mêlés** : vocabulaire du niveau choisi, dans la langue de l'interface (générateur v3.0.0, `src/utils/wordSearchGenerator.js`)
  - grille 8x8 (SIL-CP), 10x10 (CE1-CE2), 12x12 (CM1-CM2) ; mots de gauche à droite et de haut en bas seulement
  - 5, 7 ou 9 mots par grille selon le niveau, tirés au hasard (choix provisoires, à revoir après un essai avec un enseignant)
  - grille sans accents, liste affichée avec l'orthographe exacte ; mots composés et mots à apostrophe écartés
  - « Numéro de grille » : même numéro + même niveau = même grille, **à version identique de l'application et du vocabulaire**
  - ⚠️ **Mode démonstration uniquement** : la liste de mots interdits n'est pas encore établie (vide). Les lettres de remplissage peuvent former un mot inapproprié par hasard. Ne pas utiliser avec des élèves réels avant d'avoir établi cette liste avec un enseignant.
- **Anagrammes** (fiche L1 du catalogue v0.2, `src/utils/anagramGame.js`) : remettre dans l'ordre les lettres d'un mot du niveau, dans la langue de l'interface, à l'aide de sa définition
  - 3 lettres minimum ; 10 points par mot trouvé ; pas de chronomètre
  - toute autre anagramme réelle **présente dans le vocabulaire** (même niveau, même langue) est acceptée (CAMION / MANIOC) ; le jeu ne connaît pas d'autre dictionnaire
  - le mélange ne redonne jamais le mot ni une autre bonne réponse ; orthographe exacte (avec accents) montrée après chaque mot
  - choix provisoires, à valider par un enseignant : 3-5 lettres et première lettre placée (SIL-CP), 4-7 (CE1-CE2), 6-10 (CM1-CM2) ; 5 mots par partie ; après une erreur, nombre de lettres bien placées par l'élève (la lettre déjà placée ne compte pas), puis indice (première lettre ; en SIL-CP, où elle est déjà placée, les deux premières), puis solution disponible après 3 essais (mot alors non compté) ; en SIL-CP, seules les anagrammes qui commencent par la lettre placée sont acceptées
  - un mot dont la définition contient le mot lui-même ou un mot qui commence par lui (pluriel, conjugaison) n'est pas proposé ; règle par préfixe, qui écarte aussi quelques mots à tort (CAT, à cause de « catches »)
  - le numéro de partie est affiché avec la langue des mots
  - « Numéro de partie » : même numéro + même niveau + même langue = même partie, à version identique de l'application et du vocabulaire
  - ⚠️ **Mode démonstration uniquement** : même liste de mots interdits que les mots mêlés, encore vide ; un mélange peut former un mot inapproprié
- Non réalisés : difficulté adaptative, indices par IA

### 3. Dashboards
- **Élève** : Score, badges, streaks, jeux disponibles
- **Enseignant** : Score total et nombre de parties par profil, sur cet appareil
- **Parent** : Texte d'attente seulement, aucune donnée
- **Admin** : Import de vocabulaire (CSV). Les ajouts restent sur l'appareil (clé `dibieLocalVocab`) : un même numéro de grille peut alors différer entre appareils

### 4. Offline-First
- Après **une première visite en ligne**, l'application fonctionne sans connexion (essai automatique sur le build avec Edge ; vrai téléphone non essayé)
- Aucune synchronisation : les données restent sur l'appareil où l'élève a joué
- localStorage pour le stockage local ; effacer les données du site efface profils et scores
- Service Worker : tous les fichiers du build en cache dès l'installation
- **Limite connue** : en ligne, si le réseau coupe pendant le chargement d'une nouvelle version, la page peut rester vide. Un rechargement rétablit l'ancienne version, toujours complète en cache

### 5. Bilingue FR/EN
- Interface en français/anglais
- Vocabulaire adapté par niveau (SIL-CM2 ↔ Class 1-6)

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
  "niveau_en": "Class 1-2",
  "sujet": "Maison",
  "difficulte": 2,
  "actif": true
}
```

### Sujets Disponibles (94 sujets, recalculés le 2026-11-01)
- Maison (73 entrées)
- Transport (33 entrées)
- Alimentation (57 entrées)
- Géométrie (35 entrées)
- + 90 autres sujets

### Import Vocabulaire Personnalisé

**Admin Panel** :
```
1. Aller sur Dashboard Admin
2. Importer CSV
3. Format : mot_fr;mot_en;def_fr;def_en;niveau;sujet, avec ou sans colonne N° en première position, enregistré en CSV UTF-8
4. Lire le message : mots ajoutés, mots déjà présents ignorés
```

---

## 🔌 Intégration IA (Anthropic API)

> **Non réalisé** : ce qui suit est une piste. Une clé d'API ne doit jamais être placée dans une variable `VITE_`, qui serait envoyée au navigateur : il faudrait un serveur.

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
  apiKey: process.env.ANTHROPIC_API_KEY // côté serveur seulement, jamais VITE_
});
```

---

## 📱 Tests Enseignants (Fin Septembre)

### Comment Accéder

**Option 1 : Lien Web** : non disponible, aucune adresse n'est publiée à ce jour.

**Option 2 : App Mobile (Android)** : non disponible, Capacitor n'est pas installé et aucun APK n'existe.

### Retours des enseignants
Aucun formulaire n'existe à ce jour. Points à recueillir :
- Quels jeux ont marché ?
- Quels niveaux manquent ?
- Bugs rencontrés ?
- Suggestions pédagogiques ?

---

## ⚠️ Sécurité & Données

Cette version est un prototype de démonstration et ne doit pas être présentée comme une application prête pour la production.

### Stockage Local
- Les profils et les rôles sont simulés localement et ne sont pas sécurisés ; la question de l'espace adulte n'est pas une sécurité réelle
- Utilisez un pseudonyme : n’utilisez aucune donnée sensible ou réelle
- localStorage pour les profils, scores, progrès et la session de démonstration

### Backend (Futur)
- Aucun backend n’est utilisé dans ce prototype
- PostgreSQL au Cameroun (recommandé)
- Chiffrement données utilisateur
- RGPD compliant

---

## 🐛 Troubleshooting

### App ne démarre pas
```bash
# 1. Vérifier Node version
node --version  # Doit être 21+

# 2. Supprimer cache
rm -rf node_modules package-lock.json
npm install

# 3. Redémarrer
npm run dev
```

### Offline ne fonctionne pas
- Le Service Worker n'existe que sur le build (`npm run build`, puis `npm run preview`), pas avec `npm run dev`
- Il faut une première visite en ligne
- Vérifier que le Service Worker est activé
- Ouvrir DevTools → Application → Service Workers
- Activer "Offline" mode

### Vocabulaire n'apparaît pas
- Vérifier que `vocabulaire.json` existe
- Ouvrir DevTools → Console pour erreurs
- Vérifier localStorage (DevTools → Application → Local Storage)

---

## 📚 Ressources

- **React Docs** : https://react.dev
- **Vite Docs** : https://vitejs.dev
- **Zustand** : https://github.com/pmndrs/zustand

---

## 👥 Support

Pour questions/bugs :
- Aucun canal de support (courriel, téléphone, adresse GitHub publique) n'est vérifié à ce jour.

---

## 📄 License

MIT © 2024 DIBIÈ
