# -*- coding: utf-8 -*-
"""用队伍编成接口真实数据验证配队。"""
import os
import json

from .api_parser import parse_deck
from .team_builder import TeamBuilder

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "fixtures")


def main():
    path = os.path.join(FIXTURES, "party_deck_sample.json")
    with open(path, encoding="utf-8") as f:
        payload = json.load(f)

    parsed = parse_deck(payload)
    chars, weps, sums = parsed["characters"], parsed["weapons"], parsed["summons"]
    print(f"队伍编成解析: 角色{len(chars)} 武器{len(weps)} 召唤{len(sums)}")
    print("\n== 角色 ==")
    for c in chars:
        print(f"  {c.name} [{c.element}/{c.rarity}/{c.role}] 攻{c.attack} 血{c.hp}")
    print("\n== 武器 ==")
    for w in weps[:5]:
        print(f"  {w.name} [{w.element}] 攻{w.attack} 技能:{w.weapon_skill[:40]}...")
    print("\n== 召唤 ==")
    for s in sums:
        print(f"  {s.name} [{s.element}] 攻{s.attack}")

    # 用真实数据驱动配队（针对光属性副本验证克制）
    tb = TeamBuilder()
    tb.load_from_store(chars, weps, sums)
    for raid_id in ["raid_fire_dragon"]:
        try:
            res = tb.build(raid_id)
            print(f"\n== 配队(副本: {res['raid'].name}) ==")
            print(" 队员:", [c.name for c in [res["party"].main, res["party"].sub, res["party"].third] if c])
            print(" 武器:", [w.name for w in res["party"].weapons])
            print(" 召唤:", res["party"].main_summon.name if res["party"].main_summon else "无")
            print(" 总攻:", res["party"].total_attack())
            for r in res["reasons"]:
                print("  *", r)
        except Exception as e:
            print(f"  配队异常: {e}")


if __name__ == "__main__":
    main()