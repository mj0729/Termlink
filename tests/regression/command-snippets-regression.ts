import assert from 'node:assert/strict'
import { buildCommandSnippetGroups, normalizeCommandSnippets } from '../../src/utils/commandSnippets.js'

const snippets = normalizeCommandSnippets([
  { id: '1', name: ' 查看日志 ', command: ' tail -f app.log ', group: '排障 ' },
  { id: '2', name: '部署服务', command: 'systemctl restart app', group: '部署' },
  { id: '3', name: '打印路径', command: 'pwd', group: ' ' },
  { id: '4', name: '', command: 'echo skip', group: '杂项' },
])

assert.equal(snippets.length, 3, '空名称片段应被过滤')
assert.equal(snippets[0].group, '排障', '分组名称应被自动 trim')

const groups = buildCommandSnippetGroups(snippets)

assert.deepEqual(
  groups.map((group) => group.label),
  ['部署', '排障', '未分组'],
  '应按分组名称排序展示，并把未分组放在最后',
)

assert.equal(groups[2].items[0].name, '打印路径', '空分组片段应归入未分组')

const searchResult = buildCommandSnippetGroups(snippets, 'restart')

assert.deepEqual(
  searchResult.map((group) => group.label),
  ['部署'],
  '搜索命令内容时应只返回匹配分组',
)

assert.equal(searchResult[0].items[0].name, '部署服务', '搜索结果应保留匹配片段')

console.log('command snippets regression passed')
