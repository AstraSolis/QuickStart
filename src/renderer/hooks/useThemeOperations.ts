/**
 * 主题操作自定义Hook
 * 封装主题导入导出、验证、预览等操作逻辑
 */

import { useState, useCallback } from 'react';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { themeValidator } from '../utils/ThemeValidator';
import type { ThemeConfig } from '../contexts/ThemeContext';
import type { Color } from 'antd/es/color-picker';

// Hook返回类型
export interface UseThemeOperationsReturn {
  // 状态
  themeImportModalVisible: boolean;
  themePreviewModalVisible: boolean;
  previewThemeConfig: ThemeConfig | null;
  
  // 操作函数
  handleColorChange: (colorKey: string, color: Color) => void;
  handleExportTheme: () => void;
  handleImportTheme: () => void;
  handleThemeFileUpload: (file: File) => void;
  handleApplyPreviewTheme: () => void;
  
  // 模态框控制
  setThemeImportModalVisible: (visible: boolean) => void;
  setThemePreviewModalVisible: (visible: boolean) => void;
  setPreviewThemeConfig: (config: ThemeConfig | null) => void;
}

/**
 * 主题操作Hook
 */
export const useThemeOperations = (): UseThemeOperationsReturn => {
  const { t } = useTranslation(['theme', 'common']);
  const { themeConfig, updateTheme } = useTheme();
  
  // 状态管理
  const [themeImportModalVisible, setThemeImportModalVisible] = useState(false);
  const [themePreviewModalVisible, setThemePreviewModalVisible] = useState(false);
  const [previewThemeConfig, setPreviewThemeConfig] = useState<ThemeConfig | null>(null);

  // 处理颜色变化
  const handleColorChange = useCallback((colorKey: string, color: Color) => {
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
  }, [themeConfig.customColors, updateTheme]);

  // 导出主题配置（增强版）
  const handleExportTheme = useCallback(() => {
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
      
      message.success(t('theme:messages.exportSuccess', '主题配置已导出'));
    } catch (error) {
      console.error('Theme export failed:', error);
      message.error(t('theme:messages.exportFailed', '主题导出失败'));
    }
  }, [themeConfig, t]);

  // 导入主题配置（增强版）
  const handleImportTheme = useCallback(() => {
    setThemeImportModalVisible(true);
  }, []);

  // 处理主题文件上传
  const handleThemeFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const themeData = JSON.parse(e.target?.result as string);
        
        // 验证主题配置
        const validationResult = themeValidator.validate(themeData);
        
        if (!validationResult.valid) {
          // 显示验证错误
          const errorMessages = validationResult.errors.map(error => error.message).join('\n');
          message.error({
            content: `${t('theme:messages.themeValidationFailed', '主题验证失败')  }:\n${  errorMessages}`,
            duration: 6,
          });
          return;
        }

        // 如果有警告，显示警告信息
        if (validationResult.warnings.length > 0) {
          const warningMessages = validationResult.warnings.map(warning => warning.message).join('\n');
          message.warning({
            content: `${t('theme:messages.themeValidationWarnings', '主题导入警告')  }:\n${  warningMessages}`,
            duration: 4,
          });
        }

        // 设置预览主题并显示预览模态框
        const finalConfig = validationResult.fixedConfig || themeData;
        setPreviewThemeConfig(finalConfig);
        setThemePreviewModalVisible(true);
        setThemeImportModalVisible(false);
        
      } catch (error) {
        console.error('Theme import failed:', error);
        message.error(t('theme:messages.themeImportError', '主题配置文件格式错误'));
      }
    };
    reader.readAsText(file);
  }, [t]);

  // 确认应用预览的主题
  const handleApplyPreviewTheme = useCallback(() => {
    if (previewThemeConfig) {
      updateTheme(previewThemeConfig);
      message.success(t('theme:messages.themeImported', '主题配置已导入'));
      setThemePreviewModalVisible(false);
      setPreviewThemeConfig(null);
    }
  }, [previewThemeConfig, updateTheme, t]);

  return {
    // 状态
    themeImportModalVisible,
    themePreviewModalVisible,
    previewThemeConfig,
    
    // 操作函数
    handleColorChange,
    handleExportTheme,
    handleImportTheme,
    handleThemeFileUpload,
    handleApplyPreviewTheme,
    
    // 模态框控制
    setThemeImportModalVisible,
    setThemePreviewModalVisible,
    setPreviewThemeConfig,
  };
};
