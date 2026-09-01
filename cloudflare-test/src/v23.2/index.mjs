import {
  COMPETITION_KEYS,
  COMPETITIONS,
  getCompetitionConfig,
} from './competition-config.mjs';
import {
  normalizeMatch,
  normalizeTeam,
  shouldIncludeMatch,
} from './match-normalizer.mjs';
import {
  sortChronologically,
  matchesForCompetition,
  groupForCompetition,
  availablePredictions,
  nextMatchForTeam,
} from './tournament-engine.mjs';
import {
  resolveTelegramInitData,
  loadCompetitionMatches,
} from './data-client.mjs';

globalThis.CiaoV232Core = Object.freeze({
  version: '23.2-core',
  competitions: COMPETITION_KEYS,
  competitionConfig: COMPETITIONS,
  getCompetitionConfig,
  normalizeMatch,
  normalizeTeam,
  shouldIncludeMatch,
  sortChronologically,
  matchesForCompetition,
  groupForCompetition,
  availablePredictions,
  nextMatchForTeam,
  resolveTelegramInitData,
  loadCompetitionMatches,
});
