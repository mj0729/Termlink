import assert from 'node:assert/strict';
import { getBroadcastTargetPaneIds } from '../../src/utils/sshWorkspace.js';
const panes = [
    { id: 'pane-a', sshState: 'connected' },
    { id: 'pane-b', sshState: 'connected' },
    { id: 'pane-c', sshState: 'disconnected' },
];
assert.deepEqual(getBroadcastTargetPaneIds(panes, 'pane-a', false), [], '广播关闭时不应返回任何目标 pane');
assert.deepEqual(getBroadcastTargetPaneIds(panes, 'pane-a', true), ['pane-b'], '广播开启时只应向其他已连接 pane 广播');
console.log('ssh-workspace regression passed');
