/* Renders app icon, splash screen and a Play-Store feature graphic
   using the game's own procedural sprite renderer. No art assets needed. */
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..','www');
const OUT=path.join(__dirname,'..','resources');

const PAGE=(w,h,mode)=>`<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:transparent}canvas{display:block}</style></head><body>
<canvas id="c" width="${w}" height="${h}"></canvas>
<script src="/js/util.js"></script><script src="/js/i18n.js"></script>
<script src="/js/data.js"></script><script src="/js/sprites.js"></script>
<script>
const W=${w},H=${h},MODE=${JSON.stringify(mode)};
const c=document.getElementById('c'),x=c.getContext('2d');
const SP=CC.sprites,U=CC.util;

function bg(){
  const g=x.createRadialGradient(W*0.5,H*0.32,W*0.05,W*0.5,H*0.6,W*0.85);
  g.addColorStop(0,'#3b2a7a');g.addColorStop(0.55,'#221a52');g.addColorStop(1,'#0d0b1f');
  x.fillStyle=g;x.fillRect(0,0,W,H);
  // starfield
  const rng=U.seeded(9);
  for(let i=0;i<Math.round(W*H/9000);i++){
    x.fillStyle='rgba(255,255,255,'+(0.15+rng()*0.5)+')';
    const r=rng()*W*0.0035+0.5;
    x.beginPath();x.arc(rng()*W,rng()*H,r,0,6.2832);x.fill();
  }
  // glow ring behind hero
  const rg=x.createRadialGradient(W*0.5,H*0.5,0,W*0.5,H*0.5,W*0.45);
  rg.addColorStop(0,'rgba(255,194,60,0.30)');rg.addColorStop(1,'rgba(255,194,60,0)');
  x.fillStyle=rg;x.beginPath();x.arc(W*0.5,H*0.5,W*0.45,0,6.2832);x.fill();
}

function hero(cx,cy,size){
  const spec={
    arch:SP.ARCHETYPES.find(a=>a.k==='imp'),
    pal:['#ffe066','#ffb703','#7a4b00'],
    eyeColor:'#ffffff',pupil:'#141225',boss:false,seed:42,scale:1,crown:false,
    aura:'#ffc23c',zi:0
  };
  SP.drawCreature(x,spec,cx,cy,size,0.85,{hit:0,look:{x:0,y:0.1}});
}

function claw(cx,cy,size){
  x.save();x.translate(cx,cy);x.rotate(-0.35);
  x.strokeStyle='rgba(255,255,255,0.92)';x.lineCap='round';
  for(let i=-1;i<=1;i++){
    x.lineWidth=size*0.055;
    x.beginPath();
    x.moveTo(-size*0.85,i*size*0.26-size*0.15);
    x.quadraticCurveTo(0,i*size*0.34+size*0.05,size*0.85,i*size*0.26+size*0.25);
    x.stroke();
  }
  x.restore();
}

bg();
if(MODE==='icon'){
  hero(W*0.5,H*0.54,W*0.30);
}else if(MODE==='fg'){
  x.clearRect(0,0,W,H);
  hero(W*0.5,H*0.54,W*0.22);        // adaptive-icon safe zone (inner 66%)
}else if(MODE==='bgonly'){
  // gradient only
}else if(MODE==='splash'){
  hero(W*0.5,H*0.46,Math.min(W,H)*0.13);
  x.textAlign='center';
  x.font='800 '+Math.round(Math.min(W,H)*0.055)+'px system-ui,sans-serif';
  x.fillStyle='#ffc23c';
  x.fillText('CRITTER CLASH',W*0.5,H*0.63);
  x.font='600 '+Math.round(Math.min(W,H)*0.032)+'px system-ui,sans-serif';
  x.fillStyle='#a99fd0';
  x.fillText('صدام المخلوقات',W*0.5,H*0.685);
}else if(MODE==='feature'){
  // Play Store feature graphic 1024x500
  const spots=[[0.16,0.55,0.10,'slime'],[0.30,0.66,0.085,'drake'],[0.72,0.62,0.09,'ghosty'],[0.86,0.52,0.10,'golem']];
  const pals=[['#8ce99a','#2f9e44','#12401f'],['#ff8787','#e03131','#5c1010'],['#e5dbff','#7048e8','#2b1a55'],['#a5d8ff','#1c7ed6','#0b3a63']];
  spots.forEach((s,i)=>{
    SP.drawCreature(x,{arch:SP.ARCHETYPES.find(a=>a.k===s[3]),pal:pals[i],eyeColor:'#fff',pupil:'#141225',
      boss:false,seed:i*37+3,scale:1,crown:false,aura:null,zi:0},W*s[0],H*s[1],H*s[2],0.6+i,{look:{x:i<2?0.6:-0.6,y:0}});
  });
  hero(W*0.5,H*0.52,H*0.22);
  x.textAlign='center';
  x.font='900 '+Math.round(H*0.13)+'px system-ui,sans-serif';
  x.lineWidth=H*0.02;x.strokeStyle='rgba(0,0,0,0.55)';
  x.strokeText('CRITTER CLASH',W*0.5,H*0.22);
  x.fillStyle='#ffc23c';x.fillText('CRITTER CLASH',W*0.5,H*0.22);
  x.font='700 '+Math.round(H*0.062)+'px system-ui,sans-serif';
  x.fillStyle='#e9e3ff';
  x.fillText('Tap · Collect · Evolve · Idle', W*0.5, H*0.93);
}
document.title='ready';
</script></body></html>`;

const MIME={'.js':'text/javascript','.css':'text/css','.html':'text/html'};
function serve(port){return new Promise(r=>{const s=http.createServer((q,rp)=>{
  const u=q.url.split('?')[0];
  if(u.startsWith('/render')){ rp.writeHead(200,{'Content-Type':'text/html'}); rp.end(global.__PAGE); return; }
  const f=path.join(ROOT,u);
  if(!fs.existsSync(f)){rp.writeHead(404);rp.end();return;}
  rp.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(rp);
});s.listen(port,()=>r(s));});}

(async()=>{
  fs.mkdirSync(OUT,{recursive:true});
  const server=await serve(5201);
  const browser=await chromium.launch();
  const jobs=[
    {name:'icon.png',w:1024,h:1024,mode:'icon'},
    {name:'icon-foreground.png',w:1024,h:1024,mode:'fg'},
    {name:'icon-background.png',w:1024,h:1024,mode:'bgonly'},
    {name:'splash.png',w:2732,h:2732,mode:'splash'},
    {name:'splash-dark.png',w:2732,h:2732,mode:'splash'},
    {name:'feature-graphic.png',w:1024,h:500,mode:'feature'}
  ];
  for(const j of jobs){
    global.__PAGE=PAGE(j.w,j.h,j.mode);
    const page=await browser.newPage({viewport:{width:j.w,height:j.h}});
    await page.goto('http://localhost:5201/render',{waitUntil:'networkidle'});
    await page.waitForTimeout(200);
    const el=await page.$('#c');
    await el.screenshot({path:path.join(OUT,j.name),omitBackground:j.mode==='fg'});
    await page.close();
    console.log('  wrote resources/'+j.name+'  ('+j.w+'x'+j.h+')');
  }
  // web favicon
  global.__PAGE=PAGE(192,192,'icon');
  const p2=await browser.newPage({viewport:{width:192,height:192}});
  await p2.goto('http://localhost:5201/render',{waitUntil:'networkidle'});
  await (await p2.$('#c')).screenshot({path:path.join(ROOT,'icon-192.png')});
  await p2.close();
  console.log('  wrote www/icon-192.png');
  await browser.close();server.close();
})();
