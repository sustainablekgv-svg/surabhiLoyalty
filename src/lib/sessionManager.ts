const INACTIVITY_TIMEOUT_MINUTES = 30;

export const sessionManager = {
  isSessionExpired: (): boolean => {
    const lastActive = localStorage.getItem('lastActive');
    if (!lastActive) return true;

    const now = Date.now();
    const inactiveMinutes = (now - parseInt(lastActive, 10)) / (1000 * 60);
    return inactiveMinutes > INACTIVITY_TIMEOUT_MINUTES;
  },

  updateActivity: (): void => {
    localStorage.setItem('lastActive', Date.now().toString());
  },

  clearSession: (): void => {
    localStorage.removeItem('user');
    localStorage.removeItem('lastActive');
  },
};
