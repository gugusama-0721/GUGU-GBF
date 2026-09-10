# -*- coding: utf-8 -*-
"""战斗回合建议分析。

输入：BattleState（敌方+己方实时状态，来自扩展半自动录入）
输出：当回合的操作建议（结合配队角色库给出理由）

纯展示用途，不产生任何自动操作。
"""

from .models import BattleState, Element, to_dict
from .knowledge_data import build_all


class BattleAdvisor:
    def __init__(self):
        kb = build_all()
        self.characters = kb["characters"]

    # ---------- 规则集合 ----------

    def _advise_ally_hp(self, s: BattleState) -> list:
        advice = []
        if s.party_hp_pct <= 30:
            advice.append({
                "priority": "high",
                "action": "治疗/净化",
                "target": "己方全队",
                "reason": f"己方血量仅剩 {s.party_hp_pct:.0f}%，优先保证生存，回血以避免减员。",
            })
        elif s.party_hp_pct <= 60:
            advice.append({
                "priority": "medium",
                "action": "准备治疗",
                "target": "己方全队",
                "reason": "血量中等偏低，可预留治疗技能或召唤，若本回合不吃伤害可先输出。",
            })
        return advice

    def _advise_enemy_trigger(self, s: BattleState) -> list:
        advice = []
        if s.enemy_trigger:
            advice.append({
                "priority": "high",
                "action": "防御 / 停手",
                "target": "全队",
                "reason": "敌方即将触发特动，建议本回合防御或减少输出，避免吃到高额反击。",
            })
            # 若此时有od且连击强
            if s.enemy_overdrive:
                advice.append({
                    "priority": "high",
                    "action": "尽量打掉满豆条 / 开嘲讽",
                    "target": "防御型角色",
                    "reason": "敌方处于OD + 即将特动，若队伍有嘲讽/无敌技能可用于吸收该次伤害。",
                })
        return advice

    def _advise_overdrive(self, s: BattleState) -> list:
        advice = []
        if s.enemy_overdrive and not s.enemy_trigger:
            advice.append({
                "priority": "medium",
                "action": "集中输出压血 / 上破防",
                "target": "敌方",
                "reason": "敌方处于OD状态，弱体命中率高，建议给敌方上破防类弱体并集火输出。",
            })
        return advice

    def _advise_charge(self, s: BattleState) -> list:
        advice = []
        # 找奥义槽满的角色
        ready = [k for k, v in s.party_charge.items() if v >= 100]
        ready.sort(key=lambda n: s.party_charge[n], reverse=True)
        if len(ready) >= 2:
            advice.append({
                "priority": "high",
                "action": "释放全员奥义(FULL CHAIN)",
                "target": ",".join(ready),
                "reason": f"{len(ready)}人奥义已满，可连携触发高额Chain伤害打破僵局。",
            })
        elif ready:
            advice.append({
                "priority": "low",
                "action": "可单发奥义",
                "target": ready[0],
                "reason": f"「{ready[0]}」奥义槽已满，可单独释放，但建议观察是否需要留到下一回合集中Chain。",
            })
        return advice

    def _advise_enemy_hp(self, s: BattleState) -> list:
        advice = []
        if s.enemy_hp_pct <= 10:
            advice.append({
                "priority": "high",
                "action": "全力爆发收尾",
                "target": "敌方",
                "reason": f"敌方仅剩 {s.enemy_hp_pct:.0f}% 血量，全技能+奥义爆发完成击杀。",
            })
        return advice

    def _advise_attribute(self, s: BattleState) -> list:
        advice = []
        if s.enemy_element == Element.FIRE.value and "水属性" not in " ".join(s.player_buffs):
            advice.append({
                "priority": "info",
                "action": "确认己方属性",
                "target": "队伍",
                "reason": "敌方为火属性，水属性队伍有克制优势，若当前非克制属性建议换队。",
            })
        return advice

    # ---------- 对外主入口 ----------
    def advise(self, state: BattleState) -> dict:
        tips = []
        for fn in [
            self._advise_enemy_hp,
            self._advise_ally_hp,
            self._advise_enemy_trigger,
            self._advise_overdrive,
            self._advise_charge,
            self._advise_attribute,
        ]:
            tips.extend(fn(state))

        order = {"high": 0, "medium": 1, "low": 2, "info": 3}
        tips.sort(key=lambda t: order.get(t["priority"], 3))

        return {
            "turn": state.turn,
            "enemy": f"{Element(state.enemy_element).value} / 血{state.enemy_hp_pct:.0f}% / "
                     f"OD{'是' if state.enemy_overdrive else '否'} / 特动{'是' if state.enemy_trigger else '否'}",
            "party_hp": f"{state.party_hp_pct:.0f}%",
            "advice": tips,
        }


if __name__ == "__main__":
    ba = BattleAdvisor()
    st = BattleState(
        enemy_element="火",
        enemy_hp_pct=55, enemy_overdrive=True, enemy_trigger=True,
        party_hp_pct=45,
        party_charge={"尤艾尔": 100, "黑蓝大刃": 100, "镜海刃": 40},
        player_buffs=[], enemy_debuffs=[],
        turn=12,
    )
    import json
    print(json.dumps(ba.advise(st), ensure_ascii=False, indent=2))