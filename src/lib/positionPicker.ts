import type { Action } from 'svelte/action'

/**
 * Positions a floating popover just above the given square (identified by
 * `param`), clamping to the screen edges and flipping below the square when
 * there is no room above. Expects to be rendered inside `.board-frame`.
 */
export const positionPicker: Action<HTMLElement, string | null> = (node, param) => {
  const adjust = () => {
    const side = node.closest('.board-side')
    const frame = side?.querySelector('.board-frame')
    const board = frame?.querySelector(':scope > .board')
    if (!side || !frame || !board || !param) return
    const sRect = side.getBoundingClientRect()
    const fRect = frame.getBoundingClientRect()
    // measure a real square — the board element's rect includes its border
    const probe = board.querySelector('.square')
    if (!probe) return
    const cell = probe.getBoundingClientRect().width
    const origin = probe.getBoundingClientRect().left
    const f = param.charCodeAt(0) - 97
    const r = 8 - Number(param[1])

    node.style.visibility = 'hidden'
    node.style.left = '0px'
    node.style.top = '0px'
    const w = node.offsetWidth
    const h = node.offsetHeight

    const absCx = origin + f * cell + cell / 2
    const sqTop = probe.getBoundingClientRect().top - fRect.top + r * cell

    // clamp horizontally to the viewport, then to the board container
    let absX = Math.min(Math.max(absCx - w / 2, 10), window.innerWidth - w - 10)
    absX = Math.min(Math.max(absX, sRect.left + 2), sRect.right - w - 2)
    let y = sqTop - h - 10
    if (y < 10) y = Math.min(sqTop + cell + 10, fRect.height - h - 6)

    node.style.left = `${absX - sRect.left}px`
    node.style.top = `${y}px`
    node.style.visibility = 'visible'
  }
  requestAnimationFrame(adjust)
  window.addEventListener('resize', adjust)
  return {
    update: (p) => {
      param = p
      requestAnimationFrame(adjust)
    },
    destroy: () => window.removeEventListener('resize', adjust)
  }
}
