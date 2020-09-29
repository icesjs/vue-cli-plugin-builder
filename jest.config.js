module.exports = {
  testEnvironment: 'node',
  verbose: true,
  notify: false,
  collectCoverage: !!process.env.CI,
  coverageThreshold: {
    global: {
      // 暂时禁用
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testMatch: ['**/*.test.js'],
  testPathIgnorePatterns: ['.*/__fixtures__/.*'],
  collectCoverageFrom: ['<rootDir>/src/**/*.js'],
}
