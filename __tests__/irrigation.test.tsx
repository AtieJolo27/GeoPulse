import { act, fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import Irrigation from '../app/(tabs)/irrigation/index';
import { cacheMock, channelMock, mockTable, setApp, supabaseMock, triggerRealtime } from './helpers/mocks';
import { flush, pullToRefresh } from './helpers/testUtils';

const reading = (id: number, soil_moisture: number | null, created_at = '2026-11-10T08:00:00Z') => ({
  id,
  soil_moisture,
  created_at,
});
const when = (iso: string) => new Date(iso).toLocaleString();

async function renderWith(rows: any[]) {
  mockTable({ data: rows, error: null });
  await render(<Irrigation />);
  await flush();
}

describe('Irrigation tab', () => {
  describe('data loading', () => {
    it('shows the loading message while waiting for the first reading', async () => {
      supabaseMock.from.mockImplementation(() => ({
        select: () => ({ order: () => ({ limit: () => new Promise(() => {}) }) }),
      }));
      await render(<Irrigation />);
      expect(screen.getByText('Checking your field moisture...')).toBeTruthy();
    });

    it('requests the 10 most recent sensor readings, newest first', async () => {
      const builder = mockTable({ data: [reading(1, 72)], error: null });
      await render(<Irrigation />);
      await flush();
      expect(supabaseMock.from).toHaveBeenCalledWith('sensor_readings');
      expect(builder.select).toHaveBeenCalledWith('id, soil_moisture, created_at');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(builder.limit).toHaveBeenCalledWith(10);
    });

    it('caches the computed recommendations', async () => {
      await renderWith([reading(1, 60)]);
      expect(cacheMock.setCache).toHaveBeenCalledWith(
        cacheMock.CACHE_KEYS.IRRIGATION_RECOMMENDATIONS,
        [expect.objectContaining({ id: 1, moisture: 60, recommendation: 'Watering is recommended' })]
      );
    });

    it('does not cache an empty result', async () => {
      await renderWith([]);
      expect(cacheMock.setCache).not.toHaveBeenCalled();
    });

    it('shows cached recommendations immediately while the request is pending', async () => {
      cacheMock.getCache.mockResolvedValue([
        { id: 9, moisture: 72, recommendation: 'No watering needed', confidence: 90, created_at: '2026-11-09T08:00:00Z' },
      ]);
      supabaseMock.from.mockImplementation(() => ({
        select: () => ({ order: () => ({ limit: () => new Promise(() => {}) }) }),
      }));
      await render(<Irrigation />);
      await flush();
      expect(screen.getByText('72.0%')).toBeTruthy();
    });

    it('subscribes to realtime changes and cleans up on unmount', async () => {
      mockTable({ data: [reading(1, 72)], error: null });
      const view = await render(<Irrigation />);
      await flush();
      expect(supabaseMock.channel).toHaveBeenCalledWith('irrigation-sensor-readings');
      expect(channelMock.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_readings' },
        expect.any(Function)
      );
      await view.unmount();
      expect(supabaseMock.removeChannel).toHaveBeenCalledWith(channelMock);
    });

    it('re-fetches on a realtime change and bypasses the cache', async () => {
      await renderWith([reading(1, 72)]);
      cacheMock.getCache.mockClear();
      const before = supabaseMock.from.mock.calls.length;
      await act(async () => {
        await triggerRealtime();
      });
      expect(supabaseMock.from.mock.calls.length).toBe(before + 1);
      expect(cacheMock.getCache).not.toHaveBeenCalled();
    });
  });

  describe('error and empty states', () => {
    it('shows an error with a retry button when loading fails and there is no cache', async () => {
      mockTable({ data: null, error: { message: 'boom' } });
      await render(<Irrigation />);
      await flush();
      expect(screen.getByText('We could not load irrigation data')).toBeTruthy();
      expect(screen.getByText('Check your connection and try again.')).toBeTruthy();
    });

    it('retries when "Try again" is pressed', async () => {
      mockTable({ data: null, error: { message: 'boom' } });
      await render(<Irrigation />);
      await flush();
      mockTable({ data: [reading(1, 72)], error: null });
      await fireEvent.press(screen.getByText('Try again'));
      await flush();
      expect(screen.getByText('Does your field need water?')).toBeTruthy();
    });

    it('falls back to the cache when loading fails', async () => {
      cacheMock.getCache.mockResolvedValueOnce(null).mockResolvedValue([
        { id: 4, moisture: 55, recommendation: 'Watering is recommended', confidence: 21, created_at: '2026-11-09T08:00:00Z' },
      ]);
      mockTable({ data: null, error: { message: 'offline' } });
      await render(<Irrigation />);
      await flush(5);
      expect(screen.getByText('55.0%')).toBeTruthy();
      expect(screen.queryByText('We could not load irrigation data')).toBeNull();
    });

    it('shows the empty state when there are no readings', async () => {
      await renderWith([]);
      expect(screen.getByText('No recent soil reading')).toBeTruthy();
      expect(screen.getByText('Collect a soil reading to receive irrigation guidance.')).toBeTruthy();
    });
  });

  describe('irrigation decision for the latest reading', () => {
    it.each([
      // moisture, headline, message, status label, icon, confidence
      [50, 'Water needed', 'Soil moisture is below the recommended range.', 'Check field', 'water-outline', '29%'],
      [69.9, 'Water needed', 'Soil moisture is below the recommended range.', 'Check field', 'water-outline', '0%'],
      [70, 'No watering needed', 'Your field has enough soil moisture right now.', 'Good level', 'checkmark-circle-outline', '90%'],
      [72.5, 'No watering needed', 'Your field has enough soil moisture right now.', 'Good level', 'checkmark-circle-outline', '90%'],
      [75, 'No watering needed', 'Your field has enough soil moisture right now.', 'Good level', 'checkmark-circle-outline', '90%'],
      [80, 'No watering yet', 'The soil is already wet. Let it drain first.', 'Check field', 'rainy-outline', '20%'],
      [100, 'No watering yet', 'The soil is already wet. Let it drain first.', 'Check field', 'rainy-outline', '100%'],
    ])('moisture %s%% -> %s', async (moisture, title, message, badge, icon, confidence) => {
      await renderWith([reading(1, moisture)]);
      expect(screen.getAllByText(title).length).toBeGreaterThan(0);
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.getByText(badge)).toBeTruthy();
      expect(screen.getByTestId(`icon-${icon}`)).toBeTruthy();
      expect(screen.getByText(confidence)).toBeTruthy();
      expect(screen.getByText(`${moisture.toFixed(1)}%`)).toBeTruthy();
    });

    it('caps the confidence at 100%', async () => {
      // (70 - -50) / 70 would exceed 100%
      await renderWith([reading(1, -50)]);
      expect(screen.getByText('100%')).toBeTruthy();
    });

    it('handles a missing moisture value', async () => {
      await renderWith([reading(1, null)]);
      expect(screen.getAllByText('Reading unavailable').length).toBeGreaterThan(0);
      expect(screen.getByText('Wait for a new soil moisture reading.')).toBeTruthy();
      expect(screen.getByText('—')).toBeTruthy();
      expect(screen.getByText('0%')).toBeTruthy(); // confidence
      expect(screen.getByTestId('icon-cloud-offline-outline')).toBeTruthy();
    });

    it('shows the headline, current moisture label and last-updated time', async () => {
      await renderWith([reading(1, 72, '2026-11-10T08:00:00Z')]);
      expect(screen.getByText('Irrigation guide')).toBeTruthy();
      expect(screen.getByText('Does your field need water?')).toBeTruthy();
      expect(screen.getByText('Current soil moisture')).toBeTruthy();
      expect(screen.getByText('Confidence')).toBeTruthy();
      expect(screen.getByText('Last updated')).toBeTruthy();
      expect(screen.getByText(when('2026-11-10T08:00:00Z'))).toBeTruthy();
    });

    it('renders Tagalog copy', async () => {
      setApp({ language: 'tagalog' });
      await renderWith([reading(1, 50)]);
      expect(screen.getByText('Kailangan ba ng tubig ang inyong bukid?')).toBeTruthy();
      expect(screen.getAllByText('Kailangan ng pagdidilig').length).toBeGreaterThan(0);
      expect(screen.getByText('Katiyakan')).toBeTruthy();
    });

    it('scales headline text with the font scale', async () => {
      setApp({ fontScale: 1.2 });
      await renderWith([reading(1, 72)]);
      expect(screen.getByText('Does your field need water?').props.style.fontSize).toBe(Math.round(25 * 1.2));
    });
  });

  describe('recent readings list', () => {
    it('lists the previous readings (not the latest) with their own status', async () => {
      await renderWith([
        reading(3, 72, '2026-11-10T08:00:00Z'),
        reading(2, 40, '2026-11-09T08:00:00Z'),
        reading(1, 90, '2026-11-08T08:00:00Z'),
      ]);
      expect(screen.getByText('Recent moisture readings')).toBeTruthy();
      expect(screen.getByText('Previous irrigation guidance')).toBeTruthy();

      expect(screen.getByText('40.0%')).toBeTruthy();
      expect(screen.getByText('90.0%')).toBeTruthy();
      expect(screen.getByText(when('2026-11-09T08:00:00Z'))).toBeTruthy();
      expect(screen.getByText(when('2026-11-08T08:00:00Z'))).toBeTruthy();
      // 72.0% only appears once - as the hero value, not in the history list
      expect(screen.getAllByText('72.0%')).toHaveLength(1);

      expect(screen.getAllByText('Water needed').length).toBeGreaterThan(0); // for 40%
      expect(screen.getAllByText('No watering yet').length).toBeGreaterThan(0); // for 90%
    });

    it('shows a dash for history rows without moisture', async () => {
      await renderWith([reading(2, 72), reading(1, null, '2026-11-09T08:00:00Z')]);
      expect(screen.getByText('—')).toBeTruthy();
      expect(screen.getAllByText('Reading unavailable').length).toBeGreaterThan(0);
    });

    it('has no history rows when only one reading exists', async () => {
      await renderWith([reading(1, 72)]);
      expect(screen.queryByText(when('2026-11-09T08:00:00Z'))).toBeNull();
      expect(screen.getAllByText('72.0%')).toHaveLength(1);
    });
  });

  describe('refresh', () => {
    it('pull-to-refresh reloads data without using the cache', async () => {
      await renderWith([reading(1, 72)]);
      cacheMock.getCache.mockClear();
      mockTable({ data: [reading(2, 50, '2026-11-11T08:00:00Z')], error: null });
      await pullToRefresh();
      await flush();
      expect(cacheMock.getCache).not.toHaveBeenCalled();
      expect(screen.getByText('50.0%')).toBeTruthy();
      expect(screen.getByTestId('refresh-control').props.refreshing).toBe(false);
    });
  });
});
