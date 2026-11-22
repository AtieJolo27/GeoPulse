import {createCropEventStore} from '../../lib/cropEventStore';
function setup(raw:string, results = [{data:[],error:null}] as any[]){
 let readIndex=0;
 const rows=new Map([['geopulse_calendar_pending:farmer:7',raw]]);
 const storage={getItem:(k:string)=>rows.get(k)??null,setItem:(k:string,v:string)=>rows.set(k,v),removeItem:(k:string)=>rows.delete(k)};
 const query:any={};
 for(const name of ['select','eq','order']) query[name]=()=>query;
 query.then=(resolve:any)=>Promise.resolve(results[Math.min(readIndex++,results.length-1)]).then(resolve);
 const upsert=jest.fn().mockResolvedValue({error:{message:'Connection lost'}});
 const db:any={from:()=>({...query,upsert})};
 return {rows,store:createCropEventStore(db,storage,'farmer',7),upsert};
}
test('failed calendar sync retains pending dates for recovery',async()=>{
 const raw=JSON.stringify([{id:'local-1',user_id:'farmer',zone_id:7,crop:'rice',planted_on:'2026-11-01',kind:'harvest',event_date:'2027-02-01',notify_at:'2027-02-01T00:00:00Z',source:'manual',completed:false}]);
 const {store,rows}=setup(raw);
 await expect(store.load()).rejects.toThrow('Dates are safe on this device');
 expect(rows.get('geopulse_calendar_pending:farmer:7')).toBe(raw);
});
test('corrupt saved calendar is surfaced rather than silently discarded',async()=>{
 const {store,upsert}=setup('not JSON');
 await expect(store.load()).rejects.toThrow('could not be read');
 expect(upsert).not.toHaveBeenCalled();
});

const pending={id:'local-1',user_id:'farmer',zone_id:7,crop:'rice',planted_on:'2026-11-01',kind:'harvest',event_date:'2027-02-01',notify_at:'2027-02-01T00:00:00Z',source:'manual',completed:true};
test('failed refresh after upload retains local recovery copy',async()=>{
 const raw=JSON.stringify([pending]);
 const {store,rows,upsert}=setup(raw,[{data:[],error:null},{data:null,error:{message:'Refresh failed'}}]);
 upsert.mockResolvedValue({error:null});
 await expect(store.load()).rejects.toThrow('Refresh failed');
 expect(rows.get('geopulse_calendar_pending:farmer:7')).toBe(raw);
});
test('successful sync replaces temporary IDs and preserves completion',async()=>{
 const cloud={...pending,id:'cloud-1'};
 const {store,rows,upsert}=setup(JSON.stringify([pending]),[{data:[],error:null},{data:[cloud],error:null}]);
 upsert.mockResolvedValue({error:null});
 expect(await store.load()).toEqual({events:[cloud],deviceOnly:false});
 expect(upsert.mock.calls[0][0][0]).not.toHaveProperty('id');
 expect(upsert.mock.calls[0][0][0].completed).toBe(true);
 expect(rows.has('geopulse_calendar_pending:farmer:7')).toBe(false);
});
test('editing local reminder cannot overwrite an existing task on the same date',async()=>{
 const other={...pending,id:'local-2',event_date:'2027-02-02'};
 const raw=JSON.stringify([pending,other]);
 const {store,rows,upsert}=setup(raw);
 await expect(store.save([{...pending,event_date:other.event_date}] as any,pending as any)).rejects.toThrow('already exists');
 expect(rows.get('geopulse_calendar_pending:farmer:7')).toBe(raw);
 expect(upsert).not.toHaveBeenCalled();
});
