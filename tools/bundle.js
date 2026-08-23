/* Bundles the whole game into one self-contained HTML file. */
const fs=require('fs'),path=require('path');
const W=path.join(__dirname,'..','www');
const read=p=>fs.readFileSync(path.join(W,p),'utf8');

const html=read('index.html');
const css=read('styles.css');
const order=['bignum','util','i18n','data','state','sprites','mutations','arena','audio','ads','game','ui','views','main'];
const js=order.map(n=>'/* ===== js/'+n+'.js ===== */\n'+read('js/'+n+'.js')).join('\n');

const body=html.split('<body class="rtl">')[1].split('<script src="js/util.js">')[0]
  .replace(/<script[\s\S]*?<\/script>/g,'').trim();

const out=`<title>Critter Clash</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Cairo:wght@600;700;900&display=swap">
<style>
${css}
/* the artifact host owns <body>; the game shell needs the same box the app gets */
html,body{height:100%;margin:0;background:#0d0b1f;overflow:hidden}
</style>
<div id="cc-root">
${body}
</div>
<script>
${js}
</script>`;

const dest=path.join(__dirname,'..','dist');
fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(path.join(dest,'critter-clash.html'),out);
console.log('dist/critter-clash.html  '+(out.length/1024).toFixed(0)+' KB');
