// Global test setup
global.console = {
  ...console,
  // Suppress console.log in tests unless needed
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.AWS_REGION = 'us-east-1'
process.env.GITHUB_TOKEN = 'test-token'