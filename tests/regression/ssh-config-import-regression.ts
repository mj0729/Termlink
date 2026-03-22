import assert from 'node:assert/strict'
import { createImportedSshProfile } from '../../src/utils/sshConfigImport.js'
import type { ParsedSshConfigHost, SshProfile } from '../../src/types/app.js'

const entries: ParsedSshConfigHost[] = [
  {
    alias: 'bastion',
    name: 'bastion',
    host: 'bastion.example.com',
    port: 2222,
    username: 'jump',
    privateKey: '/Users/tester/.ssh/jump_id',
    proxyJumpAlias: null,
    portForwards: [],
  },
  {
    alias: 'app-prod',
    name: 'app-prod',
    host: '10.0.0.12',
    port: 22,
    username: 'deploy',
    privateKey: null,
    proxyJumpAlias: 'bastion',
    portForwards: [
      {
        id: 'forward-15432-127.0.0.1-5432',
        type: 'local',
        localPort: 15432,
        remoteHost: '127.0.0.1',
        remotePort: 5432,
        label: null,
      },
    ],
  },
]

const aliasToId = new Map<string, string>()
const existingAliasMap = new Map<string, SshProfile>()

const importedBastion = createImportedSshProfile(entries[0], aliasToId, existingAliasMap, entries)
aliasToId.set('bastion', importedBastion.id)

const importedApp = createImportedSshProfile(entries[1], aliasToId, existingAliasMap, entries)

assert.equal(importedApp.proxy_jump_id, importedBastion.id)
assert.equal(importedApp.proxy_jump_host, 'bastion.example.com')
assert.equal(importedApp.proxy_jump_username, 'jump')
assert.equal(importedApp.port_forwards?.[0]?.localPort, 15432)
assert.equal(importedApp.port_forwards?.[0]?.remotePort, 5432)
assert.equal(importedApp.ssh_config_source, '~/.ssh/config')

console.log('ssh-config import regression passed')
