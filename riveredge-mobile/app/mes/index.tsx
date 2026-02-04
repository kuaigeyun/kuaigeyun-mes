import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Card, WhiteSpace, WingBlank, Tag, Flex } from '@ant-design/react-native';
import { getWorkOrders, WorkOrder } from '../../src/services/workOrderService';

export default function MESWorkOrderList() {
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);

    // Mock data
    const mockData: WorkOrder[] = [
        { id: 1, code: 'WO-20231024-001', name: 'PCB组装A', product_name: '控制板V1', product_code: 'P001', planned_quantity: 100, completed_quantity: 0, status: 'pending', priority: 'high', planned_start_date: '2023-10-24', planned_end_date: '2023-10-25' },
        { id: 2, code: 'WO-20231024-002', name: '外壳注塑B', product_name: '外壳M2', product_code: 'P002', planned_quantity: 500, completed_quantity: 120, status: 'in_progress', priority: 'normal', planned_start_date: '2023-10-24', planned_end_date: '2023-10-26' },
    ];

    useEffect(() => {
        // Simulate fetch
        setTimeout(() => setWorkOrders(mockData), 500);
    }, []);

    return (
        <ScrollView style={styles.container}>
            <View style={{ paddingBottom: 20 }}>
                {workOrders.map((item) => (
                    <View key={item.id}>
                        <WhiteSpace size="lg" />
                        <WingBlank size="lg">
                            <Card full onPress={() => router.push({ pathname: '/mes/work-order-detail', params: { id: item.id } } as any)}>
                                <Card.Header
                                    title={item.code}
                                    extra={<Tag small type={item.status === 'pending' ? 'primary' : 'success'}>{item.status === 'pending' ? '待开工' : '进行中'}</Tag>}
                                />
                                <Card.Body>
                                    <View style={{ padding: 10 }}>
                                        <Flex justify="between" style={{ marginBottom: 6 }}>
                                            <View><Tag disabled>{item.product_code}</Tag></View>
                                            <View><Tag disabled>{item.priority === 'high' ? '高优先级' : '普通'}</Tag></View>
                                        </Flex>
                                        <View style={{ marginBottom: 6 }}>
                                            <Tag>{item.product_name}</Tag>
                                        </View>

                                        <Flex style={{ marginTop: 10 }}>
                                            <Flex.Item style={{ paddingRight: 4 }}>
                                                <View style={styles.statItem}>
                                                    <View style={styles.statLabel}><Tag small>计划</Tag></View>
                                                    <View style={styles.statValue}><Tag small>{item.planned_quantity}</Tag></View>
                                                </View>
                                            </Flex.Item>
                                            <Flex.Item style={{ paddingLeft: 4 }}>
                                                <View style={styles.statItem}>
                                                    <View style={styles.statLabel}><Tag small type="success">完成</Tag></View>
                                                    <View style={styles.statValue}><Tag small type="success">{item.completed_quantity}</Tag></View>
                                                </View>
                                            </Flex.Item>
                                        </Flex>
                                    </View>
                                </Card.Body>
                                <Card.Footer content={`计划时间: ${item.planned_start_date}`} extra={item.workshop_name} />
                            </Card>
                        </WingBlank>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f9',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#f8f8f8',
        padding: 8,
        borderRadius: 4
    },
    statLabel: {
        marginRight: 8
    },
    statValue: {
        fontWeight: 'bold'
    }
});
