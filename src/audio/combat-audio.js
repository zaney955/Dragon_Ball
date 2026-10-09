export function register({ audio: audioModule, combat: combatModule, match: matchModule }) {
  let combatNoise;
  audioModule.audioBus = function audioBus() {
    if (!audioModule.combatAudioMaster && audioModule.actx) {
      const limiter = audioModule.actx.createDynamicsCompressor();
      limiter.threshold.value = -15;
      limiter.knee.value = 10;
      limiter.ratio.value = 5;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.1;
      const master = audioModule.actx.createGain();
      master.gain.value = (audioModule.sfxVolume ?? 0.8) * 0.9;
      audioModule.sfxGain = master;
      limiter.connect(master);
      master.connect(audioModule.actx.destination);
      audioModule.combatAudioMaster = limiter;
    }
    return audioModule.combatAudioMaster ?? audioModule.actx.destination;
  };
  audioModule.eventSound = function eventSound(kind, a) {
    if (
      !audioModule.actx ||
      matchModule.game.muted ||
      audioModule.actx.state !== 'running' ||
      combatModule.combatEvents.audioVoices >= 12
    )
      return;
    const p = combatModule.FEEDBACK_PROFILES[kind];
    if (!p) return;
    const t = audioModule.actx.currentTime,
      duration = kind === 'swing' ? 0.085 : kind === 'heavy' || kind === 'ultimate' ? 0.14 : 0.085;
    const voice = (source, filter, volume, start, end) => {
      if (combatModule.combatEvents.audioVoices >= 12) return;
      const gain = audioModule.actx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      source.connect(filter ?? gain);
      if (filter) filter.connect(gain);
      gain.connect(audioModule.audioBus());
      combatModule.combatEvents.audioVoices++;
      combatModule.combatEvents.audioPeak = Math.max(
        combatModule.combatEvents.audioPeak,
        combatModule.combatEvents.audioVoices,
      );
      source.onended = () => {
        source.disconnect();
        filter?.disconnect();
        gain.disconnect();
        combatModule.combatEvents.audioVoices = Math.max(
          0,
          combatModule.combatEvents.audioVoices - 1,
        );
      };
      source.start(start);
      source.stop(end);
    };
    const osc = audioModule.actx.createOscillator();
    osc.type =
      kind === 'parry' || kind === 'pickup' ? 'sine' : kind === 'block' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(p.tone, t);
    osc.frequency.exponentialRampToValueAtTime(p.tail, t + duration);
    voice(osc, null, p.volume, t, t + duration);
    // One cached noise layer, independently filtered for cloth/wood/guard/impact.
    if (!combatNoise) {
      combatNoise = audioModule.actx.createBuffer(
        1,
        Math.ceil(audioModule.actx.sampleRate * 0.18),
        audioModule.actx.sampleRate,
      );
      let seed = 0x5193;
      const data = combatNoise.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        data[i] = ((seed / 4294967296) * 2 - 1) * (1 - i / data.length);
      }
    }
    const noise = audioModule.actx.createBufferSource(),
      filter = audioModule.actx.createBiquadFilter();
    noise.buffer = combatNoise;
    filter.type = 'bandpass';
    filter.frequency.value =
      kind === 'swing'
        ? /staff/i.test(a?.motion ?? '')
          ? 1100
          : 1900
        : kind === 'block'
          ? 3200
          : kind === 'heavy'
            ? 420
            : 1400;
    filter.Q.value = 0.6;
    voice(noise, filter, p.volume * 0.55, t, t + duration);
    if (['heavy', 'guardbreak', 'ultimate', 'throw'].includes(kind)) {
      const body = audioModule.actx.createOscillator();
      body.type = 'sine';
      const freq =
        matchModule.game.selectedMap === 2 ? 90 : matchModule.game.selectedMap === 1 ? 68 : 115;
      body.frequency.setValueAtTime(freq, t + 0.018);
      body.frequency.exponentialRampToValueAtTime(32, t + 0.12);
      voice(body, null, 0.012, t + 0.018, t + 0.13);
    }
  };
  audioModule.combatFeedback = function combatFeedback(type, pos, power) {
    audioModule.eventSound(type === 'hit' ? 'light' : type);
  };
  return function initialize() {
    audioModule.combatAudioMaster = null;
    combatNoise = null;
  };
}
