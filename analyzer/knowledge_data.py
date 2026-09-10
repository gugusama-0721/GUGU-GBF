# -*- coding: utf-8 -*-
"""示例知识库。

⚠️ 当前为演示用示例数据，用于跑通配队算法与战斗判断逻辑。
后续接入真实数据后，此文件应被"扩展从页面抓取 + 本地 JSON 库"取代。
"""

from .models import Character, Weapon, Summon, Raid


# ---------------- 角色库（示例） ----------------
def build_characters():
    return {
        "c_yuel": Character(
            id="c_yuel", name="尤艾尔", element="火",
            rarity="SSR", role="攻击",
            attack=11800, hp=1300,
            skill_effect="自身攻击大幅UP + 追伤",
            synergies=["c_valentine_clarisse"],
            tags=["攻刃", "追伤", "火属性"],
        ),
        "c_grande_noir": Character(
            id="c_grande_noir", name="黑蓝大刃(示例)", element="火",
            rarity="SSR", role="攻击",
            attack=12500, hp=1100,
            skill_effect="高额连击提升 + 破防",
            synergies=["c_yuel"],
            tags=["连击", "破防", "火属性"],
        ),
        "c_kumbhira": Character(
            id="c_kumbhira", name="镜海刃(示例)", element="土",
            rarity="SSR", role="防御",
            attack=10500, hp=1800,
            skill_effect="自身无敌 + 嘲讽",
            synergies=["c_medusa"],
            tags=["嘲讽", "生存", "土属性"],
        ),
        "c_scathacha": Character(
            id="c_scathacha", name="斯卡哈", element="水",
            rarity="SSR", role="攻击",
            attack=12200, hp=1150,
            skill_effect="奥义后全体连击UP",
            synergies=["c_lancelot"],
            tags=["奥义", "连击", "水属性"],
        ),
        "c_ss_shion": Character(
            id="c_ss_shion", name="紫苑(示例)", element="水",
            rarity="SSR", role="辅助",
            attack=9900, hp=1400,
            skill_effect="敌方弱体 + 我方攻击小UP",
            synergies=[],
            tags=["弱体", "辅助", "水属性"],
        ),
        "c_sarunan": Character(
            id="c_sarunan", name="萨鲁南(示例)", element="光",
            rarity="SSR", role="治疗",
            attack=8800, hp=1500,
            skill_effect="全体回复 + 净化",
            synergies=[],
            tags=["治疗", "净化", "光属性"],
        ),
        "c_harmen": Character(
            id="c_harmen", name="哈曼(示例)", element="暗",
            rarity="SSR", role="攻击",
            attack=12000, hp=1200,
            skill_effect="暗属性追伤 + 自残增伤",
            synergies=["c_harmen"],
            tags=["追伤", "暗属性"],
        ),
    }


# ---------------- 武器库（示例） ----------------
def build_weapons():
    return [
        Weapon(id="w_sword_fire", name="炎之圣剑(示例)", element="火",
               type="剑", attack=2900, hp=200,
               weapon_skill="诺恩大攻刃", skill_level=15, tags=["攻刃"]),
        Weapon(id="w_katana_fire", name="炎之刀(示例)", element="火",
               type="刀", attack=2700, hp=260,
               weapon_skill="大攻刃", skill_level=12, tags=["攻刃"]),
        Weapon(id="w_staff_fire", name="火杖(示例)", element="火",
               type="杖", attack=2400, hp=380,
               weapon_skill="守护", skill_level=10, tags=["防御"]),
        Weapon(id="w_gunstave_fire", name="火铳(示例)", element="火",
               type="铳", attack=2600, hp=240,
               weapon_skill="奥义受击蓄力", skill_level=8, tags=["奥义"]),
        Weapon(id="w_gs_fire", name="极圣剑(示例)", element="火",
               type="剑", attack=3050, hp=180,
               weapon_skill="大攻刃+进境", skill_level=15, tags=["攻刃", "进境"]),
        Weapon(id="w_dag_water", name="水短剑(示例)", element="水",
               type="短剑", attack=2750, hp=210,
               weapon_skill="大攻刃", skill_level=12, tags=["攻刃"]),
    ]


# ---------------- 召唤库（示例） ----------------
def build_summons():
    return [
        Summon(id="s_agnis", name="艾格尼丝(示例)", element="火",
               call_effect="火属性攻击大幅UP + 火属性角色攻刃UP", tags=["火属性", "攻刃"]),
        Summon(id="s_twin", name="双纹(示例)", element="火",
               call_effect="火属性追伤小UP", tags=["火属性", "追伤"]),
        Summon(id="s_tidus", name="提图斯(示例)", element="水",
               call_effect="水属性攻刃UP", tags=["水属性", "攻刃"]),
        Summon(id="s_flood", name="洪流(示例)", element="水",
               call_effect="我方全体弱体耐性UP", tags=["水属性", "防御"]),
        Summon(id="s_seraph", name="炽天使(示例)", element="火",
               call_effect="全属性角色伤害上限UP", tags=["全属性", "伤害"]),
    ]


# ---------------- 副本库（示例） ----------------
def build_raids():
    return {
        "raid_fire_dragon": Raid(
            id="raid_fire_dragon", name="火之龙HL", element="火",
            difficulty="HL", recommended_hp=1400,
            special_mechanics=["开场有防御UP", "55%血会特动", "OD后连击增强"],
            target_roles=["防御", "治疗"],
        ),
        "raid_primal_beast_water": Raid(
            id="raid_primal_beast_water", name="水之魔兽EX", element="水",
            difficulty="EX", recommended_hp=1000,
            special_mechanics=["会释放群体奥义"],
            target_roles=["辅助"],
        ),
        "raid_light_god": Raid(
            id="raid_light_god", name="光之神HL", element="光",
            difficulty="HL", recommended_hp=2600,
            special_mechanics=["奥义封印", "高额单点伤害"],
            target_roles=["治疗", "防御"],
        ),
    }


def build_all():
    return {
        "characters": build_characters(),
        "weapons": build_weapons(),
        "summons": build_summons(),
        "raids": build_raids(),
    }