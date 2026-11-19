/*
 * music.js v3 — 《宋鳥的一天》配樂系統
 * 純 WebAudio 即時合成，不需要任何音樂檔，可離線播放。
 *
 * 兩首曲子：
 *   'main'   = 線索推理 A（探索、推理，好奇的撥弦，BPM 98）
 *   'memory' = 老錄音帶（回憶段落，有點搖晃、帶輕微唱片雜音，BPM 62）
 *   'birthday' = 生日快樂歌（吉他到全員，前奏＋三段漸強升調＋收尾，約 66 秒，只播一遍），唱完自動接上「燭光氛圍」並一直持續，不會自己結束
 *   'candle'   = 只有燭光氛圍（很輕的長音和零星鈴聲，無限循環），不放生日快樂歌
 *
 * 用法（全域物件 Music）：
 *   Music.start();             // 必須在使用者「點擊」事件裡呼叫（iOS 規定），只建立音訊，不出聲
 *   Music.begin();             // 開始播放 main，3 秒淡入（遊戲裡是在宋鳥開場台詞說完後呼叫）
 *   Music.setMode('memory');   // 淡入淡出切到回憶曲（預設 2.5 秒），進入回憶動畫／回憶場景時呼叫
 *   Music.setMode('main');     // 切回主旋律（從頭開始播）
 *   Music.setMode('memory', 1.2); // 第二個參數可指定淡入淡出秒數
 *   Music.toggle();            // 靜音／取消靜音，記在 localStorage（key: sb_mute）
 *   Music.fadeOut(3);          // 全部淡出並停止（蛋糕結尾畫面用）
 *   Music.setMode('birthday', 1.5); // 蛋糕出場時呼叫：淡入淡出切到生日快樂歌，唱完接燭光氛圍
 *   Music.setMode('candle', 1.5);   // 若不想放歌，只要燭光氛圍就用這個
 *   Music.mode();              // 回傳目前模式：'main'、'memory'、'birthday'、'candle' 或 null
 *
 * 若頁面有 <button id="mute">，會自動顯示「音樂：開／關」並綁定 toggle。
 * 切到背景或鎖屏會自動暫停，回來再繼續。
 */
const Music=(()=>{
 let ac,master,rev,nb,timer=null,started=false,muted=false,cur=null,act=[];
 try{muted=localStorage.getItem('sb_mute')==='1';}catch(e){}
 const VOL=.6;
 const M=m=>440*Math.pow(2,(m-69)/12);
 const E=(a,s,i,m,l,v)=>a.push([s,i,m,l,v]);
 const toMap=ev=>{const m={};ev.forEach(e=>(m[e[0]]=m[e[0]]||[]).push(e));return m;};

 /* ---------- 曲子資料 ---------- */
 function buildMain(){
  const a=[],ch=[[57,60,64],[53,57,60],[50,53,57],[52,56,59]],r=[45,41,38,40],ix1=[0,1,2,1,0,2],ix2=[2,1,0,1,2,0],st=[0,3,6,8,11,14];
  for(let b=0;b<8;b++){const o=b*16,c=ch[b%4],sec=b>=4;
   st.forEach((s,k)=>E(a,o+s,'pluck',c[(sec?ix2:ix1)[k]]+12,1,.2));
   E(a,o,'bass',r[b%4],3,.38);E(a,o+6,'bass',r[b%4]+7,2,.28);E(a,o+8,'bass',r[b%4],3,.32);E(a,o+14,'bass',r[b%4]+7,2,.25);
   E(a,o,'kick',0,1,.4);E(a,o+4,'rim',0,1,.25);E(a,o+12,'rim',0,1,.25);
   [2,6,10,14].forEach(x=>E(a,o+x,'hat',0,1,.1));
   if(sec){E(a,o,'pad',c[0],15,.03);E(a,o,'bell',[81,77,74,80][b-4],6,.1);E(a,o+8,'bell',[76,72,69,71][b-4],5,.09);}}
  E(a,24,'bell',76,6,.12);E(a,60,'bell',68,6,.1);
  return{bpm:98,len:128,sw:.1,map:toMap(a)};
 }
 function buildMemory(){
  const a=[],ch=[[57,60,64],[53,57,60],[50,53,57],[52,56,59]],r=[45,41,38,40];
  const mel=[[[0,76,6],[6,72,4],[10,74,6]],[[0,72,6],[6,69,4],[10,72,6]],[[0,74,6],[6,77,4],[10,74,6]],[[0,71,6],[6,68,4],[10,71,6]],
   [[0,81,6],[6,79,4],[10,76,6]],[[0,77,6],[6,76,4],[10,72,6]],[[0,74,4],[4,77,4],[8,81,8]],[[0,80,8],[8,76,8]]];
  for(let b=0;b<8;b++){const o=b*16,c=ch[b%4];
   [0,8].forEach((x,k)=>E(a,o+x,'ep',c[k?2:0],6,.1));
   E(a,o,'bass',r[b%4],14,.28);E(a,o,'pad',c[0],16,.024);
   mel[b].forEach(x=>E(a,o+x[0],'ep',x[1],x[2],.2));}
  for(let k=0;k<26;k++)E(a,Math.floor(Math.random()*128),'crk',0,1,.03+Math.random()*.04);
  return{bpm:62,len:128,sw:0,lp:1700,wob:1,epw:.25,map:toMap(a)};
 }

function buildBirthday(song){
  const a=[];let base=0;
  if(song){
   /* 生日快樂歌：吉他到全員。前奏→第一段（吉他獨奏）→第二段（加低音與節奏）→第三段（升調、鼓與和聲）→收尾，約 66 秒，只播一遍 */
   const CT={Cadd9:{r:48,v:[60,64,67,74]},'G/B':{r:47,v:[62,67,71]},G:{r:43,v:[59,62,67]},Cmaj7:{r:48,v:[60,64,67,71]},Am7:{r:45,v:[60,64,67,69]},Fmaj7:{r:41,v:[60,64,65,69]}};
   const CP=[['Cadd9','G/B'],['G','Cmaj7'],['Cadd9','Am7'],['Fmaj7','Cadd9']];
   const N=[{p:[67,67],A:[69,67,72],B:[[71,12]]},{p:[67,67],A:[69,67,74],B:[[72,12]]},{p:[67,67],A:[79,76,72],B:[[71,4],[69,8]]},{p:[77,77],A:[76,72,74],B:[[72,12]]}];
   const L=[0,28,56,84],ARP=[0,1,2,1,2,1],SC=[0,2,4,5,7,9,11];
   const third=m=>{const pc=m%12;let o=Math.floor(m/12),k=SC.indexOf(pc);if(k<0)return m-4;k-=2;if(k<0){k+=7;o--;}return o*12+SC[k];};
   const verse=(b,tr,o)=>{N.forEach((n,i)=>{const s=b+L[i];
     const nt=[[0,n.p[0],3],[3,n.p[1],1],[4,n.A[0],4],[8,n.A[1],4],[12,n.A[2],4]];let t=16;n.B.forEach(x=>{nt.push([t,x[0],x[1]]);t+=x[1];});
     nt.forEach(x=>{const m=x[1]+tr;E(a,s+x[0],'gtr',m,x[2],o.mv);if(o.bell)E(a,s+x[0],'bell',m+12,x[2],o.bell);if(o.harm)E(a,s+x[0],'gtr',third(x[1])+tr,x[2],o.harm);});
     [[4,CP[i][0]],[16,CP[i][1]]].forEach(c=>{const C=CT[c[1]],v=C.v.map(m=>m+tr),st=s+c[0];
      if(o.bass)E(a,st,'bass',C.r+tr,12,o.bass);
      if(o.pad)v.forEach(m=>E(a,st,'pad',m-12,12,o.pad));
      for(let k=0;k<12;k+=2)E(a,st+k,'gtr',v[ARP[(k/2)%6]%v.length]-12,2,o.arp);
      if(o.hat)for(let k=0;k<12;k+=2)E(a,st+k,'hat',0,1,o.hat*(k%4?1:.6));
      if(o.kick)E(a,st,'kick',0,2,o.kick);
      if(o.rim)[4,8].forEach(k=>E(a,st+k,'rim',0,1,o.rim));});});};
   [72,76,79,84,79,76].forEach((m,k)=>E(a,k*3,'bell',m,6,.05));E(a,0,'pad',48,16,.02);E(a,0,'pad',55,16,.015);
   verse(16,0,{mv:.22,arp:.07});
   verse(128,0,{mv:.23,arp:.07,bass:.2,hat:.025,rim:.05});
   verse(240,2,{mv:.25,harm:.12,arp:.08,bass:.27,kick:.25,rim:.12,hat:.035,bell:.06,pad:.02});
   const e=352;CT.Cadd9.v.forEach(m=>E(a,e,'gtr',m+2,24,.13));E(a,e,'bass',50,26,.3);
   [60,64,67].forEach(m=>E(a,e,'pad',m+2-12,26,.04));
   [84,88,91,96].forEach((m,k)=>E(a,e+2+k*4,'bell',m+2,10,.06));
   base=384;
  }
  E(a,base,'pad',48,124,.026);E(a,base,'pad',55,124,.02);E(a,base,'pad',64,124,.016);
  [[12,84,.05],[34,79,.045],[58,88,.04],[80,76,.045],[104,91,.035]].forEach(x=>E(a,base+x[0],'bell',x[1],6,x[2]));
  return{bpm:84,len:base+128,loopFrom:base,sw:0,lp:3400,epw:.3,human:1,map:toMap(a)};
 }

 /* ---------- 音色 ---------- */
 function env(g,t,a,d,v){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
 function osc(type,f,t,dur){const o=ac.createOscillator();o.type=type;o.frequency.value=f;o.start(t);o.stop(t+dur);return o;}
 function out(tk,n,wet){n.connect(tk.bus);if(wet){const s=ac.createGain();s.gain.value=wet;n.connect(s);s.connect(tk.send);}}
 function noise(tk,t,dur,type,fq,v,q,off){const s=ac.createBufferSource();s.buffer=nb;const f=ac.createBiquadFilter();f.type=type;f.frequency.value=fq;if(q)f.Q.value=q;const g=ac.createGain();env(g,t,.002,dur,v);s.connect(f);f.connect(g);out(tk,g,.12);s.start(t,off||0);s.stop(t+dur+.05);}
 function voice(tk,i,m,t,len,v){
  const f=m?M(m):0;
  if(i==='kick'){const o=osc('sine',120,t,.3);o.frequency.exponentialRampToValueAtTime(42,t+.14);const g=ac.createGain();env(g,t,.002,.25,v);o.connect(g);out(tk,g,0);return;}
  if(i==='rim'){noise(tk,t,.05,'bandpass',3200,v,2);return;}
  if(i==='hat'){noise(tk,t,.04,'highpass',7500,v);return;}
  if(i==='crk'){noise(tk,t,.012,'highpass',3800,v,0,Math.random()*.8);return;}
  const g=ac.createGain(),lp=ac.createBiquadFilter();lp.type='lowpass';g.connect(lp);
  if(i==='pluck'){const o=osc('triangle',f,t,len+.5);o.connect(g);env(g,t,.004,len*.7+.12,v);lp.frequency.value=2200;out(tk,lp,.2);}
  if(i==='gtr'){const o=osc('triangle',f,t,len+.5),o2=osc('sine',f*2,t,.4),g2=ac.createGain();env(g2,t,.003,.18,v*.4);o2.connect(g2);g2.connect(lp);o.connect(g);env(g,t,.004,len*.8+.15,v);lp.frequency.value=2600;out(tk,lp,.25);}
  else if(i==='ep'){
   const d=len+.9,o=osc('sine',f,t,d+.2),o2=osc('sine',f*2,t,1.2),g2=ac.createGain();
   env(g2,t,.004,.7,v*.3);o2.connect(g2);g2.connect(lp);o.connect(g);env(g,t,.007,d,v);
   lp.frequency.value=tk.lp||2800;
   if(tk.wob){const l=osc('sine',.55+Math.random()*.2,t,d+.3),lg=ac.createGain();lg.gain.value=16;l.connect(lg);lg.connect(o.detune);lg.connect(o2.detune);}
   out(tk,lp,tk.epw||.35);}
  else if(i==='bass'){const o=osc('sine',f,t,len+.3),o2=osc('triangle',f,t,len+.3),g2=ac.createGain();g2.gain.value=.3;o.connect(g);o2.connect(g2);g2.connect(g);env(g,t,.01,len+.1,v);lp.frequency.value=520;out(tk,lp,0);}
  else if(i==='bell'){const o=osc('sine',f,t,4),o2=osc('sine',f*2.76,t,2),g2=ac.createGain();env(g2,t,.003,1.2,v*.2);o2.connect(g2);g2.connect(lp);o.connect(g);env(g,t,.004,3.4,v);lp.frequency.value=7000;out(tk,lp,.85);}
  else if(i==='pad'){const o=osc('sawtooth',f,t,len+3),o2=osc('sawtooth',f*1.006,t,len+3);o.connect(g);o2.connect(g);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+Math.min(1.6,len/3));g.gain.linearRampToValueAtTime(v,t+Math.max(.5,len-1));g.gain.linearRampToValueAtTime(.0001,t+len+2);lp.frequency.value=650;out(tk,lp,.5);}
 }

 /* ---------- 排程與切換 ---------- */
 function tick(){
  act.forEach(tk=>{const SD=60/tk.bpm/4;
   while(tk.nextT<ac.currentTime+.15){const sw=tk.step%2?tk.sw*SD:0;
    (tk.map[tk.step]||[]).forEach(e=>{const h=tk.human&&(e[1]==='ep'||e[1]==='gtr');voice(tk,e[1],e[2],tk.nextT+sw+(h?(Math.random()-.4)*.02:0),e[3]*SD,e[4]*(h?(.88+Math.random()*.24):1));});
    tk.nextT+=SD;tk.step++;if(tk.step>=tk.len)tk.step=tk.loopFrom||0;}});
 }
 function ensureTimer(){if(!timer)timer=setInterval(tick,25);}
 function makeTrack(name,startGain){
  const d=name==='memory'?buildMemory():name==='birthday'?buildBirthday(true):name==='candle'?buildBirthday(false):buildMain();
  d.name=name;d.step=0;d.nextT=ac.currentTime+.3;
  d.bus=ac.createGain();d.bus.gain.value=startGain;d.bus.connect(master);
  d.send=ac.createGain();d.send.gain.value=startGain;d.send.connect(rev);
  act.push(d);return d;
 }
 function fadeTrack(tk,to,sec){
  [tk.bus,tk.send].forEach(g=>{g.gain.cancelScheduledValues(ac.currentTime);g.gain.setValueAtTime(g.gain.value,ac.currentTime);g.gain.linearRampToValueAtTime(to,ac.currentTime+sec);});
 }
 function dropTrack(tk,after){
  setTimeout(()=>{act=act.filter(x=>x!==tk);try{tk.bus.disconnect();tk.send.disconnect();}catch(e){}if(!act.length&&timer){clearInterval(timer);timer=null;}},after*1000+2500);
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
  if(!ac||cur)return;
  try{ac.resume();cur=makeTrack('main',1);ensureTimer();
   master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(0,ac.currentTime);
   if(!muted)master.gain.linearRampToValueAtTime(VOL,ac.currentTime+3);}catch(e){}
 }
 function setMode(name,sec){
  if(!ac||!cur||cur.name===name)return;
  if(['main','memory','birthday','candle'].indexOf(name)<0)return;
  sec=sec==null?2.5:sec;
  try{ac.resume();
   const old=cur;fadeTrack(old,0,sec);dropTrack(old,sec);
   cur=makeTrack(name,0);fadeTrack(cur,1,sec);ensureTimer();}catch(e){}
 }
 function toggle(){muted=!muted;try{localStorage.setItem('sb_mute',muted?'1':'0');}catch(e){}label();if(ac)level(.25);}
 function fadeOut(sec){
  if(!ac||!master)return;sec=sec||3;
  master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(master.gain.value,ac.currentTime);master.gain.linearRampToValueAtTime(0,ac.currentTime+sec);
  setTimeout(()=>{act.forEach(tk=>{try{tk.bus.disconnect();tk.send.disconnect();}catch(e){}});act=[];cur=null;if(timer){clearInterval(timer);timer=null;}},sec*1000+200);
 }
 document.addEventListener('visibilitychange',()=>{if(!ac)return;if(document.hidden)ac.suspend();else ac.resume();});
 document.addEventListener('DOMContentLoaded',label);
 const mb=document.getElementById('mute');if(mb){mb.addEventListener('pointerdown',e=>e.stopPropagation());mb.addEventListener('click',toggle);label();}
 return{start,begin,setMode,toggle,fadeOut,mode:()=>cur?cur.name:null};
})();
