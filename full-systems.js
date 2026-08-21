(function(){
'use strict';

const SAVE_KEY='grid_idle_save_v2';
const BACKUP_KEY='grid_idle_save_v2_backup';
const MAX_OFFLINE_SECONDS=8*60*60;

state.meta=state.meta||{
  classId:'warrior',materials:{},potions:3,weather:'clear',achievements:{},stats:{bosses:0,elites:0,treasures:0,resources:0,totalGold:0,legendaries:0},lastSave:Date.now()
};

function markAchievement(id){
  if(state.meta.achievements[id]) return;
  const def=window.GameCatalog?.achievements?.find(a=>a.id===id);
  if(!def) return;
  state.meta.achievements[id]=Date.now();
  toast(`成就解锁：${def.name}`);
}

function auditAchievements(){
  if(state.kills>=1) markAchievement('first_blood');
  if(state.meta.stats.bosses>=1) markAchievement('boss_1');
  if(state.meta.stats.bosses>=25) markAchievement('boss_25');
  if(state.meta.stats.legendaries>=1) markAchievement('legendary_1');
  if(state.meta.stats.legendaries>=20) markAchievement('legendary_20');
  if(state.floor>=10) markAchievement('floor_10');
  if(state.floor>=50) markAchievement('floor_50');
  if(state.zoneIndex===7) markAchievement('zone_8');
  if(state.meta.stats.treasures>=50) markAchievement('treasure_50');
  if(state.meta.stats.elites>=100) markAchievement('elite_100');
  if(state.meta.stats.totalGold>=1000000) markAchievement('wealth_1m');
  if(state.player.level>=80) markAchievement('class_master');
}

function snapshot(){
  return {
    version:2, savedAt:Date.now(),
    floor:state.floor,zoneIndex:state.zoneIndex,gold:state.gold,essence:state.essence,kills:state.kills,
    player:{...state.player,equipment:{...state.player.equipment}},
    loot:state.loot.slice(0,80),
    meta:JSON.parse(JSON.stringify(state.meta))
  };
}

function saveGame(reason='auto'){
  try{
    const previous=localStorage.getItem(SAVE_KEY);
    if(previous) localStorage.setItem(BACKUP_KEY,previous);
    const data=snapshot(); data.reason=reason; data.meta.lastSave=data.savedAt;
    state.meta.lastSave=data.savedAt;
    localStorage.setItem(SAVE_KEY,JSON.stringify(data));
  }catch(e){ console.warn('save failed',e); }
}

function loadSaveObject(raw){
  const data=JSON.parse(raw);
  if(!data||data.version!==2||!data.player) throw new Error('invalid save');
  state.floor=Math.max(1,data.floor||1); state.zoneIndex=Math.max(0,data.zoneIndex||0)%ZONES.length;
  state.gold=Math.max(0,data.gold||0); state.essence=Math.max(0,data.essence||0); state.kills=Math.max(0,data.kills||0);
  Object.assign(state.player,data.player); state.player.equipment={...data.player.equipment};
  state.loot=Array.isArray(data.loot)?data.loot.slice(0,80):[];
  state.meta={...state.meta,...(data.meta||{}),materials:{...(data.meta?.materials||{})},achievements:{...(data.meta?.achievements||{})},stats:{...state.meta.stats,...(data.meta?.stats||{})}};
  return data;
}

function loadGame(){
  let data=null;
  try{ const raw=localStorage.getItem(SAVE_KEY); if(raw) data=loadSaveObject(raw); }
  catch(e){
    try{ const backup=localStorage.getItem(BACKUP_KEY); if(backup) data=loadSaveObject(backup); }
    catch(_){ data=null; }
  }
  if(data){
    const seconds=Math.min(MAX_OFFLINE_SECONDS,Math.max(0,Math.floor((Date.now()-(data.savedAt||Date.now()))/1000)));
    if(seconds>=30){
      const gold=Math.floor(seconds*(.22+state.floor*.055));
      const xp=Math.floor(seconds*(.05+state.floor*.012));
      state.gold+=gold; state.meta.stats.totalGold+=gold; grantXp(xp);
      const lootCount=Math.min(10,Math.floor(seconds/1200));
      for(let i=0;i<lootCount;i++) dropLoot('treasure');
      toast(`离线 ${Math.floor(seconds/60)} 分钟：+${gold} 金币${lootCount?`，${lootCount} 件装备`:''}`);
    }
  }
  return !!data;
}

const oldGenerateFloor=generateFloor;
generateFloor=function(){
  oldGenerateFloor();
  const empties=state.map.filter(t=>t.type==='empty'&&!t.visited);
  const takeEmpty=()=>{
    if(!empties.length) return null;
    const i=rand(0,empties.length-1); return empties.splice(i,1)[0];
  };
  const specials=[
    ['resource',3],['trap',1],['ambush',1],['nest',1],['camp',1]
  ];
  if(zoneDepth()>=4) specials.push(['merchant',1]);
  for(const [type,count] of specials){
    for(let i=0;i<count;i++){ const t=takeEmpty(); if(t) t.type=type; }
  }
  state.meta.weather=pick(window.GameCatalog?.weather||[{id:'clear'}]).id;
  renderAll();
  auditAchievements();
  saveGame('floor');
};

const oldTileIcon=tileIcon;
tileIcon=function(tile){
  const icons={resource:'◆',trap:'✕',ambush:'!',nest:'◉',merchant:'¤',camp:'⌂'};
  return icons[tile?.type]||oldTileIcon(tile);
};

const oldTilePriority=tilePriority;
tilePriority=function(tile){
  const extra={ambush:7.4,nest:7.2,merchant:6.6,resource:5.8,camp:4.8,trap:.2}[tile.type];
  if(extra!==undefined){
    let v=extra;
    if(state.strategy==='loot'&&['resource','nest','merchant'].includes(tile.type)) v+=5;
    if(state.strategy==='boss'&&tile.type==='nest') v+=3;
    return v+Math.random();
  }
  return oldTilePriority(tile);
};

const oldResolveTile=resolveTile;
resolveTile=function(tile){
  if(tile.cleared) return;
  if(tile.type==='resource'){
    tile.cleared=true; state.cleared.add(tile.index);
    const key=currentZone().id||`zone${state.zoneIndex}`;
    const amount=rand(2,5)+Math.floor(zoneDepth()/3);
    state.meta.materials[key]=(state.meta.materials[key]||0)+amount;
    state.meta.stats.resources++;
    floating(`区域材料 +${amount}`,'good'); toast(`采集 ${currentZone().name} 材料 ×${amount}`); saveGame('resource'); return;
  }
  if(tile.type==='trap'){
    tile.cleared=true; state.cleared.add(tile.index);
    const ps=playerStats(); const damage=Math.max(1,Math.round(ps.maxHp*(.08+.02*zoneDepth())));
    state.player.hp=Math.max(1,state.player.hp-damage); floating(`陷阱 -${damage} HP`,'bossfx'); return;
  }
  if(tile.type==='ambush'){
    toast('遭到精英伏击'); return startCombat(tile,'elite');
  }
  if(tile.type==='nest'){
    tile.nest=true; toast('发现怪物巢穴'); return startCombat(tile,'floorBoss');
  }
  if(tile.type==='camp'){
    tile.cleared=true; state.cleared.add(tile.index);
    const ps=playerStats(); state.player.hp=ps.maxHp; state.meta.potions=Math.min(9,(state.meta.potions||0)+1);
    floating('营地：完全恢复','good'); saveGame('camp'); return;
  }
  if(tile.type==='merchant'){
    tile.cleared=true; state.cleared.add(tile.index);
    const cost=Math.max(25,Math.floor(state.floor*35));
    if(state.gold>=cost){
      state.gold-=cost; dropLoot('treasure'); toast(`行商：${cost} 金币购得一件装备`);
    }else{
      toast(`行商报价 ${cost} 金币，本次未购买`);
    }
    saveGame('merchant'); return;
  }
  return oldResolveTile(tile);
};

const oldEnemyFor=enemyFor;
enemyFor=function(kind){
  const e=oldEnemyFor(kind), z=currentZone();
  if(kind==='elite'&&Array.isArray(z.elites)&&z.elites.length) e.name=pick(z.elites);
  if(kind==='roamingBoss'&&z.bosses?.length) e.name=pick(z.bosses);
  if(kind==='floorBoss'&&z.bosses?.length) e.name=pick(z.bosses);
  if(kind==='regionBoss'&&z.regionBoss) e.name=z.regionBoss;
  return e;
};

const oldDropLoot=dropLoot;
dropLoot=function(source){
  const before=state.loot.length;
  oldDropLoot(source);
  if(state.loot.length>before&&state.loot[0]?.rarity==='legendary') state.meta.stats.legendaries++;
  auditAchievements();
};

const oldFinishCombat=finishCombat;
finishCombat=function(win){
  const enemy=state.combat?.enemy;
  const goldBefore=state.gold;
  oldFinishCombat(win);
  if(win&&enemy){
    if(enemy.boss) state.meta.stats.bosses++;
    if(enemy.kind==='elite') state.meta.stats.elites++;
    state.meta.stats.totalGold+=Math.max(0,state.gold-goldBefore);
    auditAchievements(); saveGame(enemy.boss?'boss':'combat');
  }
};

const oldResolveForTreasure=oldResolveTile;
// Treasure statistic is derived from cleared treasure count after each movement.
let treasureSeen=0;
setInterval(()=>{
  const current=state.map.filter(t=>t.type==='treasure'&&t.cleared).length;
  if(current>treasureSeen){ state.meta.stats.treasures+=current-treasureSeen; treasureSeen=current; auditAchievements(); }
},1000);

window.GridIdleMeta={saveGame,loadGame,auditAchievements};

const restored=loadGame();
if(restored){
  const ps=playerStats(); state.player.hp=Math.min(ps.maxHp,Math.max(1,state.player.hp));
}
generateFloor();
setInterval(()=>saveGame('auto'),15000);
window.addEventListener('pagehide',()=>saveGame('pagehide'));
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='hidden') saveGame('hidden'); });
})();
