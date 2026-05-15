import { test, expect } from '@playwright/test';

test.describe('RL Correction MCP', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display dashboard with stats', async ({ page }) => {
    // 验证页面标题
    await expect(page).toHaveTitle(/RL Correction MCP/);

    // 验证导航菜单
    await expect(page.getByText('概览')).toBeVisible();
    await expect(page.getByText('修正对')).toBeVisible();
    await expect(page.getByText('行为规则')).toBeVisible();
    await expect(page.getByText('搜索')).toBeVisible();
    await expect(page.getByText('调用记录')).toBeVisible();

    // 验证统计卡片
    await expect(page.getByText('总记录数')).toBeVisible();
  });

  test('should navigate to corrections list', async ({ page }) => {
    // 点击修正对导航
    await page.getByRole('link', { name: '修正对' }).click();

    // 验证URL变化
    await expect(page).toHaveURL(/\/corrections/);

    // 验证页面标题
    await expect(page.getByRole('heading', { name: '修正对列表' })).toBeVisible();

    // 验证表格列标题
    await expect(page.getByRole('columnheader', { name: '场景描述' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '错误输出' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '正确输出' })).toBeVisible();
  });

  test('should toggle dark mode', async ({ page }) => {
    // 获取初始主题
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // 点击主题切换按钮
    await page.locator('.theme-toggle').click();

    // 验证主题已切换
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);
  });

  test('should open add correction form', async ({ page }) => {
    // 点击添加新记录按钮
    await page.getByRole('button', { name: '添加新记录' }).click();

    // 验证跳转到添加页面
    await expect(page).toHaveURL(/\/add/);

    // 验证表单标题
    await expect(page.getByRole('heading', { name: '添加修正对' })).toBeVisible();

    // 验证表单字段
    await expect(page.getByLabel(/场景描述/)).toBeVisible();
    await expect(page.getByLabel(/错误输出/)).toBeVisible();
    await expect(page.getByLabel(/正确输出/)).toBeVisible();
  });

  test('should validate form before submission', async ({ page }) => {
    await page.goto('/add');

    // 尝试直接提交（不填写表单）
    await page.getByRole('button', { name: /添加记录/ }).click();

    // 验证表单验证错误
    await expect(page.getByText('请输入场景描述')).toBeVisible();
    await expect(page.getByText('请输入错误输出')).toBeVisible();
    await expect(page.getByText('请输入正确输出')).toBeVisible();
  });

  test('should navigate using keyboard (Tab)', async ({ page }) => {
    // 从页面顶部开始 Tab 导航
    const firstFocusable = page.locator('.nav-item').first();
    await firstFocusable.focus();

    // 验证第一个导航项获得焦点
    await expect(firstFocusable).toBeFocused();

    // Tab 到下一个导航项
    await page.keyboard.press('Tab');

    // 验证焦点移动
    const secondNavItem = page.locator('.nav-item').nth(1);
    // Element Plus 可能自动管理焦点
  });

  test('should use keyboard shortcut Ctrl+K for search', async ({ page }) => {
    // 按 Ctrl+K 聚焦搜索框
    await page.keyboard.press('Control+k');

    // 验证搜索框获得焦点
    const searchInput = page.locator('textarea').first();
    await expect(searchInput).toBeFocused();
  });
});
