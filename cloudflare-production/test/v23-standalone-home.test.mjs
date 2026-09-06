import test from 'node:test';
import assert from 'node:assert/strict';
import { createLastGoodCache } from '../src/v23/core/cache.mjs';
import { loadHome, renderHome } from '../src/v23/screens/home.mjs';
import { localDayBoundsUtc, toUiMatch } from '../src/v23/data/selectors.mjs';

const NOW = '2026-09-07T17:00:00.000Z';
const TIME_ZONE = 'Europe/Berlin';

const bootstrap = {
  user:{ id:7, telegramId:446763142, displayName:'Даниил', username:'godievda', photoUrl:'https://example.com/me.jpg' },
  stats:{ points:27, rank:3, exact:4, successful:9, calculated:12 },
  favoriteTeam:{ id:1, providerTeamId:'101', nameRu:'Интер', crestUrl:'https://example.com/inter.png', countryCode:'IT' },
  favoriteChoices:[],
  settings:{},
};

const favoriteMatch = {
  id:'ucl:77', providerMatchId:'77', competition:'ucl', competitionNameRu:'Лига чемпионов',
  season:'2026', stage:'Общий этап', round:null, kickoffAt:'2026-09-07T18:45:00.000Z',
  status:'scheduled', minute:null,
  home:{ id:'101', nameRu:'Интер', crestUrl:'https://example.com/inter.png' },
  away:{ id:'202', nameRu:'Арсенал', crestUrl:'https://example.com/arsenal.png' },
  score:{ home:null, away:null }, isItalianRelevant:true, isQualification:false,
};

const liveMatch = {
  id:'serie_a:88', providerMatchId:'88', competition:'serie_a', competitionNameRu:'Серия А',
  season:'2026', stage:'3 тур', round:3, kickoffAt:'2026-09-07T16:00:00.000Z',
  status:'live', minute:68,
  home:{ id:'303', nameRu:'Милан' }, away:{ id:'404', nameRu:'Рома' },
  score:{ home:2, away:1 }, isItalianRelevant:true, isQualification:false,
};

const earlierScheduledMatch = {
  ...favoriteMatch,
  id:'coppa_italia:66',
  competition:'coppa_italia',
  competitionNameRu:'Кубок Италии',
  stage:'1/8 финала',
  kickoffAt:'2026-09-07T15:00:00.000Z',
  home:{ id:'505', nameRu:'Ювентус' },
  away:{ id:'606', nameRu:'Лацио' },
};

function apiFixture({ today = [earlierScheduledMatch, liveMatch], favorite = favoriteMatch, failToday = false } = {}) {
  const calls = [];
  return {
    calls,
    async call(action, payload) {
      calls.push({ action, payload });
      if (action === 'bootstrap') return bootstrap;
      if (action === 'favorite_next_match') return favorite;
      if (action === 'calcio_today') {
        if (failToday) throw Object.assign(new Error('network_error'), { code:'network_error', message:'Не удалось связаться с сервером' });
        return today;
      }
      throw new Error(`unexpected_action:${action}`);
    },
  };
}

test('backend match shape is converted into one Russian UI match model without fake 0:0', () => {
  const ui = toUiMatch(favoriteMatch, { now:NOW, timeZone:TIME_ZONE });
  assert.equal(ui.homeTeam.nameRu, 'Интер');
  assert.equal(ui.awayTeam.nameRu, 'Арсенал');
  assert.equal(ui.stageNameRu, 'Общий этап');
  assert.equal(ui.statusRu, 'Скоро');
  assert.equal(ui.timeLabel, 'Сегодня · 20:45');
  assert.deepEqual(ui.score, { home:null, away:null });
});

test('Home loads real bootstrap/favorite/today actions and renders approved blocks with live first', async () => {
  const api = apiFixture();
  const model = await loadHome(api, createLastGoodCache(), () => new Date(NOW), TIME_ZONE);
  assert.equal(model.profile.displayName, 'Даниил');
  assert.equal(model.stats.points, 27);
  assert.equal(model.favoriteTeam.nameRu, 'Интер');
  assert.equal(model.favoriteNextMatch.id, 'ucl:77');
  assert.equal(model.calcioToday[0].id, 'serie_a:88');
  assert.equal(model.calcioToday[0].statusRu, "В эфире · 68'");

  assert.deepEqual(api.calls.map(call => call.action), ['bootstrap','favorite_next_match','calcio_today']);
  assert.equal(api.calls[1].payload.favorite_team_provider_id, '101');
  assert.equal(api.calls[1].payload.now_iso, NOW);

  const html = renderHome(model);
  assert.match(html, /data-screen="home"/);
  assert.match(html, /data-action="open-settings"/);
  assert.match(html, /Даниил/);
  assert.match(html, /27/);
  assert.match(html, /3/);
  assert.match(html, /4/);
  assert.match(html, /Любимый клуб/);
  assert.match(html, /Интер/);
  assert.match(html, /Кальчо сегодня/);
  assert.match(html, /data-match-id="ucl:77"/);
  assert.match(html, /data-match-id="serie_a:88"/);
  assert.doesNotMatch(html, /0 — 0/);
  assert.doesNotMatch(html, /Мои прогнозы|Сделать прогноз|Прогнозы/);
  assert.ok(html.indexOf('serie_a:88') < html.indexOf('coppa_italia:66'), 'live card should render first');
});

test('Home uses exact empty Calcio copy and favorite selection CTA when no favorite exists', async () => {
  const api = apiFixture({ today:[], favorite:null });
  api.call = async function(action, payload) {
    this.calls.push({action,payload});
    if (action === 'bootstrap') return { ...bootstrap, favoriteTeam:null };
    if (action === 'calcio_today') return [];
    throw new Error(`unexpected_action:${action}`);
  };
  const model = await loadHome(api, createLastGoodCache(), () => new Date(NOW), TIME_ZONE);
  const html = renderHome(model);
  assert.equal(api.calls.some(call => call.action === 'favorite_next_match'), false);
  assert.match(html, /Кальчо сегодня нет :\(/);
  assert.match(html, /Выбрать любимый клуб/);
});

test('local day boundaries are derived from the supplied device timezone, not IP or Moscow time', () => {
  const berlin = localDayBoundsUtc('2026-09-07T21:30:00.000Z', 'Europe/Berlin');
  assert.deepEqual(berlin, {
    start:'2026-09-06T22:00:00.000Z',
    end:'2026-09-07T22:00:00.000Z',
  });
  const moscow = localDayBoundsUtc('2026-09-07T21:30:00.000Z', 'Europe/Moscow');
  assert.deepEqual(moscow, {
    start:'2026-09-07T21:00:00.000Z',
    end:'2026-09-08T21:00:00.000Z',
  });
});

test('loadHome sends the exact local midnight interval to calcio_today', async () => {
  const api = apiFixture({ today:[] });
  await loadHome(api, createLastGoodCache(), () => new Date('2026-09-07T21:30:00.000Z'), 'Europe/Berlin');
  const todayCall = api.calls.find(call => call.action === 'calcio_today');
  assert.deepEqual(todayCall.payload, {
    local_date_start_utc:'2026-09-06T22:00:00.000Z',
    local_date_end_utc:'2026-09-07T22:00:00.000Z',
  });
});

test('failed Home refresh retains last-good Calcio data and shows one inline refresh error', async () => {
  const cache = createLastGoodCache();
  const first = await loadHome(apiFixture(), cache, () => new Date(NOW), TIME_ZONE);
  assert.equal(first.calcioToday.length, 2);

  const second = await loadHome(apiFixture({ failToday:true }), cache, () => new Date(NOW), TIME_ZONE);
  assert.equal(second.calcioToday.length, 2);
  assert.equal(second.refreshError, true);
  const html = renderHome(second);
  assert.match(html, /Не удалось обновить/);
  assert.match(html, /data-match-id="serie_a:88"/);
});
