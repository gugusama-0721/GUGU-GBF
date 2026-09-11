# -*- coding: utf-8 -*-
"""GUGU-GBF 本机分析服务（HTTP）。

接收 Chrome 扩展转发的真实接口数据，聚合分页，提供配队与战斗建议。
纯只读分析，无任何自动操作。

端点：
  POST /ingest   接收扩展转发的接口数据 {kind, url, data}
  POST /team     给定副本，返回配队（用已聚合数据）
  GET  /summary  返回已聚合的数据统计
  POST /advise   给定战斗状态，返回回合建议

启动：
  python -m analyzer.server
"""

import json
import threading
from collections import defaultdict
from dataclasses import asdict
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from .api_parser import GbfApiParser, parse_payload, parse_deck
from .team_builder import TeamBuilder
from .battle_advisor import BattleAdvisor
from .models import BattleState


HOST = "127.0.0.1"
PORT = 8765


class DataStore:
    """聚合扩展转发的多页数据。"""

    def __init__(self):
        # kind -> { item_id: 完整条目 }，用于跨页去重合并
        self.pool = defaultdict(dict)
        # kind -> { item_id: model 对象 }，供配队引擎使用
        self.models = defaultdict(dict)
        self.counts = defaultdict(int)
        self.lock = threading.Lock()

    def ingest(self, kind, url, data):
        with self.lock:
            if kind == "deck":
                # 队伍编成：一次性给全 角色/武器/召唤
                parsed = parse_deck(data)
                for subkind, items in [("character", parsed["characters"]),
                                       ("weapon", parsed["weapons"]),
                                       ("summon", parsed["summons"])]:
                    for m in items:
                        self.models[subkind][m.id] = m
                        self.pool[subkind][m.id] = asdict(m)
                return
            parser = GbfApiParser(url, data)
            raw_items = parser.parse()
            for it in raw_items:
                self.pool[kind][it["id"]] = it
            for m in parser.to_models():
                self.models[kind][m.id] = m
            self.counts[kind] = len(self.pool[kind])

    def get(self, kind):
        with self.lock:
            return list(self.pool[kind].values())

    def get_models(self, kind):
        with self.lock:
            return list(self.models[kind].values())

    def summary(self):
        with self.lock:
            return {k: len(v) for k, v in self.pool.items()}


store = DataStore()


class Handler(BaseHTTPRequestHandler):
    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length))

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            body = self._read_json()
        except Exception:
            body = {}

        if self.path.startswith("/ingest"):
            kind = body.get("kind")
            url = body.get("url", "")
            data = body.get("data") or {}
            if kind and data:
                store.ingest(kind, url, data)
            self._json({"ok": True, "summary": store.summary()})

        elif self.path.startswith("/advise"):
            self._json(self._handle_advise(body))

        elif self.path.startswith("/team"):
            self._json(self._handle_team(body))

        else:
            self._json({"error": "unknown"}, 404)

    def do_GET(self):
        if self.path.startswith("/summary"):
            self._json(store.summary())
        else:
            self._json({"service": "gugu-gbf", "ok": True})

    # ---------- 业务 ----------
    def _handle_team(self, body):
        raid_id = body.get("raid_id", "raid_fire_dragon")
        tb = TeamBuilder()
        # 用扩展截获的真实数据覆盖示例库
        tb.load_from_store(
            characters=store.get_models("character"),
            weapons=store.get_models("weapon"),
            summons=store.get_models("summon"),
        )
        try:
            res = tb.build(raid_id)
        except KeyError:
            return {"error": f"未知副本 {raid_id}", "known": list(tb.raids.keys())}
        p = res["party"]
        return {
            "raid": res["raid"].name,
            "members": [p.main.name, p.sub.name, p.third.name],
            "weapons": [w.name for w in p.weapons],
            "summon": p.main_summon.name if p.main_summon else None,
            "total_attack": p.total_attack(),
            "reasons": res["reasons"],
            "collected": store.summary(),
        }

    def _handle_advise(self, body):
        ba = BattleAdvisor()
        try:
            state = BattleState(
                enemy_element=body.get("enemy_element", "火"),
                enemy_hp_pct=float(body.get("enemy_hp_pct", 100)),
                enemy_overdrive=bool(body.get("enemy_overdrive", False)),
                enemy_trigger=bool(body.get("enemy_trigger", False)),
                party_hp_pct=float(body.get("party_hp_pct", 100)),
                turn=int(body.get("turn", 1)),
            )
        except (ValueError, TypeError):
            return {"error": "参数类型错误"}
        result = ba.advise(state)
        result["collected"] = store.summary()
        return result

    def log_message(self, fmt, *args):
        pass  # 静默日志


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"GUGU-GBF 分析端已启动: http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n已停止")


if __name__ == "__main__":
    main()