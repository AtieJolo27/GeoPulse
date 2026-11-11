import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import Fertilizers from '../app/(tabs)/fertilizer/fertilizers';
import BestFertilizer from '../app/components/BestFertilizer';
import RecommendedFertilizer from '../app/components/RecommendedFertilizer';
import { getFertilizerImage } from '../app/lib/cropImages';
import { cacheMock, channelMock, mockTable, routerState, setApp, supabaseMock, triggerRealtime } from './helpers/mocks';
import { flush, pullToRefresh } from './helpers/testUtils';

const prediction = (overrides: any = {}) => ({
  id: 1,
  best_fertilizer: 'urea',
  created_at: '2026-11-10T08:00:00Z',
  recommendations: [
    { fertilizer: 'dap', confidence: 55.5 },
    { fertilizer: 'urea', confidence: 88.2 },
    { fertilizer: 'compost', confidence: 0 },
    { fertilizer: '14-14-14', confidence: 30.1 },
  ],
  ...overrides,
});

const neverResolves = () =>
  supabaseMock.from.mockImplementation(() => ({ select: () => ({ order: () => new Promise(() => {}) }) }));

describe('Fertilizer tab', () => {
  describe('data loading', () => {
    it('shows the loading indicator while the first request is pending', async () => {
      neverResolves();
      await render(<Fertilizers />);
      expect(screen.getByText('Loading fertilizer recommendations...')).toBeTruthy();
    });

    it('queries fertilizer_predictions newest first', async () => {
      const builder = mockTable({ data: [prediction()], error: null });
      await render(<Fertilizers />);
      await flush();
      expect(supabaseMock.from).toHaveBeenCalledWith('fertilizer_predictions');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('subscribes to realtime changes and unsubscribes on unmount', async () => {
      mockTable({ data: [prediction()], error: null });
      const view = await render(<Fertilizers />);
      await flush();
      expect(supabaseMock.channel).toHaveBeenCalledWith('fertilizer_predictions');
      expect(channelMock.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fertilizer_predictions' },
        expect.any(Function)
      );
      await view.unmount();
      expect(supabaseMock.removeChannel).toHaveBeenCalledWith(channelMock);
    });

    it('re-fetches when a realtime change arrives', async () => {
      mockTable({ data: [prediction()], error: null });
      await render(<Fertilizers />);
      await flush();
      const before = supabaseMock.from.mock.calls.length;
      await act(async () => {
        await triggerRealtime({ eventType: 'UPDATE' });
      });
      expect(supabaseMock.from.mock.calls.length).toBe(before + 1);
    });

    it('saves fetched predictions to the cache', async () => {
      const rows = [prediction()];
      mockTable({ data: rows, error: null });
      await render(<Fertilizers />);
      await flush();
      expect(cacheMock.setCache).toHaveBeenCalledWith(cacheMock.CACHE_KEYS.FERTILIZER_PREDICTIONS, rows);
    });

    it('does not write an empty result to the cache', async () => {
      mockTable({ data: [], error: null });
      await render(<Fertilizers />);
      await flush();
      expect(cacheMock.setCache).not.toHaveBeenCalled();
    });

    it('renders cached predictions immediately while the network request is pending', async () => {
      cacheMock.getCache.mockResolvedValue([prediction()]);
      neverResolves();
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('What fertilizer should you use?')).toBeTruthy();
      expect(screen.queryByText('Loading fertilizer recommendations...')).toBeNull();
    });
  });

  describe('error and empty states', () => {
    it('shows the error screen with the message when the request fails and there is no cache', async () => {
      mockTable({ data: null, error: { message: 'timeout' } });
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('Error Loading Fertilizers')).toBeTruthy();
      expect(screen.getByText('timeout')).toBeTruthy();
    });

    it('retries when Retry is pressed', async () => {
      mockTable({ data: null, error: { message: 'timeout' } });
      await render(<Fertilizers />);
      await flush();
      const before = supabaseMock.from.mock.calls.length;

      mockTable({ data: [prediction()], error: null });
      await fireEvent.press(screen.getByText('Retry'));
      await flush();

      expect(supabaseMock.from.mock.calls.length).toBeGreaterThan(before);
      expect(screen.getByText('What fertilizer should you use?')).toBeTruthy();
    });

    it('falls back to cached data when the request fails', async () => {
      cacheMock.getCache.mockResolvedValueOnce(null).mockResolvedValue([prediction()]);
      mockTable({ data: null, error: { message: 'offline' } });
      await render(<Fertilizers />);
      await flush(5);
      expect(screen.getByText('What fertilizer should you use?')).toBeTruthy();
      expect(screen.queryByText('Error Loading Fertilizers')).toBeNull();
    });

    it('shows the empty state when there are no predictions', async () => {
      mockTable({ data: [], error: null });
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('No Recommendations Yet')).toBeTruthy();
      expect(screen.getByText('Submit soil sensor readings to get fertilizer recommendations.')).toBeTruthy();
      expect(screen.getByTestId('icon-flask-outline')).toBeTruthy();
    });
  });

  describe('recommendation list', () => {
    beforeEach(() => {
      mockTable({ data: [prediction()], error: null });
    });

    it('shows the highest-confidence fertilizer as the best recommendation', async () => {
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('Recommended fertilizer')).toBeTruthy();
      expect(screen.getByText('88%')).toBeTruthy();
      expect(screen.getByText('Recommended based on your current soil nutrients.')).toBeTruthy();
    });

    it('lists remaining fertilizers by confidence and drops 0% entries', async () => {
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('Other suitable fertilizers')).toBeTruthy();
      expect(screen.getByText('dap')).toBeTruthy();
      expect(screen.getByText('56%')).toBeTruthy(); // 55.5 rounds up
      expect(screen.getByText('14-14-14')).toBeTruthy();
      expect(screen.getByText('30%')).toBeTruthy();
      expect(screen.queryByText('compost')).toBeNull();

      const order = screen.getAllByText(/^(dap|14-14-14)$/).map((node) => node.props.children);
      expect(order).toEqual(['dap', '14-14-14']);
    });

    it('uses only the newest prediction', async () => {
      mockTable({
        data: [
          prediction({ id: 2, best_fertilizer: 'compost', recommendations: [{ fertilizer: 'compost', confidence: 70 }] }),
          prediction({ id: 1 }),
        ],
        error: null,
      });
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('70%')).toBeTruthy();
      expect(screen.queryByText('dap')).toBeNull();
    });

    it('shows a placeholder when only one fertilizer is recommended', async () => {
      mockTable({
        data: [prediction({ recommendations: [{ fertilizer: 'urea', confidence: 90 }] })],
        error: null,
      });
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('No other fertilizer recommendations yet.')).toBeTruthy();
    });

    it('renders Tagalog copy when the language is Tagalog', async () => {
      setApp({ language: 'tagalog' });
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('Anong pataba ang dapat ninyong gamitin?')).toBeTruthy();
      expect(screen.getByText('Iba pang angkop na pataba')).toBeTruthy();
    });

    it('scales text with the selected font scale', async () => {
      setApp({ fontScale: 0.85 });
      await render(<Fertilizers />);
      await flush();
      expect(screen.getByText('What fertilizer should you use?').props.style.fontSize).toBe(Math.round(24 * 0.85));
    });

    it('pull-to-refresh fetches again', async () => {
      await render(<Fertilizers />);
      await flush();
      const before = supabaseMock.from.mock.calls.length;
      await pullToRefresh();
      await flush();
      expect(supabaseMock.from.mock.calls.length).toBeGreaterThan(before);
    });
  });

  describe('navigation', () => {
    it('opens the reasoning screen for the best fertilizer', async () => {
      mockTable({ data: [prediction()], error: null });
      await render(<Fertilizers />);
      await flush();
      await fireEvent.press(screen.getByText('Recommended fertilizer'));
      expect(routerState.push).toHaveBeenCalledWith({
        pathname: '/(tabs)/fertilizer/reasoning',
        params: { fertilizer: 'urea' },
      });
    });

    it('opens the reasoning screen for another fertilizer', async () => {
      mockTable({ data: [prediction()], error: null });
      await render(<Fertilizers />);
      await flush();
      await fireEvent.press(screen.getByText('dap'));
      expect(routerState.push).toHaveBeenCalledWith({
        pathname: '/(tabs)/fertilizer/reasoning',
        params: { fertilizer: 'dap' },
      });
    });
  });
});

describe('BestFertilizer card', () => {
  it.each([
    [95, 'checkmark-circle'],
    [80, 'checkmark-circle'],
    [60, 'alert-circle'],
    [46, 'alert-circle'],
    [45, 'close-circle'],
    [10, 'close-circle'],
  ])('%i%% match shows the %s status icon', async (percentage, icon) => {
    await render(<BestFertilizer fertilizer_name="urea" percentage={percentage} />);
    expect(screen.getByTestId(`icon-${icon}`)).toBeTruthy();
    expect(screen.getByText(`${percentage}%`)).toBeTruthy();
  });

  it('passes confidence as a 0-1 progress value and loads the fertilizer image', async () => {
    await render(<BestFertilizer fertilizer_name="Urea" percentage={40} />);
    expect(screen.getByTestId('progress-bar').props.progress).toBe(0.4);
    expect(getFertilizerImage).toHaveBeenCalledWith('Urea');
  });
});

describe('RecommendedFertilizer row', () => {
  it('shows name, percentage and bar', async () => {
    await render(<RecommendedFertilizer fertilizer_name="dap" percentage={56} />);
    expect(screen.getByText('dap')).toBeTruthy();
    expect(screen.getByText('56%')).toBeTruthy();
    expect(screen.getByTestId('progress-bar').props.progress).toBe(0.56);
  });

  it.each([
    [85, 'checkmark-circle'],
    [50, 'alert-circle'],
    [20, 'close-circle'],
  ])('%i%% uses %s', async (percentage, icon) => {
    await render(<RecommendedFertilizer fertilizer_name="dap" percentage={percentage} />);
    expect(screen.getByTestId(`icon-${icon}`)).toBeTruthy();
  });
});
