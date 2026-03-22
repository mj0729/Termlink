import type { ConnectionStatus } from '../types/app'

export const CONNECTION_STATUS_META: Record<
  ConnectionStatus,
  {
    key: ConnectionStatus
    label: string
    className: `is-${ConnectionStatus}`
  }
> = {
  connected: {
    key: 'connected',
    label: '已连接',
    className: 'is-connected',
  },
  connecting: {
    key: 'connecting',
    label: '连接中',
    className: 'is-connecting',
  },
  disconnected: {
    key: 'disconnected',
    label: '已断开',
    className: 'is-disconnected',
  },
}

export function getConnectionStatusMeta(status?: ConnectionStatus | null) {
  if (!status) return null
  return CONNECTION_STATUS_META[status]
}
