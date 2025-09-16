// Set environment variables for Jest tests
process.env.NODE_ENV = 'test';
process.env.VITE_ENCRYPTION_SECRET = 'test-secret-key-32-characters-long';

// Mock import.meta for Vite environment variables
global.importMeta = {
  env: {
    VITE_ENCRYPTION_SECRET: 'test-secret-key-32-characters-long'
  }
};