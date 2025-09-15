const INACTIVITY_TIMEOUT_MINUTES = 30;
const SESSION_TOKEN_KEY = 'sessionToken';
const LAST_ACTIVITY_KEY = 'lastActive';
const USER_KEY = 'user';

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

export const sessionManager = {
  isSessionExpired: (): boolean => {
    const lastActive = localStorage.getItem(LAST_ACTIVITY_KEY);
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    
    // Check if session token exists and is valid
    if (!sessionToken || !isValidSessionToken(sessionToken)) {
      return true;
    }
    
    if (!lastActive) return true;

    const now = Date.now();
    const lastActiveTime = parseInt(lastActive, 10);
    
    // Validate timestamp
    if (isNaN(lastActiveTime) || lastActiveTime > now) {
      return true;
    }
    
    const inactiveMinutes = (now - lastActiveTime) / (1000 * 60);
    return inactiveMinutes > INACTIVITY_TIMEOUT_MINUTES;
  },

  updateActivity: (): void => {
    const now = Date.now();
    localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());
    
    // Generate new session token if it doesn't exist
    if (!localStorage.getItem(SESSION_TOKEN_KEY)) {
      localStorage.setItem(SESSION_TOKEN_KEY, generateSessionToken());
    }
  },

  initializeSession: (): void => {
    const sessionToken = generateSessionToken();
    localStorage.setItem(SESSION_TOKEN_KEY, sessionToken);
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
  },

  getSessionToken: (): string | null => {
    const token = localStorage.getItem(SESSION_TOKEN_KEY);
    return token && isValidSessionToken(token) ? token : null;
  },

  clearSession: (): void => {
    // Clear all session-related data
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
    const sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    const lastActive = localStorage.getItem(LAST_ACTIVITY_KEY);
    const user = localStorage.getItem(USER_KEY);
    
    // All session data must be present and valid
    if (!sessionToken || !lastActive || !user) {
      return false;
    }
    
    if (!isValidSessionToken(sessionToken)) {
      return false;
    }
    
    // Check for suspicious activity patterns
    const lastActiveTime = parseInt(lastActive, 10);
    if (isNaN(lastActiveTime) || lastActiveTime > Date.now()) {
      return false;
    }
    
    return true;
  },
};
