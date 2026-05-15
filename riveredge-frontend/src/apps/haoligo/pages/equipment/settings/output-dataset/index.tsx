/**
 * 好力 GO — 设备产出数据集配置（按制令单号查询并映射列）
 */

import React, { useEffect, useState } from 'react';
import { App, Button, Card, Form, Input, Select, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ListPageTemplate } from '../../../../../../components/layout-templates';
import { getDatasetList, type Dataset } from '../../../../../../services/dataset';
import {
  getEquipmentOutputDatasetBinding,
  putEquipmentOutputDatasetBinding,
  type EquipmentOutputDatasetBindingPayload,
} from '../../../../services/haoligo';

const EquipmentOutputDatasetSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<EquipmentOutputDatasetBindingPayload>();
  const [loading, setLoading] = useState(false);
  const [datasetOptions, setDatasetOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await getEquipmentOutputDatasetBinding();
        if (cancelled) return;
        form.setFieldsValue(b);
      } catch {
        if (!cancelled) form.resetFields();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [form]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const out: { label: string; value: string }[] = [];
        let page = 1;
        const pageSize = 100;
        for (;;) {
          const res = await getDatasetList({ page, page_size: pageSize });
          const items: Dataset[] = res.items || [];
          for (const d of items) {
            out.push({ label: d.name || d.uuid, value: d.uuid });
          }
          if (items.length < pageSize) break;
          page += 1;
          if (page > 50) break;
        }
        if (!cancelled) setDatasetOptions(out);
      } catch {
        if (!cancelled) setDatasetOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSave = async () => {
    const v = await form.validateFields();
    setLoading(true);
    try {
      const saved = await putEquipmentOutputDatasetBinding(v);
      form.setFieldsValue(saved);
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const onClear = async () => {
    setLoading(true);
    try {
      await putEquipmentOutputDatasetBinding({});
      form.resetFields();
      messageApi.success(t('app.haoligo.equipment.updateSuccess'));
    } catch (e) {
      messageApi.error((e as Error).message || t('app.haoligo.equipment.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ListPageTemplate>
      <Card title={t('app.haoligo.menu.equipment.settings.output-dataset')}>
        <Typography.Paragraph type="secondary">
          {t('app.haoligo.equipment.settings.outputDatasetIntro')}
        </Typography.Paragraph>
        <Form form={form} layout="vertical" style={{ maxWidth: 560 }}>
          <Form.Item name="dataset_uuid" label={t('app.haoligo.equipment.settings.outputDatasetSelect')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={datasetOptions}
              placeholder={t('app.haoligo.equipment.settings.outputDatasetSelectPh')}
            />
          </Form.Item>
          <Form.Item name="work_order_param_key" label={t('app.haoligo.equipment.settings.workOrderParamKey')}>
            <Input placeholder="e.g. work_order_no" />
          </Form.Item>
          <Form.Item name="customer_column" label={t('app.haoligo.equipment.settings.customerColumn')}>
            <Input />
          </Form.Item>
          <Form.Item name="product_name_column" label={t('app.haoligo.equipment.settings.productColumn')}>
            <Input />
          </Form.Item>
          <Form.Item name="planned_qty_column" label={t('app.haoligo.equipment.settings.plannedQtyColumn')}>
            <Input />
          </Form.Item>
          <Space>
            <Button type="primary" loading={loading} onClick={() => void onSave()}>
              {t('app.haoligo.equipment.documents.btnSave')}
            </Button>
            <Button loading={loading} onClick={() => void onClear()}>
              {t('app.haoligo.equipment.settings.clearBinding')}
            </Button>
          </Space>
        </Form>
      </Card>
    </ListPageTemplate>
  );
};

export default EquipmentOutputDatasetSettingsPage;
