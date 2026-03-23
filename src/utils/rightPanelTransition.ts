export const RIGHT_PANEL_TRANSITION_END_EVENT = 'termlink:right-panel-transition-end'
export const MAIN_RIGHT_PANEL_TRANSITION_MS = 180

const RIGHT_PANEL_TRANSITION_UNTIL_ATTR = 'data-right-panel-transition-until'

let transitionClearTimer: number | null = null

export function isMainRightPanelTransitionActive() {
  if (typeof document === 'undefined') return false

  return Number(document.body.dataset.rightPanelTransitionUntil || 0) > Date.now()
}

export function markMainRightPanelTransition(durationMs = MAIN_RIGHT_PANEL_TRANSITION_MS) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return

  const until = Date.now() + durationMs
  document.body.setAttribute(RIGHT_PANEL_TRANSITION_UNTIL_ATTR, String(until))

  if (transitionClearTimer) {
    window.clearTimeout(transitionClearTimer)
  }

  transitionClearTimer = window.setTimeout(() => {
    transitionClearTimer = null

    if (!isMainRightPanelTransitionActive()) {
      document.body.removeAttribute(RIGHT_PANEL_TRANSITION_UNTIL_ATTR)
    }

    window.dispatchEvent(new CustomEvent(RIGHT_PANEL_TRANSITION_END_EVENT))
  }, durationMs)
}
