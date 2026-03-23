import type { CommandSnippet } from '../types/app.js'

export type CommandSnippetGroup = {
  key: string
  label: string
  items: CommandSnippet[]
}

export function normalizeCommandSnippets(items: CommandSnippet[] | undefined): CommandSnippet[] {
  return (items || [])
    .map((item) => ({
      ...item,
      name: item.name?.trim() || '',
      command: item.command?.trim() || '',
      group: item.group?.trim() || '',
    }))
    .filter((item) => item.name && item.command)
}

export function buildCommandSnippetGroups(
  items: CommandSnippet[] | undefined,
  query = '',
): CommandSnippetGroup[] {
  const normalizedQuery = query.trim().toLowerCase()
  const normalizedItems = normalizeCommandSnippets(items)
    .filter((item) => {
      if (!normalizedQuery) {
        return true
      }

      return [
        item.name,
        item.command,
        item.group || '未分组',
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    })

  const groupMap = new Map<string, CommandSnippet[]>()
  for (const item of normalizedItems) {
    const key = item.group || '未分组'
    const groupItems = groupMap.get(key) || []
    groupItems.push(item)
    groupMap.set(key, groupItems)
  }

  return Array.from(groupMap.entries())
    .sort(([left], [right]) => {
      if (left === '未分组') return 1
      if (right === '未分组') return -1
      return left.localeCompare(right, 'zh-CN')
    })
    .map(([label, groupItems]) => ({
      key: label,
      label,
      items: groupItems.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN')),
    }))
}
