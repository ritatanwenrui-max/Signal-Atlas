# Signal Atlas

Signal Atlas 是一个面向品牌团队的全球新闻与社交媒体舆情监测工具。

当前版本包括：

- 全球网页新闻发现、免费媒体源持续追踪和手动补录
- Instagram、X、YouTube、TikTok、Facebook 等社媒连接器
- Monid/TikHub 帖子、评论和评论回复采集
- 品牌消歧、排除词过滤、国家/地区识别和多语言英文翻译
- 新闻事件聚类、传播链路、世界地图、情绪/词频/评论分析
- 人工评论标注与品牌级情感判断校准
- 团队共享工作区、连接器密钥保险库和报告导出
- Cloudflare D1 数据库与每小时自动巡检任务

## 运行架构

```text
浏览器
  -> Vinext / Next.js 前端与 API Routes
  -> Cloudflare Worker
      -> D1（品牌、新闻、帖子、评论、标注、连接器状态）
      -> 新闻/RSS/社媒/Monid/翻译服务
      -> Cron Trigger（每小时自动巡检）
```

GitHub 只保存和版本管理源码。新闻抓取、API、数据库和定时任务由 Cloudflare Worker/Sites 运行；GitHub Pages 不能运行本项目。

## 本地构建

要求 Node.js `>=22.13.0`，推荐使用 pnpm。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm run dev
```

生产构建与测试：

```bash
pnpm run build
node --test tests/rendered-html.test.mjs
```

本地开发会使用项目目录下的 Miniflare/D1 状态。登录相关写操作依赖运行平台注入的用户身份；当前线上版本由 Sites 提供该身份层。

## 环境变量与连接器

复制 `.env.example` 到本地 `.env.local`，只填写实际需要的服务。不要把真实密钥提交到 GitHub。

| 变量 | 用途 | 是否必需 |
| --- | --- | --- |
| `CREDENTIALS_ENCRYPTION_KEY` | 加密保存在团队工作区中的连接器密钥 | 生产环境必需 |
| `NEWSAPI_AI_KEY` | NewsAPI.ai / Event Registry 新闻发现 | 可选 |
| `MONID_API_KEY` | Monid 社媒帖子、评论与回复采集 | 可选 |
| `X_BEARER_TOKEN` | X 官方接口 | 可选 |
| `YOUTUBE_API_KEY` | YouTube Data API | 可选 |
| `LIBRETRANSLATE_URL` | 自建/第三方 LibreTranslate 地址 | 可选 |
| `LIBRETRANSLATE_API_KEY` | LibreTranslate 密钥 | 可选 |
| `TRANSLATION_CONTACT_EMAIL` | 公共翻译服务联络标识 | 可选 |

用户也可以在网站的“数据连接器”页面录入自己的 API Key；密钥会加密后存入 D1，不会进入 GitHub。

## Cloudflare / Sites 部署要求

完整部署必须包含以下运行资源：

1. 一个绑定名为 `DB` 的 Cloudflare D1 数据库。
2. `CREDENTIALS_ENCRYPTION_KEY` Worker Secret。
3. 可选的数据提供商密钥，或由管理员在网站前端配置。
4. Cron Trigger `17 * * * *`，用于每小时运行品牌巡检。
5. 用户身份层。当前代码读取 Sites 注入的 `oai-authenticated-user-*` 请求头，以隔离个人/团队工作区。

数据库结构位于 `drizzle/`，应用启动后也会通过 `ensureDatabase()` 补齐缺失表、字段和索引。当前 Sites 项目标识与 D1 绑定声明保存在 `.openai/hosting.json`。

如果改为独立 Cloudflare Workers 部署，需要在 Cloudflare 中新建并绑定 D1，同时接入 Cloudflare Access 或其他登录系统，替换/适配 `app/chatgpt-auth.ts`。不能把生产 API Key 或数据库文件直接放进仓库。

## 关键目录

| 路径 | 内容 |
| --- | --- |
| `app/` | 页面、路由、API 和登录适配 |
| `db/` | 新闻/社媒抓取、评论、翻译、分析、数据库访问 |
| `worker/` | Cloudflare Worker 入口与定时任务 |
| `drizzle/` | D1 数据库迁移 |
| `tests/` | 构建产物与关键功能检查 |
| `.openai/hosting.json` | 当前 Sites 运行资源声明 |

## 数据与安全

- 仓库不包含线上 D1 数据、历史新闻、评论、人工标注或用户账号数据。
- 仓库不包含实际 API Key；`.env*` 已被忽略，仅提交空白 `.env.example`。
- 线上历史数据不会因为推送 GitHub 而被清空，源码与 D1 数据是分开的。
- 若更换 D1 数据库，需要单独迁移数据；只部署源码不会自动复制旧数据库。
