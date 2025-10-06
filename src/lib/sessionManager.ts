import { tabSync } from './tabSync';

const INACTIVITY_TIMEOUT_MINUTES = 30;
const SESSION_TOKEN_KEY = 'sessionToken';
const LAST_ACTIVITY_KEY = 'lastActive';
const USER_KEY = 'user';
const TAB_SESSIONS_KEY = 'tabSessions';

// Generate a secure random session token
const generateSessionToken = (): string => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

// Validate session token format
const isValidSessionToken = (token: string): boolean => {
  return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);
};

// Tab-specific session management
interface TabSession {
  tabId: string;
  sessionToken: string;
  lastActivity: number;
  isActive: boolean;
}

const getTabSessions = (): Record<string, TabSession> => {
  try {
    const sessions = localStorage.getItem(TAB_SESSIONS_KEY);
    return sessions ? JSON.parse(sessions) : {};
  } catch {
    return {};
  }
};

const setTabSessions = (sessions: Record<string, TabSession>): void => {
  try {
    localStorage.setItem(TAB_SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    // console.warn('Failed to save tab sessions:', error);
  }
};

const cleanupInactiveTabs = (): void => {
  const sessions = getTabSessions();
  const now = Date.now();
  const activeTabs = tabSync.getActiveTabs();

  // Remove sessions for tabs that are no longer active
  Object.keys(sessions).forEach(tabId => {
    if (
      !activeTabs.includes(tabId) ||
      now - sessions[tabId].lastActivity > INACTIVITY_TIMEOUT_MINUTES * 60 * 1000
    ) {
      delete sessions[tabId];
    }
  });

  setTabSessions(sessions);
};

export const sessionManager = {
  isSessionExpired: (): boolean => {
    cleanupInactiveTabs();

    const currentTabId = tabSync.getTabId();
    const sessions = getTabSessions();
    const currentSession = sessions[currentTabId];

    // Check if current tab has a valid session
    if (!currentSession || !isValidSessionToken(currentSession.sessionToken)) {
      return true;
    }

    const now = Date.now();
    const inactiveMinutes = (now - currentSession.lastActivity) / (1000 * 60);

    return inactiveMinutes > INACTIVITY_TIMEOUT_MINUTES;
  },

  updateActivity: (): void => {
    const now = Date.now();
    const currentTabId = tabSync.getTabId();
    const sessions = getTabSessions();

    // Update or create session for current tab
    if (!sessions[currentTabId]) {
      sessions[currentTabId] = {
        tabId: currentTabId,
        sessionToken: generateSessionToken(),
        lastActivity: now,
        isActive: true,
      };
    } else {
      sessions[currentTabId].lastActivity = now;
      sessions[currentTabId].isActive = true;
    }

    setTabSessions(sessions);

    // Also update legacy storage for backward compatibility
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    if (!localStorage.getItem(SESSION_TOKEN_KEY)) {
      localStorage.setItem(SESSION_TOKEN_KEY, sessions[currentTabId].sessionToken);
    }

    // Broadcast session update to other tabs
    tabSync.broadcast('SESSION_UPDATE', {
      tabId: currentTabId,
      lastActivity: now,
    });
  },

  initializeSession: (): void => {
    const currentTabId = tabSync.getTabId();
    const sessionToken = generateSessionToken();
    const now = Date.now();

    const sessions = getTabSessions();
    sessions[currentTabId] = {
      tabId: currentTabId,
      sessionToken,
      lastActivity: now,
      isActive: true,
    };

    setTabSessions(sessions);

    // Legacy storage
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
  },

  getSessionToken: (): string | null => {
    const currentTabId = tabSync.getTabId();
    const sessions = getTabSessions();
    const currentSession = sessions[currentTabId];

    if (currentSession && isValidSessionToken(currentSession.sessionToken)) {
      return currentSession.sessionToken;
    }

    // Fallback to legacy storage
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token && isValidSessionToken(token) ? token : null;
  },

  clearSession: (): void => {
    const currentTabId = tabSync.getTabId();
    const sessions = getTabSessions();

    // Remove current tab's session
    delete sessions[currentTabId];
    setTabSessions(sessions);

    // Broadcast logout to other tabs
    tabSync.broadcast('LOGOUT', {
      tabId: currentTabId,
      timestamp: Date.now(),
    });

    // Clear legacy session data
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(SESSION_TOKEN_KEY);

    // Clear any other sensitive data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('auth') || key.includes('token') || key.includes('session'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  // Security check for potential session hijacking
  validateSession: (): boolean => {
    cleanupInactiveTabs();

    const currentTabId = tabSync.getTabId();
    const sessions = getTabSessions();
    const currentSession = sessions[currentTabId];
    const user = localStorage.getItem(USER_KEY);

    // All session data must be present and valid
    if (!currentSession || !user) {
      return false;
    }

    if (!isValidSessionToken(currentSession.sessionToken)) {
      return false;
    }

    // Check for suspicious activity patterns
    if (isNaN(currentSession.lastActivity) || currentSession.lastActivity > Date.now()) {
      return false;
    }

    return true;
  },

  // Get all active tab sessions
  getActiveSessions: (): TabSession[] => {
    cleanupInactiveTabs();
    const sessions = getTabSessions();
    return Object.values(sessions).filter(session => session.isActive);
  },

  // Check if this is the main tab (for coordinating Firebase listeners)
  isMainTab: (): boolean => {
    return tabSync.isMainTabInstance();
  },
};
