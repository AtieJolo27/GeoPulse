/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared, mutable mock state used by the global mocks in setup/jest.setup.js
 * and by the individual test files.
 */

// ---------------------------------------------------------------- App context
const DEFAULT_ZONES = [
  { id: 1, name_en: 'Zone A', name_tl: 'Sona A', soil_type: 'Loam' },
  { id: 2, name_en: 'Zone B', name_tl: 'Sona B', soil_type: 'Clay' },
];

function buildApp(overrides: Record<string, any> = {}): any {
  const language = overrides.language ?? 'english';
  return {
    theme: 'light',
    toggleTheme: jest.fn(),
    isDarkMode: false,
    language,
    setLanguage: jest.fn(),
    t: (en: string, tl: string) => (language === 'english' ? en : tl),
    user: null,
    login: jest.fn(),
    logout: jest.fn(),
    loading: false,
    fontSize: 'medium',
    setFontSize: jest.fn(),
    fontScale: 1,
    zones: DEFAULT_ZONES,
    zonesLoading: false,
    activeZoneId: 1,
    setActiveZoneId: jest.fn().mockResolvedValue(undefined),
    createZone: jest.fn().mockResolvedValue(null),
    refreshZones: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const appState: { current: any } = { current: buildApp() };
const setApp = (overrides: Record<string, any> = {}): any => {
  appState.current = buildApp(overrides);
  return appState.current;
};

// -------------------------------------------------------------------- Router
const routerState: { params: Record<string, any>; push: jest.Mock; replace: jest.Mock } = { params: {}, push: jest.fn(), replace: jest.fn() };

// ------------------------------------------------------------------ Supabase
/**
 * Creates a chainable, awaitable Supabase query builder:
 *   supabase.from('x').select().order().limit()  -> resolves to `result`
 */
function createQueryBuilder(result: any): any {
  const builder: any = {};
  ['select', 'order', 'limit', 'eq', 'gte', 'lte', 'insert', 'update'].forEach((m) => {
    builder[m] = jest.fn(() => builder);
  });
  builder.single = jest.fn(() => Promise.resolve(result));
  builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const channelMock: any = {
  on: jest.fn(),
  subscribe: jest.fn(),
};
channelMock.on.mockImplementation(() => channelMock);
channelMock.subscribe.mockImplementation(() => channelMock);

const supabaseMock: any = {
  from: jest.fn(),
  channel: jest.fn(() => channelMock),
  removeChannel: jest.fn(),
  auth: {
    signInWithPassword: jest.fn(),
    signOut: jest.fn(),
    getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
  },
};

/** Make supabase.from(table) resolve to { data, error } for a given table (or every table). */
function mockTable(result: any, table?: string): any {
  const builder = createQueryBuilder(result);
  if (table) {
    const prev = supabaseMock.from.getMockImplementation();
    supabaseMock.from.mockImplementation((name: string) =>
      name === table ? builder : prev ? prev(name) : createQueryBuilder({ data: [], error: null })
    );
  } else {
    supabaseMock.from.mockImplementation(() => builder);
  }
  return builder;
}

/** Fire the realtime "postgres_changes" callback that the screen registered. */
function triggerRealtime(payload: any = {}): any {
  const call = channelMock.on.mock.calls.find((c: any[]) => c[0] === 'postgres_changes');
  if (!call) throw new Error('Screen did not subscribe to postgres_changes');
  return call[2](payload);
}

// --------------------------------------------------------------------- Cache
const CACHE_KEYS = {
  CROP_PREDICTIONS: 'crop_predictions',
  FERTILIZER_PREDICTIONS: 'fertilizer_predictions',
  IRRIGATION_RECOMMENDATIONS: 'irrigation_recommendations',
  SENSOR_READINGS: 'sensor_readings',
};
const cacheMock: any = {
  CACHE_KEYS,
  getCache: jest.fn().mockResolvedValue(null),
  setCache: jest.fn().mockResolvedValue(undefined),
};

// ------------------------------------------------------------------- Charts
const chartState: { props: any[] } = { props: [] };

// ------------------------------------------------------------- Other lib mocks
const hapticsMock: any = {
  lightHaptic: jest.fn(),
  mediumHaptic: jest.fn(),
  warningHaptic: jest.fn(),
};
const exportSensorReadingsMock = { exportSensorReadingsPdf: jest.fn().mockResolvedValue(undefined) };
const historyLibMock = { getSoilHistory: jest.fn().mockResolvedValue([]) };
const soilScoreMock: any = {
  computeSoilHealthScore: jest.fn(),
  computeOverallScore: jest.fn((row: any) => (row && row.__score !== undefined ? row.__score : 75)),
};
const apiConfigMock = { getApiUrl: jest.fn((path: string) => `http://test.local${path}`) };

function resetAll(): void {
  jest.clearAllMocks();
  appState.current = buildApp();
  routerState.params = {};
  chartState.props = [];

  supabaseMock.from.mockReset();
  supabaseMock.from.mockImplementation(() => createQueryBuilder({ data: [], error: null }));
  channelMock.on.mockReset();
  channelMock.subscribe.mockReset();
  channelMock.on.mockImplementation(() => channelMock);
  channelMock.subscribe.mockImplementation(() => channelMock);
  supabaseMock.channel.mockImplementation(() => channelMock);

  cacheMock.getCache.mockReset();
  cacheMock.getCache.mockResolvedValue(null);
  cacheMock.setCache.mockReset();
  cacheMock.setCache.mockResolvedValue(undefined);

  exportSensorReadingsMock.exportSensorReadingsPdf.mockReset();
  exportSensorReadingsMock.exportSensorReadingsPdf.mockResolvedValue(undefined);
  historyLibMock.getSoilHistory.mockReset();
  historyLibMock.getSoilHistory.mockResolvedValue([]);
  soilScoreMock.computeSoilHealthScore.mockReset();
  soilScoreMock.computeSoilHealthScore.mockReturnValue(defaultSoilScore());
  soilScoreMock.computeOverallScore.mockReset();
  soilScoreMock.computeOverallScore.mockImplementation((row: any) =>
    row && row.__score !== undefined ? row.__score : 75
  );
}

function defaultSoilScore(): any {
  return {
    overall: 82,
    factors: [
      { label: 'Nitrogen', optimalMin: 20, optimalMax: 40, unit: 'ppm', score: 90 },
      { label: 'Soil pH', optimalMin: 6, optimalMax: 7.5, unit: '', score: 55 },
    ],
    interpretation: { en: 'Soil is in good condition.', tl: 'Maayos ang lupa.' },
  };
}

export {
  DEFAULT_ZONES,
  appState,
  setApp,
  routerState,
  createQueryBuilder,
  channelMock,
  supabaseMock,
  mockTable,
  triggerRealtime,
  cacheMock,
  chartState,
  hapticsMock,
  exportSensorReadingsMock,
  historyLibMock,
  soilScoreMock,
  apiConfigMock,
  defaultSoilScore,
  resetAll,
};
