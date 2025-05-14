#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 标准库导入
import os
import sys
import json
from typing import Dict, Any, List, Optional

class LanguageManager:
    """
    语言管理类，用于处理应用程序的多语言翻译
    """
    
    def __init__(self, lang_file: str = "languages.json"):
        """
        初始化语言管理器
        
        Args:
            lang_file: 语言文件路径
        """
        # 判断是否在打包环境中
        if getattr(sys, 'frozen', False):  # 如果是打包后的可执行文件
            self.lang_file = os.path.join(sys._MEIPASS, lang_file)  # 获取打包后的路径
        else:
            self.lang_file = lang_file  # 使用开发环境中的路径
            
        self.languages = self.load_languages()

    def load_languages(self) -> Dict[str, Dict[str, str]]:
        """
        加载语言文件
        
        Returns:
            语言配置字典，格式为 {语言名称: {键: 值}}
        """
        try:
            if os.path.exists(self.lang_file):
                with open(self.lang_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            else:
                print(f"语言文件不存在: {self.lang_file}")
                return self._create_default_languages()
        except Exception as e:
            print(f"加载语言文件失败: {e}")
            return self._create_default_languages()

    def _create_default_languages(self) -> Dict[str, Dict[str, str]]:
        """
        创建默认语言配置
        
        Returns:
            默认语言配置字典
        """
        # 默认支持中文和英文
        default_languages = {
            "中文": {
                "title": "快速启动",
                "add_file": "添加文件",
                "settings": "设置",
                "delete": "删除",
                "remark": "备注",
                "administrator": "以管理员身份运行",
                "cancel_administrator": "取消管理员身份",
                "input_remark": "请输入备注:",
                "confirm_delete": "确定要删除选中的项目吗?",
                "file_not_found": "文件未找到",
                "show_extensions": "显示文件扩展名",
                "quick_icon_arrow": "移除快捷方式箭头",
                "language": "语言",
                "project_address": "项目地址",
                "admin_tag": "[管理员]",
                "params_tag": "[参数: {params}]",
                "select_file_or_folder": "选择文件或文件夹",
                "select_file": "选择文件",
                "select_folder": "选择文件夹",
                "only_show_folders": "仅显示文件夹",
                "file_filter": "启用文件过滤",
                "filter_placeholder": "输入文件后缀，如 .exe .txt",
                "selected_files_none": "未选择任何文件",
                "selected_files": "已选择文件",
                "confirm": "确定",
                "cancel": "取消",
                "file_types": "文件类型",
                "all_files": "所有文件 (*.*)",
                "add_params": "添加启动参数",
                "input_params": "请输入启动参数:",
                "open_location": "打开文件所在位置",
                "add_to_tray": "添加到系统托盘",
                "remove_from_tray": "从系统托盘移除",
                "tray_tag": "[系统托盘]",
                "minimize_to_tray": "最小化到系统托盘",
                "minimize_to_tray_enabled": "已启用最小化到系统托盘功能",
                "minimize_to_tray_disabled": "已禁用最小化到系统托盘功能",
                "minimize_to_tray_change_failed": "修改最小化到系统托盘设置失败",
                "add_to_tray_success": "成功添加 {count} 个项目到系统托盘",
                "add_to_tray_partial_failed": "{count} 个项目添加失败",
                "add_to_tray_failed": "添加到系统托盘失败",
                "remove_from_tray_success": "成功从系统托盘移除 {count} 个项目",
                "remove_from_tray_partial_failed": "{count} 个项目移除失败",
                "remove_from_tray_failed": "从系统托盘移除失败",
                "success": "成功",
                "warning": "警告",
                "error": "错误",
                "app_running_in_tray": "应用程序正在后台运行",
                "show": "显示主窗口",
                "exit": "退出",
                "running": "运行中",
                "minimized_to_tray": "已最小化到系统托盘",
                "reset_all": "重置所有设置和文件",
                "confirm_reset_all": "确定要重置所有设置和文件吗？此操作将删除所有配置和文件列表，无法恢复！",
                "reset_success": "已重置所有设置和文件",
                "reset_failed": "重置失败"
            },
            "English": {
                "title": "Quick Launch",
                "add_file": "Add File",
                "settings": "Settings",
                "delete": "Delete",
                "remark": "Remark",
                "administrator": "Run as Administrator",
                "cancel_administrator": "Cancel Administrator",
                "input_remark": "Please input remark:",
                "confirm_delete": "Are you sure to delete selected items?",
                "file_not_found": "File not found",
                "show_extensions": "Show file extensions",
                "quick_icon_arrow": "Remove shortcut arrow",
                "language": "Language",
                "project_address": "Project Address",
                "admin_tag": "[Admin]",
                "params_tag": "[Params: {params}]",
                "select_file_or_folder": "Select File or Folder",
                "select_file": "Select File",
                "select_folder": "Select Folder",
                "only_show_folders": "Show folders only",
                "file_filter": "Enable file filter",
                "filter_placeholder": "Input file extensions, e.g. .exe .txt",
                "selected_files_none": "No file selected",
                "selected_files": "Selected files",
                "confirm": "Confirm",
                "cancel": "Cancel",
                "file_types": "File Types",
                "all_files": "All Files (*.*)",
                "add_params": "Add Launch Parameters",
                "input_params": "Please input launch parameters:",
                "open_location": "Open File Location",
                "add_to_tray": "Add to System Tray",
                "remove_from_tray": "Remove from System Tray",
                "tray_tag": "[Tray]",
                "minimize_to_tray": "Minimize to System Tray",
                "minimize_to_tray_enabled": "Minimize to System Tray Enabled",
                "minimize_to_tray_disabled": "Minimize to System Tray Disabled",
                "minimize_to_tray_change_failed": "Failed to change minimize to tray settings",
                "add_to_tray_success": "Successfully added {count} items to system tray",
                "add_to_tray_partial_failed": "{count} items failed to add",
                "add_to_tray_failed": "Failed to add to system tray",
                "remove_from_tray_success": "Successfully removed {count} items from system tray",
                "remove_from_tray_partial_failed": "{count} items failed to remove",
                "remove_from_tray_failed": "Failed to remove from system tray",
                "success": "Success",
                "warning": "Warning",
                "error": "Error",
                "app_running_in_tray": "Application is running in the background",
                "show": "Show Window",
                "exit": "Exit",
                "running": "Running",
                "minimized_to_tray": "Minimized to System Tray",
                "reset_all": "Reset All Settings and Files",
                "confirm_reset_all": "Are you sure you want to reset all settings and files? This action will delete all configurations and file list, and cannot be undone!",
                "reset_success": "All settings and files have been reset",
                "reset_failed": "Reset failed"
            }
        }
        
        # 尝试保存默认语言文件
        try:
            with open(self.lang_file, "w", encoding="utf-8") as f:
                json.dump(default_languages, f, indent=4, ensure_ascii=False)

        except Exception as e:
            print(f"创建默认语言文件失败: {e}")
            
        return default_languages

    def get_translation(self, language: str, key: str) -> str:
        """
        获取指定语言的翻译
        
        Args:
            language: 语言名称
            key: 翻译键
            
        Returns:
            翻译值，如果不存在则返回键本身
        """
        return self.languages.get(language, {}).get(key, key)

    def get_all_translations(self, language: str) -> Dict[str, str]:
        """
        获取指定语言的所有翻译
        
        Args:
            language: 语言名称
            
        Returns:
            指定语言的所有翻译字典
        """
        return self.languages.get(language, {})

    def get_available_languages(self) -> List[str]:
        """
        获取所有可用的语言列表
        
        Returns:
            语言名称列表
        """
        return list(self.languages.keys())

    def add_translation(self, language: str, key: str, value: str) -> bool:
        """
        添加或更新翻译
        
        Args:
            language: 语言名称
            key: 翻译键
            value: 翻译值
            
        Returns:
            添加成功返回True，否则返回False
        """
        try:
            # 如果语言不存在，创建新的语言字典
            if language not in self.languages:
                self.languages[language] = {}
                
            # 添加或更新翻译
            self.languages[language][key] = value
            
            # 保存到文件
            with open(self.lang_file, "w", encoding="utf-8") as f:
                json.dump(self.languages, f, indent=4, ensure_ascii=False)
                
            return True
        except Exception as e:
            print(f"添加翻译失败: {e}")
            return False

    def add_language(self, language: str, translations: Dict[str, str]) -> bool:
        """
        添加新语言
        
        Args:
            language: 语言名称
            translations: 翻译字典
            
        Returns:
            添加成功返回True，否则返回False
        """
        try:
            self.languages[language] = translations
            
            # 保存到文件
            with open(self.lang_file, "w", encoding="utf-8") as f:
                json.dump(self.languages, f, indent=4, ensure_ascii=False)
                
            return True
        except Exception as e:
            print(f"添加语言失败: {e}")
            return False