/**
 * 颜色设置组件
 * 提供主题颜色配置的UI界面
 */

import React from 'react';
import { Card, Row, Col, Typography, ColorPicker, Space } from 'antd';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import type { Color } from 'antd/es/color-picker';

const { Text } = Typography;

// 组件属性接口
export interface ColorSettingsProps {
  /** 是否为移动端 */
  isMobile?: boolean;
  /** 颜色变化处理函数 */
  onColorChange: (colorKey: string, color: Color) => void;
}

/**
 * 颜色设置组件
 */
export const ColorSettings: React.FC<ColorSettingsProps> = ({
  isMobile = false,
  onColorChange,
}) => {
  const { t } = useTranslation(['theme']);
  const { themeConfig } = useTheme();

  // 渲染颜色设置项
  const renderColorSetting = (
    labelKey: string,
    colorKey: string,
    descKey?: string,
    span?: { label: number; picker: number; desc: number }
  ) => {
    const defaultSpan = isMobile 
      ? { label: 24, picker: 24, desc: 24 }
      : { label: 8, picker: 8, desc: 8 };
    const actualSpan = span || defaultSpan;

    return (
      <Row gutter={[16, 8]} align="middle" style={{ marginBottom: isMobile ? 16 : 8 }}>
        <Col {...(isMobile ? { span: actualSpan.label } : { span: actualSpan.label })}>
          <Text>{t(labelKey)}:</Text>
        </Col>
        <Col {...(isMobile ? { span: actualSpan.picker } : { span: actualSpan.picker })}>
          <ColorPicker
            value={colorKey === 'primary' ? themeConfig.primaryColor : themeConfig.customColors[colorKey as keyof typeof themeConfig.customColors]}
            onChange={(color) => onColorChange(colorKey, color)}
            showText={!isMobile}
            trigger="click"
            style={{ width: isMobile ? '100%' : 'auto' }}
          />
        </Col>
        {descKey && (
          <Col {...(isMobile ? { span: actualSpan.desc } : { span: actualSpan.desc })}>
            <Text type="secondary" style={{ fontSize: isMobile ? '12px' : '14px' }}>
              {t(descKey)}
            </Text>
          </Col>
        )}
      </Row>
    );
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* 主色调设置 */}
      <Card size="small" title={t('theme:global.primaryColor', '主色调')}>
        {renderColorSetting(
          'theme:global.primaryColor',
          'primary',
          'theme:global.primaryColorDesc',
          isMobile ? undefined : { label: 6, picker: 6, desc: 12 }
        )}
      </Card>

      {/* 自定义颜色设置 */}
      <Card size="small" title={t('theme:global.customColors', '自定义颜色')}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {renderColorSetting(
            'theme:global.surfaceColor',
            'surface',
            'theme:global.surfaceColorDesc'
          )}
          
          {renderColorSetting(
            'theme:global.textColor',
            'text',
            'theme:global.textColorDesc'
          )}
          
          {renderColorSetting(
            'theme:global.textSecondaryColor',
            'textSecondary',
            'theme:global.textSecondaryColorDesc'
          )}
          
          {renderColorSetting(
            'theme:global.borderColor',
            'border',
            'theme:global.borderColorDesc'
          )}
          
          {renderColorSetting(
            'theme:global.shadowColor',
            'shadow',
            'theme:global.shadowColorDesc'
          )}
        </Space>
      </Card>
    </Space>
  );
};

export default ColorSettings;
