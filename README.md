# RiceFinanceU

个人资产快照账本。当前版本使用 React + Vite 构建前端，使用 Cloudflare Worker 提供 API，使用 Cloudflare KV 保存一份完整 JSON 数据。

## 项目地图

如果你想理解产品模型、代码结构、关键文件和容易改错的规则，先看：

- [项目索引](docs/PROJECT_INDEX.md)
- [模块地图](docs/architecture/module-map.md)
- [依赖规则](docs/architecture/dependency-rules.md)

正式代码统一放在 `modules/`。非主项目的示例和实验代码统一放在 `examples/`。

## 代码结构

```txt
modules/
  web-app/          React/Vite PC 端
  miniprogram-app/  微信小程序端
  worker-api/       Cloudflare Worker API
  finance-core/     共享领域核心的目标模块

docs/               项目知识库、架构说明、review 清单
examples/           学习 demo 和实验代码
```

## 当前架构

```txt
浏览器 / 未来小程序
  -> Cloudflare Worker /api
  -> Cloudflare KV

Cloudflare Worker 同时托管前端静态资源 dist/
```

第一版只支持一个用户：

- 登录邮箱：通过 Cloudflare Secret 或本地 `.dev.vars` 配置
- 登录密码：通过 Cloudflare Secret 或本地 `.dev.vars` 配置

## 本地开发

安装依赖：

```bash
npm install
```

创建本地密钥文件：

```bash
cp .dev.vars.example .dev.vars
```

然后编辑 `.dev.vars`，把 `APP_USER_EMAIL` 和 `APP_PASSWORD` 改成你的本地登录邮箱和密码。

启动前端和 Worker API：

```bash
npm run dev:all
```

也可以分开启动：

```bash
npm run dev
npm run dev:api
```

前端地址：

```txt
http://localhost:5173
```

Worker API 地址：

```txt
http://localhost:8787
```

Vite 会把 `/api` 代理到本地 Worker。当前 API 行为以 `modules/worker-api/index.js` 为准。

## 测试

运行当前主线测试：

```bash
npm test
```

这会依次运行前端/domain 测试和 Worker 测试。

只运行前端/domain 测试：

```bash
npm run test:app
```

只运行 Worker 测试：

```bash
npm run worker:test
```

构建前端：

```bash
npm run build
```

## 第一次部署到 Cloudflare

创建 KV namespace：

```bash
npx wrangler kv namespace create FINANCE_KV
```

命令会返回一个 namespace id。把它填到 `wrangler.jsonc`：

```jsonc
"kv_namespaces": [
  {
    "binding": "FINANCE_KV",
    "id": "这里填返回的 id"
  }
]
```

设置线上登录密码：

```bash
npx wrangler secret put APP_USER_EMAIL
npx wrangler secret put APP_PASSWORD
```

部署：

```bash
npm run deploy
```

部署前干跑验证：

```bash
npm run deploy:dry-run
```

## 数据迁移

旧本地 JSON 数据可以通过“数据管理”页的 JSON 导出/导入迁移。

如果你已有旧备份文件：

1. 部署新 Worker。
2. 登录网页。
3. 打开“数据管理”。
4. 导入旧 JSON 备份。

新版本导出的 JSON 会包含 `rates` 汇率字段。旧备份没有 `rates` 字段也可以导入，系统会使用默认汇率。

## 重要说明

- `.dev.vars` 不要提交到 Git。
- `APP_PASSWORD` 不要写进代码或文档。
- 仓库不再保留旧 Express 后端和旧 `data/` 本地 JSON 数据目录；正式 API 在 `modules/worker-api/index.js`。
