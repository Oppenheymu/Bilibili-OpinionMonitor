/**
 * B站语境人工标注集（Ground Truth）—— 220+ 条
 *
 * 每条样本 = 一条真实风格的 B站评论 + 人工标注的期望情感倾向 + 期望分数范围。
 * 说明字段前缀标识语境类型（用于分语境准确率统计）：
 * - `反讽-`：阴阳怪气/字面夸实际批（导师重点考察）
 * - `梗-`：网络梗（典中典/保护/差不多得了...）
 * - `缩写-`：拼音/英文缩写（yyds/xswl/dbq...）
 * - `谐音-`：谐音替代字（牛批/无语子...）
 * - `直白-`：直白表达（正面/负面）
 * - `中性-`：中性陈述/提问/讨论
 *
 * 扩充方式：直接在此数组追加 { 内容, 期望倾向, 期望分数范围, 说明 }
 */

import type { AnnotationSample } from "./annotation-sample";

export const biliAnnotationSet: AnnotationSample[] = [
    // ========== 正面-直白（45 条）==========
    {
        content: "太好了，up主每次都能准时更新，质量也越来越高！",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面夸赞",
    },
    {
        content: "感谢分享，学到了学到了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面感谢",
    },
    {
        content: "楼主是懂行的，讲得清楚明白",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面认可",
    },
    {
        content: "已三连，投币支持up主",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面支持行为",
    },
    {
        content: "终于等到更新了！",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面期待满足",
    },
    {
        content: "这期内容太实用了，收藏了慢慢看",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面实用",
    },
    {
        content: "up主讲得好细致，我一个外行都听懂了",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面教学",
    },
    {
        content: "太喜欢这个系列了，每期都追",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面喜欢",
    },
    {
        content: "声音好听，文案也用心了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面细节",
    },
    {
        content: "剪辑越来越成熟了，进步很大",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面进步",
    },
    {
        content: "这个科普做得真好，深入浅出",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面科普",
    },
    {
        content: "支持up主，以后多出这类视频",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面支持",
    },
    {
        content: "看完真的很有感触，感谢分享",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面触动",
    },
    {
        content: "up主三观正，说得太对了",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面三观",
    },
    {
        content: "这个角度分析得很独到，学到了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面分析",
    },
    {
        content: "画面太美了，每一帧都是壁纸",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面画面",
    },
    {
        content: "bgm配得刚刚好，氛围感拉满",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面配乐",
    },
    {
        content: "这波操作我直接吹爆",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面吹捧",
    },
    {
        content: "老up了，从第一个视频就关注了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面老粉",
    },
    {
        content: "内容密度太高了，信息量巨大",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面信息量",
    },
    {
        content: "up主辛苦了，期待下期",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面辛苦",
    },
    {
        content: "这个选题太好了，正好是我需要的",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面选题",
    },
    {
        content: "讲得太明白了，之前一直没搞懂",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面解惑",
    },
    {
        content: "节奏舒服，一口气看完了",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面节奏",
    },
    {
        content: "字幕做得好细心，好评",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面字幕",
    },
    {
        content: "这个实验做得真严谨，佩服",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面严谨",
    },
    {
        content: "干货满满，已经转发给朋友了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面干货",
    },
    {
        content: "up主的心态值得学习，积极向上",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面心态",
    },
    {
        content: "看完心情都变好了，谢谢",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面治愈",
    },
    {
        content: "这质量对得起播放量，火是有道理的",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面质量",
    },
    {
        content: "关注列表终于又有宝藏up了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面宝藏",
    },
    {
        content: "讲的比我老师还好，投币了",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面对比夸",
    },
    {
        content: "up主加油，粉丝会一直陪着你",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面鼓励",
    },
    {
        content: "这个彩蛋藏得深，二刷才发现",
        expectedSentiment: "正面",
        expectedScoreRange: [30, 70],
        note: "直白-正面细节",
    },
    {
        content: "回答得真好，帮我解决了大问题",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面解答",
    },
    {
        content: "up主声音太治愈了，失眠就靠它",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面治愈",
    },
    {
        content: "这期嘉宾请得好，配合默契",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面嘉宾",
    },
    {
        content: "逻辑清晰，论证充分，很专业",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面专业",
    },
    {
        content: "看完立刻去实践了，效果不错",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面实践",
    },
    {
        content: "up主太有才了，这个创意绝了",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面创意",
    },
    {
        content: "第一次看到讲得这么清楚的，三连了",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面三连",
    },
    {
        content: "这个系列必看，推荐给所有人",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-正面推荐",
    },
    {
        content: "up主真的很用心在做内容",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "直白-正面用心",
    },
    {
        content: "看完直接路转粉了",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "直白-正面转粉",
    },

    // ========== 正面-梗/缩写（20 条）==========
    {
        content: "yyds！永远的yyds！",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "缩写-yyds夸赞",
    },
    {
        content: "666666",
        expectedSentiment: "正面",
        expectedScoreRange: [30, 80],
        note: "梗-666夸赞",
    },
    {
        content: "蚌埠住了，笑死哈哈哈哈",
        expectedSentiment: "正面",
        expectedScoreRange: [30, 80],
        note: "梗-蚌埠住了好笑",
    },
    {
        content: "awsl，这也太可爱了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "缩写-awsl",
    },
    {
        content: "绝绝子，这个设计真的绝",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "梗-绝绝子夸赞",
    },
    {
        content: "爱了爱了，这个up主我粉了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "梗-爱了爱了",
    },
    {
        content: "笑不活了，这个梗太好玩了",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "梗-笑不活了",
    },
    {
        content: "泪目了，这个结局太感人了",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "梗-泪目感动",
    },
    {
        content: "这也太顶了吧，直接封神",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "梗-封神",
    },
    {
        content: "好家伙，这波操作秀到我了",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "梗-秀操作",
    },
    {
        content: "破防了，看到最后绷不住了",
        expectedSentiment: "正面",
        expectedScoreRange: [30, 70],
        note: "梗-破防感动",
    },
    {
        content: "这期质量高到离谱，直接起飞",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "梗-起飞",
    },
    {
        content: "xswl，这个反转我没想到",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "缩写-xswl",
    },
    {
        content: "绝了家人们，太精彩了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "梗-绝了",
    },
    {
        content: "tql，这水平我练十年都追不上",
        expectedSentiment: "正面",
        expectedScoreRange: [60, 100],
        note: "缩写-tql",
    },
    {
        content: "nb，这操作看得我目瞪口呆",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "谐音-nb夸赞",
    },
    {
        content: "太顶了太顶了，全程无尿点",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "梗-太顶",
    },
    {
        content: "这个宝藏up终于被我发现了",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "直白-宝藏",
    },
    {
        content: "一整个爱住了，直接三连走起",
        expectedSentiment: "正面",
        expectedScoreRange: [50, 90],
        note: "梗-爱住",
    },
    {
        content: "家人们谁懂啊，太好看了",
        expectedSentiment: "正面",
        expectedScoreRange: [40, 80],
        note: "梗-家人夸赞",
    },

    // ========== 负面-直白（40 条）==========
    {
        content: "广告太多了，取关取关",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面取关",
    },
    {
        content: "审核呢？这都能过审？",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面质疑审核",
    },
    {
        content: "up主这是在洗白吧，无语了",
        expectedSentiment: "负面",
        expectedScoreRange: [-80, -40],
        note: "直白-负面质疑洗白",
    },
    {
        content: "这视频质量太差了，浪费时间",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面质量",
    },
    {
        content: "标题党！内容完全不是说的那样",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面标题党",
    },
    {
        content: "又在恰饭，广告植入也太硬了",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面恰饭",
    },
    {
        content: "抄袭的还理直气壮？恶心",
        expectedSentiment: "负面",
        expectedScoreRange: [-80, -40],
        note: "直白-负面抄袭",
    },
    {
        content: "up主人品有问题，取关了",
        expectedSentiment: "负面",
        expectedScoreRange: [-80, -40],
        note: "直白-负面人品",
    },
    {
        content: "这波操作我看不懂，完全是迷惑行为",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面迷惑",
    },
    {
        content: "声音也太刺耳了，根本听不下去",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面声音",
    },
    {
        content: "内容全是搬运的，一点原创都没有",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面搬运",
    },
    {
        content: "宣传的和实际完全不符，骗人的",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面不符",
    },
    {
        content: "越做越水了，关注你真是浪费",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面变水",
    },
    {
        content: "这期完全是凑数，毫无诚意",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面凑数",
    },
    {
        content: "理论全是错的，误人子弟",
        expectedSentiment: "负面",
        expectedScoreRange: [-80, -40],
        note: "直白-负面错误",
    },
    {
        content: "剪辑稀碎，看得头晕",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面剪辑",
    },
    {
        content: "up主态度傲慢，评论都不回",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面态度",
    },
    {
        content: "这都能火？B站现在的审美怎么了",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面审美",
    },
    {
        content: "带节奏带得飞起，别有用心",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面带节奏",
    },
    {
        content: "举报了，这种内容不该存在",
        expectedSentiment: "负面",
        expectedScoreRange: [-80, -40],
        note: "直白-负面举报",
    },
    {
        content: "之前还挺喜欢，现在彻底失望",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面失望",
    },
    {
        content: "涨粉了就飘了是吧？",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面飘了",
    },
    {
        content: "内容越来越低俗，败好感",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面低俗",
    },
    {
        content: "说了多少次了就是不改，无语",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面不改",
    },
    {
        content: "这标题取得真low，不想点进来",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面标题",
    },
    {
        content: "up主最近净整些没用的",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面没用的",
    },
    {
        content: "这就是割韭菜吧，吃相难看",
        expectedSentiment: "负面",
        expectedScoreRange: [-80, -40],
        note: "直白-负面割韭菜",
    },
    {
        content: "删评论算什么本事？心虚了？",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面删评",
    },
    {
        content: "一期不如一期，弃了",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面弃坑",
    },
    {
        content: "说话阴阳怪气，听着就不舒服",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面语气",
    },
    {
        content: "这个up主踩一捧一，太下头",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面下头",
    },
    {
        content: "评论区全是水军，没眼看",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面水军",
    },
    {
        content: "吹得天花乱坠，实际也就那样",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面吹捧",
    },
    {
        content: "这就离谱了，数据造假实锤",
        expectedSentiment: "负面",
        expectedScoreRange: [-80, -40],
        note: "直白-负面造假",
    },
    {
        content: "不看了，越看越气",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "直白-负面生气",
    },
    {
        content: "up主这波操作败光路人缘",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面路人缘",
    },
    {
        content: "内容质量断崖式下跌，看不下去了",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面下跌",
    },
    {
        content: "把观众当傻子吗？",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面当傻子",
    },
    {
        content: "毫无下限，这种烂片也推",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "直白-负面烂片",
    },
    {
        content: "取关了，白瞎了我这几年的关注",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "直白-负面取关",
    },

    // ========== 负面-反讽/阴阳（40 条）==========
    {
        content: "真有你的，这种操作都能做出来",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "反讽-真有你的",
    },
    {
        content: "好棒棒哦，真厉害呢",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-好棒棒",
    },
    {
        content: "你可真行啊，这都能赖掉",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "反讽-你可真行",
    },
    {
        content: "真是辛苦你了，白忙活一场",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-辛苦你了",
    },
    {
        content: "就这？就这？就这？",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-就这",
    },
    {
        content: "典中典，又开始洗了是吧",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "反讽-典中典",
    },
    {
        content: "哇，你好懂哦，全世界你最懂",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-你好懂",
    },
    {
        content: "对对对，你说的都对",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-你说的都对",
    },
    {
        content: "这智商，我真是无话可说",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-智商",
    },
    {
        content: "厉害了厉害了，这波操作666",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-厉害了",
    },
    {
        content: "哟，这么大牌啊，请都请不动",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-大牌",
    },
    {
        content: "你可真是个大聪明",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-大聪明",
    },
    {
        content: "真棒，比幼儿园小朋友还棒",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-比幼儿园棒",
    },
    {
        content: "谢谢啊，可真是帮了大忙（语气冷淡）",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-谢谢啊",
    },
    {
        content: "厉害了我的哥，这都能洗",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-厉害了我的哥",
    },
    {
        content: "太有水平了，我差点就信了",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-差点信了",
    },
    {
        content: "多会说话呀，就是不做人",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-不做人",
    },
    {
        content: "瞧瞧这说的是人话吗？",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "反讽-不是人话",
    },
    {
        content: "好一出大戏，演得真精彩",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-演戏",
    },
    {
        content: "真有意思，自己打自己脸",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-打脸",
    },
    {
        content: "说得好像很懂似的",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-好像很懂",
    },
    {
        content: "感谢up主牺牲自己娱乐大家",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-牺牲娱乐",
    },
    {
        content: "这期节目效果拉满（指翻车现场）",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-节目效果",
    },
    {
        content: "好一个理直气壮",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-理直气壮",
    },
    {
        content: "真棒，棒到没朋友",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-棒到没朋友",
    },
    {
        content: "可真是个人才啊",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-人才",
    },
    {
        content: "这格局，可真大啊",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-格局大",
    },
    {
        content: "多伟大呀，伟大到我都要哭了",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-伟大",
    },
    {
        content: "呵呵，说得比唱得还好听",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-唱得好听",
    },
    {
        content: "这么厉害怎么不去拯救世界",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-拯救世界",
    },
    {
        content: "我谢谢你全家",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "反讽-谢谢你全家",
    },
    {
        content: "您老可真会挑时候发视频",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-挑时候",
    },
    {
        content: "太优秀了，优秀到没边",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-优秀到没边",
    },
    {
        content: "真会说话，情商高到天上去",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-情商高",
    },
    {
        content: "哈哈，好一个双标",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-双标",
    },
    {
        content: "妙啊，妙不可言",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-妙不可言",
    },
    {
        content: "这波呀，这波是自取其辱",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-自取其辱",
    },
    {
        content: "厉害厉害，佩服佩服（阴阳）",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-佩服佩服",
    },
    {
        content: "不愧是up主，脸皮厚度第一人",
        expectedSentiment: "负面",
        expectedScoreRange: [-70, -30],
        note: "反讽-脸皮厚",
    },
    {
        content: "真好，好在大家都看得见",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-好在看得见",
    },

    // ========== 负面-梗/缩写（20 条）==========
    {
        content: "差不多得了，天天水视频",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "梗-差不多得了",
    },
    {
        content: "典！太典了，熟悉的套路",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "梗-太典了",
    },
    {
        content: "绷不住了，这操作真下饭",
        expectedSentiment: "负面",
        expectedScoreRange: [-40, 0],
        note: "梗-下饭",
    },
    {
        content: "无语子，这都能吹",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "谐音-无语子",
    },
    {
        content: "就这就这就这？就这水平？",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "反讽-就这水平",
    },
    {
        content: "麻了，被这期内容无语到",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "梗-麻了",
    },
    {
        content: "离谱他妈给离谱开门，离谱到家了",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "梗-离谱",
    },
    {
        content: "真下头，好感全无",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "梗-下头",
    },
    {
        content: "这波操作真的6（反义）",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-6反义",
    },
    {
        content: "好活当赏（反讽）",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "反讽-好活当赏",
    },
    {
        content: "蚌埠住了（被气的）",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "梗-蚌埠住生气",
    },
    {
        content: "笑死，这也能叫科普？",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "梗-笑死嘲讽",
    },
    {
        content: "绝了（嘲讽版）",
        expectedSentiment: "负面",
        expectedScoreRange: [-40, 0],
        note: "反讽-绝了嘲讽",
    },
    {
        content: "好家伙，我直接好家伙",
        expectedSentiment: "负面",
        expectedScoreRange: [-40, 0],
        note: "梗-好家伙惊讶",
    },
    {
        content: "这波我直接裂开",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "梗-裂开",
    },
    {
        content: "笑不活了（被蠢哭）",
        expectedSentiment: "负面",
        expectedScoreRange: [-40, 0],
        note: "梗-笑不活嘲讽",
    },
    {
        content: "yysy，这期真的不行",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "缩写-yysy",
    },
    {
        content: "xswl，就这还吹天花板",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "缩写-xswl嘲讽",
    },
    {
        content: "哭死，居然还有人买账",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "梗-哭死嘲讽",
    },
    {
        content: "难绷，这质量还能拿大赏",
        expectedSentiment: "负面",
        expectedScoreRange: [-60, -20],
        note: "梗-难绷",
    },

    // ========== 中性-陈述/提问/讨论（45 条）==========
    {
        content: "先占个楼，晚点再看",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-占楼",
    },
    {
        content: "评论区真热闹，都是来吃瓜的",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-吃瓜",
    },
    {
        content: "讲得还行，就是声音有点小",
        expectedSentiment: "中性",
        expectedScoreRange: [-30, 10],
        note: "中性-还行",
    },
    {
        content: "这视频质量一般般，凑合看吧",
        expectedSentiment: "中性",
        expectedScoreRange: [-30, 10],
        note: "中性-一般般",
    },
    {
        content: "今天的视频就更新到这里，大家怎么看？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "这个up主是做什么内容的？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "有没有人知道背景音乐是什么",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-求bgm",
    },
    {
        content: "前排围观",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-前排",
    },
    {
        content: "打卡打卡",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-打卡",
    },
    {
        content: "沙发",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-沙发",
    },
    {
        content: "视频最后那个彩蛋是什么意思？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问彩蛋",
    },
    {
        content: "有人和我一样是第一次来的吗",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "这个系列已经出到第几期了？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "评论区置顶的是官方消息吗",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "路过，随便看看",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-路过",
    },
    {
        content: "up主下期准备做什么内容？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "每周这个时候更新吗？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "这期和上期有什么关联？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "好奇up主的设备是什么",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "蹲一个后续",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-蹲后续",
    },
    {
        content: "坐等评论区大佬分析",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-等分析",
    },
    {
        content: "看视频来的，纯路人",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-路人",
    },
    {
        content: "更新频率还挺稳定的",
        expectedSentiment: "中性",
        expectedScoreRange: [-10, 30],
        note: "中性-客观描述",
    },
    {
        content: "这个up主粉丝量多少了？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "视频里提到的书是什么？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "有没有字幕组的版本？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "刚来，请问这个频道主要讲什么？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "评论区聊的跟视频内容有关吗",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "同问，我也想知道",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-同问",
    },
    {
        content: "原来是这样，明白了",
        expectedSentiment: "中性",
        expectedScoreRange: [-10, 30],
        note: "中性-明白",
    },
    {
        content: "这波解释挺清楚的",
        expectedSentiment: "中性",
        expectedScoreRange: [-10, 30],
        note: "中性-客观评价",
    },
    {
        content: "看完了，感觉一般",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-一般",
    },
    {
        content: "剧情还好吧，没有想象中惊艳",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-还好吧",
    },
    {
        content: "内容没问题，就是节奏可以再快点",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-建议",
    },
    {
        content: "up主加油，期待继续保持",
        expectedSentiment: "中性",
        expectedScoreRange: [0, 40],
        note: "中性-中性鼓励",
    },
    {
        content: "这期内容中规中矩",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-中规中矩",
    },
    {
        content: "说不上好也说不上坏",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-说不上",
    },
    {
        content: "先收藏了，以后再看",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-收藏",
    },
    {
        content: "看个热闹",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-看热闹",
    },
    {
        content: "这标题起得挺吸引人的",
        expectedSentiment: "中性",
        expectedScoreRange: [-10, 30],
        note: "中性-客观",
    },
    {
        content: "数据挺真实的，没注水",
        expectedSentiment: "中性",
        expectedScoreRange: [-10, 30],
        note: "中性-客观",
    },
    {
        content: "了解了，谢谢解答",
        expectedSentiment: "中性",
        expectedScoreRange: [0, 40],
        note: "中性-感谢解答",
    },
    {
        content: "下次更新是什么时候？",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-提问",
    },
    {
        content: "看了一下简介才来的",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-陈述",
    },
    {
        content: "这期和往期风格不太一样",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-客观比较",
    },

    // ========== 边缘/混合案例（10 条）==========
    {
        content: "保护！",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "梗-保护中立偏支持",
    },
    {
        content: "（狗头）别打我",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "梗-狗头保命",
    },
    {
        content: "我这话说出来肯定被喷，但还是想说",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-预判",
    },
    {
        content: "虽然内容一般，但up主态度还是可以的",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "边缘-好坏参半",
    },
    {
        content: "瑕不掩瑜，整体还是值得一看",
        expectedSentiment: "正面",
        expectedScoreRange: [30, 70],
        note: "边缘-瑕不掩瑜",
    },
    {
        content: "可惜了，本来能做得更好",
        expectedSentiment: "负面",
        expectedScoreRange: [-50, -10],
        note: "边缘-可惜",
    },
    {
        content: "又爱又恨，真是拿up主没办法",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "边缘-爱恨交织",
    },
    {
        content: "建议不错，但是别用这种语气",
        expectedSentiment: "负面",
        expectedScoreRange: [-40, 0],
        note: "边缘-建议不满",
    },
    {
        content: "一半是干货一半是广告，凑合吧",
        expectedSentiment: "中性",
        expectedScoreRange: [-30, 10],
        note: "边缘-干货广告",
    },
    {
        content: "说了句公道话，别喷我",
        expectedSentiment: "中性",
        expectedScoreRange: [-20, 20],
        note: "中性-公道话",
    },
];

// ===== 语境细分定义 =====
export interface ContextGroup {
    name: string;
    regex: RegExp;
}

/** 语境分组（说明前缀匹配） */
export const contextGroupList: ContextGroup[] = [
    { name: "反讽/阴阳", regex: /^反讽-/ },
    { name: "网络梗", regex: /^梗-/ },
    { name: "缩写/谐音", regex: /^缩写-|^谐音-/ },
    { name: "直白表达", regex: /^直白-/ },
    { name: "中性陈述", regex: /^中性-/ },
    { name: "边缘案例", regex: /^边缘-/ },
];

/** 按语境分组样本 */
export function groupByContext(samples: AnnotationSample[]): Map<string, AnnotationSample[]> {
    const groups = new Map<string, AnnotationSample[]>();
    for (const group of contextGroupList) {
        groups.set(
            group.name,
            samples.filter((s) => group.regex.test(s.note)),
        );
    }
    return groups;
}

// ===== 期望话题标注（舆论分析维度）=====
// 为代表性样本标注"该评论讨论的核心话题"——评测 LLM 关键词提取能否命中。
// 话题评测样本子集：情感全量 219 条 + 话题约 60 条。

export interface TopicAnnotationItem {
    content: string;
    expectedTopics: string[]; // 人工标注的核心话题词（LLM 提取命中任一项即算中）
}

/** 代表性样本的期望话题标注（覆盖各语境） */
export const expectedTopicAnnotations: TopicAnnotationItem[] = [
    // 正面-直白
    { content: "太好了，up主每次都能准时更新，质量也越来越高！", expectedTopics: ["更新", "质量"] },
    { content: "感谢分享，学到了学到了", expectedTopics: ["学到了"] },
    { content: "这期内容太实用了，收藏了慢慢看", expectedTopics: ["实用"] },
    { content: "up主讲得好细致，我一个外行都听懂了", expectedTopics: ["讲解"] },
    { content: "太喜欢这个系列了，每期都追", expectedTopics: ["系列"] },
    { content: "这个科普做得真好，深入浅出", expectedTopics: ["科普"] },
    { content: "up主三观正，说得太对了", expectedTopics: ["三观"] },
    { content: "画面太美了，每一帧都是壁纸", expectedTopics: ["画面"] },
    { content: "bgm配得刚刚好，氛围感拉满", expectedTopics: ["bgm", "配乐"] },
    { content: "这个实验做得真严谨，佩服", expectedTopics: ["实验"] },
    { content: "干货满满，已经转发给朋友了", expectedTopics: ["干货"] },
    // 正面-梗/缩写
    { content: "yyds！永远的yyds！", expectedTopics: ["yyds", "夸赞"] },
    { content: "蚌埠住了，笑死哈哈哈哈", expectedTopics: ["好笑"] },
    { content: "awsl，这也太可爱了", expectedTopics: ["可爱"] },
    { content: "泪目了，这个结局太感人了", expectedTopics: ["感人", "结局"] },
    { content: "tql，这水平我练十年都追不上", expectedTopics: ["技术"] },
    // 负面-直白
    { content: "广告太多了，取关取关", expectedTopics: ["广告"] },
    { content: "审核呢？这都能过审？", expectedTopics: ["审核"] },
    { content: "up主这是在洗白吧，无语了", expectedTopics: ["洗白"] },
    { content: "这视频质量太差了，浪费时间", expectedTopics: ["质量差"] },
    { content: "标题党！内容完全不是说的那样", expectedTopics: ["标题党"] },
    { content: "又在恰饭，广告植入也太硬了", expectedTopics: ["恰饭", "广告"] },
    { content: "抄袭的还理直气壮？恶心", expectedTopics: ["抄袭"] },
    { content: "内容全是搬运的，一点原创都没有", expectedTopics: ["搬运"] },
    { content: "理论全是错的，误人子弟", expectedTopics: ["错误"] },
    { content: "这就是割韭菜吧，吃相难看", expectedTopics: ["割韭菜"] },
    { content: "删评论算什么本事？心虚了？", expectedTopics: ["删评论"] },
    { content: "评论区全是水军，没眼看", expectedTopics: ["水军"] },
    { content: "这就离谱了，数据造假实锤", expectedTopics: ["造假"] },
    // 负面-反讽
    { content: "真有你的，这种操作都能做出来", expectedTopics: ["反讽", "操作"] },
    { content: "典中典，又开始洗了是吧", expectedTopics: ["洗白", "经典"] },
    { content: "哇，你好懂哦，全世界你最懂", expectedTopics: ["装懂"] },
    { content: "我可真是个大聪明", expectedTopics: ["嘲讽"] },
    { content: "厉害了我的哥，这都能洗", expectedTopics: ["洗白"] },
    { content: "瞧瞧这说的是人话吗？", expectedTopics: ["言行"] },
    { content: "真有意思，自己打自己脸", expectedTopics: ["自相矛盾"] },
    { content: "哈哈，好一个双标", expectedTopics: ["双标"] },
    { content: "妙啊，妙不可言", expectedTopics: ["嘲讽"] },
    { content: "这波呀，这波是自取其辱", expectedTopics: ["自取其辱"] },
    // 负面-梗/缩写
    { content: "差不多得了，天天水视频", expectedTopics: ["水视频"] },
    { content: "典！太典了，熟悉的套路", expectedTopics: ["套路"] },
    { content: "无语子，这都能吹", expectedTopics: ["吹捧"] },
    { content: "麻了，被这期内容无语到", expectedTopics: ["内容"] },
    { content: "真下头，好感全无", expectedTopics: ["下头", "失望"] },
    { content: "yysy，这期真的不行", expectedTopics: ["质量差"] },
    { content: "xswl，就这还吹天花板", expectedTopics: ["吹捧"] },
    // 中性
    { content: "评论区真热闹，都是来吃瓜的", expectedTopics: ["吃瓜", "评论"] },
    { content: "有没有人知道背景音乐是什么", expectedTopics: ["背景音乐", "bgm"] },
    { content: "视频最后那个彩蛋是什么意思？", expectedTopics: ["彩蛋"] },
    { content: "蹲一个后续", expectedTopics: ["后续"] },
    { content: "视频里提到的书是什么？", expectedTopics: ["书"] },
    { content: "这个up主是做什么内容的？", expectedTopics: ["up主"] },
    { content: "坐等评论区大佬分析", expectedTopics: ["分析"] },
    // 边缘
    { content: "保护！", expectedTopics: ["保护"] },
    { content: "瑕不掩瑜，整体还是值得一看", expectedTopics: ["优缺点"] },
    { content: "可惜了，本来能做得更好", expectedTopics: ["遗憾"] },
    { content: "一半是干货一半是广告，凑合吧", expectedTopics: ["干货", "广告"] },
];

/** 合并话题标注后的完整标注集（有期望话题的样本会带上该字段） */
export function mergeTopicAnnotations(): AnnotationSample[] {
    const topicMap = new Map(expectedTopicAnnotations.map((t) => [t.content, t.expectedTopics]));
    return biliAnnotationSet.map((s) => {
        const topics = topicMap.get(s.content);
        return topics ? { ...s, expectedTopics: topics } : s;
    });
}
