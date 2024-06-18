/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  roots: ['<rootDir>/unitTest'],
  preset: "jest-puppeteer",
  transform: {
    "^.+\\.tsx?$": "jest-esbuild"
  }
  // testEnvironment: 'node',
};

