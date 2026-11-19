import { START } from './pieces'
import type { PieceColor, PieceKey, Placements, Square } from './pieces'

export type PromoType = 'Q' | 'R' | 'B' | 'N'

export interface CastlingRights {
  wK: boolean
  wQ: boolean
  bK: boolean
  bQ: boolean
}

/** The board alone can't decide legality — castling rights and en passant depend on history. */
export interface Position {
  placements: Placements
  turn: PieceColor
  castling: CastlingRights
  /** square a pawn skipped with a double step on the previous move (capturable en passant) */
  ep: Square | null
}

const fileI = (s: string) => s.charCodeAt(0) - 97
const fileL = (i: number): string => String.fromCharCode(97 + i)
const at = (file: number, rank: number) => `${fileL(file)}${rank}` as Square
const opponent = (c: PieceColor): PieceColor => (c === 'w' ? 'b' : 'w')

export const SQUARES: Square[] = (() => {
  const out: Square[] = []
  for (const r of [8, 7, 6, 5, 4, 3, 2, 1] as const)
    for (const f of 'abcdefgh' as const) out.push(`${f}${r}` as Square)
  return out
})()

export function startPosition(): Position {
  return {
    placements: { ...START },
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    ep: null
  }
}

/** Whether the piece on `from` attacks `to`: geometry and blockers only, whatever stands on `to`. */
function attacks(placements: Placements, from: Square, to: Square): boolean {
  const piece = placements[from]
  if (!piece || from === to) return false
  const df = fileI(to) - fileI(from)
  const dr = +to[1] - +from[1]
  const adf = Math.abs(df)
  const adr = Math.abs(dr)

  switch (piece[1]) {
    case 'P':
      return adf === 1 && dr === (piece[0] === 'w' ? 1 : -1)
    case 'N':
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1)
    case 'K':
      return adf <= 1 && adr <= 1
    default: {
      const straight = df === 0 || dr === 0
      const diag = adf === adr
      if (piece[1] === 'R' && !straight) return false
      if (piece[1] === 'B' && !diag) return false
      if (piece[1] === 'Q' && !straight && !diag) return false
      const sf = Math.sign(df)
      const sr = Math.sign(dr)
      for (let i = 1; i < Math.max(adf, adr); i++) {
        if (placements[at(fileI(from) + sf * i, +from[1] + sr * i)]) return false
      }
      return true
    }
  }
}

function isAttacked(placements: Placements, sq: Square, by: PieceColor): boolean {
  return (Object.keys(placements) as Square[]).some(
    (from) => placements[from]?.[0] === by && attacks(placements, from, sq)
  )
}

function inCheck(placements: Placements, color: PieceColor): boolean {
  const king = (Object.keys(placements) as Square[]).find((sq) => placements[sq] === `${color}K`)
  // the king may have been taken off the board by hand — then nothing is in check
  return king !== undefined && isAttacked(placements, king, opponent(color))
}

function canCastle(pos: Position, from: Square, color: PieceColor, side: 'K' | 'Q'): boolean {
  const { placements } = pos
  const rank = color === 'w' ? 1 : 8
  if (!pos.castling[`${color}${side}` as const] || from !== at(4, rank)) return false
  if (placements[at(side === 'K' ? 7 : 0, rank)] !== `${color}R`) return false
  const between = side === 'K' ? [5, 6] : [1, 2, 3]
  if (between.some((f) => placements[at(f, rank)])) return false
  // the king may not castle out of, through, or into check
  const path = side === 'K' ? [4, 5, 6] : [4, 3, 2]
  return !path.some((f) => isAttacked(placements, at(f, rank), opponent(color)))
}

/** Movement rules, castling rights and en passant — but may still leave the mover's king in check. */
function pseudoLegal(pos: Position, from: Square, to: Square): boolean {
  const { placements } = pos
  const piece = placements[from]
  if (!piece || from === to) return false
  const color = piece[0] as PieceColor
  const occupant = placements[to]
  if (occupant && occupant[0] === color) return false
  const df = fileI(to) - fileI(from)
  const dr = +to[1] - +from[1]

  if (piece[1] === 'P') {
    const fwd = color === 'w' ? 1 : -1
    if (df === 0 && !occupant) {
      if (dr === fwd) return true
      return dr === 2 * fwd && +from[1] === (color === 'w' ? 2 : 7) && !placements[at(fileI(from), +from[1] + fwd)]
    }
    return Math.abs(df) === 1 && dr === fwd && (!!occupant || to === pos.ep)
  }
  if (piece[1] === 'K' && dr === 0 && Math.abs(df) === 2) return canCastle(pos, from, color, df > 0 ? 'K' : 'Q')
  return attacks(placements, from, to)
}

/** Whether the side to move may legally play `from`→`to` (castling = king moves two squares). */
export function canMove(pos: Position, from: Square, to: Square): boolean {
  const piece = pos.placements[from]
  if (!piece || piece[0] !== pos.turn || !pseudoLegal(pos, from, to)) return false
  return !inCheck(applyMove(pos, from, to).placements, pos.turn)
}

const CASTLING_SQUARES: Partial<Record<Square, (keyof CastlingRights)[]>> = {
  e1: ['wK', 'wQ'], h1: ['wK'], a1: ['wQ'],
  e8: ['bK', 'bQ'], h8: ['bK'], a8: ['bQ']
}

/** A king or rook leaving its home square — or being captured or removed there — ends those rights. */
export function revokeCastling(rights: CastlingRights, ...squares: Square[]): CastlingRights {
  const out = { ...rights }
  for (const sq of squares) for (const key of CASTLING_SQUARES[sq] ?? []) out[key] = false
  return out
}

/** Plays a move (validate it with canMove first); a pawn reaching the last rank becomes `promo`. */
export function applyMove(pos: Position, from: Square, to: Square, promo: PromoType = 'Q'): Position {
  const { placements } = pos
  const piece = placements[from]
  if (!piece) return pos
  const color = piece[0] as PieceColor
  const fromRank = +from[1]
  const toRank = +to[1]
  const next: Placements = { ...placements }
  delete next[from]

  // en passant: the captured pawn is beside the mover, not on the destination
  if (piece[1] === 'P' && to === pos.ep && !placements[to]) delete next[at(fileI(to), fromRank)]

  // castling: the rook travels with the king
  if (piece[1] === 'K' && Math.abs(fileI(to) - fileI(from)) === 2) {
    const [rookFrom, rookTo] = fileI(to) > fileI(from) ? [7, 5] : [0, 3]
    const rook = next[at(rookFrom, fromRank)]
    if (rook) {
      next[at(rookTo, fromRank)] = rook
      delete next[at(rookFrom, fromRank)]
    }
  }

  next[to] = piece[1] === 'P' && (toRank === 8 || toRank === 1) ? (`${color}${promo}` as PieceKey) : piece

  return {
    placements: next,
    turn: opponent(color),
    castling: revokeCastling(pos.castling, from, to),
    ep: piece[1] === 'P' && Math.abs(toRank - fromRank) === 2 ? at(fileI(from), (fromRank + toRank) / 2) : null
  }
}
