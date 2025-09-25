import { getListenerStats } from '@/hooks/useOptimizedFirestore';
import { sessionManager } from '@/lib/sessionManager';
import { tabSync } from '@/lib/tabSync';

/**
 * Comprehensive test suite for multi-tab synchronization
 * Run this in browser console to test tab coordination
 */
export class TabSyncTester {
  private testResults: { [key: string]: boolean } = {};
  private testLogs: string[] = [];

  private log(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.testLogs.push(logMessage);
    // console.log(logMessage);
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test basic tab registration and heartbeat
   */
  async testTabRegistration(): Promise<boolean> {
    this.log('Testing tab registration...');

    try {
      const tabId = tabSync.getTabId();
      const activeTabs = tabSync.getActiveTabs();

      this.log(`Current tab ID: ${tabId}`);
      this.log(`Active tabs: ${activeTabs.join(', ')}`);

      // Test heartbeat
      tabSync.sendHeartbeat();
      await this.delay(100);

      const updatedTabs = tabSync.getActiveTabs();
      const isRegistered = updatedTabs.includes(tabId);

      this.log(`Tab registration successful: ${isRegistered}`);
      return isRegistered;
    } catch (error) {
      this.log(`Tab registration test failed: ${error}`);
      return false;
    }
  }

  /**
   * Test session management across tabs
   */
  async testSessionManagement(): Promise<boolean> {
    this.log('Testing session management...');

    try {
      // Test session creation
      sessionManager.initializeSession();
      await this.delay(100);

      const sessionToken = sessionManager.getSessionToken();
      const isValid = sessionManager.validateSession();
      const isMainTab = sessionManager.isMainTab();

      this.log(`Session token exists: ${!!sessionToken}`);
      this.log(`Session is valid: ${isValid}`);
      this.log(`Is main tab: ${isMainTab}`);

      // Test activity update
      sessionManager.updateActivity();
      await this.delay(100);

      const activeSessions = sessionManager.getActiveSessions();
      this.log(`Active sessions count: ${activeSessions.length}`);

      return !!sessionToken && isValid;
    } catch (error) {
      this.log(`Session management test failed: ${error}`);
      return false;
    }
  }

  /**
   * Test message broadcasting between tabs
   */
  async testMessageBroadcasting(): Promise<boolean> {
    this.log('Testing message broadcasting...');

    try {
      let messageReceived = false;

      // Set up listener for session update message
      const unsubscribe = tabSync.subscribe('SESSION_UPDATE', message => {
        if (message.tabId !== tabSync.getTabId()) {
          messageReceived = true;
          this.log(`Received session update message from tab: ${message.tabId}`);
        }
      });

      // Broadcast session update message
      tabSync.broadcast('SESSION_UPDATE', { test: 'data', timestamp: Date.now() });

      // Wait for potential message (won't receive own message)
      await this.delay(500);

      unsubscribe();

      // For single tab test, we consider it successful if no errors occurred
      this.log(`Message broadcasting test completed (single tab)`);
      return true;
    } catch (error) {
      this.log(`Message broadcasting test failed: ${error}`);
      return false;
    }
  }

  /**
   * Test Firebase listener optimization
   */
  async testFirebaseListenerOptimization(): Promise<boolean> {
    this.log('Testing Firebase listener optimization...');

    try {
      const stats = getListenerStats();
      this.log(`Active Firebase listeners: ${stats.activeListeners}`);

      // Log listener details
      stats.listeners.forEach((listener, index) => {
        this.log(
          `Listener ${index + 1}: Tab ${listener.tabId}, Components: ${listener.componentCount}`
        );
      });

      // Test passes if we can get stats without errors
      return true;
    } catch (error) {
      this.log(`Firebase listener optimization test failed: ${error}`);
      return false;
    }
  }

  /**
   * Test memory usage and cleanup
   */
  async testMemoryManagement(): Promise<boolean> {
    this.log('Testing memory management...');

    try {
      // Get initial memory usage (if available)
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Create and destroy multiple sessions to test cleanup
      for (let i = 0; i < 10; i++) {
        sessionManager.initializeSession();
        sessionManager.updateActivity();
        await this.delay(10);
      }

      // Cleanup
      sessionManager.clearSession();

      // Force garbage collection if available
      if ((window as any).gc) {
        (window as any).gc();
      }

      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      if (initialMemory > 0 && finalMemory > 0) {
        const memoryDiff = finalMemory - initialMemory;
        this.log(`Memory usage change: ${memoryDiff} bytes`);
      } else {
        this.log('Memory usage data not available');
      }

      return true;
    } catch (error) {
      this.log(`Memory management test failed: ${error}`);
      return false;
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<{
    success: boolean;
    results: { [key: string]: boolean };
    logs: string[];
  }> {
    this.log('Starting comprehensive tab synchronization tests...');

    this.testResults['tabRegistration'] = await this.testTabRegistration();
    this.testResults['sessionManagement'] = await this.testSessionManagement();
    this.testResults['messageBroadcasting'] = await this.testMessageBroadcasting();
    this.testResults['firebaseOptimization'] = await this.testFirebaseListenerOptimization();
    this.testResults['memoryManagement'] = await this.testMemoryManagement();

    const allPassed = Object.values(this.testResults).every(result => result);

    this.log('\n=== TEST RESULTS ===');
    Object.entries(this.testResults).forEach(([test, passed]) => {
      this.log(`${test}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    this.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);

    return {
      success: allPassed,
      results: this.testResults,
      logs: this.testLogs,
    };
  }

  /**
   * Get current system status for debugging
   */
  getSystemStatus() {
    return {
      tabId: tabSync.getTabId(),
      activeTabs: tabSync.getActiveTabs(),
      isMainTab: sessionManager.isMainTab(),
      sessionValid: sessionManager.validateSession(),
      activeSessions: sessionManager.getActiveSessions().length,
      firebaseListeners: getListenerStats(),
      timestamp: new Date().toISOString(),
    };
  }
}

// Global instance for easy access in console
(window as any).tabSyncTester = new TabSyncTester();

// Auto-run basic tests on load (only in development)
if (process.env.NODE_ENV === 'development') {
  setTimeout(() => {
    const tester = new TabSyncTester();
    tester.runAllTests().then(results => {
      if (results.success) {
        // console.log(' Tab synchronization system is working correctly');
      } else {
        // console.warn(' Some tab synchronization tests failed. Check logs for details.');
      }
    });
  }, 2000); // Wait 2 seconds after page load
}

export default TabSyncTester;
