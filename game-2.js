function rollRarity(source){
  let bonus=0;
  if(source==='elite') bonus=4;
  if(source==='roamingBoss') bonus=10;
  if(source==='floorBoss') bonus=16;
  if(source==='regionBoss') bonus=28;
  const entries=RARITIES.map(r=>({...r,weight:Math.max(.5,r.weight + (r.id==='common'?-bonus:(r.id==='rare'?bonus*.55:r.id==='epic'?bonus*.32:bonus*.13)))}));
  return chooseWeighted(entries);
}

function dropLoot(source){
  const slot=pick(SLOTS), rarity=rollRarity(source), depth=state.floor;
  const base=3+depth*1.5;
  const item={
    id:`${Date.now()}-${Math.random()}`,
    slot, rarity:rarity.id, rarityName:rarity.name,
    name:itemName(slot,rarity.id),
    attack:0,defense:0,hp:0,crit:0,haste:0,source
  };
  const statRoll=Math.round(base*rarity.mult*rand(85,120)/100);
  if(slot==='weapon') item.attack=statRoll+2;
  else if(slot==='armor'||slot==='helm') item.defense=Math.round(statRoll*.65), item.hp=statRoll*2;
  else if(slot==='boots') item.defense=Math.round(statRoll*.35), item.haste=rarity.id==='legendary'?.16:(rarity.id==='epic'?.09:.04);
  else item.attack=Math.round(statRoll*.45), item.crit=rarity.id==='legendary'?.11:(rarity.id==='epic'?.07:.035);
  if(rarity.id==='legendary'){
    if(Math.random()<.5) item.attack+=Math.round(base*.9); else item.hp+=Math.round(base*4);
  }
  item.score=Math.round(item.attack*2+item.defense*1.45+item.hp*.18+item.crit*100+item.haste*70);
  state.loot.unshift(item); state.loot=state.loot.slice(0,50);
  if(els.autoEquip.checked) tryAutoEquip(item);
  floating(`${rarity.name} ${item.name}`,rarity.id==='common'?'good':'rare');
}

function itemName(slot,rarity){
  const pools={
    weapon:['巡林短剑','灰木法杖','裂石战斧','猎手长弓'], helm:['斥候兜帽','荆叶战盔','符文头环','狼骨面甲'],
    armor:['树皮胸甲','雾纹锁甲','旅者长衣','古藤护胸'], boots:['轻行靴','苔痕战靴','风痕鞋','猎迹长靴'], charm:['月牙护符','旧银戒','兽牙坠饰','雾晶徽记']
  };
  const prefix={common:'',rare:'精工·',epic:'秘仪·',legendary:'传说·'}[rarity];
  return prefix+pick(pools[slot]);
}

function tryAutoEquip(item){
  const cur=state.player.equipment[item.slot];
  if(!cur || item.score>cur.score){ state.player.equipment[item.slot]=item; toast(`自动换装：${item.name} ↑`); }
}

function enterExit(){
  if(!state.floorBossDefeated) return;
  state.intentText='进入下一层…';
  const oldDepth=zoneDepth();
  if(oldDepth===10){ state.zoneIndex=(state.zoneIndex+1)%ZONES.length; }
  state.floor++;
  const ps=playerStats(); state.player.hp=Math.min(ps.maxHp,state.player.hp+Math.round(ps.maxHp*.3));
  setTimeout(generateFloor,280);
}
