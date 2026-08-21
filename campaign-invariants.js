(function(){
'use strict';

let lastProgressKey='';
let stagnantTicks=0;

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

function liveGuard(){
  return state.map?.find(t=>t&&(t.type==='bossGuard'||t.guard)&&!t.cleared)||null;
}

function ensureCoreBossReachable(){
  if(!Array.isArray(state.map)||state.floorBossDefeated) return false;
  const core=state.map.find(t=>isCoreBoss(t)&&!t.cleared);
  if(!core) return false;
  const guard=liveGuard();
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
  if(state.meta.guardDefeated||!liveGuard()) state.meta.seekingGuard=false;
  changed=ensureCoreBossReachable()||changed;
  changed=ensureExitConsistency()||changed;
  if(changed){
    renderAll();
    if(save) window.GridIdleMeta?.saveGame?.('campaign-invariant');
  }
  return changed;
}

function progressKey(){
  return [
    state.floor,state.zoneIndex,state.playerIndex,
    state.explored?.size||0,state.cleared?.size||0,
    state.floorBossDefeated?1:0,state.meta.guardDefeated?1:0,
    state.meta.seekingGuard?1:0,state.combat?1:0,state.meta.transitioning?1:0
  ].join('|');
}

function diagnostic(){
  const current=state.map?.[state.playerIndex];
  const guard=liveGuard();
  const core=state.map?.find(t=>isCoreBoss(t)&&!t.cleared);
  const exit=state.map?.find(t=>t&&t.type==='exit');
  const pending=(state.map||[]).filter(t=>t&&!t.cleared&&!t.visited).map(t=>`${t.index}:${t.type}`);
  return {
    floor:state.floor,zoneIndex:state.zoneIndex,running:state.running,transitioning:!!state.meta.transitioning,
    seekingGuard:!!state.meta.seekingGuard,
    playerIndex:state.playerIndex,current:current&&{index:current.index,type:current.type,visited:!!current.visited,cleared:!!current.cleared},
    guardDefeated:!!state.meta.guardDefeated,guard:guard&&{index:guard.index,type:guard.type,visited:!!guard.visited,cleared:!!guard.cleared},
    floorBossDefeated:!!state.floorBossDefeated,core:core&&{index:core.index,type:core.type,visited:!!core.visited,cleared:!!core.cleared},
    exit:exit&&{index:exit.index,visited:!!exit.visited,cleared:!!exit.cleared,locked:!!exit.locked},pending
  };
}

function stepToward(from,to){
  const fr=Math.floor(from/SIZE),fc=from%SIZE;
  const tr=Math.floor(to/SIZE),tc=to%SIZE;
  if(fr<tr) return from+SIZE;
  if(fr>tr) return from-SIZE;
  if(fc<tc) return from+1;
  if(fc>tc) return from-1;
  return from;
}

function moveInto(index){
  if(!Number.isInteger(index)||index<0||index>=state.map.length) return false;
  state.playerIndex=index;
  const tile=state.map[index];
  if(!tile.visited){
    tile.visited=true;
    state.explored.add(index);
    revealAround(index);
    resolveTile(tile);
  }
  renderAll();
  return true;
}

function recoverStall(){
  if(!state.running||state.combat||!Array.isArray(state.map)) return false;
  let changed=false;

  if(state.meta.transitioning){
    state.meta.transitioning=false;
    changed=true;
  }

  if(state.floorBossDefeated){
    const exit=state.map.find(t=>t&&t.type==='exit');
    if(exit) exit.locked=false;
    state.meta.transitioning=false;
    enterExit();
    return true;
  }

  if(!state.meta.guardDefeated){
    ensureRequiredGuard();
    const guard=liveGuard();
    if(guard){
      state.meta.seekingGuard=true;
      guard.visited=false;
      guard.cleared=false;
      state.cleared.delete(guard.index);
      if(state.playerIndex===guard.index){
        guard.visited=true;
        resolveTile(guard);
      }
      changed=true;
    }
  }else{
    state.meta.seekingGuard=false;
    const core=state.map.find(t=>isCoreBoss(t)&&!t.cleared);
    if(core){
      core.visited=false;
      core.cleared=false;
      state.cleared.delete(core.index);
      if(state.playerIndex===core.index){
        core.visited=true;
        resolveTile(core);
      }
      changed=true;
    }
  }

  if(changed){
    renderAll();
    window.GridIdleMeta?.saveGame?.('stall-recovery');
  }
  return changed;
}

function observeProgress(){
  if(!state.running||state.combat){
    stagnantTicks=0;
    lastProgressKey=progressKey();
    return;
  }
  const key=progressKey();
  if(key===lastProgressKey) stagnantTicks++;
  else { lastProgressKey=key; stagnantTicks=0; }

  if(stagnantTicks===12){
    console.warn('campaign stall detected',JSON.stringify(diagnostic()));
    recoverStall();
  }else if(stagnantTicks>0&&stagnantTicks%24===0){
    console.warn('campaign stall persists',JSON.stringify(diagnostic()));
    recoverStall();
  }
}

const priorGenerateFloor=generateFloor;
generateFloor=function(){
  priorGenerateFloor();
  state.meta.seekingGuard=false;
  stagnantTicks=0;
  lastProgressKey='';
  enforce(true);
};

const priorMoveOne=moveOne;
moveOne=function(){
  if(!state.combat&&state.running&&Array.isArray(state.map)){
    if(state.meta.guardDefeated) state.meta.seekingGuard=false;
    let guard=liveGuard();
    const current=state.map[state.playerIndex];

    if(current&&!current.cleared&&!current.visited&&isCoreBoss(current)&&!state.meta.guardDefeated){
      ensureRequiredGuard();
      guard=liveGuard();
      state.meta.seekingGuard=!!guard;
    }

    if(state.meta.seekingGuard&&guard&&!state.meta.guardDefeated){
      if(state.playerIndex===guard.index){
        if(!guard.visited){
          guard.visited=true;
          state.explored.add(guard.index);
          revealAround(guard.index);
        }
        resolveTile(guard);
        renderAll();
        return;
      }
      return moveInto(stepToward(state.playerIndex,guard.index));
    }

    if(current&&!current.cleared&&!current.visited){
      const lockedCore=isCoreBoss(current)&&!state.meta.guardDefeated;
      if(!lockedCore){
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

const priorFinishCombat=finishCombat;
finishCombat=function(win){
  const wasGuard=!!(state.combat?.enemy?.guard||state.map?.[state.combat?.tileIndex]?.guard);
  priorFinishCombat(win);
  if(win&&wasGuard){
    state.meta.seekingGuard=false;
    window.GridIdleMeta?.saveGame?.('guard-cleared');
  }
};

const priorWatchdog=window.CampaignStability?.watchdog;
if(window.CampaignStability){
  window.CampaignStability.watchdog=function(){
    enforce(false);
    if(typeof priorWatchdog==='function') priorWatchdog();
    enforce(false);
    observeProgress();
  };
}

// Repair the already-restored/generated floor on boot, including old saves
// created before the mandatory guard invariant existed.
enforce(true);
setInterval(()=>{
  enforce(false);
  observeProgress();
},2000);

window.CampaignInvariants={
  enforce,
  recoverStall,
  diagnostic,
  ensureRequiredGuard,
  ensureCoreBossReachable,
  ensureExitConsistency
};
})();
