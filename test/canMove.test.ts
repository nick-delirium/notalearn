/**
 * Cross-checks the hand-rolled canMove() (src/lib/moves.ts) against chess.js.
 *
 * Build: node_modules/.bin/esbuild test/canMove.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/canMove.test.cjs
 * Run:   node /tmp/canMove.test.cjs
 *
 * By-design leniency of canMove (NOT counted as bugs):
 *  - no check modeling: it may ALLOW moves that leave one's own king in check,
 *    castling while in check / through check, or even moving the king into
 *    attack. All moves are still geometrically valid for the piece.
 *  - en-passant approximation: it may ALLOW an ep-capture when the enemy pawn
 *    did not just double-step (it only checks for an adjacent enemy pawn).
 *
 * Real bugs therefore show up as:
 *  - FALSE NEGATIVE: canMove says "no" for a move chess.js accepts
 *    (breaks puzzle solvability — the user cannot make a needed move)
 *  - GEOMETRIC FALSE POSITIVE: canMove says "yes" to a move that is even
 *    geometrically impossible for the piece (not a check/ep leniency)
 */
import { Chess } from 'chess.js'
import { canMove } from '../src/lib/moves'
import { FILES } from '../src/lib/pieces'
import type { Placements, PieceKey, Square } from '../src/lib/pieces'

// ── positions ────────────────────────────────────────────────────────────
const games: string[] = [
  `1. d4 d5 2. Bf4 e5 3. Bxe5 Bb4+ 4. c3 Bd6 5. Nf3 f6 6. Qa4+ Nc6 7. Bg3 f5 8. e3
Qe7 9. Nbd2 f4 10. Bxf4 Bxf4 11. g3 Bxe3 12. fxe3 Qxe3+ 13. Be2 Qe7 14. O-O-O
Qxe2 15. Rhe1 Qe7 16. Rxe7+ Kxe7 17. Re1+ Kf8 18. Ng5 Bg4 19. Rf1+ Nf6 20. Qa3+
Ke8 21. Re1+ Kd7 22. h3 Bf5 23. g4 Nxg4 24. hxg4 Bxg4 25. Nf7 Rhf8 26. Ne5+ Kd8
27. Nxg4 Re8 28. Re3 h5 29. Rxe8+ Kxe8 30. Nh6 h4 31. Nf3 h3 32. Nf5 Ne7 33.
Qxe7# 1-0`,
  `1. e4 e5 2. Nf3 d6 3. d4 Bg4 4. dxe5 Bxf3 5. Qxf3 dxe5 6. Bc4 Nf6 7. Qb3 Qe7
8. Nc3 c6 9. Bg5 b5 10. Nxb5 cxb5 11. Bxb5+ Nbd7 12. O-O-O Rd8 13. Rxd7 Rxd7
14. Rd1 Qe6 15. Bxd7+ Nxd7 16. Qb8+ Nxb8 17. Rd8# 1-0`,
  `1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4 Bxb4 5. c3 Ba5 6. d4 exd4 7. O-O d3
8. Qb3 Qf6 9. e5 Qg6 10. Re1 Nge7 11. Ba3 b5 12. Qxb5 Rb8 13. Qa4 Bb6 14. Nbd2
Bb7 15. Ne4 Qf5 16. Bxd3 Qh5 17. Nf6+ gxf6 18. exf6 Rg8 19. Rad1 Qxf3 20. Rxe7+
Nxe7 21. Qxd7+ Kxd7 22. Bf5+ Ke8 23. Bd7+ Kf8 24. Bxe7# 1-0`,
  `1. e4 e5 2. f4 exf4 3. Bc4 Qh4+ 4. Kf1 b5 5. Bxb5 Nf6 6. Nf3 Qh6 7. d3 Nh5
8. Nh4 Qg5 9. Nf5 c6 10. g4 Nf6 11. Rg1 cxb5 12. h4 Qg6 13. h5 Qg5 14. Qf3 Ng8
15. Bxf4 Qf6 16. Nc3 Bc5 17. Nd5 Qxb2 18. Bd6 Bxg1 19. e5 Qxa1+ 20. Ke2 Na6
21. Nxg7+ Kd8 22. Qf6+ Nxf6 23. Be7# 1-0`,
  `1. e4 e5 2. Nf3 d6 3. Bc4 Bg4 4. Nc3 g6 5. Nxe5 Bxd1 6. Bxf7+ Ke7 7. Nd5# 1-0`
]

function toMap(chess: Chess): Placements {
  const m: Placements = {}
  chess.board().forEach((row, r) =>
    row.forEach((cell, f) => {
      if (cell) {
        const sq = `${FILES[f]}${8 - r}` as Square
        m[sq] = (cell.color + cell.type.toUpperCase()) as PieceKey
      }
    })
  )
  return m
}

/** Pure piece-movement pattern, ignoring blocking/check/en-passant. */
function patternAllows(piece: PieceKey, from: Square, to: Square): boolean {
  if (from === to) return false
  const df = to.charCodeAt(0) - from.charCodeAt(0)
  const dr = +to[1] - +from[1]
  const adf = Math.abs(df)
  const adr = Math.abs(dr)
  switch (piece[1]) {
    case 'P':
      if (adf === 0) return dr === 1 || dr === -1 || (dr === 2 && +from[1] === 2) || (dr === -2 && +from[1] === 7)
      return adf === 1 && (dr === 1 || dr === -1)
    case 'N':
      return (adf === 1 && adr === 2) || (adf === 2 && adr === 1)
    case 'K':
      return (adf <= 1 && adr <= 1) || (adr === 0 && adf === 2)
    case 'R':
      return df === 0 || dr === 0
    case 'B':
      return adf === adr
    case 'Q':
      return df === 0 || dr === 0 || adf === adr
  }
  return false
}

// ── comparison ───────────────────────────────────────────────────────────
const positionsChecked = { n: 0 }
const problems: string[] = []
let lenient = 0

function checkPosition(fen: string, where: string): void {
  positionsChecked.n++
  const chess = new Chess(fen)
  const placements = toMap(chess)
  const turn = chess.turn()
  const legal = new Map<string, string>() // from>to → san
  for (const m of chess.moves({ verbose: true })) legal.set(`${m.from}>${m.to}`, m.san)

  for (const sq of Object.keys(placements) as Square[]) {
    const piece = placements[sq]!
    if (piece[0] !== turn) continue
    for (let r = 8; r >= 1; r--) {
      for (const f of 'abcdefgh') {
        const to = `${f}${r}` as Square
        if (to === sq) continue
        const legalHere = legal.has(`${sq}>${to}`)
        const cm = canMove(placements, sq, to)
        if (legalHere && !cm) {
          problems.push(`FALSE NEGATIVE @ ${where} [${chess.fen()}] ${sq}>${to} ${legal.get(`${sq}>${to}`)} — chess.js legal, canMove rejects`)
        } else if (!legalHere && cm) {
          if (!patternAllows(piece, sq, to)) {
            problems.push(`GEOMETRIC FALSE POSITIVE @ ${where} [${chess.fen()}] ${sq}>${to} — ${piece} cannot move there at all`)
          } else {
            lenient++ // expected: check/ep-approximation leniency
          }
        }
      }
    }
  }
}

// 1) every intermediate position of every curated game
for (let gi = 0; gi < games.length; gi++) {
  const c = new Chess()
  c.loadPgn(games[gi])
  const hist = c.history()
  const walk = new Chess()
  for (let i = 0; i < hist.length; i++) {
    walk.move(hist[i])
    checkPosition(walk.fen(), `game${gi + 1} after ${i + 1} plies (${hist[i]})`)
  }
}

// 2) random-play positions (exercises middlegames, promotions, weird kings)
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
for (let g = 0; g < 150; g++) {
  const c = new Chess(START)
  const plies = 20 + Math.floor(Math.random() * 30)
  for (let i = 0; i < plies; i++) {
    const moves = c.moves({ verbose: true })
    if (!moves.length) break
    c.move(moves[Math.floor(Math.random() * moves.length)])
    if (i % 3 === 0) checkPosition(c.fen(), `random-${g} ply ${i + 1}`)
  }
}

// 3) handcrafted edge cases
// ep-just: black pawn f7-f5 just played → e5xf6 e.p. is legal (FEN ep-square = f6)
checkPosition('rnbqkbnr/ppp2ppp/8/4Pp2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 1', 'ep-just (ep is legal here)')
// ep-stale: identical geometry but the ep flag is absent → e5xf6 is NOT legal;
// canMove's documented approximation will still allow it (counted as leniency)
checkPosition('rnbqkbnr/ppp2ppp/8/4Pp2/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 2 14', 'ep-stale (ep NOT legal here; approximation may allow it)')
checkPosition('r3k3/8/8/8/8/8/R3K3/8 w - - 0 1', 'bare kings + rook')
checkPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'start position')
checkPosition('8/PPP4P/8/8/8/8/8/4K2k w - - 0 1', 'pawn promotions')

console.log('== cross-check canMove vs chess.js ==')
console.log(`positions checked: ${positionsChecked.n}`)
console.log(`documented-lenient extras (check modeling / ep approximation): ${lenient}`)
if (problems.length) {
  console.log(`\nBUGS FOUND: ${problems.length}`)
  for (const p of problems) console.log('  - ' + p)
  process.exit(1)
} else {
  console.log('RESULT: PASS — no geometric disagreements with chess.js')
}
