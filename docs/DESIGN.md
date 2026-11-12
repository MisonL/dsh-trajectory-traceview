# 设计方案：轨迹全历史检索 + 稳定锚点

> 基线：`dsh-trajectory-traceview` v0.3.0（MIT，上游 AFAP）
> 目标 dsh：`0.2.1-rc.5`
> 本文描述 v1 的设计；v2 的 "从某步分叉重放" 只在范围一节出现，不在此展开。

---

## 1. 目标与非目标

### v1 目标

| 编号 | 目标 | 判据 |
|---|---|---|
| G1 | **全历史检索**：搜索覆盖整个持久会话，不再只有已加载窗口 | 长会话中能搜到早期轮次的工具参数与结果，并能跳过去 |
| G2 | **稳定锚点**：每条 **durable** 记录有可复制、跨页面重载不变的引用（未落定的合成记录明确不可深链） | 复制锚点 → 刷新 → 粘贴 → 精确回到同一条记录；合成记录的复制入口给出"未持久化"提示而非坏链 |
| G3 | **不改官方行为**：官方「轨迹」页签、Chat、会话窗口语义完全不受影响 | 卸载本插件后一切恢复；与官方页签并存无冲突 |
| G4 | **动作时间点与空档**：动作的起止**行内常驻**可见（不必悬停），且"什么都没发生"的间隔被**标注**出时长与保守归因 | 能回答"这条命令是几点跑的、几点结束"和"这两步之间那 4 小时在等什么" |
### v1 非目标（明确不做）

> 注：G4 见第 11 节。经复核后它的构成已变化——T1/T3/T4 属纯呈现并入 M1，T2 因需复刻官方时钟轴投影而移入 M2，T5 待核实。

只有以下五条：

1. 从某步 fork 重放（v2）
2. 上下文归因分解（v2，需另一个方案）
3. 失败/循环显式标记（v2）
4. 用模型解读轨迹（不做：要花 token 且是二手叙述）
5. 替换或接管官方「轨迹」页签

---

## 2. 事实基线（已实测，非推断）

| 事实 | 证据 |
|---|---|
| **快照必须通过视图 props 的 `useTrajectory` 取，不能读 `sessionSnapshot.views`**。`useTrajectory` 是 `SnapshotSelectorHook<TrajectorySnapshot>`，已声明在 `SessionStandardProps` 上；运行时实测视图收到的 props 含 `useSession / useConversation / useInput / useTrajectory / useChat / useProjection / useAccess / renderFactorySlot / t / loadOlder / inspectCall / viewRequest / openView / completeViewRequest`。**`sessionSnapshot` 上没有 `views` 字段**，旧写法 `useSession((s) => s.views.get("trajectory"))` 会在渲染时抛 `Cannot read properties of undefined (reading 'get')` | `dsh-client-ui-trajectory/lib/types/client/trajectory-contract.d.ts:59-82`（快照接口 + `SessionStandardProps.useTrajectory`）；浏览器实测（2026-11-12，见 §12.9） |
| **`useTrajectory(selector, equalityFn?)` 是 `useSyncExternalStoreWithSelector` 的包装**：`selector` 的返回值必须引用稳定，否则触发无限重渲染。本项目用 `(v) => v ?? EMPTY_SNAPSHOT`——快照对象本身是新的则自然更新，`null` 时回落到模块级常量，两种情况都稳定 | `dsh-client-ui-renderer` 的 `bindSnapshotSelector` 实现（`useSyncExternalStoreWithSelector`）；`dsh-client-ui-trajectory/lib/types/client/trajectory-contract.d.ts:70` |
| `TrajectorySnapshot` 的字段：`eventNodes` / `eventLocations` / `requests` / `callSchemas` / `partial` / `runningCalls` / `systemPrompts?`。本项目依赖其中五个（`eventNodes`、`requests`、`callSchemas`、`partial`、`runningCalls`），**全部存在** | 同上 `trajectory-contract.d.ts:59-68` |
| 分页靠 `hasMore` / `loadingOlder` / 注入的 `loadOlder()`。**这两个字段确实在公开的 `SessionSnapshot` 上**（与 `views` 不同——那个不在），所以 `useSession((s) => s.hasMore)` 合法 | `dsh-api-session-controller/lib/types/client/contract/snapshot.d.ts:58-80`（`:71` `hasMore`、`:72` `loadingOlder`；整个接口没有 `views`）；fork 从 props 取 `loadOlder` |
| `loadOlder()` 会**把更早历史 prepend 进当前加载窗口**，每页 **≥50 条消息、≤500 条** | `dsh-api-session-controller/lib/types/client/sessions/session.d.ts` |
| 会话面上有 `loadThrough(seq)`："page backwards until the window covers seq"；traceview 取的是同一个 `session` 对象（`SessionBinding.session` → `SessionFace` → `ISession`） | 同上 `session.d.ts`；`inject` 的 `loadOlder` 处 |
| `SessionSeq` **只接受非负安全整数**，小数直接 `throw TypeError` | `dsh-session/lib/index.js:21-22`（运行时校验） |
| 合成（chunk-only）助手前缀会用**小数 seq**；插件自己也在 `lastTurnEntry.seq + 0.5` 处造临时 partial，随后在 durable 补正处换成整数 seq | `records.d.ts` AssistantMessageNode；fork 的 `newStepState` 与 `lastTurnEntry.seq + 0.5` 处 |
| 官方时间线 **tooltip 已渲染"开始 → 结束"**（结束时间由 `startedAt + durationMs` 推算） | `dsh-client-ui-trajectory/lib/client.js:6360-6371` |
| 官方工具栏的「实际时间」(`toolbar.actualTime`) 开关**在本安装版是 `hidden: true`**，用户点不到 | 同上 `:6090-6112` |
| 纯数据层可切片、可单测，且**基线当前是绿的** | `//#region pure helpers: snapshot -> timeline tree`（region 名，勿用行号）；`node test/smoke.test.cjs` → `OK — turns=4 steps=4 stations=11` |
| station.id **大多已是数据派生、跨页稳定**：用户 `u{seq}`、工具 `t{callId}`、special `m/e/y/x/c{seq}` | `client.js:619/657/706/746/805/813/819/826/830` |
| **唯一不稳定的是 step 站点**：`newStepState()` 不设 `id`，回退 `s{stepCounter}`（按窗口内顺序编号） | `newStepState` 定义处、`937` |
| **`st.seq` 是被反复改写的排序键，不可当身份**：`newStepState(n.seq)` 处（step 首次创建） 建时传 `n.seq`、`newStepState(c.time)` 处（runningCalls-only step） 传 `c.time`（epoch 毫秒）、`deriveTraceTree` 的 `lastTurnEntry.seq + 0.5` 合成处 传 `seq+0.5`、`deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`） min-reduce 收敛、`:863-865` 作排序键（另 `pieceList` 的 min-sort 处 参与 turn 级 min） | `newStepState(n.seq)` 处（step 首次创建）、`698`、`720`、`633`、`863-865` |
| **`eventNodes[].seq` 本身可能是小数**：官方为"有中断证据但只有分片"的助手消息合成 `seq: boundary.seq - .9`，并放入 `eventNodes` | `dsh-client-ui-trajectory/lib/client.js:1497-1504`、`:2193-2200`、`:2232-2240` |
| 助手节点的 `messageId` 只在**合成中断兜底**上缺失 → 可作为持久性判据 | `records.d.ts:68-73`（"Absent only on synthetic interruption fallbacks"） |
| 官方合成的中断节点**确实没有** `messageId` 字段（连带 `seq: boundary.seq - .9`） | `dsh-client-ui-trajectory/lib/client.js:1496-1504`（`seq` 在 `:1498`） |
| `nid()`（`n{seq}`）是**死代码**，从未被调用 | 定义于 `pieceList` 的 `at: st.seq` 处，全文件无调用 |
| 当前搜索只在已加载窗口内 | `hay` 在 `880/954/981` 拼装，语料来自当次 derive 的 stations；`matchStations` 线性扫 |
| `time` 是 **Unix epoch ms**（官方类型注释，逐节点声明） | `dsh-client-ui-conversation/.../records.d.ts`："Unix epoch ms from the source session event" |
| `seq` 在**持久契约**上是整数；只有合成（chunk-only、无持久事件）的助手前缀用小数 seq 维持排序 | `records.d.ts` AssistantMessageNode.interrupted 注释 + `dsh-session` 的 `SessionSeq()` 运行时校验 |
| 步骤起点/首 token 时间**可能为 null**（起点在窗口外时） | `records.d.ts` AssistantTiming："or null when it is outside the current event window" |
| 工具的 `call`（名字/参数配对）与 `callTime`（发起时刻）**同时为 null**（call 落在窗口外时） | `records.d.ts` ToolResultNode.call："null when window truncation left the call outside"；同文件 `callTime: number | null`："when the call is still in-window" |
| **压缩不销毁历史**：compaction 标记只报告"模型从哪里停止看到那段历史"，**不替换历史** | `records.d.ts` CompactionSummaryNode 注释："the marker reports where the model stopped seeing that history, it does not replace it" |
| 视图注册为 `id: "traceview"`、`order: 20`（已实测；官方 `trajectory` 是 `order: 10`） | `lib/client.js` 的 `ctx.slots.register({...})` 处；官方 `dsh-client-ui-trajectory/lib/client.js:8207-8208` |
| **包名出现在 25 处（不含 docs/）**：`README.md` 8、`README.en.md` 8、`cordis.patch.yml` 3、`lib/client.js` 3、`package.json` 2、`test/smoke.test.cjs` 1 | 全仓库 grep 计数 || 上游 `package.json` **完全没有 `engines` 字段** | 文件全文无 `engines` |
| 仓库无 `src/`、无构建脚本（发布物即仓库内容，但可读、分 region） | 目录树与 `package.json` 无 `scripts` |

---

> **引用方法学（写给后续改这份文档的人）**
>
> 1. **本仓库自己的代码（`lib/client.js`）一律用符号引用，不用行号**：写 `newStepState`、`deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`）、`lastTurnEntry.seq + 0.5`、region 名等。原因：本文档的每一次实现都会让行号整体偏移，而行号一旦过期就会误导审查者以为找到了证据。2026-11-12 的实测就吃过这个亏——§2 与模块地图里的行号在加入锚点代码后全部失效。
> 2. **只有第三方官方包（`node_modules/@deepseek-ai/**`）才用行号**，因为它们随版本锁定、且我们不修改。
>
> 以下是官方包行号的取法（历史教训）：官方包行号必须用 `grep -n` 直接对**原始文件**取。不要用 `awk 'length($0)<400' file | grep -n` 这类"先过滤再编号"的写法——那是过滤后的序号，与真实行号有偏移（`dsh-client-ui-trajectory/lib/client.js` 就因此差了 5 行，本文曾把 `:6194` 写成 `:6189`、`:6223` 写成 `:6218`，已修正）。大 CSS 单行的文件尤其容易踩。

## 3. 关键设计决策

### D1 — 锚点锚在数据身份上，并补上唯一缺失的一类

上游的 id **大多已经是数据派生的**（用户 `u{seq}`、工具 `t{callId}`、special `m/e/y/x/c{seq}`），跨分页稳定。真正的问题只有两个：

1. **step 站点没有稳定 id**：`newStepState()` 不设 `id`，于是回退到 `s{stepCounter}`，按窗口内顺序编号，窗口一变就重排。而 step 恰好是人们最想引用的对象。
2. **缺一个跨会话可解析的人类标签**：现有 id 是内部形态（`u17`、`tcall_x`），贴进对话里没有意义。

#### 不能复用 `st.seq` 当身份

`st.seq` 是个**为排序服务、会被反复改写**的字段，语义随到达顺序漂移：

| 位置 | 写入值 | 含义 |
|---|---|---|
| `newStepState(n.seq)` 处（step 首次创建） | `n.seq` | 创建时用助手事件的 seq（**但 `n.seq` 自身可能是小数**，见下） |
| `newStepState(c.time)` 处 | **`c.time`** | **epoch 毫秒时间戳**（streaming 先建 step 时） |
| `deriveTraceTree` 的 `lastTurnEntry.seq + 0.5` 处 | `seq + 0.5`（无前序时 `0.5`） | 合成小数，用于排在 durable 之前 |
| **`deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`）** | `min(st.seq, n.seq)` | durable 事件到达后补正：`if (st.seq > n.seq) st.seq = n.seq` |
| `pieceList.sort` 处 | 作为 `pieceList.sort((a,b) => a.at - b.at)` 的排序键 | 也在 `pieceList` 的 min-sort 处 参与 turn 级 min 排序 |

**关键：`eventNodes[].seq` 本身就不保证是整数。** 官方投影会为"有中断证据但只有分片"的助手消息合成节点：`seq: boundary.seq - .9`（`dsh-client-ui-trajectory/lib/client.js:1497-1504`），随后放进 `eventNodes`（`:2193-2200`、`:2232-2240`）。所以**在助手折叠处无条件写 `anchorSeq` 仍会发出小数坏锚点**——这是我上一版修法的漏洞。

#### 锚点设计

- **稳定键（内部）**：`e{seq}` / `c{callId}`。**签发条件必须显式校验**：`Number.isSafeInteger(n.seq) && n.seq >= 0`，且该助手节点带有 durable `messageId`（官方注释：`messageId` 只在合成的中断兜底上缺失，见 `records.d.ts:68-73`）。两条任一不满足 → 不签发 `e` 锚点。
- **合成键**：`p{turn}s{step}`，标记 `synthetic: true`、不可深链。**不能只用 `p{turn}`**——一轮里可能有多个合成 step，会碰撞。
- **可读标签**：`t{turn}·s{step}`，仅在全史解析后生成；未解析时只给稳定键。

#### 合成 → durable 的往返

用户可能先复制了 `p3.s1`，之后该 step 落定为 durable（有了 `e{seq}`）。规则：

- 旧 `p` 锚点**不做静默重定向**。粘贴后若该 turn/step 已可解析为 durable，提示"该记录已落定，请改用 `e{seq}`"，并直接定位到同一条记录（因为 turn/step 坐标相同）
- 反向（用户在 durable 之前粘贴 `e` 引用）不可能发生，因为 `e` 只在落定后签发

两者都暴露，但不混用。可读标签是给人看的，稳定键是给机器解析的。

### D2 — 全历史检索**改走宿主侧 FTS5**，放弃客户端分页灌窗口（初版判断已被实测推翻）

初版（2026-11-03）选的是"客户端 `loadOlder()` 分页 + 内存索引"，理由是"纯客户端、不动宿主、可回滚"。**2026-11-12 的实测把这条判断推翻了。**

**实测数据**（审计本机 `~/.dsh/sessions`：376 个会话日志、压缩 213.99 MB、解压 677.80 MB、409,957 个事件）：

| 指标 | 最大真实会话 |
|---|---|
| 事件数 | 58,994 |
| 原文体积 | ≈92.8 MiB |
| turn/start | 164 |
| assistant message/step | 5,313 |
| tool/call · tool/result | 5,363 · 5,396 |
| 按官方分页参数（maxMessages=500 / minMessages=50 / minTurns=2）反推页数 | **58 页** |
| 索引条目估算 | ≈6,834（5,313 step + 995 user + 517 特殊） |
| 4 KiB 截断后的 `hay` | ≈22.49 MiB（1,044/6,834 条被截断；不截断约 34.1 MiB） |

三条致命结论：

1. **窗口会被灌满且不回收。** 官方 event source 的 prepend 是纯 concat，**没有 eviction/上限**；Chat 主滚动区**没有虚拟化**——`useVirtualizer` 只属于 TurnNavigator 轨道（`dsh-client-ui-chat/lib/client.js:290`），主聊天区是全量 `entries.map(...)`（Chat 主滚动区的 `entries.map`）。所以 58 页历史会全部参与 React 渲染并常驻内存。滚动有 anchor 保护、历史不会被静默撤销，但**成本是实打实的**。
2. **derive 是 O(N²)。** `deriveTraceTree`（region `pure helpers`）每次对全部 nodes 排序并多次全扫描；58 页累计扫描约 **1,864,792** 个事件（≈最终 59,108 的 **31.5 倍**）。
3. **32 MiB 预算过于乐观。** 光 `hay` 就 22.49 MiB，还没算 Map、key、meta、数组和 station 对象。

**因此改用宿主侧 FTS5。** `dsh-session-query-sqlite` 提供 FTS5（`session_id = ?`），`dsh-session-query` 冷读完整日志并抽取 user/assistant/tool call/result/todo/turn-end 文本建文档。优点：**不进窗口**、无 O(N²) derive、无 Chat DOM 增长。代价：要启用 SQLite backend 并在宿主组合里挂上，且需要一条"查询结果 → station 坐标"的适配。

**启用路径已核实（比初版估计的简单得多）**：

- `session-query-sqlite` 在 `dsh-base` 里**已经挂载**（`dsh-base/cordis.patch.yml:157-161`），只是 `openAt: never` 默认关闭；`dsh-web-app/cordis.patch.yml:27-31` 又用 `:memory:` + `never` 重申了一次
- 官方注解明说启用方式就是"在更后的 patch 层覆盖 `openAt` 为 `first-search` 或 `startup`，通常配一个持久 `path`"（`dsh-base/cordis.patch.yml:153-156`）
- `openAt` 合法值为 `startup | first-search | never`（`dsh-session-query-sqlite/lib/index.js:1089-1093`）；`never` 时任何全文调用直接抛 `SESSION_QUERY_SEARCH_DISABLED`（`:594-595`）
- **但检索工具 `dsh-tool-session-query` 默认没挂**，它只在 `dsh-experimental-session-search` bundle 里（该 bundle 自带一份 `isolate.sessionQuery` 的 `openAt: first-search`）

所以 M2 的实现路径是：**在 profile 的 `cordis.patch.yml` 覆盖 `openAt`（配持久 `path`），并挂上检索能力**——要么启用 `dsh-experimental-session-search` bundle，要么只挂工具行。不需要自己写 host 插件。

**重要更正**：初版拒绝宿主方案的理由"这些工具默认排除调用方自身会话"**不成立**。`session_search` 确实排除调用方（`dsh-tool-session-query/lib/index.js:748-786`），但**同文件的 `session_event_search` 能检索调用方自身会话**：`targetId(args, caller)` 未显式指定时就是 `caller.id`（`:453-454`），只把上界压到当前调用 step 之前（`:794-798`）。工具描述也明说 "current session excludes the step performing this call"（`:965-966`）。

**客户端分页未完全出局，但已降级**：只有在"独立/虚拟化的检索窗口"或"严格增量 derive + no-progress/generation 守卫 + 含对象开销的硬预算"这两条前提满足时才可行。按现稿不成立。

### D3 — 索引是会话级、内存、可丢弃的派生数据

不落盘（v1）。理由：语料含工具结果全文，体积不可控且含潜在敏感内容；落盘还带来"索引与日志不一致"的一致性问题。代价是每次打开会话需重建（可接受：只在用户显式触发"拉全史"时付出）。

### D4 — 不碰官方槽位、不复用官方 view id

- 继续注册到 `conversation.view`，用自己的新 id
- 不动 `conversation.trajectory.images`、`conversation.chat.flow` 等标记 `shadows-shipped-ui` 的槽
- 与上游原版插件**不共存**：官方原版是 order 10，本插件当前是 order 20（改名后计划提到 21），两者 order 不同，但会同时注册两个标签页，界面出现**重复 tab**；文档写明须先移除原版。另：`loadThrough` 在普通 `loadOlder` 正在分页时会直接返回（`client.js:346-351`），且其失败会被吞掉（`client.js:313-335`），所以深链定位必须等待/重试并显式传播失败，不能假定一次调用就到位。

### D5 — 身份与打包改造

| 项 | 上游 | 本方案 | 位置 |
|---|---|---|---|
| 包名 | `dsh-trajectory-traceview` | `dsh-trajectory-traceview-plus` | `package.json:2` |
| patch id / row **name** | `dsh-trajectory-traceview` | `dsh-trajectory-traceview-plus`（`name` 必须与包名逐字节一致） | `cordis.patch.yml:9-10` |
| **客户端模块 id** | `dsh-trajectory-traceview` | 必须同步改名，否则 client module graph 按行名找不到包 | `__ModuleLoader__.load({ id: ... })` 的 `id` 字段 |
| 样式标签 id | `dsh-trajectory-traceview/traceview.css` | 改名，避免与原版共用同一 `<style id>` | `const tagId = "dsh-trajectory-traceview/traceview.css"` 处 |
| `dataset.plugin` 标记 | `dsh-trajectory-traceview` | 改名，便于卸载时精确清理与调试定位 | `tag.dataset.plugin` 赋值处 |
| view id | `traceview` | `traceview-plus` | `ctx.slots.register({...})` 的 `id` 字段 |
| order | 20 | 21（避开原版；也避开官方的 10） | `ctx.slots.register({...})` 的 `order` 字段 |
| `repository.url` | 指向上游仓库 | 改指你自己的 fork | `package.json:27` |
| `README.md` / `README.en.md` | 各含 **8 处**旧包名（add/update/remove 命令、安装后路径、F12 调试提示） | 逐处改，且要与新的安装方式一致 | `README.md` / `README.en.md` |
| `test/smoke.test.cjs` | 文件头注释含旧包名 1 处 | 同步改 | `test/smoke.test.cjs:1` |
| `cordis.patch.yml` 头注释 | 含旧包名 1 处 | 同步改 | `cordis.patch.yml:1` |
| engines | **完全没有** | `dsh: ">=0.2.1-rc.1"`, `node: ">=22"` | 新增 |
| LICENSE | MIT | 保留，并在 README 注明来源与改动 | 文件 |

---

## 4. 锚点详设（G2）

### 4.1 语法

```
tvp1:e<seq>                     # durable 记录：seq 必须是整数（SessionSeq 契约）
tvp1:e<seq>#t3s7                # 同上 + 人类提示（解析以 e 为准）
tvp1:c<callId>                  # 工具结果的易读别名，实际解析成某个整数 seq
tvp1:p<turn>s<step>             # 合成 step：未持久化，不可深链
tvp1:p<turn>s<step>c<callId>    # 合成工具结果：同 step 内多个调用靠 c 后缀区分
tvp1:t<turn>s<step>             # 可读形式，仅在全史解析后生成（别名）
```

六种写法，五种解析分支（`e` 的两种写法共用一支）。

`tvp1` 是版本前缀，便于将来换语法而不误解析旧文本。

#### 签发规则：记录类型 × 持久状态 矩阵

每条记录有 **durable / synthetic 两态**，必须分列。单写一态、另一态用"否则"带过，是这份文档前四轮反复出错的根因。

| 记录类型 | 状态 | 锚点形态 | 前置条件 | 证据 |
|---|---|---|---|---|
| 助手消息 | durable | `e{seq}` | `Number.isSafeInteger(seq) && seq >= 0` **且** 带 `messageId` | `records.d.ts:68-73`；官方合成块 `:1496-1504` 无该字段 |
| 助手消息 | synthetic | `p{turn}s{step}` | 无 `messageId` 或 seq 非整数 | 官方 `seq: boundary.seq - .9`（`:1497-1504`） |
| 工具结果（其 assistant 头在窗口内） | durable | `e{seq}`，别名 `c{callId}` | 已落定 `ToolResultNode`，seq 为整数 | `records.d.ts` ToolResultNode 有 `seq` |
| 工具结果（**assistant 头在窗口外**，孤立） | durable | `e{seq}`，别名 `c{callId}` | **需要新建 station**（见 §6 改动项 O1） | `records.d.ts:156-175`（`call` 可因窗口切分为 `null`）；官方明确渲染 orphan result（`client.js:7105`） |
| 工具结果 | synthetic（被中断） | `p{turn}s{step}c{callId}` | 无 durable result 事件 | 官方 `kind: "tool-result"`、`seq: interruptedAt.seq - .8`（`:2416-2439`） |
| 用户 / 命令 / 压缩 / steering | durable | `e{seq}` | seq 为整数 | 各自 `seq` 注释指向真实事件 |
| 未落定 partial 里的工具 cell | synthetic | 不单独签发 | 官方 `PartialAssistant` 不带持久身份 | `records.d.ts:297-301` |
| 只由 runningCalls 建出的 step | synthetic | `p{turn}s{step}` | 无助手事件 | `deriveTraceTree` 的 runningCalls-only 分支 |

**为什么"整数"不是充分判据**：`eventNodes[].seq` 里混着小数，且**不止助手一类**——官方两处合成：

- 助手中断兜底：`seq: boundary.seq - .9`（`client.js:1497-1504`），入 `eventNodes`（`:2193-2200`、`:2232-2240`）
- **工具调用被中断**：`seq: interruptedAt.seq - .8`、`kind: "tool-result"`（`client.js:2416-2439`），入 `eventNodes`（`:2205-2207`）

所以 `messageId` 只是**助手类**的附加判据；通用判据是"该记录有无 durable 事件 seq"。

**合成工具结果必须带 `c{callId}` 后缀**：同一 step 内可有多个工具调用，只用 `p{turn}s{step}` 会互相覆盖（索引按 key upsert）。

解析器遇到 `e1234.5` 一律拒绝并提示"该记录未持久化，无法深链"。

### 4.2 生成

- 在 `deriveTraceTree` 产出的每个 station 上补 `anchorKey`：优先 `e{seq}`，工具类用 `c{callId}`
- `seq` 来源：`snap.eventNodes[].seq`（`deriveTraceTree` 起始处已按 `seq` 排序）；`callId` 来自 tool cell（`t${b.callId}`，已验证）
- **step 站点：另开 `anchorSeq`，在 durable 补正处（`deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`），不是 634——634 是 `st.time`）写入**。不能只在创建处（`newStepState(n.seq)` 处（step 首次创建））写，因为 partial 先到时 630 不执行。
- **写入前必须按 §4.1 的表格逐节点校验**（不是对 step 用一条规则）。注意 `deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`） 所在分支**也会收到没有 `messageId` 的合成助手节点**，所以校验必须在写入点之前逐节点做。
- `st.seq` 在 `newStepState(c.time)` 处（runningCalls-only step） 会被写入 epoch 毫秒、在 `deriveTraceTree` 的 `lastTurnEntry.seq + 0.5` 合成处 会被写入 `+0.5` 合成值、在 `deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`） 被 min-reduce，所以**既不拿它当身份，也不拿它当签发依据**。
- **只由 runningCalls 建出的 step**（`deriveTraceTree` 的 runningCalls-only 分支）没有助手事件：给它 `p{turn}s{step}`；其内部工具 cell 只有在对应 `ToolResultNode` 已落定时才签 `c{callId}`。
- 取不到合法 `anchorSeq` 的 step 用 `p{turn}s{step}`；不再用 `s{stepCounter}`
- 不在渲染层临时算，避免与虚拟化窗口耦合

### 4.3 复制入口

- 选中 station 后，行内出现「复制锚点」（复用现有选中态）
- 同时进右键菜单（若引入），避免只依赖悬停
- 复制内容默认稳定形式；若已全史解析，附可读后缀

### 4.4 解析（含深链）

出现路径三条，统一走一个 `resolveAnchor(anchor)`：

1. 视图挂载时读 `location.hash`（`#tvp1:...`）
2. 官方 `openView(view, focus)` 传入的 focus——**运行时实际传入的 owner props 只有四个**：`inspectCall`、`viewRequest`、`openView`、`completeViewRequest`（`dsh-client-ui-conversation/lib/client.js:18036-18041` 的 `renderSlot("conversation.view", {...})`）。所以必须读 `viewRequest.focus`，消费完调 `completeViewRequest()`

> **既有死代码警告**：fork 的组件签名解构的是 `inspect` / `onInspectDone`（组件签名处（`TraceMapView`）），并在 旧的 `inspect` 深链块 用它做"聊天→轨迹"深链。但**这两个名字在当前 DSH 运行时根本不存在**，值恒为 `undefined`，那条深链在这个版本上从未生效过。实现时必须改用 `viewRequest.focus`，并顺手删掉这对死参数。`inspectCall` 是**反方向**（视图→聊天打开工具检查器）的入口，可另行利用。
3. 用户粘贴到视图内搜索框

解析流程：

```
resolveAnchor(anchor)
  ├─ 形态校验（下面每个分支都必须存在，不许落到"其余即非法"）
  │    ├─ e{非整数}          -> 拒绝："该记录未持久化，无法深链"
  │    ├─ e{整数}            -> 直接按 seq 定位
  │    ├─ c{callId}          -> 在快照/索引里按 callId 找该工具结果：
  │    │                        ├─ 找到且 seq 为整数 -> 取其 seq 定位（c 只是易读别名）
  │    │                        ├─ 找到但 seq 为小数 -> 拒绝："该工具调用被中断，结果未持久化"
  │    │                        └─ 只在 partial 里    -> 拒绝："该调用尚未落定"
  │    ├─ p{turn}s{step}[c{callId}]
  │    │                     -> 查全史索引：
  │    │                        ├─ 已有 durable 对应项 -> 提示"已落定，请改用 e{seq}"，
  │    │                        │                        并对该 durable seq 走 loadThrough
  │    │                        └─ 仍无 durable 对应项 -> 留在当前窗口定位，深链 disabled
  │    └─ t{turn}s{step}     -> 可读形式，不是独立身份：先按坐标在索引里找到对应 durable
  │                             记录，再转成 e{seq} 走上面的路径；找不到则提示"需先拉取全史"
  ├─ 命中且已加载 -> seek(stationIndex) + 选中 + 高亮
  ├─ 命中但未加载 -> 先等 `loadingOlder` 结束，再 session.loadThrough(seq) -> seek
  └─ 查无此锚点   -> 提示"不在本会话"或"需先拉取全史"
```

**两种"别名"的区别**：`c{callId}` 与 `t{turn}s{step}` 都不是独立身份，只是指向某个整数 `seq` 的易读入口——排序、分页、`coverage` 一律用解析出的 `seq`。插件里的 tool cell 只带 `callId`（工具 cell 的 `id: `t${b.callId}`` 处），必须回 `ToolResultNode` 取 `seq`。

**孤立工具结果（assistant 头在窗口外）必须有 station 才能跳。** 当前 `deriveTraceTree` 只在助手 `tool-call` 块（助手 `tool-call` 块产出工具 cell 处）和 runningCalls（runningCalls 产出工具 cell 处）里产出工具 cell；主循环**没有 `n.kind === "tool-result"` 分支**，所以这类 durable 记录既搜不到也跳不到。这是 §6 的改动项 O1：新建 `orphan-tool` station，绑定 `ToolResultNode.seq` 与 `callId`。

`loadThrough` 有两个坑（`session.js:346-351` 在普通 `loadOlder` 占用时直接返回、`:313-335` 吞掉失败）：**必须等 `snapshot.loadingOlder` 为假再调用**，并把失败显式报给用户，不能假定一次调用即到位。

**关键：不要自己循环 `loadOlder()` 去够目标。** 会话面上有官方的 `loadThrough(seq)`，语义正是 "page backwards until the window covers seq"（`session.d.ts`），比手写循环精确且省事。traceview 已经通过 `ctx.sessions.binding(sessionId)?.session` 拿到这个对象，直接可用。

### 4.5 稳定性边界（写进文档，不许含糊）

- 锚点在**同一会话**内稳定；跨会话无效（seq 是会话内序号）
- 分叉（fork）后的子会话是另一份日志，锚点不继承
- **压缩不销毁历史**：官方类型注释明确——compaction 标记"报告模型从何处停止看到那段历史，**它不替换历史**"，被遮蔽的对话仍留在标记上方的 transcript 里（`records.d.ts` CompactionSummaryNode）。所以压缩前的锚点仍然可定位；残留风险只有一处：UI 可能把那段折叠起来，需要"已折叠但仍可定位"的呈现方式
- 记录本身可能缺半截数据：步骤起点在窗口外时 `timing.stepStartTime` 为 `null`；工具的 `callTime` 与 `call` 配对在 call 落在窗口外时为 `null`（`records.d.ts` 明示 "when the call is still in-window"）。锚点定位与时间点显示都必须容忍这些缺口

---

## 5. 全历史索引详设（G1）

### 5.1 数据结构

```js
IndexEntry = {
  key: "e1234",        // e{整数 seq} / c{callId} / p{turn}s{step}（合成）
  synthetic: false,    // true = 无持久事件，不可深链
  seq: 1234,           // 定位与排序的唯一依据；c{callId} 条目也要填（来自 ToolResultNode.seq）
                       // synthetic 条目恒为 null
  turn: 3, step: 7,    // 可读坐标（解析得出，可为 null）
  kind: "step" | "tool" | "user" | "compaction" | ...,
  label: "步骤 7",
  meta: ["bash", "ok", "41s"],
  hay: "…小写全文…",   // 有上限，见 5.3
  callIds: ["call_x"],
  truncated: false
}

TrajectoryIndex = {
  sessionId,
  entries: Map<key, IndexEntry>,
  coverage: { minSeq, maxSeq },   // 只统计 durable 条目
  hasMore: boolean,        // 尚未拉完
  bytes: number,           // 估算占用
  builtAt
}
```

**合成条目参与搜索，但不参与覆盖范围与排序基准。** 合成条目的排序值可能是 `x.5`，也可能是从 running call 继承来的 epoch 毫秒（`newStepState(c.time)` 处（runningCalls-only step） 那条路径），若混进 `coverage` 或当作排序键会让"覆盖到第几轮"和命中顺序都失真。因此：

- `IndexEntry` **自带 `seq: number | null`** 字段（不要从 key 里解析），synthetic 条目的 `seq` 一律记 `null`
- `coverage` 只用 non-synthetic 条目计算
- 排序：non-synthetic 之间按 `seq`；synthetic 条目排在**其 turn 内**、不参与跨轮排序
- **synthetic 同轮内的二级排序键也必须定义**（否则同轮多个合成条目顺序不稳定）：按 `(step, callId, key)` 字典序。这个序只用于**展示稳定**，不用于跨轮比较
- 命中 synthetic 条目时显示"未持久化"，深链按钮 disabled

### 5.2 采集循环（受控）

> **下面的客户端分页循环已被 D2 降级，不再是 v1 的主路径。** v1 改走宿主侧 FTS5（见 D2）。此节保留的原因：(a) 记录降级后的确切前提；(b) 若将来因宿主不可用而回退，需按此实现并满足全部守卫条件。

```
开始（用户显式触发）
  bind(cancelToken = {sessionId, openGeneration})      # 必须绑定，见下
  while (hasMore && !cancelled && tokens未过期 && bytes < BUDGET && pages < PAGE_BUDGET)
     before = snapshotIdentity
     await loadOlder()
     若 sessionId/openGeneration 已变 -> 立即 abort（不要往新会话的索引里写）
     若 loadOlder 返回后 hasMore 仍为真但 baseSeq 未前进 -> 记 no-progress，连续 2 次即停
     从最新快照 derive -> 取 stations -> upsert 进索引（按 key 幂等合并）
     更新 coverage / 进度
     每页后 yield，让出事件循环
  收尾：标记完成 / "因预算停止" / "无进展停止" / "已取消"
```

**必须实现的守卫（缺一条就不可用）**：

| 守卫 | 原因 | 证据 |
|---|---|---|
| **绑定 `sessionId` + `openGeneration`** | 跨处 resume/resync 会让 `openGeneration` 递增并丢弃旧 stream；旧循环继续写就会污染新索引 | `session.js:402-408` |
| **显式 no-progress 检测** | `loadOlder` 在未打开/无 hasMore/已在分页时**静默 return**；远端失败也被吞掉，调用方拿不到任何信号 | `session.js:313-318`、`:327-335` |
| **append/stream 期间暂停并重基线** | 循环期间用户发消息会改变快照，继续按旧游标 upsert 会错位 | 需在 append 后重读 baseline |
| **compaction / resync 时清空索引** | 压缩会替换事件流，旧索引与新快照不再对应 | — |
| **会话切换 = abort** | 视图 unmount 或切换会话时无 abort 会让循环继续跑 | — |

要点：

- **幂等合并**：按 `key` upsert，重复拉到同一页不会重复计数
- **`p` → `e` 换键要显式淘汰旧项**：`p{turn}s{step}[c{callId}]` 在合成→落定时会换成 `e{seq}`。合并时按 turn/step/callId 坐标认出是同一条，**删掉旧 `p` 条目**而不是两条并存
- **partial 被取消时要回收 stale `p`**：若该合成 step 随后从快照消失（用户中止、快照回滚），它的 `p` 条目必须在本轮合并结束时淘汰，否则索引里会留永不落定的僵尸条目
- **coverage 只用 non-synthetic 条目**（见 5.1）
- **`coverage` 不能当作"历史完整性"的证明**：`hasMore === false` 只表示"窗口顶部不再有更早的页"，若中途 no-progress 停止或预算触顶，顶部其实是空的。UI 必须区分"已覆盖到会话开头"与"因预算/错误停止"
- **不阻塞输入**：每页之间让出事件循环；正在流式生成时暂停
- **可中断**：随时取消，已建部分仍可用（标注覆盖范围）
- **不自动执行**：默认不拉全史，避免用户没要求就吃内存

### 5.3 语料预算（按实测修正）

初版拍的"单条 4 KB、总量 32 MB"**低估了对象开销**。按最大真实会话实测：

| 项 | 实测 |
|---|---|
| 截断后 `hay` 合计 | ≈22.49 MiB（6,834 条中 1,044 条被截断） |
| 不截断 `hay` 合计 | ≈34.1 MiB |
| 未计入 | Map 桶、key、meta、callIds 数组、station 对象、`truncated` 等标量 |

修正后的预算口径：

- **单条上限 4 KB 保留**（够检索，且截断率 15% 可接受）
- **总量预算改成 24 MiB，且必须把对象开销计入**：按每个条目约 200–400 B 的固定开销估算，6,834 条约 1.4–2.7 MiB，应计入同一预算池而非另算
- **达到预算就停，不静默截断**：UI 明确显示"因预算停止，已覆盖 X/Y"
- **不假设 32 MiB 够用**：若用户的会话比实测样本更大，先停再问，不要偷偷丢掉更早的页

### 5.4 搜索行为

- 有索引：先搜索引，命中项标 `来源：全史`
- 未建索引：回退到当前窗口内搜索，命中项标 `来源：已加载窗口`，并在空结果时提示可拉全史
- 命中排序：non-synthetic 按 `seq` 升序（时间序）；**synthetic 条目按其 turn 插在该轮内，不参与跨轮排序**（它们的 `seq` 是 `null`，见 5.1）。保留现有"下一个/上一个匹配"的交互
- 跳转：non-synthetic 命中项若不在窗口内，走 4.4 的 `loadThrough`；**synthetic 命中项直接在当前窗口定位，深链按钮 disabled**

### 5.5 UI

在现有工具栏加一个状态条，三态：

```
索引：仅已加载窗口（56 条）        [拉取全史]
索引：拉取中 34%  [中断]          覆盖至 第 12 轮
索引：全史（1,234 条）             覆盖 第 1–28 轮
```

---

## 6. 改动清单

| 文件 | 区域/内容 |
|---|---|
| `package.json` | 改名、`engines.dsh`、`version`、`repository`、`files` 增 `docs/` |
| `cordis.patch.yml` | `id` 与 `name` 同步改名（必须逐字节等于包名） |
| `lib/client.js` · 文件头（1–10） | **`__ModuleLoader__.load({ id: ... })` 同步改名**——client module graph 按 Loader 行名找包，漏改会导致插件不加载 |
| `lib/client.js` · styles（219–399） | `tagId`（390）与 `dataset.plugin`（393）改名，避免与原版共用同一 `<style id>` |
| `lib/client.js` · locale（12–218） | 新增索引状态、锚点复制/解析、错误提示文案（zh/en 同 key 集） |
| **`lib/client.js` · `//#region pure helpers` · 改动项 O1** | **新建孤立工具结果 station**：主循环目前**没有 `n.kind === "tool-result"` 分支**（只在首遍塞进 `resultsById`，`:567`），工具 cell 仅由助手 `tool-call` 块（助手 `tool-call` 块产出工具 cell 处）或 runningCalls（runningCalls 产出工具 cell 处）产出。因此当 assistant 头在窗口外（`records.d.ts:156-175` 的 `call === null`）时，该 durable 结果**既无 station 也无法 seek**。需在 `deriveTraceTree` 增一类 `orphan-tool` station（携带 `ToolResultNode.seq`、`callId`、`content`、`isError`、`call === null` 标记），并让其参与站点列表与索引；UI 上以"结果（调用头在窗口外）"呈现 |
| `lib/client.js` · region `pure helpers` | 新增 `anchorOf(station)`、`parseAnchor(str)`、`toIndexEntry(station, limits)`、`mergeIndex(prev, entries)`、`searchIndex(index, query)`、`resolveInIndex(index, anchor)`；`deriveTraceTree` 补 `anchorKey` / `anchorSeq`（step 另开字段，写入点 `deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`），签发条件见 §4.1），step 站点 id 不再用 `s{stepCounter}` |
| `lib/client.js` · region `horizontal timeline + replay component` | 搜索改走索引；索引状态条；复制锚点；`hash`/`focus` 解析；定位改用 `session.loadThrough(seq)`（不再手写分页循环）；**删除 `inspect`/`onInspectDone` 死参数（`:1181`、旧的 `inspect` 深链块）并用 `viewRequest.focus` + `completeViewRequest()` 重写该深链** |
| `lib/client.js` · entry（2061–2095） | 除 `id`/`order` 外基本不动（已 inject `slots/locale/sessions`） |
| `test/smoke.test.cjs` | 扩展：锚点往返、索引幂等合并、截断标记、搜索命中、解析失败分支、合成记录判别；文件头注释里的旧包名同步改 |
| `README.md` / `README.en.md` | **各 8 处旧包名**：安装/升级/卸载命令、安装后路径、F12 调试提示；另补来源标注、改动说明、与原版不共存、锚点语法与边界 |
| `docs/DESIGN.md` | 本文 |

---

## 7. 风险与对策

| 编号 | 风险 | 对策 |
|---|---|---|
| R1 | **拉全史把历史灌进会话窗口**：官方 prepend 无回收上限，Chat 主滚动区不虚拟化 → 58 页全部常驻并参与渲染 | **已实测确认代价过高**，v1 改走宿主 FTS5（D2）；客户端分页降级为备选且需满足 §5.2 全部守卫 |
| R2 | **`deriveTraceTree` 是 O(N²)**：58 页累计扫描约 1,864,792 个事件（≈最终量的 31.5 倍） | 走宿主 FTS5 后此风险消失；若回退客户端分页，必须先做增量 derive（按 seq 增量 fold），不能每页全量重算 |
| R3 | 可读锚点 `t3s7` 在未解析全史时不稳 | 未解析时禁用可读形式，只给 `e{seq}` |
| R4 | 上游快照字段变更导致解析失效 | 纯函数隔离 + smoke test 覆盖（**基线已验证为绿**）；失败时降级为"仅窗口搜索"而非崩溃 |
| R5 | 与上游原版插件同时安装 → 界面出现**重复 tab**（两者 order 不同，不是抖动） | order 用 21；文档要求先移除原版并给出卸载命令 |
| R6 | 该仓库内所有 git 命令受脱敏 env 影响而失败 | 文档与脚本统一用 `env -u GIT_CONFIG_COUNT -u GIT_CONFIG_VALUE_0 -u GIT_CONFIG_VALUE_1 git ...` |
| R7 | ~~seq 允许小数~~ **已修正**：`SessionSeq` 契约只接受非负安全整数；小数 seq 属合成记录，不能作深链目标 | 锚点键一律整数 + 合成记录用 `p{turn}s{step}` 标识，见 D1 |
| R8 | 窗口边界的记录缺半截（`stepStartTime` / `callTime` / `call` 为 `null`） | 时间点与语料都按"能拿到哪半显示哪半"设计，并在 UI 标注不完整 |
| R9 | **身份字符串漏改**：包名在 **25 处**（不含 docs/）出现，其中 `README.md`/`README.en.md` 各 8 处是**安装/升级/卸载命令**，`test/smoke.test.cjs` 1 处 | 按 D5 表格逐项过；额外改 README 的 add/update/remove 命令与测试注释；验收：装上后标签出现、`<style id>` 无重复、旧包已 remove |
| R10 | `loadThrough` 在普通 `loadOlder` 分页中会直接返回，失败也被吞（`client.js:346-351`、`:313-335`） | 深链定位等待在途分页结束再重试，并显式向用户报失败，不假定一次调用即到位 |
| R11 | **静默坏锚点**：`st.seq` 是被 min-reduce 改写的排序键（`newStepState(c.time)` 处（runningCalls-only step） epoch 毫秒、`deriveTraceTree` 的 `lastTurnEntry.seq + 0.5` 合成处 合成、`deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`） 收敛）；且 `eventNodes[].seq` 自身含小数（官方合成 `.seq - .9`） | 不复用 `st.seq` 当身份；签发 `e` 前显式校验**整数 + durable `messageId`**（§4.1），否则降级为 `p{turn}s{step}` |
| R12 | `p{turn}` 单独作合成键会在同一轮的多个合成 step 上**碰撞** | 合成键必须含 step：`p{turn}s{step}` |
| R15 | **索引循环跨会话/跨代污染**：resync 会递增 `openGeneration`（`session.js:402-408`），旧循环继续写会污染新索引 | 循环必须绑定 `sessionId` + `openGeneration`，每次 await 后校验；会话切换/视图卸载即 abort |
| R16 | **`loadOlder` 静默失败**：未打开/无 hasMore/已在分页时直接 return（`session.js:313-318`），远端错误也被吞（`:327-335`），调用方无法感知 | 显式 no-progress 检测（baseSeq 不前进连续 2 次即停），并把失败原因报给用户；不能假定"循环退出 = 拉完了" |
| R17 | **32 MiB 预算低估**：仅 `hay` 就 22.49 MiB，未计对象开销 | 总量改 24 MiB 并把每条 200–400 B 固定开销计入同一预算池；触顶即停并明确告知覆盖范围 |
| R14 | **孤立工具结果无 station**：assistant 头在窗口外时（`call === null`），当前 `deriveTraceTree` 不产出工具 cell，导致该类 durable 记录搜不到、跳不到 | §6 改动项 O1：新增 `orphan-tool` station 绑定 `ToolResultNode.seq`；官方同形态以 `resultAsText` 兜底渲染（`client.js:7105`） |
| R13 | 合成→durable 过渡后，用户已复制的旧 `p` 锚点可能**静默失效或指向错记录** | 不做静默重定向：提示"该记录已落定，请改用 `e{seq}`"，并按 turn/step 坐标直接定位（§4.1 往返规则） |

---

## 8. 验证计划

1. **安装闭环（已于 2026-11-12 实测通过）**：`dsh plugin --profile web add <本地路径>` → `dsh --profile web --dump-config` 出现插件行 → 启动后客户端模块清单里出现 `dsh-trajectory-traceview/client.js`（紧邻官方 `dsh-client-ui-trajectory`）→ 拉到的 bundle 内含 `id: "dsh-trajectory-traceview"`、`id: "traceview"`、`order: 20` → `remove` 后 profile `package.json` 与组合树均无残留。**四项全过。**
2. **单测（先跑基线）**：`node test/smoke.test.cjs` 必须全绿，再叠加新断言。**基线已于 2026-11-03 实测通过**：`TV PLUGIN SMOKE TEST (v5) OK — turns=4 steps=4 stations=11 tokensIn=750 model=deepseek-chat`
3. **锚点闭环**：复制 → 刷新页面 → 粘贴解析 → 定位到同一条（含未加载历史的情况）
4. **全史检索**：≥20 轮会话中搜索第 1–3 轮的工具参数，命中并能跳转
5. **预算与中断**：拉取中中断，部分索引仍可搜，状态标注正确
6. **共存性**：官方「轨迹」页签行为不变；卸载后无残留（视图、locale、样式）
7. **降级**：故意喂坏快照/坏锚点，确认不崩、有提示
8. **合成记录**：构造一个被中断的合成前缀（小数 seq），确认它被标识为"未持久化/不可深链"，且不会把小数喂给 `loadThrough`；落定为 durable 整数 seq 后锚点仍可用
9. **窗口边界**：在只加载了窗口尾部的会话里，确认缺 `stepStartTime` / 缺 call 配对的记录不显示为 0 或 NaN
10. **深链争用**：在 `loadOlder` 分页正在进行时触发深链，确认等待后重试成功，且失败会显式提示而非静默
11. **孤立工具结果**：构造 `call === null` 的 `ToolResultNode`（助手头在窗口外），确认它有 `orphan-tool` station、可被搜索、`e{seq}` 与 `c{callId}` 都能定位
12. **stale `p` 回收**：中止一个正在流式生成的 step，确认它的 `p` 条目被淘汰而非残留
13. **宿主 FTS5 能查到当前会话**：确认 `session_event_search` 在 `session_id` 缺省时命中调用方自身历史（`dsh-tool-session-query/lib/index.js:453-454`），且上界只压到当前 step 之前（`:794-798`）
14. **索引循环的三个守卫**（仅在回退客户端分页时适用）：resync 递增 `openGeneration` 后旧循环立即 abort；`loadOlder` 静默 return 时能在 2 页内识别无进展并停；达到预算时 UI 明确区分"已到会话开头"与"因预算停止"

---

## 9. 里程碑

| 阶段 | 内容 | 说明 |
|---|---|---|
| **M1** | 锚点：整数 durable seq 稳定键 + 合成记录判别 + 可读标签 + 复制 + 深链解析（含 step id 修正、**O1 孤立工具结果 station**）<br>时间点（G4，仅纯呈现部分）：T1 行内起止 + T3 空档标注 + T4 时钟刻度 | 不碰索引层、不灌窗口、不花 token，风险最低，可独立交付 |
| **M2** | 全历史检索改走**宿主侧 FTS5**：profile 覆盖 `session-query-sqlite.openAt`（配持久 `path`）+ 挂检索工具 + "查询结果 → station 坐标"适配；<br>G4 的 T2 时钟轴开关（需复刻官方投影，改动较大）<br>T5 KPI 拆分（先核实官方 `timing.source` 是否已覆盖） | 主要成本在这里。**客户端分页已实测不可行**（58 页全量常驻、derive O(N²)、预算低估），不再作为 v1 路径 |
| **M3**（v2 候选） | 从某步 fork 重放 / 上下文归因 / 失败与循环标记 | 另出方案。**注**：fork 比原先估计便宜——客户端 `ctx.sessions.fork({sessionId, atSeq})` 已存在，Chat 侧还有官方 `forkAt(seq)` 可参照 |

先做 M1 的理由：锚点是 M2 的基础（跳转要靠它定位）；G4 是纯呈现，能立刻验证我们对 `time` 字段的理解是否正确。两者都能单独验证"我们确实读懂了这套快照"。

---

## 10. 决策项（已给默认值，可否决）

四项都已给出默认取值，按此可直接开工；任一项不同意再改。

| # | 决策 | 默认取值 | 理由 |
|---|---|---|---|
| 1 | 索引默认开/关 | **默认关**，需显式触发建索引 | 默认开会在长会话里静默吃内存；建索引属有副作用操作，应由用户显式发起 |
| 2 | 语料上限 | 单条 **4 KB**、总量 **24 MiB**（含每条 200–400 B 对象开销） | 实测：最大会话截断后 `hay` 已 22.49 MiB，原 32 MB 未计对象开销；触顶即停并明确告知覆盖范围 |
| 3 | 锚点形态 | **两套都给**：稳定键 `e{整数 seq}` + 可读 `t3s7` | 未解析全史时只给稳定键；解析后附可读形式 |
| 4 | 接受"拉全史"灌入窗口 | **不接受（已反转）** | 实测 58 页历史会全部常驻 Chat 且不回收，代价过高；v1 改走宿主侧 FTS5（D2），不再灌窗口 |

---

## 11. 补充：动作时间点与空档（G4）

### 11.1 数据是否够（已核实）

够。官方类型逐节点声明 `time` 为 **"Unix epoch ms from the source session event"**（`records.d.ts`，UserMessageNode/ToolResultNode/CommandNode/AssistantMessageNode 均有此注释）；上游自己的 `ms < 946684800000` 校验也印证了这一点。

可以拿到的时间点：

| 对象 | 字段 | 含义 | 缺口 |
|---|---|---|---|
| 事件节点 | `eventNodes[].time` | 该事件发生的墙钟时刻 | — |
| 用户消息 | `node.time` | 提问时刻 | — |
| 轮次结束 | `turn-end.time` | 该轮收尾时刻 | — |
| 会话结束 | `session-end.time` | 会话收尾时刻 | — |
| 请求头 | `header.time` | 该次请求的生效时刻 | — |
| 助手流式 | `timing.stepStartTime` / `timing.firstTokenTime` | 步骤开始 / 首 token | **起点在窗口外时为 `null`** |
| 工具调用 | `tool.callTime`（发起）与结果节点 `time`（返回） | 起止都有，可直接算耗时 | **call 落在窗口外时配对缺失** |
| 助手完成 | `timing.completedTime` | 最终消息时刻 | — |

右列的缺口意味着：**时间点显示必须容忍"只有一半"的记录**，在窗口边界（尤其全史索引拉到的最老一页）最常见；缺开始时间的只能显示"完成于 …"，缺配对的工具只能显示返回时刻。

### 11.2 两个不同对象的现状（必须分开说）

我最初把"我们的 fork 基座"和"官方轨迹视图"混为一谈，导致两处结论写错。分开陈述：

**A. 我们的 fork 基座（`dsh-trajectory-traceview`）——时间能力很薄**

只有 `fmtClock()`（定义处用浏览器 `toLocaleTimeString()`，无日期），用在三处：站点 `title` 悬浮（`fmtClock(s.time)` 处）、rail 时钟标签（`const clock = fmtClock(...)` 处）、详情头部 `activeClock`（`const activeClock = fmtClock(...)` 处）。没有起止并排、没有时钟比例轴、没有空档。

**B. 官方轨迹视图（`dsh-client-ui-trajectory`）——比我原以为的完整得多**

| 能力 | 证据 |
|---|---|
| 「开始时间」精确到毫秒，格式 `YYYY-MM-DD HH:MM:SS.mmm`，可点击切换 Unix 时间戳 | `StartedAtValue` / `formatStartedAt`（`:3621-3628`、`:3635-3686`） |
| 总时长、TTFT、生成、吞吐量、计时来源 | locale `timing.totalDuration/ttft/generation/throughput/source` |
| **时间线 tooltip 已渲染 `开始 → 结束`**（结束由 `startedAt + durationMs` **推算**，非独立记录） | `:6360-6371` |
| 四种时间线投影 `sequence / duration / time / actual`，其中 `time`/`actual` 为真时钟轴且**不压缩空闲** | `deriveTrajectoryTimeline`（`:6194`）、`deriveTimedTimeline`（`:6223-6274`） |
| 缺数据时降级：`timing.stepStartUnavailable`、`timing.notAvailable` | locale |

**关键限定**：`actualTime`（实际时间）开关在**本安装版是 `hidden: true`**（`:6090-6112`），即能力在、**入口藏起来了**，用户点不到。

### 11.3 真正缺的是什么（已按证据重写）

原稿写的四条，两条错、一条夸大，修正后只剩两条真空白：

| 原稿说法 | 判定 | 修正后 |
|---|---|---|
| ①只有开始没有结束 | **错** | 官方 tooltip 有 `开始 → 结束`；但它是**悬停态**。真空白是**行内常驻起止**，不必悬停 |
| ②时间轴不按时钟比例 | **错** | 官方 `time`/`actual` 投影就是真时钟轴。真空白是**入口被 `hidden` 藏了**，用户其实用不到 |
| ③空档完全不可见 | **夸大** | 在 `time`/`actual` 模式下空白是**如实画出**的；但**不标注**那段空白多长、在等什么 |
| ④跨天/时区没处理 | **对基座成立** | 官方 `formatStartedAt` 含完整日期；是我们 fork 基座的 `toLocaleTimeString()` 无日期 |

所以真正的增量只有两条：**行内常驻起止** 与 **空档的标注（时长 + 保守归因）**，再加上"把被隐藏的时钟轴入口显式做出来"。

### 11.4 设计（已删减）

- **T1 行内起止**：每条记录常驻显示 `开始 – 结束 · 耗时`，不依赖悬停。结束优先用已记录的结束时刻；只有当只有时长时，才用 `开始 + 时长` 推算并**标注为推算值**。缺任一端就只显示存在的那一端；进行中只给开始并标"进行中"。
- **T2 时钟轴开关（保留，但理由已改）**：不是因为官方没有这个能力，而是因为它的入口在本版被 `hidden: true` 藏起来了。我们在自己的 tab 里给一个可见开关：`等距` ↔ `按时钟比例`。
- **T3 空档标注（核心增量）**：相邻记录 gap 超过阈值（建议 60 秒）时画灰带并标时长。原因只做**保守归因**：紧跟用户消息的标"等待输入"，紧跟审批的标"等待审批"，其余标"无记录间隙"。官方是"画出空白但不解释"，我们补的是解释。
- **T4 时钟刻度（收窄）**：只在轴上补 `HH:MM` 刻度文本，并让跨午夜的刻度带上日期。跨天/时区问题官方已解决，我们照它的 `formatStartedAt` 口径做即可，不重复设计。
- **T5 KPI 拆分**：`墙钟总时长 = 模型 + 工具 + 空档`。**待核实**：官方 `timing.source` 已经区分计时来源，动手前要先确认它是否已经给出同口径拆分，避免重复。

### 11.5 注意

T3 的"空档归因"必须保守。我在会话里能看到的"等待"至少有三种来源：等你回话、等审批弹窗、等后台 job 完成。前两种可以从记录结构判断（用户消息 / 审批记录），第三种只能从"两个记录之间无事件"推断，**不能断言**是等 job——所以标"无记录间隙"，把判断留给读者。

另有一条流程教训写在这里备查：本节初稿把"官方没有时钟比例轴/空档能力"当成事实，实际官方 `time`/`actual` 投影早就具备，只是入口被 `hidden` 藏了。**判断"官方没做 X"之前，必须先读它的 locale 字典与投影函数**——字典是它能力清单的自述。同一错误在本节出现过两次。

### 11.6 归属

- T1 / T3 / T4 是聚合与呈现，不碰数据层、不分页、不花 token → 并入 **M1**。
- **T2 需要重新评估归属**：它要复刻官方的时钟轴投影，属于时间线渲染的较大改动，可能该进 M2。
- **T5 待核实后再定**（可能已由官方 `timing.source` 覆盖）。

---

## 12. 复核记录（外部审查可追溯）

### 12.1 审查方式

2026-11-03，通过 Orca 编排一个独立 **Codex** worker 对本文做只读对抗式审查（`dispatchId=ctx_8bd238390f74`）。任务 spec 明确要求它优先猎捕一类特定错误：**"官方没做 X"的错误主张**——因为作者在写作过程中已经因为这类错误翻车两次。每条结论必须带 `文件:行号`，无法验证的必须标注。

### 12.2 它抓到的问题（作者均已独立复验）

| 严重度 | 原文主张 | 实际 | 处置 |
|---|---|---|---|
| **P1 阻塞** | "`seq` 允许小数，锚点写成 `e1234.5`" | `SessionSeq()` 运行时强制非负安全整数，小数直接抛 `TypeError`（`dsh-session/lib/index.js:21-22`）；小数只属于**无持久事件**的合成记录 | 锚点契约改为**整数 durable seq** + 合成判别（当时的写法是 `p{turn}`，第二轮复审后细化为 `p{turn}s{step}`，见 §12.5） |
| P1 | "官方只有开始，没有结束" | 官方时间线 tooltip 已渲染 `开始 → 结束`（`:6360-6371`） | §11.2/11.3 重写，增量收窄为"行内常驻起止" |
| P1 | "官方时间轴不按时钟比例" | `time`/`actual` 投影就是真时钟轴且不压空闲（`:6194`、`:6223-6274`）；但 `actualTime` 开关本版 `hidden: true`（`:6090-6112`） | §11.3 改写为"入口被藏"，T2 保留但理由与归属都改（移入 M2） |
| P3 | `id` 引到 `exports.apply` 处 | 实际 `id` 在 视图注册的 `id` 处，`order` 在 视图注册的 `order` 处 | 已改（这一处是作者上一轮"修正"时新引入的错误） |
| P3 | step fallback 的行号引用偏了 3 行 | 实际在 `s${stepCounter}` 兜底处 | 已改用符号引用 |
| P3 | "包名全仓库 6 处" | 实际 **25 处**（不含 docs/），README 各 8 处是安装/升级/卸载命令，测试注释 1 处 | 已改，并进 R9 验收标准 |
| P4 | "与上游同 order 会抖动" | 旧包 20 / 新包 21 order 不同，并存是**重复 tab**，不是抖动 | D4 / R5 已改写 |
| P4 | 深链容错 | `loadThrough` 在 `loadOlder` 在途时会直接返回、失败被吞（`client.js:346-351`、`:313-335`） | 新增 R10 与验证项 9：等待重试 + 显式报错 |

### 12.3 审查确认无误的部分

- `loadThrough` 可达性链路成立：`SessionBinding.session` → `SessionFace` → `ISession.loadThrough`；`conversation.view` owner 能拿到 `viewRequest` / `openView`
- 纯数据层可单测，基座 smoke test 当时为绿：`TV PLUGIN SMOKE TEST (v5) OK — turns=4 steps=4 stations=11`

### 12.4 教训（写进文档，避免重犯）

**判断"官方没做 X"之前，先读它的 locale 字典与投影函数。** 官方插件的内联中英文字典就是它能力清单的自述——`toolbar.actualTime`、`timing.started`、`timing.source` 这些键在动手写方案前就摆在那里，读了就不会连错两次。同一错误在 §11 出现过两次，均由外部审查纠正。

### 12.5 第二轮复核（聚焦复审，2026-11-04）

第一轮修完之后，把新写的锚点指令单独送第二轮 Codex 只读复审（`dispatchId=ctx_92b4f845670b`），问四件事：`st.seq` 的行为描述是否精确、新修法是否完整、§5.1 是否自洽、还有没有别处依赖 `st.seq` 当身份。**它共提出 6 项，其中 1 项是我第一轮修法自身的漏洞。**

| 严重度 | 我的写法 | 实际 | 处置 |
|---|---|---|---|
| **P1 漏判** | "在助手折叠处写 `anchorSeq` 即可（只要整数）" | **`eventNodes[].seq` 本身含小数**：官方为中断分片合成 `seq: boundary.seq - .9`（`dsh-client-ui-trajectory/lib/client.js:1497-1504`）并放入 `eventNodes`（`:2193-2200`、`:2232-2240`）。所以"整数"不是充分判据 | §4.1 签发条件改为**两条**：整数 **且** 带 durable `messageId`（`records.d.ts:68-73` 说明 `messageId` 只在合成兜底上缺失） |
| P2 错位 | "min-reduce 在 `st.time` 的 min-reduce 处" | 在 **`deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`）**；`st.time` 的 min-reduce 处 是 `st.time` | D1 表、§4.2、R11 全部改 `deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`） |
| P2 碰撞 | 合成键用 `p{turn}` | 一轮可有多个合成 step，**`p{turn}` 会碰撞** | 改为 `p{turn}s{step}`；新增 R12 |
| P3 不完整 | §5.1/§5.2/§5.4 未排除 synthetic | `IndexEntry` 当时**没有 `seq` 字段**，coverage 与"全部按 seq 排序"都会把合成条目算进去 | `IndexEntry` 增 `seq: number \| null`（synthetic 恒 `null`）；coverage 只用 non-synthetic；synthetic 不参与跨轮排序；§4.4 增 `p` 的拒绝/解析分支 |
| P3 未定义 | "落定后 re-issue" 一句话 | 没定义旧 `p` → 新 `e` 的映射行为 | §4.1 增"合成→durable 往返"规则：**不静默重定向**，提示改用 `e` 并按 turn/step 坐标定位；新增 R13 |
| P4 残留 | 改动清单仍写"step id 按 `st.seq` 派生" | 与 D1 新结论矛盾 | 已改为"另开 `anchorSeq`，写入点 `deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`），签发条件见 §4.1" |

它也确认了两件事：`deriveTraceTree` 的 `lastTurnEntry.seq + 0.5` 合成处 的 `lastTurnEntry.seq + 0.5`（我原先写在 `seq + 0.5` 合成处，那里只是传参）、以及 tool-result-only 路径在当前 fork **不生成 step**，所以那条路径不构成额外风险。

**两轮审查的共同教训**：两次 P1 都不是"引用错行号"，而是**我把某个字段的语义想当然了**——第一次以为 `seq` 可为小数（其实是整数契约），第二次以为"是整数就安全"（其实 `eventNodes` 里混着合成小数）。凡是准备把某个字段提升为"身份"之前，必须先查清**它的所有写入点**。

### 12.6 第三轮复核（聚焦复审，2026-11-04）

针对第二轮修完后的版本再送一轮（`dispatchId=ctx_4a1cb4201eae`），问题聚焦：签发条件是否充分必要、`anchorSeq` 落点是否正确、合成契约是否自洽、有无残留矛盾。**它的结论是"不建议按当前文本实现"，并给出唯一阻塞项。**

| 严重度 | 我的写法 | 实际 | 处置 |
|---|---|---|---|
| **P1 阻塞** | §4.1 语法允许 `c<callId>`，但 §4.4 的解析流程把"其余形态"一律判非法 | **`c` 锚点永远解析不了**：语法产出它、解析拒绝它 | §4.4 补齐四种形态的分支，`c` 明确为"`seq` 的易读别名" |
| **P1 漏判** | "只有合成**助手**前缀 seq 是小数" | **工具结果同样有合成小数**：官方中断工具调用生成 `kind: "tool-result"`、`seq: interruptedAt.seq - .8`（`client.js:2416-2439`），并进入 `eventNodes`（`:2205-2207`）。(本轮我独立发现同一处，结论一致) | §4.1 改为**按记录类型分列**的签发表；`messageId` 降为助手类的附加判据，通用判据是"有无 durable 事件 seq" |
| P2 矛盾 | §4.1 说旧 `p` "直接定位"，§4.4 说"在当前窗口找" | 不在窗口的旧 `p` 找不到已索引的 durable 对应项 | §4.4 改为先查全史索引拿坐标，再对 durable seq 走 `loadThrough` |
| P2 越界 | G2 写"每条记录"可深链 | `p` 被明确定义为不可深链 | G2 收窄为 **durable** 记录，并给合成记录定义提示行为 |
| P2 不足 | "在 `deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`） 写 `anchorSeq`" | 该分支**也会收到无 `messageId` 的合成助手节点**，必须逐节点校验；只由 runningCalls 建出的 step（`deriveTraceTree` 的 runningCalls-only 分支）没有助手事件 | §4.2 明确"逐节点校验"与 runningCalls-only step 的锚点归属 |
| P3 不一致 | §5.1 示例结构无 `seq` 字段，正文却要求 `seq` | 示例与契约不符；且 `c` 条目的排序/分页 seq 来源未定义 | 示例补 `seq`；§4.4 定义 `c` 的 `seq` 取自 `ToolResultNode` |
| P3 计数 | §12.5 写"抓到 3 处" | 该表实列 6 项 | 已改为 6 项 |

**三轮审查的规律**：P1 永远出在"我以为某类记录只有一种形态"——第一次是 `seq` 类型、第二次是 `eventNodes` 的合成节点、第三次是"只有助手才合成"。共同的修法是**按记录类型分列，而不是用一条规则覆盖全部**。

### 12.7 第四轮复核（闭环审查，2026-11-06）

第三轮修完后再送一轮，只问一个问题：**§4.1 签发表 / §4.4 解析 / §5.1 结构 / §5.2 采集 / §5.4 排序 五节是否已经闭合**（`dispatchId=ctx_f2984f3ca1fe`）。**结论仍然是 NO**。

| 严重度 | 我的写法 | 实际 | 处置 |
|---|---|---|---|
| **阻塞 INCONSISTENT** | §4.1 要求每个落定 `ToolResultNode` 都有 `e`/`c` 并按 `seq` 定位；§5.1 定义 `kind=tool` 索引项 | §5.2 只从 **stations** upsert，而主循环**没有 `n.kind === "tool-result"` 分支**——工具 cell 仅由助手 `tool-call` 块（助手 `tool-call` 块产出工具 cell 处）与 runningCalls（runningCalls 产出工具 cell 处）产出。assistant 头在窗口外时（`records.d.ts:169-173` 原文 "null when window truncation left the call outside"），该结果**没有 station 可 seek** | 新增 §6 改动项 **O1**：在 `deriveTraceTree` 建 `orphan-tool` station；§4.4 补孤立结果的说明；新增 **R14** 与验证项 10 |
| 非阻塞 | 语法定义了 `t{turn}s{step}`，但 §4.4 只分支 `e`/`c`/`p` | 可读形式没有解析路径，粘贴后落入"其余即非法" | §4.4 补 `t` 分支：先按坐标在索引里换成 `e{seq}` 再走定位；明确它只是别名 |
| 非阻塞 | §5.1/§5.4 未定义 synthetic 同轮二级排序键 | 同轮多个合成条目顺序不稳定 | 增二级键 `(step, callId, key)`，仅用于展示稳定 |
| 非阻塞 | §5.2 未说明 partial 取消后 stale `p` 的淘汰 | 索引会留永不落定的僵尸条目 | 增"本轮合并结束时淘汰 stale `p`"；新增验证项 11 |

**它同时确认已闭合的部分**：助手 durable 走 `e{seq}`、用户/压缩走 `e{seq}`、合成 step 走 `p{turn}s{step}`、运行中 synthetic tool cell 不单独签 `c` 而随父 step 定位、`IndexEntry.synthetic` 的 `seq=null` 与 coverage 排除规则与排序规则三者一致。

**本轮我自己的补充**（它未提及，我在等它期间独立发现）：合成（被中断）工具结果此前的锚点形态是空白——既拿不到 `e`，`c` 又被解析层拒绝，而 `p{turn}s{step}` 无法区分同一 step 内的多个工具调用。已把合成形态扩成 `p{turn}s{step}c{callId}`。

**四轮下来的结构性结论**：每次 P1 都是"某类记录只有一种形态"的同一个假设在换皮（`seq` 类型 → `eventNodes` 合成 → 只有助手会合成 → 工具结果要么 durable 要么不存在 → 工具调用每 step 唯一）。所以 §4.1 最终**从"类 × 单态"改成了"类 × 持久状态"矩阵**，让"另一态"在结构上不可能再被一句话带过。

### 12.8 第五轮复核（M2 索引设计，2026-11-12）

前四轮都在审锚点。第五轮**换靶**，只审 §5 全历史索引，并允许它实测本机会话数据（`dispatchId=ctx_5b72266e70c4`）。**结论：按现稿不可行，建议改用宿主侧 FTS5。**

它给出的实测数据（本机 `~/.dsh/sessions`：376 个日志、压缩 213.99 MB、解压 677.80 MB、409,957 个事件）是这轮的关键——这是第一次有人拿真实数据检验我们的假设：

| 严重度 | 我的假设 | 实测 | 处置 |
|---|---|---|---|
| **P1 不可行** | 客户端 `loadOlder()` 分页 + 内存索引（D2 方案 A） | 最大会话 58,994 事件 / 92.8 MiB / **58 页**；官方 prepend **无 eviction**；Chat 主滚动区**不虚拟化**（`useVirtualizer` 只在 TurnNavigator，`dsh-client-ui-chat/lib/client.js:290` vs 主区全量 `entries.map` Chat 主滚动区的 `entries.map`）→ 58 页全部常驻并渲染 | **D2 反转**：v1 改走宿主侧 FTS5；客户端分页降级为备选并加全部守卫 |
| **P1 复杂度** | "分页之间让出事件循环"即可（R2） | `deriveTraceTree` 对全 nodes 排序并多次全扫描（region `pure helpers`），58 页累计扫描 ≈**1,864,792** 个事件（≈最终 59,108 的 **31.5 倍**） | R2 改写：必须增量 fold，不能每页全量重算 |
| **P1 预算** | 单条 4 KB、总量 **32 MB** | 仅截断后 `hay` 就 ≈**22.49 MiB**（1,044/6,834 条被截断），未计 Map/key/meta/数组/station 对象 | §5.3 与决策项 2 改为 **24 MiB 且计入对象开销**；触顶即停 |
| **P1 未处理的失败** | 循环只写了"暂停/可中断" | `loadOlder` 在未打开/无 hasMore/已分页时**静默 return**（`session.js:313-318`），远端错误也被吞（`:327-335`）；resync 会递增 `openGeneration` 丢弃旧 stream（`:402-408`）；设计不检查 no-progress → **可能空转** | §5.2 增五个必须守卫（绑定 sessionId+generation、no-progress、append 后重基线、compaction 清空、切换即 abort）；新增 R15/R16 |
| **P1 我拒绝方案 B 的理由错了** | "上述工具默认排除调用方自身会话" | `session_search` 排除调用方（`dsh-tool-session-query/lib/index.js:748-786`），但 **`session_event_search` 能查自身会话**：`targetId` 缺省即 `caller.id`（`:453-454`），只压上界到当前 step（`:794-798`） | D2 里明确更正这条；这正是改走宿主侧的依据 |

**这轮的教训与前四轮不同**：前四轮都是"文档内部不一致"，靠读代码就能发现；这轮是**假设与现实不符**——"客户端分页应该还行"这个判断，读多少代码都验不出来，只有拿真实会话跑一遍数据才知道要 58 页。**所以凡涉及规模/成本的判断，必须实测，不能推理。**

### 12.9 首次真实安装发现的两个既有缺陷（2026-11-12）

五轮审查全是读代码。第一次真正装进 web profile 并在浏览器里打开后，发现 **fork 在当前 DSH 0.2.1-rc.5 上本来就是坏的**——与锚点设计无关，是上游插件面向旧版 API 写死的结果。

| 缺陷 | 表现 | 根因 | 处置 |
|---|---|---|---|
| **视图完全不渲染** | 页签「轨迹视图」正常出现，点进去视图区只有一个空的 `data-slot-error` 锚点，`console.error` 报 `slot entry crashed in 'conversation.view': Cannot read properties of undefined (reading 'get')` | fork 用 `useSession((s) => s.views.get("trajectory"))` 读快照。**当前版本的会话快照上没有 `views`**，正确入口是视图 props 里的 `useTrajectory`（`dsh-cordis-client-runner/lib/client.js:2462` 的 standard props 清单里明确列有 `useTrajectory`） | 组件签名改用 `useTrajectory`；`inject` 里同样失效的 `getSnapshot().views.get("trajectory")` 改为比较 `getSnapshot()` 本身 |
| **深链死参数** | 聊天→轨迹的定位从未生效，静默无操作 | 组件解构的 `inspect` / `onInspectDone` 在运行时根本不存在（运行时只传 `inspectCall` / `viewRequest` / `openView` / `completeViewRequest`，见 `dsh-client-ui-conversation/lib/client.js:18036-18041`） | 改用 `viewRequest.focus` + `completeViewRequest()`，并删掉死参数（§4.4 已有记录） |

**为什么五轮审查都没发现**：审查者的任务都是"核对文档里的断言与源码是否一致"，没有人被要求**把插件跑起来**。而这两个缺陷只有在浏览器里渲染一次才会暴露——静态阅读 `useSession((s) => s.views.get(...))` 看不出 `s.views` 是 undefined，因为那取决于运行时传入的快照形状。

**这印证了 §12.8 的结论并加以扩展**：不仅"规模/成本判断必须实测"，**"接口存在性"同样必须实测**。文档里所有关于 DSH 客户端 API 的断言，在真正跑通一次之前都只是"读起来像对的"。

**实测结果**（修复后）：视图渲染 278 KB DOM、1341 个 `dstv_` 节点、站点点位 `站点 72 / 72`、详情头部出现 `🔗 复制锚点`，其 `title` 为 **`tvp1:e3019`**——`e` + 整数 seq，符合 §4.1 矩阵对 durable 记录的签发规则。

### 12.10 M1 实现结果：G4 的 T1 / T3 / T4（2026-11-12）

三项全部落地并**在真实 web profile 的浏览器里跑通**（不是只跑单测）。

**T1 行内起止**

数据源不是新造的：`newStepState` 里早有 `startMs` / `endMs`，分别在 `n.timing.stepStartTime` 取 min、`n.timing.completedTime` 取 max 累积，`durationMs` 也由这两者相减得出。M1 只是把 `startMs` / `endMs` 从 step 内部推到 station 上，供渲染层直接读。

按 §545 的规格做了三种情形，并各有断言守着：

| 情形 | 行为 |
|---|---|
| 两端都有 | `HH:MM:SS → HH:MM:SS` |
| 只有开始（进行中） | 只显示开始 + `进行中`，**不推算结束** |
| 两端都没有 | 不渲染该行，**不显示 00:00:00** |

`durationMs` 已由 meta chip 显示（如 `32,324 ms`），因此行内不再重复耗时——这是对规格「开始 – 结束 · 耗时」的一处有意收窄。

**T3 空闲间隔**

相邻站点之间取 `前站 endMs（退化到 startMs / time）` 与 `本站 startMs（退化到 time）` 求差，≥ **30 秒**才渲染 `⏸ <时长>` 色带。阈值 `GAP_MIN_MS` 是我定的：低于 30 秒属于正常调度抖动，标出来只是噪声。任一端缺失则跳过，**绝不凭空造出一个空档**。

**T4 时钟刻度**

复核后发现**已经存在**：站点的 `dstv_axLabel` 一直带 `clock`（`fmtClock(站点时间)`）。所以 T4 无需新代码，只是既有行为。规格说「补 `HH:MM` 刻度」，实际格式是 `HH:MM:SS`，比规格更细——保留，因为秒级对排查有用。

**实测证据**（真实会话「Docker 安装检查」，72 个站点）：

```
T1 起止行      55 条，样例 14:24:21→14:24:53 / 14:24:55→14:25:34 / 14:25:36→14:26:08
T1 user 行     17 条（user 站点只有单一时间戳）
T3 空闲色带    17 条，样例 ⏸ 47,628 ms / ⏸ 61,911 ms / ⏸ 91,668 ms
锚点            tvp1:e3019
slot 错误       0
```

**变异测试**（验证断言真的会失败）：把「缺 timing 时返回 0」和「duration 与 end−start 脱钩」两种错法分别注入，**两次都被测试捕获**。另有一次是测试自身写错了期望值（空档算错成 0 条），也当场暴露并修正——说明这批断言不是恒真。

**未做**：T2（时钟轴开关）按 §559-560 的结论留在 M2；T5（KPI 拆分）仍未核实官方 `timing.source` 是否已覆盖。

### 12.11 O1 孤立工具结果：实现与真实数据验证（2026-11-12）

**问题**：`deriveTraceTree` 主循环只有 `assistant` 分支，工具结果靠 `resultsById` 按 `callId` 挂到对应 `tool-call` 上。若 `tool-call` 不在加载窗口内（或截断后 `call === null`），该结果既不会被挂载、也不会成为站点，**在时间线上彻底消失**。官方视图对此有兜底（`dsh-client-ui-trajectory/lib/client.js:7105` 用 `resultAsText(resultPreview)` 渲染孤儿），所以 fork 比官方少展示数据。

**实现**：在主循环之后、turn 组装之前，收集所有 `kind === "tool-result" && !attachedCallIds.has(callId)` 的节点，按 seq 排序、用 `turnForSeq` 归位，建成 `kind: "orphan-tool"` 的独立站点。附带：
- 卡片（名称 / args / 结果文本，4 行截断）、轴点紫色、详情面板（callId + 参数 + 结果）
- Markdown 导出新分支（含锚点字符串）
- `hay` 纳入 `displayText`，搜索可命中
- `stats.tools` / `stats.errors` 计入，**但 `stats.steps` 不增加**（它不是 step）
- 锚点由 special-stations 分支统一签发，非整数 seq 自动 `synthetic: true`

**一处设计清理**：初版在孤儿站点里自己写了 `anchorSeq` / `anchorKey` / `synthetic`，但 special-stations 分支末尾有 `...d` 展开后又统一重算这三个字段，导致前面的写入被覆盖。变异测试暴露了这点（把孤儿分支的 `anchorKey` 改成 `null` 测试竟不报错）。修正为**单一签发点**：孤儿只提供 `seq`，其余交给 special 分支。这同时让 O1 自动继承 §4.1 的整数校验。

**一处死代码清理**：初版写了 `n.resultPreview` 作为无文本时的回退。**该字段在 `ToolResultNode` 上不存在**——官方视图也不读它，而是用 `summarizeResult(node, t)` 从 `node.content` 现场计算。孤儿的 `content` 已由 `blocksText` 处理（text / image→`[图片]` / reasoning），所以那个回退是永不为真的死代码。已删除，改为错误信息回退（`n.error.code ?? n.error.name`），并为「仅错误无文本」「仅图片」两种真实形态补了断言。

**真实数据验证**：会话「Docker 安装检查」出现 **5 个孤儿站点**（索引 19–23），内容都是此前不可见的真实数据：`advance_fetch` 抓的 GitHub / Kiri Docs 页面、compose 文件摘要、`agentq` skill 内容。点击后详情正常，锚点 `tvp1:e2566`。站点总数从 72 增至 **77**。

**测试**：四组断言（孤儿必须出现、已挂载的不得重复计数、小数 seq 不得签发 `e` 锚点、Markdown 不得漏导出）；三次变异测试全部被捕获——其中一次还揪出了上面那个签发点重复的问题。
