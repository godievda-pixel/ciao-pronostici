import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveController } from '../src/v23/core/live-controller.mjs';

function fakeTimers(){
  let nextId=1;
  const queue=new Map();
  return {
    setTimer(fn,ms){const id=nextId++;queue.set(id,{fn,ms});return id;},
    clearTimer(id){queue.delete(id);},
    pending(){return [...queue.entries()];},
    async runNext(){
      const first=queue.entries().next().value;
      if(!first)return null;
      const[id,task]=first;
      queue.delete(id);
      await task.fn();
      return task.ms;
    },
  };
}

function deferred(){
  let resolve;
  let reject;
  const promise=new Promise((res,rej)=>{resolve=res;reject=rej;});
  return {promise,resolve,reject};
}

test('live controller owns exactly one timer and switching context cancels the prior timer',async()=>{
  const timers=fakeTimers();
  const calls=[];
  const live=createLiveController({
    refresh:async context=>{calls.push(context);return {context};},
    setTimer:timers.setTimer,
    clearTimer:timers.clearTimer,
    intervalMs:30000,
  });

  await live.start({screen:'home'});
  assert.equal(timers.pending().length,1);
  const firstTimerId=timers.pending()[0][0];

  await live.start({screen:'matches',tournament:'ucl'});
  assert.equal(timers.pending().length,1);
  assert.notEqual(timers.pending()[0][0],firstTimerId);
  assert.deepEqual(calls,[{screen:'home'},{screen:'matches',tournament:'ucl'}]);
  assert.deepEqual(live.state().context,{screen:'matches',tournament:'ucl'});

  live.stop();
  assert.equal(timers.pending().length,0);
  assert.equal(live.state().running,false);
});

test('failed refresh retains last good data and next successful refresh clears the error',async()=>{
  const timers=fakeTimers();
  let calls=0;
  const live=createLiveController({
    refresh:async()=>{
      calls+=1;
      if(calls===2)throw new Error('temporary');
      return {score:calls};
    },
    setTimer:timers.setTimer,
    clearTimer:timers.clearTimer,
    intervalMs:30000,
  });

  await live.start({screen:'match-center',competition:'ucl',matchId:'ucl:77'});
  assert.deepEqual(live.state().data,{score:1});
  assert.equal(live.state().error,null);

  await timers.runNext();
  assert.deepEqual(live.state().data,{score:1});
  assert.equal(live.state().error.message,'temporary');
  assert.equal(timers.pending().length,1);

  await timers.runNext();
  assert.deepEqual(live.state().data,{score:3});
  assert.equal(live.state().error,null);
  assert.equal(timers.pending().length,1);
});

test('a stale in-flight refresh cannot overwrite data after context changes',async()=>{
  const timers=fakeTimers();
  const oldRefresh=deferred();
  let calls=0;
  const live=createLiveController({
    refresh:async context=>{
      calls+=1;
      if(calls===1)return oldRefresh.promise;
      return {screen:context.screen,tournament:context.tournament??null};
    },
    setTimer:timers.setTimer,
    clearTimer:timers.clearTimer,
    intervalMs:30000,
  });

  const firstStart=live.start({screen:'home'});
  const secondStart=live.start({screen:'matches',tournament:'uel'});
  await secondStart;
  oldRefresh.resolve({screen:'home',stale:true});
  await firstStart;

  assert.deepEqual(live.state().context,{screen:'matches',tournament:'uel'});
  assert.deepEqual(live.state().data,{screen:'matches',tournament:'uel'});
  assert.equal(timers.pending().length,1);
});
