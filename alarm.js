/*
 * alarm.js — 《宋鳥的一天》開場機械鬧鐘聲
 * 純 WebAudio 即時合成，不需要音檔。兩顆小鈴交替敲打，約 2.5 秒。
 *
 * 用法：在「點一下開始」的點擊事件裡呼叫 alarm()（iOS 規定要在點擊中播放）。
 * 如果遊戲裡已經有同名的 alarm() 函式，請整個換成這個。
 */
function alarm(){
 try{
  const a=new(window.AudioContext||window.webkitAudioContext)();
  const out=a.createGain();out.gain.value=.7;out.connect(a.destination);
  const nl=a.sampleRate,nb=a.createBuffer(1,nl,a.sampleRate),d=nb.getChannelData(0);
  for(let i=0;i<nl;i++)d[i]=Math.random()*2-1;
  const tone=(f,t,dur,v)=>{
   const o=a.createOscillator(),g=a.createGain();
   o.type='sine';o.frequency.value=f;o.connect(g);g.connect(out);
   g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+.004);
   g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.start(t);o.stop(t+dur+.05);
  };
  const hit=(t,v)=>{
   const s=a.createBufferSource();s.buffer=nb;
   const f=a.createBiquadFilter();f.type='bandpass';f.frequency.value=3500;f.Q.value=1.5;
   const g=a.createGain();g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+.03);
   s.connect(f);f.connect(g);g.connect(out);s.start(t);s.stop(t+.05);
  };
  const t0=a.currentTime+.05;
  for(let i=0;i<34;i++){
   const x=t0+i*.075,k=i%2;
   hit(x,.5);tone(k?2490:2210,x,.16,.1);tone(k?3720:3300,x,.1,.04);
  }
 }catch(e){}
}
