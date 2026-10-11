/**
 * 接口测试响应体：表格 / JSON 预览切换
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented, Table, Typography } from 'antd';
import { CODE_FONT_FAMILY } from '../../../constants/fonts';
import {
  buildApiTestBodyTablePreview,
  extractKingdeeFieldKeys,
  formatApiTestBodyJson,
  type ApiTestTablePreview,
} from './apiTestResultPreview';
import './apiTestResultBodyPreview.css';

const { Text } = Typography;

const JSON_PRE_STYLE: React.CSSProperties = {
  margin: 0,
  padding: 8,
  backgroundColor: 'var(--ant-color-fill-quaternary)',
  borderRadius: 4,
  overflow: 'auto',
  fontSize: 12,
  fontFamily: CODE_FONT_FAMILY,
};

export type ApiTestBodyViewMode = 'table' | 'json';

export interface ApiTestResultBodyPreviewProps {
  body: unknown;
  testRequestJson: string;
}

export const ApiTestResultBodyPreview: React.FC<ApiTestResultBodyPreviewProps> = ({
  body,
  testRequestJson,
}) => {
  const { t } = useTranslation();

  const tablePreview = useMemo<ApiTestTablePreview | null>(() => {
    const fieldKeys = extractKingdeeFieldKeys(testRequestJson);
    return buildApiTestBodyTablePreview(body, fieldKeys);
  }, [body, testRequestJson]);

  const [viewMode, setViewMode] = useState<ApiTestBodyViewMode>('json');

  useEffect(() => {
    setViewMode(tablePreview ? 'table' : 'json');
  }, [tablePreview, body]);

  const jsonText = useMemo(() => formatApiTestBodyJson(body), [body]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <Text strong>{t('pages.system.apis.responseBodyLabel')}</Text>
        {tablePreview ? (
          <Segmented<ApiTestBodyViewMode>
            size="small"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { label: t('pages.system.apis.testResultViewTable'), value: 'table' },
              { label: t('pages.system.apis.testResultViewJson'), value: 'json' },
            ]}
          />
        ) : null}
      </div>

      {viewMode === 'table' && tablePreview ? (
        <div className="api-test-result-body-table">
          <Table
            size="small"
            bordered
            scroll={{ x: 'max-content' }}
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100'],
              style: { marginTop: 12, marginBottom: 0 },
            }}
            columns={tablePreview.columns}
            dataSource={tablePreview.dataSource}
          />
        </div>
      ) : (
        <pre style={{ ...JSON_PRE_STYLE, maxHeight: 400 }}>{jsonText}</pre>
      )}
    </div>
  );
};
