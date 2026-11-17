# Windows pnpm 打包修复（2026-11-17）

## 复现与原因

在 `F:\pengyueju\tangtang` 的 `codex/desktop-ui` 分支执行 `pnpm.cmd build:dir`，前端编译成功，随后报错：

```text
cannot find prebuild-install
fork/exec ...\pnpm\bin\pnpm.cjs: %1 is not a valid Win32 application.
```

electron-builder 24 的旧原生模块重建路径依赖平铺的依赖目录，未正确解析 pnpm 隔离目录中的 prebuild-install；回退路径把 pnpm.cjs 当成 exe 调用。该目录的 Electron 运行时和 SQLite 原生二进制此前也未安装。

## 修复

- `tools/prepare-native.cjs`按Node模块解析规则定位Electron及SQLite真实目录，缺少Electron时显式运行其安装器。
- 通过SQLite包自身的createRequire解析其prebuild-install，使用Node启动，明确传入Electron版本、win32/x64目标；不依赖根目录提升的间接包。
- 准备前后均用目标Electron运行内存SQLite建表/写入/读取，验证Electron版本和x64运行架构。已匹配时复用，不无谓覆盖使用中的原生文件。失败时停止打包。
- `tools/package.cjs`通过Node依次运行类型检查、Vite、原生模块准备及打包器。验证通过后禁止旧打包器再次重建依赖，并使用解析出的Electron目录。
- `build:dir`、`dist`与`postinstall`接入上述流程。npm和pnpm均可使用，不需切换为hoisted依赖布局。
- 打包启动测试改用已声明的`@playwright/test`导出，不直接依赖pnpm未提升的`playwright`。

## 验证

在原仓库真实pnpm隔离目录下完成：

```powershell
pnpm.cmd build:dir
pnpm.cmd test
pnpm.cmd run postinstall
node tests/packaged.cjs
```

全部成功。打包程序已实际启动，ASAR内Worker、原生SQLite、preload、最近输入和分页正常。当前Codex工作区使用npm依赖布局，执行同一`pnpm.cmd build:dir`也成功。

产物为`release/win-unpacked/PengYueJuPlus.exe`。本次验证目录打包，未重新生成安装器。已存在的用户pnpm-lock.yaml原样保留，未提交或推送。

首次准备需要能访问Electron及SQLite官方二进制下载源或其已验证缓存；下载失败会报告日志并停止，不会输出缺少原生模块的“成功”包。打包前关闭该输出目录里的应用，以免Windows阻止覆盖exe。
