<script lang="ts">
  import type { Snippet } from 'svelte'
  import { GLYPHS, NAMES, FILES, RANKS } from './pieces'
  import type { Placements, Square } from './pieces'

  interface Props {
    placements: Placements
    target: Placements
    mode: 'easy' | 'medium' | 'hard'
    selected?: Square | null
    hinted?: Square | null
    legalTargets?: Square[]
    invalid?: Square | null
    onsquareclick: (sq: Square) => void
    ondragstart: (sq: Square) => void
    ondrop: (sq: Square, e: DragEvent) => void
    children?: Snippet
  }

  let {
    placements,
    target,
    mode,
    selected = null,
    hinted = null,
    legalTargets = [],
    invalid = null,
    onsquareclick,
    ondragstart,
    ondrop,
    children
  }: Props = $props()

  function status(sq: Square): '' | 'correct' | 'wrong' {
    if (!placements[sq]) return ''
    return placements[sq] === target[sq] ? 'correct' : 'wrong'
  }
</script>

<div class="board-side">
  <div class="board-frame">
    <div class="coords files">{#each FILES as f}<span>{f}</span>{/each}</div>
    <div class="coords ranks">{#each RANKS as r}<span>{r}</span>{/each}</div>
    <div class="board" aria-label="Interactive chess board">
      {#each RANKS as rank}
        {#each FILES as file}
          {@const sq = `${file}${rank}` as Square}
          <button
            class="square {(RANKS.indexOf(rank) + FILES.indexOf(file)) % 2 === 0 ? 'light' : 'dark'}"
            class:selected={selected === sq}
            class:hinted={hinted === sq}
            class:invalid={invalid === sq}
            class:movable={mode === 'easy' && placements[sq]}
            onclick={() => onsquareclick(sq)}
            ondragover={(e) => e.preventDefault()}
            ondrop={(e) => ondrop(sq, e)}
            aria-label={placements[sq] ? `${NAMES[placements[sq]]} on ${sq}` : sq}
          >
            {#if hinted === sq && placements[sq] !== target[sq] && target[sq]}
              <span class="ghost {target[sq][0] === 'w' ? 'white' : 'black'}">{GLYPHS[target[sq]]}</span>
            {/if}
            {#if legalTargets.includes(sq)}
              <span class="move-hint" class:capture={!!placements[sq]}></span>
            {/if}
            {#if placements[sq]}
              <span
                role="img"
                aria-label="chess piece"
                class="piece {placements[sq][0] === 'w' ? 'white' : 'black'}"
                draggable={mode === 'easy'}
                ondragstart={() => ondragstart(sq)}
              >{GLYPHS[placements[sq]]}</span>
              {#if mode !== 'easy'}
                <span class="mark {status(sq)}">{status(sq) === 'correct' ? '✓' : '✕'}</span>
              {/if}
            {:else if mode === 'medium' && target[sq]}
              <span class="unknown">?</span>
            {/if}
          </button>
        {/each}
      {/each}
    </div>
  </div>
  {@render children?.()}
</div>
