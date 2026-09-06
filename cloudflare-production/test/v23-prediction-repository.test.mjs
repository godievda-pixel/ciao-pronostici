import test from 'node:test';
import assert from 'node:assert/strict';
import { createPredictionRepository } from '../../supabase/functions/ciao-v23-api/repositories/predictions.mjs';

function clone(value) {
  return structuredClone(value);
}

function makeDb(seed = {}) {
  const tables = {
    cp_matches: clone(seed.cp_matches ?? []),
    cp_predictions: clone(seed.cp_predictions ?? []),
    cp_competition_predictions: clone(seed.cp_competition_predictions ?? []),
  };
  const calls = [];

  class Query {
    constructor(table) {
      this.table = table;
      this.filters = [];
      this.operation = 'select';
      this.payload = null;
      this.options = null;
    }

    select() { this.operation = 'select'; return this; }
    eq(column, value) { this.filters.push(row => row?.[column] === value); return this; }
    in(column, values) { const allowed = new Set(values); this.filters.push(row => allowed.has(row?.[column])); return this; }
    not(column, operator, value) {
      assert.equal(operator, 'is');
      assert.equal(value, null);
      this.filters.push(row => row?.[column] !== null && row?.[column] !== undefined);
      return this;
    }

    async maybeSingle() {
      const result = await this.execute();
      return {data:result.data?.[0] ?? null, error:result.error};
    }

    async upsert(payload, options = {}) {
      this.operation = 'upsert';
      this.payload = Array.isArray(payload) ? clone(payload) : [clone(payload)];
      this.options = options;
      return await this.execute();
    }

    async execute() {
      if (!(this.table in tables)) throw new Error(`unexpected_table:${this.table}`);
      if (this.operation === 'select') {
        const data = tables[this.table].filter(row => this.filters.every(filter => filter(row)));
        calls.push({table:this.table, operation:'select', rows:clone(data)});
        return {data:clone(data), error:null};
      }

      const conflict = String(this.options?.onConflict ?? '').split(',').map(value => value.trim()).filter(Boolean);
      for (const incoming of this.payload) {
        const index = conflict.length
          ? tables[this.table].findIndex(row => conflict.every(column => row?.[column] === incoming?.[column]))
          : -1;
        if (index >= 0) tables[this.table][index] = {...tables[this.table][index], ...clone(incoming)};
        else tables[this.table].push(clone(incoming));
      }
      calls.push({table:this.table, operation:'upsert', rows:clone(this.payload), options:clone(this.options)});
      return {data:clone(this.payload), error:null};
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }
  }

  return {
    db:{from(table) { return new Query(table); }},
    tables,
    calls,
  };
}

const kickoff = '2026-09-12T18:45:00Z';
const nowOpen = Date.parse('2026-09-12T18:00:00Z');

function serieAMatch(overrides = {}) {
  return {
    id:'serie_a:9001',
    providerMatchId:'9001',
    competition:'serie_a',
    season:'2026/27',
    kickoffAt:kickoff,
    status:'scheduled',
    isItalianRelevant:true,
    isQualification:false,
    stage:'Серия А',
    ...overrides,
  };
}

function externalMatch(competition = 'ucl', overrides = {}) {
  return {
    id:`${competition}:u1`,
    providerMatchId:'u1',
    competition,
    season:'2026/27',
    kickoffAt:kickoff,
    status:'scheduled',
    isItalianRelevant:true,
    isQualification:false,
    stage:competition === 'coppa_italia' ? '1/8 финала' : 'Общий этап',
    ...overrides,
  };
}

test('legacy Serie A and external stores return one identical prediction shape', async () => {
  const {db} = makeDb({
    cp_matches:[{id:101,bsd_event_id:9001,kickoff_at:kickoff,is_finished:false}],
    cp_predictions:[{user_id:7,match_id:101,home_score:2,away_score:1,points:5}],
    cp_competition_predictions:[{
      user_id:7,match_id:'ucl:u1',competition:'ucl',predicted_home:1,predicted_away:0,
      points:3,result_type:'goal_difference',locked_at:'2026-09-13T18:30:00Z',
    }],
  });
  const repository = createPredictionRepository({db});

  const rows = await repository.listByUser(7);
  const serieA = rows.find(row => row.competition === 'serie_a');
  const ucl = rows.find(row => row.competition === 'ucl');

  assert.deepEqual(serieA, {
    userId:7,
    matchId:'serie_a:9001',
    competition:'serie_a',
    predictedHome:2,
    predictedAway:1,
    points:5,
    resultType:'exact',
    lockedAt:'2026-09-12T18:30:00.000Z',
  });
  assert.deepEqual(Object.keys(ucl).sort(), Object.keys(serieA).sort());
  assert.deepEqual(ucl, {
    userId:7,
    matchId:'ucl:u1',
    competition:'ucl',
    predictedHome:1,
    predictedAway:0,
    points:3,
    resultType:'goal_difference',
    lockedAt:'2026-09-13T18:30:00Z',
  });
});

test('Serie A save keeps legacy cp_predictions and maps BSD event identity to cp_matches id', async () => {
  const fixture = makeDb({
    cp_matches:[{id:101,bsd_event_id:9001,kickoff_at:kickoff,is_finished:false}],
  });
  const repository = createPredictionRepository({db:fixture.db});

  const saved = await repository.save({userId:7,match:serieAMatch(),predictedHome:2,predictedAway:1,nowMs:nowOpen});

  assert.equal(saved.matchId, 'serie_a:9001');
  assert.equal(saved.lockedAt, '2026-09-12T18:30:00.000Z');
  assert.deepEqual(fixture.tables.cp_predictions.map(row => ({
    user_id:row.user_id, match_id:row.match_id, home_score:row.home_score, away_score:row.away_score,
  })), [{user_id:7,match_id:101,home_score:2,away_score:1}]);
  assert.equal(fixture.tables.cp_competition_predictions.length, 0);
});

test('Coppa/UCL/UEL/UECL saves stay in cp_competition_predictions with canonical ids', async () => {
  const fixture = makeDb();
  const repository = createPredictionRepository({db:fixture.db});

  for (const competition of ['coppa_italia','ucl','uel','uecl']) {
    const suffix = competition === 'coppa_italia' ? 'c1' : `${competition}1`;
    const match = externalMatch(competition, {id:`${competition}:${suffix}`,providerMatchId:suffix});
    const saved = await repository.save({userId:7,match,predictedHome:1,predictedAway:0,nowMs:nowOpen});
    assert.equal(saved.matchId, match.id);
  }

  assert.equal(fixture.tables.cp_predictions.length, 0);
  assert.deepEqual(
    fixture.tables.cp_competition_predictions.map(row => [row.competition,row.match_id]),
    [
      ['coppa_italia','coppa_italia:c1'],
      ['ucl','ucl:ucl1'],
      ['uel','uel:uel1'],
      ['uecl','uecl:uecl1'],
    ],
  );
});

test('save at the exact deadline is closed and performs no write', async () => {
  const fixture = makeDb({cp_matches:[{id:101,bsd_event_id:9001,kickoff_at:kickoff,is_finished:false}]});
  const repository = createPredictionRepository({db:fixture.db});
  const deadline = Date.parse('2026-09-12T18:30:00Z');

  await assert.rejects(
    () => repository.save({userId:7,match:serieAMatch(),predictedHome:2,predictedAway:1,nowMs:deadline}),
    /prediction_closed/,
  );
  assert.equal(fixture.calls.filter(call => call.operation === 'upsert').length, 0);
});

test('non-Italian European match cannot be written even with a canonical match id', async () => {
  const fixture = makeDb();
  const repository = createPredictionRepository({db:fixture.db});

  await assert.rejects(
    () => repository.save({
      userId:7,
      match:externalMatch('ucl',{id:'ucl:foreign',providerMatchId:'foreign',isItalianRelevant:false}),
      predictedHome:1,
      predictedAway:0,
      nowMs:nowOpen,
    }),
    /match_not_eligible/,
  );
  assert.equal(fixture.calls.filter(call => call.operation === 'upsert').length, 0);
});

test('points and user stats combine both stores without changing scored values', async () => {
  const fixture = makeDb({
    cp_matches:[
      {id:101,bsd_event_id:9001,kickoff_at:kickoff,is_finished:true},
      {id:102,bsd_event_id:9002,kickoff_at:kickoff,is_finished:true},
      {id:103,bsd_event_id:9003,kickoff_at:kickoff,is_finished:false},
    ],
    cp_predictions:[
      {user_id:7,match_id:101,home_score:2,away_score:1,points:5},
      {user_id:7,match_id:102,home_score:0,away_score:0,points:0},
      {user_id:7,match_id:103,home_score:1,away_score:1,points:null},
      {user_id:8,match_id:101,home_score:0,away_score:1,points:2},
    ],
    cp_competition_predictions:[
      {user_id:7,match_id:'ucl:u1',competition:'ucl',predicted_home:2,predicted_away:1,points:3,result_type:'goal_difference',locked_at:kickoff},
      {user_id:7,match_id:'uel:e1',competition:'uel',predicted_home:1,predicted_away:0,points:2,result_type:'outcome',locked_at:kickoff},
      {user_id:8,match_id:'uecl:c1',competition:'uecl',predicted_home:2,predicted_away:0,points:5,result_type:'exact',locked_at:kickoff},
    ],
  });
  const repository = createPredictionRepository({db:fixture.db});

  const points = await repository.pointsForCompetitions(['serie_a','ucl']);
  assert.deepEqual(points.map(row => [row.userId,row.competition,row.points]), [
    [7,'serie_a',5],
    [7,'serie_a',0],
    [8,'serie_a',2],
    [7,'ucl',3],
  ]);
  assert.deepEqual(await repository.statsForUser(7), {
    points:10,
    exact:1,
    successful:3,
    calculated:4,
  });
});
