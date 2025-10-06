// Tab synchronization utility to prevent conflicts between multiple browser tabs

interface TabSyncMessage {
  type: 'AUTH_STATE_CHANGE' | 'LOGOUT' | 'SESSION_UPDATE' | 'TAB_REGISTER' | 'TAB_HEARTBEAT';
  payload?: any;
  tabId: string;
  timestamp: number;
}

class TabSyncManager {
  private channel: BroadcastChannel | null = null;
  private tabId: string;
  private isMainTab: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private activeTabs: Set<string> = new Set();
  private listeners: Map<string, ((message: TabSyncMessage) => void)[]> = new Map();

  constructor() {
    this.tabId = this.generateTabId();
    this.initializeChannel();
    this.registerTab();
    this.startHeartbeat();
    this.setupBeforeUnload();
  }

  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeChannel(): void {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel('loyalty_app_tabs');
        this.channel.addEventListener('message', this.handleMessage.bind(this));
      }
    } catch (error) {
      // console.warn('BroadcastChannel not supported, tab sync disabled');
    }
  }

  private handleMessage(event: MessageEvent<TabSyncMessage>): void {
    const message = event.data;

    // Ignore messages from this tab
    if (message.tabId === this.tabId) return;

    switch (message.type) {
      case 'TAB_REGISTER':
        this.activeTabs.add(message.tabId);
        this.updateMainTabStatus();
        break;

      case 'TAB_HEARTBEAT':
        this.activeTabs.add(message.tabId);
        break;

      case 'LOGOUT':
        // Handle logout from another tab
        this.notifyListeners('LOGOUT', message);
        break;

      case 'AUTH_STATE_CHANGE':
        // Handle auth state change from another tab
        this.notifyListeners('AUTH_STATE_CHANGE', message);
        break;

      case 'SESSION_UPDATE':
        // Handle session update from another tab
        this.notifyListeners('SESSION_UPDATE', message);
        break;
    }
  }

  private notifyListeners(type: string, message: TabSyncMessage): void {
    const typeListeners = this.listeners.get(type) || [];
    typeListeners.forEach(listener => listener(message));
  }

  private registerTab(): void {
    this.activeTabs.add(this.tabId);
    this.updateMainTabStatus();
    this.broadcast('TAB_REGISTER', { tabId: this.tabId });
  }

  private updateMainTabStatus(): void {
    // The tab with the smallest ID becomes the main tab
    const sortedTabs = Array.from(this.activeTabs).sort();
    this.isMainTab = sortedTabs[0] === this.tabId;
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast('TAB_HEARTBEAT', { tabId: this.tabId });
      this.cleanupInactiveTabs();
    }, 5000); // Send heartbeat every 5 seconds
  }

  private cleanupInactiveTabs(): void {
    const now = Date.now();
    const tabHeartbeats = JSON.parse(localStorage.getItem('tab_heartbeats') || '{}');

    // Remove tabs that haven't sent heartbeat in 10 seconds
    Object.keys(tabHeartbeats).forEach(tabId => {
      if (now - tabHeartbeats[tabId] > 10000) {
        this.activeTabs.delete(tabId);
        delete tabHeartbeats[tabId];
      }
    });

    // Update our heartbeat
    tabHeartbeats[this.tabId] = now;
    localStorage.setItem('tab_heartbeats', JSON.stringify(tabHeartbeats));

    this.updateMainTabStatus();
  }

  private setupBeforeUnload(): void {
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Remove this tab from active tabs
    const tabHeartbeats = JSON.parse(localStorage.getItem('tab_heartbeats') || '{}');
    delete tabHeartbeats[this.tabId];
    localStorage.setItem('tab_heartbeats', JSON.stringify(tabHeartbeats));

    if (this.channel) {
      this.channel.close();
    }
  }

  public broadcast(type: TabSyncMessage['type'], payload?: any): void {
    if (!this.channel) return;

    const message: TabSyncMessage = {
      type,
      payload,
      tabId: this.tabId,
      timestamp: Date.now(),
    };

    try {
      this.channel.postMessage(message);
    } catch (error) {
      // console.warn('Failed to broadcast message:', error);
    }
  }

  public subscribe(type: string, listener: (message: TabSyncMessage) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type)!.push(listener);

    // Return unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        const index = typeListeners.indexOf(listener);
        if (index > -1) {
          typeListeners.splice(index, 1);
        }
      }
    };
  }

  public getTabId(): string {
    return this.tabId;
  }

  public isMainTabInstance(): boolean {
    return this.isMainTab;
  }

  public getActiveTabs(): string[] {
    return Array.from(this.activeTabs);
  }

  public sendHeartbeat(): void {
    this.broadcast('TAB_HEARTBEAT', { tabId: this.tabId });
    this.cleanupInactiveTabs();
  }
}

// Create singleton instance
export const tabSync = new TabSyncManager();

// Export utility functions
export const useTabSync = () => {
  return {
    tabId: tabSync.getTabId(),
    isMainTab: tabSync.isMainTabInstance(),
    activeTabs: tabSync.getActiveTabs(),
    broadcast: tabSync.broadcast.bind(tabSync),
    subscribe: tabSync.subscribe.bind(tabSync),
  };
};

export default tabSync;
