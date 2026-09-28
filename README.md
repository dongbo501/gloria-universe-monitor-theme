# GLORIA UNIVERSE · 极简探针主题

Komari × G.E.M. 邓紫棋粉丝向监控主题 [Gloria Universe](https://github.com/TonyStarkJr2021/komari-theme-Gloria-Universe) 的[极简探针](https://github.com/monitor-probe/monitor)移植版。

界面、彩蛋、星网地图、节点卡片 / 列表、详情页图表与站长工具沿用原主题，数据层改为读取 hub 的公开接口。

> 将 VPS 节点变成星辰，将实时流量变成舞台能量流，将首页变成 I AM GLORIA 数字宇宙控制中心。

## 安装

1. 构建或下载 `theme.tar.gz`。
2. 二选一：
   - 在 hub 面板的「主题」页上传 `theme.tar.gz`；
   - 或者在 hub 的 `--themes` 目录（一键脚本部署是 `/opt/monitor/data/themes/`）下新建 `gloria-universe/` 目录，把 `theme.tar.gz` 解压进去。
3. 在主题页选中 **Gloria Universe**。卡片上的设置按钮打开主题设置。

`theme.json` 的 `url` 指向本仓库，面板上的「从 GitHub 更新」会从[最新 release](https://github.com/dongbo501/gloria-universe-monitor-theme/releases/latest) 取 `theme.tar.gz`。release 的 tag 与 `version` 对应（`v1.3.0` 对 `1.3.0`），修改 `theme.json` 的版本号并推送到 main 后，`release-on-version-bump.yml` 会自动构建并发布。

## 路由

| 路径             | 页面     |
| ---------------- | -------- |
| `/`              | 首页     |
| `/instance/{id}` | 节点详情 |

前面有按路径放行的反向代理或 WAF 时，请放行 `/instance/` 前缀，否则刷新详情页会被拦下。使用 WebSocket 实时推送时还需放行 `/api/ws` 的升级请求。

## 使用的接口

只读取 hub 的公开接口，全部为同源请求：

| 接口                                     | 用途                                    |
| ---------------------------------------- | --------------------------------------- |
| `GET /api/me`                            | 站点名、登录状态                        |
| `GET /api/nodes`                         | 节点列表与实时指标（HTTP 轮询模式）     |
| `GET /api/ws`                            | 每 2 秒推送的节点快照（WebSocket 模式） |
| `GET /api/nodes/{id}/metrics`            | 负载与延迟历史                          |
| `GET /api/themes/gloria-universe/config` | 站长保存的主题设置                      |

公开状态页关闭且未登录时，主题跳转到 hub 内置的 `/admin` 登录页。

历史查询在浏览器里排队，最多同时 3 个，遇到 hub 的 503 会退避重试。首页每张节点卡片都要取延迟历史，这样不会超出 hub 同时处理 4 个历史查询的上限。

## 功能对照

| 原主题功能                                                 | 移植后                                                                                  |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 节点卡片、列表、搜索、收藏、快捷筛选                       | 保留                                                                                    |
| 星辰分组                                                   | 保留；按 hub 的 `group`，顺序跟随面板里的节点顺序；只有部分节点分组时出现「未分组」标签 |
| 宇宙总览指标                                               | 保留，跟随当前分组计算                                                                  |
| GLORIA 星网地图                                            | 保留；按 hub 的 `country`（手填优先），登录后可按节点 IP 细化到城市                     |
| 价格、付款周期、剩余时间、剩余价值、性价比、财务明细       | 保留；剩余天数使用 hub 按自己日历算好的 `expires_in`                                    |
| 流量配额与预警                                             | 保留；使用 hub 的本期流量（`month_rx` / `month_tx`，按流量重置日清零）与流量计算方式    |
| 详情页实时图表                                             | 保留；使用浏览器收到的每一帧快照，包含负载、TCP/UDP、进程数                             |
| 详情页历史图表（4 小时 / 1 天 / 7 天 / 自定义）            | 保留；hub 历史只保存 CPU、内存、磁盘和网速，连接数、进程数图表只在实时视图显示          |
| 延迟监控（卡片、列表、详情图表）                           | 保留；使用 hub 的延迟监控，丢包率为 hub 按整个时间窗算出的精确值                        |
| 站长工具：对比、拓扑、性价比、健康摘要、快照导出           | 保留，登录后显示                                                                        |
| 歌曲标签、悬停试听、Crystal G / WAKE GLORIA 彩蛋、竖排题字 | 保留                                                                                    |
| 星光 / 深空模式、玻璃配色、色觉友好配色、自定义背景        | 保留                                                                                    |
| 公告                                                       | 保留；按纯文本 + 简易 Markdown 渲染，链接只放行 http、https、mailto                     |

### 移除或调整的部分

- **Komari 官方后台（admin-app）**：hub 自带后台和登录页，主题不再打包。
- **审计日志、访客审计**：依赖 Komari 的后台接口，hub 没有对应功能。
- **导出二级密码**：hub 的主题设置对所有访客公开，不能存放密码。导出只校验站长登录。
- **`local:` 素材路径**：hub 没有用户素材目录。背景、彩蛋和音频请填 HTTPS 地址或站内 `/` 路径。
- **GPU、温度**：hub 不采集这两项，相关卡片和图表在没有数据时自动隐藏，主题设置中去掉了 GPU 图表开关。
- **节点自定义标签**：hub 没有这个字段。
- **匿名访客看不到节点地址**：依赖 IP 的 ASN、城市信息只在站长登录后可用。

主题设置中的键名与原主题保持一致。`theme.json` 按 hub 的格式声明，面板会按分组画出表单。

## 本地开发

要求 Node.js `^20.19.0` 或 `>=22.12.0`，推荐 Bun `>=1.2.0`。

```bash
bun install
# 开发服务器把 /api 和 WebSocket 代理到这个 hub；不设时代理到 http://127.0.0.1:9911
MONITOR_HUB=https://hub.example.com bun run dev
bun run lint
bun run build
```

代理到的 hub 需要开着公开状态页。`bun run build` 生成 `dist/` 并打包 `theme.tar.gz`。hub 在包的根目录找 `theme.json`，所以包里不套目录：

```text
theme.tar.gz
├── theme.json
├── preview.png
└── dist/
```

## 主要目录

```text
src/utils/hub.ts     hub 接口读取、字段转换、历史查询队列、WebSocket
src/utils/rpc.ts     主题内部的数据类型，以及基于 hub 的历史 / 延迟查询
src/utils/api.ts     站点信息、登录状态、主题设置
src/utils/init.ts    启动请求与实时数据（HTTP 轮询或 WebSocket）
src/components/      界面组件（沿用原主题）
theme.json           主题清单与站长设置声明
```

## 致谢与许可

- 原主题：[komari-theme-Gloria-Universe](https://github.com/TonyStarkJr2021/komari-theme-Gloria-Universe)，作者 TonyStarkJr2021
- 原主题的基础工程：[komari-theme-Glassmorphism](https://github.com/sanrokamlan-prog/komari-theme-Glassmorphism)
- 监控系统：[极简探针 Monitor](https://github.com/monitor-probe/monitor)
- 沿用原主题的 MIT License。

主题以粉丝文化和演唱会舞台语言为灵感。Crystal G 彩蛋采用 I AM GLORIA 演唱会水晶舞台光束现场图，WAKE GLORIA 彩蛋背景采用新闻媒体公开发布的 I AM GLORIA 2.0 婚纱舞台照片。主题不内置音乐，歌曲片段试听只读取站长自行配置并有权使用的音频。
