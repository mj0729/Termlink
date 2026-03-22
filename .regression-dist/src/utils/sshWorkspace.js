export function getBroadcastTargetPaneIds(panes, sourcePaneId, broadcastEnabled) {
    if (!broadcastEnabled) {
        return [];
    }
    return panes
        .filter((pane) => pane.id !== sourcePaneId && pane.sshState === 'connected')
        .map((pane) => pane.id);
}
