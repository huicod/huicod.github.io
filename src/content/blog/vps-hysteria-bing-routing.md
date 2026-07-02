---
title: "VPS Hysteria2 Bing 搜索结果错乱的一次排查"
description: "记录一次用 Hysteria2 和 Clash Verge 搭建 VPS 代理后，Bing 搜索结果与关键词不匹配的问题排查。"
pubDate: "May 10 2026"
thumbnailImage: "/clash-verge-icon.png"
badge: "New"
tags: ["VPS", "Hysteria2"]
---

最近参考这篇 [VPS + Hysteria2 搭建教程](https://segmentfault.com/a/1190000047723636#item-2) 配了一台自己的 VPS。整体流程并不复杂：服务器上跑 Hysteria2，客户端用 Clash Verge Rev 导入 `conf.yaml`，再按规则集做分流。

一开始 GitHub、Google 和一些 AI 服务都能正常访问，但 Bing 出现了一个很奇怪的问题：搜索能打开，输入关键词也会返回结果页，可结果和查询内容明显对不上。

排查时我先确认了几个方向：

1. Hysteria2 服务本身是正常的，端口、进程和客户端连通性都没有问题。
2. 不是所有网站都有异常，GitHub、Google 等代理访问正常。
3. 问题集中在 Bing/Microsoft 相关域名上，所以重点看客户端分流规则和 Hysteria 的伪装配置。

最后发现原配置里把 Bing 同时用在了两个位置：服务端的 `MASQUERADE_URL`，以及客户端节点的 `sni`。这在“能连通”层面没问题，但 Bing 本身又是日常要访问的真实目标站点，客户端规则里如果再把 Bing 走到代理节点，就容易让排查变得混乱。

我的处理方式是把这两件事拆开：

```yaml
# 客户端节点里不要继续用 bing.com 做 sni
sni: www.amazon.sg

# Bing/Microsoft 相关流量单独进一个组，默认 DIRECT
- DOMAIN-SUFFIX,bing.com,Microsoft
- DOMAIN-SUFFIX,bing.net,Microsoft
- DOMAIN-SUFFIX,microsoft.com,Microsoft
- DOMAIN-KEYWORD,bing,Microsoft
```

服务端脚本里的伪装地址也同步换掉：

```bash
MASQUERADE_URL="https://www.amazon.sg"
```

改完后重启 Hysteria2 服务，再在 Clash Verge 里重新加载本地配置，Bing 搜索结果就恢复正常了。

这次的经验是：Hysteria2 的伪装站点最好不要选择自己高频访问、且会被代理规则命中的业务站点。参考其他的vpn的配置进行修改即可。

相关的配置模板放在 GitHub：[huicod/vps](https://github.com/huicod/vps)。仓库里只保留占位符，真实 VPS IP 和密码需要本地替换。
