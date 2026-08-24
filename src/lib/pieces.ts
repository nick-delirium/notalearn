export type PieceColor = 'w' | 'b'
export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
export type PieceKey = `${PieceColor}${PieceType}`

export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export type Square = `${File}${Rank}`

export type Placements = Partial<Record<Square, PieceKey>>

export const GLYPHS: Record<PieceKey, string> = {
  wK: '♚', wQ: '♛', wR: '♜', wB: '♝', wN: '♞', wP: '♟',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
}

export const NAMES: Record<PieceKey, string> = {
  wK: 'white king', wQ: 'white queen', wR: 'white rook', wB: 'white bishop', wN: 'white knight', wP: 'white pawn',
  bK: 'black king', bQ: 'black queen', bR: 'black rook', bB: 'black bishop', bN: 'black knight', bP: 'black pawn'
}

export const PALETTE: PieceKey[] = ['wK', 'wQ', 'wR', 'wB', 'wN', 'wP', 'bK', 'bQ', 'bR', 'bB', 'bN', 'bP']

export const FILES: File[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
export const RANKS: Rank[] = [8, 7, 6, 5, 4, 3, 2, 1]

export const START: Placements = (() => {
  const start: Placements = {}
  for (const f of FILES) {
    start[`${f}2` as Square] = 'wP'
    start[`${f}7` as Square] = 'bP'
  }
  Object.assign(start, {
    a1: 'wR', b1: 'wN', c1: 'wB', d1: 'wQ', e1: 'wK', f1: 'wB', g1: 'wN', h1: 'wR',
    a8: 'bR', b8: 'bN', c8: 'bB', d8: 'bQ', e8: 'bK', f8: 'bB', g8: 'bN', h8: 'bR'
  } satisfies Placements)
  return start
})()
