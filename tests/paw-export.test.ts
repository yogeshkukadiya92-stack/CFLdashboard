import test from 'node:test';
import assert from 'node:assert/strict';
import { pawExport } from '../lib/paw-export.ts';
test('PAW export selects only linked PAW workshops and strips private fields', () => {
  const result = pawExport({ registrationLinks: { a: {id:'a', title:'PAW November'}, b:{id:'b',title:'Healthy Forever'}, c:{id:'c',title:'Custom workshop'} }, registrations:[{id:'r',workshopId:'a',fullName:'Synthetic Person',mobile:'9999999999',answers:{private:'secret'},amountPaid:500}, {id:'other',workshopId:'b'}] }, ['c']);
  assert.deepEqual(result.workshops.map(w=>w.id), ['a','c']);
  assert.equal(result.registrations.length,1);
  assert.equal('answers' in result.registrations[0], false);
  assert.equal('amountPaid' in result.registrations[0], false);
});
test('unpublished existing links retain records for backfill, duplicate link configs do not duplicate workshops', () => {
  const result=pawExport({registrationLinks:{a:{id:'a',title:'PAW',published:false},b:{id:'a',title:'PAW'}},registrations:[{id:'r',workshopId:'a',registrationStatus:'waiting'}]});
  assert.equal(result.workshops.length,1);assert.equal(result.registrations[0].registrationStatus,'waiting');
});
test('selected master appears before any link or registration exists', () => {
  const result = pawExport({workshops:[{id:'new',name:'November cohort',pawSyncEnabled:true},{id:'auto',name:'PAW 31'},{id:'other',name:'Health'}]});
  assert.deepEqual(result.workshops.map(w=>w.id), ['new','auto']);
  assert.deepEqual(result.registrations, []);
});
test('explicit opt-out overrides automatic selection and link creation keeps stable identity', () => {
  const workshops=[{id:'a',name:'PAW 32',pawSyncEnabled:true},{id:'b',name:'PAW 33',pawSyncEnabled:false}];
  const before=pawExport({workshops});
  const after=pawExport({workshops,registrationLinks:{a:{id:'a',title:'PAW 32 registration'},b:{id:'b',title:'PAW 33'}},registrations:[{id:'r',workshopId:'a'}]},['b']);
  assert.deepEqual(before.workshops.map(w=>w.id),after.workshops.map(w=>w.id));
  assert.equal(after.registrations.length,1);
});
