/**
 * E2E reproduction for the stray-piece state bugs (drives the real app in Chrome):
 *
 *  Bug 1 — stale `strays` counter in Easy mode:
 *    `strays` is App-level state that only RecallMode (medium/hard) ever writes.
 *    After placing a stray piece in Hard mode and switching to Easy, the score
 *    line still shows "· N off-target" even though Easy mode has no strays.
 *
 *  Bug 2 — Hard mode declares victory with stray pieces on the board:
 *    `solved = total > 0 && score === total` ignores strays, so "Perfect —
 *    every piece is where it belongs." appears while extra (✕-marked) pieces
 *    still sit on the board.
 *
 * This test asserts the CORRECT behavior, so it FAILS before the fix and
 * PASSES after.
 *
 * Run:
 *   node_modules/.bin/vite --port 4199 &        # dev server
 *   node test/e2e.strays.test.mjs
 */
import { chromium } from 'playwright-core'

const BASE = process.env.BASE_URL ?? 'http://localhost:4199'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

// Chess Cuernavaca glyph → piece type (src/lib/pieces.ts GLYPHS)
const GLYPH_TO_TYPE = { l: 'K', w: 'Q', t: 'R', v: 'B', m: 'N', o: 'P' }
const ALL_SQUARES = [...'abcdefgh'].flatMap((f) => [8, 7, 6, 5, 4, 3, 2, 1].map((r) => `${f}${r}`))

let failures = 0
function check(name, cond, extra = '') {
  if (cond) console.log(`  ok: ${name}`)
  else {
    failures++
    console.log(`  FAIL: ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
page.on('pageerror', (e) => console.log('  [page error]', e.message))
await page.goto(BASE, { waitUntil: 'networkidle' })

const scoreLine = () => page.locator('.score span').innerText()
const successVisible = () => page.locator('.success').isVisible()

async function setDifficulty(label) {
  await page.locator('.menu-toggle', { hasText: 'Difficulty' }).click()
  await page.locator('.menu-list button', { hasText: label }).click()
  await sleep(150)
}

async function clickSquare(sq) {
  // squares render in fixed order (rank 8→1, file a→h); select by position
  // because aria-label changes once a piece sits on the square
  const idx = (8 - Number(sq[1])) * 8 + (sq.charCodeAt(0) - 97)
  await page.locator('.board .square').nth(idx).click()
  await page.locator('.picker').waitFor({ state: 'visible', timeout: 3000 })
  await sleep(80) // positionPicker runs on requestAnimationFrame
}

async function pickPiece(pieceKey) {
  await page.locator(`.picker button[data-piece="${pieceKey}"]`).click()
  await sleep(60)
}

async function placePiece(sq, pieceKey) {
  await clickSquare(sq)
  await pickPiece(pieceKey)
}

// ── setup: Hard mode, reveal the full target via the Hint button ──────────
await setDifficulty('Hard')
const total = Number((await scoreLine()).match(/\/ (\d+) pieces correct/)?.[1])
check('read total pieces from score line', total > 0, await scoreLine())

// Each hint ghosts the target piece on one random wrong square
// (class = color, text = glyph). Repeat until every target square is known.
const target = new Map() // square → pieceKey
for (let i = 0; i < 400 && target.size < total; i++) {
  await page.locator('.score-actions .action', { hasText: 'Hint' }).click()
  await sleep(120)
  const ghost = page.locator('.square .ghost')
  if ((await ghost.count()) === 0) continue
  const sq = await ghost.locator('xpath=ancestor::button[contains(@class,"square")]').getAttribute('aria-label')
  const color = (await ghost.getAttribute('class')).includes('white') ? 'w' : 'b'
  const type = GLYPH_TO_TYPE[(await ghost.innerText()).trim()]
  if (sq && type && !target.has(sq)) target.set(sq, color + type)
}
check(`revealed full target (${target.size}/${total}) via hints`, target.size === total, `revealed ${target.size}`)
const nonTargetSquares = ALL_SQUARES.filter((sq) => !target.has(sq))
const straySq = nonTargetSquares[0]

// ── Bug 1: stale strays when switching Hard → Easy ────────────────────────
console.log('== Bug 1: stale "off-target" counter in Easy mode ==')
await placePiece(straySq, 'wQ')
check('hard mode shows "· 1 off-target"', (await scoreLine()).includes('· 1 off-target'), await scoreLine())

await setDifficulty('Easy')
const easyLine = await scoreLine()
check('easy mode does NOT show the stale "off-target" counter', !easyLine.includes('off-target'), easyLine)

// ── Bug 2: Hard mode victory with strays on the board ─────────────────────
console.log('== Bug 2: "Perfect" victory while stray pieces remain ==')
await setDifficulty('Hard') // remounts RecallMode with fresh guesses

// Place every target piece except the last one.
const entries = [...target.entries()]
for (const [sq, piece] of entries.slice(0, -1)) await placePiece(sq, piece)

// Place a stray piece on an empty, non-target square.
await placePiece(straySq, 'bP')
check('stray placed; score line shows "· 1 off-target"', (await scoreLine()).includes('· 1 off-target'), await scoreLine())

// Now place the final target piece → score === total but strays === 1.
await placePiece(entries.at(-1)[0], entries.at(-1)[1])
await sleep(200)
check(
  'victory banner is NOT shown while a stray remains',
  !(await successVisible()),
  'banner "Perfect — every piece is where it belongs." is visible'
)

// Remove the stray → the puzzle is genuinely solved now.
await clickSquare(straySq)
await page.locator('.picker .clear').click()
await sleep(200)
check('victory banner IS shown once the stray is removed', await successVisible())

await browser.close()
console.log(failures === 0 ? '\nRESULT: PASS' : `\nRESULT: FAIL (${failures} checks failed)`)
process.exit(failures === 0 ? 0 : 1)
