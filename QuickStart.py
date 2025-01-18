
# 标准库导入
import os
import sys
import json
import subprocess

# 第三方库导入
from win32com.client import Dispatch
from win32com.shell import shell, shellcon
from PyQt5.QtCore import QFileInfo, Qt
from PyQt5.QtGui import QIcon, QPixmap, QFont, QKeyEvent
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QListWidget, QVBoxLayout, QPushButton, QHBoxLayout,
    QWidget, QListWidgetItem, QAbstractItemView, QMenu, QMessageBox, QInputDialog,
    QFileDialog, QDialog, QLabel, QCheckBox, QComboBox, QDialogButtonBox, QFileIconProvider,
    QLineEdit
)

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

                    # 检查并删除无效文件路径
                    self.remove_invalid_files()

            except Exception as e:
                print(f"加载配置失败: {e}")
        else:
            # 配置文件不存在时使用默认配置
            self.config = {"language": "中文", "show_extensions": True, "remove_arrow": False}
            self.config_manager.save_config()  # 保存默认配置

    def save_config(self):
        """保存配置"""
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)  # 使用 self.config 来保存配置
        except Exception as e:
            print(f"保存配置失败: {e}")
            QMessageBox.critical(None, "保存失败", f"无法保存配置: {e}")  # 弹窗提示错误

    def get(self, key, default=None):
        """获取配置项"""
        return self.config.get(key, default)

    def set(self, key, value):
        """设置配置项"""
        self.config[key] = value
        self.config_manager.save_config()  # 更新后保存配置

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
            self.config["files"] = [file_info for file_info in self.config["files"]
                                    if file_info["path"] not in invalid_paths]
            print(f"已删除无效文件: {', '.join(invalid_paths)}")  # 调试输出

            # 保存更新后的配置
            self.save_config()



class FileFolderDialog(QDialog):
    def __init__(self, parent=None, language_data=None, config=None):
        super().__init__(parent)
        try:
            self.language_data = language_data  # 接收并设置语言数据
            self.config = config if config else {"language": "中文"}  # 如果没有提供 config，则默认为语言设置
            self.setWindowIcon(QIcon(folder_path))  # 选择文件菜单图标
            self.setWindowTitle(self.tr("select_file_or_folder"))  # 设置窗口标题
            self.setMinimumWidth(300)
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
        language = self.config.get("language", "中文")
        return self.language_data.get(language, {}).get(key, key)

    def retranslate_ui(self):
        """更新对话框中的文本"""
        language = self.config.get("language", "中文")  # 确保获取正确的语言
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
            self.selected_label.setText(f"{self.tr('selected_files')}: {', '.join(self.selected_paths)}")

    def select_folder(self):
        """选择文件夹"""
        folder = QFileDialog.getExistingDirectory(
            self,
            self.tr("select_folder"),  # 对话框标题
            ""  # 起始路径，可以设置为某个目录，如 "C:/"
        )
        if folder:
            self.selected_paths = [folder]
            self.selected_label.setText(f"{self.tr('selected_files')}: {folder}")

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
            extensions = [ext.strip() for ext in filter_input_text.replace(',', ' ').split()]
            file_filter = self.tr("file_types") + " (" + " ".join([f"*{ext}" for ext in extensions]) + ")"
        else:
            file_filter = self.tr("all_files")  # 默认显示所有文件

        return file_filter


class QuickLaunchApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setAcceptDrops(True) # 启用拖拽功能

        self.config_manager = ConfigManager()  # 配置管理器实例化
        self.config_manager.load_config()  # 加载配置
        self.config = self.config_manager.config  # 获取配置


        self.icon_provider = QFileIconProvider() # 初始化文件图标提供器
        self.setWindowIcon(QIcon(window_path))  # 窗口图标

        # 多语言数据
        self.language_data = {
            "中文": {
                "title": "快捷启动",
                "add_file": "添加文件",
                "settings": "设置",
                "select_files": "选择文件",
                "error": "错误",
                "file_not_found": "文件未找到",
                "administrator": "管理员",
                "cancel_administrator": "取消管理员",
                "open_location": "打开文件所在位置",
                "remark": "备注",
                "delete": "删除",
                "confirm_delete": "确定要删除选中的文件吗？",
                "add_params": "启动参数",
                "input_remark": "请输入备注：",
                "input_params": "请输入启动参数：",
                "show_extensions": "显示文件后缀名",
                "language": "语言",
                "quick_icon_arrow": "取消快捷图标箭头",
                "select_file_or_folder": "选择文件或文件夹",
                "select_file": "选择文件",
                "select_folder": "选择文件夹",
                "only_show_folders": "仅显示文件夹",
                "file_filter": "文件类型筛选",
                "filter_placeholder": "如 .txt, .exe 或 .txt .exe",
                "selected_files_none": "已选择: 无",
                "selected_files": "已选择文件",
                "confirm": "确认",
                "cancel": "取消",
                "file_types": "文件类型",
                "all_files": "所有文件 (*.*)"
            },
            "English": {
                "title": "Quick Launch",
                "add_file": "Add File",
                "settings": "Settings",
                "select_files": "Select Files",
                "error": "Error",
                "file_not_found": "File not found",
                "administrator": "administrator",
                "cancel_administrator": "cancel administrator",
                "open_location": "Open File Location",
                "remark": "Remark",
                "delete": "Delete",
                "confirm_delete": "Are you sure you want to delete the selected files?",
                "add_params": "Startup Parameters",
                "input_remark": "Enter remark:",
                "input_params": "Enter startup parameters:",
                "show_extensions": "Show File Extensions",
                "language": "Language",
                "quick_icon_arrow": "quick icon arrow",
                "select_file_or_folder": "Select File or Folder",
                "select_file": "Select File",
                "select_folder": "Select Folder",
                "only_show_folders": "Only Show Folders",
                "file_filter": "File Filter",
                "filter_placeholder": "e.g. .txt, .exe or .txt .exe",
                "selected_files_none": "Selected: None",
                "selected_files": "Selected Files",
                "confirm": "Confirm",
                "cancel": "Cancel",
                "file_types": "File Types",
                "all_files": "All Files (*.*)"
            }
        }

        self.file_folder_dialog = None  # 用于保存 FileFolderDialog 实例
        self.init_ui()  # 初始化界面
        self.retranslate_ui() # 根据加载的语言配置更新界面文本



    def tr(self, key):
        """翻译文字"""
        language = self.config.get("language", "中文")
        return self.language_data[language].get(key, key)

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

        # 美化按钮
        self.add_file_button.setStyleSheet(
            "QPushButton { background-color: #0078D7; color: white; border-radius: 5px; padding: 5px 15px; }"
            "QPushButton:hover { background-color: #005A9E; }")
        self.settings_button.setStyleSheet(
            "QPushButton { background-color: #0078D7; color: white; border-radius: 5px; padding: 5px 15px; }"
            "QPushButton:hover { background-color: #005A9E; }")

        # 布局
        layout = QVBoxLayout()
        layout.addWidget(self.file_list_widget)

        # 顶部按钮布局
        top_button_layout = QHBoxLayout()
        top_button_layout.addWidget(self.add_file_button, alignment=Qt.AlignLeft)
        top_button_layout.addStretch()
        top_button_layout.addWidget(self.settings_button, alignment=Qt.AlignRight)

        main_layout = QVBoxLayout()
        main_layout.addLayout(top_button_layout)
        main_layout.addLayout(layout)

        container = QWidget()
        container.setLayout(main_layout)
        self.setCentralWidget(container)

        # 全局界面美化
        self.setStyleSheet("""
            QMainWindow {
                background-color: #F4F4F4;
            }
            QListWidget {
                border: 1px solid #CCCCCC;
                background: #FFFFFF;
                font-size: 14px;
                padding: 5px;
                border-radius: 5px;
            }
            QListWidget::item {
                padding: 10px;
            }
            QListWidget::item:hover {
                background: #E6F7FF;
            }
            QListWidget::item:selected {
                background: #0078D7;
                color: white;
            }
            QListWidget:focus {
                border: none;  /* 移除虚线框 */
                outline: none;  
            }
            QPushButton:focus {
                outline: none;  
            }
        """)

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
            # 只传递语言配置
            language_config = {"language": self.config.get("language", "中文")}
            dialog = FileFolderDialog(self, language_data=self.language_data, config=language_config)  # 只传递语言设置
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
                    "is_dir": is_dir, # True表示路径是一个文件夹，False表示是文件
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
                file_name = os.path.basename(file_path) if show_extensions else \
                    os.path.splitext(os.path.basename(file_path))[0]
                # 如果有备注，用括号包裹显示；否则仅显示文件名
                display_name = f"{remark} ({file_name})" if remark else file_name

                # 根据文件配置，生成管理员标记文本
                admin_text = f"[{self.tr('administrator')}]" if file_info.get("admin", False) else ""
                # 获取启动参数并生成相应的文本
                params = file_info.get("params", "")
                params_text = f"[{self.tr('add_params')}: {params}]" if params else ""

                # 获取文件对应的图标
                icon = self.get_icon(file_path)
                # 创建一个 QListWidgetItem 对象，用于在列表中显示文件信息
                item = QListWidgetItem()
                item.setToolTip(file_path)  # 设置工具提示为文件完整路径
                item.setIcon(icon)  # 设置文件图标

                # 格式化文件显示的完整文本（包括备注、管理员标记和启动参数）
                formatted_text = f"{display_name:<50} {admin_text:<10} {params_text}"
                item.setText(formatted_text.strip())  # 设置列表项的显示文本

                # 设置文件项的字体为固定宽度字体，以保持对齐
                font = QFont("Monospace")
                font.setStyleHint(QFont.Monospace)
                font.setPointSize(10)
                item.setFont(font)

                # 将生成的文件项添加到列表中
                self.file_list_widget.addItem(item)
            except Exception as e:
                # 如果在更新文件列表时发生异常，打印错误日志
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
            elif action == params_action:
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
                # 普通方式运行（使用 subprocess）
                if params:
                    subprocess.Popen([file_path, params])  # 使用参数启动
                else:
                    subprocess.Popen([file_path])  # 没有参数时直接启动
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
            file_name = os.path.basename(file_path) if show_extensions else \
            os.path.splitext(os.path.basename(file_path))[0]
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
            QMessageBox.warning(self, self.tr("error"), self.tr("file_not_found") + f": {folder_path}")

    def update_file_list(self):
        """更新文件列表显示"""
        self.file_list_widget.clear()
        show_extensions = self.config.get("show_extensions", True)

        for file_info in self.config["files"]:
            try:
                # 检查 file_info 的完整性
                if not file_info or "path" not in file_info:
                    print("跳过无效的文件信息：", file_info)
                    continue

                # 检查路径是否有效
                file_path = file_info.get("path", "")
                if not os.path.exists(file_path):
                    print(f"文件路径无效，跳过：{file_path}")
                    continue

                # 提取文件名和备注
                remark = file_info.get("remark", "")
                file_name = os.path.basename(file_path)
                if not show_extensions and not file_info.get("is_dir", False):
                    file_name = os.path.splitext(file_name)[0]

                # 构建显示名称
                display_name = file_name
                if remark:
                    display_name = f"{remark} ({display_name})"

                # 添加管理员状态和启动参数
                admin_text = f"[{self.tr('administrator')}]" if file_info.get("admin", False) else ""
                params = file_info.get("params", "")
                params_text = f"[{self.tr('add_params')}: {params}]" if params else ""

                # 获取图标并创建列表项
                try:
                    icon = self.get_icon(file_path)
                except Exception as icon_error:
                    print(f"图标加载失败：{file_path}, 错误：{icon_error}")
                    icon = QIcon()  # 使用默认空图标

                item = QListWidgetItem()
                item.setToolTip(file_path)
                item.setIcon(icon)

                # 格式化显示文本
                formatted_text = f"{display_name:<50} {admin_text} {params_text}"
                item.setText(formatted_text.strip())

                # 设置固定宽度字体避免对齐问题
                font = QFont("Monospace")
                font.setStyleHint(QFont.Monospace)
                font.setPointSize(10)
                item.setFont(font)

                self.file_list_widget.addItem(item)
            except Exception as e:
                print(f"更新文件列表时出错，文件信息：{file_info}, 错误：{e}")


    def show_settings(self):
        """显示设置窗口"""
        dialog = QDialog(self)
        dialog.setWindowTitle(self.tr("settings"))
        dialog.setWindowIcon(QIcon(settings_path)) # 设置菜单图标
        dialog.setFixedSize(250, 150)

        # 创建主布局
        layout = QVBoxLayout(dialog)

        # 显示后缀名选项
        show_extensions_checkbox = QCheckBox(self.tr("show_extensions"), dialog)
        show_extensions_checkbox.setChecked(self.config.get("show_extensions", True))
        show_extensions_checkbox.stateChanged.connect(lambda state: self.toggle_extensions(state))

        # 去除快捷方式箭头选项
        remove_arrow_checkbox = QCheckBox(self.tr("quick_icon_arrow"), dialog)
        remove_arrow_checkbox.setChecked(self.config.get("remove_arrow", False))  # 从配置中读取
        remove_arrow_checkbox.stateChanged.connect(
            lambda state: self.toggle_remove_arrow(state == Qt.Checked)
        )

        # 语言选择部分
        language_layout = QHBoxLayout()
        language_label = QLabel(self.tr("language"), dialog)
        language_combobox = QComboBox(dialog)
        language_combobox.addItems(["中文", "English"])
        language_combobox.setCurrentText(self.config.get("language", "中文"))
        language_combobox.currentTextChanged.connect(self.change_language)

        def refresh_settings_ui():
            """切换语言后刷新设置窗口"""
            language_label.setText(self.tr("language"))
            show_extensions_checkbox.setText(self.tr("show_extensions"))
            remove_arrow_checkbox.setText(self.tr("quick_icon_arrow"))
            dialog.setWindowTitle(self.tr("settings"))

        language_combobox.currentTextChanged.connect(lambda: refresh_settings_ui())

        # 将语言标签和多选框添加到水平布局
        language_layout.addWidget(language_label)
        language_layout.addWidget(language_combobox)

        # 添加到设置窗口的主布局
        layout.addWidget(show_extensions_checkbox)
        layout.addWidget(remove_arrow_checkbox)
        layout.addLayout(language_layout)

        # 添加弹性空间，让链接放置到最底部
        layout.addStretch()

        # 添加网页链接样式的 QLabel
        website_label = QLabel("<a href='https://github.com/AstraSolis'>AstraSolis</a>", dialog)
        website_label.setTextInteractionFlags(Qt.TextBrowserInteraction)  # 设置为超链接可点击
        website_label.setOpenExternalLinks(True)  # 启用外部链接点击自动打开浏览器
        website_label.setAlignment(Qt.AlignHCenter)  # 居中放置
        layout.addWidget(website_label)

        dialog.exec_()  # 显示对话框

    def toggle_extensions(self, state):
        """切换显示文件后缀名"""
        self.config["show_extensions"] = state == Qt.Checked
        self.config_manager.save_config()
        self.update_file_list()

    def toggle_remove_arrow(self, enable):
        """切换是否去掉快捷方式箭头"""
        self.config["remove_arrow"] = enable
        self.config_manager.save_config()  # 保存配置
        self.update_file_list()  # 重新加载列表，更新图标

    def change_language(self, language):
        """切换语言"""
        self.config["language"] = language
        self.config_manager.save_config()  # 保存新语言到配置文件
        print(f"Language changed to: {language}")  # 调试输出
        self.retranslate_ui()  # 重新翻译并刷新UI

        # 在语言切换时，确保更新 FileFolderDialog 的语言数据并强制刷新文本
        if self.file_folder_dialog:
            self.file_folder_dialog.language_data = self.language_data  # 更新 language_data
            print(f"Updated language data in FileFolderDialog: {self.language_data}")  # 调试输出
            self.file_folder_dialog.retranslate_ui()  # 强制刷新对话框中的文本

    def open_website(self, url):
        """打开指定网址"""
        import webbrowser
        webbrowser.open(url)

    def retranslate_ui(self):
        """动态更新界面文字"""
        self.setWindowTitle(self.tr("title"))
        self.add_file_button.setText(self.tr("add_file"))
        self.settings_button.setText(self.tr("settings"))
        self.update_file_list()

if __name__ == "__main__":
    app = QApplication(sys.argv)

    window = QuickLaunchApp()
    window.show()
    sys.exit(app.exec_())