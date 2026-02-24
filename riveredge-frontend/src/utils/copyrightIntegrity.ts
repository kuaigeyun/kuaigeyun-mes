/**
 * 版权声明关键字段完整性校验
 */
import { Modal } from 'antd';
import { COPYRIGHT_COMPANY_NAME, COPYRIGHT_TRADEMARK } from '../constants/copyrightContent';
import { _ as checkData } from '../constants/copyrightCheck';

function decodeBase64Utf8(str: string): string {
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

function getExpected(): { company: string; trademark: string } | null {
  try {
    const company = decodeBase64Utf8(checkData._a ?? '');
    const trademark = decodeBase64Utf8(checkData._b ?? '');
    if (!company || !trademark) return null;
    return { company, trademark };
  } catch {
    return null;
  }
}

const WARNING_CONTENT =
  '检测到版权声明关键信息已被修改或移除，请恢复「无锡快格信息技术有限公司」与「riveredge」的版权与商标标识。';

/**
 * 校验版权关键字段与预期一致；不一致时弹窗告警，不阻止后续逻辑
 */
export function verifyCopyright(): boolean {
  const expected = getExpected();
  if (!expected) {
    Modal.warning({
      title: '版权声明校验异常',
      content: WARNING_CONTENT,
    });
    return false;
  }
  const ok =
    COPYRIGHT_COMPANY_NAME === expected.company && COPYRIGHT_TRADEMARK === expected.trademark;
  if (!ok) {
    Modal.warning({
      title: '版权声明校验未通过',
      content: WARNING_CONTENT,
    });
    return false;
  }
  return true;
}
