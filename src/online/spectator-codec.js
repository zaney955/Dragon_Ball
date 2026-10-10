export const FIGHTER_FIELDS = [
  'hp',
  'ki',
  'guard',
  'state',
  'stateTimer',
  'walkPhase',
  'flightMode',
  'launchFlight',
  'launchElapsed',
  'facingAngle',
  'crouching',
  'flash',
  'escapeCharges',
  'stunTime',
  'comboIdx',
  'comboType',
  'comboTimer',
  'dashCooldown',
  'lastHitText',
  'receivedCombo',
  'damageTotal',
];
export const ATTACK_FIELDS = [
  'id',
  'name',
  'motion',
  'variant',
  'chainType',
  'chainIndex',
  'isUlt',
  'isThrow',
  'isKiBlast',
  'authored',
  'pursuitFollow',
  'isYouth',
  'shape',
  'ability',
  'effector',
  'dmg',
  'kiCost',
  'dur',
  'startup',
  'hitT',
  'active',
  'recovery',
  'range',
  'width',
  'targetY',
  'targetDistance',
  'targetScale',
  'drive',
  'costCommitted',
  'serial',
];
export const GEOMETRY_ARGS = {
  BoxGeometry: ['width', 'height', 'depth'],
  SphereGeometry: ['radius', 'widthSegments', 'heightSegments'],
  CylinderGeometry: ['radiusTop', 'radiusBottom', 'height', 'radialSegments'],
  ConeGeometry: ['radius', 'height', 'radialSegments'],
  CapsuleGeometry: ['radius', 'length', 'capSegments', 'radialSegments'],
  TorusGeometry: ['radius', 'tube', 'radialSegments', 'tubularSegments', 'arc'],
  RingGeometry: ['innerRadius', 'outerRadius', 'thetaSegments'],
  PlaneGeometry: ['width', 'height'],
  IcosahedronGeometry: ['radius', 'detail'],
  DodecahedronGeometry: ['radius', 'detail'],
  TetrahedronGeometry: ['radius', 'detail'],
};
const finite = (n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100000;
const vector = (a, length) => Array.isArray(a) && a.length === length && a.every(finite);
const primitive = (v) =>
  finite(v) || typeof v === 'boolean' || (typeof v === 'string' && v.length <= 120);
const fields = (o, keys) =>
  o &&
  typeof o === 'object' &&
  !Array.isArray(o) &&
  Object.entries(o).every(([k, v]) => keys.includes(k) && primitive(v));
export const pickFields = (object, keys) =>
  Object.fromEntries(keys.filter((k) => primitive(object?.[k])).map((k) => [k, object[k]]));
export const validTransform = (a) =>
  vector(a, 11) && a.slice(7, 10).every((v) => Math.abs(v) <= 100) && [0, 1].includes(a[10]);
function geometry(g) {
  if (!g || !Array.isArray(g.args)) return false;
  if (g.type === 'BufferGeometry')
    return (
      g.args.length >= 9 && g.args.length <= 72 && g.args.length % 3 === 0 && g.args.every(finite)
    );
  if (
    ['IcosahedronGeometry', 'DodecahedronGeometry', 'TetrahedronGeometry'].includes(g.type) &&
    (!Number.isInteger(g.args[1]) || g.args[1] > 3)
  )
    return false;
  return (
    g.type in GEOMETRY_ARGS &&
    Object.hasOwn(GEOMETRY_ARGS, g.type) &&
    g.args.length === GEOMETRY_ARGS[g.type].length &&
    g.args.every((n) => finite(n) && n >= 0 && n <= 64)
  );
}
export function validSpectatorFrame(frame) {
  return (
    !!frame &&
    Number.isSafeInteger(frame.seq) &&
    frame.seq > 0 &&
    finite(frame.timeLeft) &&
    finite(frame.ready) &&
    finite(frame.simTime) &&
    typeof frame.over === 'boolean' &&
    frame.world &&
    finite(frame.world.senzuTime) &&
    finite(frame.world.senzuNextSpawn) &&
    finite(frame.world.senzuSpawnCount) &&
    Array.isArray(frame.world.beans) &&
    frame.world.beans.length <= 2 &&
    frame.world.beans.every(
      (b) =>
        b && typeof b.active === 'boolean' && finite(b.x) && finite(b.z) && finite(b.expiresAt),
    ) &&
    Array.isArray(frame.world.broken) &&
    frame.world.broken.length <= 512 &&
    frame.world.broken.every(
      (b) =>
        Array.isArray(b) &&
        b.length === 3 &&
        Number.isInteger(b[0]) &&
        b[0] >= 0 &&
        b[0] < 512 &&
        validTransform(b[1]) &&
        Number.isInteger(b[2]) &&
        b[2] >= 0 &&
        b[2] <= 0xffffff,
    ) &&
    Array.isArray(frame.fighters) &&
    frame.fighters.length === 2 &&
    frame.fighters.every(
      (f) =>
        f &&
        vector(f.pos, 3) &&
        vector(f.velocity, 3) &&
        validTransform(f.root) &&
        fields(f.props, FIGHTER_FIELDS) &&
        (f.attack === null || fields(f.attack, ATTACK_FIELDS)) &&
        [null, 'ape', 'muscle', 'fourArms', 'ogre', 'bat', 'armor', 'combined'].includes(f.form) &&
        vector(f.cooldowns, 2) &&
        finite(f.formTime) &&
        finite(f.heals) &&
        typeof f.tailIntact === 'boolean' &&
        ['missile', 'flame'].includes(f.weapon) &&
        Array.isArray(f.parts) &&
        f.parts.length <= 64 &&
        f.parts.every(
          (p) =>
            Array.isArray(p) &&
            p.length === 2 &&
            typeof p[0] === 'string' &&
            /^[a-zA-Z][a-zA-Z0-9]*(?::[0-7])?$/.test(p[0]) &&
            validTransform(p[1]),
        ),
    ) &&
    Array.isArray(frame.objects) &&
    frame.objects.length <= 160 &&
    frame.objects.every(
      (o) =>
        o &&
        typeof o.id === 'string' &&
        o.id.length <= 64 &&
        geometry(o.geometry) &&
        validTransform(o.transform) &&
        Number.isInteger(o.color) &&
        o.color >= 0 &&
        o.color <= 0xffffff &&
        finite(o.opacity) &&
        o.opacity >= 0 &&
        o.opacity <= 1 &&
        typeof o.additive === 'boolean',
    )
  );
}
