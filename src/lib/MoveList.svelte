<script lang="ts">
  import type { Action } from 'svelte/action'

  interface Props {
    /** SAN of every half-move shown */
    line: string[]
    variant?: 'sheet' | 'strip'
    /** easy mode: highlight progress through the line */
    tracking?: boolean
    /** half-moves the player has replayed along the line; null = off the line */
    progress?: number | null
    /** the line runs to the game's end, so the result (if any) follows it */
    complete?: boolean
    result?: string
  }

  let { line, variant = 'sheet', tracking = false, progress = null, complete = false, result = '' }: Props = $props()

  const pairs = $derived.by(() => {
    const out: { n: number; w: number; b: number | null }[] = []
    for (let i = 0; i < line.length; i += 2) out.push({ n: i / 2 + 1, w: i, b: i + 1 < line.length ? i + 1 : null })
    return out
  })

  const played = (i: number) => tracking && progress !== null && i < progress
  const isNext = (i: number) => tracking && progress !== null && i === progress

  // the move to keep in view: the next one to play while tracking; the strip
  // otherwise shows the end (the position's last move); the sheet stays put
  const focus = $derived(
    tracking
      ? progress !== null ? Math.min(progress, line.length - 1) : null
      : variant === 'strip' ? line.length - 1 : null
  )

  /** Scrolls only this container — never the page — to center move `index`. */
  const keepInView: Action<HTMLElement, number | null> = (node, index) => {
    const scroll = (i: number | null, behavior: ScrollBehavior) => {
      if (i === null) return
      const el = node.querySelectorAll<HTMLElement>('.san')[i]
      if (!el) return
      const nb = node.getBoundingClientRect()
      const eb = el.getBoundingClientRect()
      node.scrollTo({
        left: node.scrollLeft + eb.left - nb.left - (node.clientWidth - eb.width) / 2,
        top: node.scrollTop + eb.top - nb.top - (node.clientHeight - eb.height) / 2,
        behavior
      })
    }
    requestAnimationFrame(() => scroll(index, 'instant'))
    return { update: (i) => scroll(i, 'smooth') }
  }
</script>

{#snippet san(i: number)}
  <span class="san" class:played={played(i)} class:next={isNext(i)} class:last={i === line.length - 1}
    aria-current={isNext(i) ? 'step' : undefined}>{line[i]}</span>
{/snippet}

<div class="moves-wrap {variant}">
  <div class="moves {variant}" aria-label="Game notation" use:keepInView={focus}>
    {#each pairs as p (p.n)}
      <span class="pair">
        <span class="mnum">{p.n}.</span>{@render san(p.w)}{#if p.b !== null}{@render san(p.b)}{/if}
      </span>
    {/each}
    {#if complete && result}<span class="result">{result}</span>
    {:else if !complete}<span class="more">…</span>{/if}
  </div>
  {#if tracking && progress === null}
    <p class="off-line">This position isn't on the game's line — undo back to it.</p>
  {/if}
</div>
