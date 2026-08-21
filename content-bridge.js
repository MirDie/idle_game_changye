(function(){
'use strict';

if(!window.FullContent) return;

const mappedZones = window.FullContent.zones.map(z => ({
  id:z.id,
  name:z.name,
  monsters:[...z.monsters],
  rares:[...z.rares],
  elites:[...z.elites],
  bosses:[...z.bosses, z.regionBoss],
  regionBoss:z.regionBoss,
  theme:z.theme,
  level:[...z.level]
}));

ZONES.splice(0,ZONES.length,...mappedZones);

const mappedRarities = window.FullContent.rarities.map(r => ({
  id:r.id,
  name:r.name,
  mult:r.mult,
  weight:r.weight,
  affixes:r.affixes,
  legendary:!!r.legendary
}));
RARITIES.splice(0,RARITIES.length,...mappedRarities);

window.GameCatalog = window.FullContent;
})();
