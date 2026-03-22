export interface BroadcastPaneLike {
  id: string
  sshState: 'connecting' | 'connected' | 'disconnected'
}

export function getBroadcastTargetPaneIds(
  panes: BroadcastPaneLike[],
  sourcePaneId: string,
  broadcastEnabled: boolean,
) {
  if (!broadcastEnabled) {
    return []
  }

  return panes
    .filter((pane) => pane.id !== sourcePaneId && pane.sshState === 'connected')
    .map((pane) => pane.id)
}
