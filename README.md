# GUGU-GBF

碧蓝幻想（Granblue Fantasy）辅助工具：读取玩家配置，推荐副本最优配队，并根据战斗实时状态给出当回合操作建议。

> ⚠️ **合规声明**：本工具为**纯只读展示**，仅读取页面数据并展示建议，**不进行任何自动点击 / 自动操作**。游戏内供第三方工具存在封号风险，使用前请谨慎评估。

## 架构

```
┌─────────────────────────────┐
│ Chrome 扩展 (MV3, JS)        │  读取页面/网络请求 + 展示界面
│  content.js  background.js  │
│  popup/ (配队&战斗建议)       │
└─────────────┬───────────────┘
              │ JSON (本机 127.0.0.1:8765)
┌─────────────▼───────────────┐
│ Python 分析引擎 (analyzer/)   │  配队算法 + 战斗回合判断
│  team_builder.py             │
│  battle_advisor.py           │
└─────────────────────────────┘
```

## 快速开始

### 1. 运行 Python 分析引擎（可选，当前可离线演示）

```bash
cd GUGU-GBF
# 配队演示
python -m analyzer.main_cli team
# 战斗建议演示
python -m analyzer.main_cli battle
```

### 2. 加载 Chrome 扩展

1. Chrome 打开 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点「加载已解压的扩展程序」，选择 `extension/` 文件夹
4. 打开 GBF 游戏页面，点击扩展图标查看配队与战斗建议

## 目录结构

```
GUGU-GBF/
├── analyzer/                  # Python 分析引擎
│   ├── __init__.py
│   ├── models.py             # 数据模型（角色/武器/召唤/副本/战斗状态）
│   ├── knowledge_data.py     # 示例知识库（待接真实数据）
│   ├── team_builder.py       # 配队算法
│   ├── battle_advisor.py     # 回合建议规则
│   └── main_cli.py           # 命令行入口
└── extension/                 # Chrome MV3 扩展
    ├── manifest.json         # 扩展清单
    ├── background.js         # 监听网络请求 → 转发 Python
    ├── content.js            # 页面注入：读 DOM / fetch
    └── popup/                # 展示界面
        ├── popup.html
        └── popup.js
```

## 现状与下一步

- ✅ 数据模型、配队算法、回合建议规则已可运行（示例数据）
- ✅ Chrome MV3 扩展骨架（网络监听 + 界面流）已就绪
- ⏳ 接真实数据：需抓取 GBF 网络请求，把字段映射到 models.py
- ⏳ 战斗状态半自动录入对接
- ⏳ 知识库扩充（真实角色/武器/召唤/副本数据）