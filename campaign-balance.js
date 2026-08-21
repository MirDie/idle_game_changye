(function(){
'use strict';

const MAX_RESOLVE=8;

// CampaignStability already gives resolve for required encounters. Extend the
// same protection to ordinary/elite losses so a bad early loot path can never
// permanently strand a fresh save.
const priorFinishCombat=finishCombat;
finishCombat=function(win){
  const before=Math.max(0,Math.min(MAX_RESOLVE,Number(state.meta.resolveStacks)||0));
  priorFinishCombat(win);
  if(!win){
    const after=Math.max(0,Math.min(MAX_RESOLVE,Number(state.meta.resolveStacks)||0));
    state.meta.resolveStacks=Math.min(MAX_RESOLVE,Math.max(after,before+1));
    const p=playerStats();
    state.player.hp=Math.max(state.player.hp,Math.round(p.maxHp*.78));
    window.GridIdleMeta?.saveGame?.('loss-protection');
  }
};

// Make the bounded failure protection strong enough to guarantee eventual
// forward progress without changing normal first-attempt combat balance.
const priorPlayerStats=playerStats;
playerStats=function(){
  const p=priorPlayerStats();
  const s=Math.max(0,Math.min(MAX_RESOLVE,Number(state.meta.resolveStacks)||0));
  if(!s) return p;

  // CampaignStability already applied 10/6/4% per stack. Scale that result to
  // an effective 18/10/7% per stack instead of stacking the full bonus twice.
  p.attack=Math.round(p.attack*((1+s*.18)/(1+s*.10)));
  p.defense=Math.round(p.defense*((1+s*.10)/(1+s*.06)));
  p.maxHp=Math.round(p.maxHp*((1+s*.07)/(1+s*.04)));
  p.power=Math.round(p.power*((1+s*.14)/(1+s*.085)));
  return p;
};

window.CampaignBalance={maxResolve:MAX_RESOLVE};
})();
