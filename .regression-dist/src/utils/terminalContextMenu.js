let cleanupActiveMenu = null;
export function hideTerminalContextMenu() {
    cleanupActiveMenu?.();
    cleanupActiveMenu = null;
}
export function showTerminalContextMenu(event, items) {
    hideTerminalContextMenu();
    const menu = document.createElement('div');
    menu.className = 'terminal-context-menu';
    menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--panel-bg);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    min-width: 120px;
    padding: 4px 0;
  `;
    const cleanup = () => {
        if (menu.isConnected) {
            menu.remove();
        }
        document.removeEventListener('click', closeMenu);
        document.removeEventListener('contextmenu', closeMenuOnRightClick);
        if (cleanupActiveMenu === cleanup) {
            cleanupActiveMenu = null;
        }
    };
    const closeMenu = (nextEvent) => {
        if (!menu.contains(nextEvent.target)) {
            cleanup();
        }
    };
    const closeMenuOnRightClick = () => {
        cleanup();
    };
    items.forEach((item) => {
        const menuItem = document.createElement('div');
        menuItem.style.cssText = `
      padding: 8px 16px;
      cursor: pointer;
      color: var(--text-color);
      font-size: 14px;
      transition: background-color 0.2s;
    `;
        menuItem.textContent = item.label;
        menuItem.addEventListener('mouseenter', () => {
            menuItem.style.backgroundColor = 'var(--hover-bg)';
        });
        menuItem.addEventListener('mouseleave', () => {
            menuItem.style.backgroundColor = 'transparent';
        });
        menuItem.addEventListener('click', () => {
            item.action();
            cleanup();
        });
        menu.appendChild(menuItem);
    });
    document.body.appendChild(menu);
    cleanupActiveMenu = cleanup;
    requestAnimationFrame(() => {
        document.addEventListener('click', closeMenu);
        document.addEventListener('contextmenu', closeMenuOnRightClick);
    });
    return cleanup;
}
