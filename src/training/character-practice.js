import { CHARACTER_HELP } from '../ui/character-help.js';
export function register({
  characters: charactersModule,
  combat: combatModule,
  match: matchModule,
  training: trainingModule,
  ui: uiModule,
}) {
  let v2TableBase, v2DrillBase;
  return function initialize() {
    v2TableBase = trainingModule.refreshMoveTable;
    trainingModule.refreshMoveTable = function () {
      v2TableBase();
      const c =
          uiModule.guideCharacter ??
          matchModule.player?.def ??
          charactersModule.CHARACTERS[matchModule.game.selectedChar],
        body = trainingModule.table.querySelector('tbody');
      const list = c.youth
        ? []
        : charactersModule
            .characterMoveData(c)
            .filter(
              (a) => ['launcher', 'sweep', 'throw'].includes(a.id) || (a.id === 'ult' && !c.ult),
            );
      for (const a of list) {
        const row = document.createElement('tr');
        row.title =
          trainingModule.preciseFrames(a) +
          '；射程 ' +
          a.range +
          'm；硬直 ' +
          (a.stun ?? 0) +
          's；取消 ' +
          JSON.stringify(a.cancelRules);
        row.innerHTML =
          '<td>' +
          a.name +
          '</td><td>' +
          [a.startup, a.active, a.recovery].map((x) => Number((x * 60).toFixed(2))).join(' / ') +
          '</td><td>' +
          (a.damageLabel ?? a.dmg) +
          '</td><td>' +
          ({
            low: '下',
            overhead: '上',
          }[a.level] ?? '中') +
          '</td><td>' +
          Math.round(((a.stun ?? 0) - a.active - a.recovery) * 60) +
          ' / ' +
          Math.round((a.blockstun - a.active - a.recovery) * 60) +
          '</td>';
        body.insertBefore(row, body.lastElementChild);
      }
    };
    v2DrillBase = trainingModule.drillInput;
    trainingModule.drillInput = function (ai, foe) {
      if (
        !uiModule.v2Goal ||
        uiModule.v2Goal.success ||
        ai !== matchModule.enemy ||
        matchModule.game.difficulty !== 'training'
      )
        return v2DrillBase(ai, foe);
      const goal = uiModule.v2Goal,
        condition = CHARACTER_HELP[goal.character].drill[goal.step][1];
      if (['counter', 'dodgeCounter'].includes(condition)) goal.time += matchModule.STEP;
      if (['counter', 'dodgeCounter'].includes(condition) && goal.time >= 1.5 && !ai.attack) {
        goal.time = 0;
        return { actions: [{ type: 'light' }] };
      }
      return {};
    };
    queueMicrotask(() => {
      if (window.__db)
        Object.assign(window.__db, {
          characterMoveData: charactersModule.characterMoveData,
          refreshMoveTable: trainingModule.refreshMoveTable,
          drillInput: trainingModule.drillInput,
        });
    });
  };
}
