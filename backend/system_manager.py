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
        # 不再需要QFileIconProvider
        pass
    
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
            
            # 使用Win32 API获取系统图标
            try:
                icon_data = self.get_icon_win32(file_path)
                if icon_data:
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
    
    def _icon_to_bitmap(self, hicon: int) -> bytes:
        """将图标句柄转换为位图数据 - 简化版"""
        try:
            print(f"开始转换图标句柄: {hicon}")
            # 检查是否需要显示箭头
            show_arrow = False
            if self.config_manager:
                remove_arrow = self.config_manager.get("remove_arrow", False)
                show_arrow = not remove_arrow
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
                        print("添加自定义箭头")
                        # 添加箭头图标
                        arrow_icon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                                   "frontend", "assets", "img", "arrow_icon.png")
                        if os.path.exists(arrow_icon_path):
                            print(f"箭头图标路径存在: {arrow_icon_path}")
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
                            img = Image.alpha_composite(img, arrow_layer)
                            print("成功添加自定义箭头")
                        else:
                            print(f"箭头图标不存在: {arrow_icon_path}")
                    
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
            if self.config_manager:
                remove_arrow = self.config_manager.get("remove_arrow", False)

            
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
                            
                            # 如果需要显示箭头，添加自定义箭头
                            if not remove_arrow:
                                # 添加箭头图标
                                arrow_icon_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
                                                           "frontend", "assets", "img", "arrow_icon.png")
                                if os.path.exists(arrow_icon_path):
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
                                    img = Image.alpha_composite(img, arrow_layer)
            
                            
                            # 转换为PNG格式的二进制数据
                            output = io.BytesIO()
                            img.save(output, format='PNG')
                            icon_data = output.getvalue()
                            
                            if icon_data:

                                return icon_data
                    except Exception as ico_err:
                        print(f"直接读取.ico文件失败: {ico_err}")
                
                # 使用 ExtractIconEx 提取图标
                try:
                    large_icons = (ctypes.c_int * 1)()
                    small_icons = (ctypes.c_int * 1)()
                    
                    # 使用ExtractIconEx提取图标
                    num_icons = ctypes.windll.shell32.ExtractIconExW(
                        icon_file, icon_index, large_icons, small_icons, 1
                    )

                    
                    if num_icons > 0 and large_icons[0]:
                        # 转换图标为位图
                        icon_data = self._icon_to_bitmap(large_icons[0])
                        
                        # 释放图标
                        ctypes.windll.user32.DestroyIcon(large_icons[0])
                        if small_icons[0]:
                            ctypes.windll.user32.DestroyIcon(small_icons[0])
                        
                        if icon_data:

                            return icon_data
                        else:
                            print("转换图标为位图失败")
                except Exception as e:
                    print(f"从IconFile提取图标失败: {e}")
            
            # 尝试获取URL目标网站的图标
            if url and url.startswith(("http://", "https://")):
                try:

                    # 获取域名
                    from urllib.parse import urlparse
                    parsed_url = urlparse(url)
                    domain = parsed_url.netloc
                    
                    # 尝试找到与该域名相关的本地应用
                    # 例如，获取默认浏览器图标
                    # 这里可以根据需要扩展，目前简单使用Shell API
                    pass
                except Exception as e:
                    print(f"获取URL目标网站图标失败: {e}")
            
            # 使用Shell API获取图标
            try:

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
                    icon_data = self._icon_to_bitmap(info.hIcon)
                    
                    # 释放图标
                    ctypes.windll.user32.DestroyIcon(info.hIcon)
                    
                    if icon_data:

                        return icon_data
                    else:
                        print("转换URL图标为位图失败")
                else:
                    print("未能获取URL图标句柄")
            except Exception as e:
                print(f"使用Shell API获取URL图标失败: {e}")
            
            # 如果上述方法都失败，使用直接获取图标的方法
            try:

                icon_data = self.get_icon_win32(file_path)
                if icon_data:

                    return icon_data
                else:
                    print("直接获取图标失败")
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
            
            # 方法1: 尝试获取目标文件图标（无箭头）
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
                        icon_data = self.get_icon_win32(target_path)
                        if icon_data:
                            print(f"方法1成功: 获取到目标文件图标，大小: {len(icon_data)} 字节")
                            pythoncom.CoUninitialize()
                            return icon_data
                        else:
                            print("方法1失败: 无法获取目标文件图标")
                        
                    # 如果没有有效的目标路径或无法获取图标，尝试直接从快捷方式获取图标
                    print("尝试从LNK文件本身的图标位置获取")
                    icon_location = shell_link.GetIconLocation()
                    print(f"图标位置: {icon_location}")
                    
                    if icon_location and icon_location[0] and os.path.exists(icon_location[0]):
                        print(f"图标位置存在，尝试获取图标: {icon_location[0]}, 索引: {icon_location[1]}")
                        # 从指定的图标位置获取图标
                        large_icons = (ctypes.c_int * 1)()
                        small_icons = (ctypes.c_int * 1)()
                        
                        num_icons = ctypes.windll.shell32.ExtractIconExW(
                            icon_location[0], icon_location[1], large_icons, small_icons, 1
                        )
                        print(f"提取的图标数: {num_icons}")
                        
                        if num_icons > 0 and large_icons[0]:
                            print("成功提取图标，转换为位图")
                            # 转换图标为位图
                            icon_data = self._icon_to_bitmap(large_icons[0])
                            
                            # 释放图标
                            ctypes.windll.user32.DestroyIcon(large_icons[0])
                            if small_icons[0]:
                                ctypes.windll.user32.DestroyIcon(small_icons[0])
                            
                            if icon_data:
                                print(f"方法1成功: 从图标位置获取图标，大小: {len(icon_data)} 字节")
                                pythoncom.CoUninitialize()
                                return icon_data
                            else:
                                print("方法1失败: 图标转换为位图失败")
                        else:
                            print("方法1失败: 未提取到图标")
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
                
                info = SHFILEINFOW()
                # 使用SHGFI_LINKOVERLAY标志直接获取带箭头的快捷方式图标
                flags = SHGFI_ICON | SHGFI_LARGEICON
                if not remove_arrow:
                    flags |= SHGFI_LINKOVERLAY
                    print("添加SHGFI_LINKOVERLAY标志")
                
                print(f"调用SHGetFileInfoW, 文件路径: {file_path}")
                result = shell32.SHGetFileInfoW(
                    file_path, 0, ctypes.byref(info), ctypes.sizeof(info), flags
                )
                print(f"SHGetFileInfoW结果: {result}, 图标句柄: {info.hIcon}")
                
                if result and info.hIcon:
                    print("获取到图标句柄，转换为位图")
                    # 将图标转换为位图
                    icon_data = self._icon_to_bitmap(info.hIcon)
                    
                    # 释放图标
                    ctypes.windll.user32.DestroyIcon(info.hIcon)
                    
                    if icon_data:
                        print(f"方法2成功: 图标大小: {len(icon_data)} 字节")
                        return icon_data
                    else:
                        print("方法2失败: 转换图标为位图失败")
                else:
                    print("方法2失败: 未能获取图标句柄")
            except Exception as e:
                print(f"方法2失败，错误: {e}")
            
            # 方法3: 尝试直接使用ExtractIconEx
            try:
                print("方法3: 尝试直接使用ExtractIconEx")
                # 提取图标
                large_icons = (ctypes.c_int * 1)()
                small_icons = (ctypes.c_int * 1)()
                
                print(f"调用ExtractIconExW, 文件路径: {file_path}")
                # 直接从快捷方式文件提取图标
                num_icons = ctypes.windll.shell32.ExtractIconExW(
                    file_path, 0, large_icons, small_icons, 1
                )
                print(f"ExtractIconExW结果, 提取的图标数: {num_icons}")
                
                if num_icons > 0 and large_icons[0]:
                    print("成功提取图标，转换为位图")
                    # 转换图标为位图
                    icon_data = self._icon_to_bitmap(large_icons[0])
                    
                    # 释放图标
                    ctypes.windll.user32.DestroyIcon(large_icons[0])
                    if small_icons[0]:
                        ctypes.windll.user32.DestroyIcon(small_icons[0])
                    
                    if icon_data:
                        print(f"方法3成功: 图标大小: {len(icon_data)} 字节")
                        return icon_data
                    else:
                        print("方法3失败: 转换图标为位图失败")
                else:
                    print("方法3失败: 未提取到任何图标")
            except Exception as e:
                print(f"方法3失败，错误: {e}")
            
            # 默认返回空
            print("所有方法都失败，无法获取LNK图标")
            return None
        except Exception as e:
            print(f"读取LNK文件图标失败: {e}")
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