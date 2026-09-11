// GUGU-GBF popup 逻辑
// 调用本机 Python 分析端；未启动时用内置演示数据便于离线体验。

const ANALYZER_URL = "http://127.0.0.1:8765";

// ---------- 截获数据统计 ----------
async function refreshCollected() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "gbf_get_collected" });
    if (res && res.cache) {
      document.getElementById("c-char").textContent =
        res.cache.character ? (res.cache.character.data.list || []).length : 0;
      document.getElementById("c-weapon").textContent =
        res.cache.weapon ? (res.cache.weapon.data.list || []).length : 0;
      document.getElementById("c-summon").textContent =
        res.cache.summon ? (res.cache.summon.data.list || []).length : 0;
    }
  } catch (e) {}
}

// ---------- 配队展示 ----------
const demoTeam = {
  raid: "火之龙HL",
  members: ["镜海刃(示例)", "斯卡哈", "哈曼(示例)"],
  weapons: ["极圣剑(示例)", "炎之圣剑(示例)"],
  summon: "艾格尼丝(示例)",
  total_atk: 51100,
};

function renderTeam() {
  const el = document.getElementById("team-content");
  // 尝试调用本机分析端获取真实配队
  (async () => {
    try {
      const res = await fetch(`${ANALYZER_URL}/team`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raid_id: "raid_fire_dragon" }),
      });
      const data = await res.json();
      if (data && data.members) {
        el.innerHTML = `
          <div class="team-row">
            ${data.members.map((m) => `<span class="member">${m}</span>`).join("")}
          </div>
          <div style="font-size:12px">
            <span class="label">副本</span>${data.raid}<br/>
            <span class="label">武器</span>${(data.weapons || []).join("、")}<br/>
            <span class="label">召唤</span>${data.summon || "无"}<br/>
            <span class="label">总攻</span>${data.total_attack}
          </div>`;
        document.getElementById("analyzer-status").textContent =
          `分析端运行中 · 数据:${Object.values(data.collected || {}).join("/")}条`;
        return;
      }
      throw new Error("无数据");
    } catch (e) {
      // 离线回退到演示数据
      el.innerHTML = `
        <div class="team-row">
          ${demoTeam.members.map((m) => `<span class="member">${m}</span>`).join("")}
        </div>
        <div style="font-size:12px">
          <span class="label">副本</span>${demoTeam.raid}<br/>
          <span class="label">武器</span>${demoTeam.weapons.join("、")}<br/>
          <span class="label">召唤</span>${demoTeam.summon}<br/>
          <span class="label">总攻</span>${demoTeam.total_atk}
        </div>`;
    }
  })();
}

// ---------- 战斗建议（示例） ----------
function demoAdvice() {
  return [
    { p: "high", a: "防御 / 停手", t: "全队", r: "敌方即将触发特动，建议防御。" },
    { p: "medium", a: "准备治疗", t: "己方全队", r: "血量中等偏低。" },
  ];
}

function renderAdvice(list) {
  const el = document.getElementById("battle-content");
  el.innerHTML = list.map((it) => `
    <div class="advice ${it.p}">
      <b>[${it.a}]</b> → ${it.t}<br/>${it.r}
    </div>`).join("") || "<i>暂无建议</i>";
}

// ---------- 事件 ----------
document.getElementById("quick-fill").addEventListener("click", () => {
  renderTeam();
  renderAdvice(demoAdvice());
});

document.getElementById("submit-battle").addEventListener("click", async () => {
  const state = {
    type: "gbf_battle_state",
    enemy_element: document.getElementById("enemy-element").value,
    enemy_hp_pct: +document.getElementById("enemy-hp").value,
    enemy_overdrive: document.getElementById("enemy-od").value === "是",
    enemy_trigger: document.getElementById("enemy-trigger").value === "是",
    party_hp_pct: +document.getElementById("party-hp").value,
    turn: +document.getElementById("turn").value,
  };
  // 尝试连分析端，失败则用演示
  try {
    const res = await fetch(ANALYZER_URL + "/advise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    renderAdvice(data.advice || []);
    document.getElementById("analyzer-status").textContent = "分析端：已连接";
  } catch (e) {
    // 转发给 background（即便分析端未开也保留记录）
    chrome.runtime.sendMessage({ type: "gbf_battle_state", payload: state });
    renderAdvice(demoAdvice());
    document.getElementById("analyzer-status").textContent = "分析端：离线，已用演示数据";
  }
});

renderTeam();
refreshCollected();