function renderGrid(){
  els.grid.innerHTML='';
  for(const tile of state.map){
    const div=document.createElement('div');
    div.className='tile '+(!tile.revealed?'fog':'revealed');
    if(tile.visited) div.classList.add('visited');
    if(tile.index===state.playerIndex) div.classList.add('current');
    if(tile.revealed && ['floorBoss','regionBoss','roamingBoss'].includes(tile.type)) div.classList.add('boss');
    if(tile.revealed && tile.type==='elite') div.classList.add('elite');
    if(tile.revealed && tile.type==='treasure') div.classList.add('treasure');
    if(tile.revealed && tile.type==='shrine') div.classList.add('shrine');
    if(tile.revealed && tile.type==='exit') div.classList.add('exit');
    if(tile.revealed){
      const icon=document.createElement('span'); icon.className='tile-icon'; icon.textContent=tile.cleared && tile.type!=='exit' ? '·' : tileIcon(tile); div.appendChild(icon);
      if(tile.type==='exit' && tile.locked){ const label=document.createElement('span');label.className='tile-label';label.textContent='锁';div.appendChild(label); }
    }
    if(tile.index===state.playerIndex){ const hero=document.createElement('span');hero.className='hero-token';hero.textContent='▲';div.appendChild(hero); }
    els.grid.appendChild(div);
  }
}

function renderHud(){
  const p=playerStats(); state.player.hp=Math.min(state.player.hp,p.maxHp);
  els.heroLevel.textContent=`Lv.${state.player.level}`; els.heroPower.textContent=`战力 ${p.power}`;
  els.heroHpFill.style.width=`${clamp(state.player.hp/p.maxHp*100,0,100)}%`; els.heroHpText.textContent=`${Math.max(0,Math.round(state.player.hp))} / ${p.maxHp}`;
  els.gold.textContent=state.gold.toLocaleString(); els.essence.textContent=state.essence.toLocaleString();
  els.zoneName.textContent=currentZone().name; els.floorName.textContent=`第 ${state.floor} 层`;
  els.exploredCount.textContent=state.explored.size; els.bossCount.textContent=state.bossesDefeated; els.bossTotal.textContent=state.bossesTotal;
  els.exitState.textContent=state.foundExit?(state.floorBossDefeated?'已开启':'已发现 · 封印中'):'未发现';
  els.exitProgress.style.width=`${state.foundExit?100:(state.explored.size/FLOOR_TILES*80)}%`;
  els.regionBossState.textContent=zoneDepth()===10?'本层区域 Boss':`还剩 ${10-zoneDepth()} 层`;
  els.regionProgress.style.width=`${zoneDepth()*10}%`;
}

function renderCombat(){
  const c=state.combat;
  if(!c){ els.combatCard.classList.add('hidden'); return; }
  els.combatCard.classList.remove('hidden');
  const kindName={normal:'普通遭遇',elite:'精英遭遇',roamingBoss:'巡游 Boss',floorBoss:'楼层 Boss',regionBoss:'区域 Boss'}[c.enemy.kind];
  els.enemyKind.textContent=kindName; els.enemyName.textContent=c.enemy.name;
  els.enemyBadge.textContent=c.enemy.boss?'BOSS':(c.enemy.kind==='elite'?'ELITE':'MONSTER');
  els.enemyHpFill.style.width=`${clamp(c.enemy.hp/c.enemy.maxHp*100,0,100)}%`;
  els.enemyHpText.textContent=`${Math.max(0,Math.ceil(c.enemy.hp))} / ${c.enemy.maxHp}`;
  const sec=Math.max(.1,(performance.now()-c.startedAt)/1000); els.dpsText.textContent=`${Math.round(c.damageDone/sec)} DPS`;
}

function renderEquipment(){
  els.equipmentSlots.innerHTML='';
  for(const slot of SLOTS){
    const meta=SLOT_META[slot], item=state.player.equipment[slot];
    const div=document.createElement('div'); div.className='slot '+(item?.rarity||'');
    div.innerHTML=`<div class="icon">${meta.icon}</div><small>${meta.name}</small><strong>${item?item.name:'空'}</strong><div class="power">${item?'+'+item.score:'--'}</div>`;
    els.equipmentSlots.appendChild(div);
  }
}

function renderLoot(){
  els.bagCount.textContent=`${state.loot.length} 件`;
  els.lootFeed.innerHTML='';
  const recent=state.loot.slice(0,10);
  if(!recent.length){ els.lootFeed.innerHTML='<div class="muted">尚未获得装备。继续探索格子。</div>'; return; }
  for(const item of recent){
    const row=document.createElement('div'); row.className=`loot-row ${item.rarity}`;
    row.innerHTML=`<div class="loot-icon">${SLOT_META[item.slot].icon}</div><div><strong>${item.name}</strong><small>${item.rarityName} · ${SLOT_META[item.slot].name} · ${sourceName(item.source)}</small></div><div class="score">${item.score}</div>`;
    els.lootFeed.appendChild(row);
  }
}

function sourceName(source){ return ({normal:'怪物',elite:'精英',roamingBoss:'巡游Boss',floorBoss:'楼层Boss',regionBoss:'区域Boss',treasure:'宝箱'})[source]||'掉落'; }

function renderAll(){ renderGrid(); renderHud(); renderCombat(); renderEquipment(); renderLoot(); els.intentText.textContent=state.intentText||'自动探索中'; }

function floating(text,cls='good'){
  const d=document.createElement('div');d.className=`float-item ${cls}`;d.textContent=text;els.floatingText.appendChild(d);setTimeout(()=>d.remove(),1100);
}
function toast(text){ const d=document.createElement('div');d.className='toast';d.textContent=text;els.toastRoot.appendChild(d);setTimeout(()=>d.remove(),2450); }

function mainLoop(now){
  if(state.running){
    if(state.combat){ if(now>=state.nextCombatAt){ combatTick(now); state.nextCombatAt=now+COMBAT_TICK_MS/state.speed; } }
    else if(now>=state.nextMoveAt){ moveOne(); state.nextMoveAt=now+TICK_MS/state.speed; }
  }
  requestAnimationFrame(mainLoop);
}

els.pauseBtn.addEventListener('click',()=>{ state.running=!state.running; els.pauseBtn.textContent=state.running?'暂停探索':'继续探索'; state.intentText=state.running?'恢复自动探索':'探索已暂停'; renderAll(); });
els.resetBtn.addEventListener('click',()=>{ const ps=playerStats(); state.player.hp=ps.maxHp; generateFloor(); });
els.strategyBtn.addEventListener('click',()=>{
  const order=['balanced','boss','loot']; const names={balanced:'均衡',boss:'猎杀 Boss',loot:'寻宝'}; const i=(order.indexOf(state.strategy)+1)%order.length; state.strategy=order[i];
  els.strategyBtn.textContent=`策略：${names[state.strategy]}`; toast(`自动探索策略切换为：${names[state.strategy]}`);
});
document.querySelectorAll('[data-speed]').forEach(btn=>btn.addEventListener('click',()=>{
  state.speed=Number(btn.dataset.speed); document.querySelectorAll('[data-speed]').forEach(b=>b.classList.toggle('active',b===btn)); toast(`探索速度 ${state.speed}×`);
}));
els.autoEquip.addEventListener('change',()=>toast(els.autoEquip.checked?'自动换装已开启':'自动换装已关闭'));

state.intentText='开始自动探索';
generateFloor();
requestAnimationFrame(mainLoop);
