# 上游源码与构建输入

上游源码仓库：[TonyStarkJr2021/komari-theme-Gloria-Universe](https://github.com/TonyStarkJr2021/komari-theme-Gloria-Universe)。这是 Komari 主题的完整 Vue/TypeScript/Vite 工程，采用 MIT 许可证。

`dongbo501` 基于该 Komari 主题制作了极简探针移植版。本目录中的 `theme.tar.gz` 是配置接口改造前收到的极简探针主题包（主题版本 `1.2.0`），用于重复构建 API 适配版。它包含移植后的编译产物，未附该移植版本对应的 Vue/Vite 源码。该包不是上游 Komari 源码的归档文件，也未记录所基于的上游提交。

本仓库目前在此移植包上应用可读的配置 API 适配代码。上游 Komari 工程与极简探针的接口不同，当前脚本并不直接编译上游工程。

请勿将此文件当作新版安装包。安装适配版请使用仓库根目录的 `theme-api.tar.gz`，或 Releases 中的 `theme.tar.gz`。

原包的 `theme.json` 标注作者为 `TonyStarkJr2021`；上游与原包的 MIT 许可证均保留版权信息 `Copyright (c) 2025 Tony Liu (tonyliuzj, tony-liu.com)`。许可证及包内图片来源说明均予以保留。
