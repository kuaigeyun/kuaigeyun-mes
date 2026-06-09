/**
 * 为 valueType: 'option' 内裸 <Space> 操作列补 key + rowActionKind。
 */
import fs from 'fs';
import path from 'path';

const SRC = 'src';

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== 'dist') walk(p, files);
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
  return files;
}

function ensureImport(content, filePath) {
  if (/import\s*\{[^}]*\browActionKind\b/.test(content)) return content;

  const uniActionFromComponents = content.match(
    /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*components\/uni-action)['"];/,
  );
  if (uniActionFromComponents) {
    const [, names, p] = uniActionFromComponents;
    if (names.includes('rowActionKind')) return content;
    return content.replace(
      uniActionFromComponents[0],
      `import {${names.trim()}, rowActionKind } from '${p}';`,
    );
  }

  const rel = path
    .relative(path.dirname(filePath), path.join(SRC, 'components/uni-action'))
    .replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : `./${rel}`;
  const m = content.match(/^import .+;\n/m);
  const insertAt = m ? content.indexOf(m[0]) + m[0].length : 0;
  return `${content.slice(0, insertAt)}import { rowActionKind } from '${importPath}';\n${content.slice(insertAt)}`;
}

function extractOptionPlainSpaceRegions(content) {
  const regions = [];
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
    const absStart = m.index + renderIdx + renderSlice.indexOf(spaceMatch[0]);
    regions.push({
      start: absStart,
      end: absStart + spaceMatch[0].length,
      inner: spaceMatch[2],
    });
  }
  return regions;
}

function inferKindAndKey(tagName, block) {
  const ctx = block;

  const rules = [
    [/handleDelete|handleDeleteOne|handleDeleteRow|handleDeleteTask|handleDeleteMaterial|deleteConfirm|deleteRowConfirm|DeleteOutlined|handleDeleteRow/, 'delete', 'delete'],
    [/approveTenant|handleApprove|CheckOutlined|CheckCircleOutlined|handleProcessTask\([^,]+,\s*['"]approve['"]|tenant\.approve/, 'approve', 'audit'],
    [/rejectTenant|CloseOutlined|CloseCircleOutlined|handleProcessTask\([^,]+,\s*['"]reject['"]|tenant\.reject/, 'reject', 'reject'],
    [/revokePlatformLicense|revokeTitle|revokeConfirm|\.revoke\(/, 'revoke', 'revoke'],
    [/activateTenant|activateConfirm|tenant\.activate/, 'activate', 'update'],
    [/deactivateTenant|deactivateConfirm|tenant\.deactivate/, 'deactivate', 'update'],
    [/CopyOutlined|copyKey|clipboard\.writeText/, 'copy', 'read'],
    [/HighlightOutlined|goDesigner|\/designer\?|designer\?uuid/, 'design', 'update'],
    [/ThunderboltOutlined|handleTestConnection|testConnection/, 'test', 'read'],
    [/PauseCircleOutlined|handleStop|scheduledTask\.stop/, 'stop', 'execute'],
    [/PlayCircleOutlined|handleStart|scheduledTask\.start|handleExecute|执行检验|conductVisible|执行/, 'execute', 'execute'],
    [/EyeOutlined|handleView|handleOpenDetail|handleDetail|handleViewMaterial|openDetail/, 'view', 'read'],
    [/EditOutlined|handleEdit|handleEditMaterial|openEditModal/, 'edit', 'update'],
  ];

  for (const [re, key, kind] of rules) {
    if (re.test(ctx)) return { key, kind };
  }

  if (tagName === 'Popconfirm' && /onConfirm/.test(ctx)) {
    if (/danger|DeleteOutlined/.test(ctx)) return { key: 'delete', kind: 'delete' };
    if (/approve|Approve|CheckOutlined/.test(ctx)) return { key: 'approve', kind: 'audit' };
    if (/reject|Reject|CloseOutlined/.test(ctx)) return { key: 'reject', kind: 'reject' };
  }

  return null;
}

function extractNextElement(text, fromIndex) {
  let next = attrs
    .replace(/\s*\{\.\.\.rowActionKind\([^)]*\)\}/g, '')
    .replace(/\s*\bkey=(?:"[^"]*"|'[^']*')/g, '')
    .trimStart();
  return `<${tagName} key="${key}" {...rowActionKind('${kind}')}${next ? ` ${next}` : ''}>`;
}

function extractNextElement(text, fromIndex) {
  const tags = ['Popconfirm', 'Button', 'Dropdown', 'UniWorkflowActions'];
  let best = null;
  for (const tagName of tags) {
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

function processInner(inner) {
  let changed = false;
  const unmapped = [];
  let result = inner;
  let cursor = 0;
  const replacements = [];

  while (cursor < result.length) {
    const el = extractNextElement(result, cursor);
    if (!el) break;

    const openEnd = el.block.indexOf('>');
    const openTagInner = el.block.slice(el.tagName.length + 1, openEnd);
    const isInnerButton =
      el.tagName === 'Button' &&
      result.lastIndexOf('<Popconfirm', el.start) > result.lastIndexOf('</Popconfirm>', el.start);

    if (isInnerButton || openTagInner.includes('rowActionKind') || openTagInner.includes('data-action-kind')) {
      cursor = el.end;
      continue;
    }

    if (el.tagName === 'Dropdown') {
      replacements.push({
        start: el.start,
        end: el.start + openEnd + 1,
        newText: patchOpenTag('Dropdown', openTagInner, 'more', 'skip'),
      });
      changed = true;
      cursor = el.end;
      continue;
    }

    const inferred = inferKindAndKey(el.tagName, el.block);
    if (!inferred) {
      unmapped.push({ tag: el.tagName, snippet: el.block.slice(0, 120) });
      cursor = el.end;
      continue;
    }

    replacements.push({
      start: el.start,
      end: el.start + openEnd + 1,
      newText: patchOpenTag(el.tagName, openTagInner, inferred.key, inferred.kind),
    });
    changed = true;
    cursor = el.end;
  }

  for (let i = replacements.length - 1; i >= 0; i -= 1) {
    const { start, end, newText } = replacements[i];
    result = result.slice(0, start) + newText + result.slice(end);
  }

  return { inner: result, changed, unmapped };
}

function processFile(content) {
  const regions = extractOptionPlainSpaceRegions(content);
  if (!regions.length) return { content, changed: false, unmapped: [] };

  let changed = false;
  const unmapped = [];
  let offset = 0;
  let result = content;

  for (const region of regions) {
    const { inner, changed: regionChanged, unmapped: regionUnmapped } = processInner(region.inner);
    if (!regionChanged) {
      unmapped.push(...regionUnmapped);
      continue;
    }
    changed = true;
    unmapped.push(...regionUnmapped);
    const before = result.slice(0, region.start + offset);
    const oldSpaceInner = result.slice(region.start + offset, region.end + offset);
    const newSpaceInner = oldSpaceInner.replace(region.inner, inner);
    const after = result.slice(region.end + offset);
    result = before + newSpaceInner + after;
    offset += newSpaceInner.length - oldSpaceInner.length;
  }

  return { content: result, changed, unmapped };
}

let fileCount = 0;
const allUnmapped = [];

for (const file of walk(SRC)) {
  if (file.includes(`${path.sep}components${path.sep}uni-action${path.sep}`)) continue;
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes("valueType: 'option'") && !original.includes('valueType: "option"')) continue;

  const { content, changed, unmapped } = processFile(original);
  if (!changed) {
    if (unmapped.length) allUnmapped.push({ file, unmapped });
    continue;
  }

  const next = ensureImport(content, file);
  fs.writeFileSync(file, next, 'utf8');
  fileCount += 1;
  console.log('updated', path.relative(SRC, file).replace(/\\/g, '/'));
  if (unmapped.length) allUnmapped.push({ file: path.relative(SRC, file), unmapped });
}

console.log('files updated:', fileCount);
if (allUnmapped.length) {
  console.warn('Could not infer some actions (manual review):');
  for (const { file, unmapped } of allUnmapped) {
    for (const u of unmapped) {
      console.warn(`  ${file}: <${u.tag}> ${u.snippet.replace(/\s+/g, ' ').trim()}`);
    }
  }
}
