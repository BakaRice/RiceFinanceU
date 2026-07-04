# Cloudflare Worker + KV 迁移设计

日期：2026-07-04

## 目标

把当前 RiceFinanceU 从“React 前端 + 本地 Express + 本机 JSON 文件”改造成“React 前端 + Cloudflare Worker + Cloudflare KV”。第一版继续保持个人使用、低成本、少折腾，不引入多用户、数据库、微信登录或 Cloudflare Access。

第一版上线后，正式使用方式是打开 Cloudflare Worker 托管的网址。后续小程序端可以作为独立客户端调用同一套 Worker API。

## 用户与认证

第一版只有一个用户：

- 邮箱：`resmarch404@gmail.com`
- 密码：部署时通过 Cloudflare Worker Secret 配置，不写入代码仓库。

登录流程：

1. 前端显示登录页，输入邮箱和密码。
2. `POST /api/auth/login` 把邮箱和密码发给 Worker。
3. Worker 校验邮箱必须是 `resmarch404@gmail.com`，密码必须匹配 `APP_PASSWORD` Secret。
4. 登录成功后，Worker 生成随机 session token，把 token hash 后写入 KV。
5. 前端把明文 session token 存在浏览器本地存储。
6. 后续 API 请求使用 `Authorization: Bearer <session token>`。
7. Worker 对受保护 API 校验 session token；失败返回 `401`。

退出登录只删除前端本地 session token。session 默认有效期为 30 天。

## 存储设计

KV 使用两个类别的 key：

- `finance:data:v2`：完整业务数据 JSON。
- `finance:session:<tokenHash>`：登录 session 元数据，设置 30 天过期时间。

业务数据继续沿用当前 `ExportData` 结构：

```ts
type ExportData = {
  meta: { schemaVersion: number; updatedAt: string }
  assets: Asset[]
  snapshots: Snapshot[]
  snapshotValues: SnapshotValue[]
  rates?: ExchangeRates
}
```

KV 内部保存的文档会始终包含 `rates`。导入旧备份时，如果没有 `rates` 字段，就使用默认汇率 `{ USD: 7.2, HKD: 0.92 }`。

第一版把业务数据作为单个 JSON 文档读写。每个 mutation 都是：

1. 从 KV 读取完整 `ExportData`。
2. 在 Worker 内存里执行领域逻辑。
3. 更新时间戳。
4. 写回 `finance:data:v2`。

这个方式适合个人低频使用，和当前 JSON 备份模型一致。未来如果需要多用户或高并发，再迁到 D1 或拆分 KV key。

## API 设计

Worker 保留当前前端已经依赖的 `/api` 路径，尽量减少 UI 侧改动。

公开接口：

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/health`

需要登录的接口：

- `GET /api/assets`
- `POST /api/assets`
- `PATCH /api/assets/:id`
- `DELETE /api/assets/:id`
- `GET /api/snapshots`
- `GET /api/snapshots/latest`
- `GET /api/snapshots/:id`
- `POST /api/snapshots`
- `DELETE /api/snapshots/:id`
- `GET /api/snapshot-values`
- `GET /api/rates`
- `POST /api/rates`
- `GET /api/export`
- `POST /api/import`

接口行为与当前 Express 后端保持一致。导入接口继续覆盖全部数据；导出接口返回完整 JSON，并补充 `rates` 字段。旧版没有 `rates` 的 JSON 备份仍然可以导入。

## 前端设计

前端继续使用当前 React/Vite 应用。

新增一个轻量认证层：

- 未登录时显示登录页。
- 登录成功后进入现有应用。
- API client 自动附带 session token。
- 收到 `401` 时清理本地 session 并回到登录页。

本地开发时使用 `wrangler dev` 提供 Worker API 和静态资源。Vite 原本的开发方式可以保留给纯前端调试，但正式联调以 Worker 为准。

## Cloudflare 部署

使用一个 Worker 同时提供：

- `/api/*` 动态接口。
- React build 后的静态资源。
- SPA fallback，让刷新 `/assets`、`/data` 等前端路由时仍返回前端应用。

Wrangler 配置包含：

- Worker main：`worker/index.js`
- 静态资源目录：`dist`
- KV binding：`FINANCE_KV`
- Secret：`APP_PASSWORD`
- 变量：`APP_USER_EMAIL = "resmarch404@gmail.com"`

## 非目标

第一版不做：

- 多用户注册。
- 找回密码。
- 微信登录。
- 小程序 UI。
- Cloudflare Access。
- D1 数据库。
- 端到端加密。
- 自动行情或基金净值同步。

## 测试与验证

需要覆盖：

- 未登录访问受保护 API 返回 `401`。
- 邮箱或密码错误登录失败。
- 正确登录后可访问受保护 API。
- 资产创建、软删除、快照创建、快照删除、汇率更新能写回 KV。
- 导入和导出完整 JSON 能保留当前数据结构。
- 前端构建通过。
- Worker 本地测试通过。

## 风险与取舍

单 JSON 存储不是高并发设计。如果两个客户端同时写入，后写可能覆盖先写。当前是个人低频使用，可以接受。后续如果小程序成为主力且多端频繁使用，可以增加版本号冲突检测，或者迁移到 D1。

密码登录比单个永久 token 更容易理解，也给小程序留下接口形态。但它仍然是个人项目级认证，不等同于完整商业登录系统。部署时必须使用强密码，并且不要把密码写进代码、截图或文档。
