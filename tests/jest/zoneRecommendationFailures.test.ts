import { loadZoneRecommendations } from '../../lib/zoneRecommendations';
jest.mock('../../lib/supabaseClient',()=>({supabase:{from:jest.fn()}}));
import { supabase } from '../../lib/supabaseClient';
const reading={soil_moisture:25,soil_temperature:24,air_temperature:28,humidity:70,ph:6,nitrogen:20,phosphorus:20,potassium:30};
let query: any;
let request: jest.Mock;
const originalFetch=globalThis.fetch;
afterAll(()=>{globalThis.fetch=originalFetch;});
beforeEach(()=>{
 query={};
 for(const method of ['select','eq','order','limit','abortSignal']) query[method]=jest.fn(()=>query);
 query.maybeSingle=jest.fn().mockResolvedValue({data:reading,error:null});
 (supabase.from as jest.Mock).mockReturnValue(query);
 request=jest.fn(); globalThis.fetch=request;
});
afterEach(()=>jest.restoreAllMocks());
test('database access failure stops recommendations and preserves the error',async()=>{
 query.maybeSingle.mockResolvedValue({data:null,error:{message:'Permission denied'}});
 await expect(loadZoneRecommendations('https://test.invalid',7,new AbortController().signal)).rejects.toThrow('Permission denied');
 expect(request).not.toHaveBeenCalled();
});
test.each([{humidity:101},{soil_moisture:-1},{nitrogen:-1},{ph:15}])('invalid sensor values prevent crop and fertilizer requests: %j',change=>{
 query.maybeSingle.mockResolvedValue({data:{...reading,...change},error:null});
 return expect(loadZoneRecommendations('https://test.invalid',7,new AbortController().signal)).rejects.toThrow('invalid').then(()=>expect(request).not.toHaveBeenCalled());
});
test('network failure gives farmer actionable connection guidance',async()=>{
 request.mockRejectedValue(new TypeError('fetch failed'));
 await expect(loadZoneRecommendations('https://test.invalid',7,new AbortController().signal)).rejects.toThrow('internet connection');
});
test('cancelled recommendation request explains timeout',async()=>{
 const controller=new AbortController();
 request.mockImplementation(async()=>{controller.abort();throw new Error('aborted');});
 await expect(loadZoneRecommendations('https://test.invalid',7,controller.signal)).rejects.toThrow('timed out');
});

test('modern response preserves planted-crop fertilizer results and evidence',async()=>{
 const result={zone_id:7,reading,crop:{best_crop:'corn',recommendations:[{crop:'corn'}]},fertilizer:{recommendations:[{fertilizer:'Urea',sources:[{title:'Test evidence'}]}]},fertilizer_crop_source:'planted',fertilizer_crop:'rice'};
 request.mockResolvedValue({status:200,ok:true,json:async()=>result});
 expect(await loadZoneRecommendations('https://modern-result.invalid/',7,new AbortController().signal)).toEqual(result);
 expect(request).toHaveBeenCalledTimes(1);
 expect(request.mock.calls[0][0]).toBe('https://modern-result.invalid/zones/7/recommendations');
});
test('legacy prediction failure preserves service explanation',async()=>{
 request.mockResolvedValueOnce({status:404}).mockResolvedValueOnce({ok:false,json:async()=>({detail:'Model unavailable'})});
 await expect(loadZoneRecommendations('https://legacy-error.invalid',7,new AbortController().signal)).rejects.toThrow('Model unavailable');
});
test('malformed legacy crop result is rejected instead of displaying empty recommendations',async()=>{
 request.mockResolvedValueOnce({status:404}).mockResolvedValueOnce({ok:true,json:async()=>({crop:{best_crop:'rice'}})});
 await expect(loadZoneRecommendations('https://legacy-malformed.invalid',7,new AbortController().signal)).rejects.toThrow('unexpected crop result');
});
test('latest reading query uses timestamp then ID to break ties',async()=>{
 request.mockResolvedValue({status:200,ok:true,json:async()=>({zone_id:7})});
 await loadZoneRecommendations('https://latest.invalid',7,new AbortController().signal);
 expect(query.order.mock.calls).toEqual([['created_at',{ascending:false,nullsFirst:false}],['id',{ascending:false}]]);
 expect(query.limit).toHaveBeenCalledWith(1);
});
