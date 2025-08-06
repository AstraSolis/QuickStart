/**
 * 主题导入导出组件
 * 从StylesPanel中提取的主题导入导出功能
 */

import React, { useState } from 'react';
import { Card, Button, Space, message, Modal, Upload } from 'antd';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslation } from '../../../hooks/useTranslation';
import { useTheme } from '../../contexts/ThemeContext';

interface ThemeExportImportProps {
  isMobile?: boolean;
}

export const ThemeExportImport: React.FC<ThemeExportImportProps> = ({ isMobile = false }) => {
  const { t } = useTranslation(['theme', 'common']);
  const { themeConfig, updateTheme } = useTheme();
  const [importModalVisible, setImportModalVisible] = useState(false);

  // 导出主题配置
  const handleExportTheme = () => {
    try {
      // 添加导出时间戳和版本信息
      const exportData = {
        ...themeConfig,
        exportInfo: {
          timestamp: new Date().toISOString(),
          version: themeConfig.version || '1.2.0',
          appVersion: '1.0.0', // 可以从package.json获取
          exportedBy: 'QuickStart Theme Manager',
        },
      };

      const themeData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([themeData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // 生成更有意义的文件名
      const timestamp = new Date().toISOString().split('T')[0];
      const themeName = themeConfig.activeTheme || 'custom';
      a.download = `quickstart-theme-${themeName}-${timestamp}.json`;

      a.click();
      URL.revokeObjectURL(url);
      
      message.success(t('theme:export.success'));
    } catch (error) {
      console.error('Export theme failed:', error);
      message.error(t('theme:export.failed'));
    }
  };

  // 导入主题配置
  const handleImportTheme = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string;
        const importedTheme = JSON.parse(result);
        
        // 验证导入的主题配置
        if (!importedTheme || typeof importedTheme !== 'object') {
          throw new Error('Invalid theme format');
        }

        // 移除导出信息，只保留主题配置
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { exportInfo, ...themeData } = importedTheme;
        
        // 更新主题配置
        updateTheme(themeData);
        message.success(t('theme:import.success'));
        setImportModalVisible(false);
      } catch (error) {
        console.error('Import theme failed:', error);
        message.error(t('theme:import.failed'));
      }
    };
    reader.readAsText(file);
    return false; // 阻止默认上传行为
  };

  return (
    <>
      <Card 
        title={t('theme:importExport.title')}
        size="small"
      >
        <Space 
          direction={isMobile ? 'vertical' : 'horizontal'} 
          style={{ width: '100%' }}
          size="middle"
        >
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportTheme}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            {t('theme:export.button')}
          </Button>
          
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportModalVisible(true)}
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            {t('theme:import.button')}
          </Button>
        </Space>
      </Card>

      {/* 导入主题模态框 */}
      <Modal
        title={t('theme:import.modalTitle')}
        open={importModalVisible}
        onCancel={() => setImportModalVisible(false)}
        footer={null}
        width={isMobile ? '90%' : 520}
      >
        <Upload.Dragger
          accept=".json"
          beforeUpload={handleImportTheme}
          showUploadList={false}
          style={{ margin: '20px 0' }}
        >
          <p className="ant-upload-drag-icon">
            <UploadOutlined style={{ fontSize: '48px', color: '#1890ff' }} />
          </p>
          <p className="ant-upload-text">
            {t('theme:import.dragText')}
          </p>
          <p className="ant-upload-hint">
            {t('theme:import.hint')}
          </p>
        </Upload.Dragger>
      </Modal>
    </>
  );
};
