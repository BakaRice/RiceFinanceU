# RiceFinanceU 微信小程序

这是 RiceFinanceU 的原生微信小程序客户端，第一版只做个人使用的核心链路：

- 邮箱和密码登录。
- 查看总览、资产概览、最近快照。
- 录入新的资产快照。

小程序直接调用已经部署好的 Cloudflare Worker API：

```txt
https://ricefinanceu.ricemarch-finance.workers.dev/api
```

## 本地打开

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择 `wx-miniprogram/`。
4. 使用当前 `project.config.json` 里的 AppID。
5. 编译运行。

## 后台域名配置

如果在真机或正式环境访问，需要在小程序管理后台配置 request 合法域名：

```txt
https://ricefinanceu.ricemarch-finance.workers.dev
```

开发阶段如果只是本地调试，也可以在微信开发者工具里临时勾选“不校验合法域名、web-view、TLS 版本以及 HTTPS 证书”。

## 当前页面

- `pages/login/login`：登录页。
- `pages/index/index`：总览页。
- `pages/entry/entry`：快照录入页。

## 当前限制

- 暂不支持微信登录。
- 暂不支持新增、编辑、停用资产；需要先在 PC 端维护资产。
- 暂不支持数据导入导出。
- 暂不支持离线草稿和冲突处理。

## 测试

小程序端目前覆盖核心纯函数和 API 封装：

```bash
npm run mini:test
```
