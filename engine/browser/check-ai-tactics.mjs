/* Regressioni tattiche del bot:
   1) non fermarsi dopo un solo attacco quando il danno in campo e' lethal;
   2) non sprecare MST/Dust Tornado su una carta normale gia' in risoluzione. */
import { crearCerebro } from "./src/ai/brain.js";

const X = {
  OcgMessageType: { SELECT_IDLECMD:1, SELECT_BATTLECMD:2, SELECT_CHAIN:3,
    SELECT_CARD:4, SELECT_TRIBUTE:5, SELECT_UNSELECT_CARD:6,
    ANNOUNCE_CARD:7, SELECT_POSITION:8, SELECT_EFFECTYN:9, SELECT_YESNO:10 },
  OcgResponseType: { SELECT_IDLECMD:101, SELECT_BATTLECMD:102, SELECT_CHAIN:103,
    SELECT_CARD:104, SELECT_TRIBUTE:105, SELECT_UNSELECT_CARD:106,
    ANNOUNCE_CARD:107, SELECT_POSITION:108, SELECT_EFFECTYN:109, SELECT_YESNO:110 },
  SelectIdleCMDAction: { TO_BP:1, TO_EP:2 },
  SelectBattleCMDAction: { SELECT_BATTLE:1, TO_M2:2, TO_EP:3 },
  OcgPosition: { FACEUP_ATTACK:1, FACEUP_DEFENSE:4, FACEDOWN_DEFENSE:8 },
  cardMatchesOpcode(){ return true; },
};

const names = {
  1001:{name:"Airknight Parshath"},
  1002:{name:"Breaker the Magical Warrior"},
  1003:{name:"Asura Priest"},
  2001:{name:"Mystical Space Typhoon"},
  3001:{name:"Smashing Ground"},
  3002:{name:"Snatch Steal"},
};
const db = new Map([
  [1001,{type:1,attack:1900,defense:1400}],
  [1002,{type:1,attack:1900,defense:1000}],
  [1003,{type:1,attack:1700,defense:1200}],
  [2001,{type:0x10002,attack:0,defense:0}], // Quick-Play Spell
  [3001,{type:0x2,attack:0,defense:0}],     // Normal Spell
  [3002,{type:0x40002,attack:0,defense:0}], // Equip Spell
]);

function card(uid, code, controller, location, sequence, position=1){
  return { uid, code, controller, location, sequence, position };
}
function duelBase(){
  const zones={
    0:{1:[],2:[],4:new Array(5).fill(null),8:new Array(6).fill(null),16:[],32:[],64:[]},
    1:{1:[],2:[],4:new Array(5).fill(null),8:new Array(6).fill(null),16:[],32:[],64:[]},
  };
  const cards=new Map();
  const d={
    zones,cards,lp:{0:8000,1:8000},turnPlayer:1,turnCount:8,phase:8,cadena:[],
    at(p,l,s){ return this.zones[p]?.[l]?.[s] ?? null; },
    resolve(loc, code){
      const z=this.zones[loc.controller]?.[loc.location] ?? [];
      return z[loc.sequence] ?? z.find(c=>c?.code===code) ?? null;
    },
  };
  return d;
}
function put(d,c){
  d.cards.set(c.uid,c);
  const z=d.zones[c.controller][c.location];
  if(c.location===4 || c.location===8) z[c.sequence]=c; else z.push(c);
}

let fallos=0;
const ok=(cond,msg)=>{ console.log(cond?"  ✓":"  ✗",msg); if(!cond) fallos++; };

/* Lethal: 1900+1900+1700 = 5500. Prima il bot "prudente" vedeva 2 backrow,
   vantaggio di carte e 3 mostri, quindi attaccava con uno solo. */
{
  const d=duelBase();
  d.lp[0]=5000;
  put(d,card(1,1001,1,4,0,1));
  put(d,card(2,1002,1,4,1,1));
  put(d,card(3,1003,1,4,2,1));
  put(d,card(10,0,0,8,0,8));
  put(d,card(11,0,0,8,1,8));
  // mano propria abbondante => vantaggio > 2, così la vecchia prudenza scatta davvero
  for(let i=0;i<4;i++) put(d,card(20+i,1003,1,2,i,1));

  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const attacks=[
    {code:1001,controller:1,location:4,sequence:0},
    {code:1002,controller:1,location:4,sequence:1},
    {code:1003,controller:1,location:4,sequence:2},
  ];
  const m={type:X.OcgMessageType.SELECT_BATTLECMD,attacks,to_m2:true};
  const r0=brain(m,0), r1=brain(m,1), r2=brain(m,2);
  ok(r0.action===X.SelectBattleCMDAction.SELECT_BATTLE,"lethal: primo attacco");
  ok(r1.action===X.SelectBattleCMDAction.SELECT_BATTLE,"lethal: secondo attacco non viene frenato");
  ok(r2.action===X.SelectBattleCMDAction.SELECT_BATTLE,"lethal: terzo attacco non viene frenato");
}

/* MST non nega Smashing Ground: se la sola carta utile da colpire e' proprio
   quella gia' attivata, l'IA deve lasciare risolvere la catena. */
{
  const d=duelBase();
  const mst=card(30,2001,1,8,0,8); put(d,mst);
  const normal=card(31,3001,0,8,0,1); put(d,normal);
  d.cadena=[{code:3001,controller:0,uid:31}];
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_CHAIN,forced:false,
           selects:[{code:2001,controller:1,location:8,sequence:0}]};
  const r=brain(m,0);
  ok(r.index==null,"MST non viene sprecato su una Normal Spell gia' attivata");
}

/* Controllo opposto: contro un Equip attivo, distruggerlo in catena e' utile. */
{
  const d=duelBase();
  const mst=card(40,2001,1,8,0,8); put(d,mst);
  const equip=card(41,3002,0,8,0,1); put(d,equip);
  d.cadena=[{code:3002,controller:0,uid:41}];
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_CHAIN,forced:false,
           selects:[{code:2001,controller:1,location:8,sequence:0}]};
  const r=brain(m,0);
  ok(r.index===0,"MST resta disponibile contro un Equip che deve rimanere sul campo");
}

if(fallos){ console.error("\n"+fallos+" regressione/i fallita/e"); process.exit(1); }
console.log("\nTutte le regressioni tattiche sono passate.");
