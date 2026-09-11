# -*- coding: utf-8 -*-
"""配队算法引擎。

输入：玩家拥有的角色/武器/召唤 + 目标副本
输出：一份推荐的队伍编成 + 策略说明
"""

from itertools import combinations

from .models import Element, Party, Character, Weapon
from .knowledge_data import build_all


# 属性克制关系表：key 表示"我方的属性"，value 为"被克制（克制的敌方属性）"
ELEMENT_ADVANTAGE = {
    Element.FIRE.value: Element.WIND.value,
    Element.WATER.value: Element.FIRE.value,
    Element.EARTH.value: Element.WATER.value,
    Element.WIND.value: Element.EARTH.value,
    Element.LIGHT.value: None,  # 光/暗互相不克制对敌
    Element.DARK.value: None,
}


def element_multiplier(my_element: str, enemy_element: str) -> float:
    """我方属性对敌方属性的伤害倍率，用于评分。"""
    try:
        enemy = Element(enemy_element)
    except ValueError:
        return 1.0
    if my_element not in {e.value for e in Element}:
        # 元素未知（真实列表接口暂缺元素字段）时给中性倍率
        return 1.0
    if my_element == Element.LIGHT.value or my_element == Element.DARK.value:
        # 光克暗事件可后续扩展；此示范中光暗按1.0处理
        return 1.0
    # 我方属性克制敌方 -> 1.5，被克 -> 0.75（简化）
    if ELEMENT_ADVANTAGE[my_element] == enemy.value:
        return 1.5
    return 0.75


class TeamBuilder:
    def __init__(self):
        kb = build_all()
        self.characters = kb["characters"]
        self.weapons = kb["weapons"]
        self.summons = kb["summons"]
        self.raids = kb["raids"]

    def load_from_store(self, characters: list, weapons: list, summons: list):
        """用扩展截获的真实数据覆盖内置示例库。

        characters/weapons/summons: api_parser.GbfApiParser.to_models() 产出的 model 对象。
        """
        if characters:
            self.characters = {c.id: c for c in characters}
        if weapons:
            self.weapons = list(weapons) if isinstance(weapons, list) else list(self.weapons)
        if summons:
            self.summons = list(summons) if isinstance(summons, list) else list(self.summons)

    # ---------- 角色选人评分 ----------
    def _score_character(self, ch: Character, raid, party_char_ids) -> float:
        score = 0.0
        # 1. 属性克制
        score += element_multiplier(ch.element, raid.element) * 30

        # 2. 基础攻击力
        score += ch.attack / 400.0

        # 3. 角色类型是否契合副本需求
        if "攻击" in ch.role and ("弱体" not in raid.special_mechanics):
            score += 10
        if ch.role in raid.target_roles:
            score += 20

        # 4. 生存能力（副本有高伤害机制时）
        if "生存" in ch.tags and ("特动" in " ".join(raid.special_mechanics)):
            score += 12
        if ch.rarity != "SSR":
            score -= 15

        # 5. 协同搭配
        for pid in party_char_ids:
            if pid in ch.synergies:
                score += 15

        return score

    def _select_characters(self, raid, count=3):
        """从玩家角色里选出评分最高的 count 个（不足则尽可能多选）。"""
        candidates = list(self.characters.values())
        if not candidates:
            return []
        n = min(count, len(candidates))
        ranked = sorted(
            candidates,
            key=lambda c: self._score_character(c, raid, []),
            reverse=True,
        )
        # 简单贪心 + 少量协同提升
        best_score = -1
        best_combo = None
        for combo in combinations(candidates, n):
            s = sum(self._score_character(c, raid, [x.id for x in combo]) for c in combo)
            # 加一点同属性一致性溢价
            elems = {c.element for c in combo}
            s += 25 if len(elems) == 1 else 0
            if s > best_score:
                best_score = s
                best_combo = combo
        return list(best_combo or [])

    # ---------- 武器盘构建 ----------
    def _build_weapons(self, main_character, count=6):
        """优先收集与主C同属性的攻刃武器，其次任意属性高攻武器。"""
        element = main_character.element
        owned = list(self.weapons)
        same_ele = [w for w in owned if w.element == element]
        other = [w for w in owned if w.element != element]
        same_ele.sort(key=lambda w: w.attack, reverse=True)
        other.sort(key=lambda w: w.attack, reverse=True)
        chosen = same_ele[:count]
        if len(chosen) < count:
            chosen += other[: count - len(chosen)]
        return chosen[:count]

    # ---------- 召唤选择 ----------
    def _select_summon(self, main_character, friend_element=None):
        """选择与主C同属性且带"攻刃"的召唤作为主召唤。"""
        for s in self.summons:
            if s.element == main_character.element and "攻刃" in s.tags:
                return s
        return self.summons[0] if self.summons else None

    # ---------- 对外主入口 ----------
    def build(self, raid_id: str, friend_summon=None) -> dict:
        raid = self.raids[raid_id]

        if raid.element == Element.FIRE.value:
            # 火副本 -> 推荐水属性（克制）
            pass

        chosen = self._select_characters(raid, 3)
        if not chosen:
            raise ValueError("玩家尚未解析到有效的角色数据")

        def _at(i, default=None):
            return chosen[i] if i < len(chosen) else default

        main = chosen[0]
        weapons = self._build_weapons(main)
        main_summon = self._select_summon(main)
        party = Party(
            main=main, sub=_at(1), third=_at(2),
            weapons=weapons, main_summon=main_summon,
        )

        # 收集推荐理由
        reasons = []
        weakest = min(chosen, key=lambda c: c.attack)
        strongest = max(chosen, key=lambda c: c.attack)
        reasons.append(f"主攻手「{strongest.name}」攻击力{strongest.attack}，是该副本站场核心输出。")
        # 属性克制说明
        for c in chosen:
            mult = element_multiplier(c.element, raid.element)
            if mult > 1.0:
                reasons.append(f"「{c.name}」属性克制敌方，伤害提升约1.5倍。")
        # 生存提示
        if any("特动" or "高额" in m for m in raid.special_mechanics):
            tank = [c for c in chosen if "生存" in c.tags or c.role == "防御"]
            if not tank:
                reasons.append(f"⚠️ 副本「{raid.name}」有高伤害机制，但当前没有生存/防御型角色，建议备上·生存角色。")

        return {
            "raid": raid,
            "party": party,
            "reasons": reasons,
        }


if __name__ == "__main__":
    tb = TeamBuilder()
    res = tb.build("raid_fire_dragon")
    p = res["party"]
    print("== 推荐编成 ==")
    print(f"【{res['raid'].name}】")
    print(f"  队员：{p.main.name} / {p.sub.name} / {p.third.name}")
    print(f"  武器：{[w.name for w in p.weapons]}")
    print(f"  召唤：{p.main_summon.name if p.main_summon else '无'}")
    print(f"  总攻：{p.total_attack()}")
    for r in res["reasons"]:
        print(" -", r)