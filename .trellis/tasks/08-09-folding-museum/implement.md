# 实施计划：折叠博物馆

1. 初始化 Git/GitHub 友好单仓库，建立 Vite React TypeScript 前端、Worker、D1 migration、环境变量模板、README 和基础 CI。
2. 实现纯函数游戏引擎：棋盘模型、旋转、折叠邻接、三连以上合成、连锁计分、特殊文物、撤销、结束判定、固定 seed 和随机 seed。
3. 实现前端游戏壳和响应式办公室博物馆视觉：认证页、棋盘、操作按钮、目标/分数、结算、模式选择、排行榜和错误/加载状态。
4. 实现 Worker 认证与邀请码：注册、登录、登出、会话、管理员登录、邀请码生成/作废；加入输入校验、密码哈希、Cookie 安全属性和限流。
5. 实现 D1 存档与挑战 API：每日 UTC+8 日期、固定地图、版本化挑战、云端存取和存档版本迁移策略。
6. 实现成绩校验与日榜/周榜/总榜查询，绑定用户，处理重复提交和异常请求。
7. 编写测试：游戏引擎边界、每日 seed 一致性、邀请码生命周期、认证会话、权限隔离、存档归属、排行榜周期和非法成绩。
8. 本地运行 Pages/Worker/D1 验证，执行类型检查、构建和测试；检查敏感文件与部署配置；补充 Cloudflare 部署步骤。
9. 初始化并检查 Git 状态，创建首个提交；不自动推送，除非用户提供 GitHub 远端并明确要求推送。

## Validation commands

- `npm install`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npx wrangler d1 migrations apply <binding> --local`
- `npx wrangler dev`

## Review gates

- 游戏规则必须由纯函数测试覆盖，UI 不得直接复制游戏规则。
- 所有认证和管理员接口必须验证会话与权限；所有生产 secrets 仅通过 Cloudflare 配置。
- 前端失败状态、移动端布局、键盘操作和 API 过期会话必须人工检查。
