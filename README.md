# Gloria Universe 主题配置接口版

Gloria Universe 的极简探针配置接口适配版。主题短名为 `gloria-universe`，当前版本为 `1.2.1`。

可安装文件为仓库中的 [`theme-api.tar.gz`](theme-api.tar.gz)，也可[直接下载最新发布的 theme.tar.gz](https://github.com/dongbo501/gloria-universe-monitor-theme/releases/latest/download/theme.tar.gz)。两者内容相同；原始主题包保存在 `upstream/theme.tar.gz`，仅作为构建输入。

## 安装与使用

1. 将极简探针 hub 升级到支持主题配置 GET/PUT 接口的最新版。
2. 在后台主题页上传 `theme-api.tar.gz`，覆盖安装 Gloria Universe；随后刷新主题页面。
3. 管理员登录后打开主题自带的“主题设置”，点击“保存到服务器”。此后保存只读写配置接口，无需重新安装主题。

主题信息中的仓库地址指向本仓库，后续版本可使用极简探针后台的“从 GitHub 更新”。各版本安装包及 SHA-256 校验文件见 [Releases](https://github.com/dongbo501/gloria-universe-monitor-theme/releases)。

后台主题卡片上的“设置”与主题自带设置页使用同一份数据库配置。访客刷新后读取最新配置，已打开页面沿用原主题每 30 秒同步的机制。

原始主题包中 `dist/theme-config.json` 的有效设置已经转为新包的默认值，安装后保留该包的外观。如果运行中的旧主题设置与原始主题包不同，请先在旧主题中“导出配置”，安装新包后“导入配置”并保存一次。

旧包中的 3 个禁用设置仍在主题自带界面提示暂不可用，不在后台声明：导出二级密码、自定义标签显示、GPU 图表。其余 52 项设置全部可通过后台面板和主题自带界面管理。

## 修改行为

- 启动和后续同步从 `GET /api/themes/gloria-universe/config` 读取覆盖值，与主题声明中的默认值合并。
- 保存先读取原始配置，再使用 `PUT /api/themes/gloria-universe/config` 写入；仅存与默认值不同的项，并保留当前主题不认识的键。
- 保留编辑冲突检查、同浏览器保存锁和保存后读取确认。失败时显示错误，不将未确认的结果显示为已保存。
- 普通页面读取失败或读取到不符合声明的旧值时使用默认值。管理员主动重新读取失败时保留草稿。
- 按 UTF-8 字节检查完整配置的 64 KiB 限制。成功响应支持 hub 的 `204 No Content`。
- “载入默认值”后保存会移除已声明项的覆盖值。数据库中的设置可跨主题更新、重装保留。
- `dist/theme-config.json` 保留作为可导入的配置快照，运行时不再读取它。“下载主题与配置备份”下载主题资源和这份快照；恢复设置时，导入备份内的 `dist/theme-config.json` 并保存。安装备份包不会覆盖 hub 已保存的配置。

## 文件与维护

原压缩包仅包含编译产物，未附 Vue/Vite 源码。此目录提供针对该包的可重复构建脚本，并将新配置接口逻辑保留为可读源码：

- `src/theme-config-api.js`：默认值合并、字段校验、GET/PUT 和请求错误处理。
- `src/theme-persistence.service.js`：登录检查、编辑冲突检查、保存及确认。
- `scripts/build-theme.mjs`：从原包读取设置元数据，生成 `theme.json` 和一致的浏览器声明，替换旧读写代码，更新资源文件名和打包校验清单。
- `theme-api/`：生成的解压主题目录。
- `tests/`：接口回归测试和浏览器流程验证。
- `upstream/theme.tar.gz`：原始编译包，用于重复构建；不是新版安装包。

重新生成安装包需要 Node.js 20+、Python 3.12+ 和 tar：

```sh
node scripts/build-theme.mjs
node --test tests/theme-config.test.mjs
```

构建脚本会重新生成 `theme-api/`、`theme-api.tar.gz` 和 SHA-256 校验文件，原始输入包不变。脚本针对仓库中的原始编译包校验替换位置，不适用于任意其他版本。版本号与仓库地址来自 `package.json`；安装包使用固定归档时间及文件顺序，可重复构建。

浏览器验证需要安装 Playwright 和 Chromium：

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

也可通过 `PLAYWRIGHT_MODULE` 指定 Playwright 模块路径，通过 `CHROMIUM_PATH` 指定现有 Chromium 可执行文件。

已验证 12 组接口与资源完整性测试，并用 Chromium 对模拟 hub 验证保存、刷新恢复、后台配置变更、保留草稿、冲突、失败提示、备份下载、恢复默认和访客显示。未连接用户实际部署的 hub。接口采用普通 GET/PUT，未提供条件写入能力；保存前检查可发现已发生的修改，但无法保证不同设备恰好同时写入时的原子冲突检测。

接口依据：https://monitor-document.pages.dev/dev/theme

## 许可证与来源

保留原主题的 [MIT 许可证](LICENSE) 和包内素材来源说明。原始包信息见 [upstream/README.md](upstream/README.md)。本仓库包含配置接口适配源码，并不包含原主题未提供的完整 Vue/Vite 工程。
