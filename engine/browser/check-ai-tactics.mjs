/* Regressioni tattiche del bot:
   1) non fermarsi dopo un solo attacco quando il danno in campo e' lethal;
   2) non sprecare MST/Dust Tornado su una carta normale gia' in risoluzione. */
import { crearCerebro } from "./src/ai/brain.js";
import { vistaDe } from "./src/ai/view.js";

const X = {
  OcgMessageType: { SELECT_IDLECMD:1, SELECT_BATTLECMD:2, SELECT_CHAIN:3,
    SELECT_CARD:4, SELECT_TRIBUTE:5, SELECT_UNSELECT_CARD:6,
    ANNOUNCE_CARD:7, SELECT_POSITION:8, SELECT_EFFECTYN:9, SELECT_YESNO:10 },
  OcgResponseType: { SELECT_IDLECMD:101, SELECT_BATTLECMD:102, SELECT_CHAIN:103,
    SELECT_CARD:104, SELECT_TRIBUTE:105, SELECT_UNSELECT_CARD:106,
    ANNOUNCE_CARD:107, SELECT_POSITION:108, SELECT_EFFECTYN:109, SELECT_YESNO:110 },
  SelectIdleCMDAction: { TO_BP:1, TO_EP:2, SELECT_ACTIVATE:3 },
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
  4001:{name:"Sakuretsu Armor"},
  4002:{name:"Mirror Force"},
  5001:{name:"Gravekeeper's Spy"},
  6001:{name:"Heavy Storm"},
  7001:{name:"Mystic Tomato"},
  8001:{name:"Torrential Tribute"},
  8002:{name:"Ring of Destruction"},
  8003:{name:"Book of Moon"},
  8004:{name:"D.D. Warrior Lady"},
};
const db = new Map([
  [1001,{type:1,attack:1900,defense:1400}],
  [1002,{type:1,attack:1900,defense:1000}],
  [1003,{type:1,attack:1700,defense:1200}],
  [2001,{type:0x10002,attack:0,defense:0}], // Quick-Play Spell
  [3001,{type:0x2,attack:0,defense:0}],     // Normal Spell
  [3002,{type:0x40002,attack:0,defense:0}], // Equip Spell
  [4001,{type:0x4,attack:0,defense:0}],      // Normal Trap
  [4002,{type:0x4,attack:0,defense:0}],      // Normal Trap
  [5001,{type:0x200001,attack:1200,defense:2000}],
  [6001,{type:0x2,attack:0,defense:0}],
  [7001,{type:1,attack:1400,defense:1100}],
  [8001,{type:0x4,attack:0,defense:0}],
  [8002,{type:0x4,attack:0,defense:0}],
  [8003,{type:0x10002,attack:0,defense:0}],
  [8004,{type:1,attack:1500,defense:1600}],
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

/* Un mostro coperto è informazione nascosta: anche se la stima euristica
   "1600" farebbe tornare i conti, non deve trasformarsi in lethal certo. */
{
  const d=duelBase();
  d.lp[0]=3000;
  put(d,card(51,1001,1,4,0,1));
  put(d,card(52,1002,1,4,1,1));
  put(d,card(53,1003,1,4,2,1));
  put(d,card(54,5001,0,4,0,8)); // coperto: il bot non deve leggerne la DEF
  put(d,card(55,0,0,8,0,8));
  put(d,card(56,0,0,8,1,8));
  for(let i=0;i<5;i++) put(d,card(60+i,1003,1,2,i,1));

  const pensieri=[];
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1,log:x=>pensieri.push(x)});
  const attacks=[
    {code:1001,controller:1,location:4,sequence:0},
    {code:1002,controller:1,location:4,sequence:1},
    {code:1003,controller:1,location:4,sequence:2},
  ];
  const m={type:X.OcgMessageType.SELECT_BATTLECMD,attacks,to_m2:true};
  const r0=brain(m,0);
  ok(r0.action===X.SelectBattleCMDAction.SELECT_BATTLE,
     "informazione nascosta: il bot può comunque sondare il mostro coperto");
  ok(!pensieri.some(x=>/lethal detectado/i.test(x.msg||"")),
     "informazione nascosta: un mostro coperto impedisce di dichiarare lethal certo");
}

/* Sakuretsu non va sprecata sul primo attaccante minuscolo solo perché è
   legalmente attivabile; deve invece scattare quando il colpo è letale. */
{
  const d=duelBase();
  const sak=card(70,4001,1,8,0,8); put(d,sak);
  const piccolo=card(71,7001,0,4,0,1); put(d,piccolo);
  d.lp[1]=8000;
  d.ataqueActual={attackerUid:71,targetUid:null};
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_CHAIN,forced:false,
           selects:[{code:4001,controller:1,location:8,sequence:0}]};
  const r=brain(m,0);
  ok(r.index==null,"Sakuretsu viene conservata contro un attacco non urgente");

  d.lp[1]=1400;
  const r2=brain(m,0);
  ok(r2.index===0,"Sakuretsu viene usata quando l'attacco sarebbe letale");
}

/* Heavy Storm non deve fare -X puro sul proprio campo. */
{
  const d=duelBase();
  const hs=card(80,6001,1,2,0,1); put(d,hs);
  put(d,card(81,4001,1,8,0,8));
  put(d,card(82,4002,1,8,1,8));
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_IDLECMD,
           activates:[{code:6001,controller:1,location:2,sequence:0}],
           to_bp:true,to_ep:true};
  const r=brain(m,0);
  ok(r.action!==X.SelectIdleCMDAction.SELECT_ACTIVATE,
     "Heavy Storm non viene usata quando distruggerebbe solo backrow propria");
}

/* Con due carte avversarie e nessuna propria, Heavy Storm deve invece essere
   una delle priorità alte della Main Phase. */
{
  const d=duelBase();
  const hs=card(90,6001,1,2,0,1); put(d,hs);
  put(d,card(91,0,0,8,0,8));
  put(d,card(92,0,0,8,1,8));
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_IDLECMD,
           activates:[{code:6001,controller:1,location:2,sequence:0}],
           to_bp:true,to_ep:true};
  const r=brain(m,0);
  ok(r.action===X.SelectIdleCMDAction.SELECT_ACTIVATE,
     "Heavy Storm viene usata quando pulisce gratis due backrow avversarie");
}

/* Torrential: non resettare un campo proprio migliore per un solo mostro avversario. */
{
  const d=duelBase();
  put(d,card(100,8001,1,8,0,8));
  put(d,card(101,1001,1,4,0,1));
  put(d,card(102,1002,1,4,1,1));
  put(d,card(103,7001,0,4,0,1));
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_CHAIN,forced:false,
           selects:[{code:8001,controller:1,location:8,sequence:0}]};
  const r=brain(m,0);
  ok(r.index==null,"Torrential viene conservata quando il reset è sfavorevole");
}

/* Torrential: campo proprio vuoto contro due minacce -> reset sensato. */
{
  const d=duelBase();
  put(d,card(110,8001,1,8,0,8));
  put(d,card(111,1001,0,4,0,1));
  put(d,card(112,1002,0,4,1,1));
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_CHAIN,forced:false,
           selects:[{code:8001,controller:1,location:8,sequence:0}]};
  const r=brain(m,0);
  ok(r.index===0,"Torrential viene usata quando pulisce un campo avversario senza perdere mostri");
}

/* Ring: non deve scegliere una linea che manda a zero anche noi. */
{
  const d=duelBase();
  d.lp[1]=1500; d.lp[0]=8000;
  put(d,card(120,8002,1,8,0,8));
  put(d,card(121,1001,0,4,0,1)); // 1900 ATK > nostri LP
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_CHAIN,forced:false,
           selects:[{code:8002,controller:1,location:8,sequence:0}]};
  const r=brain(m,0);
  ok(r.index==null,"Ring of Destruction evita l'autosconfitta");
}

/* Ring: se il danno chiude la partita e noi sopravviviamo, va usata. */
{
  const d=duelBase();
  d.lp[1]=3000; d.lp[0]=1800;
  put(d,card(130,8002,1,8,0,8));
  put(d,card(131,1001,0,4,0,1)); // 1900: lethal sull'avversario, noi restiamo a 1100
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const m={type:X.OcgMessageType.SELECT_CHAIN,forced:false,
           selects:[{code:8002,controller:1,location:8,sequence:0}]};
  const r=brain(m,0);
  ok(r.index===0,"Ring of Destruction viene usata per un lethal sicuro");
}

/* D.D. Warrior Lady: l'effetto opzionale non è più un sì automatico. */
{
  const d=duelBase();
  const dd=card(140,8004,1,4,0,1); put(d,dd);
  const tomato=card(141,7001,0,4,0,1); put(d,tomato);
  d.ultimaBatalla={attackerUid:140,targetUid:141,attackerDestroyed:false,targetDestroyed:false};
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const no=brain({type:X.OcgMessageType.SELECT_EFFECTYN,code:8004},0);
  ok(no.yes===false,"D.D. Warrior Lady conserva l'effetto contro un bersaglio mediocre");

  const air=card(142,1001,0,4,1,1); put(d,air);
  d.ultimaBatalla={attackerUid:140,targetUid:142,attackerDestroyed:true,targetDestroyed:false};
  const yes=brain({type:X.OcgMessageType.SELECT_EFFECTYN,code:8004},0);
  ok(yes.yes===true,"D.D. Warrior Lady bandisce una minaccia forte quando conviene");
}

/* MST: una permanente nota e pericolosa deve essere scelta prima di una set sconosciuta. */
{
  const d=duelBase();
  put(d,card(150,2001,1,2,0,1));
  put(d,card(151,3002,0,8,0,1)); // Snatch Steal face-up
  put(d,card(152,0,0,8,1,8));    // backrow sconosciuta
  const brain=crearCerebro({X,duel:d,db,names,nivel:"experto",yo:1});
  const idle={type:X.OcgMessageType.SELECT_IDLECMD,
              activates:[{code:2001,controller:1,location:2,sequence:0}],
              to_bp:true,to_ep:true};
  const a=brain(idle,0);
  ok(a.action===X.SelectIdleCMDAction.SELECT_ACTIVATE,"MST viene attivato contro Snatch Steal attivo");
  const target=brain({type:X.OcgMessageType.SELECT_CARD,min:1,max:1,selects:[
    {code:3002,controller:0,location:8,sequence:0,position:1},
    {code:9999,controller:0,location:8,sequence:1,position:8}
  ]},0);
  ok(target.indicies?.[0]===0,"MST sceglie Snatch Steal prima della backrow sconosciuta");
}

/* Memoria lecita: una carta coperta mai vista resta anonima; se è stata
   rivelata in precedenza, il bot può ricordarne l'identità. */
{
  const d=duelBase();
  const set=card(160,3002,0,8,0,8);
  set.knownTo=new Set([0]);
  put(d,set);
  let v=vistaDe(d,1,db,names);
  ok(v.backrowRival[0]?.code==null,"backrow mai rivelata resta sconosciuta alla IA");
  set.knownTo.add(1);
  v=vistaDe(d,1,db,names);
  ok(v.backrowRival[0]?.code===3002,"la IA ricorda una backrow che aveva realmente visto");
}

if(fallos){ console.error("\n"+fallos+" regressione/i fallita/e"); process.exit(1); }
console.log("\nTutte le regressioni tattiche sono passate.");
