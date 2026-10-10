import { createWildStage, createKameStage } from '../world/adventure-stages.js';

export function register({ art, characters, match, render, world }) {
  return function initialize() {
    const build = (builder) => () => {
      world.daylight();
      return builder({ characters, world, render, lightPreset: match.game.lightPreset });
    };
    art.artStageBuilders = {
      budokai: world.buildBudokaiStage,
      wild: build(createWildStage),
      kame: build(createKameStage),
      kami: world.buildKamiStage,
    };
    for (const m of world.MAPS) {
      m.build = () => {
        const map = art.artStageBuilders[m.id]();
        map.group.name = 'reconstructed-stage-' + m.id;
        map.group.userData.artVersion = art.DB_ART_VERSION;
        return map;
      };
    }
  };
}
