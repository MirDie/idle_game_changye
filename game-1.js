'use strict';

const SIZE = 6;
const FLOOR_TILES = SIZE * SIZE;
const TICK_MS = 620;
const COMBAT_TICK_MS = 120;

const SLOT_META = {
  weapon: { name: '武器', icon: '⚔' },
  helm: { name: '头盔', icon: '⛑' },
  armor: { name: '护甲', icon: '◫' },
  boots: { name: '靴子', icon: '⌁' },
  charm: { name: '饰品', icon: '✦' },
};
const SLOTS = Object.keys(SLOT_META);

const RARITIES = [
  { id: 'common', name: '普通', mult: 1, weight: 66 },
  { id: 'rare', name: '稀有', mult: 1.25, weight: 24 },
  { id: 'epic', name: '史诗', mult: 1.65, weight: 8 },
  { id: 'legendary', name: '传奇', mult: 2.35, weight: 2 },
];

const ZONES = [
  { name: '低语森林', monsters: ['森林狼','腐叶史莱姆','荆棘哥布林','迷雾蜘蛛'], bosses: ['古木守卫','腐化鹿王','狼群之母','孢子巨像','幽林猎手'] },
  { name: '荒芜矿坑', monsters: ['矿坑鼠人','碎岩魔','铁甲甲虫','失控矿工'], bosses: ['钻岩暴君','矿脉吞噬者','赤铁督军','坍塌之心','深井监工'] },
  { name: '沉眠墓园', monsters: ['骨兵','游魂','墓穴犬','腐化祭司'], bosses: ['墓园看守','无首骑士','哀嚎女妖','白骨主教','棺椁之王'] },
];

const state = {
  running: true,
  speed: 1,
  strategy: 'balanced',
  floor: 1,
  zoneIndex: 0,
  map: [],
  playerIndex: 0,
  explored: new Set(),
  cleared: new Set(),
  foundExit: false,
  exitIndex: -1,
  floorBossIndex: -1,
  floorBossDefeated: false,
  bossesDefeated: 0,
  bossesTotal: 1,
  combat: null,
  nextMoveAt: 0,
  nextCombatAt: 0,
  gold: 0,
  essence: 0,
  kills: 0,
  loot: [],
  player: {
    level: 1,
    xp: 0,
    hp: 100,
    maxHp: 100,
    baseAttack: 10,
    baseDefense: 2,
    equipment: { weapon:null, helm:null, armor:null, boots:null, charm:null },
  },
};

const els = Object.fromEntries([
  'grid','heroLevel','heroPower','heroHpFill','heroHpText','gold','essence','zoneName','floorName','floorTag',
  'exploredCount','bossCount','bossTotal','intentText','combatCard','enemyKind','enemyName','enemyBadge','enemyHpFill',
  'enemyHpText','combatHint','dpsText','exitState','exitProgress','regionBossState','regionProgress','equipmentSlots',
  'lootFeed','bagCount','pauseBtn','strategyBtn','resetBtn','autoEquip','floatingText','toastRoot'
].map(id => [id, document.getElementById(id)]));

const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const rand = (min,max) => Math.floor(Math.random()*(max-min+1))+min;
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const neighbors = idx => {
  const r = Math.floor(idx/SIZE), c = idx%SIZE, out=[];
  if(r>0) out.push(idx-SIZE); if(r<SIZE-1) out.push(idx+SIZE); if(c>0) out.push(idx-1); if(c<SIZE-1) out.push(idx+1);
  return out;
};

function chooseWeighted(entries){
  const total = entries.reduce((s,e)=>s+e.weight,0); let roll=Math.random()*total;
  for(const e of entries){ roll-=e.weight; if(roll<=0) return e; }
  return entries[entries.length-1];
}

function currentZone(){ return ZONES[state.zoneIndex % ZONES.length]; }

function zoneDepth(){ return ((state.floor-1)%10)+1; }

function playerStats(){
  let attack = state.player.baseAttack + (state.player.level-1)*2;
  let defense = state.player.baseDefense + Math.floor((state.player.level-1)*0.7);
  let hpBonus = 0;
  let crit = 0.05;
  let haste = 1;
  let power = attack*2 + defense*1.4;
  for(const item of Object.values(state.player.equipment)){
    if(!item) continue;
    attack += item.attack||0; defense += item.defense||0; hpBonus += item.hp||0; crit += item.crit||0; haste += item.haste||0;
    power += item.score;
  }
  return { attack, defense, maxHp: state.player.maxHp+hpBonus, crit: clamp(crit,0.05,0.55), haste: clamp(haste,1,2.1), power: Math.round(power) };
}

function tileIcon(tile){
  if(!tile) return '';
  if(tile.type==='start') return '·';
  if(tile.type==='empty') return pick(['·','♧','∙']);
  if(tile.type==='monster') return '♟';
  if(tile.type==='elite') return '♜';
  if(tile.type==='roamingBoss') return '♛';
  if(tile.type==='floorBoss') return '☠';
  if(tile.type==='regionBoss') return '♚';
  if(tile.type==='treasure') return '▣';
  if(tile.type==='shrine') return '✧';
  if(tile.type==='heal') return '✚';
  if(tile.type==='exit') return '⇩';
  return '·';
}

function generateFloor(){
  const map = Array.from({length:FLOOR_TILES},(_,i)=>({index:i,type:'empty',revealed:false,visited:false,cleared:false}));
  const start = rand(0,FLOOR_TILES-1);
  state.playerIndex = start;
  map[start].type='start'; map[start].revealed=true; map[start].visited=true; map[start].cleared=true;

  let available = map.map((_,i)=>i).filter(i=>i!==start);
  const take = () => { const p=rand(0,available.length-1); return available.splice(p,1)[0]; };

  const exit = take(); state.exitIndex = exit; map[exit].type='exit'; map[exit].locked=true;
  const boss = take(); state.floorBossIndex = boss;
  const isRegionBoss = zoneDepth()===10;
  map[boss].type = isRegionBoss ? 'regionBoss' : 'floorBoss';

  const roamingBossCount = zoneDepth()%3===0 ? 2 : (Math.random()<0.55 ? 1 : 0);
  const eliteCount = 3 + Math.floor(zoneDepth()/3);
  const monsterCount = 12 + Math.floor(zoneDepth()/2);
  const treasureCount = 3;
  const shrineCount = 2;
  const healCount = 1;

  for(let i=0;i<roamingBossCount && available.length;i++) map[take()].type='roamingBoss';
  for(let i=0;i<eliteCount && available.length;i++) map[take()].type='elite';
  for(let i=0;i<monsterCount && available.length;i++) map[take()].type='monster';
  for(let i=0;i<treasureCount && available.length;i++) map[take()].type='treasure';
  for(let i=0;i<shrineCount && available.length;i++) map[take()].type='shrine';
  for(let i=0;i<healCount && available.length;i++) map[take()].type='heal';

  state.map = map;
  state.explored = new Set([start]);
  state.cleared = new Set([start]);
  state.foundExit = false;
  state.floorBossDefeated = false;
  state.bossesDefeated = 0;
  state.bossesTotal = 1 + roamingBossCount;
  state.combat = null;
  state.nextMoveAt = performance.now()+350;
  revealAround(start);
  renderAll();
  toast(`${currentZone().name} · 第 ${state.floor} 层生成：${state.bossesTotal} 个 Boss`);
}

function revealAround(idx){
  [idx,...neighbors(idx)].forEach(i=>{ state.map[i].revealed=true; state.explored.add(i); });
}

function bfsNextTarget(){
  const start = state.playerIndex;
  const queue=[start], prev=new Map([[start,-1]]);
  const candidates=[];
  while(queue.length){
    const cur=queue.shift();
    for(const n of neighbors(cur)){
      if(prev.has(n)) continue;
      prev.set(n,cur); queue.push(n);
      const t=state.map[n];
      if(!t.visited){ candidates.push(n); }
    }
    if(candidates.length) break;
  }
  if(!candidates.length) return -1;
  let target = candidates[0];
  if(state.strategy==='boss'){
    const bossCandidate=candidates.find(i=>['elite','roamingBoss','floorBoss','regionBoss'].includes(state.map[i].type));
    if(bossCandidate!==undefined) target=bossCandidate;
  }else if(state.strategy==='loot'){
    const lootCandidate=candidates.find(i=>['treasure','elite','roamingBoss','floorBoss','regionBoss'].includes(state.map[i].type));
    if(lootCandidate!==undefined) target=lootCandidate;
  }
  let step=target;
  while(prev.get(step)!==start && prev.get(step)!==-1) step=prev.get(step);
  return step;
}

function chooseMove(){
  const adjacent = neighbors(state.playerIndex).filter(i=>!state.map[i].visited);
  if(adjacent.length){
    const ranked = adjacent.slice().sort((a,b)=>tilePriority(state.map[b])-tilePriority(state.map[a]));
    return ranked[0];
  }
  return bfsNextTarget();
}

function tilePriority(tile){
  const base = {regionBoss:10,floorBoss:9,roamingBoss:8,elite:7,treasure:6,shrine:5,heal:4,monster:3,exit:2,empty:1,start:0}[tile.type]||0;
  if(state.strategy==='balanced') return base + Math.random()*2.5;
  if(state.strategy==='boss') return base + (['regionBoss','floorBoss','roamingBoss','elite'].includes(tile.type)?6:0) + Math.random();
  if(state.strategy==='loot') return base + (['treasure','elite','roamingBoss'].includes(tile.type)?6:0) + Math.random();
  return base;
}

function moveOne(){
  if(state.combat || !state.running) return;
  const next = chooseMove();
  if(next<0){
    if(state.floorBossDefeated){ enterExit(); }
    return;
  }
  state.playerIndex = next;
  const tile = state.map[next]; tile.visited=true; state.explored.add(next); revealAround(next);
  state.intentText = `探索格子 ${Math.floor(next/SIZE)+1}-${next%SIZE+1}`;
  resolveTile(tile);
  renderAll();
}

function resolveTile(tile){
  if(tile.cleared) return;
  if(tile.type==='empty' || tile.type==='start'){
    tile.cleared=true; state.cleared.add(tile.index); return;
  }
  if(tile.type==='monster') return startCombat(tile,'normal');
  if(tile.type==='elite') return startCombat(tile,'elite');
  if(tile.type==='roamingBoss') return startCombat(tile,'roamingBoss');
  if(tile.type==='floorBoss') return startCombat(tile,'floorBoss');
  if(tile.type==='regionBoss') return startCombat(tile,'regionBoss');
  if(tile.type==='treasure'){
    tile.cleared=true; state.cleared.add(tile.index);
    const count=rand(1,3); for(let i=0;i<count;i++) dropLoot('treasure');
    const g=rand(18,38)*state.floor; state.gold+=g; floating(`宝箱 +${g} 金币`,'good'); toast('发现隐藏宝箱');
  }else if(tile.type==='shrine'){
    tile.cleared=true; state.cleared.add(tile.index);
    state.player.baseAttack += 1; state.player.maxHp += 4; floating('神龛：永久强化','rare'); toast('远征神龛：攻击 +1，生命 +4');
  }else if(tile.type==='heal'){
    tile.cleared=true; state.cleared.add(tile.index);
    const ps=playerStats(); state.player.hp=Math.min(ps.maxHp,state.player.hp+Math.round(ps.maxHp*.55)); floating('恢复生命','good');
  }else if(tile.type==='exit'){
    state.foundExit=true;
    if(state.floorBossDefeated) enterExit(); else { tile.locked=true; state.intentText='发现出口，但楼层 Boss 尚未击败'; toast('出口被 Boss 结界封锁'); }
  }
}

function enemyFor(kind){
  const z=currentZone();
  const rank = {normal:1,elite:1.8,roamingBoss:3.0,floorBoss:4.2,regionBoss:7.2}[kind];
  const boss = kind!=='normal' && kind!=='elite';
  const level = Math.max(1,state.floor + (kind==='elite'?1:0));
  const baseHp = 32 + level*18;
  const hp = Math.round(baseHp*rank);
  const attack = Math.round((4+level*2.1)*Math.sqrt(rank));
  const defense = Math.round(level*.55*rank);
  const name = boss ? pick(z.bosses) : pick(z.monsters);
  return {kind,name,hp,maxHp:hp,attack,defense,level,boss,rank};
}

function startCombat(tile,kind){
  const enemy=enemyFor(kind);
  state.combat={tileIndex:tile.index,enemy,lastPlayerHit:0,lastEnemyHit:0,startedAt:performance.now(),damageDone:0};
  state.intentText = `${enemy.name} · 自动战斗`;
  renderCombat();
  if(enemy.boss) floating(kind==='regionBoss'?'区域 BOSS':'BOSS 遭遇','bossfx');
}

function combatTick(now){
  const c=state.combat; if(!c) return;
  const p=playerStats();
  const playerInterval=560/p.haste;
  if(now-c.lastPlayerHit>=playerInterval){
    c.lastPlayerHit=now;
    let damage=Math.max(1,p.attack-c.enemy.defense*.5+rand(-2,3));
    if(Math.random()<p.crit) damage=Math.round(damage*1.8);
    c.enemy.hp-=damage; c.damageDone+=damage;
    if(c.enemy.hp<=0){ finishCombat(true); return; }
  }
  const enemyInterval=c.enemy.boss?780:900;
  if(now-c.lastEnemyHit>=enemyInterval){
    c.lastEnemyHit=now;
    const raw=Math.max(1,c.enemy.attack-p.defense*.42+rand(-1,2));
    state.player.hp-=raw;
    if(state.player.hp<=0){ finishCombat(false); return; }
  }
  renderCombat(); renderHud();
}

function finishCombat(win){
  const c=state.combat; if(!c) return;
  const tile=state.map[c.tileIndex], enemy=c.enemy;
  if(win){
    tile.cleared=true; state.cleared.add(tile.index); state.kills++;
    const xp=Math.round(8*enemy.rank + state.floor*2); grantXp(xp);
    const gold=Math.round(rand(5,12)*state.floor*enemy.rank); state.gold+=gold;
    const dropChance={normal:.32,elite:.78,roamingBoss:1,floorBoss:1,regionBoss:1}[enemy.kind];
    if(Math.random()<dropChance) dropLoot(enemy.kind);
    if(enemy.kind==='elite' && Math.random()<.28) dropLoot('elite');
    if(enemy.boss){
      state.bossesDefeated++;
      state.essence += enemy.kind==='regionBoss'?8:(enemy.kind==='floorBoss'?3:2);
      if(enemy.kind==='floorBoss'||enemy.kind==='regionBoss'){
        state.floorBossDefeated=true;
        state.map[state.exitIndex].locked=false;
        toast(enemy.kind==='regionBoss'?'区域 Boss 已击败，通往新区的出口开启':'楼层 Boss 已击败，出口解除封印');
      }
      if(enemy.kind==='regionBoss'){ dropLoot('regionBoss'); dropLoot('regionBoss'); }
      else if(enemy.kind==='floorBoss'){ dropLoot('floorBoss'); }
    }
    floating(`击败 ${enemy.name}`,'good');
    state.combat=null;
    state.intentText='继续自动探索';
    state.nextMoveAt=performance.now()+420/state.speed;
  }else{
    state.combat=null;
    const ps=playerStats(); state.player.hp=Math.round(ps.maxHp*.7);
    const loss=Math.min(state.gold,Math.round(state.gold*.05)); state.gold-=loss;
    state.playerIndex = [...state.explored][0] ?? 0;
    toast(`远征失败，损失 ${loss} 金币；恢复后继续探索`);
    state.nextMoveAt=performance.now()+1200/state.speed;
  }
  renderAll();
}

function grantXp(amount){
  state.player.xp+=amount;
  while(state.player.xp>=xpNeed()){
    state.player.xp-=xpNeed(); state.player.level++; state.player.maxHp+=8; state.player.baseAttack+=2; state.player.baseDefense+=1;
    state.player.hp=playerStats().maxHp; toast(`升级！Lv.${state.player.level}`); floating('LEVEL UP','rare');
  }
}
function xpNeed(){ return 30 + (state.player.level-1)*18; }
