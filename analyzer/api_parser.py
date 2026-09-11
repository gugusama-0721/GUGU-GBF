# -*- coding: utf-8 -*-
"""GBF 真实接口 JSON 解析器。

将 GBF 网络接口返回的结构映射为 models 中的角色/武器/召唤对象。

支持接口：
  - npc/list/{page}              角色（GBF 内部称 NPC）
  - listall/content/index        武器
  - summon/list/{page}           召唤

返回统一结构：{ count, current, last, list: [{ master, param }] }
分页：current / next / last
"""

import json

from .models import (
    Character, Weapon, Summon,
    Element, WeaponType, Role,
)

# ---------- 通用武器适性编号映射（GBF specialty） ----------
# key=接口里的数值字符串, value=WeaponType 的 value。
# 若与实际不符，只需调整这里，无需改解析逻辑。
WEAPON_TYPE_BY_SPECIALTY = {
    "1": "短剑",
    "2": "剑",
    "3": "杖",
    "4": "铳",
    "5": "格斗",
    "6": "枪",
    "7": "刀",
    "8": "弓",
    "9": "斧",
    "10": "矛",
}

# 稀有度数值 -> 文本（接口里 4 通常为 SSR）
RARITY_BY_ID = {
    "3": "SR",
    "4": "SSR",
    "5": "SSR",
    "1": "R",
}

# 属性：GBF 里元素通过专门字段名（e.g. 角色 param 无元素，需从 detail 或母库补。
# 当前从读取的数据仅能拿到 attack/hp/number，元素信息需后续补充。
ELEMENT_MAP = {
    1: "火", 2: "水", 3: "土", 4: "风", 5: "光", 6: "暗",
}


def _parse_int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


class GbfApiParser:
    """解析一份接口返回（dict），产出数据列表。"""

    def __init__(self, url: str, payload: dict):
        self.url = url
        self.payload = payload
        self.kind = self._detect_kind()

    # ---------- 判定数据类型 ----------
    def _detect_kind(self):
        u = self.url
        if "/npc/list/" in u:
            return "character"
        if "/summon/list/" in u:
            return "summon"
        if "/listall/content/" in u or "/listall/" in u:
            # 武器通常是 listall/content；物品是列表。用具 list 结构区分
            return "weapon" if "content" in u else "unknown"
        return "unknown"

    # ---------- 解析 ----------
    def parse(self):
        kind = self._detect_kind()
        if kind == "character":
            return self._parse_characters()
        if kind == "summon":
            return self._parse_summons()
        if kind == "weapon":
            return self._parse_weapons()
        return []

    def _parse_characters(self):
        out = []
        for item in self.payload.get("list", []):
            m = item.get("master", {}) or {}
            p = item.get("param", {}) or {}
            mid = str(m.get("id") or p.get("id"))
            atk = _parse_int(p.get("attack"))
            hp = _parse_int(p.get("hp"))
            rarity = RARITY_BY_ID.get(str(m.get("rarity") or p.get("rarity") or ""), "?")
            specialty = [WEAPON_TYPE_BY_SPECIALTY.get(s, s)
                         for s in (m.get("specialty") or [])]
            out.append({
                "id": mid,
                "name": mid,          # 名称需细节接口补充
                "element": "?",       # 元素需补充
                "rarity": rarity,
                "role": "攻击",
                "attack": atk,
                "hp": hp,
                "specialty": specialty,
                "master": m,
                "param": p,
            })
        return out

    def _parse_summons(self):
        out = []
        for item in self.payload.get("list", []):
            m = item.get("master", {}) or {}
            p = item.get("param", {}) or {}
            mid = str(m.get("id") or p.get("id"))
            out.append({
                "id": mid,
                "name": mid,
                "element": ELEMENT_MAP.get(_parse_int(p.get("element")), "?"),
                "attack": _parse_int(p.get("attack")),
                "hp": _parse_int(p.get("hp")),
                "master": m,
                "param": p,
            })
        return out

    def _parse_weapons(self):
        out = []
        for item in self.payload.get("list", []):
            m = item.get("master", {}) or {}
            p = item.get("param", {}) or {}
            mid = str(m.get("id") or p.get("id"))
            atk = _parse_int(p.get("attack"))
            hp = _parse_int(p.get("hp"))
            rarity = RARITY_BY_ID.get(str(m.get("rarity") or ""), "?")
            skill_img = m.get("skill1_image") or ""
            max_skill = m.get("max_weapon_skill_level_2") or "0"
            out.append({
                "id": mid,
                "name": mid,
                "element": "?",
                "type": WEAPON_TYPE_BY_SPECIALTY.get("2", "剑"),
                "attack": atk,
                "hp": hp,
                "rarity": rarity,
                "skill_image": skill_img,
                "max_skill_level": max_skill,
                "master": m,
                "param": p,
            })
        return out

    # ---------- 转成 models 对象 ----------
    def to_models(self):
        kind = self._detect_kind()
        result = self.parse()
        if kind == "character":
            return [Character(
                id=d["id"], name=d["name"], element=d["element"],
                rarity=d["rarity"], role=d["role"],
                attack=d["attack"], hp=d["hp"],
                tags=d.get("specialty", []),
            ) for d in result]
        if kind == "summon":
            return [Summon(
                id=d["id"], name=d["name"], element=d["element"],
                attack=d["attack"], hp=d["hp"],
            ) for d in result]
        if kind == "weapon":
            return [Weapon(
                id=d["id"], name=d["name"], element=d["element"],
                type=d["type"], attack=d["attack"], hp=d["hp"],
                weapon_skill=d["skill_image"],
                tags=d.get("skill_image", "") and ["skill"] or [],
            ) for d in result]
        return []


def parse_payload(url: str, payload: dict):
    return GbfApiParser(url, payload)


# ---------------------------------------------------------------------------
# 队伍编成接口解析（Party/Deck）
# 该接口返回完整数据：角色(名称/属性/类型/技能)、武器(名称/属性/技能)、召唤(名称/属性)。
# 是配队最理想的数据源。
# ---------------------------------------------------------------------------

# 属性数字 -> 中文
ELEMENT_BY_NUM = {
    "1": "火", "2": "水", "3": "土", "4": "风", "5": "光", "6": "暗",
}
ELEMENT_BY_NUM_INT = {1: "火", 2: "水", 3: "土", 4: "风", 5: "光", 6: "暗"}

# 武器/角色类型数字 -> 中文（得意武器 / type）
# weapon: 1 铳 ... 依序；此处给出常见映射，可按需扩展
WEAPON_KIND_NAME = {
    "1": "铳", "2": "剑? ", "3": "短剑? ", "4": "杖", "5": "弓",
    "6": "枪", "7": "刀", "8": "格斗", "9": "斧", "10": "矛",
}

# type 数字：角色类型（1=攻击? 参考值，按 GBf 惯例 1=攻击 2=防御 3=回复 4=特殊）
CHARACTER_TYPE_NAME = {
    "1": "攻击", "2": "防御", "3": "回复", "4": "特殊", "5": "平衡", "6": "特殊",
}


def parse_deck(payload: dict) -> dict:
    """从队伍编成返回中解析出 角色/武器/召唤 的 model 列表。

    返回 { "characters": [...], "weapons": [...], "summons": [...] }
    """
    deck = payload.get("deck", payload)
    result = {"characters": [], "weapons": [], "summons": []}

    # ---- 角色 NPC ----
    npc = deck.get("npc", {}) or {}
    for key in sorted(npc.keys()):
        item = npc[key]
        m = item.get("master", {}) or {}
        p = item.get("param", {}) or {}
        attr = ELEMENT_BY_NUM_INT.get(_parse_int(m.get("attribute"))) or \
            ELEMENT_BY_NUM_INT.get(_parse_int(p.get("attribute"))) or "?"
        weapon_nums = (m.get("weapon") or "").split(",")
        specialties = [WEAPON_KIND_NAME.get(n, n) for n in weapon_nums if n]
        ctype = CHARACTER_TYPE_NAME.get(str(m.get("type")), str(m.get("type")))
        skills = []
        for sk in (item.get("skill", {}).get("description", []) if isinstance(item.get("skill"), dict) else []):
            if isinstance(sk, dict) and sk.get("comment"):
                skills.append(sk["comment"])
        result["characters"].append(Character(
            id=str(m.get("id") or p.get("id")),
            name=m.get("name") or str(p.get("id")),
            element=attr,
            rarity=_rarity_str(m.get("rarity") or p.get("rarity")),
            role=ctype,
            attack=_parse_int(p.get("attack")),
            hp=_parse_int(p.get("hp")),
            tags=specialties + skills,
        ))

    # ---- 武器 ----（在 pc.weapons）
    pc = deck.get("pc", {}) if isinstance(deck, dict) else {}
    weapons = pc.get("weapons", {}) or {}
    for key in sorted(weapons.keys()):
        item = weapons[key]
        m = item.get("master", {}) or {}
        p = item.get("param", {}) or {}
        attr = ELEMENT_BY_NUM.get(str(m.get("attribute"))) or "?"
        # 收集武器技能名称
        skill_names = []
        for i in range(1, 5):
            sk = item.get(f"skill{i}")
            if isinstance(sk, dict) and sk.get("name"):
                skill_names.append(sk["name"])
        weapon_skill_desc = "; ".join(s for s in skill_names)
        result["weapons"].append(Weapon(
            id=str(m.get("id") or p.get("id")),
            name=m.get("name") or str(p.get("id")),
            element=attr,
            type="武器",
            attack=_parse_int(p.get("attack")),
            hp=_parse_int(p.get("hp")),
            weapon_skill=weapon_skill_desc,
            skill_level=_parse_int(p.get("skill_level")),
            tags=skill_names,
        ))

    # ---- 召唤 ----（在 pc.summons）
    summons = pc.get("summons", {}) or {}
    for key in sorted(summons.keys()):
        item = summons[key]
        m = item.get("master", {}) or {}
        p = item.get("param", {}) or {}
        attr = ELEMENT_BY_NUM.get(str(m.get("attribute"))) or "?"
        result["summons"].append(Summon(
            id=str(m.get("id") or p.get("id")),
            name=m.get("name") or str(p.get("id")),
            element=attr,
            attack=_parse_int(p.get("attack")),
            hp=_parse_int(p.get("hp")),
            tags=["召唤"],
        ))

    return result


def _rarity_str(v) -> str:
    s = str(v or "")
    return {"3": "SR", "4": "SSR", "1": "R", "2": "R"}.get(s, "?")


if __name__ == "__main__":
    demo = {
        "count": 89, "current": 1, "last": 5,
        "list": [{
            "is_exclude": False,
            "master": {
                "id": "3040653000", "image_id": None,
                "max_evolution_level": 4, "release_max_evolution_level": 0,
                "specialty": ["3", "7"],
            },
            "param": {
                "id": 249676977, "image_id_2": "3040653000_01",
                "attack": "1398", "hp": "328", "level": "1",
                "total": "1726", "rarity": "4",
            },
        }],
    }
    chars = GbfApiParser("https://game.granbluefantasy.jp/npc/list/1", demo).to_models()
    for c in chars:
        print(f"角色 {c.id} 攻{c.attack} 血{c.hp} rar={c.rarity} 适性={c.tags}")