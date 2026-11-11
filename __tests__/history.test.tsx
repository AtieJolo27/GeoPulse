import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import React from 'react';
import History from '../app/(tabs)/history/index';
import NutrientHistoryChart from '../app/components/HistoryChart';
import SoilHealthChart from '../app/components/SoilHealthChart';
import { exportSoilHistoryPDF } from '../app/lib/exportSoilPDF';
import { historyLibMock, setApp, soilScoreMock } from './helpers/mocks';
import { flush, lastChartProps, tapChartPoint } from './helpers/testUtils';

jest.mock('../app/lib/exportSoilPDF', () => ({ exportSoilHistoryPDF: jest.fn() }));

const row = (day: number, overrides: any = {}) => ({
  id: day,
  created_at: `2026-11-${String(day).padStart(2, '0')}T12:00:00Z`,
  nitrogen: 20 + day,
  phosphorus: 10 + day,
  potassium: 100 + day,
  ph: 6.5,
  air_temperature: 28,
  soil_temperature: 25,
  humidity: 70,
  soil_moisture: 72,
  ...overrides,
});
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

describe('History tab (screen)', () => {
  beforeEach(() => {
    historyLibMock.getSoilHistory.mockResolvedValue([row(1, { __score: 70 }), row(2, { __score: 85 })]);
  });

  it('shows the page heading and the soil-health chart by default', async () => {
    await render(<History />);
    await flush();
    expect(screen.getByText('Field history')).toBeTruthy();
    expect(screen.getByText('Is your soil improving?')).toBeTruthy();
    expect(screen.getByText('Soil health trend')).toBeTruthy();
    expect(screen.getByText('Soil Health Score')).toBeTruthy(); // SoilHealthChart title
    expect(screen.queryByText('Nutrient & Soil History')).toBeNull();
  });

  it('switches to the nutrients chart and back again', async () => {
    await render(<History />);
    await flush();

    await fireEvent.press(screen.getByText('Nutrients & soil'));
    await flush();
    expect(screen.getByText('Soil data trend')).toBeTruthy();
    expect(screen.getByText('Nutrient & Soil History')).toBeTruthy();
    expect(screen.queryByText('Soil Health Score')).toBeNull();

    await fireEvent.press(screen.getByText('Soil health'));
    await flush();
    expect(screen.getByText('Soil health trend')).toBeTruthy();
    expect(screen.getByText('Soil Health Score')).toBeTruthy();
  });

  it('renders Tagalog copy', async () => {
    setApp({ language: 'tagalog' });
    await render(<History />);
    await flush();
    expect(screen.getByText('Gumaganda ba ang inyong lupa?')).toBeTruthy();
    expect(screen.getByText('Kalusugan ng lupa')).toBeTruthy();
    expect(screen.getByText('I-export ang PDF report')).toBeTruthy();
  });

  describe('PDF export', () => {
    it('exports the report when the button is pressed', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      (exportSoilHistoryPDF as jest.Mock).mockResolvedValue('file:///report.pdf');
      await render(<History />);
      await flush();
      await fireEvent.press(screen.getByText('Export PDF report'));
      await flush();
      expect(exportSoilHistoryPDF).toHaveBeenCalledTimes(1);
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('disables the button and shows progress text while exporting', async () => {
      let finish: () => void = () => {};
      (exportSoilHistoryPDF as jest.Mock).mockImplementation(() => new Promise<void>((res) => (finish = res)));
      await render(<History />);
      await flush();

      // The press handler stays pending until the export resolves, so don't await it yet.
      const press = fireEvent.press(screen.getByText('Export PDF report'));
      await waitFor(() => expect(screen.getByText('Preparing report...')).toBeTruthy());

      // a second tap while exporting must not start another export
      fireEvent.press(screen.getByText('Preparing report...'));
      expect(exportSoilHistoryPDF).toHaveBeenCalledTimes(1);

      finish();
      await press;
      await waitFor(() => expect(screen.getByText('Export PDF report')).toBeTruthy());
    });

    it('alerts the user when the export fails and recovers the button', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      (exportSoilHistoryPDF as jest.Mock).mockRejectedValue(new Error('no history'));
      await render(<History />);
      await flush();
      await fireEvent.press(screen.getByText('Export PDF report'));
      await flush();
      expect(alertSpy).toHaveBeenCalledWith('Export failed', 'Unable to generate the soil report.');
      expect(screen.getByText('Export PDF report')).toBeTruthy();
    });

    it('shows the failure alert in Tagalog', async () => {
      setApp({ language: 'tagalog' });
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      (exportSoilHistoryPDF as jest.Mock).mockRejectedValue(new Error('x'));
      await render(<History />);
      await flush();
      await fireEvent.press(screen.getByText('I-export ang PDF report'));
      await flush();
      expect(alertSpy).toHaveBeenCalledWith('Hindi na-export', 'Hindi magawa ang soil report.');
    });
  });
});

describe('Soil health chart', () => {
  it('shows a loading message, then asks for the last 30 readings', async () => {
    historyLibMock.getSoilHistory.mockReturnValue(new Promise(() => {}));
    await render(<SoilHealthChart />);
    expect(screen.getByText('Loading health history...')).toBeTruthy();
    expect(historyLibMock.getSoilHistory).toHaveBeenCalledWith(30);
  });

  it('shows an empty message when there is no history', async () => {
    historyLibMock.getSoilHistory.mockResolvedValue([]);
    await render(<SoilHealthChart />);
    await flush();
    expect(screen.getByText('No historical data yet.')).toBeTruthy();
    expect(screen.queryByTestId('line-chart')).toBeNull();
  });

  it('plots one score per reading using computeOverallScore', async () => {
    historyLibMock.getSoilHistory.mockResolvedValue([
      row(1, { __score: 40 }),
      row(2, { __score: 65 }),
      row(3, { __score: 90 }),
    ]);
    await render(<SoilHealthChart />);
    await flush();
    expect(soilScoreMock.computeOverallScore).toHaveBeenCalledTimes(3);
    expect(lastChartProps().data.datasets[0].data).toEqual([40, 65, 90]);
    expect(lastChartProps().yAxisSuffix).toBe('%');
  });

  it.each([
    [95, 'Excellent', '#16A34A'],
    [80, 'Excellent', '#16A34A'],
    [79, 'Good', '#EAB308'],
    [60, 'Good', '#EAB308'],
    [59, 'Fair', '#F97316'],
    [40, 'Fair', '#F97316'],
    [39, 'Poor', '#DC2626'],
    [0, 'Poor', '#DC2626'],
  ])('latest score %i -> %s badge', async (score, label, color) => {
    historyLibMock.getSoilHistory.mockResolvedValue([row(1, { __score: 10 }), row(2, { __score: score })]);
    await render(<SoilHealthChart />);
    await flush();
    const badge = screen.getByText(`${score}% - ${label}`);
    expect(badge.props.style.color).toBe(color);
  });

  it('shows the score legend', async () => {
    historyLibMock.getSoilHistory.mockResolvedValue([row(1)]);
    await render(<SoilHealthChart />);
    await flush();
    expect(screen.getByText('Excellent (80+)')).toBeTruthy();
    expect(screen.getByText('Good (60-79)')).toBeTruthy();
    expect(screen.getByText('Fair (40-59)')).toBeTruthy();
    expect(screen.getByText('Poor (below 40)')).toBeTruthy();
  });

  it('labels roughly six x-axis points with short dates', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(i + 1));
    historyLibMock.getSoilHistory.mockResolvedValue(rows);
    await render(<SoilHealthChart />);
    await flush();
    const labels: string[] = lastChartProps().data.labels;
    expect(labels).toHaveLength(12);
    expect(labels.filter(Boolean)).toHaveLength(6); // every 2nd reading
    expect(labels[0]).toBe(shortDate(rows[0].created_at));
    expect(labels[1]).toBe('');
  });

  it('shows the reading count footer', async () => {
    historyLibMock.getSoilHistory.mockResolvedValue([row(1), row(2), row(3)]);
    await render(<SoilHealthChart />);
    await flush();
    expect(screen.getByText('Last 3 readings')).toBeTruthy();
  });

  it('shows a tooltip when a point is tapped and dismisses it', async () => {
    const rows = [row(1, { __score: 90 }), row(2, { __score: 45 })];
    historyLibMock.getSoilHistory.mockResolvedValue(rows);
    await render(<SoilHealthChart />);
    await flush();

    await tapChartPoint({ index: 1, value: 45 });
    expect(screen.getByText('45%')).toBeTruthy();
    expect(screen.getByText('Fair')).toBeTruthy();
    expect(screen.getByText(fullDate(rows[1].created_at))).toBeTruthy();
    expect(screen.getByText('Tap to dismiss')).toBeTruthy();

    await fireEvent.press(screen.getByText('Tap to dismiss'));
    expect(screen.queryByText('Tap to dismiss')).toBeNull();
    expect(screen.getByText('Last 2 readings')).toBeTruthy();
  });

  it('ignores taps with an out-of-range index', async () => {
    historyLibMock.getSoilHistory.mockResolvedValue([row(1)]);
    await render(<SoilHealthChart />);
    await flush();
    await tapChartPoint({ index: 5, value: 10 });
    expect(screen.queryByText('Tap to dismiss')).toBeNull();
  });
});

describe('Nutrient & soil history chart', () => {
  const rows = [row(1), row(2), row(3)];
  beforeEach(() => {
    historyLibMock.getSoilHistory.mockResolvedValue(rows);
  });

  it('shows a loading message while history is being fetched', async () => {
    historyLibMock.getSoilHistory.mockReturnValue(new Promise(() => {}));
    await render(<NutrientHistoryChart />);
    expect(screen.getByText('Loading history...')).toBeTruthy();
  });

  it('shows an empty message when there is no history', async () => {
    historyLibMock.getSoilHistory.mockResolvedValue([]);
    await render(<NutrientHistoryChart />);
    await flush();
    expect(screen.getByText('No historical data yet.')).toBeTruthy();
    expect(screen.queryByTestId('line-chart')).toBeNull();
  });

  it('requests the last 30 readings and plots nitrogen first', async () => {
    await render(<NutrientHistoryChart />);
    await flush();
    expect(historyLibMock.getSoilHistory).toHaveBeenCalledWith(30);
    expect(screen.getByText('Nutrient & Soil History')).toBeTruthy();
    expect(lastChartProps().data.datasets[0].data).toEqual([21, 22, 23]);
    expect(lastChartProps().yAxisSuffix).toBe('mg/kg');
  });

  it('offers a chip for each of the 8 metrics', async () => {
    await render(<NutrientHistoryChart />);
    await flush();
    ['Nitrogen', 'Phosphorus', 'Potassium', 'Soil pH', 'Air Temp', 'Soil Temp', 'Humidity', 'Soil Moisture'].forEach(
      (label) => expect(screen.getByText(label)).toBeTruthy()
    );
  });

  it.each([
    ['Phosphorus', [11, 12, 13], 'mg/kg'],
    ['Potassium', [101, 102, 103], 'mg/kg'],
    ['Soil pH', [6.5, 6.5, 6.5], ''],
    ['Air Temp', [28, 28, 28], '°C'],
    ['Soil Temp', [25, 25, 25], '°C'],
    ['Humidity', [70, 70, 70], '%'],
    ['Soil Moisture', [72, 72, 72], '%'],
  ])('selecting %s plots that metric with its unit', async (label, values, unit) => {
    await render(<NutrientHistoryChart />);
    await flush();
    await fireEvent.press(screen.getByText(label as string));
    expect(lastChartProps().data.datasets[0].data).toEqual(values);
    expect(lastChartProps().yAxisSuffix).toBe(unit);
  });

  it('converts string values from the database to numbers', async () => {
    historyLibMock.getSoilHistory.mockResolvedValue([row(1, { nitrogen: '31.5' })]);
    await render(<NutrientHistoryChart />);
    await flush();
    expect(lastChartProps().data.datasets[0].data).toEqual([31.5]);
  });

  it('shows a tooltip with value, unit, metric name and date', async () => {
    await render(<NutrientHistoryChart />);
    await flush();
    await tapChartPoint({ index: 1, value: 22 });
    expect(screen.getByText('22mg/kg')).toBeTruthy();
    expect(screen.getAllByText('Nitrogen').length).toBeGreaterThan(1); // chip + tooltip
    expect(screen.getByText(fullDate(rows[1].created_at))).toBeTruthy();
  });

  it('clears the tooltip when another metric is selected', async () => {
    await render(<NutrientHistoryChart />);
    await flush();
    await tapChartPoint({ index: 0, value: 21 });
    expect(screen.getByText('Tap to dismiss')).toBeTruthy();
    await fireEvent.press(screen.getByText('Humidity'));
    expect(screen.queryByText('Tap to dismiss')).toBeNull();
  });

  it('clears the tooltip when "Tap to dismiss" is pressed', async () => {
    await render(<NutrientHistoryChart />);
    await flush();
    await tapChartPoint({ index: 0, value: 21 });
    await fireEvent.press(screen.getByText('Tap to dismiss'));
    expect(screen.getByText('Last 3 readings')).toBeTruthy();
  });

  it('uses Tagalog metric names and footer', async () => {
    setApp({ language: 'tagalog' });
    await render(<NutrientHistoryChart />);
    await flush();
    expect(screen.getByText('Antas ng pH')).toBeTruthy();
    expect(screen.getByText('Halumigmig ng Lupa')).toBeTruthy();
    expect(screen.getByText('Huling 3 pagbasa')).toBeTruthy();
  });
});
