#!/usr/bin/env node
/**
 * Regenerate docs/PROVENANCE.md by diffing this repository against the upstream
 * release it forked from.
 *
 * Why generate instead of hand-write: a hand-maintained split ("these functions are
 * ours") goes stale the first time someone edits a function and forgets the list,
 * and then it silently lies. This script reads the actual bodies from `git show`
 * and the working tree, so the document is reproducible and reviewable:
 *
 *   node scripts/provenance.mjs          # rewrite docs/PROVENANCE.md
 *   node scripts/provenance.mjs --check  # exit 1 when the file is stale (CI-able)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const UPSTREAM_REF = 'v0.3.0';
const UPSTREAM_REPO = 'AFAP/dsh-trajectory-traceview';
const OUT = join(ROOT, 'docs', 'PROVENANCE.md');

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** Function bodies keyed by name; braces are counted so nested blocks stay intact. */
function functionBodies(src) {
  const out = new Map();
  const re = /^(\t| )*function ([A-Za-z0-9_]+)\s*\(/gm;
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = m[2];
    let i = src.indexOf('{', m.index);
    if (i < 0) continue;
    let depth = 0;
    let end = -1;
    for (; i < src.length; i += 1) {
      const ch = src[i];
      if (ch === '{') depth += 1;
      else if (ch === '}') { depth -= 1; if (depth === 0) { end = i + 1; break; } }
    }
    out.set(name, src.slice(m.index, end));
  }
  return out;
}

/** Class methods and top-level declarations that are not plain `function` bodies. */
function otherSymbols(src) {
  const out = new Map();
  for (const re of [/^(\t| )*class ([A-Za-z0-9_]+)/gm, /^(\t| )*const ([A-Za-z0-9_]+) = \(/gm]) {
    let m;
    while ((m = re.exec(src)) !== null) out.set(m[2], (out.get(m[2]) ?? 0) + 1);
  }
  return out;
}

const upSrc = git('show', `${UPSTREAM_REF}:lib/client.js`);
const curSrc = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const up = functionBodies(upSrc);
const cur = functionBodies(curSrc);

const untouched = [];
const modified = [];
const added = [];
const dropped = [];
for (const [name, body] of up) {
  if (!cur.has(name)) dropped.push(name);
  else if (cur.get(name) === body) untouched.push(name);
  else modified.push(name);
}
for (const name of cur.keys()) if (!up.has(name)) added.push(name);
untouched.sort(); modified.sort(); added.sort(); dropped.sort();

// File-level map: which upstream files survived byte-for-byte.
const upstreamFiles = git('ls-tree', '-r', '--name-only', UPSTREAM_REF).trim().split('\n').filter(Boolean);
const fileRows = upstreamFiles.map((file) => {
  let status;
  try {
    const now = readFileSync(join(ROOT, file), 'utf8');
    status = now === git('show', `${UPSTREAM_REF}:${file}`) ? '原样保留' : '已修改';
  } catch {
    status = '已删除';
  }
  return { file, status };
});
// Tracked additions only (`git ls-files`), so the list is stable regardless of
// whether the new files are committed yet, and never picks up untracked scratch.
const addedFiles = execFileSync('git', ['diff', '--name-status', '--diff-filter=A', UPSTREAM_REF], { cwd: ROOT, encoding: 'utf8' })
  .trim().split('\n').filter(Boolean).map((line) => line.split('\t')[1])
  .concat(['docs/PROVENANCE.md', 'scripts/provenance.mjs'])
  .filter((f, i, all) => all.indexOf(f) === i)
  .sort();

const upCommit = git('rev-parse', '--short', UPSTREAM_REF).trim();
const upDate = git('log', '-1', '--format=%ad', '--date=short', UPSTREAM_REF).trim();

const md = `# 来源清单 · Provenance

> 本文件由 \`node scripts/provenance.mjs\` **自动生成**，请勿手工编辑。
> 它回答一个问题：**哪部分是上游的，哪部分是本仓二开的。**

基线：\`${UPSTREAM_REF}\`（\`${upCommit}\`，${upDate}）来自 [${UPSTREAM_REPO}](https://github.com/${UPSTREAM_REPO})，MIT。
上游在该提交后未再发布（仓库共 3 个提交）。

## 一、文件级

上游共 ${upstreamFiles.length} 个文件，其中 ${fileRows.filter((r) => r.status === '原样保留').length} 个一字未改：

| 文件 | 状态 |
| --- | --- |
${fileRows.map((r) => `| \`${r.file}\` | ${r.status} |`).join('\n')}

本仓新增的文件：

${addedFiles.map((f) => `- \`${f}\``).join('\n')}

## 二、\`lib/client.js\` 函数级

上游 ${up.size} 个函数：**${untouched.length} 个原样保留、${modified.length} 个被修改、${dropped.length} 个被删除**；本仓**新增 ${added.length} 个**。

### 原样保留（${untouched.length}）

未做任何改动，可与上游逐字对照：

${untouched.map((n) => `- \`${n}\``).join('\n')}

### 已修改（${modified.length}）

**这些是二开最容易与前人意图冲突的地方**——功能骨架来自上游，但行为已被改变。每处都应在 \`docs/DESIGN.md\` 里找得到"为什么改"的记录：

${modified.map((n) => `- \`${n}\``).join('\n')}

### 本仓新增（${added.length}）

上游完全没有：

${added.map((n) => `- \`${n}\``).join('\n')}

${dropped.length > 0 ? `### 上游有、本仓删除（${dropped.length}）\n\n${dropped.map((n) => `- \`${n}\``).join('\n')}\n` : ''}
## 三、怎么用它

- \`git diff ${UPSTREAM_REF} -- <file>\` —— 看某个文件相对上游改了什么
- 本文件 —— 看改动**规模**和**落点**（哪个函数、哪一类）
- \`docs/DESIGN.md\` —— 看每处改动**为什么**这么做
- \`node scripts/provenance.mjs --check\` —— 确认本文件没有过期
`;

if (process.argv.includes('--check')) {
  const exists = (() => { try { return readFileSync(OUT, 'utf8'); } catch { return ''; } })();
  if (exists !== md) {
    console.error('docs/PROVENANCE.md 已过期：请运行 node scripts/provenance.mjs');
    process.exit(1);
  }
  console.log('PROVENANCE OK');
  process.exit(0);
}

writeFileSync(OUT, md);
console.log(`wrote ${OUT}`);
console.log(`上游函数 ${up.size}：原样 ${untouched.length} / 修改 ${modified.length} / 删除 ${dropped.length}；新增 ${added.length}`);
