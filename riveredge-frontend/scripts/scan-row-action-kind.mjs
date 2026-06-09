/**
 * 扫描行内操作是否缺少 `data-action-kind`。
 * 覆盖：renderRowActionsOverflow、ROW_ACTIONS_INLINE_GAP、option return 数组、option 裸 Space。
 */
import fs from 'fs';
import path from 'path';

const SRC = 'src';
const ACTION_TAGS = ['Popconfirm', 'Button', 'Dropdown', 'UniWorkflowActions'];

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== 'dist') walk(p, files);
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
  return files;
}

function extractNextElement(text, fromIndex) {
  let best = null;
  for (const tagName of ACTION_TAGS) {
    const start = text.indexOf(`<${tagName}`, fromIndex);
    if (start < 0) continue;
    if (!best || start < best.start) best = { tagName, start };
  }
  if (!best) return null;
  const closeTag = `</${best.tagName}>`;
  const closeIdx = text.indexOf(closeTag, best.start);
  if (closeIdx < 0) return null;
  return { ...best, end: closeIdx + closeTag.length, block: text.slice(best.start, closeIdx + closeTag.length) };
}

function readOpenTagAttrs(block) {
  const openEnd = block.indexOf('>');
  return block.slice(block.indexOf('<') + 1, openEnd);
}

function hasExplicitKind(block) {
  return block.includes('rowActionKind') || block.includes('data-action-kind');
}

function scanRegionElements(snippet, file, { requireKey = false } = {}) {
  const issues = [];
  let cursor = 0;
  while (cursor < snippet.length) {
    const el = extractNextElement(snippet, cursor);
    if (!el) break;

    const isInnerButton =
      el.tagName === 'Button' &&
      snippet.lastIndexOf('<Popconfirm', el.start) > snippet.lastIndexOf('</Popconfirm>', el.start);

    if (!isInnerButton && !hasExplicitKind(el.block)) {
      const attrs = readOpenTagAttrs(el.block);
      if (requireKey && !/\bkey=/.test(attrs)) {
        cursor = el.end;
        continue;
      }
      const key = attrs.match(/\bkey=(?:"([^"]+)"|'([^']+)'|\{['"]([^'"]+)['"]\})/);
      issues.push({
        file,
        tag: el.tagName,
        key: key?.[1] || key?.[2] || key?.[3] || '(missing kind)',
      });
    }
    cursor = el.end;
  }
  return issues;
}

function extractBracketArray(content, arrayStart) {
  let depth = 0;
  for (let end = arrayStart; end < content.length; end += 1) {
    if (content[end] === '[') depth += 1;
    if (content[end] === ']') {
      depth -= 1;
      if (depth === 0) return content.slice(arrayStart, end + 1);
    }
  }
  return null;
}

function extractOverflowRegions(content) {
  const regions = [];
  const marker = 'renderRowActionsOverflow(';
  let idx = 0;
  while (true) {
    const start = content.indexOf(marker, idx);
    if (start < 0) break;
    const arrayStart = content.indexOf('[', start);
    if (arrayStart < 0) break;
    const region = extractBracketArray(content, arrayStart);
    if (region) regions.push(region);
    idx = start + marker.length;
  }
  return regions;
}

function extractInlineSpaceRegions(content) {
  const regions = [];
  if (!content.includes('ROW_ACTIONS_INLINE_GAP')) return regions;
  const re = /<Space[^>]*ROW_ACTIONS_INLINE_GAP[^>]*>([\s\S]*?)<\/Space>/g;
  let m;
  while ((m = re.exec(content))) {
    regions.push(m[1]);
  }
  return regions;
}

function extractOptionReturnArrays(content) {
  const regions = [];
  if (!content.includes("valueType: 'option'") && !content.includes('valueType: "option"')) {
    return regions;
  }
  const optionRe = /valueType:\s*['"]option['"]/g;
  let m;
  while ((m = optionRe.exec(content))) {
    const slice = content.slice(m.index, m.index + 1200);
    const returnIdx = slice.search(/render:[\s\S]*?return\s*\[/);
    if (returnIdx < 0) continue;
    const absArrayStart = m.index + returnIdx + slice.slice(returnIdx).indexOf('[');
    const region = extractBracketArray(content, absArrayStart);
    if (region && /<Button|<Popconfirm|<Dropdown|<UniWorkflowActions/.test(region)) {
      regions.push(region);
    }
  }
  return regions;
}

function extractOptionPlainSpaceRegions(content) {
  const regions = [];
  if (!content.includes("valueType: 'option'") && !content.includes('valueType: "option"')) {
    return regions;
  }
  const optionRe = /valueType:\s*['"]option['"]/g;
  let m;
  while ((m = optionRe.exec(content))) {
    const slice = content.slice(m.index, m.index + 2500);
    const renderIdx = slice.indexOf('render:');
    if (renderIdx < 0) continue;
    const renderSlice = slice.slice(renderIdx, renderIdx + 1800);
    const spaceMatch = renderSlice.match(/<Space([^>]*)>([\s\S]*?)<\/Space>/);
    if (!spaceMatch) continue;
    if (spaceMatch[1].includes('ROW_ACTIONS_INLINE_GAP')) continue;
    regions.push(spaceMatch[2]);
  }
  return regions;
}

const SKIP_PATHS = [
  `${path.sep}components${path.sep}uni-action${path.sep}`,
  `${path.sep}components${path.sep}uni-document-actions${path.sep}`,
];

const all = [];
for (const file of walk(SRC)) {
  if (SKIP_PATHS.some((p) => file.includes(p))) continue;
  const content = fs.readFileSync(file, 'utf8');
  const rel = path.relative(SRC, file).replace(/\\/g, '/');

  for (const region of extractOverflowRegions(content)) {
    all.push(...scanRegionElements(region, rel, { requireKey: true }));
  }
  for (const region of extractOptionReturnArrays(content)) {
    all.push(...scanRegionElements(region, rel, { requireKey: true }));
  }
  for (const region of extractInlineSpaceRegions(content)) {
    all.push(...scanRegionElements(region, rel));
  }
  for (const region of extractOptionPlainSpaceRegions(content)) {
    all.push(...scanRegionElements(region, rel));
  }
}

if (all.length) {
  console.error('Missing data-action-kind on row actions:');
  for (const i of all) {
    console.error(`  ${i.file}: <${i.tag} key="${i.key}">`);
  }
  process.exit(1);
}
console.log('All scoped row actions have data-action-kind.');
