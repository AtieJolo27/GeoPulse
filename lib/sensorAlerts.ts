export interface SensorReading {
  id?: string | number;
  created_at?: string;
  soil_moisture?: number | string;
  soil_temperature?: number | string;
  ph?: number | string;
  [key: string]: unknown;
}

export interface SensorAlert {
  field: string;
  fieldTl: string;
  message: string;
  messageTl: string;
  date: string;
  dateTl: string;
  severity: 'high' | 'medium' | 'low';
}

const getTimeAgo = (date: Date, now: Date) => {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return { en: 'Just now', tl: 'Ngayon lang' };
  if (minutes < 60) return { en: `${minutes} min ago`, tl: `${minutes} minuto ang nakalipas` };
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return { en: `${hours} hr ago`, tl: `${hours} oras ang nakalipas` };
  const days = Math.floor(hours / 24);
  return days === 1 ? { en: '1 day ago', tl: '1 araw ang nakalipas' } : { en: `${days} days ago`, tl: `${days} araw ang nakalipas` };
};

export function computeSensorAlerts(record: SensorReading | null): SensorAlert[] {
  if (!record) return [];

  const alerts: SensorAlert[] = [];
  const recordDate = record.created_at ? new Date(record.created_at) : new Date();
  const timeAgo = getTimeAgo(recordDate, new Date());
  const add = (field: string, fieldTl: string, message: string, messageTl: string, severity: SensorAlert['severity']) =>
    alerts.push({ field, fieldTl, message, messageTl, date: timeAgo.en, dateTl: timeAgo.tl, severity });

  const temperature = Number(record.soil_temperature);
  if (Number.isFinite(temperature)) {
    if (temperature > 35) add('Soil Temperature', 'Temperatura ng Lupa', `Temperature too high (${temperature}°C), exceeds optimal range`, `Masyadong mataas ang temperatura (${temperature}°C), lampas sa optimal na antas`, 'high');
    else if (temperature < 15) add('Soil Temperature', 'Temperatura ng Lupa', `Temperature too low (${temperature}°C), below optimal range`, `Masyadong mababa ang temperatura (${temperature}°C), mababa sa optimal na antas`, 'medium');
  }

  const moisture = Number(record.soil_moisture);
  if (Number.isFinite(moisture)) {
    if (moisture < 60) add('Soil Moisture', 'Halumigmig ng Lupa', `Moisture level too low (${moisture}%)`, `Masyadong mababa ang antas ng kahalumigmigan (${moisture}%)`, 'high');
    else if (moisture > 85) add('Soil Moisture', 'Halumigmig ng Lupa', `Moisture level too high (${moisture}%) — risk of waterlogging`, `Masyadong mataas ang antas ng kahalumigmigan (${moisture}%) — peligro ng pagbaha`, 'medium');
  }

  const ph = Number(record.ph);
  if (Number.isFinite(ph)) {
    if (ph < 5.5) add('Soil pH', 'Antas ng pH', `Soil too acidic (pH ${ph}), below optimal range`, `Masyadong acidic ang lupa (pH ${ph}), mababa sa optimal na antas`, 'high');
    else if (ph > 8) add('Soil pH', 'Antas ng pH', `Soil too alkaline (pH ${ph}), above optimal range`, `Masyadong alkaline ang lupa (pH ${ph}), mataas sa optimal na antas`, 'medium');
  }

  return alerts;
}
