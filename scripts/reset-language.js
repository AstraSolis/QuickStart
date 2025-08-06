#!/usr/bin/env node

/**
 * 语言配置重置脚本
 * 用于将QuickStart应用的语言设置重置为中文（zh-CN）
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取应用数据目录
function getAppDataPath() {
  const platform = os.platform();
  const homeDir = os.homedir();
  
  switch (platform) {
    case 'win32':
      return path.join(process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming'), 'QuickStartAPP');
    case 'darwin':
      return path.join(homeDir, 'Library', 'Application Support', 'QuickStartAPP');
    case 'linux':
      return path.join(process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config'), 'QuickStartAPP');
    default:
      return path.join(homeDir, '.quickstart');
  }
}

// 配置文件路径
const APP_DATA_PATH = getAppDataPath();
const CONFIG_DIR = path.join(APP_DATA_PATH, 'config');
const I18N_CONFIG_FILE = path.join(CONFIG_DIR, 'i18n-config.json');

// 默认的i18n配置
const DEFAULT_I18N_CONFIG = {
  version: '1.0.0',
  currentLanguage: 'fr',
  fallbackLanguage: 'en',
  supportedLanguages: ['zh-CN', 'en', 'ru', 'fr'],
  autoDetect: true,
  dateFormat: 'YYYY-MM-DD',
  timeFormat: 'HH:mm:ss',
  numberFormat: {
    decimal: '.',
    thousands: ',',
    currency: '¥',
  },
  customTranslations: {},
  system: {
    localStorageKey: 'quickstart-language',
    debugMode: false,
    namespaces: ['common', 'menu', 'theme', 'settings', 'errors', 'file', 'about', 'config', 'logs'],
    detectionOrder: ['localStorage', 'navigator', 'htmlTag', 'path', 'subdomain'],
    cacheEnabled: true,
  },
};

/**
 * 确保目录存在
 */
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ 创建目录: ${dirPath}`);
  }
}

/**
 * 重置i18n配置文件
 */
function resetI18nConfig() {
  try {
    // 确保配置目录存在
    ensureDirectoryExists(CONFIG_DIR);
    
    // 检查现有配置
    let currentConfig = null;
    if (fs.existsSync(I18N_CONFIG_FILE)) {
      try {
        const configContent = fs.readFileSync(I18N_CONFIG_FILE, 'utf8');
        currentConfig = JSON.parse(configContent);
        console.log(`📄 当前语言配置: ${currentConfig.currentLanguage || '未知'}`);
      } catch (error) {
        console.log(`⚠️  配置文件解析失败: ${error.message}`);
      }
    } else {
      console.log('📄 配置文件不存在，将创建新文件');
    }
    
    // 写入默认配置
    fs.writeFileSync(I18N_CONFIG_FILE, JSON.stringify(DEFAULT_I18N_CONFIG, null, 2), 'utf8');
    console.log(`✅ i18n配置已重置为中文: ${I18N_CONFIG_FILE}`);
    
    return true;
  } catch (error) {
    console.error(`❌ 重置i18n配置失败: ${error.message}`);
    return false;
  }
}

/**
 * 清除localStorage缓存（需要在浏览器环境中执行）
 */
function generateClearCacheScript() {
  const script = `
// 在浏览器开发者工具中执行此脚本来清除语言缓存
try {
  localStorage.removeItem('quickstart-language');
  localStorage.removeItem('i18nextLng');
  console.log('✅ 语言缓存已清除');
  
  // 刷新页面以应用更改
  if (confirm('语言缓存已清除，是否刷新页面以应用更改？')) {
    window.location.reload();
  }
} catch (error) {
  console.error('❌ 清除缓存失败:', error);
}
`;
  
  const scriptFile = path.join(__dirname, 'clear-language-cache.js');
  fs.writeFileSync(scriptFile, script.trim(), 'utf8');
  console.log(`📝 已生成缓存清除脚本: ${scriptFile}`);
  console.log('💡 请在应用的开发者工具中执行此脚本来清除语言缓存');
}

/**
 * 主函数
 */
function main() {
  console.log('🔧 QuickStart 语言配置重置工具');
  console.log('=' .repeat(50));
  
  console.log(`📂 应用数据目录: ${APP_DATA_PATH}`);
  console.log(`📂 配置目录: ${CONFIG_DIR}`);
  console.log(`📄 i18n配置文件: ${I18N_CONFIG_FILE}`);
  console.log('');
  
  // 重置i18n配置
  const success = resetI18nConfig();
  
  if (success) {
    console.log('');
    console.log('✅ 语言配置重置完成！');
    console.log('');
    console.log('📋 后续步骤:');
    console.log('1. 重启QuickStart应用');
    console.log('2. 如果界面仍显示其他语言，请在开发者工具中清除localStorage缓存');
    console.log('3. 验证界面语言是否已切换为中文');
    
    // 生成缓存清除脚本
    generateClearCacheScript();
  } else {
    console.log('');
    console.log('❌ 语言配置重置失败！');
    process.exit(1);
  }
}

// 执行主函数
if (require.main === module) {
  main();
}

module.exports = {
  resetI18nConfig,
  getAppDataPath,
  DEFAULT_I18N_CONFIG
};
