# 折叠博物馆

一个通过旋转展柜与折叠边界来创造合成机会的休闲小游戏。

## 本地开发

```bash
npm install
npm run dev
```

前端当前包含可玩的本地游戏循环。生产版 API 入口可通过 `VITE_API_URL` 配置。

## Cloudflare 部署

1. 创建 D1 数据库并将 ID 写入 `wrangler.toml`。
2. 执行 `npx wrangler d1 migrations apply folding-museum --remote`。
3. 配置 Worker Secrets：`ADMIN_USERNAME`、`ADMIN_PASSWORD`。
4. 部署 API：`npx wrangler deploy`。
5. 将前端构建目录 `dist` 部署到 Cloudflare Pages，并配置 `VITE_API_URL`。

不要将 Cloudflare token、管理员密码或生产数据库信息提交到 GitHub。
