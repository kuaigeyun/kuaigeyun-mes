/**
 * 设备维保完成单：台账已绑保养方案自动带出；未绑定时可选方案并按保养项填记录。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProFormDependency, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Alert, Col, Form, Row, Spin, Typography } from 'antd';
import {
  fetchEquipmentUpkeepSchemeContext,
  fetchEquipmentUpkeepSchemeLinesBySet,
  type EquipmentUpkeepSchemeLineRow,
} from '../services/haoligo';
import {
  formatMultiselectMeasuredValue,
  normalizeMoldUpkeepValueType,
  parseMultiselectMeasuredValue,
} from '../utils/moldUpkeepParamValueType';

const { Text } = Typography;

type UpkeepSetOption = { value: number; label: string };

type Props = {
  readOnly?: boolean;
  upkeepSetOptions: UpkeepSetOption[];
  /** 来源维保单已选方案（优先于台账默认） */
  sourceUpkeepParamSetId?: number | null;
};

function UpkeepRecordLineField({
  line,
  idx,
  readOnly,
}: {
  line: EquipmentUpkeepSchemeLineRow;
  idx: number;
  readOnly?: boolean;
}) {
  const vt = normalizeMoldUpkeepValueType(line.value_type);
  const requiredRule = line.is_required ? [{ required: true, message: `请填写「${line.param_name}」` }] : undefined;

  if (vt === 'multiselect') {
    const options = (line.option_values ?? []).map((v) => ({ label: v, value: v }));
    return (
      <ProFormSelect
        name={['upkeep_record_lines', idx, 'record_value']}
        label={line.param_name}
        placeholder={options.length ? '请选择（可多选）' : '请先在保养项中配置多选候选项'}
        options={options}
        readonly={readOnly}
        disabled={!readOnly && options.length === 0}
        rules={requiredRule}
        convert={(v) => parseMultiselectMeasuredValue(typeof v === 'string' ? v : null)}
        transform={(v) => {
          if (Array.isArray(v)) return formatMultiselectMeasuredValue(v.map(String)) ?? '';
          return v ?? '';
        }}
        fieldProps={{
          mode: 'multiple',
          optionFilterProp: 'label',
          style: { width: '100%' },
          maxTagCount: 'responsive',
        }}
      />
    );
  }

  return (
    <ProFormTextArea
      name={['upkeep_record_lines', idx, 'record_value']}
      label={line.param_name}
      placeholder="请填写保养记录"
      rules={requiredRule}
      readonly={readOnly}
      fieldProps={{ rows: 2, maxLength: 2000, showCount: !readOnly }}
    />
  );
}

function EquipmentUpkeepRecordFieldsInner({
  equipmentId,
  upkeepParamSetId,
  sourceUpkeepParamSetId,
  readOnly,
  upkeepSetOptions,
}: Props & { equipmentId: number | undefined; upkeepParamSetId: number | undefined }) {
  const form = Form.useFormInstance();
  const [loading, setLoading] = useState(false);
  const [schemeLines, setSchemeLines] = useState<EquipmentUpkeepSchemeLineRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ledgerSuggestedSetId, setLedgerSuggestedSetId] = useState<number | null>(null);
  const lastEquipmentRef = useRef<number | null>(null);
  const loadedSetIdRef = useRef<number | null>(null);

  const mergeRecordLines = useCallback(
    (
      template: EquipmentUpkeepSchemeLineRow[],
      existing: { param_id: number; record_value?: string | null }[] | undefined,
    ) =>
      template.map((ln) => {
        const prev = (existing ?? []).find((x) => x.param_id === ln.param_id);
        return {
          param_id: ln.param_id,
          record_value: prev?.record_value != null ? String(prev.record_value) : '',
        };
      }),
    [],
  );

  const loadLinesBySetId = useCallback(
    async (setId: number) => {
      setLoading(true);
      setLoadError(null);
      try {
        const lines = await fetchEquipmentUpkeepSchemeLinesBySet(setId);
        setSchemeLines(lines);
        loadedSetIdRef.current = setId;
        const existing = form.getFieldValue('upkeep_record_lines') as
          | { param_id: number; record_value?: string | null }[]
          | undefined;
        form.setFieldValue('upkeep_record_lines', mergeRecordLines(lines, existing));
      } catch (e) {
        setSchemeLines([]);
        setLoadError((e as Error).message || '加载保养方案失败');
      } finally {
        setLoading(false);
      }
    },
    [form, mergeRecordLines],
  );

  useEffect(() => {
    if (sourceUpkeepParamSetId != null && Number.isFinite(sourceUpkeepParamSetId)) {
      form.setFieldValue('upkeep_param_set_id', sourceUpkeepParamSetId);
    }
  }, [sourceUpkeepParamSetId, form]);

  useEffect(() => {
    const eid = equipmentId;
    if (eid == null || !Number.isFinite(eid)) {
      lastEquipmentRef.current = null;
      setLedgerSuggestedSetId(null);
      loadedSetIdRef.current = null;
      setSchemeLines([]);
      setLoadError(null);
      form.setFieldsValue({ upkeep_param_set_id: undefined, upkeep_record_lines: [] });
      return;
    }
    if (lastEquipmentRef.current === eid) return;
    lastEquipmentRef.current = eid;

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const ctx = await fetchEquipmentUpkeepSchemeContext(eid);
        if (cancelled) return;
        const ledgerId = ctx.ledger_upkeep_param_set_id ?? null;
        setLedgerSuggestedSetId(ledgerId);
        const presetSet =
          sourceUpkeepParamSetId != null && Number.isFinite(sourceUpkeepParamSetId)
            ? sourceUpkeepParamSetId
            : ledgerId;
        if (presetSet != null) {
          const existing = form.getFieldValue('upkeep_record_lines') as
            | { param_id: number; record_value?: string | null }[]
            | undefined;
          const lines =
            presetSet === ledgerId && (ctx.lines?.length ?? 0) > 0
              ? ctx.lines
              : await fetchEquipmentUpkeepSchemeLinesBySet(presetSet);
          form.setFieldsValue({
            upkeep_param_set_id: presetSet,
            upkeep_record_lines: mergeRecordLines(lines ?? [], existing),
          });
          setSchemeLines(lines ?? []);
          loadedSetIdRef.current = presetSet;
        } else {
          loadedSetIdRef.current = null;
          const curSet = form.getFieldValue('upkeep_param_set_id');
          if (curSet != null && Number.isFinite(Number(curSet))) {
            await loadLinesBySetId(Number(curSet));
          } else {
            setSchemeLines([]);
            form.setFieldsValue({ upkeep_param_set_id: undefined, upkeep_record_lines: [] });
          }
        }
      } catch (e) {
        if (!cancelled) {
          setLedgerSuggestedSetId(null);
          loadedSetIdRef.current = null;
          setSchemeLines([]);
          setLoadError((e as Error).message || '加载保养方案失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [equipmentId, sourceUpkeepParamSetId, form, loadLinesBySetId, mergeRecordLines]);

  useEffect(() => {
    if (readOnly) return;
    const sid = upkeepParamSetId;
    if (sid == null || !Number.isFinite(Number(sid))) {
      if (schemeLines.length > 0) {
        loadedSetIdRef.current = null;
        setSchemeLines([]);
        form.setFieldValue('upkeep_record_lines', []);
      }
      return;
    }
    const numSid = Number(sid);
    if (loadedSetIdRef.current === numSid) return;
    void loadLinesBySetId(numSid);
  }, [upkeepParamSetId, readOnly, loadLinesBySetId, form, schemeLines.length]);

  if (equipmentId == null || !Number.isFinite(equipmentId)) {
    return (
      <Col span={24}>
        <Alert type="info" showIcon title="请先选择来源维保单（含设备）后再填写保养记录" />
      </Col>
    );
  }

  return (
    <>
      <Col xs={24} md={12}>
        <ProFormSelect
          name="upkeep_param_set_id"
          label="保养方案"
          placeholder="请选择保养方案"
          options={upkeepSetOptions}
          allowClear={!readOnly}
          showSearch
          readonly={readOnly}
          disabled={!readOnly}
          fieldProps={{ optionFilterProp: 'label' }}
          extra={
            ledgerSuggestedSetId != null &&
            upkeepParamSetId != null &&
            Number(upkeepParamSetId) === ledgerSuggestedSetId ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                已从设备台账绑定方案自动带出，可改选其他方案
              </Text>
            ) : sourceUpkeepParamSetId != null &&
              upkeepParamSetId != null &&
              Number(upkeepParamSetId) === sourceUpkeepParamSetId ? (
              <Text type="secondary" style={{ fontSize: 12 }}>
                已与来源维保单保养方案一致
              </Text>
            ) : undefined
          }
        />
      </Col>
      {loading ? (
        <Col span={24}>
          <Spin size="small" /> <Text type="secondary">正在加载保养方案…</Text>
        </Col>
      ) : null}
      {loadError ? (
        <Col span={24}>
          <Alert type="error" title={loadError} showIcon />
        </Col>
      ) : null}
      {!loading && !loadError && schemeLines.length > 0 ? (
        <Col span={24}>
          <div style={{ marginBottom: 8 }}>
            <Text strong>保养记录（按保养项）</Text>
          </div>
          {schemeLines.map((ln, idx) => (
            <Row key={ln.param_id} gutter={16} style={{ marginBottom: 8 }}>
              <Col xs={24} md={8}>
                <Text>
                  {ln.param_code} · {ln.param_name}
                  {ln.is_required ? <Text type="danger"> *</Text> : null}
                </Text>
                {ln.requirement ? (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {ln.requirement}
                    </Text>
                  </div>
                ) : null}
              </Col>
              <Col xs={24} md={16}>
                <ProFormText name={['upkeep_record_lines', idx, 'param_id']} hidden initialValue={ln.param_id} />
                <UpkeepRecordLineField line={ln} idx={idx} readOnly={readOnly} />
              </Col>
            </Row>
          ))}
        </Col>
      ) : null}
      {!loading && !loadError && schemeLines.length === 0 && upkeepParamSetId != null ? (
        <Col span={24}>
          <Text type="secondary">所选保养方案暂无保养项，请先在「保养方案」中维护明细</Text>
        </Col>
      ) : null}
      {!loading && !loadError && schemeLines.length === 0 && upkeepParamSetId == null ? (
        <Col span={24}>
          <ProFormTextArea
            name="completion_content"
            label="保养完成说明"
            placeholder="未选择保养方案时，请填写本次保养完成说明"
            rules={[{ required: true, message: '请选择保养方案或填写保养完成说明' }]}
            readonly={readOnly}
            fieldProps={{ rows: 3, maxLength: 4000, showCount: !readOnly }}
          />
        </Col>
      ) : null}
    </>
  );
}

export const EquipmentUpkeepRecordFields: React.FC<Props> = ({
  readOnly,
  upkeepSetOptions,
  sourceUpkeepParamSetId,
}) => (
  <ProFormDependency name={['equipment_id', 'upkeep_param_set_id']}>
    {({ equipment_id, upkeep_param_set_id }) => {
      const eid =
        equipment_id != null && equipment_id !== '' && Number.isFinite(Number(equipment_id))
          ? Number(equipment_id)
          : undefined;
      const setId =
        upkeep_param_set_id != null &&
        upkeep_param_set_id !== '' &&
        Number.isFinite(Number(upkeep_param_set_id))
          ? Number(upkeep_param_set_id)
          : undefined;
      return (
        <EquipmentUpkeepRecordFieldsInner
          equipmentId={eid}
          upkeepParamSetId={setId}
          sourceUpkeepParamSetId={sourceUpkeepParamSetId}
          readOnly={readOnly}
          upkeepSetOptions={upkeepSetOptions}
        />
      );
    }}
  </ProFormDependency>
);
