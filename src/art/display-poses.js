import * as THREE from 'three';

// These poses belong to model previews only; combat keeps its own animation rig.
// Hand targets use the original human rig's torso space and scale to each anatomy.
export const DISPLAY_POSES = {
  goku: {
    name: '如意棒起势',
    lL: [0.12, 0.15, -0.16],
    lR: [-0.2, -0.15, 0.16],
    t: [0.03, -0.15, -0.06],
    h: [0, 0.18, 0],
    right: [0.58, 0.65, 0.16],
    left: [-0.36, 0.04, 0.32],
    handR: [0, 0, -0.5],
    staff: true,
  },
  roshi: {
    name: '龟派气功蓄势',
    lL: [-0.24, 0, -0.23],
    lR: [0.23, 0, 0.23],
    t: [0.1, -0.24, 0],
    h: [0, 0.28, 0],
    right: [0.3, -0.02, 0.48],
    left: [0.15, -0.12, 0.48],
    handR: [0, 0, -Math.PI / 2],
    handL: [0, 0, Math.PI / 2],
    fingers: 'cup',
  },
  taopaipai: {
    name: '洞洞波指势',
    lL: [0.06, 0, -0.08],
    lR: [-0.12, 0, 0.1],
    t: [0, -0.18, 0],
    h: [-0.05, 0.18, 0],
    right: [0.26, 0.43, 0.61],
    left: [-0.34, -0.13, -0.12],
    handR: [-Math.PI / 2, 0, 0],
    fingers: 'point',
  },
  piccolo: {
    name: '魔王抱臂',
    lL: [0, 0.1, -0.12],
    lR: [0, -0.1, 0.12],
    t: [-0.035, 0, 0],
    h: [-0.1, 0, 0],
    right: [-0.22, 0.24, 0.38],
    left: [0.22, 0.12, 0.43],
    handR: [0, 0, Math.PI / 2],
    handL: [0, 0, -Math.PI / 2],
  },
  tien: {
    name: '气功炮手印',
    lL: [0.08, 0, -0.19],
    lR: [-0.08, 0, 0.19],
    h: [0.02, 0, 0],
    right: [0.11, 0.5, 0.51],
    left: [-0.11, 0.5, 0.51],
    handR: [0, 0, -2.6],
    handL: [0, 0, 2.6],
    fingers: 'triangle',
  },
  krillin: {
    name: '龟仙流低架',
    lL: [-0.23, 0, -0.22],
    lR: [0.21, 0, 0.22],
    t: [0.12, 0.15, 0],
    h: [-0.04, -0.15, 0],
    right: [0.35, 0.07, 0.32],
    left: [-0.32, 0.46, 0.46],
    handL: [-0.5, 0, -0.3],
  },
  yamcha: {
    name: '狼牙风风拳',
    lL: [0.27, 0, -0.21],
    lR: [-0.27, 0, 0.21],
    t: [0.14, -0.22, 0.08],
    h: [0, 0.2, 0],
    right: [0.53, 0.5, 0.34],
    left: [-0.31, 0.18, 0.55],
    handR: [-1.4, 0, -0.2],
    handL: [-1.4, 0, 0.2],
    fingers: 'claw',
  },
  gyumao: {
    name: '巨斧镇守',
    lL: [0, 0, -0.17],
    lR: [0, 0, 0.17],
    h: [-0.06, -0.1, 0],
    right: [0.57, 0.08, 0.19],
    left: [-0.42, -0.08, 0.23],
    handR: [0, 0, -0.18],
  },
  chichi: {
    name: '头盔飞刃起势',
    lL: [0.09, 0, -0.13],
    lR: [-0.17, 0, 0.12],
    t: [0, 0.12, 0],
    h: [0, -0.15, -0.06],
    right: [0.25, 0.86, 0.12],
    left: [-0.47, 0.21, 0.4],
  },
  bulma: {
    name: '持枪探险',
    lL: [0, 0, -0.04],
    lR: [-0.14, 0, 0.13],
    t: [0, 0, -0.08],
    h: [0, -0.16, 0.08],
    right: [0.49, 0.63, 0.17],
    left: [-0.28, -0.04, 0.15],
    handR: [-Math.PI / 2, 0, 0],
  },
  chiaotzu: {
    name: '浮空念力',
    lL: [0.09, 0, -0.06],
    lR: [0.09, 0, 0.06],
    right: [0.56, 0.35, 0.35],
    left: [-0.56, 0.35, 0.35],
    handR: [-Math.PI / 2, 0, 0],
    handL: [-Math.PI / 2, 0, 0],
    fingers: 'psychic',
    float: 0.24,
  },
  oolong: {
    name: '缩肩护头',
    lL: [0.1, 0, -0.08],
    lR: [-0.14, 0, 0.13],
    t: [0.12, 0.12, -0.04],
    h: [0.12, -0.1, 0.12],
    right: [0.35, 0.67, 0.18],
    left: [-0.4, 0.2, 0.31],
  },
  korin: {
    name: '拄杖捋须',
    lL: [0, 0, -0.05],
    lR: [0, 0, 0.05],
    h: [0.02, 0, -0.04],
    right: [0.42, 0.07, 0.15],
    left: [-0.19, 0.65, 0.38],
    handR: [0, 0, 0.1],
  },
  pilaf: {
    name: '机甲发号施令',
    lL: [0, 0, -0.12],
    lR: [0, 0, 0.12],
    t: [0, -0.12, 0],
    h: [-0.06, 0.15, 0],
    right: [0.58, 0.53, 0.38],
    left: [-0.45, -0.04, 0.17],
  },
};

const DOWN = new THREE.Vector3(0, -1, 0);

function poseArm(parts, side, target, handRotation) {
  const arm = parts['arm' + side],
    elbow = parts['elbow' + side],
    hand = parts['hand' + side];
  const upper = elbow.position.length(),
    lower = hand.position.length(),
    scale = upper / 0.34;
  const wrist = new THREE.Vector3(...target).multiplyScalar(scale);
  wrist.y += arm.position.y - 0.43 * scale;
  const direction = wrist.clone().sub(arm.position);
  const distance = THREE.MathUtils.clamp(
    direction.length(),
    Math.abs(upper - lower) + 0.001,
    upper + lower - 0.001,
  );
  direction.normalize();
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const bend = new THREE.Vector3(side === 'R' ? 1 : -1, -0.55, -0.25);
  bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  const joint = direction
    .clone()
    .multiplyScalar(along)
    .addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)));
  const foreDirection = direction.clone().multiplyScalar(distance).sub(joint).normalize();
  arm.quaternion.setFromUnitVectors(DOWN, joint.normalize());
  const foreRotation = new THREE.Quaternion().setFromUnitVectors(DOWN, foreDirection);
  elbow.quaternion.copy(arm.quaternion).invert().multiply(foreRotation);
  hand.quaternion
    .copy(foreRotation)
    .invert()
    .multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...(handRotation ?? [0, 0, 0]))));
}

function addFingers(parts, style, characters) {
  for (const side of style === 'point' ? ['R'] : ['L', 'R']) {
    const hand = parts['hand' + side];
    const scale = (parts.anatomy?.handR ?? 0.096) / 0.096;
    const colors = {
      point: 0xe9b68e,
      triangle: 0xe8b38b,
      claw: 0xe8b085,
      cup: 0xe8b889,
      psychic: 0xfff2d9,
    };
    const mat = characters.M(colors[style]);
    const fingers = new THREE.Group();
    fingers.name = 'display-fingers';
    fingers.scale.setScalar(scale);
    hand.add(fingers);
    const count = style === 'point' ? 1 : style === 'psychic' ? 2 : 4;
    for (let i = 0; i < count; i++) {
      const x = (i - (count - 1) / 2) * 0.043;
      const spread = style === 'claw' ? x * 0.7 : 0;
      characters.tube(
        fingers,
        mat,
        [
          [x, -0.04, 0.02],
          [x + spread, -0.17, 0.02],
          [x + spread, -0.22, style === 'claw' || style === 'cup' ? 0.08 : 0.02],
        ],
        0.019,
      );
    }
    if (style === 'triangle') {
      characters.tube(
        fingers,
        mat,
        [
          [side === 'R' ? -0.06 : 0.06, -0.015, 0.02],
          [side === 'R' ? -0.18 : 0.18, -0.015, 0.02],
        ],
        0.022,
      );
    }
  }
}

export function applyDisplayPose(body, id, characters) {
  const pose = DISPLAY_POSES[id],
    p = body.parts;
  if (!pose) throw new Error('Missing display pose: ' + id);
  characters.applyPose(
    p,
    {
      aR: [0, 0, 0],
      aL: [0, 0, 0],
      t: pose.t ?? [0, 0, 0],
      h: pose.h ?? [0, 0, 0],
      lL: pose.lL,
      lR: pose.lR,
      y: 0,
      w: pose.staff ? 1 : 0,
      kL: 0.04,
      kR: 0.04,
    },
    0,
    true,
  );
  poseArm(p, 'R', pose.right, pose.handR);
  poseArm(p, 'L', pose.left, pose.handL);
  if (pose.fingers) addFingers(p, pose.fingers, characters);
  if (p.staff) p.staff.rotation.z = 0.18;
  body.root.updateMatrixWorld(true);
  const feet = [p.footL, p.footR].map((foot) => {
    const bounds = new THREE.Box3().setFromObject(foot);
    // Reconstructed human feet keep an empty original mesh as their joint.
    return bounds.isEmpty()
      ? foot.getWorldPosition(new THREE.Vector3()).y - 0.07 * body.root.scale.y
      : bounds.min.y;
  });
  body.root.position.y += -Math.min(...feet) + (pose.float ?? 0);
  body.root.userData.displayPose = pose.name;
  body.root.updateMatrixWorld(true);
  return pose;
}
