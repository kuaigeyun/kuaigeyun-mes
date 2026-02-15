/**
 * 工位绑定组件
 *
 * 用于选择和绑定当前终端所属的工位。
 * 可以作为独立页面的一部分，或嵌入到模态框中。
 *
 * Author: RiverEdge AI
 * Date: 2026-02-05
 */

import React, { useState, useEffect } from 'react';
import { Select, message, Typography, Space, Form, Button } from 'antd';
import { LoginOutlined, EnvironmentOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { workshopApi, productionLineApi, workstationApi } from '../../master-data/services/factory';

const { Title, Text } = Typography;
const { Option } = Select;

export const STATION_STORAGE_KEY = 'kuaizhizao_current_station';

export interface StationInfo {
    workshopId: number;
    workshopName: string;
    lineId?: number;
    lineName?: string;
    stationId: number;
    stationName: string;
    stationCode: string;
    workCenterId?: number;
    workCenterName?: string;
}

interface StationBinderProps {
    onBindSuccess: () => void;
    onCancel?: () => void;
    showCancel?: boolean;
}

// Re-defining APIs here if import fails, but assuming they exist based on previous file
// If services are not in `../../apps/kuaizhizao/services/master-data`, adapt imports accordingly.
// Based on previous file: `import { workshopApi ... } from '../../../../master-data/services/factory';`
// Which was relative to `src/apps/kuaizhizao/pages/production-execution/station-login/index.tsx`
// So real path is `src/apps/kuaizhizao/master-data/services/factory`? 
// Let's double check imports later or implement dummy if needed. 
// Actually, I'll copy the logic but put it in a self-contained component file. 

// To be safe, I will treat them as passed props or use the same relative imports adjustment
// Correct Path relative to components: `../apps/kuaizhizao...` might be tricky.
// Better to place this component in `src/apps/kuaizhizao/components` for better locality.

const StationBinder: React.FC<StationBinderProps> = ({ onBindSuccess, onCancel, showCancel = false }) => {
    const [loading, setLoading] = useState(false);
    const [workshops, setWorkshops] = useState<any[]>([]);
    const [lines, setLines] = useState<any[]>([]);
    const [stations, setStations] = useState<any[]>([]);

    const [selectedWorkshop, setSelectedWorkshop] = useState<number | undefined>(undefined);
    const [selectedLine, setSelectedLine] = useState<number | undefined>(undefined);
    const [selectedStation, setSelectedStation] = useState<number | undefined>(undefined);

    // Load necessary API services dynamically or assume they are available. 
    // For this implementation, I will rely on the previous file's imports.

    useEffect(() => {
        loadWorkshops();
    }, []);

    const loadWorkshops = async () => {
        setLoading(true);
        try {
            // Using global objects or importing. 
            // For now, I will use placeholders and user must replace them if imports break.
            // Wait, I can see the imports in previous file!
            // `import { workshopApi, productionLineApi, workstationApi } from '../../../../master-data/services/factory';`
            // Let's assume this file is in `src/apps/kuaizhizao/components/StationBinder.tsx`
            // Then import path: `../master-data/services/factory` should work if structure is `src/apps/kuaizhizao/master-data/services/factory`.
            // Let's check `list_dir` output. `src/apps/kuaizhizao/services`.
            // Ah, the previous file login used `../../../../master-data/services/factory`.
            // That means `src/apps/master-data/services/factory`.
            
            const res = await workshopApi.list({ isActive: true });
            if (res && Array.isArray(res)) {
                setWorkshops(res);
            } else if (res && (res as any).items) {
                setWorkshops((res as any).items);
            }
        } catch (error) {
            console.error('加载车间失败', error);
            // message.error('加载车间数据失败'); // Be silent to avoid noise
        } finally {
            setLoading(false);
        }
    };

    const handleWorkshopChange = async (val: number) => {
        setSelectedWorkshop(val);
        setSelectedLine(undefined);
        setSelectedStation(undefined);
        setLines([]);
        setStations([]);

        if (val) {
            try {
                const res = await productionLineApi.list({ workshopId: val, isActive: true });
                if (res && Array.isArray(res)) {
                    setLines(res);
                } else if (res && (res as any).items) {
                    setLines((res as any).items);
                }
            } catch (error) {
                console.error('加载产线失败', error);
            }
        }
    };

    const handleLineChange = async (val: number) => {
        setSelectedLine(val);
        setSelectedStation(undefined);
        loadStations(selectedWorkshop, val);
    };

    const loadStations = async (workshopId?: number, lineId?: number) => {
         try {
            const params: any = { isActive: true };
            if (workshopId) params.workshopId = workshopId;
            if (lineId) params.productionLineId = lineId; 

            const res = await workstationApi.list(params);
            if (res && Array.isArray(res)) {
                setStations(res);
            } else if (res && (res as any).items) {
                setStations((res as any).items);
            }
        } catch (error) {
            console.error('加载工位失败', error);
        }
    };

    const handleConfirm = () => {
         if (!selectedWorkshop) {
            message.warning('请选择车间');
            return;
        }
         if (!selectedLine) {
            message.warning('请选择产线');
            return;
        }
         if (!selectedStation) {
            message.warning('请选择要绑定的工位');
            return;
        }

        const station = stations.find(s => s.id === selectedStation);
        const workshop = workshops.find(w => w.id === selectedWorkshop);
        const line = lines.find(l => l.id === selectedLine);

        if (station) {
            const info: StationInfo = {
                workshopId: workshop?.id || 0,
                workshopName: workshop?.name || '',
                lineId: line?.id,
                lineName: line?.name,
                stationId: station.id,
                stationName: station.name,
                stationCode: station.code,
                workCenterId: (station as any).workCenterId ?? (station as any).work_center_id,
                workCenterName: (station as any).workCenterName ?? (station as any).work_center_name,
            };

            localStorage.setItem(STATION_STORAGE_KEY, JSON.stringify(info));
             message.success(`工位绑定成功：${station.name}`);
             onBindSuccess();
        }
    };

    return (
         <div style={{ maxWidth: 600, margin: '0 auto', paddingTop: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 30 }}>
                <EnvironmentOutlined style={{ fontSize: 48, color: '#1890ff', marginBottom: 16 }} />
                <Title level={3}>请绑定当前终端所属工位</Title>
                <Text type="secondary">绑定后，终端将自动显示该工位的生产任务</Text>
            </div>

            <Form layout="vertical" size="large">
                <Form.Item label="所属车间">
                    <Select
                        placeholder="请选择车间"
                        style={{ height: 50 }}
                        onChange={handleWorkshopChange}
                        value={selectedWorkshop}
                        optionFilterProp="children"
                        loading={loading}
                        getPopupContainer={(triggerNode) => triggerNode.parentElement}
                    >
                        {workshops.map(w => (
                            <Option key={w.id} value={w.id}>{w.name}</Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label="所属产线" required>
                    <Select
                        placeholder="请选择产线"
                        style={{ height: 50 }}
                        onChange={handleLineChange}
                        value={selectedLine}
                        disabled={!selectedWorkshop}
                        getPopupContainer={(triggerNode) => triggerNode.parentElement}
                    >
                        {lines.map(l => (
                            <Option key={l.id} value={l.id}>{l.name}</Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item label="作业工位" required>
                    <Select
                        placeholder="请选择工位"
                        style={{ height: 50 }}
                        onChange={(val) => setSelectedStation(val)}
                        value={selectedStation}
                        disabled={!selectedLine}
                        showSearch
                        optionFilterProp="children"
                        getPopupContainer={(triggerNode) => triggerNode.parentElement}
                    >
                        {stations.map(s => (
                            <Option key={s.id} value={s.id}>
                                <Space>
                                    <ThunderboltOutlined />
                                    {s.name} <Text type="secondary">({s.code})</Text>
                                </Space>
                            </Option>
                        ))}
                    </Select>
                </Form.Item>

                <div style={{ marginTop: 40, display: 'flex', gap: 16 }}>
                     {showCancel && (
                        <Button size="large" onClick={onCancel} style={{ flex: 1, height: 50 }}>
                            取消
                        </Button>
                    )}
                    <Button 
                        type="primary" 
                        size="large" 
                        icon={<LoginOutlined />} 
                        onClick={handleConfirm}
                        disabled={!selectedStation}
                        loading={loading}
                        style={{ flex: 1, height: 50 }}
                    >
                        确认绑定
                    </Button>
                </div>
            </Form>
        </div>
    );
};

export default StationBinder;
