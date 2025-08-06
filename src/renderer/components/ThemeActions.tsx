/**
 * 主题操作按钮组件
 * 提供主题导入导出、重置等操作按钮
 */

import React from 'react';
import { Space, Button, Drawer } from 'antd';
import {
  DownloadOutlined,
  UploadOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

// 组件属性接口
export interface ThemeActionsProps {
  /** 是否为移动端 */
  isMobile?: boolean;
  /** 导出主题处理函数 */
  onExportTheme: () => void;
  /** 导入主题处理函数 */
  onImportTheme: () => void;
  /** 重置主题处理函数 */
  onResetTheme: () => void;
  /** 打开图标上传器处理函数 */
  onOpenIconUploader: () => void;
  /** 移动端抽屉是否可见 */
  mobileDrawerVisible?: boolean;
  /** 设置移动端抽屉可见性 */
  setMobileDrawerVisible?: (visible: boolean) => void;
}

/**
 * 主题操作按钮组件
 */
export const ThemeActions: React.FC<ThemeActionsProps> = ({
  isMobile = false,
  onExportTheme,
  onImportTheme,
  onResetTheme,
  onOpenIconUploader,
  mobileDrawerVisible = false,
  setMobileDrawerVisible,
}) => {
  const { t } = useTranslation(['theme', 'common']);

  // 移动端渲染
  if (isMobile) {
    return (
      <>
        {/* 移动端菜单按钮 */}
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setMobileDrawerVisible?.(true)}
          size="large"
        />

        {/* 移动端抽屉菜单 */}
        <Drawer
          title={t('theme:ui.mobileMenu', '样式设置菜单')}
          placement="right"
          onClose={() => setMobileDrawerVisible?.(false)}
          open={mobileDrawerVisible}
          width="80%"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button
              block
              icon={<AppstoreOutlined />}
              onClick={() => {
                onOpenIconUploader();
                setMobileDrawerVisible?.(false);
              }}
            >
              {t('theme:iconUpload.title', '自定义图标')}
            </Button>
            <Button
              block
              icon={<DownloadOutlined />}
              onClick={() => {
                onExportTheme();
                setMobileDrawerVisible?.(false);
              }}
            >
              {t('theme:actions.export')}
            </Button>
            <Button
              block
              icon={<UploadOutlined />}
              onClick={() => {
                onImportTheme();
                setMobileDrawerVisible?.(false);
              }}
            >
              {t('theme:actions.import')}
            </Button>
            <Button
              block
              icon={<ReloadOutlined />}
              onClick={() => {
                onResetTheme();
                setMobileDrawerVisible?.(false);
              }}
              danger
            >
              {t('theme:actions.reset')}
            </Button>
          </Space>
        </Drawer>
      </>
    );
  }

  // 桌面端渲染
  return (
    <Space wrap>
      <Button
        icon={<AppstoreOutlined />}
        onClick={onOpenIconUploader}
        className="apple-button"
      >
        {t('theme:iconUpload.title', '自定义图标')}
      </Button>
      <Button
        icon={<DownloadOutlined />}
        onClick={onExportTheme}
        className="apple-button"
      >
        {t('theme:actions.export')}
      </Button>
      <Button
        icon={<UploadOutlined />}
        onClick={onImportTheme}
        className="apple-button"
      >
        {t('theme:actions.import')}
      </Button>
      <Button
        icon={<ReloadOutlined />}
        onClick={onResetTheme}
        className="apple-button"
      >
        {t('theme:actions.reset')}
      </Button>
    </Space>
  );
};

export default ThemeActions;
