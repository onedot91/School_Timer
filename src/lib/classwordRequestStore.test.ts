import assert from 'node:assert/strict';
import test from 'node:test';
import { finishClasswordRequest, prepareClasswordRequest } from './classwordRequestStore';

test('manual retry retains request identity and original edit revision until confirmed or rejected', () => {
 const values=new Map<string,string>();
 const storage:Storage={get length(){return values.size;},clear:()=>values.clear(),getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value)},removeItem:key=>{values.delete(key)},key:index=>[...values.keys()][index]??null};
 const body={action:'save_entry',dateKey:'2099-09-08',entryId:'test-entry',initial:'ㄱ',word:'강아지',expectedRevision:'2026-09-08T01:00:00Z'};
 const first=prepareClasswordRequest(storage,2,body);
 const retry=prepareClasswordRequest(storage,2,{...body,expectedRevision:'2026-09-08T02:00:00Z'});
 assert.equal(retry.requestId,first.requestId);
 assert.equal(retry.expectedRevision,body.expectedRevision);
 assert.notEqual(prepareClasswordRequest(storage,4,body).requestId,first.requestId);
 finishClasswordRequest(storage,2,'save_entry',first.requestId);
 assert.notEqual(prepareClasswordRequest(storage,2,body).requestId,first.requestId);
});
