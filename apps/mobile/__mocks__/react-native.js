'use strict';
/**
 * Minimal react-native mock for ts-jest based tests (onboarding-unit project).
 *
 * Components are rendered as STRING host elements (e.g. 'View', 'Text') so that
 * react-test-renderer and @testing-library/react-native can correctly distinguish
 * host elements from composite components (RNTL checks `typeof node.type === 'string'`).
 */

const React = require('react');

// Create a host component that renders as a string type element.
// This is what react-test-renderer treats as a "native/host" component.
function makeHostComponent(name) {
  function HostComp(props) {
    const { children, onPress, ...rest } = props || {};
    // Render as a plain string element so react-test-renderer marks type as 'string'
    return React.createElement(name, { ...rest, onClick: onPress }, children);
  }
  HostComp.displayName = name;
  return HostComp;
}

const View = makeHostComponent('View');
const Text = makeHostComponent('Text');
const Pressable = makeHostComponent('Pressable');
const TouchableOpacity = makeHostComponent('TouchableOpacity');
const ScrollView = makeHostComponent('ScrollView');
const FlatList = makeHostComponent('FlatList');
const SafeAreaView = makeHostComponent('SafeAreaView');
const Image = makeHostComponent('Image');
const TextInput = makeHostComponent('TextInput');
const Modal = makeHostComponent('Modal');
// Switch is needed by RNTL's host component detection
const Switch = makeHostComponent('Switch');
const ActivityIndicator = makeHostComponent('ActivityIndicator');

const StyleSheet = {
  create: (styles) => styles,
  flatten: (styles) => styles,
  hairlineWidth: 0.5,
  absoluteFill: {},
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
};

const Platform = {
  OS: 'ios',
  Version: '16.0',
  isPad: false,
  isTVOS: false,
  isTV: false,
  select: (obj) => (obj != null && 'ios' in obj ? obj.ios : obj.default),
};

const Linking = {
  openURL: jest.fn().mockResolvedValue(null),
  openSettings: jest.fn().mockResolvedValue(null),
  canOpenURL: jest.fn().mockResolvedValue(true),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

const Animated = {
  View: makeHostComponent('Animated.View'),
  Text: makeHostComponent('Animated.Text'),
  Value: jest.fn(() => ({
    setValue: jest.fn(),
    interpolate: jest.fn(() => ({})),
    addListener: jest.fn(),
    removeListener: jest.fn(),
  })),
  timing: jest.fn(() => ({ start: jest.fn() })),
  spring: jest.fn(() => ({ start: jest.fn() })),
  sequence: jest.fn(() => ({ start: jest.fn() })),
  parallel: jest.fn(() => ({ start: jest.fn() })),
  createAnimatedComponent: (comp) => comp,
};

const Dimensions = {
  get: jest.fn(() => ({ width: 375, height: 812 })),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

const Alert = {
  alert: jest.fn(),
};

const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  removeAllListeners: jest.fn(),
};

const AccessibilityInfo = {
  isScreenReaderEnabled: jest.fn().mockResolvedValue(false),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

const NativeModules = {};

const I18nManager = {
  isRTL: false,
  forceRTL: jest.fn(),
};

const findNodeHandle = jest.fn(() => null);

module.exports = {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  FlatList,
  SafeAreaView,
  Image,
  TextInput,
  Modal,
  Switch,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Linking,
  Animated,
  Dimensions,
  Alert,
  Keyboard,
  AccessibilityInfo,
  AppState,
  NativeModules,
  I18nManager,
  findNodeHandle,
  useColorScheme: jest.fn(() => 'light'),
  useWindowDimensions: jest.fn(() => ({ width: 375, height: 812, scale: 2, fontScale: 1 })),
};
