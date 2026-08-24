---
title: "教程 | Cursor 远程连接 AutoDL 并使用 Codex"
description: "在 Windows、Cursor 和 Clash/Mihomo 环境下，通过 SSH 反向代理为 AutoDL 远程服务器配置并运行 Codex。"
pubDate: "Aug 25 2026"
badge: "Guide"
tags: ["Cursor", "Codex", "AutoDL", "Remote SSH"]
---

# Cursor 远程连接 AutoDL 并使用 Codex

本教程基于[方案三原教程](https://www.cnblogs.com/solarlemon/p/21703406)，并结合已经验证成功的配置整理。

适用场景：

- 本机使用 Windows、Cursor 和 Clash Verge/Mihomo
- 本机代理端口为 `7890`
- Cursor 通过 Remote SSH 连接国内 AutoDL 服务器
- Codex 扩展运行在远程服务器，并通过本机 VPN 访问 OpenAI

## 一、本机只需配置一次

### 1. 检查本机代理

确保 Clash/VPN 正在运行，并且 Mixed Port 为 `7890`。

在本机 PowerShell 执行：

```powershell
netstat -ano | findstr ":7890" | findstr "LISTENING"
curl.exe -x http://127.0.0.1:7890 -I https://api.openai.com
```

### 2. 配置 SSH 反向代理

打开：

```text
C:\Users\你的用户名\.ssh\config
```

为每台 AutoDL 服务器添加一段配置：

```sshconfig
Host autodl-new
    HostName connect.westc.seetacloud.com
    User root
    Port 你的AutoDL端口

    RemoteForward 127.0.0.1:7890 127.0.0.1:7890
    ExitOnForwardFailure yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
    TCPKeepAlive yes
```

如果使用 SSH 密钥，再加入：

```sshconfig
    IdentityFile C:\Users\你的用户名\.ssh\id_ed25519
```

以后在 Cursor 中直接连接 `autodl-new`。

### 3. 修改 Cursor 本机设置

在 Cursor 中按 `Ctrl+Shift+P`，执行：

```text
Preferences: Open User Settings (JSON)
```

本机配置文件通常位于：

```text
%APPDATA%\Cursor\User\settings.json
```

在现有配置中加入：

```json
"remote.extensionKind": {
    "openai.chatgpt": ["workspace"]
}
```

同时在已有的 `remote.SSH.remotePlatform` 中加入服务器别名：

```json
"remote.SSH.remotePlatform": {
    "autodl-new": "linux"
}
```

不建议配置下面这一项，因为 Codex 扩展较大，可能长时间停留在后台安装：

```json
"remote.SSH.defaultExtensions": [
    "openai.chatgpt"
]
```

如果已经添加，可以删除。

### 4. 上传 Codex 认证和配置文件

第一次连接全新服务器时，先不要在 Cursor 中打开该服务器。直接将本目录中的 `auth.json` 和新版 `config.toml` 复制到服务器的 `/root/.codex/`。

在本机 PowerShell 执行：

```powershell
ssh autodl-new "mkdir -p ~/.codex && chmod 700 ~/.codex"
scp "E:\cctv-lab\cursor-codex\auth.json" "E:\cctv-lab\cursor-codex\config.toml" "autodl-new:~/.codex/"
ssh autodl-new "chmod 600 ~/.codex/auth.json ~/.codex/config.toml"
```

新版 `config.toml` 内容为：

```toml
[proxy]
http_proxy = "http://127.0.0.1:7890"
https_proxy = "http://127.0.0.1:7890"

[projects."/root/.codex"]
trust_level = "trusted"
```

`auth.json` 相当于登录密码，不要上传到 Git、公开网盘或发送给其他人。以后凭据失效时，只需用本机最新的 `auth.json` 覆盖服务器上的同名文件。

## 二、每台全新服务器都要操作

### 1. 使用 Cursor 连接服务器

在 Cursor 中执行：

```text
Ctrl+Shift+P
Remote-SSH: Connect to Host
autodl-new
```

### 2. 配置远程 Cursor 代理

连接服务器后，按 `Ctrl+Shift+P`，执行：

```text
Preferences: Open Remote Settings (JSON)
```

注意这里必须是 Remote Settings，不是本机 User Settings。

写入：

```json
{
    "http.proxy": "http://127.0.0.1:7890",
    "http.proxySupport": "override",
    "http.proxyStrictSSL": false,
    "terminal.integrated.env.linux": {
        "http_proxy": "http://127.0.0.1:7890",
        "https_proxy": "http://127.0.0.1:7890",
        "HTTP_PROXY": "http://127.0.0.1:7890",
        "HTTPS_PROXY": "http://127.0.0.1:7890",
        "ALL_PROXY": "http://127.0.0.1:7890",
        "all_proxy": "http://127.0.0.1:7890",
        "NO_PROXY": "localhost,127.0.0.1,::1",
        "no_proxy": "localhost,127.0.0.1,::1"
    }
}
```

### 3. 配置服务器代理环境

在远程终端执行：

```bash
printf '%s\n' \
'export http_proxy="http://127.0.0.1:7890"' \
'export https_proxy="http://127.0.0.1:7890"' \
'export HTTP_PROXY="http://127.0.0.1:7890"' \
'export HTTPS_PROXY="http://127.0.0.1:7890"' \
'export ALL_PROXY="http://127.0.0.1:7890"' \
'export all_proxy="http://127.0.0.1:7890"' \
'export NO_PROXY="localhost,127.0.0.1,::1"' \
'export no_proxy="localhost,127.0.0.1,::1"' \
| tee /etc/profile.d/codex-proxy.sh >/dev/null

chmod 644 /etc/profile.d/codex-proxy.sh
source /etc/profile.d/codex-proxy.sh
```

这里使用 `/etc/profile.d/codex-proxy.sh`，无需再把代理变量追加到 `.bashrc`。

`~/.codex/config.toml` 中的 `[proxy]` 与系统环境变量共同使用。

### 4. 测试 SSH 隧道

```bash
timeout 3 bash -c '</dev/tcp/127.0.0.1/7890' \
  && echo "TUNNEL_OK" \
  || echo "TUNNEL_FAILED"
```

成功应显示：

```text
TUNNEL_OK
```

继续测试 OpenAI：

```bash
curl -sS -o /dev/null \
  -w 'HTTP=%{http_code} IP=%{remote_ip} TIME=%{time_total}\n' \
  --connect-timeout 8 \
  --max-time 20 \
  --proxy http://127.0.0.1:7890 \
  https://api.openai.com/v1/models
```

下面这种结果表示网络已经成功经过本机代理：

```text
HTTP=401 IP=127.0.0.1
```

`401` 是因为测试命令没有携带 API 凭据，不代表代理失败。

### 5. 重启远程 Cursor Server

在 Cursor 中执行：

```text
Remote-SSH: Kill Cursor Server on Host
```

部分版本显示为：

```text
Remote-SSH: Kill VS Code Server on Host
```

然后：

1. 关闭连接到该服务器的所有 Cursor 窗口。
2. 保持本机 Clash/VPN 运行。
3. 重新连接服务器。

## 三、安装 Codex 扩展

Codex Linux 扩展压缩包较大，Cursor 可能长时间显示“正在安装”。推荐使用断点续传方式手动安装。

先在扩展市场查看当前版本号。下面以 `26.818.61809` 为例：

```bash
VER=26.818.61809

cd /root/autodl-tmp

curl \
  --proxy http://127.0.0.1:7890 \
  -L --fail \
  --retry 10 \
  --retry-delay 3 \
  --connect-timeout 15 \
  -C - \
  -o "openai.chatgpt-${VER}-linux-x64.vsix" \
  "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/openai/vsextensions/chatgpt/${VER}/vspackage?targetPlatform=linux-x64"
```

确认文件已经下载：

```bash
ls -lh "/root/autodl-tmp/openai.chatgpt-${VER}-linux-x64.vsix"
```

安装扩展：

```bash
CODE_CLI="$(find ~/.cursor-server/bin -type f -path '*/bin/remote-cli/code' | head -n 1)"

"$CODE_CLI" \
  --install-extension "/root/autodl-tmp/openai.chatgpt-${VER}-linux-x64.vsix" \
  --force \
  --verbose
```

安装完成后，在 Cursor 中执行：

```text
Developer: Reload Window
```

检查远程扩展：

```bash
find ~/.cursor-server/extensions \
  -maxdepth 1 \
  -type d \
  -name 'openai.chatgpt-*' \
  -print
```

目录名称应该包含 `linux-x64`。

安装成功后可以删除 VSIX：

```bash
rm -f "/root/autodl-tmp/openai.chatgpt-${VER}-linux-x64.vsix"
```

## 四、最终验证

打开 Codex 侧边栏并发送一条消息，然后在远程终端执行：

```bash
PID="$(pgrep -n -f '[c]odex.*app-server')"
echo "Codex PID=$PID"

if [ -n "$PID" ]; then
    tr '\0' '\n' < "/proc/$PID/environ" | grep -i proxy
else
    echo "Codex app-server 尚未启动"
fi
```

应当能看到：

```text
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
ALL_PROXY=http://127.0.0.1:7890
```

至此，Codex 可以直接：

- 查看和修改服务器项目代码
- 运行训练、测试和数据处理脚本
- 读取日志并定位报错
- 像操作本机项目一样操作 AutoDL 项目

## 五、以后新建服务器的最短清单

每次创建全新的 AutoDL 服务器：

1. 在本机 SSH config 中新增 Host，并配置 `RemoteForward`。
2. 在 Cursor 本机的 `remote.SSH.remotePlatform` 中加入新 Host。
3. 将 `E:\cctv-lab\cursor-codex` 中的 `auth.json` 和 `config.toml` 上传到服务器的 `~/.codex/`。
4. 使用 Cursor 连接服务器。
5. 设置 Remote Settings 代理。
6. 创建 `/etc/profile.d/codex-proxy.sh`。
7. 测试 `TUNNEL_OK` 和 `HTTP=401`。
8. Kill Cursor Server 后重新连接。
9. 手动安装 Codex Linux VSIX。
10. 检查 Codex 进程是否继承代理变量。

如果出现：

```text
remote port forwarding failed for listen port 7890
```

说明已有 SSH/Cursor 连接占用了服务器的 `7890`。关闭连接到该服务器的全部 Cursor 窗口后重新连接即可。

如果确实需要同时建立多个 SSH 连接，可以将远程端口改为其他端口，例如：

```sshconfig
RemoteForward 127.0.0.1:17890 127.0.0.1:7890
```

此时服务器端所有代理地址都要相应改为 `127.0.0.1:17890`。

## 六、AutoDL 实例克隆

AutoDL 的“克隆实例”默认以原实例的系统盘创建新实例。`/root/.codex`、`/etc/profile.d/codex-proxy.sh` 和 `/root/.cursor-server/extensions` 都位于系统盘，因此通常会一起被克隆。

完整克隆后一般不需要：

- 再次复制 `.codex`
- 再次上传 `auth.json`
- 再次上传 `config.toml`
- 再次配置服务器代理
- 再次安装远程 Codex 扩展

但是仍需在本机完成：

1. 更新或新增 SSH Host、地址和端口。
2. 保留 `RemoteForward 127.0.0.1:7890 127.0.0.1:7890`。
3. 如果使用新别名，将它加入 Cursor 的 `remote.SSH.remotePlatform`。
4. 保持本机 Clash/VPN 运行，然后重新连接。

连接克隆实例后检查：

```bash
test -f /root/.codex/auth.json && echo "AUTH_OK"
test -f /etc/profile.d/codex-proxy.sh && echo "PROXY_CONFIG_OK"
test -f /root/.codex/config.toml && echo "CONFIG_OK"

timeout 3 bash -c '</dev/tcp/127.0.0.1/7890' \
  && echo "TUNNEL_OK" \
  || echo "TUNNEL_FAILED"

find ~/.cursor-server/extensions \
  -maxdepth 1 \
  -type d \
  -name 'openai.chatgpt-*' \
  -print
```

只有在以下情况才需要手动迁移 `.codex`：

- 创建的是全新实例，而不是克隆实例
- 只复制了 `/root/autodl-tmp` 数据盘
- 使用了新的基础镜像，没有恢复原系统盘
- 保存镜像时还没有创建 `/root/.codex`

迁移范围：

- 只需要恢复本教程的认证与代理配置：复制 `auth.json` 和 `config.toml` 到 `/root/.codex/`
- 需要登录、配置和历史记录：复制整个 `/root/.codex/`

`auth.json` 只包含认证状态。历史记录和会话还可能位于 `history.jsonl`、`sessions/` 以及 `.codex` 下的其他状态文件中。

## 参考资料

- [方案三原教程：Cursor/VS Code 远程服务器使用 Codex](https://www.cnblogs.com/solarlemon/p/21703406)
- [AutoDL：迁移实例（同地区）](https://www.autodl.com/docs/migrate_instance_2/)
- [AutoDL：镜像](https://www.autodl.com/docs/image/)
- [AutoDL：系统盘和数据盘说明](https://www.autodl.com/docs/env/)
- [Codex IDE 文档](https://learn.chatgpt.com/docs/codex/ide)
- [Codex 认证说明](https://learn.chatgpt.com/docs/auth)
- [Codex 配置与状态说明](https://learn.chatgpt.com/docs/config-file/advanced)
- [VS Code Remote SSH：指定扩展运行位置](https://code.visualstudio.com/docs/remote/ssh#_advanced-forcing-an-extension-to-run-locally-remotely)
