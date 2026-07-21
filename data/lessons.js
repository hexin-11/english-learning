(function () {
  "use strict";

  window.ENGLISH_LESSONS = [
    {
      id: "lesson-1",
      number: 1,
      title: "第一课",
      wordSectionTitle: "单词与短语",
      readingTitle: "网购文章",
      words: [
        { english: "cookery", ipa: "/ˈkʊkəri/", chinese: "烹饪课" },
        { english: "available", ipa: "/əˈveɪləbl/", chinese: "现有的；可获得的" },
        { english: "focus on", ipa: "/ˈfoʊkəs ɑːn/", chinese: "专注于……（后接名词）" },
        { english: "seasonal", ipa: "/ˈsiːzənəl/", chinese: "季节性的" },
        { english: "products", ipa: "/ˈprɑːdʌkts/", chinese: "产品" },
        { english: "private", ipa: "/ˈpraɪvət/", chinese: "私人的；私密的" },
        { english: "deal", ipa: "/diːl/", chinese: "对待；待遇；交易" },
        { english: "client", ipa: "/ˈklaɪənt/", chinese: "客户" },
        { english: "concentrate on sth.", ipa: "/ˈkɑːnsəntreɪt ɑːn ˈsʌmθɪŋ/", chinese: "集中于某事" },
        { english: "specialist", ipa: "/ˈspeʃəlɪst/", chinese: "专家" },
        { english: "calorie", ipa: "/ˈkæləri/", chinese: "卡路里" },
        { english: "recipe", ipa: "/ˈresəpi/", chinese: "食谱" },
        { english: "ingredient", ipa: "/ɪnˈɡriːdiənt/", chinese: "原料" },
        { english: "reputation", ipa: "/ˌrepjuˈteɪʃən/", chinese: "名誉；名声" },
        { english: "vegetarian", ipa: "/ˌvedʒəˈteriən/", chinese: "素食主义者" },
        { english: "carnivore", ipa: "/ˈkɑːrnɪvɔːr/", chinese: "肉食主义者" },
        { english: "sharpen", ipa: "/ˈʃɑːrpən/", chinese: "使锋利；磨尖" },
        { english: "sharpener", ipa: "/ˈʃɑːrpənər/", chinese: "削笔刀" },
        { english: "chop", ipa: "/tʃɑːp/", chinese: "切碎" },
        { english: "technique", ipa: "/tekˈniːk/", chinese: "技术；技巧" },
        { english: "barbecue", ipa: "/ˈbɑːrbɪkjuː/", chinese: "烧烤" },
        { english: "brunch", ipa: "/brʌntʃ/", chinese: "早午餐" },
        { english: "budget", ipa: "/ˈbʌdʒɪt/", chinese: "预算" },
        { english: "buffet", ipa: "/bəˈfeɪ/", chinese: "自助餐" },
        { english: "cancellation", ipa: "/ˌkænsəˈleɪʃən/", chinese: "取消（名词）" },
        { english: "discount", ipa: "/ˈdɪskaʊnt/", chinese: "打折；优惠" },
        { english: "entertainment", ipa: "/ˌentərˈteɪnmənt/", chinese: "娱乐" },
        { english: "expense", ipa: "/ɪkˈspens/", chinese: "开销" },
        { english: "expensive", ipa: "/ɪkˈspensɪv/", chinese: "贵的" },
        { english: "facility", ipa: "/fəˈsɪləti/", chinese: "设备；设施" }
      ],
      studyNotes: [
        {
          title: "一般现在时",
          description: "表示经常、反复发生或客观性的动作和行为。",
          structures: ["结构：主语 + 动词 + 宾语"],
          examples: [
            { english: "I/You/We go to school everyday.", chinese: "我/你/我们每天去上学。" },
            { english: "Do you go to school everyday?", chinese: "你每天去上学吗？" },
            { english: "He/She goes to school everyday.", chinese: "他/她每天去上学。" },
            { english: "Does he go to school everyday?", chinese: "他每天去上学吗？" }
          ]
        },
        {
          title: "现在进行时",
          description: "表示正在进行的动作。",
          structures: [
            "肯定句：主语 + be 动词（am/is/are）+ doing sth.",
            "否定句：主语 + be 动词（am/is/are + not）+ doing sth."
          ],
          examples: [
            { english: "I am watching TV.", chinese: "我正在看电视。" },
            { english: "Are you watching TV?", chinese: "你正在看电视吗？" },
            { english: "He/She is watching TV.", chinese: "他/她正在看电视。" },
            { english: "Is he/she watching TV?", chinese: "他/她正在看电视吗？" },
            { english: "We/They are watching TV.", chinese: "我们/他们正在看电视。" },
            { english: "Are they watching TV?", chinese: "他们正在看电视吗？" }
          ]
        },
        {
          title: "一般过去时",
          description: "表示发生在过去时间里的动作，动作在过去已经结束。",
          structures: [
            "肯定句：主语 + 动词过去式 + 宾语",
            "疑问句：Did + 主语 + 动词原形 + 宾语",
            "否定句：主语 + didn't + 动词原形 + 宾语"
          ],
          examples: [
            { english: "I went to coffee shop/café yesterday.", chinese: "我昨天去了咖啡店。" },
            { english: "Did you/she/he go to coffee shop yesterday?", chinese: "你/她/他昨天去咖啡店了吗？" },
            { english: "I didn't eat apples.", chinese: "我没有吃苹果。" }
          ]
        }
      ],
      sentences: [
        {
          english: "Nowadays, many people buy things on phone/online instead of going to shops. I think this change has both good sides and bad sides for ordinary people's daily life.",
          chinese: "现在很多人用手机或在网上买东西，而不是去实体店。我认为这个改变对普通人的日常生活既有好的方面，也有坏的方面。"
        },
        {
          english: "There are many advantages of buying goods on the Internet. Firstly, online shopping saves much time. People do not need to go to shopping mall and wait in long queues. They can buy clothes, food and daily things at home whenever they are free.",
          chinese: "在网上购物有许多好处。首先，网购能节省大量时间。人们无需前往购物中心排队等候，可以随时在家购买衣服、食品和日常用品。"
        }
      ]
    },
    {
      id: "lesson-2",
      number: 2,
      title: "第二课",
      wordSectionTitle: "单词、时间介词与重点词汇",
      readingTitle: "网购问题段落",
      words: [
        { english: "leaflet", ipa: "/ˈliːflət/", chinese: "宣传单" },
        { english: "perishable", ipa: "/ˈperɪʃəbl/", chinese: "易腐烂的" },
        { english: "reasonable", ipa: "/ˈriːznəbl/", chinese: "合理的" },
        { english: "resort", ipa: "/rɪˈzɔːrt/", chinese: "娱乐场所；度假胜地" },
        { english: "slicer", ipa: "/ˈslaɪsər/", chinese: "切片机" },
        { english: "slippery", ipa: "/ˈslɪpəri/", chinese: "滑溜的" },
        { english: "supermarket", ipa: "/ˈsuːpərmɑːrkɪt/", chinese: "超市" },
        { english: "well-equipped", ipa: "/ˌwel ɪˈkwɪpt/", chinese: "装备完善的（形容词）" },
        { english: "equipment", ipa: "/ɪˈkwɪpmənt/", chinese: "装备；设备（不可数名词）" },
        { english: "chairman", ipa: "/ˈtʃermən/", chinese: "主席" },
        { english: "committee", ipa: "/kəˈmɪti/", chinese: "委员会" },
        { english: "inform", ipa: "/ɪnˈfɔːrm/", chinese: "通知（动词）" },
        { english: "form", ipa: "/fɔːrm/", chinese: "表格" },
        { english: "regulation", ipa: "/ˌreɡjuˈleɪʃn/", chinese: "规则；制度" },
        { english: "propose", ipa: "/prəˈpoʊz/", chinese: "提议" },
        { english: "summarize", ipa: "/ˈsʌməraɪz/", chinese: "总结（动词）" },
        { english: "noticeable", ipa: "/ˈnoʊtɪsəbl/", chinese: "值得注意的" },
        { english: "in", ipa: "/ɪn/", chinese: "在……里；用于年、月、季节及早中晚" },
        { english: "on", ipa: "/ɑːn/", chinese: "在……；用于星期、具体日期或某一天" },
        { english: "at", ipa: "/æt/", chinese: "在……；用于具体时间点" },
        { english: "for", ipa: "/fɔːr/", chinese: "持续；用于一段时间" },
        { english: "since", ipa: "/sɪns/", chinese: "自从；用于时间点或从句" },
        { english: "however", ipa: "/haʊˈevər/", chinese: "然而" },
        { english: "online shopping", ipa: "/ˈɑːnlaɪn ˈʃɑːpɪŋ/", chinese: "网上购物" },
        { english: "cause", ipa: "/kɔːz/", chinese: "引起；导致" },
        { english: "customer", ipa: "/ˈkʌstəmər/", chinese: "顾客" },
        { english: "item", ipa: "/ˈaɪtəm/", chinese: "商品；物品" },
        { english: "pay for", ipa: "/peɪ fɔːr/", chinese: "为……付款" },
        { english: "product", ipa: "/ˈprɑːdʌkt/", chinese: "产品" },
        { english: "screen", ipa: "/skriːn/", chinese: "屏幕" },
        { english: "quality", ipa: "/ˈkwɑːləti/", chinese: "质量" },
        { english: "return", ipa: "/rɪˈtɜːrn/", chinese: "退还；退货" }
      ],
      studyNotes: [
        {
          title: "一般将来时",
          description: "表示将来会发生的动作或计划。",
          structures: [
            "肯定句：主语 + will + 动词原形 + 其他；或主语 + be going to + 动词原形 + 其他",
            "否定句：主语 + will not（won't）+ 动词原形 + 其他；或主语 + am not/isn't/aren't going to + 动词原形 + 其他",
            "疑问句：Will + 主语 + 动词原形 + 其他？或 Be + 主语 + going to + 动词原形 + 其他？"
          ],
          examples: [
            { english: "I/He/She/We/They will go to Beijing next week.", ipa: "/aɪ hiː ʃiː wiː ðeɪ wɪl ɡoʊ tə ˌbeɪˈdʒɪŋ nekst wiːk/", chinese: "我/他/她/我们/他们下周将去北京。" },
            { english: "I am/She is/He is/They are/We are going to have a meeting tomorrow.", ipa: "/aɪ æm ʃiː ɪz hiː ɪz ðeɪ ɑːr wiː ɑːr ˈɡoʊɪŋ tə hæv ə ˈmiːtɪŋ təˈmɑːroʊ/", chinese: "我/她/他/他们/我们明天将开会。" },
            { english: "I won't go to the park with Billy tomorrow.", ipa: "/aɪ woʊnt ɡoʊ tə ðə pɑːrk wɪð ˈbɪli təˈmɑːroʊ/", chinese: "我明天不会和 Billy 去公园。" },
            { english: "Billy isn't going to visit his friend next Sunday.", ipa: "/ˈbɪli ˈɪznt ˈɡoʊɪŋ tə ˈvɪzɪt hɪz frend nekst ˈsʌndeɪ/", chinese: "Billy 下周日不打算去拜访朋友。" },
            { english: "Will you have lunch with Billy tomorrow?", ipa: "/wɪl juː hæv lʌntʃ wɪð ˈbɪli təˈmɑːroʊ/", chinese: "你明天会和 Billy 一起吃午饭吗？" },
            { english: "Is Billy going to visit his friend next Sunday?", ipa: "/ɪz ˈbɪli ˈɡoʊɪŋ tə ˈvɪzɪt hɪz frend nekst ˈsʌndeɪ/", chinese: "Billy 下周日打算去拜访朋友吗？" }
          ]
        },
        {
          title: "现在完成时",
          description: "表示过去发生的动作对现在有影响，或从过去持续到现在，常译为“已经……”。",
          structures: [
            "肯定句：主语 + have/has + 动词过去分词 + 其他",
            "否定句：主语 + have/has not + 动词过去分词 + 其他",
            "疑问句：Have/Has + 主语 + 动词过去分词 + 其他？",
            "read - read - read：原形 /riːd/；过去式、过去分词 /red/"
          ],
          examples: [
            { english: "I have finished my homework.", ipa: "/aɪ hæv ˈfɪnɪʃt maɪ ˈhoʊmwɜːrk/", chinese: "我已经完成作业了。" },
            { english: "My brother has already finished his homework.", ipa: "/maɪ ˈbrʌðər hæz ɔːlˈredi ˈfɪnɪʃt hɪz ˈhoʊmwɜːrk/", chinese: "我哥哥已经完成他的作业了。" },
            { english: "We have lived here for ten years.", ipa: "/wiː hæv lɪvd hɪr fər ten jɪrz/", chinese: "我们已经在这里住了十年。" },
            { english: "He has been a teacher since 2010.", ipa: "/hiː hæz bɪn ə ˈtiːtʃər sɪns ˌtwenti ten/", chinese: "他从 2010 年起一直是一名教师。" },
            { english: "She has not seen the film.", ipa: "/ʃiː hæz nɑːt siːn ðə fɪlm/", chinese: "她还没有看过这部电影。" },
            { english: "Have you read the book?", ipa: "/hæv juː red ðə bʊk/", chinese: "你读过这本书吗？" }
          ]
        },
        {
          title: "时间介词",
          description: "根据时间单位和表达选择 in、on、at、for 或 since。",
          structures: [],
          examples: [
            { english: "in 2024; in April; in summer; in the morning", chinese: "用于年、月、季节、早上、下午和晚上。" },
            { english: "on Monday; on April 10, 2024; on Christmas Day; on that afternoon", chinese: "用于星期、具体某一天、节日和特定的早中晚。" },
            { english: "at 10:30; at noon; at night; at dawn", chinese: "用于具体时间点、中午、夜里和黎明。" },
            { english: "for ten years", chinese: "for 后接一段时间。" },
            { english: "since 2010; since I came here", chinese: "since 后接时间点或从句。" }
          ]
        }
      ],
      sentences: [
        { english: "However, online shopping also causes some problems.", ipa: "/haʊˈevər ˈɑːnlaɪn ˈʃɑːpɪŋ ˈɔːlsoʊ ˈkɔːzɪz səm ˈprɑːbləmz/", chinese: "然而，网购也会引起一些问题。" },
        { english: "Firstly, customers cannot try items before paying for them.", ipa: "/ˈfɜːrstli ˈkʌstəmərz ˈkænɑːt traɪ ˈaɪtəmz bɪˈfɔːr ˈpeɪɪŋ fər ðem/", chinese: "首先，顾客在付款前无法试用商品。" },
        { english: "Sometimes the products look nice on screens but have bad quality, and returning them takes lots of time.", ipa: "/ˈsʌmtaɪmz ðə ˈprɑːdʌkts lʊk naɪs ɑːn skriːnz bət hæv bæd ˈkwɑːləti ænd rɪˈtɜːrnɪŋ ðem teɪks lɑːts əv taɪm/", chinese: "有时产品在屏幕上看起来很好，但质量很差，而且退货会花费很多时间。" }
      ]
    },
    {
      id: "lesson-3",
      number: 3,
      title: "第三课",
      wordSectionTitle: "单词",
      readingTitle: "购物口语",
      words: [
        { english: "overall", ipa: "/ˌoʊvərˈɔːl/", chinese: "全部的；全体的" },
        { english: "volume", ipa: "/ˈvɑːljuːm/", chinese: "体积；体量" },
        { english: "concern", ipa: "/kənˈsɜːrn/", chinese: "关心；担心" },
        { english: "survey", ipa: "/ˈsɜːrveɪ/", chinese: "调研；问卷" },
        { english: "resident", ipa: "/ˈrezɪdənt/", chinese: "居民；房客" },
        { english: "response", ipa: "/rɪˈspɑːns/", chinese: "回答；回复" },
        { english: "visibility", ipa: "/ˌvɪzəˈbɪləti/", chinese: "能见度" },
        { english: "complaint", ipa: "/kəmˈpleɪnt/", chinese: "抱怨；投诉" },
        { english: "congestion", ipa: "/kənˈdʒestʃən/", chinese: "拥挤；堵塞" },
        { english: "fume", ipa: "/fjuːm/", chinese: "烟雾" },
        { english: "lorry", ipa: "/ˈlɔːri/", chinese: "卡车；货车" },
        { english: "proposal", ipa: "/prəˈpoʊzəl/", chinese: "提议；提案" },
        { english: "budget", ipa: "/ˈbʌdʒɪt/", chinese: "预算" },
        { english: "council", ipa: "/ˈkaʊnsəl/", chinese: "委员会；议会" },
        { english: "representative", ipa: "/ˌreprɪˈzentətɪv/", chinese: "代表（名词）" },
        { english: "slide", ipa: "/slaɪd/", chinese: "幻灯片" }
      ],
      studyNotes: [
        {
          title: "There be 句型",
          description: "表示“有……”，用于非自己的所属物；自己的所有物通常使用 have。",
          structures: [
            "There is + a/an + 单数可数名词 + 地点",
            "There are + 复数可数名词 + 地点",
            "Have + 自己的所有物"
          ],
          examples: [
            { english: "There is a lorry over there.", chinese: "那边有一辆卡车。" },
            { english: "There is an apple on the table.", chinese: "桌子上有一个苹果。" },
            { english: "There are 5 apples on the tree.", chinese: "树上有五个苹果。" }
          ]
        },
        {
          title: "that 定语从句与宾语从句",
          description: "that 可以引导定语从句或宾语从句。",
          structures: [],
          examples: [
            { english: "I have a dog. My dog is very cute.", chinese: "我有一只狗。我的狗很可爱。" },
            { english: "I have a dog that is very cute.", chinese: "我有一只很可爱的狗。" },
            { english: "The bike that my dad gave me is new.", chinese: "爸爸送给我的那辆自行车是新的。" },
            { english: "The girl that you met is my sister.", chinese: "你遇到的那个女孩是我的妹妹。" },
            { english: "The trouble is that we have no money.", chinese: "问题是我们没有钱。" },
            { english: "He said that the concert was amazing.", chinese: "他说那场演唱会非常精彩。" },
            { english: "I think that you are right.", chinese: "我认为你是对的。" },
            { english: "I know that he is honest.", chinese: "我知道他很诚实。" },
            { english: "I hope that it will snow this winter.", chinese: "我希望今年冬天会下雪。" },
            { english: "The problem is that he doesn't have time.", chinese: "问题是他没有时间。" },
            { english: "We all know the fact that he is a doctor.", chinese: "我们都知道他是一名医生这个事实。" }
          ]
        }
      ],
      sentences: [
        { english: "Do you like shopping?", chinese: "你喜欢购物吗？" },
        { english: "Yes, I like shopping very much. I do online shopping almost everyday because it is convenient, inexpensive and often offers discounts.", chinese: "是的，我非常喜欢购物。我几乎每天都网购，因为它方便、便宜，而且经常有折扣。" },
        { english: "Where do you usually shop?", chinese: "你通常在哪里购物？" }
      ]
    },
    {
      id: "lesson-4",
      number: 4,
      title: "第四课",
      wordSectionTitle: "单词",
      readingTitle: "which 从句与文章",
      words: [
        { english: "junction", ipa: "/ˈdʒʌŋkʃən/", chinese: "交叉点；交汇处" },
        { english: "pedestrian", ipa: "/pəˈdestriən/", chinese: "行人的；行人" },
        { english: "forbid", ipa: "/fərˈbɪd/", chinese: "禁止；阻止" },
        { english: "bend", ipa: "/bend/", chinese: "弯道；弯曲" },
        { english: "disabled", ipa: "/dɪsˈeɪbəld/", chinese: "残疾的；行动不便的" },
        { english: "arrangement", ipa: "/əˈreɪndʒmənt/", chinese: "安排；计划" },
        { english: "widen", ipa: "/ˈwaɪdən/", chinese: "使……变宽" },
        { english: "pavement", ipa: "/ˈpeɪvmənt/", chinese: "人行道；便道" },
        { english: "incorporate", ipa: "/ɪnˈkɔːrpəreɪt/", chinese: "合并；结合" },
        { english: "intersection", ipa: "/ˌɪntərˈsekʃən/", chinese: "十字路口；交叉口" },
        { english: "load", ipa: "/loʊd/", chinese: "装货；装载" },
        { english: "unload", ipa: "/ˌʌnˈloʊd/", chinese: "卸货" },
        { english: "convert", ipa: "/kənˈvɜːrt/", chinese: "改建；改造；转换" },
        { english: "cycling", ipa: "/ˈsaɪklɪŋ/", chinese: "骑车；骑行" },
        { english: "district", ipa: "/ˈdɪstrɪkt/", chinese: "区；地区" },
        { english: "drive", ipa: "/draɪv/", chinese: "机动车道；驾驶" },
        { english: "footpath", ipa: "/ˈfʊtpæθ/", chinese: "步行道；小路" },
        { english: "improvement", ipa: "/ɪmˈpruːvmənt/", chinese: "提高；改进" },
        { english: "outskirts", ipa: "/ˈaʊtskɜːrts/", chinese: "郊区；市郊" },
        { english: "redevelopment", ipa: "/ˌriːdɪˈveləpmənt/", chinese: "再开发；重建" }
      ],
      sentences: [
        { english: "He is a writer, which is respectable.", chinese: "他是一名作家，这是一件受人尊敬的事。" },
        { english: "My mom is a teacher, which is most glorious under the sun.", chinese: "我妈妈是一名教师，这是天底下最光荣的职业。" },
        { english: "This is the room which he lived in last year.", chinese: "这就是他去年住过的房间。" },
        { english: "The pictures which I had taken won the first prize.", chinese: "我拍的那些照片获得了一等奖。" },
        { english: "This is the book which I bought yesterday.", chinese: "这就是我昨天买的书。" },
        { english: "This is the drama which I watched yesterday.", chinese: "这就是我昨天看的电视剧。" },
        { english: "What's your favourite food?", chinese: "你最喜欢的食物是什么？" },
        { english: "My favourite food is hamburgers. They have crispy bread, tender meat and fresh vegetables inside.", chinese: "我最喜欢的食物是汉堡。里面有酥脆的面包、嫩肉和新鲜蔬菜。" },
        { english: "I do not eat them too frequently because they are a little high in calories.", chinese: "我不会太频繁地吃，因为它们的热量有点高。" },
        { english: "They taste juicy and are convenient to grab when I am busy.", chinese: "它们吃起来多汁，而且我忙的时候拿起来就能吃，很方便。" },
        { english: "I usually buy one for a quick lunch on workdays.", chinese: "工作日我通常买一个当作快捷午餐。" },
        { english: "My favourite food is beef noodles, which taste really savory and warm.", chinese: "我最喜欢的食物是牛肉面，味道鲜美，而且吃起来很暖和。" },
        { english: "I often have them for lunch because they are filling and easy to get.", chinese: "我经常午餐吃牛肉面，因为它很顶饱，也很容易买到。" },
        { english: "Besides, I am quite fond of the rich soup base of this dish.", chinese: "此外，我很喜欢这道菜浓郁的汤底。" }
      ]
    },
    {
      id: "lesson-5",
      number: 5,
      title: "第五课",
      wordSectionTitle: "单词与短语",
      readingTitle: "文章",
      words: [
        { english: "reorient", ipa: "/ˌriːˈɔːriənt/", chinese: "重新定位；重新调整方向" },
        { english: "residential area", ipa: "/ˌrezɪˈdenʃəl ˈeriə/", chinese: "居民区；住宅区" },
        { english: "shade", ipa: "/ʃeɪd/", chinese: "阴凉处；树荫" },
        { english: "shelter", ipa: "/ˈʃeltər/", chinese: "隐蔽处；庇护所" },
        { english: "suburb", ipa: "/ˈsʌbɜːrb/", chinese: "郊区" },
        { english: "urban", ipa: "/ˈɜːrbən/", chinese: "城市的；市区的" },
        { english: "vehicle", ipa: "/ˈviːəkl/", chinese: "车辆；交通工具" },
        { english: "germination", ipa: "/ˌdʒɜːrmɪˈneɪʃən/", chinese: "发芽" },
        { english: "eventually", ipa: "/ɪˈventʃuəli/", chinese: "最终；终于" },
        { english: "optional", ipa: "/ˈɑːpʃənəl/", chinese: "可选择的" },
        { english: "module", ipa: "/ˈmɑːdʒuːl/", chinese: "模块；单元" },
        { english: "dissertation", ipa: "/ˌdɪsərˈteɪʃən/", chinese: "学位论文" },
        { english: "equipment", ipa: "/ɪˈkwɪpmənt/", chinese: "设备；工具" },
        { english: "laboratory", ipa: "/ˈlæbrətɔːri/", chinese: "实验室" },
        { english: "ambitious", ipa: "/æmˈbɪʃəs/", chinese: "有抱负的；有野心的" },
        { english: "assignment", ipa: "/əˈsaɪnmənt/", chinese: "作业；任务" },
        { english: "plates", ipa: "/pleɪts/", chinese: "盘子（复数）" },
        { english: "a great number of", ipa: "/ə ɡreɪt ˈnʌmbər əv/", chinese: "大量的；许多的" },
        { english: "hardly", ipa: "/ˈhɑːrdli/", chinese: "几乎不；几乎没有" },
        { english: "spare time", ipa: "/sper taɪm/", chinese: "空闲时间" },
        { english: "prepare meals", ipa: "/prɪˈper miːlz/", chinese: "准备饭菜" },
        { english: "have a go at", ipa: "/hæv ə ɡoʊ æt/", chinese: "尝试做……" },
        { english: "dishes", ipa: "/ˈdɪʃɪz/", chinese: "碗碟；菜肴" },
        { english: "quite", ipa: "/kwaɪt/", chinese: "相当；很" },
        { english: "exactly", ipa: "/ɪɡˈzæktli/", chinese: "准确地；正是；完全地" },
        { english: "afterward", ipa: "/ˈæftərwərd/", chinese: "之后；后来" },
        { english: "own", ipa: "/oʊn/", chinese: "自己的" }
      ],
      sentences: [
        { english: "Do you like cooking?", chinese: "你喜欢做饭吗？" },
        { english: "I dislike cooking because cleaning plates after cooking is quite troublesome.", chinese: "我不喜欢做饭，因为做完饭后洗盘子很麻烦。" },
        { english: "I often finish a great number of coding assignments, which means I hardly have spare time to prepare meals.", chinese: "我经常需要完成大量编程作业，这意味着我几乎没有空闲时间准备饭菜。" },
        { english: "However, I would like to have a go at cooking if I am free and another person helps me wash the dishes.", chinese: "不过，如果我有空，而且有人帮我洗碗，我愿意尝试做饭。" },
        { english: "Yes, I really enjoy cooking in my spare time.", chinese: "是的，我很喜欢在空闲时间做饭。" },
        { english: "It relaxes me after long hours of coding work, and I can make food exactly to my own taste.", chinese: "长时间编程后，做饭能让我放松，而且我可以做出完全符合自己口味的食物。" },
        { english: "What makes me happiest is seeing other people enjoy the meals I cook.", chinese: "最让我开心的是看到别人喜欢我做的饭菜。" },
        { english: "I don't even mind washing dishes afterward.", chinese: "我甚至不介意之后洗碗。" }
      ]
    }
  ];
})();
