<script lang="ts">
  import Board from './Board.svelte'
  import { GLYPHS, PALETTE } from './pieces'
  import { positionPicker } from './positionPicker'
  import type { PieceKey, Placements, Square } from './pieces'

  interface Props {
    target: Placements
    difficulty: 'medium' | 'hard'
    score?: number
    wrongSquares?: Square[]
    strays?: number
    hinted?: Square | null
  }

  let {
    target,
    difficulty,
    score = $bindable(0),
    wrongSquares = $bindable([]),
    strays = $bindable(0),
    hinted = null
  }: Props = $props()

  let guesses = $state<Placements>({})
  let selected = $state<Square | null>(null)

  const correct = $derived(
    (Object.keys(target) as Square[]).reduce((n, sq) => n + (guesses[sq] === target[sq] ? 1 : 0), 0)
  )
  const mistakes = $derived((Object.keys(target) as Square[]).filter((sq) => guesses[sq] !== target[sq]))
  const straysCount = $derived((Object.keys(guesses) as Square[]).filter((sq) => !(sq in target)).length)

  $effect(() => { score = correct })
  $effect(() => { wrongSquares = mistakes })
  $effect(() => { strays = straysCount })

  function status(sq: Square): '' | 'correct' | 'wrong' {
    if (!guesses[sq]) return ''
    return guesses[sq] === target[sq] ? 'correct' : 'wrong'
  }

  function clickSquare(sq: Square): void {
    if (difficulty === 'medium' && !target[sq]) return
    selected = selected === sq ? null : sq
  }

  function pickPiece(piece: PieceKey): void {
    if (!selected) return
    const next: Placements = { ...guesses }
    if (next[selected] === piece) delete next[selected]
    else next[selected] = piece
    guesses = next
    selected = null
  }

  function clearSquare(): void {
    if (!selected) return
    const next: Placements = { ...guesses }
    delete next[selected]
    guesses = next
    selected = null
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') selected = null
  }
</script>

<svelte:window onkeydown={onKeydown} />

<Board
  placements={guesses}
  {target}
  mode={difficulty}
  {selected}
  {hinted}
  onsquareclick={clickSquare}
  ondragstart={() => {}}
  ondrop={() => {}}
>
  {#if selected}
    {#key selected}
      <div class="picker" use:positionPicker={selected}>
        <div class="picker-head">
          <span>Place on {selected}</span>
          <button class="clear" onclick={clearSquare} aria-label="Remove piece">Remove ✕</button>
        </div>
        <div class="picker-grid">
          {#each PALETTE as p}
            <button
              class:picked={guesses[selected] === p}
              onclick={() => pickPiece(p)}
              aria-label={p}
            ><span class="piece {p[0] === 'w' ? 'white' : 'black'}">{GLYPHS[p]}</span></button>
          {/each}
        </div>
      </div>
    {/key}
  {/if}
</Board>
