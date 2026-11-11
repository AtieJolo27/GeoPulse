/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * Global mocks for the Soil Monitor app tests.
 *
 * Everything that touches the network, native modules, Supabase, routing or heavy
 * SVG/chart rendering is replaced with a light stand-in, so the tests exercise
 * each screen's own logic (loading / error / empty / data states, user actions).
 *
 * Modules living in the project-root `lib/` folder (cache, supabaseClient, haptics, ...)
 * are replaced entirely, so their real implementation never runs in tests.
 */
const React = require('react');
const mocks = require('../helpers/mocks');
jest.setTimeout(30000);

// ------------------------------------------------------------- project modules
jest.mock('@/app/lib/AppContext', () => ({
  useApp: () => require('../helpers/mocks').appState.current,
  AppProvider: ({ children }) => children,
}));
jest.mock('@/lib/supabaseClient', () => ({ supabase: require('../helpers/mocks').supabaseMock }));
jest.mock('@/lib/cache', () => require('../helpers/mocks').cacheMock);
jest.mock('@/lib/haptics', () => require('../helpers/mocks').hapticsMock);
jest.mock('@/lib/exportSensorReadings', () => require('../helpers/mocks').exportSensorReadingsMock);
jest.mock('@/lib/getHistory', () => require('../helpers/mocks').historyLibMock);
jest.mock('@/lib/soilHealthScore', () => require('../helpers/mocks').soilScoreMock);
jest.mock('@/lib/apiConfig', () => require('../helpers/mocks').apiConfigMock);
jest.mock('@/app/lib/cropImages', () => ({
  getCropImage: jest.fn((name) => ({ uri: `crop:${name}` })),
  getFertilizerImage: jest.fn((name) => ({ uri: `fertilizer:${name}` })),
}));

// ------------------------------------------------------------------- libraries
jest.mock('expo-router', () => {
  const R = require('react');
  const m = require('../helpers/mocks');
  const Link = ({ children, href }) =>
    R.cloneElement(R.Children.only(children), {
      accessibilityHint: typeof href === 'string' ? href : JSON.stringify(href),
      onPress: () => m.routerState.push(href),
    });
  const Stack = ({ children }) => children;
  Stack.Screen = () => null;
  return {
    Link,
    Stack,
    router: m.routerState,
    useRouter: () => m.routerState,
    useLocalSearchParams: () => m.routerState.params,
  };
});

jest.mock('expo-linking', () => ({ openURL: jest.fn().mockResolvedValue(true) }));
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn().mockResolvedValue({ uri: 'file:///report.pdf' }) }));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@expo/vector-icons', () => {
  const R = require('react');
  const { View } = require('react-native');
  const Ionicons = ({ name, color, size }) =>
    R.createElement(View, { testID: `icon-${name}`, accessibilityLabel: name, color, size });
  return { Ionicons };
});

jest.mock('react-native-progress', () => {
  const R = require('react');
  const { View } = require('react-native');
  const Bar = (props) => R.createElement(View, { testID: 'progress-bar', progress: props.progress, color: props.color });
  return { Bar };
});

jest.mock('react-native-circular-progress', () => {
  const R = require('react');
  const { View } = require('react-native');
  const AnimatedCircularProgress = ({ fill, tintColor, children }) =>
    R.createElement(View, { testID: 'circular-progress', fill, tintColor }, children ? children(fill) : null);
  return { AnimatedCircularProgress };
});

jest.mock('react-native-chart-kit', () => {
  const R = require('react');
  const { View } = require('react-native');
  const m = require('../helpers/mocks');
  const LineChart = (props) => {
    m.chartState.props.push(props);
    return R.createElement(View, { testID: 'line-chart' });
  };
  return { LineChart };
});

jest.mock('react-native-svg', () => {
  const R = require('react');
  const { View, Text } = require('react-native');
  const passthrough = (testID) => (props) => R.createElement(View, { testID }, props.children);
  return {
    __esModule: true,
    default: passthrough('svg'),
    Svg: passthrough('svg'),
    Rect: passthrough('svg-rect'),
    Text: (props) => R.createElement(Text, null, props.children),
  };
});

// Expose the pull-to-refresh control so tests can trigger `onRefresh`.
jest.mock('react-native/Libraries/Components/RefreshControl/RefreshControl', () => {
  const R = require('react');
  const { View } = require('react-native');
  const RefreshControl = (props) =>
    R.createElement(View, { testID: 'refresh-control', refreshing: props.refreshing, onRefresh: props.onRefresh });
  return { __esModule: true, default: RefreshControl };
});

// ----------------------------------------------------------------- per-test reset
beforeEach(() => {
  mocks.resetAll();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
});
