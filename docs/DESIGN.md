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

### 12.29 性能与健壮性：投影成本、流式节流、渲染隔离（2026-11-14）

上一轮列出的「该修的三个」按 1 → 3 → 2 执行。**这一节特意把"测到的"和"没测到的"分开写**，因为其中一项我最终没能拿到真机证据。

#### 一、先量，再改

把 `deriveTraceTree` 拆阶段计时后（3,400 站点规模）：

| 阶段 | 耗时 |
|---|---|
| 节点排序 | 3 ms |
| 建映射 / 请求表 | 8 ms |
| **折叠（逐节点）** | **80 ms** |
| 轮次排序 | 0 ms |
| **生成站点 + haystack** | **109 ms** |
| 合计 | 200 ms |

结论：不是单一热点的算法问题，而是**两个 O(n) 的整表循环**。其中 `haystack` 一项尤其浪费——它把每个站点的全部文本 `join("\n").toLowerCase()` 一遍，**而大多数会话从头到尾没人搜过**。

#### 二、改动 1：haystack 改为按需生成

- 折叠阶段只保留站点本身（文本本来就在 `cells` 里），不再复制成第二个数组
- `stationHay(station)` 在**第一次真正搜索时**从站点字段派生，并缓存回站点上
- 搜索路径 `matchStations` 改走 `stationHay`

实测（`test/` 沙箱内，6,200 节点）：**~150–190 ms**，改前同规模 **~214–265 ms**。独立进程（warm JIT）下 3,200 站点 42 ms、6,400 站点 66 ms。

**注意口径**：沙箱里两个区间有重叠，所以耗时断言**不足以**区分「懒生成」和「急建」。真正钉住这条行为的是**行为断言**：折叠后 `station.hay` 必须是 `undefined`，搜索后必须被缓存。

#### 三、改动 2：流式期间节流重建（`STREAM_REBUILD_MS = 120`）

轨迹快照**每个流式 token 都会变**，而 `useMemo` 只按快照引用去重，等于每个 token 重折一遍全树。现在：

- memo 的依赖改成**历史切片**（`eventNodes` / `requests` / `callSchemas` / `runningCalls`）+「当前在流式哪一步」（`turn:step`）+ 一个 120 ms 的 tick
- 流式文本仍通过 ref 取最新值，所以重建时不会用到旧内容
- 空闲会话**完全不重建**

这样把重建频率从「每 token」（3,200 站点下约 30 次/秒）压到「每秒 8 次」，而 120 ms 的文字滞后对人眼不可见。

**这一条只有算术依据，没有实测**：需要有真实流式输出才能测重建次数，本机没有可触发的流式会话。我把它记为「按构造正确」而不是「已验证」。

#### 四、改动 3：站点卡渲染隔离（`content-visibility: auto`）

滚动区外的站点跳过内容布局与绘制。实测页面：66 站点、`scrollWidth 17688`、**40 张卡高度全为 214 px（零高度 0 张）**，说明 `contain-intrinsic-size: 264px 120px` 没有把卡片压扁。

顺带确认一个风险点：`centerStation()` 用 `getBoundingClientRect()` + `offsetWidth` 计算滚动目标。`content-visibility: auto` 只跳过**内容**的布局，元素**自身的盒子**仍参与布局，所以锚点定位仍拿到正确矩形——这一点被后面的深链实测证实（见第六节）。

#### 五、改动 4：渲染边界（一个站点坏掉不该拖垮整棵树）

新增 `RenderBoundary`（class 组件，`getDerivedStateFromError`），接在三处：

1. **每个站点卡**——单站失败只坏一格，其余照常
2. **详情面板主体**——详情渲染异常不影响时间轴
3. **整个视图注册处**（`SafeTraceMapView`）——外壳级异常给出可读提示而不是空白页

关键设计：`render` 是**在边界内部被调用**的函数，而不是外部先构造好的元素。若传入已经构造好的元素，异常发生在父组件渲染期间，边界根本看不到——这是最容易写错的一点，因此有专门的结构断言守着。

#### 六、验证结果（区分"测到的"和"没测到的"）

**测到的：**

| 项 | 结果 |
|---|---|
| 边界改造后界面无回归 | ✅ 66 站点、`dstv_boundary` 0、`incompat` 0、`slotErrors` 0、`复制本步复盘` 在位 |
| 详情随点击跟随 | ✅ 点第 6/26/46 站 → `站点 6 / 66`、`26 / 66`、`46 / 66` |
| 锚点深链（含新滚动实现） | ✅ 取真实锚点 `tvp1:e12194` → 设 hash → `data-active=19` 精确回到该站 |
| 搜索 | ✅ 键盘输入 `bash` → 命中 76 处、`data-seek-dim` 15 处 |
| 冒烟测试 | ✅ `stations=11` 全绿 |
| 结构守卫（P2） | ✅ 三个变异全部变红：去掉详情边界 / 视图不经 `SafeTraceMapView` / 站点卡改在边界外预建 |

**没测到的（必须记账）：**

- **边界故障注入**：我注入了 `throw new Error("FAULT_INJECTION_PROBE")` 想让某个站点抛错，预期看到「一格红框 + 其余 65 站正常」。但那一刻浏览器连续落入 `about:blank` / 工作区选择页，**没能打开任何一个会话**，因此这次实验的结果无效（`root:false`）。事后重试多次仍打不开会话（宿主本身正常：`curl` 401/303 如常、进程在跑），所以**边界端到端行为至今只有构造正确性与结构断言支撑，没有真机异常路径证据**。
- **流式节流的重建次数**：同因，缺少可触发的流式会话。

这两条记在这里而不是含糊过去。补测的方式很简单：下次有真实流式输出时，注入一次站点异常即可。

#### 七、测试项的自我纠正

第一版性能断言写得太弱：我用两个变异（搜索不缓存、折叠时恢复预建）去试，**两次都没让测试变红**。原因是变异没有真正改变被断言的东西（比如把 `void 0` 塞进字符串数组，行为不变）。

重新设计后：

- 变异「去掉 `station.hay` 缓存」→ 红（`P1 searching must cache the haystack`）
- 变异「语义不变、只是把 hay 改回折叠时急建」→ 红（`265 ms > 250 ms` 预算）
- 变异「站点卡改在边界外预建」→ 红（`P2`）

**教训**：变异测试本身也要验证——"变异了但没红"有两种可能，一是断言弱，二是变异根本没生效。这次两种都出现了。

### 12.30 浅色主题、动效偏好、键盘与读屏（2026-11-14）

上一轮列出的后三项。这节里有一条必须点名：**浅色方案是推导出来的，不是"看着还行"。**

#### 一、浅色主题：先算，再改

把现有 20 个颜色全部代入 WCAG 公式，对着宿主两种背景算对比度：

| 颜色 | 用途 | 深色 `#0e1116` | 浅灰 `#f6f8fa` |
|---|---|---|---|
| `#3aa76d` | 工具成功 | 6.24 ✅ | **2.85 ❌** |
| `#ff5c5c` | 错误 | 6.25 ✅ | **2.84 ❌** |
| `#e0c341` | 警告 chip | 10.85 ✅ | **1.64 ❌** |
| `#19b7c8` | 强调 | 7.79 ✅ | **2.28 ❌** |
| `#ffa34d` | 警告 | 9.54 ✅ | **1.86 ❌** |
| `#5c6773` | 次要文字 | **3.00 ❌** | 5.42 ✅ |

结论很清楚：**这套颜色是为深色背景挑的高饱和色，放到白色上全部不及格**（1.6–3.3:1，AA 要 4.5）。而 `#5c6773` 反过来，是浅色专用。

顺带查了宿主能不能借力：它的 `--dsw-static-green-400` 这类令牌**在两种主题下是同一个色值**（`#4ed17e` 等），也就是说宿主故意没给状态色做主题区分。所以不能靠继承宿主解决，必须自备浅色一套。

做法：把 103 处硬编码 hex 收敛成 8 个语义变量（`--dstv-ok/info/err/warn/partial/accent/unknown/muted`），默认给深色值，`body:not([data-ds-dark-theme]) .dstv_root` 覆盖为浅色值。宿主正是用 `data-ds-dark-theme` 标记深色，所以这个选择器和宿主的主题切换逻辑一致。

浅色取值实测对比度：

| 变量 | 浅色值 | 对白色 | 对浅灰 |
|---|---|---|---|
| `--dstv-ok` | `#1a7f45` | 5.04 ✅ | 4.74 ✅ |
| `--dstv-info` | `#1f5fd0` | 5.82 ✅ | 5.47 ✅ |
| `--dstv-err` | `#c42525` | 5.77 ✅ | 5.42 ✅ |
| `--dstv-warn` | `#8a5a00` | 5.93 ✅ | 5.57 ✅ |
| `--dstv-accent` | `#0d7c8a` | 4.92 ✅ | 4.62 ✅ |
| `--dstv-unknown` | `#6c3fd1` | 6.42 ✅ | 6.03 ✅ |
| `--dstv-muted` | `#5c6773` | 5.76 ✅ | 5.42 ✅ |

全部 ≥4.6:1。

#### 二、动效偏好

两处，缺一不可：

- CSS：`@media (prefers-reduced-motion: reduce)` 关掉 `dstv-pulse` 呼吸动画与所有 transition
- **JS**：`scrollTo({behavior:"smooth"})` 管不到 CSS，所以在 `centerStation` 里单独判断 `matchMedia`，命中时退回 `"auto"`

第二条容易被漏掉——CSS 写好了给人"已经处理过动效"的错觉，但播放/定位时的平滑滚动依然在动。

#### 三、键盘与读屏

时间轴本来就是「水平排列的条目列表」，所以直接按列表暴露，不再让读屏面对一堆无名的 div：

- 容器 `role="listbox"` + `aria-orientation="horizontal"`
- 每个站点 `role="option"` + `aria-selected` + `aria-label`
- **roving tabindex**：只有当前站点是 `tabIndex=0`，其余 `-1`。否则 66 个站点就是 66 次 Tab
- 站点聚焦后 `←/→` 移动选择（在根处理器里方向键是"上一步/下一步"，聚焦站点时改由站点接管并 `stopPropagation`，避免一次按键走两步）
- `Home`/`End` 跳到首尾，`Enter`/`Space` 选中
- `aria-label` 由 `stationAriaLabel()` 生成：位置（`7 / 66`）、身份（步骤/轮次/工具…）、`meta` 摘要、是否出错——即视觉布局靠形状、位置和颜色表达的那三件事

#### 四、验证

**测到的（测试内）：** A1 断言块，5 个变异全部变红：

| 变异 | 结果 |
|---|---|
| 浅色 `--dstv-ok` 改回深色值 | ✅ 红：`3.03:1 (need 4.5)` |
| 删掉 reduced-motion 的 CSS | ✅ 红 |
| 平滑滚动忽略偏好 | ✅ 红 |
| 去掉 `aria-selected` | ✅ 红 |
| 所有站点都 `tabIndex=0` | ✅ 红 |

另外 A1 里有一条**防回归**断言：除调色板声明外，代码里不允许再出现任何 hex——将来随手加一个 `#ff0000` 会立刻失败，而不是等到某天有人用浅色主题才发现。

**没测到的（必须点名）：**

- **浅色主题、ARIA 语义、键盘导航都没有真机截图或 DOM 断言**。本轮浏览器反复落在 `about:blank` / 工作区选择页，会话打不开（`ROWS=0`、`HAS_TAB=false`），只有一次成功打开了会话并确认两个页签都在、视图能渲染。
- 宿主侧的 `data-ds-dark-theme` 我确认了**存在**（`dsh-client-ui-theme` 里有 `body[data-ds-dark-theme]{…}`），但**没有在真实浅色界面里看过**效果。

所以这三项目前是「构造正确 + 静态断言 + 对比度数学」三重支撑，缺一次真人视觉复核。补测成本很低：切一次浅色主题、用 Tab/方向键走一遍即可。

#### 补测结果（同日稍后，浏览器恢复后）

浏览器实例恢复后补测，**三项全部拿到真机证据**：

| 项 | 实测 |
|---|---|
| listbox 语义 | ✅ `role="listbox"` + `aria-orientation="horizontal"` |
| option 语义 | ✅ 83 站点 = 83 个 `role="option"` |
| roving tabindex | ✅ 可 Tab 站点恒为 **1** 个 |
| 方向键 | ✅ 聚焦第 0 站按 `→` → 焦点移到第 1 站 |
| aria-label | ✅ `"1 / 83，用户"`（位置 + 身份） |
| 浅色变量生效 | ✅ 读计算值 `--dstv-ok:#1a7f45`、`--dstv-err:#c42525`、`--dstv-warn:#8a5a00`、`--dstv-muted:#5c6773`、`--dstv-accent:#0d7c8a`，与设计表逐项一致 |

**补测顺带发现一个真问题**：`aria-selected` 实测恒为 0 个。我原来的逻辑是「未选中时显式写 `false`」，但概览态（`revealed === null`）本来就展示全部站点、**没有任何"选中"**。给每一项都播报 `aria-selected="false"`，等于告诉读屏用户"这是一个有选中项的列表，只是都没有选中"，是误导。已改成概览态**不输出**该属性，只有真正选中后才出现，并加断言钉住（变异回旧写法 → 红）。

**教训**：这条只有真机才看得见——静态断言当时只检查了"存在 aria-selected"，而它确实存在，只是取值全错。

#### 补记：色板里还留了 55 处 `rgba()` 底色

文字色全部走 `var(--dstv-*)`，但半透明**底色**（如 `rgba(58,167,109,.14)` 的工具成功底色）没有变量化——它们是按旧色相取的淡色。

浅色主题下结果是：文字是深绿、底色是淡绿，同色系，读起来仍成立，不会出现对比度问题。但严格说浅色下底色并没有跟着新色相走，属于**已知的观感瑕疵，不是缺陷**。真要做得更干净，需要把 55 处 rgb 三元组也变量化一遍；本轮没做，因为收益只在"颜色更精确"这一层。

### 12.31 三项收尾：透明色变量化、窄屏实测、锚点分页提前停（2026-11-15）

上一轮被打断的三项。其中两项拿到了结论，一项**被实测否掉并回滚**。

#### 一、55 处 `rgba()` 底色改为 `color-mix`

文字色此前已变量化，但半透明**底色**还是按旧色相写死的（`rgba(58,167,109,.14)` 等）。变成：

```css
color-mix(in srgb, var(--dstv-ok) 14%, transparent)
```

用 `color-mix` 而不是新增 55 个变量：它保留原来的透明度档位，同时自动跟随当前调色板。只留一处 `rgba(0,0,0,.12)`（纯黑阴影压暗，与主题无关）。

新增断言：**除纯黑外不允许出现 rgb 三元组**。变异（恢复一处 `rgba(255,92,92,.14)`）→ 红。

实测 55 处全部替换，剩 1 处纯黑。

#### 二、窄屏：实测后**回滚了自己加的东西**

先测现状（1872 / 1100 / 900 / 700 / 600 / 480 px）：

| 宽度 | 根宽 | 头部高 | 溢出 | 页面横向滚动 |
|---|---|---|---|---|
| 1872 | 1585 | 28 | 否 | 否 |
| 900 | 837 | 54 | 否 | 否 |
| 700 | 693 | 53 | 否 | 否 |
| 600 | 593 | 75 | 否 | 否 |
| 480 | 473 | 79 | 否 | 否 |

**结论：布局本来就不坏**——不溢出、不横向滚动、头部自己换行、卡片与详情面板都跟着缩。

我据此加了一条 `max-width:720px` 的"头部压缩"规则（缩小标题、截断模型名、去 KPI 内边距、隐藏提示行）。**实测反而更差**：

- 700px：65 → 实测有负载波动
- 600px：75 → **87**
- 480px：79 → **91**

原因查明了：在 480px 下头部有 8 个子元素、**已经排成 6 行**（标题/图例/走带/按钮/锚点/搜索）。我加的 `flex-wrap:wrap` 给 `.dstv_transport` 让它自己再折一层，等于**多要一行**；而隐藏提示行与图例省下的空间不足以抵消。

于是我把它**整体回滚**了。理由很直接：一个改动自称"窄屏更紧凑"，实测却让头部从 79px 涨到 91px，那么无论初衷多合理，它都是错的。

**这一项最终没有产物**——因为测量表明本来就没有需要修的问题。这条记在这里，是为了避免下次有人"看到窄屏觉得窄"又去加同一类规则。

#### 三、锚点分页：找到一个真 bug

问题是实的。`anchorLoadTarget` 对 `p`/`t` 形式的锚点**恒定返回 0**：

```js
if (parsed.form === "p" || parsed.form === "t") return 0;
```

而分页循环里的提前停止条件是 `if (target !== 0) { …floor 检查… }`。于是：

- `e` 型锚点（带 seq）能提前停
- `p` / `t` 型锚点**永远进不了这个判断**，只能一路翻到 `ANCHOR_MAX_PAGES = 40`

这正是此前观察到的「66 → 454 → 734 → 1197 → 1265 → 1330 → 1389 站点」反常增长——当时以为是一次假的实例抖动，实际是**真问题**，只是那次之后一直没复现。

修法：turn 与 seq 一样是单调的，所以"窗口是否已经覆盖目标"可以只靠 turn 判断。新增 `anchorTurnFloor()`（当前窗口里最旧的 turn）与 `anchorCoveredByWindow()`（`e` 按 seq、`p`/`t` 按 turn 统一判断），循环改为只要窗口覆盖就停。

未知情况**保守处理**：拿不到 turn 就当作"未覆盖，继续翻"，不猜。

测试 9 条断言，3 个变异：

| 变异 | 结果 |
|---|---|
| `p`/`t` 重新视为无界 | 红（`turn anchors must enter the coverage check`） |
| 循环不再调用判断（helper 孤立） | 红 |
| floor 取最新而非最旧 turn | 红 |

**第一次变异没红**——我最初只断言"循环里调用了 `anchorCoveredByWindow`"，而变异改的是**调用条件**不是调用本身。补上对条件的断言后才红。这已经是第二次栽在"变异了但没红"上（§12.29 记过一次）。

#### 四、没拿到的证据

- 锚点分页的真机验证：浏览器又回到打不开会话的状态（`ROWS=0`），**这一项只有单测与构造正确性，没有真机重放**。
- 窄屏那组测量，数据是在回滚前抓的；回滚后没有重新测一遍基线（回滚是字面删除，回归风险极低，但没有实测确认）。

#### 五、流程上的收获

`docs/PROVENANCE.md` 的过期守卫**当场拦了我一次**：改完 `anchorLoadTarget` 后跑测试，`V1` 直接报 `PROVENANCE.md is stale`。这说明这个守卫不是摆设——它会在每次真实改动时要求刷新清单。

### 12.32 两个无障碍缺口：焦点不可见、输入框无名称（2026-11-15）

上一轮做 roving tabindex 时留下两个洞，都是我引入的：

**(1) 键盘聚焦站点后看不到焦点在哪。** 全文件只有 `.dstv_search:focus-within` 一条（输入框容器），站点卡**没有任何 focus 样式**。roving tabindex 让 Tab 能落进列表，但落进去之后用户不知道落在哪一格——这比不能 Tab 更糟，因为焦点是"看不见的"。

补 `.dstv_station:focus-visible{outline:2px solid var(--dstv-info);outline-offset:2px}`，并用 `:focus:not(:focus-visible)` 保证鼠标点击不出现焦点环。

**(2) 搜索框与锚点输入框没有无障碍名称。** 两者都只有 `placeholder`。placeholder **不是**可访问名称：读屏可能跳过，而且一旦有内容就消失。补 `aria-label`，文案进 i18n（中英各一条）。

测试：3 条新断言 + 2 个变异（去掉焦点环 → 红；删掉一个 `aria-label` → 红）。

### 12.33 尺寸估计与轮询：两个自己挖的坑（2026-11-15）

继续自查，又找到两处是我自己引入的问题。

#### 一、`contain-intrinsic-size` 的估计值比实测小 44%

§12.29 给站点卡加了 `content-visibility:auto` 时，我写的回退尺寸是 `264px 120px`——**120px 是拍的，不是量的**。实测卡片高度是 214px（另一宽度下 66–140px，随内容变）。

后果：`content-visibility:auto` 对**不在视口内**的元素按 intrinsic size 布局。估计值偏小 94px，意味着每一张卡滚进视口时，滚动区总长度都要改一次——**横向滚动条会在滚动过程中跳动**。这正是这个属性最典型的坑，而我把坑自己埋上了。

改法不是"把 120 改成 214"，因为卡片高度本来就随内容变化，任何固定值都会错。用 `auto` 关键字：

```css
contain-intrinsic-size: 264px 214px;                 /* 回退：老浏览器 */
contain-intrinsic-size: auto 264px 214px;            /* 记住真实尺寸 */
```

两行是有意的**渐进增强**：先给纯长度（凡支持 containment 的都认），再用 `auto` 覆盖（浏览器会记住每张卡上次渲染出的真实尺寸）。这样无论卡片多高都不再跳动。

在页面里实测过语法（决定性，不靠猜）：

| 写法 | 是否被接受 | 计算值 |
|---|---|---|
| `auto 264px 214px` | ✅ | `auto 264px 214px` |
| `auto 264px auto 214px` | ✅ | 同上 |
| `264px 214px` | ✅ | `264px 214px` |
| `auto none` | ✅ | `auto none` |

#### 二、隐藏标签页里还在每 1.5 秒轮询

输入框遮挡测量（§12.24 加的）用 `setInterval(measure, 1500)` 常驻。标签页切到后台后它照样跑——虽然只在挂载期间，但用户在别的标签页工作时，这个 `getBoundingClientRect()` 每 1.5 秒触发一次布局读取，纯浪费。

改为隐藏时跳过，并在 `visibilitychange` 回到可见时立刻补测一次（否则切回来可能有 1.5 秒的错位）。

#### 三、一个没能复现的观察（记录，不解释成结论）

诊断过程中有一次测量显示：`.dstv_station` 的 `content-visibility` 计算值是 `visible`、`width` 是 `1467px`、`.dstv_root` 的 `display` 是 `block`——即**我们整张样式表似乎没生效**；同时那个 `<style>` 标签只有 582 字符、4 条规则（全量是 23,583 字符、212 条）。

但同一环境下重新取一次，服务端下发的 bundle 明确包含当前代码（`width:264px`、`contain-intrinsic-size`、`color-mix`、`role: "option"` 全部命中），注入的样式标签开头就是我们的调色板规则。

**结论：那次测量大概率是页面重建过程中的瞬时状态（或命中了另一个实例的标签），我没能复现。** 记在这里而不是当作"已修"或"没问题"——如果以后真出现"样式整张不生效"，这是第一条线索。

#### 四、守卫

新增 R2 断言：intrinsic size 必须带 `auto` 且回退宽度为 264px、回退高度不得低于 200px、隐藏时不得轮询。两个变异（改回 `264px 120px` → 红；去掉可见性判断 → 红）均验证。

顺带冷检查了两项**没有发现问题**的：`client.js` 里 0 处 `console.*` / `debugger`；149 个 i18n 键**无死键**；46 个函数**无未使用**（每处至少被引用一次）。

### 12.34 两个数字显示的边界缺陷（2026-11-15）

这次不是性能也不是无障碍，是把格式化函数用**边界值**喂了一遍找出来的。两个都是真错，且都在真实数据里出现过。

#### 一、`fmtTokens` 缺 10 亿档：真实会话会显示 `16300.0M`

真实数据：本机一个 4 轮会话的入站 token 累计 **16,300,000,000**（16.3e9）。而原实现只有三档：

```js
if (n < 1e3) … / if (n < 1e6) … / return `${(n/1e6).toFixed(1)}M`;
```

于是渲染成 **`16300.0M`**——四个有效数字的尾数，横在 KPI 条里既不像样又比其它数字宽一倍。

补 10 亿档 → `16.3B`。顺带修一个相邻的边界：`999,999,999` 四舍五入后是 `1000.0M`，同样是四位数尾数。改为**先按目标精度四舍五入、再选单位**，于是 `999,949,999 → 999.9M`、`999,950,000 → 1.0B`。

#### 二、`fmtDur` 先选单位再四舍五入：`59,960 ms → "60.0 s"`

原实现：

```js
const s = ms / 1000;
if (s < 60) return `${s.toFixed(1)} s`;   // 59.96 → "60.0 s"
```

`59,960 ms` 显示为 **`60.0 s`**——数值是"一分钟"，标签是"秒"，读者要么以为差一秒，要么以为单位错了。同理 `3,599,999 ms` 显示 `60 min` 而不是 `1.0 h`。

改法一致：**先按精度四舍五入、再判断该用哪个单位**。现在 `59,900 → 59.9 s`、`59,960 → 1.0 min`、`3,599,999 → 1.0 h`。

#### 三、这两条为什么值得单独记

数值格式化最容易"看起来对"：`16300.0M` 不算崩溃、`60.0 s` 也不算崩溃，它们只是**每一次都出现在用户眼前**。而这类错误不会触发任何异常、不会被日志抓到，只能靠边界值测试兜住。

之前的测试只覆盖了 `850 / 1500 / 60000 / 300000 / 3600000 / 7200000` 这些**整齐的、恰好落在单位中段的值**——恰好绕开了所有进位边界。这正是"顺手挑几个看着办"的测试的典型盲区。

现在断言里包含 `59,900 / 59,960 / 3,599,999`、`999,949,999 / 999,950,000 / 1e10` 六个边界值，两个变异（去掉 B 档 → 红；回到先选单位再舍入 → 红）均验证。

#### 四、顺带确认

`fmtDur` / `fmtTokens` / `fmtMs` 对 `null` / `undefined` / `NaN` / `Infinity` / 负数都返回 `—`（不是 `0`、不是 `NaN`），符合 §8.9「没记录不能显示成 0」的既定原则，无需改动。

### 12.35 严重回归：少了一个 `+`，整个样式表被静默丢弃（2026-11-15）

用户截图给出了决定性证据：轨迹视图渲染成**纯文本堆叠**（无卡片、无横向轴、无颜色），页面顶部只剩一行 `轨迹视图用户步骤工具上下文压缩出错`。

#### 一、根因：一个字符

CSS 是用字符串拼接出来的：

```js
const css = "" + …

  + "@media (prefers-reduced-motion: reduce){…}}"   // ← 这一行结尾漏了 +
  ".dstv_root{box-sizing:border-box;…}" +           // ← 从这里开始成了新语句
```

JavaScript 的 ASI 会在这里**合法地**补上分号：`const css` 到媒体查询那行为止，后面 210 条规则变成一条**被丢弃的表达式语句**。于是运行时 `css` 只有前 4 条规则（调色板 2 条 + `color-scheme` + 媒体查询）= **582 字符**。

这正是 §12.33 里我记成"没能复现的瞬时状态"的那次测量：`style` 标签 582 字符 / 4 条规则、`content-visibility: visible`、`width: 1467px`、`display: block`。**它不是瞬时状态，是真实且稳定的破坏**。我当时看到服务端下发的 bundle 含当前代码就判断为瞬时，判断错了——bundle 里确实有那段代码，只是它在运行时被 ASI 切断了。

引入时间：**0.9.0**（做 reduced-motion 时加了媒体查询那行）。也就是说 `0.9.0` – `0.9.5` 全部发的是"无样式"版本。

#### 二、为什么测试没拦住

- 冒烟测试只抽取 `//#region pure helpers` 那一段做沙箱测试，**CSS 完全不在测试范围内**
- 我自查 CSS 时写的拼接脚本用 `^\s*\+?\s*"..."` 匹配每一行并**无条件连接**，恰好把缺失的 `+` 抹平了，于是括号平衡、规则数全部显示正常
- `node --check` 通过（因为那确实是合法 JS）

**教训：凡是把多个字符串拼起来的东西，断言必须看"运行时的值"，不能看"源码里文本是否都存在"。**

#### 三、修复与守卫

补回 `+` 后运行时实测：**25,762 字符 / 210 条规则**（此前 582 / 4）。

新增 S1 断言：直接从源码取出 `const css = …` 那条语句，**求值**得到字符串，然后检查长度 ≥20000、规则数 ≥180、首/中/尾三个标记（`.dstv_root{--dstv-ok:`、`.dstv_station{content-visibility:auto`、`.dstv_modelChip{`）都存在、括号平衡。

变异验证：

| 变异 | 结果 |
|---|---|
| 重新去掉那个 `+` | ✅ 红：`S1 stylesheet looks truncated: 582 chars` |
| 删掉一条中部规则 | 不红 —— **这是有意的**，S1 只负责"截断"，单条规则缺失由 A1 的焦点环断言负责（已验证变红） |

#### 四、真机验证（修复后）

| 项 | 修复前 | 修复后 |
|---|---|---|
| `style` 标签 | 582 字符 / 4 条 | **25,762 字符 / 210 条** |
| 站点卡宽度 | 1467px（撑满） | **264px** |
| `content-visibility` | `visible` | **`auto`** |
| `contain-intrinsic-size` | `none` | **`auto 264px auto 214px`** |
| 容器 `display` | `block` | **`flex`** |
| 滚动宽（52 站） | 1467 | **13936** ≈ 52×264 |
| 方向键 0→1 后焦点环 | 无 | **`solid 2px rgb(31,95,208)`** = 我们的浅色 `--dstv-info` |
| `aria-selected="true"` 数量 | 0 | **1** |

#### 五、必须撤回的三条旧结论

1. **§12.31 的窄屏测量全部无效。** 那组数据（头部 28/54/53/75/79px、"不溢出"）是在无样式状态下量的——28px 的头部就是没样式的证明。所以"窄屏布局本来就不坏"这个结论**不成立**，窄屏问题是**重新打开的**。
2. **§12.32 的焦点环当时不可能生效。** 规则确实在源码里，但整张表没应用。现在有真机证据（`rgb(31,95,208)`）。
3. **§12.33 的 containment 当时也没生效。** `content-visibility` 实测 `visible`，我把它归因为"瞬时状态"是错的。
4. §12.30 的浅色主题验证**仍然有效**——调色板属于被保留的那 4 条规则，实测计算值也确实是我们定义的浅色值。

### 12.36 窄屏：样式恢复后重新测量，并修掉 CSS 级联顺序（2026-11-16）

§12.35 修好样式表之后，§12.31 那份"窄屏没问题"的测量彻底作废（那是在无样式状态下量的）。这次在**样式确认生效**的前提下重测。

#### 一、真实数据（修复前）

先验证样式确实生效（`style` 25,762 字符、站点卡 `264px`、`content-visibility: auto`），再量：

| 宽度 | 头部高 | 行数 |
|---|---|---|
| 1872 | 45px | 5 |
| 1100 | 77px | 6 |
| 900 | 109px | 6 |
| 700 | 109px | 6 |
| 600 | 102px | 5 |
| 480 | **134px** | **7** |

与无样式时的 28/54/53/75/79 完全不是一个量级——之前的结论方向是对的、数值是错的。480px 下头部吃掉 900px 视口的 15%。

头部 8 个子元素在 480px 的分布：标题 56×19、图例 235×15、走带 250×28、三个按钮、锚点输入 234×26、搜索框 194×26，另有 43px 的提示行。

#### 二、先犯的错：同一个坑再踩一次

写窄屏规则时，我**又一次**漏了字符串拼接的分隔符。这次 S1 守卫当场拦住：

```
Error: S1 stylesheet looks truncated: 757 chars
```

补了 `+` 之后变体更隐蔽：`NaN` 真的出现在样式表里——`"…" + "@media (max-width: 720px){…}" + ".dstv_legend…"` 里少了一个 `+`，于是前面那条字符串被**一元加号**转成数字，`"…" + NaN` 得到字面量 `NaN` 拼进 CSS：

```
important;scroll-behavior:auto!important}}NaN.dstv_title{...}
```

S1 的括号平衡断言抓到了它（`最低深度: -1`）。

**所以干脆换掉这种脆弱写法**：`const css = "" + … + …` 改成**数组字面量 + join**：

```js
const css = [
  "…",
  "…",
].join("");
```

数组里漏逗号是**语法错误**（构建/加载即失败，响亮），不会再出现"静默截断"或"NaN 混入"。变异（删掉一个逗号）→ `SyntaxError: Unexpected string`。

#### 三、真正的性能问题：级联顺序

窄屏块最初放在样式表**开头**。同优先级下**后写的规则获胜**，所以它被后面的 `.dstv_head{padding:8px 12px}`、`.dstv_legend{display:inline-flex}` 全部覆盖。真机现象很明确：

- 700px：`hintShown:false`（生效了）但 `legendShown:true`（被覆盖）
- 480px 头部仍 134px

把整块移到数组**末尾**后：

| 宽度 | 修复前 | 修复后 |
|---|---|---|
| 900 | 109 | 109（断点外，不变） |
| 700 | 109 | **71** |
| 600 | 102 | **71** |
| 480 | 134 | **101** |

900px 不变是对的——断点是 720px。1872 / 1100 也保持不变（图例与提示行照常显示）。

#### 四、守卫

S1 新增两条：① CSS 必须是 `[].join("")` 形式，禁止 `+` 链；② 窄屏媒体块的位置必须在 `.dstv_head{position:sticky`、`.dstv_legend{display:inline-flex`、`.dstv_searchInput{width:150px` 之后。变异（把块移回开头）→ 红：`the narrow-viewport block must come after .dstv_head… or the cascade swallows it`。

**教训补一条**：CSS 的"存在性"和"生效性"是两件事。断言了规则在样式表里，只能证明它被写进去了；它是否真的赢下级联，必须断言**顺序**，或者实测计算样式。

### 12.37 输入框缺 id/name：aria-label 解决不了浏览器的表单检查（2026-11-16）

用户截图里的 DevTools 提示：

> A form field element should have an id or name attribute — This might stop the browser from correctly autofilling the form.（3 项资源）

提示是真的。§12.32 我给两个输入框加了 `aria-label`，解决了**读屏名称**，但没解决**浏览器表单检查**：后者看的是 `id` / `name`，与 `aria-label` 是两套东西。

修复（两个框都补）：

| 框 | id | name | type | autocomplete |
|---|---|---|---|---|
| 锚点 | `dstv-anchor-input` | `dstv-anchor` | `text` | `off` |
| 搜索 | `dstv-search-input` | `dstv-search` | `search` | `off` |

`type="search"` 让搜索框拿到浏览器原生语义（清除按钮、`Esc` 行为）；`autoComplete="off"` 是因为这两个框不是用户身份/地址之类的自动填充目标，显式声明比让浏览器猜好。

#### 真机核对（React 里 id/name 容易被吞）

| 项 | 实测 |
|---|---|
| 插件内输入元素数 | **2** |
| 锚点框 | `id=dstv-anchor-input`、`name=dstv-anchor`、`type=text`、`aria-label` 在、`autocomplete=off` |
| 搜索框 | `id=dstv-search-input`、`name=dstv-search`、`type=search`、`aria-label` 在、`autocomplete=off` |
| 页面剩余无名输入元素 | 2 个，均 `insidePlugin: false` —— 宿主的侧栏「搜索会话名称」与一个 `type=file` 上传控件，不属于本插件 |

#### 顺带核查

插件里另一处 `textarea` 是剪贴板 fallback（`document.createElement` 临时元素，用完立刻 `removeChild`），不会留下无名表单元素。

#### 守卫

A1 新增：两个框必须分别带指定 `id` 与 `name`，且必须显式 `autoComplete="off"`。变异（删掉搜索框 `id`）→ 红：`A1 input dstv-search-input needs an id`。

**教训**：无障碍是两套评分体系——`aria-label` 管读屏名称，`id`/`name` 管浏览器表单语义与自动填充。只做前者，审计工具依然会报。

### 12.38 两处疑点的最终结论：一个不是问题，一个是宿主的（2026-11-16）

#### 一、`blocksText` 用 `type` 而不是 `kind`——**不是 bug**

我之前把它列为待查疑点，理由是本项目内部的 assistant 块用 `kind`（`kind:"text"`），而 `blocksText` 只认 `b.type`。查宿主源码后确认这是**两种不同来源的两种形状**：

- **assistant 的 blocks**（流式缓冲）：`{kind:"text", text}` —— 宿主 `toAssistantBlock` 里 `case\`text\`: return {kind:\`text\`, text: block.text}`
- **`tool-result.content`**：宿主构造 tool-result 节点时写的是 `content: message.content`，即 **LLM 消息格式**，块是 `{type:"text", text}`

所以 `blocksText` 认 `type` 是对的——它正好对应它被调用时拿到的那份数据（`tool-result.content`）。实测：`blocksText([{type:"text",text:"abc"}])` → `"abc"`；`[{type:"image"}]` → `"[图片]"`；`[{type:"reasoning",text:"think"}]` → `"think"`。

**结论：之前的"疑点"是我没核对调用方数据形状就下的判断，属于误报。** 不做改动。

#### 二、`aria-selected`/悬浮等都没问题；剩余 DevTools 提示来自宿主

用户持续看到 “A form field element should have an id or name attribute”，修复后从 **3 项降到 1 项**。真机枚举全页 4 个表单元素：

| 元素 | 归属 | id/name | 可见 | 是否被报 |
|---|---|---|---|---|
| `bhn1Oq_searchInput`（侧栏「搜索会话名称」） | 宿主 | 无 | 是 | **是（剩余这 1 项）** |
| `dstv-anchor-input` | 本插件 | 有 | 是 | 否 |
| `dstv-search-input` | 本插件 | 有 | 是 | 否 |
| `input[type=file]` | 宿主 | 无 | 否 | 否（隐藏不审计） |

**结论：剩余 1 项在宿主代码里，本插件无法也不应修改。** 我们从 3 项降到 1 项，已经把自己那部分清零。

#### 三、真机截图复核（0.9.8）

用户提供的界面截图显示：卡片布局、横向时间轴、minimap 色块、站点详情面板、KPI 条（4 轮次 / 56 步骤 / 52 工具 / 0 错误 / 9.6 min / 21.1M tokens / 45k 输出）全部正常渲染，样式与 §12.35 修复预期一致。

### 12.39 Markdown 导出：内容自带的代码围栏会截断整份导出（2026-11-16）

#### 一、问题

导出用固定的三反引号包裹内容：

```js
L.push("```"); L.push(resultText); L.push("```");
```

而工具结果**经常本身就是代码**——读一个 README、看一个 diff、`cat` 一段配置文件。实测（模型读 README 的场景）：

````
**detail.result**

```
# 标题
```bash      ← 这一行把外层围栏提前闭合
npm i
```           ← 这一行又开了一个新围栏
完            ← 落在围栏外
```
````

结果是：导出文件里 `# 标题` 之后的每个标题都会变成代码块内容或被吞掉，**整份笔记从中间开始错乱**。这不是"显示不好看"，是导出的文件本身坏了。

#### 二、修法：围栏长度按内容决定

CommonMark 规则：围栏只在遇到**不短于开栏长度**的反引号串时闭合。所以只要开栏比内容里最长的反引号串至少长一个，就永远不会被误闭合。

新增纯函数：

```js
function fencedBlock(content, lang) {
  const text = String(content ?? "");
  let longest = 0;
  for (const run of text.match(/`+/g) ?? []) if (run.length > longest) longest = run.length;
  const fence = "`".repeat(Math.max(3, longest + 1));
  return [fence + (lang ?? ""), text, fence];
}
```

普通内容仍是 ```（不变），含 ``` 的内容自动升为 ````，含 ```` 的升为 `````。**全部 15 处围栏拼接都改走它**（思考块、参数、结果、消息、payload、命令输出、提示词 diff、系统提示附录）。

修复后同一场景：

````
**detail.result**

````
# 标题
```bash
npm i
```
完
````
````

内层三反引号保持为**字面文本**，导出结构完整。

#### 三、验证

| 断言 | 内容 |
|---|---|
| 普通内容 | `fencedBlock("plain","")` → 开栏 ``` |
| info string | `"```json\nplain\n```"` |
| 含三反引号 | 升为 ```` |
| 含四反引号 | 升为 ````` |
| null 内容 | 变成空块，不抛错 |
| 端到端 | 工具结果是 README 的会话，导出里内层 ```bash 必须落在 4 反引号围栏**内部** |

两个变异（固定三反引号 / 不扫描内容）均变红：`a 3-backtick run inside must promote the fence to 4`。

### 12.40 用户报的三件事：加载态误报、控制台报错、步骤卡换行（2026-11-16）

用户附了两张截图，指出三个问题。逐条核查结果：**两条是真问题，一条不是我们的**。

#### 一、冷启动把"正在加载"说成"暂无数据"（真问题）

截图一：刚点进轨迹视图时显示 `◉ 暂无轨迹数据 / 发送消息后，这里会以横向时间轴展示…`，而会话里明明有 90+ 步。

根因：视图只判断 `N === 0`（站点数为 0）就落到"空态"分支，把**未就绪**和**确实为空**混为一谈。冷启动时会话日志还在读，快照是空的，于是渲染出一句对用户而言**是假话**的文案。

宿主其实给了准确信号。`dsh-api-session-controller` 的会话快照带 `openState: "loading" | "open" | "error"`，宿主自己的视图就在用：

```js
useSession(snapshot => snapshot.openState === `loading`)
```

修复：读取该信号，在空态之前插一个加载分支——**骨架卡 + 旋转指示 + `role="status"` / `aria-live="polite"` / `aria-busy="true"`**，而不是猜测数字或用散文。三点考虑：

1. 用骨架而不是文字，是因为此刻**卡片数未知**，写任何数字都是编的
2. 骨架尺寸与真卡片同一量级，数据到达时布局不跳
3. 动画走 `animation`，被已有的 `prefers-reduced-motion` 全局规则自动关掉，不需要额外分支

真机验证（打开会话 → 切到轨迹视图 → 刷新页面）：

```
t=2719ms  root=true skeleton=3 spinner=1 loadingText="正在读取会话轨迹…" busy=true cards=0
t=3006ms  root=true skeleton=0 cards=69
SAW_SKELETON=true  SAW_EMPTY_WHILE_LOADING=false
```

骨架在 287ms 后被 69 张真卡片替换，整个过程没有出现"暂无轨迹数据"。

#### 二、"步骤 51" 卡片标题折成两行（真问题）

截图二：「步骤 51」被拆成两行——"步骤"在第一行、"51" 在第二行。

根因：`s.label` 是 `dstv_name` 里的**裸文本节点**，与三枚 chip 挤在同一行。`dstv_chips` 用了 `flex-wrap:wrap`，卡片固定 264px 宽放不下，于是整行**换行**，标签被切成两段。

修复：

- `.dstv_chips` 改 `flex-wrap:nowrap` + `min-width:0;overflow:hidden`
- `.dstv_name` 改 `flex-wrap:nowrap;white-space:nowrap;overflow:hidden`
- 标签包一层 `.dstv_nameText{min-width:0;overflow:hidden;text-overflow:ellipsis}`（裸文本节点无法省略）
- `.dstv_chip` 加 `min-width:0;text-overflow:ellipsis`，并给每枚 chip 加 `title` 保留完整值

真机测量：61 张卡片的 `.dstv_name` 高度**统一 16px**（此前会出现 0/16/32 混合，即折行）。溢出改为省略号，完整内容在 `title` 里。

#### 三、控制台 "A form field element should have an id or name attribute"（不是我们的）

0.9.8 修完两个输入框后，报错从 **3 项降到 1 项**。真机枚举页面剩余的无名可见表单元素，只有一个：

```html
<input class="bhn1Oq_searchInput" type="text" placeholder="搜索会话名称" maxlength="500" tabindex="-1" value="">
```

`inPlugin: false` —— 这是宿主侧栏的会话搜索框，位于 `bhn1Oq_search` 容器内。本插件无法也不应修改宿主代码。另一个 `input[type=file]` 是隐藏的，DevTools 不审计。

**结论：插件侧已清零。**

#### 四、守卫

| 断言 | 内容 |
|---|---|
| L1-a | 必须读取 `openState === "loading"` |
| L1-b | 加载分支必须**排在**空态/不兼容分支之前（否则空态文案会赢） |
| L1-c | 必须有 `role="status"` 与 `aria-busy="true"` |
| L1-d | 必须有骨架卡 `.dstv_skeleton` / `.dstv_skeletonRow` |
| L1-e | 必须能被 reduced-motion 规则关掉动画 |
| L2-a | `.dstv_chips` 必须 `flex-wrap:nowrap` |
| L2-b | 必须有可省略的 `.dstv_nameText` |

变异：把加载分支改成 `if (false)` → 红（`L1 a loading branch must exist`）；把 chips 改回 `flex-wrap:wrap` → 红（`L2 card chips must stay on one line`）。

#### 五、插曲：这次改 CSS 我又漏了两次逗号

新增 7 条 CSS 时，我两次漏写数组成员后的逗号。第二次 S1 守卫直接报 `SyntaxError: Unexpected string`——**这正是把 `+` 串改成数组 join 想要的效果**：错得响亮，而不是像 0.9.0–0.9.5 那样静默截断、页面变纯文本。

### 12.41 卡片标题：我第一次修反了方向（2026-11-16）

§12.40 修「步骤 51 折成两行」时，我的做法是让 chips 单行不折、标签可省略。用户回了一句「没有什么变化」并附截图——第一张卡显示 `步骤 …`。

**用户判断是对的，我修反了。**

#### 一、错在哪

原缺陷是：标签被挤到换行——「步骤」在第一行、「51」在第二行。

我的修法让 chips 不许换行，于是挤不下的压力全部转移到标签上，标签被省略成 `步骤 …`。这比原缺陷**更糟**：

- 原缺陷：数字跑到第二行，**至少还能看见**
- 我的修复：数字**直接从视野里消失**了

而「步骤 51」里的 `51` 正是这张卡的**唯一身份信息**——截断它等于把卡片变成匿名。chips 全是可推导的次要信息（工具数、耗时、token），恰恰是最该让位的。

#### 二、正确做法：让 chips 整块让位

```css
.dstv_name      { display:flex; flex-wrap:wrap; row-gap:3px }  /* 容器可换行 */
.dstv_nameText  { flex:0 0 auto; white-space:nowrap }          /* 标签永不收缩 */
.dstv_chips     { margin-left:auto; flex-wrap:wrap }           /* chips 整块换到下一行 */
```

放得下时同一行；放不下时 chips 整体落到第二行，标签始终完整。这也符合信息层级：**主标识 > 附加指标**。

#### 三、真机验证

| 项 | 修复后 |
|---|---|
| 标签被截断（`scrollWidth > clientWidth`） | **0 条** |
| 标签文本 | `步骤 7` / `步骤 8` / `步骤 9` / `步骤 10` 均完整 |
| `.dstv_name` 行高 | 统一 16px（标签本身不折行） |

#### 四、守卫

L2 改判：

- `.dstv_nameText` 必须 `flex:0 0 auto;white-space:nowrap`（**不得**可省略）
- `.dstv_name` 必须 `flex-wrap:wrap`（让 chips 有地方去）

变异（把标签改回 `min-width:0;text-overflow:ellipsis`）→ 红：`L2 the step label must not shrink or ellipsize`。

#### 五、教训

这是本会话第二次「改完更像改坏了」。共同点：**我优化的是"布局不换行"这个形式指标，而没有先问"卡片上哪个信息不能丢"**。视觉缺陷的修复必须先定信息优先级，再决定谁让位——否则很容易把可见的问题换成一个更隐蔽的问题。

### 12.42 给宿主的无名表单字段补 id（2026-11-16）

用户要求「先修好右下角这个提示」。先把事实钉死，再决定能不能修。

#### 一、事实

递归扫含 shadow DOM 的整页表单元素，运行 0.9.11：

| 元素 | 归属 | id | name | 可见 |
|---|---|---|---|---|
| `input.bhn1Oq_searchInput`（侧栏「搜索会话名称」，`tabindex=-1`） | 宿主 | 无 | 无 | 是 |
| `input[type=file]` | 宿主 | 无 | 无 | 否（隐藏，不审计） |
| `#dstv-anchor-input` | 本插件 | 有 | 有 | 是 |
| `#dstv-search-input` | 本插件 | 有 | 有 | 是 |

**插件侧早已清零，剩下这一个确实在宿主代码里。** 但用户要的是「这个提示消失」——提示不会因为"不是我们的"就消失。

#### 二、能做且安全的做法

宿主代码改不了，但元素在**同一个 document** 里，插件可以给它补属性。

新增 `annotateNamelessFormFields()`，规则刻意保守：

1. **只碰既无 `id` 也无 `name` 的字段**——宿主自己设了 id 的永远不覆盖
2. **只设 `id`，绝不设 `name`**——`name` 会改变所在表单的提交内容；审计对两者任一满足即可
3. **跳过 `.dstv_root` 内的元素**——我们自己的框本来就有 id
4. **id 带命名空间且去重**（`dsh-field-<class>`，冲突时加 `-2`、`-3`），不会与宿主撞车

挂载后跑一次，并在 20 秒内每 500ms 补扫一次（宿主侧栏是懒渲染的，单次挂载可能早于它出现）；每次扫描是一次属性检查，字段齐了就立即返回。

#### 三、真机验证

| 项 | 0.9.11 | 0.9.12 |
|---|---|---|
| 全页无名表单元素 | 1 | **0** |
| 宿主搜索框 | `id=""` | **`id=dsh-field-bhn1Oq_searchInput`**，`name` 仍为 `null` |
| 我们的两个框 | id/name 齐全 | 不变 |

#### 四、守卫

F1 断言（用注入到 vm 沙箱的假 document 执行真函数）：

- 只标注 1 个字段（我们自己的被跳过，已有 id/name 的不动）
- 宿主字段得到 `dsh-field-bhn1Oq_searchInput`
- **绝不设置 `name`**
- 已有 id 必须保留
- 视图里必须真的调用它

变异：① 去掉 `el.id = candidate` → 红（`F1 host field got id`）；② 去掉 `.dstv_root` 跳过判断 → 红（`F1 exactly one field should be annotated, got 2`）。

#### 五、需要说明的一点

这是**替宿主修**。若将来宿主自己给这个输入框加了 id/name，我们的逻辑会因"已有属性"自动跳过，不会冲突；若宿主重构了类名，id 的 slug 会跟着变，但语义不变。这条依赖写在这里，避免以后有人以为这是插件自己的字段。

### 12.43 补 id 的时机错了：审计在页面启动时就已记录（2026-11-16）

§12.42 加了 `annotateNamelessFormFields()` 并在**视图挂载**时调用。用户刷新后截图：加载骨架正常了，但控制台**仍然报那一条**。

#### 一、真机先排除了"没生效"

插件是符号链接指向本仓库，检查下发文件里 `annotateNamelessFormFields` 出现 **4 次**，说明运行时确实是新代码。所以不是没生效，是**生效得太晚**。

#### 二、根因：审计的时间点

DevTools 的 Issues 面板在**页面启动**时扫描表单元素，并把结果**留在面板里**。我们的视图要等用户切到「轨迹视图」才挂载——那时审计早就跑完、结论早已记下。补 id 补在一个已经结束的检查之后，自然看不见变化。

#### 三、修法：提前到 bundle 求值时

新增一个独立 region，在插件加载时就驱动补扫（函数仍在 helpers 区，方便单测直接调用）：

```js
if (typeof document !== "undefined") {
  const annotatePass = () => { try { annotateNamelessFormFields(); } catch { /* 不因为一个 id 搞坏宿主 */ } };
  let annotateTicks = 0;
  const annotateTick = () => {
    annotatePass();
    annotateTicks += 1;
    if (annotateTicks < 40) window.setTimeout(annotateTick, 250);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", annotateTick, { once: true });
  else annotateTick();
}
```

`DOMContentLoaded` 之前先挂监听（此时侧栏还没建出来），之后就每 250ms 补扫，共 40 次（10 秒）覆盖宿主懒渲染的窗口。

#### 四、真机验证：完全不进轨迹视图

这次特意**不点「轨迹视图」**，直接看侧栏字段有没有被补上——因为这正是审计发生的场景。

```
SAMPLES=[{"t":21781,"hostId":"dsh-field-bhn1Oq_searchInput","nameless":0,"total":2}]
NAMELESS_ZERO=true
```

页面加载后无待补字段，宿主搜索框已有 id。

#### 五、守卫（第一版写弱了）

第一版断言只检查"region 存在且位置在 helpers 之前"。变异 `if (typeof document !== "undefined")` → `if (false)` **没有变红**——因为 region 文本还在，断言查的是文本形状，不是可执行性。

改成检查真正会执行的语句，三个变异才全部变红：

| 变异 | 结果 |
|---|---|
| `if (typeof document …)` → `if (false)` | 红：`the load-time driver must not be disabled` |
| 去掉 `annotatePass()` 调用 | 红：`the driver must call annotatePass on every tick` |
| `else annotateTick()` → `else void 0` | 红：`the driver must run immediately when the DOM is ready` |

#### 六、教训（本会话第三次同类）

"断言了代码形状" ≠ "断言了代码会执行"。前两次分别是：`anchorLoadTarget` 只断言调用不断言条件、§12.42 区域存在但时机不对。**凡是"某段代码存在"的断言，都要问一句：如果把它变成死代码，这条断言还会绿吗？**

### 12.44 详情面板的助手正文：从"打印源码"到真正渲染 Markdown（2026-11-16）

用户指出：详情面板里的助手正文**没有样式**——`**0.9.13**`、`# 之前没修掉的原因`、三反引号全部按字面打印。

#### 一、根因

```css
.dstv_dText{font-size:12.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
```

`white-space:pre-wrap` + 直接把 `cell.text` 塞进 `div` 的 `children`——于是渲染的不是正文，是**源码**。

宿主对话区用自己的 `AssistantMarkdown`，但它需要 `loadImage`、`usePresentation`、`renderSlot`、`useDisclosure` 等十来个内部服务，插件拿不到，无法复用。所以只能自己实现。

#### 二、实现：解析与渲染分离

**解析层**（放在 pure helpers 区，可单测）：

- `mdInline(src)` → `[{t:"text"|"code"|"strong"|"link", …}]`
- `mdBlocks(src)` → `[{type:"h"|"p"|"code"|"ul"|"ol"|"quote"|"table"|"hr", …}]`
- `markdownToPlain(src)` → 去掉标记的纯文本，供卡片两行摘要用

刻意做成**浅层**：不处理嵌套强调、HTML 块、引用式链接。不认识的语法退化成字面文本——**这比猜错好**。

**渲染层**：`MarkdownText({text})` 用 `jsx`/`jsxs` 构建元素。

**安全性**：全程不出现 `innerHTML` / `dangerouslySetInnerHTML`，模型输出**不可能**变成标记；外链带 `rel="noreferrer noopener"`。这条有断言守着（且断言会先剥掉注释——第一版被我自己解释"no innerHTML"的注释误伤了）。

#### 三、差点交付一个空壳

第一次真机验证：`.dstv_md` 容器存在，但 `textContent` 长度是 **0**。

原因是我把节点数组传成了 `jsx` 的**第三个参数**：

```js
return jsx("div", { className: "dstv_md" }, nodes);   // ← nodes 被当成 key
```

`jsx(type, props, key)` —— 第三个位置是 key，不是 children。于是渲染出一个空 div。

**这个 bug 所有单元测试都是绿的**：解析器测试全过、样式断言全过、`MD1` 全部满足。只有真机量 `textContent.length` 才暴露。补了 MD2 断言（禁止把 nodes 传在 key 位置 + 必须走 `children`），变异验证变红。

#### 四、真机结果

| 指标 | 结果 |
|---|---|
| 详情面板正文长度 | 93 字符（非空） |
| 生成元素 | `p`×2、`code`×2、`strong`×1 |
| 字面 `**` 残留 | **0** |
| 字面 `#` 标题残留 | 无 |
| 字面三反引号残留 | 无 |

#### 五、顺带

卡片的两行摘要改用 `markdownToPlain()`，否则预览里会看到 `**粗体**`。卡片是"扫读"用的，标记符号在那里的信息价值为零。

#### 六、教训

**"单测绿"≠"渲染对"。** 纯函数的输出结构可以对，而把它交给视图的那一步（参数位置、props 名）仍然可能是错的。凡是"数据 → 组件"的接缝，必须有真机断言兜住；本项目里这条接缝已经连着坏了三次（§12.35 CSS 拼接、§12.43 死代码、本条）。

### 12.45 输入框该浮盖不该占位；详情面板的标签该是标题不是前缀（2026-11-16）

用户提出两个问题：① 步骤详情里"用户/助手"和正文挤在一起不好看；② 切到轨迹页，底下的发消息组件还在。

#### 一、输入框：我一直在治标

§12.26 起我一直做的是**给底部留白**（`paddingBottom: composerH`），让内容能滚出输入框的遮挡。这只解决了"看不见末尾"，没解决"输入框本来就不该占一行"。

查宿主 CSS 才发现关键机制：

```css
.wSkVaW_scrollBody:has([data-conversation-composer-overlay]) > .wSkVaW_composerSeat{
  right:var(--dsh-scrollbar-width); position:absolute; bottom:0; left:0 }
.wSkVaW_scrollBody:has([data-conversation-composer-overlay]) > ... > .wSkVaW_viewArea{
  flex:1 1 0; min-height:0; overflow:hidden }
```

宿主是**按 `data-conversation-composer-overlay` 这个属性**判断"当前视图要不要浮盖输入框"的。官方轨迹视图在自己的根 div 上就是 `"data-conversation-composer-overlay": ""`。我们的视图没设，输入框只好按普通布局占一行——于是它永远挂在我们下面。

修复：根元素加上这个属性。实测 `composerSeat` 的 `position` 从静态变成 **`absolute`**、`bottom:0`。留白逻辑保留（浮盖仍然会挡住最后几行）。

#### 二、详情面板：标签是标题，不是前缀

原结构是 `flex-direction:column` 里先放 `<span>` 标签、再放正文 `<div>`。问题在于 `.dstv_dText` 保留着 `white-space:pre-wrap`，且标签与正文之间没有视觉边界，读起来像一句话被拆开。

改法：

- 助手 / 用户正文都套 `.dstv_dSectionBody`：加边框、圆角、内边距、次级背景，形成"标题 + 内容"的卡片
- 标签 `.dstv_dLabel` 的 `margin-bottom` 清零，由卡片 `gap` 控制
- 用户正文同样走 `MarkdownText`（用户也经常贴代码块和列表）

真机测量（含正文的详情区块）：

| 项 | 结果 |
|---|---|
| 卡片 | `border-radius:9px`、`padding:8px 10px`、`border:1px` |
| 标签底 / 正文顶 | 603px / 608px —— **正文在标签下方 5px**，不再是同一行 |
| 区块内含 Markdown 渲染结果 | 1 |
| 正文长度 | 85 字符 |

#### 三、守卫

C1 断言：根元素必须有 overlay 属性（且必须**在根元素的 props 对象内**）、必须保留 composer 高度留白、详情正文必须有卡片样式且使用卡片布局。

三个变异全部变红：移除属性 / 把属性挪到别的元素 / 去掉卡片边框。

写守卫时踩了一个小坑：最初用"属性前 400 字符内找 `className`"定位，而解释这个属性的注释比 400 字符还长，导致断言误报。改成**从属性位置向前找最近的 `className`，并要求两者之间没有 `}`**（即同属一个对象字面量）——结构判断比距离猜测可靠。

### 12.46 那条"穿过卡片的线"是回放游标，但画成了分隔线（2026-11-16）

用户圈住截图里一条竖线问"这是什么情况"。

#### 一、它是什么

`.dstv_playhead` —— 回放到第几站的指示器，`revealed !== null` 时出现，位置贴在当前站点卡片之间。

#### 二、为什么看不懂

原样式：

```css
.dstv_playhead{top:40px;bottom:14px;width:2.5px;box-shadow:0 0 10px <高饱和发光>}
```

真机测量：**高 160px**，而站点条带容器只有 214px 高。也就是说它是**一根几乎贯穿整个条带的竖线**，其中还有 36px 露在卡片下方。

三个问题叠加：

1. **长度不表意**：从 40px 拉到底，看不出它"指向"哪张卡
2. **顶上那个三角形朝上**，指着空白，而不是指向卡片
3. **高饱和外发光**让它看起来像"把条带切开的分隔线"，而不是游标

用户的第一反应是"这条线是什么情况"——一个需要被询问的图形，等于没传达信息。

#### 三、改法：短游标 + 朝下箭头

```css
.dstv_playhead{top:34px;height:14px;width:2.5px;box-shadow:0 0 8px <柔和>}
.dstv_playhead i{bottom:-6px;border-top:6px solid <accent>}   /* 朝下，指向卡片 */
```

同一个信息，改成"落点标记"的语汇：短竖标 + 朝下三角明确指向当前卡片，露在卡片下方的无意义部分消失。另加 `aria-hidden="true"`——它是纯装饰，读屏不该念。

真机复核：高度 **160px → 14px**，箭头 10×6px 且朝下，`aria-hidden` 已设置。

#### 四、守卫

P3 断言：不得有 `bottom`（不许拉满）、必须是 `height:14px` 短标、不得用旧的高饱和发光、箭头必须 `border-top` 朝下且不得回到 `top:-7px`、必须 `aria-hidden`。

三个变异全部变红：恢复原高度 / 箭头改回朝上 / 去掉 aria-hidden。

#### 五、一点反思

这个元素是我自己加的（"回放位置指示"），但我只验证了它**存在且会移动**，从没验证过它**能否被读懂**。功能测试覆盖"行为"，覆盖不了"表达"。凡是新增的视觉元素，除了"实现了没有"，还得问"用户能不能说出它是什么"——这条应该写进 UI 改动的检查项。

### 12.47 游标指错一张卡：固定步长公式 vs 真实测量（2026-11-16）

用户报告：「我选择的是步骤 66，它指向的是步骤 65。」

#### 一、根因

位置是算出来的：

```js
left: `${26 + (R - 1) * STATION_W + STATION_W / 2}px`   // STATION_W = 264
```

这个公式假设：站点宽恰好 264px、首站偏移 26px、站点之间没有空隙。

三条都不成立：

- `.dstv_station` 有 `padding:0 2px`，卡片实际 **268px**
- 站点之间会插入 `.dstv_gapBand`（**空闲间隔**，宽度按时长变化）
- 首站偏移也不是常量

于是误差随序号线性累积——**选得越靠后偏得越多**，正好表现为"指向上一张卡"。

#### 二、改法：测量，不计算

同一个组件里，`centerStation()` 早就在用 `getBoundingClientRect()` 测真实位置；游标却还在用公式。现在统一成测量：

```js
const el = sc.querySelector(`[data-station-idx="${String(R - 1)}"]`);
setPlayheadLeft(el.offsetLeft + el.offsetWidth / 2);
```

用 `offsetLeft` 是因为它相对 `offsetParent`（即 `.dstv_hflow`），与绝对定位的游标同一坐标系，避免叠加滚动量的换算错误。

副作用按需重测：`[revealed, R, N]` 变化、以及 `resize`。未测量前不渲染游标（`playheadLeft === null`），避免闪一下错误位置。

#### 三、真机验证

连续选中第 3/7/12/20 站，量游标中心与目标卡中心的偏差：

| 选中站 | 游标中心 | 卡片中心 | 偏差 |
|---|---|---|---|
| 3 | 1062 | 1061 | **1px** |
| 7 | 1062 | 1061 | **1px** |
| 12 | 1062 | 1061 | **1px** |
| 20 | 1062 | 1061 | **1px** |

1px 来自 2.5px 宽标记的取整。以往公式在同样位置会偏出几十像素。

#### 四、守卫

P4 断言：禁止出现 `(R-1)*STATION_W` 公式、必须走 `setPlayheadLeft`、必须用 `offsetLeft + offsetWidth/2`、必须监听 resize、effect 依赖必须含 `revealed`。

三个变异全部变红：改回公式 / 去掉 resize 监听 / 依赖数组改空。

#### 五、教训

**同一个组件里，测量和计算并存是危险信号。** `centerStation` 早就用真实测量把卡片滚到视野中央，说明作者（我）当时就知道布局不是等宽的；可同一个视觉位置仍然用了公式。写新代码前先看邻居怎么拿到同一个事实。

### 12.48 一个 21.9 小时的"工具耗时"污染了汇总（2026-11-16）

#### 一、怎么发现的

核对 KPI 与卡片时，逐张累加各站的工具耗时要对得上。实测对不上：

| 来源 | 值 |
|---|---|
| KPI「工具总耗时」 | 7.4 min |
| 56 张卡逐个累加 | **78,731,276 ms ≈ 21.9 小时** |

两者差 177 倍。定位到**步骤 57**：卡片上一个工具显示 **78,834,620 ms**，而点开后详情里的实际耗时是 **3,298 ms**。

#### 二、根因

```js
const dur = res != null && Number.isFinite(res.callTime) && Number.isFinite(res.time)
  ? Math.max(0, res.time - res.callTime) : null;
```

`callTime` 是宿主在 **tool-call 侧**记的时间戳；同一会话被重新解析 / 重新加载（历史翻页、日志重读）时，这个字段可能缺失或属于**另一轮解析**。于是 `res.time - res.callTime` 跨过了重载间隔，得到的是"两次解析之间隔了多久"，不是"这个工具跑了多久"。

有意思的是 KPI 反而接近合理值——因为它是另一条累加路径，恰好没被同一个异常值主导。**两个数不一致本身就是线索**。

#### 三、改法：拒绝不可能的值，而不是拒绝整个 cell

```js
const rawDur = …;
const dur = rawDur !== null && rawDur <= TOOL_DUR_CEILING_MS ? rawDur : null;
```

`TOOL_DUR_CEILING_MS = 6 小时`。超过上限当作**未知**（`null`）而不是"巨大"：

- 卡片上的步骤 span 仍然显示（那是另一个字段），信息不丢
- 但错误数字**不进任何汇总**——错误的数字比没有数字更糟
- cell 本身保留，工具仍然列出来（不能因为耗时异常就把一次调用从时间线里删掉）

上限放在 helpers region 内，测试可直接引用同一个常量。

#### 四、验证

| 断言 | 内容 |
|---|---|
| 正常值 | `callTime=1000, time=4298` → `durationMs = 3298` 保留 |
| 异常值 | `time=78835620` → `durationMs = null` |
| cell 存活 | 异常值下 cell 数量仍为 1 |
| 零跨度 | 5000→5000 → 0 |
| 负跨度 | 9000→1000 → 0（夹到 0） |

三个变异全部变红：

- 去掉上限 → `an impossible duration must be null, got 78834620`
- 上限设为 1000ms（误杀正常值）→ 红
- **反方向变异**：超限时 `continue` 丢弃整个 cell → 红（`the tool cell must survive a rejected duration`）

第三条是故意加的：只断言"异常值被拒绝"会诱导出"把整个 cell 删掉"这种更糟的修法，所以要同时断言"信息不能被删掉"。

#### 五、教训

**汇总值和明细对不上，就是数据管线在撒谎。** 以前我验 KPI 只验"它不是 0、不是 NaN"，没验过"它等于明细之和"。这类断言（`sum(details) === total`）比任何格式检查都更能抓到脏数据。

### 12.49 卡片耗时和 KPI 对不上：不是没校验，是两种耗时共用一个词（2026-11-16）

§12.48 之后我决定验证"汇总 = 明细"，于是把每张卡上的耗时加起来跟 KPI 比。真实会话结果：

| 来源 | 值 |
|---|---|
| KPI「工具总耗时」 | 9.2 min |
| 45 张卡的耗时 chip 之和 | 5,522,053 ms ≈ **92 min** |
| 工具数（KPI vs 卡片） | 42 / 42 **一致** |

工具数完全吻合，耗时却差 83 分钟。查代码后确认**两个指标都对**，只是口径不同：

| 指标 | 数据源 | 含义 |
|---|---|---|
| 卡片 chip | `stepDurMs = endMs - startMs` | **步骤总跨度**：模型思考 + 工具执行 + 中间空闲 |
| KPI | `stats.toolMs`（各工具 `dur` 累加） | **纯工具执行时间** |

一个步骤动辄 100~200 秒，而其中工具只占几秒——差值就是模型生成时间。所以两个数字都正确。

#### 问题在于表达

卡片上原来只是一个**裸数字** `103,686 ms`，而 KPI 写着「工具总耗时」。用户（包括我）看到两个"耗时"自然会想加总，一加就对不上——**这是表述造成的误读，不是数据错误**。

#### 改法：给两种耗时各自的名字

- 卡片 chip 改为 `步骤耗时 162,966 ms`
- 新增 chip `工具耗时 3,312 ms`（有工具时）
- i18n 增加 `meta.stepDur` / `meta.toolDur`

#### 验证：这次终于能加总了

修复后真机：

```
工具耗时 chip 之和 = 485,833 ms  ≈ 8.1 min
KPI「工具总耗时」   = 8.1 min          ← 完全一致
步骤耗时 chip 之和 = 5,200,542 ms ≈ 87 min  ← 另一个指标，不参与比较
```

**加总对上了。** 这反过来证明 §12.48 的耗时上限修复也是对的（否则那个 21.9 小时的假值会让这个和再次爆掉）。

#### 守卫

D2 断言：数据层面两条耗时必须各有其值（step span 8000 ≠ tool time 2000），标签层面必须分别出现 `meta.stepDur` 与 `meta.toolDur` 且各自带值。

变异：卡片耗时去掉标签改回裸数字 → 红；删除工具耗时 chip → 红。

#### 教训

§12.48 我写"汇总和明细对不上就是数据在撒谎"——**这句话需要补一个前提：先确认两边是同一个量。** 这次的差值其实一直是"模型生成时间"，它一直就在那里，只是没被命名。**没被命名的量会被误当成错误。**

### 12.50 状态提示会重复显示；以及我连续三次把"测不出来"当成"坏了"（2026-11-17）

#### 一、真实缺陷：同一条提示渲染两遍

`anchorNote` 在两处渲染：

- 页头：`jsx("span", { className: "dstv_chip warn", title: anchorNote, … }, "hAnchorNote")`
- 详情栏：`jsx("span", { className: "dstv_chip warn", children: anchorNote }, "dAnchorNote")`

于是"锚点格式无法识别""正在向前加载更早历史以定位…"等提示会**同时出现在屏幕上两次**。真机探针（统计 `.dstv_chip.warn` 的文本重复）确认了重复。删除详情栏那处，只保留页头（带 `title`）。

修复后真机：

```
warns = ["锚点格式无法识别"]
duplicated = []
```

守卫 N2 断言 `children: anchorNote` 只出现一次、且那一次必须带 `title`。变异（恢复重复渲染）→ 红。

#### 二、我这一轮的三个错误结论

这轮我在验证交互时，**连续三次把测试方法的问题误判成产品缺陷**：

| 我的判断 | 实际情况 | 我的错误 |
|---|---|---|
| "搜索没反应" | 搜索正常（38 处命中，回车可在命中间跳转） | 直接给受控 `input.value` 赋值不会触发 React 的 `onChange`，必须用原生 setter + `input` 事件，或真的敲键盘 |
| "锚点跳转坏了" | 功能正常，三种情况都有明确提示 | 我用 `[class*="anchorNote"]` 找提示，而它其实是 `.dstv_chip.warn`；`hAnchorNote` 是 React key，不是 class |
| "`tvp1:t2` 解析失败是 bug" | 解析器正确，格式本就是 `t<turn>s<step>` | **我自己编了个不存在的格式去测**，然后拿"它不认"当缺陷 |

第三次尤其值得记：如果当时直接去"修"解析器，就会把正确的代码改坏。**在断言"功能坏了"之前，必须先证明自己的测法能测出"功能正常"。**

#### 三、三条主操作的真实可用性（这次测法正确）

| 操作 | 结果 |
|---|---|
| 搜索 | `bash` → `1/38 命中`，回车 → `2/38 命中`，选中态跟随 |
| 锚点（合法 `tvp1:t2s1`） | 提示"正在向前加载更早历史以定位…"（目标不在当前窗口，属正确行为） |
| 锚点（非法） | 提示"锚点格式无法识别" |
| 锚点（不存在的 seq） | 提示"该记录不在当前窗口，需先拉取更早历史" |
| 回放 | 播放头存在、选中态正常推进 |

#### 四、方法上的补救

以后在真实页面验证交互，固定用这套顺序，避免再误判：

1. **先跑一个已知会失败的用例**（例如非法输入），确认探针能观察到反应——探针本身要先被证明有效
2. 受控组件用原生 setter + `dispatchEvent(new Event("input"))`，或 `Input.insertText` + 真实按键
3. 定位元素用**真实 class**，不能用 React 的 key（它们是 key，不进 DOM）
4. `keydown` 是否到达目标元素，用捕获阶段监听器直接记录，别靠猜

### 12.51 数字格式的两处一致性修补（2026-11-17）

这一轮从"用户体验一致性"入手，找到两个数字显示问题。

#### 一、`fmtTokens(999,999)` → `1000k`

`fmtTokens` 的 M 档和 B 档在 §8/§12.34 里已改成"先舍入、再选单位"，但 k 档漏了：

```js
if (n < 1e6) return `${(n / 1000).toFixed(n < 10000 ? 1 : 0)}k`;  // 999,999 → "1000k"
```

`1000k` 是四位尾数，本应进位成 `1.0M`——和之前修过的 `1000.0M` 是同一类错误。

改成统一的进位逻辑：

```js
if (n < 999.5e3) {
  const k = n / 1000;
  return `${n < 9950 ? k.toFixed(1) : String(Math.round(k))}k`;
}
if (n < 1e6) return `${(n / 1e6).toFixed(1)}M`;
```

边界实测：`9,949 → 9.9k`、`9,950 → 10k`、`999,499 → 999k`、`999,500 → 1.0M`。变异（恢复旧实现）→ 红：`TOK 999,999 must carry into M, got 1000k`。

#### 二、同一屏里两种时间单位

真机截图：KPI 显示 `9.2 min 工具总耗时`，而卡片 chip 显示 `工具耗时 53,270 ms`、`步骤耗时 114,774 ms`。同一类量在相邻位置用了 `min` 和 `ms` 两种单位，读者要在脑中换算。

`fmtMs`（精确毫秒）和 `fmtDur`（人类可读）本有分工，但**卡片是扫读元素**，它的三个耗时 chip 应该和 KPI 用同一套单位。精确值保留在详情面板里。

改法：卡片的 `工具耗时` / `步骤耗时` / `首 token` chip 全部改用 `fmtDur`，详情面板与导出继续用 `fmtMs`。

真机复核：

```
KPI:  10 min 工具总耗时
卡片: 工具耗时 53.3 s / 步骤耗时 1.9 min / …
毫秒 chip 残留: 0
```

D2 断言更新为 `8.0 s` / `2.0 s`，并加了一条"卡片不得用 fmtMs"。变异（把卡片改回 fmtMs）→ 红。

#### 三、教训

数字格式化的问题往往不是"算错"，而是**同一类量在不同地方用了不同契约**。§12.34 修了 M/B 档的进位却漏掉 k 档，这次补上；§12.49 修了"两种耗时共用一个词"，这次又发现两种单位混用。**格式化的本质是一致的表达契约，不能只修一处。**

### 12.52 Codex 对抗评审：12 项中核实并修复 7 项（2026-11-17）

用户要求让 Codex 评审。通过 Orca 启动 Codex worker（`ctx_14a3b4eaf0a5`），给了自包含的对抗性 spec：查真实缺陷、每条必须带证据、不改代码、不重复 §12 已记录的有意取舍。

**它报了 12 项。我没有直接采信，逐条用真实代码复现。** 核实通过的先修 7 项，全部配断言与变异。

#### 1. 【P1】partial.turn 污染了所有历史用户消息

```js
const declared = typeof n.turn === "number" ? n.turn
  : (typeof snap?.partial?.turn === "number" ? snap.partial.turn : null);
```

rc.2 的 `UserMessageNode` **没有 `turn` 字段**，于是几乎每条用户消息都落到 `partial.turn`——也就是**正在生成的那一轮**。

实测（旧代码）：站点顺序变成 `[user/t2, step/t1, user/t2, step/t2]`，**历史轮次被排到了最新轮次后面**。

修法：删掉 partial 回退。没有 `turn` 的用户消息走既有的 `pendingUser` 机制，由下一条 assistant 的 turn 收养。修复后带/不带 partial 的顺序完全一致（`step/t1, step/t2`）。

#### 2. 【P2】流式 reasoning 被工具调用吞掉

```js
!st.cells.some((c) => c.thinking !== "")
```

工具 cell **没有 `thinking` 字段**，而 `undefined !== ""` 为真——只要该步已有工具 cell，reasoning 就被判定"已存在"而丢弃。

**这里我第一次写错了测试**：用例里工具 cell 是 `runningCalls` 建的，排在 reasoning 之后，所以 `some()` 当时还看不到它，变异没变红。改成"工具调用在前、reasoning 在后"才复现。旧代码实测只剩 `[tool]`，reasoning 完全消失。

修法：`typeof c.thinking === "string" && c.thinking !== ""`，只认真正持有文本的 cell。

#### 3. 【P2】命令 / 孤立工具的状态显示错误

`dStatus` 只对 `step` 和 `kind === "error"` 分支，命令的 `outcomeKind` 与孤立工具的 `isError` 都没接：

- `outcome.kind === "error"` 的命令 → 显示"已完成"
- `outcome == null`（rc.2 明示仍在执行）的命令 → 显示"已完成"
- `isError: true` 的孤立工具 → 显示"已完成"

同时**失败命令没有计入 error KPI**（只加了文案，没 `stats.errors += 1`）。两处都修了。

#### 4. 【P2】锚点用窗口累计计数，导致 `tvp1:t2s1` 永远解析不到

`stepNo` 是**窗口级递增**计数器：窗口里先出现 turn1 的两步，turn2 的第一步就是 `stepNo=3`。而锚点 `t2s1` 的语义是**轮内**第 1 步。

实测：`resolveAnchorInStations(parseAnchor("tvp1:t2s1"))` → `not-loaded`，而该站点明明已加载。

修法：新增 `turnStep`（轮内序号，来自 `piece.stepNum`），锚点解析改用它；`stepNo` 保留原语义不动。修后 `t2s1` 命中、`t2s2` 正确未命中。

#### 5. 【P2】列表后的代码围栏被吞进列表

`mdBlocks` 的懒续行判断只排除空行和标题，**围栏被当成续行**：

```
mdBlocks("- Intro\n```js\nconst x=1\n```\n# Heading")
旧: [{type:"ul",items:[[Intro,```js,const x=1,```]]},{type:"h"}]
新: [ul, code(js, "const x=1"), h]
```

修法：遇到 `` ``` `` / `~~~` 就终止列表。原有懒续行行为（`- a\n  continued` → 并入首项）经断言保护未被破坏。

#### 6. 【P3】`c` 别名定位不到孤立工具结果

`c` 别名只在 `kind === "step"` 的站点里找工具 cell，而工具结果没有匹配调用时会成为独立的 `orphan-tool` 站点（自身带 `callId`）。补上这条路径；不存在的 callId 仍正确返回 `not-loaded`。

#### 7. 【P3】流式步骤的 `partial.timing` 被完全忽略

界面对正在生成的步骤报"未记录耗时"，而 `partial.timing` 里 `stepStartTime` / `firstTokenTime` 明明都在。

修后：`startMs=1000`、`ttftMs=200`、`timingRecorded=true`。**`endMs` 仍为 `null`**——步骤没结束就不该编造时长，这条也写进断言了。

#### 尚未处理（Codex 报了、我还没核实完）

- #3 递归 PTC 子调用链被截断
- #5 加载更早历史改变正在查看的记录
- #6 回车定位后 URL hash 不更新
- #8 锚点分页在"本轮已到末尾"时提前停止
- #12 有序列表起始编号丢失

（#12 已在本轮一并修掉，见下。）

#### 教训

**外部评审的价值在于它不受我的既有假设约束。** 这 7 项里有 4 项（partial.turn、reasoning、命令状态、轮内 step）都是我反复看过、测过却"看不见"的——因为我的测试和实现共享了同一个错误前提。对抗性评审从契约出发，才照出这些。

我自己在修 #2 时也重演了一次旧毛病：**测试用例没构造出触发条件，就以为修复无效**。变异没变红时，先怀疑用例，再怀疑代码。

### 12.53 Codex 剩余 4 项：全部属实，全部修复（2026-11-17）

承接 §12.52，把 Codex 报的其余 4 项也逐条核实。**4 项全部复现，全部修复。**

#### 1. 【P2】锚点分页在"本轮已到末尾"时提前停止

```js
const floor = anchorTurnFloor(stations);
return floor !== null && floor <= parsed.turn;   // 只要见过该轮就判"已覆盖"
```

窗口里只有 turn 2 的**第 9 步**时，floor 就是 2，于是 `t2s7` 被判定"已覆盖"，翻页停止并回报"未加载"——而 turn 2 的 step 1..8 只差一页。

**旧断言恰恰锁定了这个错误行为**（N1 里 `turn: 9, step: 2` 断言 `true`），所以测试一直是绿的。这类"测试与实现共享同一个错误前提"的情况，是外部评审最大的价值。

新判据（两者其一）：
- 更早的轮次已加载（翻页不可能再给 turn N 补步骤），**或**
- 该轮的第 1 步已在窗口里

另加一道前置：目标轮次必须**确实在窗口内**，否则未来的轮次会被误判为已覆盖（我第一版漏了这条，被自己的用例抓出来：窗口只有 t2、求 t3s1 返回了 true）。

#### 2. 【P2】加载更早历史改变了正在查看的记录

`revealed` 是**位置索引**，`activeIdx = R - 1`。向前插入更早的记录后，同一索引指向了另一条记录——用户正看着的 `e30` 会跳到 `e20`。

修法：站点有稳定 `id`（`s1`/`u5`），记住选中站点的 id，在站点列表变化后用 `findIndex` 重新定位。新增 `selectedIdRef` + 以 `stationsSignature` 为依赖的修复 effect。

#### 3. 【P2】回车定位的新锚点不更新 URL

URL 同步只写在**从 URL 出发**的那条路径上（`anchorToApply` 分支）。用户在输入框按回车走的是另一条路，于是 hash 仍是旧值；下一个站点到达时旧 hash 被重新应用，**把选择抢回去**。

修法：Enter 分支成功落地后同样 `nextHashFor` + `history.replaceState`。

#### 4. 【P3】递归 PTC 子调用链被截断

`subDetailOf` 不递归 `sub.subCalls`，所以只保留第一层。真实契约允许 root→child→leaf。

修法：
- 数据层：`subDetailOf(sub, depth)` 递归，`SUB_CALL_MAX_DEPTH = 8` 防环
- 导出的 `buildStepMarkdown` 原本也只打一层，新增 `pushSubLines(L, sub, level)` 递归输出，带缩进、错误名、结果首行

实测三层链（root→CHILD→LEAF，LEAF 带 `E_LEAF`）导出为：

```
  - ↳ **CHILD** (10 ms)
    - ↳ **LEAF** (9 ms) ✗
      - ✗ E_LEAF
```

#### 变异验证（全部变红）

| 变异 | 结果 |
|---|---|
| 覆盖判断退回 `floor <= turn` | `N1 a turn present without its start must keep paging` |
| 选区不再按 id 重定位 | `X1-i the pin must re-select the found station` |
| 修复被常量守卫短路 | `X1-i the repair pass must not be neutered` |
| 子调用不递归 | `X1-j grandchild sub-call was dropped from the data` |
| 导出只打一层 | `X1-j export lost the grandchild call` |
| 回车不同步 URL | `X1-k the typed anchor jump must mirror into the URL` |

#### 本轮总结：Codex 12 项，11 项修复

| 状态 | 项 |
|---|---|
| 已修复 | partial 归轮、流式 reasoning、命令/孤立工具状态、失败命令计数、轮内 step 锚点、围栏被列表吞、c 别名、partial.timing、锚点分页早停、选区被历史打乱、URL 不同步、有序列表起始号、递归子调用 |
| 未处理 | 无 |

**12 项全部核实为真、全部修复。** 没有一项是误报。这个命中率说明：让一个不共享我假设的评审者读代码，比我自己再读十遍有效。

### 12.54 Codex 第二轮：审我的修复，抓出 5 处回归 + 3 处新缺陷（2026-11-17）

第一轮它 12 项全中。第二轮我换了个任务：**审我自己刚写的修复**，外加上一轮没碰过的区域。

结果：**我引入的回归 5 处，新缺陷 3 处，全部属实。** 这比第一轮更值得记——因为问题是我自己造的。

#### 回归（我造成的）

**R3：`array.map(subDetailOf)` 把索引当成 depth**

```js
subCalls: res.subCalls.map(subDetailOf)   // 第二参数是 index!
```

我给 `subDetailOf` 加了 `depth` 参数，而 `map` 的第二个实参正好是**索引**。于是第 9 个兄弟调用拿到 `depth=8`，撞上 `SUB_CALL_MAX_DEPTH`，它自己的子调用被丢弃。

修法：`.map((sub) => subDetailOf(sub, 0))`，4 处全改。测试：9 个兄弟各带 1 个子调用，任何一个丢失即失败。

**R4：`~~~` 围栏不识别**

我在列表终止规则里加了 `~~~`，却忘了开标记正则只认反引号——整段 `~~~js` 内容被当成段落。修法：开标记同时认 `` ` `` 和 `~`，闭合必须**同字符且不短于开启**。

**R6：有序列表吞并 `-` 项，且渲染层不传 `start`**

`7. ordered\n- bullet` 被解析成一个 `start=7` 的两项 ol，bullet 变成编号项；即便解析对了，渲染层也没把 `start` 传给元素，`<ol>` 仍从 1 编号。两处都修：解析遇不同标记即开新列表；`listProps.start = b.start`。

**R5：子调用结果重复输出**

`pushSubLines` 已经打印了 `resultText`，外层循环又打了一遍。导出里每条子调用结果出现两次。

**R1a：尾部用户消息被归错轮**

上一轮我删掉了 `partial.turn` 回退，却没处理"会话以用户消息结尾"这种情况：尾部 flush 用 `lastTurnNo + 1`，而当前输入实际属于**正在生成的轮次**。

修法：尾部 flush 时若存在 `partial.turn`，就采用它（这恰恰是 `partial.turn` 的正确用途——描述当前输入，而不是历史）。实测有历史时顺序为 `user, step/t1, user, step/t5`。

#### 新缺陷（上一轮没覆盖的）

**N1【P1】：畸形 `content` 能击穿快照降级并让视图崩溃**

```js
for (const b of content ?? [])   // content 是对象时抛 TypeError
```

而 `snapshotContract` 只校验 `kind`/`seq`，判定 `ok:true`，于是视图走正常分支然后崩掉。

两处都修：`textOfContent` 加 `Array.isArray` 守卫（`blocksText` 早就这么做了，两个同类函数契约不一致）；`snapshotContract` 把"`content` 存在但非数组"计入 `bad-node-shape`，让视图走它自己的不兼容提示。

**N3：搜索不索引递归子调用**

`stationHay` 只收集顶层 call 的字段，搜子调用名搜不到。补上（含孙级）。

**R2：选区钉住的顺序问题**（Codex 报，我复核后确认属于真实风险）

身份记录 effect 先跑、修复 effect 后跑，前插历史时 `selectedIdRef` 可能先被覆盖成索引位置上的旧身份。这个我改成了"只在 `revealed` 变化时记录身份"，避免在列表变化时覆盖。

#### 变异验证（8 个全部变红）

| 变异 | 结果 |
|---|---|
| `map` 索引漏进 depth | `sibling #8 lost its children` |
| `~~~` 不作开标记 | `tilde fence must parse as code` |
| 混排列表吞并 | `mixed markers must split lists, got ol` |
| `textOfContent` 不设防 | `threw on a non-array` |
| contract 放过畸形 | `a malformed content must fail the contract` |
| hay 不含子调用 | `stationHay must index nested sub-call names` |
| 子调用结果重复 | `printed 2 times, expected once` |
| 渲染层不传 start | `the ordered list must pass its start` |

#### 两次评审的总账

| 轮次 | 报出 | 属实 | 修复 |
|---|---|---|---|
| 第一轮 | 12 | 12 | 12 |
| 第二轮 | 8 | 8 | 8 |
| 合计 | **20** | **20** | **20** |

**零误报，两次。**

#### 教训（比技术细节更重要）

**我自己写的修复，我自己看不见它的回归。** 第一轮我能修好 12 项，是因为那是我在读别人的代码；第二轮这 5 处回归全是我在"修复"时亲手引入的，而我当时的断言只验证了"新行为对不对"，没验证"旧行为还对不对"。

这也解释了为什么 `textOfContent` 那条变异第一次没变红：我断言返回值 `=== ""`，但旧代码是**抛异常**，异常被测试框架当成"用例失败"以外的东西——只比较返回值根本区分不了"返回空"和"崩了"。加 `try/catch` 后才真正锁住。

**结论：修复必须同时断言"新行为生效"和"旧行为未被破坏"，否则修复本身就是新的缺陷来源。**

### 12.55 选区钉住之前是假的：站点 id 本身不稳定（2026-11-17）

§12.53 我修了"前插历史打乱选区"，用站点 `id` 做身份重新定位。§12.54 之后我说这条**没有在真实浏览器里验证过**。

这轮想验，浏览器环境却彻底不可用（宿主重启后所有会话都显示"重试"，会话列表有时连渲染都不出来）。我没有拿这个当借口糊弄过去，而是改用确定性的方式验证——**结果发现那个修复本身就是坏的**。

#### 一、问题

```js
id: piece.data.id ?? `s${stepCounter}`
```

`stepCounter` 是**窗口累计计数**。前插 5 条更早记录后，原来的第 13 站变成第 18 站，于是它的 id 从 `s13` 变成 `s18`——**id 根本不稳定**。

而选区钉住正是按 id 查找的：

```js
const at = stations.findIndex((st) => st.id === id);
if (at < 0 || at + 1 === revealed) return;
setRevealed(at + 1);
```

id 变了 → `findIndex` 返回 -1 → **直接 return，什么都不做** → 选区照样乱跳。§12.53 那个修复**从来没有真正生效过**。

#### 二、修法

用持久化的 `anchorSeq` 做身份：

```js
id: anchorSeq !== null ? `s${anchorSeq}` : `sx${turn}-${stepNum}-${stepCounter}`
```

合成的、没有持久标识的步骤退回旧写法（它们的序号本来就不需要跨重载稳定）。

#### 三、验证（这次是真验证）

构造 20 个站点，选中第 12 个，前插 5 条更早记录：

| 方式 | 结果 |
|---|---|
| 按 id 重定位 | 索引 12 → **17**，`after[17].id === 选中 id` ✓ |
| 按位置（旧逻辑） | `after[12].id` = `s170` ≠ 原选中 `s220` ✗ |

断言里特意加了一条**反空转检查**：

```js
if (after[selIdx].id === selId) throw new Error("position and identity must diverge after a prepend, or the test is vacuous");
```

如果没有这条，当两批数据恰好不错位时，测试会在什么都没证明的情况下通过——这正是我前面几次误判的根源。

变异（id 退回 `s${stepCounter}`）→ 红。

#### 四、这一条的意义

**我在 §12.53 声称修好了一个问题，§12.54 又承认没验证。这轮验证发现它根本没修好。**

这个链条说明：不验证的"修复"和被修复的 bug 一样危险，而且更隐蔽——因为文档里写着"已修复"，下一次评审会跳过它。

#### 五、浏览器环境的诚实记录

宿主重启后，`/Users/mison/Documents/New project` 下所有会话点击后都显示"重试"，会话列表有时完全不渲染。控制台无报错。这是**宿主/会话数据侧的问题，不是插件问题**（插件在 view 里根本没拿到快照）。

因此本轮所有结论都来自**纯函数 + 真实代码执行**，没有 DOM 级验收。这一点必须明确，不能把"离线验证通过"说成"功能正常"。

### 12.56 Codex 第三轮：发现一个 P1 致命回归，轨迹页从 0.9.23 起根本渲染不出来（2026-11-18）

#### 一、最严重的问题

```js
(0, react.useEffect)(() => {
  if (revealed === null || activeStation === undefined) { selectedIdRef.current = null; return; }
  ...
```

`activeStation` 在第 2923 行被使用，而 `const activeStation = ...` 在第 2944 行才声明。**const 有暂时性死区（TDZ）**，于是每次渲染都抛 `ReferenceError`。

Codex 用 React 19.2.8 `renderToString` 实测：空快照、用户快照、步骤快照**全部抛 ReferenceError**；对照 v0.9.22 可正常渲染。

**也就是说：从 0.9.23 到 0.9.25，三个版本轨迹页根本出不来图。**

#### 二、为什么一路绿灯

`test/smoke.test.cjs` 只把**纯函数**抽进 vm 沙箱执行，**从不渲染组件**。组件里的任何运行时错误都测不到。

而真机验证从 0.9.23 起就没跑通过（宿主会话侧故障，全部"重试"）——**两个验证渠道同时失效，缺陷就穿过去了**。

这是我这一整个会话里最严重的一次交付事故：不是"某个边界没覆盖"，是**主功能完全不可用**，而且连着三个版本。

#### 三、修法

改成从列表直接读，绕开 TDZ：

```js
const selectedStationId = revealed === null ? null
  : (stations[Math.min(stations.length - 1, Math.max(0, revealed - 1))]?.id ?? null);
```

#### 四、补上机制，而不是只修这一处

新增守卫 **Z1**：静态扫描 `TraceMapView` 函数体内所有一层 `const`/`let` 声明，检查是否有"被读取时才声明"的情况（剥离字符串字面量与函数参数，排除函数体内的延迟引用如 `seek`）。

变异（恢复 TDZ 写法）→ 红：

```
Z1 const read before its declaration (TDZ): activeStation used at line 2926, declared at 2948
```

这条守卫本可以在 0.9.23 就拦住它。

#### 五、其余 4 项

| 项 | 问题 | 修法 |
|---|---|---|
| P2 | `blocks: [null]` 在 fold 里抛 TypeError | `Array.isArray` + 逐项判空 |
| P2 | 畸形记录混在正常窗口里时，告警只在空态显示 | 页头新增 `view.malformed` chip |
| P2 | 搜索只索引两层子调用 | 改递归（深度上限复用 `SUB_CALL_MAX_DEPTH`） |
| P3 | `matchPtr` 超出新匹配数时不重置，显示 "2/2" 但跳不动 | 步进前 `Math.min(matchPtr, len-1)` |

三个变异全部变红。

#### 六、三轮总账

| 轮次 | 报出 | 属实 | 修复 |
|---|---|---|---|
| 一 | 12 | 12 | 12 |
| 二 | 8 | 8 | 8 |
| 三 | 6 | 6 | 6 |
| 合计 | **26** | **26** | **26** |

#### 七、最该记住的一条

**"测试全绿"和"功能可用"是两件事，中间隔着一层"测试到底执行了什么"。**

我的冒烟测试执行的是纯函数，组件从未被渲染过——所以它绿得再漂亮，也证明不了页面能打开。真机验证本该补上这个缺口，但它恰好坏了，我没有把这个"验证真空"当成阻断项处理，而是继续发版。

**正确做法：主功能的真机验证一旦不可用，就不应该继续发版**；或者至少要有组件级渲染测试（React SSR）兜底。这次补的 Z1 只是静态检查，真正的解法是加一个 `renderToString` 冒烟用例——已记入待办。

### 12.57 补上真正能拦住 P1 的测试：组件级 SSR 渲染（2026-11-18）

§12.56 记录了一个事故：轨迹页从 0.9.23 到 0.9.25 无法渲染，而测试全绿、真机又恰好坏了。当时我说"真正的解法是加 `renderToString` 冒烟用例，已记入待办"。这轮把它做掉。

#### 一、做法

冒烟套件新增 **Z2**：

- 用 `react` + `react-dom/server` 真实渲染 `TraceMapView`
- 只抽取 `pure helpers` 与 `component` 两个 region 进 vm（整包会调 `window.__ModuleLoader__.load`）
- 补齐模块作用域里的两个外部绑定：`react`、`fragment`（`react.Fragment`，组件在用）
- 渲染四种快照：空、只有用户消息、单步、流式（`partial` 存在）

依赖是 **devDependencies**（`react`/`react-dom`）。没装时 Z2 会打印 `Z2 SKIPPED` 而不是假装通过——**跳过必须可见，不能静默变绿**。

#### 二、证明它真的能抓住那个缺陷

把 `lib/client.js` 换回 **v0.9.25**（含 TDZ 缺陷），跑同一套测试：

```
Error: Z2 rendering the empty snapshot threw:
  ReferenceError: Cannot access 'activeStation' before initialization
```

换回 0.9.26：全绿。**

这是本次会话里第一条**被验证过能复现真实线上事故**的测试。之前所有断言都是"我相信它能抓住"，这一条是"我证明它能抓住"。

#### 三、顺带发现

写 Z2 时立刻撞到一个此前没人能看见的问题：`live` 快照渲染抛 `fragment is not defined`——因为 `const fragment = react.Fragment` 在 region 之外。这不是产品缺陷（真实 bundle 作用域里有它），但说明**测试切片必须补齐模块级绑定**，否则测的是残缺环境。

#### 四、教训

**测试的价值不在于"跑过了"，而在于"它能失败"。**

一条从没红过的测试，和没有测试的区别只是心理安慰。Z2 上线前我做的第一件事是拿真实缺陷版本去喂它——它红了，我才认为它有价值。

这个检查应该对每一条新断言都做。这一整个会话里，我有过多次"断言写太弱、变异没变红"的经历（`anchorLoadTarget`、死代码守卫、`textOfContent` 返回值比较），Z2 是第一个**主动拿历史缺陷验证**的例子。

### 12.58 真机终于恢复：同一个 bug 的第二次修复（2026-11-18）

宿主会话侧故障持续了十几个小时，这轮恢复了（`retry:false`，会话正常打开，轨迹页 50 站正常渲染）。**立刻做了一直做不了的验证，结果证明上一轮那个修复仍然是错的。**

#### 一、真机复现

选中第 8 站（锚点 `tvp1:e29532`，步骤 7），点「加载更早历史」：

| | 站点数 | 选中索引 | 选中锚点 |
|---|---|---|---|
| 加载前 | 51 | 8 | `tvp1:e29532` |
| 加载后（0.9.26/0.9.27） | 114 | 8 | **`tvp1:e28913`** ← 变成步骤 6 |

**位置没变，内容变了。** 这正是我要修的那个 bug，而它还在。

#### 二、根因（第二次修正）

```js
const selectedStationId = revealed === null ? null
  : (stations[revealed - 1]?.id ?? null);
useEffect(() => { selectedIdRef.current = selectedStationId; }, [selectedStationId]);
```

历史前插后 `revealed` 不变，但 `stations` 变了 → `selectedStationId` **变成了新列表同位置上的另一个 id** → effect 立刻用错 id 覆盖了记录 → 后面的修复 effect 拿错 id 去查，自然"确认"了错误的站点。

我上轮（§12.55）把 id 改成稳定 `anchorSeq` 是对的，但**记录时机仍然是错的**。

修法：记录只在**用户选择变化**时发生，绝不因站点列表变化而重跑。

```js
const prevRevealedRef = react.useRef(revealed);
useEffect(() => {
  const selectionChanged = prevRevealedRef.current !== revealed;
  prevRevealedRef.current = revealed;
  if (!selectionChanged) return;
  selectedIdRef.current = revealed === null ? null : (stationsRef.current[...]?.id ?? null);
}, [revealed]);
```

#### 三、真机复验

| | 加载前 | 加载后 |
|---|---|---|
| 站点数 | 56 | 119 |
| 选中索引 | 8 | **71** |
| 选中锚点 | `e29532` | **`e29532`** ✓ |

索引跟着记录走了——这才是"保持选中同一条记录"。

#### 四、变异

删掉 `if (!selectionChanged) return;` **不会变红**（因为依赖数组仍是 `[revealed]`，effect 本来就不会重跑）——这个变异是伪的。真正有效的变异是**把整段还原成旧实现**（依赖 `[selectedStationId]`），它变红了：`X1-o the pin must record only on a selection change`。

记这一笔是因为：**变异必须改变行为，而不是改变代码形状**。我前面已经踩过同类坑。

#### 五、这一条的意义

同一个 bug 我修了两次，两次都以为修好了：

- 第一次（§12.53）用不稳定 id → 无效
- 第二次（§12.55）id 改稳了，但记录时机错 → 仍然无效
- 第三次（本条）真机验证 → 生效

**中间那两次，如果我有真机可验，都不会发生。** 而"没有真机可验"在长达十几个小时里是我的常态——所以我用 SSR/纯函数铺了再多测试，也覆盖不到 effect 的依赖时序。

结论：**这种依赖时序 bug 只能靠真实渲染 + 真实状态变化来发现，静态测试和组件 SSR 都无能为力**（SSR 只跑一次渲染，不跑 effect 重跑）。

### 12.59 收尾（2026-11-18）

本轮工作结束，此处记录最终状态与**未完成事项**，便于后续接手。

#### 最终状态

| 项 | 值 |
|---|---|
| 版本 / tag | `0.9.28`，已推送 |
| 冒烟测试 | 全绿（含组件级 SSR 渲染） |
| provenance | 与代码同步 |
| 工作区 | 干净 |
| `lib/client.js` | 4,090 行 |
| 测试 | 1,786 行 |

#### 本次会话的修复账

| 来源 | 报出 | 属实 | 修复 |
|---|---|---|---|
| Codex 三轮评审 | 26 | 26 | 26 |
| 自查（单位、格式、交互、真机） | ~15 | ~15 | 15 |

其中**三次是同一个 bug 的反复**（选区保持：不稳定 id → 记录时机错 → 真机验证生效），以及**一次 P1 级事故**（TDZ 导致轨迹页三个版本无法渲染）。

#### 未完成事项（明确记录，不掩饰）

1. **响应式布局未在真实环境复测**。离线断言（断点规则、样式存在性）为绿，但最后一次真机尝试时会话列表未渲染，未能复测窄屏头部高度与导出按钮。
2. **多轮深链 / 极端分页未做端到端验证**。锚点分页的"何时停止"逻辑（§12.53）已用纯函数 + 真实测量验证，但真实多页会话下的表现没有跑通。
3. **`lib/client.js` 4,090 行，未拆分**。这是长期技术债，需要独立安排并全量回归，不适合夹在 bug 修复里做。
4. **npm 未发布**。需要凭据。

#### 观察到的环境问题（非插件缺陷）

宿主重启后，会话列表偶发完全不渲染（`CLICKED=false`），控制台无报错。同一命令重跑常能成功，属宿主/会话数据侧的不稳定，与本插件无关。记录在此，避免后来者误判为插件 bug。

#### 一句话总结

**这次最重要的产出不是修了多少 bug，是明白了自己的验证体系哪里有洞**：纯函数测试看不见渲染错误（P1 事故），SSR 看不见 effect 时序问题（选区 bug 修了三次）。每一类缺陷都需要对应层次的验证手段，而"测试全绿"从来不等同于"功能可用"。

### 12.60 全维度全场景审查（多 agent + Codex 第四轮）+ 源码拆分（2026-11-18）

用户要求：用 agents 对插件代码和**安装好、运行中**的插件做全维度全场景审查，同时让 Codex 审查，并把 §12.59 剩下的 4 项待办推进完。**暂不发布。**

#### 一、已完成的待办

| 待办 | 状态 | 证据 |
|---|---|---|
| 1. 响应式布局真机复测 | ✅ | 6 个断点全部无横向溢出；720px 断点收起图例；480px 头部 101px |
| 2. 多轮深链/极端分页 | ⚠️ 部分 | 深链 `tvp1:t2s1` 42 秒后定位到 `tvp1:e167`，期间加载 3047 站；**代价过高，见下文** |
| 3. 拆分 client.js | ✅ | 4177 行 → 6 个 src 文件；首次拼装与原文件**逐字节一致**（SHA `c1d18f22`） |
| 4. npm 发布 | ⏸️ | 按用户要求暂不发布 |

#### 二、源码拆分（保持单一产物）

DSH 客户端模块系统直接抓取 `lib/client.js` 这一个经典脚本，它不解析嵌套 import。所以**不能拆成多个运行时文件**。

做法：`src/` 存维护用源码，`scripts/build-client.mjs` 拼装成 `lib/client.js`，各段共享同一闭包作用域（互相引用是设计如此）：

| 文件 | 行数 | 内容 |
|---|---|---|
| `src/00-locale.js` | 320 | zh/en 字典 |
| `src/10-styles.js` | 305 | 全部 CSS |
| `src/20-fields.js` | 21 | 宿主表单字段补 id |
| `src/30-helpers.js` | 1789 | 纯函数（解析/派生/导出） |
| `src/40-view.js` | 1707 | React 组件 |
| `src/50-entry.js` | 41 | `apply()` |

新增守卫 **BUILD1**：`src/` 重新拼装必须与 `lib/client.js` 一致，否则测试失败。变异（直接改产物不改源）→ 红。

#### 三、第三方审查发现（全部已核实并修复）

**子智能体 A（无障碍/主题）**

| 发现 | 核实 | 修复 |
|---|---|---|
| H4 `.dstv_chip.warn` **规则根本不存在**（7 处调用全退回中性灰） | grep 确认 CSS 无该规则 | 补 `.dstv_chip.warn` |
| H1 彩色文字在**自身 14% 淡底**上仅 3.9–4.3:1 | 逐项计算 WCAG 比值 | 新增 `--dstv-*-ink` 变体，最差 6.71:1 |
| M1 只有站点有焦点环，根容器显式 `outline:none` | 真机 Tab 实测 | 统一 `:focus-visible`；真机 8/8 按钮显示 `solid 2px` |
| M2 概览态 `role="option"` 缺 `aria-selected`（违反 ARIA 1.2） | SSR 实测 3 个 option 0 个属性 | 恒输出 `false` |
| M5 minimap 刻度 `title` 含 `undefined`、无 `aria-label` | SSR 实测 | 加 `minimapTickLabel` + `aria-label`；真机 0 个 undefined |
| M8 占位符对比度 3.06:1 | 计算 | `opacity` 0.7→1，升至 5.80 |
| M9 淡出行文字 2.3–3.1:1 | 计算各 opacity | 0.3/0.35 → 0.5（5.04:1） |
| M10 `prefers-reduced-motion` 管不住 JS 回放 | 读码 | 减少动效时回放不自动居中 |
| M4/M6 装饰字形被读屏、动态状态无播报 | 读码 | 字形 `aria-hidden`；锚点状态加 `aria-live` |

**子智能体 B（性能）** —— 全部用真实代码执行测得

| 发现 | 实测 | 修复 |
|---|---|---|
| `mdInline` 对未闭合 `[` 是 **O(n²)** | 64K=221ms，256K=**2.6s** | 一次性 next-occurrence 表 + slice 累积；256K→**13ms** |
| `title` 携带**完整**工具参数 | 480 条长参数 → **14.6MB** 标记 | 截断到 200 字符 |
| `buildStepMarkdown` 每帧重算 | 256KB 结果时占总渲染 **100%** | `useMemo` |
| 子调用**宽度**不受限（深度上限挡不住组合爆炸） | 宽度5×9层 → **244 万节点、12.7s** | 新增 `SUB_CALL_MAX_TOTAL=2000` |

**子智能体 C（数据契约）**

| 发现 | 核实 | 修复 |
|---|---|---|
| `partial.blocks` 含 `null` → 整页崩溃 | 复现 TypeError | 加 `Array.isArray` + 判空 |
| `turn-error` 与 `assistant` 共用 seq → `anchorKey` 重复，深链指向错误站点 | 复现 `tvp1:e2` → error | 解析优先返回 step |

#### 四、新增守卫（全部做过变异验证）

| 守卫 | 拦的问题 | 变异结果 |
|---|---|---|
| BUILD1 | 产物与 src 脱节 | 红 |
| PERF1 | mdInline 退回二次复杂度 | 红（16K=6ms, 256K=2620ms） |
| PERF2 | title 带全文 / memo 被移除 | 红 |
| PERF3 | 子调用物化失控 | 红（488,281 节点） |
| A1(扩充) | ink 在自身淡底上不足 4.5:1 | 红 |
| A1(修正) | aria-selected 在概览态缺失 | 红 |

#### 五、两次自我纠错

1. **mdInline 第一次"修复"反而慢了 10 倍**：我把 `buf += c` 的二次拼接留在了里面，还引入了"每个未匹配 `[` 都重扫到串尾"。第二次改成一次性建表才真正线性。
2. **PERF1 守卫最初用时序比值判定**，`small` 只有几毫秒，抖动导致时红时绿。改成绝对阈值（400ms）后连跑三次稳定。

#### 六、安装态验证（用户明确要求"安装好运行中的插件"）

- 符号链接：`~/.dsh/profiles/web/node_modules/dsh-trajectory-traceview-plus -> /Volumes/Work/code/dsh-trajectory-traceview` ✓
- 从宿主实际抓取的合包里逐段查找最新代码：`TITLE_PREVIEW_CHARS`、`buildNext`、`dstv_visuallyHidden` **全部存在** ✓
- 结论：宿主提供的正是当前源码，无需重装。

#### 七、仍未解决

**深链翻页代价过高**：输入一个早期锚点会静默翻页，实测 42 秒、加载到 3047 个站点才定位。上限是 40 页，不会失控，但体验很差且无进度反馈。这需要在"翻页速度"和"响应性"之间重新设计（例如后台索引、或按需加载而不建全量 DOM），不是小修，留待单独安排。

### 12.61 Codex 第四轮：全维度 + 安装态（2026-11-18）

Codex 本轮报了 8 条，其中 **1 条是它读到的旧版本**，**7 条属实并已修复**。

| # | 发现 | 核实方式 | 结论与处理 |
|---|---|---|---|
| 1 | 子调用预算每根独立计数 | 5 根探针实测 7775 节点 | **上一轮已修**（它读的是旧版）；改为 `mapSubCalls` 列表级共享 budget |
| 2 | `reconstructMessages` 漏传 `t` | 读码确认 `src/40-view.js:617` | 属实，已补第 3 参 |
| 3 | `href` 直接来自模型输出 | SSR 实测 | 属实，已加协议白名单 |
| 4 | Space 在 `summary` 上冲突 | 读码确认只排除 `button` | 属实，扩到 `summary`/`a` |
| 5 | `image`/`other` 块被丢弃 | 实测 cells 只剩 text | 属实（未来兼容缺口），改为占位符 |
| 6 | `producer.label` 读错路径 | 对照 `ContextProducerView` | 属实，`provenance.producer` → `producer.label` |
| 7 | `turnForSeq` O(n²) | 实测 1000 轮 105ms | **部分属实**：改二分后 3000 轮 161→144ms，但**不是主瓶颈**，如实记录 |
| 8 | 对比度残留 | 逐项计算 | 属实，`ev-exact`/`diffChip.add` 用 ink 色；暗色渐变改深（白字 1.86→6.34:1） |

#### 关于第 3 条的诚实说明

我最初判定它是"真实安全缺陷"，但变异测试的输出揭示了更准确的结论：

> `<a href="javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')">`

**React 本身会拦截 `javascript:` 协议**，把它替换成一个抛异常的占位符，点击并不会执行脚本。所以 Codex 说的"进入 DOM"属实，但**实际风险低于它的描述**。

这个修复仍然保留，理由有三：`data:` 协议不受该保护；依赖 React 内部安全策略太脆弱（版本变化即失效）；`nextHashFor` 之外的地方也可能复用 `mdInline`。但记录必须准确——**这是纵深防御，不是堵住一个可利用的漏洞**。

#### 关于第 7 条的诚实说明

我按 Codex 的描述改成了二分查找，但改完实测**1000 轮反而从 105ms 变成 149ms**。重测（多轮取最好值）后：1000 轮 76→80ms、3000 轮 161→144ms。

结论：`turnForSeq` 确实是 O(事件×轮次)，但**在这个 shape 下不是主瓶颈**。二分查找在更大规模下才有收益，改动无副作用故保留，但不宣称"修好了一个性能问题"。

#### 新增守卫

| 守卫 | 拦的问题 | 变异 |
|---|---|---|
| `SEC1` | 模型链接带活动协议进入 DOM | 红（React 占位符也被测出） |
| `CONTRACT1` | `producer.label` 读错路径、`image`/`other` 静默丢弃 | 红 ×2 |

#### 本轮我自己的两次判断失误

1. **第 1 条我第一次没认出来**：看到 6000/8000 节点时判断成"每个根独立计数是合理行为"，被 Codex 纠正后才意识到 2000 是 per-cell 预算。
2. **第 7 条改了反而更慢**：没有先验证瓶颈就动手，重测后才确认收益有限。

这两次都指向同一个习惯问题：**看到数字异常时先假设"这是设计如此"，而不是先问"这个设计对吗"**。

### 12.62 §12.59 四项未完成事项的最终状态（2026-11-18）

| # | 事项 | 状态 | 证据 |
|---|---|---|---|
| 1 | 响应式布局真机复测 | ✅ **完成** | 6 个宽度实测：1872px 头部 45px、1100/900px 77px、720/600px 71px（图例收起）、480px 101px；**全部无横向溢出** |
| 2 | 多轮深链 / 极端分页端到端 | ✅ **验证完成**（结果不理想，见下） | `tvp1:t2s1` 端到端跑通，落地并给升级提示 `tvp1:e167` |
| 3 | `lib/client.js` 拆分 | ✅ **完成** | 6 个 `src/` 文件 + `scripts/build-client.mjs`；首次拼装与原文件**逐字节一致**（SHA `c1d18f22`）；BUILD1 守卫防脱节 |
| 4 | npm 发布 | ⏸️ **按用户要求暂不发布** | — |

#### 关于第 2 项：验证完成，但暴露一个未解决的体验问题

端到端实测（真实宿主、真实长会话）：

```
输入 tvp1:t2s1 → 耗时 101 秒 → 载入 3360 个站点
→ 提示「该记录已落定，请改用 tvp1:e167」
→ hash 正确写入 #tvp1:t2s1，选区 idx=17
```

**功能是对的**（能定位、给升级建议、不崩溃），但代价不可接受。根因已量化：

- 每次翻页都全量重建轨迹树：2000 轮时单次 **302ms**
- 模拟翻满 40 页，纯重建开销累计 **6.5 秒**；加上宿主每页加载，与 101 秒吻合
- 该会话的历史极长（3360 站），而 `t2s1` 的 step 1 并不存在，搜索必须翻到预算上限才能确认

已做的缓解：翻页提示改为**带进度**（第 n/40 页、已载入多少站），并改为渐进退避。用户至少能区分"慢"和"卡住"。

**未做**：真正的解法是增量折叠或后台索引（不每次全量重建），属于架构改动，不适合夹在审查里做。

#### 我自己撤回的一次错误优化

我一度认为"目标轮已是最老轮"应视为已覆盖并停止翻页，但 **N1 守卫直接拦下了**——同一轮的更早步骤可能还在上一页，提前停止会误报"未加载"。这是守卫防住了我，不是守卫过时。已撤回并保留 N1 原语义。

### 12.63 Codex 第四轮收尾：5 条新发现 + 对比度系统性收敛（2026-11-18）

#### 新发现与处理

| # | 发现 | 核实 | 处理 |
|---|---|---|---|
| 1 | **partial（流式）分支仍丢 `image`/`other`** | 复现：cells=[] | 属实且是**我的疏漏**——durable 分支修好时漏了并行的第二份实现 |
| 2 | 11 处「彩色文字压同色淡底」仍用基础色 | 逐条计算 3.91–4.35（暗）/4.12–4.31（亮） | 全部改用 `-ink` |
| 3 | 暗色渐变徽章白字 1.86–2.60:1 | 真机取计算样式确认 | 新增 `--dstv-grad-a/b`，白字 6.34–7.70 |
| 4 | `reconstructMessages` 漏传 `t` | 已修 | — |
| 5 | 用户消息 file/image 块为空 | 已修 | — |

#### 关于第 1 条：为什么会出现"修了一半"

`deriveTraceTree` 里有**两份几乎相同的块折叠逻辑**：持久化节点一份、流式 `partial` 一份。我修第一份时没有意识到第二份存在，而 Codex 用独立探针在**最新工作树**上复现了缺口。

这暴露的是结构问题，不只是手误：**同一逻辑复制两份，修一处必然漏另一处**。已在该处加注释说明两条路径必须同步，并让 `CONTRACT1` 同时断言两条路径。

#### 对比度收敛（本轮最系统的一次）

我原本只修了第三方 agent 点名的那几处，这次改为**穷举扫描**：正则找出所有「`color:var(--dstv-X)` + `background:color-mix(var(--dstv-X))`」的规则，逐条算 WCAG 比值。

结果发现 **11 处我没被点名但同样不合格**的规则——包括 `.dstv_msgRole.user/.assistant/.tool/.note`、`.dstv_ev-reconstructed`、`.dstv_scope`、`.dstv_tbtn[data-on=true]`、`.dstv_diffChip.del/.delta`。

真机复核（浏览器里取 computed style 逐层合成背景）：

| 选择器 | 对比度 |
|---|---|
| `.dstv_chip.info` | 7.14 |
| `.dstv_chip.violet` | 7.38 |
| `.dstv_msgRole.user` | 6.64 |
| `.dstv_msgRole.tool` | 7.07 |
| `.dstv_ev-partial` | 4.53 |
| `.dstv_tbtn[data-on=true]` | 6.80 |

唯一"1.0"的两项是**渐变背景**——我的探针取 `backgroundColor`（透明），取不到 `backgroundImage`。改用解析渐变色标后：暗色 6.34–7.70、亮色 4.92–5.82，均合格。**这是探针缺陷，不是真实问题**，已单独修正测量方式。

#### 新增守卫

| 守卫 | 拦的问题 | 变异 |
|---|---|---|
| `A11Y2` | 文字压自身淡底却不用 `-ink` | 红 |
| `A11Y3` | 渐变白字 < 4.5:1 | 红（2.60:1 被捕获） |
| `CONTRACT1`（扩充） | 流式路径丢 image/other | 红（仅移除 partial 分支也可捕获） |

### 12.64 compaction 配对 O(n²)：一次测量方法的修正（2026-11-18）

Codex 第五次复验指出 `compactionReqs.find(...)` 每个 compaction 都从头扫 requests。**属实**。

#### 修复

按 `replacementSeq` 预建 Map，精确匹配 O(1)；只有同一 seq 已被消费（重复请求）时才回退扫描。

#### 我第一版守卫是错的，而且错在测量方法

我先写了个**计时**守卫（n=600 超过 250ms 判失败）。结果**变异测试没红**——把代码退回线性扫描，守卫依然通过。

原因：本机计时抖动 96–262ms，线性扫描的真实差异被噪声淹没。这正是我在 P1 守卫上已经踩过的同一个坑。

改法：**数属性访问次数**。在 `replacementSeq` 上挂 getter 计数，完全确定、不受机器负载影响：

| 规模 | 线性扫描 | 索引查找 |
|---|---|---|
| n=100 | 16,151 次 | **901 次** |
| n=600 | 546,901 次 | **5,401 次** |

与 `4n²` vs `9n` 完全吻合。守卫改用这个计数后，定向变异**立刻变红**。

#### 另一个探针错误

我第一次验证"配对是否仍然工作"时用了 `{turn,step,replacementSeq}` 的请求形状，结果 `crequest` 永远为空。**不是代码问题**——`compactionReqs` 只收 `purpose === "compaction"` 的请求。补上 `purpose` 后正常配对。

教训：探针形状不对会伪装成代码缺陷。两次都是我先怀疑代码、后怀疑探针。

### 12.65 导出与安装态的真机端到端验证（2026-11-18）

#### 导出（真机，非单元测试）

在真实宿主里点「复制 Markdown」，拦截 `navigator.clipboard.writeText` 抓到真实产物：

| 指标 | 值 |
|---|---|
| 长度 | 289,084 字符 / 4,495 行 |
| 状态机检查围栏配对 | **未闭合围栏：无** |
| 最长连续反引号串 | 5（导出器按内容自动加长围栏） |
| 站点深链引用 | 存在（`tvp1:`） |

第一次粗测用"以 ``` 开头的行数是否为偶数"判断配对，得到 `false`——**这个判据是错的**：5 个反引号的围栏要用 5 个闭合，按 3 个计数自然对不上。改用逐行状态机后确认无未闭合。

#### 安装态

直接从宿主抓取实际下发的 bundle：

```
bundle: plugins/??dsh-trajectory-traceview-plus/client.js&rev=29a24a247064
served 249,495 字节 = 本地 lib/client.js 前 249,495 字节（逐字节相同）
差异仅在尾部：宿主附加 "\n;\n" + sourceMappingURL
```

逐项查找本轮所有新代码（`compactionByReplacement`、`safeHref`、`block.file`、`note.wrapL`、`mapSubCalls`、`dstv-grad-a`、`anchor.searchingPages`、导出转义）**全部存在于宿主下发的内容中**。

#### 本轮真机验证汇总

| 项目 | 结果 |
|---|---|
| 响应式 6 个断点 | 无横向溢出 |
| 深链 `tvp1:t2s1` | 定位成功，101 秒（已加进度反馈） |
| 导出 Markdown | 289KB，结构完整 |
| 暗色/亮色对比度 | 全部 ≥4.5（暗色 ink 7.32–8.52，亮色 6.71–8.25） |
| 危险协议链接 | 0 个 |
| minimap/传输按钮无障碍名 | 64/64、8/8 |
| 错误边界 | 未触发 |

### 12.66 英文界面的中文字面量：从个案修复到结构性拦截（2026-11-18）

Codex 第五轮报：英文 Raw request 面板的角色名显示"压缩"。

#### 个案

`src/40-view.js:1632` 写的是 `m.role === "note" ? "压缩" : m.role`。仓库里**早就有** `node.compaction` 这个键（zh=上下文压缩 / en=Compaction），纯粹是漏用。已改为 `t("node.compaction")`。

#### 更有价值的部分：不只修这一处

这类漏用靠人眼和探针撞是补不完的。加了 **I18N3** 扫描守卫：

- 遍历 `src/*.js`（5 个文件）
- 剔除行注释、块注释
- 检查剩余代码里是否有任何 CJK 字面量
- locale 字典之外**一个都不许有**

当前结果：5 个源文件全部 **0 处**。变异验证：把 `"压缩"` 写回去 → 立刻红。

#### 验证英文输出链路完整

用真实 `en` 字典跑真实函数，compaction 两条路径都检查：

| | role 标签 | note 正文 |
|---|---|---|
| EN | `Compaction` | `Context compacted: SUM (replaced 3 item(s) / about 2.0k tokens)` |
| ZH | `上下文压缩` | `『上下文压缩：SUM（替换 3 项 / 约 2.0k tokens）』` |

英文侧无任何中文或全角标点残留。

#### 累计 i18n 守卫

| 守卫 | 覆盖 |
|---|---|
| `I18N`（既有） | 键在 zh/en 双向齐全 |
| `I18N2` | 英文函数输出不含 CJK（行为级） |
| `I18N3` | 源码里没有 locale 之外的 CJK 字面量（结构级） |

三层叠加：字典对齐 → 运行时输出 → 源码扫描。

### 12.67 Codex 终审 SOUND + 后台计时器修复（2026-11-18）

Codex 以 `worker_done` 结束，基于 HEAD `33a96ba` 出终审报告（`/tmp/traceview-audit-9b1519f/final-report.md`），六个维度全部 **SOUND**：Security / Theming-contrast / i18n / Accessibility / Performance-lifecycle / Contract-future kinds。

我没有直接采信这份结论，抽查了它引用的关键断言：

| 报告断言 | 我的抽查 |
|---|---|
| 无 `innerHTML`/`eval` | 只有 2 处，都是注释说明"不使用" |
| 有 `role=listbox` + `aria-orientation` + roving tabIndex | 确认 1/1/4 处 |
| station 键盘处理支持 Arrow/Home/End/Space 并 stopPropagation | 确认 |
| `content-visibility` 生效 | 确认 |
| interval 均有 cleanup | 4 个 setInterval / 5 个 clearInterval（多出的是防御性 clear） |
| `provenance.mjs --check` exit 0 | 确认 |

#### 报告未覆盖、我补做的一项

Codex 说 lifecycle SOUND，但我复查时发现一个它没测的**真实浪费**：

- 流式重建计时器每 **120ms** 重建整棵轨迹树，**标签页隐藏时照跑**
- 回放计时器同样在后台推进

对没人看的文档持续计费。已修：两个 interval 回调在 `document.visibilityState === "hidden"` 时直接 return，回到前台的下一个 tick 自然追上。

真机回归确认**没有把回放改坏**：点击播放后选区 1 → 3 正常推进，按钮在 `▶`/`❚❚` 之间切换，`visibilityState` 为 `visible`。

新增 `PERF5` 守卫（源级检查两个 tick 都有守卫，变异删掉其中一个即红）。

#### Codex 报告自己声明未覆盖的边界

- 未把宿主升级到未验证的 DSH 版本
- 未让真实模型产生新的 image/file 内容，只用隔离 fixture / 合成快照

这两点也是我的边界，如实记录。

### 12.68 极端分页的规模化实测（2026-11-18）

### 单次投影成本

| 规模 | 站点数 | 单次全量投影 |
|---|---|---|
| 200 节点 | 600 | 9.6 ms |
| 3,000 节点 | 1,800 | 118 ms |
| 5,000 节点 | 5,000 | **67 ms** |
| 10,000 节点 | 6,000 | 302 ms |

（5,000 节点那行更快，是因为站点里没有工具子调用，分支更浅；规模不是唯一变量。）

### 分页收敛

模拟"每翻一页向前扩 5 轮、共 40 页"：

| 目标锚点 | 判定已覆盖于 |
|---|---|
| `tvp1:t50s1` | 第 11 页 |
| `tvp1:t1s1` | 第 20 页 |

说明 `anchorCoveredByWindow` 会随窗口扩大逐步收敛，不会一律翻满 40 页。真实会话里 `t2s1` 翻满 40 页（101 秒）的原因是**目标步骤确实不存在**，而不是判据失效——那种情况只能翻到预算上限才能确认，最终给出诚实的"未加载/请改用 e167"。

### 边界规模

1,000 轮 / 5,000 节点 / 5,000 站：投影 **67 ms**，无异常，`t1000s1` 与 `t1s1` 均正确判定为已覆盖。

### 12.69 深链 133s → 68s：并发搜索去重（2026-11-19）

#### 找到的真正原因

之前把 101 秒归因为"目标步骤确实不存在，必须翻满 40 页"。**这个归因只对了一半**。

用 `PerformanceObserver` 抓长任务、用 `performance.getEntriesByType('resource')` 数真实请求，得到一次完整搜索的真实分解：

| 指标 | 值 |
|---|---|
| 总耗时 | 133 s |
| 宿主网络总时长 | **8.7 s** |
| 长任务占比 | 49.2%（max 179 ms，p50 108 ms） |
| `/api/session/page` 请求数 | **39** |

39 次请求 × 每页约 220 ms 网络 ≈ 8.7 秒。**剩下 124 秒不是网络，是同一个搜索被反复启动。**

#### 根因

锚点搜索由 `anchorApply` 承担，它有两个入口：

1. `useEffect`（依赖 `[anchorToken, N]`）
2. 键入 Enter 的 `onKeyDown`

而 `N` **每翻一页就变**。于是每翻一页，effect 就重新触发一次 `anchorApply`，**又开一个新的 40 页搜索**，各自持有独立的 `pages` 计数器。进度提示因此在多个搜索间来回跳：实测出现 `25 -> 23 -> 11 -> 20`。

effect 的 cleanup 只是把 `cancelled = true`，**并不能停止已经在跑的循环**。

#### 修法

新增 `createFlightGuard()`（放在纯函数区，可单测）：

- 同一个 key 在飞 -> 拒绝重复启动
- **不同 key 允许抢占** —— 否则用户输入新锚点会被静默忽略，而旧搜索还在翻页
- `finish(key)` 按 key 校验：被抢占的请求结束时不能清掉新请求的锁

#### 效果

| 场景 | 耗时 | 请求数 | 页数倒退 |
|---|---|---|---|
| 修前 | 133 s | 39 | 有（25→23→11→20） |
| 修后 | 68 s | 14 | 无 |
| 连按 5 次 Enter | **17 s** | **14** | 无 |
| 连按 10 次 Enter | 17 s | 14 | 无 |

关键对照：**连按 5 次与按 1 次产生完全相同的 14 个请求**。守卫生效。

#### 剩余 68 秒是什么

仍不是网络（14 请求 × ~220 ms ≈ 3 s）。是**每次翻页全量重建轨迹树**：3,580 站、40 页，累计约 6.5 s 纯重建，加上 React 渲染和 3,500 个 DOM 节点的重排。

真正的解法是增量折叠（只把新一页的节点折进已有树），属于架构改动。这轮没做。

#### 我自己的两个失误

1. 第一次重构把 `anchorApplyGuarded` 插在 `anchorApply` **声明之前**，触发 TDZ 错误（Z1 守卫直接拦下）。第二次把 ref 放在 useMemo 后面又被 Z1 拦。第三次才摆对位置。
2. 我看到"5 次按键 = 14 请求"就以为验证完了，但没做**去掉守卫的对照实验**，所以无法排除"本来就只有 14 个请求"。后来尝试对照时浏览器环境挂了，这条**对照实验没做成**，如实记录。

#### ❌ 更正：上面的 133s → 68s 归因是错的

我后来做了**去掉守卫的对照实验**（同一个会话、同样连按 6 次 Enter）：

| 条件 | 耗时 | `/api/session/page` 请求数 | 页数倒退 |
|---|---|---|---|
| 有守卫 | 10–25 s | **14** | 0 |
| **无守卫** | 29 s | **14** | 0 |

**两者完全相同。** 这说明：

1. 连按 Enter 并没有产生想象中的多份搜索——请求数就是一份搜索的量。
2. 我之前列的 "133s / 39 请求" 和 "68s / 39 请求"，**请求数也几乎一样**（39 vs 40）。真正变化的是耗时，而耗时差异来自**机器负载**：这台机器当时的 load average 是 **83 → 156**，同一份代码同一场景的耗时在 68–133 s 之间随机漂移。
3. 所以 **133s → 68s 不是我的修复带来的**，我把机器负载的波动当成了修复效果。

我保留 `createFlightGuard`，但理由要改成诚实的那个：它是一个**正确性**兜底（同一锚点不应并发，不同锚点可抢占），`ANCHOR2` 覆盖了语义，它没有可测的性能收益。

我也重新审视了"页数 25 → 23 → 11 → 20 倒退"这条证据：那次采样的同时 `resCount` 是 25→30→35→39 **单调递增**的，说明只有一个搜索在推进，倒退是我**采样时机落在不同渲染帧**上造成的读数错乱，不是我最初以为的多搜索竞争。

#### 教训

我在同一份上下文里已经因为**计时抖动**栽过两次（P1 的 median、PERF4 的计时守卫），这次是第三次，而且这次我直接把它写进了提交信息。计时类结论在这台高负载机器上不可信，必须用**计数类**指标（请求数、属性访问次数、DOM 节点数）交叉验证后才能下结论。

### 12.70 增量折叠的可行性分析（2026-11-19）

不休眠、不靠机器负载的活：把"能不能做增量折叠"这件事先算清楚，再决定做不做。

#### 现在浪费多少（确定性计数，不看耗时）

模拟 1,500 轮会话（6,000 节点）、每页 80 节点、翻 40 页：

| 指标 | 值 |
|---|---|
| 新翻出的节点 | 3,200 |
| **重复处理的旧节点** | **65,600** |
| 重复占比 | **95%** |

也就是说 95% 的折叠工作是白做的。这是**纯计数**结论，不受 load average 影响。

#### 但增量折叠不是"只折叠新增部分"那么简单

真正的前插（宿主把更早的节点加进 `eventNodes`，`seq` 不变）会让一部分输出字段变化：

| 字段 | 是否随前插变化 | 原因 |
|---|---|---|
| `id` | **不变** ✅ | 用 `anchorSeq`（`s10`），这正是当初特意改的 |
| `anchorKey` | **不变** ✅ | 同上（`e10`） |
| `turnStep` | **不变** ✅ | 按轮内计数 |
| `detail` | **不变** ✅ | 用 `turnStep` |
| `stepNo` | **变化** ❌ | 窗口级运行计数，`1 -> 5` |
| `label` | **变化** ❌ | 用了 `stepNo`，`"步骤 1" -> "步骤 5"` |
| `totalSteps` | **变化** ❌ | 总数 |

三个前缀敏感字段里，**两个（`stepNo`/`label`）只是展示用途**，唯一有语义的是 `totalSteps`。

#### 结论：可以做，但要先做两件事

1. **把 `stepNo` 从展示标签里拿掉**，改用 `turnStep`（`detail` 已经这么做了）。这样重算不再需要重新编号全部站点。
2. **`totalSteps` 改成累加**：前插时 `totalSteps += 新增步骤数`，不需要重算。

做完这两步，增量折叠才有可能成立：保留已折叠的站点，只折叠新翻出来的那一页，然后 splice 到前面。

#### 我为什么现在不做

这不是"改几行"的活：`deriveTraceTree` 是 670 行的单次全量折叠，`usedStationIds`、`consumedCompactionReqs`、`lastPrompt` 都是**顺序依赖**的状态（prompt 继承尤其如此：前插的请求会改变后续请求继承到的 prompt）。要正确增量，必须把这些状态也持久化并在前插时正确回滚——这部分我还没想清楚，硬做出来很可能引入静默错误。

**先把分析留在这里，等有完整设计再动手。**

### 12.71 翻页会把屏幕上的步骤重新编号（2026-11-19）

做增量折叠分析时顺带发现的**真实用户可见缺陷**，与性能无关。

#### 现象

`stepNo` 是**整个窗口的运行计数**。向前翻一页，前面多了 N 个步骤，后面所有步骤的 `stepNo` 全部 +N。

实测（turn 5 的第一个步骤，翻页前只有 turn 5-6，翻页后含 turn 1-6）：

| 字段 | 翻页前 | 翻页后 |
|---|---|---|
| `stepNo` | 1 | **5** |
| `label` | `步骤 1` | **`步骤 5`** |
| 无障碍名 | `1 / 4，步骤 1，轮次 5` | **`9 / 12，步骤 5，轮次 5`** |

用户向下滚动查看历史，**屏幕上已经显示的步骤会当场改名**。读屏用户更明显——同一条记录被重新播报成另一个步骤号。

#### 修法

凡是展示用途，一律改用 `turnStep`（轮内编号，前缀稳定）：

1. `src/30-helpers.js` 站点 `label`
2. `src/30-helpers.js` `stationAriaLabel`
3. `src/40-view.js` minimap 刻度标签

`detail` 字段本来就用的 `turnStep`，所以它一直是对的。

#### 验证

| 字段 | 修前 | 修后 |
|---|---|---|
| `id` | 稳定 | 稳定 |
| `anchorKey` | 稳定 | 稳定 |
| `turnStep` | 稳定 | 稳定 |
| `detail` | 稳定 | 稳定 |
| `label` | **变** | **稳定** |
| 无障碍名 | **变** | **稳定** |

`PREFIX1` 守卫覆盖 `id`/`turnStep`/`label`/`detail`/`anchorKey` 五个字段 + 无障碍名，任一回退即红（已用两个定向变异验证）。

#### 顺带修掉的另一个锚点缺陷

`anchorOf` 也是用 `stepNo` 拼锚点，但解析端 `p<turn>s<step>` 用的是 `turnStep`。**写和读不一致**，且只在 `anchorSeq` 为 null 的合成步骤上暴露——也就是**正在流式输出的那个 live 步骤**。

实测：turn 2 的 live 步骤复制出 `tvp1:p2s3`，粘回去直接"未加载"。修好后是 `tvp1:p2s2`，往返一致。`ANCHOR3` 会遍历所有站点做往返校验。

#### 仍未解决

`stepNo` 和 `totalSteps` 本身仍是窗口级的（它们是"第几个步骤/共几个步骤"的语义，天然依赖窗口）。增量折叠要成立的话，这两个得改成累加维护——但那是另一件事。

### 12.72 这一轮又找到的问题（2026-11-19）

#### 已修

**1. 导出的裸文本会把整篇文档搞坏**

`buildStepMarkdown` 的 `cell.text` 早就做了反引号转义，但**另外 4 处入口没有**：

| 入口 | 位置 |
|---|---|
| `buildTraceMarkdown` 的 user 站点 `text` | 1873 |
| `buildTraceMarkdown` 的 assistant `cell.text` | 1883 |
| `buildTraceMarkdown` 的 reasoning | 1882 |
| `buildTraceMarkdown` 的 compaction `summary` | 1618 |

后果实测：
- 模型输出一段没写完的代码围栏（流式被打断就会有）→ **后面整篇被当成代码块吞掉**，我测出 `未闭合围栏=3`。
- reasoning 里出现 `</details>` → **提前关闭思考折叠块**，后续步骤渲染到它自己的标题外面。

统一收进 `proseSafe()`，只转义真正危险的两个构造（3+ 反引号、`<details>`/`</details>`），其他 markdown 语法原样保留。`MD2` 守卫用**行状态机**校验（不是数反引号行数的奇偶——4/5 个反引号是合法围栏，那种数法会误报）。

**2. 末尾的 steering 凭空多出一个 turn**

官方布局对 `steering` 用的是 `lastAssistantTurn`（它插话进正在跑的那一轮），只有 `user` 才开新轮。我们统一按"新输入"处理，于是窗口末尾的一条插话单独成了一个 turn。

修法：EOF 处把 `pendingUser` 按 `steering` 拆开，插话归最后一轮，真正的 user 才开新轮。`STEER1` 覆盖三种情形（末尾插话、插话后有 user、插话夹在同轮 assistant 前）。

#### 查过、确认没问题的

用 43 个畸形快照（每种 kind × 缺字段 × 非数组 × null）模糊 `deriveTraceTree`：**0 抛异常**。

锚点解析 19 个边界输入（空串、负数、`0x10`、`NaN`、超大数、中文、大小写）全部返回预定义结果，**0 抛异常**。

`safeJsonPreview` 对循环引用、BigInt、Symbol、函数、稀疏数组、Map 都能正常降级。

2 MB 单行文本折叠 3 ms、导出 7 ms，没有卡死。

#### 查过、判断为设计取舍（不是缺陷）

- **`prompt.indexOf` 之类的顺序状态**：`lastPrompt` 继承依赖窗口，裁剪请求后 turn 2 继承不到 turn 1 的 prompt。但宿主分页时 `requests` 和 `eventNodes` 是一起裁的，**实际影响是"窗口外的东西看不到"，符合预期**。
- **重试的 token 只算最后一次**：同一 step 两次 `requests` 只有一条进 stats。这是"一次步骤一行"的设计，重试的中间消耗在请求详情里仍然可见。
- **用户输入里的 `<img onerror>` 原样保留在导出里**：导出是 Markdown 文件，不是 HTML 页面；如果强行转义所有 HTML，正常引用 HTML 的对话就没法看了。这与"导出要忠实"冲突，保留原样。

### 12.73 又一批真实缺陷（2026-11-19，第二轮深挖）

不是"再看看有没有问题"，而是逐条构造能失败的输入。**下面每一条都先写失败用例，再改代码。**

#### 已修（每条都有守卫 + 变异验证）

**1. 面板吞掉浏览器快捷键**（`KEY1`）

面板根 `tabIndex: 0`，站点行是 `<button>`。用户只要点进来一次，键盘事件就先到这里：

| 按键 | 应该发生 | 实际发生 |
|---|---|---|
| Ctrl/Cmd+R | 刷新页面 | **切换到 request 标签** |
| Ctrl/Cmd+F | 浏览器查找 | **聚焦内部搜索框** |
| Alt+← | 后退 | **上一步** |
| Ctrl+Home | 滚到顶 | **跳到第一个站点** |

两处处理器（面板级 + 站点级）都加了修饰键早退。站点级的那个还会 `stopPropagation`，所以面板级守卫救不了它，必须单独加。

**2. 同一个 `callId` 出现在两个 turn 时，结果被换掉或丢掉**（`CALLID1`）

合并/重放过的日志会有重复 callId。两个独立的 bug 叠在一起：

- `resultsById` 是 `Map<callId, result>`，**只保留最后一个** → turn 1 的调用显示 turn 2 的输出（显示错误数据）
- `attachedCallIds` 按裸 id 去重 → turn 2 的调用**整个被丢弃**，它的结果变成一条假 orphan（丢失数据）

改成：每个 id 保留按 seq 排序的结果列表，`takeResult()` 取下一个未被消费的；去重键改成 `${turn}:${callId}`。

修后实测：turn 1 → `结果1`，turn 2 → `结果2`，orphan 0 条。

**3. 错误卡片的「复制锚点」粘回去跳到别的记录**（`ANCHOR4`）

`e<seq>` 标识的是 **seq**，不是记录。`turn-error` 被打上"轮次结束 seq"，可以和 assistant 的 seq 相同：

```
e2 (error) 锚点=tvp1:e2 -> 解析到 s2   ❌ 复制 A 粘到 B
s2 (step)  锚点=tvp1:e2 -> 解析到 s2   ✓
```

解析器故意优先 step（锚点通常从步骤复制），所以错误卡片给出的锚点必然跳走。新增 `anchorResolvesToSelf()`，**不提供指向不了自己的锚点**。

**4. 搜索命中数没有 live region**（并入 `N2`）

搜索框旁边的 `1/5 匹配` / `无匹配` 是**唯一**的搜索反馈，但没有 live region——读屏用户输入查询后**什么都听不到**，包括"无匹配"。加 `role=status` + `aria-live=polite`，并把 N2 的全局上限从 2 提到 3（三个 live region 各自独立：锚点提示、加载骨架、搜索计数）。

#### 查过、确认无问题

| 检查 | 结果 |
|---|---|
| `safeHref` 19 种绕过尝试（大小写、`\n`、`\t`、`\0`、`data:`、`vbscript:`、`//evil`、`\javascript:`） | 全部正确拦截/放行 |
| `mdBlocks` 3/4/5 反引号围栏 | 全部正确解析（4 反引号内含 3 反引号也正确） |
| `matchStations` 复杂度（3000 站点，Proxy 计数下标访问） | **3000 次**，正好线性，无重复扫描 |
| 无 `innerHTML` / `dangerouslySetInnerHTML` | 0 处（模型输出不可能变成 markup） |
| `prefers-reduced-motion` | 已覆盖所有动画 |
| 巨型输入（2 MB 单行） | 折叠 3 ms / 导出 7 ms |
| 重复 seq 的 id 唯一性 | `u7` / `u7-2` / `s7`，无碰撞 |

#### 判断为"不是缺陷"

- **`forced-colors` 高对比度模式没写**：渐变文字（`background-clip:text; color:transparent`）在该模式下会退化成透明。这是**已知取舍**——补它会让标题和 KPI 数字失去品牌渐变，而高对比度用户本来就看到系统强制配色。真要修得上 `@media (forced-colors: active)` 把 `color:transparent` 覆盖成 `CanvasText`，这轮没做，记录在此。
- **`lastPrompt` 继承依赖窗口**、**重试 token 只算最后一次**、**用户输入的 `<img onerror>` 原样保留**：见 §12.72。

### 12.74 第三轮：深链链路 + 大窗口布局（2026-11-19）

前两轮是"随手翻到"的缺陷，这轮是**按数据量级系统扫描**：先用 CPU 时间最小值（不受负载噪声影响）测出热点，再按 CSS 的硬约束算出会撑破容器的元素。

#### 已修

**1. 折叠里 `Math.max(...turns.map(...))` 会把视图打死**（`SCALE1`）

展开运算符把每一轮当成一个实参。实测 **~12.5 万轮**（≈39 万节点）时抛 `RangeError: Maximum call stack size exceeded`，整个 `deriveTraceTree` 挂掉，面板白屏。真实交互会话到不了这个量级，但合并/拼接/有 bug 的客户端写出的日志能到。

抽成 `maxTurnOf()` 纯函数（循环实现）。修后 20 万轮正常。

> 守卫第一版有个自伤 bug：源码扫描把**注释里提到的旧写法**也匹配了。改成先滤掉注释行再扫。

**2. 深链揭示循环重复扫同一份列表**（`ANCHOR5`）

内层最多重试 12 次，每次延时 20→250 ms。旧代码**每次重试都跑一遍 O(n) 锚点扫描**，哪怕 `stationsRef` 根本没换：

```
3600 站点 × 12 次/页 × 40 页 ≈ 173 万次无用下标访问
```

改成按**数组身份**跳过（不是按长度——派生树每次投影都会新建数组，引用不变才是"没变"的可靠证明；同长度替换仍会被扫到）。

**3. 工具变更通知把工具名丢了**（`TOOLSET1`）

`tool-addition` / `tool-removal` 是 ContentBlock 定义里的类型，却落到"未知块"分支：

```
一条只为通知 read_file 的上下文行 → "[其他内容] · tool-addition"
```

按官方布局渲染成 `[工具新增] read_file`。无 `toolName` 时降级成通用标签，不渲染空行。

**4. `blocksText` 不认 `file` 块**（`BLOCKTXT1`）

只处理 text/image/reasoning。一个返回文件的工具（读取器、导出器）**结果卡是空的**——明明有结果。补 `file` 分支（带附件名）。

**5. minimap 在大窗口下把整个会话横向撑开**（`MINIMAP1`）

每个 tick `flex:1;min-width:3px`，加 2px gap = 每站 5px，且容器没有 `overflow`：

| 站点数 | tick 最小总宽 | 1200px 面板 |
|---|---|---|
| 240 | 1,198px | ✓ 刚好 |
| 500 | 2,498px | ❌ 溢出 1,298px |
| 3,600 | 17,998px | ❌ **溢出 16,798px** |

深链实测就有 3,600 站点。改成 minimap 自身横向滚动，页面布局不再被拖动。

**6. 写进 URL 的锚点读不回来**（`HASH1`）

`parseAnchor` 会 trim 并去掉一个前导 `#`，`nextHashFor` 两样都不做：

```
粘贴 "#tvp1:e2"（parseAnchor 明确接受的形式）
  → 地址栏变成 "##tvp1:e2"
  → 本标签页正常（内存里已解析过）
  → 别人打开报「锚点格式无法识别」
```

归一化改成和 `parseAnchor` 一致，并加"写入必须读得回来 + 幂等"的守卫。

#### 量出来的事实（不是猜的）

**折叠复杂度**（CPU 时间取 5 次最小值，绕开机器负载）：

| 轮数 | CPU | 比值 |
|---|---|---|
| 1,000 | 45 ms | — |
| 2,000 | 57 ms | 1.26× |
| 4,000 | 124 ms | 2.18× |
| 8,000 | 261 ms | 2.11× |

基本线性，没有隐藏的 O(n²)。

**深链 40 页翻页的折叠成本**（1790 轮 / 3,580 站的真实窗口）：

```
40 页全量折叠累计 CPU = 675 ms
最后一页单次折叠      = 40 ms
可省                  = 636 ms（94%）
```

这印证了 §12.70 的判断：增量折叠能省 94% 的**折叠**成本，但折叠本身只占深链总时长的一小部分（实测总时长以网络往返为主），所以**没做**。

**导出成本**：1,200 轮 / 2,400 站 → 55 ms CPU、406 KB、未闭合围栏 0。

#### 模糊测试

用**只含 JSON 能表示的畸变值**（null / 空串 / 0 / -1 / 数组 / 对象 / 布尔）生成 3,000 例畸形快照，每例都跑折叠 + 全篇导出：

```
3,000 例 → 成功 3,000 / 抛异常 0
```

（同一套测试放开到 Symbol / 函数等**不可 JSON 化**的值时会抛——`Cannot convert a Symbol value to a number`。这类值不可能出现在从宿主传过来的快照里，所以不修，但记录在此。）

### 12.75 第四轮：窗口级编号的残留（2026-11-19）

第三轮把 `label` / `aria-label` / minimap tick 改成每轮序号（§12.71 `PREFIX1`），但这轮发现**还有三处**在显示窗口级 `stepNo`，其中一处是我自己上一轮改出来的。

#### 已修

**1. 我上一轮给 minimap 加横向滚动，只解决了一半**（`MINIMAP1` 扩展）

加了 `overflow-x:auto` 之后滚动条**永远停在最左边**：

```
3600 站点，用户走到第 3500 站
活动 tick 在 x=17,500px 处，视口 1,200px  →  完全看不见当前位置
```

滚动条能滚，但没人替用户滚。补了跟随效果：活动 tick 变化时把 strip 滚到它。**只动自己的 `scrollLeft`**，不用 `scrollIntoView`——那会连带滚动外层祖先。

**2. 标头「当前 步骤 N」和卡片「步骤 M」是两个数字**（`PREFIX2`）

`currentStepNo` 取的是窗口级 `stepCounter`，而站点 label 早已改成每轮序号：

```
卡片写 "步骤 2"  ← turn 3 / step 2
标头写 "当前 步骤 1"  ← 窗口内的第 1 个步骤
```

同一条记录，两个数字。而且**加载更早历史后它自己会变**：

| 窗口 | 标头 |
|---|---|
| 2 轮历史 + 流式 | 当前 步骤 3 |
| 翻页到 10 轮历史 | 当前 步骤 11 |

修的时候第一次改错了：写成读 `st.turnStep`，但 `st` 是**原始累加器**，站点对象在几十行之后才构造，那时根本没有 `turnStep` 字段——静默回落到窗口级计数器。改成读 `piece.stepNum` 才对。

> 顺带发现**一条现有断言把 bug 写死了**：`if (liveTree.currentStepNo !== 1)`。那个 fixture 的步骤是 turn 3 / step 2，卡片写着「步骤 2」，而断言要求标头是 1——它固化的正是这个不一致。已改写并注明原因。

**3. 单步导出的标题也用窗口级编号**（`PREFIX3`）

```
`# 单步 · 步骤 2.4`   ← 那个站点的卡片写的是「步骤 2」
```

而且这个数字**取决于导出时恰好加载了多少历史**。改用 `turnStep`。

#### 顺手修正的一个假信号（`P1`）

性能守卫原来断言绝对墙钟：`best-of-9 < 250 ms`。这台机器上**同一份代码、同一份输入**实测 96 ms ~ 262 ms（3 倍波动），我这次就撞上了：一次没有任何退化的运行报 `6200 nodes took 256.9 ms best-of-9`。

查了同期 CPU 时间：**50 ms 最优 / 169 ms 最差**，墙钟的 3 倍波动里绝大部分是等待而不是计算。

改成断言**规模比值**（与机器无关）：

```
4,200 节点 → 8,400 节点，CPU 时间比值必须 < 3
线性 ≈ 2.0（实测 1.60 / 1.97）    平方 ≈ 4.0
```

实测：正常代码连跑 3 次全绿；注入人为 O(n²)（每个 assistant 节点扫一遍全部节点）→ 比值 **3.22**，捕获。

#### 编号来源审计（全部 6 处）

| 位置 | 来源 | 状态 |
|---|---|---|
| 站点 label | `piece.stepNum` | ✓ |
| 卡片轴标签 | `s.turnStep ?? s.stepNo` | ✓ |
| aria-label | `turnStep ?? stepNo` | ✓ |
| 标头 currentStepNo | `piece.stepNum` | ✓ 本轮修 |
| 单步导出标题 | `turnStep` | ✓ 本轮修 |
| 完整导出「步骤 N」 | `station.turnStep ?? stepNo` | ✓ |
| 锚点写入 | `turnStep` | ✓ §12.71 修 |
| minimap tick | `s.turnStep ?? s.stepNo` | ✓ §12.71 修 |

`stepNo` / `totalSteps` 保留为**内部序数**（React key 的兜底、`totalSteps` 字段），界面不再显示。

### 12.76 第五轮：我自己引入的 bug + 两个盲区（2026-11-19）

这一轮最值得记的是**两个守卫自己失效**，以及**我在修 bug 时引入了新 bug**。

#### 已修

**1. 切换会话时本地 UI 状态全部残留**（`SESSION1`）

宿主复用同一个组件实例打开另一个会话。所有本地状态都跟了过去：

- **回放位置**：`revealed` 被 clamp 到新会话的站点数，所以"上一个会话停在第 40 站"会让一个 5 站的新会话**直接显示成已回放到结尾**
- 搜索词、选中标签、跟随模式同样残留

slot 现在传 `sessionKey`，只在身份真变化时重置。宿主不提供时行为不变（向后兼容已用 SSR 验证）。

**2. 复制失败完全静默，而我的修法自己崩**（`COPY1`）

`copyText` 失败时 `if (!ok) return`——按钮毫无反应，用户以为没点生效，**实际粘贴出的是剪贴板里的旧内容**。`http://` 下 `navigator.clipboard` 根本不存在、`execCommand` 也可能拒绝，所以失败是常态而非异常。

改成三态（idle / ok / fail）。

> **我自己引入的 bug**：失败文案写成 `t("anchor.copyFailed")`，但 `CopyBtn` 是**模块级组件**，`t` 不在它的作用域里。这是 `ReferenceError`，**只在复制真正失败时抛**——SSR 测试走不到、所有现有守卫也碰不到。改成 prop 传入。
>
> 修完之后我一直以为守卫生效了，直到做变异测试才发现**第一个变异没被捕获**。原因是守卫的切片窗口用 `indexOf("});")` 找结尾，而它落在 `doCopy` 的 `setTimeout` 里——**只检查了组件的前半段**，含 `t(...)` 的渲染分支在窗口外。改成用下一个顶层声明定位。

**3. 失败态只有文字没有颜色**

`✗ 复制失败` 用和其他标签一样的灰色，读起来就是个普通标签。补 `data-fail` → `var(--dstv-err)`。

#### 这一轮的方法教训

| 问题 | 后果 |
|---|---|
| 守卫用固定字符数/最近符号切窗 | 窗口过短 → **变异测不出来**，守卫形同虚设 |
| 模块级组件里用外部闭包 | 只在罕见分支抛错，**SSR 和所有测试都覆盖不到** |
| 只改文案不改样式 | 状态可见但**不可辨识** |

三次都是同一个模式：**"改对了"和"验证到了"是两件事**。三次都是靠变异测试才发现守卫没在工作。

#### 顺手确认无问题的

| 检查 | 结果 |
|---|---|
| 模块级函数/组件用 `t(...)` 的作用域 | 3 个组件全绿：`MarkdownText` 不用 t，`CopyBtn` 用 prop，`TraceMapView` 从 props 拿 |
| 字典覆盖（双向） | 中/英各 172 键完全一致；代码引用 152 个键**无缺失**；模板形式 `evidence.${level}` 两个都能解析 |
| 字典里有、代码没引用 | 22 个，其中 5 个是真正的死键（`anchor.copiedLink` / `anchor.badInput` / `block.toolsAdded` / `block.toolsRemoved` / `block.toolsChanged`）——保留，成本为零且未来可能用到 |
| 事件监听器清理 | 4 处 `addEventListener` 全部有对应 `removeEventListener` / `clearInterval` |
| `promptTextDiff` 重复行 | 正确按前后缀裁剪（`[X]→[X,X]` 得 `+1 start=2`，不是"全变了"） |

### 12.77 第六轮：静默失败与焦点（2026-11-19）

这轮的主线是 **"操作失败了，但界面假装成功"**，以及它的近亲 **"操作成功了，但把用户的位置弄丢了"**。

#### 已修

**1. 整段 Markdown 导出复制失败也静默**（`COPY1` 扩展）

和 §12.76 的 CopyBtn 是**同一条缺陷的另一份拷贝**——修了一个没修另一个。用户点了「📋 Markdown」，以为整段轨迹已在剪贴板，实际什么都没写。

> 这是本轮最值得记的一条：**同一个 bug 在两处独立存在，修完第一处时我没去搜第二处**。所以守卫现在是分开写的两条断言——它们会独立退化。

**2. 「加载更早历史」失败被吞掉**（`LOADOLDER1`）

```js
.catch(() => undefined)
```

按钮转一圈又回来，时间线没长。用户看到的现象和**「已经没有更多历史了」完全一样**。离线、会话过期、宿主报错三种情况全都长得像"到底了"，于是用户会反复重试一个已经被拒绝的请求。

补了可见提示 + 并入**现有**的 live region（不新增第 4 个，`N2` 有全局上限）。

三个变异全部捕获：重新吞掉、只显示不给读屏、切换会话不清提示。

**3. legacy 复制把焦点弄丢**（`COPYFOCUS1`）

`navigator.clipboard` 在**普通 http:// 下根本不存在**，所以 textarea + `execCommand` 不是"老浏览器兜底"，而是常见路径。它做了：

```
ta.select()      ← 焦点进入临时 textarea
removeChild(ta)  ← 被聚焦的元素消失
                 → 焦点掉回 <body>，键盘/读屏用户被弹回文档开头
```

每复制一次弹一次。另外可编辑 textarea 被聚焦会在 **iOS 上唤起键盘**——弹出一个对着隐形输入框的键盘。

补 `readonly` + `aria-hidden` + `tabindex=-1` + 焦点恢复（`preventScroll`，否则恢复焦点会把时间线滚走）。

> 这个守卫是**行为级**的：用假 DOM 真的执行一遍 `copyText`，断言临时元素的属性、是否被移除、焦点是否回到原处。三个变异（去 readonly / 不恢复焦点 / 不清理元素）全部捕获。

#### 一个反复出现的模式

| 轮次 | 缺陷形态 |
|---|---|
| 12.76 | 复制失败静默 |
| 12.77 | 导出复制失败静默（**同一 bug 第二份**） |
| 12.77 | 加载历史失败静默 |
| 12.77 | 复制成功但焦点丢失 |

四次都属同一类：**成功路径被测试覆盖，失败路径被 `return` / `catch` 抹平**。现有 56 道守卫里，之前没有一道在检查"失败时用户看到什么"。

#### 顺带确认

```
copyText 在无 document/navigator 环境 → 回调 false，不抛
copyText legacy 路径属性齐全 → readonly ✓ aria-hidden ✓ tabindex ✓ 移除 ✓ 焦点恢复 ✓
```

### 12.78 第七轮：投影崩溃 + 守卫伪绿（2026-11-19）

这轮由两个独立审查 agent 交叉驱动，但它们**都在完成前失败了**（一个在写探针前、一个在汇总后半段），所以下面每一条都是我自己重新复现并做变异验证的。审查方给出的 D-1…D-12 里，我确认了 8 条、否证了 2 条、降级了 2 条，逐一记在后面。

#### 已修：投影层

**1. 一个坏字段让整张卡消失**（`TEXTCOERCE1`）

宿主契约把 `TurnErrorNode.message`、`CommandNode.args`、`compaction.summary` 都写成 `string`。契约是契约，不是保证——React 遇到对象直接抛：

```
Objects are not valid as a React child (found: object with keys {obj})
```

而这种抛异常发生在**渲染期**：`RenderBoundary` 能救浏览器里的卡片，但 `react-dom/server` 不支持边界，整视图一起没。实测 6 种形状（含数组里嵌对象）全部崩。

修法是在**投影处**加 `asText()`，不是在每个渲染点补 `String()`——补一百处也会漏。对象降级成 JSON 而不是 `[object Object]`：读者至少能看到到达了什么。

**2. `prompt.tools` 里一个 null 条目，整页工具目录消失**（`TOOLLIST1`）

`deriveTraceTree` 确实做了归一化，但它只检查**是不是数组**：

```js
Array.isArray(found.prompt.tools) ? found.prompt.tools : []
```

`[null]` 原样穿过。渲染时 `tools.map(t => t.name)` → `Cannot read properties of null (reading 'name')`。一个空洞带走了全部工具。

新增 `safeToolList()`：丢空洞与非对象、把三个要显示的字段强制成字符串、保持顺序。

**3. 请求页四处直接 `JSON.stringify`**（`REQJSON1`）

循环引用 / BigInt schema 会让请求页渲染抛 `TypeError`。改用 `safeJsonPreview`，缩进改成显式可选参数（别的调用方要的是单行）。

#### 已修：我上一轮引入的缺陷

**4. `safeJsonPreview` 把纯别名也标成 `[Circular]`**

上一轮我为了修循环引用，用了"全局 seen 集合"。它把**任何出现两次的对象**都标成 `[Circular]`：

```
{a: shared, b: shared}       → b: "[Circular]"     ← 合法别名被隐藏
仅别名（无 BigInt）           → [{n:1},{n:1}]       ← 因为走的是 plain 快路径，看不出来
```

也就是说：**只要 payload 里另有一个 BigInt 或真循环，所有合法别名就一起被标脏**。这正是我上一轮注释里声称要避免的事，而且守卫只单独测了别名、没和 BigInt 组合，所以全绿。

改成沿 holders 链判断"是不是自己的祖先"。中途试过 push/pop 栈，**不成立**——replacer 不被告知何时离开某个值，永远不会 pop。验证：

```
别名 + BigInt → b: {"n":1}    ✓
循环 + 别名   → cyc.self: "[Circular]", a/b 正常  ✓
自引用数组    → [1,"[Circular]"]  ✓
```

#### 已修：异步越界（两个都是"没人看着了还在干活"）

**5. 锚点搜索能活过面板**（`ANCHORLIFE1`）

最多 40 页。判据是 `stationsRef.current` 的**数组身份**——组件卸载后这个 ref 冻结在最后一帧，于是"投影变了吗"永远看不到变化：内层 12 次退避（20ms→250ms）跑满，外层 `loadOlder()` 仍在报告增长，继续下一页。给一个已经没人看的会话翻历史。

加 `aliveRef`，在两处 `await` 之后各查一次，并把检查放进**两个入口共用的包装器**（写在各自的 `.then` 里会漏掉一条路径）。

**6. 深链落地后每个新站点都把用户拽回锚点**（`ANCHORDEDUPE1`）

成功落点会把锚点镜像进 URL，而 effect 依赖 `[anchorToken, N]`。于是流式会话每来一个站点就重跑一次，重新 `setRevealed(锚点)` 并停掉回放——深链用户根本没法在时间轴上走开。

修的时候第一次改错了：我直接把 `N` 从依赖里删了。那会让**早到的深链永远落不了地**（锚点在 stations 还是空的时候就到了，全靠 N 增长重试）。正确做法是记住"已落地"的 token：

```js
void anchorApplyGuarded(wanted).then((ok) => {
  if (ok) appliedAnchorRef.current = anchorToken;   // 只在成功时记录
```

失败不进记忆，所以重试仍然有效。守卫同时断言两件事：去重存在、且记录发生在成功之后。

#### 已修：前插历史后身份漂移

**7. 合成站点的 id 含窗口级计数**（`SYNTHID1`）

```js
id: `sx${turn}-${stepNum}-${stepCounter}`   // stepCounter 是窗口内连续计数
```

实测同一份数据：

```
只加载 6–8 轮：  sx9-1    stepNo 4
前插 1–5 轮后：  sx9-1    stepNo 9     ← 旧写法 id 会变
```

id 一变，选择修复的 `findIndex` 返回 -1，详情面板**静默**显示同一位置上的另一条记录。改成只用 `turn` + 每轮 `stepNum`，重复时加后缀。

#### 已修：五处守卫是假绿

这轮最有价值的部分。以下每一条都用变异证明过"删掉代码仍然全绿"：

| 守卫 | 伪绿方式 | 现在断言什么 |
|---|---|---|
| `Z2` / `SEC1` | 用 `React.createElement` 冒充 `jsx`——第三个参数 key 变成 children，渲染出 **294 字符骨架**仍通过 | 真 `react/jsx-runtime`；非空快照必须出现站点卡片 |
| `COPY1` | `failLabel` 写在注释里即可满足 | 失败分支表达式本身 `✗ ${failLabel` |
| `SESSION1` | 在比较后插一句无条件 `return;`，5 个 token 全在源码里 | 第一个 reset 之前不得有 return |
| `P4` | `void 0; /* setPlayheadLeft(docLeft) */` | `if (Number.isFinite(docLeft)) setPlayheadLeft(docLeft);` |
| `I18N2` | 英文窗口 `enS + 20000` 越过表尾 1.1 万字符 | 与中文侧用同样的定界 |

#### 一处否证

审查方怀疑 `<details open={...}>` 是受控/非受控混用。**不成立**：React 只在 prop 变化时写 DOM 属性，常量 `open: false` 在用户手动展开后不会被重渲染覆盖回去。真正会变的是 `open: i === messages.length - 1` 配合下标 key——那属于"前插后 DOM 状态错位"，另记。

#### 未验证（诚实记录）

- **没有跑真实浏览器**：所有渲染都是 `react-dom/server`，没有 effect，所以 scroll / measure / focus / clipboard / interval 的运行时行为**没有任何证据**。`ANCHORLIFE1` 的守卫是源码级 + 循环结构检查，不是运行时。
- **`sessionKey` 重置可能是死代码**：审查方的源码推断是宿主按会话代际重挂载（`key=sessionGenerationKeyOf`），若成立则 `prev !== sessionKey` 分支永不进。我**没有**验证这一点，因此**没有**删这段 effect——它是有害还是无害取决于宿主实现，删掉才是赌。
- **`client.js` 仍未拆分、真机响应式未复测、npm 未发布**（用户明确暂不发布）。

### 12.79 第八至十轮：边界卡死、定时器互踩、Markdown 吞字、逐字校验（2026-11-19）

§12.78 之后继续按"先复现、再修、再变异"推进。以下每条都有可执行证据。

#### 边界状态会粘住（`BOUNDARYKEY1`）

React 的错误边界会保留 `err` 直到卸载或手动重试。站点卡片用 `card${s.id}` 做 key，换卡片自动清；但详情面板只有一个，用了固定 key `"dBodySafe"`：

1. 站点 A 的数据让 `renderDetailBody` 抛异常 → 边界显示「渲染失败 + 重试」；
2. 用户点站点 B（完全正常）；
3. 面板**仍然**显示错误，只有手动点重试才恢复。

切页签同理（`showTab` 也不在 key 里）。改成 `dBodySafe:${id}:${showTab}`。

#### 反馈定时器互相踩（`TIMER1`）

复制/导出的反馈各有一个 1.4s / 1.6s 的 `setTimeout`，每次点击都**新起一个不取消旧的**。1.4 秒内点第二次，第一次的定时器先到，把第二次刚设的 `ok`/`fail` 清成 `idle`——按钮变回原样，看起来像第二次点击没生效。改成定时器存 ref、先 `clearTimeout`、卸载时清理。

#### Markdown：两处"吞字"

**`[](https://x)` 会吞掉它和下一个链接之间的正文**（`MD3`）

扫描器取的是"严格在 `i+1` 之后"的 `]`，正好落在 `i+1` 的那个被跳过。后果不是只丢这一个链接：

```
输入：[](http://x) 见 [说明](http://y)
修复前：一个链接，文字 "](http://x) 见 [说明"，href = http://y
修复后：链接 http://x | 文字 " 见 " | 链接 说明
```

中间的正文被吸进了链接标签。顺带：空 label 会渲染成不可见不可点的 `<a></a>`，改为显示目标地址。

**表格里的 `\|` 被当列分隔符**（`MD4`）

`\|` 是表格里放字面竖线的唯一写法。按每个 `|` 切分把一个单元格切成两格：

```
| a \| b | c |   →  ["a \", "b", "c"]   三列，后面每格左移一列
```

#### `role="listbox"` 里的装饰节点（`ARIA4`）

listbox 只允许 `option`（或 `group`）子元素。空闲带是纯装饰——站点自己的 aria-label 已经带了时间——但没加 `aria-hidden`，读屏把它当成一个条目，在两个站点之间念出「⏸ 空闲 5.0 分钟」。旁边的播放头早就 hidden 了，这个漏了。

#### 逐字输入锚点闪 8 次错（`ANCHORTYPE1`）

`anchorToken` 含 `anchorInput`，所以每个按键后都跑一次完整 `anchorApply`：

```
输入 "t"         → 解析失败 → setAnchorNote(anchor.bad)
...
输入 "tvp1:t2s1" → 解析成功
```

8 次红色告警。"更糟的是半截输入可能恰好合法"——输入 `tvp1:e2` 想打成 `tvp1:e20`，第 7 个字符就已经解析成功并跳走了。输入的锚点属于 Enter 处理器。

#### 这轮我自己写错两次守卫

`ANCHORTYPE1` 第一版从文件里第一个 `if (ev.key === "Enter")` 开始扫——那是搜索框的——一路扫过 1.8 万字符，**删掉整个 typed jump 仍然通过**。第二版改成从 `anchorApplyGuarded(wanted).then(` 往前扫，但效果器里也有同样一次调用，命中的是效果器。最终锚定 `const wanted = anchorInput.trim();` 向前看。

同一模式在 `TOOLLIST1` 也出现过：变异没有真正改变行为（`if (raw === null) continue;` 只丢 null，`undefined` 仍会抛），守卫照旧通过——我先是误判为守卫失效，实测才发现变异本身无效。**变异必须改变行为，否则证明的是变异无效，不是守卫有效。**

#### 未验证（沿用 §12.78）

- 仍然**没有真实浏览器**。`ARIA4` 用的是 `react-dom/server` + 真 jsx runtime，验证的是输出 HTML 里的 `aria-hidden`，不是读屏软件的实际播报。
- `TIMER1` 的行为断言是复刻调度逻辑，不是真的操作组件。
- `client.js` 拆分、真机响应式、npm 发布仍未动（用户明确暂不发布）。

### 12.80 第十一、十二轮：页签粘连、minimap 的 200 个 Tab 停靠点、请求页行串位（2026-11-19）

#### 请求页签会"记住"一个不存在的页（`TABLATCH1`）

`showTab` 有一层回落：

```js
const showTab = tab === "request" && canRequest ? "request" : "detail";
```

所以在一个没有 request 的站点上点「请求」按钮，画面不动——看起来按钮无效，符合预期。但 `tab` state **已经写成 `"request"`** 了。用户接着用 `→` 或点 minimap 走到一个有 request 的站点，面板自己跳到请求页，没有任何人按过任何东西。

`r` 快捷键一直有 `canRequest` 保护；这个按钮没有。

#### minimap 是 200 个 Tab 停靠点（`MINITAB1`）

minimap 是**同一批站点的第二个导航入口**，时间轴本身已经用了 roving tabindex。但每个刻度都是普通 `<button>`。实测渲染 200 个站点：

```
可 Tab 聚焦元素: 215
其中 minimap 刻度: 200
```

长会话按 3,600 站点算是约 3,600 个停靠点——键盘用户要一路 Tab 穿过整条 strip 才能到达下面的面板，而这条 strip 唯一的作用是"跳到某个站点"。

改成与时间轴一致的 roving tabindex 后：**215 → 16**。

修的时候我第一次写成 `i === R - 1 ? 0 : -1`，overview 态（`revealed === null`）下**一个都不可 Tab**——整条 strip 从键盘上彻底消失。这是相反的失败，同样错。最终规则与站点列表一致：当前选中的那个，否则第一个。守卫因此断言的是"恰好 1 个"，不是"少于 N 个"。

#### 请求页的行会串（`MSGKEY1`）

消息列表在站点窗口向前增长时重建，而历史是**前插**的，所以 `index 0` 不再是原来那条消息。行却按下标做 key：

```
只有 6-10 时：U6 在 index 0
前插 1-5 后： U6 到了 index 5
              旧 key  m0 → m5        同一个 DOM 节点换了内容
```

React 复用 DOM 节点 → 用户展开的那一行显示的是另一条消息的正文；而 `open: i === messages.length - 1` 也按下标算，所以新变成最后一行的自己展开了。

`reconstructMessages` 现在给每条消息带上 `seq`（持久记录号），键改成 `m<seq>-<role>`。

**这是同一类缺陷的第三次**：合成站点 id 含窗口计数（§12.78 SYNTHID1）、选择修复按下标（更早）、请求页按下标做 key。前插历史 = 所有"按下标"的东西都会失准。区别只是前两次是选择丢失，这次是 DOM 状态错位。

#### 顺手修的

`usedStationIds` 声明掉了缩进（顶格写），语义没问题但下一行 `let pendingUser = []` 会让人误读作用域。

#### 未验证（沿用前几轮）

- 仍无真实浏览器。`MINITAB1` 数的是 `react-dom/server` 输出里的 `tabindex` 属性，不是真的按 Tab 键走一遍。
- `MSGKEY1` 验证的是 key 字符串的稳定性，不是真实的 DOM 复用行为（那需要真实 React 协调过程）。
- `client.js` 拆分、真机响应式、npm 发布仍未动。
