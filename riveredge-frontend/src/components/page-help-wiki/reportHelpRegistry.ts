import type { HelpFaqDef, HelpSectionDef } from './buildWikiFromSections';

const REPORT_HELP_PREFIX = 'help.report.common';

export function buildReportHelpSections(): HelpSectionDef[] {
  const p = REPORT_HELP_PREFIX;
  return [
    {
      key: '1',
      labelKey: `${p}.overview.label`,
      titleKey: `${p}.overview.title`,
      bodyKeys: [`${p}.overview.p1`, `${p}.overview.p2`],
      bullets: [`${p}.overview.b1`, `${p}.overview.b2`, `${p}.overview.b3`, `${p}.overview.b4`],
    },
    {
      key: '2',
      labelKey: `${p}.filter.label`,
      titleKey: `${p}.filter.title`,
      bodyKeys: [`${p}.filter.p1`],
      bullets: [`${p}.filter.b1`, `${p}.filter.b2`, `${p}.filter.b3`, `${p}.filter.b4`, `${p}.filter.b5`],
      orderedSteps: [`${p}.filter.s1`, `${p}.filter.s2`, `${p}.filter.s3`, `${p}.filter.s4`],
    },
    {
      key: '3',
      labelKey: `${p}.read.label`,
      titleKey: `${p}.read.title`,
      bodyKeys: [`${p}.read.p1`, `${p}.read.p2`],
      bullets: [`${p}.read.b1`, `${p}.read.b2`, `${p}.read.b3`, `${p}.read.b4`, `${p}.read.b5`, `${p}.read.b6`],
      subsections: [
        {
          titleKey: `${p}.read.exportTitle`,
          bodyKeys: [`${p}.read.exportP1`],
          bullets: [`${p}.read.exportB1`, `${p}.read.exportB2`, `${p}.read.exportB3`],
        },
      ],
    },
  ];
}

export function buildReportHelpFaqs(): HelpFaqDef[] {
  const p = REPORT_HELP_PREFIX;
  return [
    { qKey: `${p}.faq.q1`, aKey: `${p}.faq.a1` },
    { qKey: `${p}.faq.q2`, aKey: `${p}.faq.a2` },
    { qKey: `${p}.faq.q3`, aKey: `${p}.faq.a3` },
    { qKey: `${p}.faq.q4`, aKey: `${p}.faq.a4` },
    { qKey: `${p}.faq.q5`, aKey: `${p}.faq.a5` },
    { qKey: `${p}.faq.q6`, aKey: `${p}.faq.a6` },
  ];
}
