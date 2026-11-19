<script lang="ts">
  import Board from './Board.svelte'
  import SolvedBar from './SolvedBar.svelte'
  import Icon from './Icon.svelte'
  import { GLYPHS, NAMES } from './pieces'
  import { COARSE, click } from './input'
  import { SQUARES, applyMove, canMove, positionKey, revokeCastling, startPosition } from './moves'
  import type { Position, PromoType } from './moves'
  import type { PieceKey, Placements, Square } from './pieces'

  interface Props {
    target: Placements
    score?: number
    wrongSquares?: Square[]
    canUndo?: boolean
    hinted?: Square | null
    solved?: boolean
    onnext: () => void
    /** positionKey after each half-move of the game line, from the start */
    lineKeys: string[]
    /** half-moves replayed along the line, or null once the position leaves it */
    progress?: number | null
  }

  let {
    target,
    score = $bindable(0),
    wrongSquares = $bindable([]),
    canUndo = $bindable(false),
    hinted = null,
    solved = false,
    onnext,
    lineKeys,
    progress = $bindable(null)
  }: Props = $props()

  // positions are immutable values — every change assigns a new one — so raw state suffices
  let position = $state.raw<Position>(startPosition())
  let undoStack = $state.raw<Position[]>([])
  let selected = $state<Square | null>(null)
  let invalidSq = $state<Square | null>(null)
  let pendingPromo = $state<{ from: Square; to: Square } | null>(null)
  let dragged: Square | null = null
  let invalidTimer: ReturnType<typeof setTimeout> | undefined
  let lastDrop = 0

  const placements = $derived(position.placements)
  const turn = $derived(position.turn)
  const correct = $derived(
    (Object.keys(target) as Square[]).reduce((n, sq) => n + (placements[sq] === target[sq] ? 1 : 0), 0)
  )
  const mistakes = $derived(
    (Object.keys(target) as Square[]).filter((sq) => placements[sq] !== target[sq])
  )
  const legalTargets = $derived.by(() => {
    const sel = selected
    if (!sel || placements[sel]?.[0] !== turn) return []
    return SQUARES.filter((sq) => canMove(position, sel, sq))
  })

  $effect(() => { score = correct })
  $effect(() => { wrongSquares = mistakes })
  $effect(() => { canUndo = undoStack.length > 0 })
  // on the line = same pieces and side to move as the game after the same number
  // of half-moves (transpositions count; a hand-removed piece takes you off it)
  $effect(() => {
    progress = lineKeys[position.plies] === positionKey(placements, turn) ? position.plies : null
  })
  $effect(() => () => clearTimeout(invalidTimer))

  function snapshot(): void {
    undoStack = [...undoStack.slice(-299), position]
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

  function attemptMove(from: Square, to: Square, promoType: PromoType | null = null): void {
    const piece = placements[from]
    if (!piece) return
    to = normalizeCastleTarget(from, to)
    if (!canMove(position, from, to)) {
      flashInvalid(to)
      return
    }
    if (piece[1] === 'P' && (to[1] === '8' || to[1] === '1') && !promoType) {
      pendingPromo = { from, to }
      return
    }
    snapshot()
    position = applyMove(position, from, to, promoType ?? 'Q')
    selected = null
    pendingPromo = null
  }

  function choosePromo(type: PromoType): void {
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
    const sq = selected
    if (!sq) return
    snapshot()
    const next: Placements = { ...placements }
    delete next[sq]
    position = { ...position, placements: next, castling: revokeCastling(position.castling, sq) }
    selected = null
  }

  export function undo(): void {
    const prev = undoStack.at(-1)
    if (!prev) return
    undoStack = undoStack.slice(0, -1)
    position = prev
    selected = null
    pendingPromo = null
  }

  function dragStart(sq: Square, event: DragEvent): void {
    // same rule as clicking: only the side to move can pick a piece up
    if (pendingPromo || placements[sq]?.[0] !== turn) {
      event.preventDefault()
      return
    }
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
  {solved}
  onsquareclick={clickSquare}
  ondragstart={dragStart}
  ondrop={dropOn}
>
  {#if solved}
    <SolvedBar {onnext} />
  {:else}
  <div class="under-board">
    <span class="ub-turn {turn}">{turn === 'w' ? 'White' : 'Black'} to move</span>
    {#if pendingPromo}
      <span class="ub-info">Promote to:</span>
      <div class="promo">
        {#each PROMO_TYPES as t}
          {@const key = (turn + t) as PieceKey}
          <button onclick={() => choosePromo(t)} aria-label={`Promote to ${NAMES[key].split(' ')[1]}`}>
            <span class="piece {turn === 'w' ? 'white' : 'black'}">{GLYPHS[key]}</span>
          </button>
        {/each}
        <button class="promo-cancel" onclick={cancelPromo} aria-label="Cancel promotion"><Icon name="x" size={15} /></button>
      </div>
    {:else if selected}
      <span class="ub-info"><b>{selected}</b> — {click} a dotted square to move</span>
      <button class="action ub-remove" onclick={takeOffBoard}>Take off board <Icon name="x" size={14} /></button>
    {:else}
      <span class="ub-info dim">{COARSE
        ? 'Tap a piece to see its legal moves, then tap where it goes'
        : 'Click a piece to see its legal moves · drag or click-click to move'}</span>
    {/if}
  </div>
  {/if}
</Board>
