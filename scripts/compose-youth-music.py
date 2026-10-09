"""Deterministic original 4/4 arrangements. Requires numpy and ffmpeg, never network.
WAV masters are real synthesized PCM originals, not transcoded MP3s.
"""
import json, math, subprocess, wave
from pathlib import Path
import numpy as np
RATE=44100
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'src/assets/music'
MASTERS=ROOT/'performance/music-masters'
OUT.mkdir(parents=True,exist_ok=True);MASTERS.mkdir(parents=True,exist_ok=True)
TRACKS=[('menu','少年出发',112,32,'brass'),('arena','武道会开幕',128,32,'brass'),('wild','包子山冒险',104,32,'wood'),('island','龟仙屋午后',96,32,'guitar'),('crisis','最后一搏',128,16,'brass'),('win','武道会胜利',120,0,'brass'),('lose','下次再来',100,0,'wood'),('draw','不分胜负',100,0,'wood')]
# Each lead is independently authored, with an answering phrase and bridge.
MELODIES=[[0,4,7,9,7,4,2,0],[7,7,9,7,4,2,4,7],[0,2,4,7,9,7,4,2],[4,7,9,7,2,4,0,2],[0,0,3,7,10,7,5,3],[0,4,7,12],[7,4,2,0],[0,4,7,9]]
manifest=[]
for ti,(key,title,bpm,bars,timbre) in enumerate(TRACKS):
 beat=60/bpm;duration=bars*4*beat if bars else (4.5 if key=='win' else 3)
 n=round(duration*RATE);mix=np.zeros((n,2),np.float64);rng=np.random.default_rng(8020+ti)
 def add(start,dur,midi,kind,vol,pan=0):
  length=max(1,round(dur*RATE));t=np.arange(length)/RATE;f=440*2**((midi-69)/12)
  if kind=='brass':
   sig=sum(np.sin(2*np.pi*f*k*t+.008*np.sin(2*np.pi*5*t))*np.exp(-k*.30)/k for k in range(1,9));env=(1-np.exp(-t*65))*np.minimum(1,np.maximum(0,(dur-t)/.07))*(.65+.35*np.exp(-t*2))
  elif kind=='bass':
   sig=np.sin(2*np.pi*f*t)+.3*np.sin(4*np.pi*f*t);env=(1-np.exp(-t*150))*np.exp(-t*6)*np.minimum(1,np.maximum(0,(dur-t)/.03))
  elif kind=='guitar' or kind=='mallet':
   sig=np.sin(2*np.pi*f*t)+.25*np.sin(2*np.pi*f*2*t)+.12*np.sin(2*np.pi*f*3*t);env=(1-np.exp(-t*350))*np.exp(-t*(7 if kind=='mallet' else 4))*np.minimum(1,np.maximum(0,(dur-t)/.03))
  else:
   sig=np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*f*3*t);env=(1-np.exp(-t*90))*np.exp(-t*2)*np.minimum(1,np.maximum(0,(dur-t)/.06))
  signal=sig*env*vol;i=round(start*RATE)
  for c,gain in enumerate([math.sqrt((1-pan)/2),math.sqrt((1+pan)/2)]):
   # Modular write preserves ringing across the loop without a discontinuity.
   indexes=(np.arange(length)+i)%n if bars else np.arange(length)+i
   valid=indexes<n;np.add.at(mix[:,c],indexes[valid],signal[valid]*gain)
 def drum(start,kind,vol):
  dur=.22 if kind=='kick' else .15 if kind=='snare' else .07;length=round(dur*RATE);t=np.arange(length)/RATE
  sig=(np.sin(2*np.pi*(55*t+1.7*(1-np.exp(-t*35))))*np.exp(-t*25) if kind=='kick' else rng.normal(size=length)*np.exp(-t*(35 if kind=='snare' else 80)))
  if kind=='snare':sig=.7*sig+.25*np.sin(2*np.pi*175*t)*np.exp(-t*30)
  i=round(start*RATE);idx=(np.arange(length)+i)%n if bars else np.arange(length)+i;valid=idx<n
  for c in range(2):np.add.at(mix[:,c],idx[valid],sig[valid]*vol*.7)
 if bars:
  for bar in range(bars):
   section=bar//(bars//4);root=48+([0,5,7,0] if key!='crisis' else [0,8,5,7])[bar%4];minor=key=='crisis';third=3 if minor else 4
   for b in range(4):
    at=(bar*4+b)*beat;add(at,beat*.85,root+(0 if b%2==0 else 7)-12,'bass',.11)
    drum(at,'kick',.16 if b%2==0 else .04);drum(at+beat*.5,'hat',.028)
    if b%2:drum(at,'snare',.085)
   for step in range(8):
    at=(bar*4+step*.5)*beat
    offset=MELODIES[ti][(step+bar//2)%8]
    if section==1:offset=MELODIES[ti][7-(step+bar)%8]-2
    elif section==2:offset=[7,9,12,9,5,4,2,7][(step+bar)%8]
    elif section==3 and bar%4==3:offset=[7,4,2,0,2,4,7,0][step]
    if key=='crisis' and offset==4:offset=3
    if step in ([0,2,3,5,6] if timbre=='brass' else [0,1,2,4,6,7]):add(at,beat*(.7 if step%2 else .95),72+offset,timbre,.075,-.2)
    if step%2: add(at,beat*.45,60+[0,third,7,12][step//2%4]+(root-48),'guitar',.033,.4)
   for offset in [0,third,7]:add((bar*4+1.5)*beat,beat*1.4,60+offset+(root-48),'wood',.018,.25)
   if bar%4==3:
    for offset in range(3):drum((bar*4+3+offset/3)*beat,'snare',.045)
 else:
  lead=MELODIES[ti]
  for i,note in enumerate(lead):add(i*duration*.17,duration*(.18 if i<3 else .42),72+note,timbre,.13,-.1)
  chord=[0,4,7] if key!='draw' else [0,4,9]
  for note in chord:add(duration*.53,duration*.45,60+note,'wood',.055,.2)
  drum(0,'kick',.1)
 # Gentle saturation and wide but quiet room reflections, wrapping only for loops.
 for delay,decay in [(round(.073*RATE),.12),(round(.131*RATE),.07)]:
  reflected=np.roll(mix[:,::-1],delay,axis=0)
  if not bars:reflected[:delay]=0
  mix+=reflected*decay
 mix=np.tanh(mix*1.5);peak=np.max(np.abs(mix));mix*=.78/max(peak,.001)
 if not bars:
  fade=min(n,round(.08*RATE));mix[-fade:]*=np.linspace(1,0,fade)[:,None]
 pcm=(mix*32767).astype('<i2');wav=MASTERS/(key+'.wav')
 with wave.open(str(wav),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(RATE);w.writeframes(pcm.tobytes())
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),'-codec:a','libmp3lame','-b:a','128k',str(OUT/(key+'.mp3'))],check=True)
 manifest.append(dict(id=key,title=title,bpm=bpm,bars=bars,duration=duration,loop=bool(bars),composer='Original deterministic arrangement, seed '+str(8020+ti),master='performance/music-masters/'+key+'.wav'))
 print(title,round(duration,3),'seconds')
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')

(OUT/'manifest.js').write_text('export default '+json.dumps(manifest,ensure_ascii=False,indent=2)+';\n')
