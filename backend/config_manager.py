#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 标准库导入
import os
import json
import sys
import sqlite3
import traceback
import copy
from typing import Dict, Any, List, Optional
from datetime import datetime

class ConfigManager:
    """
    配置管理类，使用SQLite数据库处理应用程序配置的加载、保存和访问
    """
    
    def __init__(self, config_file: str = None, validate_files: bool = True):
        """
        初始化配置管理器
        
        Args:
            config_file: 配置数据库文件路径，如果不指定则使用默认路径
            validate_files: 是否验证文件路径，默认为True
        """
        # 设置数据库文件路径，替代旧的JSON文件配置
        if config_file:
            self.config_file = config_file
            if config_file.endswith('.json'):
                # 支持从旧版本迁移，将.json后缀替换为.db
                self.config_file = config_file.replace('.json', '.db')
        else:
            self.config_file = self._get_default_config_path()
            
        # 确保配置目录存在
        config_dir = os.path.dirname(self.config_file)
        if config_dir and not os.path.exists(config_dir):
            os.makedirs(config_dir, exist_ok=True)
            
        self.config = {}        # 用于内存缓存配置
        self._config_cache = {} # 配置获取缓存
        self.validate_files = validate_files  # 是否验证文件路径
        
        # 配置监听器集合
        self._listeners = {}  # {key: [listener_functions]}
        self._global_listeners = []  # 全局监听器，监听所有配置变更
        
        # 初始化SQLite数据库并加载配置
        self._init_db()
        self.load_config()
        
    def _get_default_config_path(self) -> str:
        """获取默认配置文件路径，固定为%APPDATA%\\quickstart\\config.db"""
        # 在Windows上使用APPDATA路径
        if sys.platform == 'win32':
            config_dir = os.path.join(os.environ.get('APPDATA', ''), 'quickstart')
        elif sys.platform == 'darwin':
            # macOS
            config_dir = os.path.expanduser('~/Library/Application Support/quickstart')
        else:
            # Linux/其他
            config_dir = os.path.expanduser('~/.config/quickstart')
            
        # 确保配置目录存在
        os.makedirs(config_dir, exist_ok=True)
        
        config_path = os.path.join(config_dir, 'config.db')

        return config_path
    
    def _init_db(self) -> None:
        """初始化SQLite数据库表结构"""
        try:
            conn = sqlite3.connect(self.config_file)
            cursor = conn.cursor()
            
            # 创建配置表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS config (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    type TEXT,
                    updated_at TIMESTAMP
                )
            ''')
            
            # 创建文件表
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    path TEXT UNIQUE,
                    filename TEXT,
                    remark TEXT,
                    admin INTEGER,
                    params TEXT,
                    in_tray INTEGER,
                    created_at TIMESTAMP,
                    updated_at TIMESTAMP
                )
            ''')
            
            # 检查并添加缺少的列
            self._check_and_migrate_db_columns(cursor)
            
            conn.commit()
            conn.close()

        except Exception as e:
            print(f"初始化数据库失败: {e}")
            traceback.print_exc()

    def _check_and_migrate_db_columns(self, cursor):
        """检查并添加缺少的数据库列"""
        try:
            # 检查files表结构
            cursor.execute("PRAGMA table_info(files)")
            existing_columns = {column[1] for column in cursor.fetchall()}
            
            # 检查filename列是否存在
            if 'filename' not in existing_columns:

                # 添加filename列
                cursor.execute("ALTER TABLE files ADD COLUMN filename TEXT")
                
                # 更新现有数据的filename值
                cursor.execute("SELECT id, path FROM files")
                for row in cursor.fetchall():
                    file_id = row[0]
                    path = row[1]
                    filename = os.path.basename(path) if path else ""
                    cursor.execute("UPDATE files SET filename = ? WHERE id = ?", (filename, file_id))

            
            # 可以检查其他需要添加的列...
            
        except Exception as e:
            print(f"迁移数据库结构时出错: {e}")
            traceback.print_exc()

    def _migrate_from_json(self) -> bool:
        """从旧的JSON配置文件迁移到SQLite数据库"""
        old_json_path = self.config_file.replace('.db', '.json')
        if not os.path.exists(old_json_path):
            return False
            
        try:

            with open(old_json_path, "r", encoding="utf-8") as f:
                old_config = json.load(f)
            
            # 开始迁移数据
            conn = sqlite3.connect(self.config_file)
            cursor = conn.cursor()
            
            # 先处理非files的配置项
            for key, value in old_config.items():
                if key != "files":
                    self._save_setting_to_db(cursor, key, value)
            
            # 处理文件列表
            if "files" in old_config and old_config["files"]:
                for file_info in old_config["files"]:
                    if "path" in file_info:
                        path = file_info.get("path", "")
                        # 提取文件名
                        filename = os.path.basename(path) if path else ""
                        remark = file_info.get("remark", "")
                        admin = 1 if file_info.get("admin", False) else 0
                        params = file_info.get("params", "")
                        in_tray = 1 if file_info.get("in_tray", False) else 0
                        
                        # 如果参数是复杂类型，转为JSON字符串
                        if isinstance(params, (dict, list)):
                            params = json.dumps(params, ensure_ascii=False)
                        
                        now = datetime.now().isoformat()
                        cursor.execute('''
                            INSERT OR REPLACE INTO files 
                            (path, filename, remark, admin, params, in_tray, created_at, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (path, filename, remark, admin, params, in_tray, now, now))
            
            conn.commit()
            conn.close()
            
            # 创建备份并重命名旧配置文件
            backup_path = f"{old_json_path}.bak.migrated"
            if os.path.exists(backup_path):
                os.remove(backup_path)
            os.rename(old_json_path, backup_path)

            return True
        except Exception as e:
            print(f"迁移配置失败: {e}")
            traceback.print_exc()
            return False

    def _save_setting_to_db(self, cursor, key, value) -> None:
        """将单个配置项保存到数据库"""
        try:
            value_type = type(value).__name__
            # 对于复杂类型，转换为JSON字符串
            if isinstance(value, (dict, list)):
                value_str = json.dumps(value, ensure_ascii=False)
            elif isinstance(value, bool):
                value_str = "1" if value else "0"
            else:
                value_str = str(value)
                
            now = datetime.now().isoformat()
            cursor.execute('''
                INSERT OR REPLACE INTO config (key, value, type, updated_at)
                VALUES (?, ?, ?, ?)
            ''', (key, value_str, value_type, now))
        except Exception as e:
            print(f"保存配置项 {key} 到数据库失败: {e}")
            traceback.print_exc()

    def load_config(self) -> bool:
        """
        从SQLite数据库加载配置
        
        Returns:
            成功加载返回True，否则返回False
        """
        try:
            # 检查数据库文件是否存在
            db_exists = os.path.exists(self.config_file)
            
            # 如果数据库不存在，尝试从旧的JSON文件迁移
            if not db_exists:
                json_migrated = self._migrate_from_json()
                if not json_migrated:
                    self._create_default_config()
                    return True
            
            # 连接数据库并加载配置
            conn = sqlite3.connect(self.config_file)
            conn.row_factory = sqlite3.Row  # 使结果可以通过列名访问
            cursor = conn.cursor()
            
            # 检查并升级数据库结构
            self._check_and_migrate_db_columns(cursor)
            conn.commit()
            
            # 清空当前配置缓存
            self.config = {}
            self._config_cache.clear()
            
            # 加载基本配置项
            cursor.execute("SELECT key, value, type FROM config")
            for row in cursor.fetchall():
                key = row["key"]
                value_str = row["value"]
                value_type = row["type"]
                
                # 根据类型转换值
                if value_type == "dict":
                    self.config[key] = json.loads(value_str)
                elif value_type == "list":
                    self.config[key] = json.loads(value_str)
                elif value_type == "int":
                    self.config[key] = int(value_str)
                elif value_type == "float":
                    self.config[key] = float(value_str)
                elif value_type == "bool":
                    self.config[key] = value_str == "1"
                else:
                    self.config[key] = value_str
            
            # 获取files表的所有列名
            cursor.execute("PRAGMA table_info(files)")
            column_names = [column[1] for column in cursor.fetchall()]
            
            # 动态构建查询
            columns_query = ", ".join(column_names)
            # 加载文件列表
            files = []
            try:
                query = f"SELECT {columns_query} FROM files ORDER BY id"

                cursor.execute(query)
                
                for row in cursor.fetchall():
                    file_info = {
                        "path": row["path"],
                        "remark": row["remark"],
                        "admin": bool(row["admin"]),
                        "in_tray": bool(row["in_tray"])
                    }
                    
                    # 如果filename列存在，添加到文件信息中
                    if "filename" in column_names:
                        file_info["filename"] = row["filename"]
                    else:
                        # 否则从路径中提取
                        file_info["filename"] = os.path.basename(row["path"]) if row["path"] else ""
                    
                    # 处理params，可能是JSON字符串
                    params = row["params"]
                    if params:
                        try:
                            file_info["params"] = json.loads(params)
                        except:
                            file_info["params"] = params
                    else:
                        file_info["params"] = ""
                    
                    files.append(file_info)

            except Exception as e:
                print(f"加载文件列表时出错: {e}")
                traceback.print_exc()
            
            # 设置文件列表
            self.config["files"] = files
            
            # 确保配置中有必要的键
            self.config.setdefault("language", "中文")
            self.config.setdefault("show_extensions", True)
            self.config.setdefault("remove_arrow", False)
            self.config.setdefault("minimize_to_tray", False)
            
            conn.close()
            
            # 根据设置决定是否验证文件路径
            if self.validate_files:
                self.remove_invalid_files()
            
            return True
        except Exception as e:
            print(f"加载配置失败: {e}")
            traceback.print_exc()
            self._create_default_config()
            return False

    def _create_default_config(self) -> None:
        """创建默认配置"""
        self.config = {
            "language": "中文",
            "show_extensions": True,
            "remove_arrow": False,
            "minimize_to_tray": False,
            "files": []
        }
        
        # 保存默认配置到数据库
        try:
            conn = sqlite3.connect(self.config_file)
            cursor = conn.cursor()
            
            # 保存基本配置
            for key, value in self.config.items():
                if key != "files":  # 文件列表单独处理
                    self._save_setting_to_db(cursor, key, value)
            
            conn.commit()
            conn.close()

        except Exception as e:
            print(f"创建默认配置失败: {e}")
            traceback.print_exc()

    def save_config(self) -> bool:
        """
        保存配置到SQLite数据库
        
        Returns:
            保存成功返回True，否则返回False
        """
        try:
            conn = sqlite3.connect(self.config_file)
            cursor = conn.cursor()
            
            # 保存除files以外的配置项
            for key, value in self.config.items():
                if key != "files":  # 文件列表单独处理
                    self._save_setting_to_db(cursor, key, value)
            
            # 处理文件列表，先清空再重新插入
            if "files" in self.config:
                cursor.execute("DELETE FROM files")
                
                now = datetime.now().isoformat()
                for file_info in self.config["files"]:
                    if "path" in file_info:
                        path = file_info.get("path", "")
                        # 获取文件名，优先使用已有的filename字段，否则从路径中提取
                        filename = file_info.get("filename", "")
                        if not filename and path:
                            filename = os.path.basename(path)
                        remark = file_info.get("remark", "")
                        admin = 1 if file_info.get("admin", False) else 0
                        params = file_info.get("params", "")
                        in_tray = 1 if file_info.get("in_tray", False) else 0
                        
                        # 如果参数是复杂类型，转为JSON字符串
                        if isinstance(params, (dict, list)):
                            params = json.dumps(params, ensure_ascii=False)
                        
                        cursor.execute('''
                            INSERT INTO files 
                            (path, filename, remark, admin, params, in_tray, created_at, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (path, filename, remark, admin, params, in_tray, now, now))
            
            conn.commit()
            conn.close()
            self._config_cache.clear()  # 清除缓存

            return True
        except Exception as e:
            print(f"保存配置失败: {e}")
            traceback.print_exc()
            return False

    def get(self, key: str, default: Any = None) -> Any:
        """
        获取配置项，使用缓存机制
        
        Args:
            key: 配置键名
            default: 默认值，如果键不存在则返回此值
            
        Returns:
            配置值或默认值
        """
        if key in self._config_cache:
            return self._config_cache[key]
        
        value = self.config.get(key, default)
        self._config_cache[key] = value
        return value

    def set(self, key: str, value: Any) -> bool:
        """
        设置配置项
        
        Args:
            key: 配置项键名
            value: 配置项的值
            
        Returns:
            设置成功返回True，否则返回False
        """
        try:
            # 深拷贝值以避免引用问题
            value_copy = copy.deepcopy(value)
            
            # 处理文件列表中的特殊字段
            if key == "files" and isinstance(value_copy, list):
                for file_info in value_copy:
                    if "path" in file_info and file_info["path"] != "":
                        # 确保文件名字段存在
                        if "filename" not in file_info or not file_info["filename"]:
                            file_info["filename"] = os.path.basename(file_info["path"])

            
            # 保存旧值用于通知监听器
            old_value = None
            if key in self.config:
                old_value = copy.deepcopy(self.config[key])
                
                # 检查值是否已经存在且相同
                if self.config[key] == value_copy:

                    return True
            
            # 更新内存中的配置
            self.config[key] = value_copy
            self._config_cache[key] = value_copy  # 更新缓存
            
            # 记录配置操作

            
            # 直接保存到数据库
            conn = sqlite3.connect(self.config_file)
            cursor = conn.cursor()
            
            if key == "files":
                # 如果是文件列表，先删除所有文件再重新插入
                cursor.execute("DELETE FROM files")
                
                file_count = 0
                now = datetime.now().isoformat()
                for file_info in value_copy:
                    if "path" in file_info:
                        file_count += 1
                        path = file_info.get("path", "")
                        # 获取文件名，优先使用已有的filename字段，否则从路径中提取
                        filename = file_info.get("filename", "")
                        if not filename and path:
                            filename = os.path.basename(path)
                            # 更新内存中的文件信息
                            file_info["filename"] = filename
                        remark = file_info.get("remark", "")
                        admin = 1 if file_info.get("admin", False) else 0
                        params = file_info.get("params", "")
                        in_tray = 1 if file_info.get("in_tray", False) else 0
                        
                        # 如果参数是复杂类型，转为JSON字符串
                        if isinstance(params, (dict, list)):
                            params = json.dumps(params, ensure_ascii=False)
                        
                        # 打印保存的文件信息

                        
                        cursor.execute('''
                            INSERT INTO files 
                            (path, filename, remark, admin, params, in_tray, created_at, updated_at) 
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        ''', (path, filename, remark, admin, params, in_tray, now, now))

            else:
                # 保存普通配置项
                self._save_setting_to_db(cursor, key, value_copy)
            
            # 提交更改
            conn.commit()
            conn.close()
            
            # 通知监听器
            self._notify_listeners(key, value_copy, old_value)
            
            return True
        except Exception as e:
            print(f"设置配置项 {key} 失败: {e}")
            traceback.print_exc()
            return False

    def remove_invalid_files(self, validate_existence=True) -> None:
        """
        移除无效的文件路径
        
        Args:
            validate_existence: 是否验证文件路径存在，默认为True
        """
        if not self.config.get("files"):
            return
            
        valid_files = []
        invalid_paths = []

        for file_info in self.config["files"]:
            file_path = file_info.get("path", "")
            if not validate_existence or os.path.exists(file_path):
                valid_files.append(file_info)
            else:
                invalid_paths.append(file_path)

        if invalid_paths:
            self.config["files"] = valid_files
            print(f"已删除无效文件: {', '.join(invalid_paths)}")
            self.save_config()

    def get_all_config(self) -> Dict[str, Any]:
        """
        获取所有配置
        
        Returns:
            包含所有配置的字典
        """
        return self.config.copy()  # 返回配置的副本，避免外部修改

    def reset_config(self) -> bool:
        """
        重置配置为默认值
        
        Returns:
            重置成功返回True，否则返回False
        """
        try:
            # 清空数据库
            conn = sqlite3.connect(self.config_file)
            cursor = conn.cursor()
            cursor.execute("DELETE FROM config")
            cursor.execute("DELETE FROM files")
            conn.commit()
            conn.close()
            
            # 创建默认配置
            self._create_default_config()
            return True
        except Exception as e:
            print(f"重置配置失败: {e}")
            traceback.print_exc()
            return False
            
    def get_config_path(self) -> str:
        """
        获取当前使用的配置文件路径
        
        Returns:
            配置文件路径
        """
        return self.config_file 
        
    def reset_all(self) -> bool:
        """
        重置所有设置和文件，删除配置数据库并重新创建默认配置
        
        Returns:
            重置成功返回True，否则返回False
        """
        try:
            # 清空配置
            self.config = {}
            self._config_cache = {}
            
            # 删除数据库文件（如果存在）
            if os.path.exists(self.config_file):
                try:
                    # 创建备份
                    backup_file = f"{self.config_file}.bak.reset"
                    if os.path.exists(backup_file):
                        os.remove(backup_file)
                    os.rename(self.config_file, backup_file)

                except Exception as e:
                    print(f"删除配置数据库失败: {e}")
                    traceback.print_exc()
            
            # 重新创建默认配置
            self._init_db()
            self._create_default_config()
            return True
        except Exception as e:
            print(f"重置所有设置和文件失败: {e}")
            traceback.print_exc()
            return False 

    def add_listener(self, key: str, listener) -> None:
        """
        添加配置监听器，在特定配置项更改时调用
        
        Args:
            key: 要监听的配置键，如果为None或空字符串则监听所有配置变更
            listener: 回调函数，接收参数(key, new_value, old_value)
        """
        if not key:
            # 空键表示全局监听器，监听所有配置变更
            if listener not in self._global_listeners:
                self._global_listeners.append(listener)
        else:
            # 特定键的监听器
            if key not in self._listeners:
                self._listeners[key] = []
            if listener not in self._listeners[key]:
                self._listeners[key].append(listener)
    
    def remove_listener(self, key: str, listener) -> bool:
        """
        移除配置监听器
        
        Args:
            key: 监听的配置键，如果为None或空字符串则从全局监听器中移除
            listener: 要移除的监听器函数
            
        Returns:
            成功移除返回True，未找到返回False
        """
        try:
            if not key:
                # 从全局监听器移除
                if listener in self._global_listeners:
                    self._global_listeners.remove(listener)
                    return True
                return False
            else:
                # 从特定键的监听器移除
                if key in self._listeners and listener in self._listeners[key]:
                    self._listeners[key].remove(listener)
                    if not self._listeners[key]:  # 如果列表为空，删除键
                        del self._listeners[key]
                    return True
                return False
        except Exception as e:
            print(f"移除监听器时出错: {e}")
            return False
    
    def _notify_listeners(self, key: str, new_value, old_value=None) -> None:
        """
        通知监听器配置已更改
        
        Args:
            key: 更改的配置键
            new_value: 新值
            old_value: 旧值，可选
        """
        try:
            # 通知特定键的监听器
            if key in self._listeners:
                for listener in self._listeners[key]:
                    try:
                        listener(key, new_value, old_value)
                    except Exception as e:
                        print(f"调用监听器时出错: {e}")
            
            # 通知全局监听器
            for listener in self._global_listeners:
                try:
                    listener(key, new_value, old_value)
                except Exception as e:
                    print(f"调用全局监听器时出错: {e}")
        except Exception as e:
            print(f"通知监听器过程中出错: {e}") 