/**
 * 主题导入导出模态框组件
 * 提供主题导入和预览的模态框界面
 */

import React from 'react';
import { Modal, Upload, Alert, Button } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import ThemePreview from './ThemePreview';
import type { ThemeConfig } from '../contexts/ThemeContext';

// 组件属性接口
export interface ThemeImportExportModalsProps {
  /** 当前主题配置 */
  themeConfig: ThemeConfig;
  /** 主题导入模态框是否可见 */
  themeImportModalVisible: boolean;
  /** 设置主题导入模态框可见性 */
  setThemeImportModalVisible: (visible: boolean) => void;
  /** 主题预览模态框是否可见 */
  themePreviewModalVisible: boolean;
  /** 设置主题预览模态框可见性 */
  setThemePreviewModalVisible: (visible: boolean) => void;
  /** 预览的主题配置 */
  previewThemeConfig: ThemeConfig | null;
  /** 设置预览的主题配置 */
  setPreviewThemeConfig: (config: ThemeConfig | null) => void;
  /** 主题文件上传处理函数 */
  onThemeFileUpload: (file: File) => void;
  /** 应用预览主题处理函数 */
  onApplyPreviewTheme: () => void;
}

/**
 * 主题导入导出模态框组件
 */
export const ThemeImportExportModals: React.FC<ThemeImportExportModalsProps> = ({
  themeConfig,
  themeImportModalVisible,
  setThemeImportModalVisible,
  themePreviewModalVisible,
  setThemePreviewModalVisible,
  previewThemeConfig,
  setPreviewThemeConfig,
  onThemeFileUpload,
  onApplyPreviewTheme,
}) => {
  const { t } = useTranslation(['theme', 'common']);

  return (
    <>
      {/* 主题导入模态框 */}
      <Modal
        title={t('theme:import.title', '导入主题')}
        open={themeImportModalVisible}
        onCancel={() => setThemeImportModalVisible(false)}
        footer={null}
        width={600}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Upload.Dragger
            accept=".json"
            beforeUpload={(file) => {
              onThemeFileUpload(file);
              return false; // 阻止自动上传
            }}
            showUploadList={false}
            style={{ marginBottom: 16 }}
          >
            <p className="ant-upload-drag-icon">
              <UploadOutlined style={{ fontSize: 48, color: themeConfig.primaryColor }} />
            </p>
            <p className="ant-upload-text">
              {t('theme:import.dragText', '点击或拖拽主题文件到此区域')}
            </p>
            <p className="ant-upload-hint">
              {t('theme:import.hint', '支持 .json 格式的主题配置文件')}
            </p>
          </Upload.Dragger>
          
          <Alert
            message={t('theme:import.notice', '导入须知')}
            description={t('theme:import.description', '导入的主题将会覆盖当前设置，建议先导出当前主题作为备份。系统会自动验证主题文件的有效性。')}
            type="info"
            showIcon
            style={{ textAlign: 'left' }}
          />
        </div>
      </Modal>

      {/* 主题预览模态框 */}
      <Modal
        title={t('theme:preview.title', '主题预览')}
        open={themePreviewModalVisible}
        onCancel={() => {
          setThemePreviewModalVisible(false);
          setPreviewThemeConfig(null);
        }}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => {
            setThemePreviewModalVisible(false);
            setPreviewThemeConfig(null);
          }}>
            {t('common:cancel', '取消')}
          </Button>,
          <Button
            key="apply"
            type="primary"
            onClick={onApplyPreviewTheme}
            style={{ backgroundColor: previewThemeConfig?.primaryColor }}
          >
            {t('theme:preview.apply', '应用主题')}
          </Button>,
        ]}
      >
        {previewThemeConfig && (
          <ThemePreview
            themeConfig={previewThemeConfig}
            title={t('theme:preview.importPreview', '导入主题预览')}
            showDetails={true}
            compareMode={true}
            baseTheme={themeConfig}
          />
        )}
      </Modal>
    </>
  );
};

export default ThemeImportExportModals;
