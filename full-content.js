(function(){
'use strict';

const CLASSES = [
  { id:'warrior', name:'战士', resource:'怒气', role:'近战坦攻', base:{hp:130,attack:12,defense:6,crit:.05,haste:1}, talents:['盾击','裂甲斩','战斗怒吼','旋风斩','复仇','钢铁意志'] },
  { id:'rogue', name:'盗贼', resource:'连击点', role:'高速爆发', base:{hp:94,attack:14,defense:3,crit:.12,haste:1.12}, talents:['影袭','毒刃','伏击','割裂','烟幕','处决'] },
  { id:'mage', name:'法师', resource:'法力', role:'远程法术', base:{hp:82,attack:17,defense:2,crit:.08,haste:1}, talents:['火球术','寒冰箭','奥术飞弹','灼烧','冰障','陨石'] },
  { id:'cleric', name:'牧师', resource:'信仰', role:'续航反击', base:{hp:108,attack:10,defense:5,crit:.05,haste:1}, talents:['惩击','圣光术','祝福','神圣护盾','审判','复苏'] },
  { id:'ranger', name:'游侠', resource:'专注', role:'远程持续', base:{hp:98,attack:13,defense:4,crit:.10,haste:1.08}, talents:['速射','穿透箭','猎人印记','多重射击','翻滚','鹰眼'] }
];

const ZONES = [
  { id:'grassland', name:'晨风草原', level:[1,10], theme:'grass', monsters:['草原野狼','尖角野猪','苔皮史莱姆','荒原盗匪','风羽秃鹫','石背蜥'], rares:['白鬃猎手','雷角兽'], elites:['荒原冠军','巨牙战猪','风暴萨满'], bosses:['草原暴君','雷鸣巨角','野狼王后','荒野巨像'], regionBoss:'风暴酋长·赫鲁恩' },
  { id:'forest', name:'低语森林', level:[11,20], theme:'forest', monsters:['腐叶史莱姆','荆棘哥布林','迷雾蜘蛛','月影狼','毒蕈兽','树根傀儡'], rares:['银枝鹿','夜行猎手'], elites:['孢子卫士','古树先锋','荆棘女巫'], bosses:['古木守卫','腐化鹿王','狼群之母','孢子巨像'], regionBoss:'腐根之主·莫尔萨' },
  { id:'mine', name:'荒芜矿坑', level:[21,30], theme:'mine', monsters:['矿坑鼠人','碎岩魔','铁甲甲虫','失控矿工','晶洞蝙蝠','蒸汽傀儡'], rares:['黄金吞噬虫','黑曜钻兽'], elites:['赤铁督军','爆破疯徒','晶甲巨虫'], bosses:['钻岩暴君','矿脉吞噬者','坍塌之心','深井监工'], regionBoss:'地脉巨兽·格罗姆' },
  { id:'graveyard', name:'沉眠墓园', level:[31,40], theme:'grave', monsters:['骨兵','游魂','墓穴犬','腐化祭司','尸鸦','缝合尸'], rares:['白烛幽灵','无面守墓人'], elites:['白骨主教','哀嚎女妖','黑棺骑士'], bosses:['墓园看守','无首骑士','血月亡魂','棺椁之王'], regionBoss:'葬歌女王·赛琳' },
  { id:'snowpass', name:'霜脊雪关', level:[41,50], theme:'snow', monsters:['冰牙狼','雪原巨熊','冻骨亡者','寒霜鹰','冰晶元素','雪盗'], rares:['极光灵狐','白角猛犸'], elites:['霜甲卫士','冰脉术士','雪崩巨兽'], bosses:['寒风领主','冰川吞噬者','白霜女巫','雪峰巨人'], regionBoss:'永冬之眼·卡尔萨' },
  { id:'lavacave', name:'熔火裂谷', level:[51,60], theme:'lava', monsters:['熔岩蜥','火腹魔','灰烬犬','焦骨兵','炎晶虫','岩浆傀儡'], rares:['赤焰凤凰','熔核幼龙'], elites:['熔火督军','焦土先知','赤铁巨像'], bosses:['炎狱暴君','熔核吞噬者','灰烬女王','火山之心'], regionBoss:'赤焰巨龙·瓦鲁克' },
  { id:'skyruins', name:'天穹遗迹', level:[61,70], theme:'sky', monsters:['风元素','遗迹守卫','雷羽鹰','浮空水母','星辉傀儡','裂空猎手'], rares:['苍穹鲸灵','雷霆狮鹫'], elites:['星界执政官','雷铸卫士','风暴使徒'], bosses:['天穹监察者','雷鸣巨像','星辉吞噬者','浮岛核心'], regionBoss:'苍穹裁决者·阿斯特' },
  { id:'darkcastle', name:'魔王城', level:[71,80], theme:'dark', monsters:['魔城近卫','暗影猎犬','深渊术士','诅咒铠甲','血翼魔','虚空仆从'], rares:['暗月刺客','深渊凝视者'], elites:['黑曜将军','猩红主教','虚空骑士'], bosses:['魔城典狱长','深渊魔像','血月伯爵','黑冠执政官'], regionBoss:'终焉魔王·阿尔凯恩' }
];

const BASES = {
  weapon:['铁旅长剑','弧月短刃','白蜡法杖','圣徽战锤','山隼长弓','黑钢巨剑','星银匕首','龙骨权杖'],
  helm:['皮革兜帽','铁环头盔','符文冠帽','祷告兜帽','猎鹰面罩','黑钢重盔','星纹头环','龙骨冠冕'],
  armor:['旅者皮甲','锁子胸甲','秘法长袍','圣堂链甲','游猎夹克','黑钢板甲','星银法衣','龙鳞战衣'],
  boots:['旧皮靴','铁钉战靴','秘法软靴','圣印长靴','追猎短靴','黑钢胫甲','星行长靴','龙骨踏靴'],
  charm:['磨损护符','铜制徽章','法力晶核','祈光圣物','鹰眼吊坠','黑曜印戒','星辉坠饰','龙心护符']
};

const AFFIXES = [
  {id:'power',name:'力量',stat:'attack',min:2,max:18}, {id:'guard',name:'守御',stat:'defense',min:1,max:14},
  {id:'vigor',name:'强健',stat:'hp',min:8,max:90}, {id:'keen',name:'锐利',stat:'crit',min:.01,max:.09},
  {id:'swift',name:'迅捷',stat:'haste',min:.02,max:.16}, {id:'ferocity',name:'残暴',stat:'critDamage',min:.08,max:.42},
  {id:'leech',name:'汲取',stat:'lifesteal',min:.01,max:.08}, {id:'regen',name:'再生',stat:'regen',min:1,max:12},
  {id:'block',name:'格挡',stat:'block',min:.02,max:.14}, {id:'dodge',name:'闪避',stat:'dodge',min:.02,max:.12},
  {id:'fire',name:'烈焰',stat:'fireDamage',min:.04,max:.24}, {id:'frost',name:'寒霜',stat:'frostDamage',min:.04,max:.24},
  {id:'storm',name:'雷霆',stat:'stormDamage',min:.04,max:.24}, {id:'poison',name:'剧毒',stat:'poisonDamage',min:.04,max:.24},
  {id:'bossbane',name:'弑王',stat:'bossDamage',min:.05,max:.30}, {id:'elitebane',name:'猎首',stat:'eliteDamage',min:.05,max:.28},
  {id:'gold',name:'贪婪',stat:'goldFind',min:.05,max:.45}, {id:'magicfind',name:'寻珍',stat:'magicFind',min:.03,max:.30},
  {id:'xp',name:'求知',stat:'xpGain',min:.05,max:.35}, {id:'execute',name:'处决',stat:'execute',min:.03,max:.18},
  {id:'barrier',name:'壁垒',stat:'barrier',min:5,max:70}, {id:'thorns',name:'荆棘',stat:'thorns',min:1,max:20},
  {id:'cooldown',name:'流转',stat:'cooldown',min:.02,max:.16}, {id:'resource',name:'充盈',stat:'resourceGain',min:.05,max:.30}
];

const LEGENDARIES = [
  {id:'bloodmoon',name:'血月契约',text:'生命低于35%时伤害和吸血大幅提升'},
  {id:'stormchain',name:'雷链回响',text:'暴击有概率跳跃攻击额外敌人'},
  {id:'iceheart',name:'冰心壁垒',text:'受到重击时生成护盾并减速敌人'},
  {id:'embercore',name:'余烬核心',text:'持续战斗会逐层提高火焰伤害'},
  {id:'shadowstep',name:'影步',text:'闪避后下一击必定暴击'},
  {id:'huntermark',name:'猎王印记',text:'对Boss持续攻击会叠加易伤'},
  {id:'saintlight',name:'圣光回响',text:'治疗溢出转化为短时护盾'},
  {id:'ironwall',name:'钢铁壁垒',text:'格挡成功后暂时提高防御'},
  {id:'executioner',name:'终结者',text:'敌人低生命时处决阈值提高'},
  {id:'treasureblood',name:'寻宝者之血',text:'开启宝箱后短时提高稀有掉率'},
  {id:'arcaneecho',name:'奥术回声',text:'技能有概率立即重复一次弱化版本'},
  {id:'poisonbloom',name:'毒花绽放',text:'毒层数达到上限时引爆范围伤害'},
  {id:'berserker',name:'狂战脉搏',text:'连续击杀提高攻速，脱战后衰减'},
  {id:'guardianangel',name:'守护灵',text:'每层首次致死伤害改为保留1点生命'},
  {id:'starfall',name:'群星坠落',text:'精英/Boss战定期降下星辉打击'},
  {id:'abysscrown',name:'深渊王冠',text:'每击败一个Boss永久提高本轮伤害'}
];

const RARITIES = [
  {id:'common',name:'普通',weight:58,mult:1,affixes:[0,1]},
  {id:'uncommon',name:'优秀',weight:25,mult:1.16,affixes:[1,2]},
  {id:'rare',name:'稀有',weight:11,mult:1.40,affixes:[2,3]},
  {id:'epic',name:'史诗',weight:5,mult:1.78,affixes:[3,4]},
  {id:'legendary',name:'传奇',weight:1,mult:2.35,affixes:[4,5],legendary:true}
];

const ACHIEVEMENTS = [
  ['first_blood','初次讨伐','击败第一只怪物'],['boss_1','首领猎人','击败第一个Boss'],['boss_25','弑王者','累计击败25个Boss'],
  ['legendary_1','金光乍现','获得第一件传奇装备'],['legendary_20','传奇收藏家','累计获得20件传奇装备'],
  ['floor_10','深入地底','到达第10层'],['floor_50','无尽远征','到达第50层'],['zone_8','魔城来客','进入最终区域'],
  ['treasure_50','宝箱猎人','开启50个宝箱'],['elite_100','精英克星','击败100个精英'],
  ['wealth_1m','百万富翁','累计获得100万金币'],['class_master','职业大师','将任一职业升至80级']
].map(([id,name,text])=>({id,name,text}));

const WEATHER = [
  {id:'clear',name:'晴朗',move:1,combat:1},
  {id:'rain',name:'暴雨',move:.92,combat:.98},
  {id:'fog',name:'浓雾',move:.90,combat:.96},
  {id:'snow',name:'风雪',move:.86,combat:.95},
  {id:'storm',name:'雷暴',move:.88,combat:1.04}
];

window.FullContent = Object.freeze({
  version:1,
  classes:CLASSES,
  zones:ZONES,
  bases:BASES,
  affixes:AFFIXES,
  legendaries:LEGENDARIES,
  rarities:RARITIES,
  achievements:ACHIEVEMENTS,
  weather:WEATHER
});
})();
