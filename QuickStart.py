# 标准库导入
import os
import sys
import json
import subprocess

# 第三方库导入
from win32com.client import Dispatch
from win32com.shell import shell, shellcon
from PyQt5.QtCore import QFileInfo, Qt, pyqtSignal, QDataStream
from PyQt5.QtGui import QIcon, QKeyEvent
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QListWidget, QVBoxLayout, QPushButton, QHBoxLayout,
    QWidget, QListWidgetItem, QAbstractItemView, QMenu, QMessageBox, QInputDialog,
    QFileDialog, QDialog, QLabel, QCheckBox, QComboBox, QFileIconProvider, QLineEdit,
    QSystemTrayIcon
)
from PyQt5.QtNetwork import QLocalServer, QLocalSocket

# 检查程序是否在打包后环境中运行
if getattr(sys, 'frozen', False):  # 如果是打包后的可执行文件
    image_folder = os.path.join(sys._MEIPASS, 'images')  # 获取图片文件夹路径
else:
    image_folder = 'Icon'  # 如果是开发环境，使用相对路径

# 加载图标和图片
icon_path = os.path.join(image_folder, 'icon.ico')
folder_path = os.path.join(image_folder, 'folder.png')
window_path = os.path.join(image_folder, 'window.png')
settings_path = os.path.join(image_folder, 'settings.png')


class LanguageManager:
    def __init__(self, lang_file="languages.json"):

        # 判断是否在打包环境中
        if getattr(sys, 'frozen', False):  # 如果是打包后的可执行文件
            self.lang_file = os.path.join(sys._MEIPASS, lang_file)  # 获取打包后的路径
        else:
            self.lang_file = lang_file  # 使用开发环境中的路径
        self.languages = self.load_languages()

    def load_languages(self):
        try:
            with open(self.lang_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"加载语言文件失败: {e}")
            return {}

    def get_translation(self, language, key):
        return self.languages.get(language, {}).get(key, key)

    def get_available_languages(self):
        """返回所有可用的语言列表"""
        return list(self.languages.keys())


class ConfigManager:

    def __init__(self, config_file="config.json"):
        self.config_file = config_file
        self.config = {}  # 使用 config 来存储配置
        self.load_config()  # 加载配置

    def load_config(self):

        """加载配置"""
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    self.config = json.load(f)  # 加载配置到 self.config

                    # 确保配置中有 'files' 键，如果没有则初始化为空列表
                    if 'files' not in self.config:
                        self.config['files'] = []

                    # 检查并删除无效文件路径
                    self.remove_invalid_files()

            except Exception as e:
                print(f"加载配置失败: {e}")
        else:
            # 配置文件不存在时使用默认配置
            self.config = {
                "language": "中文",
                "show_extensions": True,
                "remove_arrow": False,
                "minimize_to_tray": False,
                "files": []
            }
            self.save_config()  # 保存默认配置

    def save_config(self):
        """保存配置"""
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(
                    self.config, f, indent=4, ensure_ascii=False
                )   # 使用 self.config 来保存配置
        except Exception as e:
            print(f"保存配置失败: {e}")
            QMessageBox.critical(None, "保存失败", f"无法保存配置: {e}")  # 弹窗提示错误

    def get(self, key, default=None):
        """获取配置项"""
        return self.config.get(key, default)

    def set(self, key, value):
        """设置配置项并保存"""
        self.config[key] = value
        self.save_config()  # 直接调用 save_config() 方法保存配置

    def remove_invalid_files(self):
        """移除无效的文件路径"""
        invalid_paths = []

        # 遍历配置中的文件，检查路径有效性
        for file_info in self.config.get("files", []):
            file_path = file_info.get("path", "")
            if not os.path.exists(file_path):
                invalid_paths.append(file_path)

        if invalid_paths:
            # 删除无效路径的文件项
            self.config["files"] = [
                file_info for file_info in self.config["files"]
                if file_info["path"] not in invalid_paths
            ]
            print(f"已删除无效文件: {', '.join(invalid_paths)}")  # 调试输出

            # 保存更新后的配置
            self.save_config()


class FileFolderDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        try:
            # 获取 LanguageManager 实例并加载当前语言
            self.language_manager = LanguageManager()
            self.language = self.parent().config.get("language", "中文")  # 获取父窗口的语言配置

            self.setWindowIcon(QIcon(folder_path))  # 选择文件菜单图标
            self.setWindowTitle(self.tr("select_file_or_folder"))  # 设置窗口标题
            self.setMinimumWidth(300)
            self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)  # 隐藏窗口问号
        except Exception as e:
            print(f"Error during FileFolderDialog initialization: {e}")

        # 布局
        layout = QVBoxLayout()

        # 文件选择按钮
        self.file_button = QPushButton(self.tr("select_file"))
        self.file_button.clicked.connect(self.select_file)
        layout.addWidget(self.file_button)

        # 文件夹选择按钮
        self.folder_button = QPushButton(self.tr("select_folder"))
        self.folder_button.clicked.connect(self.select_folder)
        layout.addWidget(self.folder_button)

        # 显示选项复选框
        self.checkbox = QCheckBox(self.tr("only_show_folders"))
        self.checkbox.stateChanged.connect(self.toggle_mode)
        layout.addWidget(self.checkbox)

        # 文件筛选功能
        filter_layout = QHBoxLayout()

        # 启用筛选复选框
        self.enable_filter_checkbox = QCheckBox(self.tr("file_filter"))
        self.enable_filter_checkbox.stateChanged.connect(self.toggle_filter)
        filter_layout.addWidget(self.enable_filter_checkbox)

        # 输入框，允许用户输入多个后缀名，支持逗号和空格分隔
        self.filter_input = QLineEdit(self)
        self.filter_input.setPlaceholderText(self.tr("filter_placeholder"))
        self.filter_input.setEnabled(False)  # 默认禁用
        filter_layout.addWidget(self.filter_input)

        layout.addLayout(filter_layout)

        # 显示已选择内容
        self.selected_label = QLabel(self.tr("selected_files_none"))
        layout.addWidget(self.selected_label)

        # 确认与取消按钮
        button_layout = QHBoxLayout()
        self.confirm_button = QPushButton(self.tr("confirm"))
        self.confirm_button.clicked.connect(self.accept)
        button_layout.addWidget(self.confirm_button)

        self.cancel_button = QPushButton(self.tr("cancel"))
        self.cancel_button.clicked.connect(self.reject)
        button_layout.addWidget(self.cancel_button)

        layout.addLayout(button_layout)
        self.setLayout(layout)

        # 存储选择的路径
        self.selected_paths = []

    def tr(self, key):
        """翻译文字"""
        return self.language_manager.get_translation(self.language, key)

    def retranslate_ui(self):
        """更新对话框中的文本"""
        self.setWindowTitle(self.tr("select_file_or_folder"))
        self.file_button.setText(self.tr("select_file"))
        self.folder_button.setText(self.tr("select_folder"))
        self.checkbox.setText(self.tr("only_show_folders"))
        self.enable_filter_checkbox.setText(self.tr("file_filter"))
        self.filter_input.setPlaceholderText(self.tr("filter_placeholder"))
        self.selected_label.setText(self.tr("selected_files_none"))
        self.confirm_button.setText(self.tr("confirm"))
        self.cancel_button.setText(self.tr("cancel"))

    def select_file(self):
        """选择文件，支持文件类型过滤"""
        file_filter = self.get_file_filter()
        files, _ = QFileDialog.getOpenFileNames(
            self,
            self.tr("select_file"),  # 对话框标题
            "",  # 起始路径，可以设置为某个目录，如 "C:/"
            file_filter  # 动态生成的文件过滤器
        )
        if files:
            self.selected_paths = files
            self.selected_label.setText(
                f"{self.tr('selected_files')}: "
                f"{', '.join(self.selected_paths)}"
            )

    def select_folder(self):
        """选择文件夹"""
        folder = QFileDialog.getExistingDirectory(
            self,
            self.tr("select_folder"),  # 对话框标题
            ""  # 起始路径，可以设置为某个目录，如 "C:/"
        )
        if folder:
            self.selected_paths = [folder]
            self.selected_label.setText(
                f"{self.tr('selected_files')}: {folder}"
            )

    def toggle_mode(self, state):
        """切换仅显示文件夹模式"""
        if state == Qt.Checked:
            self.file_button.setEnabled(False)  # 禁用选择文件按钮
            self.folder_button.setEnabled(True)  # 启用选择文件夹按钮
            self.enable_filter_checkbox.setChecked(False)  # 取消勾选文件筛选复选框
        else:
            self.file_button.setEnabled(True)  # 启用选择文件按钮
            self.folder_button.setEnabled(True)  # 启用选择文件夹按钮

    def toggle_filter(self, state):
        """切换文件筛选功能"""
        # 如果勾选复选框，启用输入框
        if state == Qt.Checked:
            self.filter_input.setEnabled(True)
            self.file_button.setEnabled(True)
            self.folder_button.setEnabled(False)  # 禁用选择文件夹按钮
            self.checkbox.setChecked(False)  # 关闭另一个复选框（仅显示文件夹复选框）
        else:
            self.filter_input.setEnabled(False)
            self.file_button.setEnabled(True)
            self.folder_button.setEnabled(True)  # 恢复选择文件夹按钮

    def get_file_filter(self):
        """获取文件筛选过滤器"""
        filter_input_text = self.filter_input.text().strip()
        if filter_input_text:
            # 处理多个后缀名，以空格或逗号分隔
            extensions = [
                ext.strip()
                for ext in filter_input_text.replace(',', ' ').split()
            ]
            file_filter = (
                f"{self.tr('file_types')} ("
                f"{' '.join([f'*{ext}' for ext in extensions])})"
            )
        else:
            file_filter = self.tr("all_files")  # 默认显示所有文件

        return file_filter


class SettingsDialog(QDialog):
    # 定义信号，用于通知父窗口配置变更
    language_changed = pyqtSignal(str)          # 语言变更信号
    show_extensions_changed = pyqtSignal(bool)  # 显示扩展名设置变更信号
    remove_arrow_changed = pyqtSignal(bool)     # 快捷方式箭头设置变更信号
    minimize_to_tray_changed = pyqtSignal(bool)  # 系统托盘

    def __init__(self, config_manager, language_manager, current_language, parent=None):

        super().__init__(parent)

        self.version = self._get_version()  # 添加版本号属性

        self.config_manager = config_manager       # 存储配置管理对象
        self.language_manager = language_manager  # 存储语言管理对象
        self.language = current_language           # 存储当前语言

        # 初始化窗口属性
        self.setWindowIcon(QIcon(settings_path))
        self.setFixedSize(250, 150)
        self.setWindowFlags(self.windowFlags() & ~Qt.WindowContextHelpButtonHint)  # 隐藏窗口问号

        self.init_ui()  # 初始化界面组件
        self.setup_connections()  # 建立信号槽连接

    def _get_git_root(self, path):
        """查找给定路径的Git根目录"""
        path = os.path.abspath(path)
        while True:
            if os.path.isdir(os.path.join(path, '.git')):
                return path
            parent = os.path.dirname(path)
            if parent == path:
                return None  # 到达根目录，未找到
            path = parent

    def _get_version(self):
        """获取当前版本号"""
        default_version = "V1.0.1"
        # 打包环境处理
        if getattr(sys, 'frozen', False):
            try:
                base_path = sys._MEIPASS
                version_path = os.path.join(base_path, 'version.txt')
                with open(version_path, 'r', encoding='utf-8') as f:
                    return f.read().strip()
            except Exception:
                return default_version
        # 开发环境处理
        else:
            try:
                # 获取当前文件路径
                script_path = os.path.abspath(__file__)
                git_root = self._get_git_root(os.path.dirname(script_path))

                if not git_root:
                    return f"{default_version}-dev"

                # 执行Git命令
                result = subprocess.run(
                    ["git", "describe", "--tags", "--dirty", "--always"],
                    cwd=git_root,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    check=True,
                )
                version = result.stdout.strip()
                return version if version else f"{default_version}-dev"
            except subprocess.CalledProcessError as e:
                print(f"Git版本获取失败: {e.stderr}")
                return f"{default_version}-dev"
            except Exception as e:
                print(f"版本获取异常: {e}")
                return f"{default_version}-dev"

    def tr(self, key):
        """翻译文字"""
        return self.language_manager.get_translation(self.language, key)

    def init_ui(self):

        # 主垂直布局
        layout = QVBoxLayout(self)

        # 显示后缀名复选框
        self.show_extensions_checkbox = QCheckBox(self.tr("show_extensions"), self)
        self.show_extensions_checkbox.setChecked(self.config_manager.get("show_extensions", True))
        layout.addWidget(self.show_extensions_checkbox)

        # 去除快捷方式箭头复选框
        self.remove_arrow_checkbox = QCheckBox(self.tr("quick_icon_arrow"), self)
        self.remove_arrow_checkbox.setChecked(self.config_manager.get("remove_arrow", False))
        layout.addWidget(self.remove_arrow_checkbox)

        # 最小化到托盘复选框
        self.minimize_to_tray_checkbox = QCheckBox(self.tr("minimize_to_tray"), self)
        self.minimize_to_tray_checkbox.setChecked(self.config_manager.get("minimize_to_tray", False))
        layout.addWidget(self.minimize_to_tray_checkbox)

        # 语言选择
        language_layout = QHBoxLayout()
        self.language_label = QLabel(self.tr("language"), self)
        self.language_combobox = QComboBox(self)
        self.language_combobox.addItems(self.language_manager.get_available_languages())
        self.language_combobox.setCurrentText(self.config_manager.get("language", "中文"))
        language_layout.addWidget(self.language_label)
        language_layout.addWidget(self.language_combobox)
        layout.addLayout(language_layout)

        # 垂直拉伸
        layout.addStretch()

        # 项目地址和版本号的布局
        bottom_layout = QHBoxLayout()

        # 项目地址标签
        self.website_label = QLabel(self)
        self.website_label.setTextInteractionFlags(Qt.TextBrowserInteraction)
        self.website_label.setOpenExternalLinks(True)
        bottom_layout.addWidget(self.website_label, alignment=Qt.AlignLeft)

        # 版本号标签
        self.version_label = QLabel(self.version)
        bottom_layout.addWidget(self.version_label, alignment=Qt.AlignRight)
        self.version_label.setObjectName("version_label")

        layout.addLayout(bottom_layout)  # 添加底部布局

        self.retranslate_ui()  # 初始化界面文本翻译

    def setup_connections(self):
        """建立信号与槽的连接"""
        self.show_extensions_checkbox.stateChanged.connect(self.on_show_extensions_changed)  # 显示扩展名复选框状态变化时更新配置
        self.remove_arrow_checkbox.stateChanged.connect(self.on_remove_arrow_changed)  # 去除箭头复选框状态变化时更新配置
        self.language_combobox.currentTextChanged.connect(self.on_language_changed)  # 语言选择变化时更新配置和界面
        self.minimize_to_tray_checkbox.stateChanged.connect(self.on_minimize_to_tray_changed)  # 系统托盘

    def retranslate_ui(self):
        """动态更新界面文本"""
        self.setWindowTitle(self.tr("settings"))
        self.show_extensions_checkbox.setText(self.tr("show_extensions"))
        self.remove_arrow_checkbox.setText(self.tr("quick_icon_arrow"))
        self.language_label.setText(self.tr("language"))
        link_text = self.tr("project_address")
        self.website_label.setText(f'<a href="https://github.com/AstraSolis">{link_text}</a>')
        self.minimize_to_tray_checkbox.setText(self.tr("minimize_to_tray"))

    def on_show_extensions_changed(self, state):
        """处理显示扩展名设置变更"""
        new_state = state == Qt.Checked
        self.config_manager.set("show_extensions", new_state)
        self.show_extensions_changed.emit(new_state)  # 发射信号

    def on_remove_arrow_changed(self, state):
        """处理快捷方式箭头设置变更"""
        new_state = state == Qt.Checked
        self.config_manager.set("remove_arrow", new_state)
        self.remove_arrow_changed.emit(new_state)  # 发射信号

    def on_minimize_to_tray_changed(self, state):
        """系统托盘"""
        new_state = state == Qt.Checked
        self.config_manager.set("minimize_to_tray", new_state)
        self.minimize_to_tray_changed.emit(new_state)

    def on_language_changed(self, language):
        """处理语言选择变更"""
        self.config_manager.set("language", language)
        self.language = language
        self.retranslate_ui()
        self.language_changed.emit(language)  # 发射信号


class QuickLaunchApp(QMainWindow):
    def __init__(self):
        super().__init__()

        self.setAcceptDrops(True)  # 启用拖拽功能

        self.config_manager = ConfigManager()  # 配置管理器实例化
        self.config_manager.load_config()  # 加载配置
        self.config = self.config_manager.config  # 获取配置

        self.language_manager = LanguageManager()  # 使用新的语言管理类
        self.language = self.config.get("language", "中文")  # 获取当前语言配置

        self.icon_provider = QFileIconProvider()  # 初始化文件图标提供器
        self.setWindowIcon(QIcon(window_path))  # 窗口图标

        # 创建系统托盘图标
        self.tray_icon = QSystemTrayIcon(self)
        self.tray_icon.setIcon(QIcon(icon_path))

        # 创建托盘菜单
        tray_menu = QMenu()
        show_action = tray_menu.addAction(self.tr("show"))
        exit_action = tray_menu.addAction(self.tr("exit"))
        show_action.triggered.connect(self.show_normal)
        exit_action.triggered.connect(self.quit_app)
        self.tray_icon.setContextMenu(tray_menu)
        self.tray_icon.activated.connect(self.on_tray_activated)

        self.file_folder_dialog = None  # 用于保存 FileFolderDialog 实例
        self.init_ui()  # 初始化界面
        self.retranslate_ui()  # 根据加载的语言配置更新界面文本

    def tr(self, key):
        """翻译文字"""
        return self.language_manager.get_translation(self.language, key)

    def init_ui(self):
        """初始化界面"""
        self.setWindowTitle(self.tr("title"))
        self.resize(900, 600)

        # 文件列表
        self.file_list_widget = QListWidget(self)
        self.file_list_widget.setSelectionMode(QAbstractItemView.ExtendedSelection)
        self.file_list_widget.setContextMenuPolicy(Qt.CustomContextMenu)
        self.file_list_widget.customContextMenuRequested.connect(self.show_context_menu)
        self.file_list_widget.itemDoubleClicked.connect(self.handle_double_click)

        self.file_list_widget.setDragDropMode(QAbstractItemView.InternalMove)  # 启用内部拖拽
        self.file_list_widget.model().rowsMoved.connect(self.update_order_after_drag)  # 监听拖拽事件

        # 添加文件按钮
        self.add_file_button = QPushButton(self.tr("add_file"), self)
        self.add_file_button.clicked.connect(self.add_files)

        # 设置按钮
        self.settings_button = QPushButton(self.tr("settings"), self)
        self.settings_button.clicked.connect(self.show_settings)

        # 布局
        layout = QVBoxLayout()
        layout.addWidget(self.file_list_widget)

        # 顶部按钮布局
        top_button_layout = QHBoxLayout()
        top_button_layout.addWidget(self.add_file_button, alignment=Qt.AlignLeft)
        self.add_file_button.setObjectName("add_file_button")
        top_button_layout.addStretch()
        top_button_layout.addWidget(self.settings_button, alignment=Qt.AlignRight)
        self.settings_button.setObjectName("settings_button")

        main_layout = QVBoxLayout()
        main_layout.addLayout(top_button_layout)
        main_layout.addLayout(layout)

        container = QWidget()
        container.setLayout(main_layout)
        self.setCentralWidget(container)

    def show_normal(self):
        """统一窗口激活逻辑"""
        if self.isMinimized():
            # 如果窗口被最小化，先恢复正常状态
            self.showNormal()

        # 确保窗口前置并激活
        self.setWindowState(self.windowState() & ~Qt.WindowMinimized)  # 清除最小化状态

        self.raise_()                         # 提升到父控件栈顶
        self.activateWindow()                 # 激活窗口获取焦点
        self.setWindowState(Qt.WindowActive)  # 强制设为活动状态

        # 如果窗口被其他窗口遮挡，闪烁任务栏按钮（仅Windows）
        if sys.platform == "win32":
            from ctypes import windll
            hwnd = self.winId().__int__()
            windll.user32.FlashWindow(hwnd, True)

    def quit_app(self):
        """安全退出应用程序"""
        self.tray_icon.hide()  # 隐藏系统托盘图标（避免残留）
        QApplication.quit()  # 终止Qt应用程序事件循环

    def on_tray_activated(self, reason):
        """处理系统托盘图标触发事件"""
        if reason == QSystemTrayIcon.DoubleClick:
            self.show_normal()

    def closeEvent(self, event):
        """窗口关闭事件处"""
        if self.config.get("minimize_to_tray", False):
            event.ignore()
            self.hide()
            self.tray_icon.showMessage(
                self.tr("title"),
                self.tr("app_running_in_tray"),
                QSystemTrayIcon.Information,
                2000
            )
            self.tray_icon.show()
        else:
            self.quit_app()

    def add_params(self, items):
        """添加启动参数"""
        for item in items:
            row = self.file_list_widget.row(item)
            file_info = self.config["files"][row]
            current_params = file_info.get("params", "")
            text, ok = QInputDialog.getText(self, self.tr("add_params"), self.tr("input_params"), text=current_params)
            if ok:
                file_info["params"] = text
        self.config_manager.save_config()
        self.update_file_list()

    def keyPressEvent(self, event: QKeyEvent):
        """捕获键盘事件"""
        if event.key() == Qt.Key_Delete:
            # 获取选中的文件项
            selected_items = self.file_list_widget.selectedItems()
            if selected_items:
                self.delete_files(selected_items)

    def dragEnterEvent(self, event):
        """处理拖拽进入事件"""
        if event.mimeData().hasUrls():
            event.accept()
        else:
            event.ignore()

    def dropEvent(self, event):
        """处理拖拽放置事件"""
        try:
            files_and_folders = []
            for url in event.mimeData().urls():
                file_path = url.toLocalFile()

                # 如果是文件或文件夹，都加入列表
                if os.path.exists(file_path):
                    files_and_folders.append(file_path)

            if files_and_folders:
                self.add_files_from_list(files_and_folders)  # 调用统一的文件添加逻辑
        except Exception as e:
            print(f"拖拽处理时出错: {e}")

    def update_order_after_drag(self, parent, start, end, destination, row):
        """在拖拽排序完成后更新配置文件"""
        # 获取当前文件列表的顺序
        new_order = []
        for index in range(self.file_list_widget.count()):
            item = self.file_list_widget.item(index)
            file_path = item.toolTip()  # 使用工具提示存储文件路径
            for file_info in self.config["files"]:
                if file_info["path"] == file_path:
                    new_order.append(file_info)
                    break

        # 更新配置中的文件列表顺序
        self.config["files"] = new_order
        self.config_manager.save_config()

    def add_files(self):
        """通过对话框添加文件或文件夹"""
        try:
            dialog = FileFolderDialog(self)
            dialog.retranslate_ui()  # 强制更新对话框文本
            if dialog.exec_():
                selected_paths = dialog.selected_paths
                self.add_files_from_list(selected_paths)
        except Exception as e:
            print(f"Error occurred while adding files: {e}")

    def add_files_from_list(self, files):
        """从文件列表添加文件，并更新列表和配置"""
        existing_paths = {file_info["path"] for file_info in self.config["files"]}  # 使用集合加速查重

        for file_path in files:
            # 跳过重复文件
            if file_path in existing_paths:
                print(f"文件已存在: {file_path}")
                continue

            # 检查文件路径是否有效
            if not os.path.exists(file_path):
                print(f"无效的文件路径: {file_path}")
                continue

            try:
                # 判断是文件还是文件夹
                is_dir = os.path.isdir(file_path)
                # 获取文件图标
                icon = self.icon_provider.icon(QFileInfo(file_path))

                # 创建 QListWidgetItem
                item = QListWidgetItem(os.path.basename(file_path))
                item.setToolTip(file_path)  # 设置完整路径为工具提示
                item.setIcon(icon)  # 设置图标
                self.file_list_widget.addItem(item)

                # 更新到配置
                self.config["files"].append({
                    "name": os.path.basename(file_path),
                    "path": file_path,
                    "is_dir": is_dir,  # True表示路径是一个文件夹，False表示是文件
                    "remark": "",
                    "admin": False,
                    "params": ""
                })

                # 添加到已存在路径集合
                existing_paths.add(file_path)
            except Exception as e:
                print(f"添加文件时出错: {e}")

        # 保存配置
        self.config_manager.save_config()

        # 刷新界面
        self.update_file_list()

    def get_icon(self, file_path):
        """根据文件类型获取图标"""
        try:
            # 处理 .url 文件（Internet 快捷方式）
            if file_path.endswith(".url"):
                try:
                    # 解析 .url 文件内容
                    icon_file = None
                    icon_index = 0
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        for line in f:
                            if line.startswith("IconFile="):
                                icon_file = line.split("=", 1)[1].strip()
                            elif line.startswith("IconIndex="):
                                icon_index = int(line.split("=", 1)[1].strip())

                    # 如果有有效的 IconFile 路径，尝试加载图标
                    if icon_file and os.path.exists(icon_file):
                        if icon_file.endswith(".ico"):
                            return QIcon(icon_file)  # 如果是 .ico 文件，直接使用 QIcon
                        else:
                            # 提取其他类型文件的图标
                            hicon, _ = self.extract_icon_from_file(icon_file, icon_index)
                            if hicon:
                                pixmap = self.hicon_to_pixmap(hicon)
                                if pixmap:
                                    return QIcon(pixmap)
                    print(f"无效的 IconFile 路径: {icon_file}")
                except Exception as e:
                    print(f"解析 .url 文件失败: {e}")

            # 处理 .lnk 文件（Windows 快捷方式）
            elif file_path.endswith(".lnk") and self.config.get("remove_arrow", False):
                try:
                    # 使用 win32com.client 提取 .lnk 文件的目标路径
                    shell = Dispatch("WScript.Shell")
                    shortcut = shell.CreateShortcut(file_path)
                    target_path = shortcut.TargetPath

                    # 如果目标路径存在，从目标文件提取图标
                    if os.path.exists(target_path):
                        return self.icon_provider.icon(QFileInfo(target_path))  # 返回目标文件的图标
                    else:
                        print(f"快捷方式的目标路径无效: {target_path}")
                except Exception as e:
                    print(f"解析 .lnk 文件失败: {e}")

            # 默认情况：使用 QFileIconProvider 获取文件的图标
            return self.icon_provider.icon(QFileInfo(file_path))

        except Exception as e:
            print(f"获取图标失败：{file_path}, 错误：{e}")
            # 返回一个空图标以防止程序崩溃
            return QIcon()

    def get_all_list_items(self):
        """获取列表中的所有项目"""
        return [self.file_list_widget.item(i) for i in range(self.file_list_widget.count())]

    def update_file_list(self):
        """更新文件列表显示"""
        # 清空文件列表显示
        self.file_list_widget.clear()

        # 从配置中获取是否显示文件后缀名的设置
        show_extensions = self.config.get("show_extensions", True)

        # 遍历配置中的文件列表
        for file_info in self.config["files"]:
            try:
                # 如果文件信息无效或没有路径，跳过该项
                if not file_info or "path" not in file_info:
                    continue

                # 获取文件路径
                file_path = file_info.get("path", "")
                # 如果文件路径不存在于本地，跳过该项
                if not os.path.exists(file_path):
                    continue

                # 获取备注信息
                remark = file_info.get("remark", "")
                # 根据是否显示后缀名来决定文件名的显示格式
                file_name = (
                    os.path.basename(file_path)
                    if show_extensions
                    else os.path.splitext(os.path.basename(file_path))[0]
                )
                # 如果有备注，用括号包裹显示；否则仅显示文件名
                display_name = f"{remark} ({file_name})" if remark else file_name

                # 创建列表项和自定义控件
                item = QListWidgetItem()
                item.setToolTip(file_path)
                item.setIcon(self.get_icon(file_path))

                widget = QWidget()
                layout = QHBoxLayout(widget)
                layout.setContentsMargins(5, 2, 5, 2)
                layout.setSpacing(10)

                # 文件名部分（固定宽度左对齐）
                name_label = QLabel(display_name)
                name_label.setAlignment(Qt.AlignLeft | Qt.AlignVCenter)
                name_label.setFixedWidth(200)  # 固定宽度防止拉伸

                # 右侧标签容器（右对齐）
                right_container = QWidget()
                right_layout = QHBoxLayout(right_container)
                right_layout.setContentsMargins(0, 0, 0, 0)
                right_layout.setAlignment(Qt.AlignRight)

                # 管理员标签
                if file_info.get("admin", False):
                    admin_label = QLabel(f"[{self.tr('administrator')}]")
                    admin_label.setStyleSheet("color: red; margin-right: 10px;")
                    right_layout.addWidget(admin_label)

                # 参数标签
                if params := file_info.get("params", ""):
                    params_label = QLabel(f"[{self.tr('add_params')}: {params}]")
                    params_label.setStyleSheet("color: #666666;")
                    right_layout.addWidget(params_label)

                # 组装布局
                layout.addWidget(name_label)
                layout.addWidget(right_container, 1)  # 给右侧容器分配剩余空间

                self.file_list_widget.addItem(item)
                self.file_list_widget.setItemWidget(item, widget)

            except Exception as e:
                print(f"更新文件列表时出错：{e}")

    def show_context_menu(self, pos):
        """右键菜单"""
        try:
            # 获取选中的文件项
            selected_items = self.file_list_widget.selectedItems()
            if not selected_items:
                return

            # 创建右键菜单
            menu = QMenu(self)

            # 添加右键菜单项
            remark_action = menu.addAction(self.tr("remark"))  # 备注
            delete_action = menu.addAction(self.tr("delete"))  # 删除

            # 动态显示管理员权限菜单项
            first_file = self.config["files"][self.file_list_widget.row(selected_items[0])]
            if first_file.get("admin", False):
                toggle_admin_action = menu.addAction(self.tr("cancel_administrator"))
            else:
                toggle_admin_action = menu.addAction(self.tr("administrator"))

            location_action = menu.addAction(self.tr("open_location"))  # 打开文件所在位置

            # 定义 params_action 变量，默认为 None
            params_action = None

            # 判断文件类型是否为 .exe，只有 .exe 文件才显示启动参数
            file_path = first_file.get("path", "")
            if file_path.endswith(".exe"):
                params_action = menu.addAction(self.tr("add_params"))  # 添加启动参数

            # 显示菜单并获取用户选择的动作
            action = menu.exec_(self.file_list_widget.mapToGlobal(pos))

            # 根据用户选择执行对应的操作
            if action == remark_action:
                self.add_remark(selected_items)
            elif action == delete_action:
                self.delete_files(selected_items)
            elif action == toggle_admin_action:
                self.toggle_admin(selected_items)  # 切换管理员权限
            elif action == location_action:
                self.open_file_location(selected_items[0])
            elif params_action and action == params_action:  # 只有 params_action 被添加且用户选择时才处理
                self.add_params(selected_items)

        except Exception as e:
            print(f"右键菜单出错：{e}")

    def handle_double_click(self, item):
        """处理双击打开事件"""
        row = self.file_list_widget.row(item)
        file_info = self.config["files"][row]
        self.open_file(file_info)  # 根据配置决定是否以管理员权限打开

    def open_selected_files(self, admin=False):
        """打开选中文件"""
        selected_items = self.file_list_widget.selectedItems()
        if not selected_items:
            return

        for item in selected_items:
            row = self.file_list_widget.row(item)
            file_info = self.config["files"][row]
            self.open_file(file_info, admin=admin)

    def open_file(self, file_info, admin=None):
        """打开单个文件或文件夹"""
        file_path = file_info["path"]
        params = file_info.get("params", "")

        # 如果 admin 参数未指定，则根据文件配置决定是否以管理员权限运行
        if admin is None:
            admin = file_info.get("admin", False)

        if not os.path.exists(file_path):
            QMessageBox.warning(self, self.tr("error"), self.tr("file_not_found") + f": {file_path}")
            return

        try:
            if file_info.get("is_dir", False):
                # 打开文件夹
                os.startfile(file_path)
            if admin:
                # 以管理员权限运行
                shell.ShellExecuteEx(
                    fMask=shellcon.SEE_MASK_NOCLOSEPROCESS,
                    lpVerb="runas",
                    lpFile=file_path,
                    lpParameters=params,
                    nShow=1
                )
            else:
                # 普通方式运行
                if params:
                    subprocess.Popen([file_path, params])  # 使用参数启动
                else:
                    os.startfile(file_path)  # 没有参数时直接启动
        except Exception as e:
            QMessageBox.critical(self, self.tr("error"), f"无法打开文件：{e}")

    def toggle_admin(self, items):
        """切换管理员权限"""
        for item in items:
            row = self.file_list_widget.row(item)
            file_info = self.config["files"][row]
            is_admin = file_info.get("admin", False)
            file_info["admin"] = not is_admin  # 切换管理员权限状态

            # 更新显示名称（添加或移除 [管理员] 标记）
            self.update_list_item(item, file_info)

        # 保存配置到文件
        self.config_manager.save_config()
        self.retranslate_ui()

    def add_remark(self, items):
        """添加备注"""
        for item in items:
            try:
                row = self.file_list_widget.row(item)
                file_info = self.config["files"][row]

                # 当前的备注或默认名称
                current_name = file_info["remark"] or os.path.basename(file_info["path"])

                # 弹出对话框让用户输入备注
                text, ok = QInputDialog.getText(self, self.tr("remark"), self.tr("input_remark"), text=current_name)
                if ok:
                    file_info["remark"] = text  # 保存备注
                    # 直接更新当前项的显示内容，无需重载整个列表
                    self.update_list_item(item, file_info)
            except Exception as e:
                print(f"添加备注时出错：{e}")

        self.config_manager.save_config()

    def update_list_item(self, item, file_info):
        """更新单个列表项显示"""
        try:
            # 构造新的显示名称
            show_extensions = self.config.get("show_extensions", True)
            file_path = file_info["path"]
            file_name = (
                os.path.basename(file_path)
                if show_extensions
                else os.path.splitext(os.path.basename(file_path))[0]
            )
            remark = file_info.get("remark", "")
            display_name = f"{remark} ({file_name})" if remark else file_name

            # 更新列表项文本
            admin_text = "[administrator]" if file_info.get("admin", False) else ""
            params = file_info.get("params", "")
            params_text = f"[add_params: {params}]" if params else ""

            # 格式化显示
            formatted_text = f"{display_name:<50} {admin_text} {params_text}"
            item.setText(formatted_text.strip())
        except Exception as e:
            print(f"更新列表项时出错：{e}")

    def delete_files(self, items):
        """删除选中的文件"""
        confirm = QMessageBox.question(
            self,
            self.tr("delete"),
            self.tr("confirm_delete"),
            QMessageBox.Yes | QMessageBox.No
        )
        if confirm == QMessageBox.No:
            return

        selected_rows = sorted(
            [self.file_list_widget.row(item) for item in items],
            reverse=True
        )
        for row in selected_rows:
            del self.config["files"][row]
        self.config_manager.save_config()
        self.update_file_list()

    def open_file_location(self, item):
        """打开文件所在位置"""
        row = self.file_list_widget.row(item)
        file_info = self.config["files"][row]
        folder_path = os.path.dirname(file_info["path"])
        if os.path.exists(folder_path):
            os.startfile(folder_path)
        else:
            QMessageBox.warning(
                self, self.tr("error"), self.tr("file_not_found") + f": {folder_path}"
            )

    def show_settings(self):
        dialog = SettingsDialog(
            config_manager=self.config_manager,
            language_manager=self.language_manager,
            current_language=self.config.get("language", "中文"),
            parent=self
        )
        # 连接所有配置变更信号
        dialog.language_changed.connect(self.handle_language_changed)
        dialog.show_extensions_changed.connect(self.handle_show_extensions_changed)
        dialog.remove_arrow_changed.connect(self.handle_remove_arrow_changed)
        dialog.exec_()

    def handle_language_changed(self, language):
        self.language = language
        self.retranslate_ui()  # 刷新界面文字
        self.update_file_list()  # 刷新文件列表

    def handle_show_extensions_changed(self, state):
        self.update_file_list()  # 立即刷新文件列表显示

    def handle_remove_arrow_changed(self, state):
        self.update_file_list()  # 立即刷新图标显示

    def retranslate_ui(self):
        """动态更新界面文字"""
        self.setWindowTitle(self.tr("title"))
        self.add_file_button.setText(self.tr("add_file"))
        self.settings_button.setText(self.tr("settings"))
        self.update_file_list()


def main():
    app = QApplication(sys.argv)

    # 加载QSS样式表
    if getattr(sys, 'frozen', False):
        qss_path = os.path.join(sys._MEIPASS, 'styles.qss')
    else:
        qss_path = 'styles.qss'

    try:
        with open(qss_path, 'r', encoding='utf-8') as f:
            app.setStyleSheet(f.read())
    except Exception as e:
        print(f"无法加载样式表: {e}")

    # 设置唯一的服务器名称（必须是全局唯一的）
    server_name = "QuickLaunchApp_UniqueServerName_v1"

    # 尝试创建本地服务器
    local_server = QLocalServer()
    socket = QLocalSocket()

    # 尝试连接已有实例
    socket.connectToServer(server_name)
    if socket.waitForConnected(500):
        # 如果连接成功，发送激活信号
        stream = QDataStream(socket)
        stream.writeQString("activate")
        socket.waitForBytesWritten()
        socket.close()
        return 0  # 退出新实例

    # 创建主窗口前启动服务器
    local_server.listen(server_name)

    # 创建主窗口
    window = QuickLaunchApp()
    window.show()

    # 处理激活请求
    def handle_connection():
        while local_server.hasPendingConnections():
            conn = local_server.nextPendingConnection()
            conn.readyRead.connect(lambda: handle_activate(conn))

    def handle_activate(conn):
        stream = QDataStream(conn)
        if conn.bytesAvailable() > 0:
            msg = stream.readQString()
            if msg == "activate":
                window.show_normal()  # 统一使用优化后的激活方法
                if sys.platform == "win32":
                    window.setWindowState(window.windowState() | Qt.WindowActive)
                    window.show()
        conn.disconnectFromServer()

    local_server.newConnection.connect(handle_connection)

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
