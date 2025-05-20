// 导入所需模块
// const ipcRenderer = window.electronAPI.ipcRenderer;

// API基础URL
const API_BASE_URL = 'http://localhost:5000/api';

// 当前语言
let currentLanguage = '中文';

// 翻译对象
let translations = {};

// DOM元素缓存
let DOM = {};

// 文件列表数据
let fileList = [];

// 托盘项数据
let trayItems = [];

// 当前设置
let settings = {};

// 添加一个标记以跟踪是否正在关闭应用
let isClosing = false;

// 当前选中的文件索引
let selectedFileIndices = [];

// 拖拽变量
let draggedItem = null;
let dragStartIndex = -1;

// 输入对话框相关变量
let inputDialogCallback = null;

// 添加一个变量保存上次访问的路径
let lastFilePath = '';

// 添加一个变量来标记是否正在进行语言切换操作
let isChangingLanguage = false;

// 添加一个标记来控制页面刷新
let canRefreshPage = false;

// 当文档加载完成时初始化应用
document.addEventListener('DOMContentLoaded', () => {
  // 缓存常用DOM元素
  cacheDOM();
  
  // 加载设置
  loadSettings();
  
  // 绑定事件处理程序
  bindEvents();
  
  // 统一外链点击事件
  bindExternalLinks();
});

// 在window的load事件中标记页面已完全加载
window.addEventListener('load', () => {
  // 添加loaded类到body
  document.body.classList.add('loaded');
  // 设置加载完成标记
  document.body.setAttribute('data-loaded', 'true');
  console.log('页面完全加载，标记为loaded');
  
  // 延迟设置canRefreshPage标志，确保应用完全初始化
  setTimeout(() => {
    canRefreshPage = true;
    console.log('刷新保护期结束，允许页面刷新');
  }, 2000);
});

// 监听来自主进程的刷新请求
window.electronAPI.ipcOn('refresh-main-window', () => {
  console.log('收到主进程刷新请求，重新加载页面');
  
  // 检查是否是应用程序初始加载阶段
  const isInitialLoad = document.body.getAttribute('data-loaded') !== 'true';
  
  // 如果是初始加载阶段或刷新保护期内，不要刷新，防止循环刷新导致应用关闭
  if (isInitialLoad || !canRefreshPage) {
    console.log('应用程序正在初始加载或处于刷新保护期，跳过页面刷新');
    return;
  }
  
  // 设置标记以避免触发关闭事件
  window.isManualRefresh = true;
  
  // 临时禁用刷新功能，防止短时间内多次刷新
  canRefreshPage = false;
  
  // 使用setTimeout确保其他操作完成后再刷新
  setTimeout(() => {
    console.log('执行页面手动刷新');
    // 重新加载页面
    window.location.reload();
  }, 300);
});

// 监听应用关闭事件
window.addEventListener('beforeunload', (event) => {
  // 如果是手动刷新，跳过关闭逻辑
  if (window.isManualRefresh === true) {
    console.log('页面正在手动刷新，不发送关闭通知');
    return;
  }
  
  if (!isClosing) {
    isClosing = true;
    console.log('发送应用关闭通知到主进程');
    // 通知主进程应用将要关闭
    window.electronAPI.ipcSend('app-closing');
  }
});

// 监听托盘更新事件
window.electronAPI.ipcOn('tray-updated', () => {
  // 刷新托盘项目列表
  fetchTrayItems();
});

// 缓存DOM元素引用
function cacheDOM() {
  DOM = {
    fileList: document.getElementById('file-list'),
    addFileBtn: document.getElementById('add-file-btn'),
    settingsBtn: document.getElementById('settings-btn'),
    contextMenu: document.getElementById('context-menu'),
    settingsDialog: document.getElementById('settings-dialog'),
    languageSelect: document.getElementById('language-select'),
    showExtensionsCheckbox: document.getElementById('show-extensions-checkbox'),
    removeArrowCheckbox: document.getElementById('remove-arrow-checkbox'),
    minimizeToTrayCheckbox: document.getElementById('minimize-to-tray-checkbox'),
    settingsSaveBtn: document.getElementById('settings-save-btn'),
    settingsCancelBtn: document.getElementById('settings-cancel-btn'),
    resetAllBtn: document.getElementById('reset-all-btn'),
    versionLabel: document.getElementById('version-label'),
    versionValue: document.getElementById('version-value'),
    loadingOverlay: document.getElementById('loading-overlay'),
    // 添加文件对话框元素
    addFileDialog: document.getElementById('add-file-dialog'),
    selectFileBtn: document.getElementById('select-file-btn'),
    selectFolderBtn: document.getElementById('select-folder-btn'),
    addFileCancelBtn: document.getElementById('add-file-cancel-btn'),
    configPath: document.getElementById('config-path'),
    // 添加文件列表容器引用
    fileListContainer: document.querySelector('.file-list-container'),
    // 添加自定义输入对话框元素
    inputDialog: document.getElementById('input-dialog'),
    inputDialogTitle: document.getElementById('input-dialog-title'),
    inputDialogField: document.getElementById('input-dialog-field'),
    inputDialogConfirm: document.getElementById('input-dialog-confirm'),
    inputDialogCancel: document.getElementById('input-dialog-cancel'),
    // 设置选项卡
    settingsTabs: document.querySelectorAll('.tab-button'),
    settingsTabContents: document.querySelectorAll('.tab-content'),
    checkUpdateBtn: document.getElementById('check-update-btn'),
    versionText: document.getElementById('version-text'),
  };
}

// 绑定事件处理程序
function bindEvents() {
  // 添加文件按钮点击事件
  DOM.addFileBtn.addEventListener('click', openAddFileDialog);
  
  // 添加文件对话框中的按钮事件
  DOM.selectFileBtn.addEventListener('click', () => selectAndAddFiles(false));
  DOM.selectFolderBtn.addEventListener('click', () => selectAndAddFiles(true));
  DOM.addFileCancelBtn.addEventListener('click', closeAddFileDialog);
  
  // 设置按钮点击事件
  DOM.settingsBtn.addEventListener('click', openSettingsDialog);
  
  // 设置对话框保存按钮点击事件
  DOM.settingsSaveBtn.addEventListener('click', saveSettings);
  
  // 设置对话框取消按钮点击事件
  DOM.settingsCancelBtn.addEventListener('click', closeSettingsDialog);
  
  // 设置对话框重置按钮点击事件
  if (DOM.resetAllBtn) {
    DOM.resetAllBtn.addEventListener('click', resetAll);
  }
  
  // 自定义输入对话框按钮事件
  DOM.inputDialogConfirm.addEventListener('click', confirmInputDialog);
  DOM.inputDialogCancel.addEventListener('click', closeInputDialog);
  
  // 拖放事件处理
  document.addEventListener('dragover', event => {
    event.preventDefault();
    event.stopPropagation();
    
    // 添加拖放样式
    const fileListContainer = DOM.fileList.parentNode;
    fileListContainer.classList.add('drag-over');
  });
  
  document.addEventListener('dragleave', event => {
    event.preventDefault();
    event.stopPropagation();
    
    // 移除拖放样式
    const fileListContainer = DOM.fileList.parentNode;
    fileListContainer.classList.remove('drag-over');
  });
  
  document.addEventListener('drop', event => {
    // 移除拖放样式
    const fileListContainer = DOM.fileList.parentNode;
    fileListContainer.classList.remove('drag-over');
    
    // 处理文件拖放
    handleFileDrop(event);
  });
  
  // 文件列表点击事件
  DOM.fileList.addEventListener('click', handleFileListClick);
  
  // 文件列表双击事件
  DOM.fileList.addEventListener('dblclick', handleFileListDblClick);
  
  // 添加文件项点击波纹效果
  DOM.fileList.addEventListener('mousedown', createRippleEffect);
  
  // 文件列表右键菜单事件
  DOM.fileList.addEventListener('contextmenu', handleContextMenu);
  
  // 全局点击事件，用于关闭右键菜单
  document.addEventListener('click', () => {
    DOM.contextMenu.style.display = 'none';
  });
  
  // 添加文件列表容器的点击事件，用于处理空白区域点击
  DOM.fileListContainer.addEventListener('click', handleContainerClick);
  
  // 按键事件
  document.addEventListener('keydown', handleKeyDown);
  
  // 监听来自主进程的菜单事件
  window.electronAPI.ipcOn('menu-add-file', openAddFileDialog);
  window.electronAPI.ipcOn('menu-delete', handleDeleteSelected);
  window.electronAPI.ipcOn('menu-refresh', loadFileList);
  window.electronAPI.ipcOn('menu-settings', openSettingsDialog);
  
  // 添加项目地址链接点击事件，确保在默认浏览器中打开
  const projectLink = document.querySelector('.version-info a');
  if (projectLink) {
    projectLink.addEventListener('click', (event) => {
      event.preventDefault();
      // 使用IPC调用打开外部链接
      window.electronAPI.ipcInvoke('open-external-link', projectLink.href)
        .catch(err => {
          console.error('Failed to open external link:', err);
          // 如果IPC调用失败，回退到默认行为
          window.open(projectLink.href, '_blank');
        });
    });
  }

  // 重置应用
  DOM.resetAllBtn.addEventListener('click', resetAll);

  // 设置标签切换
  DOM.settingsTabs.forEach(tab => {
    tab.addEventListener('click', handleSettingsTabClick);
  });
  
  // 初始化键盘事件监听
  document.addEventListener('keydown', handleKeyDown);
  
  // 文件列表容器的点击事件，用于处理在空白处点击取消选择
  DOM.fileList.parentElement.addEventListener('click', handleContainerClick);

  // 初始化检查更新按钮
  initCheckUpdateButton();
}

// 加载设置
function loadSettings() {
  showLoading();
  
  // 获取设置
  axios.get(`${API_BASE_URL}/settings`)
    .then(response => {
      settings = response.data.data;
      currentLanguage = settings.language || '中文';
      
      // 加载语言
      loadLanguages();
      
      // 加载文件列表
      loadFileList();
      
      // 加载应用版本
      loadVersion();
      
      // 获取配置文件路径
      getConfigPath();
    })
    .catch(error => {
      console.error('Failed to load settings:', error);
      hideLoading();
      showMessage('load_settings_failed', 'error');
    });
}

// 获取配置文件路径
function getConfigPath() {
  axios.get(`${API_BASE_URL}/config-path`)
    .then(response => {
      if (response.data.success && response.data.data) {
        const configPathElem = DOM.configPath;
        if (configPathElem) {
          configPathElem.textContent = response.data.data;
          
          // 添加点击事件，使其可以在文件管理器中打开
          configPathElem.style.cursor = 'pointer';
          configPathElem.title = translations['click_to_open'] || '点击打开配置文件所在目录';
          configPathElem.classList.add('clickable-path');
          
          // 移除旧的事件监听器（如果存在）
          configPathElem.removeEventListener('click', openConfigLocation);
          
          // 添加新的事件监听器
          configPathElem.addEventListener('click', openConfigLocation);
        }
      }
    })
    .catch(error => {
      console.error('Failed to get config path:', error);
      showMessage('open_config_location_failed', 'error');
    });
}

// 打开配置文件所在位置
function openConfigLocation() {
  const configPath = DOM.configPath.textContent;
  if (!configPath) return;
  
  // 发送请求到后端打开文件位置
  axios.post(`${API_BASE_URL}/system/file-location`, {
    path: configPath
  })
    .then(response => {
      if (!response.data.success) {
        showMessage(response.data.message || '无法打开配置文件位置', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to open config location:', error);
      showMessage('open_config_location_failed', 'error');
    });
}

// 加载语言列表
function loadLanguages() {
  axios.get(`${API_BASE_URL}/languages`)
    .then(response => {
      const languages = response.data.data;
      
      // 清空语言选择器
      DOM.languageSelect.innerHTML = '';
      
      // 添加语言选项
      languages.forEach(language => {
        const option = document.createElement('option');
        option.value = language;
        option.textContent = language;
        
        if (language === currentLanguage) {
          option.selected = true;
        }
        
        DOM.languageSelect.appendChild(option);
      });
      
      // 加载当前语言的翻译
      loadTranslations(currentLanguage);
    })
    .catch(error => {
      console.error('Failed to load languages:', error);
      hideLoading();
      showMessage('load_languages_failed', 'error');
    });
}

// 加载翻译
function loadTranslations(language) {
  // 如果已经在更改语言，则跳过
  if (isChangingLanguage) {
    console.log('语言切换操作正在进行中，跳过重复请求');
    return;
  }
  
  // 设置标志指示正在切换语言
  isChangingLanguage = true;
  
  axios.get(`${API_BASE_URL}/translations/${encodeURIComponent(language)}`)
    .then(response => {
      translations = response.data.data;
      
      // 更新界面文本
      updateUIText(translations);
      
      // 立即通知主进程更新托盘菜单翻译
      window.electronAPI.ipcSend('language-changed', language);
      
      // 延迟重置标志，确保所有操作完成后才允许下一次语言切换
      setTimeout(() => {
        isChangingLanguage = false;
      }, 1000);
    })
    .catch(error => {
      console.error(`Failed to load translations for ${language}:`, error);
      showMessage(`无法加载 ${language} 翻译`, 'error');
      
      // 错误时也需要重置标志
      isChangingLanguage = false;
    });
}

// 更新界面文本
function updateUIText(translations) {
  // 辅助函数：翻译文本
  const t = key => translations[key] || key;
  
  // 更新页面标题
  document.title = t('title');
  
  // 更新按钮文本
  if (DOM.addFileBtn) DOM.addFileBtn.textContent = t('add_file');
  if (DOM.addFileBtn) DOM.addFileBtn.title = `${t('open_multiple_files')}
${t('support_drag_drop')}`;
  if (DOM.settingsBtn) DOM.settingsBtn.textContent = t('settings');
  if (DOM.settingsSaveBtn) DOM.settingsSaveBtn.textContent = t('confirm');
  if (DOM.settingsCancelBtn) DOM.settingsCancelBtn.textContent = t('cancel');
  if (DOM.addFileCancelBtn) DOM.addFileCancelBtn.textContent = t('cancel');
  
  // 更新对话框文本
  const addFileTitle = document.querySelector('#add-file-title');
  if (addFileTitle) addFileTitle.textContent = t('select_file_or_folder') || '选择操作';
  const selectFileBtnText = document.querySelector('#select-file-btn .file-type-text');
  if (selectFileBtnText) selectFileBtnText.textContent = t('select_file') || '添加文件';
  const selectFolderBtnText = document.querySelector('#select-folder-btn .file-type-text');
  if (selectFolderBtnText) selectFolderBtnText.textContent = t('select_folder') || '添加文件夹';
  
  // 更新设置对话框文本
  const settingsTitle = document.querySelector('#settings-title');
  if (settingsTitle) settingsTitle.textContent = t('settings');
  
  // 更新设置选项卡按钮
  const generalTabBtn = document.getElementById('general-tab-btn');
  if (generalTabBtn) generalTabBtn.textContent = t('general');
  const appearanceTabBtn = document.getElementById('appearance-tab-btn');
  if (appearanceTabBtn) appearanceTabBtn.textContent = t('appearance');
  const aboutTabBtn = document.getElementById('about-tab-btn');
  if (aboutTabBtn) aboutTabBtn.textContent = t('about');
  
  // 更新常规设置选项
  const languageLabel = document.getElementById('language-label');
  if (languageLabel) languageLabel.textContent = t('language');
  const showExtensionsLabel = document.getElementById('show-extensions-label');
  if (showExtensionsLabel) showExtensionsLabel.textContent = t('show_extensions');
  const removeArrowLabel = document.getElementById('remove-arrow-label');
  if (removeArrowLabel) removeArrowLabel.textContent = t('quick_icon_arrow');
  const minimizeToTrayLabel = document.getElementById('minimize-to-tray-label');
  if (minimizeToTrayLabel) minimizeToTrayLabel.textContent = t('minimize_to_tray');
  const configPathLabel = document.getElementById('config-path-label');
  if (configPathLabel) configPathLabel.textContent = t('config_path') || '配置文件位置';
  
  // 重置按钮
  const resetBtn = document.querySelector('#reset-all-btn');
  if (resetBtn) {
    resetBtn.textContent = t('reset_all');
  }
  
  // 更新关于选项卡
  const versionLabel = document.getElementById('version-label');
  if (versionLabel) versionLabel.textContent = t('version').replace('{version}', '') || '版本号';
  const developerLabel = document.getElementById('developer-label');
  if (developerLabel) developerLabel.textContent = t('developer') || '开发者';
  const projectAddressLabel = document.getElementById('project-address-label');
  if (projectAddressLabel) projectAddressLabel.textContent = t('project_address');
  
  // 更新GitHub链接文本
  const githubLink = document.querySelector('.project-link');
  if (githubLink) {
    githubLink.textContent = t('github_repo') || 'GitHub仓库';
  }
  
  // 更新拖放提示
  const dropHint1 = document.getElementById('drop-hint-1');
  if (dropHint1) dropHint1.textContent = t('drop_files_here') || '将文件或文件夹拖放到此处';
  const dropHint2 = document.getElementById('drop-hint-2');
  if (dropHint2) dropHint2.textContent = t('support_batch_add') || '支持批量添加';
  
  // 更新样式设置选项卡
  const comingSoonTitle = document.getElementById('coming-soon-title');
  if (comingSoonTitle) comingSoonTitle.textContent = t('coming_soon') || '即将推出';
  const comingSoonDesc = document.getElementById('coming-soon-desc');
  if (comingSoonDesc) comingSoonDesc.textContent = t('style_coming_soon') || '样式设置功能正在开发中，敬请期待！';
  
  // 输入对话框按钮
  const inputDialogConfirm = document.getElementById('input-dialog-confirm');
  if (inputDialogConfirm) inputDialogConfirm.textContent = t('confirm');
  const inputDialogCancel = document.getElementById('input-dialog-cancel');
  if (inputDialogCancel) inputDialogCancel.textContent = t('cancel');
  
  // 更新版权信息
  const copyrightText = document.getElementById('copyright-text');
  if (copyrightText) {
    const year = new Date().getFullYear();
    const copyrightTemplate = t('copyright_text') || '版权所有 (c) {year} AstraSolis';
    const rightsText = t('all_rights_reserved') || '保留所有权利';
    copyrightText.textContent = `${copyrightTemplate.replace('{year}', year)}. ${rightsText}.`;
  }
}

// 获取文件列表
function fetchFiles() {
  showLoading();
  
  // 记住当前选中的文件路径，用于恢复选中状态
  const selectedPaths = selectedFileIndices.map(idx => fileList[idx]?.path).filter(Boolean);
  
  // 清除当前列表
  fileList = [];
  
  // 获取文件列表
  axios.get(`${API_BASE_URL}/files/with-icons`)
    .then(response => {
      if (response.data.success) {
        // 更新文件列表
        fileList = response.data.data || [];
        
        // 更新UI
        updateFileListUI();
        
        // 如果文件列表不为空，显示拖拽排序提示
        if (fileList.length > 1) {
          showDragSortTip();
        }
        
        // 恢复选中状态
        if (selectedPaths.length > 0) {
          // 根据路径找到新的索引
          selectedFileIndices = [];
          fileList.forEach((file, idx) => {
            if (selectedPaths.includes(file.path)) {
              selectedFileIndices.push(idx);
              const item = DOM.fileList.querySelector(`.file-item[data-index="${idx}"]`);
              if (item) {
                if (selectedFileIndices.length === 1) {
                  item.classList.add('selected');
                } else {
                  item.classList.add('multi-selected');
                }
              }
            }
          });
        }
        
        // 隐藏加载中
        hideLoading();
      } else {
        console.error('获取文件列表失败:', response.data.message);
        showMessage('fetch_files_failed', 'error');
        hideLoading();
      }
    })
    .catch(error => {
      console.error('请求文件列表时出错:', error);
      
      // 回退使用普通文件列表API
      axios.get(`${API_BASE_URL}/files`)
        .then(fallbackResponse => {
          if (fallbackResponse.data.success) {
            fileList = fallbackResponse.data.data || [];
            updateFileListUI();
            
            // 如果文件列表不为空，显示拖拽排序提示
            if (fileList.length > 1) {
              showDragSortTip();
            }
            
            // 恢复选中状态
            if (selectedPaths.length > 0) {
              selectedFileIndices = [];
              fileList.forEach((file, idx) => {
                if (selectedPaths.includes(file.path)) {
                  selectedFileIndices.push(idx);
                  const item = DOM.fileList.querySelector(`.file-item[data-index="${idx}"]`);
                  if (item) {
                    if (selectedFileIndices.length === 1) {
                      item.classList.add('selected');
                    } else {
                      item.classList.add('multi-selected');
                    }
                  }
                }
              });
            }
          } else {
            showMessage('获取文件列表失败', 'error');
          }
          hideLoading();
        })
        .catch(fallbackError => {
          console.error('回退API请求失败:', fallbackError);
          showMessage('fetch_files_failed', 'error');
          hideLoading();
        });
    });
}

// 别名函数，保持兼容性
const loadFileList = fetchFiles;

// 加载托盘项
function loadTrayItems() {
  console.log('直接加载托盘项...');
  
  axios.get(`${API_BASE_URL}/tray`)
    .then(response => {
      trayItems = response.data.data;
      console.log(`获取到${trayItems.length}个托盘项`);
      
      // 立即更新UI显示托盘标签
      updateFileListUI();
    })
    .catch(error => {
      console.error('Failed to load tray items:', error);
      // 即使失败也要更新UI,确保界面可用
      updateFileListUI();
    });
}

// 获取托盘项目列表
function fetchTrayItems() {
  axios.get(`${API_BASE_URL}/tray`)
    .then(response => {
      trayItems = response.data.data;
      // 更新文件列表UI以反映托盘状态
      updateFileListUI();
    })
    .catch(error => {
      console.error('Failed to fetch tray items:', error);
      // 即使失败也要更新UI,确保界面可用
      updateFileListUI();
    });
}

// 加载应用版本
function loadVersion() {
  axios.get(`${API_BASE_URL}/version`)
    .then(response => {
      const versionInfo = response.data.data;
      let versionText = `v${versionInfo.version} (${versionInfo.build_type})`;
      if (versionInfo.git_info && versionInfo.full_version) {
        const isDevVersion = versionInfo.full_version !== `v${versionInfo.version}`;
        if (isDevVersion && DOM.versionValue) {
          DOM.versionValue.setAttribute('title',
            `${translations.full_version || '完整版本'}: ${versionInfo.full_version}\n` +
            `${translations.last_update || '最后更新'}: ${new Date(versionInfo.timestamp).toLocaleString()}`
          );
          versionText += ' 🚧';
        }
      }
      if (DOM.versionLabel) DOM.versionLabel.textContent = translations.version?.replace('{version}', '') || '版本号';
      if (DOM.versionValue) DOM.versionValue.textContent = versionText;
    })
    .catch(error => {
      console.error('Failed to load version:', error);
      if (DOM.versionValue) DOM.versionValue.textContent = 'v1.0.0';
    });
}

// 更新文件列表UI
function updateFileListUI() {
  // 清空文件列表
  if (DOM.fileList) DOM.fileList.innerHTML = '';
  // 更新文件列表容器的空状态类
  const fileListContainer = DOM.fileList ? DOM.fileList.parentNode : null;
  if (fileListContainer && typeof fileListContainer.classList?.toggle === 'function') {
    fileListContainer.classList.toggle('empty', fileList.length === 0);
  }
  // 创建文件项
  fileList.forEach((file, index) => {
    // 创建主容器
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.index = index;
    // 设置选中状态
    if (selectedFileIndices.includes(index)) {
      if (selectedFileIndices.length === 1 && selectedFileIndices[0] === index) {
        fileItem.classList.add('selected');
      } else {
        fileItem.classList.add('multi-selected');
      }
    }
    // 添加拖拽相关属性
    fileItem.setAttribute('draggable', 'true');
    fileItem.addEventListener('dragstart', handleDragStart);
    fileItem.addEventListener('dragover', handleDragOver);
    fileItem.addEventListener('dragenter', handleDragEnter);
    fileItem.addEventListener('dragleave', handleDragLeave);
    fileItem.addEventListener('drop', handleDrop);
    fileItem.addEventListener('dragend', handleDragEnd);
    // 创建图标 - 确保垂直居中
    const fileIcon = document.createElement('div');
    fileIcon.className = 'file-icon';
    // 设置图标 - 检查是否是文件夹或路径名称包含文件夹标志
    const isFolder = file.is_dir === true || 
                   (typeof file.path === 'string' && 
                    (file.path.endsWith('\\') || file.path.endsWith('/')));
    
    // 将当前文件的详细信息记录到控制台，方便调试
    console.log(`文件项${index}: `, {
      path: file.path,
      filename: file.filename || file.name,
      is_dir: file.is_dir,
      isFolder: isFolder
    });
    
    if (isFolder) {
      // 不再使用固定的文件夹图标样式，而是获取系统图标
      if (file.icon) {
        // 如果后端已经提供了图标数据，直接使用
        fileIcon.style.backgroundImage = `url('${file.icon}')`;
      } else {
        // 尝试通过API获取文件夹图标
        getFileIcon(file.path).then(iconPath => {
          if (iconPath) {
            fileIcon.style.backgroundImage = `url('${iconPath}')`;
          } else {
            // 如果获取失败，使用默认文件夹图标作为备选
            fileIcon.innerHTML = '📁';
            fileIcon.style.display = 'flex';
            fileIcon.style.justifyContent = 'center';
            fileIcon.style.alignItems = 'center';
            fileIcon.style.fontSize = '18px';
            fileIcon.style.backgroundColor = 'transparent';
            fileIcon.style.color = '#007acc'; // 蓝色
          }
        }).catch(err => {
          console.error('获取文件夹图标失败:', err);
          // 获取失败时使用默认图标
          fileIcon.innerHTML = '📁';
          fileIcon.style.display = 'flex';
          fileIcon.style.justifyContent = 'center';
          fileIcon.style.alignItems = 'center';
          fileIcon.style.fontSize = '18px';
          fileIcon.style.backgroundColor = 'transparent';
          fileIcon.style.color = '#007acc'; // 蓝色
        });
      }
    } else if (file.icon) {
      // 设置图标URL
      fileIcon.style.backgroundImage = `url('${file.icon}')`;
    } else {
      getFileIcon(file.path).then(iconPath => {
        if (iconPath) {
          fileIcon.style.backgroundImage = `url('${iconPath}')`;
        } else {
          fileIcon.style.backgroundColor = '#f0f0f0';
          fileIcon.innerHTML = '<span style="font-size: 18px; line-height: 24px;">?</span>';
          fileIcon.style.display = 'flex';
          fileIcon.style.justifyContent = 'center';
          fileIcon.style.alignItems = 'center';
        }
      }).catch(err => {
        console.error('获取图标失败:', err);
        fileIcon.style.backgroundColor = '#f0f0f0';
        fileIcon.innerHTML = '<span style="font-size: 18px; line-height: 24px;">!</span>';
        fileIcon.style.display = 'flex';
        fileIcon.style.justifyContent = 'center';
        fileIcon.style.alignItems = 'center';
      });
    }
    
    // 处理文件名 - 优先使用filename字段，如果不存在则使用name字段
    let displayName = file.filename || file.name || window.electronAPI.path.basename(file.path);
    
    if (!settings.show_extensions) {
      const dotIndex = displayName.lastIndexOf('.');
      if (dotIndex > 0) {
        displayName = displayName.substring(0, dotIndex);
      }
    }
    if (file.remark) {
      displayName = `${file.remark} (${displayName})`;
    }
    
    // 创建文件名元素 - 确保垂直居中
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = displayName;
    name.style.lineHeight = '24px';
    
    // 创建标签容器 - 确保垂直居中
    const tags = document.createElement('div');
    tags.className = 'file-tags';
    
    // 添加标签 - 显示在文件名后面
    // 检查是否在托盘中 - 使用文件自身的in_tray属性
    const isInTray = file.in_tray === true;
    
    // 添加标签
    if (file.admin) {
      const adminTag = document.createElement('span');
      adminTag.className = 'tag admin-tag';
      adminTag.textContent = translations['admin_tag'] || '[管理员]';
      tags.appendChild(adminTag);
    }
    
    if (file.params) {
      const paramsTag = document.createElement('span');
      paramsTag.className = 'tag params-tag';
      paramsTag.textContent = (translations['params_tag'] || '[参数: {params}]').replace('{params}', file.params);
      tags.appendChild(paramsTag);
    }
    
    if (isInTray) {
      const trayTag = document.createElement('span');
      trayTag.className = 'tag tray-tag';
      trayTag.textContent = translations['tray_tag'] || '[系统托盘]';
      tags.appendChild(trayTag);
    }
    
    // 组装文件项 - 确保子元素严格对齐
    fileItem.appendChild(fileIcon);
    fileItem.appendChild(name);
    fileItem.appendChild(tags);
    
    // 添加到文件列表
    if (DOM.fileList) DOM.fileList.appendChild(fileItem);
  });
}

// 获取文件图标
async function getFileIcon(filePath) {
  try {
    // 如果没有文件路径，返回null
    if (!filePath) {
      return null;
    }
    
    // 通过IPC请求主进程获取图标
    const iconBase64 = await window.electronAPI.ipcInvoke('get-file-icon', filePath);
    if (iconBase64) {
      return `data:image/png;base64,${iconBase64}`;
    }
    
    // 如果主进程无法获取图标，尝试通过API获取
    try {
      const response = await axios.get(`${API_BASE_URL}/file/icon`, {
        params: { path: filePath },
        responseType: 'json'
      });
      
      // 如果服务器返回了图标，使用返回的Base64数据
      if (response.data && response.data.success && response.data.data) {
        return `data:image/png;base64,${response.data.data}`;
      }
    } catch (err) {
      console.error('API获取图标失败:', err);
    }
    
    // 如果没有图标数据，返回null
    console.error(`无法获取图标: ${filePath}`);
    return null;
  } catch (error) {
    console.error('获取文件图标失败:', error);
    return null;
  }
}

// 打开添加文件对话框
function openAddFileDialog() {
  // 改用显示类而不是直接设置style.display，以便应用CSS过渡效果
  DOM.addFileDialog.classList.add('show');
}

// 关闭添加文件对话框
function closeAddFileDialog() {
  // 移除显示类
  DOM.addFileDialog.classList.remove('show');
}

// 选择并添加文件或文件夹
async function selectAndAddFiles(folderOnly = false) {
  try {
    // 关闭选择对话框
    closeAddFileDialog();
    
    // 创建文件过滤器 - 只使用"所有文件"一个选项
    const filters = [
      { name: translations['all_files'] || '所有文件 (*.*)', extensions: ['*'] }
    ];
    
    // 准备对话框属性
    const properties = [];
    if (folderOnly) {
      // 仅选择文件夹
      properties.push('openDirectory');
    } else {
      // 选择文件
      properties.push('openFile', 'multiSelections');
    }
    
    // 使用Electron的文件选择对话框
    const title = folderOnly 
      ? (translations['select_folder'] || '选择文件夹')
      : (translations['select_file'] || '选择文件');
    
    // 从本地存储中获取上次的路径
    let defaultPath = localStorage.getItem(folderOnly ? 'lastFolderPath' : 'lastFilePath') || '';
    
    // 控制台输出筛选器以便调试
    console.log('文件筛选器:', JSON.stringify(filters));
    console.log('默认路径:', defaultPath);
    
    // 使用修改后的参数调用文件对话框
    const filePaths = await window.electronAPI.ipcInvoke('open-file-dialog', {
      title: title,
      filters: folderOnly ? [] : filters,
      properties: properties,
      defaultPath: defaultPath
    });
    
    if (filePaths && filePaths.length > 0) {
      // 保存最后使用的路径
      // 获取第一个选择的文件的目录
      const directoryPath = path.dirname(filePaths[0]);
      localStorage.setItem(folderOnly ? 'lastFolderPath' : 'lastFilePath', directoryPath);
      console.log('保存的路径:', directoryPath);
      
      showLoading();
      
      // 发送到后端添加文件
      const response = await axios.post(`${API_BASE_URL}/files`, {
        paths: filePaths
      });
      
      if (response.data.success) {
        // 重新加载文件列表
        loadFileList();
        showMessage(response.data.message, 'success');
      } else {
        hideLoading();
        showMessage(response.data.message || '添加文件失败', 'error');
      }
    }
  } catch (error) {
    console.error('Failed to add file:', error);
    hideLoading();
    showMessage('add_file_failed', 'error');
  }
}

// 处理文件拖放
function handleFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  
  // 检查是否是从文件系统拖拽的文件
  if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
    // 获取文件路径
    const files = Array.from(event.dataTransfer.files);
    const filePaths = files.map(file => file.path);
    
    if (filePaths.length > 0) {
      showLoading();
      
      // 发送到后端添加文件
      axios.post(`${API_BASE_URL}/files`, {
        paths: filePaths
      })
        .then(response => {
          if (response.data.success) {
            // 重新加载文件列表
            loadFileList();
            showMessage(response.data.message, 'success');
          } else {
            hideLoading();
            showMessage(response.data.message || '添加文件失败', 'error');
          }
        })
        .catch(error => {
          console.error('Failed to add dropped files:', error);
          hideLoading();
          showMessage('add_file_failed', 'error');
        });
    }
  }
}

// 处理删除选中项
function handleDeleteSelected() {
  // 获取选中的项目
  const selectedItems = DOM.fileList.querySelectorAll('.file-item.selected, .file-item.multi-selected');
  
  if (selectedItems.length === 0) {
    showMessage(translations['selected_files_none'] || '未选择任何文件', 'warning');
    return;
  }
  
  // 确认删除
  let confirmTitle = translations['delete_confirm_title'] || '确认删除';
  let confirmMessage = translations['delete_confirm_message'] || '确定要删除选中的项目吗?';
  
  // 如果是多选，显示更详细的提示
  if (selectedItems.length > 1) {
    confirmMessage = (translations['confirm_delete_multiple'] || '确定要删除选中的 {count} 个文件吗?').replace('{count}', selectedItems.length);
  }
  
  // 使用自定义确认对话框
  showCustomConfirmDialog(confirmTitle, confirmMessage, () => {
    // 收集要删除的文件路径而非索引
    const filePaths = [];
    selectedFileIndices.forEach(index => {
      if (index < fileList.length) {
        filePaths.push(fileList[index].path);
      }
    });
    
    if (filePaths.length === 0) {
      showMessage('no_valid_file_path', 'error');
      return;
    }
    
    // 显示加载中
    showLoading();
    
    // 创建一个函数删除所有文件
    axios.post(`${API_BASE_URL}/files/delete-multiple`, {
      paths: filePaths
    })
      .then(response => {
        if (response.data.success) {
          // 文件已删除，刷新列表
          loadFileList();
          hideLoading();
          
          // 显示成功消息
          let successMessage = translations['deleted_successfully'] || '文件已成功删除';
          if (filePaths.length > 1) {
            successMessage = (translations['deleted_multiple_successfully'] || '已成功删除 {count} 个文件').replace('{count}', filePaths.length);
          }
          
          showMessage(successMessage, 'success');
        } else {
          hideLoading();
          showMessage(response.data.message || 'delete_file_failed', 'error');
        }
      })
      .catch(error => {
        console.error('Failed to delete files:', error);
        hideLoading();
        
        // 如果API不存在，尝试逐个删除（兼容旧版API）
        if (error.response && error.response.status === 404) {
          // 回退到逐个删除
          deleteOneByOne(filePaths);
        } else {
          showMessage('delete_file_failed', 'error');
        }
      });
  });
}

// 逐个删除文件（兼容旧版API）
function deleteOneByOne(filePaths) {
  showLoading();
  
  // 找出第一个文件的索引
  let index = -1;
  for (let i = 0; i < fileList.length; i++) {
    if (fileList[i].path === filePaths[0]) {
      index = i;
      break;
    }
  }
  
  if (index === -1) {
    hideLoading();
    showMessage('file_index_not_found', 'error');
    return;
  }
  
  // 删除当前索引对应的文件
  axios.delete(`${API_BASE_URL}/files/${index}`)
    .then(response => {
      if (response.data.success) {
        // 如果有更多文件要删除
        if (filePaths.length > 1) {
          // 删除第一个文件路径
          filePaths.shift();
          
          // 重新加载文件列表，然后继续删除
          axios.get(`${API_BASE_URL}/files`)
            .then(response => {
              fileList = response.data.data;
              // 递归删除剩余文件
              deleteOneByOne(filePaths);
            })
            .catch(error => {
              console.error('Failed to reload file list:', error);
              hideLoading();
              showMessage('reload_file_list_failed', 'error');
            });
        } else {
          // 已删除所有文件，刷新列表
          loadFileList();
          hideLoading();
          showMessage(translations['deleted_successfully'] || '文件已成功删除', 'success');
        }
      } else {
        hideLoading();
        showMessage(response.data.message || 'delete_file_failed', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to delete file:', error);
      hideLoading();
      showMessage('delete_file_failed', 'error');
    });
}

// 切换文件选择状态
function toggleFileSelection(index) {
  const idx = selectedFileIndices.indexOf(index);
  if (idx === -1) {
    // 添加到选中列表
    selectedFileIndices.push(index);
    
    // 添加多选样式
    const item = DOM.fileList.querySelector(`.file-item[data-index="${index}"]`);
    if (item) {
      item.classList.add('multi-selected');
      item.classList.remove('selected');
    }
  } else {
    // 从选中列表移除
    selectedFileIndices.splice(idx, 1);
    
    // 移除多选样式
    const item = DOM.fileList.querySelector(`.file-item[data-index="${index}"]`);
    if (item) {
      item.classList.remove('multi-selected');
    }
  }
}

// 处理文件列表点击
function handleFileListClick(event) {
  // 关闭右键菜单
  DOM.contextMenu.style.display = 'none';
  
  // 获取点击的列表项
  const fileItem = event.target.closest('.file-item');
  if (!fileItem) {
    return;
  }
  
  // 获取文件索引
  const index = parseInt(fileItem.dataset.index);
  
  // Ctrl键多选
  if (event.ctrlKey) {
    toggleFileSelection(index);
    return;
  }
  
  // Shift键连续多选
  if (event.shiftKey && selectedFileIndices.length > 0) {
    // 获取最后选择的文件索引
    const lastSelectedIndex = selectedFileIndices[selectedFileIndices.length - 1];
    
    // 计算选择范围
    const start = Math.min(lastSelectedIndex, index);
    const end = Math.max(lastSelectedIndex, index);
    
    // 添加范围内的所有文件到选择
    for (let i = start; i <= end; i++) {
      if (!selectedFileIndices.includes(i)) {
        selectedFileIndices.push(i);
        const item = DOM.fileList.querySelector(`.file-item[data-index="${i}"]`);
        if (item) {
          item.classList.add('multi-selected');
          item.classList.remove('selected');
        }
      }
    }
    return;
  }
  
  // 单击选择
  if (!selectedFileIndices.includes(index)) {
    // 如果不是已选中项，清除之前的选择，只选择当前项
    selectedFileIndices = [index];
    DOM.fileList.querySelectorAll('.file-item').forEach(item => {
      item.classList.remove('selected', 'multi-selected');
    });
    fileItem.classList.add('selected');
  }
}

// 处理文件列表双击
function handleFileListDblClick(event) {
  // 获取双击的列表项
  const fileItem = event.target.closest('.file-item');
  if (!fileItem) {
    return;
  }
  
  // 获取文件索引
  const index = parseInt(fileItem.dataset.index);
  
  // 打开文件
  openFile(index);
}

// 打开文件
function openFile(index) {
  const file = fileList[index];
  if (!file) {
    showMessage('file_info_not_found', 'error');
    return;
  }

  console.log(`尝试打开文件: ${file.path}, 索引: ${index}`);
  
  // 检查文件是否存在
  // 注意：这里只是显示一个提示，真正的检查会在后端进行
  if (!file.path) {
    showMessage('invalid_file_path', 'error');
    return;
  }
  
  // 显示加载中提示
  showMessage(translations['opening_file'] || '正在打开文件...', 'info', 1000);
  
  // 调用后端API打开文件
  axios.post(`${API_BASE_URL}/files/open/${index}`)
    .then(response => {
      console.log('打开文件响应:', response.data);
      if (response.data.success) {
        // 成功打开文件，可以不显示提示或显示成功提示
        // showMessage('file_opened', 'success');
      } else {
        // 显示后端返回的错误消息
        showMessage(response.data.message || translations['cannot_open_file'] || '无法打开文件', 'error');
        console.error('打开文件失败:', response.data.message);
      }
    })
    .catch(error => {
      console.error('打开文件请求失败:', error);
      
      if (error.response) {
        // 服务器返回了错误状态码
        showMessage(`${translations['server_error'] || '服务器错误'}: ${error.response.status} - ${error.response.data.message || translations['cannot_open_file'] || '无法打开文件'}`, 'error');
      } else if (error.request) {
        // 请求发送了但没有收到响应
        showMessage(translations['server_no_response'] || '服务器没有响应，请检查后端服务是否运行', 'error');
      } else {
        // 请求发送前出错
        showMessage(`${translations['request_error'] || '请求错误'}: ${error.message}`, 'error');
      }
    });
}

// 处理右键菜单
function handleContextMenu(event) {
  event.preventDefault();
  
  // 获取右键点击的列表项
  const fileItem = event.target.closest('.file-item');
  if (!fileItem) {
    return;
  }
  
  // 获取文件索引
  const index = parseInt(fileItem.dataset.index);
  const file = fileList[index];
  
  // 检查是否处于多选状态
  const isMultiSelect = selectedFileIndices.length > 1;
  
  // 如果点击的不是已选中项，且按住了Ctrl键，添加到选中状态
  if (!selectedFileIndices.includes(index)) {
    if (event.ctrlKey) {
      // 添加到选中状态
      selectedFileIndices.push(index);
      fileItem.classList.add('multi-selected');
    } else {
      // 清除之前的选择
      DOM.fileList.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected', 'multi-selected');
      });
      // 选中当前项
      fileItem.classList.add('selected');
      selectedFileIndices = [index];
    }
  }
  
  // 检查点击后是否处于多选状态
  const isMultiSelectAfterClick = selectedFileIndices.length > 1;
  
  // 创建右键菜单
  DOM.contextMenu.innerHTML = '';
  
  // 添加菜单项
  if (!isMultiSelectAfterClick) {
    // 打开选项
    const openOption = document.createElement('div');
    openOption.className = 'context-menu-item';
    openOption.textContent = translations['open'] || '打开';
    openOption.addEventListener('click', () => {
      openFile(index);
    });
    DOM.contextMenu.appendChild(openOption);
    
    // 管理员权限打开选项
    const adminOpenOption = document.createElement('div');
    adminOpenOption.className = 'context-menu-item';
    adminOpenOption.textContent = translations['open_as_admin'] || '管理员权限打开';
    adminOpenOption.addEventListener('click', () => {
      // 使用临时管理员权限打开
      axios.post(`${API_BASE_URL}/files/open/${index}`, { admin: true })
        .then(response => {
          if (!response.data.success) {
            showMessage(response.data.message || 'cannot_open_file_as_admin', 'error');
          }
        })
        .catch(error => {
          console.error('以管理员权限打开文件失败:', error);
          showMessage('cannot_open_file_as_admin', 'error');
        });
    });
    
    // 如果是文件夹，不显示管理员权限打开选项
    if (!file.is_dir) {
      DOM.contextMenu.appendChild(adminOpenOption);
    }
    
    // 打开所在文件夹选项
    const openFolderOption = document.createElement('div');
    openFolderOption.className = 'context-menu-item';
    openFolderOption.textContent = translations['open_folder'] || '打开所在文件夹';
    openFolderOption.addEventListener('click', () => {
      openContainingFolder(index);
    });
    DOM.contextMenu.appendChild(openFolderOption);
    
    // 复制路径选项
    const copyPathOption = document.createElement('div');
    copyPathOption.className = 'context-menu-item';
    copyPathOption.textContent = translations['copy_path'] || '复制路径';
    copyPathOption.addEventListener('click', () => {
      copyFilePath(index);
    });
    DOM.contextMenu.appendChild(copyPathOption);
    
    // 添加分隔线
    const separator1 = document.createElement('div');
    separator1.className = 'context-menu-separator';
    DOM.contextMenu.appendChild(separator1);
    
    // 添加管理员权限设置选项
    if (!file.is_dir) {
      const toggleAdminOption = document.createElement('div');
      toggleAdminOption.className = 'context-menu-item';
      toggleAdminOption.textContent = file.admin 
        ? (translations['disable_admin'] || '取消管理员权限') 
        : (translations['enable_admin'] || '设为管理员权限');
      toggleAdminOption.addEventListener('click', () => {
        toggleAdmin(index);
      });
      DOM.contextMenu.appendChild(toggleAdminOption);
    }
    
    // 添加启动参数选项
    if (!file.is_dir) {
      const addParamsOption = document.createElement('div');
      addParamsOption.className = 'context-menu-item';
      addParamsOption.textContent = translations['add_params'] || '添加启动参数';
      addParamsOption.addEventListener('click', () => {
        addParams(index);
      });
      DOM.contextMenu.appendChild(addParamsOption);
    }
    
    // 添加备注选项
    const addRemarkOption = document.createElement('div');
    addRemarkOption.className = 'context-menu-item';
    addRemarkOption.textContent = translations['add_remark'] || '添加备注';
    addRemarkOption.addEventListener('click', () => {
      addRemark(index);
    });
    DOM.contextMenu.appendChild(addRemarkOption);
    
    // 添加到托盘选项
    if (!file.in_tray) {
      const addToTrayOption = document.createElement('div');
      addToTrayOption.className = 'context-menu-item';
      addToTrayOption.textContent = translations['add_to_tray'] || '添加到托盘';
      addToTrayOption.addEventListener('click', () => {
        addToTray(index);
      });
      DOM.contextMenu.appendChild(addToTrayOption);
    } else {
      const removeFromTrayOption = document.createElement('div');
      removeFromTrayOption.className = 'context-menu-item';
      removeFromTrayOption.textContent = translations['remove_from_tray'] || '从托盘移除';
      removeFromTrayOption.addEventListener('click', () => {
        removeFromTray(file.path);
      });
      DOM.contextMenu.appendChild(removeFromTrayOption);
    }
    
    // 添加分隔线
    const separator2 = document.createElement('div');
    separator2.className = 'context-menu-separator';
    DOM.contextMenu.appendChild(separator2);
    
    // 添加移动选项
    const moveUpOption = document.createElement('div');
    moveUpOption.className = 'context-menu-item';
    moveUpOption.textContent = translations['move_up'] || '上移';
    moveUpOption.addEventListener('click', () => {
      if (index > 0) {
        updateFileOrder(index, index - 1);
      }
    });
    // 如果已经是第一个，禁用上移选项
    if (index === 0) {
      moveUpOption.classList.add('disabled');
    }
    DOM.contextMenu.appendChild(moveUpOption);
    
    const moveDownOption = document.createElement('div');
    moveDownOption.className = 'context-menu-item';
    moveDownOption.textContent = translations['move_down'] || '下移';
    moveDownOption.addEventListener('click', () => {
      if (index < fileList.length - 1) {
        updateFileOrder(index, index + 1);
      }
    });
    // 如果已经是最后一个，禁用下移选项
    if (index === fileList.length - 1) {
      moveDownOption.classList.add('disabled');
    }
    DOM.contextMenu.appendChild(moveDownOption);
    
    // 分隔线
    const separator3 = document.createElement('div');
    separator3.className = 'context-menu-separator';
    DOM.contextMenu.appendChild(separator3);
  }
  
  // 添加删除选项
  const deleteOption = document.createElement('div');
  deleteOption.className = 'context-menu-item delete-option';
  
  if (isMultiSelectAfterClick) {
    deleteOption.textContent = translations['delete_selected'] || '删除选中项';
    deleteOption.addEventListener('click', handleDeleteSelected);
  } else {
    deleteOption.textContent = translations['delete'] || '删除';
    deleteOption.addEventListener('click', () => {
      deleteFile(index);
    });
  }
  
  DOM.contextMenu.appendChild(deleteOption);
  
  // 显示右键菜单
  DOM.contextMenu.style.display = 'block';
  
  // 计算位置，防止菜单溢出窗口
  const menuWidth = 150; // 菜单的预估宽度
  const menuHeight = DOM.contextMenu.childElementCount * 30; // 菜单的预估高度
  
  let x = event.clientX;
  let y = event.clientY;
  
  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth;
  }
  
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight;
  }
  
  DOM.contextMenu.style.left = `${x}px`;
  DOM.contextMenu.style.top = `${y}px`;
}

// 添加复制文件路径函数
function copyFilePath(index) {
  const file = fileList[index];
  if (file && file.path) {
    // 使用 Electron 的 clipboard API 复制路径
    try {
      navigator.clipboard.writeText(file.path)
        .then(() => {
          showMessage(translations['path_copied'] || '路径已复制到剪贴板', 'success');
        })
        .catch(err => {
          console.error('复制到剪贴板失败:', err);
          showMessage(translations['copy_failed'] || '复制失败', 'error');
        });
    } catch (error) {
      console.error('复制路径出错:', error);
      showMessage(translations['copy_failed'] || '复制失败', 'error');
    }
  }
}

// 添加到托盘函数
function addToTray(fileIndex) {
  // 显示加载中
  showLoading();
  
  // 发送请求
  axios.post(`${API_BASE_URL}/tray`, {file_index: fileIndex})
    .then(response => {
      if (response.data.success) {
        console.log('成功添加到托盘，更新文件列表');
        
        // 更新文件的in_tray标志
        if (fileIndex >= 0 && fileIndex < fileList.length) {
          fileList[fileIndex].in_tray = true;
        }
        
        // 重新加载托盘项列表
        axios.get(`${API_BASE_URL}/tray`)
          .then(trayResponse => {
            trayItems = trayResponse.data.data;
            
            // 更新文件列表显示
            updateFileListUI();
            
            // 向后端保存最新的设置
            const currentSettings = {
              language: settings.language,
              show_extensions: settings.show_extensions,
              remove_arrow: settings.remove_arrow,
              minimize_to_tray: settings.minimize_to_tray
            };
            
            // 保存设置以确保立即更新磁盘上的配置
            axios.put(`${API_BASE_URL}/settings`, currentSettings)
              .then(() => {
                console.log('设置已保存，确保托盘配置持久化');
                
                // 不立即创建托盘图标，仅通知主进程更新托盘菜单
                // （托盘图标只应在"最小化到托盘"启用并关闭窗口时才创建）
                window.electronAPI.ipcSend('update-tray-menu-no-create');
                
                hideLoading();
                showMessage(response.data.message || translations['add_to_tray_success'] || '已添加到系统托盘', 'success');
              })
              .catch(error => {
                console.error('保存设置失败:', error);
                // 即使保存设置失败，仍然通知主进程更新托盘菜单（不创建托盘）
                // （托盘图标只应在"最小化到托盘"启用并关闭窗口时才创建）
                window.electronAPI.ipcSend('update-tray-menu-no-create');
                hideLoading();
                showMessage(response.data.message || translations['add_to_tray_partial_failed'] || '已添加到系统托盘，但可能未保存', 'warning');
              });
          })
          .catch(error => {
            console.error('Failed to reload tray items:', error);
            hideLoading();
            
            // 即使加载托盘项失败，也通知主进程更新菜单（不创建托盘）
            window.electronAPI.ipcSend('update-tray-menu-no-create');
            updateFileListUI();
            showMessage(response.data.message || translations['add_to_tray_partial_failed'] || '已添加到系统托盘，但刷新显示失败', 'warning');
          });
      } else {
        hideLoading();
        showMessage(response.data.message || translations['add_to_tray_failed'] || '添加到系统托盘失败', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to add to tray:', error);
      hideLoading();
      showMessage(translations['add_to_tray_failed'] || '添加到系统托盘失败', 'error');
    });
}

// 从托盘移除函数
function removeFromTray(filePath) {
  // 显示加载中
  showLoading();
  
  // 发送删除请求，使用路径参数
  axios.delete(`${API_BASE_URL}/tray/${encodeURIComponent(filePath)}`)
    .then(response => {
      if (response.data.success) {
        console.log('成功从托盘移除，更新文件列表');
        
        // 更新文件的in_tray标志
        const fileIndex = fileList.findIndex(file => file.path === filePath);
        if (fileIndex >= 0) {
          fileList[fileIndex].in_tray = false;
        }
        
        // 重新加载托盘项
        axios.get(`${API_BASE_URL}/tray`)
          .then(trayResponse => {
            trayItems = trayResponse.data.data;
            
            // 更新UI
            updateFileListUI();
            
            // 向后端保存最新的设置
            const currentSettings = {
              language: settings.language,
              show_extensions: settings.show_extensions,
              remove_arrow: settings.remove_arrow,
              minimize_to_tray: settings.minimize_to_tray
            };
            
            // 保存设置以确保立即更新磁盘上的配置
            axios.put(`${API_BASE_URL}/settings`, currentSettings)
              .then(() => {
                console.log('设置已保存，确保托盘配置持久化');
                // 通知主进程更新托盘菜单（不创建托盘）
                window.electronAPI.ipcSend('update-tray-menu-no-create');
                hideLoading();
                showMessage(response.data.message || translations['remove_from_tray_success'] || '已从系统托盘移除', 'success');
              })
              .catch(error => {
                console.error('保存设置失败:', error);
                // 即使保存设置失败，仍然通知主进程更新托盘菜单（不创建托盘）
                window.electronAPI.ipcSend('update-tray-menu-no-create');
                hideLoading();
                showMessage(response.data.message || translations['remove_from_tray_partial_failed'] || '已从系统托盘移除，但可能未保存', 'warning');
              });
          })
          .catch(error => {
            console.error('Failed to reload tray items:', error);
            hideLoading();
            
            // 即使加载托盘项失败，也通知主进程更新菜单（不创建托盘）
            window.electronAPI.ipcSend('update-tray-menu-no-create');
            updateFileListUI();
            showMessage(response.data.message || translations['remove_from_tray_partial_failed'] || '已从系统托盘移除，但刷新显示失败', 'warning');
          });
      } else {
        hideLoading();
        showMessage(response.data.message || translations['remove_from_tray_failed'] || '从系统托盘移除失败', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to remove from tray:', error);
      hideLoading();
      showMessage(translations['remove_from_tray_failed'] || '从系统托盘移除失败', 'error');
    });
}

// 打开所在文件夹函数
function openContainingFolder(index) {
  const file = fileList[index];
  if (file && file.path) {
    openFileLocation(index);
  }
}

// 添加备注
function addRemark(index) {
  const file = fileList[index];
  const currentRemark = file.remark || '';
  
  console.log('准备添加备注, 当前值:', currentRemark);
  
  try {
    // 获取对话框元素
    const dialog = document.getElementById('input-dialog');
    const titleElem = document.getElementById('input-dialog-title');
    const inputField = document.getElementById('input-dialog-field');
    const confirmBtn = document.getElementById('input-dialog-confirm');
    const cancelBtn = document.getElementById('input-dialog-cancel');
    
    // 检查所有必需的元素是否存在
    if (!dialog || !titleElem || !inputField || !confirmBtn || !cancelBtn) {
      console.error('缺少一个或多个对话框元素', 
                   {dialog: !!dialog, title: !!titleElem, 
                    input: !!inputField, confirm: !!confirmBtn, 
                    cancel: !!cancelBtn});
      showMessage('无法打开对话框，界面元素缺失', 'error');
      return;
    }
    
    // 设置标题和初始值
    titleElem.textContent = translations['input_remark'] || '请输入备注';
    inputField.value = currentRemark;
    
    // 确保弹窗样式正确
    dialog.style.display = 'flex';
    dialog.style.alignItems = 'center';
    dialog.style.justifyContent = 'center';
    
    // 添加动画类
    setTimeout(() => {
      dialog.classList.add('show');
    }, 10);
    
    // 输入框获取焦点
    setTimeout(() => {
      inputField.focus();
      inputField.select();
    }, 100);
    
    // 设置确认按钮点击事件
    confirmBtn.onclick = function() {
      const remark = inputField.value;
      dialog.classList.remove('show');
      
      // 等待动画完成后隐藏对话框
      setTimeout(() => {
        dialog.style.display = 'none';
      }, 300);
      
      // 检查是否有实际修改
      if (remark === currentRemark) {
        console.log('备注未修改，无需保存');
        return;
      }
      
      showLoading();
      // 更新备注
      axios.put(`${API_BASE_URL}/files/${index}`, {
        remark: remark
      })
        .then(response => {
          hideLoading();
          if (response.data.success) {
            // 更新本地文件数据
            fileList[index].remark = remark;
            
            // 更新UI
            updateFileListUI();
            showMessage('remark_updated', 'success');
            
            // 通知主进程更新托盘菜单（如果该文件在托盘中）
            trayItems.forEach(item => {
              if (item.path === fileList[index].path) {
                window.electronAPI.ipcSend('update-tray-menu');
                return;
              }
            });
          } else {
            showMessage(response.data.message || 'update_remark_failed', 'error');
          }
        })
        .catch(error => {
          hideLoading();
          console.error('Failed to update remark:', error);
          showMessage('update_remark_failed', 'error');
        });
    };
    
    // 设置取消按钮点击事件
    cancelBtn.onclick = function() {
      dialog.classList.remove('show');
      
      // 等待动画完成后隐藏对话框
      setTimeout(() => {
        dialog.style.display = 'none';
      }, 300);
    };
    
    // 监听回车键确认和ESC键取消
    inputField.onkeydown = function(event) {
      if (event.key === 'Enter') {
        confirmBtn.click();
      } else if (event.key === 'Escape') {
        cancelBtn.click();
      }
    };
  } catch (error) {
    console.error('显示备注对话框时出错:', error);
    showMessage('cannot_show_remark_dialog', 'error');
  }
}

// 删除文件
function deleteFile(index) {
  // 设置选中状态
  selectedFileIndices = [index];
  DOM.fileList.querySelectorAll('.file-item').forEach(item => {
    item.classList.remove('selected', 'multi-selected');
  });
  const item = DOM.fileList.querySelector(`.file-item[data-index="${index}"]`);
  if (item) {
    item.classList.add('selected');
  }
  
  // 调用通用删除函数
  handleDeleteSelected();
}

// 切换管理员权限
function toggleAdmin(index) {
  const file = fileList[index];
  
  axios.put(`${API_BASE_URL}/files/${index}`, {
    admin: !file.admin
  })
    .then(response => {
      if (response.data.success) {
        // 更新本地文件数据
        fileList[index].admin = !file.admin;
        
        // 更新UI
        updateFileListUI();
      } else {
        showMessage(response.data.message || translations['update_admin_failed'] || '更新管理员权限失败', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to toggle admin:', error);
      showMessage(translations['update_admin_failed'] || '更新管理员权限失败', 'error');
    });
}

// 打开文件位置
function openFileLocation(index) {
  const file = fileList[index];
  
  // 通过IPC调用主进程打开文件位置
  window.electronAPI.ipcInvoke('open-file-location', file.path)
    .then(success => {
      if (!success) {
        showMessage(translations['file_not_found'] || '文件未找到', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to open file location:', error);
      showMessage('open_file_location_failed', 'error');
    });
}

// 添加启动参数
function addParams(index) {
  const file = fileList[index];
  const currentParams = file.params || '';
  
  console.log('准备添加启动参数, 当前值:', currentParams);
  
  try {
    // 获取对话框元素
    const dialog = document.getElementById('input-dialog');
    const titleElem = document.getElementById('input-dialog-title');
    const inputField = document.getElementById('input-dialog-field');
    const confirmBtn = document.getElementById('input-dialog-confirm');
    const cancelBtn = document.getElementById('input-dialog-cancel');
    
    // 检查所有必需的元素是否存在
    if (!dialog || !titleElem || !inputField || !confirmBtn || !cancelBtn) {
      console.error('缺少一个或多个对话框元素', 
                   {dialog: !!dialog, title: !!titleElem, 
                    input: !!inputField, confirm: !!confirmBtn, 
                    cancel: !!cancelBtn});
      showMessage('无法打开对话框，界面元素缺失', 'error');
      return;
    }
    
    // 设置标题和初始值
    titleElem.textContent = translations['input_params'] || '请输入启动参数';
    inputField.value = currentParams;
    
    // 确保弹窗样式正确
    dialog.style.display = 'flex';
    dialog.style.alignItems = 'center';
    dialog.style.justifyContent = 'center';
    
    // 添加动画类
    setTimeout(() => {
      dialog.classList.add('show');
    }, 10);
    
    // 输入框获取焦点
    setTimeout(() => {
      inputField.focus();
      inputField.select();
    }, 100);
    
    // 设置确认按钮点击事件
    confirmBtn.onclick = function() {
      const params = inputField.value;
      dialog.classList.remove('show');
      
      // 等待动画完成后隐藏对话框
      setTimeout(() => {
        dialog.style.display = 'none';
      }, 300);
      
      // 检查是否有实际修改
      if (params === currentParams) {
        console.log('启动参数未修改，无需保存');
        return;
      }
      
      showLoading();
      // 更新启动参数
      axios.put(`${API_BASE_URL}/files/${index}`, {
        params: params
      })
        .then(response => {
          hideLoading();
          if (response.data.success) {
            // 更新本地文件数据
            fileList[index].params = params;
            
            // 更新UI
            updateFileListUI();
            showMessage('params_updated', 'success');
            
            // 通知主进程更新托盘菜单（如果该文件在托盘中）
            trayItems.forEach(item => {
              if (item.path === fileList[index].path) {
                window.electronAPI.ipcSend('update-tray-menu');
                return;
              }
            });
          } else {
            showMessage(response.data.message || 'update_params_failed', 'error');
          }
        })
        .catch(error => {
          hideLoading();
          console.error('Failed to update parameters:', error);
          showMessage('update_params_failed', 'error');
        });
    };
    
    // 设置取消按钮点击事件
    cancelBtn.onclick = function() {
      dialog.classList.remove('show');
      
      // 等待动画完成后隐藏对话框
      setTimeout(() => {
        dialog.style.display = 'none';
      }, 300);
    };
    
    // 监听回车键确认和ESC键取消
    inputField.onkeydown = function(event) {
      if (event.key === 'Enter') {
        confirmBtn.click();
      } else if (event.key === 'Escape') {
        cancelBtn.click();
      }
    };
  } catch (error) {
    console.error('显示参数对话框时出错:', error);
    showMessage('cannot_show_params_dialog', 'error');
  }
}

// 打开设置对话框
function openSettingsDialog() {
  // 更新设置对话框的控件值
  DOM.languageSelect.value = settings.language || '中文';
  DOM.showExtensionsCheckbox.checked = settings.show_extensions !== false;
  DOM.removeArrowCheckbox.checked = settings.remove_arrow === true;
  DOM.minimizeToTrayCheckbox.checked = settings.minimize_to_tray === true;
  
  // 设置对话框动画处理
  const dialog = DOM.settingsDialog;
  
  // 确保对话框内容在显示前就定位在屏幕中央
  const dialogContent = dialog.querySelector('.dialog-content');
  if (dialogContent) {
    dialogContent.style.top = '50%';
    dialogContent.style.left = '50%';
    dialogContent.style.transform = 'translate(-50%, -50%)';
  }
  
  // 显示设置对话框并添加show类以触发动画
  dialog.style.display = 'flex';
  
  // 强制浏览器重绘
  void dialog.offsetWidth;
  
  // 添加show类以触发动画
  dialog.classList.add('show');
  
  // 绑定ESC键关闭对话框
  document.addEventListener('keydown', handleSettingsEscapeKey);
  
  // 绑定点击背景关闭对话框
  dialog.addEventListener('click', handleSettingsBackdropClick);
}

// 关闭设置对话框
function closeSettingsDialog() {
  const dialog = DOM.settingsDialog;
  
  // 移除show类以触发隐藏动画
  dialog.classList.remove('show');
  
  // 等待动画完成后隐藏对话框
  setTimeout(() => {
    dialog.style.display = 'none';
  }, 300); // 与CSS动画时长匹配
  
  // 移除ESC键监听
  document.removeEventListener('keydown', handleSettingsEscapeKey);
  
  // 移除背景点击监听
  dialog.removeEventListener('click', handleSettingsBackdropClick);
}

// 处理设置对话框ESC键关闭
function handleSettingsEscapeKey(event) {
  if (event.key === 'Escape') {
    closeSettingsDialog();
  }
}

// 处理设置对话框背景点击关闭
function handleSettingsBackdropClick(event) {
  // 只有点击到背景层时才关闭对话框
  if (event.target === DOM.settingsDialog) {
    closeSettingsDialog();
  }
}

// 保存设置
function saveSettings() {
  const newSettings = {
    language: DOM.languageSelect.value,
    show_extensions: DOM.showExtensionsCheckbox.checked,
    remove_arrow: DOM.removeArrowCheckbox.checked,
    minimize_to_tray: DOM.minimizeToTrayCheckbox.checked
  };
  
  // 记录是否改变了remove_arrow设置
  const arrowSettingChanged = settings.remove_arrow !== newSettings.remove_arrow;
  // 记录是否改变了minimize_to_tray设置
  const traySettingChanged = settings.minimize_to_tray !== newSettings.minimize_to_tray;
  // 记录是否变更了语言设置
  const languageChanged = currentLanguage !== newSettings.language;
  
  // 显示加载中
  if (languageChanged) {
    showLoading();
  }
  
  axios.put(`${API_BASE_URL}/settings`, newSettings)
    .then(response => {
      if (response.data.success) {
        // 更新设置
        settings = { ...settings, ...newSettings };
        
        // 如果语言变更，通知主进程
        if (languageChanged) {
          currentLanguage = newSettings.language;
          
          // 通知主进程更新翻译，主进程负责刷新窗口
          window.electronAPI.ipcSend('language-changed', currentLanguage);
          
          // 关闭设置对话框
          closeSettingsDialog();
          
          // 显示保存成功消息
          showMessage(response.data.message || translations['settings_saved'] || '设置已保存', 'success');
          
          // 不在这里主动刷新，让主进程负责刷新操作
          return; // 提前返回，避免下面的代码立即执行
        }
        
        // 如果改变了箭头设置，重新加载文件列表以更新图标
        if (arrowSettingChanged) {
          showLoading();
          loadFileList();
        } else {
          // 仅更新UI
          updateFileListUI();
        }
        
        // 如果改变了最小化到托盘设置，通知主进程更新
        if (traySettingChanged) {
          window.electronAPI.ipcSend('update-minimize-setting', newSettings.minimize_to_tray);
        }
        
        // 关闭设置对话框
        closeSettingsDialog();
        
        showMessage(response.data.message || translations['settings_saved'] || '设置已保存', 'success');
      } else {
        hideLoading();
        showMessage(response.data.message || 'save_settings_failed', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to save settings:', error);
      hideLoading();
      showMessage('save_settings_failed', 'error');
    });
}

// 处理键盘事件
function handleKeyDown(event) {
  // Delete键删除选中项
  if (event.key === 'Delete' && selectedFileIndices.length > 0) {
    handleDeleteSelected();
  }
}

// 显示消息
function showMessage(message, type = 'info', duration = 3000) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  
  // 如果是翻译键，则尝试获取翻译，否则直接使用消息
  const translatedMessage = translations[message] || message;
  messageDiv.textContent = translatedMessage;
  
  // 添加标题以便于样式化
  if (messageDiv.querySelector('.message-title') === null) {
    const titleType = type === 'info' ? 'notification_info' : 
                     type === 'success' ? 'notification_success' : 
                     type === 'warning' ? 'notification_warning' : 'notification_error';
                     
    const titleText = translations[titleType] || '';
    if (titleText) {
      const title = document.createElement('strong');
      title.className = 'message-title';
      title.textContent = titleText + ': ';
      messageDiv.prepend(title);
    }
  }
  
  document.body.appendChild(messageDiv);
  
  // 等待一帧以确保元素添加到DOM
  requestAnimationFrame(() => {
    messageDiv.classList.add('show');
  });
  
  setTimeout(() => {
    messageDiv.classList.remove('show');
    
    // 等待淡出动画完成后再移除元素
    messageDiv.addEventListener('transitionend', () => {
      if (document.body.contains(messageDiv)) {
        document.body.removeChild(messageDiv);
      }
    });
  }, duration);
}

// 显示加载中覆盖层
function showLoading() {
  DOM.loadingOverlay.style.display = 'flex';
}

// 隐藏加载中覆盖层
function hideLoading() {
  DOM.loadingOverlay.style.display = 'none';
}

// 添加重置所有设置和文件的逻辑
function resetAll() {
  // 显示确认对话框，确保用户真的想要重置所有设置和文件
  const confirmTitle = translations['reset_confirm_title'] || '确认重置';
  const confirmMessage = translations['reset_confirm_message'] || '确定要重置所有设置和文件吗？此操作将删除所有配置和文件列表，无法恢复！';
  
  // 使用美观的自定义对话框代替原生confirm
  showCustomConfirmDialog(confirmTitle, confirmMessage, () => {
    showLoading();
    
    // 调用后端API进行重置
    axios.post(`${API_BASE_URL}/reset`)
      .then(response => {
        if (response.data.success) {
          // 关闭设置对话框
          closeSettingsDialog();
          
          // 重新加载应用
          showMessage(response.data.message || 'reset_success', 'success');
          
          // 延迟后重新加载设置和文件列表
          setTimeout(() => {
            loadSettings();
          }, 1000);
        } else {
          hideLoading();
          showMessage(response.data.message || '重置失败', 'error');
        }
      })
      .catch(error => {
        console.error('Failed to reset settings and files:', error);
        hideLoading();
        showMessage('重置失败', 'error');
      });
  });
}

// 显示自定义确认对话框
function showCustomConfirmDialog(title, message, confirmCallback) {
  // 创建自定义确认对话框
  const dialog = document.createElement('div');
  dialog.className = 'modal custom-confirm-dialog';
  dialog.style.zIndex = '3000';
  
  const dialogContent = document.createElement('div');
  dialogContent.className = 'dialog-content input-dialog-content';
  
  // 添加标题
  const titleElement = document.createElement('h2');
  titleElement.textContent = title;
  titleElement.style.color = '#333';
  titleElement.style.fontSize = '16px';
  titleElement.style.fontWeight = '500';
  titleElement.style.marginBottom = '16px';
  dialogContent.appendChild(titleElement);
  
  // 添加图标
  const iconElement = document.createElement('div');
  iconElement.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f56c6c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  iconElement.style.margin = '5px auto 15px';
  dialogContent.appendChild(iconElement);
  
  // 添加消息
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  messageElement.style.color = '#606266';
  messageElement.style.fontSize = '14px';
  messageElement.style.margin = '0 0 20px';
  messageElement.style.lineHeight = '1.5';
  messageElement.style.padding = '0 10px';
  dialogContent.appendChild(messageElement);
  
  // 添加按钮
  const buttonGroup = document.createElement('div');
  buttonGroup.className = 'dialog-buttons';
  
  const cancelButton = document.createElement('button');
  cancelButton.className = 'button cancel-button';
  cancelButton.textContent = translations['cancel'] || '取消';
  cancelButton.onclick = () => {
    document.body.removeChild(dialog);
  };
  
  const confirmButton = document.createElement('button');
  confirmButton.className = 'button confirm-button';
  confirmButton.style.backgroundColor = '#f56c6c';
  confirmButton.style.borderColor = '#f56c6c';
  confirmButton.textContent = translations['confirm'] || '确定';
  confirmButton.onclick = () => {
    document.body.removeChild(dialog);
    if (typeof confirmCallback === 'function') {
      confirmCallback();
    }
  };
  
  buttonGroup.appendChild(cancelButton);
  buttonGroup.appendChild(confirmButton);
  dialogContent.appendChild(buttonGroup);
  
  dialog.appendChild(dialogContent);
  document.body.appendChild(dialog);
  
  // 显示对话框
  setTimeout(() => {
    dialog.classList.add('show');
  }, 10);
  
  // ESC 键关闭对话框
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      dialog.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(dialog)) {
          document.body.removeChild(dialog);
        }
      }, 300);
      document.removeEventListener('keydown', handleKeyDown);
    }
  };
  document.addEventListener('keydown', handleKeyDown);
}

// 处理容器点击事件（点击空白处）
function handleContainerClick(event) {
  // 如果点击目标不是文件项，则视为点击空白区域
  if (!event.target.closest('.file-item')) {
    // 如果不是按下Ctrl或Shift，才清除所有选择
    if (!event.ctrlKey && !event.shiftKey) {
      // 取消所有选择
      selectedFileIndices = [];
      DOM.fileList.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected', 'multi-selected');
      });
    }
  }
}

// 创建波纹效果
function createRippleEffect(event) {
  // 只对文件项添加波纹效果
  const fileItem = event.target.closest('.file-item');
  if (!fileItem) return;
  
  // 创建波纹元素
  const ripple = document.createElement('div');
  ripple.className = 'file-item-ripple';
  
  // 设置波纹位置
  const rect = fileItem.getBoundingClientRect();
  ripple.style.left = `${event.clientX - rect.left}px`;
  ripple.style.top = `${event.clientY - rect.top}px`;
  
  // 添加波纹元素到文件项
  fileItem.appendChild(ripple);
  
  // 波纹动画结束后移除元素
  setTimeout(() => {
    if (fileItem.contains(ripple)) {
      fileItem.removeChild(ripple);
    }
  }, 800);
}

// 拖拽排序事件处理函数
// 开始拖拽
function handleDragStart(e) {
  // 防止与文件上传拖拽冲突
  e.stopPropagation();
  
  draggedItem = this;
  dragStartIndex = parseInt(this.dataset.index);
  
  // 设置拖拽效果和数据
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragStartIndex);
  
  // 添加拖拽样式
  setTimeout(() => {
    this.classList.add('dragging');
  }, 0);
}

// 拖拽经过其他元素时
function handleDragOver(e) {
  // 阻止默认行为以允许放置
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

// 拖拽进入其他元素
function handleDragEnter(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // 只对文件项添加悬停效果
  if (this !== draggedItem) {
    this.classList.add('drag-over-item');
  }
}

// 拖拽离开元素
function handleDragLeave(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // 移除悬停效果
  this.classList.remove('drag-over-item');
}

// 放置元素
function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // 防止在自身上放置
  if (draggedItem === this) {
    return;
  }
  
  // 获取目标索引
  const dropIndex = parseInt(this.dataset.index);
  
  // 移除悬停效果
  this.classList.remove('drag-over-item');
  
  // 更新文件顺序
  updateFileOrder(dragStartIndex, dropIndex);
}

// 拖拽结束
function handleDragEnd(e) {
  e.preventDefault();
  e.stopPropagation();
  
  // 移除所有拖拽相关样式
  this.classList.remove('dragging');
  
  // 清除所有悬停效果
  document.querySelectorAll('.file-item').forEach(item => {
    item.classList.remove('drag-over-item');
  });
  
  // 重置拖拽变量
  draggedItem = null;
  dragStartIndex = -1;
}

// 更新文件顺序
function updateFileOrder(fromIndex, toIndex) {
  // 显示加载状态
  showLoading();
  
  // 调用后端API更新文件顺序
  axios.put(`${API_BASE_URL}/files/order/${fromIndex}/${toIndex}`)
    .then(response => {
      if (response.data.success) {
        // 重新加载文件列表
        loadFileList();
        showMessage('file_order_updated', 'success');
      } else {
        hideLoading();
        showMessage(response.data.message || 'update_file_order_failed', 'error');
      }
    })
    .catch(error => {
      console.error('Failed to update file order:', error);
      hideLoading();
      showMessage('update_file_order_failed', 'error');
    });
}

// 显示拖拽排序提示
function showDragSortTip() {
  // 检查是否之前显示过提示（使用localStorage记录）
  if (!localStorage.getItem('drag_sort_tip_shown')) {
    showMessage(translations['drag_sort_tip'] || '提示：您可以拖拽文件项来调整顺序', 'info', 5000);
    // 记录已显示过提示
    localStorage.setItem('drag_sort_tip_shown', 'true');
  }
}

// 确认输入对话框
function confirmInputDialog() {
  const dialog = document.getElementById('input-dialog');
  dialog.classList.remove('show');
  
  // 等待动画完成后隐藏对话框
  setTimeout(() => {
    dialog.style.display = 'none';
    // 获取输入值
    const value = DOM.inputDialogField.value;
    
    // 执行回调
    if (typeof inputDialogCallback === 'function') {
      inputDialogCallback(value);
    }
  }, 300);
}

// 关闭输入对话框
function closeInputDialog() {
  const dialog = document.getElementById('input-dialog');
  dialog.classList.remove('show');
  
  // 等待动画完成后隐藏对话框
  setTimeout(() => {
    dialog.style.display = 'none';
    inputDialogCallback = null;
  }, 300);
}

// 处理设置标签切换
function handleSettingsTabClick(event) {
  // 如果已经是活跃标签，则不做任何操作
  if (event.currentTarget.classList.contains('active')) {
    return;
  }
  
  // 移除所有标签按钮的active类
  DOM.settingsTabs.forEach(tab => {
    tab.classList.remove('active');
  });
  
  // 为当前标签按钮添加active类
  event.currentTarget.classList.add('active');
  
  // 获取要显示的标签内容ID
  const tabId = event.currentTarget.getAttribute('data-tab');
  const activeContent = document.getElementById(`${tabId}-tab`);
  
  // 先将所有标签内容设置为淡出状态
  DOM.settingsTabContents.forEach(content => {
    content.style.opacity = '0';
    
    // 短暂延迟后移除active类并隐藏非当前标签
    setTimeout(() => {
      if (content !== activeContent) {
        content.classList.remove('active');
      }
    }, 150);
  });
  
  // 短暂延迟后显示当前标签内容
  setTimeout(() => {
    if (activeContent) {
      activeContent.classList.add('active');
      // 再次短暂延迟确保过渡效果平滑
      setTimeout(() => {
        activeContent.style.opacity = '1';
      }, 50);
    }
  }, 150);
}

// 初始化检查更新按钮
function initCheckUpdateButton() {
  if (DOM.checkUpdateBtn) {
    DOM.checkUpdateBtn.addEventListener('click', () => {
      // 禁用按钮，防止重复点击
      DOM.checkUpdateBtn.disabled = true;
      DOM.checkUpdateBtn.textContent = '检查中...';

      // 发送检查更新请求到主进程
      window.electronAPI.ipcSend('check-for-updates');
    });
  }
}

// 处理更新检查结果
window.electronAPI.ipcOn('update-check-result', (event, result) => {
  DOM.checkUpdateBtn.disabled = false;
  DOM.checkUpdateBtn.textContent = '检查更新';
  const updateTip = document.getElementById('update-tip');
  if (updateTip) {
    updateTip.textContent = '';
    const parent = updateTip.parentNode;
    if (parent) {
      parent.querySelectorAll('.update-available, .no-update').forEach(el => el.remove());
    }
  }
  if (result.hasUpdate) {
    cachedUpdateResult = result; // 缓存新版本信息
    // 显示完整新版本号提示，并可点击
    const updateInfo = document.createElement('span');
    updateInfo.className = 'update-available';
    updateInfo.textContent = `发现新版本 ${result.latestVersion}`;
    updateInfo.style.textDecoration = 'underline';
    updateInfo.style.cursor = 'pointer';
    updateInfo.onclick = () => showUpdateDialog(result);
    if (updateTip) updateTip.appendChild(updateInfo);
    // 自动弹窗
    showUpdateDialog(result);
  } else {
    cachedUpdateResult = null;
    const updateInfo = document.createElement('span');
    updateInfo.className = 'no-update';
    updateInfo.textContent = '已是最新版本';
    if (updateTip) updateTip.appendChild(updateInfo);
    // 新增：无新版本时也弹窗
    showUpdateDialog({ hasUpdate: false });
  }
});

// 处理更新检查错误
window.electronAPI.ipcOn('update-check-error', (event, error) => {
  // 恢复按钮状态
  DOM.checkUpdateBtn.disabled = false;
  DOM.checkUpdateBtn.textContent = '检查更新';

  // 清除旧的更新提示
  const updateTip = document.getElementById('update-tip');
  if (updateTip) {
    updateTip.textContent = '';
    const parent = updateTip.parentNode;
    if (parent) {
      parent.querySelectorAll('.update-available, .no-update').forEach(el => el.remove());
    }
  }

  // 显示错误提示
  const updateInfo = document.createElement('span');
  updateInfo.className = 'no-update';
  updateInfo.textContent = '检查更新失败';
  if (updateTip) updateTip.appendChild(updateInfo);
});

// 统一外链点击事件
function bindExternalLinks() {
  document.querySelectorAll('.external-link').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const url = this.getAttribute('href');
      if (url && window.electronAPI && window.electronAPI.openExternal) {
        window.electronAPI.openExternal(url);
      }
    });
  });
}

// 显示更新日志弹窗
function showUpdateDialog(result) {
  const dialog = document.getElementById('update-log-dialog');
  const content = document.getElementById('update-log-content');
  const confirmBtn = document.getElementById('update-log-confirm');
  const cancelBtn = document.getElementById('update-log-cancel');
  const title = document.getElementById('update-log-title');
  if (!dialog || !content || !confirmBtn || !cancelBtn) return;
  if (!result.hasUpdate) {
    title.textContent = '已是最新版本';
    content.innerHTML = `<div style='text-align:center;line-height:2;font-size:16px;color:#333;padding:10px 0;'>您当前已是最新版本，无需更新。</div>`;
    confirmBtn.textContent = '确定';
    confirmBtn.style.background = '#1E88E5';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.fontSize = '15px';
    cancelBtn.style.display = 'none';
    confirmBtn.onclick = () => {
      dialog.classList.remove('show');
      setTimeout(() => {
        dialog.style.display = 'none';
        cancelBtn.style.display = '';
      }, 300);
    };
  } else {
    // ... existing code for新版本弹窗 ...
    title.textContent = `发现新版本 ${result.latestVersion || ''}`;
    let notes = result.releaseNotes || '';
    if (!notes && window.versionInfo && window.versionInfo.releaseNotes) {
      notes = window.versionInfo.releaseNotes;
    }
    // 原：content.innerHTML = `<div style='text-align:left;line-height:1.8;font-size:15px;color:#333;padding:0 2px;'>${notes ? notes.replace(/\n/g,'<br>') : '有新版本可用，建议前往更新。'}</div>`;
    // 改为：去除line-height，统一用外部样式
    content.innerHTML = `<div style='text-align:left;font-size:15px;color:#333;padding:0 2px;'>${notes ? notes.replace(/\n/g,'<br>') : '有新版本可用，建议前往更新。'}</div>`;
    confirmBtn.textContent = '立即前往新版';
    confirmBtn.style.background = 'linear-gradient(90deg,#1E88E5,#42a5f5)';
    confirmBtn.style.fontWeight = 'bold';
    confirmBtn.style.fontSize = '15px';
    cancelBtn.textContent = '暂不更新';
    cancelBtn.style.background = '#f5f5f5';
    cancelBtn.style.color = '#666';
    cancelBtn.style.fontWeight = 'normal';
    cancelBtn.style.fontSize = '15px';
    cancelBtn.style.display = '';
    confirmBtn.onclick = () => {
      dialog.classList.remove('show');
      setTimeout(() => {
        dialog.style.display = 'none';
        window.electronAPI.openExternal && window.electronAPI.openExternal('https://github.com/AstraSolis/QuickStart/releases/latest');
      }, 300);
    };
    cancelBtn.onclick = () => {
      dialog.classList.remove('show');
      setTimeout(() => {
        dialog.style.display = 'none';
      }, 300);
    };
  }
  dialog.style.display = 'flex';
  setTimeout(() => dialog.classList.add('show'), 10);
}
// 让"发现新版本"提示可点击，直接弹窗
const updateTip = document.getElementById('update-tip');
if (updateTip) {
  updateTip.onclick = () => {
    if (cachedUpdateResult) showUpdateDialog(cachedUpdateResult);
  };
}