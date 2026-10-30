// Contrôle de toutes les combinaisons niveau × type × sujet réellement
// proposées par l'écran de choix. Exécuté sur la taille « ordinateur » seulement.
import { test, expect } from '@playwright/test'
import { ouvrirMotsCroises, controlerGrille, suivreErreurs, NIVEAUX, TYPES, echapper } from './outils.js'

for (const type of TYPES) {
  for (const niveau of NIVEAUX) {
    test(`Toutes les grilles : ${niveau}, ${type}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'ordinateur', 'contrôle complet sur ordinateur seulement')
      test.setTimeout(240_000)
      const erreurs = suivreErreurs(page)
      await ouvrirMotsCroises(page)
      const choix = page.locator('.crossword-select')
      await choix.getByRole('button', { name: type, exact: true }).click()
      await choix.getByRole('button', { name: niveau, exact: true }).click()

      const sujets = await page.locator('.crossword-select__grid button').evaluateAll(bs =>
        bs.map(b => ({ sujet: b.textContent.replace(/bientôt disponible|coming soon/, '').trim(), grise: b.disabled })))
      const grises = sujets.filter(s => s.grise).map(s => s.sujet)
      if (grises.length) info.annotations.push({ type: 'sujets grisés', description: grises.join(', ') })

      const echecs = []
      for (const { sujet, grise } of sujets) {
        if (grise) continue
        await page.locator('.crossword-select__grid button', { hasText: new RegExp(`^${echapper(sujet)}$`) }).click()
        await page.getByRole('button', { name: 'Commencer' }).click()
        await expect(page.locator('.eclipse-board')).toBeVisible()
        const { anomalies } = await controlerGrille(page, { type, niveau, sujet })
        if (anomalies.length) echecs.push(`${sujet} : ${anomalies.join(' ; ')}`)
        await page.locator('.eclipse-back-btn').click()
        await expect(page.locator('.crossword-select')).toBeVisible()
      }
      expect(echecs, echecs.join('\n')).toEqual([])
      expect(erreurs, erreurs.join('\n')).toEqual([])
    })
  }
}
