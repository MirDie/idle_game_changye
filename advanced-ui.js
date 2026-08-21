(function(){
'use strict';

const weatherName={clear:'晴朗',rain:'暴雨',fog:'浓雾',snow:'风雪',storm:'雷暴'};
const classIcon={warrior:'⚔',rogue:'◆',mage:'✦',cleric:'✚',ranger:'➶'};
let selectedClass=state.meta.classId||'warrior';

function esc(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtValue(a){
  if(typeof a.value!=='number') return a.value;
  if(Math.abs(a.value)<1) return `${Math.round(a.value*100)}%`;
  return Math.round(a.value).toString();
}
function modal(title,body){
  closeModal();
  const root=document.createElement('div'); root.id='system-modal'; root.className='system-modal';
  root.innerHTML=`<section class="system-sheet"><div class="sheet-head"><h2>${esc(title)}</h2><button class="sheet-close">关闭</button></div>${body}</section>`;
  root.querySelector('.sheet-close').addEventListener('click',closeModal);
  root.addEventListener('click',e=>{if(e.target===root)closeModal();}); document.body.appendChild(root); return root;
}
function closeModal(){ document.getElementById('system-modal')?.remove(); }

function itemDetail(item){
  if(!item) return '<small>空</small>';
  const aff=(item.affixes||[]).map(a=>`<div class="affix-line">${esc(a.name)} +${fmtValue(a)}</div>`).join('');
  const leg=item.legendaryEffect?`<small class="legendary-text">◆ ${esc(item.legendaryEffect.name)}：${esc(item.legendaryEffect.text)}</small>`:'';
  return `<strong class="rarity-${item.rarity}">${esc(item.name)}</strong><small>${esc(item.rarityName)} · 战力 ${item.score}</small>${aff}${leg}`;
}

function showInventory(){
  const slots=SLOTS.map(slot=>{
    const item=state.player.equipment[slot];
    return `<div class="ui-card"><div class="ui-row"><div><small>${esc(SLOT_META[slot].name)}</small>${itemDetail(item)}</div><button class="ui-btn" data-reforge="${slot}" ${item?'':'disabled'}>重铸</button></div></div>`;
  }).join('');
  const recent=state.loot.slice(0,30).map(item=>`<div class="ui-card">${itemDetail(item)}<small>来源：${esc(sourceName(item.source))}</small></div>`).join('')||'<div class="ui-card"><small>背包暂无装备。</small></div>';
  const root=modal('装备与背包',`<div class="ui-card"><div class="ui-row"><span>重铸石</span><b>${state.meta.reforgeTokens||0}</b></div><small>无重铸石时可消耗 2 Boss 精华。</small></div><h3>已装备</h3><div class="ui-list">${slots}</div><h3>最近掉落</h3><div class="ui-list">${recent}</div>`);
  root.querySelectorAll('[data-reforge]').forEach(btn=>btn.addEventListener('click',()=>{
    const r=window.AdvancedGame.reforge(btn.dataset.reforge);
    if(r.ok){toast(`重铸完成：${r.item.name}`);showInventory();}else toast(r.reason==='cost'?'需要 1 重铸石或 2 Boss 精华':'该槽位没有装备');
  }));
}

function showTalents(){
  const classes=window.AdvancedGame.classes.map(c=>`<button class="ui-btn ${c.id===state.meta.classId?'primary':''}" data-class="${c.id}">${classIcon[c.id]||'•'} ${esc(c.name)}</button>`).join('');
  const cards=window.AdvancedGame.talentList().map((t,i)=>{
    const lv=window.AdvancedGame.talentLevel(i);
    return `<div class="ui-card"><div class="ui-row"><div><strong>${esc(t.name)} <span class="tagline">${lv}/${t.max}</span></strong><small>${esc(t.desc)}</small></div><button class="ui-btn primary" data-talent="${i}" ${state.meta.talentPoints<=0||lv>=t.max?'disabled':''}>+</button></div></div>`;
  }).join('');
  const root=modal('职业与 Talent',`<div class="ui-card"><div class="ui-row"><div><strong>${esc((window.AdvancedGame.classes.find(c=>c.id===state.meta.classId)||{}).name||'战士')}</strong><small>剩余 Talent 点：${state.meta.talentPoints||0}</small></div><span>${classIcon[state.meta.classId]||'⚔'}</span></div><div class="ui-actions">${classes}</div></div><div class="ui-list">${cards}</div>`);
  root.querySelectorAll('[data-class]').forEach(b=>b.addEventListener('click',()=>{window.AdvancedGame.selectClass(b.dataset.class);toast(`职业切换为 ${(window.AdvancedGame.classes.find(c=>c.id===b.dataset.class)||{}).name}`);showTalents();}));
  root.querySelectorAll('[data-talent]').forEach(b=>b.addEventListener('click',()=>{if(window.AdvancedGame.spendTalent(Number(b.dataset.talent)))showTalents();}));
}

function shopCost(id){ return ({potion:30+state.floor*4,reforge:90+state.floor*9,gear:120+state.floor*14,talent:260+state.floor*20})[id]; }
function showShop(){
  const rows=[
    ['potion','补给药水 ×3','用于后续主动恢复与自动保命'],['reforge','重铸石 ×1','重新生成一件已装备物的词缀'],['gear','远征装备箱','立即获得一件当前深度装备'],['talent','战斗手册','获得 1 Talent 点并自动分配']
  ].map(([id,n,d])=>`<div class="ui-card"><div class="ui-row"><div><strong>${n}</strong><small>${d}</small></div><b class="shop-price">${shopCost(id)}G</b></div><div class="ui-actions"><button class="ui-btn primary" data-buy="${id}">购买</button></div></div>`).join('');
  const mats=Object.entries(state.meta.materials||{}).map(([k,v])=>`<span>${esc(k)} ×${v}</span>`).join(' · ')||'暂无区域材料';
  const root=modal('营地商店',`<div class="ui-card"><div class="ui-row"><span>金币</span><b>${state.gold.toLocaleString()} G</b></div><small>${mats}</small></div><div class="ui-list">${rows}</div>`);
  root.querySelectorAll('[data-buy]').forEach(b=>b.addEventListener('click',()=>{const r=window.AdvancedGame.buyShop(b.dataset.buy);toast(r.ok?`购买成功 -${r.cost}G`:`金币不足，需要 ${r.cost}G`);showShop();}));
}

function showAchievements(){
  const list=(window.GameCatalog?.achievements||[]).map(a=>{
    const unlocked=!!state.meta.achievements?.[a.id];
    return `<div class="ui-card"><div class="ui-row"><div><strong>${unlocked?'✓ ':'○ '}${esc(a.name)}</strong><small>${esc(a.text)}</small></div><span>${unlocked?'已完成':'未完成'}</span></div></div>`;
  }).join('');
  modal('成就',`<div class="ui-list">${list}</div>`);
}

function showSettings(){
  const s=state.meta.combatStrategy||'balanced';
  const buttons=[['safe','稳健'],['balanced','均衡'],['aggressive','激进']].map(([id,n])=>`<button class="ui-btn ${s===id?'primary':''}" data-combat="${id}">${n}</button>`).join('');
  const w=weatherName[state.meta.weather]||state.meta.weather;
  const root=modal('远征设置',`<div class="ui-card"><strong>战斗策略 <span class="weather-chip">天气：${esc(w)}</span></strong><small>稳健降低受到的伤害；激进提高输出速度但承受更多伤害。</small><div class="ui-actions">${buttons}</div></div><div class="ui-card"><div class="ui-row"><span>自动换装</span><b>${els.autoEquip.checked?'开启':'关闭'}</b></div><div class="ui-actions"><button class="ui-btn" id="toggleAutoEquip">切换</button></div></div><div class="ui-card"><strong>存档</strong><small>主档 + 备份档，15 秒自动保存；页面隐藏和关键战斗会立即保存。</small><div class="ui-actions"><button class="ui-btn" id="saveNow">立即保存</button></div></div>`);
  root.querySelectorAll('[data-combat]').forEach(b=>b.addEventListener('click',()=>{window.AdvancedGame.setCombatStrategy(b.dataset.combat);showSettings();}));
  root.querySelector('#toggleAutoEquip').addEventListener('click',()=>{els.autoEquip.checked=!els.autoEquip.checked;toast(els.autoEquip.checked?'自动换装已开启':'自动换装已关闭');showSettings();});
  root.querySelector('#saveNow').addEventListener('click',()=>{window.GridIdleMeta.saveGame('manual');toast('已保存');});
}

function showWorldInfo(){
  const z=currentZone();
  const boss=z.regionBoss||'未知';
  const materials=Object.entries(state.meta.materials||{}).map(([k,v])=>`${k}×${v}`).join(' · ')||'暂无';
  modal('远征档案',`<div class="stat-grid"><div class="stat-box"><span>区域</span><b>${esc(z.name)}</b></div><div class="stat-box"><span>层数</span><b>${state.floor}</b></div><div class="stat-box"><span>击杀</span><b>${state.kills}</b></div><div class="stat-box"><span>Boss</span><b>${state.meta.stats.bosses||0}</b></div></div><div class="ui-card"><strong>区域 Boss：${esc(boss)}</strong><small>本区第 10 层出现。门卫必须先被击败。</small></div><div class="ui-card"><strong>材料</strong><small>${esc(materials)}</small></div>`);
}

function makeDock(){
  document.getElementById('system-dock')?.remove();
  const nav=document.createElement('nav');nav.id='system-dock';
  const items=[['world','远征'],['bag','装备'],['talent','Talent'],['shop','商店'],['ach','成就'],['settings','设置']];
  nav.innerHTML=items.map(([id,n])=>`<button data-panel="${id}">${n}</button>`).join('');
  nav.addEventListener('click',e=>{
    const id=e.target.closest('[data-panel]')?.dataset.panel;if(!id)return;
    ({world:showWorldInfo,bag:showInventory,talent:showTalents,shop:showShop,ach:showAchievements,settings:showSettings}[id])();
  });
  document.body.appendChild(nav);
}

function titleOverlay(){
  if(localStorage.getItem('grid_idle_profile_started')) return;
  state.running=false;
  const hasSave=!!localStorage.getItem('grid_idle_save_v2');
  const root=document.createElement('div');root.className='title-overlay';root.id='title-overlay';
  root.innerHTML=`<div class="title-card"><div class="tagline">FANTASY GRID EXPEDITION</div><h1>幻境远征</h1><p>6×6 自动探索 · 放置刷宝 RPG</p><div class="class-grid">${window.AdvancedGame.classes.map(c=>`<button class="class-choice ${c.id===selectedClass?'selected':''}" data-start-class="${c.id}"><b>${classIcon[c.id]||'•'}</b>${esc(c.name)}</button>`).join('')}</div><div class="profile-summary">选择职业后开始。五职业拥有不同基础属性、技能节奏和 Talent 构筑。世界由 8 个区域组成，每区 10 层，第 10 层为区域 Boss。</div><button class="ui-btn primary" id="startGame">${hasSave?'继续 / 载入远征':'开始新游戏'}</button></div>`;
  root.querySelectorAll('[data-start-class]').forEach(b=>b.addEventListener('click',()=>{selectedClass=b.dataset.startClass;root.querySelectorAll('[data-start-class]').forEach(x=>x.classList.toggle('selected',x===b));}));
  root.querySelector('#startGame').addEventListener('click',()=>{window.AdvancedGame.selectClass(selectedClass);localStorage.setItem('grid_idle_profile_started','1');state.running=true;root.remove();toast('远征开始');});
  document.body.appendChild(root);
}

function showEnding(){
  closeModal();
  const s=window.AdvancedGame.summary(); state.running=false;
  const root=document.createElement('div');root.className='title-overlay';root.id='ending-overlay';
  root.innerHTML=`<div class="title-card"><div class="tagline">EXPEDITION COMPLETE</div><h1 class="ending-title">魔王城陷落</h1><p>你完成了八区域远征，但装备与无尽深层仍会继续成长。</p><div class="stat-grid"><div class="stat-box"><span>等级</span><b>Lv.${s.level}</b></div><div class="stat-box"><span>总击杀</span><b>${s.kills}</b></div><div class="stat-box"><span>Boss</span><b>${s.bosses}</b></div><div class="stat-box"><span>传奇</span><b>${s.legendaries}</b></div></div><div class="profile-summary">晨风草原、低语森林、荒芜矿坑、沉眠墓园、霜脊雪关、熔火裂谷、天穹遗迹与魔王城的首轮路线已经完成。继续后进入无尽轮回。</div><button class="ui-btn primary" id="continueEndless">继续无尽远征</button></div>`;
  root.querySelector('#continueEndless').addEventListener('click',()=>{root.remove();window.AdvancedGame.continueAfterEnding();toast('无尽远征开启');});document.body.appendChild(root);
}

window.AdvancedUI={showInventory,showTalents,showShop,showAchievements,showSettings,showEnding,closeModal};
makeDock(); titleOverlay();
})();
