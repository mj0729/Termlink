export interface ProfileTagPreset {
  value: string
  label: string
  color: string
  background: string
  border: string
  text: string
  darkBackground: string
  darkBorder: string
  darkText: string
}

export const PROFILE_TAG_PRESETS: ProfileTagPreset[] = [
  {
    value: '红色',
    label: '红色',
    color: '#ef4444',
    background: 'rgba(239, 68, 68, 0.12)',
    border: 'rgba(239, 68, 68, 0.22)',
    text: '#c2410c',
    darkBackground: 'rgba(239, 68, 68, 0.16)',
    darkBorder: 'rgba(248, 113, 113, 0.3)',
    darkText: '#fca5a5'
  },
  {
    value: '橙色',
    label: '橙色',
    color: '#f59e0b',
    background: 'rgba(245, 158, 11, 0.14)',
    border: 'rgba(245, 158, 11, 0.24)',
    text: '#b45309',
    darkBackground: 'rgba(245, 158, 11, 0.16)',
    darkBorder: 'rgba(251, 191, 36, 0.3)',
    darkText: '#fcd34d'
  },
  {
    value: '黄色',
    label: '黄色',
    color: '#eab308',
    background: 'rgba(234, 179, 8, 0.14)',
    border: 'rgba(234, 179, 8, 0.24)',
    text: '#a16207',
    darkBackground: 'rgba(234, 179, 8, 0.16)',
    darkBorder: 'rgba(250, 204, 21, 0.28)',
    darkText: '#fde047'
  },
  {
    value: '绿色',
    label: '绿色',
    color: '#84cc16',
    background: 'rgba(132, 204, 22, 0.14)',
    border: 'rgba(132, 204, 22, 0.24)',
    text: '#3f6212',
    darkBackground: 'rgba(132, 204, 22, 0.16)',
    darkBorder: 'rgba(163, 230, 53, 0.28)',
    darkText: '#bef264'
  },
  {
    value: '蓝色',
    label: '蓝色',
    color: '#3b82f6',
    background: 'rgba(59, 130, 246, 0.14)',
    border: 'rgba(59, 130, 246, 0.24)',
    text: '#1d4ed8',
    darkBackground: 'rgba(59, 130, 246, 0.16)',
    darkBorder: 'rgba(96, 165, 250, 0.3)',
    darkText: '#93c5fd'
  },
  {
    value: '紫色',
    label: '紫色',
    color: '#a855f7',
    background: 'rgba(168, 85, 247, 0.14)',
    border: 'rgba(168, 85, 247, 0.24)',
    text: '#7e22ce',
    darkBackground: 'rgba(168, 85, 247, 0.16)',
    darkBorder: 'rgba(192, 132, 252, 0.3)',
    darkText: '#d8b4fe'
  },
  {
    value: '灰色',
    label: '灰色',
    color: '#9ca3af',
    background: 'rgba(156, 163, 175, 0.16)',
    border: 'rgba(156, 163, 175, 0.26)',
    text: '#4b5563',
    darkBackground: 'rgba(148, 163, 184, 0.16)',
    darkBorder: 'rgba(148, 163, 184, 0.28)',
    darkText: '#cbd5e1'
  }
]

export function getProfileTagPreset(tag: string) {
  return PROFILE_TAG_PRESETS.find((preset) => preset.value === tag) ?? null
}
