import React, { useMemo } from 'react';
import { createUsePuck } from '@measured/puck';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import './puckChrome.css';

const useChromePuck = createUsePuck();

export type PuckChromeLabels = {
  components: string;
  outline: string;
  page: string;
  noItems: string;
};

export function readPuckChromeLabels(t: TFunction): PuckChromeLabels {
  return {
    components: t('components.puckChrome.components'),
    outline: t('components.puckChrome.outline'),
    page: t('components.puckChrome.page'),
    noItems: t('components.puckChrome.noItems'),
  };
}

export function puckChromeRootProps(labels: PuckChromeLabels): {
  className: string;
  style: React.CSSProperties;
} {
  return {
    className: 'puck-chrome-i18n',
    style: {
      ['--puck-i18n-no-items' as string]: JSON.stringify(labels.noItems),
    },
  };
}

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="puck-chrome-section-title">{children}</div>
);

const FieldsTitle: React.FC<{ pageLabel: string }> = ({ pageLabel }) => {
  const selectedItem = useChromePuck((s) => s.selectedItem);
  const selectedLabel = useChromePuck((s) => {
    if (!s.selectedItem) return '';
    const type = String(s.selectedItem.type);
    const label = s.config.components[type]?.label;
    return typeof label === 'string' && label.trim() ? label : type;
  });
  return (
    <div className="puck-chrome-fields-title">{selectedItem ? selectedLabel : pageLabel}</div>
  );
};

export function usePuckChrome() {
  const { t } = useTranslation();
  const labels = useMemo(() => readPuckChromeLabels(t), [t]);
  const rootProps = useMemo(() => puckChromeRootProps(labels), [labels]);

  const chromeOverrides = useMemo(
    () => ({
      drawer: ({ children }: { children: React.ReactNode }) => (
        <>
          <SectionTitle>{labels.components}</SectionTitle>
          {children}
        </>
      ),
      outline: ({ children }: { children: React.ReactNode }) => (
        <>
          <SectionTitle>{labels.outline}</SectionTitle>
          {children}
        </>
      ),
      fields: ({ children }: { children: React.ReactNode }) => (
        <>
          <FieldsTitle pageLabel={labels.page} />
          {children}
        </>
      ),
    }),
    [labels],
  );

  return { labels, rootProps, chromeOverrides };
}
