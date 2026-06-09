/**
 * 修复 option 裸 Space 操作列：逐元素推断 kind，纠正批量迁移误判。
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
  const rules = [
    [/handleDelete|handleDeleteOne|handleDeleteRow|handleDeleteTask|handleDeleteMaterial|handleDeleteDrawing|deleteConfirm|deleteRowConfirm|DeleteOutlined/, 'delete', 'delete'],
    [/handleRelease|SendOutlined|release|\.release\(/, 'submit', 'submit'],
    [/handleRevision|createRevision|newRevision|BranchesOutlined/, 'create', 'create'],
    [/handleObsolete|StopOutlined|obsolete/, 'obsolete', 'obsolete'],
    [/approveTenant|handleApprove|CheckOutlined|CheckCircleOutlined|handleProcessTask\([^,]+,\s*['"]approve['"]|tenant\.approve|审批/, 'approve', 'audit'],
    [/rejectTenant|CloseOutlined|CloseCircleOutlined|handleProcessTask\([^,]+,\s*['"]reject['"]|tenant\.reject/, 'reject', 'reject'],
    [/revokePlatformLicense|revokeTitle|revokeConfirm|\.revoke\(/, 'revoke', 'revoke'],
    [/activateTenant|activateConfirm|tenant\.activate/, 'activate', 'update'],
    [/deactivateTenant|deactivateConfirm|tenant\.deactivate/, 'deactivate', 'update'],
    [/CopyOutlined|copyKey|clipboard\.writeText/, 'copy', 'read'],
    [/HighlightOutlined|goDesigner|\/designer\?|designer\?uuid/, 'design', 'update'],
    [/ThunderboltOutlined|handleTestConnection|testConnection/, 'test', 'read'],
    [/PauseCircleOutlined|handleStop|scheduledTask\.stop/, 'stop', 'execute'],
    [/PlayCircleOutlined|handleStart|scheduledTask\.start|handleExecute|执行检验|conductVisible|推进阶段|transitionVisible|执行/, 'execute', 'execute'],
    [/openRemediate\([^,]+,\s*false|ToolOutlined|治理/, 'remediate', 'update'],
    [/EyeOutlined|handleView|handleOpenDetail|handleDetail|handleViewMaterial|loadDetail|openPreview|\.preview/, 'view', 'read'],
    [/EditOutlined|handleEdit|handleEditMaterial|openEditModal/, 'edit', 'update'],
  ];

  for (const [re, key, kind] of rules) {
    if (re.test(block)) return { key, kind };
  }

  if (tagName === 'Popconfirm' && /onConfirm/.test(block)) {
    if (/danger|DeleteOutlined|delete/i.test(block)) return { key: 'delete', kind: 'delete' };
    if (/approve|Approve|CheckOutlined/i.test(block)) return { key: 'approve', kind: 'audit' };
    if (/reject|Reject|CloseOutlined/i.test(block)) return { key: 'reject', kind: 'reject' };
    if (/activate/i.test(block)) return { key: 'activate', kind: 'update' };
    if (/deactivate/i.test(block)) return { key: 'deactivate', kind: 'update' };
  }

  return null;
}

function extractNextElement(text, fromIndex) {
  const pop = text.indexOf('<Popconfirm', fromIndex);
  const btn = text.indexOf('<Button', fromIndex);
  const drop = text.indexOf('<Dropdown', fromIndex);
  const uni = text.indexOf('<UniWorkflowActions', fromIndex);

  const candidates = [
    ['Popconfirm', pop],
    ['Button', btn],
    ['Dropdown', drop],
    ['UniWorkflowActions', uni],
  ].filter(([, i]) => i >= 0);

  if (!candidates.length) return null;
  candidates.sort((a, b) => a[1] - b[1]);
  const [tagName, start] = candidates[0];
  const closeTag = `</${tagName}>`;
  const closeIdx = text.indexOf(closeTag, start);
  if (closeIdx < 0) return null;
  const end = closeIdx + closeTag.length;
  return { tagName, start, end, block: text.slice(start, end) };
}

function stripActionMarks(openTagInner) {
  return openTagInner
    .replace(/\s*\{\.\.\.rowActionKind\([^)]*\)\}/g, '')
    .replace(/\s*\bkey=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s*data-action-kind=(?:"[^"]*"|'[^']*')/g, '');
}

function rebuildOpenTag(tagName, openTagInner, key, kind) {
  const cleaned = stripActionMarks(openTagInner).trimStart();
  return `<${tagName} key="${key}" {...rowActionKind('${kind}')}${cleaned ? ` ${cleaned}` : ''}>`;
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

    if (isInnerButton) {
      cursor = el.end;
      continue;
    }

    if (el.tagName === 'UniWorkflowActions') {
      if (!openTagInner.includes('rowActionKind') && !openTagInner.includes('data-action-kind')) {
        const newOpen = rebuildOpenTag('UniWorkflowActions', openTagInner, 'wf', 'skip');
        replacements.push({ start: el.start, end: el.start + openEnd + 1, newText: newOpen });
        changed = true;
      }
      cursor = el.end;
      continue;
    }

    const inferred = inferKindAndKey(el.tagName, el.block);
    if (!inferred) {
      unmapped.push({ tag: el.tagName, snippet: el.block.slice(0, 100) });
      cursor = el.end;
      continue;
    }

    const newOpen = rebuildOpenTag(el.tagName, openTagInner, inferred.key, inferred.kind);
    replacements.push({ start: el.start, end: el.start + openEnd + 1, newText: newOpen });
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
    unmapped.push(...regionUnmapped);
    if (!regionChanged) continue;
    changed = true;
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
  const original = fs.readFileSync(file, 'utf8');
  if (!original.includes("valueType: 'option'") && !original.includes('valueType: "option"')) continue;
  const { content, changed, unmapped } = processFile(original);
  if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    fileCount += 1;
    console.log('fixed', path.relative(SRC, file).replace(/\\/g, '/'));
  }
  if (unmapped.length) allUnmapped.push({ file: path.relative(SRC, file), unmapped });
}

console.log('files fixed:', fileCount);
if (allUnmapped.length) {
  console.warn('Still unmapped:');
  for (const { file, unmapped } of allUnmapped) {
    for (const u of unmapped) {
      console.warn(`  ${file}: <${u.tag}> ${u.snippet.replace(/\s+/g, ' ').trim()}`);
    }
  }
}
