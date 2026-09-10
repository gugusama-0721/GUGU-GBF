# -*- coding: utf-8 -*-
"""GUGU-GBF 命令行入口。

演示两大核心功能：
  1. 配队：给定副本 -> 推荐队伍编成
  2. 战斗建议：给定战斗实时状态 -> 当回合操作建议

用法：
  python main_cli.py              # 跑配队演示
  python main_cli.py battle       # 跑战斗建议演示
"""

import sys
import json

from .team_builder import TeamBuilder
from .battle_advisor import BattleAdvisor
from .models import BattleState


def show_team():
    tb = TeamBuilder()
    res = tb.build("raid_fire_dragon")
    p = res["party"]
    print("=" * 50)
    print("  GUGU-GBF 配队推荐")
    print("=" * 50)
    print(f"副本：{res['raid'].name}  (敌方属性:{res['raid'].element})")
    print(f"队员：{p.main.name} / {p.sub.name} / {p.third.name}")
    print(f"武器：{'、'.join(w.name for w in p.weapons)}")
    print(f"召唤：{p.main_summon.name if p.main_summon else '无'}")
    print(f"总攻击力：{p.total_attack()}")
    print("-" * 50)
    print("推荐理由：")
    for r in res["reasons"]:
        print("  •", r)


def show_battle():
    ba = BattleAdvisor()
    state = BattleState(
        enemy_element="火",
        enemy_hp_pct=55,
        enemy_overdrive=True,
        enemy_trigger=True,
        party_hp_pct=45,
        party_charge={"尤艾尔": 100, "黑蓝大刃": 100, "镜海刃": 40},
        turn=12,
    )
    result = ba.advise(state)
    print("=" * 50)
    print("  GUGU-GBF 战斗回合建议")
    print("=" * 50)
    print(f"第 {result['turn']} 回合 | 敌方：{result['enemy']} | 己方HP：{result['party_hp']}")
    print("-" * 50)
    for tip in result["advice"]:
        mark = {"high": "🔴", "medium": "🟡", "low": "🟢", "info": "⚪"}.get(tip["priority"], "⚪")
        print(f"{mark} [{tip['priority']}] {tip['action']} → {tip['target']}")
        print(f"      {tip['reason']}")


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "team"
    if arg == "battle":
        show_battle()
    else:
        show_team()


if __name__ == "__main__":
    main()