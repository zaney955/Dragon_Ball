const identity = [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
export function spectatorFixture() {
  const actor = () => ({
    pos: [0, 0, 0],
    velocity: [0, 0, 0],
    root: [...identity],
    props: { hp: 100, ki: 100, state: 'idle', stateTimer: 0 },
    attack: null,
    form: null,
    formTime: 0,
    cooldowns: [0, 0],
    heals: 1,
    tailIntact: true,
    weapon: 'missile',
    parts: [['head', [...identity]]],
  });
  return {
    seq: 1,
    timeLeft: 90,
    ready: 0,
    over: false,
    simTime: 9,
    world: { senzuTime: 9, senzuNextSpawn: 25, senzuSpawnCount: 0, beans: [], broken: [] },
    fighters: [actor(), actor()],
    objects: [
      {
        id: 'projectile',
        geometry: { type: 'SphereGeometry', args: [0.1, 8, 8] },
        transform: [...identity],
        color: 0xffaa00,
        opacity: 1,
        additive: true,
      },
    ],
  };
}
