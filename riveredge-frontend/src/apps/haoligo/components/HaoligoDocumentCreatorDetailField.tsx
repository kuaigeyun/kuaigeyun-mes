import { Col, Descriptions } from 'antd';
import { ProFormText } from '@ant-design/pro-components';
import {
  resolveHaoligoDocumentCreatorName,
  type WithCreatorFields,
} from '../utils/documentTableColumns';

/** 详情表单 initialValues 注入创建人展示字段（只读，不参与提交） */
export function haoligoDocumentCreatorFormValue<T extends Record<string, unknown>>(
  values: T,
  row: WithCreatorFields,
): T & { creator_name: string } {
  return {
    ...values,
    creator_name: resolveHaoligoDocumentCreatorName(row),
  };
}

/** 详情/只读表单内「创建人」只读字段 */
export function HaoligoDocumentCreatorFormField({
  visible,
  colSpan = 12,
}: {
  visible: boolean;
  colSpan?: number;
}) {
  if (!visible) return null;
  return (
    <Col span={colSpan}>
      <ProFormText label="创建人" name="creator_name" readonly />
    </Col>
  );
}

/** Descriptions 详情块「创建人」项 */
export function HaoligoDocumentCreatorDescriptionsItem({
  row,
  span,
}: {
  row: WithCreatorFields;
  span?: number;
}) {
  return (
    <Descriptions.Item label="创建人" span={span}>
      {resolveHaoligoDocumentCreatorName(row)}
    </Descriptions.Item>
  );
}
