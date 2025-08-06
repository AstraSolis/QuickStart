import '@ant-design/v5-patch-for-react-19'; // React 19兼容性补丁
import { createRoot } from 'react-dom/client';
import 'antd/dist/reset.css';
import { App } from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from '../contexts/I18nContext';
import '../i18n'; // 初始化新的 i18n 系统
import type { ElectronAPI } from '@shared/ipc-types';

// 添加调试日志（仅开发环境）
if (process.env.NODE_ENV === 'development') {
  // 开发环境使用英文调试信息
  console.log('Renderer script loaded');
  console.log('electronAPI available:', !!window.electronAPI);
}

// 紧急情况下的国际化支持（当i18n系统未初始化时使用）
const getEmergencyTranslation = (key: string): string => {
  const browserLang = navigator.language || 'en';
  const lang = browserLang.startsWith('zh') ? 'zh-CN' :
               browserLang.startsWith('ru') ? 'ru' :
               browserLang.startsWith('fr') ? 'fr' : 'en';

  const translations: Record<string, Record<string, string>> = {
    'zh-CN': {
      'app.startupFailed.title': '应用程序启动失败',
      'app.startupFailed.message': '错误：',
      'app.startupFailed.instruction': '请检查开发者控制台获取更多信息'
    },
    'en': {
      'app.startupFailed.title': 'Application Startup Failed',
      'app.startupFailed.message': 'Error: ',
      'app.startupFailed.instruction': 'Please check the developer console for more information'
    },
    'ru': {
      'app.startupFailed.title': 'Ошибка запуска приложения',
      'app.startupFailed.message': 'Ошибка: ',
      'app.startupFailed.instruction': 'Пожалуйста, проверьте консоль разработчика для получения дополнительной информации'
    },
    'fr': {
      'app.startupFailed.title': 'Échec du démarrage de l\'application',
      'app.startupFailed.message': 'Erreur : ',
      'app.startupFailed.instruction': 'Veuillez vérifier la console développeur pour plus d\'informations'
    }
  };

  return translations[lang]?.[key] || translations['en'][key] || key;
};

// 扩展Window接口以包含electronAPI
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// 应用包装组件 - 现在由I18nProvider处理ConfigProvider
const AppWrapper: React.FC = () => {
  return <App />;
};

// 应用初始化
const container = document.getElementById('root');
if (container) {
  if (process.env.NODE_ENV === 'development') {
    // 开发环境使用英文调试信息
    console.log('Root container found, initializing React app...');
  }

  // 清除初始加载界面
  container.innerHTML = '';

  const root = createRoot(container);

  try {
    root.render(
      <I18nProvider>
        <ThemeProvider>
          <AppWrapper />
        </ThemeProvider>
      </I18nProvider>
    );
    if (process.env.NODE_ENV === 'development') {
      // 开发环境使用英文调试信息
      console.log('React app rendered successfully');
    }
  } catch (error) {
    // 使用紧急国际化支持显示错误信息
    console.error('Failed to render React app:', error);
    const errorMessage = (error as Error).message;
    container.innerHTML = `
      <div style="padding: 20px; color: red; font-family: monospace;">
        <h2>${getEmergencyTranslation('app.startupFailed.title')}</h2>
        <p>${getEmergencyTranslation('app.startupFailed.message')}${errorMessage}</p>
        <p>${getEmergencyTranslation('app.startupFailed.instruction')}</p>
      </div>
    `;
  }
} else {
  console.error('Root container not found');
}
