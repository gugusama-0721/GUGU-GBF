# -*- coding: utf-8 -*-
"""用真实截获数据验证端到端配队（离线，无需启动服务）。

从 fixtures/*.json 读取你抓取的接口数据，喂给 api_parser + team_builder，
验证真实数据能正确驱动配队算法。
"""

import json
import os

from .api_parser import GbfApiParser
from .team_builder import TeamBuilder

FIXTURES = os.path.join(os.path.dirname(__file__), "..", "fixtures")


def load_fixture(name):
    path = os.path.join(FIXTURES, name)
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def run():
    # 载入角色真实数据（fragment：你提供的 npc/list 样例）
    char_payload = load_fixture("npc_list_sample.json")
    char_models = GbfApiParser("https://game.granbluefantasy.jp/npc/list/1", char_payload).to_models()

    # 重要：npc/list 接口暂缺"属性"字段。这里演示用"元素富化表"补全。
    # 真实项目需从角色 detail 接口或本地图鉴表补上 element，否则配队无法做属性克制。
    ELEMENT_BY_ID = {"3040653000": "水"}  # 示例：id->属性
    for c in char_models:
        c.element = ELEMENT_BY_ID.get(c.id, "?")

    # 载入武器与召唤（暂用空或可选样例）
    weapon_models = []
    summon_models = []
    wp = os.path.join(FIXTURES, "listall_content_sample.json")
    if os.path.exists(wp):
        weapon_models = GbfApiParser(
            "https://game.granbluefantasy.jp/listall/content/index", load_fixture("listall_content_sample.json")
        ).to_models()
    sp = os.path.join(FIXTURES, "summon_list_sample.json")
    if os.path.exists(sp):
        summon_models = GbfApiParser(
            "https://game.granbluefantasy.jp/summon/list/1", load_fixture("summon_list_sample.json")
        ).to_models()

    print(f"解析到 角色{len(char_models)} 武器{len(weapon_models)} 召唤{len(summon_models)}")

    tb = TeamBuilder()
    tb.load_from_store(char_models, weapon_models, summon_models)
    res = tb.build("raid_fire_dragon")
    print("\n== 真实数据配队推荐 ==")
    print("副本:", res["raid"].name)
    print("队员:", [c.name for c in [res["party"].main, res["party"].sub, res["party"].third] if c])
    print("总攻:", res["party"].total_attack())
    for r in res["reasons"]:
        print(" -", r)


if __name__ == "__main__":
    run()