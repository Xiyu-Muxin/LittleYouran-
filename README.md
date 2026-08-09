# LittleYouran ☆ 重定向

> 爱你喵喵喵 🐟

一个基于 Magisk / KernelSU 的 Android 文件重定向模块，通过挂载与路径搬运的方式，将指定目录中的文件自动重定向到其他位置，并配备一个轻量级 WebUI 管理面板。

- **模块 ID**：`LittleYouran`
- **模块功能**：重定向文件
- **作者**：掌柜-泉氿 & 忻铃

---

## ✨ 功能特性

- 支持七种规则类型，覆盖从简单搬运到精准分流的多种场景
- 通过 WebUI（KernelSU WebUI）实时增删规则并重启守护进程
- 守护进程后台常驻，开机自启，日志自动轮转
- 自带 `libc++_shared.so` 依赖，避免系统 libc++ 不兼容问题
- 对 SELinux 上下文、可执行权限做了多重兜底处理，兼容性更好

---

## 📦 目录结构

```
LittleYouran☆重定向/
├── bin/
│   ├── LittleYouran          # 守护进程二进制（核心程序）
│   └── libc++_shared.so      # NDK 共享库依赖
├── config/
│   └── LittleYouran.txt      # 规则配置文件（每行一条规则）
├── webroot/
│   ├── index.html            # WebUI 主页面
│   ├── app.js                # WebUI 逻辑脚本
│   └── LittleYouran.png      # 背景图
├── module.prop               # Magisk 模块描述
├── post-fs-data.sh           # 开机早期：修正权限与 SELinux 上下文
├── service.sh                # 开机后期：启动守护进程、轮转日志
└── META-INF/com/google/android/
    ├── update-binary         # Magisk 安装入口
    └── updater-script
```

---

## 📜 规则语法

配置文件 `config/LittleYouran.txt` 每行一条规则，支持以下七种类型：

| 类型 | 图标 | 名称 | 示例 | 说明 |
|------|------|------|------|------|
| `mount` | 🔘 | 镜像挂载 | `mount=/sdcard/Download+/sdcard/Mirror` | 将源目录以挂载方式镜像到目标目录 |
| `simple` | 📦 | 整体搬运 | `/sdcard/Download+/sdcard/a` | 把源目录整体搬到目标目录 |
| `multi` | 📁 | 多源合一 | `/sdcard/A&&/sdcard/B+/sdcard/c` | 多个源目录合并到同一目标 |
| `filter` | 🎯 | 格式筛选 | `/sdcard/Download+*.zip+/sdcard/zip` | 仅搬运符合通配符的文件 |
| `multiFilter` | 🚀 | 多源+筛选 | `/sdcard/A&&/sdcard/B+*.mp4+/sdcard/Video` | 多源合并的同时按格式筛选 |
| `smartCategory` | 🧹 | 多格式分类 | `/sdcard/Download+*.mp4,*.zip,*.jpg+/sdcard/MyMedia` | 多种格式分流到目标下的同名子目录 |
| `routing` | 🗺️ | 精准分流路由 | `/sdcard/Download+*.mp4:/sdcard/1mp4,*.zip:/sdcard/1zzip+/sdcard/Others` | 每种格式指定独立目标，剩余走兜底目录 |

### 规则分隔符说明

- `+` ：源路径与目标路径之间的分隔
- `&&` ：多个源路径之间的分隔（同一规则多源）
- `,` ：多格式列表之间的分隔
- `:` ：格式与其对应目标之间的分隔（仅 routing 类型）
- `mount=` 前缀 ：标记为挂载类型规则

---

## 🚀 安装方法

1. 将整个目录打包为 `LittleYouran☆重定向.zip` ，或从Releases下载zip
2. 在 Magisk / KernelSU 管理器中选择「从本地安装」，选中该 zip
3. 安装完成后重启设备
4. 重启后守护进程会自动启动，日志输出至 `/data/adb/modules/LittleYouran/log.txt`

---

## 🌐 WebUI 使用

本模块附带 KernelSU WebUI 控制面板：

1. 在 KernelSU 管理器中打开模块的 WebUI 入口
2. 首页为「⚙️ 配置」，可按规则类型逐项添加规则，也可一键复制示例
3. 添加规则后会自动写入配置文件并重启守护进程
4. 已存在的规则会列在卡片下方，点 ✕ 可删除
5. 切到「📜 日志」可查看最近 20 行运行日志，点「刷新日志」可手动更新

> WebUI 通过 `ksu.exec` 接口与系统 Shell 通信，所有操作均以 root 权限执行，请谨慎使用。

---

## ⚙️ 运行机制

### post-fs-data.sh（开机早期）

- 修正守护进程二进制的可执行权限（`chmod 0755`）
- 设置 SELinux 上下文为 `magisk_file` 并执行 `restorecon`
- 该阶段挂载可能只读，部分操作在 `service.sh` 中再次兜底

### service.sh（开机后期）

- 再次修正二进制与所有 `*.so` 的权限与 SELinux 上下文
- 将模块 `bin` 目录加入 `LD_LIBRARY_PATH`，确保动态链接库可被加载
- 通过 `pgrep` 按精确路径匹配旧实例并 kill，避免重复启动
- 等待 `/sdcard` 就绪（最长 30 秒）
- 日志超过 1MB 时自动轮转为 `log.txt.old`
- 使用 `nohup` 后台启动守护进程，输出重定向到 `log.txt`

### 守护进程

`bin/LittleYouran` 是核心二进制程序，负责读取 `config/LittleYouran.txt` 并按规则执行实际的挂载与文件搬运。依赖 `bin/libc++_shared.so`（NDK `std::__ndk1` 命名空间），系统 libc++.so 不提供该符号，因此需要随模块自带。

---

## 🛠️ 手动操作

```sh
# 编辑规则配置
vim /data/adb/modules/LittleYouran/config/LittleYouran.txt

# 重启守护进程
sh /data/adb/modules/LittleYouran/service.sh

# 查看运行日志
tail -f /data/adb/modules/LittleYouran/log.txt
```

---

## ⚠️ 注意事项

- 删除或修改规则后，需通过 WebUI「保存并重启」或手动执行 `service.sh` 使其生效
- 配置文件中空行与以 `#` 开头的行会被忽略
- 守护进程依赖 `libc++_shared.so`，请勿删除 `bin` 目录下的该文件
- 模块运行需要 root + Magisk 或 KernelSU 环境
- WebUI 仅在 KernelSU webUI 环境可正常调用，其他管理器可能无法显示

---

爱你喵喵喵 🐟💛
