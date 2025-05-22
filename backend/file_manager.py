#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 标准库导入
import os
import sys
import subprocess
import base64
from io import BytesIO
from typing import Dict, Any, List, Optional, Tuple, Union
import ctypes
import copy
import logging

# 第三方库导入
import win32com.client
from win32com.shell import shell, shellcon
import win32api
import win32con
import win32ui
import win32gui
from PIL import Image

# 获取日志记录器
logger = logging.getLogger("file_manager")

class FileManager:
    """
    文件管理类，用于处理文件相关操作
    """
    
    def __init__(self, config_manager, system_manager=None):
        """
        初始化文件管理器
        
        Args:
            config_manager: 配置管理器实例
            system_manager: 系统管理器实例
        """
        self.config_manager = config_manager
        self.system_manager = system_manager

    def add_files_from_list(self, file_paths: List[str]) -> List[Dict[str, Any]]:
        """
        从路径列表中添加文件
        
        Args:
            file_paths: 文件路径列表
            
        Returns:
            成功添加的文件信息列表
        """
        if not file_paths:
            return []
        
        # 获取当前文件列表
        files = self.config_manager.get("files", [])
        
        # 记录已存在的文件路径
        existing_paths = {file_info.get("path", "") for file_info in files}
        
        # 记录成功添加的文件
        added_files = []
        
        # 添加文件
        for file_path in file_paths:
            # 如果文件路径为空或已存在，则跳过
            if not file_path or file_path in existing_paths:
                continue

            try:
                # 判断是文件还是文件夹
                is_dir = os.path.isdir(file_path)
                
                # 获取文件名
                file_basename = os.path.basename(file_path)
                
                # 创建文件信息
                file_info = {
                    "path": file_path,
                    "filename": file_basename,  # 确保设置filename字段
                    "name": file_basename,      # 为了向后兼容
                    "is_dir": is_dir,
                    "remark": "",
                    "admin": False,
                    "params": "",
                    "in_tray": False  # 确保创建文件时包含in_tray字段
                }

                
                # 添加到文件列表和存在路径集合
                files.append(file_info)
                existing_paths.add(file_path)
                added_files.append(file_info)
                
                # 立即保存每个文件的添加，确保即使部分添加失败也能保存成功的部分
                self.config_manager.save_config()  # 使用save_config方法强制保存
                
            except Exception as e:
                logger.error(f"添加文件时出错: {e}")
                import traceback
                traceback.print_exc()
                continue

        # 如果有文件被添加，确保再次统一保存最终版本
        if added_files:
            result = self.config_manager.save_config()  # 使用save_config方法强制保存
            
            if not result:
                logger.error("最终保存文件列表失败")
        else:
            logger.info("没有新文件需要添加")
        
        return added_files

    def update_file(self, file_index: int, file_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        更新文件信息
        
        Args:
            file_index: 文件索引
            file_data: 更新的文件数据
            
        Returns:
            更新后的文件信息，如果失败则返回None
        """
        try:
            files = self.config_manager.get("files", [])
            
            # 检查索引有效性
            if file_index < 0 or file_index >= len(files):
                logger.error(f"无效的文件索引: {file_index}，有效范围: 0-{len(files)-1 if len(files) > 0 else 0}")
                return None
            
            # 保存原始文件进行比较 - 使用深拷贝
            original_file = copy.deepcopy(files[file_index])
            file_path = original_file.get("path", "未知路径")
            file_name = original_file.get("name", "未知文件")

            
            # 保留原始路径和托盘状态，只更新允许修改的字段
            allowed_fields = ["remark", "admin", "params"]
            changes_made = False
            
            # 创建修改记录
            changes = {}
            
            # 创建当前文件的深拷贝进行修改
            updated_file = copy.deepcopy(files[file_index])
            
            # 确保in_tray字段存在
            if "in_tray" not in updated_file:
                updated_file["in_tray"] = original_file.get("in_tray", False)
                changes_made = True

            
            for field in allowed_fields:
                if field in file_data:
                    old_value = original_file.get(field)
                    new_value = file_data[field]
                    
                    # 检查值是否实际变化
                    if old_value != new_value:
                        updated_file[field] = new_value
                        changes_made = True
                        changes[field] = {"old": old_value, "new": new_value}
                    else:
                        logger.info(f"字段 {field} 值未变化: {old_value}")

            
            # 只有在有变更时才保存配置
            if changes_made:
                # 保存前再次检查索引和数据有效性
                current_files = self.config_manager.get("files", [])
                if file_index >= len(current_files):
                    logger.error(f"错误: 保存前索引已无效，当前文件列表长度: {len(current_files)}")
                    return None
                    
                # 确保文件路径匹配，避免错误更新
                if current_files[file_index].get("path") != file_path:
                    logger.error(f"错误: 文件路径不匹配，期望: {file_path}, 实际: {current_files[file_index].get('path')}")
                    return None
                
                # 创建文件列表的深拷贝
                updated_files = copy.deepcopy(current_files)
                updated_files[file_index] = updated_file
                
                # 强制保存配置，确保更新内容被写入到配置文件
                result = self.config_manager.set("files", updated_files)
                
                if not result:
                    logger.error("配置保存失败")
                    return None
                
                # 验证保存成功
                saved_files = self.config_manager.get("files", [])
                if saved_files and file_index < len(saved_files):
                    saved_file = saved_files[file_index]

                    for field in changes.keys():
                        expected = changes[field]["new"]
                        actual = saved_file.get(field)
                        if actual != expected:
                            logger.warning(f"警告: 字段 {field} 保存后与期望值不匹配，期望: {expected}, 实际: {actual}")
                
                # 返回更新后的文件信息 - 获取保存后的数据
                return saved_files[file_index] if file_index < len(saved_files) else None
            else:
                logger.info("没有变更需要保存")
                return original_file
        except Exception as e:
            logger.error(f"更新文件信息时出错: {e}")
            import traceback
            traceback.print_exc()
            return None

    def delete_file(self, file_index: int) -> bool:
        """
        删除文件信息
        
        Args:
            file_index: 文件索引
            
        Returns:
            成功删除返回True，否则返回False
        """
        try:
            files = self.config_manager.get("files", [])
            
            if 0 <= file_index < len(files):
                # 获取被删除文件的路径
                deleted_path = files[file_index]["path"]
                deleted_name = files[file_index]["name"]
                
                # 从文件列表中删除
                del files[file_index]
                
                # 保存更新后的文件列表
                files_result = self.config_manager.set("files", files)
                
                if not files_result:
                    logger.error(f"保存文件列表失败: {deleted_path}")
                    return False

                return True
            else:
                logger.error(f"无效的文件索引: {file_index}")
                return False
        except Exception as e:
            logger.error(f"删除文件时出错: {e}")
            import traceback
            traceback.print_exc()
            return False

    def open_file(self, file_index: int, admin: Optional[bool] = None) -> bool:
        """
        打开文件或文件夹
        
        Args:
            file_index: 文件索引
            admin: 是否以管理员权限运行，如果为None则使用文件配置
            
        Returns:
            成功打开返回True，否则返回False
        """
        try:
            files = self.config_manager.get("files", [])
            
            if 0 <= file_index < len(files):
                file_info = files[file_index]
                file_path = file_info["path"]

                
                # 检查文件存在性
                if not os.path.exists(file_path):
                    logger.error(f"文件不存在: {file_path}")
                    return False
                
                # 如果admin参数未指定，则使用文件配置
                if admin is None:
                    admin = file_info.get("admin", False)
                
                # 获取文件扩展名
                _, ext = os.path.splitext(file_path)
                ext = ext.lower()
                
                # 根据文件类型打开文件
                if file_info.get("is_dir", False):
                    # 打开文件夹
                    os.startfile(file_path)
                    return True
                elif ext == '.url':
                    # 特殊处理URL文件
                    try:
                        # 读取URL文件内容
                        with open(file_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        # 提取URL
                        import re
                        url_match = re.search(r'URL=(.+)', content)
                        if url_match:
                            url = url_match.group(1).strip()

                            
                            # 使用默认浏览器打开URL
                            import webbrowser
                            webbrowser.open(url)
                            return True
                        else:
                            logger.info(f"无法从URL文件中提取URL: {file_path}")
                            # 如果无法提取URL，则使用默认方式打开
                            os.startfile(file_path)
                            return True
                    except Exception as e:
                        logger.error(f"处理URL文件时出错: {e}")
                        # 出错时尝试使用默认方式打开
                        os.startfile(file_path)
                        return True
                else:
                    # 其他类型文件
                    if admin:
                        # 以管理员权限运行
                        try:
                            shell.ShellExecuteEx(
                                fMask=shellcon.SEE_MASK_NOCLOSEPROCESS,
                                lpVerb="runas",
                                lpFile=file_path,
                                lpParameters=file_info.get("params", ""),
                                nShow=1
                            )
                            return True
                        except Exception as admin_error:
                            logger.error(f"以管理员权限打开文件失败: {admin_error}")
                            # 管理员权限打开失败时尝试普通方式
                            try:
                                os.startfile(file_path)
                                return True
                            except Exception as normal_error:
                                logger.error(f"普通方式打开也失败: {normal_error}")
                                return False
                    else:
                        # 普通方式运行
                        try:
                            params = file_info.get("params", "")
                            if params:
                                params_list = params.split()
                                subprocess.Popen([file_path] + params_list)
                            else:
                                os.startfile(file_path)
                            return True
                        except Exception as e:
                            logger.error(f"打开文件失败: {e}")
                            
                            # 尝试使用shell.ShellExecuteEx
                            try:
                                shell.ShellExecuteEx(
                                    fMask=shellcon.SEE_MASK_NOCLOSEPROCESS,
                                    lpVerb="open",
                                    lpFile=file_path,
                                    lpParameters=file_info.get("params", ""),
                                    nShow=1
                                )
                                return True
                            except Exception as shell_error:
                                logger.error(f"ShellExecuteEx打开失败: {shell_error}")
                                return False
                
                return True  # 默认返回成功
            else:
                logger.error(f"无效的文件索引: {file_index}")
                return False
        except Exception as e:
            logger.error(f"打开文件时出错: {e}")
            import traceback
            traceback.print_exc()
            return False

    def update_files_order(self, new_order: List[int]) -> bool:
        """
        更新文件列表顺序
        
        Args:
            new_order: 新的文件索引顺序
            
        Returns:
            成功更新返回True，否则返回False
        """
        try:
            files = self.config_manager.get("files", [])
            
            # 检查新顺序是否合法
            if len(new_order) != len(files) or not all(0 <= i < len(files) for i in new_order):
                return False
            
            # 根据新顺序重排文件列表
            new_files = [files[i] for i in new_order]
            self.config_manager.set("files", new_files)
            return True
        except Exception as e:
            logger.error(f"更新文件顺序时出错: {e}")
            return False

    def add_to_tray(self, file_index: int) -> Optional[Dict[str, Any]]:
        """
        将文件添加到系统托盘
        
        Args:
            file_index: 文件索引
            
        Returns:
            添加的托盘项信息，如果失败则返回None
        """
        try:
            files = self.config_manager.get("files", [])
            
            if 0 <= file_index < len(files):
                file_info = files[file_index]
                file_path = file_info["path"]
                
                # 检查文件是否已存在于托盘
                already_in_tray = file_info.get("in_tray", False)
                if already_in_tray:
                    return file_info
                
                # 创建文件的深拷贝，避免引用问题
                updated_file = copy.deepcopy(file_info)
                # 设置in_tray标志
                updated_file["in_tray"] = True
                
                # 更新文件列表中的对应项
                files[file_index] = updated_file
                
                # 保存配置
                result = self.config_manager.set("files", files)
                
                # 确保配置立即保存到磁盘
                if result:
                    # 显式调用save_config确保立即写入磁盘
                    self.config_manager.save_config()

                    return updated_file
                else:
                    logger.error(f"保存托盘配置失败: {file_path}")
                    return None
            else:
                logger.error(f"无效的文件索引: {file_index}")
                return None
        except Exception as e:
            logger.error(f"添加到系统托盘时出错: {e}")
            import traceback
            traceback.print_exc()
            return None

    def remove_from_tray(self, file_path: str) -> bool:
        """
        从系统托盘移除项目
        
        Args:
            file_path: 文件路径
            
        Returns:
            成功移除返回True，否则返回False
        """
        try:
            files = self.config_manager.get("files", [])
            found = False
            
            # 查找对应的文件
            for i, file_info in enumerate(files):
                if file_info.get("path") == file_path:
                    # 如果文件已在托盘中
                    if file_info.get("in_tray", False):
                        updated_file = copy.deepcopy(file_info)
                        updated_file["in_tray"] = False
                        files[i] = updated_file
                        found = True
                        break
            
            if not found:
                return False
            
            # 保存更新后的文件列表
            result = self.config_manager.set("files", files)
            
            # 确保配置立即保存到磁盘
            if result:
                # 显式调用save_config确保立即写入磁盘
                self.config_manager.save_config()

                return True
            else:
                logger.error(f"保存配置失败，无法从托盘移除: {file_path}")
                return False
        except Exception as e:
            logger.error(f"从系统托盘移除时出错: {e}")
            import traceback
            traceback.print_exc()
            return False

    def get_tray_items(self) -> List[Dict[str, Any]]:
        """
        获取托盘项列表
        
        Returns:
            托盘项列表
        """
        try:
            files = self.config_manager.get("files", [])
            # 过滤出in_tray为True的文件
            tray_items = [file for file in files if file.get("in_tray", False)]
            return tray_items
        except Exception as e:
            logger.error(f"获取托盘项列表时出错: {e}")
            import traceback
            traceback.print_exc()
            return []

    def get_file_location(self, file_index: int) -> Optional[str]:
        """
        获取文件所在位置
        
        Args:
            file_index: 文件索引
            
        Returns:
            文件所在文件夹路径，如果失败则返回None
        """
        try:
            files = self.config_manager.get("files", [])
            
            if 0 <= file_index < len(files):
                file_path = files[file_index]["path"]
                folder_path = os.path.dirname(file_path)
                
                if os.path.exists(folder_path):
                    return folder_path
            
            return None
        except Exception as e:
            logger.error(f"获取文件位置时出错: {e}")
            return None

    def get_file_icon(self, file_path: str, size: int = 32) -> Optional[str]:
        """
        获取文件系统图标并转换为base64编码的图片
        
        Args:
            file_path: 文件或文件夹的完整路径
            size: 图标尺寸，默认为32像素
            
        Returns:
            base64编码的图标数据，如果失败则返回None
        """
        try:
            # 检查文件是否存在
            if not os.path.exists(file_path):
                logger.error(f"文件不存在: {file_path}")
                return None
                
            # 获取文件图标的句柄
            # 定义常量（因win32con中没有这些值）
            SHGFI_ICON = 0x000000100
            SHGFI_SMALLICON = 0x000000001
            SHGFI_LARGEICON = 0x000000000
            
            flags = SHGFI_ICON | SHGFI_SMALLICON
            if size >= 32:
                flags = SHGFI_ICON | SHGFI_LARGEICON
            
            # 使用win32gui.GetFileAttributesEx而不是SHGetFileInfo
            try:
                # 尝试使用shell32的SHGetFileInfoW
                shell32 = ctypes.windll.shell32
                
                # 使用ctypes定义SHFILEINFO结构体，而不依赖win32gui
                class SHFILEINFOW(ctypes.Structure):
                    _fields_ = [
                        ("hIcon", ctypes.c_void_p),
                        ("iIcon", ctypes.c_int),
                        ("dwAttributes", ctypes.c_ulong),
                        ("szDisplayName", ctypes.c_wchar * 260),
                        ("szTypeName", ctypes.c_wchar * 80)
                    ]
                
                shinfo = SHFILEINFOW()
                himg = shell32.SHGetFileInfoW(
                    file_path, 0, ctypes.byref(shinfo), 
                    ctypes.sizeof(shinfo), SHGFI_ICON | SHGFI_LARGEICON
                )
                
                if not himg:
                    raise Exception("SHGetFileInfo返回0")
                
                icon_handle = shinfo.hIcon
            except Exception as e:
                # 不输出详细错误日志，使用备选方法
                # 使用ExtractIconEx作为备选方法
                large_icons = (ctypes.c_int * 1)()
                small_icons = (ctypes.c_int * 1)()
                
                # 提取图标
                num_icons = ctypes.windll.shell32.ExtractIconEx(
                    file_path, 0, large_icons, small_icons, 1
                )
                
                if num_icons <= 0:
                    return None
                
                icon_handle = large_icons[0] if size >= 32 else small_icons[0]
                
                # 释放不需要的图标
                if size >= 32 and small_icons[0]:
                    ctypes.windll.user32.DestroyIcon(small_icons[0])
                elif size < 32 and large_icons[0]:
                    ctypes.windll.user32.DestroyIcon(large_icons[0])
            
            if not icon_handle:
                logger.error(f"无法获取图标: {file_path}")
                return None
                
            # 创建一个设备上下文和位图
            hdc = win32ui.CreateDCFromHandle(win32gui.GetDC(0))
            hbmp = win32ui.CreateBitmap()
            hbmp.CreateCompatibleBitmap(hdc, size, size)
            hdc = hdc.CreateCompatibleDC()
            
            # 选择位图到设备上下文
            hdc.SelectObject(hbmp)
            
            # 设置背景为透明
            hdc.FillSolidRect((0, 0, size, size), win32api.RGB(255, 255, 255))
            
            # 绘制图标
            win32gui.DrawIconEx(hdc.GetHandleOutput(), 0, 0, icon_handle, size, size, 0, None, win32con.DI_NORMAL)
            
            # 将位图转换为PIL图像
            bmpinfo = hbmp.GetInfo()
            bmpstr = hbmp.GetBitmapBits(True)
            img = Image.frombuffer(
                'RGBA',
                (bmpinfo['bmWidth'], bmpinfo['bmHeight']),
                bmpstr, 'raw', 'BGRA', 0, 1
            )
            
            # 释放资源
            win32gui.DestroyIcon(icon_handle)
            hdc.DeleteDC()
            hbmp.DeleteObject()
            
            # 将图像转换为base64编码
            buffer = BytesIO()
            img.save(buffer, format="PNG")
            img_str = base64.b64encode(buffer.getvalue()).decode('ascii')
            
            return f"data:image/png;base64,{img_str}"
            
        except Exception as e:
            logger.error(f"获取文件图标时出错: {e}")
            return None
            
    def get_files_with_icons(self) -> List[Dict[str, Any]]:
        """获取带有图标的文件列表"""
        try:
            # 获取文件列表
            file_list = self.config_manager.get("files", [])
            
            # 转换为包含图标的文件列表
            files_with_icons = []
            
            for file_info in file_list:
                file_path = file_info["path"]
                
                # 默认图标为空
                icon_data = None
                
                # 获取文件图标，无需详细日志
                try:
                    if file_path.lower().endswith('.url'):
                        print(f"处理URL文件图标: {file_path}")
                        icon_bytes = self.system_manager.get_url_icon(file_path)
                        if icon_bytes:
                            print(f"获取到URL文件图标: {file_path}")
                            icon_data = f"data:image/png;base64,{base64.b64encode(icon_bytes).decode('utf-8')}"
                    elif file_path.lower().endswith('.lnk'):
                        print(f"处理LNK文件图标: {file_path}")
                        icon_bytes = self.system_manager.get_lnk_icon(file_path)
                        if icon_bytes:
                            print(f"获取到LNK文件图标: {file_path}，大小: {len(icon_bytes)} 字节")
                            icon_data = f"data:image/png;base64,{base64.b64encode(icon_bytes).decode('utf-8')}"
                        else:
                            print(f"LNK文件图标获取失败: {file_path}")
                    
                    # 如果上面的特殊处理失败或不是特殊文件类型，使用通用方法
                    if not icon_data:
                        print(f"使用通用方法获取图标: {file_path}")
                        icon_data = self.get_file_icon(file_path)
                        print(f"通用方法获取图标结果: {file_path}, 成功: {icon_data is not None}")
                except Exception as e:
                    # 只记录图标获取失败，但不影响流程
                    logger.error(f"获取图标失败: {str(e)}")
                    print(f"获取图标失败: {file_path}, 错误: {str(e)}")
                
                # 创建包含图标的文件信息副本
                file_with_icon = file_info.copy()
                file_with_icon["icon"] = icon_data
                
                files_with_icons.append(file_with_icon)
                
            return files_with_icons
            
        except Exception as e:
            logger.error(f"获取带图标的文件列表时出错: {e}")
            import traceback
            traceback.print_exc()
            return []

    def get_file_icon_data(self, file_path):
        """获取文件图标的Base64编码数据"""
        try:
            # 确保文件存在
            if not os.path.exists(file_path):
                logger.error(f"文件不存在: {file_path}")
                print(f"文件不存在: {file_path}")
                return None
            
            # 根据文件类型处理不同的图标获取方式
            file_ext = os.path.splitext(file_path)[1].lower()
            
            # 处理URL文件
            if file_ext == '.url':
                try:
                    print(f"处理URL文件图标(get_file_icon_data): {file_path}")
                    # 解析URL文件中的IconFile行
                    import configparser
                    config = configparser.ConfigParser()
                    config.read(file_path)
                    
                    if 'InternetShortcut' in config and 'IconFile' in config['InternetShortcut']:
                        icon_file = config['InternetShortcut']['IconFile']
                        if os.path.exists(icon_file):
                            with open(icon_file, 'rb') as f:
                                icon_data = f.read()
                                return base64.b64encode(icon_data).decode('utf-8')
                    
                    # 没有显式指定图标或找不到图标文件,使用系统方法
                    return self.get_system_icon(file_ext[1:] if file_ext.startswith('.') else file_ext)
                    
                except Exception as e:
                    logger.error(f"处理URL文件图标时出错: {str(e)}")
                    print(f"处理URL文件图标时出错: {str(e)}")
                    return self.get_system_icon(file_ext[1:] if file_ext.startswith('.') else file_ext)
            
            # 处理LNK文件 - 使用system_manager的专用方法
            elif file_ext == '.lnk':
                try:
                    print(f"处理LNK文件图标(get_file_icon_data): {file_path}")
                    if self.system_manager:
                        icon_bytes = self.system_manager.get_lnk_icon(file_path)
                        if icon_bytes:
                            print(f"获取到LNK文件图标: {file_path}, 大小: {len(icon_bytes)} 字节")
                            return base64.b64encode(icon_bytes).decode('utf-8')
                    
                    print(f"专用方法无法获取LNK图标，尝试通用方法: {file_path}")
                    # 如果system_manager的方法失败，尝试通用方法
                except Exception as e:
                    logger.error(f"处理LNK文件图标时出错: {str(e)}")
                    print(f"处理LNK文件图标时出错: {str(e)}")
            
            # 处理可执行文件和其他文件类型
            print(f"使用通用方法处理文件图标: {file_path}")
            import win32api
            import win32con
            import win32ui
            import win32gui
            
            try:
                # 获取大图标句柄
                large, small = win32gui.ExtractIconEx(file_path, 0)
                if large:
                    print(f"成功提取图标: {file_path}")
                    # 将图标转换为位图
                    hdc = win32ui.CreateDCFromHandle(win32gui.GetDC(0))
                    hbmp = win32ui.CreateBitmap()
                    hbmp.CreateCompatibleBitmap(hdc, 32, 32)
                    
                    hdc2 = hdc.CreateCompatibleDC()
                    hdc2.SelectObject(hbmp)
                    hdc2.DrawIcon((0, 0), large[0])
                    
                    # 将位图转换为字节数据
                    bmpstr = hbmp.GetBitmapBits(True)
                    
                    # 清理资源
                    win32gui.DestroyIcon(large[0])
                    if small:
                        win32gui.DestroyIcon(small[0])
                    hdc.DeleteDC()
                    hdc2.DeleteDC()
                    
                    # 转换为Base64
                    if bmpstr:
                        print(f"成功转换图标为Base64: {file_path}")
                        return base64.b64encode(bmpstr).decode('utf-8')
                    else:
                        print(f"位图数据为空: {file_path}")
                else:
                    print(f"无法提取图标: {file_path}")
            except Exception as e:
                logger.error(f"获取图标错误: {str(e)}")
                print(f"获取图标错误: {str(e)}")
            
            # 使用默认方式获取图标
            print(f"尝试使用系统图标: {file_path}")
            return self.get_system_icon(file_ext[1:] if file_ext.startswith('.') else file_ext)
            
        except Exception as e:
            logger.error(f"获取文件图标数据失败: {str(e)}")
            print(f"获取文件图标数据失败: {str(e)}")
            return None

    def get_system_icon(self, file_type):
        """根据文件类型获取系统图标"""
        try:
            # 文件类型和对应的系统图标路径映射 
            icon_map = {
                'txt': '%SystemRoot%\\System32\\imageres.dll,-102',
                'doc': '%SystemRoot%\\System32\\imageres.dll,-112',
                'docx': '%SystemRoot%\\System32\\imageres.dll,-112',
                'pdf': '%SystemRoot%\\System32\\imageres.dll,-112',
                'exe': '%SystemRoot%\\System32\\imageres.dll,-101',
                'lnk': '%SystemRoot%\\System32\\imageres.dll,-1003',
                'url': '%SystemRoot%\\System32\\imageres.dll,-178',
                'folder': '%SystemRoot%\\System32\\imageres.dll,-3',
                'file': '%SystemRoot%\\System32\\imageres.dll,-2',
            }
            
            import win32api
            import win32con
            import win32ui
            import win32gui
            
            # 获取默认图标资源
            icon_path = icon_map.get(file_type, icon_map.get('file'))
            if not icon_path:
                return None
            
            # 展开环境变量
            icon_path = win32api.ExpandEnvironmentStrings(icon_path)
            
            # 分割路径和索引
            path_parts = icon_path.split(',')
            dll_path = path_parts[0]
            icon_index = int(path_parts[1]) if len(path_parts) > 1 else 0
            
            # 提取图标
            large, small = win32gui.ExtractIconEx(dll_path, abs(icon_index), 1)
            
            if large:
                # 将图标转换为位图
                hdc = win32ui.CreateDCFromHandle(win32gui.GetDC(0))
                hbmp = win32ui.CreateBitmap()
                hbmp.CreateCompatibleBitmap(hdc, 32, 32)
                
                hdc2 = hdc.CreateCompatibleDC()
                hdc2.SelectObject(hbmp)
                hdc2.DrawIcon((0, 0), large[0])
                
                # 将位图转换为字节数据
                bmpstr = hbmp.GetBitmapBits(True)
                
                # 清理资源
                win32gui.DestroyIcon(large[0])
                if small:
                    win32gui.DestroyIcon(small[0])
                hdc.DeleteDC()
                hdc2.DeleteDC()
                
                # 转换为Base64
                if bmpstr:
                    return base64.b64encode(bmpstr).decode('utf-8')
        
        except Exception as e:
            logger.error(f"获取系统图标失败: {str(e)}")
        
        return None 