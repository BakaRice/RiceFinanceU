import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.dirname(fileURLToPath(import.meta.url))

function readAppConfig() {
  return JSON.parse(readFileSync(path.join(appRoot, 'app.json'), 'utf8'))
}

test('小程序启动页应该直接进入总览页', () => {
  const appConfig = readAppConfig()

  assert.equal(appConfig.pages[0], 'pages/index/index')
  assert.ok(appConfig.pages.includes('pages/login/login'))
})

test('小程序底部导航应该对齐 PC 端核心菜单', () => {
  const appConfig = readAppConfig()

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
  const appConfig = readAppConfig()

  for (const item of appConfig.tabBar.list) {
    for (const ext of ['js', 'json', 'wxml', 'wxss']) {
      const pageFile = path.join(appRoot, `${item.pagePath}.${ext}`)
      assert.equal(
        existsSync(pageFile),
        true,
        `${item.pagePath}.${ext} should exist`
      )
    }
  }
})

test('底部导航菜单应该配置本地图标', () => {
  const appConfig = readAppConfig()
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  for (const item of appConfig.tabBar.list) {
    for (const key of ['iconPath', 'selectedIconPath']) {
      assert.equal(typeof item[key], 'string', `${item.text}.${key} should be configured`)
      assert.equal(item[key].endsWith('.png'), true, `${item.text}.${key} should point to a PNG`)

      const iconFile = path.join(appRoot, item[key])
      assert.equal(existsSync(iconFile), true, `${iconFile} should exist`)
      assert.deepEqual(readFileSync(iconFile).subarray(0, 8), pngSignature)
    }
  }
})
