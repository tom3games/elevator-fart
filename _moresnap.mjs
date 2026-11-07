// ほかのバカゲーの入口と一覧を6サイズで撮る。node _moresnap.mjs
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { launch } from './_mute.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, OUT = ROOT + '/shots/more'; mkdirSync(OUT, { recursive: true })
const PORT = 5639, server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await launch(chromium), log = []
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]
const chk = p => p.evaluate(() => {
  const H = innerHeight, W = innerWidth, bad = []
  const vis = [...document.querySelectorAll('main:not([hidden]) button, #moreBox:not([hidden]) a, #moreBox:not([hidden]) button, #moreBox:not([hidden]) .moreP')].filter(e => e.offsetParent && !e.closest('[hidden]'))
  for (const e of vis) { const r = e.getBoundingClientRect(); if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) bad.push((e.id || e.className || e.tagName) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom)) }
  const m = document.querySelector('.moreP'); if (m && m.offsetParent && m.scrollHeight > m.clientHeight + 1) bad.push('moreP-scroll:' + m.scrollHeight + '>' + m.clientHeight)
  // 入口ボタンがほかのボタンと重ならない
  const mb = [...document.querySelectorAll('main:not([hidden]) .more')].filter(e => e.offsetParent)[0]
  if (mb) { const a = mb.getBoundingClientRect(); for (const e of vis) { if (e === mb || e.closest('#moreBox')) continue; const r = e.getBoundingClientRect(); if (a.left < r.right - 1 && r.left < a.right - 1 && a.top < r.bottom - 1 && r.top < a.bottom - 1) bad.push('overlap:' + (e.id || e.className)) } }
  if (document.documentElement.scrollWidth > W || document.documentElement.scrollHeight > H + 1) bad.push('page-scroll')
  return bad
})
for (const [w, h, nm] of SIZES) for (const lang of ['ja', 'en']) {
  const ctx = await b.newContext({ locale: lang === 'ja' ? 'ja-JP' : 'en-US', viewport: { width: w, height: h } }), p = await ctx.newPage(), errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hsReady); await p.evaluate(() => document.fonts.ready)
  const sh = async n => { await p.evaluate(() => hs.dbg.render()); await p.waitForTimeout(250); const bad = await chk(p); console.log(`${nm}-${lang}-${n}: ${bad.length ? bad.join(" ") : "ok"}`); await p.screenshot({ path: `${OUT}/${nm}-${lang}-${n}.png` }) }
  await p.evaluate(() => hs.dbg.pause())
  await sh('title')
  await p.click('#bMoreT'); await p.waitForFunction(() => [...document.querySelectorAll('#moreL img')].every(i => i.complete), null, { timeout: 15000 }); await sh('title-list')
  await p.click('#bMoreX')
  await p.evaluate(() => { hs.dbg.seed(1); hs.start(); hs.beginCount(); hs.dbg.step(150); hs.dbg.toPeak(0.3); hs.fart('bubo'); hs.dbg.step(30); hs.toResult(); hs.finishReveal(); hs.dbg.step(30) })
  await p.waitForTimeout(400); await sh('result')
  await p.click('#bMore'); await p.waitForTimeout(300); await sh('result-list')
  if (errs.length) log.push(`${nm}-${lang} errors: ${errs.join(' | ')}`)
  await ctx.close()
}
await b.close(); server.kill(); console.log(log.join('\n'))
