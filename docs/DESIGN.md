# 设计方案：轨迹稳定锚点 + 动作时间点 + 窗口内检索

> 基线：`dsh-trajectory-traceview` v0.3.0（MIT，上游 AFAP）
> 目标 dsh：`0.2.1-rc.5`
> 本文描述 v1 的设计；v2 的 "从某步分叉重放" 只在范围一节出现，不在此展开。

---

## 1. 目标与非目标

### v1 目标

| 编号 | 目标 | 判据 |
|---|---|---|
| G1 | ~~**全历史检索**：搜索覆盖整个持久会话~~ → **降级为「已加载窗口内检索」**（2026-11-12 实测：客户端分页与宿主 FTS5 两条路都不可行，见 D2 与 §12.13） | 能在当前已加载的轨迹里搜到工具参数与结果，并能跳过去；**UI 必须显式标注覆盖边界**，不假装覆盖了没加载的历史 |
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

### D2 — 全历史检索：两条路都实测不通，v1 只做「已加载窗口内检索」

这一节记了**一个被两次实测推翻的判断**，完整保留证据链，避免第三次重走同一条路。

#### 第一次判断（2026-11-03）：客户端 `loadOlder()` 分页 + 内存索引

理由是"纯客户端、不动宿主、可回滚"。**2026-11-12 的语料审计把它推翻。**

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

1. **窗口会被灌满且不回收。** 官方 event source 的 prepend 是纯 concat，**没有 eviction/上限**；Chat 主滚动区**没有虚拟化**——`useVirtualizer` 只属于 TurnNavigator 轨道（`dsh-client-ui-chat/lib/client.js:290`），主聊天区是全量 `entries.map(...)`。所以 58 页历史会全部参与 React 渲染并常驻内存。
2. **derive 是 O(N²)。** `deriveTraceTree`（region `pure helpers`）每次对全部 nodes 排序并多次全扫描；58 页累计扫描约 **1,864,792** 个事件（≈最终 59,108 的 **31.5 倍**）。
3. **32 MiB 预算过于乐观。** 光 `hay` 就 22.49 MiB，还没算 Map、key、meta 数组和 station 对象。

#### 第二次判断（2026-11-12）：改走宿主侧 FTS5

`dsh-session-query-sqlite` 提供 FTS5，`dsh-session-query` 冷读完整日志并抽取 user/assistant/tool call/result/todo/turn-end 文本建文档。**看起来**完全对症：不进窗口、无 O(N²) derive、无 Chat DOM 增长。启用路径也已核实——`session-query-sqlite` 在 `dsh-base` 里已挂载（`dsh-base/cordis.patch.yml:157-161`），`openAt` 合法值 `startup | first-search | never`（`dsh-session-query-sqlite/lib/index.js:1089-1093`），官方注解明说启用方式就是在更后的 patch 层覆盖 `openAt` 并配持久 `path`。

**于是照做并实测：失败。**

把 `session-query-sqlite` 覆盖为 `path: <profile>/session-query.db` + `openAt: first-search`，删库重启，从页面里发 `POST /api/session/search`：

| 观测 | 结果 |
|---|---|
| 返回耗时 | **426,673 ms**（约 7 分钟） |
| 返回体 | `gateway/internal`：`session-search persistence observation did not stabilize after one retry`（`SESSION_QUERY_PERSISTENCE_FAILED`） |
| 进程 CPU | 冲到 208% 后又回落到 0.1% |
| `session-query.db` / `-wal` / `persisted_sessions` | 4096 B / 57,712 B / **0 行**——一笔都没提交 |

**根因**（`dsh-session-query-sqlite/lib/index.js:707-756`，`_observeStable`）：

1. 第 1 轮：`persistence.list()` → 对**每个**未索引且非活跃的会话 `readColdSessionLog` 全量冷读 → 再 `list()` 比对，不一致就 `continue`
2. 第 2 轮重复一次；仍不一致 → 抛 `SESSION_QUERY_PERSISTENCE_FAILED`
3. `STABLE_OBSERVATION_ATTEMPTS = 2`（`:474`），所以只有两次机会

本机语料 376 个日志、解压 677.8 MB，一轮冷读以**分钟**计；而 `list()` 的 revision 会随**任何**活跃会话写盘而变。只要有会话在写（GUI 常驻，本会话自身也在写），这个窗口就永远不稳定。**首次全量建索引在本机规模下不可行**，且 `_reconcile` 是 all-or-nothing——失败即整体不可用（`searchSessions`/`searchEvents` 全部报错，不是局部降级）。

**顺带落出两条运维事实**（都实测过）：

- 8 个 `version: 0` 遗留会话在 converter 里先抛 `subagent/descriptor ... unsupported descriptor version 2`，而 `_reconcile` 的 all-or-nothing 让**一条坏日志拖垮全部检索**
- 这 8 个目录还以"扁平日志"形式直接放在 `~/.dsh/sessions/` 根下，会让 `listSessionDirs` 抛 `uses the unsupported flat-file layout`（`dsh-session-persistence-jsonl/lib/index.js:3523-3536`），**连带 5 个插件不激活**（workspace / session-controller / schedule / workspace-controller / ui-deliverables）。移出根目录后启动恢复单行、无告警；这 8 个会话内容确认不需要，**已于 2026-11-13 经用户确认删除**

#### v1 定稿：不做全史检索

- **检索范围 = 当前已加载的轨迹窗口**（快照里已有的 `eventNodes`）：纯内存、零额外 I/O、零窗口污染
- UI **必须显式标注覆盖边界**：`已检索 n 条 / 更早 12 页未加载`，并给出"加载更早"入口（沿用官方 `loadOlder()`），但**不自动**拉取——拉不拉由用户决定，因为代价（几十页常驻）是已知的
- 锚点深链（§4）不受影响：解析在已加载窗口内进行；窗口外命中时提示"目标不在已加载范围"，而不是静默失败
- README 写明本插件**不含跨会话检索**，那是官方轨迹页 / `session_event_search` 的路

#### 升级路径（M3 候选，**未验证**，不得当成已有能力写进任何文档）

1. **离线预建索引**：独立 Node 脚本（无 DSH 会话在写）直接驱动 `dsh-session-query` + `sqlite` 建库，之后 GUI 只做增量 reconcile（读取量小、窗口短，**可能**稳定）。未验证，且与 D3"不落盘"原则冲突，需重审
2. **上游改 stability gate**：把"全语料快照比对"改成 per-session 比对，让活跃写入下的全量建索引可行
3. **独立虚拟化检索窗口 + 受控分页**：§5.2 的全部守卫 + 自带虚拟滚动的面板，与 Chat 主区解耦

### D3 — 若将来建索引：会话级、内存、可丢弃，不落盘

**v1 根本不建索引**（D2 定稿）。这条只在将来做"显式拉全史 + 临时索引"时生效：不落盘。理由：语料含工具结果全文，体积不可控且含潜在敏感内容；落盘还带来"索引与日志不一致"的一致性问题，且**实测已证明宿主侧落盘索引在本机规模下建不起来**（§12.13）。代价是每次打开会话需重建（可接受：只在用户显式触发"加载更早"时付出）。

### D4 — 不碰官方槽位、不复用官方 view id

- 继续注册到 `conversation.view`，用自己的新 id
- 不动 `conversation.trajectory.images`、`conversation.chat.flow` 等标记 `shadows-shipped-ui` 的槽
- 与上游原版插件**不共存**：官方原版是 order 10，本插件当前是 order 20（改名后计划提到 21），两者 order 不同，但会同时注册两个标签页，界面出现**重复 tab**；文档写明须先移除原版。另：`loadThrough` 在普通 `loadOlder` 正在分页时会直接返回（`client.js:346-351`），且其失败会被吞掉（`client.js:313-335`），所以深链定位必须等待/重试并显式传播失败，不能假定一次调用就到位。

### D5 — 身份与打包改造（**已落地，2026-11-12**）

下表"本方案"列已全部实施并实测（`refactor(D5)` 提交）。实测方式：`dsh plugin --profile web remove dsh-trajectory-traceview` → `add /Volumes/Work/code/dsh-trajectory-traceview` → 重启 → 页面断言 style 标签为 `dsh-trajectory-traceview-plus/traceview.css`、页签仍为 3 个、77 站点 / 72 步骤跨度 / 5 孤立站点 —— 全部符合。

> 顺带修正一处判断：变更 `package.json` 的 `name` 之后，**必须先 remove 旧包名再 add**，否则 pnpm 的 link 目录名（旧名）与包内 `name`（新名）不一致，profile 里会留下一个指向同一目录、却以旧名注册的依赖。

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

## 5. 索引详设（G1，**v1 不启用，保留作升级参考**）

> **v1 不建索引。** 本节描述的是"若将来做跨页/全史检索"的数据结构与守卫，来源是第五轮复核。两条实现路径都已被实测否决（客户端分页：§12.8；宿主 FTS5：§12.13），但这里的条目模型、排序键、synthetic 规则在"用户显式点『加载更早』后对已拉取部分建临时索引"的场景下仍然有效。**读本节前先读 D2 定稿。**

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

> **下面的客户端分页循环不在 v1 范围内。** v1 只检索已加载窗口（见 D2 定稿）；宿主侧 FTS5 也已实测证伪。此节保留的原因：(a) 记录"用户显式点『加载更早』"时该循环必须满足的守卫；(b) 将来若做虚拟化检索窗口，按此实现。

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
| `lib/client.js` · region `pure helpers` | 新增 `anchorOf` / `parseAnchor` / `resolveAnchorInStations` / `anchorLoadTarget` / `anchorSeqFloor` / `nextHashFor` / `searchScopeNote`（**均已实现**）；<br>**`toIndexEntry` / `mergeIndex` / `searchIndex` / `resolveInIndex` 已随 D2 取消，不实现**；`deriveTraceTree` 补 `anchorKey` / `anchorSeq`（step 另开字段，写入点 `deriveTraceTree` 的 durable 补正处（`if (st.seq > n.seq)`），签发条件见 §4.1） |
| `lib/client.js` · region `horizontal timeline + replay component` | 搜索改走**当前窗口内存过滤**（不是索引，见 D2 定稿）+ 覆盖范围徽标；🔗 锚点粘贴输入框；详情头部复制锚点；`viewRequest.focus` + `location.hash` + `hashchange` 三入口统一走 `anchorApply`；失败/未加载都有显式提示。<br>**定位没有用 `session.loadThrough(seq)`——实测它无效**（见 §12.16），改为有界 `loadOlder()` 循环 |
| `lib/client.js` · entry（2061–2095） | 除 `id`/`order` 外基本不动（已 inject `slots/locale/sessions`） |
| `test/smoke.test.cjs` | 扩展：锚点往返、索引幂等合并、截断标记、搜索命中、解析失败分支、合成记录判别；文件头注释里的旧包名同步改 |
| `README.md` / `README.en.md` | **各 8 处旧包名**：安装/升级/卸载命令、安装后路径、F12 调试提示；另补来源标注、改动说明、与原版不共存、锚点语法与边界 |
| `docs/DESIGN.md` | 本文 |

---

## 7. 风险与对策

| 编号 | 风险 | 对策 |
|---|---|---|
| R1 | **拉全史把历史灌进会话窗口**：官方 prepend 无回收上限，Chat 主滚动区不虚拟化 → 58 页全部常驻并参与渲染 | **已实测确认代价过高**，v1 **不拉全史**：只检索已加载窗口（D2 定稿）；拉取改为用户显式动作且需满足 §5.2 全部守卫 |
| R2 | **`deriveTraceTree` 是 O(N²)**：58 页累计扫描约 1,864,792 个事件（≈最终量的 31.5 倍） | v1 只 derive 已加载窗口，风险不触发；若将来真做分页拉取，必须先做增量 derive（按 seq 增量 fold），不能每页全量重算 |
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

1. **安装闭环（已于 2026-11-12 实测通过）**：`dsh plugin --profile web add <本地路径>` → `dsh --profile web --dump-config` 出现插件行 → 启动后客户端模块清单里出现 `dsh-trajectory-traceview-plus/client.js`（紧邻官方 `dsh-client-ui-trajectory`）→ 拉到的 bundle 内含 `id: "dsh-trajectory-traceview-plus"`、`id: "traceview-plus"`、`order: 21` → 页面里 `<style data-plugin-css>` 为 `dsh-trajectory-traceview-plus/traceview.css` → `remove` 后 profile `package.json` 与组合树均无残留。**四项全过。**
2. **单测（先跑基线）**：`node test/smoke.test.cjs` 必须全绿，再叠加新断言。**基线已于 2026-11-03 实测通过**：`TV PLUGIN SMOKE TEST (v5) OK — turns=4 steps=4 stations=11 tokensIn=750 model=deepseek-chat`
3. **锚点闭环**：复制 → 刷新页面 → 粘贴解析 → 定位到同一条（含未加载历史的情况）
4. **窗口内检索**：在已加载的 ≥20 轮轨迹里搜工具参数，命中并能跳转；**边界断言**：更早未加载的历史不得被判为"无结果"，UI 必须标注"更早 N 页未加载"
5. ~~**预算与中断**~~ **（作废：索引已随 D2 取消，无边可中断）**
6. **共存性（2026-11-13 实测通过）**：官方「轨迹」页签在切换前后 `main` 的 `innerText` 长度与节点数**完全一致**（15068 字符 / 1425 节点），切回后 `dstv_` 残留节点 0；卸载并重启后页签只剩 `对话` / `轨迹`、`style[data-plugin-css]` 里 `traceview` 为 0 条、`data-slot-error` 0；重新安装后页签恢复 3 个、站点 57、锚点输入框在位
7. **降级（2026-11-13 实测并修复）**：初版**会崩**——`eventNodes` 含 `null` 抛 `Cannot read properties of null (reading seq)`，`runningCalls` 传对象抛 `not iterable`，`requests` 传对象抛 `not iterable`。已加 `safeList()` 统一强制转换，13 组畸形输入全部不崩且返回空树；单测固化
8. **合成记录**：构造一个被中断的合成前缀（小数 seq），确认它被标识为"未持久化/不可深链"，且不会把小数喂给 `loadThrough`；落定为 durable 整数 seq 后锚点仍可用
9. **窗口边界（2026-11-13 实测通过）**：三态（无 timing / timing 带 null / 只有开始）分列断言：`startMs`/`endMs` 只能是 `null` 或有限数、**不得为 0**；`timingRecorded` 在无 timing 时为 `false`、在有 timing 但字段为 null 时为 `true`；半截记录的 `endMs` 保持 `null` 而不会被兜底成 `startMs`。三个变异（兜底成 0 / 恒 true / endMs 兜底）全部变红
10. **深链争用（2026-11-13 实测通过）**：先点「加载更早历史」，150~200ms 后立刻粘 `tvp1:e258` —— 最终 57 → 1348 站点、`location.hash` 变 `#tvp1:e258`、详情锚点读数 `tvp1:e258`、无卡死（没有按钮停在正在加载更早）、`data-slot-error` 0
11. **孤立工具结果（已验）**：构造 `call === null` 的 `ToolResultNode`，确认它有 `orphan-tool` station、计入 `stats.tools` 而非 `steps`、锚点为 `tvp1:e9`；真实会话上另有 5 个孤立站点实测存在
12. ~~**stale `p` 回收**~~ **（作废：合成 `p` 条目只存在于索引里，索引已取消）**
13. ~~**宿主 FTS5 能查到当前会话**~~ **（已关闭：FTS5 建不起索引，见 §12.13）**。保留的实测结论：`session_event_search` 在 `targetId` 缺省时确实命中调用方自身历史（`dsh-tool-session-query/lib/index.js:453-454`），只把上界压到当前 step 之前（`:794-798`）——**这条能力存在，但本机规模的索引建不起来**
14. ~~**索引循环的三个守卫**~~ **（作废）**。其中无进展即停的等价守卫保留在锚点翻页循环里：`stationsRef.current.length` 未变化且 `loadOlder()` 返回未移动时立即退出

---

## 9. 里程碑

| 阶段 | 内容 | 说明 |
|---|---|---|
| **M1** | 锚点：整数 durable seq 稳定键 + 合成记录判别 + 可读标签 + 复制 + 深链解析（含 step id 修正、**O1 孤立工具结果 station**）<br>时间点（G4，仅纯呈现部分）：T1 行内起止 + T3 空档标注 + T4 时钟刻度 | 不碰索引层、不灌窗口、不花 token，风险最低，可独立交付 |
| **M2** | ~~全历史检索改走宿主侧 FTS5~~ → **窗口内检索 + 覆盖边界标注**（FTS5 已实测证伪，见 D2/§12.13）；<br>G4 的 T2 时钟轴开关（已完成：等距/按时钟切换）<br>T5 KPI 拆分（已完成：`timingRecorded` 三态） | 检索部分**成本大幅下降**：不再需要 profile 改动、不再需要宿主索引、不再需要"查询结果 → station 坐标"适配 |
| **M3**（v2 候选） | 从某步 fork 重放 / 上下文归因 / 失败与循环标记 | 另出方案。**注**：fork 比原先估计便宜——客户端 `ctx.sessions.fork({sessionId, atSeq})` 已存在，Chat 侧还有官方 `forkAt(seq)` 可参照 |

先做 M1 的理由：锚点是 M2 的基础（跳转要靠它定位）；G4 是纯呈现，能立刻验证我们对 `time` 字段的理解是否正确。两者都能单独验证"我们确实读懂了这套快照"。

---

## 10. 决策项（已给默认值，可否决）

四项都已给出默认取值，按此可直接开工；任一项不同意再改。

| # | 决策 | 默认取值 | 理由 |
|---|---|---|---|
| 1 | 是否建索引 | **v1 不建索引**（只对已加载窗口做内存过滤） | D2 两条路都实测不通；对已加载窗口过滤不需要索引，也就不存在"默认开/关"与内存预算问题 |
| 2 | 检索语料上限 | 已加载窗口本身（无额外预算） | 实测最大会话截断后 `hay` 就有 22.49 MiB；一旦要跨页检索就必然撞预算，故 v1 不跨页（见 D2） |
| 3 | 锚点形态 | **两套都给**：稳定键 `e{整数 seq}` + 可读 `t3s7` | 未解析全史时只给稳定键；解析后附可读形式 |
| 4 | 接受"拉全史"灌入窗口 | **不接受（已反转两次）** | 实测 58 页历史会全部常驻 Chat 且不回收；宿主侧 FTS5 又实测建不起索引（D2）→ v1 不灌窗口、不建索引，只检索已加载窗口 |

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
| **P1 不可行** | 客户端 `loadOlder()` 分页 + 内存索引（D2 方案 A） | 最大会话 58,994 事件 / 92.8 MiB / **58 页**；官方 prepend **无 eviction**；Chat 主滚动区**不虚拟化**（`useVirtualizer` 只在 TurnNavigator，`dsh-client-ui-chat/lib/client.js:290` vs 主区全量 `entries.map` Chat 主滚动区的 `entries.map`）→ 58 页全部常驻并渲染 | 方案 A 否决（保留）；当时改投宿主侧 FTS5，**该替代方案也已实测证伪**，见 §12.13 与 D2 定稿 |
| **P1 复杂度** | "分页之间让出事件循环"即可（R2） | `deriveTraceTree` 对全 nodes 排序并多次全扫描（region `pure helpers`），58 页累计扫描 ≈**1,864,792** 个事件（≈最终 59,108 的 **31.5 倍**） | R2 改写：必须增量 fold，不能每页全量重算 |
| **P1 预算** | 单条 4 KB、总量 **32 MB** | 仅截断后 `hay` 就 ≈**22.49 MiB**（1,044/6,834 条被截断），未计 Map/key/meta/数组/station 对象 | §5.3 与决策项 2 改为 **24 MiB 且计入对象开销**；触顶即停 |
| **P1 未处理的失败** | 循环只写了"暂停/可中断" | `loadOlder` 在未打开/无 hasMore/已分页时**静默 return**（`session.js:313-318`），远端错误也被吞（`:327-335`）；resync 会递增 `openGeneration` 丢弃旧 stream（`:402-408`）；设计不检查 no-progress → **可能空转** | §5.2 增五个必须守卫（绑定 sessionId+generation、no-progress、append 后重基线、compaction 清空、切换即 abort）；新增 R15/R16 |
| **P1 我拒绝方案 B 的理由错了** | "上述工具默认排除调用方自身会话" | `session_search` 排除调用方（`dsh-tool-session-query/lib/index.js:748-786`），但 **`session_event_search` 能查自身会话**：`targetId` 缺省即 `caller.id`（`:453-454`），只压上界到当前 step（`:794-798`） | D2 里已更正这条；但即便如此仍救不了宿主方案（见 §12.13），最终 v1 不做全史检索 |

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

### 12.12 T5 核实结论与 T2 实现（2026-11-12）

**T5 的核实结果：官方没有「推算耗时」这回事，因此拆分 KPI 的前提不成立。**

| 核实项 | 结论 |
|---|---|
| `AssistantTiming` 是否有 `source` 字段 | **没有**。只有 `stepStartTime` / `firstTokenTime` / `completedTime` 三个时间戳（`dsh-client-ui-conversation/lib/types/client/contract/records.d.ts:54-61`） |
| 官方如何区分「没有耗时」的原因 | 用 `timingRecorded: boolean`（`= timing !== void 0`），见 `dsh-client-ui-trajectory/lib/types/client/trajectory-record.d.ts:10` 与赋值处 `lib/client.js:7321` |
| 官方是否会用单端推算另一端 | **不会**。`timingRecorded` 为假显示「未记录」，`stepStartTime === null` 显示「步骤开始时间不可用」，从不推算（`lib/client.js:3650-3658`） |
| 本项目是否在推算 | **没有**。`durationMs` 要求两端都有，否则 `null` |

所以原计划里的「KPI 把真实耗时和推算耗时混在一起」**不成立**——不存在混算。真正的问题是另一个：我们把「完全没有 timing」和「timing 有记录但边界落在窗口外」**都压成了 `null`**，无法区分。

**实际做的**：引入 `timingRecorded`（与官方同名同义），详情头部据此显示三种状态：`⏱ 39,224 ms` / `⏱ 未记录耗时` / `⏱ 耗时不全`，后两者带 tooltip 说明原因。

**真实数据下的诚实结论**：会话「Docker 安装检查」的 **55 个 step 全部有完整起止时间，两个「无耗时」分支在真实数据里一条都没出现**。也就是说这两条分支目前只有单测覆盖，没有真实样本。它们不是死代码（窗口边缘、进行中步骤、无 timing 的旧记录都会触发），但我无法声称「实战验证过」。

**T2 实现**：工具栏加「⏱ 等距 / 按时钟」切换。按时钟模式下，空闲色带宽度按 `10 + 15·log₂(1+秒)` 缩放，上限 220px。站点卡片本身宽度不变——**这是对原始规格的有意收窄**：完整复刻官方的时钟轴投影需要重写整条布局（当前是 flex 定宽 264px 流），成本远高于收益，而「长间隔看起来更长」已经能解决「看不出哪段在等」的核心诉求。

**参数是算出来的，不是拍的**：初版用 `28 + 26·log₂`，30 秒就给 157px、5 分钟顶到上限，整条轨道失去区分度——**这是单测单调性断言当场抓出来的**（`n5m === n1h === 220`）。改为 `10 + 15·log₂` 后，30s≈84px、5m≈134px、1h≈187px、4h 后才触顶。

**实测**（真实会话，77 个站点）：切换后 18 条空闲色带全部带 `data-on`，宽度 94/100/108/114px 随 47s/62s/92s/123s 递增。

### 12.13 宿主侧 FTS5 实测证伪（2026-11-12）

第五轮复核把 D2 从"客户端分页"推到"宿主侧 FTS5"，理由是前者代价过高。**这一轮证明后者在本机规模下根本建不起索引。**

**做法**：`~/.dsh/profiles/web/cordis.patch.yml` 末尾覆盖 `session-query-sqlite` 为持久 `path` + `openAt: first-search`（`dsh-base` 与 `dsh-web-app` 两层原本设成 `:memory:` + `never`），删掉 `session-query.db*` 重启，再从页面内用 `POST /api/session/search` 发真实请求（`{type:'client-request', method:'session/search', payload:{args:{request:{query:'compose', limit:5}}}}`）。

**结果**：

| 观测 | 值 |
|---|---|
| 返回耗时 | 426,673 ms（≈7 分钟） |
| 错误码 | `gateway/internal` / `session-search persistence observation did not stabilize after one retry`（`SESSION_QUERY_PERSISTENCE_FAILED`） |
| 进程 CPU | 冲到 208%，随后回落到 0.1%（说明确实干了活，但没提交） |
| `session-query.db` | 4096 B，`-wal` 57,712 B，`persisted_sessions` **0 行** —— 全程未提交 |

**根因**（`dsh-session-query-sqlite/lib/index.js:707-756`）：`_observeStable` 的第 1 轮会 `persistence.list()` → 对每个未索引且非活跃会话全量 `readColdSessionLog` → 再 `list()` 比对，不一致即 `continue`；`STABLE_OBSERVATION_ATTEMPTS = 2`（`:474`），第二轮仍不一致就抛。本机 376 个日志 / 解压 677.8 MB，一轮冷读以分钟计，而 `list()` 的 revision 随任何活跃会话写盘即变——**只要有会话在写，全量建索引的稳定窗口就不存在**。且 `_reconcile` 是 all-or-nothing，失败后 `searchSessions`/`searchEvents` 整体报错，没有局部降级。

**过程中发现的第二个坑**（同样实测）：8 个 `version: 0` 会话含 `subagent/descriptor` v2，converter 直接抛 `unsupported descriptor version 2`；由于 all-or-nothing，**一条坏日志就能让全部检索不可用**。把它们移走后索引才开始真正重建（CPU 起来），但仍卡在上面的稳定窗口问题上。

**第三个坑**（与检索无关，但差点误判成插件故障）：这 8 个会话是"扁平日志"布局，直接放在 `~/.dsh/sessions/` 根下。`listSessionDirs` 会把它们当成 project 目录并抛 `uses the unsupported flat-file layout`（`dsh-session-persistence-jsonl/lib/index.js:3523-3536`），结果 `workspace` 失败并连带 5 个插件 pending（`session-controller` / `schedule` / `workspace-controller` / `ui-deliverables`）。**表面症状是"轨迹页没了"，实际是组合层挂了 5 个插件。** 归位到 `~/.dsh/sessions-archive-v0/` 后启动恢复单行、无告警。

**处置**：撤掉覆盖，恢复 `openAt: never`；删掉 `session-query.db*`；D2 改为"v1 不做全史检索，只检索已加载窗口"（见 D2 定稿）。配置里保留一段注释记录这次证伪，避免后人重试。

**这轮的教训**：第五轮复核给的"改走宿主侧 FTS5"建议，本身也是**未实测的推理**——它正确指出了方案 A 的成本，但把方案 B 当成了免责替代。**推翻一个方案不等于另一个方案成立**；替代方案同样要跑一遍真实规模，尤其是涉及"全量重建 + 快照一致性"这种必然与活跃写入冲突的机制。

### 12.14 D2 定稿后的实现与真实数据验证（2026-11-12）

D2 从"全史检索"降级为"已加载窗口内检索"后，代码上的实际改动只有一处：**把覆盖边界显式说出来**。

原版（v0.3.0）的搜索框只显示 `1/54 命中` 或 `无命中`——在长会话里这会**误导**：用户搜一个早期命令，界面答"无命中"，而真相是那部分历史根本没加载。

**实现**：
- 纯函数 `searchScopeNote(hasMore, loading, t)`：`hasMore !== true` 时返回 `null`（全量已加载，无需提示）；否则返回 `search.scopePartial`，加载中返回 `search.scopeLoading`
- 工具栏搜索框旁渲染 `⬆ 仅已加载范围` chip，tooltip 写明"未加载的部分不会被判定为『无命中』"，点击直接调用已有的 `doLoadOlder()`（复用原版 `action.loadOlder` 那条路径，没有新逻辑）
- 只认真正的布尔：`SessionSnapshot` 上 `hasMore` / `loadingOlder` 都是可选的，用 `=== true` 判定，`undefined` 一律当"已全量加载/未在加载"

**单测 + 变异测试**（新断言 6 条，全部先验证"能抓到回归"）：

| 变异 | 结果 |
|---|---|
| `searchScopeNote` 恒返回 `null` | 红：`D2 must flag the loaded-only range` |
| 忽略 `loading` 状态 | 红 |
| 把 `hasMore !== true` 写成 `if (hasMore)` | 红 |

**真实数据验证**（本机 web profile，2026-11-12 21:5x，装的是本仓库代码，`dsh plugin --profile web add /Volumes/Work/code/dsh-trajectory-traceview`）：

| 观测 | 值 |
|---|---|
| 页签 | 3 个：`对话` / `轨迹`（官方）/ `轨迹视图`（本插件） |
| 轨迹视图 DOM | 1,674 个 `dstv_` 节点、**77** 个站点 |
| 输入 `bash` 后 | `1/54 命中`，chip 文本 `⬆ 仅已加载范围`，tooltip 正常，未 disabled |
| 点击 chip | 站点 77 → **146**，命中 54 → **112**，`hasMore` 仍为真故 chip 保留 |

最后一行是重点：这个 chip 不是装饰——**点一下确实会多加载一页并把新命中的站点纳入搜索**。

**仍未做到的**：截图。`Page.captureScreenshot` 在这个 DOM 规模下稳定超时（1,674 节点时必现），所以"视觉观感"这一项**至今没有证据**，只能说布局测量值（站点数、跨度行、色带宽度）都符合设计，不能说"看起来没问题"。

### 12.15 收尾优化（2026-11-12）

**1. profile 配置瘦身**：D2 那段 10 行长注释压成 4 行，保留"不要再试"的结论与文档指针（`~/.dsh/profiles/web/cordis.patch.yml`，3826 B）。401 修复的 `llm-deepseek` / `llm-deepseek-account` 禁用块原样保留。

**2. 旧会话暂存后删除**：8 个旧会话先移到 `~/.dsh/sessions-archive-v0/`（1.8 MB）并写 `README.md` 说明为什么必须移出（扁平布局会让 5 个插件不激活）、为什么加载不了（descriptor v2）、以及恢复步骤。当时**没有直接删**——这是用户数据，决定权不在我。2026-11-13 用户确认内容不需要，已连同暂存目录一并删除。

**3. D5 身份改造落地**（见 D5）：包名 / patch id / 客户端模块 id / 样式标签 id / `dataset.plugin` / view id / order / `engines` / 仓库地址，共 9 处，加 README 中英各 8 处、测试头部 1 处。`version` 从 0.3.0 提到 0.4.0——功能集已明显超出上游。

**4. README 补齐说明**：新增"检索范围显式标注""站点可定位可复制""时间看得见"三组特性，顶部加醒目的"这是增强版、不要与原版同装"，License 段补上游署名与实质改动清单（MIT 要求，也便于将来给上游提 PR）。

**验证**：改名重装后重启单行无告警；3 个页签（`对话` / `轨迹` / `轨迹视图`）；77 站点 = 72 步骤 + 5 孤立；`dstv_spanRow` 72 条；搜 `bash` → `1/54 命中` + `⬆ 仅已加载范围`；单测全绿。

### 12.16 G2 收敛：锚点闭环、以及 `loadThrough` 被实测证伪（2026-11-13）

**背景**：G2 的验收判据是"复制锚点 → 刷新 → 粘贴 → 精确回到同一条记录"。改动前只完成了"生成 + 解析"，**没有粘贴入口，也没有跨页定位**——能复制出一串 `tvp1:e3019`，但用户无处可粘。这一节记补齐过程。

#### 补上的三件事

1. **🔗 锚点粘贴输入框**（工具栏）：回车定位，Esc 清空；解析失败、目标未持久化、目标未加载都各有明确提示（`anchor.bad` / `anchor.notPersisted` / `anchor.notLoaded`），并常驻头部状态条，不会只挂在详情面板里看不见。
2. **URL 哈希双向联动**：定位成功后 `history.replaceState` 写入 `#tvp1:...`；反向也监听 `hashchange`，手改 URL 或浏览器后退都能重新定位。**刷新页面仍停在同一条记录**（实测）。
3. **跨页自动向前翻页**：目标不在当前窗口时，自动调用 `loadOlder()` 直到命中。

#### 实测：`session.loadThrough(seq)` 不可用

原设计（§6 旧稿）写的是"定位改用 `session.loadThrough(seq)`（不再手写分页循环）"。**真机验证表明这条行不通。**

观测（真实会话，57 站点）：

| 调用 | 返回 | 站点数 | 说明 |
|---|---|---|---|
| `loadThrough(1)` | 解析成功 | **57 → 57** | 没变化 |
| `loadOlder()` | 解析成功 | **57 → 118** | 正常 |

埋点进一步确认：`loadThrough` 确实动了 `baseSeq`（`inject` 里比对 `session.baseSeq` 前后不同，返回 `moved: true`），但**轨迹投影没有任何波动**——`stationsRef.current[0].anchorSeq` 仍然是 11693，`e1` 一次都没出现。

读官方实现（`dsh-api-session-controller/lib/types/client/sessions/session.js:337-396`）能对上：`loadThrough` 的循环体是 `events.prepend(...)`，累积到 `pending.pages`，收尾时 `if (generation === this.openGeneration && pending.pages.length > 0) this.prependWindow(...)`。也就是说它只在**事件源**这一层拼接，而没有走 `loadOlder` 那条会触发会话投影重建的路径；同时它有一串**静默早退**（`openState !== 'open'` / `!hasMore` / `baseSeq <= seq` / `loadingOlder`），调用方拿不到任何失败信号。

**结论**：跨页定位改回 `loadOlder()` 有界循环，并用 `anchorSeqFloor()`（当前窗口最小 `anchorSeq`）判断"已经翻到覆盖目标的位置就停"，避免无谓地拉全史。循环同时受 `ANCHOR_MAX_PAGES = 40` 与 `hasMore` 双重约束。

#### 真机验证（跨页）

| 场景 | 结果 |
|---|---|
| 窗口 57 站点，粘贴 `tvp1:e1` | 自动翻页到 **1348 站点**（窗口下界推进到 `e203`）；`e1` 在该会话中确实不存在，故如实提示"不在当前窗口"——**没有假装成功** |
| 同一会话粘贴 `tvp1:e203` | 定位成功，URL 变为 `#tvp1:e203`，详情锚点读数 `tvp1:e203` |
| **冷启动**：直接打开 `?token=…&tvp1:e203` | 自动翻到 1348 站点并定位到 `tvp1:e203`，无需任何手动操作 |
| 单元测试 | 全绿；4 个变异（floor 取最大 / 不翻页 / 非法锚点也翻页 / 哈希不去重）全部变红 |

#### 顺手修掉的两个真 bug

1. **`nextHashFor` 的"是否改写"判据是错的**：初版写成"返回值是否等于入参"。字符串是原始值，函数重新拼出同样的文本时 `===` 仍为 `true`——这个断言**抓不到变异**（实测变异后测试照常全绿）。改为显式返回 `{hash, changed}`，调用方只看 `changed`。
2. **测试断言用值比较代替身份比较**：同上的根因，一并改掉。

#### 一处仍未验证

`ANCHOR_MAX_PAGES = 40` 是否够用取决于单个会话的页数（最大真实会话 58 页）。触顶时会如实提示"不在当前窗口"，不会静默失败；但**没有真实样本触发过触顶**，所以这个上限的实际表现属于未验证项。

### 12.17 §8 验证债清算（2026-11-13）

此前 §8 的 14 条验证计划里有 7 条从未真正跑过。这一轮逐条清算，结果分三类。

#### 一、真发现 bug（已修）：畸形快照会让整页崩

**这是本轮最重要的发现。** `deriveTraceTree` 直接吃另一个插件产出的快照，此前**完全没有防御**：

| 输入 | 改动前 | 改动后 |
|---|---|---|
| `eventNodes: [null]` | 💥 `Cannot read properties of null (reading 'seq')` | 跳过该条，返回空树 |
| `runningCalls: {}` | 💥 `object is not iterable` | 视为空 |
| `requests: {}` | 💥 `is not iterable` | 视为空 |

修法：新增 `safeList(value)` —— 非数组返回 `[]`，数组则丢弃 `null`/非对象元素；`eventNodes` / `runningCalls`(两处) / `requests` 全部改走它。`callSchemas` 原本已有 `instanceof Map` 守卫，`partial` 已有 `Array.isArray` 守卫。

单测固化 13 组畸形输入（`null` / `undefined` / `{}` / 字符串 / 数字 / 各类字段错型组合），断言"不抛异常且返回带 `stations[]` 的空树"。变异验证：把 `safeList` 的 `Array.isArray` 守卫去掉 → 测试红。

**为什么以前没发现**：所有测试都在造"正常"快照。而这类崩溃一旦发生，用户看到的是**整个轨迹页白屏**，且 error boundary 只会记一条 `slot entry crashed`，很难追到根因。

#### 二、验证通过（无需改动）

- **§8.9 窗口边界**：三态分列断言通过（无 timing / timing 带 null / 只有开始）。关键点是"缺失不得兜底成 0"——0 是合法 epoch 值，兜底会把"未记录"伪装成"记录于 1970"。三个变异全部变红。
- **§8.10 深链争用**：分页在飞时粘锚点，150ms 后仍能正确翻页（57 → 1348 站点）并定位、写 URL、无卡死。
- **§8.6 共存性**：官方页签切换前后 `main` 的 innerText 长度与节点数**完全一致**（15068 / 1425），切回后 `dstv_` 残留 0；卸载重启后页签只剩两个、样式标签无 `traceview` 残留；重装后完全恢复。

#### 三、作废（对象已随 D2 消失）

§8.5（预算与中断）、§8.12（stale `p` 回收）、§8.14（索引循环守卫）三条的验证对象是**索引**，而索引已随 D2 取消。唯一有价值的部分——"无进展即停"——已等价实现在锚点翻页循环里。

#### 仍然没有证据的一项

**视觉观感。** `Page.captureScreenshot` 在 1300+ 站点、1600+ `dstv_` 节点的 DOM 下稳定超时，至今拿不到一张图。功能正确性有测量值和断言支撑，**但"好不好看"我无法作证**。

### 12.18 M3 可行性探测：fork 可做，但比原估计贵（2026-11-13）

设计里对 M3 的原判断是"fork 比原先估计便宜——客户端 `ctx.sessions.fork({sessionId, atSeq})` 已存在，Chat 侧还有官方 `forkAt(seq)` 可参照"。**探测结果：一半对一半错。**

#### 探到的三件事

1. **`ChatView` 的 `forkAt` 不是 owner prop 继承来的。** `conversation.view` 的 owner props 至今仍只有四个（`dsh-client-ui-conversation/lib/client.js:18035-18041`：`inspectCall` / `viewRequest` / `openView` / `completeViewRequest`），**没有 `forkAt`**。官方 Chat 是自己在 `inject(sessionId)` 里造的（`dsh-client-ui-chat/lib/client.js:13300-13314`）：

   ```js
   forkAt: (seq) => {
     ctx.sessions.fork({ sessionId, atSeq: seq, increaseTitle: true, onCreated: ... })
       .then((childId) => { ctx.uiWorkspace.openSession(childId); })
   }
   ```

   所以"有 `forkAt` 可参照"实际意思是"有**写法**可参照"，不是"这个能力现成能拿到"。

2. **`ctx.uiWorkspace` 未在 `inject` 声明里会直接抛错。** 首次探测报 `cannot get property "uiWorkspace" without inject`——本插件的 `inject = ["slots","locale","sessions"]` 里没有它，运行时硬失败，不是返回 `undefined`。要开 M3 必须同步改 `inject`。

3. **补齐声明后全部可用**：`hasFork: true`、`hasUiWorkspace: true`（`openSession` 为函数）、`hasSessionController: true`、`sessionId` 为 string。

#### 成本重估

| 项 | 原估计 | 实测后 |
|---|---|---|
| 拿到 fork 能力 | "已存在，可直接用" | 需在 `inject` 加 `uiWorkspace`，并在 `inject` 里照样手写 `forkAt`（约 10 行） |
| UI 入口 | 未评估 | 站点详情里加"从此步分叉"按钮 + 二次确认（fork 会产生新会话，不可撤销） |
| 边界 | 未评估 | `atSeq` 必须是**存在的 durable seq**；合成站点（`p` 锚点）不能 fork；分叉后要能切换/提示到子会话 |

**结论**：M3 不是"几乎白捡"，但也确实不贵——核心能力都在，主要工作在 UI 与边界处理。**探针已全部移除，工作区干净**（`git status` 无改动，页面 `window.__m3probe` 为 absent，60 站点正常渲染）。

#### 顺带确认：截图通道彻底不可用

本轮又试了三条路，全部失败：

| 尝试 | 结果 |
|---|---|
| `page.screenshot()` 全页 | `CDP request timed out` |
| `page.cdp('Page.captureScreenshot')` 原样调用（jpeg/低质量/`optimizeForSpeed`） | 同样超时 |
| 先 `Emulation.setDeviceMetricsOverride` 缩到 420×300 再截 | 同样超时 |

也就是说超时与**视口大小、编码、DOM 规模都无关**，是这个 CDP 通道本身不可用。`page.snapshot()` 只返回可访问性树（890 字符），不含视觉信息。**视觉观感这一项，我不会再声称能验证。**

### 12.19 Codex 复核：三条建议与采纳结果（2026-11-13）

请 Codex（经 Orca worker）对本项目后续方向做了独立评审。它给出三条建议，**我逐条核实引证后全部采纳并实现**。

#### Q1：它赞成暂缓 M3，但理由和我不同（重要）

我的理由是"定位错位 + 官方已覆盖"。Codex 指出更准确的理由是**机会成本**，并给了一个我没考虑到的反面场景：

> 唯一明显更值的场景，是**一轮内保留昂贵、可安全重用的搜索/只读工具结果，只改后续回答**；而副作用工具的会话分叉**不会回滚工作区**，因此不能泛称可重放。

这条比我原来的判断更精确：M3 并非"没用"，而是**只在"只读工具已花费高昂成本 + 后续回答有问题"这一个窄场景**下更值，而这个场景同时又受"工作区状态无法回滚"的严重限制。**结论不变（不做），但理由修正**。

#### Q2-1：提示词差异只看到"字符数变了"，看不到"哪里变了"

**核实属实**：`promptDiffOf` 原本只产出 `systemDelta`（字符数差）和工具名增删。而 `RequestPromptChange.previous` 是完整的 `ConversationPromptSnapshot`（含 `system` 全文与 `tools` 数组，见 `dsh-client-ui-conversation/lib/types/client/contract/request-inspection.d.ts:10-21, 42-55`），**数据一直都在，是我没用**。

这正是"调优提示词"场景的核心痛点：改了一句系统提示，界面只说"字符 +12"，用户无法确认改的到底是哪句。

**实现**：`promptTextDiff()` 做**公共前后缀裁剪**（一次中间改动不会显示成"全都变了"），返回变更行、起始行号、是否截断；`changedTools()` 按 `名称+描述+schema` 比较，**同名但定义改了**的工具单独标为 `~`。UI 增加可展开的 before/after 双栏。

#### Q2-2：近似重建的上下文可能被误当成"答案的原因"

**核实属实**：消息列表是 `reconstructMessages()` 按日志重建的，但不代表服务端实际收到的字节；而面板上没有任何区分标记（原文只有一句"近似重建"，且被埋在长文案里）。

**实现**：`evidenceOf()` 产出三级标记并在面板上以徽标呈现——`原始记录`（来自日志原字段）/ `近似重建`（按日志重新拼出）/ `可能不全`（窗口外历史未加载），每个都有 tooltip 说明"不要把它当成唯一证据"。

#### Q2-3：整段轨迹导出对"复盘单个失败步骤"太重

**核实属实**：`buildTraceMarkdown()` 一次性导出全部轨迹。想复盘某一步为什么错，用户得复制整段再删。

**实现**：`buildStepMarkdown()` + 详情头部「📋 复制本步复盘」按钮。一个包内含：锚点、证据等级、请求配置、提示词/工具差异（含 diff 代码块）、思考/正文/工具参数/工具结果、重建消息摘要。实样已人工核对。

#### Q3：它指出的最大风险——快照契约漂移

> 当前包声明 `dsh >=0.2.1-rc.1` 却依赖多个具体字段，`safeList` 会把类型变化**压成空数据而显示空态**

**这条我认，而且它指出了我上一轮防护的副作用**：`safeList` 让崩溃变成"安静的空白"——比崩溃好看，但**更难察觉**。计划中的应对已记入待办：契约夹具 + 显式"不兼容"状态，而不是静默空态。

#### 验证

- 单测新增 4 组断言块，**6 个变异全部变红**（不裁剪前后缀 / 相同文本也返回差异 / 工具只比名字 / 复盘包不带锚点 / 不复述证据等级 / 不写工具结果）
- 其中 M3 变异（不写工具结果）**第一版没抓到**——原断言只检查"有没有 ```"，而参数块本身也有围栏。改成"必须包含工具结果文本片段"后才抓到。**这是本轮第 5 次出现"断言看起来对、实际抓不到"的情况**
- 真机验证：证据三标签正常渲染（`原始记录` / `近似重建` / `可能不全`）、`复制本步复盘` 按钮在位、`data-slot-error` 0、单测全绿
- 一处**未能现场验证**：当前这条会话前 40 个站点没有提示词变更记录，所以真实 UI 里的 diff 双栏渲染只能靠单测与构造数据证明，**没有真实样本**。已如实记录

### 12.20 契约漂移防护：Codex 第二轮复核（2026-11-13）

请 Codex 复核"静默丢数据"风险。**它纠正了我的一处证据错误**，并给出可直接执行的判据。

#### 先认错：我给出的 fixture 证据不成立

我在请求里声称"混合数据会显示 1 个站点、另外 2 个静默消失"。Codex 指出我贴出的样例 `stations: 0`，并说"未提供输入的『带 turn 1 站点』不可复现"。

**我自己重跑后确认它是对的**：

- 贴出的 mixed fixture（`user` + 两个未知名）→ **0 站点**，因为 `user` 节点只进 `pendingUser`，要等 `flushUser` 在有 turn 之后才落地
- 我随后试图用 `kind: 'turn/start'` 造 turn → 仍然是 0，因为**投影器根本不消费 `turn/start`**，turn 只会由 `assistant` / `tool-result` / 特殊事件 / `runningCalls` 触发创建

**真实的"静默丢数据"是能复现的，但构造方式不同**：一个可识别的 `assistant` 节点 + 两个未知 kind → `stations: 1`，两个未知节点**无声消失**。证据成立，但我的原始构造是错的。

#### 采纳的判据（Codex 给的，比我原来的想法更精确）

1. **已知 kind 名单由投影器自己拥有**（`KNOWN_NODE_KINDS`），紧贴投影逻辑，避免"画什么"与"认识什么"两张皮
2. **最低契约**：hook 存在、snap 是对象、`eventNodes` 存在且是数组、每项是对象且 `kind` 为非空字符串、`seq` 为**有限数值（允许小数）**。缺项/错型 → 不兼容态
3. **混合有效与未知/无效记录时，保留有效站点并显示计数**——不因为有几条坏的就把整页判死
4. **普通空态只用于"契约通过且确实没有可显示数据"**的快照

#### 实现

- `snapshotContract(snap)`：返回 `{ok, problems[]}`，问题码可读（`no-snapshot` / `missing-eventNodes` / `eventNodes-not-array` / `bad-node-shape`）
- `unknownNodeStats(nodes)`：分别统计 `unknown`（kind 不认识）与 `invalid`（结构不可用），并列出不认识的 kind 名
- `isEverythingUnknown(nodes, stats)`：**单独一类升级信号**——契约检查全过但一条都认不出
- UI：非空时头部显示 `⚠ N 条记录无法识别 [kind1, kind2]` / `⚠ N 条记录结构异常`；空态区分「不兼容」（含原因码）与「暂无数据」

#### 实现途中发现的新坑（这条最有价值）

**只做 `snapshotContract` 是不够的。** 我模拟 DSH 升级把 kind 全部改名（`turn.start` / `message.user` / `message.assistant`），结果：

```
stations: 0 | contract.ok: true | problems: []
```

字段名一个没变、类型全对、`seq` 全合法——**契约检查通过，但一条都认不出**，空态仍然会显示"暂无数据"。也就是说 Codex 原话"缺项/错型走不兼容状态"漏掉了"字段合法但语义全变"这一类，而这类恰恰是最可能的升级方式。

补了 `isEverythingUnknown()` 作为第二个独立触发条件后，同样的场景正确升级为不兼容态，并在原因码里带上 `unrecognized-kinds: turn.start|message.user|message.assistant`——**用户能直接看到是哪些 kind 不认识**。

#### engines 修正（采纳 Codex 建议）

`engines.dsh` 从 `>=0.2.1-rc.1` 改为 **`=0.2.1-rc.5`**（本机 `dsh --version` 实测）。理由：宽范围是"兼容声明"不是"测试记录"，钉到实测版本更诚实；后续实测通过再放宽。版本号同时提到 0.6.0。

#### 验证

新增 4 组断言块，**5 个变异全部变红**：未知 kind 不计 / 空快照判不兼容 / 小数 seq 判非法 / 已知名单漏项 / 不升级为不兼容。

**真机负向验证**：当前会话 66 站点、`incompat` 0、漂移徽标 0、`data-slot-error` 0 —— 说明正常数据**不会误报**。模拟升级场景用构造数据验证正确升级（无法在真机上制造 kind 改名，这一点如实记录）。

### 12.21 第三轮复核：三个投影错误 + 一个文案说谎（2026-11-13）

请 Codex 做第三轮评审，要求它先跑测试、再读代码。**它没有推荐任何新功能**（"Q1 暂无新功能值得排在正确性修复前"），而是找出四个真缺陷。我逐个复现，**全部成立**。

#### 缺陷 1+2：用户消息的归轮逻辑是错的（最严重）

**现状**：`user`/`steering`/`context` 节点先塞进 `pendingUser`，等遇到 assistant 或特殊事件时才 `flushUser(turn, seq)`，且 flush 到"当时那个 turn"。

两个后果：

| 场景 | 修复前 | 修复后 |
|---|---|---|
| 快照里**只有** user 消息 | `stations: 0` —— **整条消息凭空消失** | `stations: 1`，正常显示 |
| 第二轮提问（该轮还没有 assistant） | 被挂到 **turn 1** 名下 | 归到 **turn 2** |

第二个更隐蔽：用户在界面上看到"第二轮提问"出现在第一轮的分组里，会直接误判上下文边界。

**修法**：user 节点若有 `turn` 字段（或 `partial.turn` 可用）就直接建 turn；否则进 `pendingUser`，循环结束时若仍未归位，**给它自己的 turn**（而不是挂到 `lastTurnEntry` 或丢弃）。

#### 缺陷 3：同一个工具调用被算两次

`runningCalls` 与 `partial` 可以同时描述同一个在飞调用。`partial` 的分支会检查 `attachedCallIds`，但 `runningCalls` 的分支**只检查不认领**，于是：

```
stats.tools: 2   ← 实际只有 1 个工具
tool cells: [{call:"dup1"}, {call:"dup1"}]
```

**修法**：`runningCalls` 分支也执行 `attachedCallIds.add(c.callId)`。

#### 缺陷 4：单步复盘包漏掉子调用、静默截断结果

- `subCalls` **完全没写**——而子调用恰恰是"这一步为什么失败"的关键
- 结果 `slice(0, 4000)` **没有任何截断标记**，读者无法知道拿到的是残缺结果
- 重建消息只输出一行 preview，不是正文

**修法**：补子调用（名称/耗时/参数/结果首行）、截断时写明 `…(5,000 字)`、消息改为完整正文。

#### 缺陷 5：中文文案说了 UI 没做的事

`view.incompatibleHint` 中文写的是"这里会**显示为空**而不是崩溃"，但实际 UI 显示的是**明确的警告态**。英文文案是对的。已修正中文。

#### 关于 Q3（单文件 2,949 行要不要拆）

Codex 建议**不拆**：locale/style/helpers/view/entry 已有清晰 `//#region` 划分，个人插件且要求单 bundle，拆文件会额外引入构建链。**我同意**——拆分的收益主要在多人协作与独立发布，这里都不成立。

#### 验证

- 新增 7 组断言（4 个缺陷 + 子调用/截断标记/文案）
- **4 个变异全部变红**：user-only 又丢 / runningCalls 不认领 / 复盘包不写子调用 / 静默截断
- 真机：66 站点、`incompat` 0、`slotError` 0、`复制本步复盘` 在位
- **过程中我又写错两次断言**：一次断言中文字面量 `"5000"`，实际是 `fmtInt` 格式化的 `"5,000"`；一次 grep 搜错目标误判为"截断标记没生效"。两次都是断言的问题，不是代码的问题

#### 这一轮的意义

三轮复核里，**第三轮最有价值**——它没有提任何新功能，而是指出"已经做出来的东西算错了"。`user` 消息归错轮、工具重复计数，都属于用户**一眼看不出、但结论会被悄悄带偏**的错误。这类缺陷比缺功能严重得多。

### 12.22 收尾优化：把"同类问题"全部查完（2026-11-13）

在第三轮复核修完之后，我按同样的思路把剩余同类问题扫了一遍，不只看 Codex 点名的几处。

#### 一、承诺与实现不符（3 处）

1. **`anchor.jumpTip` 说"自动向前翻页"，但没说有上限**。实测 `ANCHOR_MAX_PAGES = 40`，触顶时原本只说"不在当前窗口"，用户不知道该手动再拉一页。现在：
   - 记录翻页停止原因（`capHit`），触顶时给可操作提示「已向前翻页 40 页仍未找到；可先手动点『加载更早历史』再重试」
   - 中英文提示文案都写明"有页数上限"
2. **i18n 完整性审计发现两个真缺失**：`t()` 在键缺失时会静默回退成原始 dotted id 直接显示在 UI 上（例：`detail.request` 会原样印出来）。实测**中文缺 `anchor.capped`、中英都缺 `detail.request`**。补齐后新增**中英键 parity 断言**，变异（删掉任一键）立即变红。
3. **中文 `view.incompatibleHint` 写"显示为空"**，与实际的警告态不符（第三轮已修，此处复核确认）。

#### 二、功能盲区：6 类站点点「复制本步复盘」导出空壳

这是本轮自己找到的最大问题。`buildStepMarkdown` 只遍历 `station.cells`，而**孤立工具结果 / 轮次失败 / 重试 / 压缩 / 命令 / 达到 maxTokens** 这六类站点把载荷放在**站点本身**（`summary` / `message` / `outcomeText` / `resultText` 等），不在 `cells` 里。

实测这些站点的包长度只有 53–59 字符——**一个标题加一个锚点，什么内容都没有**，而按钮写着"复制本步复盘"。

**修法**：按 kind 分支从站点字段取载荷，孤立工具额外补参数/错误名/结果，并把截断改成显式标记。新增测试逐类验证"包里必须有正文"和"载荷文本必须出现"，3 个变异全部变红。

#### 三、易读性：长会话 KPI 显示成 `3600.0 s`

`fmtDur` 只做 ms / s 两档，而它唯一的使用点是 KPI 的**总工具耗时**。在长会话上会输出 `3600.0 s` / `86400.0 s` 这种没法读的数。改为 ms / s / min / h 四档自适应，边界断言覆盖 59999 ms（仍是秒）到 24 小时。

#### 四、排查过但确认没问题的

- `attachedCallIds` 其余三处「检查即认领」都正确，没有第二处重复计数
- 每个已知 kind 单独喂最小节点，10/10 都产出站点（`user`/`steering`/`context` → user，`tool-result` → orphan-tool，其余各归各位）
- 新 turn 之后紧跟的特殊事件（`compaction`）按 seq 正确归到新 turn，没有被旧 turn 抢走
- `user → assistant → user → assistant` 序列无重复站点、归轮正确（4 站点）
- `follow` 模式的 `scrollLeft = scrollWidth` 实现属实，文案没夸大的地方

#### 验证汇总

- `node test/smoke.test.cjs` 全绿
- 新增断言：i18n 双语 parity / 6 类特殊站点复盘包 / `fmtDur` 边界 / 页数上限提示
- 变异测试：删 i18n 键 / 特殊站点包为空 / 丢错误名 / 丢命令输出 / `fmtDur` 退化 → **全部变红**
- 真机：66 站点、`incompat` 0、`data-slot-error` 0、`复制本步复盘` 在位、**页面上无 raw dotted i18n key 泄漏**

#### 仍然没有证据的一项（不变）

视觉观感。CDP 截图通道在这个 DOM 规模下三条路径全部超时，功能正确性有断言，**好不好看需要人眼看**。

### 12.23 视觉证据：截图通道终于打通（2026-11-13）

此前多次记录"CDP 截图通道在这个 DOM 规模下必超时，拿不到任何视觉证据"。这一条**被推翻了**——换了一条完全不同的链路后成功。

#### 找到的可用路径

`Page.captureScreenshot` / `page.screenshot()` 确实全部超时（又试了 `fromSurface:false`、小 clip、`optimizeForSpeed`、缩视口，依旧失败）。但：

```
page.cdp('Page.printToPDF', {...})   → 成功，959 KB / 1 页
qlmanage -t -s 2400 -o <dir> <pdf>  → PNG（macOS QuickLook）
```

`printToPDF` 走的是打印管线而不是屏幕捕获，不受那个超时的 CDP 通道影响。另外自编了一个 Swift 的 CoreGraphics 光栅器（`CGPDFDocument` → `CGContext` → PNG），用于逐页渲染多页 PDF。

**结论**：CDP **截图**不可用，但 CDP **打印**可用。之前的"截图通道彻底不可用"结论说得过宽，应修正为"屏幕捕获通道不可用，打印通道可用"。

#### 第一次真正看到的界面（实测内容）

- 三页签 `对话` / `轨迹` / `轨迹视图` 正常，当前页签高亮
- 工具条两行（回放按钮 / 加载更早历史 / 锚点输入 / 搜索框）完整，无溢出
- legend 色块、KPI 六个、minimap 色带、时间轴、站点卡片、底部详情两栏全部在位
- KPI 实测显示 `3.0 min 工具总耗时`、`16.3M 请求 tokens`、`14k 生成 tokens` —— 单位自适应生效
- 详情面板：`步骤 49` / `已完成` / `44,869 ms` / `首 token 44,126 ms` / `160.2 tok/s` / `复制锚点` / `站点 66 / 66` / `复制本步复盘` 全部可见
- 工具卡片：参数折叠、结果全文、`523 ms` 耗时条正常

#### 一处"看起来像 bug"的误判

放大时间轴时看到橙色方块压住了 `44 15:27:45` 这类标签，一度判定为重叠 bug。DOM 实测（66 个站点逐个比对 `dstv_axLabel` 与 `dstv_tag` / `dstv_hDot` 的矩形交叠）：**0 处重叠**。那是 PDF 打印缩放造成的视觉错觉，不是布局问题。**没有据此改代码**。

#### 仍然的限制

`printToPDF` 拿到的是**打印布局**，不是屏幕实时像素；打印时把 DOM 撑成了 10 页（正常屏显是一页），且 sticky/滚动位置与实时界面不完全一致。但它足以证明**布局结构、文案、颜色、按钮、面板都在位且没有明显错位**。视觉观感这一项，从"完全无证据"变成"有打印布局证据"。

### 12.24 视觉复核收尾：输入框遮挡（真 bug）与两处误报（2026-11-13）

有了可用链路后把整个界面过了一遍，一共 3 个候选问题，**只有 1 个是真的**。

#### 真 bug：宿主输入框压住了详情面板底边

DOM 实测（视口 875 px）：

| 元素 | top | bottom | height |
|---|---|---|---|
| 宿主 `[class*="composerSeat"]`（`position:sticky`，`z-index:7`） | 747 | 875 | 128 |
| 插件根 `.dstv_root` | 76 | 890 | 814 |

插件根的下边界 890 > 宿主输入框上边界 747，**详情面板最后 25 px 被输入框盖住**：`复制本步复盘` 下面那行内容在屏幕上看不到，滚到底也看不到，因为那是容器边界而不是内容。

修法：测量宿主输入框高度，只在"输入框贴住视口底部"（`rect.bottom >= innerHeight - 24`）时才在根节点上补 `padding-bottom`。轮询间隔 1500 ms + `resize` 监听，避免输入框高度变化（多行输入、附件预览）后留白错位。

修复后实测：`rootPadBottom: 128px`，根 `{t:76,b:1006,h:930}`，详情面板 `{t:487,b:890,h:404}`，宿主输入框 `{t:747,b:875}` —— 详情面板底边 890 正好落在输入框上沿之下被撑开的空白里，不再重叠。

#### 误报一：minimap 上橙色方块压住时间标签

放大后看像色块压住了 `44 15:27:45`。实测这些方块是 `dstv_miniTick`，**位于 minimap（t=167..185 的 18 px 色带内）**，而时间标签在下面的时间轴里，两者不在同一区域。PDF 缩放把小色带糊成了一片。**没有据此改代码。**

#### 误报二：详情面板头部右侧的 `↗` 图标像是溢出到面板外

`.`dstv_dHead` 实测 `{l:280, r:1828, w:1548}`，`scrollWidth 1548 == clientWidth 1548`（**无横向溢出**），11 个子元素全部落在 280..1828 内，最右的 `dstv_panelToggle` 在 `{l:1787, r:1814}`，距右边界 14 px 才收口。以 `dstv_root` 右边界为限扫描整棵子树，**没有任何元素越过**。那个"图标"是 `⤢`（`action.expandPanel` 的展开图标）在打印光栅化时的抗锯齿残缺。**没有据此改代码。**

记录这条的目的不是解释图片，而是确立一条纪律：**视觉印象必须先被 `getBoundingClientRect` 证实，再动代码。** 本轮 3 个候选里 2 个是渲染假象，如果凭图直觉改 CSS，会引入"为不存在的重叠加留白"这种更难查的问题。

#### 硬证据

- 修复前：`seatBox {t:747,b:875}` vs `rootBox {t:76,b:890}` → 底部 25 px 覆盖
- 修复后：`rootPadBottom: "128px"`，`detailBox {t:487,b:890,h:404}` 恰好避开 `seatBox {t:747,b:875}`
- 全树越界扫描：`badCount` 中所有条目 `right < -14000`（横向溢出容器内的滚动内容，属正常），**无一条超出根右边界 1828**
- `dstv_dHead`：`scrollWidth == clientWidth == 1548`，`flexWrap: wrap`
- 冒烟：`TV PLUGIN SMOKE TEST (v5) OK — turns=4 steps=4 stations=11 tokensIn=750 model=deepseek-chat`

#### 视觉这一项的最终状态

从"完全无证据"→"打印布局证据 + 关键矩形实测"。能证明的：结构、文案、单位、颜色、按钮在位，无横向溢出，无遮挡。**不能**证明的：滚动行为、sticky 定位在实时屏幕下的表现、动画与 hover 态——这些打印管线天然拍不到。所以这一项标记为**部分通过**，不再宣称"视觉已验证"。

### 12.25 契约考古：`kind: "unknown"` 被误当成版本漂移（2026-11-13）

这一条来自"要不要放宽 `engines.dsh`"的排查，结论却是一个**功能缺陷**，不是兼容性结论。

#### 怎么发现的

为了判断能否放宽钉版，下载了 `0.2.2-rc.1` 与 `0.2.1-rc.5` 做权威契约比对（不看 bundle，看 `.d.ts`）。逐项结果：

| 契约面 | 结果 |
|---|---|
| `contract/request-inspection.d.ts`（`ConversationPromptSnapshot` / `RequestPromptChange`） | **逐字节相同** |
| `ConvViewOwnerProps`（`conversation.view` 的四个 owner props） | **逐字节相同** |
| `conversation.view` 插槽定义（`kind`/`scope`/`owner`） | **相同** |
| `ConversationNode` 联合 | **相同**（11 个成员） |
| `trajectory-contract.d.ts`（`TrajectorySnapshot`） | **逐字节相同** |
| `dsh-session-projection/lib/types/types.d.ts` | 纯增量（新增 `SessionProjectionSummaryExcluded` 等类型标记） |
| `TrajectoryContribution` 的 7 个分支 | **相同** |
| `layout.d.ts` | 只多一行文档注释 |

比对 `records.d.ts` 的 kind 字面量时看到 `'unknown'`，顺着查到：

```ts
export interface UnknownSurfaceNode {
    kind: 'unknown';
    seq: number;
    time: number;
    type: string;   // 原始事件类型
    data: unknown;  // 原始负载
}
```

注释写得很清楚："Known unsupported developer events throw before fallback selection."

#### 缺陷

`UnknownSurfaceNode` 是契约**自己命名的**降级面，含义是"宿主承认这条事件存在、但选择不建模"。我的 `KNOWN_NODE_KINDS` 里没有 `'unknown'`，于是：

1. 它被 `unknownNodeStats` 计入 `unknown` → 头部显示 `⚠ N 条记录无法识别`，暗示版本不兼容；
2. 它没有任何渲染分支 → 时间轴上**直接消失**；
3. 更糟：如果一个会话**只有**这类事件，`isEverythingUnknown` 判定"一条都认不出"，整棵树被换成「无法识别当前会话的轨迹数据格式」。

这是纯粹的**冤枉**：宿主明明认得出（它给了 `type` 字符串），是我把它当成了自己看不懂的东西。一个陌生事件让整个视图改口说"格式不认识"，这正是本插件最不该犯的错——比"少显示一个站点"严重得多。

#### 修法

- `KNOWN_NODE_KINDS` 加入 `'unknown'`，并在注释里写明**为什么**它属于已知（契约文档化的降级面），防止以后被"清理"掉
- fold 阶段为它生成一等站点：`kind: "unknown"`，携带 `eventType`（原始类型）与 `payload`（JSON 预览，`UNKNOWN_PAYLOAD_LIMIT = 2000`）
- 详情面板显示事件类型 + 原始数据；时间轴卡片用**虚线**左边框和灰色圆点，视觉上区别于其它语义色，读作"未分类"而不是"出错"
- 时间轴导出、单步复盘包、搜索 haystack 全部带上 `eventType`/`payload`——否则"哪条事件"这个唯一有用的信息就丢了
- 新增 `safeJsonPreview(value, limit)`：`data` 是 `unknown`，可能含循环引用或 `bigint`，而这是**唯一**一个"必须让读者看到原文"的节点，不能因为序列化失败就抛异常

#### 变异测试（4/4 变红）

| 变异 | 断言反应 |
|---|---|
| 从 `KNOWN_NODE_KINDS` 删掉 `'unknown'` | `DRIFT handled kind treated as unknown: unknown` |
| 把 fold 分支改名成不存在的 kind | `R4 an unknown surface node must produce one station, got 0` |
| haystack 去掉 `eventType`/`payload` | `R4 the event type must be searchable` |
| 复盘包不带 payload | `R4 review pack lost the payload` |

#### 顺带确认的兼容性结论

`engines.dsh` **保持钉在 `=0.2.1-rc.5`**，不放宽。理由是纪律而不是谨慎：上面那张表是**类型级**证据，我**没有**在 `0.2.2-rc.1` 上实跑过。`ConvViewOwnerProps` 相同能保证注册面不报错，但保证不了运行时投影行为不变（这次 `dsh-client-ui-conversation` 的 bundle 就多了附件上传生命周期、`FileDrag` 注入、文本交互注册表等改动）。把"类型没变"当作"能用"来放宽钉版，就是这个项目一直在批的那种"没测就声称通过"。

已把 0.2.2 的比对结论写进 README §12，并把"在 0.2.2 上实跑"列为下一步，需要用户同意后才会动其运行时。

#### 硬证据

- 真机（0.2.1-rc.5）：66 站点、`incompat` 0、`data-slot-error` 0、无 raw i18n key、`复制本步复盘`/`复制锚点` 在位
- 冒烟：`TV PLUGIN SMOKE TEST (v5) OK — turns=4 steps=4 stations=11`
- 新增断言：`R4`（8 条）+ `DRIFT` 已知类型清单加入 `unknown`

### 12.26 在 0.2.2-rc.1 上实跑的尝试：拿到的证据与拿不到的（2026-11-13）

§12.25 说"没在 0.2.2 上实跑过，所以不放宽钉版"。为了不把"没试"说成"不能试"，做了隔离实跑：独立 `npm install` 前缀 + 独立 `DSH_HOME` + 另一个端口，**完全不碰用户现有运行时**。

#### 第一个发现：钉版是硬闸，不是建议

用 0.2.2 启动时会直接拒绝加载：

```
dsh: skipping profile bundle "dsh-trajectory-traceview-plus":
Plugin dsh-trajectory-traceview-plus@0.7.0 is incompatible with dsh 0.2.2-rc.1:
requirements {"engines.dsh":"=0.2.1-rc.5"}
```

同一份日志里 `dsh-union-search@0.10.20` 因为 `engines.dsh` 是一长串显式白名单也被跳过了。这说明：**DSH 升级后插件会整体消失**，而不是降级运行。这一点写进 README 的价值高于钉版本身——用户升级后看到的是"这个页签没了"，需要知道原因。

测法是准备一份 `engines.dsh` 改成 `=0.2.2-rc.1` 的副本（`/tmp/tv222test`），链接进隔离 profile。

#### 拿到的证据（真实、可复核）

| 证据 | 内容 |
|---|---|
| 宿主主动下发 | `/plugins/??…,@deepseek-ai/dsh-client-ui-trajectory/client.js,dsh-trajectory-traceview-plus/client.js,…` —— 我们的 bundle 在 0.2.2 的插件清单里被打了包 |
| 模块执行到位 | 页面 158 个 `<style>`，其中含 `.dstv_root` / `.dstv_hDot` → 模块顶层（纯 helper + CSS 注入）在 0.2.2 上跑通了，没有语法/引用错误 |
| 静态契约 | §12.25 那张表：`ConvViewOwnerProps`、`conversation.view` 插槽、`ConversationNode`、`trajectory-contract.d.ts` 逐字节相同 |

#### 拿不到的证据（诚实记录）

**没能打开一个会话，所以"注册成功 + 真的画出了时间轴"仍未验证。**

隔离环境里没有会话列表：拷贝了 4 个最大的会话日志进隔离 `DSH_HOME`，但 0.2.2 的侧栏按 cwd 分组且自动恢复"上次打开的会话"，恢复一个 208 MB 日志时页面直接卡住（后续 `page.goto` 全部超时，`document.body.innerText` 为空、`style` 数为 0）。换 cwd 重启也一样。另有一个坑：`?token=` 是一次性的，消费后就 303，后续导航拿不到新文档。

#### 结论：钉版不动

`engines.dsh` **保持** `=0.2.1-rc.5`。理由不是"懒得测"，而是**测出来的证据不够**：
- "bundle 被执行"证明不了 `ctx.slots.inject("conversation.view")` 与 `ctx.locale.register` 在 0.2.2 的运行时下接受同样的调用形态；
- 更证明不了投影行为一致——这次 `dsh-client-ui-conversation` 的 bundle 就新增了附件上传生命周期、`FileDrag` 注入、文本交互注册表等运行时改动，类型层面完全看不出来。

放宽钉版需要的是"0.2.2 上打开真实会话 → 轨迹视图画出站点 → 66/66 锚点可跳"这一整套，不是"模块没报错"。

#### 隔离实跑的善后

隔离环境共占约 1.4 GB（`/tmp/dsh222` 913 MB / `/tmp/dshhome222` 466 MB / 拷贝实验件），实验后全部删除；测试用插件副本 `/tmp/tv222test` 与两个契约对比包也一并删除。用户的 `~/.dsh` 与 0.2.1 实例未做任何修改（验证：3080 仍在跑，401 正常）。

### 12.27 升级实况：DSH 0.2.1-rc.5 → 0.2.2-rc.2 + dsh-tui 0.18.0 → 0.20.0（2026-11-14）

用户要求"升级到最新版本，注意 dsh-tui 也要升级适配"。§12.26 当时留的悬案（"没能在 0.2.2 上验证注册与投影"）在这次真机升级里**全部拿到证据了**。

#### 版本矩阵

| 层 | 升级前 | 升级后 |
|---|---|---|
| `@deepseek-ai/dsh` | 0.2.1-rc.5 | **0.2.2-rc.2** |
| `@deepseek-harness-tui/dsh-tui` | 0.18.0 | **0.20.0** |
| `engines.dsh`（本插件） | `=0.2.1-rc.5` | **`=0.2.2-rc.2`** |
| `dsh-union-search` | 0.10.20（白名单卡在 0.2.1 线） | **0.10.22**（`>=0.1.1-rc.2 <0.3.0`） |
| hook 协议 / claude-code hooks | 0.2.1-rc.5 | **0.2.2-rc.2** |
| 插件版本 | 0.7.0 | **0.8.0** |

#### 为什么是 rc.2 而不是 `latest`(rc.1)

dsh-tui 0.20.0 的 `dsh-adapter/contract.js` 写着："0.2.2-rc.2 = primary continuous-CI line"。npm 的 `latest` 标签还指着 rc.1，但 rc.2 才是 TUI 持续集成主跑的那条线。**选 rc.2 是让两个包落在它们各自 CI 覆盖的交叉点上**，不是为了追新。

#### 途中撞到的三件事（都是真问题，不是配置偷懒）

**(1) 升级后浏览器打不开页面。**`page.goto` 一直超时、`fetch` 报 `Failed to fetch`，而 `curl` 一切正常；表面症状是"页面空白"。

真因：0.2.2 收紧了 `/api` 的 `Host` 头校验，ego 浏览器发出的请求被拒，于是 HTML 拿到了、脚本请求全丢。加 `--trusted-host 127.0.0.1:3080 --trusted-host localhost:3080` 后恢复正常。

**这一条我差点判错**：第一次带 trusted-host 启动时成功，但那台浏览器里已经留了 `dsh-auth-…` cookie，无法排除"其实是 cookie 生效"。于是补做了对照实验——清空该 origin 的全部 cookie 后访问裸 `http://127.0.0.1:3080/`（不带 token），页面正常渲染出 209 字符的侧栏。**结论成立：是 trusted-host 起的作用，不是 cookie 残留。**

**(2) `?token=` 是一次性的。**消费后 `/?token=…` 一律 303 到 `./`。所以自动化里"每次 goto 都带 token"其实是第一跳就 303，后面靠 cookie。我一度连续多次 `newPage()` 开新标签，把浏览器拖到加载不出任何文档（`location` 显示 `blank`、`htmlLen 39`）——这是**测试方法把自己搞挂**，不是应用的 bug。记录在此以免下次误判。

**(3) dsh-tui 0.20.0 自带一个内部矛盾。**它的 `lib/types/dsh-adapter/contract.js` 里 `UPSTREAM_VALIDATED_VERSIONS` **已经列了** `0.2.2-rc.1` 和 `0.2.2-rc.2`，注释也写明 rc.2 是主 CI 线；但 `cli/adapters/dsh/index.mjs` 里执行闸门的 `validated` 集合**只冻结到 0.2.1-rc.5**。结果：`dst cli <任意命令>` 全部报

```
dst: ADAPTER_UNAVAILABLE: This adapter validates DSH 0.2.0-rc.2, …, 0.2.1-rc.5; use dst dsh for another runtime
```

交互 TUI 本身正常（`doctor` 全绿），只有 `cli` 这条子命令被自己的硬编码白名单挡住。

处置：**按最小面打补丁**（用户已授权"升级适配"）。只把契约里**已经声明支持**的两个 0.2.2 预发布版加进那个集合，不顺手放宽到 `0.2.2-rc.3`（未验证）或任意版本（那会把"不兼容"这个真实风险放掉）。补丁点同时打在两处：全局安装与 profile 内的副本（两者 md5 相同，必须一致），并在代码里留注释说明为什么。

备份：`/tmp/dsh-tui-adapter-index.mjs.bak-20261114-005940`。

#### 这次终于拿到的证据（§12.26 缺的那些）

在 **0.2.2-rc.2 真机**上（真实会话、真实 Web UI）：

| 验证点 | 结果 |
|---|---|
| 页签存在（`轨迹视图` 与内置 `轨迹` 并存） | ✅ |
| slot 注册生效、视图真的渲染 | ✅ `stmt 66` 站点、66 张卡片 |
| `ctx.locale.register` / `bind` 生效 | ✅ 无 raw i18n key（`node.*` / `detail.*` / `chip.*` 零泄漏） |
| 契约漂移告警未误报 | ✅ `incompat 0`、`data-slot-error 0` |
| 点站点 → 详情面板跟随 | ✅ 点第 31 站 → `站点 31 / 66`，`复制本步复盘` 在位 |
| URL hash 锚点深链 | ✅ `#tvp1:e3019` → `data-active=30` 并滚动到位 |
| 跨页锚点分页 | ✅ 66 → 454 → …，期间显示"正在向前加载更早历史以定位…" |
| 回放控件 | ✅ 点击后 `data-dim=true` 站点数 423 → 621 |
| KPI / 单位自适应 | ✅ `4 轮次 / 49 步骤 / 65 工具 / 2 错误` |

**TUI 侧**：`dsh-tui doctor` 全绿（launcher ↔ profile 0.20.0 对齐、`dsh 0.2.2-rc.2`、凭据已设置）；`cli session list --limit 3` 返回真实会话；`cli session show <id>` 读出 v4 日志头；`cli session export <id>` 导出 Markdown。

`cli auth status` 返回 `CAPABILITY_UNAVAILABLE` —— 这是**该命令在新运行时下的既有行为**（它只报告凭据存在性），而 `doctor` 里 `DEEPSEEK_API_KEY: 已设置` 与 `models list` 都有输出，所以我按"这一条没拿到证据"记录，不写成通过也不写成失败。

#### 结论

- 升级完成，**web / dsh-tui / headless 三个 profile 全部对齐**，启动日志零 `skipping` / `incompatible`
- 本插件钉到 `=0.2.2-rc.2`，版本 0.8.0
- 唯一需要人工记住的运维事实：**0.2.2 起 Web 服务要带 `--trusted-host`**，否则浏览器侧静默拿不到脚本

### 12.28 插件逐个体检：谁该升、谁不该升（2026-11-14）

用户要求"各个插件也检查一下适配情况，能升级的都升级一下"。结论是**只有一个插件该升，另一个刻意不升**，并且顺手改掉本插件一处不准确的声明。

#### 体检表

| 插件 | 当前 | 最新 | 处置 | 依据 |
|---|---|---|---|---|
| `dsh-trajectory-traceview-plus`（本插件） | 0.8.0 → **0.8.1** | — | 钉版已对齐 + **修 `engines.node`** | 见下文 A |
| `dsh-union-search` | 0.10.22 | 0.10.22 | 已最新 | `engines.dsh: >=0.1.1-rc.2 <0.3.0`，覆盖 0.2.2 |
| `dsh-plugin`（TUI） | 2.3.4 → **2.3.9** | 2.3.9 | **已升级** | 见下文 B |
| `@deepseek-ai/dsh-hook-protocol` / `-hooks-claude-code` | 0.2.2-rc.2 | 0.2.2-rc.3 | **不升** | 见下文 C |
| `@visual-journal/dsh-plugin` | 0.2.0 | 无上游 | **不升（无版本可升）** | 见下文 D |
| `@anthropic-ai/claude-agent-sdk`（TUI 可选 peer） | 0.3.287 | 0.3.325 | **刻意不升** | 见下文 E |

#### A. 本插件：`engines.node` 是错的

0.2.2 起 DSH 自己的 `engines` 是 `node: >=24.9.0`（rc.1 和 rc.2 都一样）。而本插件写的是 `node: ">=22"` —— 跟着旧约定抄的。

后果不是"更宽松所以无害"：这是一个**会让使用者装到一半失败**的声明。宿主要求 24.9，插件说 22 就行，两边对不上时插件给出的是错误的期望。已改成 `>=24.9.0`，与本机 `v24.22.1` 和宿主声明一致。

顺带确认：本机 Node 满足 DSH 0.2.2 的 24.9 下限，不需要动运行时。这条**如果当初没搜到上游 release note 就会漏掉**（`npm ls` 不会因为 engines 不匹配而失败）。

#### B. `dsh-plugin` 2.3.4 → 2.3.9：升了，并验证

它是 TUI profile 的插件市场 bundle。新版 manifest 是 `engines.node >=22.6`、peer 只有 `@deepseek-ai/cordis: 4.0.1` 且标记为 `optional`，没有任何 DSH 版本绑定——所以它对 0.2.2 **不构成兼容风险**。

升级后实测：`dsh --profile dsh-tui --dump-config` 退出码 0、零 `skipping/incompatible/denies`；`dsh-tui doctor` 全绿（launcher ↔ profile 对齐 0.20.0）；`cli session list` 仍返回真实会话。

#### C. hook 协议相关的两个包：**不升到 rc.3**

npm 上已经有 `0.2.2-rc.3`，看起来"能升"。但 DSH 本身停在 `0.2.2-rc.2`（`next` 标签是 rc.3，`latest` 还是 rc.1），而 `@deepseek-ai/dsh-hooks-claude-code@0.2.2-rc.2` 的 peer 是**精确钉死的**：

```
"@deepseek-ai/dsh-agent": "0.2.2-rc.2",
"@deepseek-ai/dsh-hook-protocol": "0.2.2-rc.2",
… 七个 @deepseek-ai/dsh-* 全部精确到 0.2.2-rc.2
```

把 hook 包单独升到 rc.3 就等于让它的 peer 全部失配，而宿主仍跑 rc.2。**这类包必须与宿主同版本走**，所以 `0.2.2-rc.3` 不是"可升级"，是"等宿主升到 rc.3 之后再一起升"。这是本轮唯一一个"看起来该升、实际不能升"的项。

#### D. `@visual-journal/dsh-plugin`：没有上游

它是本地 tarball（`~/.dsh/plugins/visual-journal-dsh-plugin-0.2.0.tgz`），npm 上 `@visual-journal/dsh-plugin`、`dsh-visual-journal`、`visual-journal-dsh-plugin` 三个名字全部 404（用 registry 的 search 也搜不到同名包）。**没有可升级的版本。**

能做的适配核查已做：
- `engines.dsh: >=0.2.1-rc.5 <0.3.0` —— 覆盖 0.2.2，不会被宿主跳过
- 启动零拒载，插件面板里正常列出
- 它的后端是本地 Docker（`http://127.0.0.1:4783`），实测 `/api/agent/capabilities` 返回 200 且带了完整的 `api_version / schema_version / endpoints` 清单

#### E. `@anthropic-ai/claude-agent-sdk`：0.3.287 → 0.3.325 是**降级风险**

它是 dsh-tui 的 `peerDependency`，且在 `peerDependenciesMeta` 里标了 `optional: true`；TUI 自己的 `package.json` 与 README 都把它钉在 **0.3.287**。这是 Anthropic 的独立包，**与 DSH 0.2.2 无关**，只服务 `dsh-tui --backend claude`。

把 peer 升到 TUI 未验证的 0.3.325，是拿一个能用的后端去换一个"没测过"的状态——TUI 没有声明支持 0.3.325，升级就等于单方面违约。**刻意不升。**

#### F. 端到端体检结果（全部通过）

- web profile 配置编排：`--dump-config` 退出码 0，零拒载
- Web UI：`data-slot-error` 0，三个页签（`对话` / `轨迹` / `轨迹视图`）俱全
- 插件面板「已安装插件」三项全部列出：`@visual-journal/dsh-plugin`、`dsh-trajectory-traceview-plus`、`dsh-union-search`，界面无「更新」按钮（本机确实都是最新）
- 搜索插件真跑：`web_search` 返回正常结果（含上游 0.2.2 release note，Node 24.9 那条线索就是从这拿到的）
- 视觉日志插件后端：`/api/agent/capabilities` 200

#### 结论

升级了 **`dsh-plugin` 2.3.4 → 2.3.9**；修正了本插件 **`engines.node` 的错误声明**；另外两个看起来"该升"的（hooks rc.3、claude-agent-sdk）**有明确理由不升**，理由写在上文而不是默默跳过。
