/*
 * music.js — 《宋鳥的一天》主旋律（線索推理 A 版）
 * 純 WebAudio 即時合成，不需要任何音樂檔，可離線播放。
 * 風格：好奇的撥弦 + 低音 + 輕鼓點，後半段加入鈴聲旋律與柔和底色。BPM 98，約 20 秒循環。
 *
 * 用法（全域物件 Music）：
 *   Music.start();    // 必須在使用者「點擊」事件裡呼叫（iOS 規定），只建立音訊，不出聲
 *   Music.begin();    // 開始播放，3 秒淡入。遊戲裡是在宋鳥早上的開場台詞說完後呼叫
 *   Music.toggle();   // 靜音／取消靜音，並記在 localStorage（key: sb_mute）
 *   Music.fadeOut(3); // 淡出並停止（蛋糕畫面等場景用）
 *
 * 若頁面有 <button id="mute">，會自動顯示「音樂：開／關」並綁定 toggle。
 * 切到背景或鎖屏會自動暫停，回來再繼續。
 */
const Music=(()=>{
 let ac,master,rev,nb,timer=null,nextT=0,step=0,started=false,muted=false;
 try{muted=localStorage.getItem('sb_mute')==='1';}catch(e){}
 const BPM=98,SW=.1,LEN=128,SD=60/BPM/4,VOL=.6,map={};
 const M=m=>440*Math.pow(2,(m-69)/12);
 const E=(s,i,m,l,v)=>(map[s]=map[s]||[]).push([i,m,l,v]);
 (function build(){
  const ch=[[57,60,64],[53,57,60],[50,53,57],[52,56,59]],r=[45,41,38,40],ix1=[0,1,2,1,0,2],ix2=[2,1,0,1,2,0],st=[0,3,6,8,11,14];
  for(let b=0;b<8;b++){const o=b*16,c=ch[b%4],sec=b>=4;
   st.forEach((s,k)=>E(o+s,'pluck',c[(sec?ix2:ix1)[k]]+12,1,.2));
   E(o,'bass',r[b%4],3,.38);E(o+6,'bass',r[b%4]+7,2,.28);E(o+8,'bass',r[b%4],3,.32);E(o+14,'bass',r[b%4]+7,2,.25);
   E(o,'kick',0,1,.4);E(o+4,'rim',0,1,.25);E(o+12,'rim',0,1,.25);
   [2,6,10,14].forEach(x=>E(o+x,'hat',0,1,.1));
   if(sec){E(o,'pad',c[0],15,.03);E(o,'bell',[81,77,74,80][b-4],6,.1);E(o+8,'bell',[76,72,69,71][b-4],5,.09);}}
  E(24,'bell',76,6,.12);E(60,'bell',68,6,.1);
 })();
 function env(g,t,a,d,v){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
 function osc(type,f,t,dur){const o=ac.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(t+dur);return o;}
 function out(n,wet){n.connect(master);if(wet){const s=ac.createGain();s.gain.value=wet;n.connect(s);s.connect(rev);}}
 function noise(t,dur,type,fq,v,q){const s=ac.createBufferSource();s.buffer=nb;const f=ac.createBiquadFilter();f.type=type;f.frequency.value=fq;if(q)f.Q.value=q;const g=ac.createGain();env(g,t,.002,dur,v);s.connect(f);f.connect(g);out(g,.12);s.start(t);s.stop(t+dur+.05);}
 function voice(i,m,t,len,v){
  const f=m?M(m):0;
  if(i==='kick'){const o=osc('sine',120,t,.3);o.frequency.exponentialRampToValueAtTime(42,t+.14);const g=ac.createGain();env(g,t,.002,.25,v);o.connect(g);out(g,0);return;}
  if(i==='rim'){noise(t,.05,'bandpass',3200,v,2);return;}
  if(i==='hat'){noise(t,.04,'highpass',7500,v);return;}
  const g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';g.connect(lp);
  if(i==='pluck'){const o=osc('triangle',f,t,len+.5);o.connect(g);env(g,t,.004,len*.7+.12,v);lp.frequency.value=2200;out(lp,.2);}
  else if(i==='bass'){const o=osc('sine',f,t,len+.3),o2=osc('triangle',f,t,len+.3),g2=ac.createGain();g2.gain.value=.3;o.connect(g);o2.connect(g2);g2.connect(g);env(g,t,.01,len+.1,v);lp.frequency.value=520;out(lp,0);}
  else if(i==='bell'){const o=osc('sine',f,t,4),o2=osc('sine',f*2.76,t,2),g2=ac.createGain();env(g2,t,.003,1.2,v*.2);o2.connect(g2);g2.connect(lp);o.connect(g);env(g,t,.004,3.4,v);lp.frequency.value=7000;out(lp,.85);}
  else if(i==='pad'){const o=osc('sawtooth',f,t,len+3),o2=osc('sawtooth',f*1.006,t,len+3);o.connect(g);o2.connect(g);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+Math.min(1.6,len/3));g.gain.linearRampToValueAtTime(v,t+Math.max(.5,len-1));g.gain.linearRampToValueAtTime(.0001,t+len+2);lp.frequency.value=650;out(lp,.5);}
 }
 function tick(){
  while(nextT<ac.currentTime+.15){const sw=step%2?SW*SD:0;
   (map[step]||[]).forEach(e=>voice(e[0],e[1],nextT+sw,e[2]*SD,e[3]));
   nextT+=SD;step=(step+1)%LEN;}
 }
 function level(t){master.gain.cancelScheduledValues(ac.currentTime);master.gain.setTargetAtTime(muted?0:VOL,ac.currentTime,t);}
 function label(){const b=document.getElementById('mute');if(b)b.textContent=muted?'音樂：關':'音樂：開';}
 function start(){
  if(started)return;started=true;
  try{
   ac=new(window.AudioContext||window.webkitAudioContext)();
   master=ac.createGain();master.gain.value=0;master.connect(ac.destination);
   const len=ac.sampleRate*2.6,b=ac.createBuffer(2,len,ac.sampleRate);
   for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6);}
   rev=ac.createConvolver();rev.buffer=b;const w=ac.createGain();w.gain.value=.5;rev.connect(w);w.connect(master);
   const nl=ac.sampleRate;nb=ac.createBuffer(1,nl,ac.sampleRate);const nd=nb.getChannelData(0);for(let i=0;i<nl;i++)nd[i]=Math.random()*2-1;
   ac.resume();
  }catch(e){started=false;}
 }
 function begin(){
  if(!ac||timer)return;
  try{ac.resume();nextT=ac.currentTime+.3;step=0;timer=setInterval(tick,25);
   master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(0,ac.currentTime);
   if(!muted)master.gain.linearRampToValueAtTime(VOL,ac.currentTime+3);}catch(e){}
 }
 function toggle(){muted=!muted;try{localStorage.setItem('sb_mute',muted?'1':'0');}catch(e){}label();if(ac)level(.25);}
 document.addEventListener('visibilitychange',()=>{if(!ac)return;if(document.hidden)ac.suspend();else ac.resume();});
 document.addEventListener('DOMContentLoaded',label);
 const mb=document.getElementById('mute');if(mb){mb.addEventListener('pointerdown',e=>e.stopPropagation());mb.addEventListener('click',toggle);label();}
 function fadeOut(sec){if(!ac||!master)return;sec=sec||3;master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(master.gain.value,ac.currentTime);master.gain.linearRampToValueAtTime(0,ac.currentTime+sec);setTimeout(()=>{if(timer){clearInterval(timer);timer=null;}},sec*1000+200);}
 return{start,begin,toggle,fadeOut};
})();
