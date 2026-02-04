import React, { useEffect, useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { List, Button, WhiteSpace, WingBlank, Steps, Modal, Toast } from '@ant-design/react-native';
import { WorkOrder } from '../../src/services/workOrderService';

const Item = List.Item;
const Brief = Item.Brief;
const Step = Steps.Step;

export default function WorkOrderDetailScreen() {
    const { id } = useLocalSearchParams();
    const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);

    useEffect(() => {
        // Simulate fetching details
        setTimeout(() => {
            setWorkOrder({
                id: Number(id),
                code: 'WO-20231024-001',
                name: 'PCB组装A',
                product_name: '控制板V1',
                product_code: 'P001',
                planned_quantity: 100,
                completed_quantity: 0,
                status: 'pending',
                priority: 'high',
                planned_start_date: '2023-10-24',
                planned_end_date: '2023-10-25',
                workshop_name: '电子车间',
                work_center_name: 'SMT产线01'
            });
        }, 500);
    }, [id]);

    const handleStart = () => {
        Modal.alert('确认', '确定开工吗？', [
            { text: '取消', onPress: () => console.log('cancel'), style: 'cancel' },
            { text: '确定', onPress: () => Toast.success('工单已开工') },
        ]);
    };

    const handleReport = () => {
        router.push({ pathname: '/mes/report', params: { workOrderId: id } } as any);
    };

    if (!workOrder) return null;

    return (
        <View style={{ flex: 1, backgroundColor: '#f5f5f9' }}>
            <ScrollView>
                <List renderHeader={'基本信息'}>
                    <Item extra={workOrder.status === 'pending' ? '待开工' : '进行中'}>{workOrder.code}</Item>
                    <Item extra={workOrder.priority}>优先级</Item>
                    <Item extra={workOrder.workshop_name}>车间</Item>
                </List>

                <List renderHeader={'产品信息'}>
                    <Item multipleLine>
                        {workOrder.product_name}
                        <Brief>{workOrder.product_code}</Brief>
                    </Item>
                    <Item extra={`${workOrder.completed_quantity} / ${workOrder.planned_quantity}`}>
                        完成进度
                    </Item>
                </List>

                <View style={{ marginTop: 20, paddingHorizontal: 15, backgroundColor: '#fff', paddingVertical: 20 }}>
                    <Steps direction="vertical" current={0} size="small">
                        <Step title="010 贴片" description="待开工" status="process" />
                        <Step title="020 回流焊" description="等待中" status="wait" />
                        <Step title="030 AOI检测" description="等待中" status="wait" />
                    </Steps>
                </View>

                <WhiteSpace size="xl" />
            </ScrollView>

            <View style={{ backgroundColor: '#fff', padding: 10, borderTopWidth: 1, borderTopColor: '#ddd' }}>
                <WingBlank>
                    {workOrder.status === 'pending' ? (
                        <Button type="primary" onPress={handleStart}>开工</Button>
                    ) : (
                        <Button type="primary" onPress={handleReport}>生产报工</Button>
                    )}
                </WingBlank>
            </View>
        </View>
    );
}
