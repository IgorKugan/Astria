'use strict';
const assert=require('node:assert/strict');
const {planViewLoads}=require('../src/view-loads');
const accounts=[
 {id:'background-1',activity:'always'},
 {id:'background-2',activity:'always'},
 {id:'selected',activity:'always'},
 {id:'visible',activity:'visible'},
 {id:'hidden',activity:'visible'},
 {id:'paused',activity:'suspended'}
];
const base={ready:true,visible:new Set(['selected']),existing:new Set(),loading:new Set(),selected:'selected'};
const plan=overrides=>planViewLoads(accounts,{...base,...overrides}).map(a=>a.id);
assert.deepEqual(plan({ready:false}),[],'do not open hidden accounts before the first layout');
assert.deepEqual(plan({}),['selected'],'selected game starts before earlier hidden Always active entries');
assert.deepEqual(plan({visible:new Set(['selected','visible','paused'])}),['selected','visible'],'two visible pages may start together; paused pages stay unloaded');
assert.deepEqual(plan({existing:new Set(['selected']),loading:new Set(['selected'])}),[],'background profiles wait for visible navigation');
assert.deepEqual(plan({existing:new Set(['selected'])}),['background-1'],'start one hidden profile at a time');
assert.deepEqual(plan({existing:new Set(['selected','background-1']),loading:new Set(['background-1'])}),[],'no background disk burst');
assert.deepEqual(plan({existing:new Set(['selected','background-1'])}),['background-2'],'Always active profiles eventually start');
assert.deepEqual(plan({existing:new Set(['background-1','background-2']),loading:new Set(['background-1','background-2'])}),['selected'],'an explicit foreground selection is not blocked by slow hidden pages');
assert.deepEqual(plan({visible:new Set(),existing:new Set(['selected','background-1','background-2'])}),[],'hidden visible-only accounts are not preloaded');
assert.deepEqual(planViewLoads([{id:'low',activity:'eco'}],{...base,visible:new Set()}).map(a=>a.id),['low'],'power-saving accounts start while hidden');
console.log('PASS: foreground priority, bounded loading, slow-site selection and activity policies');

assert.deepEqual(planViewLoads([{id:'auto-low',activity:'adaptive'}],{...base,visible:new Set()}).map(a=>a.id),['auto-low'],'adaptive accounts stay loaded in background');
