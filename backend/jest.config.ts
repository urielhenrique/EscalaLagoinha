import type { Config } from "jest";

const config: Config = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  collectCoverageFrom: [
    "**/*.service.ts",
    "**/*.controller.ts",
    "!**/*.module.ts",
    "!**/main.ts",
  ],
  coverageDirectory: "../coverage",
  coverageReporters: ["text", "text-summary"],
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
};

export default config;
