(function () {
  "use strict";

  const STORAGE_KEY = "hexin-interface-language:v1";
  const supported = ["zh", "en", "ko", "ja"];
  const languageTags = { zh: "zh-CN", en: "en", ko: "ko", ja: "ja" };

  const messages = {
    zh: {
      "edit.menu": "课程菜单",
      "edit.addLesson": "新增课程",
      "edit.newLesson": "第{number}课",
      "edit.manualSource": "手动创建",
      "edit.addLessonFailed": "无法创建课程",
      "lessons.localCourse": "本地课程",
      "lessons.manualCourseHint": "手动创建 · 可从下方添加单词、语法和文章",
      "language.label": "界面语言",
      "nav.home": "首页",
      "nav.lessons": "课程",
      "nav.search": "搜索",
      "nav.favorites": "收藏",
      "nav.flashcards": "单词卡",
      "speech.settings": "朗读设置",
      "speech.ready": "点击英文即可朗读",
      "speech.voice": "英语声音",
      "speech.reload": "刷新",
      "speech.accent": "发音",
      "speech.us": "美式",
      "speech.uk": "英式",
      "speech.speed": "语速",
      "speech.stop": "停止朗读",
      "speech.voiceCount": "英语声音 · {count} 个", "speech.defaultVoice": "系统默认英语声音（{accent}）", "speech.defaultMark": "默认", "speech.unsupportedSystem": "当前浏览器不支持系统朗读", "speech.accentAU": "澳式", "speech.accentEnglish": "英语", "theme.day": "白天", "theme.night": "夜间", "theme.toDay": "切换到白天模式", "theme.toNight": "切换到夜间模式",
      "home.continue": "继续学习",
      "home.cards": "开始单词卡",
      "home.overview": "学习概览",
      "home.autoUpdate": "数据会在你学习时自动更新",
      "home.recent": "最近学习",
      "home.allLessons": "查看全部课程",
      "stats.courses": "课程总数", "stats.words": "单词与短语", "stats.mastered": "已掌握", "stats.favorites": "收藏数量",
      "recent.emptyTitle": "还没有学习记录", "recent.emptyText": "展开一课或点击英文后，这里会显示最近学习内容。", "recent.continue": "继续",
      "lessons.title": "课程学习",
      "lessons.description": "展开一课开始学习，也可以把自己的 PDF、Word 或图片整理成新课程。",
      "lessons.hideChinese": "隐藏中文释义",
      "lessons.hideChineseHint": "自测时只看英文和音标",
      "lessons.expand": "全部展开",
      "lessons.collapse": "全部收起",
      "lessons.words": "单词与短语",
      "lessons.grammar": "语法与例句",
      "lessons.reading": "文章与句子",
      "lessons.clickRead": "点击卡片朗读",
      "lessons.clickWord": "点击单词查音标，或朗读整句",
      "lessons.open": "展开学习",
      "lessons.close": "收起课程",
      "lessons.wordCount": "{words} 个词条 · {sentences} 条学习句子",
      "lessons.localImport": "本地导入",
      "lessons.source": "来源：{source} · 原文件未保存",
      "lessons.empty": "暂无内容",
      "import.title": "从文件生成课程", "import.description": "在浏览器中提取文字并自动整理词表与中英句子，保存前可以逐行修改。", "import.local": "仅保存在本机", "import.choose": "选择文件，或拖到这里",
      "export.title": "导出课程与学习记录",
      "export.hint": "可导出全部课程或单独一课，包含当前掌握、复习和收藏状态。",
      "export.scope": "导出范围",
      "export.all": "全部课程",
      "export.pdf": "导出 PDF",
      "export.word": "导出 Word",
      "export.working": "正在生成文件…",
      "export.done": "文件已开始下载。",
      "export.failed": "导出失败：{message}",
      "edit.manage": "课程管理",
      "edit.rename": "修改课名",
      "edit.deleteLesson": "删除课时",
      "edit.addWord": "添加词条",
      "edit.addGrammar": "添加语法",
      "edit.addExample": "添加例句",
      "edit.addSentence": "添加文章或句子",
      "edit.delete": "删除",
      "edit.confirm": "再点一次确认",
      "edit.saved": "修改已保存",
      "edit.dialog.rename": "修改课程名称",
      "edit.dialog.word": "添加单词或短语",
      "edit.dialog.note": "添加语法笔记",
      "edit.dialog.example": "添加语法例句",
      "edit.dialog.sentence": "添加文章或句子",
      "edit.field.title": "标题",
      "edit.field.english": "英文",
      "edit.field.ipa": "音标",
      "edit.field.chinese": "中文",
      "edit.field.description": "说明",
      "edit.field.structures": "语法结构（每行一条）",
      "edit.cancel": "取消",
      "edit.save": "保存",
      "search.title": "单词搜索",
      "search.description": "课程词汇支持中英文搜索；课程外的英文单词会继续查询在线词典。",
      "search.label": "搜索全部课程内容，或查询任意英文单词",
      "search.placeholder": "例如：junction、serendipity、郊区",
      "search.clear": "清空",
      "favorites.title": "我的收藏",
      "favorites.description": "集中查看收藏的单词与短语，点击卡片可以直接朗读。",
      "favorites.browse": "浏览课程",
      "favorites.review": "复习收藏",
      "favorites.count": "已收藏 {count} 个单词与短语", "favorites.none": "还没有收藏词条", "favorites.emptyTitle": "收藏夹还是空的", "favorites.emptyText": "进入课程，点击单词卡右上角的星星即可收藏。", "favorites.add": "收藏", "favorites.remove": "取消收藏", "favorites.saved": "已收藏",
      "cards.title": "单词卡",
      "cards.description": "先回忆中文，再点击卡片翻面。使用状态按钮整理复习节奏。",
      "cards.scope": "卡片范围",
      "cards.shuffle": "打乱顺序",
      "cards.previous": "上一张",
      "cards.speak": "朗读单词",
      "cards.next": "下一张",
      "cards.mastered": "已掌握",
      "cards.review": "待复习",
      "cards.favorite": "收藏",
      "cards.none": "暂无卡片", "cards.noContent": "暂无内容",
      "images.change": "图片不合适？换一张", "images.searching": "正在匹配更准确的图片…", "images.none": "这个词暂时没有足够准确的图片", "images.unavailable": "图片服务暂不可用", "images.failed": "图片加载失败，可以换一张重试", "images.offline": "暂时无法加载图片", "images.changing": "正在切换图片…", "images.changed": "已切换，并记住这张图片",
      "profile.edit": "编辑个人资料", "profile.title": "编辑个人资料", "profile.avatar": "头像", "profile.chooseAvatar": "选择图片", "profile.resetAvatar": "恢复默认", "profile.avatarHint": "支持 JPG、PNG、WebP，图片只保存在当前浏览器。", "profile.name": "网名", "profile.errorName": "请输入 1 到 30 个字符的网名。", "profile.errorImage": "请选择有效的图片文件。", "profile.errorSize": "图片过大，请选择更小的图片。", "profile.errorSave": "浏览器存储空间不足，无法保存这张头像。",
      "common.allLessons": "全部课程",
      "common.myFavorites": "我的收藏"
    },
    en: {
      "edit.menu": "Lesson menu",
      "edit.addLesson": "Add lesson",
      "edit.newLesson": "Lesson {number}",
      "edit.manualSource": "Created manually",
      "edit.addLessonFailed": "Could not create the lesson",
      "lessons.localCourse": "Local lesson",
      "lessons.manualCourseHint": "Created manually · Add words, grammar, and articles below",
      "language.label": "Interface language", "nav.home": "Home", "nav.lessons": "Lessons", "nav.search": "Search", "nav.favorites": "Favorites", "nav.flashcards": "Flashcards",
      "speech.settings": "Reading settings", "speech.ready": "Click English text to hear it", "speech.voice": "English voice", "speech.reload": "Refresh", "speech.accent": "Accent", "speech.us": "US", "speech.uk": "UK", "speech.speed": "Speed", "speech.stop": "Stop", "speech.voiceCount": "English voices · {count}", "speech.defaultVoice": "System default English voice ({accent})", "speech.defaultMark": "default", "speech.unsupportedSystem": "Speech is not supported in this browser", "speech.accentAU": "Australian", "speech.accentEnglish": "English", "theme.day": "Light", "theme.night": "Dark", "theme.toDay": "Switch to light mode", "theme.toNight": "Switch to dark mode",
      "home.continue": "Continue learning", "home.cards": "Start flashcards", "home.overview": "Learning overview", "home.autoUpdate": "Your stats update as you study", "home.recent": "Recent lessons", "home.allLessons": "View all lessons", "stats.courses": "Lessons", "stats.words": "Words & phrases", "stats.mastered": "Mastered", "stats.favorites": "Favorites", "recent.emptyTitle": "No study history yet", "recent.emptyText": "Open a lesson or click English text to see it here.", "recent.continue": "Continue",
      "lessons.title": "Lessons", "lessons.description": "Open a lesson to study, or turn your own PDF, Word document, or image into a new lesson.", "lessons.hideChinese": "Hide Chinese translations", "lessons.hideChineseHint": "Show only English and phonetics for self-testing", "lessons.expand": "Expand all", "lessons.collapse": "Collapse all", "lessons.words": "Words & phrases", "lessons.grammar": "Grammar & examples", "lessons.reading": "Articles & sentences", "lessons.clickRead": "Click a card to hear it", "lessons.clickWord": "Click a word for phonetics, or read the whole sentence", "lessons.open": "Open lesson", "lessons.close": "Close lesson", "lessons.wordCount": "{words} entries · {sentences} study sentences", "lessons.localImport": "Local import", "lessons.source": "Source: {source} · Original file not saved", "lessons.empty": "No content yet", "import.title": "Create a lesson from a file", "import.description": "Extract text and organize vocabulary and bilingual sentences in your browser, then review before saving.", "import.local": "Saved on this device", "import.choose": "Choose a file or drop it here",
      "export.title": "Export lessons and progress", "export.hint": "Export every lesson or one lesson with your mastery, review, and favorite status.", "export.scope": "Export scope", "export.all": "All lessons", "export.pdf": "Export PDF", "export.word": "Export Word", "export.working": "Generating file…", "export.done": "Your download has started.", "export.failed": "Export failed: {message}",
      "edit.manage": "Lesson controls", "edit.rename": "Rename lesson", "edit.deleteLesson": "Delete lesson", "edit.addWord": "Add entry", "edit.addGrammar": "Add grammar", "edit.addExample": "Add example", "edit.addSentence": "Add article or sentence", "edit.delete": "Delete", "edit.confirm": "Click again to confirm", "edit.saved": "Changes saved", "edit.dialog.rename": "Rename lesson", "edit.dialog.word": "Add a word or phrase", "edit.dialog.note": "Add a grammar note", "edit.dialog.example": "Add a grammar example", "edit.dialog.sentence": "Add an article or sentence", "edit.field.title": "Title", "edit.field.english": "English", "edit.field.ipa": "Phonetics", "edit.field.chinese": "Chinese", "edit.field.description": "Description", "edit.field.structures": "Grammar structures (one per line)", "edit.cancel": "Cancel", "edit.save": "Save",
      "search.title": "Word search", "search.description": "Search course vocabulary in English or Chinese, and look up unfamiliar English words online.", "search.label": "Search all course content or look up any English word", "search.placeholder": "For example: junction, serendipity, 郊区", "search.clear": "Clear",
      "favorites.title": "My favorites", "favorites.description": "Keep saved words and phrases together. Click a card to hear it.", "favorites.browse": "Browse lessons", "favorites.review": "Review favorites", "favorites.count": "{count} saved words and phrases", "favorites.none": "No saved entries yet", "favorites.emptyTitle": "Your favorites are empty", "favorites.emptyText": "Open a lesson and click the star on a word card to save it.", "favorites.add": "Favorite", "favorites.remove": "Remove favorite", "favorites.saved": "Saved",
      "profile.edit": "Edit profile", "profile.title": "Edit profile", "profile.avatar": "Avatar", "profile.chooseAvatar": "Choose image", "profile.resetAvatar": "Use default", "profile.avatarHint": "Supports JPG, PNG, and WebP. The image stays in this browser.", "profile.name": "Display name", "profile.errorName": "Enter a display name from 1 to 30 characters.", "profile.errorImage": "Choose a valid image file.", "profile.errorSize": "That image is too large. Choose a smaller one.", "profile.errorSave": "There is not enough browser storage to save this avatar.",
      "cards.title": "Flashcards", "cards.description": "Recall the meaning, then click to flip. Use the status buttons to plan reviews.", "cards.scope": "Card set", "cards.shuffle": "Shuffle", "cards.previous": "Previous", "cards.speak": "Read word", "cards.next": "Next", "cards.mastered": "Mastered", "cards.review": "Review", "cards.favorite": "Favorite", "cards.none": "No cards", "cards.noContent": "No content", "images.change": "Wrong image? Show another", "images.searching": "Finding a more accurate image…", "images.none": "No image is accurate enough for this word", "images.unavailable": "Image service is unavailable", "images.failed": "Image failed to load; try another", "images.offline": "Images cannot be loaded right now", "images.changing": "Changing image…", "images.changed": "Changed and saved for this word", "common.allLessons": "All lessons", "common.myFavorites": "My favorites"
    },
    ko: {
      "edit.menu": "수업 메뉴",
      "edit.addLesson": "수업 추가",
      "edit.newLesson": "제 {number}과",
      "edit.manualSource": "직접 생성",
      "edit.addLessonFailed": "수업을 만들 수 없습니다",
      "lessons.localCourse": "로컬 수업",
      "lessons.manualCourseHint": "직접 생성 · 아래에서 단어, 문법, 글을 추가하세요",
      "language.label": "인터페이스 언어", "nav.home": "홈", "nav.lessons": "수업", "nav.search": "검색", "nav.favorites": "즐겨찾기", "nav.flashcards": "단어 카드",
      "speech.settings": "읽기 설정", "speech.ready": "영어를 클릭하면 발음을 들을 수 있어요", "speech.voice": "영어 음성", "speech.reload": "새로고침", "speech.accent": "발음", "speech.us": "미국식", "speech.uk": "영국식", "speech.speed": "속도", "speech.stop": "읽기 중지", "speech.voiceCount": "영어 음성 · {count}개", "speech.defaultVoice": "시스템 기본 영어 음성 ({accent})", "speech.defaultMark": "기본", "speech.unsupportedSystem": "이 브라우저는 음성 읽기를 지원하지 않습니다", "speech.accentAU": "호주식", "speech.accentEnglish": "영어", "theme.day": "라이트", "theme.night": "다크", "theme.toDay": "라이트 모드로 전환", "theme.toNight": "다크 모드로 전환",
      "home.continue": "계속 학습", "home.cards": "단어 카드 시작", "home.overview": "학습 개요", "home.autoUpdate": "학습하면 통계가 자동으로 갱신됩니다", "home.recent": "최근 학습", "home.allLessons": "전체 수업 보기", "stats.courses": "수업 수", "stats.words": "단어와 구", "stats.mastered": "학습 완료", "stats.favorites": "즐겨찾기", "recent.emptyTitle": "학습 기록이 없습니다", "recent.emptyText": "수업을 펼치거나 영어를 클릭하면 여기에 표시됩니다.", "recent.continue": "계속",
      "lessons.title": "수업 학습", "lessons.description": "수업을 펼쳐 학습하거나 PDF, Word, 이미지를 새 수업으로 만들 수 있습니다.", "lessons.hideChinese": "중국어 뜻 숨기기", "lessons.hideChineseHint": "자가 테스트에서는 영어와 발음기호만 표시", "lessons.expand": "모두 펼치기", "lessons.collapse": "모두 접기", "lessons.words": "단어와 구", "lessons.grammar": "문법과 예문", "lessons.reading": "글과 문장", "lessons.clickRead": "카드를 클릭해 듣기", "lessons.clickWord": "단어를 눌러 발음기호를 보거나 문장 전체 듣기", "lessons.open": "수업 펼치기", "lessons.close": "수업 접기", "lessons.wordCount": "단어 {words}개 · 학습 문장 {sentences}개", "lessons.localImport": "로컬 가져오기", "lessons.source": "출처: {source} · 원본 파일은 저장되지 않음", "lessons.empty": "아직 내용이 없습니다", "import.title": "파일에서 수업 만들기", "import.description": "브라우저에서 텍스트와 이중 언어 문장을 정리하고 저장 전에 검토할 수 있습니다.", "import.local": "이 기기에 저장", "import.choose": "파일을 선택하거나 여기에 놓기",
      "export.title": "수업 및 학습 기록 내보내기", "export.hint": "전체 또는 한 수업을 학습 상태와 함께 내보냅니다.", "export.scope": "내보낼 범위", "export.all": "전체 수업", "export.pdf": "PDF 내보내기", "export.word": "Word 내보내기", "export.working": "파일 생성 중…", "export.done": "다운로드가 시작되었습니다.", "export.failed": "내보내기 실패: {message}",
      "edit.manage": "수업 관리", "edit.rename": "수업명 변경", "edit.deleteLesson": "수업 삭제", "edit.addWord": "단어 추가", "edit.addGrammar": "문법 추가", "edit.addExample": "예문 추가", "edit.addSentence": "글 또는 문장 추가", "edit.delete": "삭제", "edit.confirm": "다시 눌러 확인", "edit.saved": "저장되었습니다", "edit.dialog.rename": "수업명 변경", "edit.dialog.word": "단어 또는 구 추가", "edit.dialog.note": "문법 노트 추가", "edit.dialog.example": "문법 예문 추가", "edit.dialog.sentence": "글 또는 문장 추가", "edit.field.title": "제목", "edit.field.english": "영어", "edit.field.ipa": "발음기호", "edit.field.chinese": "중국어", "edit.field.description": "설명", "edit.field.structures": "문법 구조(한 줄에 하나)", "edit.cancel": "취소", "edit.save": "저장",
      "search.title": "단어 검색", "search.description": "수업 단어는 영어·중국어로 검색하고, 모르는 영어 단어는 온라인으로 찾을 수 있습니다.", "search.label": "전체 수업 내용 또는 모든 영어 단어 검색", "search.placeholder": "예: junction, serendipity, 郊区", "search.clear": "지우기",
      "favorites.title": "내 즐겨찾기", "favorites.description": "저장한 단어와 구를 모아 보고 카드를 눌러 발음을 들으세요.", "favorites.browse": "수업 보기", "favorites.review": "즐겨찾기 복습", "favorites.count": "저장한 단어와 구 {count}개", "favorites.none": "저장한 단어가 없습니다", "favorites.emptyTitle": "즐겨찾기가 비어 있습니다", "favorites.emptyText": "수업에서 단어 카드의 별을 눌러 저장하세요.", "favorites.add": "즐겨찾기", "favorites.remove": "즐겨찾기 해제", "favorites.saved": "저장됨",
      "profile.edit": "프로필 편집", "profile.title": "프로필 편집", "profile.avatar": "프로필 사진", "profile.chooseAvatar": "이미지 선택", "profile.resetAvatar": "기본값 복원", "profile.avatarHint": "JPG, PNG, WebP를 지원하며 현재 브라우저에만 저장됩니다.", "profile.name": "닉네임", "profile.errorName": "1~30자의 닉네임을 입력하세요.", "profile.errorImage": "올바른 이미지 파일을 선택하세요.", "profile.errorSize": "이미지가 너무 큽니다. 더 작은 이미지를 선택하세요.", "profile.errorSave": "브라우저 저장 공간이 부족해 저장할 수 없습니다.",
      "cards.title": "단어 카드", "cards.description": "뜻을 떠올린 뒤 카드를 눌러 뒤집으세요. 상태 버튼으로 복습을 관리할 수 있습니다.", "cards.scope": "카드 범위", "cards.shuffle": "순서 섞기", "cards.previous": "이전", "cards.speak": "단어 읽기", "cards.next": "다음", "cards.mastered": "학습 완료", "cards.review": "복습 필요", "cards.favorite": "즐겨찾기", "cards.none": "카드 없음", "cards.noContent": "내용 없음", "images.change": "이미지가 다르나요? 다른 이미지", "images.searching": "더 정확한 이미지를 찾는 중…", "images.none": "이 단어와 충분히 맞는 이미지가 없습니다", "images.unavailable": "이미지 서비스를 사용할 수 없습니다", "images.failed": "이미지 로드 실패, 다른 이미지를 시도하세요", "images.offline": "지금 이미지를 불러올 수 없습니다", "images.changing": "이미지 변경 중…", "images.changed": "변경한 이미지를 이 단어에 저장했습니다", "common.allLessons": "전체 수업", "common.myFavorites": "내 즐겨찾기"
    },
    ja: {
      "edit.menu": "レッスンメニュー",
      "edit.addLesson": "レッスンを追加",
      "edit.newLesson": "レッスン {number}",
      "edit.manualSource": "手動作成",
      "edit.addLessonFailed": "レッスンを作成できません",
      "lessons.localCourse": "ローカルレッスン",
      "lessons.manualCourseHint": "手動作成 · 下から単語・文法・文章を追加できます",
      "language.label": "表示言語", "nav.home": "ホーム", "nav.lessons": "レッスン", "nav.search": "検索", "nav.favorites": "お気に入り", "nav.flashcards": "単語カード",
      "speech.settings": "読み上げ設定", "speech.ready": "英語をクリックすると読み上げます", "speech.voice": "英語音声", "speech.reload": "更新", "speech.accent": "発音", "speech.us": "米国式", "speech.uk": "英国式", "speech.speed": "速度", "speech.stop": "停止", "speech.voiceCount": "英語音声 · {count}件", "speech.defaultVoice": "システム標準の英語音声（{accent}）", "speech.defaultMark": "標準", "speech.unsupportedSystem": "このブラウザは読み上げに対応していません", "speech.accentAU": "豪州式", "speech.accentEnglish": "英語", "theme.day": "ライト", "theme.night": "ダーク", "theme.toDay": "ライトモードに切替", "theme.toNight": "ダークモードに切替",
      "home.continue": "学習を続ける", "home.cards": "単語カードを始める", "home.overview": "学習概要", "home.autoUpdate": "学習するとデータが自動更新されます", "home.recent": "最近の学習", "home.allLessons": "全レッスンを見る", "stats.courses": "レッスン数", "stats.words": "単語とフレーズ", "stats.mastered": "習得済み", "stats.favorites": "お気に入り", "recent.emptyTitle": "学習履歴はまだありません", "recent.emptyText": "レッスンを開くか英語をクリックすると、ここに表示されます。", "recent.continue": "続ける",
      "lessons.title": "レッスン学習", "lessons.description": "レッスンを開いて学習したり、PDF・Word・画像から新しいレッスンを作成できます。", "lessons.hideChinese": "中国語訳を隠す", "lessons.hideChineseHint": "セルフテストでは英語と発音記号だけを表示", "lessons.expand": "すべて開く", "lessons.collapse": "すべて閉じる", "lessons.words": "単語とフレーズ", "lessons.grammar": "文法と例文", "lessons.reading": "文章と文", "lessons.clickRead": "カードをクリックして聞く", "lessons.clickWord": "単語を押して発音記号を確認、または文全体を読み上げ", "lessons.open": "レッスンを開く", "lessons.close": "レッスンを閉じる", "lessons.wordCount": "{words}語 · 学習文{sentences}件", "lessons.localImport": "ローカル取込", "lessons.source": "出典：{source} · 元ファイルは保存されません", "lessons.empty": "内容はまだありません", "import.title": "ファイルからレッスンを作成", "import.description": "ブラウザでテキストと中英の文を整理し、保存前に確認できます。", "import.local": "この端末に保存", "import.choose": "ファイルを選択するか、ここにドロップ",
      "export.title": "レッスンと学習記録を書き出す", "export.hint": "全レッスンまたは1件を学習状態と一緒に書き出します。", "export.scope": "書き出す範囲", "export.all": "全レッスン", "export.pdf": "PDFを書き出す", "export.word": "Wordを書き出す", "export.working": "ファイルを作成中…", "export.done": "ダウンロードを開始しました。", "export.failed": "書き出し失敗：{message}",
      "edit.manage": "レッスン管理", "edit.rename": "名前を変更", "edit.deleteLesson": "レッスン削除", "edit.addWord": "単語を追加", "edit.addGrammar": "文法を追加", "edit.addExample": "例文を追加", "edit.addSentence": "文章・文を追加", "edit.delete": "削除", "edit.confirm": "もう一度押して確認", "edit.saved": "保存しました", "edit.dialog.rename": "レッスン名を変更", "edit.dialog.word": "単語・フレーズを追加", "edit.dialog.note": "文法ノートを追加", "edit.dialog.example": "文法例文を追加", "edit.dialog.sentence": "文章・文を追加", "edit.field.title": "タイトル", "edit.field.english": "英語", "edit.field.ipa": "発音記号", "edit.field.chinese": "中国語", "edit.field.description": "説明", "edit.field.structures": "文法構造（1行に1件）", "edit.cancel": "キャンセル", "edit.save": "保存",
      "search.title": "単語検索", "search.description": "教材語彙は英語・中国語で検索し、未知の英単語はオンラインで調べられます。", "search.label": "全レッスンまたは任意の英単語を検索", "search.placeholder": "例：junction、serendipity、郊区", "search.clear": "クリア",
      "favorites.title": "お気に入り", "favorites.description": "保存した単語やフレーズをまとめて、カードをクリックして発音を聞けます。", "favorites.browse": "レッスンを見る", "favorites.review": "お気に入りを復習", "favorites.count": "保存した単語・フレーズ：{count}件", "favorites.none": "保存した単語はありません", "favorites.emptyTitle": "お気に入りは空です", "favorites.emptyText": "レッスンで単語カードの星を押して保存してください。", "favorites.add": "お気に入り", "favorites.remove": "お気に入り解除", "favorites.saved": "保存済み",
      "profile.edit": "プロフィール編集", "profile.title": "プロフィール編集", "profile.avatar": "アイコン", "profile.chooseAvatar": "画像を選択", "profile.resetAvatar": "初期画像に戻す", "profile.avatarHint": "JPG・PNG・WebPに対応し、このブラウザにのみ保存されます。", "profile.name": "表示名", "profile.errorName": "1〜30文字の表示名を入力してください。", "profile.errorImage": "有効な画像ファイルを選択してください。", "profile.errorSize": "画像が大きすぎます。小さい画像を選択してください。", "profile.errorSave": "ブラウザの保存容量が不足しています。",
      "cards.title": "単語カード", "cards.description": "意味を思い出してからカードをクリックして裏返します。状態ボタンで復習を整理できます。", "cards.scope": "カード範囲", "cards.shuffle": "シャッフル", "cards.previous": "前へ", "cards.speak": "単語を読む", "cards.next": "次へ", "cards.mastered": "習得済み", "cards.review": "要復習", "cards.favorite": "お気に入り", "cards.none": "カードなし", "cards.noContent": "内容なし", "images.change": "画像が違う？別の画像", "images.searching": "より正確な画像を検索中…", "images.none": "この単語に十分合う画像がありません", "images.unavailable": "画像サービスを利用できません", "images.failed": "画像の読み込みに失敗。別の画像をお試しください", "images.offline": "現在画像を読み込めません", "images.changing": "画像を切替中…", "images.changed": "変更した画像をこの単語に保存しました", "common.allLessons": "全レッスン", "common.myFavorites": "お気に入り"
    }
  };

  function current() {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return supported.includes(saved) ? saved : "zh";
    } catch (_error) {
      return "zh";
    }
  }

  function t(key, variables) {
    const locale = current();
    const template = messages[locale]?.[key] || messages.zh[key] || key;
    return String(template).replace(/\{(\w+)\}/g, (_match, name) => String(variables?.[name] ?? ""));
  }

  function setLanguage(locale) {
    const next = supported.includes(locale) ? locale : "zh";
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch (_error) { /* no-op */ }
    document.documentElement.lang = languageTags[next];
    return next;
  }

  function apply(root) {
    const scope = root || document;
    document.documentElement.lang = languageTags[current()];
    scope.querySelectorAll("[data-i18n]").forEach((element) => {
      element.textContent = t(element.dataset.i18n);
    });
    scope.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
      element.placeholder = t(element.dataset.i18nPlaceholder);
    });
    scope.querySelectorAll("[data-i18n-aria]").forEach((element) => {
      element.setAttribute("aria-label", t(element.dataset.i18nAria));
    });
  }

  window.SiteI18n = { apply, current, setLanguage, t };
})();
