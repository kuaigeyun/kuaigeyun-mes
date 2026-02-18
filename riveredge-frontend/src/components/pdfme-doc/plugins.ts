/**
 * pdfme 插件统一导出
 *
 * 集中管理 Designer、Preview、Generator 使用的插件，确保一致性
 * 一维码仅保留最常用两种：Code128（物流/通用）、EAN-13（零售商品）
 * 组件按使用频度与关联性排序
 */
import {
  text,
  table,
  barcodes,
  image,
  svg,
  line,
  rectangle,
  ellipse,
  date,
  time,
  dateTime,
  multiVariableText,
} from '@pdfme/schemas';
import { signaturePlugin } from './signaturePlugin';

/** 一维码仅保留最常用两种：Code128、EAN-13；二维码 QRCode */
const BARCODE_TYPES = ['qrcode', 'code128', 'ean13'] as const;

const barcodePlugins = Object.fromEntries(
  BARCODE_TYPES.map((type) => [type, (barcodes as Record<string, unknown>)[type]])
) as Record<string, (typeof barcodes)[keyof typeof barcodes]>;

/** 按使用频度与关联性排序：文本→表格→图片→签名→条码→日期→图形 */
export const PDFME_PLUGINS = {
  Text: text,
  Table: table,
  Image: image,
  Signature: signaturePlugin,
  ...barcodePlugins,
  Date: date,
  Time: time,
  DateTime: dateTime,
  MultiVariableText: multiVariableText,
  Line: line,
  Rectangle: rectangle,
  Ellipse: ellipse,
  Svg: svg,
};
