export function formatBytes(bytes, options = {}) {
    const emptyValue = options.emptyValue ?? '0 B';
    if (!bytes || bytes === 0)
        return emptyValue;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    const value = Math.round((bytes / 1024 ** unitIndex) * 100) / 100;
    return `${value} ${sizes[unitIndex]}`;
}
export function formatTransferSpeed(bytesPerSecond) {
    return `${formatBytes(bytesPerSecond)}/s`;
}
export function formatUnixTimestamp(seconds, options = {}) {
    const emptyValue = options.emptyValue ?? '-';
    if (!seconds)
        return emptyValue;
    return new Date(seconds * 1000).toLocaleString();
}
export function formatUptime(seconds) {
    if (!seconds)
        return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) {
        return `${days}天 ${hours}小时`;
    }
    if (hours > 0) {
        return `${hours}小时 ${minutes}分钟`;
    }
    return `${minutes}分钟`;
}
