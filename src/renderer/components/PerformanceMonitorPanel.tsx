/**
 * 性能监控面板组件
 * 提供性能指标的可视化展示和配置界面
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Typography,
  Switch,
  Select,
  InputNumber,
  Space,
  Button,
  Divider,
  Tabs,
  Table,
  Statistic,
  Empty,
  Alert,
} from 'antd';
import {
  LineChartOutlined,
  ReloadOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  DatabaseOutlined, // 使用DatabaseOutlined替代不存在的MemoryOutlined
  DashboardOutlined,
  ThunderboltOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  performanceMonitor,
  MetricType,
  type PerformanceMetric,
  type PerformanceMonitorConfig,
} from '../utils/PerformanceMonitor';

const { Title, Text } = Typography;
const { Option } = Select;

// 组件属性接口
export interface PerformanceMonitorPanelProps {
  /** 是否为移动端 */
  isMobile?: boolean;
}

/**
 * 性能监控面板组件
 */
export const PerformanceMonitorPanel: React.FC<PerformanceMonitorPanelProps> = ({
  isMobile = false,
}) => {
  const { t } = useTranslation(['theme']);
  
  // 状态管理
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [config, setConfig] = useState<PerformanceMonitorConfig>(performanceMonitor.getConfig());
  const [selectedMetricType, setSelectedMetricType] = useState<MetricType>(MetricType.THEME_SWITCH);
  const [refreshKey, setRefreshKey] = useState(0);

  // 刷新指标数据
  const refreshMetrics = useCallback(() => {
    setMetrics(performanceMonitor.getMetrics(selectedMetricType));
    setRefreshKey(prev => prev + 1);
  }, [selectedMetricType]);

  // 监听指标更新
  useEffect(() => {
    const handleMetricUpdate = (metric: PerformanceMetric) => {
      if (metric.type === selectedMetricType) {
        refreshMetrics();
      }
    };

    performanceMonitor.addListener(selectedMetricType, handleMetricUpdate);
    refreshMetrics();

    return () => {
      performanceMonitor.removeListener(selectedMetricType, handleMetricUpdate);
    };
  }, [selectedMetricType, refreshMetrics]);

  // 更新配置
  const updateConfig = useCallback((updates: Partial<PerformanceMonitorConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    performanceMonitor.updateConfig(newConfig);
  }, [config]);

  // 清除指标数据
  const clearMetrics = useCallback(() => {
    performanceMonitor.clearMetrics();
    refreshMetrics();
  }, [refreshMetrics]);

  // 手动测试主题切换性能
  const testThemeSwitch = useCallback(() => {
    // 模拟主题切换操作
    performanceMonitor.measureThemeSwitch(() => {
      // 模拟主题切换的工作量
      const start = performance.now();
      while (performance.now() - start < 50) {
        // 空循环模拟工作
      }
    }, { test: true });
    
    refreshMetrics();
  }, [refreshMetrics]);

  // 计算平均值
  const calculateAverage = useCallback((metrics: PerformanceMetric[]): number => {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, metric) => acc + metric.value, 0);
    return sum / metrics.length;
  }, []);

  // 计算最大值
  const calculateMax = useCallback((metrics: PerformanceMetric[]): number => {
    if (metrics.length === 0) return 0;
    return Math.max(...metrics.map(metric => metric.value));
  }, []);

  // 计算最小值
  const calculateMin = useCallback((metrics: PerformanceMetric[]): number => {
    if (metrics.length === 0) return 0;
    return Math.min(...metrics.map(metric => metric.value));
  }, []);

  // 渲染指标统计
  const renderMetricStats = () => {
    const average = calculateAverage(metrics);
    const max = calculateMax(metrics);
    const min = calculateMin(metrics);

    return (
      <Row gutter={16}>
        <Col span={isMobile ? 24 : 8}>
          <Statistic
            title={t('theme:performance.average', '平均值')}
            value={average.toFixed(2)}
            suffix={metrics.length > 0 ? metrics[0].unit : ''}
            precision={2}
          />
        </Col>
        <Col span={isMobile ? 12 : 8}>
          <Statistic
            title={t('theme:performance.max', '最大值')}
            value={max.toFixed(2)}
            suffix={metrics.length > 0 ? metrics[0].unit : ''}
            precision={2}
            valueStyle={{ color: '#cf1322' }}
          />
        </Col>
        <Col span={isMobile ? 12 : 8}>
          <Statistic
            title={t('theme:performance.min', '最小值')}
            value={min.toFixed(2)}
            suffix={metrics.length > 0 ? metrics[0].unit : ''}
            precision={2}
            valueStyle={{ color: '#3f8600' }}
          />
        </Col>
      </Row>
    );
  };

  // 渲染指标表格
  const renderMetricTable = () => {
    const columns = [
      {
        title: t('theme:performance.name', '名称'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('theme:performance.value', '值'),
        dataIndex: 'value',
        key: 'value',
        render: (value: number, record: PerformanceMetric) => `${value.toFixed(2)} ${record.unit}`,
        sorter: (a: PerformanceMetric, b: PerformanceMetric) => a.value - b.value,
      },
      {
        title: t('theme:performance.timestamp', '时间'),
        dataIndex: 'timestamp',
        key: 'timestamp',
        render: (timestamp: number) => new Date(timestamp).toLocaleTimeString(),
        sorter: (a: PerformanceMetric, b: PerformanceMetric) => a.timestamp - b.timestamp,
      },
    ];

    return (
      <Table
        dataSource={metrics.map(metric => ({ ...metric, key: metric.id }))}
        columns={columns}
        size="small"
        pagination={{ pageSize: 5 }}
      />
    );
  };

  // 渲染配置面板
  const renderConfigPanel = () => (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Row gutter={16} align="middle">
        <Col span={isMobile ? 16 : 8}>
          <Text>{t('theme:performance.enabled', '启用监控')}:</Text>
        </Col>
        <Col span={isMobile ? 8 : 16}>
          <Switch
            checked={config.enabled}
            onChange={(checked) => updateConfig({ enabled: checked })}
          />
        </Col>
      </Row>

      <Row gutter={16} align="middle">
        <Col span={isMobile ? 16 : 8}>
          <Text>{t('theme:performance.sampleInterval', '采样间隔')}:</Text>
        </Col>
        <Col span={isMobile ? 8 : 16}>
          <InputNumber
            min={100}
            max={10000}
            step={100}
            value={config.sampleInterval}
            onChange={(value) => updateConfig({ sampleInterval: value as number })}
            addonAfter="ms"
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      <Row gutter={16} align="middle">
        <Col span={isMobile ? 16 : 8}>
          <Text>{t('theme:performance.maxSamples', '最大样本数')}:</Text>
        </Col>
        <Col span={isMobile ? 8 : 16}>
          <InputNumber
            min={10}
            max={1000}
            step={10}
            value={config.maxSamples}
            onChange={(value) => updateConfig({ maxSamples: value as number })}
            style={{ width: '100%' }}
          />
        </Col>
      </Row>

      <Row gutter={16} align="middle">
        <Col span={isMobile ? 16 : 8}>
          <Text>{t('theme:performance.autoMemorySampling', '自动内存采样')}:</Text>
        </Col>
        <Col span={isMobile ? 8 : 16}>
          <Switch
            checked={config.autoMemorySampling}
            onChange={(checked) => updateConfig({ autoMemorySampling: checked })}
          />
        </Col>
      </Row>

      <Row gutter={16} align="middle">
        <Col span={isMobile ? 16 : 8}>
          <Text>{t('theme:performance.autoFpsSampling', '自动FPS采样')}:</Text>
        </Col>
        <Col span={isMobile ? 8 : 16}>
          <Switch
            checked={config.autoFpsSampling}
            onChange={(checked) => updateConfig({ autoFpsSampling: checked })}
          />
        </Col>
      </Row>

      <Row gutter={16} align="middle">
        <Col span={isMobile ? 16 : 8}>
          <Text>{t('theme:performance.logToConsole', '输出到控制台')}:</Text>
        </Col>
        <Col span={isMobile ? 8 : 16}>
          <Switch
            checked={config.logToConsole}
            onChange={(checked) => updateConfig({ logToConsole: checked })}
          />
        </Col>
      </Row>
    </Space>
  );

  // 渲染指标类型选择器
  const renderMetricTypeSelector = () => (
    <Row gutter={16} align="middle" style={{ marginBottom: 16 }}>
      <Col span={isMobile ? 24 : 12}>
        <Select
          value={selectedMetricType}
          onChange={setSelectedMetricType}
          style={{ width: '100%' }}
        >
          <Option value={MetricType.THEME_SWITCH}>
            <ClockCircleOutlined /> {t('theme:performance.themeSwitch', '主题切换')}
          </Option>
          <Option value={MetricType.RENDER_TIME}>
            <DashboardOutlined /> {t('theme:performance.renderTime', '渲染时间')}
          </Option>
          <Option value={MetricType.MEMORY_USAGE}>
            <DatabaseOutlined /> {t('theme:performance.memoryUsage', '内存使用')}
          </Option>
          <Option value={MetricType.FPS}>
            <ThunderboltOutlined /> {t('theme:performance.fps', '帧率')}
          </Option>
        </Select>
      </Col>
      <Col span={isMobile ? 24 : 12} style={{ textAlign: 'right', marginTop: isMobile ? 8 : 0 }}>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshMetrics}
            size={isMobile ? 'small' : 'middle'}
          >
            {t('theme:performance.refresh', '刷新')}
          </Button>
          <Button
            icon={<ClearOutlined />}
            onClick={clearMetrics}
            size={isMobile ? 'small' : 'middle'}
          >
            {t('theme:performance.clear', '清除')}
          </Button>
          {selectedMetricType === MetricType.THEME_SWITCH && (
            <Button
              type="primary"
              onClick={testThemeSwitch}
              size={isMobile ? 'small' : 'middle'}
            >
              {t('theme:performance.test', '测试')}
            </Button>
          )}
        </Space>
      </Col>
    </Row>
  );

  const tabItems = [
    {
      key: 'metrics',
      label: t('theme:performance.metrics', '指标'),
      icon: <LineChartOutlined />,
      children: (
        <>
          {renderMetricTypeSelector()}
          
          {metrics.length === 0 ? (
            <Empty description={t('theme:performance.noData', '暂无数据')} />
          ) : (
            <>
              {renderMetricStats()}
              <Divider />
              {renderMetricTable()}
            </>
          )}
        </>
      ),
    },
    {
      key: 'config',
      label: t('theme:performance.config', '配置'),
      icon: <SettingOutlined />,
      children: renderConfigPanel(),
    },
  ];

  return (
    <Card size="small" title={t('theme:performance.title', '性能监控')}>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Alert
          message={t('theme:performance.info', '性能监控信息')}
          description={t('theme:performance.description', '此面板提供样式系统性能监控，包括主题切换耗时、内存使用、渲染性能等指标。')}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Tabs
          items={tabItems}
          size="small"
          tabPosition={isMobile ? 'top' : 'top'}
        />
      </Space>
    </Card>
  );
};

export default PerformanceMonitorPanel;
