/**
 * 工单二维码扫描组件
 * 对接后端 QRCode 格式：{"type":"WO","data":{"work_order_uuid":"...","work_order_code":"...","material_code":"..."}}
 * 兼容：纯文本工单编码、一维码（code128/code39）
 */
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, TextInput } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export interface ScanResult {
  workOrderCode: string;
  workOrderUuid?: string;
}

export function parseWorkOrderQR(data: string): ScanResult | null {
  if (!data || typeof data !== 'string') return null;
  const trimmed = data.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.type === 'WO' && parsed?.data) {
      const code = parsed.data.work_order_code || parsed.data.code;
      if (code) {
        return {
          workOrderCode: String(code),
          workOrderUuid: parsed.data.work_order_uuid,
        };
      }
    }
  } catch {
    // 非 JSON，当作纯工单编码
  }
  return { workOrderCode: trimmed };
}

interface BarcodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [scanned, setScanned] = useState(false);
  const [webInput, setWebInput] = useState('');
  const [permission, requestPermission] = useCameraPermissions();

  const handleBarCodeScanned = useCallback(
    ({ data }: { type: string; data: string }) => {
      if (scanned) return;
      const result = parseWorkOrderQR(data);
      if (result) {
        setScanned(true);
        onScan(result.workOrderCode);
      }
    },
    [scanned, onScan]
  );

  const handleWebSimulate = useCallback(() => {
    const result = parseWorkOrderQR(webInput);
    if (result) {
      onScan(result.workOrderCode);
    }
  }, [webInput, onScan]);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>扫码功能请在真机（iOS/Android）上使用</Text>
        <Text style={styles.webHint}>Web 调试：粘贴二维码 JSON 或输入工单编码</Text>
        <TextInput
          style={styles.webInput}
          placeholder='{"type":"WO","data":{"work_order_code":"WO001"}} 或 WO001'
          placeholderTextColor="#999"
          value={webInput}
          onChangeText={setWebInput}
          multiline
        />
        <TouchableOpacity
          style={[styles.closeBtn, styles.simulateBtn]}
          onPress={handleWebSimulate}
          disabled={!webInput.trim()}
        >
          <Text style={styles.closeBtnText}>模拟扫码</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>正在获取相机权限...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>需要相机权限以扫描工单二维码</Text>
        <TouchableOpacity style={styles.closeBtn} onPress={requestPermission}>
          <Text style={styles.closeBtnText}>授权</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.closeBtn, { marginTop: 12 }]} onPress={onClose}>
          <Text style={styles.closeBtnText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13'],
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>
          {scanned ? '已识别，正在查询...' : '将工单二维码/条码放入框内'}
        </Text>
        {scanned && (
          <TouchableOpacity
            style={[styles.closeBtn, { marginBottom: 8 }]}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.closeBtnText}>再次扫码</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeBtnText}>取消</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 24,
  },
  placeholderText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    alignItems: 'center',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 16,
  },
  closeBtn: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
  },
  webHint: {
    color: '#999',
    fontSize: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  webInput: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#333',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    minHeight: 60,
    marginBottom: 12,
  },
  simulateBtn: {
    backgroundColor: '#1677ff',
    marginBottom: 8,
  },
});
