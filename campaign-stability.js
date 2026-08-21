(function(){
'use strict';

const SAVE_KEY='grid_idle_save_v3';
const BACKUP_KEY='grid_idle_save_v3_backup';
const VERSION=3;
const MAX_OFFLINE_SECONDS=8*60*60;
const AUTO_SAVE_MS=10000;

state.meta=state.meta||{};
state.meta.resolveStacks=Math.max(0,Math.min(8,Number(state.meta.resolveStacks)||0));
state.meta.campaignVersion=VERSION;
state.meta.transitioning=false;

const legacyMeta=window.GridIdleMeta||{};
const legacySave=typeof legacyMeta.saveGame==='function'?legacyMeta.saveGame.bind(legacyMeta):null;
const legacyLoad=typeof legacyMeta.loadGame==='function'?legacyMeta.loadGame.bind(legacyMeta):null;

function clone(value){ return JSON.parse(JSON.stringify(value)); }

function canonicalZoneIndex(floor){
  return Math.floor((Math.max(1,Number(floor)||1)-1)/10)%Math.max(1,ZONES.length);
}

function sanitizeMap(raw){
  if(!Array.isArray(raw)||raw.length!==FLOOR_TILES) return null;
  const seen=new Set();
  const out=[];
  for(let i=0;i<raw.length;i++){
    const t=raw[i];
    if(!t||typeof t!=='object') return null;
    const index=Number.isInteger(t.index)?t.index:i;
    if(index<0||index>=FLOOR_TILES||seen.has(index)) return null;
    seen.add(index);
    out[index]={...clone(t),index};
  }
  return out.length===FLOOR_TILES?out:null;
}

function repairFloorState(){
  state.floor=Math.max(1,Math.floor(Number(state.floor)||1));
  state.zoneIndex=canonicalZoneIndex(state.floor);
  state.gold=Math.max(0,Number(state.gold)||0);
  state.essence=Math.max(0,Number(state.essence)||0);
  state.kills=Math.max(0,Math.floor(Number(state.kills)||0));
  state.meta=state.meta||{};
  state.meta.stats=state.meta.stats||{bosses:0,elites:0,treasures:0,resources:0,totalGold:0,legendaries:0};
  state.meta.materials=state.meta.materials||{};
  state.meta.achievements=state.meta.achievements||{};
  state.meta.resolveStacks=Math.max(0,Math.min(8,Number(state.meta.resolveStacks)||0));
  state.meta.campaignVersion=VERSION;

  if(!Array.isArray(state.map)||state.map.length!==FLOOR_TILES) return false;
  if(!Number.isInteger(state.playerIndex)||state.playerIndex<0||state.playerIndex>=FLOOR_TILES) state.playerIndex=0;
  state.explored=state.explored instanceof Set?state.explored:new Set();
  state.cleared=state.cleared instanceof Set?state.cleared:new Set();

  const coreBoss=state.map.find(t=>t&&['floorBoss','regionBoss'].includes(t.type));
  if(coreBoss) state.floorBossIndex=coreBoss.index;
  const exit=state.map.find(t=>t&&t.type==='exit');
  if(exit) state.exitIndex=exit.index;

  if(state.floorBossDefeated){
    state.meta.guardDefeated=true;
    if(exit) exit.locked=false;
  }else if(exit){
    exit.locked=true;
  }

  if(!state.floorBossDefeated&&coreBoss&&!coreBoss.cleared){
    const hasUnvisited=state.map.some(t=>t&&!t.visited&&!t.cleared);
    if(!hasUnvisited) coreBoss.visited=false;
  }
  if(!state.meta.guardDefeated){
    const guard=state.map.find(t=>t&&(t.type==='bossGuard'||t.guard)&&!t.cleared);
    if(guard){
      const hasOtherUnvisited=state.map.some(t=>t&&!t.visited&&!t.cleared&&t.index!==coreBoss?.index);
      if(!hasOtherUnvisited) guard.visited=false;
    }
  }
  return true;
}

function snapshot(reason='auto'){
  const map=Array.isArray(state.map)?state.map.map(t=>clone(t)):[];
  const pendingCombatTile=state.combat&&Number.isInteger(state.combat.tileIndex)?state.combat.tileIndex:-1;
  if(pendingCombatTile>=0&&map[pendingCombatTile]){
    map[pendingCombatTile].visited=false;
    map[pendingCombatTile].cleared=false;
  }
  return {
    version:VERSION,
    reason,
    savedAt:Date.now(),
    floor:state.floor,
    zoneIndex:canonicalZoneIndex(state.floor),
    gold:state.gold,
    essence:state.essence,
    kills:state.kills,
    player:clone(state.player),
    loot:clone((state.loot||[]).slice(0,80)),
    meta:clone(state.meta),
    runtime:{
      map,
      playerIndex:state.playerIndex,
      explored:[...(state.explored||[])],
      cleared:[...(state.cleared||[])],
      foundExit:!!state.foundExit,
      exitIndex:state.exitIndex,
      floorBossIndex:state.floorBossIndex,
      floorBossDefeated:!!state.floorBossDefeated,
      bossesDefeated:Number(state.bossesDefeated)||0,
      bossesTotal:Number(state.bossesTotal)||1,
      strategy:state.strategy||'balanced',
      speed:[1,2,4].includes(Number(state.speed))?Number(state.speed):1,
      pendingCombatTile
    }
  };
}

function writeStable(reason='auto'){
  try{
    repairFloorState();
    const previous=localStorage.getItem(SAVE_KEY);
    if(previous) localStorage.setItem(BACKUP_KEY,previous);
    const data=snapshot(reason);
    state.meta.lastSave=data.savedAt;
    localStorage.setItem(SAVE_KEY,JSON.stringify(data));
    return true;
  }catch(e){
    console.warn('stable save failed',e);
    return false;
  }
}

function parseStable(raw){
  const data=JSON.parse(raw);
  if(!data||data.version!==VERSION||!data.player||!data.runtime) throw new Error('invalid v3 save');
  const map=sanitizeMap(data.runtime.map);
  if(!map) throw new Error('invalid floor map');
  return {...data,runtime:{...data.runtime,map}};
}

function readStable(){
  const primary=localStorage.getItem(SAVE_KEY);
  if(primary){
    try{return parseStable(primary);}catch(e){console.warn('primary v3 save invalid',e);}
  }
  const backup=localStorage.getItem(BACKUP_KEY);
  if(backup){
    try{return parseStable(backup);}catch(e){console.warn('backup v3 save invalid',e);}
  }
  return null;
}

function applyStable(data){
  state.floor=Math.max(1,Math.floor(Number(data.floor)||1));
  state.zoneIndex=canonicalZoneIndex(state.floor);
  state.gold=Math.max(0,Number(data.gold)||0);
  state.essence=Math.max(0,Number(data.essence)||0);
  state.kills=Math.max(0,Math.floor(Number(data.kills)||0));
  Object.assign(state.player,clone(data.player));
  state.player.equipment={...(data.player.equipment||{})};
  state.loot=Array.isArray(data.loot)?clone(data.loot.slice(0,80)):[];
  const currentStats=state.meta?.stats||{};
  state.meta={
    ...(state.meta||{}),
    ...(clone(data.meta||{})),
    materials:{...(data.meta?.materials||{})},
    achievements:{...(data.meta?.achievements||{})},
    stats:{...currentStats,...(data.meta?.stats||{})}
  };
  state.meta.campaignVersion=VERSION;
  state.meta.transitioning=false;

  const r=data.runtime;
  state.map=r.map.map(t=>({...t}));
  state.playerIndex=Number.isInteger(r.playerIndex)?r.playerIndex:0;
  state.explored=new Set((r.explored||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<FLOOR_TILES));
  state.cleared=new Set((r.cleared||[]).filter(i=>Number.isInteger(i)&&i>=0&&i<FLOOR_TILES));
  state.foundExit=!!r.foundExit;
  state.exitIndex=Number.isInteger(r.exitIndex)?r.exitIndex:-1;
  state.floorBossIndex=Number.isInteger(r.floorBossIndex)?r.floorBossIndex:-1;
  state.floorBossDefeated=!!r.floorBossDefeated;
  state.bossesDefeated=Math.max(0,Number(r.bossesDefeated)||0);
  state.bossesTotal=Math.max(1,Number(r.bossesTotal)||1);
  state.strategy=['balanced','boss','loot'].includes(r.strategy)?r.strategy:'balanced';
  state.speed=[1,2,4].includes(Number(r.speed))?Number(r.speed):1;
  state.combat=null;
  state.nextCombatAt=0;
  state.nextMoveAt=performance.now()+250;

  if(Number.isInteger(r.pendingCombatTile)&&r.pendingCombatTile>=0&&state.map[r.pendingCombatTile]){
    state.map[r.pendingCombatTile].visited=false;
    state.map[r.pendingCombatTile].cleared=false;
    state.cleared.delete(r.pendingCombatTile);
  }
  repairFloorState();
}

function settleOffline(savedAt){
  const seconds=Math.min(MAX_OFFLINE_SECONDS,Math.max(0,Math.floor((Date.now()-(Number(savedAt)||Date.now()))/1000)));
  if(seconds<30) return null;
  const gold=Math.floor(seconds*(.22+state.floor*.055));
  const xp=Math.floor(seconds*(.05+state.floor*.012));
  state.gold+=gold;
  state.meta.stats.totalGold=(state.meta.stats.totalGold||0)+gold;
  grantXp(xp);
  const lootCount=Math.min(10,Math.floor(seconds/1200));
  for(let i=0;i<lootCount;i++) dropLoot('treasure');
  state.meta.lastOffline={seconds,gold,xp,lootCount,at:Date.now()};
  toast(`离线 ${Math.floor(seconds/60)} 分钟：+${gold} 金币${lootCount?`，${lootCount} 件装备`:''}`);
  return state.meta.lastOffline;
}

function restoreStable(options={offline:true}){
  const data=readStable();
  if(!data) return false;
  applyStable(data);
  if(options.offline!==false) settleOffline(data.savedAt);
  const ps=playerStats();
  state.player.hp=Math.min(ps.maxHp,Math.max(1,Number(state.player.hp)||1));
  renderAll();
  writeStable(options.offline===false?'reload':'resume');
  return true;
}

window.GridIdleMeta=window.GridIdleMeta||{};
window.GridIdleMeta.saveGame=function(reason='manual'){
  try{ if(legacySave) legacySave(reason); }catch(e){ console.warn('legacy save failed',e); }
  return writeStable(reason);
};
window.GridIdleMeta.loadGame=function(){
  if(restoreStable()) return true;
  return legacyLoad?!!legacyLoad():false;
};
window.GridIdleMeta.snapshotV3=snapshot;
window.GridIdleMeta.restoreV3=restoreStable;
window.GridIdleMeta.SAVE_KEY_V3=SAVE_KEY;

const priorGenerateFloor=generateFloor;
generateFloor=function(){
  const previousFloor=state.floor;
  priorGenerateFloor();
  state.meta.transitioning=false;
  state.meta.resolveStacks=0;
  state.meta.floorKey=`${state.zoneIndex}:${state.floor}`;
  repairFloorState();
  writeStable(previousFloor===state.floor?'floor-ready':'floor-transition');
};

const priorPlayerStats=playerStats;
playerStats=function(){
  const p=priorPlayerStats();
  const stacks=Math.max(0,Math.min(8,Number(state.meta.resolveStacks)||0));
  if(stacks>0){
    p.attack=Math.round(p.attack*(1+stacks*.10));
    p.defense=Math.round(p.defense*(1+stacks*.06));
    p.maxHp=Math.round(p.maxHp*(1+stacks*.04));
    p.power=Math.round(p.power*(1+stacks*.085));
  }
  return p;
};

const priorFinishCombat=finishCombat;
finishCombat=function(win){
  const combat=state.combat;
  const tileIndex=combat&&Number.isInteger(combat.tileIndex)?combat.tileIndex:-1;
  const tile=tileIndex>=0?state.map[tileIndex]:null;
  const kind=combat?.enemy?.kind;
  const required=!!(combat?.enemy?.boss||combat?.enemy?.guard||tile?.guard||['floorBoss','regionBoss','bossGuard'].includes(tile?.type));
  priorFinishCombat(win);

  if(!win&&tile){
    tile.cleared=false;
    tile.visited=false;
    state.cleared.delete(tileIndex);
    if(required){
      state.meta.resolveStacks=Math.min(8,(Number(state.meta.resolveStacks)||0)+1);
      const p=playerStats();
      state.player.hp=Math.max(state.player.hp,Math.round(p.maxHp*.75));
      toast(`远征意志 +1：下次关键战斗获得临时强化 (${state.meta.resolveStacks}/8)`);
    }
    state.nextMoveAt=performance.now()+800;
    writeStable('combat-retry');
  }else if(win&&required){
    if(kind==='floorBoss'||kind==='regionBoss') state.meta.resolveStacks=0;
    writeStable('required-win');
  }
};

const priorEnterExit=enterExit;
enterExit=function(){
  if(state.meta.transitioning) return;
  const beforeFloor=state.floor;
  const beforeZone=state.zoneIndex;
  state.meta.transitioning=true;
  priorEnterExit();

  if(state.floor===beforeFloor&&state.zoneIndex===beforeZone){
    state.meta.transitioning=false;
    writeStable(state.meta.completed?'ending':'exit-blocked');
    return;
  }
  setTimeout(()=>{
    state.meta.transitioning=false;
    repairFloorState();
    writeStable('entered-floor');
  },420);
};

function watchdog(){
  if(!state.running||state.combat||state.meta.transitioning) return;
  if(!Array.isArray(state.map)||state.map.length!==FLOOR_TILES) return;

  repairFloorState();
  if(state.floorBossDefeated){
    const anyUnvisited=state.map.some(t=>t&&!t.visited&&!t.cleared);
    if(!anyUnvisited){ enterExit(); return; }
  }

  if(!state.floorBossDefeated){
    const guard=state.map.find(t=>t&&(t.type==='bossGuard'||t.guard)&&!t.cleared);
    const core=state.map.find(t=>t&&['floorBoss','regionBoss'].includes(t.type)&&!t.cleared);
    const anyUnvisited=state.map.some(t=>t&&!t.visited&&!t.cleared);
    if(!anyUnvisited){
      if(guard&&!state.meta.guardDefeated) guard.visited=false;
      else if(core) core.visited=false;
    }
  }
}

const restored=restoreStable();
if(!restored){
  repairFloorState();
  writeStable('migrate-v3');
}

setInterval(()=>writeStable('auto-v3'),AUTO_SAVE_MS);
setInterval(watchdog,2500);
window.addEventListener('pagehide',()=>writeStable('pagehide-v3'));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')writeStable('hidden-v3');});

if(state.meta.completed&&state.floor===80&&state.zoneIndex===ZONES.length-1){
  state.running=false;
  setTimeout(()=>window.AdvancedUI?.showEnding?.(),0);
}

window.CampaignStability={
  version:VERSION,
  snapshot,
  restore:restoreStable,
  save:writeStable,
  repair:repairFloorState,
  watchdog,
  canonicalZoneIndex
};
})();
