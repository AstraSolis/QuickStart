import React, { useState, useEffect } from 'react';
import {
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Tabs,
  Descriptions,
  Row,
  Col
} from 'antd';
import {
  GithubOutlined,
  BugOutlined,
  HeartOutlined,
  InfoCircleOutlined,
  SettingOutlined,
  CopyrightOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { GITHUB_LINKS, PROJECT_CONFIG } from '@shared/project-config';

const { Title, Text, Paragraph } = Typography;

export const AboutPanel: React.FC = () => {
  const { themeConfig } = useTheme();
  const { t } = useTranslation('about');

  // 获取国际化的项目配置
  // const i18nProjectConfig = getI18nProjectConfig(t);

  const [activeTab, setActiveTab] = useState('overview');
  const [licenseContent, setLicenseContent] = useState<string>('');

  // 读取LICENSE文件内容
  useEffect(() => {
    // 直接使用LICENSE文件的完整内容
    const licenseText = `MIT License

Copyright (c) 2025 AstraSolis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

    setLicenseContent(licenseText);
  }, []);

  // 应用概览组件
  const AppOverview = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {/* App Information */}
      <div style={{ textAlign: 'center' }}>
        <Title level={2} style={{ margin: 0, marginBottom: 24 }}>
          {t('app.name', 'QuickStart')}
        </Title>
      </div>

      {/* Version Information */}
      <Card size="small" title={<><InfoCircleOutlined /> {t('version.title')}</>}>
        <Descriptions column={2} size="small">
          <Descriptions.Item label={t('version.app')}>
            <Tag color="blue">{t('app.version', `v${PROJECT_CONFIG.version}`)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t('version.build_date')}>
            {t('version.build_date_value')}
          </Descriptions.Item>
          <Descriptions.Item label={t('version.build_number')}>
            {t('version.build_number_value')}
          </Descriptions.Item>
          <Descriptions.Item label={t('version.environment')}>
            <Tag color="green">{t('version.environment_value')}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Project Description */}
      <Card size="small" title={t('project.title')}>
        <Paragraph>
          {t('project.description1')}
        </Paragraph>
        <Paragraph>
          {t('project.description2')}
        </Paragraph>
      </Card>

      {/* Action Buttons */}
      <Card size="small" title={t('actions.open_source')}>
        <div style={{ textAlign: 'center' }}>
          <Space>
            <Button
              type="primary"
              icon={<GithubOutlined />}
              className="apple-button"
              onClick={() => window.open(GITHUB_LINKS.repo)}
            >
              {t('actions.github')}
            </Button>
            <Button
              icon={<BugOutlined />}
              className="apple-button"
              onClick={() => window.open(GITHUB_LINKS.issues)}
            >
              {t('actions.feedback')}
            </Button>
          </Space>
        </div>
      </Card>
    </Space>
  );

  // 鸣谢组件
  const Acknowledgments = () => {
    const techStackItems = [
      'electron', 'react', 'typescript', 'antd', 'i18next',
      'webpack', 'nodejs', 'sqlite', 'jest', 'eslint', 'prettier'
    ];

    return (
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card size="small" title={<><SettingOutlined /> {t('acknowledgments.title')}</>}>
          <div style={{ marginBottom: 16 }}>
            <Text type="secondary">{t('acknowledgments.description')}</Text>
          </div>
          <Row gutter={[16, 16]}>
            {techStackItems.map((tech) => (
              <Col xs={24} sm={12} md={8} lg={6} key={tech}>
                <Card
                  size="small"
                  hoverable
                  style={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  onClick={() => window.open(t(`acknowledgments.tech_stack.${tech}.url`))}
                >
                  <div style={{ textAlign: 'center' }}>
                    <Title level={5} style={{ margin: '0 0 8px 0', fontSize: '14px' }}>
                      {t(`acknowledgments.tech_stack.${tech}.name`)}
                    </Title>
                    <Text
                      type="secondary"
                      style={{
                        fontSize: '12px',
                        display: 'block',
                        lineHeight: '1.4'
                      }}
                    >
                      {t(`acknowledgments.tech_stack.${tech}.description`)}
                    </Text>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </Card>
      </Space>
    );
  };

  // 版权组件
  const Copyright = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small" title={<><CopyrightOutlined /> {t('copyright.title')}</>}>
        <div style={{ textAlign: 'left' }}>
          <Paragraph>
            <Text
              style={{
                fontFamily: 'monospace',
                fontSize: '12px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.5'
              }}
            >
              {licenseContent}
            </Text>
          </Paragraph>
        </div>
      </Card>
    </Space>
  );

  // 支持组件
  const Support = () => (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card size="small" title={<><SafetyOutlined /> {t('support.title')}</>}>
        <div style={{ textAlign: 'center' }}>
          <Space direction="vertical" size="middle">
            <Paragraph>
              <Text type="secondary">
                {t('support.description')}
              </Text>
            </Paragraph>
            <Button
              type="primary"
              icon={<HeartOutlined />}
              size="large"
              className="apple-button"
              onClick={() => window.open(GITHUB_LINKS.sponsors)}
            >
              {t('actions.support')}
            </Button>
          </Space>
        </div>
      </Card>
    </Space>
  );

  const tabItems = [
    {
      key: 'overview',
      label: t('tabs.overview'),
      icon: <InfoCircleOutlined />,
      children: <AppOverview />,
    },
    {
      key: 'acknowledgments',
      label: t('tabs.acknowledgments'),
      icon: <SettingOutlined />,
      children: <Acknowledgments />,
    },
    {
      key: 'copyright',
      label: t('tabs.copyright'),
      icon: <CopyrightOutlined />,
      children: <Copyright />,
    },
    {
      key: 'support',
      label: t('tabs.support'),
      icon: <SafetyOutlined />,
      children: <Support />,
    },
  ];

  return (
    <div className="about-panel-container page-container">
      <Card
        className="apple-card"
        style={{
          background: themeConfig.glassEffect
            ? 'var(--glass-background)'
            : 'rgba(255, 255, 255, 0.8)', // 半透明背景，不完全遮挡
          backdropFilter: themeConfig.glassEffect
            ? 'var(--glass-backdrop-filter)'
            : 'blur(10px)',
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="small"
        />
      </Card>
    </div>
  );
};
