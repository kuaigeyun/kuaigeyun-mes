/**
 * 官方接口包修正弹窗（平台超管）
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { App, Button, Form, Input, Select, Space } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { FormModalTemplate } from '../../../components/layout-templates';
import {
  getOfficialApiLibraryAdminPack,
  updateOfficialApiLibraryAdminPack,
  type OfficialApiLibraryItem,
  type OfficialApiLibraryPack,
} from '../../../services/officialApiLibraryAdmin';

const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map(
  (method) => ({ label: method, value: method }),
);

export interface OfficialApiLibraryPackEditModalProps {
  open: boolean;
  packId: string | null;
  onClose: () => void;
  onSaved?: () => void;
}

type EditFormValues = {
  name: string;
  description?: string;
  connector_type: string;
  category_name: string;
  category_code?: string;
  category_description?: string;
  status: string;
  items: OfficialApiLibraryItem[];
};

export const OfficialApiLibraryPackEditModal: React.FC<OfficialApiLibraryPackEditModalProps> = ({
  open,
  packId,
  onClose,
  onSaved,
}) => {
  const { t } = useTranslation();
  const { message: messageApi } = App.useApp();
  const [form] = Form.useForm<EditFormValues>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pack, setPack] = useState<OfficialApiLibraryPack | null>(null);

  useEffect(() => {
    if (!open || !packId) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const detail = await getOfficialApiLibraryAdminPack(packId);
        if (cancelled) {
          return;
        }
        setPack(detail);
        form.setFieldsValue({
          name: detail.name,
          description: detail.description,
          connector_type: detail.connector_type,
          category_name: detail.category_name,
          category_code: detail.category_code,
          category_description: detail.category_description,
          status: detail.status || 'published',
          items: (detail.items || []).map((item) => ({
            item_key: item.item_key,
            name: item.name,
            description: item.description || '',
            path: item.path || '',
            method: (item.method || 'GET').toUpperCase(),
            request_headers: item.request_headers ?? null,
            request_params: item.request_params ?? null,
            request_body: item.request_body ?? null,
            response_format: item.response_format ?? null,
            response_example: item.response_example ?? null,
          })),
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        messageApi.error(err?.message || t('pages.infra.officialApiLibrary.loadPackFailed'));
        onClose();
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [form, messageApi, onClose, open, packId, t]);

  const handleFinish = async (values: EditFormValues) => {
    if (!packId) {
      return;
    }
    setSaving(true);
    try {
      await updateOfficialApiLibraryAdminPack(packId, {
        name: values.name,
        description: values.description,
        connector_type: values.connector_type,
        category_name: values.category_name,
        category_code: values.category_code,
        category_description: values.category_description,
        status: values.status,
        items: values.items,
      });
      messageApi.success(t('pages.infra.officialApiLibrary.updateSuccess'));
      onSaved?.();
      onClose();
    } catch (error: unknown) {
      const err = error as { message?: string };
      messageApi.error(err?.message || t('pages.infra.officialApiLibrary.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalTemplate
      title={t('pages.infra.officialApiLibrary.editTitle', {
        name: pack?.name || packId || '',
      })}
      open={open}
      onClose={onClose}
      form={form}
      grid={false}
      width={920}
      loading={loading || saving}
      onFinish={handleFinish}
    >
      <Form.Item
        name="name"
        label={t('pages.infra.officialApiLibrary.packName')}
        rules={[{ required: true, message: t('pages.infra.officialApiLibrary.packNameRequired') }]}
      >
        <Input />
      </Form.Item>
      <Form.Item name="description" label={t('pages.infra.officialApiLibrary.packDescription')}>
        <Input.TextArea rows={2} />
      </Form.Item>
      <Space wrap style={{ width: '100%' }} size={16}>
        <Form.Item
          name="connector_type"
          label={t('pages.infra.officialApiLibrary.connectorType')}
          rules={[
            { required: true, message: t('pages.infra.officialApiLibrary.connectorTypeRequired') },
          ]}
          style={{ minWidth: 200, flex: 1 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="category_name"
          label={t('pages.infra.officialApiLibrary.categoryName')}
          rules={[
            { required: true, message: t('pages.infra.officialApiLibrary.categoryNameRequired') },
          ]}
          style={{ minWidth: 200, flex: 1 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="status"
          label={t('pages.infra.officialApiLibrary.status')}
          rules={[{ required: true }]}
          style={{ minWidth: 160 }}
        >
          <Select
            options={[
              {
                label: t('pages.infra.officialApiLibrary.statusPublished'),
                value: 'published',
              },
              {
                label: t('pages.infra.officialApiLibrary.statusRejected'),
                value: 'rejected',
              },
            ]}
          />
        </Form.Item>
      </Space>
      <Space wrap style={{ width: '100%' }} size={16}>
        <Form.Item
          name="category_code"
          label={t('pages.infra.officialApiLibrary.categoryCode')}
          style={{ minWidth: 200, flex: 1 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="category_description"
          label={t('pages.infra.officialApiLibrary.categoryDescription')}
          style={{ minWidth: 280, flex: 2 }}
        >
          <Input />
        </Form.Item>
      </Space>

      <Form.List name="items">
        {(fields, { add, remove }) => (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <strong>{t('pages.infra.officialApiLibrary.itemsTitle')}</strong>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() =>
                  add({
                    item_key: '',
                    name: '',
                    description: '',
                    path: '',
                    method: 'GET',
                  })
                }
              >
                {t('pages.infra.officialApiLibrary.addItem')}
              </Button>
            </div>
            {fields.map((field) => (
              <div
                key={field.key}
                style={{
                  border: '1px solid var(--river-divider-color, #f0f0f0)',
                  borderRadius: 8,
                  padding: 12,
                  marginBottom: 12,
                }}
              >
                <Space wrap style={{ width: '100%' }} size={12} align="start">
                  <Form.Item
                    {...field}
                    name={[field.name, 'item_key']}
                    label={t('pages.infra.officialApiLibrary.itemKey')}
                    rules={[{ required: true }]}
                    style={{ minWidth: 140 }}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    {...field}
                    name={[field.name, 'name']}
                    label={t('pages.infra.officialApiLibrary.itemName')}
                    rules={[{ required: true }]}
                    style={{ minWidth: 160 }}
                  >
                    <Input />
                  </Form.Item>
                  <Form.Item
                    {...field}
                    name={[field.name, 'method']}
                    label={t('pages.infra.officialApiLibrary.itemMethod')}
                    rules={[{ required: true }]}
                    style={{ width: 120 }}
                  >
                    <Select options={METHOD_OPTIONS} />
                  </Form.Item>
                  <Form.Item
                    {...field}
                    name={[field.name, 'path']}
                    label={t('pages.infra.officialApiLibrary.itemPath')}
                    rules={[{ required: true }]}
                    style={{ minWidth: 220, flex: 1 }}
                  >
                    <Input />
                  </Form.Item>
                  <Button
                    type="link"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => remove(field.name)}
                    style={{ marginTop: 30 }}
                  />
                </Space>
                <Form.Item
                  {...field}
                  name={[field.name, 'description']}
                  label={t('pages.infra.officialApiLibrary.itemDescription')}
                >
                  <Input.TextArea rows={1} />
                </Form.Item>
              </div>
            ))}
          </div>
        )}
      </Form.List>
    </FormModalTemplate>
  );
};

export default OfficialApiLibraryPackEditModal;
