import { setCache,getCache,clearCache,clearAllCaches } from '../../lib/cache';
let rows: Map<string,string>;
beforeEach(() => {
 rows=new Map();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>rows.set(k,v),removeItem:(k:string)=>rows.delete(k),key:(i:number)=>Array.from(rows.keys())[i]??null,get length(){return rows.size;}}});
 jest.spyOn(Date,'now').mockReturnValue(1000);
 jest.spyOn(console,'warn').mockImplementation(()=>{});
});
afterEach(()=>jest.restoreAllMocks());
test('round-trips data and expires old entries',async()=>{
 await setCache('sensor',{moisture:25},100);
 expect(await getCache('sensor')).toEqual({moisture:25});
 jest.spyOn(Date,'now').mockReturnValue(1101);
 expect(await getCache('sensor')).toBeNull();
 expect(rows.has('cache_sensor')).toBe(false);
});
test('missing and corrupt values return null',async()=>{
 expect(await getCache('missing')).toBeNull(); rows.set('cache_bad','invalid'); expect(await getCache('bad')).toBeNull();
});
test('clears only cache keys and preserves account preferences',async()=>{
 rows.set('language','en'); await setCache('a',1); await setCache('b',2);
 await clearCache('a'); expect(await getCache('a')).toBeNull();
 await clearAllCaches(); expect(Array.from(rows.entries())).toEqual([['language','en']]);
});
