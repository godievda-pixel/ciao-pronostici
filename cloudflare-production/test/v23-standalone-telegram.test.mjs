import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramBridge } from '../src/v23/core/telegram.mjs';

test('Telegram bridge exposes init data/user and delegates ready/expand/back visibility', () => {
  const calls = [];
  const user = { id:446763142, first_name:'Даня', username:'test_user' };
  const BackButton = {
    show(){ calls.push('show'); },
    hide(){ calls.push('hide'); },
    onClick(handler){ calls.push(['onClick', handler]); },
    offClick(handler){ calls.push(['offClick', handler]); },
  };
  const webApp = {
    initData:'signed-init-data',
    initDataUnsafe:{ user },
    ready(){ calls.push('ready'); },
    expand(){ calls.push('expand'); },
    BackButton,
    contentSafeAreaInset:{ top:11, right:2, bottom:19, left:3 },
  };
  const bridge = createTelegramBridge({ Telegram:{ WebApp:webApp } });

  assert.equal(bridge.initData(), 'signed-init-data');
  assert.deepEqual(bridge.user(), user);
  bridge.ready();
  bridge.expand();
  bridge.setBackVisible(true);
  bridge.setBackVisible(false);
  assert.deepEqual(bridge.safeArea(), { top:11, right:2, bottom:19, left:3 });
  assert.deepEqual(calls.slice(0,4), ['ready','expand','show','hide']);
});

test('onBack owns one Telegram BackButton registration and unsubscribe removes the same handler', () => {
  const registered = [];
  const removed = [];
  const BackButton = {
    onClick(handler){ registered.push(handler); },
    offClick(handler){ removed.push(handler); },
    show(){},
    hide(){},
  };
  const bridge = createTelegramBridge({ Telegram:{ WebApp:{ BackButton, initData:'x', initDataUnsafe:{} } } });
  let count = 0;
  const handler = () => { count += 1; };

  const unsubscribeA = bridge.onBack(handler);
  const unsubscribeB = bridge.onBack(handler);
  assert.equal(registered.length, 1);
  registered[0]();
  assert.equal(count, 1);

  unsubscribeA();
  assert.equal(removed.length, 1);
  assert.equal(removed[0], registered[0]);
  unsubscribeB();
  assert.equal(removed.length, 1);
});

test('bridge is a safe no-op outside Telegram', () => {
  const bridge = createTelegramBridge({});
  assert.equal(bridge.initData(), '');
  assert.equal(bridge.user(), null);
  assert.doesNotThrow(() => bridge.ready());
  assert.doesNotThrow(() => bridge.expand());
  assert.doesNotThrow(() => bridge.setBackVisible(true));
  assert.deepEqual(bridge.safeArea(), { top:0, right:0, bottom:0, left:0 });
  const unsubscribe = bridge.onBack(() => {});
  assert.equal(typeof unsubscribe, 'function');
  assert.doesNotThrow(() => unsubscribe());
});

test('safeArea falls back to Telegram safeAreaInset and normalizes invalid values', () => {
  const bridge = createTelegramBridge({
    Telegram:{
      WebApp:{
        initData:'',
        initDataUnsafe:{},
        safeAreaInset:{ top:8, right:'4', bottom:null, left:-5 },
      },
    },
  });
  assert.deepEqual(bridge.safeArea(), { top:8, right:4, bottom:0, left:0 });
});
