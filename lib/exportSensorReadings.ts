import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

type SensorReading = Record<string, unknown>;

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '-';

  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return text.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character] ?? character));
}

export function toPdfHtml(readings: SensorReading[], title = 'Soil Sensor Report', zoneName?: string): string {
  const columns = Array.from(new Set(readings.flatMap((reading) => Object.keys(reading))));
  const labels: Record<string, string> = { created_at: 'Reading time', nitrogen: 'N (mg/kg)', phosphorus: 'P (mg/kg)', potassium: 'K (mg/kg)', ph: 'Soil pH', soil_moisture: 'Soil moisture (%)', humidity: 'Humidity (%)', soil_temperature: 'Soil temp (C)', air_temperature: 'Air temp (C)' };
  const header = columns.map((column) => `<th>${escapeHtml(labels[column] ?? column.replace(/_/g, ' '))}</th>`).join('');
  const rows = readings.map((reading) => `<tr>${columns
    .map((column) => `<td>${escapeHtml(reading[column])}</td>`)
    .join('')}</tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      thead { display: table-header-group; } tr { break-inside: avoid; }
      body { font-family: Arial, sans-serif; color: #1f2937; padding: 20px; }
      h1 { color: #184B44; margin-bottom: 4px; } p { color: #4b5563; margin-top: 0; }
      table { width: 100%; border-collapse: collapse; font-size: 9px; }
      th { background: #184B44; color: #fff; text-transform: capitalize; }
      th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; word-break: break-word; }
      tr:nth-child(even) { background: #f3f4f6; }
    </style></head><body>
      <h1>${escapeHtml(title)}</h1>
      ${zoneName ? `<p>Zone: ${escapeHtml(zoneName)}</p>` : ''}
      <p>Generated ${escapeHtml(new Date().toLocaleString())} · ${readings.length} reading${readings.length === 1 ? '' : 's'}</p>
      <table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>
      <p>Sensor values require calibration. Nutrients are reported in mg/kg (ppm on a soil mass basis); missing values are shown as a dash.</p>
    </body></html>`;
}

export async function exportReportHtml(html: string): Promise<void> {
  if (Platform.OS === 'web') {
    // Expo Print on web prints the current page and returns no file URI.
    // Print an isolated report document instead; no popup permission is needed.
    await new Promise<void>((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.title = 'Soil report print preview';
      frame.style.cssText = 'position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
      let printed = false;
      const cleanup = () => { clearTimeout(deadline); frame.remove(); };
      const deadline = setTimeout(() => {
        cleanup();
        if (!printed) reject(new Error('The report could not open for printing. Please retry.'));
      }, 60000);
      frame.onload = () => {
        try {
          const reportWindow = frame.contentWindow;
          if (!reportWindow) throw new Error('Unable to open report preview.');
          reportWindow.addEventListener('afterprint', cleanup, { once: true });
          reportWindow.focus();
          reportWindow.print();
          printed = true;
          resolve();
        } catch (error) { cleanup(); reject(error); }
      };
      frame.srcdoc = html;
      document.body.appendChild(frame);
    });
    return;
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `soil-report-${timestamp}.pdf`;
  const { uri, base64 } = await Print.printToFileAsync({ html, width: 842, height: 595, base64: Platform.OS === 'android' });
  if (!uri) throw new Error('PDF generation did not return a file.');

  if (Platform.OS === 'android') {
    if (!base64) throw new Error('PDF generation returned no content. Please retry the export.');
    const downloadsDirectory = LegacyFileSystem.StorageAccessFramework.getUriForDirectoryInRoot('Download');
    const permission = await LegacyFileSystem.StorageAccessFramework
      .requestDirectoryPermissionsAsync(downloadsDirectory);
    if (!permission.granted) throw new Error('Download folder access is required to save the PDF.');

    const destination = await LegacyFileSystem.StorageAccessFramework.createFileAsync(
      permission.directoryUri, filename.replace(/\.pdf$/, ''), 'application/pdf'
    );
    // Expo Go may not permit legacy FileSystem reads of Print's cache URI.
    // Use the bytes returned by Print instead of reopening that temporary file.
    await LegacyFileSystem.StorageAccessFramework.writeAsStringAsync(destination, base64, {
      encoding: LegacyFileSystem.EncodingType.Base64,
    });
    return;
  }

  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await Sharing.shareAsync(uri, {
    dialogTitle: 'Export sensor readings PDF', mimeType: 'application/pdf', UTI: 'com.adobe.pdf',
  });
}

export async function exportSensorReadingsPdf(readings: SensorReading[], zoneName?: string): Promise<void> {
  if (readings.length === 0) throw new Error('There are no sensor readings to export.');
  await exportReportHtml(toPdfHtml(readings, 'Soil Sensor Report', zoneName));
}

export const exportSensorReadings = exportSensorReadingsPdf;
