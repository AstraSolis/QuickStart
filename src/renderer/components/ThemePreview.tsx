/**
 * 主题预览组件
 * 提供主题配置的实时预览功能，支持导入前预览和主题对比
 */

import React, { useMemo } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Tag,
  Row,
  Col,
  Divider,
  Avatar,
  Progress,
  Switch,
  Slider,
  Input,
  Select,
} from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  HeartOutlined,
  StarOutlined,
  MessageOutlined,
  BellOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ThemeConfig } from '../contexts/ThemeContext';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// 组件属性接口
export interface ThemePreviewProps {
  /** 要预览的主题配置 */
  themeConfig: ThemeConfig;
  /** 预览标题 */
  title?: string;
  /** 是否显示详细信息 */
  showDetails?: boolean;
  /** 是否显示对比模式 */
  compareMode?: boolean;
  /** 对比的基准主题 */
  baseTheme?: ThemeConfig;
  /** 预览容器样式 */
  style?: React.CSSProperties;
  /** 预览容器类名 */
  className?: string;
}

/**
 * 主题预览组件
 */
export const ThemePreview: React.FC<ThemePreviewProps> = ({
  themeConfig,
  title = '主题预览',
  showDetails = true,
  compareMode = false,
  baseTheme,
  style,
  className,
}) => {
  const { t } = useTranslation(['theme', 'common']);

  // 生成预览样式
  const previewStyle = useMemo(() => {
    const isDark = themeConfig.mode === 'dark';
    
    return {
      '--preview-primary-color': themeConfig.primaryColor,
      '--preview-border-radius': `${themeConfig.borderRadius}px`,
      '--preview-font-family': themeConfig.fontFamily,
      '--preview-font-size': `${themeConfig.fontSize}px`,
      '--preview-glass-opacity': themeConfig.glassOpacity.toString(),
      '--preview-surface-color': themeConfig.customColors.surface,
      '--preview-text-color': themeConfig.customColors.text,
      '--preview-text-secondary-color': themeConfig.customColors.textSecondary,
      '--preview-border-color': themeConfig.customColors.border,
      '--preview-shadow-color': themeConfig.customColors.shadow,
      '--preview-background': isDark ? '#1c1c1e' : '#ffffff',
      '--preview-card-background': isDark 
        ? `rgba(28, 28, 30, ${themeConfig.glassOpacity})` 
        : `rgba(255, 255, 255, ${themeConfig.glassOpacity})`,
      '--preview-backdrop-filter': themeConfig.glassEffect 
        ? 'blur(20px) saturate(180%)' 
        : 'none',
    } as React.CSSProperties;
  }, [themeConfig]);

  // 渲染主题信息
  const renderThemeInfo = () => (
    <Card size="small" title={t('theme:preview.themeInfo', '主题信息')}>
      <Row gutter={[16, 8]}>
        <Col span={12}>
          <Text type="secondary">{t('theme:preview.version', '版本')}:</Text>
          <br />
          <Text>{themeConfig.version}</Text>
        </Col>
        <Col span={12}>
          <Text type="secondary">{t('theme:preview.mode', '模式')}:</Text>
          <br />
          <Tag color={themeConfig.mode === 'dark' ? 'purple' : themeConfig.mode === 'light' ? 'gold' : 'blue'}>
            {t(`theme:modes.${themeConfig.mode}`, themeConfig.mode)}
          </Tag>
        </Col>
        <Col span={12}>
          <Text type="secondary">{t('theme:preview.primaryColor', '主色调')}:</Text>
          <br />
          <Space>
            <div
              style={{
                width: 16,
                height: 16,
                backgroundColor: themeConfig.primaryColor,
                borderRadius: 2,
                border: '1px solid #d9d9d9',
              }}
            />
            <Text code>{themeConfig.primaryColor}</Text>
          </Space>
        </Col>
        <Col span={12}>
          <Text type="secondary">{t('theme:preview.glassEffect', '毛玻璃效果')}:</Text>
          <br />
          <Tag color={themeConfig.glassEffect ? 'green' : 'default'}>
            {themeConfig.glassEffect ? t('common:enabled', '启用') : t('common:disabled', '禁用')}
          </Tag>
        </Col>
      </Row>
    </Card>
  );

  // 渲染预览内容
  const renderPreviewContent = () => (
    <div
      style={{
        ...previewStyle,
        background: 'var(--preview-background)',
        borderRadius: 'var(--preview-border-radius)',
        padding: '16px',
        fontFamily: 'var(--preview-font-family)',
        fontSize: 'var(--preview-font-size)',
        color: 'var(--preview-text-color)',
        minHeight: '300px',
      }}
    >
      {/* 模拟应用头部 */}
      <div
        style={{
          background: 'var(--preview-card-background)',
          backdropFilter: 'var(--preview-backdrop-filter)',
          borderRadius: 'var(--preview-border-radius)',
          padding: '12px 16px',
          marginBottom: '16px',
          border: `1px solid var(--preview-border-color)`,
          boxShadow: `0 2px 8px var(--preview-shadow-color)`,
        }}
      >
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={4} style={{ margin: 0, color: 'var(--preview-text-color)' }}>
              QuickStart
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                size="small"
                style={{
                  backgroundColor: 'var(--preview-primary-color)',
                  borderColor: 'var(--preview-primary-color)',
                  borderRadius: 'var(--preview-border-radius)',
                }}
              >
                {t('common:search', '搜索')}
              </Button>
              <Avatar size="small" icon={<UserOutlined />} />
            </Space>
          </Col>
        </Row>
      </div>

      {/* 模拟内容卡片 */}
      <Row gutter={16}>
        <Col span={16}>
          <div
            style={{
              background: 'var(--preview-card-background)',
              backdropFilter: 'var(--preview-backdrop-filter)',
              borderRadius: 'var(--preview-border-radius)',
              padding: '16px',
              border: `1px solid var(--preview-border-color)`,
              boxShadow: `0 2px 8px var(--preview-shadow-color)`,
              marginBottom: '16px',
            }}
          >
            <Title level={5} style={{ color: 'var(--preview-text-color)', marginBottom: '8px' }}>
              {t('theme:preview.sampleTitle', '示例标题')}
            </Title>
            <Paragraph style={{ color: 'var(--preview-text-secondary-color)', marginBottom: '12px' }}>
              {t('theme:preview.sampleContent', '这是一段示例内容，用于展示主题的文本颜色和排版效果。')}
            </Paragraph>
            
            <Space wrap>
              <Button
                type="primary"
                style={{
                  backgroundColor: 'var(--preview-primary-color)',
                  borderColor: 'var(--preview-primary-color)',
                  borderRadius: 'var(--preview-border-radius)',
                }}
              >
                {t('common:confirm', '确认')}
              </Button>
              <Button style={{ borderRadius: 'var(--preview-border-radius)' }}>
                {t('common:cancel', '取消')}
              </Button>
              <Tag color="processing">{t('theme:preview.processing', '处理中')}</Tag>
              <Tag color="success">{t('theme:preview.completed', '已完成')}</Tag>
            </Space>
          </div>

          {/* 模拟表单 */}
          <div
            style={{
              background: 'var(--preview-card-background)',
              backdropFilter: 'var(--preview-backdrop-filter)',
              borderRadius: 'var(--preview-border-radius)',
              padding: '16px',
              border: `1px solid var(--preview-border-color)`,
              boxShadow: `0 2px 8px var(--preview-shadow-color)`,
            }}
          >
            <Title level={5} style={{ color: 'var(--preview-text-color)', marginBottom: '12px' }}>
              {t('theme:preview.formExample', '表单示例')}
            </Title>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text style={{ color: 'var(--preview-text-color)' }}>
                  {t('theme:preview.inputLabel', '输入框')}:
                </Text>
                <Input
                  placeholder={t('theme:preview.inputPlaceholder', '请输入内容')}
                  style={{ 
                    marginTop: '4px',
                    borderRadius: 'var(--preview-border-radius)',
                  }}
                />
              </div>
              
              <div>
                <Text style={{ color: 'var(--preview-text-color)' }}>
                  {t('theme:preview.selectLabel', '选择器')}:
                </Text>
                <Select
                  defaultValue="option1"
                  style={{ 
                    width: '100%', 
                    marginTop: '4px',
                  }}
                >
                  <Option value="option1">{t('theme:preview.option1', '选项1')}</Option>
                  <Option value="option2">{t('theme:preview.option2', '选项2')}</Option>
                </Select>
              </div>
              
              <div>
                <Row justify="space-between" align="middle">
                  <Text style={{ color: 'var(--preview-text-color)' }}>
                    {t('theme:preview.switchLabel', '开关')}:
                  </Text>
                  <Switch defaultChecked />
                </Row>
              </div>
              
              <div>
                <Text style={{ color: 'var(--preview-text-color)' }}>
                  {t('theme:preview.sliderLabel', '滑块')}:
                </Text>
                <Slider defaultValue={30} style={{ marginTop: '8px' }} />
              </div>
            </Space>
          </div>
        </Col>

        <Col span={8}>
          {/* 模拟侧边栏 */}
          <div
            style={{
              background: 'var(--preview-card-background)',
              backdropFilter: 'var(--preview-backdrop-filter)',
              borderRadius: 'var(--preview-border-radius)',
              padding: '16px',
              border: `1px solid var(--preview-border-color)`,
              boxShadow: `0 2px 8px var(--preview-shadow-color)`,
              marginBottom: '16px',
            }}
          >
            <Title level={5} style={{ color: 'var(--preview-text-color)', marginBottom: '12px' }}>
              {t('theme:preview.quickActions', '快速操作')}
            </Title>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <Button
                block
                icon={<SettingOutlined />}
                style={{ borderRadius: 'var(--preview-border-radius)' }}
              >
                {t('theme:preview.settings', '设置')}
              </Button>
              <Button
                block
                icon={<HeartOutlined />}
                style={{ borderRadius: 'var(--preview-border-radius)' }}
              >
                {t('theme:preview.favorites', '收藏')}
              </Button>
              <Button
                block
                icon={<StarOutlined />}
                style={{ borderRadius: 'var(--preview-border-radius)' }}
              >
                {t('theme:preview.starred', '已标记')}
              </Button>
            </Space>
          </div>

          {/* 模拟进度卡片 */}
          <div
            style={{
              background: 'var(--preview-card-background)',
              backdropFilter: 'var(--preview-backdrop-filter)',
              borderRadius: 'var(--preview-border-radius)',
              padding: '16px',
              border: `1px solid var(--preview-border-color)`,
              boxShadow: `0 2px 8px var(--preview-shadow-color)`,
            }}
          >
            <Title level={5} style={{ color: 'var(--preview-text-color)', marginBottom: '12px' }}>
              {t('theme:preview.progress', '进度')}
            </Title>
            
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <Text style={{ color: 'var(--preview-text-secondary-color)' }}>
                  {t('theme:preview.taskProgress', '任务进度')}
                </Text>
                <Progress 
                  percent={75} 
                  strokeColor="var(--preview-primary-color)"
                  style={{ marginTop: '4px' }}
                />
              </div>
              
              <div>
                <Text style={{ color: 'var(--preview-text-secondary-color)' }}>
                  {t('theme:preview.storageUsage', '存储使用')}
                </Text>
                <Progress 
                  percent={45} 
                  strokeColor="var(--preview-primary-color)"
                  style={{ marginTop: '4px' }}
                />
              </div>
            </Space>
          </div>
        </Col>
      </Row>
    </div>
  );

  return (
    <div className={className} style={style}>
      <Card
        title={title}
        size="small"
        style={{ marginBottom: showDetails ? '16px' : 0 }}
      >
        {renderPreviewContent()}
      </Card>
      
      {showDetails && renderThemeInfo()}
      
      {compareMode && baseTheme && (
        <Card size="small" title={t('theme:preview.comparison', '对比信息')}>
          <Row gutter={16}>
            <Col span={12}>
              <Text strong>{t('theme:preview.currentTheme', '当前主题')}</Text>
              <br />
              <Text>主色调: {themeConfig.primaryColor}</Text>
              <br />
              <Text>模式: {themeConfig.mode}</Text>
            </Col>
            <Col span={12}>
              <Text strong>{t('theme:preview.baseTheme', '基准主题')}</Text>
              <br />
              <Text>主色调: {baseTheme.primaryColor}</Text>
              <br />
              <Text>模式: {baseTheme.mode}</Text>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  );
};

export default ThemePreview;
