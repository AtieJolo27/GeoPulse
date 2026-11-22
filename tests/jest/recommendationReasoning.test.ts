import { getCropReasoning,getMatchSummary } from '../../lib/recommendation_reasoning';
const reading={nitrogen:80,phosphorus:40,potassium:40,ph:6,air_temperature:25,humidity:82};
test('matches all six in-range rice factors with case-insensitive crop lookup',()=>{
 expect(getMatchSummary('RICE',reading)).toEqual({matched:6,total:6});
 expect(getCropReasoning('rice',reading)).toHaveLength(6);
 expect(getCropReasoning('rice',reading).every(line=>line.includes('is within'))).toBe(true);
});
test('explains low and high factors',()=>{
 const reasons=getCropReasoning('rice',{...reading,nitrogen:0,ph:14});
 expect(reasons[0]).toContain('a bit low'); expect(reasons[5]).toContain('a bit high');
 expect(getMatchSummary('rice',{...reading,nitrogen:0,ph:14}).matched).toBe(4);
});
test('unknown crop reports unavailable profile',()=>{
 expect(getMatchSummary('unknown',reading)).toEqual({matched:0,total:6});
 expect(getCropReasoning('unknown',reading)[0]).toContain('No detailed profile');
});
