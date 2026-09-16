// GUGU-GBF 侧边栏逻辑（复刻 Tarou 侧边栏展示数据）
// 从 background 读取截获的数据 + 诊断，渲染明细供与网页核对。

async function fetchCollected() {
  try {
    const res = await chrome.runtime.sendMessage({ type: "gbf_get_collected" });
    return (res && res.cache) || {};
  } catch (e) {
    return {};
  }
}

const EL = { "1": "火", "2": "水", "3": "土", "4": "风", "5": "光", "6": "暗" };
function fmtAttr(v) {
  if (v === undefined || v === null || v === "") return "?";
  return EL[String(v)] || v;
}
function rarityStr(v) {
  const s = String(v || "");
  return { "3": "SR", "4": "SSR", "1": "R", "2": "R" }[s] || s;
}

function renderCharacters(container, list) {
  if (!list || !list.length) { container.innerHTML = "<i class=muted>暂无角色数据</i>"; return; }
  container.innerHTML = list.map((c) => `
    <div class="raw-item">
      <b>${c.name || c.id}</b>
      <span class="raw-field"> ${fmtAttr(c.attribute)}属性 · ${rarityStr(c.rarity)} · 类型${c.type ?? "?"}</span><br/>
      <span class="kv"><span class="raw-field">攻</span>${c.attack}</span>
      <span class="kv"><span class="raw-field">血</span>${c.hp}</span>
      <span class="kv"><span class="raw-field">得意</span>${(c.weapon || "").split(",").join("/")}</span>
    </div>`).join("");
}

function renderWeapons(container, list) {
  if (!list || !list.length) { container.innerHTML = "<i class=muted>暂无武器数据</i>"; return; }
  container.innerHTML = list.map((w) => {
    const skills = [];
    for (let i = 1; i <= 4; i++) { const sk = w["skill" + i]; if (sk && sk.name) skills.push(sk.name); }
    const lv = w.level ?? (w.param && w.param.level);
    return `<div class="raw-item">
      <b>${w.name}</b> <span class="raw-field">${fmtAttr(w.attribute)} · Lv${lv ?? "?"}</span><br/>
      <span class="kv"><span class="raw-field">攻</span>${w.attack}</span>
      <span class="kv"><span class="raw-field">血</span>${w.hp}</span>
      <span class="raw-field">技能:</span>${skills.join("、") || "无"}
    </div>`;
  }).join("");
}

function renderSummons(container, list) {
  if (!list || !list.length) { container.innerHTML = "<i class=muted>暂无召唤数据</i>"; return; }
  container.innerHTML = list.map((s) => `
    <div class="raw-item">
      <b>${s.name}</b> <span class="raw-field">${fmtAttr(s.attribute)}属性 · ${rarityStr(s.rarity)}</span><br/>
      <span class="kv"><span class="raw-field">攻</span>${s.attack}</span>
      <span class="kv"><span class="raw-field">血</span>${s.hp}</span>
    </div>`).join("");
}

function extractAndRender(cache) {
  let charList = [];
  const npcRaw = cache.character && cache.character.data;
  if (npcRaw && npcRaw.list) {
    charList = npcRaw.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    charList = deckNPCs(normalizeDeck(cache.deck && cache.deck.data));
  }
  const charCount = document.getElementById("c-char");
  if (charCount) charCount.textContent = charList.length;

  let wepList = [];
  const lw = cache.weapon && cache.weapon.data;
  if (lw && lw.list) {
    wepList = lw.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    const pc = deckPC(normalizeDeck(cache.deck && cache.deck.data));
    if (pc.weapons) wepList = Object.values(pc.weapons).map((it) => ({ ...(it.master || {}), ...(it.param || {}), ...it }));
  }
  const weaponCount = document.getElementById("c-weapon");
  if (weaponCount) weaponCount.textContent = wepList.length;

  let sumList = [];
  const ls = cache.summon && cache.summon.data;
  if (ls && ls.list) {
    sumList = ls.list.map((it) => ({ ...(it.master || {}), ...(it.param || {}) }));
  } else {
    const pc = deckPC(normalizeDeck(cache.deck && cache.deck.data));
    if (pc.summons) sumList = Object.values(pc.summons).map((it) => ({ ...(it.master || {}), ...(it.param || {}), ...it }));
  }
  const summonCount = document.getElementById("c-summon");
  if (summonCount) summonCount.textContent = sumList.length;

  // 队伍数量由可视化函数 renderDeckVisual 处理，这里仅汇总计数
  const deckCount = document.getElementById("c-deck");
  if (deckCount) deckCount.textContent = deckNPCs(normalizeDeck(cache.deck && cache.deck.data)).length;

  updateStatus(cache);
}

function updateStatus(cache) {
  const lastUpdate = document.getElementById("last-update");
  const diagBox = document.getElementById("diag-box");
  if (!lastUpdate && !diagBox) return;
  const last = [];
  for (const k of ["character", "weapon", "summon", "deck"]) {
    if (cache[k] && cache[k].time) last.push(`${k}:${new Date(cache[k].time).toLocaleTimeString()}`);
  }
  if (lastUpdate) {
    lastUpdate.textContent =
      last.length ? "最近截获: " + last.join(" · ") : "尚未读取 · 打开游戏页后自动采集";
  }

  try {
    chrome.storage.local.get("gugu_gbf_diag", (obj) => {
      const box = document.getElementById("diag-box");
      if (!box) return;
      const d = obj && obj.gugu_gbf_diag;
      if (!d) {
        box.textContent = "暂无诊断数据。\ncontent script 未写入诊断。可能：尚未刷新游戏页，或注入失败。\n请刷新 GBF 页面后点「立即读取」。";
        return;
      }
      // 叠加展示 CDP/debugger 状态
      chrome.storage.local.get("gugu_gbf_dbg", (dbgObj) => {
        const db = dbgObj && dbgObj.gugu_gbf_dbg;
        const dbgLine = db
          ? [
              "\n===== CDP/debugger 状态 =====",
              "attach: " + (db.state === "attached" ? "✅已附加" : db.state === "attach-fail" ? "❌附加失败" : db.state),
              "attach详情: " + (db.detail || "-"),
              "捕获响应数: " + (db.captured ?? 0),
              "最近捕获: " + (db.lastKind || "-"),
            ]
          : ["\n===== CDP/debugger 状态 =====", "暂无状态。debugger 未记录（可能扩展未重载或未打开 GBF 页）"];
      const lines = [
        "注入时间: " + (d.time ? new Date(d.time).toLocaleTimeString() : "-"),
        "注入页面: " + (d.url || "-"),
        "是否 iframe: " + (d.isIframe === true ? "是（子框架）" : d.isIframe === false ? "否（顶层）" : "未知"),
        "jQuery 就绪: " + (d.jquery ? "是" : "否"),
        "主世界inject加载: " + (d.injectLoaded ? "已加载" : "❌未加载"),
        "主世界inject状态: " + ({ hooked: "✅已挂接", "no-jquery": "❌无jQuery(30秒超时)", loaded: "已加载" }[d.injectState] || d.injectState || "-"),
        "已接收数据条数: " + (d.received ?? 0),
        "最近类型: " + (d.lastKind || "-"),
        ...dbgLine,
      ];
      box.textContent = lines.join("\n");
      // 追加最近请求 URL
      chrome.storage.local.get("gugu_gbf_recent", (rc) => {
        const list = (rc && rc.gugu_gbf_recent) || [];
        if (list.length) {
          const shown = list.map((r) => `  ${r.type||"-"} ${(r.url||"").replace("https://game.granbluefantasy.jp","")}`).join("\n");
          box.textContent += "\n\n===== 最近 CDP 请求 =====" + (shown.length > 900 ? shown.slice(-900) : shown);
        } else {
          box.textContent += "\n\n(暂无 CDP 请求记录)";
        }
      });
      if (db && db.state === "attached" && (db.captured ?? 0) === 0) {
        box.textContent += "\n\n⚠️ debugger 已附加但未捕获到目标接口。\nCDP 层级监控正常，但当前页面没触发 角色/武器/召唤/队伍 请求。请进入对应页面。";
      } else if (!db || db.state !== "attached") {
        box.textContent += "\n\n⚠️ debugger 未附加成功。\n可能是：①Tarou 或其他扩展占用；②标签页已自动 attach 但被 detach。\n请停用 Tarou 后重载扩展、重开 GBF 标签页。";
      }
      });
    });
  } catch (e) {}
}

async function refresh() {
  const cache = await fetchCollected();
  renderRawBox(cache);
  renderBattle(cache);
  extractAndRender(cache);
  renderDeckVisual(cache);
  renderDeckCharacters(cache);
  renderWeaponGrid(cache);
  renderSummonGrid(cache);
  renderStatEstimate(cache);
}

// 战斗实时事件（WebSocket，复刻 Tarou）
async function renderBattle() {
  const box = document.getElementById("battle-box");
  if (!box) return;
  let list = null;
  try { list = (await chrome.storage.local.get("gugu_gbf_battle")).gugu_gbf_battle || []; } catch (e) { list = []; }
  if (!list.length) { box.innerHTML = '<i class="muted">进入副本战斗后，WebSocket 服务器实时推送事件会显示于此</i>'; return; }
  box.innerHTML = list.map((b) => {
    const t = new Date(b.t || Date.now());
    const hm = t.toTimeString().slice(0, 8);
    return `<div style="font-size:calc(11px*var(--ui-scale));padding:3px 0;border-bottom:1px dashed var(--line)">
      <span style="color:var(--muted)">${hm}</span>
      <span style="color:${b.dir==='发'?'var(--accent)':'var(--ok)'}">[${b.dir}]</span>
      <b style="color:var(--gold)">${b.evt}</b>
      <span style="color:var(--muted)"> ${b.summary||''}</span>
    </div>`;
  }).join("");
}

function renderRawBox(cache) {
  const box = document.getElementById("raw-box");
  if (!box) return;
  const parts = [];
  for (const k of ["deck", "character", "weapon", "summon"]) {
    const item = cache[k];
    if (item && item.data !== undefined) {
      parts.push("===== " + k + " (" + item.time + ") =====\n" + JSON.stringify(item.data).slice(0, 3000));
    } else {
      parts.push("===== " + k + " =====\n(无)");
    }
  }
  box.textContent = parts.join("\n\n");
}

const ATTR_COLOR = { "1":"#ff5b2e", "2":"#3fb0ff", "3":"#c8a24a", "4":"#7fd14a", "5":"#ffd23f", "6":"#a56bff" };
const ATTR_CHAR = { "1":"🔥", "2":"💧", "3":"⛰️", "4":"🌪️", "5":"🌕", "6":"🌑" };
const ATTR_NAME = { "1":"火","2":"水","3":"土","4":"风","5":"光","6":"暗" };
const GBF_ASSET_CDN = "https://prd-game-a-granbluefantasy.akamaized.net/assets_en/img/sp/assets";

function charTag(v){ return ATTR_CHAR[String(v)] || ""; }
function charColor(v){ return ATTR_COLOR[String(v)] || "#555"; }

// GBF 的实际角色图 ID 不是单一命名规则：有时在 param.image_id_3，有时在 cjs_name / master.id，
// 同时 jpg/png 也可能互换，且某些对象会带前缀 npc_。这里按真实数据的多种变体生成候选地址。
function directImageUrl(item) {
  if (!item || typeof item !== "object") return "";
  const candidates = [
    item.image_url,
    item.img_url,
    item.src,
    item.url,
    item.imageUrl,
    item.imgUrl,
    item.master && (item.master.image_url || item.master.img_url || item.master.src || item.master.url),
    item.param && (item.param.image_url || item.param.img_url || item.param.src || item.param.url),
  ];
  for (const v of candidates) {
    const s = String(v || "").trim();
    if (s && /^https?:\/\//i.test(s)) return s;
  }
  return "";
}

function characterImageId(item) {
  if (directImageUrl(item)) return "";
  const master = item.master || {};
  const param = item.param || {};
  const candidates = [
    param.image_id_3,
    param.image_id_3_tower,
    master.image_id,
    param.image_id,
    param.cjs_name,
    master.id,
    master.character_id,
    master.unit_id,
    param.unit_id,
  ];
  for (const v of candidates) {
    const s = String(v || "").trim();
    if (!s) continue;
    return s;
  }
  return "";
}

function characterImageVariants(item) {
  if (directImageUrl(item)) return [];
  const raw = characterImageId(item);
  if (!raw) return [];
  const ids = new Set();
  const add = (value) => {
    const s = String(value || "").trim();
    if (!s) return;
    ids.add(s);
    const noPrefix = s.replace(/^npc_/, "");
    if (noPrefix !== s) ids.add(noPrefix);
  };
  add(raw);
  const m = String(raw).match(/^(.*?)(?:_(?:\d{2}|\d{1}))$/);
  if (m && m[1]) add(m[1]);
  return [...ids].filter(Boolean);
}

function characterImageUrl(item, extension = "jpg") {
  const direct = directImageUrl(item);
  if (direct) return direct;
  const variants = characterImageVariants(item);
  if (!variants.length) return "";
  const base = variants[0];
  const plain = String(base || "").trim();
  if (!plain) return "";
  const folderCandidates = ["f", "", "m"];
  for (const folder of folderCandidates) {
    const path = folder ? `${GBF_ASSET_CDN}/npc/${folder}/${plain}.${extension}` : `${GBF_ASSET_CDN}/npc/${plain}.${extension}`;
    if (folder === "f") return path;
  }
  return `${GBF_ASSET_CDN}/npc/${plain}.${extension}`;
}

function characterImageCandidates(item) {
  const direct = directImageUrl(item);
  if (direct) return [direct];
  const variants = characterImageVariants(item);
  if (!variants.length) return [];
  const urls = [];
  for (const id of variants) {
    const plain = String(id || "").trim();
    if (!plain) continue;
    const folders = ["f", "", "m"];
    for (const folder of folders) {
      const base = folder ? `${GBF_ASSET_CDN}/npc/${folder}/${plain}` : `${GBF_ASSET_CDN}/npc/${plain}`;
      urls.push(`${base}.jpg`);
      urls.push(`${base}.png`);
    }
  }
  return [...new Set(urls.filter(Boolean))];
}

function imageFallback(img) {
  if (!img) return;
  const current = img.src || "";
  const dedup = [];
  try {
    const raw = img.dataset.candidates || "";
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) dedup.push(...parsed);
    }
  } catch (e) {}
  const jpg = img.dataset.jpgSrc || "";
  const png = img.dataset.pngSrc || "";
  if (jpg) dedup.push(jpg);
  if (png) dedup.push(png);
  const candidates = [...new Set(dedup.filter(Boolean))];
  if (!candidates.length) {
    img.style.display = "none";
    img.onerror = null;
    return;
  }
  const tried = Number(img.dataset.fallbackIndex || "0");
  if (tried >= candidates.length) {
    img.style.display = "none";
    img.onerror = null;
    return;
  }
  const next = candidates[tried];
  if (!next || next === current) {
    img.dataset.fallbackIndex = String(Math.min(tried + 1, candidates.length));
    img.style.display = "none";
    img.onerror = null;
    return;
  }
  img.dataset.fallbackIndex = String(tried + 1);
  img.src = next;
}

function buildCharacterImage(item, className, alt = "") {
  const candidates = characterImageCandidates(item);
  const img = document.createElement("img");
  img.className = className;
  img.alt = alt;
  img.loading = "eager";
  img.decoding = "async";
  img.style.display = "block";
  img.style.objectFit = "cover";
  img.dataset.fallbackIndex = "0";
  if (candidates.length) {
    img.dataset.candidates = JSON.stringify(candidates);
    const jpg = candidates.find((u) => u.endsWith(".jpg")) || "";
    const png = candidates.find((u) => u.endsWith(".png")) || "";
    if (jpg) img.dataset.jpgSrc = jpg;
    if (png) img.dataset.pngSrc = png;
    img.src = candidates[0];
    img.title = candidates[0];
    img.onerror = () => imageFallback(img);
  }
  return img;
}

// 队伍总览：成员缩略条
function normalizeDeck(deckData) {
  if (!deckData || typeof deckData !== "object") return null;
  let data = deckData;
  for (let i = 0; i < 3; i++) {
    if (data.result && typeof data.result === "object") {
      data = data.result;
    } else if (data.data && typeof data.data === "object" && !data.npc && !data.deck) {
      data = data.data;
    } else {
      break;
    }
  }
  if (Array.isArray(data.deck_list)) {
    return data.deck_list.find((item) => deckNPCs(item).length) || data.deck_list[0] || null;
  }
  return data;
}
function deckNPCs(d) {
  if (!d) return [];
  if (d.npc) return Object.values(d.npc);
  if (d.party && d.party.npc) return Object.values(d.party.npc);
  if (d.deck && d.deck.npc) return Object.values(d.deck.npc);
  return [];
}
function deckPC(d) {
  if (!d) return {};
  if (d.pc) return d.pc;
  if (d.party && d.party.pc) return d.party.pc;
  if (d.deck && d.deck.pc) return d.deck.pc;
  return {};
}
function renderDeckVisual(cache){
  const nameEl = document.getElementById("deck-name");
  const slotEl = document.getElementById("deck-slot");
  const jobEl = document.getElementById("job-info");
  const memEl = document.getElementById("deck-members");
  const deckData = cache.deck && cache.deck.data;
  if(!deckData){
    nameEl.textContent = "未读取"; slotEl.textContent = "";
    if (jobEl) jobEl.textContent = "主角职业：未读取";
    memEl.innerHTML = '<i class="muted">打开编成页后自动采集</i>'; return;
  }
  const d = normalizeDeck(cache.deck.data);
  const pc = deckPC(d);
  const job = pc.job || {};
  const jobMaster = job.master || {};
  const jobParam = job.param || {};
  nameEl.textContent = (d && (d.name || d.deck_name)) || "Deck";
  slotEl.textContent = (d && (d.group_name || (cache.deck.url||"").split("?")[0])) || "";
  if (jobEl) {
    const jobName = jobMaster.name || job.name || jobParam.name || "未读取";
    const jobLevel = jobParam.level || job.level || "";
    jobEl.innerHTML = `主角职业：<b>${jobName}</b>${jobLevel ? ` · Lv${jobLevel}` : ""}`;
  }
  const npcs = deckNPCs(d);
  if(!npcs.length){ memEl.innerHTML='<i class="muted">无成员（原始结构见🔬原始数据）</i>'; return; }
  memEl.innerHTML = "";
  npcs.forEach((it)=>{
    const m = it.master||{}, p = it.param||{};
    const attr = String(m.element ?? m.attribute ?? p.element ?? p.attribute ?? "");
    const cell = document.createElement("div");
    cell.className = "m-cell";
    const img = buildCharacterImage(it, "m-avatar");
    cell.appendChild(img);
    const attrEl = document.createElement("div");
    attrEl.className = "attr";
    attrEl.style.background = charColor(attr);
    cell.appendChild(attrEl);
    const mn = document.createElement("div");
    mn.className = "mn";
    mn.textContent = m.name || (m.unit_name || "?");
    cell.appendChild(mn);
    const mnum = document.createElement("div");
    mnum.className = "mnum";
    mnum.textContent = p.level ? "Lv" + p.level : "";
    cell.appendChild(mnum);
    const ms = document.createElement("div");
    ms.className = "ms";
    ms.textContent = `${ATTR_NAME[attr] || ""} ${m.rare_name || ""}`;
    cell.appendChild(ms);
    memEl.appendChild(cell);
  });
}

// 角色头卡
function renderDeckCharacters(cache){
  const el = document.getElementById("ch-grid");
  const deckData = cache.deck && cache.deck.data;
  let list = deckNPCs(normalizeDeck(deckData));
  if(!list.length){
    const raw = cache.character && cache.character.data;
    if(raw && raw.list) list = raw.list;
  }
  if(!list.length){ el.innerHTML='<i class="muted">暂无角色数据</i>'; return; }
  // 优先从 deck 取 master.name 作真实名称
  el.innerHTML = "";
  list.forEach((it)=>{
    const m = it.master||{}, p = it.param||{};
    const attr = m.element ?? m.attribute ?? p.element ?? p.attribute;
    const name = (m && m.name) || "";
    const card = document.createElement("div");
    card.className = "ch-card";
    const head = document.createElement("div");
    head.className = "ch-head";
    const avatarWrap = document.createElement("div");
    avatarWrap.className = "ch-avatar";
    const img = buildCharacterImage(it, "ch-image", name);
    avatarWrap.appendChild(img);
    head.appendChild(avatarWrap);
    card.appendChild(head);
    const body = document.createElement("div");
    body.className = "ch-body";
    const nameEl = document.createElement("div");
    nameEl.className = "ch-name";
    nameEl.textContent = name || it.id;
    body.appendChild(nameEl);
    const stats = document.createElement("div");
    stats.className = "ch-stats";
    const atk = document.createElement("span");
    atk.innerHTML = `攻<b>${p.attack || m.attack || "-"}</b>`;
    const hp = document.createElement("span");
    hp.innerHTML = `血<b>${p.hp || m.hp || "-"}</b>`;
    stats.appendChild(atk);
    stats.appendChild(hp);
    body.appendChild(stats);
    const typeEl = document.createElement("div");
    typeEl.className = "ch-type";
    const specialty = m.specialty ? (Array.isArray(m.specialty) ? m.specialty.map((s) => "得意" + s).join(" ") : "得意" + m.specialty) : "";
    typeEl.textContent = specialty;
    body.appendChild(typeEl);
    card.appendChild(body);
    el.appendChild(card);
  });
}

// 武器盘网格（主手 + 副手）
function renderWeaponGrid(cache){
  const el = document.getElementById("wp-grid");
  const deckData = cache.deck && cache.deck.data;
  const pc = deckPC(normalizeDeck(deckData));
  let weps = (pc && pc.weapons) ? Object.values(pc.weapons) : [];
  if(!weps.length){
    const raw = cache.weapon && cache.weapon.data;
    if(raw && raw.list) weps = raw.list.slice(0,13);
  }
  if(!weps.length){ el.innerHTML='<i class="muted">暂无武器数据</i>'; return; }
  el.innerHTML = weps.map((it,idx)=>{
    const m = it.master||{}, p = it.param||{};
    const name = (m && m.name) || "";
    const attr = m.element ?? m.attribute ?? p.element ?? p.attribute;
    const atk = p.attack !== undefined ? p.attack : m.attack;
    let skillName = "";
    for(let i=1;i<=4;i++){ if(it["skill"+i] && it["skill"+i].name){ skillName = it["skill"+i].name; break; } }
    return `<div class="wp-cell${idx===0?' main':''}">
      <span class="wp-tag">${idx===0?'主手':(charTag(attr))}</span>
      <div class="wp-icon" style="border:2px solid ${charColor(attr)}">🗡️</div>
      <div class="wp-name">${name||it.id}</div>
      <div class="wp-atk">攻 ${atk||"-"}</div>
      ${skillName?`<div class="wp-skill">${skillName}</div>`:""}
    </div>`;
  }).join("");
}

// 召唤栏（主召唤 + 副召唤）
function renderSummonGrid(cache){
  const el = document.getElementById("sm-grid");
  const deckData = cache.deck && cache.deck.data;
  const pc = deckPC(normalizeDeck(deckData));
  let sums = [];
  if (pc && pc.summons) sums.push(...Object.values(pc.summons));
  if (pc && pc.sub_summons) sums.push(...Object.values(pc.sub_summons));
  if(!sums.length){
    const raw = cache.summon && cache.summon.data;
    if(raw && raw.list) sums = raw.list.slice(0,6);
  }
  if(!sums.length){ el.innerHTML='<i class="muted">暂无召唤数据</i>'; return; }
  el.innerHTML = sums.map((it,idx)=>{
    const m = it.master||{}, p = it.param||{};
    const name = (m && m.name) || "";
    const attr = m.element ?? m.attribute ?? p.element ?? p.attribute;
    const atk = p.attack||m.attack||"-";
    return `<div class="sm-cell${idx===0?' main':''}">
      <div class="sm-icon" style="border:2px solid ${charColor(attr)}">${charTag(attr)||"✨"}</div>
      <div class="sm-name">${name||it.id}</div>
      <div class="sm-meta">${ATTR_NAME[attr]||""} · 攻 ${atk}</div>
    </div>`;
  }).join("");
}

// 数值统计：先展示可用基础统计（完整攻刃引擎后续）
function renderStatEstimate(cache){
  const el = document.getElementById("stats");
  const deckData = cache.deck && cache.deck.data;
  const weps = (deckData && deckData.deck && deckData.deck.pc && deckData.deck.pc.weapons)
    ? Object.values(deckData.deck.pc.weapons) : [];
  if(!weps.length){ el.innerHTML='<i class="muted">数值引擎待接入（参考 Tarou 攻刃/EX/浑身计算）</i>'; return; }
  // 简化的攻刃估算：按武器数量 + 技能类型粗分（占位，真实公式后续实现）
  const totalAtk = weps.reduce((s,w)=> s + Number((w.param&&w.param.attack)||(w.master&&w.master.attack)||0), 0);
  const attrs = weps.reduce((s,w)=>{ const a=String((w.master&&w.master.element)||(w.param&&w.param.element)); s[a]=(s[a]||0)+1; return s;},{});
  const rows = [
    ["武器数", weps.length + " 把", Math.min(100, weps.length*8)],
    ["总攻击", totalAtk.toLocaleString(), Math.min(100, totalAtk/2000)],
    ["主属性", (Object.entries(attrs).sort((a,b)=>b[1]-a[1])[0]||["?",""])[0]+"属 x"+(Object.values(attrs)[0]||0), 60],
  ];
  el.innerHTML = rows.map(([label,val,bar])=>`
    <div class="stat-row">
      <span class="label">${label}</span>
      <span class="val">${val}</span>
    </div>
    <div class="bar"><i style="width:${bar}%"></i></div>`).join("")
    + '<div class="muted" style="margin-top:8px">⚠️ 当前为基础统计，完整「攻刃/EX/浑身」精细计算引擎为下一步 TODO</div>';
}

// 保留原渲染调用
function refreshAll(){ refresh(); }
const refreshBtn = document.getElementById("btn-refresh");
if (refreshBtn) refreshBtn.addEventListener("click", refreshAll);

// ===== Tab 切换：配队读取 | 战斗事件 =====
function bindTabs() {
  const deckBtn = document.getElementById("tab-btn-deck");
  const battleBtn = document.getElementById("tab-btn-battle");
  const deckPanel = document.getElementById("panel-deck");
  const battlePanel = document.getElementById("panel-battle");
  if (!deckBtn || !battleBtn || !deckPanel || !battlePanel) return;
  function select(which) {
    const isDeck = which === "deck";
    deckBtn.classList.toggle("active", isDeck);
    battleBtn.classList.toggle("active", !isDeck);
    deckPanel.style.display = isDeck ? "" : "none";
    battlePanel.style.display = isDeck ? "none" : "";
  }
  deckBtn.addEventListener("click", () => select("deck"));
  battleBtn.addEventListener("click", () => select("battle"));
  return select;
}
const selectTab = bindTabs();

function bindScrollbars() {
  const scrollAreas = [document.querySelector(".main"), document.querySelector(".sidebar")].filter(Boolean);
  scrollAreas.forEach((area) => {
    let hideTimer = null;
    const showScrollbar = () => {
      area.classList.add("is-scrolling");
      clearTimeout(hideTimer);
      hideTimer = setTimeout(() => area.classList.remove("is-scrolling"), 700);
    };
    area.addEventListener("scroll", showScrollbar, { passive: true });
    area.addEventListener("mouseenter", () => area.classList.add("is-scrolling"));
    area.addEventListener("mouseleave", () => {
      clearTimeout(hideTimer);
      area.classList.remove("is-scrolling");
    });
  });
}
bindScrollbars();

// ===== 实时监听：数据到位自动重渲染，无需手动点击 =====
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  // 数据缓存、诊断、最近请求 或 战斗事件 任一变化都触发刷新展示
  if (changes["gugu_gbf_data"] || changes["gugu_gbf_dbg"] || changes["gugu_gbf_recent"] || changes["gugu_gbf_battle"]) {
    refresh();
  }
});
liveRefresh(true);
function liveRefresh(first) {
  if (first) refresh();
}
const manifestVersion = "0.1.0";
const versionNode = document.getElementById('plugin-version');
if (versionNode) versionNode.textContent = 'v' + manifestVersion;

function applyGlobalScale() {
  const width = Math.max(window.innerWidth || 0, 240);
  const scaleByWidth = width / 500;
  const scale = Math.min(2, Math.max(0.36, scaleByWidth));
  document.documentElement.style.setProperty('--ui-scale', scale.toFixed(3));
}
window.addEventListener('resize', applyGlobalScale);
applyGlobalScale();