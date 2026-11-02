// Défaut n° 2 de l'audit : un mot importé doit rester après rechargement et
// être disponible dans un jeu. Fichier synthétique de même structure que le
// fichier réel : BOM, colonne N°, en-tête répété, tiret long, apostrophe.
import { existsSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { connecterEleve, creerProfil, ouvrirEspaceAdulte, choisir } from './outils.js'

const EN_TETE = 'N°;Mot en français;Mot en anglais;Définition en français;Définition en anglais;Niveau;Sujet'
const SUJET = 'Essai import'
const CSV = '﻿' + [
  EN_TETE,
  `1;ZEBRURE;Stripe;Rayure d’un pelage.;"A mark; on a coat.";CE1–CE2;${SUJET}`,
  `2;BRUME;Mist;Léger brouillard, sur l’eau.;Light fog.;CE1–CE2;${SUJET}`,
  ';;;;;;',
  EN_TETE,
  `3;GERBE;Sheaf;Botte de blé.;A bundle of wheat.;CE1–CE2;${SUJET}`,
  // Déjà dans la base au niveau CM1-CM2 : ignoré, et la définition d'origine reste
  '4;AXE;Axis;Définition qui ne doit pas écraser.;Must not overwrite.;CM1–CM2;Nombres'
].join('\r\n')

async function importer(page, contenu = CSV) {
  await page.locator('input[type="file"]').setInputFiles({
    name: 'essai.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(contenu, 'utf8')
  })
}

const stocke = (page, cle) => page.evaluate(k => JSON.parse(localStorage.getItem(k) || '[]'), cle)

async function ouvrirAdmin(page) {
  await page.goto('/')
  await ouvrirEspaceAdulte(page)
  await page.getByRole('button', { name: /Administrateur/ }).click()
}

async function sujetJouable(page) {
  await page.getByRole('button', { name: /Mots Croisés/ }).click()
  await choisir(page, { type: 'Français', niveau: 'CE1-CE2', sujet: SUJET })
  await expect(page.locator('.crossword-select__grid button', { hasText: SUJET })).toBeEnabled()
  await page.getByRole('button', { name: 'Commencer' }).click()
  await expect(page.locator('.eclipse-board')).toBeVisible()
  await expect(page.locator('.eclipse-clues')).toContainText('Rayure d’un pelage.')
}

test('Mot importé : message, jouable sans recharger, conservé après rechargement', async ({ page }) => {
  await ouvrirAdmin(page)
  await expect(page.getByText('Un même numéro de grille peut alors donner une grille différente')).toBeVisible()
  await importer(page)
  await expect(page.getByText('3 mots ajoutés, 1 déjà présent ignoré.')).toBeVisible()

  // Écrit à part : la base n'est jamais touchée, ni écrasée
  expect((await stocke(page, 'dibieLocalVocab')).map(e => e.mot_fr)).toEqual(['ZEBRURE', 'BRUME', 'GERBE'])
  const base = await stocke(page, 'dibieVocab')
  expect(base.some(e => e.mot_fr === 'ZEBRURE')).toBe(false)
  expect(base.find(e => e.mot_fr === 'AXE' && e.niveau_fr === 'CM1-CM2').def_fr).not.toContain('écraser')

  // Sans recharger
  await page.getByRole('button', { name: 'Déconnexion' }).click()
  await creerProfil(page, { pseudo: 'Importeur', niveau: 'CE1-CE2' })
  await sujetJouable(page)

  // Après rechargement
  await page.reload()
  await expect(page.locator('.crossword-select')).toBeVisible()
  await page.locator('.crossword-select__back').click()
  await sujetJouable(page)
  expect((await stocke(page, 'dibieVocab')).some(e => e.mot_fr === 'ZEBRURE')).toBe(false)
})

test('Second import du même fichier : tout est ignoré, rien n\'est dupliqué', async ({ page }) => {
  await ouvrirAdmin(page)
  await importer(page)
  await expect(page.getByText('3 mots ajoutés')).toBeVisible()
  await importer(page)
  await expect(page.getByText('0 mot ajouté, 4 déjà présents ignorés.')).toBeVisible()
  await page.reload()
  await importer(page)
  await expect(page.getByText('0 mot ajouté, 4 déjà présents ignorés.')).toBeVisible()
  expect(await stocke(page, 'dibieLocalVocab')).toHaveLength(3)
})

test('Fichier invalide : message d\'erreur, rien n\'est ajouté', async ({ page }) => {
  await ouvrirAdmin(page)
  await importer(page, 'mot_fr;mot_en;def_fr;def_en;niveau;sujet\nNOUVEAU;New;d;d;SIL-CP;X\nCASSE;Broken;;')
  await expect(page.getByText('Ligne 3 incomplète')).toBeVisible()
  expect(await stocke(page, 'dibieLocalVocab')).toHaveLength(0)
})

test('Fichier Windows-1252 : refusé, message CSV UTF-8 en français et en anglais, rien d\'enregistré', async ({ page }) => {
  await ouvrirAdmin(page)
  const fichier = Buffer.from('mot_fr;mot_en;def_fr;def_en;niveau;sujet\r\n\xC9COLE;School;Lieu;Place;SIL-CP;X', 'latin1')
  const champ = page.getByLabel('Fichier CSV à importer')
  await champ.setInputFiles({ name: 'ansi.csv', mimeType: 'text/csv', buffer: fichier })
  await expect(page.getByText('« CSV UTF-8 »')).toBeVisible()
  expect(await stocke(page, 'dibieLocalVocab')).toHaveLength(0)

  await page.getByRole('button', { name: 'English' }).click()
  await page.getByLabel('CSV file to import').setInputFiles({ name: 'ansi.csv', mimeType: 'text/csv', buffer: fichier })
  await expect(page.getByText('"CSV UTF-8"')).toBeVisible()
  expect(await stocke(page, 'dibieLocalVocab')).toHaveLength(0)
})

test('Ajouts déjà présents illisibles : message clair, contenu jamais écrasé', async ({ page }) => {
  await ouvrirAdmin(page)
  await page.evaluate(() => localStorage.setItem('dibieLocalVocab', '{illisible'))
  await importer(page)
  await expect(page.getByText('les ajouts déjà présents sur cet appareil sont illisibles')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('dibieLocalVocab'))).toBe('{illisible')
})

test('Stockage plein à l\'import : message compréhensible, pas celui du navigateur', async ({ page }) => {
  await ouvrirAdmin(page)
  await page.evaluate(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (cle, valeur) {
      if (cle === 'dibieLocalVocab') throw new DOMException('Détail technique du navigateur', 'QuotaExceededError')
      return original.call(this, cle, valeur)
    }
  })
  await importer(page)
  await expect(page.getByText('le stockage de cet appareil est plein ou indisponible')).toBeVisible()
  await expect(page.getByText('Détail technique du navigateur')).toHaveCount(0)
})

// Fichiers réels, en lecture seule, sur ordinateur seulement ; dossier indiqué
// par DIBIE_CSV_DIR, tests ignorés sans cette variable ou si le fichier est absent
for (const nom of ['DOC ED TECH DIBIE 2.csv', 'DOC ED TECH DIBIE.csv']) {
  const dossier = process.env.DIBIE_CSV_DIR
  const chemin = dossier ? `${dossier}/${nom}` : null
  test(`Import du fichier réel par l'interface : ${nom}`, async ({ page }, info) => {
    test.skip(info.project.name !== 'ordinateur', 'contrôle sur ordinateur seulement')
    test.skip(!chemin || !existsSync(chemin), 'DIBIE_CSV_DIR non défini ou fichier absent')
    await ouvrirAdmin(page)
    await page.locator('input[type="file"]').setInputFiles(chemin)
    await expect(page.getByText('3 mots ajoutés, 967 déjà présents ignorés.')).toBeVisible()
    expect(await stocke(page, 'dibieLocalVocab')).toHaveLength(3)
  })
}

test('Sans import : aucune clé d\'ajouts locaux', async ({ page }) => {
  await connecterEleve(page)
  expect(await page.evaluate(() => localStorage.getItem('dibieLocalVocab'))).toBeNull()
})
