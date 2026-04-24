import { useState, useEffect } from 'react';
import { Typography, Space, InputNumber, Select, Row, Col, Divider, Input, Button, message, Image, Segmented, Checkbox } from 'antd';
import * as LucideIcons from 'lucide-react';

const { Text } = Typography;
const { TextArea } = Input;

/**
 * 价税换算：正算（不含税→税/含税）、反算（含税→不含税/税额）
 */
export const TaxCalculator = () => {
  const [mode, setMode] = useState<'forward' | 'reverse'>('forward');
  const [amountExcl, setAmountExcl] = useState<number>(100);
  const [amountIncl, setAmountIncl] = useState<number>(113);
  const [taxRate, setTaxRate] = useState<number>(13);
  const r = taxRate / 100;

  const forwardTax = amountExcl * r;
  const forwardTotal = amountExcl + forwardTax;
  const reverseExcl = r >= 0 ? amountIncl / (1 + r) : 0;
  const reverseTax = amountIncl - reverseExcl;

  const syncMode = (next: 'forward' | 'reverse') => {
    if (next === 'reverse' && mode === 'forward') {
      setAmountIncl(Number(forwardTotal.toFixed(2)));
    } else if (next === 'forward' && mode === 'reverse') {
      setAmountExcl(Number(reverseExcl.toFixed(2)));
    }
    setMode(next);
  };

  return (
    <div style={{ padding: '8px 4px', width: 268 }}>
      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>增值税价税计算器</Text>
      <Segmented
        size="small"
        block
        value={mode}
        onChange={(v) => syncMode(v as 'forward' | 'reverse')}
        options={[
          { label: '正算', value: 'forward' },
          { label: '反算', value: 'reverse' },
        ]}
        style={{ marginBottom: 10 }}
      />
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        {mode === 'forward' ? (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>不含税金额 (元)</Text>
            <InputNumber style={{ width: '100%', marginTop: 4 }} value={amountExcl} onChange={(v) => setAmountExcl(v ?? 0)} size="small" min={0} precision={2} />
          </div>
        ) : (
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>含税总金额 (元)</Text>
            <InputNumber style={{ width: '100%', marginTop: 4 }} value={amountIncl} onChange={(v) => setAmountIncl(v ?? 0)} size="small" min={0} precision={2} />
          </div>
        )}
        <Row gutter={8}>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 12 }}>税率 (%)</Text>
            <Select
              style={{ width: '100%', marginTop: 4 }}
              value={taxRate}
              onChange={setTaxRate}
              size="small"
              options={[
                { label: '13% 制造', value: 13 },
                { label: '9% 运输', value: 9 },
                { label: '6% 服务', value: 6 },
                { label: '3% 小规模', value: 3 },
                { label: '1%', value: 1 },
              ]}
            />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 12 }}>{mode === 'forward' ? '税额 (￥)' : '税额 (￥)'}</Text>
            <div style={{ height: 24, lineHeight: '30px', fontWeight: 'bold', color: '#ff4d4f', fontSize: 14 }}>
              {(mode === 'forward' ? forwardTax : reverseTax).toFixed(2)}
            </div>
          </Col>
        </Row>
        <Divider style={{ margin: '6px 0' }} />
        {mode === 'forward' ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>含税总计</Text>
            <Text strong style={{ color: '#52c41a', fontSize: 17 }}>￥{forwardTotal.toFixed(2)}</Text>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>倒推不含税</Text>
            <Text strong style={{ color: '#1890ff', fontSize: 17 }}>￥{reverseExcl.toFixed(2)}</Text>
          </div>
        )}
        <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>一般计税：税额 = 不含税×税率；反算：不含税 = 含税÷(1+税率)</Text>
      </Space>
    </div>
  );
};

/**
 * 金属重量：板材（长宽高）或管材（外径/内径/长度，空心圆截面）
 */
export const WeightCalculator = () => {
  const [shape, setShape] = useState<'plate' | 'pipe'>('plate');
  const [type, setType] = useState('steel');
  const [len, setLen] = useState<number>(1000);
  const [width, setWidth] = useState<number>(1000);
  const [thick, setThick] = useState<number>(1);
  const [pipeOuter, setPipeOuter] = useState<number>(60);
  const [pipeInner, setPipeInner] = useState<number>(50);
  const [pipeLen, setPipeLen] = useState<number>(1000);
  const [qty, setQty] = useState<number>(1);
  const densities: Record<string, number> = { steel: 7.85, stainless: 7.93, aluminum: 2.7, copper: 8.96 };
  const density = densities[type] || 0;

  const plateVolumeMm3 = len * width * thick;
  const plateVolumeM3 = plateVolumeMm3 / 1e9;
  const plateSingleKg = (plateVolumeMm3 * density) / 1e6;

  const pipeValid = pipeOuter > 0 && pipeInner > 0 && pipeOuter > pipeInner && pipeLen > 0;
  const pipeSectionMm2 = pipeValid ? (Math.PI / 4) * (pipeOuter * pipeOuter - pipeInner * pipeInner) : 0;
  const pipeVolumeMm3 = pipeSectionMm2 * pipeLen;
  const pipeVolumeM3 = pipeVolumeMm3 / 1e9;
  const pipeSingleKg = pipeValid ? (pipeVolumeMm3 * density) / 1e6 : 0;

  const volumeM3 = shape === 'plate' ? plateVolumeM3 : pipeVolumeM3;
  const singleKg = shape === 'plate' ? plateSingleKg : pipeSingleKg;
  const totalKg = singleKg * Math.max(0, qty);

  return (
    <div style={{ padding: '8px 4px', width: 280 }}>
      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>金属重量计算</Text>
      <Segmented
        size="small"
        block
        value={shape}
        onChange={(v) => setShape(v as 'plate' | 'pipe')}
        options={[
          { label: '板材', value: 'plate' },
          { label: '管材', value: 'pipe' },
        ]}
        style={{ marginBottom: 10 }}
      />
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Select style={{ width: '100%' }} value={type} onChange={setType} size="small" options={[{ label: '碳钢/普通钢 (7.85)', value: 'steel' }, { label: '不锈钢 (7.93)', value: 'stainless' }, { label: '铝合金/铝板 (2.70)', value: 'aluminum' }, { label: '紫铜/黄铜 (8.96)', value: 'copper' }]} />
        {shape === 'plate' ? (
          <Row gutter={8}>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 11 }}>长 L (mm)</Text>
              <InputNumber value={len} onChange={(v) => setLen(v ?? 0)} size="small" style={{ width: '100%', marginTop: 2 }} min={0} />
            </Col>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 11 }}>宽 W (mm)</Text>
              <InputNumber value={width} onChange={(v) => setWidth(v ?? 0)} size="small" style={{ width: '100%', marginTop: 2 }} min={0} />
            </Col>
            <Col span={8}>
              <Text type="secondary" style={{ fontSize: 11 }}>厚 T (mm)</Text>
              <InputNumber value={thick} onChange={(v) => setThick(v ?? 0)} size="small" style={{ width: '100%', marginTop: 2 }} min={0} />
            </Col>
          </Row>
        ) : (
          <>
            <Row gutter={8}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>外径 Do (mm)</Text>
                <InputNumber value={pipeOuter} onChange={(v) => setPipeOuter(v ?? 0)} size="small" style={{ width: '100%', marginTop: 2 }} min={0} />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>内径 Di (mm)</Text>
                <InputNumber value={pipeInner} onChange={(v) => setPipeInner(v ?? 0)} size="small" style={{ width: '100%', marginTop: 2 }} min={0} />
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11 }}>管长 L (mm)</Text>
                <InputNumber value={pipeLen} onChange={(v) => setPipeLen(v ?? 0)} size="small" style={{ width: '100%', marginTop: 2 }} min={0} />
              </Col>
            </Row>
            {!pipeValid && (pipeOuter > 0 || pipeInner > 0 || pipeLen > 0) ? (
              <Text type="danger" style={{ fontSize: 11 }}>
                需满足：外径大于内径，且外径、内径、管长均大于 0
              </Text>
            ) : null}
            <Text type="secondary" style={{ fontSize: 10, display: 'block' }}>
              空心圆管：体积 = π/4×(Do²−Di²)×L，密度同板材公式 (g/cm³)
            </Text>
          </>
        )}
        <Row gutter={8} align="bottom">
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>件数 (同规格)</Text>
            <InputNumber value={qty} onChange={(v) => setQty(Math.max(1, Math.floor(v ?? 1)))} size="small" style={{ width: '100%', marginTop: 2 }} min={1} precision={0} />
          </Col>
          <Col span={12}>
            <Text type="secondary" style={{ fontSize: 11 }}>体积 (m³)</Text>
            <div style={{ marginTop: 6, fontWeight: 600, color: 'rgba(0,0,0,0.65)' }}>{pipeValid || shape === 'plate' ? volumeM3.toFixed(6) : '—'}</div>
          </Col>
        </Row>
        <Divider style={{ margin: '4px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>单重 / 合计</Text>
          <div>
            <Text style={{ fontSize: 12, marginRight: 8 }}>{(shape === 'pipe' && !pipeValid ? 0 : singleKg).toFixed(3)} kg</Text>
            <Text strong style={{ color: '#1890ff', fontSize: 16 }}>{(shape === 'pipe' && !pipeValid ? 0 : totalKg).toFixed(3)} kg</Text>
          </div>
        </div>
      </Space>
    </div>
  );
};

/**
 * 汇率参考：外币↔人民币双向（牌价为内置示例，仅作粗算）
 */
export const ExchangeCalculator = () => {
  const [direction, setDirection] = useState<'toCny' | 'fromCny'>('toCny');
  const [amount, setAmount] = useState<number>(100);
  const [currency, setCurrency] = useState('USD');
  const rates: Record<string, number> = { USD: 7.24, EUR: 7.72, JPY: 0.046, HKD: 0.92, GBP: 9.15 };
  const rate = rates[currency] || 0;
  /** toCny：amount 为外币；fromCny：amount 为人民币 */
  const resultCny = direction === 'toCny' ? amount * rate : 0;
  const resultForeign = direction === 'fromCny' && rate > 0 ? amount / rate : 0;

  const flipDirection = (next: 'toCny' | 'fromCny') => {
    if (next === direction) return;
    if (next === 'fromCny' && direction === 'toCny') {
      setAmount(Number((amount * rate).toFixed(2)));
    } else if (next === 'toCny' && direction === 'fromCny' && rate > 0) {
      setAmount(Number((amount / rate).toFixed(4)));
    }
    setDirection(next);
  };

  return (
    <div style={{ padding: '8px 4px', width: 248 }}>
      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>汇率换算参考</Text>
      <Segmented
        size="small"
        block
        value={direction}
        onChange={(v) => flipDirection(v as 'toCny' | 'fromCny')}
        options={[
          { label: '外币→人民币', value: 'toCny' },
          { label: '人民币→外币', value: 'fromCny' },
        ]}
        style={{ marginBottom: 10 }}
      />
      <Space direction="vertical" style={{ width: '100%' }} size={10}>
        <Select style={{ width: '100%' }} value={currency} onChange={setCurrency} size="small" options={[
          { label: '美元 USD', value: 'USD' },
          { label: '欧元 EUR', value: 'EUR' },
          { label: '日元 JPY', value: 'JPY' },
          { label: '港币 HKD', value: 'HKD' },
          { label: '英镑 GBP', value: 'GBP' },
        ]} />
        {direction === 'toCny' ? (
          <Row gutter={8} align="middle">
            <Col span={14}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>外币金额</Text>
              <InputNumber style={{ width: '100%', marginTop: 4 }} value={amount} onChange={(v) => setAmount(v ?? 0)} size="small" min={0} precision={4} />
            </Col>
            <Col span={10} style={{ textAlign: 'center', paddingTop: 18 }}>
              <LucideIcons.ArrowDown size={16} style={{ color: '#bfbfbf' }} />
            </Col>
          </Row>
        ) : (
          <Row gutter={8} align="middle">
            <Col span={14}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>人民币 ￥</Text>
              <InputNumber style={{ width: '100%', marginTop: 4 }} prefix="￥" value={amount} onChange={(v) => setAmount(v ?? 0)} size="small" min={0} precision={2} />
            </Col>
            <Col span={10} style={{ textAlign: 'center', paddingTop: 18 }}>
              <LucideIcons.ArrowDown size={16} style={{ color: '#bfbfbf' }} />
            </Col>
          </Row>
        )}
        <div style={{ background: '#f5f5f5', padding: '8px', borderRadius: 4, textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{direction === 'toCny' ? '折合人民币 (估计)' : `折合 ${currency} (估计)`}</Text>
          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#108ee9' }}>
            {direction === 'toCny' ? `￥${resultCny.toFixed(2)}` : resultForeign.toFixed(4)}
          </div>
        </div>
        <Text type="secondary" style={{ fontSize: 10 }}>内置为示例汇率，签约与结算请以银行/合同为准</Text>
      </Space>
    </div>
  );
};

type UnitRow = { label: string; value: string; factor: number };

/**
 * 工业单位换算（含温度非线性）
 */
export const UnitConverter = () => {
  const [val, setVal] = useState<number>(1);
  const [type, setType] = useState('length');
  const [unitId, setUnitId] = useState('m_mm');
  const unitOptions: Record<string, UnitRow[]> = {
    length: [
      { label: '米(m) ➜ 毫米(mm)', value: 'm_mm', factor: 1000 },
      { label: '毫米(mm) ➜ 米(m)', value: 'mm_m', factor: 0.001 },
      { label: '英寸(in) ➜ 毫米(mm)', value: 'in_mm', factor: 25.4 },
      { label: '英尺(ft) ➜ 米(m)', value: 'ft_m', factor: 0.3048 },
    ],
    weight: [
      { label: '吨(t) ➜ 公斤(kg)', value: 't_kg', factor: 1000 },
      { label: '公斤(kg) ➜ 吨(t)', value: 'kg_t', factor: 0.001 },
      { label: '磅(lb) ➜ 公斤(kg)', value: 'lb_kg', factor: 0.45359237 },
      { label: '盎司(oz) ➜ 克(g)', value: 'oz_g', factor: 28.349523125 },
    ],
    area: [
      { label: '㎡ ➜ 平方毫米', value: 'm2_mm2', factor: 1e6 },
      { label: '平方毫米 ➜ ㎡', value: 'mm2_m2', factor: 1e-6 },
    ],
    pressure: [
      { label: 'MPa ➜ bar', value: 'mpa_bar', factor: 10 },
      { label: 'bar ➜ MPa', value: 'bar_mpa', factor: 0.1 },
    ],
    temp: [
      { label: '摄氏℃ ➜ 华氏℉', value: 'c_f', factor: 1 },
      { label: '华氏℉ ➜ 摄氏℃', value: 'f_c', factor: 1 },
    ],
  };

  const current = unitOptions[type]?.find((o) => o.value === unitId);
  const currentFactor = current?.factor ?? 1;

  let result: number;
  if (type === 'temp') {
    if (unitId === 'c_f') result = (val * 9) / 5 + 32;
    else if (unitId === 'f_c') result = ((val - 32) * 5) / 9;
    else result = val * currentFactor;
  } else {
    result = val * currentFactor;
  }

  /** 与当前选项成对的反向换算 id（仅线性比例关系） */
  const inverseUnitId: Record<string, string> = {
    m_mm: 'mm_m',
    mm_m: 'm_mm',
    t_kg: 'kg_t',
    kg_t: 't_kg',
    m2_mm2: 'mm2_m2',
    mm2_m2: 'm2_mm2',
    mpa_bar: 'bar_mpa',
    bar_mpa: 'mpa_bar',
  };

  const applyInversePair = () => {
    const nextId = inverseUnitId[unitId];
    if (!nextId || type === 'temp') {
      message.info('请从下拉中另选换算关系，或切换有「↔」成对的项');
      return;
    }
    setVal(Number(result.toFixed(8)));
    setUnitId(nextId);
  };

  return (
    <div style={{ padding: '8px 4px', width: 268 }}>
      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>单位换算工具</Text>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <Select
          style={{ width: '100%' }}
          value={type}
          onChange={(v) => {
            setType(v);
            setUnitId(unitOptions[v][0].value);
          }}
          size="small"
        >
          <Select.Option value="length">长度</Select.Option>
          <Select.Option value="weight">重量</Select.Option>
          <Select.Option value="area">面积</Select.Option>
          <Select.Option value="pressure">压力</Select.Option>
          <Select.Option value="temp">温度</Select.Option>
        </Select>
        <Select style={{ width: '100%' }} value={unitId} onChange={setUnitId} size="small" options={unitOptions[type]} />
        <Row gutter={8} align="middle">
          <Col span={10}>
            <InputNumber value={val} onChange={(v) => setVal(v ?? 0)} size="small" style={{ width: '100%' }} />
          </Col>
          <Col span={4} style={{ textAlign: 'center' }}>
            =
          </Col>
          <Col span={10}>
            <div style={{ fontWeight: 'bold', color: '#722ed1', fontSize: 15 }}>
              {Number.isFinite(result) ? result.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '—'}
            </div>
          </Col>
        </Row>
        {type !== 'temp' ? (
          <Button size="small" type="link" block style={{ padding: 0, height: 'auto' }} disabled={!inverseUnitId[unitId]} onClick={applyInversePair}>
            一键反向（结果→左侧并切换方向）
          </Button>
        ) : (
          <Text type="secondary" style={{ fontSize: 10 }}>温度按线性公式换算，工艺控温请以规程为准</Text>
        )}
      </Space>
    </div>
  );
};

/**
 * 1. 人民币金额转大写
 */
export const RmbCapitalizer = () => {
  const [num, setNum] = useState<number>(0);
  const formatNum = (n: number) =>
    Number.isFinite(n) ? n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
  const convertToChinese = (n: number) => {
    const fraction = ['角', '分'];
    const digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    const unit = [['元', '万', '亿'], ['', '拾', '佰', '仟']];
    let s = '';
    for (let i = 0; i < fraction.length; i++) s += (digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, '');
    s = s || '整';
    n = Math.floor(n);
    for (let i = 0; i < unit[0].length && n > 0; i++) {
        let p = '';
        for (let j = 0; j < unit[1].length && n > 0; j++) { p = digit[n % 10] + unit[1][j] + p; n = Math.floor(n / 10); }
        s = p.replace(/(零.)*零$/, '').replace(/^$/, '零') + unit[0][i] + s;
    }
    return s.replace(/(零.)*零元/, '元').replace(/(零.)+/g, '零').replace(/^整$/, '零元整');
  };
  const result = convertToChinese(num);
  const copyAll = () => {
    const line = `${formatNum(num)} 元\n${result}`;
    void navigator.clipboard.writeText(line);
    message.success('已复制「金额 + 大写」');
  };
  return (
    <div style={{ padding: '8px 4px', width: 280 }}>
      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>人民币大写转换</Text>
      <InputNumber style={{ width: '100%' }} placeholder="输入金额..." value={num} onChange={(v) => setNum(v ?? 0)} precision={2} size="small" min={0} />
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>千分位：{formatNum(num)}</Text>
      <div style={{ marginTop: 10, padding: '10px', background: '#fff7e6', borderRadius: 4, border: '1px solid #ffe7ba', wordBreak: 'break-all', minHeight: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#d46b08', fontWeight: 'bold', fontSize: 14 }}>{result}</div>
      <Space style={{ marginTop: 8 }} wrap>
        <Button size="small" onClick={() => { void navigator.clipboard.writeText(result); message.success('已复制大写'); }}>仅大写</Button>
        <Button size="small" type="primary" onClick={copyAll}>
          复制金额+大写
        </Button>
      </Space>
    </div>
  );
};

/**
 * 2. 文本转换工具
 */
export const TextTransformer = () => {
  const [text, setText] = useState('');

  const toHalfWidth = (s: string) =>
    s
      .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
      .replace(/\u3000/g, ' ');

  const handleCase = (type: 'up' | 'low' | 'trim' | 'oneLine' | 'half') => {
    if (!text && type !== 'half') return;
    if (type === 'half') {
      setText(toHalfWidth(text));
      return;
    }
    let res = '';
    if (type === 'up') res = text.toUpperCase();
    else if (type === 'low') res = text.toLowerCase();
    else if (type === 'trim') res = text.split('\n').map((l) => l.trim()).join('\n');
    else if (type === 'oneLine') res = text.replace(/\r?\n/g, '');
    setText(res);
  };

  const chars = text.length;
  const lines = text === '' ? 0 : text.split(/\r?\n/).length;

  return (
    <div style={{ padding: '8px 4px', width: 280 }}>
      <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>文本整理</Text>
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>合同、报价从 PDF/Word 粘贴后常用</Text>
      <TextArea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="粘贴或输入文本..." style={{ fontSize: 12 }} />
      <Text type="secondary" style={{ fontSize: 11, marginTop: 6, display: 'block' }}>
        字符 {chars} · 行 {lines}
      </Text>
      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Button size="small" onClick={() => handleCase('up')}>
          大写
        </Button>
        <Button size="small" onClick={() => handleCase('low')}>
          小写
        </Button>
        <Button size="small" onClick={() => handleCase('trim')}>
          逐行去首尾空格
        </Button>
        <Button size="small" onClick={() => handleCase('oneLine')}>
          去换行
        </Button>
        <Button size="small" onClick={() => handleCase('half')}>
          全角转半角
        </Button>
        <Button size="small" icon={<LucideIcons.Copy size={12} />} onClick={() => { void navigator.clipboard.writeText(text); message.success('已复制'); }} />
      </div>
    </div>
  );
};

/**
 * 5. 二维码生成器
 */
export const QrGenerator = () => {
  const [text, setText] = useState('https://kuaigeyun.com');
  const [px, setPx] = useState<160 | 200 | 280>(200);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&data=${encodeURIComponent(text)}`;
  const previewW = Math.min(140, px);
  return (
    <div style={{ padding: '8px 4px', width: 240, textAlign: 'center' }}>
      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>二维码快速生成</Text>
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="网址、工号、WiFi 口令等" size="small" style={{ marginBottom: 8 }} />
      <div style={{ marginBottom: 10, textAlign: 'left' }}>
        <Text type="secondary" style={{ fontSize: 11, marginRight: 8 }}>边长</Text>
        <Select size="small" style={{ width: 120 }} value={px} onChange={(v) => setPx(v as 160 | 200 | 280)} options={[{ label: '160（省墨）', value: 160 }, { label: '200（默认）', value: 200 }, { label: '280（海报）', value: 280 }]} />
      </div>
      {text ? (
        <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #eee', display: 'inline-block' }}>
          <Image src={qrUrl} width={previewW} preview />
        </div>
      ) : null}
      <Text type="secondary" style={{ fontSize: 10, display: 'block', marginTop: 8 }}>预览点击可放大；打印请选更大边长</Text>
    </div>
  );
};

/**
 * 6. 随机密码生成器
 */
export const PasswordGen = () => {
  const [pwd, setPwd] = useState('');
  const [len, setLen] = useState<number>(14);
  const [useLower, setUseLower] = useState(true);
  const [useUpper, setUseUpper] = useState(true);
  const [useDigit, setUseDigit] = useState(true);
  const [useSymbol, setUseSymbol] = useState(true);

  const gen = () => {
    let pool = '';
    if (useLower) pool += 'abcdefghijklmnopqrstuvwxyz';
    if (useUpper) pool += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (useDigit) pool += '0123456789';
    if (useSymbol) pool += '!@#$%^&*-_+=';
    if (!pool) {
      message.warning('至少选一类字符');
      return;
    }
    const n = Math.min(32, Math.max(6, Math.floor(len)));
    const arr = new Uint32Array(n);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < n; i++) arr[i] = Math.floor(Math.random() * 0xffffffff);
    }
    let res = '';
    for (let i = 0; i < n; i++) res += pool[arr[i]! % pool.length];
    setPwd(res);
  };

  return (
    <div style={{ padding: '8px 4px', width: 260 }}>
      <Text strong style={{ display: 'block', marginBottom: 10, fontSize: 13 }}>随机密码</Text>
      <Row gutter={8} align="middle">
        <Col span={10}>
          <Text type="secondary" style={{ fontSize: 11 }}>长度</Text>
          <InputNumber value={len} onChange={(v) => setLen(v ?? 14)} min={6} max={32} size="small" style={{ width: '100%', marginTop: 4 }} />
        </Col>
        <Col span={14} style={{ paddingTop: 16 }}>
          <Button type="primary" size="small" block onClick={gen}>
            生成
          </Button>
        </Col>
      </Row>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Checkbox checked={useLower} onChange={(e) => setUseLower(e.target.checked)}>
          小写 a-z
        </Checkbox>
        <Checkbox checked={useUpper} onChange={(e) => setUseUpper(e.target.checked)}>
          大写 A-Z
        </Checkbox>
        <Checkbox checked={useDigit} onChange={(e) => setUseDigit(e.target.checked)}>
          数字 0-9
        </Checkbox>
        <Checkbox checked={useSymbol} onChange={(e) => setUseSymbol(e.target.checked)}>
          符号 !@#…
        </Checkbox>
      </div>
      <Input.Password value={pwd} readOnly size="small" style={{ marginTop: 10 }} placeholder="点击生成" />
      {pwd ? (
        <Button block size="small" style={{ marginTop: 8 }} onClick={() => { void navigator.clipboard.writeText(pwd); message.success('已复制'); }}>
          复制
        </Button>
      ) : null}
    </div>
  );
};

/**
 * 个人备忘录工具
 */
export const MemoTool = () => {
  const [content, setContent] = useState('');
  useEffect(() => {
    const saved = localStorage.getItem('dashboard_quick_memo');
    if (saved) setContent(saved);
  }, []);
  const saveMemo = (val: string) => {
    setContent(val);
    localStorage.setItem('dashboard_quick_memo', val);
  };
  const wc = content.length;
  const lines = content === '' ? 0 : content.split(/\r?\n/).length;
  return (
    <div style={{ padding: '8px 4px', width: 260 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text strong style={{ fontSize: 13 }}>个人备忘录</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>
          {wc} 字 · {lines} 行
        </Text>
      </div>
      <Text type="secondary" style={{ fontSize: 10, display: 'block', marginBottom: 6 }}>仅保存在本浏览器</Text>
      <TextArea rows={5} value={content} onChange={(e) => saveMemo(e.target.value)} placeholder="待办、分机、临时单号…" style={{ fontSize: 12 }} />
      <Button size="small" type="link" onClick={() => saveMemo('')} danger style={{ marginTop: 4 }}>
        清空
      </Button>
    </div>
  );
};
