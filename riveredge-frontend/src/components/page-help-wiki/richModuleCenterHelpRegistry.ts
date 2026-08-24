import type { HelpFaqDef, HelpSectionDef } from './buildWikiFromSections';

export type RichModuleCenterHelpKey =
  | 'sales'
  | 'purchase'
  | 'warehouse'
  | 'production'
  | 'equipment'
  | 'finance'
  | 'quality'
  | 'kuaioa'
  | 'kuaiplm'
  | 'kuaiiot'
  | 'haoligo'
  | 'plan';

export const RICH_MODULE_CENTER_HELP_KEYS: RichModuleCenterHelpKey[] = [
  'sales',
  'purchase',
  'warehouse',
  'production',
  'equipment',
  'finance',
  'quality',
  'kuaioa',
  'kuaiplm',
  'kuaiiot',
  'haoligo',
  'plan',
];

const prefix = (moduleKey: RichModuleCenterHelpKey) => `help.moduleCenter.${moduleKey}`;

export function isRichModuleCenterHelpKey(key: string): key is RichModuleCenterHelpKey {
  return (RICH_MODULE_CENTER_HELP_KEYS as string[]).includes(key);
}

export function buildRichModuleCenterSections(moduleKey: RichModuleCenterHelpKey): HelpSectionDef[] {
  const p = prefix(moduleKey);
  return [
    {
      key: '1',
      labelKey: `${p}.overview.label`,
      titleKey: `${p}.overview.title`,
      bodyKeys: [`${p}.overview.p1`, `${p}.overview.p2`],
      bullets: [`${p}.overview.b1`, `${p}.overview.b2`, `${p}.overview.b3`],
    },
    {
      key: '2',
      labelKey: `${p}.layout.label`,
      titleKey: `${p}.layout.title`,
      bodyKeys: [`${p}.layout.p1`],
      bullets: [`${p}.layout.b1`, `${p}.layout.b2`, `${p}.layout.b3`, `${p}.layout.b4`],
    },
    {
      key: '3',
      labelKey: `${p}.panels.label`,
      titleKey: `${p}.panels.title`,
      bodyKeys: [`${p}.panels.p1`],
      bullets: [`${p}.panels.b1`, `${p}.panels.b2`, `${p}.panels.b3`, `${p}.panels.b4`],
    },
    {
      key: '4',
      labelKey: `${p}.shortcuts.label`,
      titleKey: `${p}.shortcuts.title`,
      bodyKeys: [`${p}.shortcuts.p1`],
      orderedSteps: [`${p}.shortcuts.s1`, `${p}.shortcuts.s2`, `${p}.shortcuts.s3`, `${p}.shortcuts.s4`],
    },
  ];
}

export function buildRichModuleCenterFaqs(moduleKey: RichModuleCenterHelpKey): HelpFaqDef[] {
  const p = prefix(moduleKey);
  return [
    { qKey: `${p}.faq.q1`, aKey: `${p}.faq.a1` },
    { qKey: `${p}.faq.q2`, aKey: `${p}.faq.a2` },
    { qKey: `${p}.faq.q3`, aKey: `${p}.faq.a3` },
    { qKey: `${p}.faq.q4`, aKey: `${p}.faq.a4` },
    { qKey: `${p}.faq.q5`, aKey: `${p}.faq.a5` },
    { qKey: `${p}.faq.q6`, aKey: `${p}.faq.a6` },
  ];
}
