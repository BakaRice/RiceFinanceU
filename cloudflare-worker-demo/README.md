# Cloudflare Worker + KV 小 Demo

这是一个用来学习 Cloudflare Workers 的小 Demo。它和当前的 RiceFinanceU 项目没有连接，只是帮助你理解 Worker 到底怎么玩。

这个 Demo 会演示四件事：

- Worker 怎么接收 HTTP 请求。
- Worker 怎么返回 JSON。
- Worker 怎么把一条数据存进 Workers KV。
- 不部署到 Cloudflare，也能在本地跑测试。

## 文件说明

- `src/index.js`：Worker 主代码。
- `test/worker.test.mjs`：本地测试，用来验证接口行为。
- `wrangler.jsonc`：Cloudflare 部署配置。
- `package.json`：本地脚本，比如测试、开发、部署。

## 接口说明

```text
GET    /              返回使用说明
GET    /api/health    检查 Worker 是否正常
GET    /api/note      从 KV 读取便签
PUT    /api/note      把便签保存到 KV
DELETE /api/note      删除 KV 里的便签
```

`PUT /api/note` 需要传 JSON：

```json
{
  "note": "hello worker kv"
}
```

你可以把这个便签理解成“未来的一份备份 JSON”。现在只是先用最小例子把读写流程跑通。

## 先跑本地测试

进入这个目录：

```bash
cd cloudflare-worker-demo
```

运行测试：

```bash
npm test
```

这个测试不需要 Cloudflare 账号。它用的是一个内存里的假 KV，只是为了验证 Worker 的路由和读写逻辑。

## 用 Wrangler 在本地启动

第一次需要安装依赖：

```bash
npm install
```

启动 Worker：

```bash
npm run dev
```

Wrangler 一般会把本地服务开在：

```text
http://localhost:8787
```

然后可以试这些命令：

```bash
curl -i http://localhost:8787/api/health
curl -i http://localhost:8787/api/note
curl -i -X PUT http://localhost:8787/api/note \
  -H 'content-type: application/json' \
  -d '{"note":"hello from local wrangler"}'
curl -i http://localhost:8787/api/note
curl -i -X DELETE http://localhost:8787/api/note
```

## 部署到 Cloudflare

第一步，创建一个 KV namespace。可以在 Cloudflare 控制台里点，也可以用命令：

```bash
npx wrangler kv namespace create DEMO_KV
```

第二步，把命令返回的 namespace `id` 复制到 `wrangler.jsonc`：

```jsonc
"kv_namespaces": [
  {
    "binding": "DEMO_KV",
    "id": "这里换成你的真实 namespace id"
  }
]
```

第三步，部署：

```bash
npm run deploy
```

第四步，访问部署后的地址：

```bash
curl -i https://你的-worker-name.你的-subdomain.workers.dev/api/health
```

如果返回 JSON，并且里面有：

```json
{
  "ok": true,
  "kvBound": true
}
```

说明 Worker 和 KV 绑定都正常。

## 如果你想用 Cloudflare 在线编辑器

你也可以不用 Wrangler。直接把 `src/index.js` 复制到 Cloudflare 的 Worker 在线编辑器里。

然后在 Worker 设置里添加 KV binding：

```text
绑定名称：DEMO_KV
KV namespace：选择你创建的 namespace
```

绑定名称必须叫 `DEMO_KV`，因为代码里读取的是：

```js
env.DEMO_KV
```

如果名字不一致，Worker 会报“缺少 DEMO_KV 绑定”。

## 这个 Demo 和未来资产项目的关系

未来如果要给 RiceFinanceU 加一个“云端备份”，思路会很像这个 Demo：

```text
本地应用
  -> 生成一份 JSON 备份
  -> PUT 到 Worker
  -> Worker 存进 KV / R2 / D1
```

现在先用一条 `note` 学会流程，后面再把 `note` 换成真正的备份数据。
