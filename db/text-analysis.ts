export type CommentTone = "正面" | "中性" | "负面" | "混合";
export type DetailedEmotion = "认可赞赏" | "兴奋期待" | "购买意向" | "好奇讨论" | "轻松戏谑" | "中性陈述" | "担忧顾虑" | "怀疑质疑" | "失望抱怨" | "愤怒抵制" | "反感不适" | "伦理争议";

const chineseStopwords = new Set([
  "的", "了", "和", "是", "在", "就", "都", "而", "及", "与", "着", "或", "被", "把", "让", "给", "从", "到", "上", "下", "中", "里", "对", "将", "又", "也", "还", "很", "太", "更", "最", "吗", "呢", "吧", "啊", "呀", "哦", "嗯", "哈",
  "一个", "一种", "一样", "一些", "这次", "那次", "这个", "那个", "这些", "那些", "这里", "那里", "其中", "什么", "怎么", "为什么", "如何", "多少", "时候", "的话", "这样", "那样", "这么", "那么", "自己", "我们", "你们", "他们", "她们", "它们", "大家", "有人", "人家",
  "就是", "还是", "可以", "不是", "没有", "已经", "真的", "感觉", "觉得", "认为", "可能", "应该", "需要", "能够", "不能", "不会", "不要", "然后", "因为", "所以", "如果", "但是", "而且", "不过", "虽然", "对于", "关于", "以及", "进行", "表示", "目前", "相关", "比较", "非常", "特别", "其实", "确实", "当然", "只是", "开始", "出来", "起来", "看到", "知道", "看看", "来说", "这种", "那种", "现在", "以后", "之前", "之后", "还有", "并且", "甚至", "同时", "直接", "已经", "哈哈", "哈哈哈", "呵呵", "哈哈哈哈",
  "评论", "留言", "新闻", "媒体", "公司", "品牌", "产品", "官方", "帖子", "内容", "视频", "图片", "用户", "网友", "事情", "东西", "问题", "方面", "情况",
]);

const englishStopwords = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "that", "this", "these", "those", "there", "here", "it", "its", "it's", "they", "them", "their", "theirs", "we", "us", "our", "ours", "you", "your", "yours", "he", "him", "his", "she", "her", "hers", "i", "me", "my", "mine",
  "is", "am", "are", "was", "were", "be", "been", "being", "do", "does", "did", "done", "have", "has", "had", "can", "could", "will", "would", "shall", "should", "may", "might", "must", "not", "no", "yes", "to", "of", "in", "on", "at", "by", "for", "from", "with", "without", "about", "into", "over", "under", "after", "before", "between", "through", "during", "as",
  "what", "which", "who", "whom", "whose", "when", "where", "why", "how", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "only", "own", "same", "so", "too", "very", "just", "really", "even", "also", "still", "already", "now", "well", "much", "many", "get", "got", "make", "made", "like", "one", "two", "thing", "things", "something", "anything", "people", "someone",
  "comment", "comments", "post", "posts", "video", "photo", "instagram", "media", "news", "brand", "company", "product", "official", "http", "https", "www", "com",
]);

const allowedSingleHan = new Set(["贵", "骗", "赞", "爱", "差", "丑", "假", "真", "怕", "爽", "酷", "值", "买", "贵", "萌"]);
const positiveWords = ["喜欢", "支持", "期待", "创新", "不错", "很好", "看好", "有用", "厉害", "进步", "值得", "满意", "惊喜", "可爱", "有趣", "优秀", "方便", "推荐", "成功", "赞", "爱", "酷", "love", "great", "good", "amazing", "awesome", "excellent", "support", "excited", "interesting", "helpful", "cute", "smart", "impressive", "recommend", "ชอบ", "ดี", "สุดยอด"];
const negativeWords = ["垃圾", "恶心", "騙", "骗", "骗局", "騙局", "太贵", "昂贵", "担心", "擔心", "风险", "危險", "危险", "违法", "噩梦", "問題", "问题", "不行", "反对", "反對", "可怕", "离谱", "失望", "糟糕", "缺陷", "故障", "隐私", "洩露", "泄露", "抵制", "讨厌", "討厭", "差", "丑", "假", "bad", "hate", "scam", "risk", "worst", "awful", "terrible", "dangerous", "expensive", "problem", "broken", "creepy", "privacy", "disappointed", "แพง", "แย่", "อันตราย"];

const topicRules: Array<[string, RegExp]> = [
  ["购买意向", /哪里买|怎么买|想买|购买|下单|预订|预售|链接|available|where.*buy|want.*buy|order|purchase|ราคา|ซื้อ/i],
  ["价格讨论", /价格|售价|多少钱|太贵|便宜|性价比|price|cost|expensive|cheap|afford|ราคา|แพง/i],
  ["产品体验", /体验|使用|功能|质量|材质|外观|设计|效果|好用|耐用|体验感|feature|quality|design|experience|useful|works|ใช้งาน/i],
  ["安全隐私", /安全|隐私|数据|泄露|风险|危险|监听|security|privacy|data|leak|risk|danger|ปลอดภัย/i],
  ["伦理争议", /伦理|道德|违法|物化|取代|失业|人类|社会|ethic|moral|legal|replace|human|society/i],
  ["服务售后", /客服|售后|退货|退款|保修|物流|发货|service|support|refund|shipping|delivery|warranty/i],
  ["情绪表达", /喜欢|支持|期待|讨厌|恶心|可怕|离谱|哈哈|love|hate|wow|lol|amazing|creepy/i],
];

const emotionRules: Array<[DetailedEmotion, RegExp]> = [
  ["愤怒抵制", /愤怒|气死|抵制|滚|不可接受|outrage|furious|boycott|unacceptable/i],
  ["反感不适", /恶心|反感| creepy|诡异|不适|disgust|gross|disturbing/i],
  ["伦理争议", /伦理|道德|物化|违法|取代人类|ethic|moral|objectify|dehuman/i],
  ["怀疑质疑", /怀疑|质疑|真假|骗局|噱头|智商税|scam|fake|doubt|skeptic|really\?/i],
  ["担忧顾虑", /担心|担忧|害怕|风险|危险|隐私|泄露|安全吗|concern|worry|afraid|risk|danger|privacy/i],
  ["失望抱怨", /失望|糟糕|不行|故障|退款|太贵|disappoint|terrible|broken|refund|expensive/i],
  ["购买意向", /哪里买|怎么买|想买|购买|下单|预订|价格多少|where.*buy|want.*buy|order|purchase|available/i],
  ["兴奋期待", /期待|等不及|终于|兴奋|迫不及待|excited|can't wait|cannot wait|looking forward/i],
  ["轻松戏谑", /哈哈|笑死|好笑|离谱|lol|lmao|rofl|😂|🤣|😅/i],
  ["认可赞赏", /喜欢|支持|推荐|厉害|优秀|惊喜|可爱|赞|love|great|awesome|amazing|excellent|support|recommend/i],
  ["好奇讨论", /为什么|怎么|如何|什么原理|有意思|好奇|why|how|what|interesting|curious|\?/i],
];

export function inferDetailedEmotion(text: string, sentiment: CommentTone = "中性"): DetailedEmotion {
  const matched = emotionRules.find(([, pattern]) => pattern.test(text));
  if (matched) return matched[0];
  if (sentiment === "正面") return "认可赞赏";
  if (sentiment === "负面") return "担忧顾虑";
  if (sentiment === "混合") return "好奇讨论";
  return "中性陈述";
}

function normalizedBrandTerms(brandTerms: string[]) {
  return brandTerms.map((term) => term.normalize("NFKC").toLocaleLowerCase().replace(/^[@#]/, "").trim()).filter(Boolean);
}

export function inferTextLanguage(text: string) {
  if (/\p{Script=Thai}/u.test(text)) return "泰语";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)) return "日语";
  if (/\p{Script=Hangul}/u.test(text)) return "韩语";
  if (/\p{Script=Han}/u.test(text)) return "中文";
  return /[A-Za-z]/.test(text) ? "英文" : "语言待确认";
}

export function meaningfulTokens(text: string, brandTerms: string[] = []) {
  const excluded = normalizedBrandTerms(brandTerms);
  const cleaned = text.normalize("NFKC").toLocaleLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/g, " ").replace(/[@#][\p{L}\p{N}_.-]+/gu, " ").replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, " ");
  const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("zh-CN", { granularity: "word" }) : null;
  const raw = segmenter ? [...segmenter.segment(cleaned)].filter((part) => part.isWordLike).map((part) => part.segment)
    : cleaned.match(/[a-z][a-z0-9'-]*|\p{Script=Han}+|\p{Script=Thai}+|\p{Script=Hiragana}+|\p{Script=Katakana}+|\p{Script=Hangul}+/gu) ?? [];
  return raw.map((token) => token.replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, "")).filter((token) => {
    if (!token || /^\d+(?:[.,]\d+)*$/.test(token) || /^(.)\1{2,}$/u.test(token)) return false;
    if (excluded.some((term) => token === term || (term.length >= 2 && term.includes(token)))) return false;
    if (/^[a-z]/i.test(token)) return token.length >= 3 && !englishStopwords.has(token);
    if (/^\p{Script=Han}+$/u.test(token)) return !chineseStopwords.has(token) && (token.length >= 2 || allowedSingleHan.has(token));
    return token.length >= 2;
  });
}

export function keywordCounts(texts: string[], brandTerms: string[] = [], limit = 35) {
  const counts = new Map<string, number>();
  for (const text of texts) for (const token of meaningfulTokens(text, brandTerms)) counts.set(token, (counts.get(token) ?? 0) + 1);
  return [...counts.entries()].map(([word, count]) => ({ word, count })).sort((a, b) => b.count - a.count || a.word.localeCompare(b.word)).slice(0, limit);
}

export function analyzeCommentText(text: string) {
  const lower = text.normalize("NFKC").toLocaleLowerCase();
  const positive = positiveWords.filter((word) => lower.includes(word)).length;
  const negative = negativeWords.filter((word) => lower.includes(word)).length;
  const sentiment: CommentTone = positive && negative ? "混合" : positive ? "正面" : negative ? "负面" : "中性";
  const score = positive || negative ? Math.max(-100, Math.min(100, Math.round((positive - negative) / (positive + negative) * 100))) : 0;
  const topic = topicRules.find(([, pattern]) => pattern.test(text))?.[0] ?? "其他讨论";
  return { sentiment, score, emotion: inferDetailedEmotion(text, sentiment), topic, language: inferTextLanguage(text) };
}
