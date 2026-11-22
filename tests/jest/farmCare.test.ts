import { getFieldWeatherAlert, getNutrientTrends, buildFarmTasks } from '../../lib/farmCare';
test.each([[40,33,60,'urgent'],[80,25,85,'warning'],[70,33,60,'warning'],[70,25,60,'healthy']])('weather decision for moisture %s temperature %s humidity %s', (soil_moisture,air_temperature,humidity,tone) => expect(getFieldWeatherAlert({soil_moisture:Number(soil_moisture),air_temperature:Number(air_temperature),humidity:Number(humidity)}).tone).toBe(tone));
test('insufficient history has unknown trends', () => expect(getNutrientTrends([]).every(t=>t.direction==='unknown')).toBe(true));
test('compares recent seven readings against previous seven', () => {
 const rows = [...Array(7).fill({nitrogen:40,phosphorus:10,potassium:30,ph:6.5}),...Array(7).fill({nitrogen:20,phosphorus:30,potassium:30,ph:6.5})];
 expect(getNutrientTrends(rows).map(t=>t.direction)).toEqual(['up','down','steady','steady']);
});
test('dry low-nitrogen field receives moisture, compost and review tasks', () => {
 const tasks=buildFarmTasks({soil_moisture:40,nitrogen:10},new Date('2026-11-17T12:00:00Z'));
 expect(tasks.map(t=>t.id)).toEqual(['2026-11-17-moisture-check','2026-11-17-compost','2026-11-17-weekly-review']);
 expect(tasks.every(t=>t.titleEn && t.titleTl)).toBe(true);
});
