import type { ParsedSshConfigHost, SshProfile } from '../types/app.js'

export function createImportedSshProfile(
  entry: ParsedSshConfigHost,
  aliasToId: Map<string, string>,
  existingAliasMap: Map<string, SshProfile>,
  parsedEntries: ParsedSshConfigHost[],
) {
  const linkedProxyProfile = entry.proxyJumpAlias
    ? existingAliasMap.get(entry.proxyJumpAlias) || null
    : null
  const linkedProxyId = entry.proxyJumpAlias
    ? aliasToId.get(entry.proxyJumpAlias) || linkedProxyProfile?.id || null
    : null
  const linkedProxyEntry = entry.proxyJumpAlias
    ? parsedEntries.find((item) => item.alias === entry.proxyJumpAlias) || null
    : null

  const profile: SshProfile = {
    id: `sshcfg-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    name: entry.name,
    host: entry.host,
    port: entry.port,
    username: entry.username,
    save_password: false,
    private_key: entry.privateKey || null,
    group: 'SSH Config',
    tags: ['ssh-config'],
    proxy_jump_id: linkedProxyId,
    proxy_jump_name: entry.proxyJumpAlias || linkedProxyProfile?.name || null,
    proxy_jump_host: linkedProxyEntry?.host || linkedProxyProfile?.host || null,
    proxy_jump_port: linkedProxyEntry?.port || linkedProxyProfile?.port || null,
    proxy_jump_username: linkedProxyEntry?.username || linkedProxyProfile?.username || null,
    proxy_jump_private_key: linkedProxyEntry?.privateKey || linkedProxyProfile?.private_key || null,
    ssh_config_source: '~/.ssh/config',
    ssh_config_host: entry.alias,
    port_forwards: entry.portForwards,
    command_snippets: [],
    startup_tasks: [],
    env_templates: [],
  }

  return profile
}
