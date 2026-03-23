import assert from 'node:assert/strict';
import SshService from '../../src/services/SshService.js';
const profile = {
    id: 'profile-bootstrap',
    host: 'example.com',
    port: 22,
    username: 'root',
    save_password: false,
    env_templates: [
        { id: 'env-1', key: 'NODE_ENV', value: 'production' },
        { id: 'env-2', key: 'INVALID-NAME', value: 'skip-me' },
    ],
    startup_tasks: [
        { id: 'task-1', name: '进入工作目录', command: 'cd /srv/app', enabled: true },
        { id: 'task-2', name: '禁用任务', command: 'npm test', enabled: false },
    ],
};
const commands = SshService.buildBootstrapCommands(profile);
assert(commands.some((command) => command.includes('export NODE_ENV=')), '应注入合法的环境变量模板');
assert(commands.every((command) => !command.includes('INVALID-NAME')), '非法环境变量名不应出现在启动脚本中');
assert(commands.some((command) => command.includes('启动任务 1/1: 进入工作目录')), '应展示已启用启动任务的执行提示');
assert(commands.some((command) => command.includes('cd /srv/app')), '应保留启动任务原始命令');
assert(commands.every((command) => !command.includes('禁用任务')), '已关闭的启动任务不应进入启动脚本');
assert(commands.some((command) => command.includes('"$__termlink_bootstrap_status"')), '失败提示应引用真实 shell 退出码变量');
const envOnlyProfile = {
    id: 'profile-env-only',
    host: 'example.com',
    port: 22,
    username: 'deploy',
    save_password: false,
    env_templates: [
        { id: 'env-3', key: 'APP_ENV', value: 'staging' },
    ],
    startup_tasks: [
        { id: 'task-3', name: '关闭任务', command: 'pwd', enabled: false },
    ],
};
const envOnlyCommands = SshService.buildBootstrapCommands(envOnlyProfile);
assert(envOnlyCommands.some((command) => command.includes('当前没有启用的启动任务')), '仅有环境变量时应明确提示没有启用的启动任务');
console.log('ssh-bootstrap regression passed');
