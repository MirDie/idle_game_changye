'use strict';

const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');

const ROOT=path.resolve(__dirname,'..');
const SCRIPTS=[
  'full-content.js',
  'game-1.js',
  'content-bridge.js',
  'game-2.js',
  'game-3.js',
  'full-systems.js',
  'advanced-gameplay.js',
  'hotfixes.js',
  'campaign-stability.js',
  'campaign-invariants.js'
];

class FakeClassList{
  add(){} remove(){} toggle(){return false;} contains(){return false;}
}
class FakeElement{
  constructor(id=''){
    this.id=id; this.style={}; this.classList=new FakeClassList(); this.children=[];
    this.dataset={}; this.checked=id==='autoEquip'; this.textContent=''; this.innerHTML='';
    this.value=''; this.disabled=false;
  }
  appendChild(el){this.children.push(el);return el;}
  remove(){}
  addEventListener(){}
  querySelectorAll(){return [];}
  querySelector(){return new FakeElement();}
  closest(){return null;}
}

function makeStorage(seed){
  const map=seed||new Map();
  return {
    _map:map,
    getItem(k){return map.has(k)?map.get(k):null;},
    setItem(k,v){map.set(k,String(v));},
    removeItem(k){map.delete(k);},
    clear(){map.clear();}
  };
}

function makeContext(storageMap=new Map(),nowValue=1_800_000_000_000){
  const elements=new Map();
  const document={
    visibilityState:'visible',
    body:new FakeElement('body'),
    getElementById(id){if(!elements.has(id))elements.set(id,new FakeElement(id));return elements.get(id);},
    createElement(tag){return new FakeElement(tag);},
    querySelectorAll(){return [];},
    addEventListener(){}
  };
  const storage=makeStorage(storageMap);
  let seed=0x12345678;
  const math=Object.create(Math);
  math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};
  class FakeDate extends Date{static now(){return nowValue;}}

  const context={
    console,
    document,
    localStorage:storage,
    Math:math,
    Date:FakeDate,
    performance:{now:()=>0},
    requestAnimationFrame:()=>0,
    setInterval:()=>0,
    clearInterval:()=>{},
    setTimeout:(fn)=>{fn();return 0;},
    clearTimeout:()=>{},
    addEventListener:()=>{},
    window:null,
    globalThis:null
  };
  context.window=context;
  context.globalThis=context;
  vm.createContext(context);

  for(const file of SCRIPTS){
    const code=fs.readFileSync(path.join(ROOT,file),'utf8');
    vm.runInContext(code,context,{filename:file});
  }

  vm.runInContext(`
    globalThis.__campaignTest={
      inspect(){
        return {
          floor:state.floor, zoneIndex:state.zoneIndex, running:state.running,
          completed:!!state.meta.completed, playerIndex:state.playerIndex,
          gold:state.gold, level:state.player.level, xp:state.player.xp,
          bosses:state.meta.stats.bosses||0,
          floorBossDefeated:!!state.floorBossDefeated,
          guardDefeated:!!state.meta.guardDefeated,
          resolveStacks:state.meta.resolveStacks||0,
          map:state.map.map(t=>({index:t.index,type:t.type,visited:!!t.visited,cleared:!!t.cleared,locked:!!t.locked,guard:!!t.guard}))
        };
      },
      powerUp(){
        state.player.baseAttack=50000;
        state.player.baseDefense=10000;
        state.player.maxHp=Math.max(state.player.maxHp,100000);
        state.player.hp=playerStats().maxHp;
      },
      simulate(maxSteps,targetFloor){
        const zones=new Set([state.zoneIndex]);
        let now=1000;
        for(let i=0;i<maxSteps;i++){
          if(state.meta.completed) return {steps:i,zones:[...zones]};
          if(targetFloor&&state.floor>=targetFloor&&!state.combat) return {steps:i,zones:[...zones]};
          zones.add(state.zoneIndex);
          if(i%4===0) window.CampaignStability.watchdog();
          if(state.combat){ now+=1200; combatTick(now); }
          else { moveOne(); now+=700; }
        }
        return {steps:maxSteps,zones:[...zones],timedOut:true,floor:state.floor,zoneIndex:state.zoneIndex,completed:!!state.meta.completed};
      },
      settleCombat(){
        let now=1000,guard=200;
        while(state.combat&&guard-->0){now+=1500;combatTick(now);}
        if(state.combat) throw new Error('combat did not settle');
      },
      save(reason){return window.GridIdleMeta.saveGame(reason||'test');},
      watchdog(){return window.CampaignStability.watchdog();}
    };
  `,context);

  return {context,storageMap,storage,advance(ms){nowValue+=ms;},setNow(v){nowValue=v;},getNow(){return nowValue;}};
}

function inspect(env){return env.context.__campaignTest.inspect();}
function signature(s){return JSON.stringify({floor:s.floor,zoneIndex:s.zoneIndex,playerIndex:s.playerIndex,map:s.map});}

(function campaignCompletesAllEightZones(){
  const env=makeContext();
  env.context.__campaignTest.powerUp();
  const result=env.context.__campaignTest.simulate(30000,0);
  const s=inspect(env);
  assert.strictEqual(result.timedOut,undefined,`campaign simulation timed out at floor ${result.floor}, zone ${result.zoneIndex}`);
  assert.strictEqual(s.completed,true,'final boss path did not trigger completion');
  assert.strictEqual(s.floor,80,'completion must happen on floor 80');
  assert.strictEqual(s.zoneIndex,7,'completion must happen in zone 8');
  assert.strictEqual(Array.from(result.zones).sort((a,b)=>a-b).join(','),'0,1,2,3,4,5,6,7','not all eight zones were reached');
  assert.ok(s.bosses>=80,'expected at least one required boss per floor');
  console.log('✓ new game can progress through all 8 zones and final boss');
})();

(function midFloorSaveRestoresExactFloor(){
  const storage=new Map();
  const first=makeContext(storage);
  first.context.__campaignTest.powerUp();
  const result=first.context.__campaignTest.simulate(12000,17);
  assert.strictEqual(result.timedOut,undefined,'failed to reach mid campaign save point');
  first.context.__campaignTest.settleCombat();
  for(let i=0;i<4;i++){
    first.context.__campaignTest.simulate(1,0);
    first.context.__campaignTest.settleCombat();
  }
  first.context.__campaignTest.save('mid-floor-test');
  const before=inspect(first);
  const sig=signature(before);
  assert.strictEqual(before.floor,17);

  const second=makeContext(storage,first.getNow()+5000);
  const after=inspect(second);
  assert.strictEqual(signature(after),sig,'reload regenerated or changed the active floor');
  assert.strictEqual(after.floor,17);
  console.log('✓ save/load restores the exact active floor and exploration state');
})();

(function offlineSettlementIsExactAndNotDuplicated(){
  const storage=new Map();
  const first=makeContext(storage);
  first.context.__campaignTest.powerUp();
  first.context.__campaignTest.simulate(4000,7);
  first.context.__campaignTest.settleCombat();
  first.context.__campaignTest.save('offline-base');
  const before=inspect(first);

  const stableKey='grid_idle_save_v3';
  const data=JSON.parse(storage.get(stableKey));
  data.savedAt=first.getNow()-60*60*1000;
  storage.set(stableKey,JSON.stringify(data));
  const legacyKey='grid_idle_save_v2';
  if(storage.has(legacyKey)){
    const legacy=JSON.parse(storage.get(legacyKey));
    legacy.savedAt=data.savedAt;
    storage.set(legacyKey,JSON.stringify(legacy));
  }

  const expectedGold=Math.floor(3600*(.22+before.floor*.055));
  const second=makeContext(storage,first.getNow());
  const after=inspect(second);
  assert.strictEqual(after.gold,before.gold+expectedGold,'offline gold was settled more or less than exactly once');
  assert.ok(after.level>=before.level,'offline XP regressed level');
  const onceGold=after.gold;

  const third=makeContext(storage,first.getNow()+1000);
  const afterImmediateReload=inspect(third);
  assert.strictEqual(afterImmediateReload.gold,onceGold,'offline reward was duplicated on immediate reload');
  console.log('✓ offline settlement is exact, single, and survives immediate reload');
})();

(function requiredBossFailureCannotHardLockFloor(){
  const env=makeContext();
  env.context.__campaignTest.powerUp();
  vm.runInContext(`
    state.meta.guardDefeated=true;
    const core=state.map.find(t=>['floorBoss','regionBoss'].includes(t.type));
    if(!core) throw new Error('missing core boss');
    state.playerIndex=core.index;
    core.visited=true; core.cleared=false;
    startCombat(core,core.type);
    state.player.baseAttack=1;
    state.player.baseDefense=0;
    state.player.hp=1;
    state.combat.enemy.attack=999999;
    combatTick(5000);
  `,env.context);
  const s=inspect(env);
  const core=s.map.find(t=>['floorBoss','regionBoss'].includes(t.type));
  assert.ok(core&&!core.visited&&!core.cleared,'failed required boss was not returned to the exploration frontier');
  assert.ok(s.resolveStacks>=1,'resolve recovery stack was not granted');
  console.log('✓ required boss defeat retries instead of hard-locking the floor');
})();

console.log('All campaign stability tests passed.');
