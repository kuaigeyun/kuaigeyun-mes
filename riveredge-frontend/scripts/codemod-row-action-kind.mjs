/**
 * 为行内操作补全 rowActionKind（源码迁移，非运行时）。
 */
import fs from 'fs';
import path from 'path';

const SRC = 'src';

const KEY_KIND = {
  view: 'read', v: 'read', det: 'read', d: 'read', detail: 'read',
  edit: 'update', e: 'update', ed: 'update',
  design: 'update', designer: 'update', reset: 'update', sync: 'update',
  install: 'update', uninstall: 'update', corr: 'update', corr2: 'update',
  rules: 'update', 'terms-manage': 'update', 'loadPreset': 'import',
  'load-presets': 'import', initialize: 'update', translations: 'read',
  items: 'read', scan: 'read', trace: 'read', share: 'read', mount: 'update',
  delete: 'delete', del: 'delete', del2: 'delete', 'batch-delete': 'delete',
  batchDelete: 'delete', 'batchDelete': 'delete',
  copy: 'create', create: 'create', new: 'create', nf: 'create',
  'add-child': 'create', addChild: 'create', 'batch-create': 'create',
  'batchCreate': 'create', 'create-plan': 'create', 'create-from-casting': 'create',
  test: 'read', execute: 'execute', ex: 'execute', exec: 'execute',
  approve: 'audit', ap: 'audit', unapprove: 'revoke', reject: 'reject',
  rj: 'reject', revoke: 'revoke', rv: 'revoke', cancel: 'revoke', ca: 'revoke',
  transfer: 'assign', assign: 'assign', submit: 'submit', sub: 'submit',
  st: 'submit', confirm: 'audit', cf: 'audit',
  print: 'print', export: 'export', import: 'import', upload: 'import',
  download: 'read', restore: 'update',
  more: 'skip', wf: 'skip', 'workflow-actions': 'skip', w: 'skip',
  inspect: 'execute', defect: 'create', push: 'submit',
  complete: 'complete', close: 'close', obsolete: 'obsolete',
  claim: 'claim', recycle: 'recycle', rc: 'recycle', release: 'release',
  dispatch: 'dispatch', recall: 'recall', preview: 'read', variables: 'read',
  render: 'print', 'cancel-tt': 'skip', 'push-tip': 'skip', 'del-tip': 'skip',
  'dedicated-binding': 'skip', 'from-po-tip': 'skip', 'merge-computation-tooltip': 'skip',
  withdraw: 'revoke', notify: 'dispatch', notifyInbound: 'dispatch',
  issue: 'dispatch', receipt: 'read', pay: 'execute', repair: 'update',
  rework: 'update', outsource: 'dispatch', split: 'update',
  unfreeze: 'update', freeze: 'update', smartRelease: 'release', ignore: 'skip',
  'dissolve-group': 'update', 'batch-revoke': 'revoke', scrap: 'obsolete',
  'batch-qrcode': 'read', 'batch-enable': 'update',
  'batch-disable': 'update', 'batch-read': 'update', checkout: 'update',
  'follow-up': 'create', quote: 'create', fu: 'create', ro: 'read', rp: 'print',
  'quotation-revision': 'create', 'quotation-print': 'print', 'contract-print': 'print',
  'merge-computation': 'execute', 'batch-level1-category': 'update',
  'adjustment-done': 'confirm_adjustment', 'from-mold-po': 'create',
  'from-pending-mold': 'create', 'mold-batch-lifecycle': 'update',
  'syncLineSide': 'update', 'toggleExpand': 'skip', setHome: 'update',
  clearBackendHome: 'update', remove: 'delete', p: 'print',
  'batch-qrcode': 'read', 'task-pool': 'read',
  ok: 'skip', save: 'skip', '?': 'skip',
  c: 'read', n: 'dispatch', 'to-pr': 'read',
  'from-notice': 'create', 'from-delivery': 'create', batch: 'skip',
  'move-up': 'skip', 'move-down': 'skip', 'batch-test': 'read',
};

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'node_modules' && e.name !== 'dist') walk(p, files);
    else if (/\.tsx$/.test(e.name)) files.push(p);
  }
  return files;
}

function needsContext(content) {
  return (
    content.includes('renderRowActionsOverflow') ||
    content.includes("valueType: 'option'") ||
    content.includes('valueType: "option"') ||
    content.includes('ROW_ACTIONS_INLINE_GAP')
  );
}

function resolveKindFromKey(key) {
  if (!key) return null;
  if (KEY_KIND[key]) return KEY_KIND[key];
  const base = key.split('-')[0];
  return KEY_KIND[base] || null;
}

function ensureImport(content, filePath) {
  if (/import\s*\{[^}]*\browActionKind\b/.test(content)) return content;

  const uniActionFromComponents = content.match(
    /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]*components\/uni-action)['"];/,
  );
  if (uniActionFromComponents) {
    const [, names, p] = uniActionFromComponents;
    if (names.includes('rowActionKind')) return content;
    return content.replace(uniActionFromComponents[0], `import {${names.trim()}, rowActionKind } from '${p}';`);
  }

  const overflowImport = content.match(
    /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];\s*\n(?=[^]*renderRowActionsOverflow)/,
  );
  if (overflowImport && overflowImport[1].includes('renderRowActionsOverflow')) {
    const [, names, p] = overflowImport;
    if (names.includes('rowActionKind')) return content;
    const nextNames = names.includes('renderRowActionsOverflow')
      ? `${names.trim()}, rowActionKind`
      : `${names.trim()}, renderRowActionsOverflow, rowActionKind`;
    return content.replace(overflowImport[0], `import { ${nextNames} } from '${p}';\n`);
  }

  const rel = path.relative(path.dirname(filePath), path.join(SRC, 'components/uni-action')).replace(/\\/g, '/');
  const importPath = rel.startsWith('.') ? rel : `./${rel}`;
  const m = content.match(/^import .+;\n/m);
  const insertAt = m ? content.indexOf(m[0]) + m[0].length : 0;
  return `${content.slice(0, insertAt)}import { rowActionKind } from '${importPath}';\n${content.slice(insertAt)}`;
}

function patchOpenTag(tagName, attrs, kind) {
  if (attrs.includes('rowActionKind') || attrs.includes('data-action-kind')) {
    return `<${tagName}${attrs}`;
  }
  return `<${tagName} {...rowActionKind('${kind}')}${attrs}`;
}

function processContent(content) {
  let changed = false;
  const tagNames = ['Button', 'Popconfirm', 'Dropdown', 'UniWorkflowActions', 'Tooltip', 'span'];

  for (const tag of tagNames) {
    const re = new RegExp(`<${tag}((?:\\s[^>]*)?)>`, 'g');
    content = content.replace(re, (full, attrs) => {
      if (attrs.includes('rowActionKind') || attrs.includes('data-action-kind')) return full;
      const keyMatch = attrs.match(/\bkey=(?:"([^"]+)"|'([^']+)'|\{['"]([^'"]+)['"]\})/);
      const key = keyMatch?.[1] || keyMatch?.[2] || keyMatch?.[3] || '';
      let kind = resolveKindFromKey(key);
      if (!kind && tag === 'UniWorkflowActions') kind = 'skip';
      if (!kind && tag === 'Dropdown') kind = 'skip';
      if (!kind) return full;
      changed = true;
      return `${patchOpenTag(tag, attrs, kind)}>`;
    });
  }
  return { content, changed };
}

let count = 0;
for (const file of walk(SRC)) {
  if (file.includes(`${path.sep}components${path.sep}uni-action${path.sep}`)) continue;
  const original = fs.readFileSync(file, 'utf8');
  if (!needsContext(original)) continue;
  const { content, changed } = processContent(original);
  if (!changed) continue;
  const next = ensureImport(content, file);
  fs.writeFileSync(file, next, 'utf8');
  count += 1;
  console.log('updated', path.relative(SRC, file));
}
console.log('files updated:', count);
