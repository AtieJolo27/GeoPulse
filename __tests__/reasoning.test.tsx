import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Linking from 'expo-linking';
import React from 'react';
import CropReasoning from '../app/(tabs)/crop/reasoning';
import FertilizerReasoning from '../app/(tabs)/fertilizer/reasoning';
import { apiConfigMock, createQueryBuilder, routerState, setApp, supabaseMock } from './helpers/mocks';
import { flush } from './helpers/testUtils';

const soil = {
  id: 1,
  best_crop: 'rice',
  recommendations: [
    { crop: 'rice', confidence: 91 },
    { crop: 'maize', confidence: 60 },
  ],
  nitrogen: 30,
  phosphorus: 20,
  potassium: 150,
  ph: 6.8,
  air_temperature: 29,
  humidity: 65,
};

const aiReply = (data: string, ok = true, status = 200) =>
  jest.fn().mockResolvedValue({ ok, status, json: async () => (ok ? { data } : { error: data }) });

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

// The same behaviours apply to both screens - run them against each.
const screens = [
  {
    name: 'Crop reasoning',
    Screen: CropReasoning,
    param: { crop: 'maize' },
    chosen: 'maize',
    selectArg: undefined as string | undefined,
    promptWord: 'crop recommendation for maize',
  },
  {
    name: 'Fertilizer reasoning',
    Screen: FertilizerReasoning,
    param: { fertilizer: 'urea' },
    chosen: 'urea',
    selectArg: 'nitrogen, phosphorus, potassium, ph, air_temperature, humidity',
    promptWord: 'fertilizer recommendation for urea',
  },
] as const;

describe.each(screens)('$name screen', ({ Screen, param, chosen, selectArg, promptWord }) => {
  const setup = (row: any = soil, error: any = null) => {
    const builder = createQueryBuilder({ data: row, error });
    supabaseMock.from.mockImplementation(() => builder);
    return builder;
  };

  it('shows a loading message while soil data loads', async () => {
    routerState.params = param;
    supabaseMock.from.mockImplementation(() => ({
      select: () => ({ order: () => ({ limit: () => ({ single: () => new Promise(() => {}) }) }) }),
    }));
    await render(<Screen />);
    expect(screen.getByText('Loading soil data...')).toBeTruthy();
  });

  it('loads only the newest soil record', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('ok');
    const builder = setup();
    await render(<Screen />);
    await flush();
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(1);
    expect(builder.single).toHaveBeenCalled();
    if (selectArg) expect(builder.select).toHaveBeenCalledWith(selectArg);
  });

  it('shows an error when the soil data cannot be loaded', async () => {
    routerState.params = param;
    setup(null, { message: 'permission denied' });
    await render(<Screen />);
    await flush();
    expect(screen.getByText('Error Loading Data')).toBeTruthy();
    expect(screen.getByText('permission denied')).toBeTruthy();
  });

  it('shows the selected item and the current soil status', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('Looks good.');
    setup();
    await render(<Screen />);
    await flush();
    expect(screen.getByText(chosen)).toBeTruthy();
    expect(screen.getByText('Current Soil Status')).toBeTruthy();
    expect(screen.getByText('N: 30 | P: 20 | K: 150 | pH: 6.8')).toBeTruthy();
    expect(screen.getByText('Temp: 29°C | Humidity: 65%')).toBeTruthy();
  });

  it('sends the soil readings to the AI endpoint in English', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('Looks good.');
    setup();
    await render(<Screen />);
    await flush();

    expect(apiConfigMock.getApiUrl).toHaveBeenCalledWith('/api/groq');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://test.local/api/groq');
    expect(init.method).toBe('POST');
    const { prompt } = JSON.parse(init.body);
    expect(prompt).toContain(promptWord);
    expect(prompt).toContain('Nitrogen (N): 30');
    expect(prompt).toContain('Phosphorus (P): 20');
    expect(prompt).toContain('Potassium (K): 150');
    expect(prompt).toContain('pH level: 6.8');
    expect(prompt).toContain('Respond entirely in English.');
  });

  it('asks the AI to answer in Tagalog when the app is in Tagalog', async () => {
    setApp({ language: 'tagalog' });
    routerState.params = param;
    globalThis.fetch = aiReply('Mabuti.');
    setup();
    await render(<Screen />);
    await flush();
    const { prompt } = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(prompt).toContain('Respond entirely in Tagalog (Filipino)');
  });

  it('shows a spinner message while the AI is answering', async () => {
    routerState.params = param;
    globalThis.fetch = jest.fn(() => new Promise(() => {})) as any;
    setup();
    await render(<Screen />);
    await flush();
    expect(screen.getByText('✨ AI Suitability Analysis')).toBeTruthy();
    expect(screen.getByText('Analyzing soil nutrient fit...')).toBeTruthy();
  });

  it('shows the AI answer without the trailing "References:" block', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('Planting is advisable. Nitrogen is adequate.\n\nReferences: [1] made up source');
    setup();
    await render(<Screen />);
    await flush();
    expect(screen.getByText('Planting is advisable. Nitrogen is adequate.')).toBeTruthy();
    expect(screen.queryByText(/made up source/)).toBeNull();
  });

  it('lists the three trusted reference links and opens them', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('Fine.');
    setup();
    await render(<Screen />);
    await flush();

    expect(screen.getByText('Sources — tap to open')).toBeTruthy();
    const link = screen.getByText('[1] DA-BSWM FertMap — crop-specific soil guidance');
    expect(screen.getByText('[2] DA-BSWM National Soil Health Program')).toBeTruthy();
    expect(screen.getByText('[3] FAO — Soil fertility guidance')).toBeTruthy();

    await fireEvent.press(link);
    expect(Linking.openURL).toHaveBeenCalledWith('https://nshp.bswm.da.gov.ph/fertmap/');
  });

  it('shows a message when a reference link cannot be opened', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('Fine.');
    (Linking.openURL as jest.Mock).mockRejectedValueOnce(new Error('no browser'));
    setup();
    await render(<Screen />);
    await flush();
    await fireEvent.press(screen.getByText('[3] FAO — Soil fertility guidance'));
    await waitFor(() => expect(screen.getByText('Unable to open this reference on this device.')).toBeTruthy());
  });

  it('shows the AI error returned by the server', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('rate limited', false, 429);
    setup();
    await render(<Screen />);
    await flush();
    expect(screen.getByText('AI analysis unavailable.')).toBeTruthy();
    expect(screen.getByText('rate limited')).toBeTruthy();
  });

  it('shows an error when the AI server cannot be reached', async () => {
    routerState.params = param;
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network request failed')) as any;
    setup();
    await render(<Screen />);
    await flush();
    expect(screen.getByText('AI analysis unavailable.')).toBeTruthy();
    expect(screen.getByText('Network request failed')).toBeTruthy();
  });

  it('falls back to "No explanation returned." when the AI replies with nothing', async () => {
    routerState.params = param;
    globalThis.fetch = aiReply('');
    setup();
    await render(<Screen />);
    await flush();
    expect(screen.getByText('No explanation returned.')).toBeTruthy();
  });

  it('shows Tagalog headings', async () => {
    setApp({ language: 'tagalog' });
    routerState.params = param;
    globalThis.fetch = aiReply('Mabuti.');
    setup();
    await render(<Screen />);
    await flush();
    expect(screen.getByText('Kasalukuyang Katayuan ng Lupa')).toBeTruthy();
    expect(screen.getByText('Mga Sanggunian — pindutin upang buksan')).toBeTruthy();
  });
});

describe('Crop reasoning - crop specific behaviour', () => {
  const setup = () => {
    supabaseMock.from.mockImplementation(() => createQueryBuilder({ data: soil, error: null }));
  };

  it('shows the confidence score of the selected crop', async () => {
    routerState.params = { crop: 'maize' };
    globalThis.fetch = aiReply('ok');
    setup();
    await render(<CropReasoning />);
    await flush();
    expect(screen.getByText('60% confidence score')).toBeTruthy();
  });

  it('matches the crop name case-insensitively', async () => {
    routerState.params = { crop: 'RICE' };
    globalThis.fetch = aiReply('ok');
    setup();
    await render(<CropReasoning />);
    await flush();
    expect(screen.getByText('91% confidence score')).toBeTruthy();
  });

  it('defaults to the best crop when none is selected', async () => {
    routerState.params = {};
    globalThis.fetch = aiReply('ok');
    setup();
    await render(<CropReasoning />);
    await flush();
    expect(screen.getByText('rice')).toBeTruthy();
    const { prompt } = JSON.parse((globalThis.fetch as jest.Mock).mock.calls[0][1].body);
    expect(prompt).toContain('crop recommendation for rice');
  });

  it('hides the confidence line for a crop that is not in the recommendations', async () => {
    routerState.params = { crop: 'durian' };
    globalThis.fetch = aiReply('ok');
    setup();
    await render(<CropReasoning />);
    await flush();
    expect(screen.queryByText(/confidence score/)).toBeNull();
  });

  it('shows Tagalog confidence text', async () => {
    setApp({ language: 'tagalog' });
    routerState.params = { crop: 'maize' };
    globalThis.fetch = aiReply('ok');
    setup();
    await render(<CropReasoning />);
    await flush();
    expect(screen.getByText('60% puntos ng kumpiyansa')).toBeTruthy();
  });
});

describe('Fertilizer reasoning - fertilizer specific behaviour', () => {
  it('does not call the AI when no fertilizer is selected', async () => {
    routerState.params = {};
    globalThis.fetch = aiReply('ok');
    supabaseMock.from.mockImplementation(() =>
      createQueryBuilder({ data: { nitrogen: 1, phosphorus: 2, potassium: 3, ph: 7, air_temperature: 28, humidity: 60 }, error: null })
    );
    await render(<FertilizerReasoning />);
    await flush();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Awaiting metrics to analyze...')).toBeTruthy();
  });
});
