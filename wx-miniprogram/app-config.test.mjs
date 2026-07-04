import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('小程序启动页应该是登录页', () => {
  const appConfig = JSON.parse(readFileSync('wx-miniprogram/app.json', 'utf8'))

  assert.equal(appConfig.pages[0], 'pages/login/login')
})
