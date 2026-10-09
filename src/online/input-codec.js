export const HELD_KEYS = [
  'up',
  'down',
  'left',
  'right',
  'flight',
  'block',
  'crouch',
  'charge',
  'blastHeld',
];
export const ACTIONS = [
  'light',
  'heavy',
  'ult',
  'dash',
  'throw',
  'evasion',
  'pursuit',
  'jump',
  'blast',
  'special',
];

export function encodeInput(input) {
  let held = 0;
  HELD_KEYS.forEach((key, index) => {
    if (input[key]) held |= 1 << index;
  });
  return [
    held,
    Math.round((input.moveYaw ?? 0) * 100000) / 100000,
    (input.actions ?? []).map((a) => [ACTIONS.indexOf(a.type), +!!a.up, +!!a.down]),
  ];
}

export function decodeInput(data) {
  if (
    !Array.isArray(data) ||
    data.length !== 3 ||
    !Number.isInteger(data[0]) ||
    data[0] < 0 ||
    data[0] > 511 ||
    !Number.isFinite(data[1]) ||
    Math.abs(data[1]) > 7 ||
    !Array.isArray(data[2]) ||
    data[2].length > 20
  )
    throw new Error('输入数据无效');
  const input = { moveYaw: data[1], actions: [] };
  HELD_KEYS.forEach((key, index) => {
    input[key] = !!(data[0] & (1 << index));
  });
  for (const action of data[2]) {
    if (
      !Array.isArray(action) ||
      !Number.isInteger(action[0]) ||
      !ACTIONS[action[0]] ||
      ![0, 1].includes(action[1]) ||
      ![0, 1].includes(action[2])
    )
      throw new Error('动作数据无效');
    input.actions.push({ type: ACTIONS[action[0]], up: !!action[1], down: !!action[2] });
  }
  return input;
}
