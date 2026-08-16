import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProFormItem } from '@ant-design/pro-components';
import { Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { qualityImprovementApi } from '../../../services/quality-improvement';
import type { QmsEvidenceLink } from '../../../services/quality-qms';

const NC_TYPE = 'nonconforming_ledger';
const EIGHT_D_TYPE = 'quality_8d';

function linkKey(link: QmsEvidenceLink): string {
  return `${link.ref_type}:${link.ref_id ?? ''}`;
}

export function splitFindingLinks(links?: QmsEvidenceLink[]) {
  const ncIds: number[] = [];
  const eightDIds: number[] = [];
  for (const link of links || []) {
    if (link.ref_type === NC_TYPE && link.ref_id) ncIds.push(Number(link.ref_id));
    if (link.ref_type === EIGHT_D_TYPE && link.ref_id) eightDIds.push(Number(link.ref_id));
  }
  return { ncIds, eightDIds };
}

export function mergeFindingLinks(ncIds: number[], eightDIds: number[], cache: Map<string, QmsEvidenceLink>): QmsEvidenceLink[] {
  const out: QmsEvidenceLink[] = [];
  for (const id of ncIds) {
    const key = `${NC_TYPE}:${id}`;
    out.push(cache.get(key) || { ref_type: NC_TYPE, ref_id: id });
  }
  for (const id of eightDIds) {
    const key = `${EIGHT_D_TYPE}:${id}`;
    out.push(cache.get(key) || { ref_type: EIGHT_D_TYPE, ref_id: id });
  }
  return out;
}

type Props = {
  ncIds?: number[];
  eightDIds?: number[];
  onChange?: (links: QmsEvidenceLink[]) => void;
};

const QmsFindingLinksField: React.FC<Props> = ({ ncIds = [], eightDIds = [], onChange }) => {
  const { t } = useTranslation();
  const linkCacheRef = useRef<Map<string, QmsEvidenceLink>>(new Map());
  const [ncOptions, setNcOptions] = useState<{ label: string; value: number }[]>([]);
  const [eightDOptions, setEightDOptions] = useState<{ label: string; value: number }[]>([]);
  const [ncLoading, setNcLoading] = useState(false);
  const [eightDLoading, setEightDLoading] = useState(false);

  const emitChange = useCallback(
    (nextNc: number[], next8d: number[]) => {
      onChange?.(mergeFindingLinks(nextNc, next8d, linkCacheRef.current));
    },
    [onChange],
  );

  const searchNc = useCallback(async (keyword?: string) => {
    setNcLoading(true);
    try {
      const res = await qualityImprovementApi.nonconformingLedger.list({
        skip: 0,
        limit: 30,
        keyword: keyword?.trim() || undefined,
      });
      const opts = (res.data || []).map((row) => {
        const code = String((row as { code?: string }).code || row.id);
        const label = `${code} ${(row as { product_name?: string }).product_name || ''}`.trim();
        linkCacheRef.current.set(`${NC_TYPE}:${row.id}`, {
          ref_type: NC_TYPE,
          ref_id: row.id,
          ref_code: code,
          ref_name: (row as { product_name?: string }).product_name,
        });
        return { label, value: Number(row.id) };
      });
      setNcOptions(opts);
    } finally {
      setNcLoading(false);
    }
  }, []);

  const search8d = useCallback(async (keyword?: string) => {
    setEightDLoading(true);
    try {
      const res = await qualityImprovementApi.eightD.list({
        skip: 0,
        limit: 30,
        keyword: keyword?.trim() || undefined,
      });
      const opts = (res.items || []).map((row) => {
        const code = String(row.report_code || row.id);
        const label = `${code} ${row.title || ''}`.trim();
        linkCacheRef.current.set(`${EIGHT_D_TYPE}:${row.id}`, {
          ref_type: EIGHT_D_TYPE,
          ref_id: row.id,
          ref_code: code,
          ref_name: row.title,
        });
        return { label, value: Number(row.id) };
      });
      setEightDOptions(opts);
    } finally {
      setEightDLoading(false);
    }
  }, []);

  useEffect(() => {
    void searchNc();
    void search8d();
  }, [search8d, searchNc]);

  return (
    <>
      <ProFormItem label={t('app.kuaizhizao.quality.qms.findingLinksNc')} tooltip={t('app.kuaizhizao.quality.qms.findingLinksHint')}>
        <Select
          mode="multiple"
          allowClear
          showSearch
          filterOption={false}
          loading={ncLoading}
          options={ncOptions}
          value={ncIds}
          placeholder={t('app.kuaizhizao.quality.qms.findingLinksNcPlaceholder')}
          onSearch={(val) => void searchNc(val)}
          onChange={(vals) => emitChange(vals as number[], eightDIds)}
        />
      </ProFormItem>
      <ProFormItem label={t('app.kuaizhizao.quality.qms.findingLinks8d')}>
        <Select
          mode="multiple"
          allowClear
          showSearch
          filterOption={false}
          loading={eightDLoading}
          options={eightDOptions}
          value={eightDIds}
          placeholder={t('app.kuaizhizao.quality.qms.findingLinks8dPlaceholder')}
          onSearch={(val) => void search8d(val)}
          onChange={(vals) => emitChange(ncIds, vals as number[])}
        />
      </ProFormItem>
    </>
  );
};

export default QmsFindingLinksField;
