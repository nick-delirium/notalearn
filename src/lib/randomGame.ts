import { Chess } from 'chess.js'
import type { Move } from 'chess.js'

export interface GeneratedGame {
  history: string[]
  result: string
}

const VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }

const CENTER = new Set([
  'c4', 'd4', 'e4', 'f4', 'c5', 'd5', 'e5', 'f5', 'd3', 'e3', 'd6', 'e6'
])

/**
 * Generates a plausible-looking random game. Pure random play produces
 * chaotic piece shuffling, so moves are scored with light heuristics:
 *   - develop knights/bishops early, castle when possible
 *   - keep the queen and king out of the opening
 *   - prefer central squares, real captures and checks
 *   - avoid leaving the moved piece hanging on an attacked square
 *   - discourage instant back-and-forth shuffling
 * The best-scoring move (with some noise) is played until a random target
 * length is reached or the game actually ends.
 */
export function generateGame(): GeneratedGame {
  const chess = new Chess()
  const targetPlies = 40 + Math.floor(Math.random() * 50)
  let last: { from: string; to: string } | null = null

  while (chess.history().length < targetPlies && !chess.isGameOver()) {
    const moves = chess.moves({ verbose: true })
    const ply = chess.history().length
    let best: Move | null = null
    let bestScore = -Infinity
    for (const move of moves) {
      const s = scoreMove(chess, move, ply, last)
      if (s > bestScore) {
        bestScore = s
        best = move
      }
    }
    if (!best) break
    chess.move(best)
    last = { from: best.from, to: best.to }
  }

  let result = ''
  if (chess.isCheckmate()) result = chess.turn() === 'w' ? '0-1' : '1-0'
  else if (chess.isGameOver()) result = '1/2-1/2'

  return { history: chess.history(), result }
}

function scoreMove(chess: Chess, move: Move, ply: number, last: { from: string; to: string } | null): number {
  const enemy: 'w' | 'b' = chess.turn() === 'w' ? 'b' : 'w'
  let s = Math.random() * 0.9

  if (move.captured) s += VALUES[move.captured] * (ply < 12 ? 0.5 : 1.3)
  if (move.promotion) s += 8

  const castle = move.isKingsideCastle() || move.isQueensideCastle()
  if (castle) s += ply < 24 ? 4 : 1
  if (move.piece === 'k' && !castle) s -= 3
  if (move.piece === 'q' && ply < 14) s -= 2.5
  if (CENTER.has(move.to)) s += 0.7

  const homeRank = enemy === 'w' ? '8' : '1'
  if (ply < 20 && (move.piece === 'n' || move.piece === 'b') && move.from[1] === homeRank) s += 1.6
  if (ply < 16 && move.piece === 'p' && (move.to[0] === 'a' || move.to[0] === 'h')) s -= 0.6
  if (last && move.from === last.to && move.to === last.from) s -= 2.5

  chess.move(move)
  if (chess.isCheckmate()) {
    s += 100
  } else {
    if (chess.inCheck()) s += 0.4
    const mover: 'w' | 'b' = enemy === 'w' ? 'b' : 'w'
    if (chess.isAttacked(move.to, enemy) && !chess.isAttacked(move.to, mover)) {
      s -= VALUES[move.piece] * (ply < 20 ? 1.2 : 0.8)
    }
  }
  chess.undo()

  return s
}
