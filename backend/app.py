#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 标准库导入
import os
import sys
import json
import subprocess
import ctypes
from typing import Dict, Any, List, Optional
import base64
import urllib.parse
import logging
import datetime

# 第三方库导入
from flask import Flask, request, jsonify
from flask_cors import CORS
import win32com.client

# 添加类型注释帮助 Pylance 识别 win32com.shell 模块
# pyright: reportMissingModuleSource=false
import win32com.shell.shell  # type: ignore
import win32com.shell.shellcon  # type: ignore
from win32com.shell import shell, shellcon  # type: ignore

# 自定义模块导入
from config_manager import ConfigManager
from file_manager import FileManager
from system_manager import SystemManager
from languages import LanguageManager

# 配置日志记录器
logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.DEBUG,  # 将日志级别提高到DEBUG
    format='%(asctime)s - %(levelname)s: %(message)s'
)

# 减少Flask的日志输出
logging.getLogger('werkzeug').setLevel(logging.INFO)

# 设置其他模块的日志级别
logging.getLogger('file_manager').setLevel(logging.DEBUG)
logging.getLogger('system_manager').setLevel(logging.DEBUG)
logging.getLogger('config_manager').setLevel(logging.DEBUG)

# 创建Flask应用
app = Flask(__name__)
CORS(app)  # 启用跨域支持

# 设置JSON序列化选项
app.json.ensure_ascii = False  # 确保JSON中的非ASCII字符不会被转义
app.config['JSON_AS_ASCII'] = False  # 确保JSON响应中的非ASCII字符能够正确显示

# 禁用Flask内置开发服务器的启动消息
import werkzeug
werkzeug.serving.run_simple = lambda *args, **kwargs: werkzeug.serving.BaseWSGIServer(*args[:3]).serve_forever()

# 初始化管理器

config_manager = ConfigManager()


# 初始化语言管理器

language_manager = LanguageManager()

# 初始化系统管理器

system_manager = SystemManager(config_manager)

# 初始化文件管理器

file_manager = FileManager(config_manager, system_manager)

# 获取当前语言
current_language = config_manager.get("language", "中文")


# 确保配置文件中包含所有必需字段
def ensure_config_complete():
    """确保配置文件包含所有必需字段"""

    
    # 检查并设置默认值
    config = config_manager.get_all_config()
    changes_made = False
    
    # 确保基本设置存在
    required_fields = {
        "language": "中文",
        "show_extensions": True,
        "remove_arrow": False,
        "minimize_to_tray": False
    }
    
    for field, default_value in required_fields.items():
        if field not in config:
            config_manager.set(field, default_value)
            changes_made = True

    
    # 确保文件列表存在
    if "files" not in config:
        config_manager.set("files", [])
        changes_made = True

    
    # 迁移旧格式的托盘项列表（如果存在）
    if "tray_items" in config:

        try:
            # 迁移托盘项到文件列表的in_tray标志
            config_manager._migrate_tray_items()
            changes_made = True

        except Exception as e:
            print(f"托盘项迁移失败: {e}")
    
    # 如果有变更，保存配置
    if changes_made:
        config_manager.save_config()
    else:
        # 降低配置完整日志输出
        pass

# 确保配置完整
ensure_config_complete()

@app.route('/api/files', methods=['GET'])
def get_files():
    """获取所有文件列表"""
    try:
        files = config_manager.get("files", [])
        
        # 检查并确保所有文件条目都有filename字段
        for file_info in files:
            if "path" in file_info:
                path = file_info.get("path", "")
                # 如果没有filename字段或值为空，则从路径中提取
                if "filename" not in file_info or not file_info["filename"]:
                    filename = os.path.basename(path)
                    file_info["filename"] = filename

                
                # 检查并设置文件夹状态
                if os.path.exists(path):
                    is_dir = os.path.isdir(path)
                    file_info["is_dir"] = is_dir

                
                # 兼容性：如果没有name字段，也设置它
                if "name" not in file_info or not file_info["name"]:
                    file_info["name"] = file_info["filename"]
        
        return jsonify({
            "success": True,
            "data": files
        }), 200
    except Exception as e:
        print(f"获取文件列表时出错: {str(e)}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/with-icons', methods=['GET'])
def get_files_with_icons():
    """获取带有图标的文件列表"""
    try:
        files_with_icons = file_manager.get_files_with_icons()
        return jsonify({
            "success": True,
            "data": files_with_icons
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files', methods=['POST'])
def add_file():
    """添加新文件"""
    try:
        file_data = request.json
        file_paths = file_data.get("paths", [])
        # 获取append参数，默认为False
        append_to_bottom = file_data.get("append", False)
        # 调用文件管理器添加文件，传递append参数
        added_files = file_manager.add_files_from_list(file_paths, append_to_bottom)
        
        return jsonify({
            "success": True,
            "message": f"成功添加 {len(added_files)} 个文件",
            "data": added_files
        }), 201
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/<int:file_index>', methods=['DELETE'])
def delete_file(file_index):
    """删除文件"""
    try:
        result = file_manager.delete_file(file_index)
        if result:
            return jsonify({
                "success": True,
                "message": "文件已删除"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "文件未找到"
            }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/<int:file_index>', methods=['PUT'])
def update_file(file_index):
    """更新文件信息"""
    try:
        file_data = request.json
        result = file_manager.update_file(file_index, file_data)
        if result:
            return jsonify({
                "success": True,
                "message": "文件信息已更新",
                "data": result
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "文件未找到"
            }), 404
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/open/<int:file_index>', methods=['POST'])
def open_file(file_index):
    """打开文件"""
    try:
        # 获取文件列表，用于错误提示
        files = config_manager.get("files", [])
        if not (0 <= file_index < len(files)):
            return jsonify({
                "success": False,
                "message": f"无效的文件索引: {file_index}"
            }), 400
        
        # 记录准备打开的文件路径
        file_path = files[file_index]["path"]

        
        # 从请求中获取admin参数
        admin = None
        if request.is_json and request.json:
            admin = request.json.get("admin", None)

        
        # 调用文件管理器打开文件
        result = file_manager.open_file(file_index, admin)
        
        if result:
            return jsonify({
                "success": True,
                "message": "文件已打开",
                "data": {
                    "path": file_path,
                    "admin": admin
                }
            }), 200
        else:
            # 获取文件类型信息用于更详细的错误消息
            file_info = files[file_index]
            file_type = "文件夹" if file_info.get("is_dir", False) else "文件"
            
            return jsonify({
                "success": False,
                "message": f"无法打开{file_type}: {file_path}",
                "data": {
                    "path": file_path,
                    "admin": admin,
                    "is_dir": file_info.get("is_dir", False)
                }
            }), 400
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"打开文件时发生异常: {error_msg}")
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "message": f"打开文件失败: {error_msg}",
            "error": error_msg
        }), 500

@app.route('/api/files/reorder', methods=['POST'])
def reorder_files():
    """重新排序文件"""
    try:
        data = request.json
        from_index = data.get("from_index")
        to_index = data.get("to_index")
        
        if from_index is None or to_index is None:
            return jsonify({
                "success": False,
                "message": "缺少必要参数"
            }), 400
            
        files = config_manager.get("files", [])
        
        # 检查索引是否合法
        if not (0 <= from_index < len(files) and 0 <= to_index < len(files)):
            return jsonify({
                "success": False,
                "message": "无效的索引"
            }), 400
            
        # 移动文件位置
        file_to_move = files.pop(from_index)
        files.insert(to_index, file_to_move)
        
        # 保存更新后的文件列表
        config_manager.set("files", files)
        
        return jsonify({
            "success": True,
            "message": "文件顺序已更新"
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/order', methods=['PUT'])
def update_files_order():
    """更新文件顺序"""
    try:
        new_order = request.json.get("order", [])
        result = file_manager.update_files_order(new_order)
        if result:
            return jsonify({
                "success": True,
                "message": "文件顺序已更新"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "无法更新文件顺序"
            }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/order/<int:from_index>/<int:to_index>', methods=['PUT'])
def update_file_order_by_indices(from_index, to_index):
    """通过起始和目标索引更新文件顺序"""
    try:
        files = config_manager.get("files", [])
        
        # 检查索引是否合法
        if not (0 <= from_index < len(files) and 0 <= to_index <= len(files)):
            return jsonify({
                "success": False,
                "message": "无效的索引"
            }), 400
        
        # 如果起始和目标索引相同，无需移动
        if from_index == to_index:
            return jsonify({
                "success": True,
                "message": "文件顺序未改变"
            }), 200
        
        # 移动文件位置
        file_to_move = files.pop(from_index)
        
        # 插入到新位置
        if to_index >= len(files):
            files.append(file_to_move)
        else:
            files.insert(to_index, file_to_move)
        
        # 保存更新后的文件列表
        config_manager.set("files", files)
        
        return jsonify({
            "success": True,
            "message": "文件顺序已更新"
        }), 200
    except Exception as e:
        print(f"更新文件顺序时出错: {e}")
        return jsonify({
            "success": False,
            "message": f"更新文件顺序失败: {str(e)}"
        }), 500

@app.route('/api/files/full-order', methods=['PUT'])
def update_files_full_order():
    """通过文件路径数组更新完整的文件顺序"""
    try:
        # 获取请求中的文件路径数组
        paths_data = request.json.get("paths", [])
        if not paths_data:
            return jsonify({
                "success": False,
                "message": "未提供文件路径"
            }), 400
            
        # 获取当前的文件列表
        current_files = config_manager.get("files", [])
        
        # 创建路径到文件对象的映射
        path_to_file = {file['path']: file for file in current_files}
        
        # 根据新顺序创建新的文件列表
        new_files = []
        for path in paths_data:
            if path in path_to_file:
                new_files.append(path_to_file[path])
        
        # 检查是否所有文件都在新列表中
        if len(new_files) != len(current_files):
            # 将缺失的文件添加到末尾
            missing_paths = set(path_to_file.keys()) - set(paths_data)
            for path in missing_paths:
                new_files.append(path_to_file[path])
                
        # 保存新的文件顺序
        config_manager.set("files", new_files)
        
        return jsonify({
            "success": True,
            "message": "文件顺序已完全更新"
        }), 200
    except Exception as e:
        print(f"更新完整文件顺序时出错: {e}")
        return jsonify({
            "success": False,
            "message": f"更新文件顺序失败: {str(e)}"
        }), 500

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """获取设置"""
    try:
        # 获取托盘项列表
        tray_items = file_manager.get_tray_items()
        
        settings = {
            "language": config_manager.get("language", "中文"),
            "show_extensions": config_manager.get("show_extensions", True),
            "remove_arrow": config_manager.get("remove_arrow", False),
            "minimize_to_tray": config_manager.get("minimize_to_tray", False),
            "tray_items": tray_items  # 使用文件管理器获取的托盘项
        }
        return jsonify({
            "success": True,
            "data": settings
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/settings', methods=['PUT'])
def update_settings():
    """更新设置"""
    try:
        settings = request.json
        for key, value in settings.items():
            config_manager.set(key, value)
        
        return jsonify({
            "success": True,
            "message": "设置已更新"
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/languages', methods=['GET'])
def get_languages():
    """获取可用语言列表"""
    try:
        languages = language_manager.get_available_languages()
        return jsonify({
            "success": True,
            "data": languages
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/translations/<string:language>', methods=['GET'])
def get_translations(language):
    """获取指定语言的翻译"""
    try:
        # 确保语言参数正确解码
        language = urllib.parse.unquote(language)
        translations = language_manager.get_all_translations(language)
        return jsonify({
            "success": True,
            "data": translations
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/tray', methods=['GET'])
def get_tray_items():
    try:
        # 使用文件管理器获取托盘项列表
        tray_items = file_manager.get_tray_items()
        return jsonify({'success': True, 'data': tray_items})
    except Exception as e:
        logger.error(f"获取托盘项列表出错: {str(e)}")
        return jsonify({'success': False, 'message': f"获取托盘项列表出错: {str(e)}"}), 500

@app.route('/api/tray', methods=['POST'])
def add_to_tray():
    try:
        data = request.get_json()
        file_index = data.get('file_index')
        
        if file_index is None:
            logger.error("缺少file_index参数")
            return jsonify({'success': False, 'message': "缺少file_index参数"}), 400
        
        # 使用文件管理器添加文件到托盘
        tray_item = file_manager.add_to_tray(file_index)
        
        if tray_item:
            return jsonify({'success': True, 'message': "文件已添加到系统托盘", 'data': tray_item})
        else:
            return jsonify({'success': False, 'message': "添加文件到系统托盘失败"}), 500
    except Exception as e:
        logger.error(f"添加到托盘出错: {str(e)}")
        return jsonify({'success': False, 'message': f"添加到托盘出错: {str(e)}"}), 500

@app.route('/api/tray/<path:file_path>', methods=['DELETE'])
def remove_from_tray(file_path):
    try:
        # 使用文件管理器从托盘移除文件
        result = file_manager.remove_from_tray(file_path)
        
        if result:
            return jsonify({'success': True, 'message': "文件已从系统托盘移除"})
        else:
            return jsonify({'success': False, 'message': "从系统托盘移除文件失败"}), 500
    except Exception as e:
        logger.error(f"从托盘移除文件出错: {str(e)}")
        return jsonify({'success': False, 'message': f"从托盘移除文件出错: {str(e)}"}), 500

@app.route('/api/files/icon', methods=['GET'])
def get_file_icon():
    """获取文件图标的Base64编码数据"""
    try:
        # 获取文件路径参数
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'success': False, 'message': '缺少文件路径参数', 'data': None})
        
        # 获取是否移除箭头的参数
        remove_arrow_param = request.args.get('remove_arrow')
        remove_arrow = None
        if remove_arrow_param is not None:
            # 转换为布尔值
            remove_arrow = remove_arrow_param.lower() in ['true', '1', 't', 'y', 'yes']
            print(f"接收到remove_arrow参数: {remove_arrow_param}, 转换为: {remove_arrow}")
        
        # 尝试获取文件图标，传递remove_arrow参数
        icon_data = file_manager.get_file_icon_data(file_path, remove_arrow)
        
        if icon_data:
            return jsonify({'success': True, 'message': '成功获取图标数据', 'data': icon_data})
        else:
            return jsonify({'success': False, 'message': '无法获取图标数据', 'data': None})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'获取文件图标时出错: {str(e)}', 'data': None})

@app.route('/api/system/file-location', methods=['POST'])
def open_file_location():
    """打开文件所在位置"""
    try:
        file_path = request.json.get("path")
        success = system_manager.open_file_location(file_path)
        if success:
            return jsonify({
                "success": True,
                "message": "已打开文件所在位置"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "无法打开文件所在位置"
            }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/version', methods=['GET'])
def get_version():
    """获取版本信息"""
    try:
        is_packaged = getattr(sys, 'frozen', False)
        build_type = "Release" if is_packaged else "Dev"
        
        # 获取版本号
        version = "1.0.0"  # 默认版本号
        version_data = None
        
        try:
            # 优先尝试读取version.json文件（新版本管理方式）
            if is_packaged:
                version_json_path = os.path.join(sys._MEIPASS, 'version.json')
            else:
                version_json_path = 'version.json'
            
            if os.path.exists(version_json_path):
                with open(version_json_path, 'r', encoding='utf-8') as f:
                    import json
                    version_data = json.load(f)
                    version = version_data.get('version', version)
                    build_type = version_data.get('buildType', build_type)
            else:
                # 回退到旧版本的version.txt
                if is_packaged:
                    version_path = os.path.join(sys._MEIPASS, 'version.txt')
                else:
                    version_path = 'version.txt'
                
                if os.path.exists(version_path):
                    with open(version_path, 'r', encoding='utf-8') as f:
                        version = f.read().strip() or version
        except Exception as e:
            print(f"读取版本信息错误: {e}")
            pass
            
        response_data = {
                "version": version,
                "build_type": build_type
            }
        
        # 如果有完整的版本信息，添加到响应中
        if version_data:
            response_data.update({
                "full_version": version_data.get('fullVersion', version),
                "timestamp": version_data.get('timestamp', ''),
                "git_info": True
            })
            
        return jsonify({
            "success": True,
            "data": response_data
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查端点"""
    return jsonify({
        "status": "ok",
        "service": "QuickStart API"
    }), 200

@app.route('/api/config-path', methods=['GET'])
def get_config_path():
    """获取配置文件路径"""
    try:
        config_path = config_manager.get_config_path()
        return jsonify({
            "success": True,
            "data": config_path
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/reset', methods=['POST'])
def reset_all():
    """重置所有设置和文件"""
    try:
        # 重置配置管理器
        result = config_manager.reset_all()
        
        if result:
            return jsonify({
                "success": True,
                "message": "已重置所有设置和文件"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "重置失败"
            }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/api/files/delete-multiple', methods=['POST'])
def delete_multiple_files():
    """批量删除多个文件"""
    try:
        data = request.get_json()
        
        # 检查是否提供了文件路径列表
        if not data or 'paths' not in data or not isinstance(data['paths'], list):
            return jsonify({
                "success": False,
                "message": "请提供有效的文件路径列表"
            }), 400
        
        file_paths = data['paths']
        if not file_paths:
            return jsonify({
                "success": False,
                "message": "文件路径列表为空"
            }), 400
        
        # 获取当前文件列表
        files = config_manager.get("files", [])
        
        # 记录成功删除的文件数量
        deleted_count = 0
        
        # 遍历需要删除的文件路径
        for path in file_paths:
            # 查找文件在列表中的索引
            file_index = None
            for i, file in enumerate(files):
                if file.get("path") == path:
                    file_index = i
                    break
            
            # 如果找到了文件，则删除
            if file_index is not None:
                # 删除文件
                del files[file_index]
                deleted_count += 1
        
        # 更新配置文件
        config_manager.set("files", files)
        
        # 返回结果
        if deleted_count > 0:
            return jsonify({
                "success": True,
                "message": f"成功删除了 {deleted_count} 个文件",
                "deleted_count": deleted_count
            })
        else:
            return jsonify({
                "success": False,
                "message": "未能删除任何文件"
            })
            
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"删除文件时出错: {str(e)}"
        }), 500

@app.route('/api/files/open-by-path', methods=['POST'])
def open_file_by_path():
    """通过文件路径直接打开文件"""
    try:
        data = request.json
        file_path = data.get("path", "")
        admin = data.get("admin", False)
        params = data.get("params", "")
        
        if not file_path:
            return jsonify({
                "success": False,
                "message": "未提供文件路径"
            }), 400
            
        if not os.path.exists(file_path):
            return jsonify({
                "success": False,
                "message": f"文件不存在: {file_path}"
            }), 404

        
        # 判断是文件还是文件夹
        is_dir = os.path.isdir(file_path)
        
        if is_dir:
            # 打开文件夹
            os.startfile(file_path)
            return jsonify({
                "success": True,
                "message": "文件夹已打开"
            }), 200
        elif file_path.lower().endswith('.url'):
            # 处理URL文件
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # 提取URL
                import re
                url_match = re.search(r'URL=(.+)', content)
                if url_match:
                    url = url_match.group(1).strip()
                    import webbrowser
                    webbrowser.open(url)
                    return jsonify({
                        "success": True,
                        "message": "URL已打开",
                        "url": url
                    }), 200
                else:
                    # 如果无法提取URL，则使用默认方式打开
                    os.startfile(file_path)
                    return jsonify({
                        "success": True,
                        "message": "URL文件已打开(默认方式)"
                    }), 200
            except Exception as e:
                # 出错时尝试使用默认方式打开
                try:
                    os.startfile(file_path)
                    return jsonify({
                        "success": True,
                        "message": "URL文件已打开(出错后默认方式)"
                    }), 200
                except Exception as e2:
                    return jsonify({
                        "success": False,
                        "message": f"打开URL文件失败: {str(e2)}"
                    }), 500
        else:
            # 普通文件
            try:
                if admin:
                    # 管理员方式运行
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
                        # 使用参数
                        subprocess.Popen([file_path] + params.split(), shell=True)
                    else:
                        # 无参数
                        os.startfile(file_path)
                        
                return jsonify({
                    "success": True,
                    "message": "文件已打开",
                    "admin": admin
                }), 200
            except Exception as e:
                return jsonify({
                    "success": False,
                    "message": f"打开文件失败: {str(e)}"
                }), 500
    except Exception as e:
        import traceback
        error_msg = str(e)
        print(f"通过路径打开文件时出错: {error_msg}")
        traceback.print_exc()
        
        return jsonify({
            "success": False,
            "message": f"处理文件打开请求失败: {error_msg}"
        }), 500

@app.route('/api/system-icon', methods=['GET'])
def get_system_icon():
    """获取系统图标"""
    try:
        # 获取图标类型参数
        icon_type = request.args.get('type', 'file')
        
        # 使用文件管理器获取系统图标
        icon_data = file_manager.get_system_icon(icon_type)
        
        if icon_data:
            return jsonify({
                "success": True,
                "data": icon_data
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": f"无法获取{icon_type}类型的系统图标"
            }), 404
    except Exception as e:
        logger.error(f"获取系统图标出错: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"获取系统图标时出错: {str(e)}"
        }), 500

# 测试路由 - 显示测试页面
@app.route('/test-lnk-icon', methods=['GET'])
def test_lnk_icon_page():
    """显示测试LNK图标的HTML页面"""
    html = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>测试LNK图标</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .test-form { margin-bottom: 20px; }
            .result { margin-top: 20px; padding: 10px; border: 1px solid #ccc; }
            .icon-display { margin-top: 10px; background-color: #f0f0f0; padding: 10px; border-radius: 4px; }
        </style>
        <script>
            async function testIcon() {
                const pathInput = document.getElementById('file-path');
                const resultDiv = document.getElementById('result');
                const iconDiv = document.getElementById('icon-display');
                
                const path = pathInput.value.trim();
                if (!path) {
                    resultDiv.textContent = '请输入文件路径';
                    return;
                }
                
                try {
                    resultDiv.textContent = '正在获取图标...';
                    const response = await fetch(`/api/test/lnk-icon?path=${encodeURIComponent(path)}`);
                    const data = await response.json();
                    
                    resultDiv.textContent = data.message;
                    
                    if (data.success && data.data) {
                        iconDiv.innerHTML = `<img src="data:image/png;base64,${data.data}" style="width:64px; height:64px;" />`;
                    } else {
                        iconDiv.innerHTML = '无法显示图标';
                    }
                } catch (error) {
                    resultDiv.textContent = `错误: ${error.message}`;
                }
            }
        </script>
    </head>
    <body>
        <h1>测试LNK文件图标获取</h1>
        <div class="test-form">
            <label for="file-path">LNK文件路径:</label>
            <input type="text" id="file-path" style="width: 500px;" placeholder="输入完整的.lnk文件路径" />
            <button onclick="testIcon()">测试</button>
        </div>
        <div class="result" id="result">输入LNK文件路径并点击测试按钮</div>
        <div class="icon-display" id="icon-display"></div>
    </body>
    </html>
    """
    return html

# 测试路由 - 单独测试lnk图标获取
@app.route('/api/test/lnk-icon', methods=['GET'])
def test_lnk_icon():
    """测试获取lnk文件图标的功能"""
    try:
        # 获取文件路径参数
        file_path = request.args.get('path')
        if not file_path:
            return jsonify({'success': False, 'message': '缺少文件路径参数', 'data': None})
        
        if not file_path.lower().endswith('.lnk'):
            return jsonify({'success': False, 'message': '不是LNK文件', 'data': None})
            
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'message': '文件不存在', 'data': None})
        
        # 尝试获取LNK文件图标
        print(f"测试获取LNK图标: {file_path}")
        icon_data = system_manager.get_lnk_icon(file_path)
        
        if icon_data:
            print(f"成功获取LNK图标，大小: {len(icon_data)} 字节")
            base64_data = base64.b64encode(icon_data).decode('utf-8')
            return jsonify({
                'success': True, 
                'message': '成功获取图标数据', 
                'data': base64_data,
                'html': f'<img src="data:image/png;base64,{base64_data}" />'
            })
        else:
            print("无法获取LNK图标")
            return jsonify({'success': False, 'message': '无法获取图标数据', 'data': None})
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'message': f'测试LNK图标时出错: {str(e)}', 'data': None})

@app.route('/api/clear-icon-cache', methods=['POST'])
def clear_icon_cache():
    """清理图标缓存"""
    try:
        # 简单记录日志
        logger.info("接收到清理图标缓存请求")
        
        # 检查管理器对象
        fm_status = "有效" if 'file_manager' in globals() and file_manager is not None else "无效"
        sm_status = "有效" if 'system_manager' in globals() and system_manager is not None else "无效"
        logger.info(f"文件管理器状态: {fm_status}, 系统管理器状态: {sm_status}")
        
        # 简化的清理逻辑
        cleared = []
        
        # 尝试清理文件管理器缓存
        if 'file_manager' in globals() and file_manager is not None:
            # 如果缓存属性不存在，创建一个空字典
            if not hasattr(file_manager, '_icon_cache'):
                file_manager._icon_cache = {}
                cleared.append("已创建文件管理器缓存")
            else:
                # 清空现有缓存
                old_size = len(file_manager._icon_cache) if isinstance(file_manager._icon_cache, dict) else '未知'
                file_manager._icon_cache = {}
                cleared.append(f"已清理文件管理器缓存({old_size}项)")
        
        # 尝试清理系统管理器缓存
        if 'system_manager' in globals() and system_manager is not None:
            # 如果缓存属性不存在，创建一个空字典
            if not hasattr(system_manager, '_icon_cache'):
                system_manager._icon_cache = {}
                cleared.append("已创建系统管理器缓存")
            else:
                # 清空现有缓存
                old_size = len(system_manager._icon_cache) if isinstance(system_manager._icon_cache, dict) else '未知'
                system_manager._icon_cache = {}
                cleared.append(f"已清理系统管理器缓存({old_size}项)")
                
            # 同样处理LNK图标缓存
            if not hasattr(system_manager, '_lnk_icon_cache'):
                system_manager._lnk_icon_cache = {}
                cleared.append("已创建系统管理器LNK缓存")
            else:
                old_size = len(system_manager._lnk_icon_cache) if isinstance(system_manager._lnk_icon_cache, dict) else '未知'
                system_manager._lnk_icon_cache = {}
                cleared.append(f"已清理系统管理器LNK缓存({old_size}项)")
            
            # 清理物理缓存目录中的文件
            if hasattr(system_manager, 'cache_dir') and system_manager.cache_dir:
                try:
                    # 确保缓存目录存在
                    if os.path.exists(system_manager.cache_dir):
                        # 删除目录中的所有文件
                        file_count = 0
                        for filename in os.listdir(system_manager.cache_dir):
                            file_path = os.path.join(system_manager.cache_dir, filename)
                            if os.path.isfile(file_path):
                                os.unlink(file_path)
                                file_count += 1
                        
                        cleared.append(f"已删除缓存目录中的{file_count}个文件")
                    else:
                        # 如果目录不存在，则创建它
                        os.makedirs(system_manager.cache_dir, exist_ok=True)
                        cleared.append("创建了缓存目录")
                except Exception as e:
                    cleared.append(f"清理缓存目录时出错: {str(e)}")
                    logger.error(f"清理缓存目录时出错: {str(e)}")
        
        # 强制进行垃圾回收
        try:
            import gc
            gc.collect()
            cleared.append("执行了垃圾回收")
        except:
            pass
        
        # 返回成功结果
        result_text = "、".join(cleared) if cleared else "无缓存需要清理"
        logger.info(f"图标缓存清理成功: {result_text}")
        
        return jsonify({
            "success": True,
            "message": f"图标缓存已清理: {result_text}，请刷新文件列表以重新加载图标",
            "cleared": cleared
        }), 200
        
    except Exception as e:
        # 记录详细错误信息
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"清理图标缓存失败: {str(e)}")
        logger.error(error_trace)
        
        return jsonify({
            "success": False,
            "message": f"清理图标缓存失败: {str(e)}",
            "error_trace": error_trace
        }), 500

@app.route('/api/diagnostics/icon-cache', methods=['GET'])
def diagnose_icon_cache():
    """显示图标缓存的诊断信息"""
    try:
        diagnostics = {
            "success": True,
            "file_manager": {
                "initialized": 'file_manager' in globals() and file_manager is not None,
                "has_icon_cache": hasattr(file_manager, '_icon_cache') if 'file_manager' in globals() and file_manager is not None else False,
                "icon_cache_type": str(type(file_manager._icon_cache)) if 'file_manager' in globals() and file_manager is not None and hasattr(file_manager, '_icon_cache') else "N/A",
                "icon_cache_size": len(file_manager._icon_cache) if 'file_manager' in globals() and file_manager is not None and hasattr(file_manager, '_icon_cache') else 0,
                "icon_cache_keys": list(file_manager._icon_cache.keys())[:10] if 'file_manager' in globals() and file_manager is not None and hasattr(file_manager, '_icon_cache') else []
            },
            "system_manager": {
                "initialized": 'system_manager' in globals() and system_manager is not None,
                "has_icon_cache": hasattr(system_manager, '_icon_cache') if 'system_manager' in globals() and system_manager is not None else False,
                "icon_cache_type": str(type(system_manager._icon_cache)) if 'system_manager' in globals() and system_manager is not None and hasattr(system_manager, '_icon_cache') else "N/A", 
                "icon_cache_size": len(system_manager._icon_cache) if 'system_manager' in globals() and system_manager is not None and hasattr(system_manager, '_icon_cache') else 0,
                "has_lnk_icon_cache": hasattr(system_manager, '_lnk_icon_cache') if 'system_manager' in globals() and system_manager is not None else False,
                "lnk_icon_cache_size": len(system_manager._lnk_icon_cache) if 'system_manager' in globals() and system_manager is not None and hasattr(system_manager, '_lnk_icon_cache') else 0
            },
            "config": {
                "remove_arrow": config_manager.get("remove_arrow", False) if 'config_manager' in globals() and config_manager is not None else "N/A"
            }
        }
        
        return jsonify(diagnostics), 200
    except Exception as e:
        import traceback
        error_traceback = traceback.format_exc()
        return jsonify({
            "success": False,
            "message": f"获取诊断信息失败: {str(e)}",
            "traceback": error_traceback
        }), 500

@app.route('/api/test', methods=['GET'])
def test_api():
    """简单的测试API，验证服务器是否正常响应"""
    return jsonify({
        "success": True,
        "message": "API服务器正常运行",
        "time": str(datetime.datetime.now())
    }), 200

@app.route('/api/clear-icon-cache-simple', methods=['POST'])
def clear_icon_cache_simple():
    """简单版清理图标缓存 - 重建管理器对象"""
    try:
        global file_manager, system_manager
        
        # 记录原始缓存目录
        cache_dir = None
        if 'system_manager' in globals() and system_manager is not None and hasattr(system_manager, 'cache_dir'):
            cache_dir = system_manager.cache_dir
        
        # 确保配置管理器存在
        if 'config_manager' in globals() and config_manager is not None:
            # 重新创建系统管理器
            new_system_manager = SystemManager(config_manager)
            # 给系统管理器添加缓存属性
            new_system_manager._icon_cache = {}
            new_system_manager._lnk_icon_cache = {}
            
            # 重新创建文件管理器
            new_file_manager = FileManager(config_manager, new_system_manager)
            # 给文件管理器添加缓存属性
            new_file_manager._icon_cache = {}
            
            # 替换全局变量
            system_manager = new_system_manager
            file_manager = new_file_manager
            
            # 清理物理缓存目录
            try:
                if cache_dir and os.path.exists(cache_dir):
                    # 删除目录中的所有文件
                    file_count = 0
                    for filename in os.listdir(cache_dir):
                        file_path = os.path.join(cache_dir, filename)
                        if os.path.isfile(file_path):
                            os.unlink(file_path)
                            file_count += 1
                    
                    logger.info(f"已删除缓存目录中的{file_count}个文件")
                else:
                    # 使用新的系统管理器的缓存目录
                    if hasattr(system_manager, 'cache_dir') and os.path.exists(system_manager.cache_dir):
                        # 删除目录中的所有文件
                        file_count = 0
                        for filename in os.listdir(system_manager.cache_dir):
                            file_path = os.path.join(system_manager.cache_dir, filename)
                            if os.path.isfile(file_path):
                                os.unlink(file_path)
                                file_count += 1
                        
                        logger.info(f"已删除新缓存目录中的{file_count}个文件")
            except Exception as e:
                logger.error(f"清理缓存目录时出错: {str(e)}")
            
            logger.info("已重建管理器对象并清理图标缓存")
            
            return jsonify({
                "success": True,
                "message": "已重建管理器对象并清理图标缓存，请刷新文件列表"
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "配置管理器未初始化，无法重建对象"
            }), 500
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error(f"重建管理器对象失败: {str(e)}")
        logger.error(error_trace)
        
        return jsonify({
            "success": False,
            "message": f"重建管理器对象失败: {str(e)}"
        }), 500

@app.route('/api/icon-cache-path', methods=['GET'])
def get_icon_cache_path():
    """获取图标缓存目录路径"""
    try:
        if 'system_manager' in globals() and system_manager is not None and hasattr(system_manager, 'cache_dir'):
            cache_dir = system_manager.cache_dir
            # 检查目录是否存在
            if not os.path.exists(cache_dir):
                os.makedirs(cache_dir, exist_ok=True)
                
            return jsonify({
                "success": True,
                "data": cache_dir
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": "无法获取缓存目录信息"
            }), 500
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"获取缓存目录时出错: {str(e)}"
        }), 500

# 添加全局错误处理器
@app.errorhandler(Exception)
def handle_exception(e):
    """处理所有未捕获的异常"""
    # 记录异常
    logger.error(f"未捕获的异常: {str(e)}")
    import traceback
    logger.error(traceback.format_exc())
    
    # 返回JSON格式的错误响应
    response = {
        "success": False,
        "message": f"服务器错误: {str(e)}",
        "error_type": e.__class__.__name__
    }
    return jsonify(response), 500

def start_server():
    """启动Flask服务器"""
    # 确保控制台输出使用UTF-8编码
    if sys.platform == 'win32':
        # 在Windows上设置控制台编码为UTF-8
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')
    
    host = '127.0.0.1'  # 本地地址
    port = 5000         # 默认端口
    
    # 从命令行参数获取端口（如果有）
    if len(sys.argv) > 1:
        try:
            port = int(sys.argv[1])
        except ValueError:
            print(f"无效的端口号: {sys.argv[1]}，使用默认端口 5000")
    
    # 打印启动信息
    print(f"\n{'='*40}")
    print(f"启动QuickStart服务器，版本: {config_manager.get('version', '1.0.0')}")
    print(f"主机: {host}, 端口: {port}")
    print(f"系统: {sys.platform}")
    print(f"Python版本: {sys.version}")
    print(f"缓存管理器状态:")
    print(f" - 文件管理器: {'已初始化' if 'file_manager' in globals() and file_manager is not None else '未初始化'}")
    print(f" - 系统管理器: {'已初始化' if 'system_manager' in globals() and system_manager is not None else '未初始化'}")
    print(f" - 配置管理器: {'已初始化' if 'config_manager' in globals() and config_manager is not None else '未初始化'}")
    print(f"{'='*40}\n")
    
    app.run(host=host, port=port, debug=False)

if __name__ == "__main__":
    start_server() 