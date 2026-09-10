# -*- coding: utf-8 -*-
"""GUGU-GBF 数据模型定义。

定义玩家配置（角色/武器/召唤）、副本、队伍等核心数据结构。
这些结构与后续扩展（页面读取）解耦：扩展抓到的数据会映射成这些模型。
"""

from dataclasses import dataclass, field, asdict
from enum import Enum


class Element(Enum):
    FIRE = "火"
    WATER = "水"
    EARTH = "土"
    WIND = "风"
    LIGHT = "光"
    DARK = "暗"


class WeaponType(Enum):
    SWORD = "剑"
    DAGGER = "短剑"
    SPEAR = "枪"
    AXE = "斧"
    STAFF = "杖"
    GUN = "铳"
    FIST = "格斗"
    BOW = "弓"
    HARP = "琴"
    KATANA = "刀"


class Role(Enum):
    ATTACKER = "攻击"
    DEFENDER = "防御"
    SUPPORT = "辅助"
    HEALER = "治疗"


@dataclass
class Character:
    """角色"""
    id: str
    name: str
    element: str          # Element 的 value
    rarity: str           # SSR / SR / R
    role: str             # Role 的 value
    attack: int
    hp: int
    skill_effect: str = ""      # 技能效果描述
    synergies: list = field(default_factory=list)  # 擅长配合的其他角色 id
    tags: list = field(default_factory=list)       # 额外标签，如 "奥义加速"


@dataclass
class Weapon:
    """武器"""
    id: str
    name: str
    element: str
    type: str             # WeaponType 的 value
    attack: int
    hp: int
    weapon_skill: str = ""       # 武器技能名
    skill_level: int = 0
    tags: list = field(default_factory=list)


@dataclass
class Summon:
    """召唤"""
    id: str
    name: str
    element: str
    call_effect: str = ""
    tags: list = field(default_factory=list)


@dataclass
class Party:
    """一个队伍编成"""
    main: Character
    sub: Character
    third: Character
    weapons: list = field(default_factory=list)   # list[Weapon]
    main_summon: Summon = None
    friend_summon: Summon = None
    support_summons: list = field(default_factory=list)

    def total_attack(self) -> int:
        atk = self.main.attack + self.sub.attack + self.third.attack
        atk += sum(w.attack for w in self.weapons)
        if self.main_summon:
            atk += self.main_summon.attack if hasattr(self.main_summon, 'attack') else 0
        return atk


@dataclass
class Raid:
    """副本（Boss）"""
    id: str
    name: str
    element: str               # 敌方属性
    difficulty: str            # EX / HL / 高难
    recommended_hp: int = 0    # 推荐血量门槛
    special_mechanics: list = field(default_factory=list)  # 特殊机制描述
    target_roles: list = field(default_factory=list)       # 需要的角色类型


@dataclass
class BattleState:
    """战斗实时状态（用于回合前判断，半自动录入）"""
    enemy_element: str
    enemy_hp_pct: float = 100.0        # 敌方剩余血量百分比 0-100
    enemy_overdrive: bool = False      # 是否 OD 状态
    enemy_trigger: bool = False        # 是否即将满豆（要触发特动）
    party_hp_pct: float = 100.0        # 己方平均血量百分比
    party_charge: dict = field(default_factory=dict)  # {role名: 奥义槽0-100}
    player_buffs: list = field(default_factory=list)  # 我方有利状态
    enemy_debuffs: list = field(default_factory=list) # 敌方弱体状态
    turn: int = 1


def to_dict(obj) -> dict:
    return asdict(obj)