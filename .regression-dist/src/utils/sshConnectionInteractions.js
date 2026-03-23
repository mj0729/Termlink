import { Button, Modal } from 'antdv-next';
import { h } from 'vue';
export const defaultSshConnectionInteractions = {
    requestPassword(profile, { title }) {
        return promptForSshPassword(profile, title);
    },
    requestPassphrase(profile, { title, privateKeyPath }) {
        return promptForSecret(profile, title, '请输入私钥密码短语', privateKeyPath ? `私钥：${privateKeyPath}` : '用于解锁当前私钥');
    },
    confirmHostKey(verification) {
        return confirmSshHostKey(verification);
    },
};
function promptForSshPassword(profile, title) {
    return promptForSecret(profile, title, '请输入密码');
}
function promptForSecret(profile, title, placeholder, helperText) {
    let password = '';
    return new Promise((resolve) => {
        Modal.confirm({
            title,
            content: h('div', { class: 'termlink-confirm-stack' }, [
                h('div', { class: 'termlink-confirm-text' }, `目标：${profile.username}@${profile.host}:${profile.port}`),
                helperText
                    ? h('div', { class: 'termlink-confirm-text' }, helperText)
                    : null,
                h('input', {
                    class: 'termlink-confirm-input',
                    type: 'password',
                    autofocus: true,
                    placeholder,
                    onInput: (event) => {
                        password = event.target.value;
                    },
                }),
            ]),
            okText: '连接',
            cancelText: '取消',
            onOk: async () => resolve(password || null),
            onCancel: async () => resolve(null),
        });
    });
}
function confirmSshHostKey(verification) {
    const stateLabelMap = {
        unknown: '首次连接',
        changed: '主机密钥已变化',
        revoked: '主机密钥已被撤销',
        trusted: '主机密钥已受信任',
    };
    const details = [
        `状态：${stateLabelMap[verification.state] || verification.state}`,
        `主机：${verification.presented.host}:${verification.presented.port}`,
        `算法：${verification.presented.algorithm}`,
        `指纹：${verification.presented.fingerprint_sha256}`,
    ];
    if (verification.stored?.fingerprint_sha256) {
        details.push(`已存储指纹：${verification.stored.fingerprint_sha256}`);
    }
    return new Promise((resolve) => {
        let settled = false;
        let modal = null;
        const finish = (decision) => {
            if (settled) {
                return;
            }
            settled = true;
            modal?.destroy();
            resolve(decision);
        };
        modal = Modal.confirm({
            title: verification.state === 'changed' ? '主机密钥已变化' : '确认主机密钥',
            content: h('div', { class: 'termlink-confirm-text' }, [
                verification.state === 'changed'
                    ? '检测到主机密钥与已保存记录不一致。'
                    : '这是该主机的首次连接。',
                '',
                ...details,
                '',
                '选择“仅本次信任”会继续连接，但不会保存到本地主机密钥记录。',
                '选择“信任并保存”会继续连接，并将当前主机密钥保存到本地记录。',
            ].join('\n')),
            okText: null,
            cancelText: null,
            footer: () => h('div', { class: 'termlink-confirm-footer' }, [
                h(Button, { class: 'termlink-confirm-button termlink-confirm-button--danger', onClick: () => finish('reject') }, { default: () => '拒绝连接' }),
                h(Button, { class: 'termlink-confirm-button', onClick: () => finish('trust-once') }, { default: () => '仅本次信任' }),
                h(Button, { type: 'primary', class: 'termlink-confirm-button termlink-confirm-button--primary', onClick: () => finish('trust-and-save') }, { default: () => '信任并保存' }),
            ]),
            onCancel: async () => finish('reject'),
        });
    });
}
