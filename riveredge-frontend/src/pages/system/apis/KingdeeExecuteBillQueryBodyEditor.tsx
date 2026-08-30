/**
 * 金蝶 ExecuteBillQuery Body 向导（编辑弹窗）
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Col, Input, InputNumber, Row, Select, Typography } from 'antd';
import { ApiTestResultBodyPreview } from './ApiTestResultBodyPreview';
import {
  buildExecuteBillQueryBody,
  parseExecuteBillQueryBody,
  type ExecuteBillQueryDraft,
  type KingdeeFormCatalogItem,
} from './kingdeeExecuteBillQuery';
import {
  getKingdeeExecuteBillQueryCatalog,
  probeAPIDraft,
  type APITestResponse,
} from '../../../services/apiManagement';
import { testConnection } from '../../../services/integrationConfig';
import { keyValueListToObject, type ApiKeyValueRow } from './apiFormUtils';
import {
  CustomFieldJsonEditor,
  type CustomFieldJsonEditorMode,
} from '../../../components/custom-fields/CustomFieldJsonEditor';
import { ThemedSegmented } from '../../../components/themed-segmented/ThemedSegmented';
import { ProForm, ProFormItem } from '@ant-design/pro-components';
import './kingdeeExecuteBillQueryBodyEditor.css';

export interface KingdeeExecuteBillQueryBodyEditorProps {
  connectionUuid?: string;
  path?: string;
  value?: unknown;
  requestHeaders?: ApiKeyValueRow[];
}

const resolveEditorMode = (body: unknown): CustomFieldJsonEditorMode =>
  parseExecuteBillQueryBody(body) ? 'kv' : 'source';

export const KingdeeExecuteBillQueryBodyEditor: React.FC<KingdeeExecuteBillQueryBodyEditorProps> = ({
  connectionUuid,
  path,
  value,
  requestHeaders,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const form = ProForm.useFormInstance();

  const [catalog, setCatalog] = useState<KingdeeFormCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [connectionTesting, setConnectionTesting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<APITestResponse | null>(null);
  const [mode, setMode] = useState<CustomFieldJsonEditorMode>(() => resolveEditorMode(value));

  const parsed = useMemo(() => parseExecuteBillQueryBody(value), [value]);

  const [draft, setDraft] = useState<ExecuteBillQueryDraft>(() => ({
    formId: parsed?.formId || '',
    fieldKeys: parsed?.fieldKeys || [],
    filterString: parsed?.filterString || '',
    orderString: parsed?.orderString || '',
    startRow: parsed?.startRow ?? 0,
    limit: parsed?.limit ?? 100,
  }));

  useEffect(() => {
    if (!parsed) return;
    setDraft({
      formId: parsed.formId,
      fieldKeys: parsed.fieldKeys,
      filterString: parsed.filterString,
      orderString: parsed.orderString,
      startRow: parsed.startRow,
      limit: parsed.limit,
    });
  }, [parsed?.formId, parsed?.fieldKeys.join(','), parsed?.filterString, parsed?.orderString, parsed?.startRow, parsed?.limit]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    void getKingdeeExecuteBillQueryCatalog()
      .then((items) => {
        if (!cancelled) setCatalog(items);
      })
      .catch(() => {
        if (!cancelled) setCatalog([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const currentFormCatalog = useMemo(
    () => catalog.find((item) => item.form_id === draft.formId),
    [catalog, draft.formId],
  );

  const fieldOptions = useMemo(() => {
    const optionMap = new Map<string, string>();
    currentFormCatalog?.fields.forEach((field) => {
      optionMap.set(field.key, field.label);
    });
    draft.fieldKeys.forEach((key) => {
      if (!optionMap.has(key)) {
        optionMap.set(key, key);
      }
    });
    return [...optionMap.entries()].map(([key, label]) => ({
      value: key,
      label: label === key ? key : `${label} (${key})`,
    }));
  }, [currentFormCatalog, draft.fieldKeys]);

  const applyDraft = useCallback(
    (nextDraft: ExecuteBillQueryDraft) => {
      setDraft(nextDraft);
      const nextBody = buildExecuteBillQueryBody(nextDraft, value);
      form.setFieldValue('request_body', nextBody);
      setPreviewResult(null);
    },
    [form, value],
  );

  const handleFormIdChange = (formId: string) => {
    const entry = catalog.find((item) => item.form_id === formId);
    applyDraft({
      ...draft,
      formId,
      fieldKeys: entry?.default_field_keys?.length ? [...entry.default_field_keys] : draft.fieldKeys,
    });
  };

  const handleModeChange = (nextMode: CustomFieldJsonEditorMode) => {
    if (nextMode === 'kv') {
      const currentBody = form.getFieldValue('request_body') ?? value;
      const nextParsed = parseExecuteBillQueryBody(currentBody);
      if (!nextParsed) {
        messageApi.warning(t('pages.system.apis.kingdeeWizard.cannotSwitchToWizard'));
        return;
      }
      setDraft(nextParsed);
      setMode('kv');
      return;
    }

    if (draft.formId) {
      form.setFieldValue('request_body', buildExecuteBillQueryBody(draft, value));
    }
    setMode('source');
  };

  const handleJsonChange = (next: unknown) => {
    form.setFieldValue('request_body', next);
    setPreviewResult(null);
    const nextParsed = parseExecuteBillQueryBody(next);
    if (nextParsed) {
      setDraft(nextParsed);
    }
  };

  const handleTestConnection = async () => {
    if (!connectionUuid) {
      messageApi.warning(t('pages.system.apis.kingdeeWizard.connectionRequired'));
      return;
    }
    setConnectionTesting(true);
    try {
      const result = await testConnection(connectionUuid);
      if (result.success) {
        messageApi.success(result.message || t('pages.system.apis.kingdeeWizard.connectionOk'));
      } else {
        messageApi.error(result.message || t('pages.system.apis.kingdeeWizard.connectionFailed'));
      }
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : t('pages.system.apis.kingdeeWizard.connectionFailed'),
      );
    } finally {
      setConnectionTesting(false);
    }
  };

  const handlePreviewQuery = async () => {
    if (!connectionUuid) {
      messageApi.warning(t('pages.system.apis.kingdeeWizard.connectionRequired'));
      return;
    }
    if (!path?.trim()) {
      messageApi.warning(t('pages.system.apis.pathRequired'));
      return;
    }
    if (!draft.formId) {
      messageApi.warning(t('pages.system.apis.kingdeeWizard.formIdRequired'));
      return;
    }
    if (draft.fieldKeys.length === 0) {
      messageApi.warning(t('pages.system.apis.kingdeeWizard.fieldKeysRequired'));
      return;
    }

    const body = buildExecuteBillQueryBody(draft, value);
    const headers = keyValueListToObject(requestHeaders);
    if (!headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const result = await probeAPIDraft({
        connection_uuid: connectionUuid,
        path,
        method: 'POST',
        request_headers: headers,
        request_body: body,
      });
      setPreviewResult(result);
      if (result.status_code >= 200 && result.status_code < 300) {
        messageApi.success(
          t('pages.system.apis.kingdeeWizard.previewOk', {
            count: Array.isArray(result.body) ? result.body.length : 0,
          }),
        );
      } else {
        messageApi.warning(t('pages.system.apis.kingdeeWizard.previewHttpError', { code: result.status_code }));
      }
    } catch (error: unknown) {
      messageApi.error(error instanceof Error ? error.message : t('pages.system.apis.kingdeeWizard.previewFailed'));
    } finally {
      setPreviewLoading(false);
    }
  };

  const previewTestRequestJson = useMemo(
    () => JSON.stringify({ body: buildExecuteBillQueryBody(draft, value) }),
    [draft, value],
  );

  const wizardPanel = (
    <div className="kingdee-ebq-wizard-panel">
      <Row gutter={16} className="kingdee-ebq-grid-row">
        <Col span={24}>
          <ProFormItem label={t('pages.system.apis.kingdeeWizard.formId')} required>
            <Select
              showSearch
              loading={catalogLoading}
              placeholder={t('pages.system.apis.kingdeeWizard.formIdPlaceholder')}
              value={draft.formId || undefined}
              optionFilterProp="label"
              options={catalog.map((item) => ({
                value: item.form_id,
                label: `${item.name} (${item.form_id})`,
              }))}
              onChange={handleFormIdChange}
            />
          </ProFormItem>
        </Col>
      </Row>

      <Row gutter={16} className="kingdee-ebq-grid-row">
        <Col span={24}>
          <ProFormItem label={t('pages.system.apis.kingdeeWizard.fieldKeys')} required>
            <Select
              mode="multiple"
              showSearch
              allowClear
              placeholder={t('pages.system.apis.kingdeeWizard.fieldKeysPlaceholder')}
              value={draft.fieldKeys}
              optionFilterProp="label"
              options={fieldOptions}
              onChange={(keys) => applyDraft({ ...draft, fieldKeys: keys as string[] })}
            />
          </ProFormItem>
        </Col>
      </Row>

      <Row gutter={16} align="bottom" className="kingdee-ebq-grid-row">
        <Col xs={24} sm={12} md={6}>
          <ProFormItem label={t('pages.system.apis.kingdeeWizard.filterString')}>
            <Input
              value={draft.filterString}
              placeholder={t('pages.system.apis.kingdeeWizard.filterStringPlaceholder')}
              onChange={(event) => applyDraft({ ...draft, filterString: event.target.value })}
            />
          </ProFormItem>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <ProFormItem label={t('pages.system.apis.kingdeeWizard.orderString')}>
            <Input
              value={draft.orderString}
              placeholder={t('pages.system.apis.kingdeeWizard.orderStringPlaceholder')}
              onChange={(event) => applyDraft({ ...draft, orderString: event.target.value })}
            />
          </ProFormItem>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <ProFormItem label={t('pages.system.apis.kingdeeWizard.startRow')}>
            <InputNumber
              min={0}
              precision={0}
              value={draft.startRow}
              onChange={(num) => applyDraft({ ...draft, startRow: Number(num ?? 0) })}
            />
          </ProFormItem>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <ProFormItem label={t('pages.system.apis.kingdeeWizard.limit')}>
            <InputNumber
              min={1}
              max={10000}
              precision={0}
              value={draft.limit}
              onChange={(num) => applyDraft({ ...draft, limit: Number(num ?? 100) })}
            />
          </ProFormItem>
        </Col>
      </Row>

      <Row gutter={16} className="kingdee-ebq-grid-row kingdee-ebq-actions-row">
        <Col span={24}>
          <div className="kingdee-ebq-action-buttons">
            <Button loading={connectionTesting} onClick={() => void handleTestConnection()}>
              {t('pages.system.apis.kingdeeWizard.testConnection')}
            </Button>
            <Button type="primary" loading={previewLoading} onClick={() => void handlePreviewQuery()}>
              {t('pages.system.apis.kingdeeWizard.previewQuery')}
            </Button>
          </div>
        </Col>
      </Row>

      {previewResult ? (
        <div className="kingdee-ebq-preview-result">
          <Typography.Text type="secondary">
            {t('pages.system.apis.statusCodeLabel')} {previewResult.status_code}{' '}
            {t('pages.system.apis.elapsedLabel')} {previewResult.elapsed_time}s
          </Typography.Text>
          <div style={{ marginTop: 8 }}>
            <ApiTestResultBodyPreview
              body={previewResult.body}
              testRequestJson={previewTestRequestJson}
            />
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="kingdee-ebq-body-editor api-form-json-field">
      <ProFormItem name="request_body" hidden />
      <Row align="middle" gutter={16} style={{ width: '100%', marginBottom: 8 }}>
        <Col flex="auto">
          <div className="ant-form-item-label" style={{ padding: 0, overflow: 'visible' }}>
            <label>{t('pages.system.apis.labelRequestBody')}</label>
          </div>
        </Col>
        <Col flex="none">
          <ThemedSegmented
            size="small"
            value={mode}
            onChange={(next) => handleModeChange(next as CustomFieldJsonEditorMode)}
            options={[
              { label: t('pages.system.apis.kingdeeWizard.modeWizard'), value: 'kv' },
              { label: t('pages.system.apis.kingdeeWizard.modeJson'), value: 'source' },
            ]}
          />
        </Col>
      </Row>

      {mode === 'kv' ? (
        wizardPanel
      ) : (
        <CustomFieldJsonEditor
          value={value}
          onChange={handleJsonChange}
          placeholder={t('pages.system.apis.bodyJsonPlaceholder')}
          showModeToggle={false}
          mode="source"
        />
      )}
    </div>
  );
};
