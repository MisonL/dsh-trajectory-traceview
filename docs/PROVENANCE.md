# 来源清单 · Provenance

> 本文件由 `node scripts/provenance.mjs` **自动生成**，请勿手工编辑。
> 它回答一个问题：**哪部分是上游的，哪部分是本仓二开的。**

基线：`v0.3.0`（`2d1d07d`，2026-08-26）来自 [AFAP/dsh-trajectory-traceview](https://github.com/AFAP/dsh-trajectory-traceview)，MIT。
上游在该提交后未再发布（仓库共 3 个提交）。

## 一、文件级

上游共 10 个文件，其中 4 个一字未改：

| 文件 | 状态 |
| --- | --- |
| `.gitignore` | 原样保留 |
| `LICENSE` | 原样保留 |
| `README.en.md` | 已修改 |
| `README.md` | 已修改 |
| `cordis.patch.yml` | 已修改 |
| `lib/client.js` | 已修改 |
| `lib/index.js` | 原样保留 |
| `package.json` | 已修改 |
| `screenshot/overview.jpg` | 原样保留 |
| `test/smoke.test.cjs` | 已修改 |

本仓新增的文件：

- `docs/DESIGN.md`
- `docs/PROVENANCE.md`
- `scripts/provenance.mjs`

## 二、`lib/client.js` 函数级

上游 24 个函数：**13 个原样保留、11 个被修改、0 个被删除**；本仓**新增 30 个**。

### 原样保留（13）

未做任何改动，可与上游逐字对照：

- `CopyBtn`
- `blocksText`
- `copyText`
- `decodeRateOf`
- `firstLine`
- `fmtInt`
- `fmtMs`
- `normalizeUsage`
- `prettyArgs`
- `prettyJson`
- `reconstructMessages`
- `subName`
- `toolGlyph`

### 已修改（11）

**这些是二开最容易与前人意图冲突的地方**——功能骨架来自上游，但行为已被改变。每处都应在 `docs/DESIGN.md` 里找得到"为什么改"的记录：

- `TraceMapView`
- `apply`
- `buildTraceMarkdown`
- `deriveTraceTree`
- `fmtDur`
- `fmtTokens`
- `matchStations`
- `newStepState`
- `promptDiffOf`
- `subDetailOf`
- `textOfContent`

### 本仓新增（30）

上游完全没有：

- `MarkdownText`
- `anchorCoveredByWindow`
- `anchorLoadTarget`
- `anchorOf`
- `anchorSeqFloor`
- `anchorTurnFloor`
- `annotateNamelessFormFields`
- `buildStepMarkdown`
- `changedTools`
- `clockGapWidth`
- `evidenceOf`
- `fencedBlock`
- `isEverythingUnknown`
- `markdownToPlain`
- `mdBlocks`
- `mdInline`
- `nextHashFor`
- `parseAnchor`
- `promptTextDiff`
- `pushSubLines`
- `renderMdInline`
- `resolveAnchorInStations`
- `safeJsonPreview`
- `safeList`
- `searchScopeNote`
- `snapshotContract`
- `stationAriaLabel`
- `stationHay`
- `toolSchemaKey`
- `unknownNodeStats`


## 三、怎么用它

- `git diff v0.3.0 -- <file>` —— 看某个文件相对上游改了什么
- 本文件 —— 看改动**规模**和**落点**（哪个函数、哪一类）
- `docs/DESIGN.md` —— 看每处改动**为什么**这么做
- `node scripts/provenance.mjs --check` —— 确认本文件没有过期
