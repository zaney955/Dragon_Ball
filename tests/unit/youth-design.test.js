import { test } from 'node:test';
import assert from 'node:assert/strict';
import { YOUTH_PROFILES } from '../../src/characters/youth-profiles.js';
import { VICTORY_LINES, RELATION_LINES, selectVictoryLine } from '../../src/match/victory.js';
import music from '../../src/assets/music/manifest.js';
test('fourteen independent childhood profiles and fixed skill costs', () => {
  assert.equal(Object.keys(YOUTH_PROFILES).length, 14);
  for (const [id, p] of Object.entries(YOUTH_PROFILES)) {
    assert.ok(p.light.length >= 2);
    assert.ok(p.heavy.length >= 2);
    assert.equal(p.skills.length, 2);
    assert.equal(p.ult.kiCost, 100);
    assert.ok(VICTORY_LINES[id]);
    assert.ok(Object.keys(RELATION_LINES).some((k) => k.startsWith(id + ':')));
    for (const s of p.skills) {
      assert.ok(s.kiCost >= 30);
      assert.ok(s.startup > 0);
      assert.ok(s.cooldown >= 0);
    }
  }
  assert.equal(YOUTH_PROFILES.krillin.ult.motion, 'kamehameha');
  assert.equal(YOUTH_PROFILES.oolong.skills[0].ability, 'ogre');
  assert.equal(YOUTH_PROFILES.oolong.skills[1].ability, 'bat');
  assert.equal(YOUTH_PROFILES.tien.ult.lifeCost, 0.06);
});
test('victory dialogue direction and special shape precedence', () => {
  assert.equal(selectVictoryLine('goku', 'krillin', null), RELATION_LINES['goku:krillin']);
  assert.equal(selectVictoryLine('krillin', 'goku', null), RELATION_LINES['krillin:goku']);
  assert.equal(selectVictoryLine('goku', 'krillin', 'ape'), '咦？刚才发生什么事了？');
  assert.equal(selectVictoryLine('roshi', 'goku', 'muscle'), RELATION_LINES['roshi:goku']);
  assert.equal(selectVictoryLine('piccolo', 'korin'), VICTORY_LINES.piccolo);
});
test('eight original tracks have exact timing and structural length', () => {
  assert.equal(music.length, 8);
  for (const t of music) {
    assert.ok(t.duration > 0);
    if (t.loop) assert.ok(Math.abs(t.duration - (t.bars * 4 * 60) / t.bpm) < 1e-7);
  }
  assert.deepEqual(
    music.filter((t) => !t.loop).map((t) => t.duration),
    [4.5, 3, 3],
  );
});
