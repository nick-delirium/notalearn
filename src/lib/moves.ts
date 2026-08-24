import type { PieceKey, Placements, Square } from './pieces'

const fileI = (s: string) => s.charCodeAt(0) - 97
const fileL = (i: number): string => String.fromCharCode(97 + i)

export const SQUARES: Square[] = (() => {
  const out: Square[] = []
  for (const r of [8, 7, 6, 5, 4, 3, 2, 1] as const)
    for (const f of 'abcdefgh' as const) out.push(`${f}${r}` as Square)
  return out
})()

export function canMove(placements: Placements, from: Square, to: Square): boolean {
  const piece = placements[from]
  if (!piece || from === to) return false
  const color = piece[0] as 'w' | 'b'
  const type = piece[1]
  const occupant = placements[to]
  if (occupant && occupant[0] === color) return false

  const ff = fileI(from[0])
  const fr = +from[1]
  const tf = fileI(to[0])
  const tr = +to[1]
  const df = tf - ff
  const dr = tr - fr
  const adf = Math.abs(df)
  const adr = Math.abs(dr)
  const fwd = color === 'w' ? 1 : -1

  switch (type) {
    case 'P': {
      if (adf === 0 && !occupant) {
        if (dr === fwd) return true
        if (
          dr === 2 * fwd &&
          fr === (color === 'w' ? 2 : 7) &&
          !placements[`${fileL(ff)}${fr + fwd}` as Square]
        ) return true
        return false
      }
      if (adf === 1 && dr === fwd) {
        if (occupant) return true
        // Approximation: allows en-passant-style captures whenever an enemy pawn
        // sits beside the mover, without verifying it just double-stepped.
        const adj = `${fileL(tf)}${fr}` as Square
        return placements[adj] === (color === 'w' ? 'bP' : 'wP')
      }
      return false
    }
    case 'N':
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1)
    case 'K': {
      if (adf <= 1 && adr <= 1) return true
      if (adr === 0 && adf === 2 && !occupant) {
        const home = color === 'w' ? '1' : '8'
        if (from !== `e${home}`) return false
        if (df === 2)
          return placements[`h${home}`] === (color + 'R' as PieceKey) &&
            !placements[`f${home}`] && !placements[`g${home}`]
        if (df === -2)
          return placements[`a${home}`] === (color + 'R' as PieceKey) &&
            !placements[`b${home}`] && !placements[`c${home}`] && !placements[`d${home}`]
      }
      return false
    }
    default: {
      const straight = df === 0 || dr === 0
      const diag = adf === adr
      if (type === 'R' && !straight) return false
      if (type === 'B' && !diag) return false
      if (type === 'Q' && !straight && !diag) return false
      const sf = Math.sign(df)
      const sr = Math.sign(dr)
      for (let i = 1; i < Math.max(adf, adr); i++) {
        if (placements[`${fileL(ff + sf * i)}${fr + sr * i}` as Square]) return false
      }
      return true
    }
  }
}
