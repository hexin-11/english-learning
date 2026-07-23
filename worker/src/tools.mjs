const TOOL_NAMES = new Set([
  "get_learning_overview",
  "list_lessons",
  "get_lesson_detail",
  "search_course",
  "lookup_dictionary_word",
  "get_review_material",
  "create_lesson",
  "edit_lesson",
  "delete_lesson",
  "update_word_state",
  "navigate_to_page",
  "export_lesson",
  "create_presentation"
]);

const stringProperty = (description, extra = {}) => ({ type: "STRING", description, ...extra });

export const AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "get_learning_overview",
    description: "读取用户当前课程总数、词汇数、收藏、掌握、待复习和最近学习等概况。制定学习计划前优先调用。",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "list_lessons",
    description: "列出用户当前账号能看到的课程、课号、内容数量和是否可编辑。",
    parameters: { type: "OBJECT", properties: {} }
  },
  {
    name: "get_lesson_detail",
    description: "读取一节课的完整单词、句子和语法笔记，用于总结、出题、复习计划或后续编辑。",
    parameters: {
      type: "OBJECT",
      properties: { lesson: stringProperty("课程 ID、课号或课程标题") },
      required: ["lesson"]
    }
  },
  {
    name: "search_course",
    description: "在用户全部课程的英文、中文、单词和句子中搜索。",
    parameters: {
      type: "OBJECT",
      properties: { query: stringProperty("要搜索的英文或中文关键词") },
      required: ["query"]
    }
  },
  {
    name: "lookup_dictionary_word",
    description: "通过在线英汉词典查询任意英文单词或短语的音标、词性和中文释义。用户询问课程外单词时优先调用，不要凭记忆编造。",
    parameters: {
      type: "OBJECT",
      properties: { word: stringProperty("要查询的完整英文单词或短语") },
      required: ["word"]
    }
  },
  {
    name: "get_review_material",
    description: "读取当前账号真实的拼写错题、待复习单词、未掌握词汇与收藏词汇。制定个性化复习计划、生成测验或分析薄弱点前必须调用，不要凭空猜测用户错题。",
    parameters: {
      type: "OBJECT",
      properties: {
        limit: { type: "NUMBER", description: "最多返回多少个重点项目，默认 20，最大 50" }
      }
    }
  },
  {
    name: "create_lesson",
    description: "创建一节新的私人课程并放到课程列表最前面。必须给出真实可学习的中英文内容，不能只创建空壳。",
    parameters: {
      type: "OBJECT",
      properties: {
        title: stringProperty("课程名称"),
        words: {
          type: "ARRAY",
          description: "课程词汇，建议 5 到 20 个",
          items: {
            type: "OBJECT",
            properties: {
              english: stringProperty("英文单词或短语"),
              ipa: stringProperty("标准音标；不确定时留空"),
              chinese: stringProperty("中文词义，可含词性")
            },
            required: ["english", "chinese"]
          }
        },
        sentences: {
          type: "ARRAY",
          description: "中英双语学习句子，建议 3 到 10 句",
          items: {
            type: "OBJECT",
            properties: {
              english: stringProperty("英文句子"),
              chinese: stringProperty("准确的中文翻译")
            },
            required: ["english", "chinese"]
          }
        }
      },
      required: ["title", "words", "sentences"]
    }
  },
  {
    name: "edit_lesson",
    description: "修改可编辑课程的名称，或向课程添加一个单词或一个中英双语句子。一次调用只执行一个操作。",
    parameters: {
      type: "OBJECT",
      properties: {
        lesson: stringProperty("课程 ID、课号或标题"),
        operation: stringProperty("操作类型", { enum: ["rename", "add_word", "add_sentence"] }),
        title: stringProperty("rename 时的新课程名称"),
        english: stringProperty("add_word 或 add_sentence 时的英文"),
        ipa: stringProperty("add_word 时的音标"),
        chinese: stringProperty("add_word 或 add_sentence 时的中文")
      },
      required: ["lesson", "operation"]
    }
  },
  {
    name: "delete_lesson",
    description: "删除用户可编辑的私人课程。只有用户明确要求删除时才能调用，不允许根据猜测调用。",
    parameters: {
      type: "OBJECT",
      properties: { lesson: stringProperty("要删除的课程 ID、课号或准确标题") },
      required: ["lesson"]
    }
  },
  {
    name: "update_word_state",
    description: "收藏或取消收藏任意英文单词或短语；课程外单词会自动通过在线词典补全音标和中文释义后收藏。也可把课程词或已收藏的词标记为已掌握或待复习。用户说‘收藏某词’时直接调用，不要先要求加入课程。",
    parameters: {
      type: "OBJECT",
      properties: {
        word: stringProperty("完整的英文单词或短语，可以不在课程中"),
        action: stringProperty("目标状态", { enum: ["favorite", "unfavorite", "mastered", "review"] })
      },
      required: ["word", "action"]
    }
  },
  {
    name: "navigate_to_page",
    description: "在英语学习网站中打开指定页面。",
    parameters: {
      type: "OBJECT",
      properties: {
        page: stringProperty("页面", { enum: ["home", "lessons", "search", "favorites", "flashcards", "spelling"] })
      },
      required: ["page"]
    }
  },
  {
    name: "export_lesson",
    description: "把一节课或全部课程导出为 PDF 或 Word 文件并下载到用户设备。lesson 留空表示全部课程。",
    parameters: {
      type: "OBJECT",
      properties: {
        lesson: stringProperty("课程 ID、课号或标题；导出全部课程时留空"),
        format: stringProperty("导出格式", { enum: ["pdf", "word"] })
      },
      required: ["format"]
    }
  },
  {
    name: "create_presentation",
    description: "根据用户主题生成真正的 PowerPoint 文件并下载到用户设备。需要先规划清晰的页结构；每页聚焦一个学习目标，英文内容必须配准确中文解释。",
    parameters: {
      type: "OBJECT",
      properties: {
        title: stringProperty("PPT 主标题"),
        subtitle: stringProperty("封面副标题或学习目标"),
        fileName: stringProperty("下载文件名，不需要写 .pptx 后缀"),
        slides: {
          type: "ARRAY",
          description: "正文页面，建议 4 到 10 页，最多 12 页",
          items: {
            type: "OBJECT",
            properties: {
              title: stringProperty("本页标题"),
              bullets: {
                type: "ARRAY",
                description: "本页要点，建议 3 到 6 条，每条简短清晰",
                items: stringProperty("一条中英双语学习内容、例句或练习")
              }
            },
            required: ["title", "bullets"]
          }
        }
      },
      required: ["title", "slides"]
    }
  }
];

function cleanString(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function cleanObject(value, limit = 12000) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  try {
    const json = JSON.stringify(value);
    if (json.length > limit) return { truncated: true, value: json.slice(0, limit) };
    return JSON.parse(json);
  } catch {
    return {};
  }
}

export function cleanAgentContext(value) {
  return cleanObject(value, 14000);
}

export function cleanToolTrace(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).flatMap((round) => {
    const calls = (Array.isArray(round?.calls) ? round.calls : []).slice(0, 6).flatMap((call) => {
      const name = cleanString(call?.name, 80);
      if (!TOOL_NAMES.has(name)) return [];
      return [{
        id: cleanString(call?.id, 160),
        name,
        args: cleanObject(call?.args, 12000),
        signature: cleanString(call?.signature, 6000)
      }];
    });
    const results = (Array.isArray(round?.results) ? round.results : []).slice(0, calls.length).map((result, index) => ({
      id: cleanString(result?.id, 160) || calls[index]?.id || "",
      name: TOOL_NAMES.has(cleanString(result?.name, 80)) ? cleanString(result.name, 80) : calls[index]?.name || "",
      result: cleanObject(result?.result, 16000)
    })).filter((result) => result.name);
    return calls.length && results.length ? [{ calls, results }] : [];
  });
}

export function agentContextPart(context) {
  const safe = cleanAgentContext(context);
  if (!Object.keys(safe).length) return "";
  return `\n\n这是网站刚刚提供的真实学习环境索引。需要更详细内容时请调用工具，不要猜测：\n${JSON.stringify(safe)}`;
}

export function appendToolTrace(contents, trace) {
  cleanToolTrace(trace).forEach((round) => {
    contents.push({
      role: "model",
      parts: round.calls.map((call) => ({
        ...(call.signature ? { thoughtSignature: call.signature } : {}),
        functionCall: {
          ...(call.id ? { id: call.id } : {}),
          name: call.name,
          args: call.args
        }
      }))
    });
    contents.push({
      role: "user",
      parts: round.results.map((item) => ({
        functionResponse: {
          ...(item.id ? { id: item.id } : {}),
          name: item.name,
          response: { result: item.result }
        }
      }))
    });
  });
  return contents;
}

export function extractToolCalls(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return [];
  return parts.slice(0, 8).flatMap((part) => {
    const call = part?.functionCall;
    const name = cleanString(call?.name, 80);
    if (!TOOL_NAMES.has(name)) return [];
    return [{
      id: cleanString(call?.id, 160),
      name,
      args: cleanObject(call?.args, 12000),
      signature: cleanString(part?.thoughtSignature, 6000)
    }];
  });
}

export function agentToolConfig() {
  return {
    tools: [{ functionDeclarations: AGENT_FUNCTION_DECLARATIONS }],
    toolConfig: { functionCallingConfig: { mode: "AUTO" } }
  };
}
