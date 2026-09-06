import { createBsdModularProvider } from '../bsd-modular-provider.mjs';

const REQUIRED = Object.freeze(['serie_a','coppa_italia','ucl','uel','uecl']);
const EUROPE = new Set(['ucl','uel','uecl']);

function env(name) {
  const value = String(process.env[name] ?? '').trim();
  if (!value) throw new Error(`env_required:${name}`);
  return value;
}

function teamId(team) {
  return String(team?.id ?? '').trim();
}

function remember(map, team, source) {
  const id = teamId(team);
  if (!id) return;
  const name = String(team?.name ?? team?.shortName ?? '').trim();
  const current = map.get(id) ?? {id, name, sources: new Set()};
  if (!current.name && name) current.name = name;
  current.sources.add(source);
  map.set(id, current);
}

async function loadLocalizationIds({supabaseUrl, serviceRoleKey}) {
  const url = new URL('/rest/v1/cp_team_localizations', supabaseUrl);
  url.searchParams.set('select', 'provider_team_id');
  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`localization_http_${response.status}`);
  const rows = await response.json();
  return new Set((Array.isArray(rows) ? rows : []).map(row => String(row?.provider_team_id ?? '')).filter(Boolean));
}

async function discover(provider) {
  const teams = new Map();

  for (const competition of ['serie_a','coppa_italia']) {
    const matches = await provider.loadMatches({competition});
    for (const match of matches) {
      remember(teams, match?.home, `${competition}:matches`);
      remember(teams, match?.away, `${competition}:matches`);
    }
  }

  for (const competition of EUROPE) {
    const standings = await provider.loadStandings({competition});
    for (const row of standings?.rows ?? []) remember(teams, row?.team, `${competition}:standings`);
  }

  return teams;
}

async function main() {
  const apiKey = env('BSD_API_KEY');
  const supabaseUrl = env('SUPABASE_URL');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const provider = createBsdModularProvider({apiKey});

  const teams = await discover(provider);
  const localized = await loadLocalizationIds({supabaseUrl, serviceRoleKey});
  const discovered = [...teams.values()].sort((a,b) => Number(a.id) - Number(b.id) || a.name.localeCompare(b.name));
  const missing = discovered.filter(team => !localized.has(team.id));

  for (const team of discovered) {
    const sources = [...team.sources].sort().join(',');
    console.log(`${team.id}\t${team.name}\t${sources}\t${localized.has(team.id) ? 'ok' : 'missing'}`);
  }
  console.log(`competitions=${REQUIRED.join(',')}`);
  console.log(`discovered_teams=${discovered.length}`);
  console.log(`missing_localizations=${missing.length}`);

  if (missing.length) process.exitCode = 1;
}

await main();
