# 技术设计：折叠博物馆

## Architecture

采用单仓库 TypeScript 项目：`web/` 为 Vite + React 前端，`worker/` 为 Cloudflare Worker API，`db/` 保存 D1 migration，`tests/` 保存共享游戏逻辑和 API 测试。前端部署 Pages，Worker 绑定 D1。

## Core interfaces

- `GameState`: 模式、地图种子/版本、棋盘、步数、分数、连锁、目标、撤销栈、状态。
- `GameEngine`: 纯函数处理旋转、折叠、合成、连锁、计分、结束判定和序列化，挑战模式由日期生成固定 seed。
- `POST /api/auth/register`: 用户名、密码、邀请码；返回会话。
- `POST /api/auth/login` / `POST /api/auth/logout` / `GET /api/auth/me`。
- `GET/POST /api/save`: 当前用户云端存档，服务端检查用户归属与版本。
- `GET /api/challenge/today`: 返回北京时间日期、挑战版本和地图 seed/初始布局。
- `POST /api/scores`: 仅接受已认证的每日挑战完成成绩，Worker 校验挑战版本、步数、分数范围和提交频率。
- `GET /api/leaderboard?period=daily|weekly|all`。
- `POST/GET/DELETE /api/admin/invites`: 仅单一管理员会话可用。

## Data and security

D1 表包括 users、invite_codes、sessions、game_saves、scores，并为用户、日期、周期和分数建立查询索引。用户密码使用带随机 salt 的 PBKDF2-SHA-256 哈希；会话使用随机不可预测 token 的哈希值存库，Cookie 使用 HttpOnly、Secure（生产）、SameSite=Lax。所有写接口校验 JSON、长度、频率和权限；用户名/昵称只允许安全字符并限制长度。管理员凭据从 Worker Secrets 读取并使用恒时比较。

每日挑战以北京时间计算日期，再用版本化 seed 生成固定初始棋盘；客户端不能自行指定挑战布局。成绩验证以服务端保存的挑战参数和合理的操作/结果边界为基础；首版不承诺完全防作弊。

## Frontend behavior

认证页是未登录入口；登录成功后进入游戏壳。游戏页包含模式切换、棋盘、选中展柜状态、旋转/折叠/撤销按钮、目标、分数和存档状态。排行榜独立面板显示加载、空状态和错误状态。所有主要按钮提供键盘焦点、可读标签和触摸尺寸。

状态按领域拆分：游戏引擎保持纯数据和 reducer；认证、存档、排行榜使用 API hooks；React UI 状态只保存选择、弹窗和加载状态。云端存档采用防抖保存与显式完成保存，避免每个动画帧请求 API。

## Failure and compatibility

Worker 不可用时保留当前内存局面并提示保存失败，不伪造“已保存”；登录过期时清理客户端状态并返回认证页。数据库 migration 必须可重复执行且向后兼容存档版本；API 错误统一返回可展示的错误码和消息，前端不依赖 Worker 内部异常文本。
