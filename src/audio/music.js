import manifest from '../assets/music/manifest.js';
const BGM_OUTPUT_GAIN = 0.4;
export const MUSIC_URLS = {
  global: './01.魔訶不思議アドベンチャー__爱给网_aigei_com.mp3',
  menu: new URL('../assets/music/menu.mp3', import.meta.url).href,
  arena: new URL('../assets/music/arena.mp3', import.meta.url).href,
  wild: new URL('../assets/music/wild.mp3', import.meta.url).href,
  island: new URL('../assets/music/island.mp3', import.meta.url).href,
  crisis: new URL('../assets/music/crisis.mp3', import.meta.url).href,
  win: new URL('../assets/music/win.mp3', import.meta.url).href,
  lose: new URL('../assets/music/lose.mp3', import.meta.url).href,
  draw: new URL('../assets/music/draw.mp3', import.meta.url).href,
};
export function register({ audio, match }) {
  const buffers = new Map();
  const voices = new Set();
  let generation = 0,
    current = null,
    desired = null,
    musicEnabled = true;
  audio.bgmVolume = 0.35;
  audio.sfxVolume = 0.8;
  audio.bgmState = { track: null, looping: 0, loading: false, error: null };
  audio.stopBGM = function () {
    generation++;
    if (current) {
      try {
        current.source.stop();
      } catch {}
      current.gain.disconnect();
      current = null;
    }
    for (const voice of voices) {
      try {
        voice.source.stop();
      } catch {}
      voice.gain.disconnect();
    }
    voices.clear();
    desired = null;
    audio.bgmState.track = null;
    audio.bgmState.looping = 0;
  };
  async function buffer(id) {
    if (!buffers.has(id)) {
      const response = await fetch(MUSIC_URLS[id]);
      if (!response.ok) throw new Error('配乐加载失败：' + id);
      const decoded = await audio.actx.decodeAudioData(await response.arrayBuffer());
      if (id === 'global') buffers.set(id, decoded);
      else {
        const meta = manifest.find((t) => t.id === id),
          n = Math.min(decoded.length, Math.round(meta.duration * decoded.sampleRate)),
          copy = audio.actx.createBuffer(decoded.numberOfChannels, n, decoded.sampleRate);
        for (let c = 0; c < copy.numberOfChannels; c++)
          copy.copyToChannel(decoded.getChannelData(c).subarray(0, n), c);
        buffers.set(id, copy);
      }
    }
    return buffers.get(id);
  }
  audio.playBGM = async function (id, fade = 0.8) {
    if (!audio.actx || match.game.manualTest) return;
    desired = id;
    const token = ++generation;
    audio.bgmState.loading = true;
    try {
      const pcm = await buffer(id);
      if (token !== generation) return;
      const t = audio.actx.currentTime;
      if (current) {
        const old = current;
        old.source.loop = false;
        old.gain.gain.cancelScheduledValues(t);
        old.gain.gain.setValueAtTime(old.gain.gain.value, t);
        old.gain.gain.linearRampToValueAtTime(0, t + fade);
        old.source.stop(t + fade);
        old.source.onended = () => {
          old.source.disconnect();
          old.gain.disconnect();
          voices.delete(old);
        };
      }
      const source = audio.actx.createBufferSource(),
        gain = audio.actx.createGain(),
        meta =
          id === 'global'
            ? { loop: true, duration: pcm.duration }
            : manifest.find((m) => m.id === id);
      source.buffer = pcm;
      source.loop = meta.loop;
      source.loopStart = 0;
      source.loopEnd = meta.duration;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(
        audio.bgmVolume * BGM_OUTPUT_GAIN * (match.game.muted || !musicEnabled ? 0 : 1),
        t + fade,
      );
      source.connect(gain);
      gain.connect(audio.actx.destination);
      source.start();
      current = { source, gain, id };
      voices.add(current);
      audio.bgmState.track = id;
      audio.bgmState.looping = meta.loop ? 1 : 0;
      audio.bgmState.error = null;
      source.onended = () => {
        source.disconnect();
        gain.disconnect();
        for (const v of voices) if (v.source === source) voices.delete(v);
        if (current?.source === source) {
          current = null;
          audio.bgmState.looping = 0;
        }
      };
    } catch (e) {
      if (token === generation) {
        desired = null;
        audio.bgmState.error = e.message;
        console.error(e);
      }
    } finally {
      if (token === generation) audio.bgmState.loading = false;
    }
  };
  audio.musicDiagnostics = () => ({
    ...audio.bgmState,
    context: audio.actx?.state,
    decoded: [...buffers.keys()],
    voices: voices.size,
    looping: [...voices].filter((v) => v.source.loop).length,
    musicEnabled,
    bgm: audio.bgmVolume,
    sfx: audio.sfxVolume,
  });
  audio.resetBGM = function () {
    audio.updateBGM();
  };
  audio.finishBGM = function () {
    audio.updateBGM();
  };
  audio.updateBGM = function () {
    if (!audio.actx || match.game.manualTest) return;
    if (match.game.paused || document.hidden || match.game.muted) {
      if (audio.actx.state === 'running') audio.actx.suspend();
      return;
    }
    if (audio.actx.state === 'suspended') audio.actx.resume();
    if (musicEnabled && desired !== 'global') audio.playBGM('global');
    if (current) {
      const duck =
        match.victory?.finished && match.victory.time >= 2
          ? 0.35
          : [match.player, match.enemy].some((f) => f?.attack?.isUlt)
            ? 0.5
            : 1;
      current.gain.gain.cancelScheduledValues(audio.actx.currentTime);
      current.gain.gain.setTargetAtTime(
        audio.bgmVolume * BGM_OUTPUT_GAIN * duck * (musicEnabled ? 1 : 0),
        audio.actx.currentTime,
        0.12,
      );
    }
    if (audio.sfxGain)
      audio.sfxGain.gain.setTargetAtTime(audio.sfxVolume * 0.9, audio.actx.currentTime, 0.03);
  };
  return function initialize() {
    try {
      const saved = JSON.parse(localStorage.getItem('dragon-ball-audio') ?? 'null');
      if (saved) {
        audio.bgmVolume = Math.max(0, Math.min(1, saved.bgm ?? 0.35));
        audio.sfxVolume = Math.max(0, Math.min(1, saved.sfx ?? 0.8));
        musicEnabled = saved.musicEnabled !== false;
      }
    } catch {}
    const saveSettings = () => {
      try {
        localStorage.setItem(
          'dragon-ball-audio',
          JSON.stringify({ bgm: audio.bgmVolume, sfx: audio.sfxVolume, musicEnabled }),
        );
      } catch {}
    };
    const musicBtn = document.getElementById('musicBtn');
    const updateMusicButton = () => {
      musicBtn.textContent = musicEnabled ? '音乐：开' : '音乐：关';
      musicBtn.setAttribute('aria-pressed', String(musicEnabled));
      musicBtn.title = musicEnabled ? '关闭背景音乐' : '开启背景音乐';
    };
    updateMusicButton();
    musicBtn.onclick = () => {
      musicEnabled = !musicEnabled;
      updateMusicButton();
      saveSettings();
      for (const voice of voices) {
        voice.gain.gain.cancelScheduledValues(audio.actx.currentTime);
        voice.gain.gain.setTargetAtTime(
          musicEnabled ? audio.bgmVolume * BGM_OUTPUT_GAIN : 0,
          audio.actx.currentTime,
          0.03,
        );
      }
      audio.initAudio();
    };
    const settings = document.createElement('div');
    settings.className = 'audioSettings';
    settings.innerHTML = `<label>音乐 <input id="bgmVolume" aria-label="音乐音量" type="range" min="0" max="100" value="${audio.bgmVolume * 100}"></label><label>音效 <input id="sfxVolume" aria-label="音效音量" type="range" min="0" max="100" value="${audio.sfxVolume * 100}"></label>`;
    document.getElementById('pause').querySelector('div').appendChild(settings);
    for (const [id, key] of [
      ['bgmVolume', 'bgmVolume'],
      ['sfxVolume', 'sfxVolume'],
    ])
      document.getElementById(id).oninput = (e) => {
        audio[key] = Number(e.target.value) / 100;
        saveSettings();
        audio.updateBGM();
      };
    const init = audio.initAudio;
    audio.initAudio = function () {
      init();
      audio.updateBGM();
    };
    addEventListener('pointerdown', () => audio.initAudio(), { once: true });
    addEventListener('keydown', () => audio.initAudio(), { once: true });
    let hiddenPause = false;
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          hiddenPause = match.game.paused;
          audio.actx?.suspend();
        } else {
          if (!hiddenPause && (match.game.screen === 'fight' || match.victory))
            match.setPaused(false);
          audio.updateBGM();
        }
      },
      { capture: true },
    );
  };
}
