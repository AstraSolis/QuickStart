import React from 'react';
import { Select, Space, Typography, message } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useTranslationWithMarker } from '../../hooks/useTranslationWithMarker';
import { useI18nContext } from '../../contexts/I18nContext';
import { supportedLanguages, type SupportedLanguage } from '../../i18n';

const { Text } = Typography;
const { Option } = Select;

interface LanguageSelectorProps {
  size?: 'small' | 'middle' | 'large';
  showIcon?: boolean;
  showLabel?: boolean;
  style?: React.CSSProperties;
  className?: string;
  placement?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  size = 'middle',
  showIcon = true,
  showLabel = false,
  style,
  className,
  placement = 'bottomRight',
}) => {
  const { t } = useTranslationWithMarker('common', {
    componentName: 'LanguageSelector',
    enableMarker: true,
    debug: process.env.NODE_ENV === 'development'
  });
  const { changeLanguage, isLoading, currentLanguage } = useI18nContext();

  // 处理语言切换
  const handleLanguageChange = async (languageCode: string) => {
    try {
      console.log(`Attempting to change language to: ${languageCode}`);
      const success = await changeLanguage(languageCode as SupportedLanguage);

      if (success) {
        // 从翻译文件获取语言名称
        const languageName = t(`language.selector.${languageCode}`, languageCode, undefined, {
          elementType: 'text',
          isDynamic: true
        });
        message.success(`${t('common:messages.languageChanged', '语言已切换', undefined, {
          elementType: 'text',
          isDynamic: false
        })}: ${languageName}`);
        console.log(`Language changed successfully to: ${languageName}`);
      } else {
        message.error(t('common:messages.operationFailed', '操作失败', undefined, {
          elementType: 'text',
          isDynamic: false
        }));
      }
    } catch (error) {
      console.error('Failed to change language:', error);
      message.error(t('common:messages.operationFailed', '操作失败', undefined, {
        elementType: 'text',
        isDynamic: false
      }));
    }
  };

  // 渲染语言选项 - 使用翻译文件中的语言名称
  const renderLanguageOption = (lang: typeof supportedLanguages[0]) => (
    <Option key={lang.code} value={lang.code}>
      <Space>
        <span>{t(`language.selector.${lang.code}`, lang.nativeName, undefined, {
          elementType: 'text',
          isDynamic: false
        })}</span>
        {lang.code !== lang.nativeName && (
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ({lang.name})
          </Text>
        )}
      </Space>
    </Option>
  );

  return (
    <Space size="small" style={style} className={className}>
      {showIcon && <GlobalOutlined />}
      {showLabel && (
        <Text style={{ fontSize: size === 'small' ? '12px' : '14px' }}>
          {t('language.selector.title', '选择语言', undefined, {
            elementType: 'text',
            isDynamic: false
          })}
        </Text>
      )}
      <Select
        value={currentLanguage}
        onChange={handleLanguageChange}
        size={size}
        style={{ minWidth: 120 }}
        placement={placement}
        showSearch
        loading={isLoading}
        optionFilterProp="children"
        filterOption={(input, option) => {
          const lang = supportedLanguages.find(l => l.code === option?.value);
          if (!lang) return false;

          const searchText = input.toLowerCase();
          return (
            lang.name.toLowerCase().includes(searchText) ||
            lang.nativeName.toLowerCase().includes(searchText) ||
            lang.code.toLowerCase().includes(searchText)
          );
        }}
        dropdownRender={(menu) => (
          <div>
            {menu}
            <div style={{ 
              padding: '8px 12px', 
              borderTop: '1px solid #f0f0f0',
              fontSize: '12px',
              color: '#999'
            }}>
              {t('language.selector.title', '选择语言', undefined, {
                elementType: 'text',
                isDynamic: false
              })}
            </div>
          </div>
        )}
      >
        {supportedLanguages.map(renderLanguageOption)}
      </Select>
    </Space>
  );
};

// 紧凑版语言选择器（只显示当前语言）
export const CompactLanguageSelector: React.FC<{
  style?: React.CSSProperties;
  className?: string;
}> = ({ style, className }) => {
  const { changeLanguage, isLoading, currentLanguage } = useI18nContext();

  const handleLanguageChange = async (languageCode: string) => {
    try {
      await changeLanguage(languageCode as SupportedLanguage);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  return (
    <Select
      value={currentLanguage}
      onChange={handleLanguageChange}
      size="small"
      style={{ minWidth: 80, ...style }}
      className={className}
      bordered={false}
      loading={isLoading}
    >
      {supportedLanguages.map(lang => (
        <Option key={lang.code} value={lang.code}>
          {lang.code.split('-')[0].toUpperCase()}
        </Option>
      ))}
    </Select>
  );
};

// 语言状态指示器
export const LanguageIndicator: React.FC<{
  style?: React.CSSProperties;
  className?: string;
}> = ({ style, className }) => {
  const { currentLanguage } = useI18nContext();
  const { t } = useTranslationWithMarker('common', {
    componentName: 'LanguageIndicator',
    enableMarker: false
  });

  const displayName = t(`language.selector.${currentLanguage}`, currentLanguage);

  return (
    <Space size="small" style={style} className={className}>
      <GlobalOutlined style={{ color: '#1890ff' }} />
      <Text style={{ fontSize: '12px', color: '#666' }}>
        {displayName}
      </Text>
    </Space>
  );
};

export default LanguageSelector;
