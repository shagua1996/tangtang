# 芃悦居木门桌面版

本地尺寸计算、销售/生产单、逐条标签打印、订单历史与设置。保留旧业务公式及快照，使用 Vue 3 + TypeScript + Element Plus、Electron 22.3.27、SQLite。

- [业务需求、字段、精确公式和旧代码索引](docs/requirements.md)
- [架构、迁移、界面、打印和验收设计](docs/design.md)
- [实施及验证进度](docs/progress.md)
- [验证报告与性能实测](docs/verification.md)

## 开发与构建

使用支持 Vite 6 的开发用 Node 安装依赖。PowerShell 使用 `.cmd` 避免脚本执行策略影响。应用使用 Electron 自带 Node，与开发机 Node 独立。

开发时 Vite 仅热更新界面。修改 `desktop/` 中的主进程、preload 或存储接口后，请先保存当前订单，再关闭应用并重新运行 `npm.cmd run dev`。启动脚本会在桌面代码变动时输出此提示，不自动关闭含未保存录入的窗口。旧窗口缺少最近输入接口时，会保留手动输入并提示重启，不重复弹出技术错误。

```powershell
npm.cmd install
npm.cmd run dev
npm.cmd run typecheck
npm.cmd test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run build:dir
npm.cmd run dist
npm.cmd run benchmark
node tests/performance.cjs
```

`build` 执行类型检查并构建前端；`build:dir` 生成 Windows x64 未安装目录，`dist` 生成 x64 NSIS 安装包，输出在 release/。postinstall 为 Electron 重建原生依赖。test 包含 TypeScript 业务测试和通过 tools/electron-node.cjs 执行的数据库测试；benchmark 也通过该桥接器匹配 better-sqlite3 的 Electron ABI。不要以主机 `node tests/storage.cjs` 替代原生测试。安装时如需本机原生构建工具，应依据安装日志处理；安装成功仍须检查打包产物。

## 数据和使用

新库在 Electron userData 下的 db 子目录。首次运行选择旧 Tang 目录迁移 order.db、case.db、setting.db，或明确初始化空库。迁移先复制文件再流式读取及事务核对，损坏或冲突停止，原库不修改。迁移前关闭旧程序，避免复制过程中继续写入。

先计算并累积清单，再创建订单；当前订单提供销售单、生产单、标签。历史左侧订单每页100条，右侧完整展示所选单据、不再分页；可搜索、打印、删除，不可编辑。页面和打印共用表格模板，保留旧项目单据排版及按钮位置。销售/生产 A4 纵向；每条明细一张标签，八项内容，纸张跟随打印机设置及 2mm 边距。未提交清单不在重启后恢复。开发启动的数据位于 userData/development-db，正式安装位于 userData/db，两者隔离。

## 兼容目标与验证边界

目标 Windows 7 SP1/10/11 x64，最小布局 1024×600。Electron 22 已结束维护，为旧系统兼容固定 22.3.27；渲染目标 Chrome 108，桌面代码目标 Node 16。这不等于已通过 Windows 7 真机验证，也不承诺后续安全维护。

发版前须验证真实 Windows 7/10/11 安装运行、物理 A4/标签打印机，以及双核/4GB/SSD 上 10 万订单/100 万明细和单订单 1 万明细。类型检查和自动化不能证明旧系统、驱动或最低配置性能已通过。实际结果见进度记录及测试输出。

## 目录与旧版参考

domain/ 保存业务规则，ui/ 是新界面，desktop/ 是主进程、preload、数据库与打印，tools/ 是开发测试工具，tests/ 是验证用例。src/ 保留原 electron-vue 代码供核对；新入口为 desktop/main.cjs，不再使用旧 README 的 9080 热更新入口或不存在的 lint 命令。
