// 在浏览器开发者工具中执行此脚本来清除语言缓存
try {
  localStorage.removeItem('quickstart-language');
  localStorage.removeItem('i18nextLng');
  console.log('✅ 语言缓存已清除');
  
  // 刷新页面以应用更改
  if (confirm('语言缓存已清除，是否刷新页面以应用更改？')) {
    window.location.reload();
  }
} catch (error) {
  console.error('❌ 清除缓存失败:', error);
}