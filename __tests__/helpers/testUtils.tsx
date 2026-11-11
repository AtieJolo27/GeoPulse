import { act, screen } from '@testing-library/react-native';
import { chartState } from './mocks';

/** Let pending promises (fetches, cache reads, effects) settle. */
export async function flush(times = 3) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

/** Latest props handed to the mocked <LineChart>. */
export function lastChartProps(): any {
  const props = chartState.props;
  return props[props.length - 1];
}

/** Simulate tapping a point on the mocked chart. */
export async function tapChartPoint(point: { index: number; value: number; x?: number; y?: number }) {
  await act(async () => {
    lastChartProps().onDataPointClick({ x: 100, y: 100, ...point });
  });
}

/** Simulate the user pulling down on the screen's scroll view / list. */
export async function pullToRefresh() {
  const control = screen.getByTestId('refresh-control');
  await act(async () => {
    control.props.onRefresh();
  });
}
