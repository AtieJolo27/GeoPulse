#!/usr/bin/env node
/**
 * One-time helper: merges the Jest settings needed by the test-suite into package.json.
 * Safe to run more than once.   Usage:  node setup-jest.js
 */
const fs = require('fs');
const path = require('path');

const pkgPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(pkgPath)) {
  console.error('package.json not found - run this from your project root.');
  process.exit(1);
}
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

pkg.jest = {
  ...(pkg.jest || {}),
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup/jest.setup.js'],
  testMatch: ['<rootDir>/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\\.(jpg|jpeg|png|gif|webp)$': '<rootDir>/__tests__/setup/fileMock.js',
  },
  collectCoverageFrom: [
    'app/(tabs)/**/*.{ts,tsx}',
    'app/components/**/*.{ts,tsx}',
    'app/lib/exportSoilPDF.ts',
    '!app/(tabs)/**/_layout.tsx',
  ],
};

pkg.scripts = pkg.scripts || {};
pkg.devDependencies = pkg.devDependencies || {};
// Dev dependencies the test-suite needs that are missing from a default Expo 57 project:
//  - test-renderer:            peer dependency of @testing-library/react-native v14
//  - @react-native/jest-preset: peer dependency of jest-expo 57
const wanted = { 'test-renderer': '^1.3.1', '@react-native/jest-preset': '^0.86.3' };
let added = false;
for (const [name, version] of Object.entries(wanted)) {
  if (!pkg.devDependencies[name] && !(pkg.dependencies || {})[name]) {
    pkg.devDependencies[name] = version;
    console.log(`Added devDependency ${name}@${version}`);
    added = true;
  }
}
// keep keys sorted like npm does
pkg.devDependencies = Object.fromEntries(Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b)));

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Jest configuration written to package.json');
if (added) console.log('Now run: npm install');
