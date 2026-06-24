/**
 * 品质单据 — 制令单 ERP 数据集关联配置（对齐设备产出单 / 模具领用单）
 */

import React, { useCallback, useEffect, useState } from 'react';
import { rowActionKind } from '../../../../../components/uni-action';
import { Alert, AutoComplete, Button, Col, Form, Modal, Row, Select, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  putQualityWorkOrderDatasetBinding,
  type QualityWorkOrderDatasetBindingPayload,
} from '../../../services/haoligo';
import { executeDatasetQuery, getDatasetByUuid, getDatasetList } from '../../../../../services/dataset';
import { extractSqlNamedParams } from '../../../../../utils/extractSqlNamedParams';

function normalizeDatasetParameterMap(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim();
    if (!key) continue;
    if (v === null || v === undefined) continue;
    if (typeof v === 'number' || typeof v === 'boolean') {
      out[key] = v;
    } else {
      const s = String(v).trim();
      if (s !== '') out[key] = s;
    }
  }
  return out;
}

type QualityWorkOrderDatasetBindingModalProps = {
  open: boolean;
  binding: QualityWorkOrderDatasetBindingPayload | null;
  onClose: () => void;
  onSaved: (binding: QualityWorkOrderDatasetBindingPayload | null) => void;
};

export const QualityWorkOrderDatasetBindingModal: React.FC<QualityWorkOrderDatasetBindingModalProps> = ({
  open,
  binding,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm<QualityWorkOrderDatasetBindingPayload>();
  const datasetUuidWatched = Form.useWatch('dataset_uuid', form);
  const [datasetSelectOptions, setDatasetSelectOptions] = useState<{ label: string; value: string }[]>([]);
  const [bindingColumnOptions, setBindingColumnOptions] = useState<{ value: string; label: string }[]>([]);
  const [bindingColumnsLoading, setBindingColumnsLoading] = useState(false);
  const [bindingModalBusy, setBindingModalBusy] = useState(false);
  const [datasetParamKeyOptions, setDatasetParamKeyOptions] = useState<{ value: string; label: string }[]>([]);
  const [datasetParamKeysLoading, setDatasetParamKeysLoading] = useState(false);

  const loadBindingDatasetColumns = useCallback(
    async (opts?: { silent?: boolean }) => {
      const uuid = String(datasetUuidWatched ?? '').trim();
      if (!uuid) {
        setBindingColumnOptions([]);
        return;
      }
      setBindingColumnsLoading(true);
      try {
        const ds = await getDatasetByUuid(uuid);
        const cfg = (ds.query_config || {}) as { parameters?: Record<string, unknown> };
        const defaultsRaw =
          cfg.parameters && typeof cfg.parameters === 'object' && !Array.isArray(cfg.parameters)
            ? (cfg.parameters as Record<string, unknown>)
            : {};
        const merged = normalizeDatasetParameterMap(defaultsRaw);
        const res = await executeDatasetQuery(uuid, {
          parameters: merged,
          fill_missing_sql_parameters: true,
          limit: 5,
          offset: 0,
        });
        const raw = res.columns?.length
          ? res.columns
          : res.data?.[0]
            ? Object.keys(res.data[0] as object)
            : [];
        const unique = [...new Set(raw.map((c) => String(c).trim()).filter(Boolean))];
        setBindingColumnOptions(unique.map((c) => ({ value: c, label: c })));
      } catch {
        setBindingColumnOptions([]);
      } finally {
        setBindingColumnsLoading(false);
      }
    },
    [datasetUuidWatched],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const options: { label: string; value: string }[] = [];
        let page = 1;
        const pageSize = 100;
        for (;;) {
          const res = await getDatasetList({ page, page_size: pageSize, is_active: true });
          const items = res.items ?? [];
          for (const d of items) {
            options.push({ label: `${d.name} (${d.code})`, value: d.uuid });
          }
          if (items.length < pageSize) break;
          page += 1;
        }
        if (!cancelled) setDatasetSelectOptions(options);
      } catch {
        if (!cancelled) setDatasetSelectOptions([]);
      }
    })();
    form.resetFields();
    form.setFieldsValue({
      dataset_uuid: binding?.dataset_uuid ?? undefined,
      work_order_param_key: binding?.work_order_param_key ?? undefined,
      workshop_name_column: binding?.workshop_name_column ?? undefined,
      production_line_column: binding?.production_line_column ?? undefined,
      equipment_asset_code_column: binding?.equipment_asset_code_column ?? undefined,
      mold_code_column: binding?.mold_code_column ?? undefined,
      finished_product_code_column: binding?.finished_product_code_column ?? undefined,
      finished_product_name_column: binding?.finished_product_name_column ?? undefined,
    });
    setBindingColumnOptions([]);
    return () => {
      cancelled = true;
    };
  }, [open, binding, form]);

  useEffect(() => {
    if (!open) return;
    const uuid = String(datasetUuidWatched ?? '').trim();
    if (!uuid) {
      setDatasetParamKeyOptions([]);
      setDatasetParamKeysLoading(false);
      return;
    }
    let cancelled = false;
    setDatasetParamKeysLoading(true);
    void (async () => {
      try {
        const ds = await getDatasetByUuid(uuid);
        if (cancelled) return;
        const cfg = (ds.query_config || {}) as { sql?: string; parameters?: Record<string, unknown> };
        let keys: string[] = [];
        if (cfg.parameters && typeof cfg.parameters === 'object' && !Array.isArray(cfg.parameters)) {
          keys = Object.keys(cfg.parameters)
            .map((k) => k.trim())
            .filter(Boolean);
        }
        if (keys.length === 0 && typeof cfg.sql === 'string') {
          keys = extractSqlNamedParams(cfg.sql);
        }
        const opts = keys.map((k) => ({ value: k, label: k }));
        const savedKey =
          binding?.dataset_uuid && String(binding.dataset_uuid).trim() === uuid
            ? String(binding.work_order_param_key ?? '').trim()
            : '';
        if (savedKey && !opts.some((o) => o.value === savedKey)) {
          opts.unshift({ value: savedKey, label: savedKey });
        }
        if (!cancelled) setDatasetParamKeyOptions(opts);
      } catch {
        if (!cancelled) setDatasetParamKeyOptions([]);
      } finally {
        if (!cancelled) setDatasetParamKeysLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, datasetUuidWatched, binding]);

  const handleSave = async () => {
    const ds = String(form.getFieldValue('dataset_uuid') ?? '').trim();
    if (!ds) {
      setBindingModalBusy(true);
      try {
        const saved = await putQualityWorkOrderDatasetBinding({});
        onSaved(saved?.dataset_uuid?.trim() ? saved : null);
        onClose();
      } finally {
        setBindingModalBusy(false);
      }
      return;
    }
    let v: QualityWorkOrderDatasetBindingPayload;
    try {
      v = await form.validateFields();
    } catch {
      return;
    }
    setBindingModalBusy(true);
    try {
      const saved = await putQualityWorkOrderDatasetBinding({
        dataset_uuid: ds,
        work_order_param_key: String(v.work_order_param_key ?? '').trim(),
        workshop_name_column: String(v.workshop_name_column ?? '').trim() || undefined,
        production_line_column: String(v.production_line_column ?? '').trim() || undefined,
        equipment_asset_code_column: String(v.equipment_asset_code_column ?? '').trim() || undefined,
        mold_code_column: String(v.mold_code_column ?? '').trim() || undefined,
        finished_product_code_column: String(v.finished_product_code_column ?? '').trim() || undefined,
        finished_product_name_column: String(v.finished_product_name_column ?? '').trim() || undefined,
      });
      onSaved(saved);
      onClose();
    } finally {
      setBindingModalBusy(false);
    }
  };

  const columnAutoComplete = (name: keyof QualityWorkOrderDatasetBindingPayload, label: string) => (
    <Col span={12} key={name}>
      <Form.Item name={name} label={label}>
        <AutoComplete
          allowClear
          options={bindingColumnOptions}
          filterOption={(input, option) =>
            String(option?.value ?? '')
              .toLowerCase()
              .includes(String(input).trim().toLowerCase())
          }
        />
      </Form.Item>
    </Col>
  );

  return (
    <Modal
      title={t('app.haoligo.quality.workOrder.datasetBindingTitle')}
      open={open}
      onCancel={onClose}
      width={720}
      destroyOnHidden
      footer={[
        <Button {...rowActionKind('revoke')} key="cancel" onClick={onClose}>
          {t('common.cancel')}
        </Button>,
        <Button {...rowActionKind('skip')} key="save" type="primary" loading={bindingModalBusy} onClick={() => void handleSave()}>
          {t('common.save')}
        </Button>,
      ]}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="dataset_uuid" label={t('app.haoligo.quality.workOrder.datasetSelect')}>
          <Select
            allowClear
            showSearch
            placeholder={t('app.haoligo.quality.workOrder.datasetSelectPh')}
            optionFilterProp="label"
            options={datasetSelectOptions}
            onChange={() => {
              form.setFieldsValue({
                work_order_param_key: undefined,
                workshop_name_column: undefined,
                production_line_column: undefined,
                equipment_asset_code_column: undefined,
                mold_code_column: undefined,
                finished_product_code_column: undefined,
                finished_product_name_column: undefined,
              });
              setBindingColumnOptions([]);
              setDatasetParamKeyOptions([]);
            }}
          />
        </Form.Item>
        <Spin spinning={datasetParamKeysLoading}>
          <Form.Item
            name="work_order_param_key"
            label={t('app.haoligo.equipment.settings.workOrderParamKey')}
            rules={[{ required: true, message: t('app.haoligo.quality.workOrder.datasetParamRequired') }]}
          >
            <AutoComplete
              allowClear
              style={{ width: '100%' }}
              options={datasetParamKeyOptions}
              placeholder={t('app.haoligo.equipment.documents.outputDatasetParamPh')}
              filterOption={(input, option) =>
                String(option?.value ?? '')
                  .toLowerCase()
                  .includes(String(input).trim().toLowerCase())
              }
            />
          </Form.Item>
        </Spin>
        <div style={{ marginBottom: 12 }}>
          <Button
            type="link"
            size="small"
            style={{ padding: 0 }}
            loading={bindingColumnsLoading}
            disabled={!datasetUuidWatched}
            onClick={() => void loadBindingDatasetColumns({ silent: false })}
          >
            {t('app.haoligo.equipment.documents.outputDatasetLoadColumns')}
          </Button>
        </div>
        <Row gutter={16}>
          {columnAutoComplete('workshop_name_column', t('app.haoligo.quality.workOrder.workshopNameColumn'))}
          {columnAutoComplete('production_line_column', t('app.haoligo.quality.workOrder.productionLineColumn'))}
          {columnAutoComplete('equipment_asset_code_column', t('app.haoligo.quality.workOrder.equipmentAssetCodeColumn'))}
          {columnAutoComplete('mold_code_column', t('app.haoligo.quality.workOrder.moldCodeColumn'))}
          {columnAutoComplete('finished_product_code_column', t('app.haoligo.equipment.settings.finishedProductCodeColumn'))}
          {columnAutoComplete('finished_product_name_column', t('app.haoligo.equipment.settings.finishedProductNameColumn'))}
        </Row>
        <Alert
          type="info"
          showIcon
          title={t('app.haoligo.equipment.documents.outputDatasetBindingHintTitle')}
          description={t('app.haoligo.quality.workOrder.datasetIntro')}
        />
      </Form>
    </Modal>
  );
};

export default QualityWorkOrderDatasetBindingModal;
