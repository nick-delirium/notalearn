/**
 * Touch-first devices get "tap" wording (drag-and-drop doesn't work there
 * anyway). Evaluated once — switching input type mid-session is rare enough.
 */
export const COARSE = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

export const click = COARSE ? 'tap' : 'click'
export const Click = COARSE ? 'Tap' : 'Click'
