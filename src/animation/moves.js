export function register({ animation: animationModule }) {
  return function initialize() {
    animationModule.ANIM = {};
    animationModule.ANIM.jab = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.28,
        animationModule.pz({
          aR: [-1.62, 0, -0.12],
          aL: [-1.12, 0, -0.5],
          t: [0.04, 0.34, 0],
          h: [0, 0.2, 0],
          lR: [-0.14, 0, 0],
        }),
      ],
      [
        0.5,
        animationModule.pz({
          aR: [-1.5, 0, -0.06],
          aL: [-1.02, 0, -0.46],
          t: [0.03, 0.26, 0],
          h: [0, 0.14, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.cross = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.3,
        animationModule.pz({
          aL: [-1.62, 0, 0.14],
          aR: [-1.05, 0, 0.6],
          t: [0.04, -0.42, 0],
          h: [0, -0.24, 0],
          lL: [-0.16, 0, 0],
        }),
      ],
      [
        0.52,
        animationModule.pz({
          aL: [-1.5, 0, 0.1],
          aR: [-0.98, 0, 0.54],
          t: [0.03, -0.32, 0],
          h: [0, -0.18, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.hook = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.24,
        animationModule.pz({
          aR: [-0.85, 0, 1.18],
          t: [0.1, -0.32, 0],
          lR: [-0.18, 0, 0],
        }),
      ],
      [
        0.48,
        animationModule.pz({
          aR: [-1.5, -0.45, -0.42],
          aL: [-1.15, 0, -0.65],
          t: [0.04, -0.65, 0],
          h: [0, -0.36, 0],
          lR: [-0.24, 0, 0],
        }),
      ],
      [
        0.7,
        animationModule.pz({
          aR: [-1.38, -0.25, -0.24],
          aL: [-1.05, 0, -0.55],
          t: [0.04, -0.5, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.uppercut = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.22,
        animationModule.pz({
          aR: [-0.32, 0, 0.72],
          t: [0.32, 0.3, 0],
          y: -0.1,
          lR: [-0.3, 0, 0],
          lL: [0.22, 0, 0],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-2.9, 0, 0.2],
          aL: [-1.3, 0, -0.55],
          t: [-0.42, 0.32, 0],
          h: [-0.28, 0, 0],
          ry: 0.24,
          lR: [-0.32, 0, 0],
        }),
      ],
      [
        0.62,
        animationModule.pz({
          aR: [-2.55, 0, 0.18],
          aL: [-1.2, 0, -0.5],
          t: [-0.32, 0.22, 0],
          ry: 0.12,
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.spinKick = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.2,
        animationModule.pz({
          t: [0, 0.6, 0],
          lR: [-0.5, 0, 0.35],
          aR: [-0.5, 0, 0.95],
          aL: [-0.6, 0, -0.85],
          y: 0.04,
        }),
      ],
      [
        0.46,
        animationModule.pz({
          t: [0.05, 1.3, 0],
          lR: [-1.95, 0, 0.55],
          lL: [0.28, 0, 0],
          aR: [-0.25, 0, 1.45],
          aL: [-0.45, 0, -1.25],
          h: [0, -0.55, 0],
          ry: 0.2,
        }),
      ],
      [
        0.68,
        animationModule.pz({
          t: [0, 0.98, 0],
          lR: [-1.5, 0, 0.45],
          lL: [0.2, 0, 0],
          aR: [-0.35, 0, 1.15],
          aL: [-0.55, 0, -0.95],
          ry: 0.1,
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.heavyPunch = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.26,
        animationModule.pz({
          aR: [-0.68, 0, 1.05],
          t: [0.22, -0.38, 0],
          y: -0.08,
          lR: [-0.22, 0, 0],
        }),
      ],
      [
        0.5,
        animationModule.pz({
          aR: [-1.72, 0, -0.16],
          aL: [-1.2, 0, -0.62],
          t: [0.06, -0.66, 0],
          h: [0, -0.38, 0],
          lR: [-0.3, 0, 0],
          y: 0.06,
        }),
      ],
      [
        0.7,
        animationModule.pz({
          aR: [-1.55, 0, -0.08],
          aL: [-1.1, 0, -0.52],
          t: [0.05, -0.46, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.heavyKick = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.22,
        animationModule.pz({
          lR: [-0.6, 0, 0.4],
          t: [0.22, 0.22, 0],
          y: -0.06,
          aR: [-0.4, 0, 1.0],
          aL: [-0.5, 0, -0.9],
        }),
      ],
      [
        0.48,
        animationModule.pz({
          lR: [-2.1, 0, 0.35],
          t: [-0.32, 0.16, 0],
          aR: [-0.2, 0, 1.35],
          aL: [-0.35, 0, -1.15],
          ry: 0.2,
          h: [-0.18, 0, 0],
        }),
      ],
      [
        0.7,
        animationModule.pz({
          lR: [-1.6, 0, 0.3],
          t: [-0.16, 0.1, 0],
          aR: [-0.3, 0, 1.1],
          aL: [-0.45, 0, -0.9],
          ry: 0.08,
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.staffSweep = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.2,
        animationModule.pz({
          aR: [-0.6, 0, 1.45],
          aL: [-0.85, 0, -0.6],
          t: [0.1, -0.55, 0],
          w: 1,
        }),
      ],
      [
        0.46,
        animationModule.pz({
          aR: [-1.38, 0, -0.95],
          aL: [-0.92, 0, -0.32],
          t: [0.05, -1.05, 0],
          h: [0, -0.55, 0],
          w: 1,
        }),
      ],
      [
        0.7,
        animationModule.pz({
          aR: [-1.2, 0, -0.6],
          aL: [-0.86, 0, -0.36],
          t: [0.05, -0.72, 0],
          w: 1,
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.staffSmash = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.22,
        animationModule.pz({
          aR: [-2.65, 0, 0.55],
          aL: [-2.45, 0, -0.42],
          t: [-0.38, 0.2, 0],
          ry: 0.18,
          w: 1,
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-0.42, 0, 0.16],
          aL: [-0.4, 0, -0.16],
          t: [0.5, 0.1, 0],
          ry: -0.22,
          lR: [-0.34, 0, 0],
          lL: [0.28, 0, 0],
          w: 1,
        }),
      ],
      [
        0.6,
        animationModule.pz({
          aR: [-0.32, 0, 0.14],
          aL: [-0.34, 0, -0.14],
          t: [0.38, 0.08, 0],
          ry: -0.12,
          w: 1,
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.palmStrike = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.26,
        animationModule.pz({
          aR: [-1.5, -0.32, 0.5],
          aL: [-1.1, 0, -0.5],
          t: [0.05, -0.4, 0],
          h: [0, -0.22, 0],
        }),
      ],
      [
        0.5,
        animationModule.pz({
          aR: [-1.4, -0.2, 0.42],
          aL: [-1.0, 0, -0.45],
          t: [0.04, -0.28, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.elbow = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.24,
        animationModule.pz({
          aR: [-1.9, 0, 1.55],
          t: [0.1, -0.42, 0],
          lR: [-0.2, 0, 0],
        }),
      ],
      [
        0.48,
        animationModule.pz({
          aR: [-2.0, -0.9, 0.2],
          aL: [-1.0, 0, -0.5],
          t: [0.05, -0.75, 0],
          h: [0, -0.32, 0],
        }),
      ],
      [
        0.7,
        animationModule.pz({
          aR: [-1.7, -0.6, 0.1],
          aL: [-0.95, 0, -0.45],
          t: [0.04, -0.52, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.sweep = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.22,
        animationModule.pz({
          t: [0.38, 0.2, 0],
          y: -0.32,
          lR: [-0.4, 0, 0.2],
          lL: [0.42, 0, 0],
          aR: [-0.3, 0, 0.85],
          aL: [-0.4, 0, -0.75],
        }),
      ],
      [
        0.48,
        animationModule.pz({
          t: [0.55, 1.05, 0],
          y: -0.58,
          lR: [-1.4, 0, 0.5],
          lL: [0.52, 0, 0],
          aR: [-0.15, 0, 1.15],
          aL: [-0.25, 0, -0.95],
        }),
      ],
      [
        0.72,
        animationModule.pz({
          t: [0.38, 0.72, 0],
          y: -0.36,
          lR: [-1.05, 0, 0.4],
          lL: [0.42, 0, 0],
          aR: [-0.25, 0, 0.95],
          aL: [-0.35, 0, -0.8],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.doublePalm = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.22,
        animationModule.pz({
          aR: [-0.8, 0, 0.95],
          aL: [-0.8, 0, -0.95],
          t: [0.22, 0, 0],
          y: -0.06,
        }),
      ],
      [
        0.48,
        animationModule.pz({
          aR: [-1.58, 0, 0.25],
          aL: [-1.58, 0, -0.25],
          t: [0.06, 0, 0],
          ry: 0.1,
          lR: [-0.25, 0, 0],
          lL: [0.2, 0, 0],
        }),
      ],
      [
        0.7,
        animationModule.pz({
          aR: [-1.42, 0, 0.22],
          aL: [-1.42, 0, -0.22],
          t: [0.05, 0, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.claw = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.24,
        animationModule.pz({
          aR: [-1.2, 0, 1.35],
          t: [0.15, 0.38, 0],
          lR: [-0.2, 0, 0],
        }),
      ],
      [
        0.48,
        animationModule.pz({
          aR: [-1.62, -0.5, -0.62],
          aL: [-1.1, 0, -0.6],
          t: [0.05, 0.75, 0],
          h: [0, 0.38, 0],
        }),
      ],
      [
        0.7,
        animationModule.pz({
          aR: [-1.45, -0.3, -0.36],
          aL: [-1.0, 0, -0.5],
          t: [0.04, 0.52, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.backClaw = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.24,
        animationModule.pz({
          aR: [-1.3, 0, 1.45],
          t: [0.1, 0.52, 0],
        }),
      ],
      [
        0.48,
        animationModule.pz({
          aR: [-1.5, 0.9, 0.95],
          aL: [-1.1, 0, -0.6],
          t: [0.05, -0.85, 0],
          h: [0, -0.45, 0],
        }),
      ],
      [
        0.7,
        animationModule.pz({
          aR: [-1.35, 0.6, 0.62],
          aL: [-1.0, 0, -0.5],
          t: [0.04, -0.58, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.knee = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.22,
        animationModule.pz({
          lR: [-1.6, 0, 0.2],
          t: [0.28, 0, 0],
          ry: 0.1,
          aR: [-0.9, 0, 0.72],
          aL: [-0.9, 0, -0.72],
        }),
      ],
      [
        0.46,
        animationModule.pz({
          lR: [-2.15, 0, 0.15],
          t: [0.1, 0, 0],
          ry: 0.28,
          aR: [-1.2, 0, 0.5],
          aL: [-1.2, 0, -0.5],
          h: [-0.18, 0, 0],
        }),
      ],
      [
        0.68,
        animationModule.pz({
          lR: [-1.6, 0, 0.15],
          t: [0.05, 0, 0],
          ry: 0.12,
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.rushPalm = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.2,
        animationModule.pz({
          aR: [-0.9, 0, 0.95],
          aL: [-0.6, 0, -0.85],
          t: [0.28, 0, 0],
          y: -0.1,
          lR: [-0.22, 0, 0],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-1.68, -0.28, 0.2],
          aL: [-1.2, 0, -0.5],
          t: [0.05, -0.45, 0],
          h: [0, -0.22, 0],
          ry: 0.07,
        }),
      ],
      [
        0.66,
        animationModule.pz({
          aR: [-1.5, -0.15, 0.15],
          aL: [-1.1, 0, -0.45],
          t: [0.04, -0.3, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.solarFlare = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.2,
        animationModule.pz({
          aR: [-2.45, 0, 0.95],
          aL: [-2.45, 0, -0.95],
          t: [-0.32, 0, 0],
          h: [-0.22, 0, 0],
          ry: 0.06,
        }),
      ],
      [
        0.46,
        animationModule.pz({
          aR: [-2.65, 0, 1.35],
          aL: [-2.65, 0, -1.35],
          t: [-0.38, 0, 0],
          h: [-0.28, 0, 0],
          ry: 0.14,
        }),
      ],
      [
        0.68,
        animationModule.pz({
          aR: [-2.3, 0, 1.0],
          aL: [-2.3, 0, -1.0],
          t: [-0.2, 0, 0],
          ry: 0.05,
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.magicFlash = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.2,
        animationModule.pz({
          aR: [-0.7, 0, 1.1],
          aL: [-0.7, 0, -1.1],
          t: [0.25, 0, 0],
          y: -0.08,
        }),
      ],
      [
        0.46,
        animationModule.pz({
          aR: [-1.5, 0, 0.4],
          aL: [-1.5, 0, -0.4],
          t: [0.05, 0, 0],
          ry: 0.12,
        }),
      ],
      [
        0.68,
        animationModule.pz({
          aR: [-1.35, 0, 0.35],
          aL: [-1.35, 0, -0.35],
          t: [0.04, 0, 0],
        }),
      ],
      [1.0, animationModule.IDLE_POSE],
    ];
    animationModule.ANIM.kamehameha = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.16,
        animationModule.pz({
          aR: [-0.32, 0.15, 0.85],
          aL: [-0.32, -0.15, -0.85],
          t: [0.22, 0.32, 0],
          y: -0.08,
          lR: [-0.16, 0, 0],
          lL: [0.14, 0, 0],
          h: [0.06, -0.18, 0],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-0.2, 0.22, 1.02],
          aL: [-0.2, -0.22, -1.02],
          t: [0.34, 0.46, 0],
          y: -0.14,
          lR: [-0.22, 0, 0],
          lL: [0.18, 0, 0],
          h: [0.12, -0.28, 0],
        }),
      ],
      [
        0.62,
        animationModule.pz({
          aR: [-1.58, 0.16, 0.08],
          aL: [-1.58, -0.16, -0.08],
          t: [0.02, -0.22, 0],
          y: 0.04,
          lR: [-0.26, 0, 0],
          lL: [0.22, 0, 0],
          h: [-0.12, 0, 0],
        }),
      ],
      [
        1.0,
        animationModule.pz({
          aR: [-1.5, 0.14, 0.08],
          aL: [-1.5, -0.14, -0.08],
          t: [0.02, -0.14, 0],
          lR: [-0.2, 0, 0],
          lL: [0.16, 0, 0],
        }),
      ],
    ];
    animationModule.ANIM.mafuba = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.16,
        animationModule.pz({
          aR: [-0.85, 0, 0.7],
          aL: [-0.85, 0, -0.7],
          t: [0.2, 0.28, 0],
          y: -0.06,
          h: [0.05, -0.14, 0],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-1.15, 0, 0.42],
          aL: [-1.15, 0, -0.42],
          t: [0.1, 0.12, 0],
          y: -0.02,
          h: [0.02, 0, 0],
        }),
      ],
      [
        0.62,
        animationModule.pz({
          aR: [-1.55, 0.06, 0.2],
          aL: [-1.55, -0.06, -0.2],
          t: [0.03, -0.1, 0],
          y: 0.03,
        }),
      ],
      [
        1.0,
        animationModule.pz({
          aR: [-1.5, 0.05, 0.18],
          aL: [-1.5, -0.05, -0.18],
          t: [0.03, -0.06, 0],
        }),
      ],
    ];
    animationModule.ANIM.dodonpa = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.16,
        animationModule.pz({
          aR: [-0.35, 0, 0.9],
          aL: [-0.9, 0, -0.5],
          t: [0.16, 0.34, 0],
          y: -0.06,
          h: [0.06, -0.24, 0],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-0.25, 0, 1.02],
          aL: [-0.85, 0, -0.46],
          t: [0.22, 0.42, 0],
          y: -0.1,
          h: [0.1, -0.3, 0],
        }),
      ],
      [
        0.62,
        animationModule.pz({
          aR: [-1.66, 0.08, 0.02],
          aL: [-1.0, 0, -0.44],
          t: [0.02, -0.26, 0],
          h: [-0.06, -0.1, 0],
        }),
      ],
      [
        1.0,
        animationModule.pz({
          aR: [-1.56, 0.06, 0.02],
          aL: [-0.95, 0, -0.4],
          t: [0.02, -0.18, 0],
        }),
      ],
    ];
    animationModule.ANIM.bakuriki = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.16,
        animationModule.pz({
          aR: [-0.5, 0, 1.25],
          aL: [-0.5, 0, -1.25],
          t: [0.28, 0, 0],
          y: -0.12,
          h: [0.1, 0, 0],
          lL: [0.2, 0, 0],
          lR: [-0.2, 0, 0],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-0.35, 0, 1.5],
          aL: [-0.35, 0, -1.5],
          t: [0.38, 0, 0],
          y: -0.18,
          h: [0.16, 0, 0],
          lL: [0.26, 0, 0],
          lR: [-0.26, 0, 0],
        }),
      ],
      [
        0.62,
        animationModule.pz({
          aR: [-1.55, 0.22, 0.28],
          aL: [-1.55, -0.22, -0.28],
          t: [0.03, 0, 0],
          y: 0.06,
          lL: [0.14, 0, 0],
          lR: [-0.14, 0, 0],
        }),
      ],
      [
        1.0,
        animationModule.pz({
          aR: [-1.45, 0.18, 0.26],
          aL: [-1.45, -0.18, -0.26],
          t: [0.02, 0, 0],
        }),
      ],
    ];
    animationModule.ANIM.kikoho = [
      [0.0, animationModule.IDLE_POSE],
      [
        0.16,
        animationModule.pz({
          aR: [-0.55, 0, 0.95],
          aL: [-0.55, 0, -0.95],
          t: [0.3, 0, 0],
          y: -0.12,
          h: [0.12, 0, 0],
          lL: [0.24, 0, 0],
          lR: [-0.24, 0, 0],
        }),
      ],
      [
        0.44,
        animationModule.pz({
          aR: [-0.4, 0, 1.28],
          aL: [-0.4, 0, -1.28],
          t: [0.4, 0, 0],
          y: -0.2,
          h: [0.18, 0, 0],
          lL: [0.3, 0, 0],
          lR: [-0.3, 0, 0],
        }),
      ],
      [
        0.62,
        animationModule.pz({
          aR: [-1.55, 0.28, 0.34],
          aL: [-1.55, -0.28, -0.34],
          t: [0.05, 0, 0],
          y: 0.06,
          lL: [0.12, 0, 0],
          lR: [-0.12, 0, 0],
        }),
      ],
      [
        1.0,
        animationModule.pz({
          aR: [-1.46, 0.24, 0.3],
          aL: [-1.46, -0.24, -0.3],
          t: [0.04, 0, 0],
        }),
      ],
    ];
  };
}
