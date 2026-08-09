# 折叠博物馆

一个通过旋转展柜与折叠边界来创造合成机会的休闲小游戏。

## 功能

- 账号登录后游戏，邀请码注册
- 新手引导：选择展柜、旋转空间、折叠边界、完成第一次合成
- 旋转四个 2×2 展柜，折叠棋盘远端边缘，触发空间合成
- 三个或以上同等级文物合成，支持连锁倍率、得分反馈和目标进度
- 30 步挑战、胜利/失败结算、每局 3 次云端撤销
- 每日挑战使用北京时间 UTC+8 的固定地图，保证所有玩家面对相同开局
- 自由模式随机生成地图，不计入排行榜
- 合成、新文物出现、折叠边界高亮和分数跳动反馈
- 云端馆藏图鉴：初次共鸣、空间折叠、连锁守护者等成就
- D1 云端存档，跨设备恢复
- 绑定账号的每日/每周/总排行榜，成绩提交时由 Worker 重放操作序列校验
- 管理员邀请码后台：`/admin`

## 本地开发

```bash
npm install
npm run dev
```

本地 API 推荐使用 Wrangler：

```bash
# 第一次使用前，把 wrangler.toml 的 database_id 替换为真实 D1 ID
npx wrangler d1 migrations apply folding-museum --local
npx wrangler dev
```

另开终端启动前端：

```bash
npm run dev
```

前端默认访问同源 `/api`。Pages 独立部署时配置 `VITE_API_URL` 指向 Worker URL；Worker 需要配置 `ALLOWED_ORIGIN`，否则跨域请求会被拒绝。浏览器登录依赖安全 Cookie，生产环境必须使用 HTTPS。

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

`ALLOWED_ORIGIN` 填 Pages 站点的完整 origin，例如 `https://museum.pages.dev`。不要附带路径或结尾斜杠。

### 3. 部署 Pages

构建命令：`npm ci && npm run build`；输出目录：`dist`；环境变量：`VITE_API_URL=https://你的-worker域名.workers.dev`。

也可以把 Pages 与 Worker 绑定为同一自定义域名，这时可不设置 `VITE_API_URL`。

### 4. 首次初始化邀请码

部署 Worker 后，访问 `/admin`，使用 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录并生成首批邀请码。管理员凭据只通过 Cloudflare Secrets 配置。

## GitHub

将仓库推送到 GitHub 后，`.github/workflows/validate.yml` 会在 push 和 pull request 自动执行类型检查、Worker 检查、测试和生产构建。不要提交 `.env`、Cloudflare Token、管理员密码或生产数据库信息。

## 当前线上环境

- Pages：`https://folding-museum.pages.dev`
- Worker：`https://folding-museum-api.15770739466lfh.workers.dev`
- D1：`folding-museum`（APAC）

线上部署状态可用以下命令复核：

```bash
npx wrangler d1 migrations list folding-museum --remote
npx wrangler deployments list
npx wrangler pages deployment list --project-name folding-museum
```
