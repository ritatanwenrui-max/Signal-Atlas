from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "signal-atlas-report-sample.pdf"
MAP = ROOT / "tmp" / "pdfs" / "report-map.png"
OUT.parent.mkdir(parents=True, exist_ok=True)

pdfmetrics.registerFont(TTFont("ArialUnicode", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))
W, H = landscape(A4)
INK = HexColor("#151a14")
DARK = HexColor("#20271e")
ACID = HexColor("#c9f04b")
MUTED = HexColor("#7f877c")
LINE = HexColor("#d9ddd4")
PAPER = HexColor("#f7f8f4")
GREEN = HexColor("#657956")
RED = HexColor("#d65a4a")
YELLOW = HexColor("#d2a33f")
PLATFORMS = [("网页新闻", "#1f291c", 18), ("Instagram", "#d76ea9", 7), ("Facebook", "#6e93df", 4), ("TikTok", "#42c8bd", 5), ("X", "#8c96a0", 8), ("YouTube", "#e8665c", 3)]

def text(c, x, y, value, size=8, color=INK, font="ArialUnicode"):
    c.setFont(font, size); c.setFillColor(color); c.drawString(x, y, str(value))

def fit_text(c, x, y, value, width, size=8, color=INK, font="ArialUnicode"):
    value = str(value)
    while value and c.stringWidth(value, font, size) > width:
        value = value[:-1]
    if value != str(value): value = value[:-1] + "…"
    text(c, x, y, value, size, color, font)

def page_header(c, section, page):
    text(c, 38, H-33, "SIGNAL ATLAS", 8, INK, "Helvetica-Bold")
    text(c, 113, H-33, "MEDIA INTELLIGENCE REPORT", 6, MUTED, "Helvetica")
    fit_text(c, W-300, H-33, section, 155, 8, INK)
    text(c, W-134, H-33, "示例品牌 · 过去 30 天", 6, MUTED)
    c.setStrokeColor(LINE); c.line(38, H-43, W-38, H-43)
    c.line(38, 27, W-38, 27)
    text(c, 38, 15, "样例预览：正式导出会使用共享工作区真实数据", 5.5, MUTED)
    text(c, W-118, 15, f"2026-08-13  ·  {page:02d}", 5.5, MUTED, "Helvetica")

def title_block(c, eyebrow, title, note=""):
    text(c, 38, H-68, eyebrow, 6.5, MUTED, "Helvetica-Bold")
    text(c, 38, H-91, title, 21, INK)
    if note: fit_text(c, W-300, H-84, note, 260, 7, MUTED)

def rounded(c, x, y, w, h, fill=white, stroke=LINE, radius=6):
    c.setFillColor(fill); c.setStrokeColor(stroke); c.roundRect(x, y, w, h, radius, fill=1, stroke=1)

def kpi(c, x, y, w, label, value, note, danger=False):
    rounded(c, x, y, w, 72, PAPER, LINE)
    text(c, x+12, y+55, label, 6.5, MUTED)
    value_font = "Helvetica-Bold" if str(value).isascii() else "ArialUnicode"
    text(c, x+12, y+27, value, 21, RED if danger else INK, value_font)
    fit_text(c, x+12, y+10, note, w-24, 6, MUTED)

def bars(c, x, y, width, items, max_value, row_h=23):
    for i, (label, value, note, color) in enumerate(items):
        yy = y - i*row_h
        fit_text(c, x, yy+8, label, 95, 7, INK)
        fit_text(c, x, yy-1, note, 95, 5.5, MUTED)
        c.setFillColor(HexColor("#e8ebe3")); c.roundRect(x+105, yy+5, width-145, 5, 2.5, fill=1, stroke=0)
        c.setFillColor(HexColor(color)); c.roundRect(x+105, yy+5, max(3, (width-145)*value/max(1,max_value)), 5, 2.5, fill=1, stroke=0)
        text(c, x+width-29, yy+5, value, 7, INK, "Helvetica-Bold")

c = canvas.Canvas(str(OUT), pagesize=(W,H), pageCompression=1)
c.setTitle("Signal Atlas 舆情数据分析报告 - 样例")

# 1 Cover
c.setFillColor(DARK); c.rect(0,0,W,H,fill=1,stroke=0)
c.setStrokeColor(ACID); c.setLineWidth(48); c.circle(W-40, H-46, 155, fill=0, stroke=1)
c.setStrokeColor(HexColor("#596650")); c.setLineWidth(28); c.circle(W-110, 5, 112, fill=0, stroke=1)
text(c, 65, H-62, "SIGNAL ATLAS / MEDIA INTELLIGENCE", 7, HexColor("#8e9989"), "Helvetica-Bold")
text(c, 65, H-180, "品牌舆情数据分析报告", 40, white)
text(c, 65, H-220, "示例品牌", 18, ACID)
text(c, 65, H-286, "过去 30 天", 10, HexColor("#9ca697"))
text(c, 142, H-287, "2026.07.15 — 2026.08.13", 13, white, "Helvetica")
x = 65
for label, color, _ in PLATFORMS:
    c.setFillColor(HexColor(color)); c.rect(x, H-336, 7, 7, fill=1, stroke=0)
    text(c, x+11, H-336, label, 7, HexColor("#b7bfb3")); x += 93
c.setStrokeColor(HexColor("#465043")); c.line(65, 70, W-65, 70)
text(c, 65, 50, "WORKSPACE", 5.5, HexColor("#727e6e"), "Helvetica-Bold")
text(c, 65, 35, "示例品牌团队工作区", 8, HexColor("#c7cec3"))
text(c, 310, 50, "GENERATED", 5.5, HexColor("#727e6e"), "Helvetica-Bold")
text(c, 310, 35, "2026-08-13 15:50", 8, HexColor("#c7cec3"), "Helvetica")
text(c, 520, 50, "DATA POLICY", 5.5, HexColor("#727e6e"), "Helvetica-Bold")
text(c, 520, 35, "仅使用已归档与已实际采集数据", 8, HexColor("#c7cec3"))
c.showPage()

# 2 Summary
page_header(c, "01 / 管理摘要", 2); title_block(c, "EXECUTIVE SUMMARY", "本期舆情概览", "先结论，后证据")
for i, item in enumerate([("归档内容","45","6 类渠道"), ("国家 / 地区","8","台湾最多"), ("传播事件","4","最大 19 个节点"), ("净情绪指数","+18","正面占比减负面占比"), ("高风险内容","3","风险分 ≥ 70")]):
    kpi(c, 38+i*153, H-185, 141, *item, danger=i==4)
rounded(c, 38, 52, 492, 335, white, LINE); text(c, 54, 364, "自动研判", 10, INK)
insights = ["过去 30 天共归档 45 条品牌相关内容，覆盖 8 个国家或地区。", "台湾是报道最集中的市场，占本期总量的 38%。", "最大传播事件从香港首发，随后扩散至台湾、泰国与马来西亚。", "发现 3 条高风险内容，建议优先复核高互动负面评论。"]
for i, ins in enumerate(insights):
    y=315-i*69; c.setFillColor(PAPER); c.rect(54,y,458,52,fill=1,stroke=0); text(c,65,y+31,f"{i+1:02d}",7,GREEN,"Helvetica-Bold"); fit_text(c,95,y+23,ins,400,8,INK)
rounded(c, 548, 52, 255, 335, DARK, DARK); text(c,565,364,"风险雷达",10,white); text(c,565,314,"82",38,ACID,"Helvetica-Bold"); text(c,620,320,"本期最高风险分",7,HexColor("#9aa596"))
for i,t in enumerate(["产品安全性的担忧集中上升", "部分评论质疑信息真实性", "跨地区转载带来标题夸张"]):
    yy=246-i*58; c.setFillColor(HexColor("#171d16")); c.rect(565,yy,220,45,fill=1,stroke=0); text(c,577,yy+27,"重点复核",5.5,HexColor("#82907b")); fit_text(c,577,yy+11,t,190,7,white)
c.showPage()

# 3 Volume
page_header(c, "02 / 声量与渠道", 3); title_block(c,"VOLUME & CHANNELS","报道声量、平台与媒体来源","45 条有效归档")
rounded(c,38,245,475,255,white,LINE); text(c,54,477,"每日内容量 / 负面占比",9,INK)
daily=[1,2,1,4,3,6,9,7,5,3,4]; neg=[0,0,0,1,0,1,2,1,1,0,1]
base=275
for i,v in enumerate(daily):
    x=66+i*38; c.setFillColor(GREEN); c.rect(x,base,18,v*18,fill=1,stroke=0); c.setFillColor(RED); c.rect(x,base,18,neg[i]*18,fill=1,stroke=0); text(c,x-1,260,f"08/{i+3:02d}",5,MUTED,"Helvetica")
rounded(c,531,245,272,255,white,LINE); text(c,547,477,"渠道构成",9,INK)
bars(c,547,445,238,[(a,n,f"{round(n/45*100)}%",col) for a,col,n in PLATFORMS],18,31)
rounded(c,38,52,765,174,white,LINE); text(c,54,204,"媒体 / 账号排行",9,INK)
sources=[("台湾好新闻","台湾",9,82),("Yahoo 新闻","台湾",7,77),("网易新闻","中国",6,74),("ETtoday 新闻云","台湾",5,71),("Bangkok Post","泰国",4,64)]
for i,(name,country,count,impact) in enumerate(sources):
    yy=174-i*26; text(c,55,yy,f"{i+1:02d}",6,MUTED,"Helvetica-Bold"); fit_text(c,90,yy,name,190,7,INK); text(c,300,yy,country,7,MUTED); text(c,410,yy,count,8,INK,"Helvetica-Bold"); text(c,500,yy,impact,8,INK,"Helvetica-Bold"); c.setFillColor(GREEN); c.roundRect(585,yy+1,160*count/9,5,2,fill=1,stroke=0)
c.showPage()

# 4 Geography
page_header(c,"03 / 地区分布",4); title_block(c,"GEOGRAPHIC INTELLIGENCE","全球报道热力与市场结构","媒体发布地区，不等同于内容提及地区")
rounded(c,38,118,528,380,white,LINE); c.drawImage(ImageReader(str(MAP)),52,150,width=500,height=293,mask='auto',preserveAspectRatio=True,anchor='c')
legend_colors=["#dce9bc","#bed27f","#91ad52","#5f7d30","#263c19"]
text(c,170,132,"报道较少",6,MUTED)
for i,col in enumerate(legend_colors): c.setFillColor(HexColor(col)); c.rect(226+i*24,132,20,5,fill=1,stroke=0)
text(c,352,132,"报道最多",6,MUTED)
rounded(c,584,118,219,380,white,LINE); text(c,600,475,"主要市场",9,INK)
countries=[("台湾",17,"38% · 风险 82"),("香港",8,"18% · 风险 68"),("泰国",6,"13% · 风险 54"),("马来西亚",5,"11% · 风险 48"),("美国",4,"9% · 风险 51"),("中国",3,"7% · 风险 73"),("新加坡",2,"4% · 风险 42")]
bars(c,600,444,186,[(a,n,note,"#657956") for a,n,note in countries],17,42)
for i,item in enumerate([("首要市场","台湾","17 条报道"),("跨境传播边","12","已识别复制链路"),("地区覆盖","8","可信推断地区"),("首要渠道","网页新闻","18 条内容")]): kpi(c,38+i*191,37,178,*item)
c.showPage()

# 5 Sentiment
page_header(c,"04 / 情绪与议题",5); title_block(c,"SENTIMENT & THEMES","报道情绪、具体意图与高频议题","机器研判需结合原文复核")
rounded(c,38,100,224,398,white,LINE); text(c,54,475,"情绪结构",9,INK)
cx,cy,r=150,350,76; start=0
for val,col in [(42,GREEN),(37,HexColor("#aeb4aa")),(13,RED),(8,YELLOW)]: c.setFillColor(col); c.wedge(cx-r,cy-r,cx+r,cy+r,start,val*3.6,fill=1,stroke=0); start+=val*3.6
c.setFillColor(white); c.circle(cx,cy,43,fill=1,stroke=0); text(c,cx-19,cy+4,"+29",19,INK,"Helvetica-Bold"); text(c,cx-25,cy-12,"净情绪指数",6,MUTED)
for i,(lab,val,col) in enumerate([("正面",19,GREEN),("中性",17,HexColor("#aeb4aa")),("负面",6,RED),("混合",3,YELLOW)]):
    yy=236-i*28; c.setFillColor(col); c.circle(63,yy+3,3,fill=1,stroke=0); text(c,73,yy,lab,7,INK); text(c,200,yy,f"{val} · {round(val/45*100)}%",7,INK,"Helvetica-Bold")
rounded(c,280,100,240,398,white,LINE); text(c,296,475,"具体情绪与行动意图",9,INK)
emotions=[("好奇探索",13),("期待支持",10),("中性陈述",8),("担忧风险",6),("质疑真实性",4),("购买意向",2),("嘲讽反感",2)]
bars(c,296,438,208,[(a,n,"", "#71845e") for a,n in emotions],13,43)
rounded(c,538,100,265,398,white,LINE); text(c,554,475,"高频议题",9,INK)
words=[("人工智能",22,18),("产品设计",18,16),("隐私",14,15),("机器人",12,14),("价格",10,13),("安全",9,13),("情感陪伴",8,12),("创新",7,11),("伦理",6,11),("发布",5,10),("体验",5,10)]
positions=[(566,420),(662,430),(730,389),(580,360),(686,345),(752,320),(570,298),(670,280),(742,250),(600,218),(700,205)]
for (word,_,size),(x,y) in zip(words,positions): text(c,x,y,word,size,GREEN if size<15 else INK)
rounded(c,38,38,765,45,PAPER,PAPER); c.setFillColor(ACID); c.rect(38,38,4,45,fill=1,stroke=0); text(c,54,63,"判读口径",7,INK); fit_text(c,120,61,"极性用于快速筛查；具体情绪与行动意图更适合支持公关决策。词频已过滤中英文常见虚词与品牌名。",650,7,MUTED)
c.showPage()

# 6 Propagation
page_header(c,"05 / 事件与传播",6); title_block(c,"EVENT PROPAGATION","同一事件识别与跨地区扩散","时间顺序 + 标题正文重合 + 实体主题指纹")
rounded(c,38,405,765,92,DARK,DARK); text(c,56,475,"本期最大传播事件",6,HexColor("#82907b")); fit_text(c,56,447,"新品发布与产品功能报道在亚洲多地集中扩散",630,13,white); text(c,56,425,"首发：香港示例媒体（香港） · 19 个节点 · 4 个地区 · 风险 82",7,HexColor("#9aa596")); text(c,737,438,"19",33,ACID,"Helvetica-Bold")
routes=[("香港","网页新闻","香港示例媒体","08/08 09:10"),("台湾","网页新闻","台湾示例媒体","08/08 12:40"),("台湾","Instagram","新闻账号 A","08/08 15:20"),("泰国","TikTok","新闻账号 B","08/09 10:15"),("马来西亚","网页新闻","媒体 C","08/09 16:50")]
for i,(country,platform,source,dt) in enumerate(routes):
    x=48+i*151; col=dict((a,b) for a,b,_ in PLATFORMS).get(platform,"#657956"); c.setFillColor(white); c.setStrokeColor(LINE); c.roundRect(x,273,126,95,5,fill=1,stroke=1); c.setFillColor(HexColor(col)); c.rect(x,363,126,5,fill=1,stroke=0); text(c,x+10,348,f"{i+1:02d} · {platform}",5.5,MUTED); fit_text(c,x+10,324,source,105,8,INK); text(c,x+10,294,f"{country} · {dt}",6,MUTED); 
    if i<4: text(c,x+135,316,"→",14,GREEN)
rounded(c,38,52,765,193,white,LINE); text(c,54,221,"并列传播事件",9,INK)
events=[("新品发布与功能报道集中扩散","香港示例媒体",4,19,82),("创始人采访引发行业讨论","美国科技媒体",3,11,64),("用户体验视频带动评论增长","Instagram 账号",2,8,58),("产品安全质疑进入复核队列","论坛与 X",2,6,76)]
for i,(name,source,regions,nodes,risk) in enumerate(events):
    yy=183-i*35; fit_text(c,55,yy,name,310,7.5,INK); fit_text(c,385,yy,source,130,7,MUTED); text(c,545,yy,regions,8,INK,"Helvetica-Bold"); text(c,620,yy,nodes,8,INK,"Helvetica-Bold"); text(c,730,yy,risk,8,RED,"Helvetica-Bold")
c.showPage()

# 7 Comments + evidence
page_header(c,"06 / 评论舆情与证据",7); title_block(c,"COMMENT INTELLIGENCE","受众反馈、风险评论与核心证据","仅统计实际取得的公开评论文本")
for i,item in enumerate([("已分析评论","386","214 位参与者"),("净情绪指数","-12","正面减负面",True),("负面评论","31%","120 条",True),("评论互动","1,248","获赞与回复"),("采集覆盖","78%","已归档 / 披露")]): kpi(c,38+i*153,H-182,141,*item[:3], danger=len(item)>3)
rounded(c,38,232,242,190,white,LINE); text(c,54,398,"核心讨论议题",9,INK)
topics=[("产品安全",88,"42% 负面"),("价格",71,"18% 负面"),("隐私",56,"39% 负面"),("设计",49,"8% 负面"),("购买意向",38,"5% 负面")]
bars(c,54,368,210,[(a,n,note,"#657956") for a,n,note in topics],88,33)
rounded(c,298,232,242,190,white,LINE); text(c,314,398,"评论高频词",9,INK)
for (word,_,size),(x,y) in zip(words[:9],[(320,360),(408,370),(460,330),(326,315),(410,300),(470,278),(330,263),(420,250),(475,242)]): text(c,x,y,word,max(9,size-3),GREEN if size<14 else INK)
rounded(c,558,232,245,190,white,LINE); text(c,574,398,"优先复核评论",9,INK)
risk_comments=[("担忧风险 · TikTok","这个功能真的安全吗？需要更多公开说明。"),("质疑真实性 · X","宣传中的数字有没有第三方证据支持？"),("混合 · Instagram","设计很有意思，但价格和隐私政策需要解释。")]
for i,(tag,body) in enumerate(risk_comments):
    yy=354-i*52; text(c,574,yy,tag,6,RED); fit_text(c,574,yy-16,body,205,7,INK); c.setStrokeColor(LINE); c.line(574,yy-25,786,yy-25)
rounded(c,38,52,765,160,white,LINE); text(c,54,188,"重点原文索引",9,INK)
rows=[("08/13 09:20","网页新闻","产品功能与行业影响分析","台湾示例媒体","台湾","担忧风险",82),("08/12 18:05","Instagram","新品体验短视频获得集中讨论","@news_demo","香港","好奇探索",66),("08/11 14:40","X","产品安全性问题引发转发","@tech_watch","美国","质疑真实性",79)]
for i,row in enumerate(rows):
    yy=156-i*36; text(c,55,yy,row[0],6,MUTED,"Helvetica"); text(c,125,yy,row[1],6,GREEN); fit_text(c,205,yy,row[2],225,7,INK); fit_text(c,446,yy,row[3],100,7,MUTED); text(c,570,yy,row[4],7,MUTED); fit_text(c,635,yy,row[5],90,7,INK); text(c,756,yy,row[6],8,RED,"Helvetica-Bold")
c.save()
print(OUT)
