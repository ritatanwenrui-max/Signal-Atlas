"use client";

import { useEffect, useState } from "react";

export type UiLanguage = "zh" | "en";

const STORAGE_KEY = "somnia-media-ui-language";

export function getUiLocale() {
  if (typeof window === "undefined") return "zh-CN";
  try { return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en-US" : "zh-CN"; }
  catch { return "zh-CN"; }
}

const ENGLISH: Record<string, string> = {
  "情报总览": "Overview",
  "新闻档案": "Media Archive",
  "传播链路": "Propagation",
  "内容舆情": "Content Intelligence",
  "受众舆情": "Audience Intelligence",
  "数据采集": "Data Collection",
  "分析报告": "Analysis Reports",
  "品牌与团队": "Brand & Team",
  "产品使用说明": "Product Guide",
  "主要导航": "Main navigation",
  "选择语言": "Choose language",
  "中文": "Chinese",
  "主要导航语言": "Interface language",
  "搜索全部档案": "Search all archives",
  "搜索标题、来源、关键词": "Search titles, sources or keywords",
  "全档案": "All records",
  "共享工作区": "Shared workspace",
  "立即巡检": "Run scan now",
  "巡检中…": "Scanning…",
  "混合监测已运行": "Hybrid monitoring is active",
  "后台续跑": "Background resume",
  "每 5 分钟": "Every 5 minutes",
  "主巡检": "Main scan",
  "Reddit 独立任务": "Reddit task",
  "全球发现": "Global discovery",
  "六平台社媒搜索": "Six-platform social search",
  "免费单源": "Free source tracking",
  "媒体来源库": "Media source library",
  "最后巡检": "Last scan",
  "已完成": "Completed",
  "等待重试": "Waiting to retry",
  "运行中": "Running",
  "失败待复核": "Failed · review needed",
  "已排队": "Queued",
  "待配置": "Not configured",
  "待接入": "Not connected",
  "采集中": "Collecting",
  "暂缓重试": "Backoff",
  "品牌情报工作区": "Brand intelligence workspace",
  "尚未配置品牌": "Brand not configured",
  "尚未登录": "Not signed in",
  "正在读取长期新闻档案与传播图谱…": "Loading the long-term media archive and propagation graph…",
  "品牌舆情监测": "Brand media intelligence",
  "自动搜索网页新闻与已接入的社交平台内容，并按地区归档、聚类事件、分析情绪和推断传播路径。": "Automatically discovers web news and connected social content, archives it by region, clusters events, analyzes sentiment and infers propagation paths.",
  "搜索与归档": "Discover & archive",
  "事件与传播": "Events & propagation",
  "情绪与风险": "Sentiment & risk",
  "登录后使用": "Sign in to continue",
  "如果管理员已邀请你的邮箱，登录后会直接进入同一个团队工作区，品牌、档案、分析和连接器配置无需重新建立。": "If an administrator invited your email, signing in opens the same team workspace. You do not need to recreate the brand, archive, analysis or connector settings.",
  "使用 ChatGPT 登录 →": "Sign in with ChatGPT →",
  "未受邀账号会获得独立的新工作区。": "Accounts that have not been invited receive a separate workspace.",
  "配置监测品牌": "Configure a brand",
  "填写品牌名、别名和官网域名。保存后系统会自动搜索报道、更新媒体来源，并持续归档和分析新内容。": "Enter the brand name, aliases and official domain. The system will discover coverage, update sources, and continuously archive and analyze new content.",
  "发现报道": "Discover coverage",
  "更新来源": "Update sources",
  "归档分析": "Archive & analyze",
  "创建品牌监测档案": "Create a brand monitoring profile",
  "品牌名称 *": "Brand name *",
  "品牌名称": "Brand name",
  "品牌别名": "Brand aliases",
  "品牌别名（每行一个）": "Brand aliases (one per line)",
  "官网域名": "Official website domain",
  "身份锚点（强烈建议）": "Identity anchors (strongly recommended)",
  "身份锚点": "Identity anchors",
  "排除词": "Exclusion terms",
  "启动自动监测 →": "Start automatic monitoring →",
  "正在建立全球档案…": "Building the global archive…",
  "精准模式要求品牌词与至少一个身份锚点同时出现，可避免收录同名公司。": "Precise mode requires the brand term and at least one identity anchor, preventing unrelated companies with the same name from being included.",
  "监测概览": "Monitoring overview",
  "系统按计划搜索新报道并跟踪已发现的媒体来源。归档内容用于地区识别、事件聚类、传播路径和情绪分析。": "The system searches for new coverage on schedule and follows discovered media sources. Archived content supports regional identification, event clustering, propagation analysis and sentiment analysis.",
  "等待数据": "Waiting for data",
  "首次巡检后生成": "Generated after the first scan",
  "历史新闻档案": "Lifetime media archive",
  "持续累积，不覆盖旧记录": "Continuously accumulated; old records are preserved",
  "连续 96 小时无新增则切分事件": "An event closes after 96 hours without new coverage",
  "国家 / 地区": "Countries / regions",
  "由来源元数据、域名、媒体及语言推断": "Inferred from source metadata, domain, publisher and language",
  "跨境传播边": "Cross-border propagation links",
  "已识别的地区间复制链路": "Identified cross-region copying paths",
  "负面内容": "Negative content",
  "免费媒体来源": "Free media sources",
  "自动增长的追踪来源库": "Automatically expanding source library",
  "全球报道热力分布": "Global coverage heat map",
  "查看完整分析 →": "View full analysis →",
  "最新归档新闻": "Latest archived content",
  "全部档案 →": "All records →",
  "正在扩散的报道链路": "Active propagation events",
  "舆情告警": "Intelligence alerts",
  "标记已处理": "Mark as resolved",
  "当前没有待处理高风险信号": "No unresolved high-risk signals",
  "品牌历史媒体档案": "Lifetime Brand Media Archive",
  "新闻与社媒内容统一保留发布时间、地区、来源、账号、公开互动、情绪、风险和传播事件编号；旧记录不会被下一次搜索覆盖。": "News and social content retain publication time, region, source, account, public engagement, sentiment, risk and event ID. Future searches never overwrite old records.",
  "全部平台": "All platforms",
  "全部情绪": "All sentiment",
  "全球": "Global",
  "最新优先": "Newest first",
  "最早优先": "Oldest first",
  "风险优先": "Highest risk",
  "手动补充": "Add manually",
  "导出 CSV": "Export CSV",
  "发布时间": "Published",
  "平台": "Platform",
  "新闻 / 社媒原文": "News / social content",
  "媒体 / 账号": "Publisher / account",
  "互动": "Engagement",
  "地区与语言": "Region & language",
  "具体情绪": "Specific emotion",
  "风险": "Risk",
  "事件": "Event",
  "地区待确认": "Region to confirm",
  "地区未披露": "Region unavailable",
  "地区未知": "Unknown region",
  "修改": "Edit",
  "暂未取得文本": "Text not available yet",
  "暂未公开获取的互动数据": "Public engagement data unavailable",
  "手动补充新闻或社媒内容": "Add news or social content manually",
  "用于补充系统尚未发现但需要进入同一档案与传播分析的公开内容。": "Add public content the system has not discovered but should be included in the archive and propagation analysis.",
  "原文链接 *": "Original URL *",
  "媒体 / 账号 *": "Publisher / account *",
  "来源国家 / 地区 *": "Source country / region *",
  "标题 / 帖子原文摘要 *": "Title / post summary *",
  "正文摘录 / 帖子文案": "Body excerpt / post copy",
  "发布时间 *": "Publication time *",
  "内容语言": "Content language",
  "作者 / 账号 ID": "Author / account ID",
  "取消": "Cancel",
  "保存并进入分析": "Save and analyze",
  "校正来源地区与语言": "Correct source region and language",
  "来源国家 / 地区": "Source country / region",
  "语言": "Language",
  "当前判断": "Current classification",
  "人工保存后优先级最高，自动巡检不会覆盖这次校正。": "Manual corrections have the highest priority and will not be overwritten by automatic scans.",
  "保存校正": "Save correction",
  "传播事件": "Propagation events",
  "同一事件扩散路径": "Propagation path for the same event",
  "从左到右按发布时间排列；方块颜色代表发布渠道，点击节点查看证据。": "Ordered left to right by publication time. Node colors represent channels; select a node to inspect evidence.",
  "同一事件由连续爆发时间、品牌实体、标题正文、关键数字和跨语言主题指纹共同判断；连续 96 小时没有新增报道会强制结束上一事件，避免跨越长空窗期误合并。": "Events are identified using burst timing, brand entities, title and body similarity, key numbers and cross-language topic fingerprints. An event closes after 96 hours without new coverage to avoid merging across long gaps.",
  "最早信源": "Earliest source",
  "同地区": "Same region",
  "跨地区": "Cross-region",
  "峰值时段": "Peak period",
  "高度转载率": "High-copy rate",
  "平均推断置信": "Average inference confidence",
  "样本不足": "Insufficient sample",
  "尚未形成传播边": "No propagation links yet",
  "媒体与原帖如何描述品牌": "How media and original posts describe the brand",
  "舆情趋势与渠道结构": "Volume trend and channel structure",
  "情绪结构": "Sentiment distribution",
  "具体情绪与意图": "Specific emotions and intent",
  "高频议题词云": "High-frequency topic cloud",
  "国家 / 地区舆情结构": "Country / region intelligence",
  "地区": "Region",
  "报道": "Coverage",
  "正 / 中 / 负": "Positive / neutral / negative",
  "最高风险": "Highest risk",
  "公开互动": "Public engagement",
  "暂无高频词": "No recurring terms yet",
  "受众在关注什么，以及哪些观点正在获得响应": "What audiences care about and which viewpoints are gaining traction",
  "规则与统计研判": "Rules and statistical analysis",
  "评论区情绪": "Comment sentiment",
  "已分析评论": "Comments analyzed",
  "社媒评论采集尚未启动": "Social comment collection has not started",
  "评论量与负面走势": "Comment volume and negative trend",
  "评论情绪结构": "Comment sentiment distribution",
  "核心议题": "Core discussion themes",
  "评论区关键词词云": "Comment keyword cloud",
  "讨论最集中的帖子": "Most discussed posts",
  "评论明细档案": "Comment archive",
  "负面与混合情绪复核": "Negative and mixed sentiment review",
  "帖子评论采集状态": "Post comment collection status",
  "指定帖子评论采集": "Collect comments from a specific post",
  "粘贴公开帖子链接。Instagram 会先校验 Media ID；Reddit 会识别 t3_ 帖子 ID；系统随后按平台分页采集主评论及嵌套回复。": "Paste a public post URL. Instagram first validates its Media ID; Reddit identifies the t3_ post ID; the system then collects top-level comments and nested replies page by page.",
  "指定帖子公开链接": "Public post URL",
  "采集此帖评论": "Collect this post's comments",
  "搜索评论、账号或帖子": "Search comments, accounts or posts",
  "全部历史": "All time",
  "获赞最多": "Most liked",
  "原始数量": "Raw count",
  "共鸣口径": "Resonance weighted",
  "正面": "Positive",
  "中性": "Neutral",
  "负面": "Negative",
  "混合": "Mixed",
  "无实意": "No substantive meaning",
  "人工标注": "Human label",
  "人工结论": "Human decision",
  "原文": "Original",
  "英文翻译": "English translation",
  "点赞": "Likes",
  "回复": "Replies",
  "评论": "Comments",
  "粉丝": "Followers",
  "共鸣权重": "Resonance weight",
  "地区接受情况": "Regional acceptance",
  "当前受众结论": "Current audience findings",
  "国家 / 地区接受情况": "Audience acceptance by country / region",
  "采集计划与混合分析": "Collection plan and hybrid analysis",
  "新闻与社媒持续归档；规则模型处理全部数据，LLM 只复核高互动、高风险、跨语言或判断不明确的内容，最后由报告 Agent 汇总为可核验结论。": "News and social content are continuously archived. Rule-based models process all data; the LLM reviews only high-engagement, high-risk, cross-language or ambiguous items, and the report agent produces traceable findings.",
  "采集完整度与漏收诊断": "Collection completeness and missed-result diagnostics",
  "接口候选": "API candidates",
  "实际收录": "Archived",
  "重复内容": "Duplicates",
  "规则过滤": "Rule-filtered",
  "实际搜索": "Queries run",
  "候选": "Candidates",
  "相关": "Relevant",
  "新增": "New",
  "重复": "Duplicate",
  "过滤": "Filtered",
  "任务状态": "Task status",
  "原因与错误": "Reasons & errors",
  "部分失败": "Partially failed",
  "批次完成": "Batch complete",
  "新版诊断会从下一次新闻巡检开始记录；现有历史档案不会受到影响。": "The new diagnostics start with the next scan. Existing archive records are unaffected.",
  "采集连接器": "Collection connectors",
  "待凭证": "Credentials required",
  "凭证已存": "Credentials saved",
  "需授权": "Authorization required",
  "管理员可配置": "Admin can configure",
  "配置团队 API": "Configure team API",
  "团队数据连接器": "Team data connectors",
  "管理员只需配置一次新闻、社媒和翻译服务，所有成员共享同一批采集与英文翻译结果。凭证由服务端加密，完整值不会返回任何成员的浏览器。": "An administrator configures news, social and translation services once. All members share the resulting data and English translations. Credentials are encrypted server-side and never returned in full to a member's browser.",
  "团队共用采集结果": "Shared collection results",
  "服务端加密": "Server-side encryption",
  "仅管理员可更换": "Admin-only changes",
  "更换": "Replace",
  "配置": "Configure",
  "删除": "Delete",
  "安全保存": "Save securely",
  "保存中…": "Saving…",
  "免费媒体来源库": "Free media source library",
  "媒体 / 域名": "Publisher / domain",
  "追踪协议": "Tracking method",
  "状态": "Status",
  "最后抓取": "Last collected",
  "下次计划": "Next run",
  "活跃": "Active",
  "监看": "Watching",
  "重试": "Retry",
  "已发现": "Discovered",
  "自动探测": "Auto-detected",
  "首次全球发现完成后，媒体来源会自动进入这里，无需手动添加。": "After the first global discovery run, media sources appear here automatically; no manual entry is required.",
  "团队品牌监测档案与同名消歧": "Team brand profile and name disambiguation",
  "管理员可编辑": "Admin can edit",
  "仅管理员可修改": "Admin only",
  "匹配模式": "Matching mode",
  "精准：品牌词 + 身份锚点": "Precise: brand term + identity anchor",
  "平衡：长品牌名可单独命中": "Balanced: distinctive long names can match alone",
  "宽泛：仅品牌词即可": "Broad: brand term alone",
  "官方社媒账号": "Official social accounts",
  "保存定位规则": "Save matching rules",
  "团队扩展监测词典": "Team monitoring dictionary",
  "公司": "Company",
  "产品": "Product",
  "人物": "Person",
  "关键词": "Keyword",
  "事件指纹": "Event fingerprint",
  "通用": "General",
  "英文": "English",
  "简体中文": "Simplified Chinese",
  "繁体中文": "Traditional Chinese",
  "泰语": "Thai",
  "日语": "Japanese",
  "添加": "Add",
  "启用": "Enabled",
  "档案管理": "Manage in profile",
  "团队自动运行策略": "Team automation policy",
  "共享数据": "Shared data",
  "后台分阶段巡检": "Staged background scan",
  "多平台公开搜索": "Multi-platform public search",
  "评论与回复": "Comments and replies",
  "精准品牌匹配": "Precise brand matching",
  "Meta / TikTok 官方接口": "Meta / TikTok official APIs",
  "可选配置": "Optional",
  "已加入成员": "Members",
  "你的权限": "Your role",
  "邀请同事邮箱": "Invite colleagues by email",
  "加入后的权限": "Role after joining",
  "编辑者：可巡检、补录和维护词典": "Editor: scan, add records and maintain the dictionary",
  "查看者：只读全部档案与分析": "Viewer: read-only access to all archives and analysis",
  "添加到团队": "Add to team",
  "保存邀请中…": "Saving invitation…",
  "成员": "Member",
  "权限": "Role",
  "已加入": "Joined",
  "移除": "Remove",
  "等待首次登录": "Waiting for first sign-in",
  "撤销": "Revoke",
  "所有者": "Owner",
  "管理员": "Administrator",
  "编辑者": "Editor",
  "查看者": "Viewer",
  "本页说明系统能够采集什么、各页面如何使用，以及事件、传播、情绪、地区和互动指标的计算依据。规则发生变化时，说明页应与实际运行版本同时更新。": "This page explains what the system collects, how to use each page, and how event, propagation, sentiment, regional and engagement metrics are calculated. The guide is updated whenever operating rules change.",
  "说明目录": "Contents",
  "产品用途": "Purpose",
  "数据与档案": "Data & archive",
  "舆情分析": "Intelligence analysis",
  "互动加权": "Engagement weighting",
  "地区判断": "Regional classification",
  "人工复核": "Human review",
  "产品用途与数据边界": "Product purpose and data boundaries",
  "本系统用于持续收集、整理和分析与品牌相关的公开网络信息。数据范围包括网页新闻、媒体报道、社交媒体公开帖子，以及帖子下方公开展示的评论和回复。系统会按照时间、平台、媒体和地区进行归档，并在此基础上识别事件、分析传播过程、总结讨论话题，观察媒体态度和受众反馈。": "The system continuously collects, organizes and analyzes public online information related to a brand. It covers web news, media coverage, public social posts, and publicly visible comments and replies. Content is archived by time, platform, publisher and region, then used to identify events, analyze propagation, summarize discussion themes, and observe media framing and audience response.",
  "系统只处理公开可访问的数据，不读取私人账号、私密帖子或私信。部分平台会限制评论、互动数据和历史内容的访问，因此系统不能保证收录互联网上的全部相关信息。重要的公关、法律和商业判断仍应回到原文并经过人工复核。": "The system processes only publicly accessible data. It does not read private accounts, private posts or direct messages. Some platforms restrict access to comments, engagement data and historical content, so complete coverage of the internet cannot be guaranteed. Important communications, legal and commercial decisions should always be checked against the original source and reviewed by a person.",
  "首次使用时，应先在“品牌与团队”中填写品牌名称、别名、产品、官网、官方账号、相关人物、行业、主要市场和常用语言。品牌名称较为常见时，还应设置身份锚点和排除词。身份锚点用于证明候选内容确实指向当前品牌，排除词用于过滤其他同名公司和无关结果。": "Before the first scan, complete Brand & Team with the brand name, aliases, products, website, official accounts, relevant people, industry, key markets and languages. For common brand names, add identity anchors and exclusion terms. Anchors verify that a candidate refers to this brand; exclusion terms remove unrelated companies and results.",
  "品牌配置完成后，在“数据采集”中连接需要使用的新闻和社交媒体渠道。页面会显示各渠道能够采集的数据、最近成功时间、当前任务、失败原因和下次运行时间。首次运行默认补充最近一个月内能够获取的公开数据，此后按照页面显示的实际计划持续更新。": "After configuring the brand, connect the required news and social channels in Data Collection. The page shows available data, most recent success, current tasks, failure reasons and next run time for each channel. The first run backfills up to one month of available public data, then continues on the schedule shown in the interface.",
  "社交媒体评论按照“发现帖子、保存帖子地址、采集主评论、采集回复、翻译与分析”的顺序处理。内容档案保留发布时间、平台、原文、媒体或账号、地区、原始链接、事件编号和公开互动数据。平台没有披露点赞、分享或播放量时，字段留空而不是写成零；只有接口明确返回零时才显示零。": "Social comments are processed in this order: discover posts, save post URLs, collect top-level comments, collect replies, translate and analyze. The archive retains publication time, platform, original text, publisher or account, region, original URL, event ID and public engagement. If a platform does not disclose likes, shares or views, the field stays blank rather than showing zero; zero appears only when the source explicitly returns zero.",
  "系统会把品牌名、无空格写法、别名、产品、事件指纹、官网域名以及“品牌名＋身份锚点”组合成搜索计划。Instagram 使用适合 hashtag 的无空格词形，YouTube 与 TikTok 会分别执行前三组高优先级关键词；NewsAPI.ai 在首批达到一百条时自动继续请求后续页面。搜索任务、异步返回和无新增复核全部完成后，才进入评论采集。": "The search plan combines the brand name, compact spelling, aliases, products, event fingerprints, official domain and brand-plus-anchor queries. Instagram uses hashtag-safe compact forms; YouTube and TikTok each run the three highest-priority queries; NewsAPI.ai requests additional pages when the first page reaches 100 results. Comment collection starts only after search jobs, asynchronous results and no-new-result checks have completed.",
  "系统通过URL、平台内容ID和正文相似度识别重复内容。重复内容只保留一条主记录，但不同媒体之间的转载关系仍可进入传播链路。用户也可以手动补充遗漏内容，人工补充会保留标记，并与自动采集内容一起参与后续分析。“数据采集”页会分别显示接口候选、相关候选、新增、重复、过滤和失败原因，以便判断漏收发生在哪一层。": "Duplicates are detected using URL, platform content ID and body similarity. One primary record is retained, while reposting relationships between publishers can still enter the propagation graph. Missing content can be added manually and remains marked as such while participating in later analysis. Data Collection separately shows API candidates, relevant candidates, new records, duplicates, filtered items and failure reasons so missed coverage can be traced to a specific stage.",
  "添加排除词后，命中内容会从新闻档案、事件、内容舆情、受众舆情、词云和报告中移除。原始记录可以保留用于审计，但不再参与正常指标。删除排除词后，系统可以重新评估此前被过滤的数据。": "When an exclusion term is added, matching content is removed from the archive, events, content intelligence, audience intelligence, word clouds and reports. Raw records may remain for audit purposes but no longer affect normal metrics. Removing an exclusion term allows previously filtered data to be evaluated again.",
  "同一事件与传播链路": "Events and propagation paths",
  "“同一事件”是围绕同一件具体事情形成的一组报道和帖子，并不等于某段时间内所有提到品牌的内容。系统综合比较发布时间、标题、正文、人物、产品、地点、关键事实、相同段落和引用来源。三天内出现且内容高度相似的内容通常归入同一事件；相隔三至七天时，需要存在相同关键事实或明显文本继承；相隔超过七天时默认建立新事件，除非存在明确引用或持续更新。": "An event is a group of articles and posts about the same concrete development, not every brand mention within a time period. The system compares publication time, titles, bodies, people, products, locations, key facts, shared passages and cited sources. Highly similar content within three days is usually grouped together. A gap of three to seven days requires shared key facts or clear textual inheritance. A gap over seven days creates a new event unless an explicit citation or continuing update is present.",
  "传播链路只能从较早发布的内容指向较晚发布的内容。直接引用、链接或明显文本复制属于高置信关系；时间明确且内容高度相似但没有直接引用时属于中置信；只有时间和话题接近时属于低置信。低置信关系使用弱化样式展示，不能当作已经确认的转载事实。当前最早来源仅指系统现有数据中能够核实的最早公开内容。": "Propagation links always point from earlier content to later content. Direct citation, linking or obvious copying produces a high-confidence relationship. Clear timing and strong similarity without direct citation produces medium confidence. Timing and topic proximity alone produces low confidence. Low-confidence links are visually de-emphasized and must not be treated as confirmed reposting. The earliest source means only the earliest public item verifiable in the current dataset.",
  "内容舆情与受众舆情": "Content and audience intelligence",
  "“内容舆情”分析新闻报道和社交媒体原帖，用于观察媒体和发布者如何描述品牌。“受众舆情”分析评论及回复，用于观察公众为什么接受、质疑或拒绝产品。两者共享底层数据，但分析对象不同，因此作为并列页面存在。": "Content Intelligence analyzes news coverage and original social posts to show how publishers frame the brand. Audience Intelligence analyzes comments and replies to understand why people accept, question or reject a product. They share underlying data but analyze different subjects, so they are presented as parallel pages.",
  "受众舆情不只判断正面、负面和中立，还会识别认可、期待、购买意向、好奇、怀疑、担忧、失望、愤怒、反感、伦理争议和轻松戏谑等具体状态，并结合价格、产品体验、安全隐私、服务售后等议题形成结论。所有自动结论都应显示样本、互动权重和代表性原文，不能只给出无法核对的摘要。": "Audience Intelligence goes beyond positive, negative and neutral. It identifies approval, anticipation, purchase intent, curiosity, skepticism, concern, disappointment, anger, discomfort, ethical concerns and humor, and connects them with topics such as price, product experience, safety, privacy and support. Automated findings must show sample size, engagement weighting and representative original text rather than an unverifiable summary alone.",
  "情绪模型优先分析原文，翻译只用于展示。简体中文、繁体中文和英文原文不重复翻译，其他语言在原文下方显示英文译文。词云会进行中英文分词，并过滤虚词、网址、平台名和无分析意义的高频词。": "Sentiment models analyze the original text first; translations are for display. Simplified Chinese, Traditional Chinese and English originals are not translated again. Other languages show an English translation beneath the original. Word clouds segment Chinese and English text and remove filler words, URLs, platform names and high-frequency terms with no analytical value.",
  "评论数量与互动加权": "Comment counts and engagement weighting",
  "系统同时保留“原始数量”和“互动共鸣”两种口径。原始数量回答有多少评论表达了某种观点；互动共鸣回答哪些观点获得了更多点赞。回复数量主要代表讨论或争议强度，不直接视为对原评论的认同。": "The system retains both raw counts and engagement resonance. Raw counts answer how many comments expressed a viewpoint; resonance shows which viewpoints received more likes. Reply counts mainly indicate discussion or controversy and are not treated as agreement with the original comment.",
  "点赞采用对数转换和平台内标准化，避免一条爆款评论决定全部结果。同平台最近样本的点赞对数95分位数作为上限，标准化点赞和共鸣权重按以下方式计算：": "Likes are log-transformed and normalized within each platform so one viral comment cannot determine the entire result. The 95th percentile of recent log-like counts on the same platform is the cap. Normalized likes and resonance weight are calculated as follows:",
  "每条有效评论至少保留权重1，高共鸣评论最高为3。该上限是防止极端值支配结果的产品约束，不代表一条评论等于三个人。不同平台分别标准化后才进行汇总。页面同时显示未加权结果和加权结果，避免高互动观点掩盖数量较多但互动较低的意见。": "Every meaningful comment has a minimum weight of 1 and a maximum resonance weight of 3. This cap prevents extreme values from dominating; it does not mean one comment equals three people. Platforms are normalized separately before aggregation. The page shows weighted and unweighted results so high-engagement viewpoints do not hide more numerous but lower-engagement opinions.",
  "国家、地区与文化语境": "Countries, regions and cultural context",
  "系统区分媒体或发帖账号所在地区、评论者可能所在地区以及评论使用的语言。评论者地区优先使用公开所在地和地理信息；这些信息不存在时，会参考帖子主要市场、账号简介、语言、字形和当地用词进行推测。语言不能证明国籍，因此页面统一使用“受众地区（推测）”，并显示判断依据和置信度。": "The system distinguishes the region of a publisher or posting account, the likely region of a commenter, and the language used. Commenter region first uses publicly disclosed location and geographic information. When unavailable, the system considers the post's primary market, account bio, language, script and local wording. Language cannot prove nationality, so the interface labels this as an inferred audience region and shows the basis and confidence.",
  "地区判断分为高、中、低和未知。平台或用户明确披露时为高置信；多个公开信息一致时为中置信；主要依靠讨论市场或语言时为低置信；无法可靠判断时保留未知。中国大陆、香港、澳门和台湾分别统计。样本过少的地区不会被用于推断整个市场的态度。": "Regional classification can be high, medium, low or unknown confidence. Explicit platform or user disclosure is high confidence; consistent public signals are medium; relying mainly on discussion market or language is low; and unreliable cases remain unknown. Mainland China, Hong Kong, Macao and Taiwan are counted separately. Regions with very small samples are not used to infer an entire market's attitude.",
  "人工标注、采集复核与团队共享": "Human labeling, collection review and team sharing",
  "用户可以修改评论的情绪和具体情绪，也可以把纯表情、广告、重复灌水或与产品态度无关的内容标记为“无实意”。系统会保留这类评论原文和人工标注，但不会把它们计入正面、中性、负面、混合的比例、议题、词频和地区态度分析。系统同时保留模型原始判断和人工结果，人工结果始终优先；重新采集、重新分析或升级模型时，不得覆盖已完成的人工标注。": "Users can correct a comment's polarity and specific emotion, or label emoji-only, advertising, repetitive spam or attitude-irrelevant content as having no substantive meaning. The original text and human label are retained, but such comments do not affect sentiment proportions, topics, term frequency or regional attitude analysis. Model output and human decisions are both preserved, with human labels always taking priority; recollection, reanalysis or model upgrades never overwrite completed labels.",
  "评论采集任务会明确区分排队、运行、等待重试、完成和人工复核。达到最大失败次数后，系统停止自动重试，并展示实际错误和最后一次尝试时间。仍有希望恢复的任务会显示下次重试时间。有效且公开可访问的Instagram帖子优先处理，避免无效地址长期占用队列。": "Comment collection clearly distinguishes queued, running, retrying, completed and human-review states. After the maximum number of failures, automatic retries stop and the actual error and last attempt time are shown. Recoverable tasks show the next retry time. Valid publicly accessible Instagram posts are prioritized so invalid URLs do not occupy the queue indefinitely.",
  "同一团队工作区中的成员共享品牌配置、档案、事件、标注、分析和报告，无需重新建立监测流程。管理员负责成员和接口配置，编辑者可以维护数据与标注，查看者只能查看和导出结果。": "Members of the same workspace share brand settings, archives, events, labels, analysis and reports without recreating the monitoring process. Administrators manage members and connectors, editors maintain data and labels, and viewers can only view and export results.",
  "产品定位": "Product scope",
  "开始使用": "Getting started",
  "采集、归档与数据缺失": "Collection, archiving and missing data",
  "事件与传播判断": "Event and propagation rules",
  "地区识别": "Region identification",
  "情绪、评论与人工校准": "Sentiment, comments and human calibration",
  "指标与报告": "Metrics and reports",
  "权限与安全": "Access and security",
  "边界与注意事项": "Limitations and notes",
  "可直接参考的周报／月报文字": "Weekly / monthly copy ready for reference",
  "导出 PDF 报告": "Export PDF report",
  "正在生成 PDF…": "Generating PDF…",
  "管理摘要": "Executive summary",
  "声量与渠道": "Volume & channels",
  "地区分布": "Regional distribution",
  "情绪与议题": "Sentiment & topics",
  "关键受众洞察": "Key audience findings",
  "风险与机会": "Risks & opportunities",
  "下一步建议": "Recommended actions",
  "统计口径": "Methodology",
  "结论随筛选范围更新": "Findings update with the selected scope",
  "全平台 · 全地区": "All platforms · all regions",
  "过去 7 天": "Past 7 days",
  "过去 30 天": "Past 30 days",
  "全部历史数据": "All historical data",
  "月报 · 过去 30 天": "Monthly · past 30 days",
  "周报 · 过去 7 天": "Weekly · past 7 days",
  "季度观察 · 过去 90 天": "Quarterly review · past 90 days",
  "全站自动舆情分析报告": "Automated Media Intelligence Report",
  "汇总新闻、社媒、事件传播和评论数据，先呈现全局变化，再给出可直接用于周报或月报的判断。": "Combines news, social, event propagation and comment data, showing the overall change first and then findings ready for weekly or monthly reporting.",
  "报告名称": "Report name",
  "统计周期": "Reporting period",
  "本期综合判断": "Overall assessment",
  "当前状态": "Current status",
  "数据解释": "Interpretation",
  "建议动作": "Recommended action",
  "归档内容": "Archived content",
  "有效评论": "Meaningful comments",
  "总互动": "Total engagement",
  "地区 / 事件": "Regions / events",
  "高风险内容": "High-risk content",
  "查看新闻档案 →": "View media archive →",
  "每日内容量与负面内容": "Daily content and negative share",
  "全部内容": "All content",
  "其中负面": "Negative portion",
  "平台构成": "Platform mix",
  "重点事件与传播": "Key events and propagation",
  "查看传播链路 →": "View propagation →",
  "等待形成传播事件": "Waiting for a propagation event",
  "首发来源": "Earliest source",
  "节点": "Nodes",
  "查看全部评论与人工标注 →": "View all comments and human labels →",
  "评论态度构成": "Comment attitude mix",
  "最集中的讨论议题": "Most concentrated discussion themes",
  "高互动代表性原文": "Representative high-engagement originals",
  "证据": "Evidence",
  "建议": "Recommendation",
  "查看内容舆情 →": "View content intelligence →",
  "条内容": "items",
  "地区声量与市场差异": "Regional volume and market differences",
  "返回情报总览 →": "Back to overview →",
  "内容较少": "Lower volume",
  "内容最多": "Highest volume",
  "内容": "Content",
  "正面 / 负面": "Positive / negative",
  "立即处理": "Act now",
  "持续观察": "Continue monitoring",
  "主动利用": "Use proactively",
  "暂无集中风险信号": "No concentrated risk signal",
  "核心议题待形成": "Core theme not established yet",
  "暂无趋势数据": "No trend data",
  "暂无有效议题词": "No meaningful topic terms",
  "暂无可归纳议题": "No themes can be summarized yet",
  "当前没有可展示的代表性评论。": "No representative comments are available.",
  "全部地区": "All regions",
  "全部极性": "All polarity",
  "全部标注状态": "All label states",
  "仅未标注": "Unlabeled only",
  "已人工标注": "Human labeled",
  "人机有分歧": "Model / human disagreement",
  "最新发布": "Newest",
  "清除帖子筛选 ×": "Clear post filter ×",
  "上一页": "Previous",
  "下一页": "Next",
  "按情绪分与互动量排序": "Sorted by sentiment score and engagement",
  "暂无需要复核的高风险评论": "No high-risk comments require review",
  "已停止自动重试，请人工核验帖子地址、公开状态和接口返回。": "Automatic retries have stopped. Review the post URL, public availability and API response.",
  "发现带评论的相关帖子后，这里会显示逐帖采集状态。": "Per-post collection status appears here after relevant posts with comments are discovered.",
  "网页新闻": "Web news",
  "公开账号": "Public account",
  "低": "Low",
  "中": "Medium",
  "高": "High",
  "当前筛选条件下没有评论。": "No comments match the current filters.",
  "正在读取评论档案…": "Loading the comment archive…",
  "持续采集中": "Collection in progress",
  "部分帖子待核验": "Some posts need review",
  "当前队列已完成": "Current queue completed",
  "等待建立帖子目标": "Waiting to create post targets",
  "整体平稳": "Stable overall",
  "需要关注": "Requires attention",
  "需要处理": "Action required",
  "可以利用": "Opportunity",
  "暂未形成可靠结论": "No reliable conclusion yet",
  "中国大陆": "Mainland China",
  "香港": "Hong Kong",
  "台湾": "Taiwan",
  "新加坡": "Singapore",
  "马来西亚": "Malaysia",
  "泰国": "Thailand",
  "日本": "Japan",
  "韩国": "South Korea",
  "越南": "Vietnam",
  "印度尼西亚": "Indonesia",
  "菲律宾": "Philippines",
  "印度": "India",
  "美国": "United States",
  "加拿大": "Canada",
  "英国": "United Kingdom",
  "法国": "France",
  "德国": "Germany",
  "意大利": "Italy",
  "西班牙": "Spain",
  "葡萄牙": "Portugal",
  "荷兰": "Netherlands",
  "波兰": "Poland",
  "俄罗斯": "Russia",
  "土耳其": "Türkiye",
  "澳大利亚": "Australia",
  "其他": "Other",
  "认可赞赏": "Approval",
  "兴奋期待": "Excitement",
  "好奇讨论": "Curiosity",
  "怀疑质疑": "Skepticism",
  "担忧顾虑": "Concern",
  "失望抱怨": "Disappointment",
  "反感不适": "Discomfort",
  "愤怒抵制": "Anger / rejection",
  "轻松戏谑": "Humor",
  "购买意向": "Purchase intent",
  "伦理争议": "Ethical concern",
  "中性陈述": "Neutral statement",
};

const EMBEDDED = Object.entries(ENGLISH)
  .filter(([source]) => source.length >= 6)
  .sort(([a], [b]) => b.length - a.length);

const ORIGINAL_TEXT = new WeakMap<Text, string>();
const ORIGINAL_ATTRIBUTES = new WeakMap<Element, Map<string, string>>();

function translateDynamic(value: string) {
  return value
    .replace(/^(\d+) 分钟前$/, "$1 minutes ago")
    .replace(/^(\d+) 小时前$/, "$1 hours ago")
    .replace(/^(\d+) 天前$/, "$1 days ago")
    .replace(/^(\d+) 分钟$/, "$1 minutes")
    .replace(/^(\d+) 小时$/, "$1 hours")
    .replace(/^(\d+) 天$/, "$1 days")
    .replace(/^(\d+) 位成员$/, "$1 members")
    .replace(/^(\d+) 人$/, "$1 people")
    .replace(/^(\d+) 个媒体来源$/, "$1 media sources")
    .replace(/^(\d+) 条归档$/, "$1 archived items")
    .replace(/^(\d+) 篇报道$/, "$1 articles")
    .replace(/^(\d+) 条$/, "$1 items")
    .replace(/^(\d+) 组$/, "$1 query groups")
    .replace(/^(\d+) 次$/, "$1 times")
    .replace(/^(\d+) 节点$/, "$1 nodes")
    .replace(/^(\d+) 个地区$/, "$1 regions")
    .replace(/^第 (\d+) 页 \/ 共 (\d+) 页$/, "Page $1 of $2")
    .replace(/^显示 (\d+) 条结果$/, "$1 results")
    .replace(/^风险 (\d+)$/, "Risk $1")
    .replace(/^下次 (.+)$/, "Next: $1")
    .replace(/^等待 (\d+)$/, "$1 pending")
    .replace(/^已分析 (\d+) 条公开评论$/, "$1 public comments analyzed")
    .replace(/^共鸣权重 ([\d.]+)$/, "Resonance weight $1")
    .replace(/^地区：(.+) · (.+)置信$/, "Region: $1 · $2 confidence");
}

export function translateUiText(value: string) {
  const leading = value.match(/^\s*/)?.[0] ?? "";
  const trailing = value.match(/\s*$/)?.[0] ?? "";
  const core = value.slice(leading.length, value.length - trailing.length || undefined);
  if (!core) return value;
  let translated = ENGLISH[core] ?? translateDynamic(core);
  if (translated === core && /[\u3400-\u9fff]/.test(core)) {
    for (const [source, target] of EMBEDDED) translated = translated.replaceAll(source, target);
  }
  return `${leading}${translated}${trailing}`;
}

function shouldSkip(node: Text) {
  const parent = node.parentElement;
  return Boolean(parent?.closest("[data-no-ui-translate], .english-translation, script, style"));
}

function applyLanguage(root: ParentNode, language: UiLanguage) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (!shouldSkip(node)) {
      if (language === "en") {
        if (/[\u3400-\u9fff]/.test(node.data)) ORIGINAL_TEXT.set(node, node.data);
        const original = ORIGINAL_TEXT.get(node) ?? node.data;
        const next = translateUiText(original);
        if (next !== node.data) node.data = next;
      } else {
        const original = ORIGINAL_TEXT.get(node);
        if (original != null && node.data !== original) node.data = original;
      }
    }
    node = walker.nextNode() as Text | null;
  }

  root.querySelectorAll?.<HTMLElement>("[placeholder], [aria-label], [title]").forEach((element) => {
    const saved = ORIGINAL_ATTRIBUTES.get(element) ?? new Map<string, string>();
    for (const attribute of ["placeholder", "aria-label", "title"]) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      if (language === "en") {
        if (/[\u3400-\u9fff]/.test(current)) saved.set(attribute, current);
        const next = translateUiText(saved.get(attribute) ?? current);
        if (next !== current) element.setAttribute(attribute, next);
      } else if (saved.has(attribute)) element.setAttribute(attribute, saved.get(attribute)!);
    }
    if (saved.size) ORIGINAL_ATTRIBUTES.set(element, saved);
  });
}

export function useInterfaceLanguage() {
  const [language, setLanguageState] = useState<UiLanguage>(() => {
    if (typeof window === "undefined") return "zh";
    try { return window.localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "zh"; }
    catch { return "zh"; }
  });

  useEffect(() => {
    document.documentElement.lang = language === "en" ? "en" : "zh-CN";
    try { window.localStorage.setItem(STORAGE_KEY, language); } catch { /* local preferences can fail in private browsing */ }
    let scheduled = false;
    const refresh = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        applyLanguage(document.body, language);
      });
    };
    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["placeholder", "aria-label", "title"] });
    return () => observer.disconnect();
  }, [language]);

  function setLanguage(next: UiLanguage) {
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* local preferences can fail in private browsing */ }
    setLanguageState(next);
  }
  return { language, setLanguage };
}
