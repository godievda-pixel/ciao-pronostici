import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter } from '../src/modular/core/router.mjs';

function harness() {
  const rendered=[];
  const restored=[];
  const stack=[];
  let index=-1;
  let scrollY=0;
  let popHandler=null;
  const history={
    get length(){return stack.length},
    pushState(state){stack.splice(index+1);stack.push(state);index=stack.length-1},
    replaceState(state){if(index<0){stack.push(state);index=0}else stack[index]=state},
    back(){if(index<=0)return;index-=1;popHandler?.({state:stack[index]})},
  };
  const router=createRouter({
    history,
    renderRoute:route=>rendered.push(route),
    readScroll:()=>scrollY,
    restoreScroll:value=>restored.push(value),
    afterRender:fn=>fn(),
    fallbackRoute:{screen:'home'},
  });
  popHandler=event=>router.handlePopState(event);
  return {router,history,rendered,restored,setScroll:value=>{scrollY=value}};
}

const MATCH_PATHS=[
  [{screen:'favorite'},'serie_a','serie_a:101'],
  [{screen:'calcio'},'serie_a','serie_a:102'],
  [{screen:'matches',tournament:'serie_a'},'serie_a','serie_a:103'],
  [{screen:'matches',tournament:'coppa_italia'},'coppa_italia','coppa_italia:104'],
  [{screen:'matches',tournament:'ucl'},'ucl','ucl:105'],
  [{screen:'matches',tournament:'uel'},'uel','uel:106'],
  [{screen:'matches',tournament:'uecl'},'uecl','uecl:107'],
];

for(const [origin,competition,matchId] of MATCH_PATHS){
  test(`${origin.screen}${origin.tournament?`/${origin.tournament}`:''} → Match Center → visible Back restores route and scroll`,()=>{
    const h=harness();
    h.router.navigate(origin,{replace:true});
    h.setScroll(321);
    h.router.openMatchCenter({competition,matchId});
    h.router.back();
    const current=h.router.current();
    assert.equal(current.screen,origin.screen);
    assert.equal(current.tournament,origin.tournament||'');
    assert.equal(current.scrollY,321);
    assert.equal(h.restored.at(-1),321);
  });

  test(`${origin.screen}${origin.tournament?`/${origin.tournament}`:''} → Match Center → browser Back matches visible Back`,()=>{
    const visible=harness();
    visible.router.navigate(origin,{replace:true});
    visible.setScroll(222);
    visible.router.openMatchCenter({competition,matchId});
    visible.router.back();

    const system=harness();
    system.router.navigate(origin,{replace:true});
    system.setScroll(222);
    system.router.openMatchCenter({competition,matchId});
    system.history.back();

    assert.deepEqual(system.router.current(),visible.router.current());
    assert.equal(system.restored.at(-1),visible.restored.at(-1));
  });
}

test('Predictions subview and Tables tournament survive leave-and-back navigation',()=>{
  const predictions=harness();
  predictions.router.navigate({screen:'predictions',subview:'mine'},{replace:true});
  predictions.router.openMatchCenter({competition:'serie_a',matchId:'serie_a:201'});
  predictions.router.back();
  assert.equal(predictions.router.current().subview,'mine');

  const tables=harness();
  tables.router.navigate({screen:'tables',tournament:'uecl'},{replace:true});
  tables.router.openMatchCenter({competition:'uecl',matchId:'uecl:202'});
  tables.router.back();
  assert.equal(tables.router.current().tournament,'uecl');
});

test('stale Match Center history without competition/match id falls back to last valid top-level route',()=>{
  const h=harness();
  h.router.navigate({screen:'tables',tournament:'uel'},{replace:true});
  h.router.handlePopState({state:{ciaoRoute:{screen:'match-center',tournament:'',matchId:''}}});
  assert.equal(h.router.current().screen,'tables');
  assert.equal(h.router.current().tournament,'uel');
  assert.equal(h.rendered.at(-1).screen,'tables');
});
