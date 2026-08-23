/* Visual capture: set up a rich save state, then screenshot every screen. */
const http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const ROOT=path.join(__dirname,'..','www');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'};
const serve=p=>new Promise(r=>{const s=http.createServer((q,rp)=>{let u=q.url.split('?')[0];if(u==='/')u='/index.html';
 const f=path.join(ROOT,u);if(!fs.existsSync(f)){rp.writeHead(404);rp.end();return;}
 rp.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'text/plain'});fs.createReadStream(f).pipe(rp);});s.listen(p,()=>r(s));});

(async()=>{
  const server=await serve(5200);
  const browser=await chromium.launch();
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
  const page=await ctx.newPage();
  page.on('pageerror',e=>console.log('ERR',e.message));
  await page.goto('http://localhost:5200/',{waitUntil:'networkidle'});
  await page.waitForSelector('#app:not([hidden])');
  await page.waitForTimeout(700);
  let m=await page.$('.modal-bg [data-close]'); if(m) await m.click();

  await page.evaluate(()=>{
    const g=window.CCDEBUG.state();
    g.bestStage=48; g.souls=64; g.gems=430; g.prestiges=2;
    g.gold=5e11;
    ['sparky','mossy','pyra','glacio','venn','phantom'].forEach((id,i)=>{ g.critters[id]=[260,180,120,80,45,12][i]; });
    window.CC.data.UPGRADES.forEach((u,i)=>{ g.upgrades[u.id]=[40,18,12,9,22,14,6,3,4,1][i]||0; });
    g.relics.r_dmg=6; g.relics.r_gold=4; g.relics.r_tap=5; g.relics.r_auto=2;
    Object.keys(g.achievements).length; ['a_stage5','a_stage10','a_stage25','a_tap100','a_kill100','a_boss10','a_pres1','a_squad3'].forEach(a=>g.achievements[a]=true);
    g.boosts.gold={mult:2,end:Date.now()+900000};
    window.CC.game.gotoStage(32);
  });
  await page.waitForTimeout(1500);
  const dir=path.join(__dirname,'..','shots');
  fs.mkdirSync(dir,{recursive:true});

  const box=await (await page.$('#taplayer')).boundingBox();
  for(let i=0;i<6;i++){ await page.mouse.click(box.x+box.width/2,box.y+box.height*0.45); await page.waitForTimeout(60); }
  await page.waitForTimeout(120);
  await page.screenshot({path:path.join(dir,'v-battle.png')});

  // boss
  await page.evaluate(()=>window.CC.game.gotoStage(35));
  await page.waitForTimeout(1400);
  const b2=await (await page.$('#taplayer')).boundingBox();
  await page.mouse.click(b2.x+b2.width/2,b2.y+b2.height*0.45);
  await page.waitForTimeout(200);
  await page.screenshot({path:path.join(dir,'v-boss.png')});

  for(const v of ['critters','upgrades','prestige','more']){
    await page.click('#tabs .tab[data-view="'+v+'"]');
    await page.waitForTimeout(700);
    await page.screenshot({path:path.join(dir,'v-'+v+'.png')});
  }
  // rewards modal
  await page.click('#tabs .tab[data-view="battle"]');
  await page.waitForTimeout(400);
  await page.click('#chest-btn',{force:true});
  await page.waitForTimeout(500);
  await page.screenshot({path:path.join(dir,'v-rewards.png')});

  await browser.close(); server.close();
  console.log('shots written');
})();
