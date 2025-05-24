#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 标准库导入
import os
import sys
import base64
import tempfile
import io
import ctypes
import win32con
import win32ui
import win32gui
import win32api
import win32com.client
from win32com.shell import shell
from typing import Optional, Tuple
import struct
import uuid
import hashlib

# 第三方库导入
import pythoncom

# 尝试导入PIL
try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("警告: PIL模块未安装，图标可能无法正常显示。请运行 'pip install Pillow' 安装。")

class SystemManager:
    """
    系统管理类，用于处理系统相关操作
    """
    
    def __init__(self, config_manager=None):
        """初始化系统管理器"""
        # 保存配置管理器引用
        self.config_manager = config_manager
        # 初始化图标缓存
        self._icon_cache = {}
        self._lnk_icon_cache = {}
        
        # 创建图标缓存目录（修改为%APPDATA%\quickstart\icon_cache）
        appdata_path = os.environ.get('APPDATA')
        if appdata_path:
            self.cache_dir = os.path.join(appdata_path, 'quickstart', 'icon_cache')
        else:
            # 如果无法获取APPDATA环境变量，退回到用户主目录
            self.cache_dir = os.path.join(os.path.expanduser('~'), '.quickstart', 'icon_cache')
        
        os.makedirs(self.cache_dir, exist_ok=True)
        print(f"图标缓存目录: {self.cache_dir}")
        
        # 不再需要QFileIconProvider
        pass
    
    def _get_cached_icon(self, file_path: str, with_arrow: bool = False) -> Optional[bytes]:
        """
        从缓存获取图标
        
        Args:
            file_path: 文件路径
            with_arrow: 是否获取带箭头的图标版本
            
        Returns:
            缓存的图标数据，如果不存在则返回None
        """
        # 生成文件路径的哈希值作为缓存的键
        file_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()
        
        # 根据是否需要箭头选择不同的缓存文件名
        suffix = "_arrow" if with_arrow else "_plain"
        cache_file = os.path.join(self.cache_dir, f"{file_hash}{suffix}.png")
        
        # 检查缓存文件是否存在
        if os.path.exists(cache_file):
            try:
                with open(cache_file, 'rb') as f:
                    print(f"从缓存加载图标: {cache_file}")
                    return f.read()
            except Exception as e:
                print(f"读取缓存图标失败: {e}")
        
        return None
    
    def _save_icon_to_cache(self, file_path: str, icon_data: bytes, with_arrow: bool = False) -> None:
        """
        保存图标到缓存
        
        Args:
            file_path: 文件路径
            icon_data: 图标数据
            with_arrow: 是否为带箭头的图标版本
        """
        if not icon_data:
            return
        
        # 生成文件路径的哈希值作为缓存的键
        file_hash = hashlib.md5(file_path.encode('utf-8')).hexdigest()
        
        # 根据是否需要箭头选择不同的缓存文件名
        suffix = "_arrow" if with_arrow else "_plain"
        cache_file = os.path.join(self.cache_dir, f"{file_hash}{suffix}.png")
        
        try:
            with open(cache_file, 'wb') as f:
                f.write(icon_data)
                print(f"图标已缓存: {cache_file}")
        except Exception as e:
            print(f"缓存图标失败: {e}")
    
    def get_file_icon_base64(self, file_path: str) -> Optional[str]:
        """
        获取文件图标并转换为Base64编码的字符串
        
        Args:
            file_path: 文件路径
            
        Returns:
            Base64编码的图标数据，失败则返回None
        """
        try:
            if not os.path.exists(file_path):
                return None
            
            # 检查文件类型
            is_shortcut = file_path.lower().endswith(('.lnk', '.url'))
            
            # 如果是快捷方式，使用专门的方法处理
            if is_shortcut:
                # 获取设置中是否移除箭头
                remove_arrow = False
                if self.config_manager:
                    remove_arrow = self.config_manager.get("remove_arrow", False)
                
                # 根据设置选择使用带箭头还是不带箭头的图标
                with_arrow = not remove_arrow
                
                # 尝试从缓存获取图标
                cached_icon = self._get_cached_icon(file_path, with_arrow)
                if cached_icon:
                    return base64.b64encode(cached_icon).decode('utf-8')
                
                # 如果是.lnk文件
                if file_path.lower().endswith('.lnk'):
                    icon_data = self.get_lnk_icon(file_path)
                    if icon_data:
                        return base64.b64encode(icon_data).decode('utf-8')
                
                # 如果是.url文件
                elif file_path.lower().endswith('.url'):
                    icon_data = self.get_url_icon(file_path)
                    if icon_data:
                        return base64.b64encode(icon_data).decode('utf-8')
            
            # 对于普通文件，尝试从缓存获取
            cached_icon = self._get_cached_icon(file_path, False)
            if cached_icon:
                return base64.b64encode(cached_icon).decode('utf-8')
            
            # 使用Win32 API获取系统图标
            try:
                icon_data = self.get_icon_win32(file_path)
                if icon_data:
                    # 缓存普通文件图标
                    self._save_icon_to_cache(file_path, icon_data, False)
                    return base64.b64encode(icon_data).decode('utf-8')
            except Exception as e:
                print(f"使用Win32获取图标失败: {e}")
                return None
            
            return None
        
        except Exception as e:
            print(f"获取文件图标时出错: {e}")
            return None
    
    def get_icon_win32(self, file_path: str) -> Optional[bytes]:
        """
        使用Win32 API获取文件图标
        
        Args:
            file_path: 文件路径
            
        Returns:
            图标二进制数据
        """
        try:
            # 获取文件的SHFILEINFO结构
            SHGFI_ICON = 0x000000100
            SHGFI_LARGEICON = 0x000000000  # 大图标
            SHIL_EXTRALARGE = 0x2  # 使用额外大图标获取更清晰的图标
            
            shell32 = ctypes.windll.shell32
            
            # 先尝试获取额外大图标
            hicon = self._extract_icon(file_path)
            
            if not hicon:
                # 如果失败，尝试使用SHGetFileInfo获取图标
                file_info = self._get_file_info(file_path, SHGFI_ICON | SHGFI_LARGEICON)
                if not file_info:
                    return None
                
                hicon = file_info.hIcon
            
            # 将图标转换为位图
            icon_data = self._icon_to_bitmap(hicon)
            
            # 销毁图标
            ctypes.windll.user32.DestroyIcon(hicon)
            
            return icon_data
        except Exception as e:
            print(f"Win32获取图标失败: {e}")
            return None
    
    def _extract_icon(self, file_path: str) -> Optional[int]:
        """提取文件关联的图标句柄"""
        try:
            # 使用ExtractIconEx获取图标
            # 此API从可执行文件、DLL或图标文件中提取图标
            large_icons = (ctypes.c_int * 1)()
            small_icons = (ctypes.c_int * 1)()
            
            # 提取第一个图标
            num_icons = ctypes.windll.shell32.ExtractIconExW(
                file_path, 0, large_icons, small_icons, 1
            )
            
            if num_icons > 0:
                # 释放小图标
                if small_icons[0]:
                    ctypes.windll.user32.DestroyIcon(small_icons[0])
                    
                # 返回大图标
                return large_icons[0]
            
            return None
        except Exception as e:
            print(f"提取图标失败: {e}")
            return None
    
    def _get_file_info(self, file_path: str, flags: int) -> Optional[ctypes.Structure]:
        """获取文件信息结构"""
        try:
            class SHFILEINFOW(ctypes.Structure):
                _fields_ = [
                    ("hIcon", ctypes.c_void_p),
                    ("iIcon", ctypes.c_int),
                    ("dwAttributes", ctypes.c_ulong),
                    ("szDisplayName", ctypes.c_wchar * 260),
                    ("szTypeName", ctypes.c_wchar * 80)
                ]
            
            info = SHFILEINFOW()
            result = ctypes.windll.shell32.SHGetFileInfoW(
                file_path, 0, ctypes.byref(info), ctypes.sizeof(info), flags
            )
            
            if result and info.hIcon:
                return info
            
            return None
        except Exception as e:
            print(f"获取文件信息失败: {e}")
            return None
    
    def _icon_to_bitmap(self, hicon: int, add_arrow: bool = False) -> bytes:
        """将图标句柄转换为位图数据 - 简化版"""
        try:
            print(f"开始转换图标句柄: {hicon}")
            # 检查是否需要显示箭头
            show_arrow = False
            if add_arrow and self.config_manager:
                remove_arrow = self.config_manager.get("remove_arrow", False)
                show_arrow = not remove_arrow and add_arrow
                print(f"移除箭头设置: {remove_arrow}, 显示箭头: {show_arrow}")
            
            # 获取图标尺寸
            sz = self._get_icon_size(hicon)
            if not sz:
                sz = (48, 48)  # 默认尺寸
            
            # 使用固定尺寸以确保一致性
            target_size = (64, 64)
            print(f"原始图标尺寸: {sz}, 目标尺寸: {target_size}")
            
            # 创建设备上下文
            dc = win32ui.CreateDCFromHandle(win32gui.GetDC(0))
            memdc = dc.CreateCompatibleDC()
            
            # 创建位图
            bmp = win32ui.CreateBitmap()
            bmp.CreateCompatibleBitmap(dc, target_size[0], target_size[1])
            memdc.SelectObject(bmp)
            
            # 清空位图（设置透明背景）
            win32gui.FillRect(memdc.GetHandleOutput(), (0, 0, target_size[0], target_size[1]), win32gui.GetStockObject(0))
            
            # 使用标准标志绘制图标
            try:
                win32gui.DrawIconEx(
                    memdc.GetHandleOutput(),
                    0, 0,
                    hicon,
                    target_size[0], target_size[1],
                    0, None,
                    win32con.DI_NORMAL  # 使用标准标志
                )
                print("成功绘制图标")
            except Exception as draw_err:
                print(f"绘制图标失败: {draw_err}")
                raise
            
            # 获取位图数据
            try:
                bits = bmp.GetBitmapBits(True)
                print(f"获取到位图数据, 大小: {len(bits)} 字节")
            except Exception as bits_err:
                print(f"获取位图数据失败: {bits_err}")
                raise
            
            # 使用PIL处理图像
            if PIL_AVAILABLE:
                try:
                    img = Image.frombuffer(
                        'RGBA', (target_size[0], target_size[1]), bits, 'raw', 'BGRA', 0, 1
                    )
                    
                    # 如果需要显示箭头，添加自定义箭头
                    if show_arrow:
                        img = self._add_arrow_to_icon(img)
                        if img:
                            return img
                    
                    # 保存为PNG
                    output = io.BytesIO()
                    img.save(output, format="PNG", optimize=True)
                    png_data = output.getvalue()
                    print(f"成功转换为PNG, 大小: {len(png_data)} 字节")
                    return png_data
                except Exception as pil_err:
                    print(f"PIL处理图像失败: {pil_err}")
                    # 如果PIL处理失败，尝试直接返回位图数据
                    return bits
            else:
                # 如果PIL不可用，直接返回位图数据
                print("PIL不可用，直接返回位图数据")
                return bits
                
        except Exception as e:
            print(f"图标转换为位图完全失败: {e}")
            import traceback
            traceback.print_exc()
            
            # 在所有方法都失败的情况下，返回一个空白图标
            try:
                if PIL_AVAILABLE:
                    # 创建一个空白图标
                    img = Image.new('RGBA', (64, 64), (200, 200, 200, 255))
                    output = io.BytesIO()
                    img.save(output, format="PNG")
                    print("返回空白图标")
                    return output.getvalue()
            except:
                pass
            
            # 如果连空白图标都创建失败，返回None
            return None
    
    def _get_icon_size(self, hicon: int) -> Optional[Tuple[int, int]]:
        """获取图标尺寸"""
        try:
            # 尝试使用win32gui获取图标尺寸
            return win32gui.GetIconDimensions(hicon)
        except Exception:
            try:
                # 备选方法：从icon info获取
                icon_info = win32gui.GetIconInfo(hicon)
                if icon_info:
                    hbm_mask = icon_info[3]
                    hbm_color = icon_info[4]
                    
                    # 获取位图信息
                    bm = win32gui.GetObject(hbm_color)
                    if bm:
                        width = bm.bmWidth
                        height = bm.bmHeight
                        
                        # 释放位图资源
                        win32gui.DeleteObject(hbm_mask)
                        win32gui.DeleteObject(hbm_color)
                        
                        return (width, height)
            except Exception as e:
                print(f"获取图标尺寸失败: {e}")
                
            return None
    
    def get_url_icon(self, file_path: str) -> Optional[bytes]:
        """获取.url文件的图标"""
        try:
            # 检查是否需要显示箭头
            remove_arrow = False
            if self.config_manager:
                remove_arrow = self.config_manager.get("remove_arrow", False)
                
            # 尝试从缓存获取图标(不带箭头的版本)
            cached_plain_icon = self._get_cached_icon(file_path, False)
            if cached_plain_icon:
                # 如果需要不带箭头的图标且缓存中有，直接返回
                if remove_arrow:
                    return cached_plain_icon
                else:
                    # 查看是否有带箭头的缓存版本
                    cached_arrow_icon = self._get_cached_icon(file_path, True)
                    if cached_arrow_icon:
                        return cached_arrow_icon
            
            # 缓存中没有找到，需要重新获取图标
            
            # 先尝试使用 URL 文件中指定的图标
            icon_file = None
            icon_index = 0
            url = ""
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if line.startswith("IconFile="):
                            icon_file = line.split("=", 1)[1].strip()
                        elif line.startswith("IconIndex="):
                            try:
                                icon_index = int(line.split("=", 1)[1].strip())
                            except ValueError:
                                pass
                        elif line.startswith("URL="):
                            url = line.split("=", 1)[1].strip()
            except Exception as e:
                print(f"解析URL文件失败: {e}")

            # 获取原始图标
            original_icon_data = None
            
            # 如果有有效的 IconFile 路径，尝试加载图标
            if icon_file and os.path.exists(icon_file):
                # 检查是否是.ico文件
                if icon_file.lower().endswith('.ico') and PIL_AVAILABLE:
                    try:
                        # 使用PIL直接读取.ico文件
                        with Image.open(icon_file) as ico:
                            if hasattr(ico, 'n_frames') and ico.n_frames > icon_index:
                                # 多帧图标，尝试获取指定索引
                                try:
                                    ico.seek(icon_index)
                                except:
                                    pass
                            
                            # 确保转换为RGBA模式
                            if ico.mode != 'RGBA':
                                ico = ico.convert('RGBA')
                            
                            # 调整尺寸
                            target_size = (64, 64)
                            # 使用高质量调整大小
                            try:
                                ico = ico.resize(target_size, Image.LANCZOS)
                            except AttributeError:
                                ico = ico.resize(target_size, Image.ANTIALIAS)
                            
                            # 创建一个新的图像并粘贴原始图标
                            img = Image.new('RGBA', target_size, (0, 0, 0, 0))
                            img.paste(ico, (0, 0), ico)
                            
                            # 保存原始版本(不带箭头)
                            output = io.BytesIO()
                            img.save(output, format='PNG')
                            original_icon_data = output.getvalue()
                            
                            # 缓存原始版本
                            self._save_icon_to_cache(file_path, original_icon_data, False)
                            
                            # 创建带箭头版本
                            arrow_icon_data = self._add_arrow_to_icon(img)
                            if arrow_icon_data:
                                # 缓存带箭头版本
                                self._save_icon_to_cache(file_path, arrow_icon_data, True)
                            
                            # 根据设置返回相应版本
                            if remove_arrow:
                                return original_icon_data
                            else:
                                return arrow_icon_data or original_icon_data
                    except Exception as ico_err:
                        print(f"直接读取.ico文件失败: {ico_err}")
            
            # 如果上述方法都失败，使用Shell API或直接方法获取图标
            try:
                # 尝试使用Shell API获取URL图标
                shell32 = ctypes.windll.shell32
                SHGFI_ICON = 0x000000100
                SHGFI_LARGEICON = 0x000000000
                
                class SHFILEINFOW(ctypes.Structure):
                    _fields_ = [
                        ("hIcon", ctypes.c_void_p),
                        ("iIcon", ctypes.c_int),
                        ("dwAttributes", ctypes.c_ulong),
                        ("szDisplayName", ctypes.c_wchar * 260),
                        ("szTypeName", ctypes.c_wchar * 80)
                    ]
                
                info = SHFILEINFOW()
                result = shell32.SHGetFileInfoW(
                    file_path, 0, ctypes.byref(info), ctypes.sizeof(info), 
                    SHGFI_ICON | SHGFI_LARGEICON
                )
                
                if result and info.hIcon:
                    # 将图标转换为位图
                    original_icon_data = self._icon_to_bitmap(info.hIcon, False)  # 不带箭头
                    
                    # 释放图标
                    ctypes.windll.user32.DestroyIcon(info.hIcon)
                    
                    if original_icon_data:
                        # 缓存原始版本
                        self._save_icon_to_cache(file_path, original_icon_data, False)
                        
                        # 如果有PIL可用，创建带箭头版本
                        if PIL_AVAILABLE:
                            try:
                                img = Image.open(io.BytesIO(original_icon_data))
                                arrow_icon_data = self._add_arrow_to_icon(img)
                                if arrow_icon_data:
                                    # 缓存带箭头版本
                                    self._save_icon_to_cache(file_path, arrow_icon_data, True)
                                    
                                    # 根据设置返回相应版本
                                    if remove_arrow:
                                        return original_icon_data
                                    else:
                                        return arrow_icon_data
                            except Exception as e:
                                print(f"创建带箭头版本图标失败: {e}")
                        
                        # 如果无法创建带箭头版本或不需要箭头，返回原始版本
                        return original_icon_data
            except Exception as e:
                print(f"使用Shell API获取URL图标失败: {e}")
            
            # 最后尝试直接获取图标
            try:
                original_icon_data = self.get_icon_win32(file_path)
                if original_icon_data:
                    # 缓存原始版本
                    self._save_icon_to_cache(file_path, original_icon_data, False)
                    
                    # 如果有PIL可用，创建带箭头版本
                    if PIL_AVAILABLE:
                        try:
                            img = Image.open(io.BytesIO(original_icon_data))
                            arrow_icon_data = self._add_arrow_to_icon(img)
                            if arrow_icon_data:
                                # 缓存带箭头版本
                                self._save_icon_to_cache(file_path, arrow_icon_data, True)
                                
                                # 根据设置返回相应版本
                                if remove_arrow:
                                    return original_icon_data
                                else:
                                    return arrow_icon_data
                        except Exception as e:
                            print(f"创建带箭头版本图标失败: {e}")
                    
                    # 如果无法创建带箭头版本或不需要箭头，返回原始版本
                    return original_icon_data
            except Exception as e:
                print(f"直接获取图标失败: {e}")
            
            return None
        except Exception as e:
            print(f"处理URL文件图标时出错: {e}")
            return None
    
    def get_lnk_icon(self, file_path: str) -> Optional[bytes]:
        """获取.lnk快捷方式文件的图标"""
        try:
            print(f"开始获取LNK图标: {file_path}")
            # 检查是否需要移除箭头
            remove_arrow = False
            if self.config_manager:
                remove_arrow = self.config_manager.get("remove_arrow", False)
                print(f"移除箭头设置: {remove_arrow}")
            
            # 尝试从缓存获取图标
            with_arrow = not remove_arrow
            cached_icon = self._get_cached_icon(file_path, with_arrow)
            if cached_icon:
                print(f"使用缓存的图标(带箭头={with_arrow})")
                return cached_icon
            
            # 方法1: 尝试获取目标文件图标（无箭头）
            original_icon_data = None
            try:
                print("方法1: 尝试获取目标文件图标")
                # 初始化COM环境以获取目标路径
                pythoncom.CoInitialize()
                try:
                    # 使用 ShellLink 接口获取目标路径 - 更可靠的方式
                    shell_link = pythoncom.CoCreateInstance(
                        shell.CLSID_ShellLink, None,
                        pythoncom.CLSCTX_INPROC_SERVER, shell.IID_IShellLink
                    )
                    persist_file = shell_link.QueryInterface(pythoncom.IID_IPersistFile)
                    persist_file.Load(file_path)
                    
                    # 获取目标路径
                    target_path, _ = shell_link.GetPath(0)
                    print(f"获取到的目标路径: {target_path}")
                    
                    if target_path and os.path.exists(target_path):
                        print(f"目标路径存在，尝试获取目标图标")
                        # 直接获取目标文件的图标
                        original_icon_data = self.get_icon_win32(target_path)
                        if original_icon_data:
                            print(f"方法1成功: 获取到目标文件图标，大小: {len(original_icon_data)} 字节")
                            # 缓存不带箭头的原始版本
                            self._save_icon_to_cache(file_path, original_icon_data, False)
                            
                            # 如果需要带箭头的版本
                            if not remove_arrow and PIL_AVAILABLE:
                                try:
                                    img = Image.open(io.BytesIO(original_icon_data))
                                    arrow_icon_data = self._add_arrow_to_icon(img)
                                    if arrow_icon_data:
                                        # 缓存带箭头版本
                                        self._save_icon_to_cache(file_path, arrow_icon_data, True)
                                        pythoncom.CoUninitialize()
                                        return arrow_icon_data
                                except Exception as e:
                                    print(f"创建带箭头版本图标失败: {e}")
                            
                            # 如果不需要箭头或创建失败，返回原始版本
                            pythoncom.CoUninitialize()
                            return original_icon_data
                        else:
                            print("方法1失败: 无法获取目标文件图标")
                finally:
                    pythoncom.CoUninitialize()
            except Exception as e:
                print(f"方法1失败，错误: {e}")
            
            # 方法2: 使用Shell API获取快捷方式图标
            try:
                print("方法2: 使用Shell API获取快捷方式图标")
                shell32 = ctypes.windll.shell32
                SHGFI_ICON = 0x000000100
                SHGFI_LARGEICON = 0x000000000
                SHGFI_LINKOVERLAY = 0x000008000  # 使链接覆盖可见
                
                # 使用SHGFI_ICON直接获取图标
                class SHFILEINFOW(ctypes.Structure):
                    _fields_ = [
                        ("hIcon", ctypes.c_void_p),
                        ("iIcon", ctypes.c_int),
                        ("dwAttributes", ctypes.c_ulong),
                        ("szDisplayName", ctypes.c_wchar * 260),
                        ("szTypeName", ctypes.c_wchar * 80)
                    ]
                
                # 先获取不带箭头的图标
                info = SHFILEINFOW()
                print(f"调用SHGetFileInfoW获取不带箭头图标, 文件路径: {file_path}")
                result = shell32.SHGetFileInfoW(
                    file_path, 0, ctypes.byref(info), ctypes.sizeof(info), 
                    SHGFI_ICON | SHGFI_LARGEICON
                )
                print(f"SHGetFileInfoW结果: {result}, 图标句柄: {info.hIcon}")
                
                if result and info.hIcon:
                    print("获取到图标句柄，转换为位图")
                    # 将图标转换为位图
                    original_icon_data = self._icon_to_bitmap(info.hIcon, False)  # 确保不带箭头
                    
                    # 释放图标
                    ctypes.windll.user32.DestroyIcon(info.hIcon)
                    
                    if original_icon_data:
                        print(f"成功获取不带箭头的图标, 大小: {len(original_icon_data)} 字节")
                        # 缓存不带箭头的原始版本
                        self._save_icon_to_cache(file_path, original_icon_data, False)
                        
                        # 然后获取带箭头的图标
                        if not remove_arrow:
                            # 方法1: 使用SHGFI_LINKOVERLAY标志
                            info = SHFILEINFOW()
                            print("添加SHGFI_LINKOVERLAY标志获取带箭头图标")
                            result = shell32.SHGetFileInfoW(
                                file_path, 0, ctypes.byref(info), ctypes.sizeof(info), 
                                SHGFI_ICON | SHGFI_LARGEICON | SHGFI_LINKOVERLAY
                            )
                            
                            if result and info.hIcon:
                                # 将图标转换为位图
                                arrow_icon_data = self._icon_to_bitmap(info.hIcon, False)  # 不再手动添加箭头
                                
                                # 释放图标
                                ctypes.windll.user32.DestroyIcon(info.hIcon)
                                
                                if arrow_icon_data:
                                    print(f"成功获取带箭头的图标, 大小: {len(arrow_icon_data)} 字节")
                                    # 缓存带箭头版本
                                    self._save_icon_to_cache(file_path, arrow_icon_data, True)
                                    return arrow_icon_data
                            
                            # 方法2: 如果SHGFI_LINKOVERLAY失败，尝试手动添加箭头
                            if PIL_AVAILABLE:
                                try:
                                    img = Image.open(io.BytesIO(original_icon_data))
                                    arrow_icon_data = self._add_arrow_to_icon(img)
                                    if arrow_icon_data:
                                        # 缓存带箭头版本
                                        self._save_icon_to_cache(file_path, arrow_icon_data, True)
                                        return arrow_icon_data
                                except Exception as e:
                                    print(f"创建带箭头版本图标失败: {e}")
                        
                        # 如果不需要箭头或无法创建带箭头版本，返回原始版本
                        return original_icon_data
                    else:
                        print("方法2失败: 转换图标为位图失败")
                else:
                    print("方法2失败: 未能获取图标句柄")
            except Exception as e:
                print(f"方法2失败，错误: {e}")
            
            # 默认返回空
            print("所有方法都失败，无法获取LNK图标")
            return None
        except Exception as e:
            print(f"读取LNK文件图标失败: {e}")
            return None
    
    def _add_arrow_to_icon(self, img) -> Optional[bytes]:
        """
        向图标添加箭头
        
        Args:
            img: PIL Image对象，原始图标
            
        Returns:
            添加了箭头的图标二进制数据，失败则返回None
        """
        if not PIL_AVAILABLE:
            return None
        
        try:
            # 确保图像是RGBA模式
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # 获取原始图像大小
            target_size = img.size
            
            # 添加箭头图标
            arrow_icon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                           "frontend", "assets", "img", "arrow_icon.png")
            
            if not os.path.exists(arrow_icon_path):
                print(f"箭头图标不存在: {arrow_icon_path}")
                # 尝试创建临时箭头
                arrow_icon_path = self._find_arrow_icon()
                if not arrow_icon_path:
                    return None
            
            print(f"使用箭头图标: {arrow_icon_path}")
            arrow_img = Image.open(arrow_icon_path).convert('RGBA')
            
            # 箭头尺寸为图标的40%
            arrow_size = int(target_size[0] * 0.4)
            try:
                arrow_img = arrow_img.resize((arrow_size, arrow_size), Image.LANCZOS)
            except AttributeError:
                arrow_img = arrow_img.resize((arrow_size, arrow_size), Image.ANTIALIAS)
            
            # 箭头位置（左下角）
            paste_x = int(target_size[0] * 0.1)
            paste_y = target_size[1] - int(target_size[1] * 0.1) - arrow_size
            
            # 创建透明层用于箭头
            arrow_layer = Image.new('RGBA', target_size, (0, 0, 0, 0))
            arrow_layer.paste(arrow_img, (paste_x, paste_y), arrow_img)
            
            # 添加箭头
            result_img = Image.alpha_composite(img, arrow_layer)
            
            # 转换为PNG格式的二进制数据
            output = io.BytesIO()
            result_img.save(output, format='PNG')
            
            print("成功添加箭头到图标")
            return output.getvalue()
        except Exception as e:
            print(f"添加箭头到图标失败: {e}")
            return None
    
    def _find_arrow_icon(self) -> Optional[str]:
        """查找箭头图标文件，返回找到的第一个有效路径"""
        try:
            # 查找的潜在路径列表
            possible_paths = [
                # 开发环境
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                            "frontend", "assets", "img", "arrow_icon.png"),
                # 打包环境
                os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                            "assets", "img", "arrow_icon.png"),
                # 备用路径
                os.path.join(os.path.dirname(os.path.abspath(__file__)), 
                            "assets", "img", "arrow_icon.png")
            ]
            
            # 检查每个可能的路径
            for p in possible_paths:
                if os.path.exists(p):
                    print(f"找到箭头图标: {p}")
                    return p
            
            # 特殊处理：复制箭头图标到临时目录并返回路径
            try:
                print("未找到箭头图标，尝试临时创建一个")
                temp_dir = tempfile.gettempdir()
                temp_arrow_path = os.path.join(temp_dir, "arrow_icon.png")
                
                # 如果已经存在，直接返回
                if os.path.exists(temp_arrow_path):
                    print(f"找到临时箭头图标: {temp_arrow_path}")
                    return temp_arrow_path
                    
                # 创建一个简单的箭头图标
                from PIL import Image, ImageDraw
                img = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
                draw = ImageDraw.Draw(img)
                
                # 绘制一个简单的箭头
                draw.polygon([(8, 8), (24, 8), (16, 24)], fill=(0, 0, 160, 230))
                
                # 保存
                img.save(temp_arrow_path, format='PNG')
                print(f"已创建临时箭头图标: {temp_arrow_path}")
                return temp_arrow_path
            except Exception as e:
                print(f"创建临时箭头图标失败: {e}")
                return None
        except Exception as e:
            print(f"查找箭头图标失败: {e}")
            return None
    
    def open_file_location(self, file_path: str) -> bool:
        """
        打开文件所在位置
        
        Args:
            file_path: 文件路径
            
        Returns:
            成功打开返回True，否则返回False
        """
        try:
            if not os.path.exists(file_path):
                return False
            
            folder_path = os.path.dirname(file_path)
            if os.path.exists(folder_path):
                os.startfile(folder_path)
                return True
            else:
                return False
        except Exception as e:
            print(f"打开文件位置时出错: {e}")
            return False
    
    def is_admin(self) -> bool:
        """
        检查当前程序是否以管理员权限运行
        
        Returns:
            是否以管理员权限运行
        """
        try:
            import ctypes
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except Exception:
            return False
    
    def convert_icon_to_base64(self, icon_path: str) -> Optional[str]:
        """
        将图标文件转换为Base64编码
        
        Args:
            icon_path: 图标文件路径
            
        Returns:
            Base64编码的图标数据，失败则返回None
        """
        try:
            if not os.path.exists(icon_path):
                return None
            
            # 使用PIL处理图像
            if PIL_AVAILABLE:
                img = Image.open(icon_path)
                img_byte_arr = io.BytesIO()
                img.save(img_byte_arr, format='PNG')
                img_data = img_byte_arr.getvalue()
                return base64.b64encode(img_data).decode('utf-8')
            else:
                # 直接读取文件
                with open(icon_path, 'rb') as f:
                    return base64.b64encode(f.read()).decode('utf-8')
        except Exception as e:
            print(f"转换图标时出错: {e}")
            return None
    
    def get_os_info(self) -> dict:
        """
        获取操作系统信息
        
        Returns:
            包含操作系统信息的字典
        """
        try:
            import platform
            
            os_info = {
                'system': platform.system(),
                'release': platform.release(),
                'version': platform.version(),
                'machine': platform.machine(),
                'processor': platform.processor(),
                'python_version': platform.python_version(),
            }
            
            return os_info
        except Exception as e:
            print(f"获取操作系统信息时出错: {e}")
            return {
                'system': 'Unknown',
                'error': str(e)
            } 