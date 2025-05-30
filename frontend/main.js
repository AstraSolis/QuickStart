// 导入Electron模块
const { app, BrowserWindow, Tray, Menu, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const axios = require('axios');
const os = require('os');
const crypto = require('crypto');
const { nativeImage } = require('electron');

// Python服务器进程
let pyProc = null;
// 主窗口
let mainWindow = null;
// 系统托盘图标
let trayIcon = null;
// API基础URL
let API_BASE_URL = 'http://localhost:5000/api';
// 端口号（可被外部传入）
let port = 5000;
// 重试次数
let retryCount = 0;
// 最大重试次数
const MAX_RETRIES = 5;
// 菜单翻译
let menuTranslations = {};
// 全局设置 (增加默认值以确保基本功能可用)
let settings = { 
  language: "中文",
  minimize_to_tray: false  // 默认不启用最小化到托盘，将在加载设置时更新
};

// 应用状态管理标志
const appState = {
  isQuitting: false,    // 应用是否正在退出
  settingsLoaded: false, // 设置是否已加载
  trayItemsLoaded: false // 托盘项目是否已加载
};

// 缓存图标路径，避免重复生成
const iconCache = new Map();

// 添加一个变量跟踪是否正在处理语言变更请求
let isProcessingLanguageChange = false;

// 只记录错误和警告信息，跳过普通信息
const log = (message, isError = false) => {
  if (isError || process.env.DEBUG) {
    console.log(message);
  }
}

// 获取文件图标并保存为临时文件
function getFileIconAsPath(filePath) {
  return new Promise((resolve, reject) => {
    try {
      // 如果图标已经在缓存中，直接返回
      if (iconCache.has(filePath)) {
        return resolve(iconCache.get(filePath));
      }
      
      // 检查文件是否存在
      if (!fs.existsSync(filePath)) {
        log(`文件不存在: ${filePath}`);
        return resolve(null);
      }
      
      // 使用应用获取文件图标
      app.getFileIcon(filePath, { size: 'small' })
        .then(icon => {
          if (icon && !icon.isEmpty()) {
            try {
              // 为临时文件创建一个唯一的名称
              const hash = crypto.createHash('md5').update(filePath).digest('hex');
              const tempDir = path.join(os.tmpdir(), 'quickstart-icons');
              
              // 确保临时目录存在
              if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
              }
              
              // 保存图标为PNG文件
              const iconPath = path.join(tempDir, `${hash}.png`);
              fs.writeFileSync(iconPath, icon.toPNG());
              
              // 存入缓存
              iconCache.set(filePath, iconPath);
              
              log(`成功保存文件图标: ${filePath} -> ${iconPath}`);
              resolve(iconPath);
            } catch (error) {
              log(`保存图标失败: ${error.message}`);
              resolve(null);
            }
          } else {
            log(`无法获取文件图标: ${filePath}`);
            resolve(null);
          }
        })
        .catch(error => {
          log(`获取图标出错: ${error.message}`);
          resolve(null);
        });
    } catch (error) {
      log(`处理图标时出错: ${error.message}`);
      resolve(null);
    }
  });
}

// 确保应用只有一个实例
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  log('应用已经运行，退出当前实例');
  app.quit();
} else {
  // 如果用户尝试打开第二个实例，我们应该聚焦到当前窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  // 正常初始化应用程序
  app.whenReady().then(() => {
    // 设置应用ID
    app.setAppUserModelId('github.com/AstraSolis/QuickStart');
    
    // 每次启动应用时重置isQuitting标志
    app.isQuitting = false;
    
    // 启动Python后端服务
    startPythonServer();
    
    // 等待Python服务启动
    waitForPythonServer();
  });
}

// 获取托盘图标路径
function getTrayIconPath() {
  try {
    // 使用PNG图标而不是ICO文件
    const iconPath = path.resolve(__dirname, 'assets', 'img', 'tray.png');
    log(`尝试加载托盘图标: ${iconPath}`);
    
    // 检查图标文件是否存在
    if (fs.existsSync(iconPath)) {
      const stats = fs.statSync(iconPath);
      log(`托盘图标文件存在，大小: ${stats.size} 字节`);
      return iconPath;
    } else {
      log(`托盘图标文件不存在: ${iconPath}`);
      
      // 尝试查找备用图标
      const defaultIcon = path.join(process.resourcesPath || __dirname, 'assets', 'img', 'tray.png');
      if (fs.existsSync(defaultIcon)) {
        log(`使用备用托盘图标: ${defaultIcon}`);
        return defaultIcon;
      }
      
      // 如果找不到PNG，尝试使用ICO
      const icoPath = path.resolve(__dirname, 'assets', 'img', 'icon.ico');
      if (fs.existsSync(icoPath)) {
        log(`使用ICO图标作为备用: ${icoPath}`);
        return icoPath;
      }
      
      // 返回null表示无法加载图标
      return null;
    }
  } catch (error) {
    log(`获取托盘图标路径出错: ${error.message}`);
    return null;
  }
}

// 获取窗口图标路径
function getIconPath() {
  try {
    // 使用绝对路径，解决加载问题
    const iconPath = path.resolve(__dirname, 'assets', 'img', 'icon.ico');
    log(`尝试加载窗口图标: ${iconPath}`);
    
    // 检查图标文件是否存在
    if (fs.existsSync(iconPath)) {
      const stats = fs.statSync(iconPath);
      log(`窗口图标文件存在，大小: ${stats.size} 字节`);
      return iconPath;
    } else {
      log(`窗口图标文件不存在: ${iconPath}`);
      
      // 尝试查找备用图标（应用打包后的位置）
      const defaultIcon = path.join(process.resourcesPath || __dirname, 'assets', 'img', 'icon.ico');
      if (fs.existsSync(defaultIcon)) {
        log(`使用备用窗口图标: ${defaultIcon}`);
        return defaultIcon;
      }
      
      // 返回null表示无法加载图标
      return null;
    }
  } catch (error) {
    log(`获取窗口图标路径出错: ${error.message}`);
    return null;
  }
}

// 启动Python后端服务
function startPythonServer() {
  // 检查当前环境
  const isProd = app.isPackaged;
  let backendCmd, backendArgs;
  
  if (isProd) {
    // 生产环境（打包后）直接运行 backend.exe
    backendCmd = path.join(process.resourcesPath, 'backend', process.platform === 'win32' ? 'backend.exe' : 'backend');
    backendArgs = [port.toString()];
  } else {
    // 开发环境，调用 python app.py
    backendCmd = 'python';
    backendArgs = [path.join(__dirname, '..', 'backend', 'app.py'), port.toString()];
  }
  
  // 设置环境变量，确保Python进程使用UTF-8编码
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
  
  // 启动后端服务器
  pyProc = spawn(backendCmd, backendArgs, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: env
  });
  
  // 记录PID到临时文件，便于后续清理
  try {
    const tmpDir = path.join(os.tmpdir(), 'quickstart');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    
    const pidFile = path.join(tmpDir, 'app.pid');
    fs.writeFileSync(pidFile, pyProc.pid.toString(), 'utf8');
    log(`Python进程已启动，PID: ${pyProc.pid}，已记录到: ${pidFile}`);
  } catch (error) {
    log(`无法记录PID文件: ${error.message}`);
  }
  
  // 处理Python进程输出
  pyProc.stdout.on('data', (data) => {
    log(`Python: ${data}`);
  });
  
  // 处理Python进程错误
  pyProc.stderr.on('data', (data) => {
    log(`Python Error: ${data}`);
  });
  
  // 处理Python进程退出
  pyProc.on('close', (code) => {
    log(`Python进程已退出，退出码: ${code}`);
    
    // 如果非正常退出且应用未退出，尝试重启
    if (code !== 0 && !app.isQuitting) {
      restartPythonServer();
    }
  });
}

// 等待Python服务器启动
function waitForPythonServer() {
  // 在启动过程中明确将isQuitting标志设置为false
  log('服务启动，显式重置app.isQuitting标志');
  app.isQuitting = false;
  appState.isQuitting = false;  // 同时确保appState中的标志也为false
  
  setTimeout(() => {
    axios.get(`${API_BASE_URL}/health`)
      .then(() => {
        log('Python API server is ready');
        createWindow();
      })
      .catch(err => {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          log(`Waiting for API server, retry ${retryCount}/${MAX_RETRIES}...`);
          waitForPythonServer();
        } else {
          dialog.showErrorBox(
            'Server Connection Error',
            'Could not connect to the Python API server. The application will now exit.'
          );
          app.exit(1);
        }
      });
  }, 1000); // 等待1秒再检查服务器状态
}

// 创建主窗口
function createWindow() {
  // 如果窗口已存在，激活它而不是创建新窗口
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
    return;
  }

  const iconPath = getIconPath();
  
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    // 设置标题栏样式和背景色
    titleBarStyle: 'default',
    backgroundColor: '#f5f6fa',
    // 禁用菜单栏
    autoHideMenuBar: true
  });

  // 加载主页面
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  
  // 隐藏菜单栏
  mainWindow.setMenuBarVisibility(false);
  
  // 添加同步检查和重试机制，确保设置被正确加载和应用
  let settingsRetryCount = 0;
  const MAX_SETTINGS_RETRIES = 3;
  
  function loadAndApplySettings() {
    log('获取设置并应用最小化到托盘功能...');
    
    // 获取设置，判断是否显示托盘图标
    axios.get(`${API_BASE_URL}/settings`)
      .then(response => {
        // 更新全局settings变量，确保保留默认值
        const newSettings = response.data.data || {};
        
        // 合并设置，保留默认值的同时更新服务器返回的值
        settings = {
          ...settings,  // 保持默认值
          ...newSettings  // 应用服务器返回的设置
        };
        
        // 确保minimize_to_tray是布尔值
        if (typeof settings.minimize_to_tray !== 'boolean') {
          // 将非布尔值转换为布尔值（例如 "true" 字符串转为 true）
          settings.minimize_to_tray = settings.minimize_to_tray === true || settings.minimize_to_tray === "true";
        }
        
        log(`加载设置成功，minimize_to_tray=${settings.minimize_to_tray}，类型：${typeof settings.minimize_to_tray}`);
        
        // 标记设置已加载
        appState.settingsLoaded = true;
        
        // 如果设置为最小化到托盘，确保加载托盘项目
        if (settings.minimize_to_tray) {
          loadTrayItems();
        }
        
        const language = settings.language || "中文";
        log(`当前语言: ${language}`);
        
        // 获取当前语言的翻译
        axios.get(`${API_BASE_URL}/translations/${encodeURIComponent(language)}`)
          .then(translationRes => {
            menuTranslations = translationRes.data.data || {};
            
            log('菜单翻译加载成功:', Object.keys(menuTranslations).length);
            
            // 创建应用程序菜单
            createAppMenu();
            
            // 明确地应用最小化到托盘设置
            log(`加载后立即设置最小化到托盘: ${settings.minimize_to_tray}`);
            handleMinimizeToTray(settings.minimize_to_tray);
          })
          .catch(err => {
            log('Failed to get translations:', err);
            // 出错时使用默认中文菜单
            menuTranslations = {};
            createAppMenu();
            
            // 即使翻译加载失败，仍然应用最小化到托盘设置
            log(`加载翻译失败，但仍然设置最小化到托盘: ${settings.minimize_to_tray}`);
            handleMinimizeToTray(settings.minimize_to_tray);
          });
      })
      .catch(err => {
        log('Failed to get settings:', err);
        
        // 尝试重试几次加载设置
        settingsRetryCount++;
        if (settingsRetryCount < MAX_SETTINGS_RETRIES) {
          log(`获取设置失败，${settingsRetryCount}/${MAX_SETTINGS_RETRIES} 次重试...`);
          setTimeout(loadAndApplySettings, 1000);
          return;
        }
        
        // 出错时默认不启用最小化到托盘
        log('获取设置失败，使用默认设置，不启用最小化到托盘');
        handleMinimizeToTray(false);
      });
  }
  
  // 立即调用设置加载和应用
  loadAndApplySettings();

  // 设置窗口关闭事件
  mainWindow.on('closed', () => {
    // 当窗口关闭时，将其引用置为null
    mainWindow = null;
    // 确保在应用下次启动时isQuitting被正确重置
    if (!app.isQuitting) {
      log('窗口被关闭，但不是通过退出应用操作，重置isQuitting标志');
      app.isQuitting = false;
      appState.isQuitting = false;  // 同时重置appState中的标志
    }
  });
}

// 创建应用程序菜单
function createAppMenu() {
  // 将应用菜单设置为null以彻底移除菜单栏
  Menu.setApplicationMenu(null);
  
  // 其余的菜单创建代码保留，以便如果将来需要启用菜单可以轻松还原
  // 翻译函数，如果找不到翻译就返回原始文本
  const t = (key) => menuTranslations[key] || key;
  
  // 定义菜单模板
  const template = [
    {
      // 使用翻译后的标签
      label: t('file_menu') || '文件',
      submenu: [
        {
          id: 'add-file',
          label: t('add_file') || '添加文件',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-add-file');
            }
          }
        },
        {
          type: 'separator'
        },
        {
          id: 'delete',
          label: t('delete') || '删除',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-delete');
            }
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'quit',
          label: t('exit') || '退出',
          click: () => quitApplication()
        }
      ]
    },
    {
      label: t('edit_menu') || '编辑',
      submenu: [
        {
          role: 'undo',
          label: t('undo') || '撤销'
        },
        {
          role: 'redo',
          label: t('redo') || '重做'
        },
        {
          type: 'separator'
        },
        {
          role: 'cut',
          label: t('cut') || '剪切'
        },
        {
          role: 'copy',
          label: t('copy') || '复制'
        },
        {
          role: 'paste',
          label: t('paste') || '粘贴'
        },
        {
          role: 'selectAll',
          label: t('select_all') || '全选'
        }
      ]
    },
    {
      label: t('view_menu') || '视图',
      submenu: [
        {
          id: 'refresh',
          label: t('refresh') || '刷新',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-refresh');
            }
          }
        },
        {
          type: 'separator'
        },
        {
          role: 'resetZoom',
          label: t('reset_zoom') || '重置缩放',
          accelerator: 'CommandOrControl+0'
        },
        {
          role: 'zoomIn',
          label: t('zoom_in') || '放大',
          accelerator: 'CommandOrControl+Plus'
        },
        {
          role: 'zoomOut',
          label: t('zoom_out') || '缩小',
          accelerator: 'CommandOrControl+-'
        },
        {
          type: 'separator'
        },
        {
          role: 'toggleDevTools',
          label: t('toggle_dev_tools') || '开发者工具',
          accelerator: 'CommandOrControl+Shift+I'
        }
      ]
    },
    {
      label: t('window_menu') || '窗口',
      submenu: [
        {
          role: 'minimize',
          label: t('minimize') || '最小化'
        },
        {
          label: t('hide_to_tray') || '隐藏到托盘',
          click: () => {
            if (mainWindow) {
              mainWindow.hide();
            }
          }
        },
        {
          role: 'close',
          label: t('close') || '关闭'
        }
      ]
    },
    {
      label: t('help_menu') || '帮助',
      submenu: [
        {
          id: 'settings',
          label: t('settings') || '设置',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('menu-settings');
            }
          }
        },
        {
          type: 'separator'
        },
        {
          label: t('project_address') || '项目地址',
          click: () => {
            shell.openExternal('https://github.com/AstraSolis/QuickStart');
          }
        }
      ]
    }
  ];
  
  // 创建菜单
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  
  // 如果是macOS，创建dock菜单
  if (process.platform === 'darwin') {
    app.dock.setMenu(Menu.buildFromTemplate([
      {
        label: t('add_file') || '添加文件',
        click: () => {
          createWindow();
          mainWindow.webContents.send('menu-add-file');
        }
      },
      {
        label: t('settings') || '设置',
        click: () => {
          createWindow();
          mainWindow.webContents.send('menu-settings');
        }
      }
    ]));
  }
}

  // 创建系统托盘图标
function createTray(iconPath) {
  try {
    // 如果应用正在退出，不创建托盘图标
    if (appState.isQuitting) {
      log('应用正在退出，不创建托盘图标');
      return;
    }
    
    // 如果已存在托盘图标，先删除
    if (trayIcon) {
      trayIcon.destroy();
      trayIcon = null;
    }

    if (!iconPath) {
      // 使用专门的托盘图标路径函数
      iconPath = getTrayIconPath();
    }
    
    // 避免空图标路径
    if (!iconPath) {
      log('无法获取有效的图标路径，托盘图标将不会创建');
      return;
    }
    
    // 确保图标文件存在
    if (!fs.existsSync(iconPath)) {
      log(`图标文件不存在: ${iconPath}，托盘图标将不会创建`);
      return;
    }
    
    // 确保应用不是处于退出状态
    appState.isQuitting = false;
    
    // 输出更详细的信息用于调试
    log(`尝试创建托盘图标，使用图标: ${iconPath}`);
    log(`图标文件大小: ${fs.statSync(iconPath).size} 字节`);
    
    try {
      // 使用nativeImage来加载图标，可以提供更好的兼容性
      const { nativeImage } = require('electron');
      const icon = nativeImage.createFromPath(iconPath);
      
      if (icon.isEmpty()) {
        log('图标加载失败，创建了空图像');
        // 直接使用路径尝试 - 最后的尝试
        trayIcon = new Tray(iconPath);
      } else {
        log('图标加载成功，创建托盘图标');
        trayIcon = new Tray(icon);
      }
      
      trayIcon.setToolTip('QuickStart');
      
      // 立即设置一个基本菜单，确保右键始终可用
      const basicMenu = Menu.buildFromTemplate([
        { 
          label: '显示主窗口', 
          click: () => {
            if (mainWindow) {
              mainWindow.show();
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.focus();
            } else {
              createWindow();
            }
          } 
        },
        { type: 'separator' },
        { 
          label: '退出', 
          click: () => quitApplication()
        }
      ]);
      trayIcon.setContextMenu(basicMenu);
      
      // 然后异步更新完整的托盘菜单
      refreshTrayMenu();
      
      // 点击托盘图标时切换窗口显示状态
      trayIcon.on('click', () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            if (mainWindow.isMinimized()) {
              mainWindow.restore();  // 如果窗口被最小化，恢复它
            }
            mainWindow.focus();    // 确保窗口获得焦点
            
            // 检查是否需要销毁托盘图标（只有当最小化到托盘选项未启用时）
            if (!settings || !settings.minimize_to_tray) {
              if (trayIcon) {
                log('通过托盘图标恢复窗口，销毁托盘图标');
                trayIcon.destroy();
                trayIcon = null;
              }
            }
          }
        } else {
          createWindow();
          
          // 新创建窗口后，也应检查是否需要销毁托盘图标
          if (!settings || !settings.minimize_to_tray) {
            if (trayIcon) {
              log('通过托盘图标创建新窗口，销毁托盘图标');
              trayIcon.destroy();
              trayIcon = null;
            }
          }
        }
      });
      
      log('托盘图标创建成功');
    } catch (error) {
      log(`创建托盘图标失败: ${error.message}`, true);
    }
  } catch (error) {
    log(`创建托盘图标时发生异常: ${error.message}`, true);
  }
}

// 为托盘菜单项获取图标，使用与文件列表完全相同的逻辑
async function getTrayItemIcon(filePath) {
  try {
    // 如果文件不存在，返回null
    if (!fs.existsSync(filePath)) {
      log(`文件不存在，无法获取图标: ${filePath}`);
      return null;
    }
    
    // 直接通过files/with-icons API获取所有文件及图标数据
    try {
      const response = await axios.get(`${API_BASE_URL}/files/with-icons`);
      if (response.data && response.data.success && response.data.data) {
        // 在返回的文件列表中查找匹配的文件
        const fileList = response.data.data;
        const matchingFile = fileList.find(file => file.path === filePath);
        
        if (matchingFile && matchingFile.icon) {
          // 找到匹配文件并且有图标数据
          log(`找到文件 ${filePath} 的图标数据`);
          
          try {
            // 将Base64图标数据转换为nativeImage
            let iconData = matchingFile.icon;
            // 如果图标数据不是以data:开头的完整URL，添加前缀
            if (!iconData.startsWith('data:')) {
              iconData = `data:image/png;base64,${iconData}`;
            }
            
            // 从Base64数据创建Buffer
            const imgData = iconData.replace(/^data:image\/(png|jpg|jpeg|gif);base64,/, '');
            const buffer = Buffer.from(imgData, 'base64');
            
            // 创建nativeImage对象
            const icon = nativeImage.createFromBuffer(buffer);
            if (!icon.isEmpty()) {
              // 图标有效，调整大小后返回
              return icon.resize({ width: 16, height: 16 });
            }
          } catch (err) {
            log(`处理图标数据失败: ${err.message}`);
          }
        } else {
          log(`找不到文件 ${filePath} 的图标数据`);
        }
      }
    } catch (apiError) {
      log(`通过API获取图标失败: ${apiError.message}`);
    }

    // 如果API方法失败，继续使用Electron原生方法
    const ext = path.extname(filePath).toLowerCase();
    const stats = fs.statSync(filePath);
    const isFolder = stats.isDirectory();
    
    if (isFolder) {
      // 不再直接返回null，而是尝试获取系统文件夹图标
      try {
        const icon = await app.getFileIcon(filePath, { size: 'large' });
        if (icon && !icon.isEmpty()) {
          return icon.resize({ width: 16, height: 16 });
        }
      } catch (error) {
        log(`使用Electron API获取文件夹图标失败: ${error.message}`);
      }
    }
    
    // 使用Electron原生API获取图标作为备选方案
    try {
      const icon = await app.getFileIcon(filePath, { size: 'large' });
      if (icon && !icon.isEmpty()) {
        return icon.resize({ width: 16, height: 16 });
      }
    } catch (error) {
      log(`使用Electron API获取图标失败: ${error.message}`);
    }
    
    // 所有方法都失败，返回null
    return null;
  } catch (error) {
    log(`获取托盘项图标时出错: ${error.message}`);
    return null;
  }
}

  // 构建托盘菜单
function buildTrayMenu(trayItems, translations) {
  if (!trayIcon) {
    log('托盘图标不存在，无法构建菜单');
    return;
  }
  
  // Electron的Tray对象没有getContextMenu方法
  // 我们不需要检查是否存在上下文菜单，直接为其构建菜单即可
  
  // 翻译辅助函数
  const t = (key) => {
    // 键名完全匹配
    if (translations[key]) {
      return translations[key];
    }
    
    // 打印可用的翻译键，帮助调试
    log(`尝试查找翻译键: ${key}`);
    log(`可用的翻译键:`, Object.keys(translations).filter(k => 
      k.toLowerCase() === key.toLowerCase() || 
      k.includes(key) || 
      key.includes(k)
    ).slice(0, 5).join(', '));
    
    // 尝试不区分大小写的匹配
    const lowerKey = key.toLowerCase();
    for (const [k, v] of Object.entries(translations)) {
      if (k.toLowerCase() === lowerKey) {
        log(`找到类似的翻译键: ${k} => ${v}`);
        return v;
      }
    }
    
    // 回退到默认值
    log(`未找到翻译键: ${key}，使用默认值`);
    const defaultValues = {
      'show': '显示主窗口',
      'exit': '退出',
      'tray_list_label': '托盘文件列表'
    };
    
    return defaultValues[key] || key;
  };
  
  // 输出详细调试信息
  log('开始构建托盘菜单，托盘项数量:', trayItems.length);
  log('当前使用的语言:', settings?.language);
  if (trayItems.length > 0) {
    log('第一个托盘项示例:', JSON.stringify(trayItems[0]));
  }
  
  // 创建基本菜单
  const menuItems = [
    {
      label: t('show') || '显示主窗口',
      click: () => {
        log('点击了显示菜单项');
        if (mainWindow) {
          mainWindow.show();
          if (mainWindow.isMinimized()) {
            mainWindow.restore();
          }
          mainWindow.focus();
          
          // 检查是否需要销毁托盘图标（只有当最小化到托盘选项未启用时）
          if (!settings || !settings.minimize_to_tray) {
            if (trayIcon) {
              log('通过托盘菜单恢复窗口，销毁托盘图标');
              trayIcon.destroy();
              trayIcon = null;
            }
          }
        } else {
          createWindow();
          
          // 新创建窗口后，也应检查是否需要销毁托盘图标
          if (!settings || !settings.minimize_to_tray) {
            if (trayIcon) {
              log('通过托盘菜单创建新窗口，销毁托盘图标');
              trayIcon.destroy();
              trayIcon = null;
            }
          }
        }
      }
    }
  ];
  
  // 添加用户自定义项
  if (trayItems && trayItems.length > 0) {
    log(`添加${trayItems.length}个托盘自定义项到菜单`);
    
    // 分隔线
    menuItems.push({ type: 'separator' });
    
    // 添加托盘文件标签
    menuItems.push({ 
      label: t('tray_list_label') || '托盘文件列表', 
      enabled: false 
    });
    
    // 防止对象属性丢失导致错误
    let safeItems = trayItems.map(item => {
      // 确保必须属性存在
      return {
        path: item.path || '',
        name: item.name || path.basename(item.path || '') || '未命名',
        remark: item.remark || '',
        in_tray: item.in_tray === true,
        is_dir: item.is_dir === true,
        admin: item.admin === true,
        params: item.params || '',
        icon: item.icon || null // 保留原始图标数据
      };
    });
    
    log(`处理后的托盘项数量: ${safeItems.length}`);
    
    // 首先检查是否有完整的图标数据
    const hasIconData = safeItems.some(item => item.icon);
    log(`托盘项中${hasIconData ? '包含' : '不包含'}原始图标数据`);
    
    // 为每个文件创建菜单项
    const promises = safeItems.map(item => {
      return new Promise(async (resolve) => {
        // 先检查文件是否存在
        if (!fs.existsSync(item.path)) {
          log(`文件不存在: ${item.path}`);
          // 如果文件不存在，创建一个简单菜单项
          resolve({
            label: item.remark || item.name,
            click: () => log(`文件不存在: ${item.path}`)
          });
          return;
        }
        
        // 获取文件属性
        const stats = fs.statSync(item.path);
        const isFolder = item.is_dir || stats.isDirectory();
        
        // 获取显示名称 - 优先使用备注
        const displayName = item.remark || item.name;
        
        // 处理文件夹
        if (isFolder) {
          // 尝试获取文件夹的系统图标
          try {
            // 先尝试从原始图标数据创建图标
            let folderIcon = null;
            
            // 如果有原始图标数据，直接使用
            if (item.icon && typeof item.icon === 'string') {
              try {
                let iconData = item.icon;
                if (!iconData.startsWith('data:')) {
                  iconData = `data:image/png;base64,${iconData}`;
                }
                
                const imgData = iconData.replace(/^data:image\/(png|jpg|jpeg|gif);base64,/, '');
                const buffer = Buffer.from(imgData, 'base64');
                folderIcon = nativeImage.createFromBuffer(buffer);
                
                if (folderIcon && !folderIcon.isEmpty()) {
                  folderIcon = folderIcon.resize({ width: 16, height: 16 });
                  log(`使用原始图标数据为文件夹 ${item.path} 创建图标`);
                } else {
                  folderIcon = null;
                }
              } catch (err) {
                log(`处理文件夹图标数据失败: ${err.message}`);
                folderIcon = null;
              }
            }
            
            // 如果没有原始图标数据，尝试获取系统图标
            if (!folderIcon) {
              folderIcon = await getTrayItemIcon(item.path);
            }
            
            // 如果成功获取到图标，使用系统图标
            if (folderIcon && !folderIcon.isEmpty()) {
              resolve({
                label: displayName,
                icon: folderIcon,
                click: () => openFileWithFallbacks(item)
              });
              return;
            }
          } catch (folderIconError) {
            log(`获取文件夹图标失败: ${folderIconError.message}`);
          }
          
          // 如果获取系统图标失败，使用文本前缀
          resolve({
            label: `📂 ${displayName}`,  // 使用📂作为后备选项
            click: () => openFileWithFallbacks(item)
          });
          return;
        }
        
        // 使用图标数据，优先使用item中的图标数据
        let icon = null;
        
        // 如果有原始图标数据，直接使用
        if (item.icon && typeof item.icon === 'string') {
          try {
            let iconData = item.icon;
            // 确保图标数据有正确的格式
            if (!iconData.startsWith('data:')) {
              iconData = `data:image/png;base64,${iconData}`;
            }
            
            // 转换为nativeImage
            const imgData = iconData.replace(/^data:image\/(png|jpg|jpeg|gif);base64,/, '');
            const buffer = Buffer.from(imgData, 'base64');
            icon = nativeImage.createFromBuffer(buffer);
            
            // 调整大小
            if (icon && !icon.isEmpty()) {
              icon = icon.resize({ width: 16, height: 16 });
              log(`使用原始图标数据为 ${item.path} 创建图标`);
            }
          } catch (err) {
            log(`处理原始图标数据失败: ${err.message}`);
            icon = null;
          }
        }
        
        // 如果无法从原始数据创建图标，尝试获取
        if (!icon) {
          icon = await getTrayItemIcon(item.path);
        }
        
        if (icon) {
          // 成功获取图标，使用系统图标
          resolve({
            label: displayName,
            icon: icon,
            click: () => openFileWithFallbacks(item)
          });
        } else {
          // 无法获取图标，使用文本前缀
          let prefixedLabel = displayName;
          if (ext === '.lnk') {
            prefixedLabel = `🔗 ${displayName}`;  // 使用🔗图标并加空格
          } else if (ext === '.url') {
            prefixedLabel = `🌐 ${displayName}`;  // 使用🌐图标并加空格
          }
          
          resolve({
            label: prefixedLabel,
            click: () => openFileWithFallbacks(item)
          });
        }
      });
    });
    
    // 异步处理所有菜单项
    Promise.all(promises)
      .then(fileMenuItems => {
        // 添加文件菜单项
        fileMenuItems.forEach(item => {
          menuItems.push(item);
        });
        
        // 添加分隔线
        menuItems.push({ type: 'separator' });
        
        // 添加退出选项
        menuItems.push({
          label: t('exit') || '退出',
          click: () => quitApplication()
        });
        
        // 构建最终菜单
        const contextMenu = Menu.buildFromTemplate(menuItems);
        
        // 设置托盘图标菜单
        if (trayIcon) {
          trayIcon.setContextMenu(contextMenu);
          log('托盘菜单已更新');
        } else {
          log('托盘图标不存在，无法设置菜单');
        }
      })
      .catch(error => {
        log('构建托盘菜单项错误:', error);
        
        // 出错时构建简单菜单
        const simpleMenuItems = menuItems.concat([
          { type: 'separator' },
          {
            label: t('exit') || '退出',
            click: () => quitApplication()
          }
        ]);
        
        // 构建简单菜单并设置
        const simpleMenu = Menu.buildFromTemplate(simpleMenuItems);
        
        if (trayIcon) {
          trayIcon.setContextMenu(simpleMenu);
          log('已设置简单托盘菜单');
        } else {
          log('托盘图标不存在，无法设置简单菜单');
        }
      });
  } else {
    // 没有托盘项，构建简单菜单
    const simpleMenuItems = menuItems.concat([
      { type: 'separator' },
      {
        label: t('exit') || '退出',
        click: () => quitApplication()
      }
    ]);
    
    // 构建简单菜单并设置
    const simpleMenu = Menu.buildFromTemplate(simpleMenuItems);
    
    if (trayIcon) {
      trayIcon.setContextMenu(simpleMenu);
      log('已设置简单托盘菜单（无托盘项）');
    } else {
      log('托盘图标不存在，无法设置简单菜单（无托盘项）');
    }
  }
}

// 添加新的辅助函数来打开文件，包含多种备选方法
function openFileWithFallbacks(item) {
  const filePath = item.path;
  
  try {
    log(`尝试打开文件: ${filePath}`);
    
    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      log(`文件不存在: ${filePath}`);
      return;
    }
    
    // 检查文件扩展名
    const ext = path.extname(filePath).toLowerCase();
    
    // 对于URL文件，尝试读取内容并提取URL
    if (ext === '.url') {
      try {
        log('处理URL文件');
        const content = fs.readFileSync(filePath, 'utf8');
        const urlMatch = content.match(/URL=(.+)/);
        
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1].trim();
          log(`从URL文件中提取URL: ${url}`);
          shell.openExternal(url);
          return;
        }
      } catch (urlError) {
        log('处理URL文件内容失败:', urlError);
        // 继续尝试其他方法
      }
    }
    
    // 根据文件类型打开
    if (item.is_dir) {
      // 打开文件夹
      log(`打开文件夹: ${filePath}`);
      shell.openPath(filePath).then(error => {
        if (error) log(`打开文件夹失败: ${error}`);
      });
    } else if (item.admin && process.platform === 'win32') {
      // 以管理员权限打开 - 这里只能使用shell.openExternal
      log(`以管理员权限打开文件: ${filePath}`);
      shell.openExternal(filePath).catch(err => {
        log(`管理员权限打开失败: ${err.message}`);
        // 尝试普通方式打开
        shell.openPath(filePath).then(error => {
          if (error) log(`普通方式打开也失败: ${error}`);
        });
      });
    } else {
      // 普通方式打开
      log(`普通方式打开文件: ${filePath}`);
      shell.openPath(filePath).then(error => {
        if (error) {
          log(`shell.openPath失败: ${error}`);
          // 尝试使用子进程
          tryOpenWithChildProcess(filePath, item.params);
        }
      });
    }
  } catch (error) {
    log(`打开文件失败: ${error.message}`);
    // 最后尝试子进程方法
    tryOpenWithChildProcess(filePath, item.params);
  }
}

// 使用子进程打开文件的辅助函数
function tryOpenWithChildProcess(filePath, params = '') {
  log('尝试使用子进程打开文件');
  try {
    if (process.platform === 'win32') {
      // Windows平台
      const args = ['/c', 'start', '""'];
      if (params) args.push(params);
      args.push(filePath);
      
      const childProcess = require('child_process');
      childProcess.spawn('cmd.exe', args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
      
      log('通过cmd.exe启动文件成功');
    } else if (process.platform === 'darwin') {
      // macOS平台
      const args = [filePath];
      if (params) args.push(params);
      
      const childProcess = require('child_process');
      childProcess.spawn('open', args, {
        detached: true,
        stdio: 'ignore'
      }).unref();
      
      log('通过open命令启动文件成功');
    } else {
      // Linux平台
      const args = [filePath];
      if (params) args.push(params);
      
      const childProcess = require('child_process');
      childProcess.spawn('xdg-open', args, {
        detached: true,
        stdio: 'ignore'
      }).unref();
      
      log('通过xdg-open命令启动文件成功');
    }
  } catch (spawnError) {
    log(`子进程启动失败: ${spawnError.message}`);
  }
}

// 处理最小化到托盘设置
function handleMinimizeToTray(minimize) {
  log(`设置最小化到托盘: ${minimize}`);
  
  // 确保退出状态正确
  if (!appState.isQuitting) {
    appState.isQuitting = false;
    app.isQuitting = false;  // 同时确保app.isQuitting也为false
  }
  
  // 如果已存在窗口，设置其关闭行为
  if (mainWindow) {
    // 移除所有已有的close事件监听器，避免重复添加
    mainWindow.removeAllListeners('close');
    
    // 添加新的close事件监听器
    mainWindow.on('close', (event) => {
      // 明确转换为布尔值，避免字符串等类型问题
      const shouldMinimize = minimize === true;
      const settingsEnabled = settings && settings.minimize_to_tray === true;
      
      log(`窗口关闭事件触发，appState.isQuitting=${appState.isQuitting}, app.isQuitting=${app.isQuitting}, settingsEnabled=${settingsEnabled}, minimize=${minimize}`);
      
      // 确保设置值是正确的，防止意外情况
      log(`检查minimize_to_tray当前设置状态: ${settings.minimize_to_tray}, 类型: ${typeof settings.minimize_to_tray}`);
      
      // 如果明确设置要退出，不拦截关闭事件
      // 同时检查两个退出标志，确保一致性
      if (appState.isQuitting || app.isQuitting) {
        log('应用正在退出，允许窗口关闭');
        return true;
      }
      
      // 如果设置了最小化到托盘，拦截关闭事件
      if (shouldMinimize && settingsEnabled) {
        event.preventDefault();
        log('阻止窗口关闭，改为隐藏窗口');
        mainWindow.hide();
        
        // 只在关闭窗口且设置了"最小化到系统托盘"时创建托盘图标
        if (!trayIcon) {
          log('托盘图标不存在，尝试创建');
          const iconPath = getTrayIconPath();
          createTray(iconPath);
          
          // 确保托盘项目已加载
          if (!appState.trayItemsLoaded) {
            loadTrayItems();
          }
        }
        
        return false;
      }
      
      log('允许窗口关闭');
      // 确保退出时清理资源
      appState.isQuitting = true;
      app.isQuitting = true;
      
      // 如果设置了不需要最小化到托盘或明确指定退出，销毁托盘图标
      if (trayIcon && (!settings.minimize_to_tray || appState.isQuitting)) {
        log('销毁托盘图标');
        trayIcon.destroy();
        trayIcon = null;
      }
      
      // 在明确退出时才终止Python服务器进程
      if (pyProc && appState.isQuitting) {
        try {
          log('正在终止Python进程...');
          // 强制杀死进程及其子进程
          if (process.platform === 'win32') {
            const { spawn } = require('child_process');
            // 使用同步方式确保在应用退出前完成
            spawn('taskkill', ['/pid', pyProc.pid, '/f', '/t'], {
              detached: true,
              stdio: 'ignore'
            }).unref();
            
            log(`已发送taskkill命令终止进程(PID: ${pyProc.pid})`);
          } else {
            pyProc.kill('SIGKILL');
          }
        } catch (error) {
          log('终止Python进程失败:', error);
        }
        pyProc = null;
      }
      return true;
    });
    
    // 处理窗口最小化行为
    mainWindow.removeAllListeners('minimize');
    
    if (minimize) {
      mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
        
        // 确保settings存在，并检查设置是否明确启用了最小化到托盘
        const enableMinToTray = settings && settings.minimize_to_tray === true;
        
        // 只有在设置了最小化到系统托盘且托盘图标不存在时才创建托盘图标
        if (!trayIcon && enableMinToTray) {
          log('最小化时创建托盘图标');
          const iconPath = getTrayIconPath();
          createTray(iconPath);
        }
      });
    } else {
      // 如果不需要最小化到托盘但托盘图标存在，销毁它
      if (trayIcon && !app.isQuitting) {
        log('销毁不必要的托盘图标');
        trayIcon.destroy();
        trayIcon = null;
      }
    }
  }
}

// 重启Python服务器
function restartPythonServer() {
  if (pyProc) {
    // 尝试正常终止进程
    pyProc.kill();
    pyProc = null;
  }
  
  // 重置重试计数器
  retryCount = 0;
  
  // 重新启动服务器
  setTimeout(() => {
    startPythonServer();
    waitForPythonServer();
  }, 1000);
}

// 添加一个全局的退出函数，确保所有清理工作都正确执行
function quitApplication(skipAppQuit = false) {
  log('执行应用退出流程');
  
  // 设置退出标志
  appState.isQuitting = true;
  app.isQuitting = true;
  
  // 确保销毁托盘图标
  if (trayIcon) {
    log('退出应用，销毁托盘图标');
    trayIcon.destroy();
    trayIcon = null;
  }
  
  // 判断是否为打包环境
  const isProd = app.isPackaged;
  log(`当前环境: ${isProd ? '生产环境(打包)' : '开发环境'}`);
  
  // 终止Python服务器进程
  if (pyProc) {
    try {
      log('正在终止Python进程...');
      
      if (process.platform === 'win32') {
        if (isProd) {
          // 打包环境 - 使用强化的终止逻辑
          const { execSync } = require('child_process');
          try {
            log(`尝试通过PID终止进程(PID: ${pyProc.pid})`);
            execSync(`taskkill /pid ${pyProc.pid} /f /t`, { timeout: 3000 });
            log(`成功终止进程(PID: ${pyProc.pid})`);
          } catch (err) {
            log(`尝试通过PID终止失败: ${err.message}`);
            // 备用方案：尝试通过映像名终止
            try {
              log('尝试通过映像名终止backend.exe进程');
              execSync('taskkill /im backend.exe /f /t', { timeout: 3000 });
              log('成功通过映像名终止backend.exe进程');
            } catch (backendErr) {
              log(`终止backend.exe失败: ${backendErr.message}`);
            }
          }
        } else {
          // 开发环境 - 使用简单的进程终止方式
          pyProc.kill();
          log(`已终止Python开发进程(PID: ${pyProc.pid})`);
        }
      } else {
        // 非Windows平台使用SIGKILL信号
        pyProc.kill('SIGKILL');
      }
    } catch (error) {
      log('终止Python进程失败:', error);
    }
    pyProc = null;
  } else {
    // 即使pyProc为空，也尝试通过映像名终止backend.exe（仅在打包环境可能存在脱离控制的进程）
    if (process.platform === 'win32' && app.isPackaged) {
      try {
        const { execSync } = require('child_process');
        log('pyProc为空，但在打包环境下仍尝试通过映像名终止backend.exe');
        execSync('taskkill /im backend.exe /f /t', { timeout: 3000 });
        log('成功通过映像名终止backend.exe进程');
      } catch (err) {
        // 如果进程不存在会抛出错误，这是可以接受的
        log(`通过映像名终止backend.exe进程返回: ${err.message}`);
      }
    }
  }
  
  // 使用kill-python.js脚本作为备份清理方案（仅在打包环境需要）
  if (app.isPackaged && process.platform === 'win32') {
    try {
      // 尝试多个可能的路径，确保在打包环境能找到脚本
      let killScriptPath = path.join(__dirname, '..', 'scripts', 'kill-python.js');
      
      // 如果找不到，尝试在资源目录下查找
      if (!fs.existsSync(killScriptPath)) {
        killScriptPath = path.join(process.resourcesPath, 'scripts', 'kill-python.js');
        
        // 如果还是找不到，尝试app.asar外的路径
        if (!fs.existsSync(killScriptPath)) {
          killScriptPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'kill-python.js');
        }
      }
      
      if (fs.existsSync(killScriptPath)) {
        log(`找到并执行Python进程清理脚本: ${killScriptPath}`);
        const { execSync } = require('child_process');
        execSync(`node "${killScriptPath}"`, { timeout: 5000 });
        log('Python进程清理脚本执行完成');
      } else {
        log(`未找到清理脚本，使用备选方案直接终止进程`);
        // 备选方案: 再次尝试终止所有backend.exe进程
        try {
          const { execSync } = require('child_process');
          execSync('taskkill /im backend.exe /f /t', { timeout: 3000 });
          log('使用备选方案成功终止backend.exe进程');
        } catch (err) {
          log(`备选方案终止进程结果: ${err.message}`);
        }
      }
    } catch (error) {
      log('执行清理脚本失败:', error);
    }
  }
  
  // 确保在指定时间后强制退出应用
  setTimeout(() => {
    log('确保应用退出');
    process.exit(0);
  }, app.isPackaged ? 1500 : 1000); // 打包环境给予更长的清理时间
  
  // 如果没有指定跳过，则立即退出应用
  if (!skipAppQuit) {
    log('调用app.quit()');
    app.quit();
  }
}

// 监听IPC消息：应用关闭 - 使用统一的退出函数
ipcMain.on('app-closing', () => {
  log('应用关闭中，准备清理资源...');
  quitApplication();
});

// 监听渲染进程发来的消息
ipcMain.on('update-tray-menu', (event) => {
  log('收到更新托盘菜单消息');
  refreshTrayMenu();
});

// 监听渲染进程发来的消息 - 只更新菜单但不创建托盘
ipcMain.on('update-tray-menu-no-create', (event) => {
  log('收到更新托盘菜单消息（不创建托盘）');
  // 只有当托盘图标已存在时才更新菜单
  if (trayIcon) {
    refreshTrayMenu();
  } else {
    log('托盘图标不存在，跳过更新托盘菜单');
  }
});

// 监听渲染进程发来的设置更新消息
ipcMain.on('settings-updated', (event, newSettings) => {
  log('收到设置更新:', newSettings);
  
  // 保存旧设置中的minimize_to_tray状态
  const oldMinimizeToTray = settings ? settings.minimize_to_tray : false;
  
  // 确保新设置不为空
  if (!newSettings) {
    log('收到空设置，使用当前设置');
    newSettings = settings || { language: "中文" };
  }
  
  // 确保minimize_to_tray属性是布尔值
  if (typeof newSettings.minimize_to_tray !== 'boolean') {
    newSettings.minimize_to_tray = newSettings.minimize_to_tray === true || newSettings.minimize_to_tray === "true";
  }
  
  // 更新设置
  settings = {
    ...settings,  // 保留默认值
    ...newSettings  // 应用新设置
  };
  
  // 检查最小化到托盘设置是否变化
  const minimizeToTrayChanged = oldMinimizeToTray !== settings.minimize_to_tray;
  
  if (minimizeToTrayChanged) {
    log(`最小化到托盘设置改变: ${oldMinimizeToTray} -> ${settings.minimize_to_tray}`);
    // 重置应用退出标志，确保下次窗口关闭时正确处理
    app.isQuitting = false;
  }
  
  // 更新最小化到托盘设置
  // 明确确保settings.minimize_to_tray是布尔类型 true
  const enableTrayMinimize = settings && settings.minimize_to_tray === true;
  
  // 记录当前状态用于调试
  log(`更新最小化到托盘设置，当前设置值: ${enableTrayMinimize}，原始值类型: ${typeof settings.minimize_to_tray}`);
  
  if (enableTrayMinimize) {
    // 启用最小化到托盘
    log('启用最小化到托盘功能');
    
    // 移除现有事件监听器，避免多次绑定
    if (mainWindow) {
      mainWindow.removeAllListeners('minimize');
      
      // 添加新的minimize事件监听器
      mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
        
        // 确保图标存在
        if (!trayIcon) {
          const trayIconPath = getTrayIconPath();
          log('最小化时创建托盘图标');
          createTray(trayIconPath);
        }
      });
    }
    
    // 更新窗口关闭事件处理为启用状态，此处传入true
    log('启用关闭窗口时最小化到托盘');
    app.isQuitting = false; // 重要：确保isQuitting被正确重置
    handleMinimizeToTray(true);
  } else {
    // 禁用最小化到托盘
    log('禁用最小化到托盘功能');
    
    // 移除事件监听器
    if (mainWindow) {
      mainWindow.removeAllListeners('minimize');
    }
    
    // 更新窗口关闭事件处理为禁用状态，此处传入false
    log('禁用关闭窗口时最小化到托盘');
    handleMinimizeToTray(false);
    
    // 如果托盘图标存在且不是退出状态，销毁它
    if (trayIcon && !app.isQuitting) {
      log('销毁不必要的托盘图标');
      trayIcon.destroy();
      trayIcon = null;
    }
  }
});

// 监听IPC消息：打开文件选择对话框
ipcMain.handle('open-file-dialog', async (event, options) => {
  const { title, filters, properties, defaultPath } = options;
  
  // 确保所有文件 (*.*) 筛选器显示为默认选项
  let dialogFilters = filters;
  
  // 在Windows系统上特殊处理
  if (process.platform === 'win32' && filters && filters.length > 0) {
    // 为Windows确保"*.*"能作为默认选择
    if (filters[0] && filters[0].extensions && filters[0].extensions.includes('*')) {
      dialogFilters = [...filters];
      // 在Windows上使用"*"作为扩展名不好，改为更明确的描述
      dialogFilters[0] = {
        name: filters[0].name || '所有文件 (*.*)',
        extensions: ['*']
      };
      
      log('Windows文件对话框筛选器:', JSON.stringify(dialogFilters));
    }
  }
  
  // 使用用户提供的defaultPath，如果存在的话
  const userDefaultPath = defaultPath && fs.existsSync(defaultPath) ? defaultPath : null;
  
  const dialogOptions = {
    title,
    filters: dialogFilters,
    properties,
    // 优先使用传入的路径，其次使用用户目录
    defaultPath: userDefaultPath || (process.platform === 'win32' ? (process.env.USERPROFILE || '') : '')
  };
  
  // 调试输出
  log('打开文件对话框选项:', JSON.stringify({
    platform: process.platform,
    dialogOptions: {
      title: dialogOptions.title,
      filters: dialogOptions.filters,
      properties: dialogOptions.properties,
      defaultPath: dialogOptions.defaultPath
    }
  }));
  
  const result = await dialog.showOpenDialog(mainWindow, dialogOptions);
  
  return result.filePaths;
});

// 监听IPC消息：打开文件位置
ipcMain.handle('open-file-location', async (event, filePath) => {
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
    return true;
  }
  return false;
});

// 监听IPC消息：获取文件图标
ipcMain.handle('get-file-icon', async (event, filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      log(`文件不存在: ${filePath}`);
      return null;
    }

    try {
      // 使用Electron原生API获取图标
      const icon = await app.getFileIcon(filePath, {
        size: 'large'
      });
      
      if (icon) {
        // 转换为Base64
        return icon.toPNG().toString('base64');
      }
    } catch (error) {
      log(`获取文件图标失败: ${error.message}`);
    }
    
    return null;
  } catch (error) {
    log('获取文件图标失败:', error);
    return null;
  }
});

// 监听IPC消息：打开外部链接
ipcMain.handle('open-external-link', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    log('打开外部链接失败:', error);
    return false;
  }
});

// 监听IPC消息：更新最小化到托盘设置
ipcMain.on('update-minimize-setting', (event, minimizeToTray) => {
  log(`立即更新最小化到托盘设置: ${minimizeToTray}`);
  
  // 转换为布尔值并更新全局设置
  const enableMinimize = minimizeToTray === true;
  
  // 更新内存中的设置
  if (settings) {
    settings.minimize_to_tray = enableMinimize;
  }
  
  // 重置应用退出标志，确保下次窗口关闭时正确处理
  appState.isQuitting = false;
  app.isQuitting = false;
  
  // 确保更新同步到后端，以便持久化保存
  axios.put(`${API_BASE_URL}/settings`, { minimize_to_tray: enableMinimize })
    .then(response => {
      log(`最小化到托盘设置已同步到后端: ${enableMinimize}`);
    })
    .catch(error => {
      log(`同步最小化到托盘设置到后端失败: ${error.message}`);
    });
  
  // 如果启用了最小化到托盘，确保加载托盘项目
  if (enableMinimize && !appState.trayItemsLoaded) {
    loadTrayItems();
  }
  
  // 立即应用新设置
  handleMinimizeToTray(enableMinimize);
});

// 确保在应用退出前清理资源
app.on('will-quit', (event) => {
  log('应用即将退出');
  // 传入 true 表示跳过调用 app.quit()，因为这是在 will-quit 事件中
  quitApplication(true);
});

// 在应用准备退出之前处理
app.on('before-quit', (event) => {
  log('应用准备退出(before-quit)');
  // 设置退出标志，确保其他事件处理器知道应用正在退出
  appState.isQuitting = true;
  app.isQuitting = true;
  
  // 如果是Windows平台且在打包环境下，主动使用映像名终止backend.exe
  if (process.platform === 'win32' && app.isPackaged) {
    try {
      const { execSync } = require('child_process');
      log('打包环境下主动尝试终止backend.exe进程');
      execSync('taskkill /im backend.exe /f /t', { timeout: 3000 });
      log('成功主动终止backend.exe进程');
    } catch (err) {
      // 如果进程不存在会抛出错误，这是可以接受的
      log(`主动终止backend.exe返回: ${err.message}`);
    }
  }
});

// 处理macOS特性：点击dock图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理所有窗口关闭事件
app.on('window-all-closed', () => {
  // 在macOS上，除非用户按下 Cmd + Q 显式退出
  // 否则应用及菜单栏会保持活跃状态
  if (process.platform !== 'darwin') {
    // 使用统一的退出函数
    quitApplication();
  }
});

// 刷新托盘菜单
function refreshTrayMenu() {
  log('刷新托盘菜单');
  
  // 如果托盘图标不存在，直接返回
  if (!trayIcon) {
    log('托盘图标不存在，跳过刷新菜单');
    return;
  }
  
  axios.get(`${API_BASE_URL}/tray`)
    .then(response => {
      const trayItems = response.data.data || [];
      log(`获取到${trayItems.length}个托盘项`);
      
      // 获取翻译，使用全局settings，并添加默认值保护
      const language = settings && settings.language ? settings.language : "中文";
      axios.get(`${API_BASE_URL}/translations/${encodeURIComponent(language)}`)
        .then(translationResponse => {
          const translations = translationResponse.data.data || {};
          buildTrayMenu(trayItems, translations);
        })
        .catch(error => {
          log('获取翻译出错:', error);
          // 即使翻译获取失败，仍然构建菜单
          buildTrayMenu(trayItems, {});
        });
    })
    .catch(error => {
      log('获取托盘项目错误:', error);
      // 构建菜单但不包含项目
      buildTrayMenu([], {});
    });
}

// 监听IPC消息：语言变更事件
ipcMain.on('language-changed', (event, newLanguage) => {
  // 如果已经在处理语言变更，跳过
  if (isProcessingLanguageChange) {
    log('已有语言变更请求正在处理中，跳过重复请求');
    return;
  }
  
  // 设置标志表示正在处理语言变更
  isProcessingLanguageChange = true;
  
  log(`语言已变更为: ${newLanguage}，立即更新托盘菜单翻译`);
  // 更新全局设置中的语言
  if (settings) {
    settings.language = newLanguage;
  }
  
  // 获取新语言的翻译，并更新托盘菜单
  updateTrayMenu()
    .then(() => {
      // 确保只有当应用完全初始化后才刷新主窗口
      if (app.appReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        log('应用已初始化，正在刷新主窗口以应用新语言');
        // 通知主窗口刷新一次
        mainWindow.webContents.send('refresh-main-window');
      } else {
        log('应用尚未完全初始化，跳过主窗口刷新');
      }
      
      // 重置标志，允许下一次语言变更请求
      setTimeout(() => {
        isProcessingLanguageChange = false;
      }, 1500);
    })
    .catch(err => {
      log('更新托盘菜单失败:', err);
      // 确保只有当应用完全初始化后才刷新主窗口
      if (app.appReady && mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents) {
        log('尽管更新托盘菜单失败，仍然刷新主窗口');
        mainWindow.webContents.send('refresh-main-window');
      }
      
      // 错误情况下也要重置标志
      isProcessingLanguageChange = false;
    });
});

// 当应用程序已准备好时执行
app.on('ready', async () => {
  // 设置表示尚未完全准备好
  app.appReady = false;
  
  // 初始化应用状态
  appState.isQuitting = false;
  app.isQuitting = false;  // 确保两个标志保持一致
  appState.settingsLoaded = false;
  appState.trayItemsLoaded = false;
  
  log('应用启动: 重置所有状态标志');
  
  // 尝试启动Python后端服务器
  try {
    await startPythonServer();
    await waitForPythonServer();
    
    // 创建主窗口
    createWindow();
    
    // 创建应用程序菜单
    createAppMenu();
    
    // 设置标记表示应用已完全初始化
    setTimeout(() => {
      app.appReady = true;
      log('应用程序已完全初始化，标记为就绪状态');
    }, 2000); // 给应用足够的时间初始化
    
  } catch (error) {
    log('启动应用程序失败:', error);
    if (mainWindow) {
      dialog.showErrorBox('启动失败', `无法启动应用程序: ${error.message || '未知错误'}`);
    }
    app.quit();
  }
});

// 更新托盘菜单（获取托盘项和翻译）
function updateTrayMenu() {
  return new Promise((resolve, reject) => {
    // 如果托盘图标不存在，直接解析Promise
    if (!trayIcon) {
      log('托盘图标不存在，跳过更新菜单');
      resolve();
      return;
    }
    
    // 获取当前语言
    const language = settings?.language || 'English';
    
    // 强制重新请求托盘项和翻译，以确保使用最新数据
    Promise.all([
      axios.get(`${API_BASE_URL}/tray`).catch(err => {
        log('获取托盘项失败:', err);
        return { data: { data: [] } };
      }),
      axios.get(`${API_BASE_URL}/translations/${encodeURIComponent(language)}`).catch(err => {
        log('获取翻译失败:', err);
        return { data: { data: {} } };
      })
    ])
    .then(([trayResponse, translationResponse]) => {
      const trayItems = trayResponse.data.data || [];
      const translations = translationResponse.data.data || {};
      
      log(`已获取${trayItems.length}个托盘项和语言[${language}]的翻译`);
      
      // 确保托盘图标存在（此时已确认trayIcon存在，不需再次检查）
      
      // 立即构建并设置托盘菜单
      buildTrayMenu(trayItems, translations);
      
      resolve();
    })
    .catch(err => {
      log('更新托盘菜单失败:', err);
      reject(err);
    });
  });
}

// 加载托盘项目函数
function loadTrayItems() {
  log('开始加载托盘项目...');
  
  // 如果托盘图标不存在且设置允许最小化到托盘，创建托盘图标
  if (!trayIcon && settings.minimize_to_tray) {
    const iconPath = getTrayIconPath();
    log('基于设置创建托盘图标');
    createTray(iconPath);
  }
  
  // 无论托盘图标是否存在，都尝试获取托盘项目
  axios.get(`${API_BASE_URL}/tray`)
    .then(response => {
      const trayItems = response.data.data || [];
      log(`成功加载 ${trayItems.length} 个托盘项目`);
      
      // 标记托盘项目已加载
      appState.trayItemsLoaded = true;
      
      // 如果托盘图标存在，更新托盘菜单
      if (trayIcon) {
        // 获取当前语言的翻译
        const language = settings?.language || "中文";
        axios.get(`${API_BASE_URL}/translations/${encodeURIComponent(language)}`)
          .then(translationResponse => {
            const translations = translationResponse.data.data || {};
            buildTrayMenu(trayItems, translations);
            log('已使用加载的托盘项目更新托盘菜单');
          })
          .catch(error => {
            log('获取翻译出错:', error);
            // 即使翻译获取失败，仍使用加载的托盘项目构建菜单
            buildTrayMenu(trayItems, {});
          });
      }
    })
    .catch(error => {
      log('加载托盘项目失败:', error);
      appState.trayItemsLoaded = false;
    });
} 

// 检查更新函数
async function checkForUpdates(sender) {
  try {
    // 读取项目根目录下的版本信息
    const versionPath = path.join(__dirname, '..', 'version.json');
    const versionJson = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
    const localVersion = versionJson.version;

    // 获取GitHub最新发布版本
    const response = await axios.get('https://api.github.com/repos/AstraSolis/QuickStart/releases/latest');
    const latestVersion = response.data.tag_name.replace('v', '');

    // 比较版本号
    const hasUpdate = compareVersions(latestVersion, localVersion) > 0;

    // 发送更新检查结果到渲染进程
    sender.send('update-check-result', {
      hasUpdate,
      currentVersion: localVersion,
      latestVersion: latestVersion,
      releaseNotes: response.data.body
    });

  } catch (error) {
    console.error('检查更新失败:', error);
    sender.send('update-check-error', error.message);
  }
}

// 版本号比较函数
function compareVersions(v1, v2) {
  const v1Parts = v1.split('.').map(Number);
  const v2Parts = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (v1Parts[i] > v2Parts[i]) return 1;
    if (v1Parts[i] < v2Parts[i]) return -1;
  }
  return 0;
}

// 监听检查更新请求
ipcMain.on('check-for-updates', (event) => {
  checkForUpdates(event.sender);
});

// ... existing code ...
ipcMain.on('open-external-link', (event, url) => {
  if (url) shell.openExternal(url);
});
// ... existing code ...

