(function(){
'use strict';

state.meta.talents=state.meta.talents||{};
state.meta.talentPoints=state.meta.talentPoints||0;
state.meta.reforgeTokens=state.meta.reforgeTokens||0;
state.meta.combatStrategy=state.meta.combatStrategy||'balanced';
state.meta.guardDefeated=!!state.meta.guardDefeated;
state.meta.completed=!!state.meta.completed;
state.meta.endings=state.meta.endings||0;
state.meta.totalPlayStartedAt=state.meta.totalPlayStartedAt||Date.now();

const CLASS_ICONS={warrior:'⚔',rogue:'◆',mage:'✦',cleric:'✚',ranger:'➶'};
const TALENT_RULES={
  warrior:[
    {name:'盾击',max:5,desc:'防御 +5%/级',stat:'defensePct',per:.05},
    {name:'裂甲斩',max:5,desc:'技能伤害 +12%/级',stat:'skillDamage',per:.12},
    {name:'战斗怒吼',max:3,desc:'攻击 +6%/级',stat:'attackPct',per:.06},
    {name:'旋风斩',max:5,desc:'普攻有 3%/级概率追加一击',stat:'doubleHit',per:.03},
    {name:'复仇',max:3,desc:'受到 Boss 伤害后提高伤害',stat:'revenge',per:.08},
    {name:'钢铁意志',max:1,desc:'每层首次致死伤害保留 1 HP',stat:'cheatDeath',per:1}
  ],
  rogue:[
    {name:'影袭',max:5,desc:'暴击率 +2%/级',stat:'crit',per:.02},
    {name:'毒刃',max:5,desc:'技能附加毒伤 +10%/级',stat:'poison',per:.10},
    {name:'伏击',max:3,desc:'战斗前 3 秒伤害 +15%/级',stat:'opener',per:.15},
    {name:'割裂',max:5,desc:'Boss 伤害 +7%/级',stat:'bossDamage',per:.07},
    {name:'烟幕',max:3,desc:'闪避 +4%/级',stat:'dodge',per:.04},
    {name:'处决',max:1,desc:'20% 生命以下造成双倍伤害',stat:'execute',per:1}
  ],
  mage:[
    {name:'火球术',max:5,desc:'技能伤害 +14%/级',stat:'skillDamage',per:.14},
    {name:'寒冰箭',max:5,desc:'Boss 攻击速度 -3%/级',stat:'slow',per:.03},
    {name:'奥术飞弹',max:3,desc:'技能有 8%/级概率重复',stat:'echo',per:.08},
    {name:'灼烧',max:5,desc:'普攻伤害 +5%/级',stat:'attackPct',per:.05},
    {name:'冰障',max:3,desc:'每场战斗获得 8%/级生命护盾',stat:'shield',per:.08},
    {name:'陨石',max:1,desc:'Boss 每 8 秒受到一次大伤害',stat:'meteor',per:1}
  ],
  cleric:[
    {name:'惩击',max:5,desc:'攻击 +5%/级',stat:'attackPct',per:.05},
    {name:'圣光术',max:5,desc:'技能触发时恢复 2%/级生命',stat:'heal',per:.02},
    {name:'祝福',max:3,desc:'经验获取 +10%/级',stat:'xpGain',per:.10},
    {name:'神圣护盾',max:3,desc:'受到伤害 -5%/级',stat:'damageReduction',per:.05},
    {name:'审判',max:5,desc:'对精英/Boss伤害 +6%/级',stat:'bossDamage',per:.06},
    {name:'复苏',max:1,desc:'每层首次死亡恢复 35%生命',stat:'cheatDeath',per:1}
  ],
  ranger:[
    {name:'速射',max:5,desc:'攻速 +4%/级',stat:'haste',per:.04},
    {name:'穿透箭',max:5,desc:'忽略防御 +6%/级',stat:'armorPen',per:.06},
    {name:'猎人印记',max:5,desc:'Boss 伤害 +6%/级',stat:'bossDamage',per:.06},
    {name:'多重射击',max:3,desc:'技能追加伤害 +18%/级',stat:'skillDamage',per:.18},
    {name:'翻滚',max:3,desc:'闪避 +4%/级',stat:'dodge',per:.04},
    {name:'鹰眼',max:1,desc:'暴击伤害提高 50%',stat:'critDamage',per:.50}
  ]
};

function classDef(){ return window.GameCatalog?.classes?.find(c=>c.id===state.meta.classId)||window.GameCatalog?.classes?.[0]; }
function talentList(){ return TALENT_RULES[state.meta.classId]||TALENT_RULES.warrior; }
function talentLevel(index){ return state.meta.talents[state.meta.classId]?.[index]||0; }
function talentValue(stat){
  let v=0;
  talentList().forEach((t,i)=>{ if(t.stat===stat) v+=talentLevel(i)*t.per; });
  return v;
}
function spendTalent(index){
  const list=talentList(), t=list[index]; if(!t||state.meta.talentPoints<=0) return false;
  state.meta.talents[state.meta.classId]=state.meta.talents[state.meta.classId]||{};
  const cur=state.meta.talents[state.meta.classId][index]||0;
  if(cur>=t.max) return false;
  state.meta.talents[state.meta.classId][index]=cur+1; state.meta.talentPoints--;
  window.GridIdleMeta?.saveGame?.('talent'); return true;
}
function autoSpendTalent(){
  let guard=50;
  while(state.meta.talentPoints>0&&guard-->0){
    const list=talentList();
    const open=list.map((t,i)=>({t,i,l:talentLevel(i)})).filter(x=>x.l<x.t.max);
    if(!open.length) break;
    open.sort((a,b)=>((b.t.stat==='attackPct'||b.t.stat==='skillDamage'||b.t.stat==='bossDamage')?2:1)-((a.t.stat==='attackPct'||a.t.stat==='skillDamage'||a.t.stat==='bossDamage')?2:1));
    if(!spendTalent(open[0].i)) break;
  }
}

function selectClass(id){
  const c=window.GameCatalog?.classes?.find(x=>x.id===id); if(!c) return false;
  state.meta.classId=id;
  state.meta.talents[id]=state.meta.talents[id]||{};
  state.player.maxHp=c.base.hp; state.player.baseAttack=c.base.attack; state.player.baseDefense=c.base.defense;
  state.player.hp=playerStats().maxHp;
  const icon=document.getElementById('heroIcon'); if(icon) icon.textContent=CLASS_ICONS[id]||'⚔';
  window.GridIdleMeta?.saveGame?.('class'); renderAll(); return true;
}

const oldPlayerStats=playerStats;
playerStats=function(){
  const p=oldPlayerStats();
  const c=classDef();
  p.attack=Math.round(p.attack*(1+talentValue('attackPct')));
  p.defense=Math.round(p.defense*(1+talentValue('defensePct')));
  p.crit=clamp(p.crit+talentValue('crit'),.05,.75);
  p.haste=clamp(p.haste+talentValue('haste'),1,2.6);
  p.dodge=clamp(talentValue('dodge')+(c?.id==='rogue'?.04:0),0,.45);
  p.damageReduction=clamp(talentValue('damageReduction'),0,.45);
  p.bossDamage=talentValue('bossDamage');
  p.skillDamage=talentValue('skillDamage');
  p.armorPen=talentValue('armorPen');
  p.critDamage=1.8+talentValue('critDamage');
  p.power=Math.round(p.power*(1+talentValue('attackPct')*.7+talentValue('defensePct')*.35)+p.bossDamage*100+p.skillDamage*65);
  return p;
};

const oldGrantXp=grantXp;
grantXp=function(amount){
  const before=state.player.level;
  const xpBonus=talentValue('xpGain');
  oldGrantXp(Math.round(amount*(1+xpBonus)));
  const gained=state.player.level-before;
  if(gained>0){ state.meta.talentPoints+=gained; autoSpendTalent(); }
};

const oldGenerateFloor2=generateFloor;
generateFloor=function(){
  state.meta.guardDefeated=false;
  state.meta.cheatDeathUsed=false;
  oldGenerateFloor2();
  const empties=state.map.filter(t=>t.type==='empty'&&!t.visited);
  const take=()=>{ if(!empties.length)return null; return empties.splice(rand(0,empties.length-1),1)[0]; };
  const rare=take(); if(rare) rare.type='rare';
  const guard=take(); if(guard){ guard.type='bossGuard'; guard.guard=true; }
  if(zoneDepth()>=6){ const worldBoss=take(); if(worldBoss&&Math.random()<.45) worldBoss.type='worldBoss'; }
  state.meta.weather=pick(window.GameCatalog?.weather||[{id:'clear'}]).id;
  renderAll();
};

const oldTileIcon2=tileIcon;
tileIcon=function(tile){
  const icons={rare:'◇',bossGuard:'♝',worldBoss:'♕'};
  return icons[tile?.type]||oldTileIcon2(tile);
};

const oldTilePriority2=tilePriority;
tilePriority=function(tile){
  if(tile.type==='worldBoss') return state.strategy==='boss'?19:12;
  if(tile.type==='bossGuard') return state.strategy==='boss'?18:10.5;
  if(tile.type==='rare') return state.strategy==='loot'?13:8;
  return oldTilePriority2(tile);
};

const oldEnemyFor2=enemyFor;
enemyFor=function(kind){
  if(kind==='worldBoss'){
    const z=currentZone(), level=state.floor+3, rank=8.8;
    const hp=Math.round((42+level*22)*rank), attack=Math.round((5+level*2.4)*Math.sqrt(rank)), defense=Math.round(level*.7*rank);
    return {kind,name:`异变·${pick(z.bosses)}`,hp,maxHp:hp,attack,defense,level,boss:true,rank,phase:1};
  }
  const e=oldEnemyFor2(kind);
  if(state.meta.nextRare&&kind==='elite'){
    state.meta.nextRare=false; const z=currentZone(); e.name=pick(z.rares||z.monsters); e.rank=2.15; e.maxHp=e.hp=Math.round(e.maxHp*1.22); e.attack=Math.round(e.attack*1.12); e.rare=true;
  }
  if(kind==='elite'&&state.meta.nextGuard){
    state.meta.nextGuard=false; e.name=`门卫·${pick(currentZone().elites||currentZone().monsters)}`; e.maxHp=e.hp=Math.round(e.maxHp*1.5); e.attack=Math.round(e.attack*1.2); e.guard=true;
  }
  return e;
};

const oldResolveTile2=resolveTile;
resolveTile=function(tile){
  if(tile.type==='rare'&&!tile.cleared){ state.meta.nextRare=true; return startCombat(tile,'elite'); }
  if(tile.type==='bossGuard'&&!tile.cleared){ state.meta.nextGuard=true; return startCombat(tile,'elite'); }
  if(tile.type==='worldBoss'&&!tile.cleared) return startCombat(tile,'worldBoss');
  if(['floorBoss','regionBoss'].includes(tile.type)&&!state.meta.guardDefeated&&!tile.cleared){
    tile.visited=false; state.intentText='Boss 结界未解除：先击败本层门卫'; toast('Boss 门卫仍然存活'); return;
  }
  return oldResolveTile2(tile);
};

function skillMultiplier(){
  const c=state.meta.classId;
  return ({warrior:1.55,rogue:1.72,mage:2.05,cleric:1.35,ranger:1.68}[c]||1.5)*(1+talentValue('skillDamage'));
}

function useClassSkill(c,p,now){
  if(!c.nextSkillAt) c.nextSkillAt=now+1200;
  if(now<c.nextSkillAt) return;
  const cooldown=({warrior:3000,rogue:2400,mage:3400,cleric:2800,ranger:2600}[state.meta.classId]||3000)*(1-talentValue('cooldown'));
  c.nextSkillAt=now+cooldown;
  let damage=Math.max(1,(p.attack-c.enemy.defense*(.38*(1-p.armorPen)))*skillMultiplier());
  if(state.meta.classId==='rogue'&&Math.random()<p.crit+.15) damage*=p.critDamage;
  if(state.meta.classId==='ranger') damage*=1+talentLevel(3)*.08;
  if(state.meta.classId==='mage'&&Math.random()<talentValue('echo')) damage*=1.55;
  if(c.enemy.boss) damage*=1+p.bossDamage;
  c.enemy.hp-=Math.round(damage); c.damageDone+=Math.round(damage);
  if(state.meta.classId==='cleric'&&talentValue('heal')>0){ state.player.hp=Math.min(p.maxHp,state.player.hp+Math.round(p.maxHp*talentValue('heal'))); }
  if(c.enemy.hp<=0) finishCombat(true);
}

combatTick=function(now){
  const c=state.combat; if(!c) return;
  const p=playerStats();
  if(!c.phase) c.phase=1;
  const ratio=c.enemy.hp/c.enemy.maxHp;
  const nextPhase=ratio<=.33?3:(ratio<=.66?2:1);
  if(nextPhase>c.phase){ c.phase=nextPhase; c.enemy.attack=Math.round(c.enemy.attack*(nextPhase===2?1.13:1.18)); floating(`BOSS PHASE ${nextPhase}`,'bossfx'); }

  let playerInterval=560/p.haste;
  if(state.meta.combatStrategy==='aggressive') playerInterval*=.86;
  if(state.meta.combatStrategy==='safe') playerInterval*=1.06;
  if(now-c.lastPlayerHit>=playerInterval){
    c.lastPlayerHit=now;
    let enemyDefense=c.enemy.defense*(1-p.armorPen);
    let damage=Math.max(1,p.attack-enemyDefense*.5+rand(-2,3));
    if(c.enemy.boss) damage*=1+p.bossDamage;
    if(state.meta.classId==='rogue'&&(now-c.startedAt)<3000) damage*=1+talentValue('opener');
    if(Math.random()<p.crit) damage*=p.critDamage;
    if(talentValue('execute')&&c.enemy.hp/c.enemy.maxHp<=.2) damage*=2;
    c.enemy.hp-=Math.round(damage); c.damageDone+=Math.round(damage);
    if(Math.random()<talentValue('doubleHit')){ const extra=Math.round(damage*.65); c.enemy.hp-=extra; c.damageDone+=extra; }
    if(c.enemy.hp<=0){ finishCombat(true); return; }
  }

  useClassSkill(c,p,now); if(!state.combat) return;

  if(c.enemy.boss&&talentValue('meteor')&&(!c.nextMeteorAt||now>=c.nextMeteorAt)){
    c.nextMeteorAt=now+8000; const dmg=Math.round(p.attack*4.2); c.enemy.hp-=dmg; c.damageDone+=dmg; floating('陨石！','rare'); if(c.enemy.hp<=0){finishCombat(true);return;}
  }

  let enemyInterval=c.enemy.boss?760:900;
  enemyInterval*=1+talentValue('slow');
  if(state.meta.combatStrategy==='safe') enemyInterval*=1.12;
  if(now-c.lastEnemyHit>=enemyInterval){
    c.lastEnemyHit=now;
    if(Math.random()<p.dodge){ floating('闪避','good'); }
    else{
      let raw=Math.max(1,c.enemy.attack-p.defense*.42+rand(-1,2));
      raw*=1-p.damageReduction;
      if(state.meta.combatStrategy==='safe') raw*=.82;
      if(state.meta.combatStrategy==='aggressive') raw*=1.12;
      state.player.hp-=Math.round(raw);
      if(state.player.hp<=0){
        if(talentValue('cheatDeath')&&!state.meta.cheatDeathUsed){ state.meta.cheatDeathUsed=true; state.player.hp=state.meta.classId==='cleric'?Math.round(p.maxHp*.35):1; floating('绝境生还','rare'); }
        else { finishCombat(false); return; }
      }
    }
  }
  renderCombat(); renderHud();
};

const oldFinishCombat2=finishCombat;
finishCombat=function(win){
  const c=state.combat, tile=c?state.map[c.tileIndex]:null, wasGuard=!!tile?.guard||!!c?.enemy?.guard, wasWorld=c?.enemy?.kind==='worldBoss';
  if(wasWorld&&win){
    // Convert to a supported boss reward channel before the base resolver runs.
    c.enemy.kind='regionBoss'; c.enemy.rank=Math.max(c.enemy.rank,8.8);
  }
  oldFinishCombat2(win);
  if(win&&wasGuard){ state.meta.guardDefeated=true; toast('Boss 门卫已击败，结界解除'); }
  if(win&&wasWorld){ state.essence+=10; dropLoot('regionBoss'); toast('世界 Boss 额外战利品已获得'); }
};

function buyShop(id){
  const prices={potion:30+state.floor*4,reforge:90+state.floor*9,gear:120+state.floor*14,talent:260+state.floor*20};
  const cost=prices[id]; if(cost===undefined||state.gold<cost) return {ok:false,cost};
  state.gold-=cost;
  if(id==='potion') state.meta.potions=Math.min(99,(state.meta.potions||0)+3);
  if(id==='reforge') state.meta.reforgeTokens=(state.meta.reforgeTokens||0)+1;
  if(id==='gear') dropLoot('treasure');
  if(id==='talent'){ state.meta.talentPoints++; autoSpendTalent(); }
  window.GridIdleMeta?.saveGame?.('shop'); renderAll(); return {ok:true,cost};
}

function reforge(slot){
  const item=state.player.equipment[slot]; if(!item) return {ok:false,reason:'empty'};
  if((state.meta.reforgeTokens||0)<=0&&state.essence<2) return {ok:false,reason:'cost'};
  if(state.meta.reforgeTokens>0) state.meta.reforgeTokens--; else state.essence-=2;
  item.attack=Math.max(0,item.attack||0); item.defense=Math.max(0,item.defense||0); item.hp=Math.max(0,item.hp||0); item.crit=Math.max(0,item.crit||0); item.haste=Math.max(0,item.haste||0);
  item.extraStats={}; item.affixes=[];
  const rarity=RARITIES.find(r=>r.id===item.rarity)||RARITIES[0], range=rarity.affixes||[0,1];
  for(const def of pickUniqueAffixes(rand(range[0],range[1]))) applyAffixToItem(item,def,rollAffixValue(def,state.floor,rarity));
  item.score=Math.round(item.attack*2+item.defense*1.45+item.hp*.18+item.crit*100+item.haste*70+Object.values(item.extraStats).reduce((s,v)=>s+Math.abs(v)*18,0)+(item.legendaryEffect?42:0));
  window.GridIdleMeta?.saveGame?.('reforge'); renderAll(); return {ok:true,item};
}

const oldEnterExit2=enterExit;
enterExit=function(){
  if(state.zoneIndex===ZONES.length-1&&zoneDepth()===10&&state.floorBossDefeated&&!state.meta.completed){
    state.meta.completed=true; state.meta.endings++; state.running=false; window.GridIdleMeta?.saveGame?.('ending');
    window.AdvancedUI?.showEnding?.(); return;
  }
  oldEnterExit2();
};
function continueAfterEnding(){ state.running=true; state.meta.completed=true; oldEnterExit2(); }

window.AdvancedGame={
  classes:window.GameCatalog?.classes||[],talents:TALENT_RULES,
  selectClass,spendTalent,autoSpendTalent,talentLevel,talentList,
  buyShop,reforge,continueAfterEnding,
  setCombatStrategy(v){ if(['safe','balanced','aggressive'].includes(v)){state.meta.combatStrategy=v;window.GridIdleMeta?.saveGame?.('strategy');} },
  summary(){ return {floor:state.floor,zone:currentZone().name,level:state.player.level,kills:state.kills,bosses:state.meta.stats.bosses,legendaries:state.meta.stats.legendaries,gold:state.gold,playMs:Date.now()-state.meta.totalPlayStartedAt}; }
};

if(document.getElementById('heroIcon')) document.getElementById('heroIcon').textContent=CLASS_ICONS[state.meta.classId]||'⚔';
generateFloor();
})();
