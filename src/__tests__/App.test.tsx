/**
 * 基础测试用例
 * 测试Jest配置和基本功能
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

// 简单的测试组件
const TestComponent: React.FC = () => {
  return <div data-testid="test-component">Hello Jest!</div>;
};

describe('Jest Configuration Test', () => {
  test('Jest configuration should work properly', () => {
    expect(true).toBe(true);
  });

  test('React components should render correctly', () => {
    render(<TestComponent />);

    const element = screen.getByTestId('test-component');
    expect(element).toBeInTheDocument();
    expect(element).toHaveTextContent('Hello Jest!');
  });

  test('window.electronAPI 模拟应该可用', () => {
    expect(window.electronAPI).toBeDefined();
    expect(window.electronAPI.config).toBeDefined();
    expect(window.electronAPI.file).toBeDefined();
    expect(window.electronAPI.window).toBeDefined();
    expect(window.electronAPI.system).toBeDefined();
  });

  test('localStorage 模拟应该可用', () => {
    expect(window.localStorage).toBeDefined();
    expect(window.localStorage.getItem).toBeDefined();
    expect(window.localStorage.setItem).toBeDefined();
  });
});
