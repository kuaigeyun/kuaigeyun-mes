/**
 * 隐患治理表单 05～08（用于治理 Modal）
 */

import React from 'react';
import { Typography } from 'antd';
import { ProFormDateTimePicker, ProFormSelect, ProFormTextArea } from '@ant-design/pro-components';
import { uploadFile, type FileUploadResponse } from '../../../../../services/file';
import { SecurePictureCardUpload } from '../../../components/SecurePictureCardUpload';
import { PatrolImagePreview } from './PatrolImagePreview';

const { Text } = Typography;

function SectionLabel({ num, label }: { num: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
      <Text style={{ color: '#1677ff', fontWeight: 700, fontSize: 16, minWidth: 28 }}>{num}</Text>
      <Text style={{ fontWeight: 500, fontSize: 15 }}>{label}</Text>
    </div>
  );
}

export interface RemediationFormBodyProps {
  userOptions: { label: string; value: string }[];
  afterUuids: string[];
  onAfterUuidsChange: (uuids: string[]) => void;
  readOnly?: boolean;
}

export const RemediationFormBody: React.FC<RemediationFormBodyProps> = ({
  userOptions,
  afterUuids,
  onAfterUuidsChange,
  readOnly,
}) => {
  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <SectionLabel num="05" label="解决方案" />
        <ProFormTextArea
          name="solution_note"
          placeholder="请输入"
          fieldProps={{ rows: 4, disabled: readOnly }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <SectionLabel num="06" label="处理后照片（选填）" />
        {readOnly ? (
          <PatrolImagePreview uuids={afterUuids} emptyText="无" />
        ) : (
          <SecurePictureCardUpload
            uuids={afterUuids}
            onUuidsChange={onAfterUuidsChange}
            accept=".jpg,.jpeg,.png,.gif,.webp"
            customRequest={async (options) => {
              try {
                const file = options.file as File;
                const res: FileUploadResponse = await uploadFile(file, { category: 'haoligo_patrol_hazard' });
                options.onSuccess?.(res, options.file);
              } catch (e) {
                options.onError?.(e instanceof Error ? e : new Error(String(e)));
              }
            }}
          />
        )}
      </div>
      <div style={{ marginBottom: 12 }}>
        <SectionLabel num="07" label="处理时间" />
        <ProFormDateTimePicker
          name="handled_at"
          placeholder="请选择"
          fieldProps={{ style: { width: '100%' }, format: 'YYYY-MM-DD HH:mm', disabled: readOnly }}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <SectionLabel num="08" label="处理人" />
        <ProFormSelect
          name="handler_name"
          placeholder="请选择"
          options={userOptions}
          fieldProps={{ showSearch: true, optionFilterProp: 'label', allowClear: true, disabled: readOnly }}
        />
      </div>
    </>
  );
};
