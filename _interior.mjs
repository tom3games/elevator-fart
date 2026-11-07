// 内装（1階・25階・50階）と匂いのモヤを縦横で撮る。node _interior.mjs [dir]
import './mute-auto.mjs'  // テスト中は絶対に音を出さない（playwright を無音に差し替え）
import { chromium } from 'playwright'
import { launch } from './_mute.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname, OUT = ROOT + '/shots/' + (process.argv[2] || 'interior'); mkdirSync(OUT, { recursive: true })
const PORT = 5513, server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await launch(chromium), log = []
for (const [w, h, nm] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const p = await (await b.newContext({ locale: 'ja-JP', viewport: { width: w, height: h }, deviceScaleFactor: 2 })).newPage(), errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hsReady); await p.evaluate(() => document.fonts.ready)
  const sh = async n => { await p.evaluate(() => hs.dbg.render()); await p.screenshot({ path: `${OUT}/${nm}-${n}.png` }) }
  await p.evaluate(() => { hs.dbg.pause(); hs.dbg.seed(3); hs.start(); hs.beginCount(); hs.dbg.step(150); hs.S.tut = 2; document.querySelector('#hint').hidden = true; hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.step(30) })
  await sh('f01')
  for (const [f, n] of [[25, 'f25'], [50, 'f50']]) {
    const r = await p.evaluate(f => { hs.dbg.floor(f); hs.S.stop = { t: 0 }; hs.dbg.step(200); return hs.interior() }, f)
    log.push(`${nm} ${n}: ${JSON.stringify(r)}`); await sh(n)
  }
  await p.evaluate(() => { hs.S.smell = 0.9; hs.dbg.step(150) }); await sh('moya')
  await p.evaluate(() => { hs.S.cd.bubo = 0; hs.S.snz = null; hs.fart('bubo'); hs.dbg.step(30) }); log.push(`${nm} moya=${await p.evaluate(() => hs.moyaN() + '/' + hs.lineN())}`); await sh('moya-fart')
  log.push(`${nm} errors: ${errs.join(' | ') || 'none'}`)
}
await b.close(); server.kill(); console.log(log.join('\n'))
