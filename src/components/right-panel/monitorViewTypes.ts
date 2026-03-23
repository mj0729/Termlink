import type { CSSProperties, Component } from 'vue'
import type { DiskInfo, NetworkInfo, ProcessInfo } from '../../types/app'

export type MonitorHeroStatistic = {
  key: string
  label: string
  value: string | number
  precision?: number
  suffix?: string
  meta: string
  valueStyle: CSSProperties
}

export type MonitorMemorySegment = {
  label: string
  percent: number
  value: string
  color: string
}

export type MonitorAlertItem = {
  key: string
  type: 'success' | 'info' | 'warning' | 'error'
  message: string
  description: string
}

export type MonitorResourceHighlight = {
  key: string
  label: string
  icon: Component
  percent: number
  color: string
  tone: string
  state: string
  value: number
  suffix?: string
  precision?: number
  meta: string
}

export type MonitorProcessColumn = {
  title: string
  dataIndex: string
  key: string
  width?: number
  align?: 'left' | 'center' | 'right'
  ellipsis?: boolean
}

export type MonitorProcessRow = {
  key: string
  rank: number
  command: string
  cpuPercent: number
  memoryKb: number
}

export type MonitorProcessSummary = Pick<ProcessInfo, 'running' | 'sleeping'>

export type MonitorDiskColorGetter = (percentage: number) => string
export type MonitorNumberFormatter = (value?: number) => string
export type MonitorTextFormatter = (value: string) => string
export type MonitorSizeFormatter = (value?: number) => string
export type MonitorSpeedFormatter = (value?: number) => string

export type { DiskInfo, NetworkInfo }
