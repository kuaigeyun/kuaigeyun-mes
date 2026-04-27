/**
 * WebAuthn 浏览器端工具函数
 * 
 * 提供与后端 WebAuthn 交互的辅助方法及数据转换。
 */

/**
 * 将 Base64URL 转换为 ArrayBuffer
 */
export function base64URLToBuffer(base64URL: string): ArrayBuffer {
  const base64 = base64URL.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padLen);
  const binaryString = window.atob(padded);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 将 ArrayBuffer 转换为 Base64URL
 */
export function bufferToBase64URL(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * 递归转换对象中的 ArrayBuffer/Uint8Array 为 Base64URL
 */
export function transformObjectToBuffer(obj: any): any {
  if (!obj) return obj;
  
  const newObj: any = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    const value = obj[key];
    if (value instanceof ArrayBuffer || value instanceof Uint8Array) {
      newObj[key] = bufferToBase64URL(value);
    } else if (typeof value === 'object' && value !== null) {
      newObj[key] = transformObjectToBuffer(value);
    } else {
      newObj[key] = value;
    }
  }
  
  return newObj;
}

/**
 * 转换后端返回的注册选项，将 Base64URL 字符串转回 ArrayBuffer
 */
export function parseRegistrationOptions(options: any): PublicKeyCredentialCreationOptions {
  return {
    ...options,
    challenge: base64URLToBuffer(options.challenge),
    user: {
      ...options.user,
      id: base64URLToBuffer(options.user.id),
    },
    excludeCredentials: options.excludeCredentials?.map((cred: any) => ({
      ...cred,
      id: base64URLToBuffer(cred.id),
    })),
  };
}

/**
 * 转换后端返回的认证选项
 */
export function parseAuthenticationOptions(options: any): PublicKeyCredentialRequestOptions {
  return {
    ...options,
    challenge: base64URLToBuffer(options.challenge),
    allowCredentials: options.allowCredentials?.map((cred: any) => ({
      ...cred,
      id: base64URLToBuffer(cred.id),
    })),
  };
}

/**
 * 检查浏览器是否支持 WebAuthn
 */
export async function isWebAuthnSupported(): Promise<boolean> {
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === 'function' &&
    await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  );
}
