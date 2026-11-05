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
