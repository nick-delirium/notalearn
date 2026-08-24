<script lang="ts">
  import Board from './Board.svelte'
  import { START, GLYPHS } from './pieces'
  import { SQUARES, canMove } from './moves'
  import type { PieceKey, Placements, Square } from './pieces'

  interface Props {
    target: Placements
    score?: number
    wrongSquares?: Square[]
    canUndo?: boolean
    hinted?: Square | null
  }

  let {
    target,
    score = $bindable(0),
    wrongSquares = $bindable([]),
    canUndo = $bindable(false),
    hinted = null
  }: Props = $props()

  interface Snapshot {
    p: Placements
    t: number
  }

  let placements = $state<Placements>({ ...START })
  let ply = $state(0)
  let selected = $state<Square | null>(null)
  let invalidSq = $state<Square | null>(null)
  let pendingPromo = $state<{ from: Square; to: Square } | null>(null)
  let dragged: Square | null = null
  let undoStack = $state<Snapshot[]>([])
  let invalidTimer: ReturnType<typeof setTimeout> | undefined
  let lastDrop = 0

  const turn = $derived(ply % 2 === 0 ? ('w' as const) : ('b' as const))
  const correct = $derived(
    (Object.keys(target) as Square[]).reduce((n, sq) => n + (placements[sq] === target[sq] ? 1 : 0), 0)
  )
  const mistakes = $derived(
    (Object.keys(target) as Square[]).filter((sq) => placements[sq] !== target[sq])
  )
  const legalTargets = $derived.by(() => {
    const sel = selected
    if (!sel || placements[sel]?.[0] !== turn) return []
    return SQUARES.filter((sq) => canMove(placements, sel, sq))
  })

  $effect(() => { score = correct })
  $effect(() => { wrongSquares = mistakes })
  $effect(() => { canUndo = undoStack.length > 0 })
  $effect(() => () => clearTimeout(invalidTimer))

  function snapshot(): void {
    undoStack.push({ p: placements, t: ply })
    if (undoStack.length > 300) undoStack.shift()
  }

  function flashInvalid(sq: Square): void {
    clearTimeout(invalidTimer)
    invalidSq = null
    invalidSq = sq
    invalidTimer = setTimeout(() => (invalidSq = null), 550)
  }

  /** Dropping the king on its own rook is treated as a castling attempt. */
  function normalizeCastleTarget(from: Square, to: Square): Square {
    const piece = placements[from]
    const rook = placements[to]
    if (piece?.[1] === 'K' && rook && rook[0] === piece[0] && rook[1] === 'R') {
      if (to[0] === 'h') return `g${from[1]}` as Square
      if (to[0] === 'a') return `c${from[1]}` as Square
    }
    return to
  }

  function attemptMove(from: Square, to: Square, promoType: 'Q' | 'R' | 'B' | 'N' | null = null): void {
    const piece = placements[from]
    if (!piece) return
    to = normalizeCastleTarget(from, to)
    if (piece[0] !== turn || !canMove(placements, from, to)) {
      flashInvalid(to)
      return
    }
    const destRank = +to[1]
    if (piece[1] === 'P' && (destRank === 8 || destRank === 1) && !promoType) {
      pendingPromo = { from, to }
      return
    }
    snapshot()
    const next: Placements = { ...placements }
    delete next[from]
    next[to] = promoType ? (piece[0] + promoType as PieceKey) : piece

    // castling: the rook travels with the king
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

    // en passant: the captured pawn is not on the destination square
    if (piece[1] === 'P' && from[0] !== to[0] && !placements[to]) {
      delete next[`${to[0]}${from[1]}` as Square]
    }

    placements = next
    ply += 1
    selected = null
    pendingPromo = null
  }

  function choosePromo(type: 'Q' | 'R' | 'B' | 'N'): void {
    if (!pendingPromo) return
    attemptMove(pendingPromo.from, pendingPromo.to, type)
  }

  function cancelPromo(): void {
    pendingPromo = null
  }

  function clickSquare(sq: Square): void {
    if (Date.now() - lastDrop < 250 || pendingPromo) return
    const occ = placements[sq]
    const sel = selected
    // king onto own rook = castling attempt
    if (sel && occ && occ[0] === turn && placements[sel]?.[1] === 'K' && occ[1] === 'R') {
      attemptMove(sel, sq)
      return
    }
    if (occ && occ[0] === turn) {
      selected = sel === sq ? null : sq
    } else if (sel) {
      attemptMove(sel, sq)
    } else {
      flashInvalid(sq)
    }
  }

  function takeOffBoard(): void {
    if (!selected) return
    snapshot()
    const next: Placements = { ...placements }
    delete next[selected]
    placements = next
    selected = null
  }

  export function undo(): void {
    const prev = undoStack.pop()
    if (!prev) return
    placements = prev.p
    ply = prev.t
    selected = null
    pendingPromo = null
  }

  function dragStart(sq: Square): void {
    dragged = sq
    selected = sq
  }
  function dropOn(sq: Square, event: DragEvent): void {
    event.preventDefault()
    lastDrop = Date.now()
    if (dragged && dragged !== sq) attemptMove(dragged, sq)
    dragged = null
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      selected = null
      pendingPromo = null
    }
  }

  const PROMO_TYPES = ['Q', 'R', 'B', 'N'] as const
</script>

<svelte:window onkeydown={onKeydown} />

<Board
  {placements}
  {target}
  mode="easy"
  {selected}
  {legalTargets}
  invalid={invalidSq}
  {hinted}
  onsquareclick={clickSquare}
  ondragstart={dragStart}
  ondrop={dropOn}
>
  <div class="under-board">
    <span class="ub-turn {turn}">{turn === 'w' ? 'White' : 'Black'} to move</span>
    {#if pendingPromo}
      <span class="ub-info">Promote to:</span>
      <div class="promo">
        {#each PROMO_TYPES as t}
          <button onclick={() => choosePromo(t)} aria-label={'Promote to ' + t}>
            <span class="piece {turn}">{GLYPHS[(turn + t) as PieceKey]}</span>
          </button>
        {/each}
        <button class="promo-cancel" onclick={cancelPromo} aria-label="Cancel promotion">✕</button>
      </div>
    {:else if selected}
      <span class="ub-info"><b>{selected}</b> — click a dotted square to move</span>
      <button class="action ub-remove" onclick={takeOffBoard}>Take off board ✕</button>
    {:else}
      <span class="ub-info dim">Click a piece to see its legal moves · drag or click-click to move</span>
    {/if}
  </div>
</Board>
