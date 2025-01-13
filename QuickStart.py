# 标准库导入
import os
import sys
import json
import ctypes

# 第三方库导入
from win32com.client import Dispatch
from win32com.shell import shell, shellcon
import win32gui
from PyQt5.QtCore import QFileInfo, Qt
from PyQt5.QtGui import QIcon, QPixmap, QFont, QKeyEvent
from PyQt5.QtWidgets import (
    QApplication, QMainWindow, QListWidget, QVBoxLayout, QPushButton, QHBoxLayout,
    QWidget, QListWidgetItem, QAbstractItemView, QMenu, QMessageBox, QInputDialog,
    QFileDialog, QDialog, QLabel, QCheckBox, QComboBox, QDialogButtonBox, QFileIconProvider
)



class QuickLaunchApp(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setAcceptDrops(True) # 启用拖拽功能
        self.config = {"files": [], "show_extensions": True, "language": "中文"}
        self.icon_provider = QFileIconProvider() # 初始化文件图标提供器



        # 多语言数据
        self.language_data = {
            "中文": {
                "title": "快捷启动文件",
                "add_file": "添加文件",
                "settings": "设置",
                "select_files": "选择文件",
                "error": "错误",
                "file_not_found": "文件未找到",
                "open_as_admin": "切换管理员权限",
                "open_location": "打开文件所在位置",
                "remark": "备注",
                "delete": "删除",
                "confirm_delete": "确定要删除选中的文件吗？",
                "add_params": "启动参数",
                "input_remark": "请输入备注：",
                "input_params": "请输入启动参数：",
                "show_extensions": "显示文件后缀名",
                "language": "语言",
            },
            "English": {
                "title": "Quick Launch Files",
                "add_file": "Add File",
                "settings": "Settings",
                "select_files": "Select Files",
                "error": "Error",
                "file_not_found": "File not found",
                "open_as_admin": "Open as Administrator",
                "open_location": "Open File Location",
                "remark": "Remark",
                "delete": "Delete",
                "confirm_delete": "Are you sure you want to delete the selected files?",
                "add_params": "Startup Parameters",
                "input_remark": "Enter remark:",
                "input_params": "Enter startup parameters:",
                "show_extensions": "Show File Extensions",
                "language": "Language",
            }
        }

        self.init_ui()  # 初始化界面
        self.load_config()  # 加载配置

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
        self.save_config()
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
            files = []
            for url in event.mimeData().urls():
                file_path = url.toLocalFile()
                if os.path.isfile(file_path):  # 只处理文件
                    files.append(file_path)

            if files:
                self.add_files_from_list(files)  # 调用统一的文件添加逻辑
        except Exception as e:
            print(f"拖拽处理时出错: {e}")

    def add_files(self):
        """通过对话框添加文件"""
        files, _ = QFileDialog.getOpenFileNames(self, "选择文件")
        if files:
            self.add_files_from_list(files)  # 调用统一的文件添加逻辑

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
                    "remark": "",
                    "admin": False,
                    "params": ""
                })

                # 添加到已存在路径集合
                existing_paths.add(file_path)
            except Exception as e:
                print(f"添加文件时出错: {e}")

        # 保存配置
        self.save_config()

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

        # 如果解析失败或文件不是 .url，返回默认图标
        return self.icon_provider.icon(QFileInfo(file_path))

    def get_all_list_items(self):
        """获取列表中的所有项目"""
        return [self.file_list_widget.item(i) for i in range(self.file_list_widget.count())]

    def save_config(self):
        """保存配置到 config.json"""
        try:
            # 去重文件列表
            unique_files = {file_info["path"]: file_info for file_info in self.config["files"]}
            self.config["files"] = list(unique_files.values())

            with open("config.json", "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
        except Exception as e:
            print(f"保存配置文件时出错: {e}")

    def load_config(self):
        """加载配置从 config.json"""
        if os.path.exists("config.json"):
            try:
                with open("config.json", "r", encoding="utf-8") as f:
                    self.config = json.load(f)
            except Exception as e:
                QMessageBox.warning(self, self.tr("error"), str(e))

        # 检查配置完整性
        valid_files = []
        for file_info in self.config.get("files", []):
            if "path" in file_info and os.path.exists(file_info["path"]):
                valid_files.append(file_info)
            else:
                print(f"无效的文件配置或路径：{file_info}")
        self.config["files"] = valid_files

        self.update_file_list()

    def update_file_list(self):
        """更新文件列表显示"""
        self.file_list_widget.clear()
        show_extensions = self.config.get("show_extensions", True)

        for file_info in self.config["files"]:
            try:
                if not file_info or "path" not in file_info:
                    continue

                # 获取文件路径和备注
                file_path = file_info.get("path", "")
                if not os.path.exists(file_path):
                    continue

                remark = file_info.get("remark", "")
                file_name = os.path.basename(file_path)
                if not show_extensions:
                    file_name = os.path.splitext(file_name)[0]

                # 构建显示名称
                display_name = file_name
                if remark:
                    display_name = f"{remark} ({display_name})"

                # 添加管理员状态和启动参数
                admin_text = "[管理员]" if file_info.get("admin", False) else ""
                params = file_info.get("params", "")
                params_text = f"[启动参数: {params}]" if params else ""

                # 获取图标并创建列表项
                icon = self.get_icon(file_path)
                item = QListWidgetItem()
                item.setToolTip(file_path)
                item.setIcon(icon)

                # 格式化显示文本，控制间距
                formatted_text = f"{display_name:<50} {admin_text:<10} {params_text}"
                item.setText(formatted_text.strip())

                # 设置固定宽度字体避免对齐问题
                font = QFont("Monospace")
                font.setStyleHint(QFont.Monospace)
                font.setPointSize(10)
                item.setFont(font)

            except Exception as e:
                print(f"更新文件列表时出错，文件信息：{file_info}, 错误：{e}")

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
                toggle_admin_action = menu.addAction(self.tr("取消管理员权限"))
            else:
                toggle_admin_action = menu.addAction(self.tr("设置管理员权限"))

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
        """打开单个文件"""
        file_path = file_info["path"]
        params = file_info.get("params", "")

        # 如果 admin 参数未指定，则根据文件配置决定是否以管理员权限运行
        if admin is None:
            admin = file_info.get("admin", False)

        if not os.path.exists(file_path):
            QMessageBox.warning(self, self.tr("error"), self.tr("file_not_found") + f": {file_path}")
            return

        try:
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
                os.startfile(file_path)
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
        self.save_config()

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

        self.save_config()

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
            admin_text = "[管理员]" if file_info.get("admin", False) else ""
            params = file_info.get("params", "")
            params_text = f"[启动参数: {params}]" if params else ""

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
        self.save_config()
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
                if not show_extensions:
                    file_name = os.path.splitext(file_name)[0]

                # 构建显示名称
                display_name = file_name
                if remark:
                    display_name = f"{remark} ({display_name})"

                # 添加管理员状态和启动参数
                admin_text = "[管理员]" if file_info.get("admin", False) else ""
                params = file_info.get("params", "")
                params_text = f"[启动参数: {params}]" if params else ""

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

    def load_config(self):
        """加载配置从 config.json"""
        if os.path.exists("config.json"):
            try:
                with open("config.json", "r", encoding="utf-8") as f:
                    self.config = json.load(f)
            except Exception as e:
                QMessageBox.warning(self, self.tr("error"), str(e))
        self.update_file_list()

    def show_settings(self):
        """显示设置窗口"""
        dialog = QDialog(self)
        dialog.setWindowTitle(self.tr("settings"))
        dialog.setFixedSize(250, 150)

        # 创建主布局
        layout = QVBoxLayout(dialog)

        # 显示后缀名选项
        show_extensions_checkbox = QCheckBox(self.tr("show_extensions"), dialog)
        show_extensions_checkbox.setChecked(self.config.get("show_extensions", True))
        show_extensions_checkbox.stateChanged.connect(lambda state: self.toggle_extensions(state))

        # 去除快捷方式箭头选项
        remove_arrow_checkbox = QCheckBox(self.tr("快捷图标箭头"), dialog)
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

        # 语言切换时立即刷新设置窗口
        def refresh_settings_ui():
            """切换语言后刷新设置窗口"""
            language_label.setText(self.tr("language"))
            show_extensions_checkbox.setText(self.tr("show_extensions"))
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
        website_label = QLabel("<a href='https://www.baidu.com'>baidu.com</a>", dialog)
        website_label.setTextInteractionFlags(Qt.TextBrowserInteraction)  # 设置为超链接可点击
        website_label.setOpenExternalLinks(True)  # 启用外部链接点击自动打开浏览器
        website_label.setAlignment(Qt.AlignHCenter)  # 居中放置
        layout.addWidget(website_label)

        dialog.exec_()  # 显示对话框

    def toggle_extensions(self, state):
        """切换显示文件后缀名"""
        self.config["show_extensions"] = state == Qt.Checked
        self.save_config()
        self.update_file_list()

    def toggle_remove_arrow(self, enable):
        """切换是否去掉快捷方式箭头"""
        self.config["remove_arrow"] = enable
        self.save_config()  # 保存配置
        self.update_file_list()  # 重新加载列表，更新图标

    def change_language(self, language):
        """切换语言"""
        self.config["language"] = language
        self.save_config()  # 保存新语言到配置文件
        self.retranslate_ui()  # 重新翻译并刷新UI

    def open_website(self, url):
        """打开指定网址"""
        import webbrowser
        webbrowser.open(url)

    def retranslate_ui(self):
        """动态更新界面文字"""
        self.setWindowTitle(self.tr("title"))
        self.add_file_button.setText(self.tr("add_file"))
        self.settings_button.setText(self.tr("settings"))


if __name__ == "__main__":
    app = QApplication(sys.argv)

    window = QuickLaunchApp()
    window.show()
    sys.exit(app.exec_())

# 测试