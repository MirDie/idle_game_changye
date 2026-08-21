function rollRarity(source){
  const boost={normal:0,treasure:2,elite:5,roamingBoss:10,floorBoss:16,regionBoss:30}[source]||0;
  const tierBoost={common:-1.00,uncommon:-.35,rare:.55,epic:.85,legendary:1.25};
  const entries=RARITIES.map(r=>({
    ...r,
    weight:Math.max(.2,r.weight + boost*(tierBoost[r.id]||0))
  }));
  return chooseWeighted(entries);
}

function rollAffixValue(def, depth, rarity){
  const scale=1+Math.max(0,depth-1)*.025;
  const t=Math.random();
  const raw=def.min+(def.max-def.min)*t;
  const value=raw*scale*(rarity.mult||1);
  return Number.isInteger(def.min)&&Number.isInteger(def.max)?Math.max(1,Math.round(value)):Math.round(value*1000)/1000;
}

function pickUniqueAffixes(count){
  const pool=[...(window.GameCatalog?.affixes||[])];
  const out=[];
  while(pool.length&&out.length<count){
    const idx=rand(0,pool.length-1);
    out.push(pool.splice(idx,1)[0]);
  }
  return out;
}

function applyAffixToItem(item, affix, value){
  item.affixes.push({id:affix.id,name:affix.name,stat:affix.stat,value});
  if(affix.stat==='attack') item.attack+=value;
  else if(affix.stat==='defense') item.defense+=value;
  else if(affix.stat==='hp') item.hp+=value;
  else if(affix.stat==='crit') item.crit+=value;
  else if(affix.stat==='haste') item.haste+=value;
  else item.extraStats[affix.stat]=(item.extraStats[affix.stat]||0)+value;
}

function dropLoot(source){
  const slot=pick(SLOTS), rarity=rollRarity(source), depth=state.floor;
  const bases=window.GameCatalog?.bases?.[slot]||[];
  const baseName=bases.length?pick(bases):SLOT_META[slot].name;
  const base=3+depth*1.55;
  const item={
    id:`${Date.now()}-${Math.random()}`,
    uid:`gear-${depth}-${Math.random().toString(36).slice(2,10)}`,
    seed:Math.floor(Math.random()*0x7fffffff),
    slot, rarity:rarity.id, rarityName:rarity.name,
    name:itemName(slot,rarity.id,baseName),
    baseName,
    attack:0,defense:0,hp:0,crit:0,haste:0,
    extraStats:{},affixes:[],legendaryEffect:null,source
  };

  const statRoll=Math.round(base*rarity.mult*rand(85,120)/100);
  if(slot==='weapon') item.attack=statRoll+2;
  else if(slot==='armor'||slot==='helm') { item.defense=Math.round(statRoll*.65); item.hp=statRoll*2; }
  else if(slot==='boots') { item.defense=Math.round(statRoll*.35); item.haste=.02+statRoll*.001; }
  else { item.attack=Math.round(statRoll*.45); item.crit=.015+statRoll*.0008; }

  const range=rarity.affixes||[0,1];
  const affixCount=rand(range[0],range[1]);
  for(const def of pickUniqueAffixes(affixCount)){
    applyAffixToItem(item,def,rollAffixValue(def,depth,rarity));
  }

  if(rarity.legendary){
    const legendaryPool=window.GameCatalog?.legendaries||[];
    if(legendaryPool.length) item.legendaryEffect={...pick(legendaryPool)};
  }

  item.score=Math.round(
    item.attack*2 + item.defense*1.45 + item.hp*.18 + item.crit*100 + item.haste*70 +
    Object.values(item.extraStats).reduce((s,v)=>s+(typeof v==='number'?Math.abs(v)*18:0),0) +
    (item.legendaryEffect?42:0)
  );

  state.loot.unshift(item); state.loot=state.loot.slice(0,80);
  if(els.autoEquip.checked) tryAutoEquip(item);
  floating(`${rarity.name} ${item.name}`,['common','uncommon'].includes(rarity.id)?'good':'rare');
}

function itemName(slot,rarity,baseName){
  const prefix={common:'',uncommon:'精制·',rare:'稀有·',epic:'史诗·',legendary:'传奇·'}[rarity]||'';
  return prefix+(baseName||SLOT_META[slot].name);
}

function tryAutoEquip(item){
  const cur=state.player.equipment[item.slot];
  if(!cur || item.score>cur.score){ state.player.equipment[item.slot]=item; toast(`自动换装：${item.name} ↑`); }
}

function enterExit(){
  if(!state.floorBossDefeated) return;
  state.intentText='进入下一层…';
  const oldDepth=zoneDepth();
  if(oldDepth===10){
    const wasFinal=state.zoneIndex===ZONES.length-1;
    if(wasFinal){ toast('最终区域完成：开启无尽轮回远征'); }
    state.zoneIndex=(state.zoneIndex+1)%ZONES.length;
  }
  state.floor++;
  const ps=playerStats(); state.player.hp=Math.min(ps.maxHp,state.player.hp+Math.round(ps.maxHp*.3));
  setTimeout(generateFloor,280);
}
