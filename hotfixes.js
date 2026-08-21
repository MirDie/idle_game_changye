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

if(window.AdvancedGame?.selectClass){
  const priorSelectClass=window.AdvancedGame.selectClass;
  window.AdvancedGame.selectClass=function(id){
    const level=Math.max(1,state.player.level||1);
    const ok=priorSelectClass(id);
    if(!ok) return false;
    const c=window.GameCatalog?.classes?.find(x=>x.id===id);
    if(c){
      state.player.maxHp=c.base.hp+(level-1)*8;
      state.player.hp=playerStats().maxHp;
      window.GridIdleMeta?.saveGame?.('class');
      renderAll();
    }
    return true;
  };
}
})();
