import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { router } from 'expo-router';
import { NoticeBar, Grid, WhiteSpace, WingBlank, Icon } from '@ant-design/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../../src/components/GlassCard';
import { BlurView } from 'expo-blur';

export default function WorkbenchScreen() {
    const modules = [
        {
            title: 'MES生产',
            data: [
                { icon: <Icon name="form" size="md" color="#1890ff" />, text: '生产报工', route: '/mes' },
                { icon: <Icon name="ordered-list" size="md" color="#1890ff" />, text: '工单查看', route: '/mes' },
                { icon: <Icon name="alert" size="md" color="#faad14" />, text: '安灯呼叫', route: '/mes' },
                { icon: <Icon name="dashboard" size="md" color="#52c41a" />, text: '生产看板', route: '/mes' },
            ]
        },
        {
            title: '质量管理',
            data: [
                { icon: <Icon name="safety" size="md" color="#52c41a" />, text: '来料检验', route: '/quality' },
                { icon: <Icon name="search" size="md" color="#13c2c2" />, text: '过程检验', route: '/quality' },
                { icon: <Icon name="check-circle" size="md" color="#52c41a" />, text: '成品检验', route: '/quality' },
            ]
        },
        {
            title: '仓储物流',
            data: [
                { icon: <Icon name="export" size="md" color="#fa8c16" />, text: '生产领料', route: '/wms' },
                { icon: <Icon name="import" size="md" color="#722ed1" />, text: '成品入库', route: '/wms' },
                { icon: <Icon name="database" size="md" color="#eb2f96" />, text: '库存查询', route: '/wms' },
            ]
        },
    ];

    return (
        <LinearGradient
            colors={['#f6f9fc', '#ecf3f9', '#dce9f9']} // Subtler gradient for dashboard
            style={styles.container}
        >
            {/* Header Glass */}
            <BlurView intensity={80} tint="light" style={styles.headerGlass}>
                <View style={styles.headerContent}>
                    <View>
                        <Text style={styles.headerTitle}>RiverEdge</Text>
                        <Text style={styles.headerSubtitle}>早安，操作员</Text>
                    </View>
                    <Icon name="bell" size="md" color="#333" />
                </View>
            </BlurView>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <WhiteSpace size="lg" />
                <WingBlank size="lg">
                    {/* Notice Bar - Styled */}
                    <GlassCard style={styles.noticeCard}>
                        <View style={styles.noticeContent}>
                            <Icon name="sound" size="xs" color="#f76a24" style={{ marginRight: 8 }} />
                            <Text style={styles.noticeText}>系统维护通知：下周六进行系统升级。</Text>
                        </View>
                    </GlassCard>

                    <WhiteSpace size="lg" />

                    {modules.map((module, idx) => (
                        <View key={idx} style={{ marginBottom: 20 }}>
                            <Text style={styles.sectionTitle}>{module.title}</Text>
                            <GlassCard style={styles.moduleCard}>
                                <Grid
                                    data={module.data}
                                    columnNum={4}
                                    hasLine={false} // Clean look
                                    onPress={(_el, index) => {
                                        const item = module.data[index];
                                        if (item && item.route) {
                                            router.push(item.route as any);
                                        }
                                    }}
                                    itemStyle={{ backgroundColor: 'transparent', height: 90 }} // Transparent for glass effect
                                />
                            </GlassCard>
                        </View>
                    ))}
                </WingBlank>
                <WhiteSpace size="xl" />
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerGlass: {
        paddingTop: Platform.OS === 'ios' ? 60 : 50,
        paddingBottom: 15,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800', // Heavy font for iOS style
        color: '#1a1a1a',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
        fontWeight: '500',
    },
    scrollContent: {
        paddingTop: 10,
    },
    noticeCard: {
        borderRadius: 16,
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.7)',
    },
    noticeContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    noticeText: {
        fontSize: 13,
        color: '#f76a24',
        fontWeight: '500',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
        marginBottom: 12,
        marginLeft: 4,
        letterSpacing: 0.5,
    },
    moduleCard: {
        borderRadius: 24,
        padding: 10,
    }
});
