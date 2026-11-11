import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import React from 'react';
import Dashboard from '../app/(tabs)/home/index';
import {
  cacheMock,
  channelMock,
  defaultSoilScore,
  exportSensorReadingsMock,
  hapticsMock,
  mockTable,
  setApp,
  soilScoreMock,
  supabaseMock,
  triggerRealtime,
} from './helpers/mocks';
import { flush, pullToRefresh } from './helpers/testUtils';

jest.mock('../app/components/LoadingSkeleton', () => {
  const R = require('react');
  const { View } = require('react-native');
  return { DashboardSkeleton: () => R.createElement(View, { testID: 'dashboard-skeleton' }) };
});

const reading = (overrides: any = {}) => ({
  id: 1,
  created_at: '2026-11-10T08:00:00Z',
  soil_moisture: 72,
  soil_temperature: 25,
  ph: 6.8,
  nitrogen: 30,
  phosphorus: 20,
  potassium: 150,
  air_temperature: 29,
  humidity: 65,
  ...overrides,
});

async function renderDashboard(rows: any[] = [reading()]) {
  mockTable({ data: rows, error: null });
  await render(<Dashboard />);
  await flush();
}

const neverResolves = () =>
  supabaseMock.from.mockImplementation(() => ({ select: () => ({ order: () => new Promise(() => {}) }) }));

describe('Dashboard tab', () => {
  describe('data loading', () => {
    it('shows the skeleton while the first request is pending', async () => {
      neverResolves();
      await render(<Dashboard />);
      expect(screen.getByTestId('dashboard-skeleton')).toBeTruthy();
      expect(screen.queryByText('How is your field today?')).toBeNull();
    });

    it('queries all sensor_readings columns, newest first', async () => {
      const builder = mockTable({ data: [reading()], error: null });
      await render(<Dashboard />);
      await flush();
      expect(supabaseMock.from).toHaveBeenCalledWith('sensor_readings');
      expect(builder.select).toHaveBeenCalledWith('*');
      expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('caches the fetched readings but not an empty result', async () => {
      const rows = [reading()];
      await renderDashboard(rows);
      expect(cacheMock.setCache).toHaveBeenCalledWith(cacheMock.CACHE_KEYS.SENSOR_READINGS, rows);

      cacheMock.setCache.mockClear();
      await renderDashboard([]);
      expect(cacheMock.setCache).not.toHaveBeenCalled();
    });

    it('shows cached readings immediately while the network request is pending', async () => {
      cacheMock.getCache.mockResolvedValue([reading({ soil_moisture: 71 })]);
      neverResolves();
      await render(<Dashboard />);
      await flush();
      expect(screen.queryByTestId('dashboard-skeleton')).toBeNull();
      expect(screen.getByLabelText(/^Soil Moisture: 71%/)).toBeTruthy();
    });

    it('subscribes to realtime changes and unsubscribes on unmount', async () => {
      mockTable({ data: [reading()], error: null });
      const view = await render(<Dashboard />);
      await flush();
      expect(supabaseMock.channel).toHaveBeenCalledWith('sensor_readings');
      expect(channelMock.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sensor_readings' },
        expect.any(Function)
      );
      await view.unmount();
      expect(supabaseMock.removeChannel).toHaveBeenCalledWith(channelMock);
    });

    it('refreshes the readings when a realtime change arrives', async () => {
      await renderDashboard([reading({ soil_moisture: 72 })]);
      mockTable({ data: [reading({ soil_moisture: 64 })], error: null });
      await act(async () => {
        await triggerRealtime();
      });
      await flush();
      expect(screen.getByLabelText(/^Soil Moisture: 64%/)).toBeTruthy();
    });

    it('settles after loading instead of re-fetching forever', async () => {
      await renderDashboard();
      await flush(5);
      const calls = supabaseMock.from.mock.calls.length;
      await flush(10);
      expect(supabaseMock.from.mock.calls.length).toBe(calls);
    });

    it('pull-to-refresh reloads the data with haptic feedback', async () => {
      await renderDashboard([reading({ soil_moisture: 72 })]);
      mockTable({ data: [reading({ soil_moisture: 66 })], error: null });
      await pullToRefresh();
      await flush();
      expect(hapticsMock.lightHaptic).toHaveBeenCalled();
      expect(screen.getByLabelText(/^Soil Moisture: 66%/)).toBeTruthy();
    });
  });

  describe('error and empty states', () => {
    it('shows a connection error with the message when nothing could be loaded', async () => {
      mockTable({ data: null, error: { message: 'server unreachable' } });
      await render(<Dashboard />);
      await flush();
      expect(screen.getByText('Connection Error')).toBeTruthy();
      expect(screen.getByText('server unreachable')).toBeTruthy();
      expect(screen.getByTestId('icon-cloud-offline-outline')).toBeTruthy();
    });

    it('retries when Retry is pressed', async () => {
      mockTable({ data: null, error: { message: 'server unreachable' } });
      await render(<Dashboard />);
      await flush();
      mockTable({ data: [reading()], error: null });
      await fireEvent.press(screen.getByText('Retry'));
      await flush();
      expect(screen.getByText('How is your field today?')).toBeTruthy();
      expect(screen.queryByText('Connection Error')).toBeNull();
    });

    it('falls back to cached readings when the request fails', async () => {
      cacheMock.getCache.mockResolvedValueOnce(null).mockResolvedValue([reading({ soil_moisture: 68 })]);
      mockTable({ data: null, error: { message: 'offline' } });
      await render(<Dashboard />);
      await flush(5);
      expect(screen.queryByText('Connection Error')).toBeNull();
      expect(screen.getByLabelText(/^Soil Moisture: 68%/)).toBeTruthy();
    });

    it('renders placeholders when there are no readings yet', async () => {
      await renderDashboard([]);
      expect(screen.getByLabelText(/^Soil Moisture: --%/)).toBeTruthy();
      expect(screen.getByLabelText(/^Soil Temperature: --°C/)).toBeTruthy();
      expect(screen.getByLabelText(/^Soil pH: --,/)).toBeTruthy();
      expect(screen.getByLabelText(/^Nitrogen: -- ppm/)).toBeTruthy();
      expect(screen.getByText('Your latest readings are within their recommended ranges.')).toBeTruthy();
      expect(screen.getByLabelText('Needs attention')).toBeTruthy(); // score 0 badge
    });
  });

  describe('header and language', () => {
    it('shows the greeting in English', async () => {
      await renderDashboard();
      expect(screen.getByText('Good day')).toBeTruthy();
      expect(screen.getByText('How is your field today?')).toBeTruthy();
      expect(screen.getByText('Live soil conditions and practical next steps.')).toBeTruthy();
    });

    it('shows the greeting in Tagalog', async () => {
      setApp({ language: 'tagalog' });
      await renderDashboard();
      expect(screen.getByText('Magandang araw')).toBeTruthy();
      expect(screen.getByText('Kumusta ang inyong bukid ngayon?')).toBeTruthy();
      expect(screen.getByText('Kalusugan ng lupa')).toBeTruthy();
    });

    it('scales text with the font scale', async () => {
      setApp({ fontScale: 1.2 });
      await renderDashboard();
      expect(screen.getByText('How is your field today?').props.style.fontSize).toBe(Math.round(26 * 1.2));
    });
  });

  describe('sensor cards', () => {
    it('shows the latest reading (first row) for every sensor with its ideal range', async () => {
      await renderDashboard([reading(), reading({ id: 0, soil_moisture: 10 })]);
      expect(screen.getByLabelText('Soil Moisture: 72%, optimal range: 70-75%')).toBeTruthy();
      expect(screen.getByLabelText('Soil Temperature: 25°C, optimal range: 20-30°C')).toBeTruthy();
      expect(screen.getByLabelText('Soil pH: 6.8, optimal range: 6-7.5')).toBeTruthy();
      expect(screen.getByLabelText('Nitrogen: 30 ppm, optimal range: 20-40 ppm')).toBeTruthy();
      expect(screen.getByLabelText('Phosphorus: 20 ppm, optimal range: 10-30 ppm')).toBeTruthy();
      expect(screen.getByLabelText('Potassium: 150 ppm, optimal range: 100-200 ppm')).toBeTruthy();
      expect(screen.getByText('Ideal: 70-75%')).toBeTruthy();
      expect(screen.getByText('Ideal: 100-200 ppm')).toBeTruthy();
    });

    it.each([
      ['Soil Moisture: 72%', 0.72], // value / 100
      ['Soil Temperature: 25°C', 0.5], // value / 50
      ['Soil pH: 6.8', 6.8 / 14], // value / 14
      ['Nitrogen: 30 ppm', 0.3], // value / 100
      ['Phosphorus: 20 ppm', 0.2], // value / 100
      ['Potassium: 150 ppm', 0.5], // value / 300
    ])('%s fills the bar to %d', async (label, expected) => {
      await renderDashboard();
      const card = screen.getByLabelText(new RegExp(`^${label}`));
      expect(within(card).getByTestId('progress-bar').props.progress).toBeCloseTo(expected as number, 5);
    });

    it('caps progress at 100%', async () => {
      await renderDashboard([reading({ soil_moisture: 130, potassium: 900 })]);
      const moisture = screen.getByLabelText(/^Soil Moisture: 130%/);
      const potassium = screen.getByLabelText(/^Potassium: 900 ppm/);
      expect(within(moisture).getByTestId('progress-bar').props.progress).toBe(1);
      expect(within(potassium).getByTestId('progress-bar').props.progress).toBe(1);
    });

    it('shows 0% progress for missing values', async () => {
      await renderDashboard([reading({ nitrogen: undefined, ph: null })]);
      const nitrogen = screen.getByLabelText(/^Nitrogen: -- ppm/);
      expect(within(nitrogen).getByTestId('progress-bar').props.progress).toBe(0);
      expect(screen.getByLabelText(/^Soil pH: --,/)).toBeTruthy();
    });

    it('uses Tagalog sensor names', async () => {
      setApp({ language: 'tagalog' });
      await renderDashboard();
      expect(screen.getByLabelText(/^Halumigmig ng Lupa: 72%/)).toBeTruthy();
      expect(screen.getByLabelText(/^Temperatura ng Lupa/)).toBeTruthy();
      expect(screen.getByLabelText(/^Antas ng pH/)).toBeTruthy();
    });
  });

  describe('alerts ("Needs attention")', () => {
    it('shows an all-clear message when every reading is in range', async () => {
      await renderDashboard();
      expect(screen.getByText('Everything looks good today.')).toBeTruthy();
      expect(screen.getByText('Your latest readings are within their recommended ranges.')).toBeTruthy();
    });

    it.each([
      // overrides, field, message
      [{ soil_temperature: 36 }, 'Soil Temperature', 'Temperature too high (36°C), exceeds optimal range'],
      [{ soil_temperature: 14 }, 'Soil Temperature', 'Temperature too low (14°C), below optimal range'],
      [{ soil_moisture: 59 }, 'Soil Moisture', 'Moisture level too low (59%)'],
      [{ soil_moisture: 86 }, 'Soil Moisture', 'Moisture level too high (86%) — risk of waterlogging'],
      [{ ph: 5.4 }, 'Soil pH', 'Soil too acidic (pH 5.4), below optimal range'],
      [{ ph: 8.1 }, 'Soil pH', 'Soil too alkaline (pH 8.1), above optimal range'],
    ])('%j raises "%s"', async (overrides, field, message) => {
      await renderDashboard([reading(overrides)]);
      expect(screen.getByText('These conditions may need action today.')).toBeTruthy();
      expect(screen.getAllByText(field)).toHaveLength(2); // sensor card label + alert title
      expect(screen.getByText(message)).toBeTruthy();
      expect(screen.queryByText('Everything looks good today.')).toBeNull();
    });

    it.each([
      [{ soil_temperature: 35 }],
      [{ soil_temperature: 15 }],
      [{ soil_moisture: 60 }],
      [{ soil_moisture: 85 }],
      [{ ph: 5.5 }],
      [{ ph: 8 }],
    ])('%j is on the boundary and does not raise an alert', async (overrides) => {
      await renderDashboard([reading(overrides)]);
      expect(screen.getByText('Everything looks good today.')).toBeTruthy();
    });

    it('accepts numeric strings from the database', async () => {
      await renderDashboard([reading({ soil_temperature: '40' })]);
      expect(screen.getByText('Temperature too high (40°C), exceeds optimal range')).toBeTruthy();
    });

    it('ignores non-numeric values', async () => {
      await renderDashboard([reading({ soil_temperature: 'n/a', soil_moisture: null, ph: undefined })]);
      expect(screen.getByText('Everything looks good today.')).toBeTruthy();
    });

    it('shows only the first alert (temperature > moisture > pH) when several apply', async () => {
      await renderDashboard([reading({ soil_temperature: 40, soil_moisture: 10, ph: 4 })]);
      expect(screen.getByText('Temperature too high (40°C), exceeds optimal range')).toBeTruthy();
      expect(screen.queryByText(/Moisture level too low/)).toBeNull();
      expect(screen.queryByText(/Soil too acidic/)).toBeNull();
    });

    it('shows the alert message in Tagalog', async () => {
      setApp({ language: 'tagalog' });
      await renderDashboard([reading({ ph: 4.9 })]);
      expect(screen.getByText('Soil pH')).toBeTruthy(); // field label itself is English-only in the UI
      expect(screen.getByText('Masyadong acidic ang lupa (pH 4.9), mababa sa optimal na antas')).toBeTruthy();
    });
  });

  describe('soil health score', () => {
    it('converts readings to numbers and passes them to the scoring function', async () => {
      await renderDashboard([reading({ nitrogen: '31', ph: 'bad', humidity: undefined })]);
      expect(soilScoreMock.computeSoilHealthScore).toHaveBeenCalledWith(
        expect.objectContaining({
          nitrogen: 31,
          phosphorus: 20,
          potassium: 150,
          ph: undefined,
          soil_moisture: 72,
          soil_temperature: 25,
          air_temperature: 29,
          humidity: undefined,
        })
      );
    });

    it('does not compute a score when there are no readings', async () => {
      await renderDashboard([]);
      expect(soilScoreMock.computeSoilHealthScore).not.toHaveBeenCalled();
      expect(screen.getByTestId('circular-progress').props.fill).toBe(0);
    });

    it.each([
      [92, 'Healthy', '#16A34A'],
      [80, 'Healthy', '#16A34A'],
      [79, 'Needs care', '#EAB308'],
      [60, 'Needs care', '#EAB308'],
      [59, 'Needs attention', '#F97316'],
      [40, 'Needs attention', '#F97316'],
      [39, 'Needs attention', '#DC2626'],
    ])('score %i%% -> "%s" badge and %s ring', async (overall, badge, ring) => {
      soilScoreMock.computeSoilHealthScore.mockReturnValue({ ...defaultSoilScore(), overall });
      await renderDashboard();
      const circle = screen.getByTestId('circular-progress');
      expect(circle.props.fill).toBe(overall);
      expect(circle.props.tintColor).toBe(ring);
      expect(screen.getByLabelText(badge)).toBeTruthy(); // StatusBadge exposes its label
      expect(screen.getByText(`${overall}%`)).toBeTruthy();
    });

    it('shows the placeholder soil facts', async () => {
      await renderDashboard();
      expect(screen.getByText('Soil type')).toBeTruthy();
      expect(screen.getByText('Planting status')).toBeTruthy();
      expect(screen.getByText('Ready for Planting')).toBeTruthy();
    });

    describe('breakdown modal', () => {
      it('is hidden until the info button is pressed', async () => {
        await renderDashboard();
        expect(screen.queryByText('Soil Health Score Breakdown')).toBeNull();
      });

      it('opens with per-factor scores, the overall score and the interpretation', async () => {
        await renderDashboard();
        await fireEvent.press(screen.getByLabelText('View soil health details'));
        expect(hapticsMock.mediumHaptic).toHaveBeenCalled();
        expect(screen.getByText('Soil Health Score Breakdown')).toBeTruthy();
        expect(screen.getByText('Nitrogen (20-40 ppm)')).toBeTruthy();
        expect(screen.getByText('90/100')).toBeTruthy();
        expect(screen.getByText('Soil pH (6-7.5 )')).toBeTruthy();
        expect(screen.getByText('55/100')).toBeTruthy();
        expect(screen.getByText('Overall Score: 82%')).toBeTruthy();
        expect(screen.getByText('Soil is in good condition.')).toBeTruthy();
      });

      it('colours each factor bar by its score', async () => {
        soilScoreMock.computeSoilHealthScore.mockReturnValue({
          ...defaultSoilScore(),
          factors: [
            { label: 'A', optimalMin: 0, optimalMax: 1, unit: 'u', score: 85 },
            { label: 'B', optimalMin: 0, optimalMax: 1, unit: 'u', score: 65 },
            { label: 'C', optimalMin: 0, optimalMax: 1, unit: 'u', score: 45 },
            { label: 'D', optimalMin: 0, optimalMax: 1, unit: 'u', score: 10 },
          ],
        });
        await renderDashboard();
        await fireEvent.press(screen.getByLabelText('View soil health details'));
        const bars = screen.getAllByTestId('progress-bar').filter((b) => [0.85, 0.65, 0.45, 0.1].includes(b.props.progress));
        expect(bars.map((b) => b.props.progress)).toEqual([0.85, 0.65, 0.45, 0.1]);
        expect(bars.map((b) => b.props.color)).toEqual(['#28784A', '#EAB308', '#F97316', '#DC2626']);
      });

      it('falls back to a default interpretation', async () => {
        soilScoreMock.computeSoilHealthScore.mockReturnValue({ ...defaultSoilScore(), interpretation: undefined });
        await renderDashboard();
        await fireEvent.press(screen.getByLabelText('View soil health details'));
        expect(screen.getByText('Your soil condition is being evaluated based on 6 key parameters.')).toBeTruthy();
      });

      it('shows the Tagalog interpretation', async () => {
        setApp({ language: 'tagalog' });
        await renderDashboard();
        await fireEvent.press(screen.getByLabelText('Tingnan ang detalye ng kalusugan ng lupa'));
        expect(screen.getByText('Maayos ang lupa.')).toBeTruthy();
        expect(screen.getByText('Kabuuang Skor: 82%')).toBeTruthy();
      });

      it('closes when the close button is pressed', async () => {
        await renderDashboard();
        await fireEvent.press(screen.getByLabelText('View soil health details'));
        await fireEvent.press(screen.getByLabelText('Close'));
        expect(screen.queryByText('Soil Health Score Breakdown')).toBeNull();
      });
    });
  });

  describe('zones', () => {
    it('lists every zone with its soil type', async () => {
      await renderDashboard();
      expect(screen.getByLabelText('Select Zone A')).toBeTruthy();
      expect(screen.getByLabelText('Select Zone B')).toBeTruthy();
      expect(screen.getByText('Loam')).toBeTruthy();
      expect(screen.getByText('Clay')).toBeTruthy();
      expect(screen.getByText('FIELD ZONES')).toBeTruthy();
    });

    it('highlights the active zone and names it below the selector', async () => {
      setApp({ activeZoneId: 2 });
      await renderDashboard();
      const active = screen.getByLabelText('Select Zone B');
      const inactive = screen.getByLabelText('Select Zone A');
      expect(active.props.style.backgroundColor).toBe('#28784A');
      expect(inactive.props.style.backgroundColor).not.toBe('#28784A');
      // heading under the selector (the chip also shows the same text)
      expect(screen.getAllByText('Zone B')).toHaveLength(2);
    });

    it('falls back to a generic label when no zone is active', async () => {
      setApp({ activeZoneId: null });
      await renderDashboard();
      expect(screen.getByText('Zone')).toBeTruthy();
    });

    it('shows Tagalog zone names', async () => {
      setApp({ language: 'tagalog' });
      await renderDashboard();
      expect(screen.getByLabelText('Piliin ang Sona B')).toBeTruthy();
      expect(screen.getByText('SONA NG LARANGAN')).toBeTruthy();
    });

    it('switches the active zone when a zone is pressed', async () => {
      const app = setApp();
      await renderDashboard();
      await fireEvent.press(screen.getByLabelText('Select Zone B'));
      expect(hapticsMock.lightHaptic).toHaveBeenCalled();
      expect(app.setActiveZoneId).toHaveBeenCalledWith(2);
    });

    it('renders with no zones', async () => {
      setApp({ zones: [], activeZoneId: null });
      await renderDashboard();
      expect(screen.getByLabelText('Add zone')).toBeTruthy();
      expect(screen.queryByLabelText(/^Select/)).toBeNull();
    });
  });

  describe('add zone modal', () => {
    const open = async () => {
      await fireEvent.press(screen.getByLabelText('Add zone'));
    };
    const fillForm = async (en = 'Zone C', tl = 'Sona C', soil: string | null = 'Sandy Loam') => {
      await fireEvent.changeText(screen.getByPlaceholderText('Enter zone name in English'), en);
      await fireEvent.changeText(screen.getByPlaceholderText('Enter zone name in Tagalog'), tl);
      if (soil) await fireEvent.press(screen.getByLabelText(soil));
    };

    it('is hidden until the add button is pressed', async () => {
      await renderDashboard();
      expect(screen.queryByText('Add New Zone')).toBeNull();
      await open();
      expect(hapticsMock.lightHaptic).toHaveBeenCalled();
      expect(screen.getByText('Add New Zone')).toBeTruthy();
      expect(screen.getByText('Zone Name (English)')).toBeTruthy();
      expect(screen.getByText('Zone Name (Tagalog)')).toBeTruthy();
    });

    it('offers all seven soil types', async () => {
      await renderDashboard();
      await open();
      ['Clay', 'Clay Loam', 'Loam', 'Sandy', 'Sandy Loam', 'Silty Clay Loam', 'Volcanic Loam'].forEach((soil) =>
        expect(screen.getByLabelText(soil)).toBeTruthy()
      );
    });

    it('highlights the selected soil type', async () => {
      await renderDashboard();
      await open();
      await fireEvent.press(screen.getByLabelText('Volcanic Loam'));
      expect(screen.getByLabelText('Volcanic Loam').props.style.backgroundColor).toBe('#28784A');
      expect(screen.getByLabelText('Clay').props.style.backgroundColor).not.toBe('#28784A');
    });

    it('closes when the close button is pressed', async () => {
      await renderDashboard();
      await open();
      await fireEvent.press(screen.getByLabelText('Close'));
      expect(screen.queryByText('Add New Zone')).toBeNull();
    });

    it.each([
      ['English name missing', '', 'Sona C', 'Sandy'],
      ['Tagalog name missing', 'Zone C', '   ', 'Sandy'],
      ['soil type missing', 'Zone C', 'Sona C', null],
    ])('does not save when the %s', async (_label, en, tl, soil) => {
      const app = setApp();
      await renderDashboard();
      await open();
      await fillForm(en as string, tl as string, soil as string | null);
      await fireEvent.press(screen.getByText('Save'));
      expect(hapticsMock.warningHaptic).toHaveBeenCalled();
      expect(app.createZone).not.toHaveBeenCalled();
      expect(screen.getByText('Add New Zone')).toBeTruthy();
    });

    it('creates the zone with trimmed names, activates it and closes the modal', async () => {
      const app = setApp({
        createZone: jest.fn().mockResolvedValue({ id: 9, name_en: 'Zone C', name_tl: 'Sona C', soil_type: 'Sandy Loam' }),
      });
      await renderDashboard();
      await open();
      await fillForm('  Zone C ', ' Sona C  ', 'Sandy Loam');
      await fireEvent.press(screen.getByText('Save'));
      await flush();

      expect(hapticsMock.mediumHaptic).toHaveBeenCalled();
      expect(app.createZone).toHaveBeenCalledWith('Zone C', 'Sona C', 'Sandy Loam');
      expect(app.setActiveZoneId).toHaveBeenCalledWith(9);
      expect(screen.queryByText('Add New Zone')).toBeNull();
    });

    it('resets the form after a successful save', async () => {
      setApp({ createZone: jest.fn().mockResolvedValue({ id: 9, name_en: 'Zone C', name_tl: 'Sona C', soil_type: 'Clay' }) });
      await renderDashboard();
      await open();
      await fillForm('Zone C', 'Sona C', 'Clay');
      await fireEvent.press(screen.getByText('Save'));
      await flush();

      await open();
      expect(screen.getByPlaceholderText('Enter zone name in English').props.value).toBe('');
      expect(screen.getByLabelText('Clay').props.style.backgroundColor).not.toBe('#28784A');
    });

    it('alerts and keeps the modal open when the zone cannot be saved', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const app = setApp({ createZone: jest.fn().mockResolvedValue(null) });
      await renderDashboard();
      await open();
      await fillForm();
      await fireEvent.press(screen.getByText('Save'));
      await flush();

      expect(alertSpy).toHaveBeenCalledWith('Could not save zone', 'Please check your connection and try again.');
      expect(app.setActiveZoneId).not.toHaveBeenCalled();
      expect(screen.getByText('Add New Zone')).toBeTruthy();
      expect(screen.getByText('Save')).toBeTruthy(); // saving state cleared
    });

    it('shows "Saving..." while the request is in flight', async () => {
      let resolve: (z: any) => void = () => {};
      setApp({ createZone: jest.fn(() => new Promise((res) => (resolve = res))) });
      await renderDashboard();
      await open();
      await fillForm();

      const press = fireEvent.press(screen.getByText('Save'));
      await waitFor(() => expect(screen.getByText('Saving...')).toBeTruthy());

      resolve({ id: 5, name_en: 'Zone C', name_tl: 'Sona C', soil_type: 'Sandy Loam' });
      await press;
      await waitFor(() => expect(screen.queryByText('Add New Zone')).toBeNull());
    });

    it('is translated to Tagalog', async () => {
      setApp({ language: 'tagalog' });
      await renderDashboard();
      await fireEvent.press(screen.getByLabelText('Magdagdag na zona'));
      expect(screen.getByText('Magdagdag na Bagong Zona')).toBeTruthy();
      expect(screen.getByText('I-save')).toBeTruthy();
    });
  });

  describe('export PDF', () => {
    it('exports the loaded readings', async () => {
      const rows = [reading(), reading({ id: 2 })];
      await renderDashboard(rows);
      await fireEvent.press(screen.getByLabelText('Export sensor readings as PDF'));
      await flush();
      expect(exportSensorReadingsMock.exportSensorReadingsPdf).toHaveBeenCalledWith(rows);
    });

    it('disables the button and shows "Exporting..." while working', async () => {
      let finish: () => void = () => {};
      exportSensorReadingsMock.exportSensorReadingsPdf.mockImplementation(() => new Promise<void>((r) => (finish = r)));
      await renderDashboard();

      const press = fireEvent.press(screen.getByLabelText('Export sensor readings as PDF'));
      await waitFor(() => expect(screen.getByText('Exporting...')).toBeTruthy());

      fireEvent.press(screen.getByText('Exporting...'));
      expect(exportSensorReadingsMock.exportSensorReadingsPdf).toHaveBeenCalledTimes(1);

      finish();
      await press;
      await waitFor(() => expect(screen.getByText('Export PDF')).toBeTruthy());
    });

    it('alerts with the error message when the export fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      exportSensorReadingsMock.exportSensorReadingsPdf.mockRejectedValue(new Error('Sharing is not available'));
      await renderDashboard();
      await fireEvent.press(screen.getByLabelText('Export sensor readings as PDF'));
      await flush();
      expect(alertSpy).toHaveBeenCalledWith('Export failed', 'Sharing is not available');
      expect(screen.getByText('Export PDF')).toBeTruthy();
    });

    it('uses a default message when a non-Error is thrown', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      exportSensorReadingsMock.exportSensorReadingsPdf.mockRejectedValue('nope');
      await renderDashboard();
      await fireEvent.press(screen.getByLabelText('Export sensor readings as PDF'));
      await flush();
      expect(alertSpy).toHaveBeenCalledWith('Export failed', 'Unable to export sensor readings.');
    });
  });
});
