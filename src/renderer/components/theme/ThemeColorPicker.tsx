/**
 * 主题颜色选择器组件
 * 从StylesPanel中提取的颜色选择功能
 */

import React from 'react';
import { Card, Row, Col, Typography, ColorPicker, Space } from 'antd';
import { useTranslation } from '../../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';
import type { Color } from 'antd/es/color-picker';

const { Title, Text } = Typography;

interface ThemeColorPickerProps {
  isMobile?: boolean;
}

export const ThemeColorPicker: React.FC<ThemeColorPickerProps> = ({ isMobile = false }) => {
  const { t } = useTranslation(['theme']);
  const { themeConfig, updateTheme } = useTheme();

  // 处理颜色变化
  const handleColorChange = (colorKey: string, color: Color) => {
    const hexColor = color.toHexString();
    if (colorKey === 'primary') {
      updateTheme({ primaryColor: hexColor });
    } else {
      updateTheme({
        customColors: {
          ...themeConfig.customColors,
          [colorKey]: hexColor,
        },
      });
    }
  };

  // 颜色配置项
  const colorItems = [
    {
      key: 'primary',
      label: t('theme:colors.primary'),
      value: themeConfig.primaryColor,
      description: t('theme:colors.primaryDescription'),
    },
    {
      key: 'surface',
      label: t('theme:colors.surface'),
      value: themeConfig.customColors?.surface || '#f5f5f5',
      description: t('theme:colors.surfaceDescription'),
    },
    {
      key: 'text',
      label: t('theme:colors.text'),
      value: themeConfig.customColors?.text || '#000000',
      description: t('theme:colors.textDescription'),
    },
    {
      key: 'border',
      label: t('theme:colors.border'),
      value: themeConfig.customColors?.border || '#d9d9d9',
      description: t('theme:colors.borderDescription'),
    },
  ];

  return (
    <Card 
      title={
        <Space>
          <Title level={4} style={{ margin: 0 }}>
            {t('theme:colors.title')}
          </Title>
        </Space>
      }
      size="small"
    >
      <Row gutter={[16, 16]}>
        {colorItems.map((item) => (
          <Col 
            key={item.key} 
            xs={24} 
            sm={isMobile ? 24 : 12} 
            md={isMobile ? 24 : 8}
          >
            <div style={{ textAlign: 'center' }}>
              <Text strong>{item.label}</Text>
              <div style={{ margin: '8px 0' }}>
                <ColorPicker
                  value={item.value}
                  onChange={(color) => handleColorChange(item.key, color)}
                  showText
                  size="large"
                  style={{ width: '100%' }}
                />
              </div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {item.description}
              </Text>
            </div>
          </Col>
        ))}
      </Row>
    </Card>
  );
};
