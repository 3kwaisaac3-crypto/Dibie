# 🚀 DÉMARRAGE RAPIDE - DIBIÈ

## Installation (5 minutes)

### 1. Télécharger et extraire le projet
```bash
unzip dibie-app.zip
cd dibie-app
```

### 2. Installer les dépendances
```bash
npm install
```
*(Primera fois seulement - prend 2-3 min)*

### 3. Lancer l'app
```bash
npm run dev
```

### 4. Ouvrir dans le navigateur
```
http://localhost:3000
```

---

## 🎯 Test Rapide

### Créer un compte
1. Email : `test@example.com`
2. Mot de passe : `password123`
3. Cliquer "Sign In"

### Choisir rôle
- Cliquer **Élève**
- Dashboard s'ouvre

### Jouer
1. Cliquer sur **Mots Croisés**
2. Choisir niveau (SIL-CP, CE1-CE2, CM1-CM2)
3. Choisir sujet (Maison, Transport, etc.)
4. Cliquer **Commencer**
5. Remplir les cases

---

## 🌐 Mode Bilingue

### Changer langue
- Avant login : Clicker 🇫🇷 / 🇬🇧
- Après login : Settings (futur)

---

## 📊 Données Vocabulary

**Fichier** : `src/data/vocabulaire.json`

- 869 mots nettoyés
- Niveaux : SIL-CP, CE1-CE2, CM1-CM2
- Sujets : Maison, Transport, Alimentation, etc.

---

## 🔧 Config Avancée

### Ajouter clé Anthropic (pour indices IA)
1. Créer fichier `.env.local`
2. Ajouter : `VITE_ANTHROPIC_API_KEY=sk-xxx`
3. Redémarrer `npm run dev`

---

## ❓ Problèmes ?

**Port 3000 déjà occupé ?**
```bash
npm run dev -- --port 3001
```

**Dépendances cassées ?**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Service Worker pas activé ?**
- Ouvrir DevTools (F12)
- Application → Service Workers
- Vérifier "Status"

---

## 📱 Tester sur Mobile

### Android (Capacitor)
```bash
npm run build
npx cap add android
npx cap open android
# Ouvre Android Studio - Run sur téléphone
```

### iPhone (iOS)
```bash
npx cap add ios
npx cap open ios
# Ouvre Xcode - Run sur simulateur/téléphone
```

---

## 📤 Envoyer à Enseignants

### Méthode 1 : Lien web (Recommandé)
1. Build : `npm run build`
2. Deploy sur Vercel : https://vercel.com
3. Partager le lien

### Méthode 2 : Fichier APK (Android)
```bash
npm run build
npx cap sync
npx cap open android
# Android Studio → Build APK
```

---

## 📋 Checklist Test Enseignants

- [ ] Créer compte ?
- [ ] Changer langue (FR/EN) ?
- [ ] Jouer mots croisés ?
- [ ] Voir scores ?
- [ ] Offline marche ? (désactiver WiFi)

---

**Questions ?** Support WhatsApp : +237 [NUMÉRO]
