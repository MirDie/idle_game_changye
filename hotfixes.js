(function(){
'use strict';
const priorFinishCombat=finishCombat;
finishCombat=function(win){
  const c=state.combat;
  const worldWin=!!(win&&c&&c.enemy&&c.enemy.kind==='worldBoss');
  if(worldWin){
    c.enemy.kind='roamingBoss';
    c.enemy.rank=Math.max(c.enemy.rank||1,8.8);
    state.essence+=10;
  }
  priorFinishCombat(win);
  if(worldWin){
    dropLoot('regionBoss');
    toast('世界 Boss 已击败：额外获得 Boss 精华与高阶战利品');
  }
};
})();
