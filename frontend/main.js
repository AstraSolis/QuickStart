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
// 全局设置
let settings = { language: "中文" };

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
  let pythonPath, scriptPath;
  
  if (isProd) {
    // 生产环境（打包后）
    pythonPath = path.join(process.resourcesPath, 'python', 'python.exe');
    scriptPath = path.join(process.resourcesPath, 'backend', 'app.py');
  } else {
    // 开发环境
    pythonPath = 'python';
    scriptPath = path.join(__dirname, '..', 'backend', 'app.py');
  }
  
  // 设置环境变量，确保Python进程使用UTF-8编码
  const env = { ...process.env, PYTHONIOENCODING: 'utf-8' };
  
  // 启动Python服务器，传入端口号
  pyProc = spawn(pythonPath, [scriptPath, port.toString()], {
    // 明确设置stdio选项，确保进程能接收信号
    stdio: ['ignore', 'pipe', 'pipe'],
    // 传递环境变量
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
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
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
  
  // 获取设置，判断是否显示托盘图标
  axios.get(`${API_BASE_URL}/settings`)
    .then(response => {
      // 更新全局settings变量
      settings = response.data.data || { language: "中文" };
      const language = settings.language || "中文";
      
      log(`当前语言: ${language}`);
      
      // 获取当前语言的翻译
      axios.get(`${API_BASE_URL}/translations/${encodeURIComponent(language)}`)
        .then(translationRes => {
          menuTranslations = translationRes.data.data || {};
          
          log('菜单翻译加载成功:', Object.keys(menuTranslations).length);
          
          // 创建应用程序菜单
          createAppMenu();
          
          // 处理最小化到托盘设置
          log(`设置最小化到托盘: ${settings.minimize_to_tray}`);
          handleMinimizeToTray(settings.minimize_to_tray);
        })
        .catch(err => {
          log('Failed to get translations:', err);
          // 出错时使用默认中文菜单
          menuTranslations = {};
          createAppMenu();
          
          // 处理最小化到托盘设置
          handleMinimizeToTray(settings.minimize_to_tray);
        });
    })
    .catch(err => {
      log('Failed to get settings:', err);
      // 出错时不创建托盘图标，改为使用默认设置
      handleMinimizeToTray(false);
    });

  // 设置窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
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
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
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
      
      // 更新托盘菜单
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
          click: () => {
            app.isQuitting = true;
            app.quit();
          }
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
            click: () => {
              app.isQuitting = true;
              app.quit();
            }
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
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
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
  
  // 如果已存在窗口，设置其关闭行为
  if (mainWindow) {
    // 移除所有已有的close事件监听器，避免重复添加
    mainWindow.removeAllListeners('close');
    
    // 添加新的close事件监听器
    mainWindow.on('close', (event) => {
      log(`窗口关闭事件触发，app.isQuitting=${app.isQuitting}, minimize=${minimize}`);
      
      if (!app.isQuitting && minimize) {
        event.preventDefault();
        log('阻止窗口关闭，改为隐藏窗口');
        mainWindow.hide();
        
        // 确保托盘图标存在
        if (!trayIcon) {
          log('托盘图标不存在，尝试创建');
          const iconPath = getTrayIconPath();  // 使用新的托盘图标路径函数
          createTray(iconPath);
        }
        
        return false;
      }
      
      log('允许窗口关闭');
      // 确保退出时清理资源
      app.isQuitting = true;
      
      // 如果存在系统托盘，销毁它
      if (trayIcon) {
        log('销毁托盘图标');
        trayIcon.destroy();
        trayIcon = null;
      }
      
      // 终止Python服务器进程
      if (pyProc) {
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
        
        // 确保托盘图标存在
        if (!trayIcon) {
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

// 监听IPC消息：应用关闭
ipcMain.on('app-closing', () => {
  log('应用关闭中，准备清理资源...');
  app.isQuitting = true;
  
  // 保存当前Python进程PID
  let pythonPid = pyProc ? pyProc.pid : null;
  
  // 立即执行终止脚本
  try {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'kill-python.js');
    
    // 确保脚本文件存在
    if (fs.existsSync(scriptPath)) {
      // 如果有PID，将其作为参数传递
      const args = pythonPid ? [scriptPath, pythonPid.toString()] : [scriptPath];
      
      // 使用独立进程执行脚本，不等待其完成
      const cleanupProcess = spawn('node', args, {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      });
      
      // 让清理进程独立运行，即使主进程退出
      cleanupProcess.unref();
      
      log('已启动进程清理脚本');
    } else {
      log(`清理脚本不存在: ${scriptPath}`);
    }
  } catch (error) {
    log('启动清理脚本失败:', error);
  }
  
  // 防止长时间无法退出
  log('设置强制退出定时器...');
  setTimeout(() => {
    log('强制退出应用');
    process.exit(0); // 直接终止Node进程，比app.exit()更强力
  }, 1500);
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
  
  // 更新设置
  settings = newSettings || settings;
  
  // 检查最小化到托盘设置是否变化
  const minimizeToTrayChanged = oldMinimizeToTray !== settings.minimize_to_tray;
  
  if (minimizeToTrayChanged) {
    log(`最小化到托盘设置改变: ${oldMinimizeToTray} -> ${settings.minimize_to_tray}`);
  }
  
  // 更新最小化到托盘设置
  if (settings.minimize_to_tray) {
    // 启用最小化到托盘
    log('启用最小化到托盘功能');
    
    // 移除现有事件监听器，避免多次绑定
    if (mainWindow) {
      mainWindow.removeAllListeners('minimize');
      
      // 添加新的minimize事件监听器
      mainWindow.on('minimize', (event) => {
        event.preventDefault();
        mainWindow.hide();
        // 确保托盘图标存在
        if (!trayIcon) {
          const trayIconPath = getTrayIconPath();
          createTray(trayIconPath);
        }
      });
    }
    
    // 更新窗口关闭事件处理
    handleMinimizeToTray(true);
  } else {
    // 禁用最小化到托盘
    log('禁用最小化到托盘功能');
    
    // 移除事件监听器
    if (mainWindow) {
      mainWindow.removeAllListeners('minimize');
    }
    
    // 更新窗口关闭事件处理
    handleMinimizeToTray(false);
    
    // 如果托盘图标存在且不需要最小化到托盘，销毁托盘图标
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
  // 立即应用新设置
  handleMinimizeToTray(minimizeToTray);
});

// 确保在应用退出前清理资源
app.on('will-quit', (event) => {
  // 标记应用正在退出
  app.isQuitting = true;
  
  // 确保销毁托盘图标
  if (trayIcon) {
    log('应用退出，销毁托盘图标');
    trayIcon.destroy();
    trayIcon = null;
  }
  
  // 终止Python服务器进程
  if (pyProc) {
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
        // 非Windows平台使用SIGKILL信号
        pyProc.kill('SIGKILL');
      }
    } catch (error) {
      log('终止Python进程失败:', error);
    }
    pyProc = null;
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
    app.isQuitting = true;
    
    // 确保销毁托盘图标
    if (trayIcon) {
      log('所有窗口关闭，销毁托盘图标');
      trayIcon.destroy();
      trayIcon = null;
    }
    
    // 确保关闭Python进程
    if (pyProc) {
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
          // 非Windows平台使用SIGKILL信号
          pyProc.kill('SIGKILL');
        }
      } catch (error) {
        log('终止Python进程失败:', error);
      }
      pyProc = null;
    }
    
    // 延迟退出以确保进程被终止
    setTimeout(() => {
      app.exit(0);
    }, 1000);
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
