// fps とドローコールの目安。node _fps.mjs [port]（GPU 描画で実時間に6秒遊ばせる）
import { chromium } from 'playwright'
import { launch } from './_mute.mjs'
import { spawn } from 'node:child_process'
const ROOT = import.meta.dirname, PORT = +(process.argv[2] || 5512)
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const b = await launch(chromium, { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
for (const [w, h, f] of [[390, 844, 1], [390, 844, 45], [1440, 900, 45]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 500 ? 2 : 1 })).newPage()
  await p.goto(`http://localhost:${PORT}/`); await p.waitForFunction(() => window.__hsReady)
  await p.evaluate(f => { hs.start(); hs.beginCount(); hs.dbg.floor(f) }, f); await p.waitForTimeout(6000)
  const r = await p.evaluate(() => { const fps = hs.S.fps; hs.dbg.pause(); const gl = hs.renderer.getContext(), px = new Uint8Array(4); const t0 = performance.now(); for (let i = 0; i < 120; i++) { hs.dbg.step(1); hs.dbg.render(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) } const ms = (performance.now() - t0) / 120; return { fps, ms: ms.toFixed(2), calls: hs.renderer.info.render.calls, tris: hs.renderer.info.render.triangles } })
  console.log(`${w}x${h} floor${f}: fps=${r.fps} frame=${r.ms}ms calls=${r.calls} tris=${r.tris}`)
  await p.close()
}
await b.close(); server.kill()
