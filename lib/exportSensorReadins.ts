import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

type SensorReading = Record<string, unknown>;

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '—';

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character] ?? character));
}

function toPdfHtml(readings: SensorReading[]): string {
  const columns = Array.from(new Set(readings.flatMap((reading) => Object.keys(reading))));
  const header = columns.map((column) => `<th>${escapeHtml(column.replace(/_/g, ' '))}</th>`).join('');
  const rows = readings.map((reading) => `<tr>${columns
    .map((column) => `<td>${escapeHtml(reading[column])}</td>`)
    .join('')}</tr>`).join('');

  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body { font-family: Arial, sans-serif; color: #1f2937; padding: 20px; }
      h1 { color: #184B44; margin-bottom: 4px; } p { color: #4b5563; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; }
      th { background: #184B44; color: #fff; text-transform: capitalize; }
      th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; word-break: break-word; }
      tr:nth-child(even) { background: #f3f4f6; }
    </style></head><body>
      <h1>Sensor Readings Report</h1>
      <p>Generated ${escapeHtml(new Date().toLocaleString())} · ${readings.length} reading${readings.length === 1 ? '' : 's'}</p>
      <table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
}

export async function exportSensorReadingsPdf(readings: SensorReading[]): Promise<void> {
  if (readings.length === 0) throw new Error('There are no sensor readings to export.');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `sensor-readings-${timestamp}.pdf`;
  const { uri } = await Print.printToFileAsync({ html: toPdfHtml(readings) });

  if (Platform.OS === 'android') {
    const downloadsDirectory = LegacyFileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
    const permission = await LegacyFileSystem.StorageAccessFramework
      .requestDirectoryPermissionsAsync(downloadsDirectory);
    if (!permission.granted) throw new Error('Download folder access is required to save the PDF.');

    const destination = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri, filename.replace(/\.pdf$/, ''), 'application/pdf'
    );
    const content = await LegacyFileSystem.readAsStringAsync(uri, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(destination, content, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return;
  }

  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(uri, {
    dialogTitle: 'Export sensor readings PDF', mimeType: 'application/pdf', UTI: 'com.adobe.pdf',
  });
}

export const exportSensorReadings = exportSensorReadingsPdf;
