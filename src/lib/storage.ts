export const STORAGE_KEYS = {
  USER: 'user',
  LAST_ACTIVE: 'lastActive',
} as const;

export const storageUtils = {
  getUser: (): any | null => {
    try {
      const user = localStorage.getItem(STORAGE_KEYS.USER);
      return user ? JSON.parse(user) : null;
    } catch (error) {
      console.error('Error parsing stored user:', error);
      return null;
    }
  },

  setUser: (user: any): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    } catch (error) {
      console.error('Error storing user:', error);
    }
  },

  removeUser: (): void => {
    localStorage.removeItem(STORAGE_KEYS.USER);
  },

  getLastActive: (): number | null => {
    try {
      const lastActive = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
      return lastActive ? parseInt(lastActive, 10) : null;
    } catch (error) {
      console.error('Error parsing last active time:', error);
      return null;
    }
  },

  setLastActive: (): void => {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, Date.now().toString());
    } catch (error) {
      console.error('Error storing last active time:', error);
    }
  },

  removeLastActive: (): void => {
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
  },

  clearAll: (): void => {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE);
  },
};
