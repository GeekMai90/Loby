/**
 * [INPUT]: 依赖 静态资产、shared 公共契约
 * [OUTPUT]: 对外提供 WECHAT_THEME_SAMPLE_PROJECT_ID、WECHAT_THEME_SAMPLE_SHEET_ID、WECHAT_THEME_SAMPLE_PROJECT、withWechatThemeSampleArticle
 * [POS]: 发布 feature 的领域模型边界，集中 发布 规则、数据转换与外部契约
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import sampleCoverUrl from "@/assets/wechat-theme-sample-cover.jpg?inline";
import sampleIllustrationUrl from "@/assets/wechat-theme-sample-illustration.svg";
import type { WritingProject } from "@/shared/types";

export const WECHAT_THEME_SAMPLE_PROJECT_ID = "loby-wechat-theme-sample";
export const WECHAT_THEME_SAMPLE_SHEET_ID = "loby-wechat-theme-sample-article";

export const WECHAT_THEME_SAMPLE_PROJECT: WritingProject = {
  id: WECHAT_THEME_SAMPLE_PROJECT_ID,
  title: "示例文章",
  status: "待发布",
  projectGoal: { enabled: false, unit: "words", target: 0 },
  updatedAt: "2026-07-16T08:00:00.000Z",
  sheets: [
    {
      id: WECHAT_THEME_SAMPLE_SHEET_ID,
      title: "把生活重新调回自己的节奏",
      status: "待发布",
      tags: ["生活方式", "自我管理"],
      targetWords: 2200,
      description: "",
      createdAt: "2026-07-16T08:00:00.000Z",
      updatedAt: "2026-07-16T08:00:00.000Z",
      properties: {},
      body: `# 把生活重新调回自己的节奏

![在忙碌的齿轮之间，为自己的时间放下一枚锚](${sampleCoverUrl})

有一段时间，我每天都很忙。

早上睁眼先看消息，通勤路上处理邮件，到了晚上，待办清单依然比早晨更长。一天好像没有真正停下来，可回头看时，又很难说清自己究竟完成了什么。

后来我才意识到，问题不在于事情太多，而在于每一件事都在争夺同一份注意力。**当生活只剩下即时响应，我们就很容易把“没有空闲”误认为“正在前进”。**

## 忙碌并不等于在前进

忙碌有一种很强的迷惑性。回复消息、整理文件、参加会议，都能带来“我正在做事”的即时反馈。真正重要的工作却常常相反：它进展缓慢，需要长时间安静，也不会立刻得到掌声。

> 节奏不是把每一分钟安排得严丝合缝，而是知道什么值得被反复留出时间。

我们当然不可能拒绝所有琐事。但可以先分清两类事情：一类维持生活运转，另一类让生活向前。前者需要被妥善处理，后者则需要被主动保护。

对我来说，这个变化从一个很小的问题开始：如果今天只能认真完成一件事，我希望它是什么？

## 先找回一天里的三个锚点

所谓锚点，不是一张新的时间表，而是一天里几个相对稳定的位置。它们像路标，让我们在被消息和意外打断之后，仍然知道如何回来。

### 早晨：先决定今天不做什么

很多人会在早晨列出长长的待办。我现在更愿意先删掉一些东西，只保留三项：

- 一件必须推进的重要工作；
- 一件维持日常运转的小事；
- 一件照顾身体或关系的事情。

这份清单看起来并不雄心勃勃，却更接近真实的一天。==选择越少，注意力越容易真正落下去。==

![安静的书桌、窗户与一张简短的计划表](${sampleIllustrationUrl})

### 白天：给重要工作一段完整时间

注意力并不是随叫随到的工具。每次从写作切到消息，再从消息切回文档，我们都要重新找回上下文。因此，我会给最重要的事情安排一个 \`90 分钟专注块\`，期间关掉通知，也不临时增加任务。

这 90 分钟未必每天都高效。有时只是读完几页资料，有时写出的内容第二天还要删掉。但它的价值在于：我不再等待“有空的时候”，而是让重要的工作拥有一个确定的位置。

### 晚上：把没有完成的事放回明天

一天结束时，最消耗人的往往不是未完成本身，而是那些事情仍然悬在脑子里。简单记录下一步，就能让大脑停止反复提醒。

我只回答三个问题：

1. 今天真正推进了什么？
2. 哪件事消耗很多，却没有产生相应价值？
3. 明天开始工作时，第一步是什么？

下面是我长期使用的一张小表。它不是考核，只是帮我看见时间去了哪里。

| 时刻 | 要问的问题 | 一个具体行动 |
| --- | --- | --- |
| 早晨 | 今天最重要的是什么？ | 留出一段完整时间 |
| 午后 | 注意力是否偏离？ | 关闭一个干扰源 |
| 晚上 | 哪件事可以结束？ | 写下明天的第一步 |

#### 一个足够小的复盘模板

如果不想使用复杂工具，在任何 Markdown 文档里留下这几行就够了：

\`\`\`text
今天推进：
今天放下：
明天第一步：
\`\`\`

工具越简单，越容易持续。真正重要的不是记录得多完整，而是第二天打开文档时，不必重新决定从哪里开始。

## 给生活留一点没有用途的时间

恢复节奏并不意味着把自己训练成一台稳定运行的机器。相反，我们还需要一部分没有明确产出的时间：散步、发呆、做饭，或者只是在窗边坐一会儿。

这些时刻看似“没做什么”，却在帮助注意力重新变得完整。*不是所有时间都需要证明自己的价值。* 当我们允许生活里存在留白，工作反而不再无限蔓延。

如果你想进一步理解为什么完整注意力如此稀缺，可以从 [Deep Work](https://en.wikipedia.org/wiki/Deep_Work) 这个概念开始。但不必急着建立一套复杂系统，先守住一天中的一个小时，就已经足够。

---

## 最后

我现在仍然会遇到混乱的日子：临时任务突然出现，计划被打断，晚上也会忍不住多看一会儿手机。不同的是，我不再把偶尔失控看成失败。

节奏从来不是一条笔直的线，而是一种回来的能力。

当你知道什么最重要，知道下一步在哪里，也愿意为生活留下少量空白，就不必把每一天都过得完美。**慢一点，但持续地回到自己选择的方向。** 这或许就是一种更可靠的前进。`,
    },
  ],
};

export function withWechatThemeSampleArticle(projects: WritingProject[]): WritingProject[] {
  return [WECHAT_THEME_SAMPLE_PROJECT, ...projects.filter((project) => project.id !== WECHAT_THEME_SAMPLE_PROJECT_ID)];
}
