import { register as registerOnlineSession } from '../online/session.js';
import { register as registerOnlineLobby } from '../online/lobby-ui.js';
import { register as registerRenderScene } from '../render/scene.js';
import { register as registerAudioSound } from '../audio/sound.js';
import { register as registerAnimationPoses } from '../animation/poses.js';
import { register as registerAnimationMoves } from '../animation/moves.js';
import { register as registerCharactersAttackData } from '../characters/attack-data.js';
import { register as registerCharactersModelPrimitives } from '../characters/model-primitives.js';
import { register as registerCharactersSkeleton } from '../characters/skeleton.js';
import { register as registerCharactersOriginalModels } from '../characters/original-models.js';
import { register as registerCharactersRoster } from '../characters/roster.js';
import { register as registerCombatFighter } from '../combat/fighter.js';
import { register as registerRenderEffects } from '../render/effects.js';
import { register as registerWorldStages } from '../world/stages.js';
import { register as registerInputKeyboard } from '../input/keyboard.js';
import { register as registerRenderMenuCamera } from '../render/menu-camera.js';
import { register as registerMatchState } from '../match/state.js';
import { register as registerCombatSimulation } from '../combat/simulation.js';
import { register as registerUiHud } from '../ui/hud.js';
import { register as registerMatchLifecycle } from '../match/lifecycle.js';
import { register as registerAppBoot } from '../app/boot.js';
import { register as registerMatchSession } from '../match/session.js';
import { register as registerUiSelectionMenu } from '../ui/selection-menu.js';
import { register as registerMatchRounds } from '../match/rounds.js';
import { register as registerInputControls } from '../input/controls.js';
import { register as registerCombatMoveRules } from '../combat/move-rules.js';
import { register as registerInputPlayerOne } from '../input/player-one.js';
import { register as registerAiTacticalAi } from '../ai/tactical-ai.js';
import { register as registerRenderFightCamera } from '../render/fight-camera.js';
import { register as registerCombatFixedStep } from '../combat/fixed-step.js';
import { register as registerUiCombatHud } from '../ui/combat-hud.js';
import { register as registerWorldEnvironment } from '../world/environment.js';
import { register as registerRenderUltimateEffects } from '../render/ultimate-effects.js';
import { register as registerInputPlayerTwo } from '../input/player-two.js';
import { register as registerCombatFlight } from '../combat/flight.js';
import { register as registerWorldDestruction } from '../world/destruction.js';
import { register as registerCombatKiDisc } from '../combat/ki-disc.js';
import { register as registerWorldSenzu } from '../world/senzu.js';
import { register as registerUiNavigation } from '../ui/navigation.js';
import { register as registerCombatCollision } from '../combat/collision.js';
import { register as registerTrainingArenaTools } from '../training/arena-tools.js';
import { register as registerCombatKi } from '../combat/ki.js';
import { register as registerCombatEvents } from '../combat/events.js';
import { register as registerAudioCombatAudio } from '../audio/combat-audio.js';
import { register as registerAnimationCombatPolish } from '../animation/combat-polish.js';
import { register as registerAiMemory } from '../ai/memory.js';
import { register as registerTrainingDrills } from '../training/drills.js';
import { register as registerAnimationContactPoses } from '../animation/contact-poses.js';
import { register as registerArtOriginalRefinement } from '../art/original-refinement.js';
import { register as registerUiArtGallery } from '../ui/art-gallery.js';
import { register as registerUiMoveGuide } from '../ui/move-guide.js';
import { register as registerCombatAbilitiesState } from '../combat/abilities-state.js';
import { register as registerCharactersV2Models } from '../characters/v2-models.js';
import { register as registerCharactersV2Roster } from '../characters/v2-roster.js';
import { register as registerCombatV2Fighter } from '../combat/v2-fighter.js';
import { register as registerCombatAbilities } from '../combat/abilities.js';
import { register as registerCombatV2Integration } from '../combat/v2-integration.js';
import { register as registerAiV2Tactics } from '../ai/v2-tactics.js';
import { register as registerCharactersV2OriginalRoutes } from '../characters/v2-original-routes.js';
import { register as registerCombatV2OriginalRules } from '../combat/v2-original-rules.js';
import { register as registerUiV2Presentation } from '../ui/v2-presentation.js';
import { register as registerAnimationV2OriginalPolish } from '../animation/v2-original-polish.js';
import { register as registerArtCharacterReconstruction } from '../art/character-reconstruction.js';
import { register as registerArtStageReconstruction } from '../art/stage-reconstruction.js';
import { register as registerArtResources } from '../art/resources.js';
import { register as registerCharactersFrameData } from '../characters/frame-data.js';
import { register as registerTrainingCharacterPractice } from '../training/character-practice.js';
export const modulePlan = [
  {
    id: 'render/scene',
    register: registerRenderScene,
  },
  {
    id: 'audio/sound',
    register: registerAudioSound,
  },
  {
    id: 'animation/poses',
    register: registerAnimationPoses,
  },
  {
    id: 'animation/moves',
    register: registerAnimationMoves,
  },
  {
    id: 'characters/attack-data',
    register: registerCharactersAttackData,
  },
  {
    id: 'characters/model-primitives',
    register: registerCharactersModelPrimitives,
  },
  {
    id: 'characters/skeleton',
    register: registerCharactersSkeleton,
  },
  {
    id: 'characters/original-models',
    register: registerCharactersOriginalModels,
  },
  {
    id: 'characters/roster',
    register: registerCharactersRoster,
  },
  {
    id: 'combat/fighter',
    register: registerCombatFighter,
  },
  {
    id: 'render/effects',
    register: registerRenderEffects,
  },
  {
    id: 'world/stages',
    register: registerWorldStages,
  },
  {
    id: 'input/keyboard',
    register: registerInputKeyboard,
  },
  {
    id: 'render/menu-camera',
    register: registerRenderMenuCamera,
  },
  {
    id: 'match/state',
    register: registerMatchState,
  },
  {
    id: 'combat/simulation',
    register: registerCombatSimulation,
  },
  {
    id: 'ui/hud',
    register: registerUiHud,
  },
  {
    id: 'match/lifecycle',
    register: registerMatchLifecycle,
  },
  {
    id: 'app/boot',
    register: registerAppBoot,
  },
  {
    id: 'match/session',
    register: registerMatchSession,
  },
  {
    id: 'ui/selection-menu',
    register: registerUiSelectionMenu,
  },
  {
    id: 'match/rounds',
    register: registerMatchRounds,
  },
  {
    id: 'input/controls',
    register: registerInputControls,
  },
  {
    id: 'combat/move-rules',
    register: registerCombatMoveRules,
  },
  {
    id: 'input/player-one',
    register: registerInputPlayerOne,
  },
  {
    id: 'ai/tactical-ai',
    register: registerAiTacticalAi,
  },
  {
    id: 'render/fight-camera',
    register: registerRenderFightCamera,
  },
  {
    id: 'combat/fixed-step',
    register: registerCombatFixedStep,
  },
  {
    id: 'ui/combat-hud',
    register: registerUiCombatHud,
  },
  {
    id: 'world/environment',
    register: registerWorldEnvironment,
  },
  {
    id: 'render/ultimate-effects',
    register: registerRenderUltimateEffects,
  },
  {
    id: 'input/player-two',
    register: registerInputPlayerTwo,
  },
  {
    id: 'combat/flight',
    register: registerCombatFlight,
  },
  {
    id: 'world/destruction',
    register: registerWorldDestruction,
  },
  {
    id: 'combat/ki-disc',
    register: registerCombatKiDisc,
  },
  {
    id: 'world/senzu',
    register: registerWorldSenzu,
  },
  {
    id: 'ui/navigation',
    register: registerUiNavigation,
  },
  {
    id: 'combat/collision',
    register: registerCombatCollision,
  },
  {
    id: 'training/arena-tools',
    register: registerTrainingArenaTools,
  },
  {
    id: 'testing/base-regression',
    test: true,
  },
  {
    id: 'testing/debug-interface',
    test: true,
  },
  {
    id: 'combat/ki',
    register: registerCombatKi,
  },
  {
    id: 'combat/events',
    register: registerCombatEvents,
  },
  {
    id: 'audio/combat-audio',
    register: registerAudioCombatAudio,
  },
  {
    id: 'animation/combat-polish',
    register: registerAnimationCombatPolish,
  },
  {
    id: 'ai/memory',
    register: registerAiMemory,
  },
  {
    id: 'training/drills',
    register: registerTrainingDrills,
  },
  {
    id: 'animation/contact-poses',
    register: registerAnimationContactPoses,
  },
  {
    id: 'testing/v1-regression',
    test: true,
  },
  {
    id: 'art/original-refinement',
    register: registerArtOriginalRefinement,
  },
  {
    id: 'ui/art-gallery',
    register: registerUiArtGallery,
  },
  {
    id: 'ui/move-guide',
    register: registerUiMoveGuide,
  },
  {
    id: 'combat/abilities-state',
    register: registerCombatAbilitiesState,
  },
  {
    id: 'characters/v2-models',
    register: registerCharactersV2Models,
  },
  {
    id: 'characters/v2-roster',
    register: registerCharactersV2Roster,
  },
  {
    id: 'combat/v2-fighter',
    register: registerCombatV2Fighter,
  },
  {
    id: 'combat/abilities',
    register: registerCombatAbilities,
  },
  {
    id: 'combat/v2-integration',
    register: registerCombatV2Integration,
  },
  {
    id: 'ai/v2-tactics',
    register: registerAiV2Tactics,
  },
  {
    id: 'characters/v2-original-routes',
    register: registerCharactersV2OriginalRoutes,
  },
  {
    id: 'combat/v2-original-rules',
    register: registerCombatV2OriginalRules,
  },
  {
    id: 'ui/v2-presentation',
    register: registerUiV2Presentation,
  },
  {
    id: 'animation/v2-original-polish',
    register: registerAnimationV2OriginalPolish,
  },
  {
    id: 'art/character-reconstruction',
    register: registerArtCharacterReconstruction,
  },
  {
    id: 'art/stage-reconstruction',
    register: registerArtStageReconstruction,
  },
  {
    id: 'art/resources',
    register: registerArtResources,
  },
  {
    id: 'characters/frame-data',
    register: registerCharactersFrameData,
  },
  {
    id: 'training/character-practice',
    register: registerTrainingCharacterPractice,
  },
  {
    id: 'testing/v2-regression',
    test: true,
  },
  { id: 'online/session', register: registerOnlineSession },
  { id: 'online/lobby-ui', register: registerOnlineLobby },
];
