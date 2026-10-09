export function register({ audio: audioModule, match: matchModule }) {
  audioModule.initAudio = function initAudio() {
    if (!audioModule.actx) {
      try {
        audioModule.actx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {}
    }
    if (!matchModule.game.muted && audioModule.actx && audioModule.actx.state === 'suspended')
      audioModule.actx.resume();
  };
  audioModule.sfxSwing = function sfxSwing() {
    audioModule.eventSound('swing');
  };
  return function initialize() {
    audioModule.actx = null;
  };
}
