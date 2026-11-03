# RA2WEB React

免责声明：这是基于《红色井界》RA2WEB www.ra2web.com 的分析而开发，并意图基于最新的react和three版本进行重构。

但项目所有权利（包括收益权）归《红色井界》/RA2WEB负责人所有。未经《红色井界》/RA2WEB负责人许可，严禁用于任何商业行为。

需要注意的是，《红色井界》/RA2WEB的负责人从未以任何方式开源游戏客户端代码（即便存在诸如mod-sdk之类的周边开源内容）。本项目运行产生的BUG、功能不完善，不能等同视为对《红色井界》/RA2WEB的名誉贬损。

红色警戒2网页版，一款经典的即时战略类游戏的完整TypeScript重构版本，使用React + TypeScript + Vite + Three.js构建。

![动画](https://github.com/user-attachments/assets/d83f6001-d426-4d49-98a6-8282addc898d)

Disclaimer

This project is developed based on the analysis of 红色井界 / RA2WEB (www.ra2web.com), and is intended to be refactored using the latest versions of React and Three.js. All rights to this project, including profit rights, belong to the owner of 红色井界 / RA2WEB. Without permission from the owner of 红色井界 / RA2WEB, any commercial use of this project is strictly prohibited.

It should be noted that the owner of 红色井界 / RA2WEB has never open-sourced the game client code in any form, even though some peripheral open-source content such as a mod-SDK exists. Bugs, incomplete functions or other issues arising from the operation of this project shall not be regarded as damage to the reputation of 红色井界 / RA2WEB.

![image](https://github.com/user-attachments/assets/f146dc1c-ca15-456a-a8f0-4b43f2d431e8)

![image](https://github.com/user-attachments/assets/a23760df-e679-4b32-a9a2-ca51c214c420)

![image](https://github.com/user-attachments/assets/4781f451-7a51-45e2-919b-cbcb8bbd727a)

## 项目简介

本项目是使用Typescript编写，完全对标“红色警戒2”的游戏引擎，本地自行导入红色警戒2美术素材后，就可以获得类似红警2的游玩体验

## 当前技术状态

### 运行时和构建

- 包管理与本地运行时：`Bun 1.3.10`
- 开发服务器：`Vite 8.0.1`
- UI：`React 19.2.4` + `react-dom 19.2.4`
- 类型系统：`TypeScript 5.9.3`
- 渲染：`three 0.183.2`
- 自动化：`Playwright 1.58.2`
- 默认开发和预览端口：`127.0.0.1:4000`

## 快速开始

### 环境要求

- `Bun 1.3+`
- 现代浏览器，推荐 Chrome / Edge
- 浏览器需要支持：
  - `WebGL`
  - `Web Audio API`
  - `File System Access API`

### 安装与启动

```bash
cd redalert2
bun install
bun run dev
```

默认访问地址：

```text
http://127.0.0.1:4000
```

生产构建与预览：

```bash
bun run build
bun run preview
```

类型检查：

```bash
bun run typecheck:entry
```

## 自动化回归

仓库当前已经不再只依赖手点验证。`scripts/` 下维护了一组可直接执行的回归脚本，主要覆盖大厅、进图、机制和 tester 入口。

常用命令包括：

```bash
bun run debug:game-res-init
bun run debug:viewport
bun run debug:options
bun run debug:storage-explorer
bun run debug:skirmish
bun run debug:skirmish-lobby-data
bun run debug:victory-exit
bun run debug:superweapon
bun run debug:nuke
bun run debug:radiation
bun run debug:minimap-shroud
bun run debug:anti-air-hit
bun run debug:terror-drone
bun run debug:chrono-legionnaire
bun run debug:test-entries
bun run debug:tester-panels
```

这些脚本的产物默认会写入 `.artifacts/`，便于回看截图和 JSON 结果。

## 测试入口

主菜单中的测试入口目前分为三类：

1. 素材测试
   - `VXL测试`
   - `SHP测试`
   - `音频测试`
2. 机制测试
   - `建筑测试`
   - `载具测试`
   - `步兵测试`
   - `飞行器测试`
3. 场景测试
   - `大厅测试`
   - `世界测试`
   - `移动测试`

这些 tester 页面不是孤立 Demo，而是当前仓库里很重要的调试和回归入口。页面左侧面板状态会同步到调试状态对象，自动化脚本也会直接使用这些入口验证渲染和交互结果。

## 技术架构

### 核心技术栈

- `React 19.2.4`
- `TypeScript 5.9.3`
- `Vite 8.0.1`
- `three 0.183.2`
- `Bun 1.3.10`
- `Playwright 1.58.2`
- `7z-wasm`
- `file-system-access`
- `@ffmpeg/ffmpeg`
- `@ra2web/pcxfile`
- `@ra2web/wavefile`

### 目录说明

```text
redalert2/
├── public/          静态资源、配置、locale、遗留样式
├── scripts/         Playwright 自动化回归脚本
├── src/
│   ├── data/        原版资源格式、编码、地图、VFS
│   ├── engine/      渲染、音频、资源加载、底层引擎能力
│   ├── game/        游戏逻辑、对象系统、触发器、规则、超武
│   ├── gui/         主菜单、HUD、选项、游戏内 UI
│   ├── network/     网络和联机相关基础设施
│   ├── tools/       独立 tester 页面
│   └── util/        通用工具
├── docs/            对齐记录与工程说明
└── vite.config.ts   开发和构建配置
```

### 主要模块

`src/engine/`

- `gfx/`：three 渲染层、材质、批处理、viewport、lighting
- `renderable/`：游戏对象到可视对象的桥接层
- `sound/`：音频混音、音乐、音效播放
- `gameRes/`：资源导入、CDN 加载、缓存与目录处理

`src/game/`

- `gameobject/`：单位、建筑、抛射体、trait、locomotor
- `rules/`：INI 规则读取与对象规则构建
- `trigger/`：地图触发器、条件、执行器
- `superweapon/`：核弹、闪电风暴、超时空等超武逻辑

`src/gui/`

- `screen/mainMenu/`：主菜单、地图选择、大厅、选项
- `screen/game/`：游戏内 HUD、世界交互、菜单
- `component/`：React 组件
- `jsx/`：自定义 UI 渲染桥接

`src/tools/`

- 提供素材、机制、场景三类 tester 页面
- 当前是调试结果可视化和自动化断言的重要入口

## 开发命令

```bash
bun run dev
bun run build
bun run preview
bun run typecheck:entry
```

## 文档与调试约定

- 开发端口固定为 `4000`
- 主要技术对齐记录维护在 `docs/build-alignment-log.md`
- 自动化产物默认输出到 `.artifacts/`
- 构建通过并不等于所有行为已完全对齐，功能层面仍应优先参考专项脚本和实际流程验证

## 贡献建议

提交改动前，至少建议执行：

```bash
bun run typecheck:entry
bun run build
```

如果改动涉及大厅、资源加载、进图、HUD、机制或 tester，请补跑相应的 `debug:*` 脚本。

## 许可证

本项目基于GNU General Public License v3.0（GPL-3.0）许可证开源。详见 [LICENSE](LICENSE) 文件。

### 重要说明
- 可以自由使用、修改和分发，除非取得《红色井界》/RA2WEB负责人许可，否则严禁用于商业目的
- 必须保留版权声明和许可证文本
- 任何衍生作品必须使用相同的 GPL-3.0 许可证
- 必须提供源代码，包括修改后的版本
- 不能将 GPL 代码集成到专有软件中

**注意：** 本项目仅用于学习和研究目的。红色警戒2是EA公司的知识产权，导入美术素材时请确保拥有合法的游戏副本。

## 致谢

- 《红色井界》/ RA2WEB.COM
- Three.js 社区
- React 团队
- TypeScript 团队
- 相关开源依赖维护者
- 红警 2 玩家社区

---

**免责声明**: 本项目仅供学习研究使用，不用于商业目的。红色警戒2及相关商标归EA公司所有。

---
