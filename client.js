/**
 * Client half of the multi-character story bundle.
 *
 * 依赖 dsh-role-play 通过 ctx.provide('roleplayChat', ...) 暴露的共享接口：
 * 读取角色卡、读取当前模型、发起单次补全。
 *
 * 玩法：多个角色在同一个场景里，既会和你说话，也会互相说话。
 * 每轮由模型决定「谁开口、说什么」，按角色分段输出，界面上按角色分色展示。
 */
window.__ModuleLoader__.load({
  id: 'dsh-role-play-story',
  factory(require) {
    const React = require('react')
    const { useState, useEffect, useRef, useCallback } = React
    const h = React.createElement

    const LS_STORIES = 'rpStory.stories.v1'
    const LS_SELECTED = 'rpStory.selected.v1'
    const LS_MODE = 'rpStory.mode.v1'
    const LS_AUTO = 'rpStory.auto.v1'

    const ZH = {
      viewLabel: '多角色故事',
      title: '故事',
      newStory: '新建故事',
      noStories: '还没有故事',
      noStoriesHint: '创建一个故事，选几个角色，让他们同场互动。',
      selectStory: '在左侧选择一个故事，或先新建一个。',
      needMain: '需要先安装并启用「角色扮演聊天」插件',
      needMainHint: '本插件从那个插件读取角色卡。装好后刷新页面即可使用。',
      needCharacters: '还没有角色卡',
      needCharactersHint: '先去「角色扮演聊天」里创建至少两个角色。',
      storyTitle: '故事标题',
      storyScene: '故事背景',
      storySceneHint: '写清时间、地点、你们的关系和处境，角色们会围绕这个背景展开。',
      pickCharacters: '选择出场的角色',
      pickCharactersHint: '至少选两个，才能有角色之间的互动。',
      playAs: '你扮演谁',
      playAsHint: '选一个角色当作故事里的「你」。选中的角色由你来说话，AI 不再替他开口。',
      playAsNone: '玩家旁观（所有人都由 AI 演）',
      playAsMine: '你',
      modeTurn: '轮流',
      modeFree: '自由',
      modeTurnDesc: '每次由模型决定谁开口，一人一段',
      modeFreeDesc: '多人可能同时说话，更热闹',
      autoNext: '自动续演',
      autoNextDesc: '每轮结束后自动让故事往下走，直到你叫停',
      start: '开始',
      save: '保存',
      cancel: '取消',
      delete: '删除',
      deleteConfirm: '删除这个故事及其全部对话？',
      composer: '你在故事里做什么、说什么……',
      send: '发送',
      narrator: '旁白',
      continue: '继续',
      rewrite: '重写',
      rewind: '回溯到这里',
      errorModel: '模型调用失败',
      fabricated: '生成中…',
      generating: '正在生成…',
      emptyStory: '还没有开场。点右上角「编辑」可以生成开场白，或者你直接说第一句话。',
      charsCount: '个角色',
      autoOn: '自动续演中',
      stopAuto: '停止',
      generatingStory: '正在生成故事…',
      genFailed: '生成失败，请重试。',
      genKeywords: '故事情节',
      genKeywordsPlaceholder: '例如：三个人被困在停电的公寓，旧情敌突然出现',
      genKeywordsHint: '描述你想要的情节，AI 会从零创作故事背景和 2～4 个全新角色，不使用你已有的角色卡。',
      genStart: '生成故事与角色',
      genCreatesCards: '生成的角色会自动加进「角色扮演」里，可以随时修改。',
      editStory: '编辑',
      openingLabel: '开场白',
      openingEmpty: '还没有开场白。点下面的按钮让 AI 写一段，故事就能直接开演。',
      openingGen: '生成开场白',
      openingRegen: '重新生成',
      openingClear: '清空',
      openingGenerating: '正在写…',
      openingFailed: '开场白生成失败，请重试。',
      openingHint: '开场白是故事开始时看到的发言，会出现在聊天区最前面。',
    }

    const STYLE = `
.rp-root{display:flex;height:100%;max-height:100%;min-height:0;min-width:0;width:100%;box-sizing:border-box;color:var(--dsw-alias-label-primary);font-size:13px;background:var(--dsw-alias-bg-base);overflow:hidden}
.rp-anchor{position:relative;display:flex;flex:1 1 auto;height:100%;min-height:0;min-width:0;width:100%;box-sizing:border-box}
.rp-side{flex:0 0 232px;width:232px;display:flex;flex-direction:column;border-right:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);min-height:0;max-height:100%;overflow:hidden}
.rp-side-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px 6px;font-weight:600;flex:0 0 auto}
.rp-list{flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden;padding:4px 8px 12px;display:flex;flex-direction:column;gap:4px;list-style:none;margin:0;overscroll-behavior:contain}
.rp-item{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;border:1px solid transparent;background:transparent;color:inherit;text-align:left;width:100%;font:inherit}
.rp-item:hover{background:var(--dsw-alias-bg-layer-2)}
.rp-item.active{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1)}
.rp-item-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-side-foot{flex:0 0 auto;padding:8px 10px 12px;border-top:1px solid var(--dsw-alias-border-l1)}
.rp-main{flex:1 1 0;display:flex;flex-direction:column;min-width:0;min-height:0;max-height:100%;overflow:hidden}
.rp-head{display:flex;align-items:center;gap:8px;padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto;flex-wrap:wrap}
.rp-head-title{font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rp-cast{display:flex;align-items:center;gap:4px;flex:0 0 auto}
.rp-cast-av{width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);overflow:hidden}
.rp-cast-av img{width:100%;height:100%;object-fit:cover}
.rp-btn{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);border-radius:7px;padding:4px 10px;cursor:pointer;font:inherit}
.rp-btn:hover:not(:disabled){border-color:var(--dsw-alias-border-l2)}
.rp-btn:disabled{opacity:.5;cursor:default}
.rp-btn.primary{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.rp-btn.danger{color:var(--dsw-alias-state-error-primary)}
.rp-msgs{flex:1 1 0;min-height:0;overflow-y:auto;overflow-x:hidden;padding:14px 16px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}
.rp-row{display:flex;flex-direction:column;max-width:80%}
.rp-row.user{align-self:flex-end;align-items:flex-end}
.rp-row.assistant,.rp-row.narrator{align-self:flex-start;align-items:flex-start}
.rp-who{font-size:11px;color:var(--dsw-alias-label-secondary);margin-bottom:2px;display:flex;align-items:center;gap:5px}
.rp-who-av{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:1px solid var(--dsw-alias-border-l1);overflow:hidden;background:var(--dsw-alias-bg-base)}
.rp-who-av img{width:100%;height:100%;object-fit:cover}
.rp-rewind{opacity:0;border:none;background:none;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px;padding:0 4px;font-family:inherit}
.rp-row:hover .rp-rewind{opacity:1}
.rp-bubble{padding:8px 12px;border-radius:12px;white-space:pre-wrap;word-break:break-word;line-height:1.65}
.rp-row.user .rp-bubble{background:var(--dsw-alias-brand-primary);color:#fff;border-bottom-right-radius:4px}
.rp-row.assistant .rp-bubble{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-bottom-left-radius:4px}
.rp-row.narrator .rp-bubble{background:transparent;border:1px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);font-size:12px}
.rp-bubble.live{opacity:.85}
.rp-narr{color:var(--dsw-alias-label-secondary)}
.rp-mind{color:var(--dsw-alias-label-secondary);font-style:italic}
.rp-error{margin:0 16px;padding:8px 12px;border-radius:8px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary);flex:0 0 auto}
.rp-acts{flex:0 0 auto;display:flex;gap:6px;padding:6px 14px 0}
.rp-act{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);border-radius:999px;padding:3px 12px;font:inherit;font-size:11px;cursor:pointer}
.rp-act:hover:not(:disabled){color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary)}
.rp-act.on{background:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-brand-primary);color:#fff}
.rp-act:disabled{opacity:.45;cursor:default}
.rp-composer{flex:0 0 auto;display:flex;gap:8px;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l1)}
.rp-input{flex:1;resize:none;font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:9px;padding:8px 10px;min-height:40px;max-height:140px;outline:none}
.rp-input:focus{border-color:var(--dsw-alias-brand-primary)}
.rp-placeholder{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--dsw-alias-label-secondary);text-align:center;padding:20px}
.rp-editor{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;max-width:720px}
.rp-field{display:flex;flex-direction:column;gap:4px}
.rp-field label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.rp-text{font:inherit;color:inherit;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:7px 9px;outline:none}
.rp-text:focus{border-color:var(--dsw-alias-brand-primary)}
.rp-textarea{min-height:72px;resize:vertical}
.rp-chips{display:flex;flex-wrap:wrap;gap:6px}
.rp-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.rp-chip.on{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}
.rp-chip-av{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:1px solid var(--dsw-alias-border-l1);overflow:hidden}
.rp-chip-av img{width:100%;height:100%;object-fit:cover}
.rp-editor-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:4px}
.rp-overlay{position:fixed;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;z-index:50;padding:24px}
.rp-modal{width:min(560px,100%);max-height:min(80vh,640px);display:flex;flex-direction:column;background:var(--dsw-alias-bg-overlay);border:1px solid var(--dsw-alias-border-l1);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.28);overflow:hidden}
.rp-modal-head{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex:0 0 auto}
.rp-modal-title{font-weight:600;font-size:13px;flex:1}
.rp-modal-body{flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.rp-choice{display:flex;flex-direction:column;align-items:flex-start;gap:3px;padding:12px 14px;border-radius:10px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:inherit;cursor:pointer;font:inherit;text-align:left;width:100%}
.rp-choice:hover{border-color:var(--dsw-alias-brand-primary)}
.rp-choice b{font-size:13px}
.rp-choice span{font-size:11px;color:var(--dsw-alias-label-secondary)}
.rp-hint{font-size:11px;color:var(--dsw-alias-label-secondary)}
.rp-opening-preview{flex:1;min-width:0;max-height:130px;overflow-y:auto;padding:8px 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);font-size:12px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
.rp-opening-name{color:var(--dsw-alias-brand-primary);font-weight:600}
.rp-err-text{font-size:12px;color:var(--dsw-alias-state-error-primary)}
`

    // ---------- 工具 ----------

    function loadJson(key, fallback) {
      try {
        const raw = localStorage.getItem(key)
        const v = raw === null ? undefined : JSON.parse(raw)
        return v === undefined || v === null ? fallback : v
      } catch {
        return fallback
      }
    }

    function saveJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        /* 存储不可用时只影响持久化 */
      }
    }

    function newId() {
      try {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
      } catch {
        /* fall through */
      }
      return `s-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    }

    /** 头像组件：有图用图，没图用 emoji。 */
    function Avatar({ char, size = 18, className = 'rp-who-av' }) {
      const style = { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.55) + 'px' }
      const src = char?.avatarImage
      if (typeof src === 'string' && src.startsWith('data:image/')) {
        return h('span', { className, style }, h('img', { src, alt: '' }))
      }
      return h('span', { className, style }, char?.avatar || '🎭')
    }

    /** 把角色回复切成台词和括号描写，括号部分显示为灰色。 */
    function renderSpeech(text) {
      if (typeof text !== 'string' || text === '') return null
      const nodes = []
      const pattern = /（[^）]*）|\([^)]*\)/g
      let last = 0
      let m
      let i = 0
      while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index))
        nodes.push(h('span', { key: 'n' + i, className: 'rp-narr' }, m[0]))
        i += 1
        last = m.index + m[0].length
      }
      if (last < text.length) nodes.push(text.slice(last))
      return nodes
    }

    function parseSse(buffer, onEvent) {
      let rest = buffer
      let at
      while ((at = rest.indexOf('\n\n')) !== -1) {
        const raw = rest.slice(0, at)
        rest = rest.slice(at + 2)
        for (const line of raw.split('\n')) {
          if (!line.startsWith('data: ')) continue
          try {
            onEvent(JSON.parse(line.slice(6)))
          } catch {
            /* 跳过坏帧 */
          }
        }
      }
      return rest
    }

    // ---------- 提示词 ----------

    const CAST_FORMAT = `【输出格式（严格遵守，这是分段协议）】
每一段发言必须以下面的标记开头，独占一行：
[[角色名]]
然后换行写这个角色的台词与动作。
- 同一段里不要出现两个 [[角色名]]。
- 只能使用下面给定的角色名，不要自创角色。
- 如果上面说明了某个角色由用户扮演，就不要为他生成任何段落。
- 旁白（场景变化、环境描写）用 [[旁白]] 开头。
- 每轮输出 2～4 段，让角色之间有来有回；不要一个人说完整场。`

    function buildStoryPrompt(story, chars, mode) {
      const st = story && typeof story === 'object' ? story : {}
      const list = Array.isArray(chars) ? chars.filter((c) => c && typeof c.name === 'string') : []
      const names = list.map((c) => c.name)
      // st.playAsId 指向「由用户来演」的那个角色；没有就是全员 AI。
      const playerChar = list.find((c) => c.id === st.playAsId) ?? null
      const aiCast = playerChar === null ? list : list.filter((c) => c.id !== playerChar.id)
      // 用户在这个故事里演的是 playerChar，所以他的性别就等于这个角色的性别。
      const known = playerChar?.gender === '男' || playerChar?.gender === '女' ? playerChar.gender : ''
      const genderLine =
        known === ''
          ? '用户的性别未说明，不要擅自假设，用中性说法（如「你」「对方」）。'
          : `用户是${known === '男' ? '男性' : '女性'}，提到他的性别特征或被他人称呼时用「${known === '男' ? '他' : '她'}」相关的说法，不要搞错。`
      const castDesc = list
        .map((c) => {
          const bits = [`名字：${c.name}`]
          if (c.persona) bits.push(`设定：${c.persona}`)
          if (c.desire) bits.push(`想要：${c.desire}`)
          if (c.guard) bits.push(`防线：${c.guard}`)
          return bits.join('\n')
        })
        .join('\n\n')
      const parts = [`你现在要写一场多角色群像故事。出场角色如下：\n\n${castDesc}`]
      if (st.scene) parts.push(`【故事背景】\n${st.scene}`)

      if (playerChar !== null) {
        // 有玩家角色时，这是最重要的一条约束：他的台词归用户，AI 只写别人。
        parts.push(`【用户扮演的角色（最高优先级）】
${playerChar.name} 由用户本人在扮演，不是由你写。
- 绝对不要写 ${playerChar.name} 的台词、动作、心理活动，一行都不要。
- ${genderLine}
- 你的任务是把 ${playerChar.name} 之外的角色写好，让他们对 ${playerChar.name} 和彼此做出反应。
- 用户的发言在对话记录里标记为 [用户]，那就是 ${playerChar.name} 说的话，请当作 ${playerChar.name} 亲口说的来接。
- 角色们知道 ${playerChar.name} 在场，会看着他、跟他说话、对他有情绪。
- 把舞台留给 ${playerChar.name}：每轮结尾留一个能让他接话的钩子。`)
        parts.push(
          `【角色名单】${names.join('、')}\n（其中 ${playerChar.name} 由用户演，你只写 ${aiCast.map((c) => c.name).join('、')}）`,
        )
      } else {
        parts.push(`【角色名单】${names.join('、')}`)
        parts.push(`【用户的位置】用户是这一切的旁观者与参与者，所有角色都由你来写。
- ${genderLine}`)
      }

      parts.push(CAST_FORMAT)
      parts.push(`【角色之间的互动（重点）】
- 角色之间必须有直接交流：互相接话、反驳、试探、争抢、冷战，不要各自只对用户说话。
- 让角色之间产生张力：立场冲突、信息差、吃醋、旧怨、默契配合，都可以。
- 用户在场，角色也会对用户说话；但同一轮里不要所有人都围着用户转。
- 角色要知道彼此存在，会引用别人刚说的话。
- 每个角色保持自己的人设和说话方式，不要串味。`)
      parts.push(`【写作要求】
- 台词直接写，动作、神态、场景用全角括号：（她把杯子推回去）。
- 心理活动写成：（角色名：所想的），第一人称口语，不要写成旁白分析。
- 长度适中：每段 1～3 句台词，不要长篇独白。
- 不要替用户说话、不要替用户做决定。`)
      if (mode === 'turn') {
        parts.push(`【节奏】本轮按顺序让角色轮流开口，每人一段，最后给用户留出接话的空间。`)
      } else {
        parts.push(`【节奏】本轮自由互动，谁的情绪最强烈谁先说，可以有打断、抢话、同时开口的混乱感。`)
      }
      return parts.join('\n\n')
    }

    /** 把历史消息拼成模型可读的上下文。 */
    function buildTranscript(messages, playerName) {
      const you = typeof playerName === 'string' && playerName !== '' ? playerName : '用户'
      return messages
        .map((m) => {
          if (m.role === 'user') return `[用户/${you}]：${m.text}`
          if (m.role === 'narrator') return `[旁白]：${m.text}`
          return `[${m.speaker || '角色'}]：${m.text}`
        })
        .join('\n')
    }

    /** 解析模型输出里的 [[角色名]] 分段。 */
    function parseSegments(raw) {
      const lines = String(raw).split('\n')
      const segments = []
      let current = null
      const nameRe = /^\[\[(.+?)\]\]\s*$/
      for (const line of lines) {
        const m = line.match(nameRe)
        if (m) {
          if (current && current.text.trim() !== '') segments.push(current)
          current = { speaker: m[1].trim(), text: '' }
          continue
        }
        if (current === null) {
          if (line.trim() !== '') current = { speaker: '__unknown__', text: line }
          continue
        }
        current.text += (current.text === '' ? '' : '\n') + line
      }
      if (current && current.text.trim() !== '') segments.push(current)
      // 没有任何标记时，整段当成一个角色的话（用第一个角色）
      if (segments.length === 0 && String(raw).trim() !== '') {
        segments.push({ speaker: '__unknown__', text: String(raw).trim() })
      }
      return segments.map((s) => ({ ...s, text: s.text.trim() }))
    }

    /**
     * 故事生成：完全从零创作角色，根据情节描述产出故事背景与 2～4 张全新角色卡。
     * 不参考、不复用已有角色卡——用户要的是 AI 原创的整套阵容。
     * 失败时通过 lastGenError 暴露原因，便于界面显示具体卡点。
     */
    let lastGenError = ''
    async function generateStory(plot, chars, hub) {
      lastGenError = ''
      // 只把已有角色的名字当作「避让名单」，防止新建的重名导致管理混乱。
      const taken =
        Array.isArray(chars) && chars.length > 0
          ? chars
              .map((c) => (typeof c?.name === 'string' ? c.name.trim() : ''))
              .filter((n) => n !== '')
              .join('、')
          : ''
      const system = `你是多角色群像故事的策划，负责从零创作一个故事和它的全部角色。

【最重要的前提】
所有角色都由你原创。不要使用任何现实中的公众人物，也不要假定用户已经有现成的角色。
如果用户消息里给了【避让名单】，那些名字已被占用，你起名时要避开。

必须只输出一个 JSON 对象，不要解释、不要代码块标记、不要嵌套（所有字段都是字符串，只有 cast 是数组）。
字段名必须使用下列英文键，不要翻译成中文：
{"title":"故事标题，10字内","scene":"故事背景，180-280字，写清时间地点、角色之间的旧有关系、当前引爆矛盾的处境","youName":"用户在这个故事里扮演的那个角色的名字","opening":"开场白，见下方要求","cast":[{"name":"角色名","avatar":"一个贴切的 emoji","gender":"男 或 女","persona":"人物设定，200-350字，写清性格、说话方式、背景、习惯动作、口癖","desire":"这个角色在这个故事里想要什么，30-60字","guard":"这个角色的心理防线，30-60字"}]}

【开场白 opening（很重要）】
这是故事开始时用户第一眼看到的内容，必须让人立刻想接话。
- 用第 2～4 段发言的格式写，每段以 [[角色名]] 独占一行开头，就像故事已经在进行。
- 必须是 cast 里的角色说的，绝对不要写 youName 那个布色（那是用户本人）。
- 写 3～5 句台词加动作，制造一个正在发生的小冲突或暧昧瞬间，把场面逼到一个必须回应的点。
- 动作、神态用全角括号：（她把烟按灭）。
- 结尾要留出空档，让用户马上有话说。
- 不要写成旁白介绍，不要交代设定，直接开演。
格式示例（照这个格式，内容你自己写）：
[[角色甲]]
（抬头看你）你来得正好。
[[角色乙]]
（把杯子推到你面前）先坐下吧，站着说话不好听。

【用户必须有自己的位置（非常重要）】
用户在玩这个故事，不是旁观者。你要从 cast 里挑一个角色当作「用户本人扮演的角色」，把它的名字填进 youName。
- 这个角色是故事的主角之一，是这场戏的核心，其他角色都会围着他转。
- 他被卷进矛盾中心，有充分的说话动机和改变局势的能力。
- 在 scene 里用「你」称呼他，写成「你」的处境，不要写成第三人称旁白。
- youName 必须是 cast 里真实存在的名字之一，不要另起一个。

【JSON 写法（非常重要，违反会导致解析失败）】
- 字符串内部绝对不要出现英文双引号 "。要引用对话就用中文引号「」或『』。
- 不要在 JSON 里写注释，字段之间必须有逗号，最后一个字段后面不要加逗号。
- 每个字段值都必须用英文双引号包住，且整段输出只有一个 JSON 对象。

字数要求是硬性的：persona 一定要写满 200 字以上，写清楚性格层次、说话的具体方式（口癖、句长、用词习惯）、身份背景、习惯动作。写不到 200 字说明你偷懒了，重写。

要求：
- cast 输出 2～4 个角色，人数按情节需要定，不要凑数。
- 每个角色都要有完整的来历：姓名、身份、在这个故事里的位置，不要写「角色A」这类占位名。
- 角色之间必须有现成的张力：旧怨、暗恋、竞争、上下级、隐瞒的秘密，任选其一并落到实处。
- 每个角色的性格和说话方式要明显不同，不要写成同一个人换了名字。
- avatar 必须是一个真实存在的 emoji 字符（如 🩸、🌙、🕯️），不要写文字描述。
- 每个角色卡片里的 greeting 不需要输出（开场白统一写在 opening 里）。
- 角色彼此之间要有自己的关系和目的，不要写成围着用户转的工具人。
- 用户给的情节如果已经点名了角色或身份，就按用户的设定来写，不要另起一套。`
      const userText =
        (taken === '' ? '' : `【避让名单：这些名字已被占用，新角色不要重名】\n${taken}\n\n`) +
        `【想要的情节】\n${plot}`
      let raw = null
      try {
        raw = await hub.complete(system, userText, { temperature: 0.95, maxTokens: 2800 })
      } catch (e) {
        lastGenError = `模型调用抛错：${e instanceof Error ? e.message : String(e)}`
        return null
      }
      if (raw === null || typeof raw !== 'string' || raw.trim() === '') {
        const hint = typeof hub.lastError === 'string' && hub.lastError !== '' ? `（${hub.lastError}）` : ''
        lastGenError = `模型没有返回内容${hint}`
        return null
      }
      try {
        const cleaned = raw.replace(/```json|```/g, '').trim()
        const s = cleaned.indexOf('{')
        const e = cleaned.lastIndexOf('}')
        if (s === -1 || e === -1) {
          lastGenError = `模型输出里找不到 JSON 对象。开头是：${cleaned.slice(0, 80)}`
          return null
        }
        let p = null
        const text = cleaned.slice(s, e + 1)
        try {
          p = JSON.parse(text)
        } catch (first) {
          // 模型经常在字符串值里写未转义的英文直引号（中文对话引号尤其多），
          // 直接 JSON.parse 会提前截断。这里做一次修复再试。
          const repaired = repairJsonQuotes(text)
          if (repaired !== null) {
            try {
              p = JSON.parse(repaired)
            } catch {
              p = null
            }
          }
          if (p === null) {
            lastGenError = `JSON 解析失败：${first instanceof Error ? first.message : String(first)}｜原文开头：${raw.slice(0, 160)}`
            return null
          }
        }
        if (p === null || typeof p !== 'object') {
          lastGenError = '模型返回的不是 JSON 对象'
          return null
        }
        let src = p
        const keys = Object.keys(src)
        if (keys.length === 1 && src[keys[0]] && typeof src[keys[0]] === 'object' && !Array.isArray(src[keys[0]])) src = src[keys[0]]
        const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
        const title = str(src.title) || str(src['标题']) || str(src['故事标题'])
        const scene = str(src.scene) || str(src['背景']) || str(src['故事背景']) || str(src['情节'])
        const youName = str(src.youName) || str(src['you']) || str(src['用户角色']) || str(src['我扮演'])
        const rawCast = src.cast || src['角色'] || src['角色名单'] || src['出场角色'] || []
        // 兼容三种写法：完整角色对象数组、纯名字字符串数组、单个对象。
        const list = Array.isArray(rawCast) ? rawCast : rawCast && typeof rawCast === 'object' ? [rawCast] : []
        const cast = list.map(normalizeCastCard).filter(Boolean).slice(0, 4)
        if (title === '' && scene === '') {
          lastGenError = `JSON 里没有标题和背景。字段是：${Object.keys(src).join(', ')}`
          return null
        }
        if (cast.length === 0) {
          lastGenError = `没有可用的角色卡。cast 字段：${JSON.stringify(rawCast).slice(0, 120)}`
          return null
        }
        // youName 必须能在 cast 里找到，否则退化为「第一个角色是玩家」。
        const hasYou = youName !== '' && cast.some((c) => c.name === youName)
        const finalYou = hasYou ? youName : (cast[0]?.name ?? '')
        const opening = str(src.opening) || str(src['开场白']) || str(src['开场'])
        return {
          title: title || '未命名故事',
          scene,
          cast,
          youName: finalYou,
          opening,
        }
      } catch (e) {
        lastGenError = `JSON 解析失败：${e instanceof Error ? e.message : String(e)}｜原文开头：${raw.slice(0, 120)}`
        return null
      }
    }

    /**
     * 把生成出来的开场白（[[角色名]] 分段文本）转成消息数组。
     * 玩家角色的段落会被丢掉——那是用户自己要说的话。
     * @param {string} opening 模型给的开场白
     * @param {object[]} cast 本次生成的角色
     * @param {string} youName 用户扮演的角色名
     */
    function openingToMessages(opening, cast, youName) {
      const text = typeof opening === 'string' ? opening.trim() : ''
      if (text === '') return []
      const names = new Set(cast.map((c) => c.name))
      const segs = parseSegments(text)
      const out = []
      for (const seg of segs) {
        if (typeof seg.text !== 'string' || seg.text.trim() === '') continue
        // 用户本人的台词不写进来
        if (youName !== '' && seg.speaker === youName) continue
        const isNarr = seg.speaker === '旁白'
        // 模型偶尔会漏标记，兜底归给第一个非玩家角色
        const fallback = cast.find((c) => c.name !== youName)?.name ?? cast[0]?.name ?? '角色'
        const speaker = isNarr ? '' : names.has(seg.speaker) ? seg.speaker : fallback
        out.push({
          role: isNarr ? 'narrator' : 'assistant',
          speaker,
          text: seg.text.trim(),
          time: Date.now() + out.length,
        })
      }
      return out
    }

    /**
     * 修复模型生成的不合法 JSON：主要是字符串值里未转义的英文直引号。
     *
     * 思路：逐字符扫描，跟踪「当前是否在字符串内部」。
     * 只有出现在「值的位置」且后面紧跟结构字符（, } ] :) 或行尾的引号，才算字符串结束；
     * 其余在值内部的引号一律当作普通字符转义掉。
     * 同时把常见的中文直引号残留、末尾多余逗号一并处理。
     *
     * @returns {string | null} 修复后的文本；无法修复返回 null
     */
    function repairJsonQuotes(text) {
      if (typeof text !== 'string' || text === '') return null
      const out = []
      const stack = [] // 容器栈：'obj' | 'arr'
      let inString = false
      let escaped = false
      let afterColon = false // 刚读完冒号：下一个字符串一定是「值」

      /** 当前容器里，字符串应当被当作「键」还是「值」 */
      const topIsObject = () => stack.length > 0 && stack[stack.length - 1] === 'obj'

      for (let i = 0; i < text.length; i += 1) {
        const ch = text[i]

        if (inString) {
          if (escaped) {
            out.push(ch)
            escaped = false
            continue
          }
          if (ch === '\\') {
            out.push(ch)
            escaped = true
            continue
          }
          if (ch === '"') {
            // 找到后面第一个非空白字符，用它判断这个引号是不是真正的结尾
            let j = i + 1
            while (j < text.length && /\s/.test(text[j])) j += 1
            const next = text[j]
            // 字符串结束的合法后续：逗号、右括号、冒号（键后面）、行尾
            const isRealEnd =
              next === ',' || next === '}' || next === ']' || next === ':' || next === undefined
            // 对象里「值」位置开头的字符串，如果后面是 : 说明其实是个键（模型漏了值）
            const asKey = topIsObject() && !afterColon && next === ':'
            if (isRealEnd || asKey) {
              out.push(ch)
              inString = false
              if (next === ':') afterColon = true
              else afterColon = false
              continue
            }
            // 否则是值内部未转义的引号 → 转义掉
            out.push('\\"')
            continue
          }
          out.push(ch)
          continue
        }

        // —— 字符串外部 ——
        if (ch === '"') {
          inString = true
          out.push(ch)
          continue
        }
        if (ch === ':') {
          afterColon = true
          out.push(ch)
          continue
        }
        if (ch === ',') {
          afterColon = false
          out.push(ch)
          continue
        }
        if (ch === '{') {
          stack.push('obj')
          afterColon = false
          out.push(ch)
          continue
        }
        if (ch === '[') {
          stack.push('arr')
          afterColon = false
          out.push(ch)
          continue
        }
        if (ch === '}' || ch === ']') {
          stack.pop()
          afterColon = false
          out.push(ch)
          continue
        }
        out.push(ch)
      }

      let repaired = out.join('')
      // 收尾清理：对象/数组里多余的逗号，如 [1,2,] 或 {"a":1,}
      repaired = repaired.replace(/,\s*([}\]])/g, '$1')
      // 只要有改动就交回去；没改动说明修不了，让调用方保留原始报错。
      return repaired !== text ? repaired : null
    }

    /** 解析模型给的一个角色对象，中文字段名和纯字符串都认。 */
    function normalizeCastCard(raw) {
      // 模型只给了名字时，先造一张只有名字的卡，细节留空由用户补。
      if (typeof raw === 'string') {
        const only = raw.trim()
        if (only === '') return null
        return { name: only, avatar: '🎭', gender: '', persona: '', scenario: '', greeting: '', desire: '', guard: '' }
      }
      if (raw === null || typeof raw !== 'object') return null
      let src = raw
      const keys = Object.keys(src)
      if (keys.length === 1 && src[keys[0]] && typeof src[keys[0]] === 'object' && !Array.isArray(src[keys[0]])) src = src[keys[0]]
      const str = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
      const pick = (alias) => {
        for (const k of alias) {
          const v = str(src[k])
          if (v !== '') return v
        }
        return ''
      }
      const name = pick(['name', '名字', '姓名', '角色名', '角色'])
      if (name === '') return null
      const avatarRaw = pick(['avatar', '头像', 'emoji', '表情'])
      const avatar = /^[\p{Extended_Pictographic}\uFE0F]{1,4}$/u.test(avatarRaw) ? avatarRaw : '🎭'
      // 性别：只认男/女，其余留空
      const gRaw = pick(['gender', '性别', 'sex'])
      const gender = /男/.test(gRaw) ? '男' : /女/.test(gRaw) ? '女' : ''
      return {
        name,
        avatar,
        gender,
        persona: pick(['persona', '人设', '人物设定', '性格', '设定', '角色设定']),
        scenario: pick(['scenario', '情景', '世界观', '场景', '背景设定']),
        greeting: pick(['greeting', '开场白']),
        desire: pick(['desire', '欲望', '想要什么', '动机', '渴望']),
        guard: pick(['guard', '防线', '心理防线', '防备']),
      }
    }

    // ---------- 主视图 ----------

    function StoryView({ t }) {
      const [stories, setStories] = useState(() => loadJson(LS_STORIES, []))
      const [selectedId, setSelectedId] = useState(() => loadJson(LS_SELECTED, null))
      const [editing, setEditing] = useState(null)
      const [input, setInput] = useState('')
      const [streaming, setStreaming] = useState(false)
      const [live, setLive] = useState('')
      const [error, setError] = useState('')
      const [mode, setMode] = useState(() => loadJson(LS_MODE, 'free'))
      const [autoNext, setAutoNext] = useState(() => Boolean(loadJson(LS_AUTO, false)))
      const [hub, setHub] = useState(null)
      const [characters, setCharacters] = useState([])
      const [createOpen, setCreateOpen] = useState(false)
      const [createPlot, setCreatePlot] = useState('')
      const [generatingStory, setGeneratingStory] = useState(false)
      const [createError, setCreateError] = useState('')
      const scrollRef = useRef(null)
      const hubRef = useRef(null)

      const selected = stories.find((s) => s.id === selectedId) ?? null
      const messages = selected ? selected.messages ?? [] : []
      const cast = selected ? (selected.characterIds ?? []).map((id) => characters.find((c) => c.id === id)).filter(Boolean) : []

      // 从主插件获取共享接口：优先全局通道，其次 Cordis 服务。
      // 主插件的 Client 半部可能比本插件晚加载，所以轮询等待。
      useEffect(() => {
        let cancelled = false
        let offChange = null
        const tryAttach = () => {
          const svc =
            (typeof window !== 'undefined' ? window.__DSH_ROLEPLAY_HUB__ : undefined) ||
            (ctxRef.current && typeof ctxRef.current.get === 'function' ? ctxRef.current.get('roleplayChat') : undefined)
          if (!svc) return false
          if (hubRef.current === svc) return true
          hubRef.current = svc
          setHub(svc)
          const sync = () => setCharacters(svc.getCharacters())
          sync()
          offChange = svc.onChange(sync)
          return true
        }
        if (tryAttach()) return () => { if (offChange) offChange() }
        const timer = setInterval(() => {
          if (cancelled) return
          if (tryAttach()) clearInterval(timer)
        }, 500)
        return () => {
          cancelled = true
          clearInterval(timer)
          if (typeof offChange === 'function') offChange()
        }
      }, [])

      useEffect(() => {
        saveJson(LS_STORIES, stories)
      }, [stories])
      useEffect(() => {
        saveJson(LS_SELECTED, selectedId)
      }, [selectedId])
      useEffect(() => {
        saveJson(LS_MODE, mode)
      }, [mode])
      useEffect(() => {
        saveJson(LS_AUTO, autoNext)
      }, [autoNext])

      useEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = el.scrollHeight
      }, [messages.length, live])

      const updateStory = useCallback((id, patch) => {
        setStories((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
      }, [])

      // 一次叙事补全
      const runStoryCompletion = useCallback(
        async (story, castList, history) => {
          if (!hubRef.current) return
          setStreaming(true)
          setLive('')
          setError('')
          let acc = ''
          try {
            const system = buildStoryPrompt(story, castList, mode)
            const playerName = castList.find((c) => c.id === story.playAsId)?.name ?? ''
            const userText = `【目前为止的对话】\n${buildTranscript(history, playerName)}\n\n请据此写出接下来的 2～4 段。`
            const text = await hubRef.current.complete(system, userText, { temperature: 0.9, maxTokens: 1600 })
            if (text === null) throw new Error(t('errorModel'))
            acc = text
            setLive(acc)
            const segments = parseSegments(acc)
            const nameSet = new Set(castList.map((c) => c.name))
            // 玩家角色由用户本人说话，AI 写了也丢掉，避免替用户开口。
            const appended = segments
              .filter((seg) => !(playerName !== '' && seg.speaker === playerName))
              .map((seg) => {
                const known = nameSet.has(seg.speaker) ? seg.speaker : seg.speaker === '旁白' ? '' : seg.speaker
                return {
                  role: seg.speaker === '旁白' ? 'narrator' : 'assistant',
                  speaker: known || castList[0]?.name || '角色',
                  text: seg.text,
                  time: Date.now(),
                }
              })
            updateStory(story.id, { messages: [...history, ...appended] })
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          } finally {
            setLive('')
            setStreaming(false)
          }
        },
        [mode, updateStory, t],
      )

      // 发送用户输入
      const send = useCallback(async () => {
        const text = input.trim()
        if (text === '' || streaming || !selected || cast.length < 2) return
        // 记下用户这次是以哪个角色身份说的话，气泡上就能显示对的名字。
        const asId = typeof selected.playAsId === 'string' ? selected.playAsId : null
        const history = [...messages, { role: 'user', text, asId, time: Date.now() }]
        setInput('')
        updateStory(selected.id, { messages: history })
        await runStoryCompletion(selected, cast, history)
      }, [input, streaming, selected, cast, messages, updateStory, runStoryCompletion])

      // 「继续」：不给用户发言，直接让角色们继续演
      const continueStory = useCallback(async () => {
        if (streaming || !selected || cast.length < 2) return
        await runStoryCompletion(selected, cast, messages)
      }, [streaming, selected, cast, messages, runStoryCompletion])

      // 自动续演
      useEffect(() => {
        if (!autoNext || streaming || !selected) return
        if (cast.length < 2) return
        const timer = setTimeout(() => {
          if (!streaming) continueStory()
        }, 1800)
        return () => clearTimeout(timer)
      }, [autoNext, streaming, selected, cast.length, messages.length, continueStory])

      const rewindTo = useCallback(
        (index) => {
          if (!selected || streaming) return
          updateStory(selected.id, { messages: messages.slice(0, index) })
          setError('')
        },
        [selected, streaming, messages, updateStory],
      )

      const deleteStory = useCallback(
        (id) => {
          if (!window.confirm(t('deleteConfirm'))) return
          setStories((prev) => prev.filter((s) => s.id !== id))
          setSelectedId((prev) => (prev === id ? null : prev))
        },
        [t],
      )

      /**
       * 把生成出来的角色卡落进主插件：全部当作原创新建，不套用旧角色。
       * @param {object[]} cast 生成的角色卡
       * @param {object} hub 主插件共享接口
       * @param {string} scene 故事背景，用来补全新卡缺失的情景字段
       * @returns {string[]} 可用于 story.characterIds 的 id 列表
       */
      const materializeCast = useCallback((cast, hub, scene) => {
        const ids = []
        const live = hub.getCharacters()
        const backdrop = typeof scene === 'string' ? scene.trim() : ''
        const hasCreate = typeof hub.createCharacter === 'function'
        let created = 0
        let failed = 0
        for (const card of cast) {
          const name = (card?.name ?? '').trim()
          if (name === '') continue
          // 生成模式要求「完全原创」：即使碰巧同名，也新建一张独立的卡，
          // 否则会悄悄套用旧角色的人设，和用户看到的情节对不上。
          const clash = live.some((c) => c.name === name)
          if (!hasCreate) {
            failed += 1
            continue
          }
          // 单独打开这张卡聊天时也要有背景，所以把故事背景写进 scenario。
          const payload = {
            ...card,
            ...(backdrop !== '' && (card.scenario ?? '').trim() === '' ? { scenario: backdrop } : {}),
            // 重名时加后缀，既保留原创设定，也不会和旧卡混淆。
            ...(clash ? { name: `${name}（新生）` } : {}),
          }
          const made = hub.createCharacter(payload)
          if (made && typeof made.id === 'string') {
            live.push(made)
            created += 1
            if (!ids.includes(made.id)) ids.push(made.id)
          } else {
            failed += 1
          }
        }
        if (created === 0 && failed > 0) {
          lastGenError = hasCreate
            ? `角色卡写入失败（${failed} 个）。可能是「角色扮演」插件未启用。`
            : '「角色扮演」插件没有提供建卡接口，请确认它已启用并刷新页面。'
        }
        return ids
      }, [])

      // 生成故事：根据情节自动生成背景与角色卡，并把角色写进主插件的角色列表
      const runGenerateStory = useCallback(async () => {
        if (!hubRef.current || generatingStory) return
        const plot = createPlot.trim()
        if (plot === '') return
        setGeneratingStory(true)
        setCreateError('')
        try {
          const draft = await generateStory(plot, characters, hubRef.current)
          if (draft === null) {
            setCreateError(lastGenError !== '' ? lastGenError : t('genFailed'))
            return
          }
          const characterIds = materializeCast(draft.cast, hubRef.current, draft.scene)
          // 只用本次生成的原创角色，不拿旧角色凑数——这才能保证阵容完全来自 AI。
          if (characterIds.length < 2) {
            setCreateError(
              lastGenError !== ''
                ? lastGenError
                : `${t('genFailed')}（AI 只生成了 ${characterIds.length} 个角色，至少需要 2 个，请重新生成）`,
            )
            return
          }
          // 新卡刚写进主插件，立刻拉一次快照，否则编辑器的角色 chips 会缺新角色。
          const fresh = hubRef.current.getCharacters()
          setCharacters(fresh)
          // 把 AI 指定的「用户角色」名字翻译成 id，存进故事里。
          const youId = fresh.find((c) => c.name === draft.youName)?.id ?? null
          const playAsId = youId !== null && characterIds.includes(youId) ? youId : (characterIds[0] ?? null)
          // 开场白随生成一起产出，进编辑器时就能看到戏已经开场了。
          const castForOpening = characterIds
            .map((id) => fresh.find((c) => c.id === id))
            .filter(Boolean)
          const openingMessages = openingToMessages(draft.opening, castForOpening, draft.youName)
          setCreateOpen(false)
          setCreatePlot('')
          setEditing({
            id: undefined,
            title: draft.title,
            scene: draft.scene,
            characterIds,
            playAsId,
            messages: openingMessages,
          })
        } finally {
          setGeneratingStory(false)
        }
      }, [createPlot, characters, generatingStory, t, materializeCast])

      const startNew = () => setEditing({ id: undefined, title: '', scene: '', characterIds: [], messages: [] })

      const saveStory = (draft) => {
        const title = (draft.title ?? '').trim()
        if (title === '') return
        const ids = Array.isArray(draft.characterIds) ? draft.characterIds : []
        if (ids.length < 2) return
        const id = draft.id ?? newId()
        setStories((prev) => {
          const at = prev.findIndex((s) => s.id === id)
          // 编辑器里生成过开场白就用它；否则沿用已有消息，新故事则为空。
          const incoming = Array.isArray(draft.openingMessages) ? draft.openingMessages : null
          const messages =
            incoming !== null && incoming.length > 0
              ? incoming
              : at === -1
                ? (draft.messages ?? [])
                : (prev[at].messages ?? [])
          const record = {
            id,
            title,
            scene: draft.scene ?? '',
            characterIds: ids,
            playAsId: typeof draft.playAsId === 'string' && ids.includes(draft.playAsId) ? draft.playAsId : null,
            messages,
          }
          if (at === -1) return [...prev, record]
          const next = prev.slice()
          next[at] = { ...next[at], ...record }
          return next
        })
        setEditing(null)
        setSelectedId(id)
      }

      /**
       * 编辑器里「生成开场白」：按当前标题/背景/阵容现写一段。
       * @returns {{text: string, messages: object[]} | null}
       */
      const generateOpeningFor = useCallback(async (payload) => {
        const hub = hubRef.current
        if (!hub) return null
        const ids = Array.isArray(payload?.characterIds) ? payload.characterIds : []
        const castList = ids.map((id) => characters.find((c) => c.id === id)).filter(Boolean)
        if (castList.length < 2) return null
        const playerChar = castList.find((c) => c.id === payload?.playAsId) ?? null
        const aiNames = castList.filter((c) => c.id !== playerChar?.id).map((c) => c.name)
        // 用户演的就是 playerChar，性别跟着这个角色卡走。
        const youGender =
          playerChar?.gender === '男' || playerChar?.gender === '女' ? playerChar.gender : ''
        const sys = `你要为一个多角色群像故事写开场白。

【出场角色】
${castList
  .map((c) => `名字：${c.name}${c.gender ? `（${c.gender}）` : ''}${c.persona ? `\n设定：${c.persona.slice(0, 200)}` : ''}`)
  .join('\n\n')}

【故事背景】
${payload?.scene ?? ''}

【你只写这些角色】${aiNames.join('、')}${
          playerChar === null ? '' : `\n【不要写】${playerChar.name}（那是用户本人扮演的，一个字都不要写）`
        }${youGender === '' ? '' : `\n【用户的性别】${playerChar.name} 是${youGender === '男' ? '男性' : '女性'}，叙述时用「${youGender === '男' ? '他' : '她'}」相关的说法。`}

【格式】每段以 [[角色名]] 独占一行开头，然后换行写台词与动作。只输出正文，不要解释、不要代码块标记。

【要求】
- 3～5 段，制造一个正在发生的小冲突或暧昧瞬间。
- 动作、神态用全角括号，如（她把烟按灭）。
- 结尾留出空档，让用户马上能接话。
- 不要交代设定，直接开演。`
        let text = null
        try {
          text = await hub.complete(sys, '请写出这个故事的开场白。', { temperature: 0.95, maxTokens: 900 })
        } catch {
          return null
        }
        if (text === null) return null
        const clean = String(text).replace(/```[a-z]*|```/g, '').trim()
        if (clean === '') return null
        return {
          text: clean,
          messages: openingToMessages(clean, castList, playerChar?.name ?? ''),
        }
      }, [characters])

      // ---------- 渲染 ----------

      const rows = []
      const playerChar = cast.find((c) => c.id === selected?.playAsId) ?? null
      messages.forEach((m, index) => {
        const isUser = m.role === 'user'
        const isNarrator = m.role === 'narrator'
        const char = cast.find((c) => c.name === m.speaker)
        // 用户发言时显示他扮演的角色名，让人一眼看清「我」是谁。
        const userName = isUser ? (playerChar?.name ?? t('you')) : ''
        rows.push(
          h(
            'div',
            { key: `${m.time}-${index}`, className: `rp-row ${isUser ? 'user' : isNarrator ? 'narrator' : 'assistant'}` },
            h(
              'div',
              { className: 'rp-who' },
              isUser && playerChar !== null ? h(Avatar, { char: playerChar }) : null,
              !isUser && !isNarrator ? h(Avatar, { char: char ?? cast[0] }) : null,
              isUser ? userName : isNarrator ? t('narrator') : m.speaker,
              h('button', { className: 'rp-rewind', title: t('rewind'), disabled: streaming, onClick: () => rewindTo(index) }, '↩'),
            ),
            h(
              'div',
              { className: 'rp-bubble' },
              isUser || isNarrator ? m.text : renderSpeech(m.text),
            ),
          ),
        )
      })
      if (streaming && live !== '') {
        const segs = parseSegments(live)
        for (const seg of segs) {
          if (seg.text.trim() === '') continue
          const char = cast.find((c) => c.name === seg.speaker)
          rows.push(
            h(
              'div',
              { key: 'live-' + seg.speaker + seg.text.length, className: 'rp-row assistant' },
              h('div', { className: 'rp-who' }, h(Avatar, { char: char ?? cast[0] }), seg.speaker),
              h('div', { className: 'rp-bubble live' }, renderSpeech(seg.text)),
            ),
          )
        }
      }

      let main
      if (editing !== null) {
        main = h(StoryEditor, {
          t,
          draft: editing,
          characters,
          onSave: saveStory,
          onCancel: () => setEditing(null),
          onGenerateOpening: generateOpeningFor,
          onDelete: editing.id ? () => {
            deleteStory(editing.id)
            setEditing(null)
          } : undefined,
        })
      } else if (!selected) {
        main = h(
          'div',
          { className: 'rp-placeholder' },
          h('div', { style: { fontSize: '30px' } }, '🎭'),
          h('div', null, stories.length === 0 ? t('noStories') : t('selectStory')),
          stories.length === 0 ? h('div', null, t('noStoriesHint')) : null,
          h('button', { className: 'rp-btn primary', onClick: () => setCreateOpen(true) }, t('newStory')),
        )
      } else {
        main = h(
          React.Fragment,
          null,
          h(
            'div',
            { className: 'rp-head' },
            h('div', { className: 'rp-head-title' }, selected.title),
            h(
              'div',
              { className: 'rp-cast' },
              cast.map((c) => h('span', { key: c.id, title: c.name }, h(Avatar, { char: c, size: 22, className: 'rp-cast-av' }))),
            ),
            h('button', { className: 'rp-btn', onClick: () => setEditing({ ...selected }), disabled: streaming }, t('editStory')),
          ),
          error === '' ? null : h('div', { className: 'rp-error' }, error),
          h(
            'div',
            { className: 'rp-acts' },
            h('button', { className: `rp-act${mode === 'turn' ? ' on' : ''}`, onClick: () => setMode(mode === 'turn' ? 'free' : 'turn'), disabled: streaming, title: mode === 'turn' ? t('modeTurnDesc') : t('modeFreeDesc') }, mode === 'turn' ? t('modeTurn') : t('modeFree')),
            h('button', { className: 'rp-act', onClick: continueStory, disabled: streaming || cast.length < 2 }, t('continue')),
            h('button', { className: `rp-act${autoNext ? ' on' : ''}`, onClick: () => setAutoNext((v) => !v), title: t('autoNextDesc') }, autoNext ? `${t('autoOn')}·${t('stopAuto')}` : t('autoNext')),
          ),
          h('div', { className: 'rp-msgs', ref: scrollRef }, rows.length === 0 ? h('div', { className: 'rp-hint', style: { padding: '10px 0' } }, t('emptyStory')) : rows),
          h(
            'div',
            { className: 'rp-composer' },
            h('textarea', {
              className: 'rp-input',
              value: input,
              placeholder: t('composer'),
              onChange: (e) => setInput(e.target.value),
              onKeyDown: (e) => {
                if (e.key !== 'Enter' || e.shiftKey) return
                const native = e.nativeEvent
                if (native && native.isComposing) return
                e.preventDefault()
                send()
              },
              disabled: streaming,
            }),
            h('button', { className: 'rp-btn primary', onClick: send, disabled: streaming || input.trim() === '' }, streaming ? '…' : t('send')),
          ),
        )
      }

      const items = stories.map((s) =>
        h(
          'li',
          { key: s.id },
          h('button', { className: `rp-item${s.id === selectedId ? ' active' : ''}`, onClick: () => setSelectedId(s.id), title: s.title },
            h('span', { className: 'rp-item-name' }, s.title),
            h('span', { style: { fontSize: '10px', color: 'var(--dsw-alias-label-secondary)' } }, `${(s.characterIds ?? []).length}${t('charsCount')}`),
          ),
        ),
      )

      // 没有主插件时无法读写角色卡，直接给出提示。
      // 角色卡数量不再拦截：新建故事时可以让 AI 直接生成角色。
      if (hub === null) {
        return h(
          'div',
          { className: 'rp-anchor' },
          h(
            'div',
            { className: 'rp-root' },
            h('style', null, STYLE),
            h(
              'div',
              { className: 'rp-placeholder', style: { flex: 1 } },
              h('div', { style: { fontSize: '30px' } }, '🔌'),
              h('div', { style: { fontWeight: 600 } }, t('needMain')),
              h('div', null, t('needMainHint')),
            ),
          ),
        )
      }

      return h(
        'div',
        { className: 'rp-anchor' },
        h(
          'div',
          { className: 'rp-root' },
          h('style', null, STYLE),
          h(
            'aside',
            { className: 'rp-side' },
            h('div', { className: 'rp-side-head' }, h('span', null, t('title'))),
            h('ul', { className: 'rp-list' }, items),
            h(
              'div',
              { className: 'rp-side-foot' },
              h('button', { className: 'rp-btn', style: { width: '100%' }, onClick: () => setCreateOpen(true) }, `+ ${t('newStory')}`),
            ),
          ),
          h('main', { className: 'rp-main' }, main),
          createOpen
            ? h(CreateModal, {
                t,
                plot: createPlot,
                setPlot: setCreatePlot,
                generating: generatingStory,
                error: createError,
                onGenerate: runGenerateStory,
                onCustom: () => {
                  setCreateOpen(false)
                  setCreatePlot('')
                  startNew()
                },
                onClose: () => {
                  setCreateOpen(false)
                  setCreatePlot('')
                  setCreateError('')
                },
              })
            : null,
        ),
      )
    }

    // ---------- 新建故事弹层 ----------

    function CreateModal({ t, plot, setPlot, generating, error, onGenerate, onCustom, onClose }) {
      return h(
        'div',
        {
          className: 'rp-overlay',
          onClick: (e) => {
            if (e.target === e.currentTarget && !generating) onClose()
          },
        },
        h(
          'div',
          { className: 'rp-modal' },
          h('div', { className: 'rp-modal-head' }, h('div', { className: 'rp-modal-title' }, t('newStory')), h('button', { className: 'rp-btn', onClick: onClose, disabled: generating }, t('cancel'))),
          h(
            'div',
            { className: 'rp-modal-body' },
            h(
              'button',
              { className: 'rp-choice', onClick: onCustom, disabled: generating },
              h('b', null, t('modeTurn') === 'turn' ? '手动创建' : '手动创建'),
              h('span', null, '自己选角色、写背景'),
            ),
            h('div', { className: 'rp-hint', style: { marginTop: '10px' } }, t('genKeywords')),
            h('textarea', {
              className: 'rp-text rp-textarea',
              value: plot,
              placeholder: t('genKeywordsPlaceholder'),
              disabled: generating,
              onChange: (e) => setPlot(e.target.value),
            }),
            h('div', { className: 'rp-hint' }, t('genKeywordsHint')),
            h('div', { style: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)', opacity: 0.85 } }, t('genCreatesCards')),
            error === '' ? null : h('div', { className: 'rp-err-text' }, error),
            h(
              'div',
              { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' } },
              h('button', { className: 'rp-btn primary', onClick: onGenerate, disabled: generating || plot.trim() === '' }, generating ? t('generatingStory') : t('genStart')),
            ),
          ),
        ),
      )
    }

    // ---------- 故事编辑器 ----------

    function StoryEditor({ t, draft, characters, onSave, onCancel, onDelete, onGenerateOpening }) {
      const [title, setTitle] = useState(draft.title ?? '')
      const [scene, setScene] = useState(draft.scene ?? '')
      const [characterIds, setCharacterIds] = useState(Array.isArray(draft.characterIds) ? draft.characterIds : [])
      const [playAsId, setPlayAsId] = useState(draft.playAsId ?? null)
      const [openingText, setOpeningText] = useState(typeof draft.openingText === 'string' ? draft.openingText : '')
      const [openingMessages, setOpeningMessages] = useState(Array.isArray(draft.openingMessages) ? draft.openingMessages : [])
      const [openingBusy, setOpeningBusy] = useState(false)
      const [openingError, setOpeningError] = useState('')

      // 生成开场白：由父组件调模型，结果回填到这里。
      const runOpening = async (payload) => {
        if (openingBusy || typeof onGenerateOpening !== 'function') return
        setOpeningBusy(true)
        setOpeningError('')
        try {
          const result = await onGenerateOpening(payload)
          if (result === null || result === undefined) {
            setOpeningError(t('openingFailed'))
            return
          }
          setOpeningText(typeof result.text === 'string' ? result.text : '')
          setOpeningMessages(Array.isArray(result.messages) ? result.messages : [])
        } catch (e) {
          setOpeningError(e instanceof Error ? e.message : String(e))
        } finally {
          setOpeningBusy(false)
        }
      }

      const toggle = (id) => {
        setCharacterIds((prev) => {
          const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          // 被移出阵容的角色不能再当「你」。
          if (playAsId !== null && !next.includes(playAsId)) setPlayAsId(null)
          return next
        })
      }

      // 只有已选进阵容的角色才能作为「你」。
      const candidates = characters.filter((c) => characterIds.includes(c.id))

      return h(
        'div',
        { className: 'rp-editor' },
        h('div', { style: { fontWeight: 600 } }, '🎬'),
        h(
          'div',
          { className: 'rp-field' },
          h('label', null, t('storyTitle')),
          h('input', { className: 'rp-text', value: title, onChange: (e) => setTitle(e.target.value), autoFocus: true }),
        ),
        h(
          'div',
          { className: 'rp-field' },
          h('label', null, t('storyScene')),
          h('textarea', { className: 'rp-text rp-textarea', style: { minHeight: '110px' }, value: scene, onChange: (e) => setScene(e.target.value), placeholder: t('storySceneHint') }),
        ),
        h(
          'div',
          { className: 'rp-field' },
          h('label', null, t('pickCharacters')),
          h(
            'div',
            { className: 'rp-chips' },
            characters.map((c) =>
              h(
                'button',
                { key: c.id, className: `rp-chip${characterIds.includes(c.id) ? ' on' : ''}`, onClick: () => toggle(c.id) },
                h(Avatar, { char: c, className: 'rp-chip-av' }),
                c.name,
              ),
            ),
          ),
          h('div', { className: 'rp-hint' }, t('pickCharactersHint')),
        ),
        h(
          'div',
          { className: 'rp-field' },
          h('label', null, t('playAs')),
          h(
            'div',
            { className: 'rp-chips' },
            h(
              'button',
              {
                className: `rp-chip${playAsId === null ? ' on' : ''}`,
                onClick: () => setPlayAsId(null),
              },
              '👁 ' + t('playAsNone'),
            ),
            candidates.map((c) =>
              h(
                'button',
                {
                  key: c.id,
                  className: `rp-chip${playAsId === c.id ? ' on' : ''}`,
                  onClick: () => setPlayAsId(c.id),
                },
                h(Avatar, { char: c, className: 'rp-chip-av' }),
                c.name,
              ),
            ),
          ),
          h('div', { className: 'rp-hint' }, t('playAsHint')),
        ),
        h(
          'div',
          { className: 'rp-field' },
          h('label', null, t('openingLabel')),
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' } },
            openingText === ''
              ? h('span', { className: 'rp-hint' }, t('openingEmpty'))
              : h(
                  'div',
                  { className: 'rp-opening-preview' },
                  openingText
                    .split('\n')
                    .slice(0, 6)
                    .map((line, i) => h('div', { key: i, className: /^\[\[/.test(line.trim()) ? 'rp-opening-name' : '' }, line)),
                ),
          ),
          h(
            'div',
            { style: { display: 'flex', gap: '8px', marginTop: '6px' } },
            h(
              'button',
              {
                className: 'rp-btn',
                onClick: () => runOpening({ title, scene, characterIds, playAsId }),
                disabled: openingBusy || characterIds.length < 2,
              },
              openingBusy ? t('openingGenerating') : openingText === '' ? t('openingGen') : t('openingRegen'),
            ),
            openingText === ''
              ? null
              : h('button', { className: 'rp-btn', onClick: () => { setOpeningText(''); setOpeningMessages([]) } }, t('openingClear')),
          ),
          h('div', { className: 'rp-hint' }, t('openingHint')),
          openingError === '' ? null : h('div', { className: 'rp-err-text' }, openingError),
        ),
        h(
          'div',
          { className: 'rp-editor-actions' },
          onDelete === undefined ? null : h('button', { className: 'rp-btn danger', onClick: onDelete }, t('delete')),
          h('button', { className: 'rp-btn', onClick: onCancel }, t('cancel')),
          h(
            'button',
            {
              className: 'rp-btn primary',
              onClick: () =>
                onSave({ ...draft, title, scene, characterIds, playAsId, openingMessages }),
              disabled: title.trim() === '' || characterIds.length < 2,
            },
            t('save'),
          ),
        ),
      )
    }

    // ---------- 插件入口 ----------

    // 由 apply 注入的 Client Context，供 StoryView 读取共享服务。
    let ctxRef = { current: null }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctxRef.current = ctx
        const slots = ctx.get('slots')
        if (slots === undefined) throw new Error('roleplay story requires the client slots service')
        const t = (key) => ZH[key] ?? key
        const disposer = slots.inject('conversation.view', () =>
          slots.register({ name: 'conversation.view', id: 'roleplay-story', order: 60, label: () => t('viewLabel') }, (props) =>
            StoryView({ ...props, t }),
          ),
        )
        return () => {
          try {
            disposer()
          } catch {
            /* best-effort teardown */
          }
          ctxRef.current = null
        }
      },
    }
  },
})
