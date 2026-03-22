// Minimal React Native test environment setup
// Replaces react-native/jest/setup.js to avoid @react-native/js-polyfills Flow syntax
// which ts-jest cannot parse.

global.IS_REACT_ACT_ENVIRONMENT = true;
global.IS_REACT_NATIVE_TEST_ENVIRONMENT = true;
global.__DEV__ = true;

// Mock NativeModules that react-native components rely on
global.__fbBatchedBridgeConfig = {};

// Silence the react-test-renderer warning about act()
const originalError = console.error;
console.error = (...args) => {
  if (
    args[0] &&
    typeof args[0] === 'string' &&
    (args[0].includes('Warning: An update to') ||
      args[0].includes('act(...)'))
  ) {
    return;
  }
  originalError(...args);
};
