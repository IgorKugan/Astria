'use strict';
const assert=require('node:assert/strict');
const {floatingPosition,floatingAccount,floatingBounds,positionAt}=require('../src/floating-layout');
assert.deepEqual(floatingPosition({x:-2,y:Infinity,accountId:'bad/path'}),{x:0,y:1});
assert.deepEqual(floatingPosition({width:2,pinned:true}),{x:1,y:1,width:1,pinned:true});
assert.deepEqual(floatingPosition({width:NaN,pinned:'yes'}),{x:1,y:1});
const state={activeWorkspaceId:'w',selectedAccountId:'a',workspaces:[{id:'w',layout:'floating',floating:{accountId:'c'}}],accounts:[{id:'a',workspaceId:'w'},{id:'b',workspaceId:'w',activity:'suspended'},{id:'c',workspaceId:'w'},{id:'d',workspaceId:'other'}]};
assert.equal(floatingAccount(state).id,'c');state.accounts[2].activity='suspended';assert.equal(floatingAccount(state),undefined);
state.accounts[1].activity='visible';assert.equal(floatingAccount(state).id,'b');state.workspaces[0].layout='focus';assert.equal(floatingAccount(state),undefined);
const area={x:160,y:70,width:1000,height:600},size={width:1280,height:720};
for(const position of [{x:0,y:0},{x:1,y:1},{x:.3,y:.8}]){
 const card=floatingBounds(area,size,position);assert.ok(card.x>=area.x+8&&card.y>=area.y+8);assert.ok(card.x+card.width<=area.x+area.width-8&&card.y+card.height<=area.y+area.height-8);
 const restored=positionAt(area,card,card.x,card.y);assert.ok(Math.abs(restored.x-position.x)<.005&&Math.abs(restored.y-position.y)<.005);
 assert.deepEqual(positionAt(area,card,-1e6,1e6),{x:0,y:1});
}
assert.equal(floatingBounds({x:0,y:0,width:100,height:80},size,{}),null);
const small=floatingBounds(area,size,{width:.18}),large=floatingBounds(area,size,{width:.6});
assert.equal(small.width,180);assert.equal(large.width,600,'saved width controls miniature size');
for(const ratio of [.001,.18,.6,1]){
 const card=floatingBounds(area,size,{x:1,y:1,width:ratio});
 assert.ok(card.width>=180&&card.width<=area.width-16);
 assert.ok(card.x+card.width<=area.x+area.width-8&&card.y+card.height<=area.y+area.height-8);
 assert.ok(Math.abs((card.height-28)-(card.width-4)*size.height/size.width)<=1,'resize preserves game proportions');
}
console.log('PASS: floating account eligibility, normalized positions, sizing and bounds');
