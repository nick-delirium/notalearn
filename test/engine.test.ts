/**
 * Verifies EasyMode's move ENGINE (the bookkeeping in EasyMode.svelte's
 * attemptMove / normalizeCastleTarget) against chess.js: replay moves through
 * a faithful mirror of the engine and compare resulting boards.
 *
 * Build: node_modules/.bin/esbuild test/engine.test.ts --bundle --platform=node --format=cjs --outfile=/tmp/engine.test.cjs
 * Run:   node /tmp/engine.test.cjs
 */
import { Chess } from 'chess.js'
import { canMove } from '../src/lib/moves'
import { FILES, START } from '../src/lib/pieces'
import type { Placements, PieceKey, Square } from '../src/lib/pieces'

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

// ── faithful mirror of EasyMode.svelte engine ─────────────────────────────
// (copied expression-for-expression from attemptMove + normalizeCastleTarget)
function normalizeCastleTarget(placements: Placements, from: Square, to: Square): Square {
  const piece = placements[from]
  const rook = placements[to]
  if (piece?.[1] === 'K' && rook && rook[0] === piece[0] && rook[1] === 'R') {
    if (to[0] === 'h') return `g${from[1]}` as Square
    if (to[0] === 'a') return `c${from[1]}` as Square
  }
  return to
}

function engineMove(placements: Placements, from: Square, to: Square, promoType: 'Q' | 'R' | 'B' | 'N' | null = null): Placements | null {
  const piece = placements[from]
  if (!piece) return null
  to = normalizeCastleTarget(placements, from, to)
  if (!canMove(placements, from, to)) return null
  const next: Placements = { ...placements }
  delete next[from]
  next[to] = promoType ? (piece[0] + promoType as PieceKey) : piece

  if (piece[1] === 'K' && from[1] === to[1] && Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2) {
    const rank = from[1]
    if (to[0] === 'g') {
      const rook = placements[`h${rank}` as Square]
      if (rook) {
        next[`f${rank}` as Square] = rook
        delete next[`h${rank}` as Square]
      }
    } else if (to[0] === 'c') {
      const rook = placements[`a${rank}` as Square]
      if (rook) {
        next[`d${rank}` as Square] = rook
        delete next[`a${rank}` as Square]
      }
    }
  }

  if (piece[1] === 'P' && from[0] !== to[0] && !placements[to]) {
    delete next[`${to[0]}${from[1]}` as Square]
  }

  return next
}

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

function sameBoard(a: Placements, b: Placements): boolean {
  return Object.keys(a).length === Object.keys(b).length && Object.entries(b).every(([sq, pk]) => a[sq as Square] === pk)
}

let failures = 0
function scenario(name: string, fen: string, sans: string[]) {
  const fen2 = fen === 'start' ? START_FEN : fen
  const chess = new Chess(fen2)
  let placements: Placements = toMap(chess)
  let ok = true
  for (const san of sans) {
    const mv = chess.move(san) // throws if SAN is illegal
    placements = engineMove(placements, mv.from as Square, mv.to as Square, mv.promotion ? (mv.promotion.toUpperCase() as 'Q' | 'R' | 'B' | 'N') : null) ?? {}
    const want = toMap(chess)
    if (!sameBoard(placements, want)) {
      ok = false
      failures++
      console.log(`FAIL: ${name} after ${san}`)
      console.log(`  engine:   ${JSON.stringify(placements)}`)
      console.log(`  chess.js: ${JSON.stringify(want)}`)
    }
  }
  if (ok) console.log(`ok: ${name}`)
}

// ── targeted scenarios: every engine bookkeeping path ──────────────────────
scenario('white kingside castle (Ruy Lopez)', 'start', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O'])
scenario('black kingside castle (Ruy Lopez)', 'start', ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O'])
scenario('white queenside castle + black kingside castle', 'start', ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Bb4', 'cxd5', 'exd5', 'Qa4+', 'Nc6', 'Bf4', 'Nf6', 'O-O-O', 'a6', 'Qb3', 'O-O'])
scenario('black queenside castle', 'r3k2r/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 2 3', ['O-O-O', 'a3', 'a5'])
// ep-just: black pawn f7-f5 just played → e5xf6 e.p. is legal (FEN ep-square = f6)
scenario('en passant white captures', 'rnbqkbnr/ppppp1pp/8/4Pp2/8/8/PPP1PPPP/RNBQKBNR w KQkq f6 0 3', ['exf6'])
// white pawn f2-f4 just played → e4xf3 e.p. is legal (FEN ep-square = f3)
scenario('en passant black captures', 'rnbqkbnr/pppppppp/8/8/2B1pP2/5N2/PPPP1PPP/R1BQKB1R b KQkq f3 0 3', ['exf3'])
scenario('pawn capture (not ep)', '8/8/8/3p4/4P3/8/8/4K2k w - - 0 1', ['exd5', 'Kg2', 'd6'])
scenario('promotion to queen', '8/P7/8/8/8/8/8/4K2k w - - 0 1', ['a8=Q'])
scenario('promotion capture', '1r5k/P7/8/8/8/8/8/K7 w - - 0 1', ['axb8=Q'])
scenario('promotion to knight', '8/P7/8/8/8/8/8/4K2k w - - 0 1', ['a8=N'])
scenario('promo + captures', '8/P2k4/8/8/8/8/1r6/4K2R w - - 0 1', ['a8=Q', 'Ra2', 'Qxa2', 'Kc6', 'Qa8', 'Kd6'])

// UI drag path: king is dropped on its own rook's square (h1); engine must
// normalize to g1 and castle (mirror of clickSquare/dropOn + normalizeCastleTarget)
{
  const chessBoard = new Chess('r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 5')
  let placements = toMap(chessBoard)
  placements = engineMove(placements, 'e1' as Square, 'h1' as Square) ?? {}
  chessBoard.move('O-O')
  const want = toMap(chessBoard)
  if (sameBoard(placements, want)) console.log('ok: castling via rook square (UI drag path)')
  else {
    failures++
    console.log('FAIL: castling via rook square (UI drag path)')
    console.log(`  engine:   ${JSON.stringify(placements)}`)
    console.log(`  chess.js: ${JSON.stringify(want)}`)
  }
}

// ── randomized full games replayed through the engine ──────────────────────
let randomOk = true
for (let g = 0; g < 400; g++) {
  const chess = new Chess()
  let placements: Placements = { ...START }
  const plies = 30 + Math.floor(Math.random() * 30)
  for (let i = 0; i < plies; i++) {
    const moves = chess.moves({ verbose: true })
    if (!moves.length) break
    // bias toward interesting moves: castles, ep, promos, captures, checks
    const interesting = moves.filter((m) => m.san.includes('+') || m.san.includes('#') || m.captured || m.promotion || m.san.startsWith('O-O'))
    const pool = interesting.length && Math.random() < 0.7 ? interesting : moves
    const mv = chess.move(pool[Math.floor(Math.random() * pool.length)])
    placements = engineMove(placements, mv.from as Square, mv.to as Square, mv.promotion ? (mv.promotion.toUpperCase() as 'Q' | 'R' | 'B' | 'N') : null) ?? {}
    if (!sameBoard(placements, toMap(chess))) {
      randomOk = false
      failures++
      console.log(`FAIL: random-${g} ply ${i + 1} (${mv.san}) fen=${chess.fen()}`)
      console.log(`  engine:   ${JSON.stringify(placements)}`)
      console.log(`  chess.js: ${JSON.stringify(toMap(chess))}`)
      break
    }
  }
}
console.log(randomOk ? 'ok: 400 randomized games replayed through engine' : 'randomized replay FAILED')

console.log(failures === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${failures})`)
process.exit(failures === 0 ? 0 : 1)
