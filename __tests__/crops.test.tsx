import { fireEvent, render, screen, act } from '@testing-library/react-native';
import React from 'react';
import Crops from '../app/(tabs)/crop/crops';
import BestCrop from '../app/components/BestCrop';
import RecommendedCrops from '../app/components/RecommendedCrops';
import { getCropImage } from '../app/lib/cropImages';
import { cacheMock, channelMock, mockTable, routerState, setApp, supabaseMock, triggerRealtime } from './helpers/mocks';
import { flush, pullToRefresh } from './helpers/testUtils';

const prediction = (overrides: any = {}) => ({
  id: 1,
  best_crop: 'rice',
  created_at: '2026-11-10T08:00:00Z',
  recommendations: [
    { crop: 'maize', confidence: 62.4 },
    { crop: 'rice', confidence: 91.6 },
    { crop: 'banana', confidence: 0 },
    { crop: 'mango', confidence: 48.2 },
  ],
  ...overrides,
});

describe('Crops tab', () => {
  describe('data loading', () => {
    it('shows the loading indicator while the first request is pending', async () => {
      supabaseMock.from.mockImplementation(() => ({
        select: () => ({ order: () => new Promise(() => {}) }),
      }));
      await render(<Crops />);
      expect(screen.getByText('Loading crop recommendations...')).toBeTruthy();
    });

    it('queries crop_predictions newest first', async () => {
      const builder = mockTable({ data: [prediction()], error: null });
      await render(<Crops />);
      await flush();
      expect(supabaseMock.from).toHaveBeenCalledWith('crop_predictions');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('subscribes to realtime changes and unsubscribes on unmount', async () => {
      mockTable({ data: [prediction()], error: null });
      const view = await render(<Crops />);
      await flush();
      expect(supabaseMock.channel).toHaveBeenCalledWith('crop_predictions');
      expect(channelMock.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crop_predictions' },
        expect.any(Function)
      );
      await view.unmount();
      expect(supabaseMock.removeChannel).toHaveBeenCalledWith(channelMock);
    });

    it('re-fetches when a realtime change arrives', async () => {
      mockTable({ data: [prediction()], error: null });
      await render(<Crops />);
      await flush();
      const callsBefore = supabaseMock.from.mock.calls.length;
      await act(async () => {
        await triggerRealtime({ eventType: 'INSERT' });
      });
      expect(supabaseMock.from.mock.calls.length).toBe(callsBefore + 1);
    });

    it('saves fetched predictions to the cache', async () => {
      const rows = [prediction()];
      mockTable({ data: rows, error: null });
      await render(<Crops />);
      await flush();
      expect(cacheMock.setCache).toHaveBeenCalledWith(cacheMock.CACHE_KEYS.CROP_PREDICTIONS, rows);
    });

    it('does not write an empty result to the cache', async () => {
      mockTable({ data: [], error: null });
      await render(<Crops />);
      await flush();
      expect(cacheMock.setCache).not.toHaveBeenCalled();
    });

    it('renders cached predictions immediately while the network request is still pending', async () => {
      cacheMock.getCache.mockResolvedValue([prediction()]);
      supabaseMock.from.mockImplementation(() => ({
        select: () => ({ order: () => new Promise(() => {}) }),
      }));
      await render(<Crops />);
      await flush();
      expect(screen.getByText('What should you plant?')).toBeTruthy();
      expect(screen.queryByText('Loading crop recommendations...')).toBeNull();
    });
  });

  describe('error and empty states', () => {
    it('shows the error screen with the message when the request fails and there is no cache', async () => {
      mockTable({ data: null, error: { message: 'network down' } });
      await render(<Crops />);
      await flush();
      expect(screen.getByText('Error Loading Crops')).toBeTruthy();
      expect(screen.getByText('network down')).toBeTruthy();
    });

    it('retries the request when Retry is pressed', async () => {
      mockTable({ data: null, error: { message: 'network down' } });
      await render(<Crops />);
      await flush();
      const before = supabaseMock.from.mock.calls.length;

      mockTable({ data: [prediction()], error: null });
      await fireEvent.press(screen.getByText('Retry'));
      await flush();

      expect(supabaseMock.from.mock.calls.length).toBeGreaterThan(before);
      expect(screen.getByText('What should you plant?')).toBeTruthy();
    });

    it('falls back to cached data when the request fails', async () => {
      cacheMock.getCache.mockResolvedValueOnce(null).mockResolvedValue([prediction()]);
      mockTable({ data: null, error: { message: 'offline' } });
      await render(<Crops />);
      await flush(5);
      expect(screen.getByText('What should you plant?')).toBeTruthy();
      expect(screen.queryByText('Error Loading Crops')).toBeNull();
    });

    it('shows the empty state when there are no predictions', async () => {
      mockTable({ data: [], error: null });
      await render(<Crops />);
      await flush();
      expect(screen.getByText('No Recommendations Yet')).toBeTruthy();
      expect(screen.getByText('Submit soil sensor readings to get crop recommendations.')).toBeTruthy();
      expect(screen.getByTestId('icon-leaf-outline')).toBeTruthy();
    });
  });

  describe('recommendation list', () => {
    beforeEach(() => {
      mockTable({ data: [prediction()], error: null });
    });

    it('shows the highest-confidence crop as the best recommendation', async () => {
      await render(<Crops />);
      await flush();
      expect(screen.getByText('Recommended for your soil')).toBeTruthy();
      expect(screen.getByText('92%')).toBeTruthy(); // 91.6 rounded
      expect(screen.getByText('Your current soil conditions are suitable for rice.')).toBeTruthy();
    });

    it('lists the remaining crops sorted by confidence and drops 0% crops', async () => {
      await render(<Crops />);
      await flush();
      expect(screen.getByText('Other suitable crops')).toBeTruthy();
      expect(screen.getByText('maize')).toBeTruthy();
      expect(screen.getByText('62%')).toBeTruthy();
      expect(screen.getByText('mango')).toBeTruthy();
      expect(screen.getByText('48%')).toBeTruthy();
      expect(screen.queryByText('banana')).toBeNull();

      const order = screen.getAllByText(/^(maize|mango)$/).map((node) => node.props.children);
      expect(order).toEqual(['maize', 'mango']); // 62% before 48%
    });

    it('uses only the newest prediction', async () => {
      mockTable({
        data: [
          prediction({ id: 2, best_crop: 'coconut', recommendations: [{ crop: 'coconut', confidence: 80 }] }),
          prediction({ id: 1, best_crop: 'rice' }),
        ],
        error: null,
      });
      await render(<Crops />);
      await flush();
      expect(screen.getByText('Your current soil conditions are suitable for coconut.')).toBeTruthy();
      expect(screen.queryByText('maize')).toBeNull();
    });

    it('shows a placeholder when only one crop is recommended', async () => {
      mockTable({
        data: [prediction({ recommendations: [{ crop: 'rice', confidence: 90 }] })],
        error: null,
      });
      await render(<Crops />);
      await flush();
      expect(screen.getByText('No other crop recommendations yet.')).toBeTruthy();
    });

    it('renders Tagalog copy when the language is Tagalog', async () => {
      setApp({ language: 'tagalog' });
      await render(<Crops />);
      await flush();
      expect(screen.getByText('Ano ang dapat ninyong itanim?')).toBeTruthy();
      expect(screen.getByText('Iba pang angkop na pananim')).toBeTruthy();
    });

    it('scales text with the selected font scale', async () => {
      setApp({ fontScale: 1.2 });
      await render(<Crops />);
      await flush();
      const heading = screen.getByText('What should you plant?');
      expect(heading.props.style.fontSize).toBe(Math.round(24 * 1.2));
    });

    it('pull-to-refresh fetches again', async () => {
      await render(<Crops />);
      await flush();
      const before = supabaseMock.from.mock.calls.length;
      await pullToRefresh();
      await flush();
      expect(supabaseMock.from.mock.calls.length).toBeGreaterThan(before);
    });
  });

  describe('navigation', () => {
    it('opens the reasoning screen for the best crop', async () => {
      mockTable({ data: [prediction()], error: null });
      await render(<Crops />);
      await flush();
      await fireEvent.press(screen.getByText('Recommended for your soil'));
      expect(routerState.push).toHaveBeenCalledWith({
        pathname: '/(tabs)/crop/reasoning',
        params: { crop: 'rice' },
      });
    });

    it('opens the reasoning screen for another crop', async () => {
      mockTable({ data: [prediction()], error: null });
      await render(<Crops />);
      await flush();
      await fireEvent.press(screen.getByText('maize'));
      expect(routerState.push).toHaveBeenCalledWith({
        pathname: '/(tabs)/crop/reasoning',
        params: { crop: 'maize' },
      });
    });
  });
});

describe('BestCrop card', () => {
  it.each([
    [95, 'checkmark-circle'],
    [80, 'checkmark-circle'],
    [60, 'alert-circle'],
    [46, 'alert-circle'],
    [45, 'close-circle'],
    [10, 'close-circle'],
  ])('%i%% match shows the %s status icon', async (percentage, icon) => {
    await render(<BestCrop crop_name="rice" percentage={percentage} />);
    expect(screen.getByTestId(`icon-${icon}`)).toBeTruthy();
    expect(screen.getByText(`${percentage}%`)).toBeTruthy();
  });

  it('passes the confidence as a 0-1 progress value and loads the crop image', async () => {
    await render(<BestCrop crop_name="Rice" percentage={75} />);
    expect(screen.getByTestId('progress-bar').props.progress).toBe(0.75);
    expect(getCropImage).toHaveBeenCalledWith('Rice');
  });
});

describe('RecommendedCrops row', () => {
  it('shows name, percentage and bar', async () => {
    await render(<RecommendedCrops crop_name="maize" percentage={62} />);
    expect(screen.getByText('maize')).toBeTruthy();
    expect(screen.getByText('62%')).toBeTruthy();
    expect(screen.getByTestId('progress-bar').props.progress).toBe(0.62);
  });

  it.each([
    [85, 'checkmark-circle'],
    [50, 'alert-circle'],
    [20, 'close-circle'],
  ])('%i%% uses %s', async (percentage, icon) => {
    await render(<RecommendedCrops crop_name="maize" percentage={percentage} />);
    expect(screen.getByTestId(`icon-${icon}`)).toBeTruthy();
  });
});
