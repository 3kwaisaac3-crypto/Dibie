export class CrosswordGenerator {
  constructor(words, gridSize = 15) {
    this.words = words.map((w, i) => ({
      ...w,
      text: w.text.toUpperCase(),
      direction: i % 2 === 0 ? 'across' : 'down',
      placed: false,
      row: 0,
      col: 0,
      clueNum: 0
    }))
    this.gridSize = gridSize
    this.grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null))
    this.clueNumber = 1
  }

  generate() {
    // Placer premier mot au centre horizontal
    if (this.words.length === 0) return { grid: this.grid, words: [] }

    const firstWord = this.words[0]
    const startRow = Math.floor(this.gridSize / 2)
    const startCol = Math.floor((this.gridSize - firstWord.text.length) / 2)
    
    this.placeWord(0, startRow, startCol)

    // Placer autres mots en cherchant des intersections
    for (let i = 1; i < this.words.length; i++) {
      this.findIntersectionAndPlace(i)
    }

    return {
      grid: this.grid,
      words: this.words.filter(w => w.placed)
    }
  }

  placeWord(wordIdx, row, col) {
    const w = this.words[wordIdx]
    
    // Vérifier si on peut placer
    if (w.direction === 'across') {
      if (col + w.text.length > this.gridSize) return false
      for (let i = 0; i < w.text.length; i++) {
        const cell = this.grid[row][col + i]
        if (cell !== null && cell !== w.text[i]) return false
      }
    } else {
      if (row + w.text.length > this.gridSize) return false
      for (let i = 0; i < w.text.length; i++) {
        const cell = this.grid[row + i][col]
        if (cell !== null && cell !== w.text[i]) return false
      }
    }

    // Placer le mot
    w.placed = true
    w.row = row
    w.col = col
    w.clueNum = this.clueNumber++

    if (w.direction === 'across') {
      for (let i = 0; i < w.text.length; i++) {
        this.grid[row][col + i] = w.text[i]
      }
    } else {
      for (let i = 0; i < w.text.length; i++) {
        this.grid[row + i][col] = w.text[i]
      }
    }

    return true
  }

  findIntersectionAndPlace(wordIdx) {
    const w = this.words[wordIdx]
    
    // Chercher tous les mots déjà placés
    for (let placed of this.words.filter(x => x.placed)) {
      // Chercher des lettres communes
      for (let pIdx = 0; pIdx < placed.text.length; pIdx++) {
        for (let wIdx = 0; wIdx < w.text.length; wIdx++) {
          if (placed.text[pIdx] === w.text[wIdx]) {
            // Trouver la position pour l'intersection
            if (placed.direction === 'across' && w.direction === 'down') {
              const row = placed.row - wIdx
              const col = placed.col + pIdx
              if (row >= 0 && row + w.text.length <= this.gridSize) {
                if (this.placeWord(wordIdx, row, col)) return
              }
            } else if (placed.direction === 'down' && w.direction === 'across') {
              const row = placed.row + pIdx
              const col = placed.col - wIdx
              if (col >= 0 && col + w.text.length <= this.gridSize) {
                if (this.placeWord(wordIdx, row, col)) return
              }
            }
          }
        }
      }
    }
  }
}