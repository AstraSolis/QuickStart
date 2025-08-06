// ================= BOOTSTRAP ERROR HANDLER =================
// 在所有模块加载之前，立即设置一个最基础的错误处理器。
// 这可以捕获在初始化阶段发生的、可能导致应用静默退出的致命错误。
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const rootDir = join(__dirname, '..', '..'); // 项目根目录
const logDir = join(rootDir, 'logs');
const crashLogPath = join(rootDir, 'crash.log');

// 确保日志目录存在
if (!existsSync(logDir)) {
  try {
    mkdirSync(logDir, { recursive: true });
  } catch {
    // 如果创建目录失败，至少尝试在根目录记录崩溃日志
  }
}


const emergencyLog = (message: string): void => {
  try {
    const timestamp = new Date().toISOString();
    appendFileSync(crashLogPath, `${timestamp} - ${message}\n`, 'utf8');
  } catch {
    // 如果连日志都写不了，那就没办法了
  }
};

process.on('uncaughtException', (error: Error) => {
  emergencyLog(`未捕获的异常:\n${error.stack ?? error.message}`);
  process.exit(1); // 捕获到未处理异常后，强制退出
});

process.on('unhandledRejection', (reason: unknown) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  emergencyLog(`未处理的Promise拒绝:\n${error.stack ?? error.message}`);
  process.exit(1); // 捕获到未处理的Promise拒绝后，强制退出
});

emergencyLog('引导错误处理器已初始化');
// =========================================================

import { app, BrowserWindow, shell, Menu, Tray, nativeImage } from 'electron';

emergencyLog('Electron模块导入成功');

import { registerIPCHandlers } from './ipc-handlers';

emergencyLog('IPC处理器导入成功');

import { initializeAppDirectories } from './config';

emergencyLog('配置模块导入成功');

import { configManager } from './config-manager';

emergencyLog('配置管理器导入成功');

import { databaseManager } from './database-manager';

emergencyLog('数据库管理器导入成功');

import { backgroundCacheManager } from './background-cache-manager';

emergencyLog('背景缓存管理器导入成功');

import { createMainLogger, LogCategory, createPerformanceLogger, createErrorLogger } from '../shared/logger';

emergencyLog('日志模块导入成功');

emergencyLog('所有模块导入成功');


// 强制Windows终端使用UTF-8编码
if (process.platform === 'win32') {
  process.env.CHCP = '65001'; // 设置代码页为UTF-8

  // 设置进程编码
  if (process.stdout.setDefaultEncoding) {
    process.stdout.setDefaultEncoding('utf8');
  }
  if (process.stderr.setDefaultEncoding) {
    process.stderr.setDefaultEncoding('utf8');
  }

  // 设置环境变量强制UTF-8编码
  process.env.PYTHONIOENCODING = 'utf-8';
  process.env.LANG = 'zh_CN.UTF-8';
  process.env.LC_ALL = 'zh_CN.UTF-8';

  // 尝试设置Windows控制台代码页为UTF-8
  try {
    const { execSync } = require('child_process');
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch {
    // 忽略错误，继续执行
  }
}

// 初始化日志系统
const logger = createMainLogger({
  logDir: join(process.env.APPDATA ?? process.env.HOME ?? process.cwd(), 'QuickStartAPP', 'logs'),
  level: 2, // INFO
  enableFile: true,
  enableConsole: true,
});

const perfLogger = createPerformanceLogger(logger);
const errorLogger = createErrorLogger(logger);

// 全局错误处理
process.on('uncaughtException', (error) => {
  // 注意：.catch(console.error)是合理的回退机制，当日志系统失效时使用console输出
  errorLogger.logError(error, 'main.ts', LogCategory.APP).catch(console.error);
  // 记录系统错误
  logger.error(`未捕获的异常: ${error.message}`, LogCategory.APP, 'main.ts', undefined, error).catch(console.error);
});

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  // 注意：.catch(console.error)是合理的回退机制，当日志系统失效时使用console输出
  errorLogger.logError(error, 'main.ts', LogCategory.APP).catch(console.error);
  // 记录未处理的Promise拒绝
  logger.error(`未处理的Promise拒绝: ${String(reason)}`, LogCategory.APP, 'main.ts', { reason: String(reason) }).catch(console.error);
});

// 记录主进程启动 - 移动到app.whenReady()之后
// 注意：此时logger尚未完全初始化，使用简单的console输出是合理的
console.log('[DEBUG] Main process script loaded, setting up app events...');

// 文件调试函数
function debugLog(message: string) {
  console.log(message);
  try {
    const debugFile = join(__dirname, '../../debug.log');
    writeFileSync(debugFile, `${new Date().toISOString()} - ${message}\n`, { flag: 'a' });
  } catch {
    // 忽略文件写入错误
  }
}

debugLog('[DEBUG] Main process script loaded, setting up app events...');

// 全局变量
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// 开发环境检测 - 增强环境变量检测逻辑
// 改进环境检测：支持多种环境判断方式
const isDev = process.env.NODE_ENV === 'development' ||
              (!app.isPackaged && process.env.NODE_ENV !== 'production');
const RENDERER_URL = isDev ? 'http://localhost:3000' : `file://${join(__dirname, '../renderer/index.html')}`;

// 调试信息：输出环境检测结果
const envInfo = {
  NODE_ENV: process.env.NODE_ENV,
  isPackaged: app.isPackaged,
  isDev,
  RENDERER_URL,
  platform: process.platform,
  arch: process.arch,
  versions: process.versions
};

// 环境检测信息将在app.whenReady()后使用logger记录
console.log(`[DEBUG] Environment detection:`, envInfo);
debugLog(`[DEBUG] Environment detection: ${JSON.stringify(envInfo, null, 2)}`);

// 验证关键路径是否存在
if (!isDev) {
  const rendererPath = join(__dirname, '../renderer/index.html');
  debugLog(`[DEBUG] Checking renderer path: ${rendererPath}`);
  if (!require('fs').existsSync(rendererPath)) {
    const error = `Renderer file not found: ${rendererPath}`;
    // 注意：此时logger可能尚未完全初始化，使用console和emergencyLog是合理的
    console.error(`[ERROR] ${error}`);
    debugLog(`[ERROR] ${error}`);
    emergencyLog(`严重错误: ${error}`);
  }
}

// 环境信息将在app ready后输出

/**
 * 创建主窗口
 */
async function createMainWindow(): Promise<void> {
  perfLogger.start('createMainWindow');
  await logger.info('正在创建主窗口...', LogCategory.APP, 'main.ts');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // 等待ready-to-show事件再显示，避免重复显示
    titleBarStyle: 'default',
    icon: join(__dirname, '../../assets/icon.png'),
    webPreferences: {
      // 安全配置 - 统一的安全设置
      contextIsolation: true,        // 始终启用上下文隔离
      sandbox: false,                // 禁用沙箱以支持预加载脚本
      nodeIntegration: false,        // 禁用Node.js集成
      webSecurity: true,             // 始终启用Web安全
      allowRunningInsecureContent: false,  // 禁止不安全内容
      experimentalFeatures: false,

      // 预加载脚本
      preload: join(__dirname, '../preload/preload.js'),

      // 其他安全设置
      backgroundThrottling: false,

      // 开发环境特殊设置
      ...(isDev && {
        webSecurity: false,          // 开发环境禁用Web安全以支持热重载
        allowRunningInsecureContent: true  // 开发环境允许不安全内容
      })
    }
  });

  // 加载渲染进程
  await logger.info(`正在加载渲染器URL: ${RENDERER_URL}`, LogCategory.APP, 'main.ts');
  mainWindow.loadURL(RENDERER_URL);

  // 窗口事件处理 - 简化调试
  mainWindow.once('ready-to-show', async () => {
    await logger.debug('窗口ready-to-show事件触发', LogCategory.APP, 'main.ts');
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus(); // 确保窗口获得焦点
      await logger.info('主窗口已显示', LogCategory.APP, 'main.ts');
      await perfLogger.end('createMainWindow', 'main.ts');

      // 开发环境下打开开发者工具
      if (isDev) {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  // 添加页面加载事件监听
  mainWindow.webContents.on('did-finish-load', async () => {
    await logger.info('渲染进程加载完成', LogCategory.APP, 'main.ts');
  });

  mainWindow.webContents.on('did-fail-load', async (_event, errorCode, errorDescription) => {
    const error = new Error(`渲染器加载失败: ${errorDescription} (${errorCode})`);
    await errorLogger.logError(error, 'main.ts', LogCategory.APP);
  });

  // 监听渲染进程的控制台消息
  mainWindow.webContents.on('console-message', async (_event, level, message, _line, _sourceId) => {
    await logger.debug(`渲染器控制台 [${level}]: ${message}`, LogCategory.UI, 'main.ts');
  });

  mainWindow.on('closed', async () => {
    mainWindow = null;
    await logger.info('主窗口已关闭', LogCategory.APP, 'main.ts');
  });

  // 控制新窗口创建 - 安全措施
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 注意：.catch(console.error)是合理的回退机制
    logger.info(`尝试打开外部链接: ${url}`, LogCategory.APP, 'main.ts').catch(console.error);
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 阻止导航到外部URL
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    if (parsedUrl.origin !== new URL(RENDERER_URL).origin) {
      event.preventDefault();
      // 注意：.catch(console.error)是合理的回退机制
      logger.warn(`阻止导航到外部链接: ${navigationUrl}`, LogCategory.APP, 'main.ts').catch(console.error);
    }
  });
}

/**
 * 创建系统托盘
 */
async function createTray(): Promise<void> {
  try {
    const trayIcon = nativeImage.createFromPath(join(__dirname, '../../assets/icon.png'));
    tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createMainWindow().catch(console.error);
          }
        }
      },
      {
        label: '退出',
        click: () => {
          app.quit();
        }
      }
    ]);

    tray.setToolTip('QuickStart');
    tray.setContextMenu(contextMenu);

    // 双击托盘图标显示窗口
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    await logger.info('系统托盘创建成功', LogCategory.APP, 'main.ts');
  } catch (error) {
    await errorLogger.logError(error as Error, 'main.ts', LogCategory.APP);
  }
}

/**
 * 应用程序事件处理
 */
app.whenReady().then(async () => {
  debugLog('[DEBUG] App is ready, starting initialization...');
  perfLogger.start('appReady');

  try {
    // 初始化配置管理器
    await configManager.initialize();
    await logger.info('配置管理器初始化成功', LogCategory.CONFIG, 'main.ts');

    // 读取配置文件中的语言设置
    let savedLanguage = 'zh-CN'; // 默认语言
    try {
      const i18nConfig = configManager.getConfig('i18n-config');
      if (i18nConfig?.currentLanguage) {
        savedLanguage = i18nConfig.currentLanguage;
        console.log(`正在加载保存的语言: ${savedLanguage}`);
      }
    } catch (error) {
      console.warn('加载保存的语言失败，使用默认语言:', error);
    }

    // 记录应用就绪
    await logger.info('应用程序已就绪', LogCategory.APP, 'main.ts');

    // 环境信息详细日志
    await logger.info('=== 环境配置信息 ===', LogCategory.APP, 'main.ts');
    await logger.info(`NODE_ENV: ${process.env.NODE_ENV ?? 'undefined'}`, LogCategory.APP, 'main.ts');
    await logger.info(`app.isPackaged: ${app.isPackaged}`, LogCategory.APP, 'main.ts');
    await logger.info(`isDev (computed): ${isDev}`, LogCategory.APP, 'main.ts');
    await logger.info(`process.platform: ${process.platform}`, LogCategory.APP, 'main.ts');
    await logger.info(`process.arch: ${process.arch}`, LogCategory.APP, 'main.ts');
    await logger.info(`RENDERER_URL: ${RENDERER_URL}`, LogCategory.APP, 'main.ts');
    await logger.info(`__dirname: ${__dirname}`, LogCategory.APP, 'main.ts');
    await logger.info('===================', LogCategory.APP, 'main.ts');
  } catch (error) {
    await logger.info('应用程序已就绪（配置初始化失败）', LogCategory.APP, 'main.ts');
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logger.error(`配置初始化失败: ${errorMessage}`, LogCategory.CONFIG, 'main.ts', { error: errorMessage });
  }

  try {
    await logger.debug('开始初始化进程', LogCategory.APP, 'main.ts');

    // 记录主进程启动成功
    await logger.info(`应用程序启动成功，版本: ${app.getVersion()}`, LogCategory.APP, 'main.ts');
    await logger.debug('日志系统启动成功', LogCategory.APP, 'main.ts');

    // 初始化应用目录
    await logger.debug('正在初始化应用目录', LogCategory.APP, 'main.ts');
    initializeAppDirectories();
    await logger.debug('应用目录初始化完成', LogCategory.APP, 'main.ts');

    // 初始化数据库管理器
    databaseManager.initialize();
    await logger.info('数据库管理器初始化完成', LogCategory.DB, 'main.ts');

    // 初始化背景缓存管理器
    await backgroundCacheManager.initialize();
    await logger.info('背景缓存管理器初始化完成', LogCategory.APP, 'main.ts');

    // 注册IPC处理器
    registerIPCHandlers();

    // 创建主窗口
    await logger.debug('正在创建主窗口', LogCategory.APP, 'main.ts');
    await createMainWindow();
    await logger.debug('主窗口创建完成', LogCategory.APP, 'main.ts');

    // 创建系统托盘
    await createTray();

    // macOS 特殊处理
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow().catch(console.error);
      }
    });

    await perfLogger.end('appReady', 'main.ts');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    await logger.error(`初始化失败: ${errorMessage}`, LogCategory.APP, 'main.ts', { error: errorMessage });
    debugLog(`[ERROR] Initialization failed: ${errorMessage}`);
    emergencyLog(`初始化错误: ${errorMessage}\n${errorStack}`);

    try {
      await errorLogger.logError(error as Error, 'main.ts', LogCategory.APP);
    } catch (logError) {
      emergencyLog(`日志记录错误: ${logError}`);
    }

    // 延迟退出，确保日志写入完成
    setTimeout(() => {
      app.quit();
    }, 1000);
  }
});

// 所有窗口关闭时的处理
app.on('window-all-closed', () => {
  // macOS 下保持应用运行
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前的清理
app.on('before-quit', async () => {
  await logger.info('应用程序正在关闭', LogCategory.APP, 'main.ts');

  // 清理配置管理器
  configManager.destroy();

  // 清理日志管理器
  try {
    // 执行日志清理
    await logger.info('应用程序关闭，执行日志清理', LogCategory.APP, 'main.ts');
  } catch (error) {
    // 应用退出时的清理错误，此时logger可能已经关闭，使用console是合理的
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('清理日志记录器失败:', errorMessage);
  }
});

// 安全相关：阻止新窗口创建
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});


