# Multi-Tab Synchronization Integration Guide

## Overview

This system prevents application freezing when multiple browser tabs are open by implementing:

1. **Tab Synchronization**: Uses BroadcastChannel API for inter-tab communication
2. **Session Management**: Tab-specific session tokens prevent conflicts
3. **Firebase Optimization**: Prevents duplicate listeners and memory leaks
4. **Automatic Cleanup**: Removes inactive tabs and unused listeners

## Key Components

### 1. TabSyncManager (`/lib/tabSync.ts`)

- Manages tab registration and heartbeats
- Handles inter-tab message broadcasting
- Tracks active tabs and determines main tab

### 2. Enhanced SessionManager (`/lib/sessionManager.ts`)

- Tab-specific session storage
- Automatic cleanup of inactive sessions
- Coordinated logout across tabs

### 3. Optimized Auth Context (`/hooks/auth-context.tsx`)

- Only main tab handles Firebase auth state changes
- Broadcasts auth changes to other tabs
- Prevents duplicate Firebase listeners

### 4. Optimized Firestore Hook (`/hooks/useOptimizedFirestore.ts`)

- Prevents duplicate Firestore listeners
- Automatic cleanup of unused listeners
- Memory leak prevention

## How It Works

### Tab Coordination

1. Each tab gets a unique ID on load
2. Tabs send heartbeats every 30 seconds
3. Main tab is determined by earliest active tab
4. Inactive tabs are cleaned up automatically

### Session Management

```typescript
// Sessions are stored per tab
{
  "tab_sessions": {
    "tab_123": {
      "sessionToken": "token_abc",
      "userId": "user_456",
      "lastActivity": 1234567890,
      "userData": { ... }
    }
  }
}
```

### Firebase Optimization

- Only main tab creates Firebase auth listeners
- Auth state changes are broadcast to other tabs
- Firestore listeners are shared and reference-counted
- Automatic cleanup prevents memory leaks

## Testing the Solution

### Automatic Testing

The system includes automatic tests that run in development mode:

```typescript
// Access the tester in browser console
window.tabSyncTester.runAllTests();

// Get current system status
window.tabSyncTester.getSystemStatus();
```

### Manual Testing Steps

1. **Open Multiple Tabs**
   - Open 3-4 tabs of the application
   - Verify no freezing occurs
   - Check browser console for any errors

2. **Test Authentication**
   - Login in one tab
   - Verify other tabs sync the login state
   - Logout from any tab
   - Verify all tabs logout simultaneously

3. **Test Data Synchronization**
   - Make changes in one tab (e.g., add transaction)
   - Verify changes appear in other tabs
   - Check that only one tab is making Firebase calls

4. **Test Tab Cleanup**
   - Close some tabs
   - Verify remaining tabs continue working
   - Check that resources are cleaned up

### Debug Information

Use browser console to check system status:

```javascript
// Check active tabs
console.log('Active tabs:', tabSync.getActiveTabs());

// Check Firebase listeners
console.log('Firebase listeners:', getListenerStats());

// Check session status
console.log('Session valid:', sessionManager.validateSession());
console.log('Is main tab:', sessionManager.isMainTab());
```

## Performance Benefits

### Before (Issues)

- Multiple Firebase auth listeners per tab
- Duplicate Firestore subscriptions
- Session conflicts in localStorage
- Memory leaks from uncleaned listeners
- Race conditions causing freezing

### After (Solutions)

- Single Firebase auth listener (main tab only)
- Shared Firestore listeners with reference counting
- Tab-specific session management
- Automatic cleanup of inactive resources
- Coordinated state management

## Monitoring

The system provides built-in monitoring:

```typescript
// Get listener statistics
const stats = getListenerStats();
console.log(`Active listeners: ${stats.activeListeners}`);

// Get tab information
const tabInfo = {
  currentTab: tabSync.getTabId(),
  activeTabs: tabSync.getActiveTabs(),
  isMainTab: sessionManager.isMainTab(),
};
```

## Troubleshooting

### If tabs still freeze:

1. Check browser console for errors
2. Verify BroadcastChannel API support
3. Run the test suite: `window.tabSyncTester.runAllTests()`
4. Check if localStorage is accessible

### If authentication doesn't sync:

1. Verify main tab is handling auth changes
2. Check BroadcastChannel messages in Network tab
3. Ensure sessionManager is properly initialized

### If data doesn't sync:

1. Check Firestore listener statistics
2. Verify components are using optimized hooks
3. Check for JavaScript errors blocking execution

## Migration Notes

Existing components should continue working without changes. The optimizations are:

- **Automatic**: Auth context and session management
- **Optional**: Use `useOptimizedFirestore` for new components
- **Backward Compatible**: Existing Firebase usage still works

No breaking changes were introduced to maintain existing functionality.
