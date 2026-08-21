(function(){
'use strict';

function isCoreBoss(tile){
  return !!tile&&['floorBoss','regionBoss'].includes(tile.type);
}

function ensureRequiredGuard(){
  if(!Array.isArray(state.map)||state.map.length!==FLOOR_TILES) return false;
  if(state.floorBossDefeated||state.meta.guardDefeated) return false;
  if(state.map.some(t=>t&&(t.type==='bossGuard'||t.guard)&&!t.cleared)) return false;

  const protectedTypes=new Set(['start','exit','floorBoss','regionBoss','worldBoss']);
  const preference=['empty','trap','resource','heal','shrine','merchant','treasure','monster','elite','rare','ambush','nest'];
  let candidate=null;

  for(const type of preference){
    candidate=state.map.find(t=>t&&!protectedTypes.has(t.type)&&t.type===type&&!t.cleared&&!t.visited);
    if(candidate) break;
  }
  if(!candidate){
    for(const type of preference){
      candidate=state.map.find(t=>t&&!protectedTypes.has(t.type)&&t.type===type&&!t.cleared);
      if(candidate) break;
    }
  }
  if(!candidate){
    candidate=state.map.find(t=>t&&!protectedTypes.has(t.type)&&!t.cleared)||null;
  }
  if(!candidate) return false;

  candidate.type='bossGuard';
  candidate.guard=true;
  candidate.cleared=false;
  candidate.visited=false;
  candidate.locked=false;
  state.cleared.delete(candidate.index);
  if(candidate.revealed===undefined) candidate.revealed=false;
  state.meta.guardInjected=true;
  return true;
}

function ensureCoreBossReachable(){
  if(!Array.isArray(state.map)||state.floorBossDefeated) return false;
  const core=state.map.find(t=>isCoreBoss(t)&&!t.cleared);
  if(!core) return false;
  const guard=state.map.find(t=>t&&(t.type==='bossGuard'||t.guard)&&!t.cleared);
  if(guard&&!state.meta.guardDefeated) return false;

  const hasFrontier=state.map.some(t=>t&&!t.visited&&!t.cleared&&t.index!==core.index);
  if(!hasFrontier&&core.visited){
    core.visited=false;
    state.cleared.delete(core.index);
    return true;
  }
  return false;
}

function ensureExitConsistency(){
  if(!Array.isArray(state.map)) return false;
  const exit=state.map.find(t=>t&&t.type==='exit');
  if(!exit) return false;
  const shouldLock=!state.floorBossDefeated;
  if(!!exit.locked!==shouldLock){
    exit.locked=shouldLock;
    return true;
  }
  return false;
}

function enforce(save=true){
  let changed=false;
  changed=ensureRequiredGuard()||changed;
  changed=ensureCoreBossReachable()||changed;
  changed=ensureExitConsistency()||changed;
  if(changed){
    renderAll();
    if(save) window.GridIdleMeta?.saveGame?.('campaign-invariant');
  }
  return changed;
}

const priorGenerateFloor=generateFloor;
generateFloor=function(){
  priorGenerateFloor();
  enforce(true);
};

const priorMoveOne=moveOne;
moveOne=function(){
  if(!state.combat&&state.running&&Array.isArray(state.map)){
    const current=state.map[state.playerIndex];
    if(current&&!current.cleared&&!current.visited){
      const coreReady=isCoreBoss(current)&&state.meta.guardDefeated;
      const guardReady=current.type==='bossGuard'||current.guard;
      if(coreReady||guardReady){
        current.visited=true;
        state.explored.add(current.index);
        revealAround(current.index);
        resolveTile(current);
        renderAll();
        return;
      }
    }
  }
  return priorMoveOne();
};

const priorWatchdog=window.CampaignStability?.watchdog;
if(window.CampaignStability){
  window.CampaignStability.watchdog=function(){
    enforce(false);
    if(typeof priorWatchdog==='function') priorWatchdog();
    enforce(false);
  };
}

// Repair the already-restored/generated floor on boot, including old saves
// created before the mandatory guard invariant existed.
enforce(true);
setInterval(()=>enforce(false),2000);

window.CampaignInvariants={
  enforce,
  ensureRequiredGuard,
  ensureCoreBossReachable,
  ensureExitConsistency
};
})();
