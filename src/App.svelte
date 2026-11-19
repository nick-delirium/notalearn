<script lang="ts">
  import { Chess } from 'chess.js'
  import games from './pgns'
  import EasyMode from './lib/EasyMode.svelte'
  import RecallMode from './lib/RecallMode.svelte'
  import MoveList from './lib/MoveList.svelte'
  import Icon from './lib/Icon.svelte'
  import { swUpdate } from './lib/swUpdate.svelte'
  import { generateGame } from './lib/randomGame'
  import { positionKey } from './lib/moves'
  import { Click, click } from './lib/input'
  import { FILES } from './lib/pieces'
  import type { PieceKey, Placements, Square } from './lib/pieces'

  type Difficulty = 'easy' | 'medium' | 'hard'
  type Phase = 'opening' | 'half' | 'full' | 'random'

  interface DifficultyDef {
    id: Difficulty
    label: string
    hint: string
  }
  interface PhaseDef {
    id: Phase
    label: string
  }

  const DIFFICULTIES: DifficultyDef[] = [
    { id: 'easy', label: 'Easy', hint: `Replay the game move by move — ${click} a piece, then one of its dotted squares. The move to play next is highlighted in the notation.` },
    { id: 'medium', label: 'Medium', hint: `Every piece is hidden. ${Click} a “?” square, then pick the piece you think stands there.` },
    { id: 'hard', label: 'Hard', hint: `The board is empty. ${Click} any square, then pick the piece that belongs there.` }
  ]
  const PHASES: PhaseDef[] = [
    { id: 'opening', label: 'Opening' },
    { id: 'half', label: 'Half game' },
    { id: 'full', label: 'Full game' },
    { id: 'random', label: 'Random' }
  ]

  const GENERATED_CHANCE = 0.4

  let difficulty = $state<Difficulty>('easy')
  let phase = $state<Phase>('random')
  let target = $state<Placements>({})
  /** SAN of each half-move leading to the target position */
  let line = $state<string[]>([])
  /** positionKey before the first and after every half-move of `line` */
  let lineKeys = $state<string[]>([])
  /** easy mode: half-moves replayed along the line (null = off it) */
  let progress = $state<number | null>(null)
  let result = $state('')
  let puzzleId = $state(0)
  let score = $state(0)
  let wrongSquares = $state<Square[]>([])
  let strays = $state(0)
  let canUndo = $state(false)
  let hintedSquare = $state<Square | null>(null)
  let openMenu = $state<'difficulty' | 'phase' | null>(null)
  let gameEnd = $state(false)

  let modeRef = $state<{ undo: () => void } | null>(null)
  let hintTimer: ReturnType<typeof setTimeout> | undefined

  const diff = $derived(DIFFICULTIES.find((d) => d.id === difficulty)!)
  const phaseLabel = $derived(PHASES.find((p) => p.id === phase)!.label)
  const total = $derived(Object.keys(target).length)
  const solved = $derived(total > 0 && score === total && strays === 0)
  const tracking = $derived(difficulty === 'easy')
  // name the position by its last move in proper notation ("8...c6", "11. Qxd5+");
  // a ply count would call 8 full moves "16 moves"
  const lastMove = $derived.by(() => {
    const i = line.length - 1
    if (i < 0) return null
    const n = Math.floor(i / 2) + 1
    return i % 2 === 0 ? `${n}. ${line[i]}` : `${n}...${line[i]}`
  })

  // strays only exist in medium/hard and progress only in easy (the active
  // mode syncs its own); reset the other so a previous session can't leak
  // into the score line or the notation highlights
  $effect(() => {
    if (difficulty === 'easy') strays = 0
    else progress = null
  })

  function plyRange(max: number): [number, number] {
    switch (phase) {
      case 'opening': return [4, Math.max(4, Math.min(14, max))]
      case 'half': return [Math.max(2, Math.round(max * 0.45)), Math.max(3, Math.round(max * 0.55))]
      case 'full': return [max, max]
      default: return [Math.min(8, max), max]
    }
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

  function loadRealGame(): { history: string[]; result: string } {
    const pgn = games[Math.floor(Math.random() * games.length)].trim()
    const full = new Chess()
    full.loadPgn(pgn)
    return {
      history: full.history(),
      result: pgn.match(/(1-0|0-1|1\/2-1\/2)\s*$/)?.[1] ?? ''
    }
  }

  function newGame(): void {
    clearHint()
    // mix of curated human games and generated ones
    const source = Math.random() < GENERATED_CHANCE ? generateGame() : loadRealGame()
    const history = source.history
    const max = history.length
    const [lo, hi] = plyRange(max)
    const k = Math.min(hi, lo + Math.floor(Math.random() * (hi - lo + 1)))

    const game = new Chess()
    const keys = [positionKey(toMap(game), game.turn())]
    for (let i = 0; i < k; i++) {
      game.move(history[i])
      keys.push(positionKey(toMap(game), game.turn()))
    }

    target = toMap(game)
    line = history.slice(0, k)
    lineKeys = keys
    gameEnd = k === max
    result = gameEnd ? source.result : ''
    puzzleId += 1
  }

  function showHint(): void {
    if (solved || !wrongSquares.length) return
    clearTimeout(hintTimer)
    hintedSquare = wrongSquares[Math.floor(Math.random() * wrongSquares.length)]
    hintTimer = setTimeout(() => (hintedSquare = null), 2200)
  }

  // a hint belongs to one board — never carry it into a new puzzle or mode
  function clearHint(): void {
    clearTimeout(hintTimer)
    hintedSquare = null
  }

  function setDifficulty(id: Difficulty): void {
    difficulty = id
    clearHint()
    openMenu = null
  }

  function toggleMenu(id: 'difficulty' | 'phase'): void {
    openMenu = openMenu === id ? null : id
  }
  function onDocumentClick(event: MouseEvent): void {
    if (!event.target || !(event.target instanceof Element) || !event.target.closest('.menu')) openMenu = null
  }
  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') openMenu = null
  }

  function reloadApp(): void {
    // pages are fetched network-first, so a plain reload picks up the new build
    swUpdate.reloading = true
    location.reload()
  }

  // the GitHub buttons widget scans the DOM on load, so inject it after mount
  $effect(() => {
    if (document.querySelector('script[src*="buttons.github.io"]')) return
    const s = document.createElement('script')
    s.src = 'https://buttons.github.io/buttons.js'
    s.async = true
    s.defer = true
    document.body.appendChild(s)
  })

  newGame()
</script>

<svelte:document onclick={onDocumentClick} />
<svelte:window onkeydown={onKeydown} />

<main class="app">
  <header class="top">
    <h1 class="brand"><img src="icon-192.png" alt="" width="30" height="30" /><span>Nota<em>Learn</em></span></h1>

    <div class="controls">
      <div class="menu" class:open={openMenu === 'difficulty'}>
        <button class="menu-toggle" aria-expanded={openMenu === 'difficulty'} onclick={() => toggleMenu('difficulty')}>
          <span>Difficulty <b>{diff.label}</b></span><span class="caret"><Icon name="chevron-down" size={14} /></span>
        </button>
        {#if openMenu === 'difficulty'}
          <div class="menu-list" role="listbox" aria-label="Difficulty">
            {#each DIFFICULTIES as d}
              <button role="option" aria-selected={difficulty === d.id} class:active={difficulty === d.id}
                onclick={() => setDifficulty(d.id)}>{d.label}</button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="menu" class:open={openMenu === 'phase'}>
        <button class="menu-toggle" aria-expanded={openMenu === 'phase'} onclick={() => toggleMenu('phase')}>
          <span>Position <b>{phaseLabel}</b></span><span class="caret"><Icon name="chevron-down" size={14} /></span>
        </button>
        {#if openMenu === 'phase'}
          <div class="menu-list" role="listbox" aria-label="Position range">
            {#each PHASES as p}
              <button role="option" aria-selected={phase === p.id} class:active={phase === p.id}
                onclick={() => { phase = p.id; newGame(); openMenu = null }}>{p.label}</button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="actions">
      <button class="new" onclick={newGame}><Icon name="rotate-cw" size={15} />New puzzle</button>
    </div>
  </header>

  <div class="stage">
    <div class="board-col">
      {#key `${difficulty}-${puzzleId}`}
        {#if difficulty === 'easy'}
          <EasyMode bind:this={modeRef} {target} {lineKeys} bind:progress bind:score bind:wrongSquares bind:canUndo
            hinted={hintedSquare} {solved} onnext={newGame} />
        {:else}
          <RecallMode {difficulty} {target} bind:score bind:wrongSquares bind:strays hinted={hintedSquare} {solved} onnext={newGame} />
        {/if}
      {/key}
      <!-- phones: the notation, one line, right under the board (the panel list is a scroll away) -->
      <MoveList {line} variant="strip" {tracking} {progress} complete={gameEnd} {result} />
    </div>

    <aside class="panel">
      <p class="eyebrow">
        {#if lastMove}Position after <span class="eyebrow-san">{lastMove}</span>{:else}Starting position{/if}
      </p>
      <div class="score-row">
        <div class="score" class:won={solved}>
          <b>{score}</b><span>/ {total} pieces correct{strays ? ` · ${strays} off-target` : ''}</span>
        </div>
        <div class="score-actions">
          {#if difficulty === 'easy'}
            <button class="action" onclick={() => modeRef?.undo()} disabled={solved || !canUndo}>Undo</button>
          {/if}
          <button class="action" onclick={showHint} disabled={solved || !wrongSquares.length}>Hint</button>
        </div>
      </div>

      <MoveList {line} variant="sheet" {tracking} {progress} complete={gameEnd} {result} />

      {#if solved}
        <!-- the "Next puzzle" action lives under the board (SolvedBar), where it's seen on mobile too -->
        <div class="note success"><Icon name="circle-check" size={18} /><p>Perfect — every piece is where it belongs.</p></div>
      {:else}
        <div class="note hint"><Icon name="lightbulb" size={18} /><p>{diff.hint}</p></div>
      {/if}
    </aside>
  </div>

  <footer class="foot">
    <p>
      <Icon name="book-open" size={15} />
      New to chess notation? Read about
      <a href="https://en.wikipedia.org/wiki/Algebraic_notation_(chess)" target="_blank" rel="noopener noreferrer">algebraic notation</a>
      on Wikipedia.
    </p>
    <a class="github-button" href="https://github.com/nick-delirium/notalearn" data-color-scheme="no-preference: dark; light: dark; dark: dark;" data-show-count="true" aria-label="Star nick-delirium/notalearn on GitHub">Star on GitHub</a>
  </footer>

  {#if swUpdate.ready}
    <div class="update-bar" role="status">
      <span>New version available</span>
      <button onclick={reloadApp}>{swUpdate.reloading ? 'Reloading…' : 'Reload'}</button>
    </div>
  {/if}
</main>
