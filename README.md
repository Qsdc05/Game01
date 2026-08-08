# 折叠博物馆

一个通过旋转展柜与折叠边界来创造合成机会的休闲小游戏。

## 功能

- 账号登录后游戏，邀请码注册
- 旋转四个 2×2 展柜，折叠边界触发空间合成
- 每日挑战（北京时间 UTC+8）与自由模式
- D1 云端存档，跨设备恢复
- 绑定账号的每日/每周/总排行榜
- 管理员邀请码后台：`/admin`

## 本地开发

```bash
npm install
npm run dev
```

默认前端使用同源 `/api`；本地或 Pages 独立部署时，用 `VITE_API_URL` 指向 Worker URL。若未启动 Worker，登录无法完成，这是有意的：未认证用户不能进入游戏。

## Cloudflare 部署

### 1. 创建 D1 和迁移

```bash
npx wrangler d1 create folding-museum
# 将返回的 database_id 写入 wrangler.toml
npx wrangler d1 migrations apply folding-museum --remote
```

### 2. 部署 Worker

```bash
npx wrangler secret put ADMIN_USERNAME
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ALLOWED_ORIGIN
npx wrangler deploy
```

`ALLOWED_ORIGIN` 填 Pages 站点的完整 origin，例如 `https://museum.pages.dev`。生产环境必须使用 HTTPS。

### 3. 部署 Pages

构建命令：`npm ci && npm run build`；输出目录：`dist`；环境变量：`VITE_API_URL=https://你的-worker域名.workers.dev`。

也可以把 Pages 与 Worker 绑定为同一自定义域名，这时可不设置 `VITE_API_URL`。

## GitHub

将仓库推送到 GitHub 后，`.github/workflows/validate.yml` 会在 push 和 pull request 自动执行类型检查、Worker 检查、测试和生产构建。不要提交 `.env`、Cloudflare Token、管理员密码或生产数据库信息。
