/**
 * 保养完修单明细行：台账已绑保养方案自动带出；未绑定时可选方案并按项填记录。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ProFormDependency, ProFormSelect, ProFormText, ProFormTextArea } from '@ant-design/pro-components';
import { Alert, Col, Form, Row, Spin, Typography } from 'antd';
import {
  fetchMoldUpkeepSchemeContext,
  fetchMoldUpkeepSchemeLinesBySet,
  type MoldUpkeepSchemeLineRow,
} from '../services/haoligo';
import {
  formatMultiselectMeasuredValue,
  normalizeMoldUpkeepValueType,
  parseMultiselectMeasuredValue,
} from '../utils/moldUpkeepParamValueType';

const { Text } = Typography;

type UpkeepSetOption = { value: number; label: string };

type Props = {
  fieldNamePrefix: (string | number)[];
  readOnly?: boolean;
  upkeepSetOptions: UpkeepSetOption[];
};

function fieldPath(prefix: (string | number)[], key: string): (string | number)[] {
  return [...prefix, key];
}

function UpkeepRecordLineField({
  line,
  idx,
  readOnly,
}: {
  line: MoldUpkeepSchemeLineRow;
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

function MoldUpkeepRecordFieldsInner({
  moldCode,
  upkeepParamSetId,
  fieldNamePrefix,
  readOnly,
  upkeepSetOptions,
}: Props & { moldCode: string; upkeepParamSetId: number | undefined }) {
  const form = Form.useFormInstance();
  const [loading, setLoading] = useState(false);
  const [schemeLines, setSchemeLines] = useState<MoldUpkeepSchemeLineRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** 台账绑定的方案 id，仅用于提示「已自动带出」，不限制改选 */
  const [ledgerSuggestedSetId, setLedgerSuggestedSetId] = useState<number | null>(null);
  const lastMoldRef = useRef('');
  const loadedSetIdRef = useRef<number | null>(null);

  const setLineFields = useCallback(
    (patch: { upkeep_param_set_id?: number | undefined; upkeep_record_lines?: unknown[] }) => {
      if ('upkeep_param_set_id' in patch) {
        form.setFieldValue(fieldPath(fieldNamePrefix, 'upkeep_param_set_id'), patch.upkeep_param_set_id);
      }
      if ('upkeep_record_lines' in patch) {
        form.setFieldValue(fieldPath(fieldNamePrefix, 'upkeep_record_lines'), patch.upkeep_record_lines ?? []);
      }
    },
    [form, fieldNamePrefix],
  );

  const mergeRecordLines = useCallback(
    (
      template: MoldUpkeepSchemeLineRow[],
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

  const loadLinesBySetId = useCallback(async (setId: number) => {
    setLoading(true);
    setLoadError(null);
    try {
      const lines = await fetchMoldUpkeepSchemeLinesBySet(setId);
      setSchemeLines(lines);
      loadedSetIdRef.current = setId;
      const existing = form.getFieldValue(fieldPath(fieldNamePrefix, 'upkeep_record_lines')) as
        | { param_id: number; record_value?: string | null }[]
        | undefined;
      setLineFields({
        upkeep_record_lines: mergeRecordLines(lines, existing),
      });
    } catch (e) {
      setSchemeLines([]);
      setLoadError((e as Error).message || '加载保养方案失败');
    } finally {
      setLoading(false);
    }
  }, [form, fieldNamePrefix, mergeRecordLines, setLineFields]);

  useEffect(() => {
    const mc = moldCode.trim();
    if (mc === lastMoldRef.current && mc) {
      return;
    }
    lastMoldRef.current = mc;

    if (!mc) {
      setLedgerSuggestedSetId(null);
      loadedSetIdRef.current = null;
      setSchemeLines([]);
      setLoadError(null);
      setLineFields({ upkeep_param_set_id: undefined, upkeep_record_lines: [] });
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void (async () => {
      try {
        const ctx = await fetchMoldUpkeepSchemeContext(mc);
        if (cancelled) return;
        const ledgerId = ctx.ledger_upkeep_param_set_id ?? null;
        setLedgerSuggestedSetId(ledgerId);
        if (ledgerId != null) {
          const existing = form.getFieldValue(fieldPath(fieldNamePrefix, 'upkeep_record_lines')) as
            | { param_id: number; record_value?: string | null }[]
            | undefined;
          setLineFields({
            upkeep_param_set_id: ledgerId,
            upkeep_record_lines: mergeRecordLines(ctx.lines ?? [], existing),
          });
          setSchemeLines(ctx.lines ?? []);
          loadedSetIdRef.current = ledgerId;
        } else {
          loadedSetIdRef.current = null;
          const curSet = upkeepParamSetId;
          if (curSet != null && Number.isFinite(Number(curSet))) {
            await loadLinesBySetId(Number(curSet));
          } else {
            setSchemeLines([]);
            setLineFields({ upkeep_param_set_id: undefined, upkeep_record_lines: [] });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅模具代号变化时重解析台账绑定
  }, [moldCode]);

  useEffect(() => {
    if (readOnly) return;
    const sid = upkeepParamSetId;
    if (sid == null || !Number.isFinite(Number(sid))) {
      loadedSetIdRef.current = null;
      setSchemeLines([]);
      setLineFields({ upkeep_record_lines: [] });
      return;
    }
    const numSid = Number(sid);
    if (loadedSetIdRef.current === numSid) return;
    void loadLinesBySetId(numSid);
  }, [upkeepParamSetId, readOnly, loadLinesBySetId, setLineFields]);

  if (!moldCode.trim()) {
    return (
      <>
        <Col xs={24} md={12}>
          <ProFormSelect
            name="upkeep_param_set_id"
            label="保养方案"
            placeholder="请先填写模具代号"
          options={upkeepSetOptions}
          readonly={readOnly}
          disabled={!readOnly}
          />
        </Col>
        <Col span={24}>
          <ProFormTextArea
            name="upkeep_content"
            label="保养内容"
          placeholder="请先填写模具代号"
          readonly={readOnly}
          fieldProps={{ rows: 3 }}
          />
        </Col>
      </>
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
                已从模具台账绑定方案自动带出，可改选其他方案
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
            <Text strong>保养记录（按方案）</Text>
          </div>
          {schemeLines.map((ln, idx) => (
            <Row key={ln.param_id} gutter={16} style={{ marginBottom: 8 }}>
              <Col xs={24} md={8}>
                <Text>
                  {ln.param_code} · {ln.param_name}
                  {ln.is_required ? <Text type="danger"> *</Text> : null}
                </Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {normalizeMoldUpkeepValueType(ln.value_type) === 'multiselect' ? '多选' : '文本'}
                  </Text>
                </div>
                {ln.requirement ? (
                  <div>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {ln.requirement}
                    </Text>
                  </div>
                ) : null}
              </Col>
              <Col xs={24} md={16}>
                <ProFormText
                  name={['upkeep_record_lines', idx, 'param_id']}
                  hidden
                  initialValue={ln.param_id}
                />
                <UpkeepRecordLineField line={ln} idx={idx} readOnly={readOnly} />
              </Col>
            </Row>
          ))}
          <ProFormText name="upkeep_content" hidden />
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
            name="upkeep_content"
            label="保养内容"
            placeholder="未选择保养方案时，请填写本次保养内容"
            rules={[{ required: true, message: '请选择保养方案或填写保养内容' }]}
            readonly={readOnly}
            fieldProps={{ rows: 3, maxLength: 4000, showCount: !readOnly }}
          />
        </Col>
      ) : null}
    </>
  );
}

export function MoldUpkeepRecordFields({ fieldNamePrefix, readOnly, upkeepSetOptions }: Props) {
  return (
    <ProFormDependency name={['mold_code', 'upkeep_param_set_id']}>
      {({ mold_code, upkeep_param_set_id }) => {
        const rawSet = upkeep_param_set_id;
        const setId =
          rawSet != null && rawSet !== '' && Number.isFinite(Number(rawSet)) ? Number(rawSet) : undefined;
        return (
          <MoldUpkeepRecordFieldsInner
            moldCode={String(mold_code ?? '')}
            upkeepParamSetId={setId}
            fieldNamePrefix={fieldNamePrefix}
            readOnly={readOnly}
            upkeepSetOptions={upkeepSetOptions}
          />
        );
      }}
    </ProFormDependency>
  );
}

export function alignUpkeepRecordLinesForForm(
  stored: { param_id: number; record_value?: string | null }[] | undefined,
  template: MoldUpkeepSchemeLineRow[],
): { param_id: number; record_value: string }[] {
  const byId = new Map((stored ?? []).map((x) => [x.param_id, x.record_value ?? '']));
  return template.map((ln) => ({
    param_id: ln.param_id,
    record_value: String(byId.get(ln.param_id) ?? '').trim(),
  }));
}
