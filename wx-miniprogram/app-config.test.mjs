import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'

test('小程序启动页应该是登录页', () => {
  const appConfig = JSON.parse(readFileSync('wx-miniprogram/app.json', 'utf8'))

  assert.equal(appConfig.pages[0], 'pages/login/login')
})

test('小程序底部导航应该对齐 PC 端核心菜单', () => {
  const appConfig = JSON.parse(readFileSync('wx-miniprogram/app.json', 'utf8'))

  assert.deepEqual(appConfig.tabBar.list.map((item) => item.pagePath), [
    'pages/index/index',
    'pages/assets/assets',
    'pages/entry/entry',
    'pages/data/data',
  ])
  assert.deepEqual(appConfig.tabBar.list.map((item) => item.text), [
    '总览',
    '资产',
    '录入',
    '数据',
  ])
})

test('底部导航页面文件都应该存在', () => {
  const appConfig = JSON.parse(readFileSync('wx-miniprogram/app.json', 'utf8'))

  for (const item of appConfig.tabBar.list) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      assert.equal(
        existsSync(`wx-miniprogram/${item.pagePath}.${ext}`),
        true,
        `${item.pagePath}.${ext} should exist`
      )
    }
  }
})
