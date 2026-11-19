<script lang="ts">
  import { Chess } from 'chess.js'
  import type { Color, PieceSymbol, Square as ChessSquare } from 'chess.js'
  import games from './pgns'
  import EasyMode from './lib/EasyMode.svelte'
  import RecallMode from './lib/RecallMode.svelte'
  import { swUpdate } from './lib/swUpdate.svelte'
  import { generateGame } from './lib/randomGame'
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
  interface MovePair {
    n: number
    w: string
    b?: string
  }

  const DIFFICULTIES: DifficultyDef[] = [    { id: 'easy', label: 'Easy', hint: 'Pieces move by real chess rules — legal squares are dotted. Click a piece, then a dotted square. Captures and castling included.' },
    { id: 'medium', label: 'Medium', hint: 'Every piece is hidden. Click a “?” square, then pick the piece you think stands there.' },
    { id: 'hard', label: 'Hard', hint: 'The board is empty. Click any square, then pick the piece that belongs there.' }
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
  let movePairs = $state<MovePair[]>([])
  let moveCount = $state(0)
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

  // strays only exist in medium/hard (RecallMode syncs them); keep the
  // counter at zero in easy mode so a previous recall session can't leak
  // a stale "off-target" count into the score line
  $effect(() => {
    if (difficulty === 'easy') strays = 0
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
    for (let i = 0; i < k; i++) game.move(history[i])

    target = toMap(game)
    moveCount = k
    gameEnd = k === max
    result = gameEnd ? source.result : ''

    const verbose = game.history({ verbose: true }) as { san: string; color: Color; piece: PieceSymbol; from: ChessSquare; to: ChessSquare }[]
    const pairs: MovePair[] = []
    for (let i = 0; i < verbose.length; i += 2) {
      pairs.push({ n: i / 2 + 1, w: verbose[i].san, b: verbose[i + 1]?.san })
    }
    movePairs = pairs
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
    <div class="controls">
      <div class="menu" class:open={openMenu === 'difficulty'}>
        <button class="menu-toggle" aria-expanded={openMenu === 'difficulty'} onclick={() => toggleMenu('difficulty')}>
          Difficulty <b>{diff.label}</b><span class="caret">▾</span>
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
          Position <b>{phaseLabel}</b><span class="caret">▾</span>
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
      <button class="new" onclick={newGame} aria-label="New puzzle"><em>New puzzle</em><span>⟳</span></button>
    </div>
  </header>

  <div class="stage">
    {#key `${difficulty}-${puzzleId}`}
      {#if difficulty === 'easy'}
        <EasyMode bind:this={modeRef} {target} bind:score bind:wrongSquares bind:canUndo hinted={hintedSquare} />
      {:else}
        <RecallMode {difficulty} {target} bind:score bind:wrongSquares bind:strays hinted={hintedSquare} />
      {/if}
    {/key}

    <aside class="panel">
      <p class="eyebrow">Position after {moveCount} moves</p>
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

      <div class="moves-text" aria-label="Game notation">
        {#each movePairs as pair, i}
          {@const isLast = i === movePairs.length - 1}
          <span class="mnum">{pair.n}.</span><span class="san" class:last={isLast && !pair.b}>{pair.w}</span>
          {#if pair.b}<span class="san" class:last={isLast}>{pair.b}</span>{/if}
        {/each}
        {#if gameEnd && result}<span class="result">{result}</span>
        {:else if !gameEnd}<span class="more">…</span>{/if}
      </div>

      {#if solved}
        <div class="success">
          <span>✦</span>
          <div>
            <p>Perfect — every piece is where it belongs.</p>
            <button class="action next" onclick={newGame}>Next puzzle →</button>
          </div>
        </div>
      {:else}
        <div class="hint"><span>⌁</span><p>{diff.hint}</p></div>
      {/if}

      <div class="learn">
        <span>♞</span>
        <p>New to notation? Read about <a href="https://en.wikipedia.org/wiki/Algebraic_notation_(chess)" target="_blank" rel="noopener noreferrer">Algebraic Chess Notation</a> on Wikipedia.</p>
      </div>

      <div class="star-row">
        <a class="github-button" href="https://github.com/nick-delirium/notalearn" data-color-scheme="no-preference: light; light: light; dark: dark;" data-size="large" data-show-count="true" aria-label="Star nick-delirium/notalearn on GitHub">Star</a>
      </div>
    </aside>
  </div>

  {#if swUpdate.ready}
    <div class="update-bar" role="status">
      <span>New version available</span>
      <button onclick={reloadApp}>{swUpdate.reloading ? 'Reloading…' : 'Reload'}</button>
    </div>
  {/if}
</main>
