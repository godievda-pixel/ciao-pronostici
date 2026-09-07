import test from 'node:test';
import assert from 'node:assert/strict';
import { multitournamentCardThemeSource } from '../scripts/multitournament-card-theme.mjs';

test('external tournament cards render halftime, extra time and penalties explicitly', () => {
  const source = multitournamentCardThemeSource();
  assert.match(source, /match\?\.status==='halftime'/);
  assert.match(source, /ПЕРЕРЫВ/);
  assert.match(source, /match\?\.status==='extra_time'/);
  assert.match(source, /ДОП\. ВРЕМЯ/);
  assert.match(source, /match\?\.status==='penalties'/);
  assert.match(source, /ПЕНАЛЬТИ/);
});

test('halftime, extra time and penalties retain the current score', () => {
  const source = multitournamentCardThemeSource();
  assert.match(source, /\['live','halftime','extra_time','penalties','finished'\]\.includes/);
});
