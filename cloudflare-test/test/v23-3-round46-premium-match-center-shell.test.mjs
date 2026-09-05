import test from 'node:test';
import assert from 'node:assert/strict';
import { matchCenterTheme } from '../src/v23.3/match-center-theme.mjs';
import { renderMatchCenterView } from '../src/v23.3/match-center-view.mjs';

const REQUIRED_TOKENS = [
  '--mc-bg','--mc-bg-deep','--mc-surface','--mc-surface-2','--mc-surface-raised',
  '--mc-border','--mc-border-strong','--mc-accent','--mc-accent-2','--mc-accent-soft',
  '--mc-glow','--mc-pitch','--mc-pitch-line','--mc-home-marker','--mc-away-marker',
];

function state(competition = 'serie_a') {
  return {
    open:true,
    phase:'ready',
    competition,
    matchId:`${competition}:900`,
    activeTab:'overview',
    match:{
      competition,
      matchId:`${competition}:900`,
      status:'finished',
      kickoffAt:'2026-09-05T18:00:00Z',
      homeTeam:{ name:'Home United', crestUrl:'https://cdn/home.png' },
      awayTeam:{ name:'Away City', crestUrl:'https://cdn/away.png' },
      score:{ home:2, away:1 },
      goals:{
        home:[
          { player:'Marco Rossi', minute:34, addedTime:null, kind:'penalty', scoreAfter:{ home:1, away:0 } },
          { player:'Luca Bianchi', minute:45, addedTime:2, kind:'open_play', scoreAfter:{ home:2, away:1 } },
        ],
        away:[{ player:'Paolo Neri', minute:41, addedTime:null, kind:'own_goal', scoreAfter:{ home:1, away:1 } }],
      },
      coverage:{ overview:true, stats:true, events:true, lineups:true, players:true },
    },
    sections:{ overview:{}, stats:null, events:null, lineups:null, players:null },
    sectionState:{
      overview:{ status:'ready', error:'' },
      stats:{ status:'idle', error:'' },
      events:{ status:'idle', error:'' },
      lineups:{ status:'idle', error:'' },
      players:{ status:'idle', error:'' },
    },
  };
}

test('all five Match Center competition themes expose the premium token contract', () => {
  const keys = ['serie_a','coppa_italia','ucl','uel','uecl'];
  const themeKeys = new Set();
  for (const key of keys) {
    const theme = matchCenterTheme(key);
    themeKeys.add(theme.key);
    for (const token of REQUIRED_TOKENS) {
      assert.ok(theme.vars[token], `${key} missing ${token}`);
    }
  }
  assert.equal(themeKeys.size, 5);
});

test('premium hero renders scorers, qualifiers and added time below teams', () => {
  const html = renderMatchCenterView(state());
  assert.match(html, /data-cw239-scorers="home"/);
  assert.match(html, /Marco Rossi/);
  assert.match(html, /34′/);
  assert.match(html, /\(П\)/);
  assert.match(html, /Luca Bianchi/);
  assert.match(html, /45\+2′/);
  assert.match(html, /data-cw239-scorers="away"/);
  assert.match(html, /Paolo Neri/);
  assert.match(html, /\(АГ\)/);
  assert.doesNotMatch(html, /\[object Object\]|undefined|>null</);
});

test('premium Match Center hides system scrollbars without disabling vertical scrolling', () => {
  const html = renderMatchCenterView(state('ucl'));
  assert.match(html, /scrollbar-width\s*:\s*none/);
  assert.match(html, /::-webkit-scrollbar\{[^}]*display\s*:\s*none/s);
  assert.match(html, /overflow-x\s*:\s*hidden/);
  assert.doesNotMatch(html, /\.cw239-mc\{[^}]*overflow\s*:\s*hidden/s);
});

test('premium shell keeps all five tabs and a competition-specific theme marker', () => {
  const html = renderMatchCenterView(state('uel'));
  assert.match(html, /data-cw239-theme="europa"/);
  assert.equal((html.match(/data-cw239-tab=/g) || []).length, 5);
  assert.match(html, /--mc-accent:#f06722;--mc-accent-2:#ff9b32/);
});
