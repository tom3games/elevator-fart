// 密室おなら選手権の検証。node verify.mjs（FPS=1 で GPU 描画の fps も測る）
// 遊び: 1回の乗車で登り続け、おならボタン3種（すかしっぺ・ぷっ・ブボボボッ）で点を稼ぐ。3回バレたら降ろされる
import { chromium, webkit } from 'playwright'
import { launch } from './_mute.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
const PORT = +process.env.PORT || 5617
const server = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT) } })
await new Promise(r => setTimeout(r, 400))
const URL0 = `http://localhost:${PORT}/`
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${e.message.split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) p.errs.push('reqfail ' + r.url()) })
  await p.goto(URL0); await p.waitForFunction(() => window.__hsReady, null, { timeout: 15000 })
  await p.evaluate(() => document.fonts && document.fonts.ready)
  return p
}
const overflow = p => p.evaluate(() => {
  const W = document.documentElement.clientWidth, bad = []
  for (const el of document.querySelectorAll('main:not([hidden]) *')) {
    if (el.closest('[hidden]') || (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true }))) continue
    const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push((el.id || el.className || el.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right))
  }
  return { sw: document.documentElement.scrollWidth, W, bad: bad.slice(0, 5) }
})
const fit = q => q.evaluate(() => {
  const H = innerHeight, W = innerWidth, de = document.documentElement, over = []
  if (de.scrollHeight > H + 1) over.push('page:' + de.scrollHeight)
  for (const el of document.querySelectorAll('main:not([hidden]) button,main:not([hidden]) canvas,main:not([hidden]) .card,main:not([hidden]) .resCard,main:not([hidden]) .panel,#corner button')) {
    if (!el.offsetParent || el.closest('[hidden]')) continue; const r = el.getBoundingClientRect()
    if (r.bottom > H + 1 || r.top < -1 || r.right > W + 1 || r.left < -1) over.push((el.id || el.className) + ':' + Math.round(r.top) + '-' + Math.round(r.bottom))
  }
  // 右上の小ボタンと HUD が重ならない
  const c = document.querySelector('#corner').getBoundingClientRect()
  for (const el of document.querySelectorAll('main:not([hidden]) .stChip,main:not([hidden]) .logo .main,main:not([hidden]) .resCard,main:not([hidden]) .panel,main:not([hidden]) .card:not([hidden])')) { if (el.closest('[hidden]')) continue; const r = el.getBoundingClientRect(); if (r.width && r.right > c.left + 2 && r.left < c.right && r.top < c.bottom - 2 && r.bottom > c.top) over.push('corner-overlap:' + (el.id || el.className)) }
  // プレイ画面の HUD 同士が重ならない（おならボタン・なすりつけ・ヒント・点数・右上）
  const hud = ['.farts', '#bBlame', '#hint', '.stChip', '#corner'].map(q => [q, document.querySelector(q)]).filter(([q, e]) => e && e.offsetParent && !e.closest('[hidden]')).map(([q, e]) => [q, e.getBoundingClientRect()])
  for (let i = 0; i < hud.length; i++) for (let j = i + 1; j < hud.length; j++) { const [qa, a] = hud[i], [qb, b] = hud[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) over.push('hud:' + qa + '/' + qb) }
  return { H, over: over.slice(0, 6) }
})
// Xでポスト: window.open を差し替えて、開かれるURLを取る
const xCheck = async (p, ns, want, tag, pub) => {
  await p.evaluate(() => { window.__opened = []; window.open = (...a) => { window.__opened.push(a); return null } })
  const vis = await p.isVisible('#bX'); expect(vis, 'Xボタンが見えない')
  await p.click('#bX')
  const r = await p.evaluate(ns => ({ o: window.__opened, api: window[ns].xPost(), label: document.querySelector('#bX').textContent.trim(), bg: getComputedStyle(document.querySelector('#bX')).backgroundColor, svg: !!document.querySelector('#bX svg path') }), ns)
  expect(r.o.length === 1, 'open回数 ' + r.o.length)
  const [href, target, feat] = r.o[0], u = new URL(href), text = u.searchParams.get('text')
  expect(href.startsWith('https://x.com/intent/post?') && target === '_blank' && /noopener/.test(feat), href + ' ' + target + ' ' + feat)
  expect(u.searchParams.get('url') === pub && !/https?:/.test(text), 'url ' + href)
  expect(text.includes(tag) && want.every(w => text.includes(String(w))), 'text ' + text + ' want ' + want.join(','))
  expect(text === r.api.text && r.svg && r.bg === 'rgb(0, 0, 0)', JSON.stringify(r))
  return { label: r.label, text }
}
// 保存・Xボタンの文字が1行に収まっている（折り返しなし）
const oneLine = p => p.evaluate(() => {
  const bad = []
  for (const id of ['#bSave', '#bX']) { const b = document.querySelector(id); if (!b) { bad.push(id + ':none'); continue }
    const sp = [...b.querySelectorAll('span')].pop() || b, rg = document.createRange(); rg.selectNodeContents(sp)
    const tops = new Set([...rg.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)))
    const br = b.getBoundingClientRect(), sr = sp.getBoundingClientRect()
    if (tops.size > 1 || sr.left < br.left - 1 || sr.right > br.right + 1) bad.push(id + ':' + tops.size + 'lines') }
  return bad
})
const SIZES = [[360, 640, 'small'], [390, 844, 'phone'], [844, 390, 'land'], [667, 375, 'land-se'], [768, 1024, 'tab'], [1440, 900, 'pc']]

// ボット（中身は bot.js。verify と分布の確認で同じものを使う）
const BOT = readFileSync(ROOT + '/bot.js', 'utf8').replace(/^\/\/.*\n/gm, '')

const PUB = 'https://tom3games.github.io/elevator-fart/'
const GAZE_ME = 2.4
const browser = await launch(chromium)
const p = await open(browser)
const run = (fn, arg) => p.evaluate(fn, arg)
const botRun = (mode, seed, bseed) => p.evaluate(([b, m, s, bs]) => { hs.dbg.pause(); hs.dbg.seed(s); hs.start(); return eval(b)(m, bs) }, [BOT, mode, seed, bseed])
// 乗車を始めて、カウントを終えたところまで進める
const begin = seed => p.evaluate(s => { hs.dbg.pause(); hs.dbg.seed(s); hs.start(); hs.beginCount(); hs.dbg.step(150) }, seed)
// 箱を静かにして（大きな音を止めて）乗客を入れ替える
const quiet = types => p.evaluate(t => { hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.clearPax(); for (const x of t) hs.dbg.addPax(x); hs.dbg.step(2) }, types)
// 種類を出して、判定が出るまで進める（その時の記録を返す）
// 匂いをためて犯人探しに入れる（視線を自分に向けたい時は me=true）
const toHunt = me => p.evaluate(me => { hs.S.tut = 2; hs.S.smell = 0.75 * hs.D.run.bustAt / hs.sniffMult(); let n = 0; while (hs.S.air < 2 && n++ < 600) hs.dbg.step(1); if (me) { let k = 0; while (hs.S.hunt && hs.S.hunt.to !== 'me' && k++ < 40) hs.nextGaze() } hs.dbg.step(20); return { air: hs.S.air, to: hs.S.hunt && (hs.S.hunt.to === 'me' ? 'me' : hs.S.hunt.to && hs.S.hunt.to.type) } }, me)
const fart = id => p.evaluate(k => { hs.S.cd[k] = 0; hs.S.snz = null; const o = hs.fart(k); hs.dbg.step(12); return { o, rec: hs.S.rec[hs.S.rec.length - 1] } }, id)

await t('起動時にエラーが出ない', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await t('ブラウザの拡大が起きない（viewport・ピンチ・Ctrl+ホイール・Ctrl+プラス）', async () => {
  const r = await p.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]').content
    const g = new Event('gesturestart', { cancelable: true }); document.dispatchEvent(g)
    const w = new WheelEvent('wheel', { ctrlKey: true, deltaY: -10, bubbles: true, cancelable: true }); window.dispatchEvent(w)
    const k = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true }); window.dispatchEvent(k)
    return { vp, gesture: g.defaultPrevented, wheel: w.defaultPrevented, key: k.defaultPrevented, ta: getComputedStyle(document.documentElement).touchAction, us: getComputedStyle(document.body).userSelect }
  })
  expect(/user-scalable=no/.test(r.vp) && r.gesture && r.wheel && r.key && r.ta === 'manipulation' && r.us === 'none', JSON.stringify(r)); return r
})
await t('OGP 一式がある（og:image は公開URL・1200x630 の og.png）', async () => {
  const r = await p.evaluate(async () => {
    const g = k => (document.querySelector(`meta[property="${k}"]`) || document.querySelector(`meta[name="${k}"]`) || {}).content
    const img = new Image(); img.src = 'og.png'; await img.decode().catch(() => {})
    return { title: g('og:title'), desc: g('og:description'), image: g('og:image'), url: g('og:url'), type: g('og:type'), card: g('twitter:card'), w: img.naturalWidth, h: img.naturalHeight, dt: document.title }
  })
  expect(/おなら/.test(r.title) && /点/.test(r.desc) && r.image === PUB + 'og.png?v=4' && r.url === PUB && r.type === 'website' && r.card === 'summary_large_image' && r.w === 1200 && r.h === 630, JSON.stringify(r)); return { title: r.title, w: r.w, h: r.h }
})
await t('古い仕様の文言が残っていない（くしゃみ・我慢ゲージ・誤魔化し4種・ステージ）', async () => {
  const r = await p.evaluate(() => {
    const txt = JSON.stringify(hs.D.T) + JSON.stringify(hs.D.run) + document.head.innerHTML + document.body.innerHTML
    return (txt.match(/くしゃみ|sneez|咳払い|次で降りる|ステージ|STAGE|がまん中|おなか|まわりの音/g) || []).slice(0, 5)
  })
  expect(!r.length, r.join(',')); return true
})
await t('3D が描けている（画面の色が散らばっている）', async () => {
  const buf = await p.screenshot(); const r = await p.evaluate(async b64 => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 17) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ } return Math.round(s2 / n - (s / n) ** 2)
  }, buf.toString('base64'))
  expect(r > 400, 'variance ' + r); return { variance: r }
})

// ---- 画面の情報量
await t('HUD にバー・メーター・ゲージの要素が無い', async () => {
  await begin(2)
  const r = await run(() => {
    const q = '#vPlay progress,#vPlay meter,#vPlay [class*=bar i],#vPlay [class*=gauge i],#vPlay [class*=meter i],#vPlay [id*=bar i],#vPlay [id*=gauge i],#vPlay [id*=meter i],#vPlay [class*=noise i]'
    return [...document.querySelectorAll(q)].map(e => e.id || e.className)
  })
  expect(!r.length, r.join(',')); return true
})
await t('普段の画面に出ているのは 点数・ハート3つ・おならボタン3つ だけ（なすりつけは出ていない）', async () => {
  await begin(2)
  const r = await run(() => {
    hs.S.tut = 2; document.querySelector('#hint').hidden = true; hs.dbg.step(2)
    const vis = el => el && !el.hidden && !el.closest('[hidden]') && el.getClientRects().length > 0
    const top = [...document.querySelectorAll('.hudTop > *')].filter(vis).map(e => e.className), bot = [...document.querySelectorAll('.hudBot > *')].filter(vis).map(e => e.className || e.id)
    return { top, bot, hearts: document.querySelectorAll('#hLives i:not(.off)').length, score: document.querySelector('#hScore').textContent, fb: document.querySelectorAll('.farts .fb').length }
  })
  expect(r.top.join() === 'stChip' && r.bot.join() === 'farts' && r.hearts === 3 && r.score === '0点' && r.fb === 3, JSON.stringify(r)); return r
})
await t('最初の1回だけ、実際の画面で案内する（ボタンで出す→大きな音で ブボボボッ→できたら消え、次の回からは出ない）', async () => {
  await begin(3)
  const r = await run(() => {
    const h = () => { const e = document.querySelector('#hint'); return e.hidden ? '' : e.dataset.k }
    hs.dbg.step(1); const a = h()
    while (!hs.S.evs.some(e => !e.fake && e.ph === 'warn')) hs.dbg.step(1); hs.dbg.step(2); const b = h()
    hs.dbg.toPeak(0.25); const c = h(), txt = document.querySelector('#hint').textContent; hs.fart('bubo'); hs.dbg.step(12)
    const d = h(), tut = hs.S.tut
    // バレた瞬間には案内を出さない（最初からやり直して、案内中に音でバレる）
    const remembered = localStorage.getItem('hs.tut'); localStorage.removeItem('hs.tut'); hs.start(); hs.beginCount(); hs.dbg.step(150); hs.dbg.step(30); const e0 = h(); hs.S.evs = []; hs.S.planAt = 1e9; hs.S.cd.bubo = 0; hs.fart('bubo'); hs.dbg.step(20); const e1 = h()
    hs.dbg.step(400); const late = h()
    localStorage.setItem('hs.tut', '1'); hs.start(); hs.beginCount(); hs.dbg.step(150); hs.dbg.step(2); const again = h(), tut2 = hs.S.tut; localStorage.removeItem('hs.tut')
    return { a, b, c, txt, d, tut, remembered, e0, e1, late, again, tut2 }
  })
  await p.screenshot({ path: ROOT + '/shots/tutorial-peak.png' })
  expect(r.a === 'tap' && r.b === 'wait' && r.c === 'rel' && /ブボボボッ/.test(r.txt) && r.d === '' && r.tut === 2 && r.remembered === '1' && r.e0 === 'tap' && r.e1 === '' && r.late === '' && r.again === '' && r.tut2 === 2, JSON.stringify(r)); return r
})
await t('予告は 3D の中で分かる（チャイムの前に階数表示のランプが点く・揺れの前に明かりがちらつく）', async () => {
  await begin(4)
  const r = await run(() => {
    const out = { lampIdle: hs.lampOn() }
    hs.S.evs = []; hs.S.planAt = 1e9; hs.S.evN = 0; hs.newEvent(); hs.dbg.step(Math.round(hs.S.evs[0].warn * 60 * 0.7)); out.chime = hs.S.evs[0].type; out.lampWarn = hs.lampOn()
    hs.dbg.step(400); hs.S.evs = []; hs.S.evN = 1; hs.S.planAt = 1e9; hs.dbg.clearPax(); hs.dbg.addPax('coworker')
    const rr = hs.S.rand; hs.dbg.set({ rand: () => 0.3 }); const e = hs.newEvent(); hs.dbg.set({ rand: rr }); out.other = e.type
    let fl = 0; for (let i = 0; i < Math.round(e.warn * 60); i++) { hs.dbg.step(1); fl = Math.max(fl, hs.S.flicker || 0) } out.flicker = fl
    return out
  })
  expect(!r.lampIdle && r.chime === 'chime' && r.lampWarn && r.other === 'shake' && r.flicker > 0.3, JSON.stringify(r)); return r
})
await t('大きな音が来た瞬間: 画面のふちが光り・画面が揺れ・大きな擬音が出る', async () => {
  await begin(5)
  const r = await run(() => { hs.S.tut = 2; hs.dbg.toPeak(0.1); return { flash: document.querySelector('#flash').className, shake: hs.S.shake, ono: [...document.querySelectorAll('#fx .ono.yel')].map(e => e.textContent).join('|') } })
  await run(() => hs.dbg.render()); await p.screenshot({ path: ROOT + '/shots/peak.png' })
  expect(r.flash === 'now' && r.shake > 0.03 && r.ono.length > 0, JSON.stringify(r)); return r
})
await t('匂いでバレた時: 「くさっ！！誰！？」と判定は同時に出さない（吹き出しが先、判定はあと）', async () => {
  await begin(27); await quiet(['coworker', 'nose'])
  const r = await run(() => {
    const vis = sel => [...document.querySelectorAll('#fx ' + sel)].some(e => +e.style.opacity > 0.05)
    hs.smellBust('sniff'); let both = 0, sb = 0, vd = 0
    for (let i = 0; i < 150; i++) { hs.dbg.step(1); const a = vis('.sb'), b = vis('.verdict'); if (a && b) both++; if (a && !vd) sb++; if (b) vd++ }
    return { both, sb, vd }
  })
  await run(() => hs.dbg.render()); await p.screenshot({ path: ROOT + '/shots/smell-bust-order.png' })
  expect(r.both === 0 && r.sb > 30 && r.vd > 30, JSON.stringify(r)); return r
})
await t('吹き出し・擬音は同時に2つまで（音でバレた時・匂いでバレた時・なすりつけ）', async () => {
  await begin(6)
  const r = await run(() => {
    let mx = 0; const cnt = () => [...document.querySelectorAll('#fx > *')].filter(e => +e.style.opacity >= 0.99).length
    const watch = n => { for (let i = 0; i < n; i++) { hs.dbg.step(1); mx = Math.max(mx, cnt()) } }
    hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.clearPax(); for (const t of ['coworker', 'bucho', 'nose', 'madam']) hs.dbg.addPax(t)
    hs.S.cd.bubo = 0; hs.fart('bubo'); watch(180)
    hs.smellBust('sniff'); watch(180)
    hs.S.cd.bubo = 0; hs.fart('bubo'); hs.dbg.step(15); hs.dbg.set({ rand: () => 0.01 }); hs.useRuse('blame'); watch(180)
    hs.dbg.set({ rand: Math.random }); hs.S.smell = 0.9; watch(240); hs.S.smell = 1.8; watch(600)
    return mx
  })
  expect(r <= 2, 'max ' + r); return { max: r }
})

// ---- おならの種類と判定
await t('種類: 静かな箱では すかしっぺ だけ通る・ぷっ と ブボボボッ はバレる', async () => {
  await begin(7); await quiet(['coworker'])
  const a = await fart('suka'), b = await fart('pu'), c = await fart('bubo')
  expect(a.rec.rating === 'safe' && a.rec.pts === 1 && b.rec.rating === 'busted' && b.rec.pts === 0 && c.rec.rating === 'busted' && c.rec.pts === 0, JSON.stringify([a.rec, b.rec, c.rec].map(x => x.id + ':' + x.rating))); return [a, b, c].map(x => x.rec.id + ':' + x.rec.rating)
})
await t('種類: 大きな音の山なら ブボボボッ が通って10点・ヘッドホンの音もれなら ぷっ は通るが ブボボボッ は通らない', async () => {
  await begin(8)
  const peak = await run(() => { hs.S.tut = 2; hs.dbg.toPeak(hs.S.evs.length ? 0.3 : 0.3); hs.S.cd.bubo = 0; hs.fart('bubo'); hs.dbg.step(12); const r = hs.S.rec[hs.S.rec.length - 1]; return r.rating + ':' + r.pts })
  await quiet(['headphone'])
  const pu = await fart('pu'), bubo = await fart('bubo')
  expect(/perfect:10|safe:10/.test(peak) && /safe|perfect/.test(pu.rec.rating) && pu.rec.pts === 3 && bubo.rec.rating !== 'perfect' && bubo.rec.rating !== 'safe', JSON.stringify({ peak, pu: pu.rec.rating, bubo: bubo.rec.rating })); return { peak, pu: pu.rec.rating, bubo: bubo.rec.rating }
})
await t('種類: 静かなおならほど匂いがたまる（すかしっぺ > ブボボボッ > ぷっ）', async () => {
  const r = await run(() => Object.fromEntries(hs.D.farts.map(f => [f.id, f.smell])))
  expect(r.suka > r.bubo && r.bubo > r.pu, JSON.stringify(r)); return r
})
await t('溜まり直し: 出した種類は少しのあいだ押せず、ボタン自体が下から満ちて戻る（連打できない）', async () => {
  await begin(9); await quiet(['coworker'])
  const r = await run(() => {
    hs.S.cd.suka = 0; const a = hs.fart('suka'), b = hs.fart('suka'); hs.dbg.step(15)
    const btn = document.querySelector('#f_suka'), cs = getComputedStyle(btn, '::before')
    const mid = { dis: btn.disabled, cd: +btn.style.getPropertyValue('--cd'), wait: btn.classList.contains('wait'), coverH: parseFloat(cs.height), puOk: !document.querySelector('#f_pu').disabled }
    hs.dbg.step(Math.round(hs.FT.suka.cd * 60) + 2)
    return { a, b, mid, after: { dis: btn.disabled, cd: +btn.style.getPropertyValue('--cd') } }
  })
  expect(r.a === 'ok' && r.b === 'no' && r.mid.dis && r.mid.cd > 0.5 && r.mid.wait && r.mid.coverH > 20 && r.mid.puOk && !r.after.dis && r.after.cd === 0, JSON.stringify(r)); return r
})
await t('光るボタン: かき消せる時だけ光る（山で ブボボボッ が光る・静かな時は光らない）', async () => {
  await begin(10)
  const r = await run(() => {
    hs.S.tut = 2; hs.dbg.clearPax(); hs.dbg.addPax('coworker'); const g = k => document.querySelector('#f_' + k).classList.contains('go')
    hs.dbg.step(2); const calm = { bubo: g('bubo'), pu: g('pu'), suka: g('suka') }
    hs.dbg.toPeak(0.3); return { calm, peak: { bubo: g('bubo'), pu: g('pu') } }
  })
  expect(!r.calm.bubo && !r.calm.pu && !r.calm.suka && r.peak.bubo && r.peak.pu, JSON.stringify(r)); return r
})

// ---- ライフ・終わり方
await t('3回バレたら降ろされて終わる（結果に何階まで行けたかが出る）', async () => {
  await begin(11); await quiet(['coworker', 'bucho'])
  const r = await run(() => {
    const lives = []
    for (let i = 0; i < 3; i++) { hs.S.cd.bubo = 0; hs.S.snz = null; hs.fart('bubo'); hs.dbg.step(15); lives.push(hs.S.lives) }
    const hearts = document.querySelectorAll('#hLives i:not(.off)').length
    let n = 0; while (hs.S.mode === 'play' && n++ < 400) hs.dbg.step(1); const kicked = hs.S.mode
    while (hs.S.mode !== 'result' && n++ < 800) hs.dbg.step(1)
    hs.finishReveal(); return { lives, hearts, kicked, mode: hs.S.mode, floor: hs.S.result.floor, txt: document.querySelector('#rFloor').textContent }
  })
  expect(r.lives.join() === '2,1,0' && r.hearts === 0 && r.kicked === 'kicked' && r.mode === 'result' && r.txt === r.floor + '階まで到達', JSON.stringify(r)); return r
})
await t('なすりつけ: 3回目のバレも、すぐなすりつけて成功すれば取り消されて降ろされない（点も入る）', async () => {
  await begin(12); await quiet(['coworker', 'dog'])
  const r = await run(() => {
    for (let i = 0; i < 3; i++) { hs.S.cd.bubo = 0; hs.S.snz = null; hs.fart('bubo'); hs.dbg.step(15) }
    const before = { lives: hs.S.lives, score: hs.S.score, pinch: hs.pinch(), btn: !document.querySelector('#bBlame').hidden }
    const rr = hs.S.rand; hs.dbg.set({ rand: () => 0.01 }); const out = hs.useRuse('blame'); hs.dbg.set({ rand: rr }); hs.dbg.step(200)
    return { before, out, lives: hs.S.lives, score: hs.S.score, mode: hs.S.mode, who: hs.S.ruseLog[0].who, bubble: [...document.querySelectorAll('#fx .sb')].map(e => e.textContent).join('|') }
  })
  expect(r.before.lives === 0 && r.before.pinch && r.before.btn && r.out === 'success' && r.lives === 1 && r.score === 10 && r.mode === 'play' && r.who === 'dog', JSON.stringify(r)); return r
})
await t('なすりつけ: ピンチの時だけ出る1つのボタン・失敗するとさらに1回バレ・回数に限りがある', async () => {
  await begin(13); await quiet(['coworker', 'bucho'])
  const r = await run(() => {
    const vis = () => !document.querySelector('#bBlame').hidden
    hs.dbg.step(2); const calm = vis()
    hs.S.smell = 0.75 * hs.D.run.bustAt / hs.sniffMult(); let n = 0; while (hs.S.air < 2 && n++ < 600) hs.dbg.step(1); hs.dbg.step(2); const sniffy = vis()
    const l0 = hs.S.lives; const rr = hs.S.rand; hs.dbg.set({ rand: () => 0.99 }); const out = hs.useRuse('blame'); hs.dbg.set({ rand: rr }); hs.dbg.step(60)
    const lost = l0 - hs.S.lives
    hs.S.ruseLeft.blame = 0; hs.S.smell = 0.75 * hs.D.run.bustAt / hs.sniffMult(); n = 0; while (hs.S.air < 2 && n++ < 600) hs.dbg.step(1); hs.dbg.step(2)
    return { calm, sniffy, out, lost, none: vis(), no: hs.useRuse('blame'), max: hs.D.ruses.blame }
  })
  expect(!r.calm && r.sniffy && r.out === 'fail' && r.lost === 1 && !r.none && r.no === 'no' && r.max === 3, JSON.stringify(r)); return r
})
await t('屋上まで行くと胸を張って終わる', async () => {
  await begin(14)
  const r = await run(() => { hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.floor(hs.D.run.top - 0.3); let n = 0; while (hs.S.mode !== 'result' && n++ < 1200) hs.dbg.step(1); hs.finishReveal(); return { mode: hs.S.mode, roof: hs.S.result.roof, floor: hs.S.result.floor, txt: document.querySelector('#rFloor').textContent } })
  expect(r.mode === 'result' && r.roof && r.floor === 80 && r.txt === '屋上まで到達', JSON.stringify(r)); return r
})

// ---- 一続きで登る
await t('一続き: 区切りの画面を出さずに登り続け、20階で社長・40階でデートの顔ぶれと内装に変わる', async () => {
  await begin(15)
  const r = await run(() => {
    hs.S.tut = 2; const seen = { zones: new Set(), ceo: false, partner: false, cards: 0 }
    let n = 0
    while (hs.S.mode === 'play' && hs.S.floor < 60 && n++ < 60 * 500) {
      hs.S.lives = 3; hs.dbg.step(1); seen.zones.add(hs.S.zone)
      if (hs.aboard().some(p => p.type === 'ceo')) seen.ceo = seen.ceo || hs.S.floor
      if (hs.aboard().some(p => p.type === 'partner')) seen.partner = seen.partner || hs.S.floor
      if (!document.querySelector('#introCard').hidden) seen.cards++
    }
    return { floor: hs.S.floor, zones: [...seen.zones].join(), ceo: seen.ceo, partner: seen.partner, cards: seen.cards, mode: hs.S.mode }
  })
  await run(() => hs.dbg.render()); await p.screenshot({ path: ROOT + '/shots/zone-date.png' })
  expect(r.floor >= 60 && r.zones === '0,1,2' && r.ceo >= 20 && r.ceo < 40 && r.partner >= 40 && r.cards === 0 && r.mode === 'play', JSON.stringify(r)); return r
})
await t('乗り降り: 止まるたびに降りるのは1人まで・乗るのも1人まで', async () => {
  await begin(16)
  const r = await run(() => {
    hs.S.tut = 2; const stops = []; let n = 0, was = null
    while (stops.length < 6 && n++ < 60 * 200) {
      hs.S.lives = 3; hs.dbg.step(1)
      if (hs.S.stop && hs.S.stop !== was && hs.S.stop.did) { was = hs.S.stop; stops.push({ ex: hs.S.pax.filter(p => p.state === 'exit').length, bd: hs.S.pax.filter(p => p.state === 'board').length }) }
    }
    return stops
  })
  expect(r.length === 6 && r.every(s => s.ex <= 1 && s.bd <= 1) && r.some(s => s.ex + s.bd > 0), JSON.stringify(r)); return r
})
await t('上の階ほど厳しい（予告が短く・山が短く・間隔が短く・ひっかけは10階まで出ない）', async () => {
  const r = await run(() => {
    hs.dbg.seed(17); hs.start(); hs.beginCount(); hs.dbg.step(150)
    const at = f => { hs.dbg.floor(f); return { warn: +hs.RP('warn').toFixed(2), peak: +hs.RP('peak').toFixed(2), gap: +hs.RP('gap').toFixed(2) } }
    return { f1: at(1), f30: at(30), f60: at(60) }
  })
  const never = await botRun('never', 18, 1)
  const log = await run(() => hs.S.evLog), early = log.filter(e => e.f < 10 && e.fake).length, later = log.filter(e => e.fake).length
  expect(r.f1.warn > r.f30.warn && r.f30.warn > r.f60.warn && r.f1.peak > r.f60.peak && r.f1.gap > r.f60.gap && early === 0 && later >= 1, JSON.stringify({ ...r, early, later })); return { ...r, fakes: later }
})

// ---- 匂い
await t('すかし連打: 数発でざわざわ（ひそひそ・鼻をつまむ・BGMが不穏）→ 犯人探しに入る', async () => {
  await begin(19); await quiet(['coworker', 'bucho', 'madam'])
  const r = await run(() => {
    hs.S.tut = 2; let n = 0, k = 0, zawaAt = -1, huntAt = -1, pinch = 0, talk = 0, said = new Set()
    for (const p of hs.aboard()) p.age = 99
    while (hs.S.air < 2 && n++ < 60 * 40) {
      if (hs.canFart('suka')) { hs.fart('suka'); k++ }
      hs.dbg.step(1)
      if (hs.S.air >= 1 && zawaAt < 0) zawaAt = k
      if (hs.S.air === 1) { for (const p of hs.aboard()) { if (p.n.pinchH.visible) pinch++; if (p.n.talkT > 0) talk++ } for (const e of document.querySelectorAll('#fx .sb')) said.add(e.textContent) }
      if (hs.S.air === 2) huntAt = k
    }
    return { zawaAt, huntAt, pinch: pinch > 0, talk: talk > 0, tense: hs.Snd.tense, whisper: [...said].some(x => hs.D.T.ja.zawa.includes(x)), said: [...said].join('|'), busts: hs.S.smellBusts }
  })
  expect(r.zawaAt >= 1 && r.zawaAt <= 3 && r.huntAt > r.zawaAt && r.huntAt <= 5 && r.pinch && r.talk && r.whisper && r.tense === 2 && r.busts === 0, JSON.stringify(r)); return r
})
await t('画面: ざわざわ・犯人探し・視線が自分に来た瞬間（縦 390x844 のスクショ）', async () => {
  await begin(31); await quiet(['coworker', 'bucho', 'madam'])
  const cnt = () => p.evaluate(() => [...document.querySelectorAll('#fx > *')].filter(e => +e.style.opacity > 0.05).length)
  const z = await run(() => { hs.S.tut = 2; for (const p of hs.aboard()) p.age = 99; hs.S.smell = 0.9; let n = 0; while (hs.S.air < 1 && n++ < 300) hs.dbg.step(1); hs.S.zawaT = 0; hs.dbg.step(40); hs.dbg.render(); return hs.S.air })
  await p.screenshot({ path: ROOT + '/shots/air-zawa.png' }); const c1 = await cnt()
  const h = await toHunt(false); await run(() => hs.dbg.render()); await p.screenshot({ path: ROOT + '/shots/air-hunt.png' }); const c2 = await cnt()
  const m = await run(() => { let k = 0; while (hs.S.hunt.to !== 'me' && k++ < 40) hs.nextGaze(); hs.dbg.step(25); hs.dbg.render(); return { to: hs.S.hunt.to, gazed: hs.gazedNow() } })
  await p.screenshot({ path: ROOT + '/shots/air-gaze-me.png' }); const c3 = await cnt()
  expect(z === 1 && h.air === 2 && m.to === 'me' && m.gazed && c1 <= 2 && c2 <= 2 && c3 <= 2, JSON.stringify({ z, h, m, c1, c2, c3 })); return { c1, c2, c3 }
})
await t('犯人探し: 視線が自分に来ている間に出すと、すかしっぺでも即バレ（1回失う・空気は戻る）', async () => {
  await begin(32); await quiet(['coworker', 'bucho'])
  await toHunt(true)
  const r = await run(() => {
    const l0 = hs.S.lives; hs.S.cd.suka = 0; hs.fart('suka'); hs.dbg.step(12)
    const rec = hs.S.rec[hs.S.rec.length - 1], lost = l0 - hs.S.lives
    hs.dbg.step(70); const said = [...document.querySelectorAll('#fx .sb')].map(e => e.textContent).join('|')
    return { rating: rec.rating, pts: rec.pts, lost, hunt: !!hs.S.hunt, air: hs.S.air, said }
  })
  expect(r.rating === 'caught' && r.pts === 0 && r.lost === 1 && !r.hunt && r.air === 0 && /やっぱりお前か/.test(r.said), JSON.stringify(r)); return r
})
await t('犯人探し: 視線が自分に来ても、出さずに耐えれば疑いは別の人へ移る', async () => {
  await begin(33); await quiet(['coworker', 'bucho', 'nose'])
  await toHunt(true)
  const r = await run(() => {
    const l0 = hs.S.lives, from0 = hs.S.hunt.from.type; let n = 0
    while (hs.S.hunt && hs.S.hunt.to === 'me' && n++ < 400) hs.dbg.step(1)
    return { sec: +(n / 60).toFixed(2), to: hs.S.hunt && (hs.S.hunt.to === 'me' ? 'me' : hs.S.hunt.to ? hs.S.hunt.to.type : null), from: hs.S.hunt && hs.S.hunt.from.type, from0, lost: l0 - hs.S.lives, busts: hs.S.smellBusts }
  })
  expect(r.to && r.to !== 'me' && r.sec <= GAZE_ME + 0.1 && r.lost === 0, JSON.stringify(r)); return r
})
await t('犯人探し: 視線と「…あなた？」が人から人へ移る（疑われた人が次に疑う）', async () => {
  await begin(34); await quiet(['coworker', 'bucho', 'madam', 'nose'])
  await toHunt(false)
  const r = await run(() => {
    const seq = []; let prev = null, chain = 0, pairs = 0, q = 0
    for (let i = 0; i < 60 * 14 && hs.S.hunt; i++) {
      const h = hs.S.hunt, key = h.n
      if (key !== prev) {
        const to = h.to === 'me' ? 'me' : h.to ? h.to.type : '-'
        if (seq.length) { const last = seq[seq.length - 1]; if (last.to !== 'me' && last.to !== '-') { pairs++; if (last.to === h.from.type) chain++ } }
        seq.push({ from: h.from.type, to }); prev = key
        if ([...document.querySelectorAll('#fx .sb')].some(e => /あなた|気のせい/.test(e.textContent))) q++
      }
      hs.S.smell = 0.75 * hs.D.run.bustAt / hs.sniffMult(); hs.dbg.step(1)
    }
    return { seq: seq.map(s => s.from + '>' + s.to).join(' '), chain, pairs, q, n: seq.length, froms: new Set(seq.map(s => s.from)).size }
  })
  expect(r.n >= 5 && r.froms >= 3 && r.chain === r.pairs && r.pairs >= 2 && r.q >= r.n - 1, JSON.stringify(r)); return r
})
await t('匂いが抜けると落ち着く: 犯人探し → ざわざわ → 平常に戻り、乗客も元どおり', async () => {
  await begin(35); await quiet(['coworker', 'bucho'])
  await toHunt(false)
  const r = await run(() => {
    const seen = []; let n = 0
    while (hs.S.air > 0 && n++ < 60 * 90) { hs.dbg.step(1); if (seen[seen.length - 1] !== hs.S.air) seen.push(hs.S.air) }
    hs.dbg.step(30)
    const ab = hs.aboard()
    return { sec: +(n / 60).toFixed(1), seen: seen.join('>'), hunt: !!hs.S.hunt, tense: hs.Snd.tense, pinch: ab.some(p => p.n.pinchH.visible), gaze: ab.some(p => p.n.gaze), busts: hs.S.smellBusts, lives: hs.S.lives }
  })
  expect(r.seen.endsWith('0') && r.seen.includes('1') && !r.hunt && r.tense === 0 && !r.pinch && !r.gaze && r.busts === 0 && r.sec < 60, JSON.stringify(r)); return r
})
await t('犯人探し中の なすりつけ: 成功で疑いを押し付けて空気が戻る（押し付けられた人は首を振る）／失敗で1回失う', async () => {
  await begin(36); await quiet(['coworker', 'dog'])
  await toHunt(true)
  const ok = await run(() => {
    const btn = !document.querySelector('#bBlame').hidden, rr = hs.S.rand; hs.dbg.set({ rand: () => 0.01 }); const out = hs.useRuse('blame'); hs.dbg.set({ rand: rr }); hs.dbg.step(40)
    const dog = hs.aboard().find(p => p.type === 'dog'); return { btn, out, hunt: !!hs.S.hunt, air: hs.S.air, deny: dog.n.denyT > 0, lives: hs.S.lives }
  })
  await run(() => hs.dbg.render()); await p.screenshot({ path: ROOT + '/shots/air-blame.png' })
  await toHunt(true)
  const ng = await run(() => { const l0 = hs.S.lives, rr = hs.S.rand; hs.dbg.set({ rand: () => 0.99 }); const out = hs.useRuse('blame'); hs.dbg.set({ rand: rr }); hs.dbg.step(40); return { out, lost: l0 - hs.S.lives, hunt: !!hs.S.hunt } })
  expect(ok.btn && ok.out === 'success' && !ok.hunt && ok.air === 0 && ok.deny && ok.lives === 3 && ng.out === 'fail' && ng.lost === 1 && !ng.hunt, JSON.stringify({ ok, ng })); return { ok, ng }
})
await t('匂い隠し: ドアが開いている間は匂いがすぐ消え、くんくん度も下がる', async () => {
  await begin(20)
  const r = await run(() => {
    hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.clearPax(); hs.dbg.addPax('coworker')
    const meas = door => { hs.S.smell = 1; hs.S.sniff = 0.5; hs.S.door = door; hs.S.stop = door ? { t: 1, did: true } : null; for (let i = 0; i < 60; i++) { if (door) { hs.S.stop.t = 1; hs.S.door = 1 } hs.dbg.step(1) } return { smell: +hs.S.smell.toFixed(3), sniff: +hs.S.sniff.toFixed(3) } }
    const closed = meas(0), open = meas(1); hs.S.stop = null; hs.S.door = 0
    return { closed, open }
  })
  expect(r.open.smell < r.closed.smell * 0.4 && r.open.sniff < r.closed.sniff, JSON.stringify(r)); return r
})
await t('匂い隠し: カレー弁当・香水の人が乗ってきた直後は匂いが消えやすい', async () => {
  await begin(21)
  const r = await run(() => {
    hs.S.evs = []; hs.S.planAt = 1e9
    const meas = types => { hs.dbg.clearPax(); for (const t of types) { const p = hs.dbg.addPax(t); p.age = 0 } hs.S.smell = 1; hs.S.sniff = 0.3; hs.dbg.step(60); return +hs.S.smell.toFixed(3) }
    return { plain: meas(['coworker']), curry: meas(['coworker', 'curry']), madam: meas(['coworker', 'madam']) }
  })
  expect(r.curry < r.plain * 0.75 && r.madam < r.plain * 0.75, JSON.stringify(r)); return r
})
await t('匂い: だれも乗っていなければ、くんくん度は上がらない', async () => {
  await begin(22)
  const r = await run(() => { hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.clearPax(); hs.S.smell = 1; hs.dbg.step(180); return { sniff: hs.S.sniff, busts: hs.S.smellBusts } })
  expect(r.sniff === 0 && r.busts === 0, JSON.stringify(r)); return r
})
// ---- 乗客
await t('乗客: 鼻が利く人がいると、くんくん度の上がり方が速い（同僚の1.6倍以上）', async () => {
  await begin(23)
  const r = await run(() => {
    hs.S.evs = []; hs.S.planAt = 1e9
    hs.dbg.floor(30); const meas = t => { hs.dbg.clearPax(); hs.dbg.addPax(t); hs.S.smell = 1.2; hs.S.sniff = 0; hs.S.smellBusts = 0; hs.S.stop = { t: 9, did: true }; hs.dbg.step(30); return +hs.S.sniff.toFixed(3) }
    return { coworker: meas('coworker'), nose: meas('nose'), dog: meas('dog'), headphoneKid: meas('headphone') }
  })
  expect(r.nose > r.coworker * 1.6 && r.dog > r.coworker && r.headphoneKid < r.coworker, JSON.stringify(r)); return r
})
await t('乗客: 清掃員のおばちゃんは、くんくん度が上がると1回だけ黙って消臭する', async () => {
  await begin(24)
  const r = await run(() => { hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.clearPax(); const c = hs.dbg.addPax('cleaner'); hs.S.smell = 1; hs.S.sniff = 0.56; hs.dbg.step(1); const a = { smell: hs.S.smell, sniff: hs.S.sniff, sprayed: c.sprayed }; hs.S.smell = 1; hs.S.sniff = 0.56; hs.dbg.step(1); return { a, again: hs.S.smell > 0.9 } })
  expect(r.a.smell === 0 && r.a.sniff < 0.3 && r.a.sprayed && r.again, JSON.stringify(r)); return r
})
await t('乗客: 乗っている人の出す大きな音が顔ぶれで決まる（赤ちゃん→泣き声・犬→ほえる・社長→大笑い）', async () => {
  const r = await run(() => {
    const out = {}
    for (const t of ['baby', 'dog', 'delivery', 'jk', 'headphone', 'ceo']) { hs.dbg.seed(25); hs.start(); hs.beginCount(); hs.dbg.step(150); hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.clearPax(); hs.dbg.addPax(t); hs.S.evN = 1; const rr = hs.S.rand; hs.dbg.set({ rand: () => 0.3 }); const e = hs.newEvent(); hs.dbg.set({ rand: rr }); out[t] = e.type + ':' + (e.src && e.src.type) }
    return out
  })
  expect(r.baby === 'baby:baby' && r.dog === 'bark:dog' && r.delivery === 'cart:delivery' && r.jk === 'giggle:jk' && r.headphone === 'music:headphone' && r.ceo === 'laugh:ceo', JSON.stringify(r)); return r
})
await t('乗客: 箱からはみ出さない・重ならない（満員・犬と台車も込み）／14種類どれも出せる', async () => {
  const r = await run(() => {
    const bad = []
    const combos = [['coworker', 'bucho', 'madam', 'curry', 'nose', 'headphone', 'baby', 'dog', 'delivery'], ['partner', 'dog', 'jk', 'yakiniku', 'cleaner', 'baby', 'ceo', 'delivery', 'madam'], ['ceo', 'dog', 'nose', 'cleaner', 'bucho', 'curry', 'headphone', 'jk']]
    for (const c of combos) {
      hs.dbg.clearPax(); for (const t of c) hs.dbg.addPax(t); hs.dbg.step(2)
      const L = hs.dbg.layout(), C = hs.CAR
      for (const a of L) if (Math.abs(a.x) > C.x - a.r + 0.02 || a.z < C.zb + a.r - 0.02 || a.z > C.zf - a.r) bad.push('out:' + a.k)
      for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j], d = Math.hypot(a.x - b.x, a.z - b.z), need = a.k.match(/dog-animal|cart/) || b.k.match(/dog-animal|cart/) ? 0.36 : 0.52; if (d < need) bad.push(`${a.k}-${b.k}:${d.toFixed(2)}`) }
    }
    const all = Object.keys(hs.D.pax); let made = 0; for (const t of all) { hs.dbg.clearPax(); if (hs.dbg.addPax(t)) made++ }
    return { bad, made, all: all.length }
  })
  expect(!r.bad.length && r.made === r.all, JSON.stringify(r)); return r
})
await t('一言: 乗客14種類すべてに 乗る・降りる・気づく・なすりつけられた の一言が日英そろっている', async () => {
  const r = await run(() => { const bad = []; for (const [k, v] of Object.entries(hs.D.pax)) for (const f of ['board', 'exit', 'notice', 'blamed']) { if (!v[f] || !v[f].length) bad.push(k + '.' + f); else for (const pr of v[f]) if (!pr[0] || !pr[1] || /[぀-ヿ一-鿿]/.test(pr[1])) bad.push(k + '.' + f) } return { bad, n: Object.keys(hs.D.pax).length } })
  expect(!r.bad.length && r.n === 14, JSON.stringify(r)); return r
})

// ---- 通し・結果
let skilled
await t('通しで遊べる: 上手い人は点を稼いで、結果まで行く', async () => {
  skilled = await botRun('skilledR', 2, 1)
  expect(skilled.score >= 60 && skilled.floor >= 10 && skilled.steps < 60 * 900, JSON.stringify({ ...skilled, rec: skilled.rec.length })); return { score: skilled.score, floor: skilled.floor, rank: skilled.rank, n: skilled.n }
})
await t('結果画面: 大見出しが点数・何階まで到達を添える・ボタンが押せる位置に出る', async () => {
  const r = await run(() => { hs.finishReveal(); return { pct: document.querySelector('#rPct').textContent, unit: document.querySelector('.resNum .pct span').textContent, floor: document.querySelector('#rFloor').textContent, stamp: document.querySelector('#rStamp').classList.contains('on'), rank: document.querySelector('#rRank').textContent, st: document.querySelector('#rStages').textContent, pax: document.querySelector('#rPax').textContent } })
  await p.waitForTimeout(400)
  expect(r.pct === String(skilled.score) && r.unit === '点' && /階まで到達|屋上まで到達/.test(r.floor) && r.stamp && r.rank && /バレずに/.test(r.st) && /なすりつけ/.test(r.st) && /今日の乗客/.test(r.pax), JSON.stringify(r)); await p.screenshot({ path: ROOT + '/shots/result.png' }); return r
})
await t('結果画面: 判定は発表まで見せない', async () => {
  const r = await run(() => { hs.toResult(); hs.dbg.step(30); return { stamp: document.querySelector('#rStamp').classList.contains('on'), rank: document.querySelector('#rRank').classList.contains('on') } })
  expect(!r.stamp && !r.rank, JSON.stringify(r)); return r
})
await t('結果カード画像: 1080x1350 で中身が描けている・顔写真が撮れている', async () => {
  const r = await run(async () => {
    hs.finishReveal(); const url = await hs.cardDataURL(); const img = new Image(); img.src = url; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data; let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 4 * 31) { const v = d[i] * .3 + d[i + 1] * .59 + d[i + 2] * .11; s += v; s2 += v * v; n++ }
    const ph = document.querySelector('#rPhoto').getContext('2d').getImageData(0, 0, 256, 256).data; let a = 0, a2 = 0, m = 0; for (let i = 0; i < ph.length; i += 4 * 7) { const v = ph[i] * .3 + ph[i + 1] * .59 + ph[i + 2] * .11; a += v; a2 += v * v; m++ }
    return { w: img.width, h: img.height, v: Math.round(s2 / n - (s / n) ** 2), photo: hs.S.photo, pv: Math.round(a2 / m - (a / m) ** 2), url }
  })
  const { writeFileSync } = await import('node:fs'); writeFileSync(ROOT + '/shots/card.png', Buffer.from(r.url.split(',')[1], 'base64'))
  expect(r.w === 1080 && r.h === 1350 && r.v > 1500 && r.photo && r.pv > 200, JSON.stringify({ ...r, url: 0 })); return { w: r.w, h: r.h, v: r.v, pv: r.pv }
})
await t('画像を保存ボタンでダウンロードされる（PC）', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 5000 }), p.click('#bSave')])
  expect(dl.suggestedFilename() === 'elevator-fart.png', dl.suggestedFilename()); return dl.suggestedFilename()
})
await t('Xでポスト: 点数・ランク・到達階入りの x.com/intent/post が新しいタブで開く', async () => {
  const w = await run(() => { const r = hs.S.result; return ['エレベーターで' + r.score + '点', r.rank.t.ja, r.floor + '階まで到達', 'バレずに' + r.n + '発', r.db.toFixed(1) + 'dB'] })
  const r = await xCheck(p, 'hs', w, '#密室おなら選手権', PUB); expect(r.label === 'Xでポスト', r.label); return r
})
await t('同じ種と同じ操作なら同じ結果（再現性・乗客の顔ぶれも同じ）', async () => {
  const a = JSON.stringify(await botRun('skilledR', 42, 5)), b = JSON.stringify(await botRun('skilledR', 42, 5))
  expect(a === b, a.slice(0, 80) + ' vs ' + b.slice(0, 80)); return { n: JSON.parse(a).rec.length }
})
let dist
await t('点数の分布: 上手い人（光を見て押す・匂いを見て混ぜる・なすりつけも使う）は最高ランク2〜6割／すかし連打は上手い人の1/3未満・溜まったら全部押す・何もしない は低い', async () => {
  dist = await p.evaluate(b => {
    const bot = eval(b), run = (m, n, base) => { const o = []; for (let i = 0; i < n; i++) { hs.dbg.seed(base + i * 7); hs.start(); o.push(bot(m, base * 31 + i)) } return o }
    const TOP = hs.D.ranks[0].min
    const st = a => { const sc = a.map(x => x.score).sort((x, y) => x - y), fl = a.map(x => x.floor).sort((x, y) => x - y); return { min: sc[0], med: sc[sc.length >> 1], max: sc[sc.length - 1], top: sc.filter(x => x >= TOP).length, n: sc.length, floorMed: fl[fl.length >> 1], roof: a.filter(x => x.roof).length, ranks: Object.entries(a.reduce((o, x) => (o[x.rank] = (o[x.rank] || 0) + 1, o), {})).map(e => e.join(':')).join(' ') } }
    return { skilled: st(run('skilled', 20, 100)), skilledR: st(run('skilledR', 20, 100)), aim: st(run('aim', 10, 100)), spam: st(run('spam', 6, 300)), suka: st(run('suka', 6, 300)), sukaWait: st(run('sukaWait', 6, 300)), never: st(run('never', 4, 500)) }
  }, BOT)
  const d = dist
  expect(d.skilledR.top >= 4 && d.skilledR.top <= 12 && d.skilledR.med > d.skilled.med * 0.9 && d.spam.max < 20 && d.suka.max * 3 < d.skilled.med && d.sukaWait.med * 2.5 < d.skilled.med && d.never.max === 0, JSON.stringify(d)); return d
})
await t('英語に切り替えると全部の文言が英語になる（ボタン・乗客・結果）', async () => {
  const r = await run(() => {
    hs.toTitle(); hs.setLang('en')
    const title = document.querySelector('.logo').textContent, start = document.querySelector('#bStart').textContent
    hs.dbg.seed(3); hs.start(); const intro = document.querySelector('#iName').textContent, btns = [...document.querySelectorAll('.fb .fn')].map(e => e.textContent).join(','), play = document.querySelector('#vPlay').innerText
    hs.toResult(); hs.finishReveal(); const rank = document.querySelector('#rRank').textContent
    const ja = /[぀-ヿ一-鿿]/.test(document.querySelector('#vResult').innerText + title + start + intro + btns + play)
    return { title, start, intro, btns, rank, ja, floor: document.querySelector('#rFloor').textContent }
  })
  await p.screenshot({ path: ROOT + '/shots/result-en.png' })
  await run(() => hs.setLang('ja'))
  expect(/FART/.test(r.title) && r.start === 'Get on' && r.btns === 'Silent,Toot,Thunder' && r.rank && !r.ja && /Reached floor/.test(r.floor), JSON.stringify(r)); return r
})
await t('英語: Post on X も英語の点数・ハッシュタグで開く', async () => {
  await run(() => { hs.setLang('en'); hs.toResult(); hs.finishReveal() })
  const w = await run(() => { const r = hs.S.result; return ['Scored ' + r.score, r.rank.t.en, 'reached floor ' + r.floor] })
  const r = await xCheck(p, 'hs', w, '#ElevatorFart', PUB); await run(() => hs.setLang('ja')); expect(r.label === 'Post on X', r.label); return r
})
await t('音: 鳴らす関数がエラーなく呼ばれる（出来事の音・おなら。テスト中は無音）', async () => {
  await run(() => hs.toTitle()); await p.click('#bStart'); await p.click('#bGo')
  await run(() => { hs.dbg.pause(); hs.dbg.step(150); hs.dbg.toPeak(0.3); hs.dbg.render() })
  await p.click('#f_bubo')
  const r = await run(() => { hs.dbg.step(30); return { state: hs.Snd.ctx && hs.Snd.ctx.state, played: Object.keys(hs.Snd.played), rec: hs.S.rec.map(x => x.id + ':' + x.rating) } })
  await p.waitForTimeout(500)
  // テスト中は実際には鳴らさない（_mute.mjs で AudioContext は止めたまま）。鳴らす関数が呼ばれたかで確かめる
  await run(() => hs.Snd.setMute(true)); await p.waitForTimeout(150)
  const muted = await run(() => hs.Snd.master.gain.value)
  await run(() => hs.Snd.setMute(false))
  expect(r.state === 'suspended' && r.played.includes('ev:chime') && r.played.includes('fart') && r.rec.length === 1 && /bubo:(perfect|safe)/.test(r.rec[0]) && muted === 0 && !p.errs.length, JSON.stringify({ ...r, muted, errs: p.errs })); return { played: r.played.length, rec: r.rec, ctx: r.state }
})
await t('PC: 1・2・3 キーでも出せる', async () => {
  await begin(26); await quiet(['coworker'])
  await p.keyboard.press('Digit1'); await run(() => hs.dbg.step(12))
  const r = await run(() => hs.S.rec.map(x => x.id))
  expect(r.join() === 'suka', r.join()); return r
})
await t('全部の出来事の音が鳴る（9種）＋消臭・ボタン連打', async () => {
  const r = await run(() => { for (const e of ['chime', 'phone', 'shake', 'laugh', 'baby', 'bark', 'cart', 'giggle', 'music']) hs.Snd.event(e, 1, 0.5); hs.Snd.sfx('spray'); hs.Snd.sfx('mash'); return Object.keys(hs.Snd.played).filter(k => k.startsWith('ev:')).length })
  expect(r === 9 && !p.errs.length, r + ' ' + p.errs.join('|')); return r
})
// ---- 音の作り込み（鳴らさずに、呼ばれ方と中身の散らばりで固定する）
await t('おならの音: 録音の差分から選び、同じ素材を続けない・速さが毎回違う（3種×15回）', async () => {
  await p.waitForFunction(() => ['pu1', 'bubo1', 'suka1'].every(n => hs.Snd.bufs[n] && hs.Snd.bufs[n] !== 'loading'), null, { timeout: 15000 })
  const r = await run(() => {
    const out = {}
    for (const k of ['suka', 'pu', 'bubo']) {
      const L = []; for (let i = 0; i < 15; i++) L.push(hs.Snd.fart(k, 'plain'))
      const sig = L.map(p => p.name + '@' + p.rate.toFixed(3))
      out[k] = { uniq: new Set(sig).size, files: new Set(L.map(p => p.name)).size, sameNext: L.some((p, i) => i && p.name === L[i - 1].name), rates: [Math.min(...L.map(p => p.rate)).toFixed(2), Math.max(...L.map(p => p.rate)).toFixed(2)].join('-'), dur: +(L.reduce((a, p) => a + p.dur, 0) / L.length).toFixed(2), allLoaded: L.every(p => p.dur > 0) }
    }
    return out
  })
  for (const k in r) expect(r[k].uniq === 15 && !r[k].sameNext && r[k].allLoaded, k + ' ' + JSON.stringify(r[k]))
  expect(r.pu.files >= 4 && r.bubo.files >= 4 && r.suka.files === 2, '差分の数 ' + JSON.stringify(r))
  expect(r.pu.dur < 0.6 && r.bubo.dur > 1.1, 'ぷっは短く、ブボボボッは長い ' + JSON.stringify(r))
  return r
})
await t('音: 合成音を使っていない（createOscillator が0回）・素材が全部読める', async () => {
  const r = await run(async () => {
    const miss = []; for (const n of new Set(Object.values(hs.SF).flat())) { const res = await fetch(hs.Snd.url(n)); if (!res.ok) miss.push(n) }
    return { miss, oscSrc: /createOscillator/.test(await (await fetch('game.js')).text()) }
  })
  expect(!r.miss.length && !r.oscSrc, JSON.stringify(r)); return r
})
await t('おならの音: かき消せた=こもって小さく / バレた=狭い箱の残響 / すかしっぺ=空気だけ', async () => {
  await begin(31); await quiet(['coworker', 'bucho'])
  const ok = await run(() => { hs.S.planAt = hs.S.st; const e = hs.dbg.toPeak(0.3); hs.S.cd.bubo = 0; hs.S.snz = null; hs.fart('bubo'); hs.dbg.step(12); const L = hs.S.rec[hs.S.rec.length - 1]; return { rating: L.rating, how: hs.Snd.fartLog[hs.Snd.fartLog.length - 1].how, ev: e && e.type } })
  const bad = await run(() => { hs.S.evs = []; hs.S.planAt = 1e9; hs.S.cd.bubo = 0; hs.S.snz = null; const n0 = hs.Snd.played.echo || 0; hs.fart('bubo'); hs.dbg.step(12); const L = hs.S.rec[hs.S.rec.length - 1]; return { rating: L.rating, how: hs.Snd.fartLog[hs.Snd.fartLog.length - 1].how, echo: (hs.Snd.played.echo || 0) - n0 } })
  const suka = await run(() => { hs.S.cd.suka = 0; hs.S.snz = null; hs.S.smell = 0; hs.S.sniff = 0; hs.fart('suka'); hs.dbg.step(12); const p = hs.Snd.fartLog[hs.Snd.fartLog.length - 1]; return { how: p.how, kind: p.kind, name: p.name } })
  const route = await run(() => ({ muf: hs.Snd.muf.frequency.value, mufGain: hs.Snd.muf.context ? 1 : 0, box: !!hs.Snd.box.buffer, boxLen: +(hs.Snd.box.buffer.duration).toFixed(2) }))
  expect(/perfect|safe/.test(ok.rating) && ok.how === 'masked' && bad.rating === 'busted' && bad.how === 'busted' && bad.echo === 1 && suka.how === 'plain' && suka.kind === 'suka' && /^suka/.test(suka.name) && route.muf < 500 && route.box && route.boxLen < 0.6, JSON.stringify({ ok, bad, suka, route }))
  return { ok: ok.how, bad: bad.how, suka: suka.how, muffle: route.muf + 'Hz', box: route.boxLen + 's' }
})
await t('BGM: 平常=エレベーターの曲 / ざわざわ=速さ（音程）がうねってこもる / 犯人探し=曲が消えて心臓の音だけ', async () => {
  await p.waitForFunction(() => hs.Snd.bufs.bgm_quiet && hs.Snd.bufs.bgm_quiet !== 'loading', null, { timeout: 15000 })
  const r = await run(async () => {
    const S = hs.Snd, out = {}, keepT = S.track, keepW = S.want
    S.want = null; S.setTrack('quiet'); S.switchAt = S.now(); S.tick()
    const look = (ten, sour) => { S.tense = ten; S.sour = sour; const rs = []; for (let i = 0; i < 40; i++) { const t0 = performance.now(); while (performance.now() - t0 < 8); S.tick(); rs.push(S.rate) } return { mode: S.mode, spread: +(Math.max(...rs) - Math.min(...rs)).toFixed(4), heart: !!S.heartSrc, src: !!S.bgmSrc } }
    out.calm = look(0, 0)
    await new Promise(r => setTimeout(r, 400)); out.zawa = look(1, 0.8)
    out.hunt = look(2, 1); out.back = look(0, 0)
    S.tense = 0; S.sour = 0; S.want = keepW; S.track = keepT
    return out
  })
  expect(r.calm.mode === 'calm' && r.calm.src && r.calm.spread === 0 && !r.calm.heart, 'calm ' + JSON.stringify(r.calm))
  expect(r.zawa.mode === 'sour' && r.zawa.spread > 0.001, 'zawa ' + JSON.stringify(r.zawa))
  expect(r.hunt.mode === 'heart', 'hunt ' + JSON.stringify(r.hunt))
  expect(r.back.mode === 'calm' && !r.back.heart, 'back ' + JSON.stringify(r.back))
  return r
})
await t('BGM: 遊びの中で 匂いがたまると少しずつずれ、犯人探しで心臓、落ち着くと元の曲に戻る', async () => {
  await begin(33); await quiet(['coworker', 'bucho', 'nose'])
  const r = await run(() => {
    const S = hs.S, A = hs.D.run.air, log = {}
    S.tut = 2; S.smell = (A.zawa + 0.08) * hs.D.run.bustAt / hs.sniffMult(); let n = 0
    while (S.air < 1 && n++ < 600) hs.dbg.step(1)
    const s0 = hs.Snd.sour; hs.dbg.step(60); const s1 = hs.Snd.sour; hs.dbg.step(120); log.zawa = { air: S.air, s0: +s0.toFixed(2), s1: +s1.toFixed(2), s2: +hs.Snd.sour.toFixed(2), tense: hs.Snd.tense }
    S.smell = 0.75 * hs.D.run.bustAt / hs.sniffMult(); n = 0; while (S.air < 2 && n++ < 600) hs.dbg.step(1); hs.dbg.step(5)
    log.hunt = { air: S.air, tense: hs.Snd.tense, mode: hs.Snd.modeNow() }
    S.smell = 0; n = 0; while (S.air > 0 && n++ < 1200) hs.dbg.step(1); hs.dbg.step(400)
    log.calm = { air: S.air, tense: hs.Snd.tense, sour: +hs.Snd.sour.toFixed(3), mode: hs.Snd.modeNow(), want: hs.Snd.want }
    return log
  })
  expect(r.zawa.air === 1 && r.zawa.s0 < r.zawa.s1 && r.zawa.s1 <= r.zawa.s2 + 0.01 && r.zawa.s2 > 0.2 && r.hunt.tense === 2 && r.hunt.mode === 'heart' && r.calm.tense === 0 && r.calm.sour === 0 && r.calm.mode === 'calm' && r.calm.want === 'quiet', JSON.stringify(r))
  return r
})
await t('内装: 1階=ふつうの箱 → 20階から木目と真鍮 → 40階から大理石と金（ドアが開いたところで変わる）', async () => {
  await begin(35)
  const r = await run(() => {
    const out = [hs.interior()]
    for (const f of [19, 25, 39, 50, 79]) { hs.S.evs = []; hs.S.planAt = 1e9; hs.dbg.floor(f); hs.S.stop = { t: 0 }; hs.dbg.step(200); out.push({ f, ...hs.interior() }) }
    return out
  })
  const ids = r.map(x => x.wall).join('>')
  expect(ids === 'morning>morning>boss>boss>date>date' && r.every(x => x.id === x.wall) && new Set(r.map(x => x.rail)).size === 3 && new Set(r.map(x => x.light)).size === 3, JSON.stringify(r))
  return ids
})
await t('匂いのモヤ: たまると湧いて、抜けると消える。監視カメラの赤いランプが点滅する', async () => {
  await begin(37); await quiet([])
  const r = await run(() => {
    const S = hs.S; S.smell = 0; hs.dbg.step(120); const none = hs.moyaN()
    S.smell = 0.35; hs.dbg.step(120); const low = hs.moyaN(); S.smell = 1.0; hs.dbg.step(150); const high = hs.moyaN(), ln = hs.lineN()
    S.smell = 0; hs.dbg.step(240); const gone = hs.moyaN() + hs.lineN()
    const led = new Set(); for (let i = 0; i < 90; i++) { hs.dbg.step(1); led.add(hs.ledOn()) }
    return { none, low, high, ln, gone, led: led.size }
  })
  expect(r.none === 0 && r.low >= 3 && r.high > r.low && r.ln > 0 && r.gone === 0 && r.led === 2, JSON.stringify(r)); return r
})
await t('ほかのバカゲー: 結果とタイトルの入口から一覧が開き、4本とも新しいタブ（noopener）で各ゲームへ', async () => {
  const want = ['sneeze-quiet', 'onara-jinro', 'nod-master', 'sushi-tower'].map(s => `https://tom3games.github.io/${s}/`)
  const list = () => run(() => [...document.querySelectorAll('#moreL a')].map(a => ({ href: a.href, target: a.target, rel: a.rel, img: a.querySelector('img').getAttribute('src'), name: a.querySelector('b').textContent, sub: a.querySelector('span').textContent })))
  const okList = (L, ja) => L.length === 4 && L.every((a, i) => a.href === want[i] && a.target === '_blank' && /noopener/.test(a.rel) && a.img === want[i] + 'og.png' && a.name && a.sub && /[぀-ヿ一-鿿]/.test(a.name + a.sub) === ja)
  await run(() => { hs.toResult(); hs.finishReveal() })
  expect(await p.isVisible('#bMore') && await p.isVisible('#bX'), '結果の入口が見えない')
  await p.click('#bMore'); expect(await p.isVisible('#moreBox'), '一覧が開かない')
  const ja = await list(); expect(okList(ja, true), JSON.stringify(ja))
  await p.click('#bMoreX'); expect(!(await p.isVisible('#moreBox')), '×で閉じない')
  await p.click('#bMore'); await p.mouse.click(3, 3); expect(!(await p.isVisible('#moreBox')), '外側タップで閉じない')
  await run(() => hs.setLang('en')); await p.click('#bMore'); const en = await list(); await p.keyboard.press('Escape')
  expect(okList(en, false) && en[0].name === 'HOLD THAT SNEEZE' && !(await p.isVisible('#moreBox')), JSON.stringify(en))
  await run(() => { hs.setLang('ja'); hs.toTitle() }); await p.click('#bMoreT'); const tl = await list(); expect(okList(tl, true), 'タイトル ' + JSON.stringify(tl))
  // 実際にクリックすると新しいタブが開く（遷移先はネットに出ないよう止める）
  await p.context().route('https://tom3games.github.io/**/', r => r.fulfill({ body: '<title>x</title>', contentType: 'text/html' }))
  const [np] = await Promise.all([p.context().waitForEvent('page'), p.click('#moreL a >> nth=2')])
  const u = np.url(); await np.close(); await p.context().unroute('https://tom3games.github.io/**/')
  await p.click('#bMoreX')
  expect(u === want[2] && p.url().startsWith(URL0), u + ' / ' + p.url()); return { ja: ja.map(a => a.name), en: en.map(a => a.name), opened: u }
})
await t('通しの最後までコンソールエラーなし', async () => { expect(p.errs.length === 0, p.errs.join('|')) })
await p.close()

// ---- 6サイズ × 全画面で一画面に収まる
for (const [w, h, name0, en] of [...SIZES, [360, 640, 'small', 1], [667, 375, 'land-se', 1]]) {
  const name = name0 + (en ? '-en' : '')
  const q = await open(browser, { viewport: { width: w, height: h } })
  if (en) await q.evaluate(() => hs.setLang('en'))
  const views = {}
  await q.waitForTimeout(300)
  views.title = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-title.png` })
  await q.click('#bHow'); views.how = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-how.png` }); await q.click('#bHowBack')
  await q.click('#bStart'); await q.evaluate(() => { hs.dbg.pause(); hs.dbg.render() }); views.intro = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-intro.png` })
  await q.click('#bGo')
  await q.evaluate(() => { hs.dbg.seed(1); hs.dbg.step(150); hs.dbg.render() }); views.tutorial = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-play.png` })
  const fbSize = await q.evaluate(() => [...document.querySelectorAll('.fb')].map(b => { const n = b.querySelector('.fn'), br = b.getBoundingClientRect(), nr = n.getBoundingClientRect(); return { h: Math.round(br.height), fit: nr.left >= br.left - 1 && nr.right <= br.right + 1 && nr.height < 30 } }))
  await q.evaluate(() => { const e = hs.dbg.toPeak(-1.2); hs.dbg.render() }); views.warn = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-warn.png` })
  await q.evaluate(() => { hs.dbg.toPeak(0.25); hs.fart('bubo'); hs.dbg.step(14); hs.dbg.render() }); views.fart = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-fart.png` })
  await q.evaluate(() => { hs.dbg.step(120); hs.S.smell = 0.75 * hs.D.run.bustAt / hs.sniffMult(); let n = 0; while (hs.S.air < 2 && n++ < 600) hs.dbg.step(1); if (hs.S.hunt) { let k = 0; while (hs.S.hunt.to !== 'me' && k++ < 40) hs.nextGaze() } hs.dbg.step(25); hs.dbg.render() }); views.hunt = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-hunt.png` })
  await q.evaluate(() => { hs.smellBust('sniff'); hs.dbg.step(25); hs.dbg.render() }); views.smellBust = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-smellbust.png` })
  await q.evaluate(() => { hs.dbg.step(200); hs.S.evs = []; hs.S.planAt = 1e9; hs.S.cd.bubo = 0; hs.fart('bubo'); hs.dbg.step(50); hs.dbg.render() }); views.busted = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-busted.png` })
  await q.evaluate(() => { hs.S.lives = 1; hs.S.cd.bubo = 0; hs.S.snz = null; hs.fart('bubo'); hs.dbg.step(140); hs.dbg.render() }); views.kicked = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-kicked.png` })
  await q.evaluate(() => { let n = 0; while (hs.S.mode !== 'result' && n++ < 600) hs.dbg.step(1); hs.finishReveal(); hs.dbg.step(30); hs.dbg.render() }); await q.waitForTimeout(450); views.result = await fit(q); await q.screenshot({ path: `${ROOT}/shots/fit-${name}-result.png` })
  const ol = await oneLine(q); await t(`${name}: 保存・Xボタンの文字が1行`, async () => { expect(!ol.length, ol.join(',')) })
  for (const [v, r] of Object.entries(views)) await t(`一画面に収まる ${name} ${w}x${h} ${v}`, async () => { expect(!r.over.length, JSON.stringify(r)) })
  await t(`${name}: おならボタンの文字が1行で収まり、押しやすい大きさ（高さ56px以上）`, async () => {
    const r = fbSize
    expect(r.every(x => x.fit && x.h >= 56), JSON.stringify(r)); return r.map(x => x.h).join(',')
  })
  await t(`${name}: はみ出し・エラーなし`, async () => { const o = await overflow(q); expect(o.sw <= o.W && !o.bad.length && !q.errs.length, JSON.stringify(o) + q.errs.join('|')) })
  await t(`${name}: もう一回ですぐ遊べる`, async () => { await q.click('#bAgain'); const m = await q.evaluate(() => hs.S.mode); expect(m === 'intro', m); return m })
  await q.close()
}
await browser.close()

// ---- WebKit（iPhone 相当）でタッチの通し
const wb = await launch(webkit), wp = await open(wb, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
await t('WebKit: 2本指の touchmove を止める', async () => {
  const r = await wp.evaluate(() => { const e = new Event('touchmove', { cancelable: true, bubbles: true }); Object.defineProperty(e, 'touches', { value: [{}, {}] }); document.body.dispatchEvent(e); return e.defaultPrevented })
  expect(r, r)
})
await t('WebKit: タップで始めて、山で ブボボボッ をタップすると通る（スマホの案内文）', async () => {
  await wp.tap('#bStart'); await wp.tap('#bGo')
  const hint = await wp.evaluate(() => { hs.dbg.pause(); hs.dbg.step(150); hs.dbg.render(); return document.querySelector('#hint').textContent })
  await wp.evaluate(() => { hs.dbg.toPeak(0.3); hs.dbg.render() })
  await wp.tap('#f_bubo')
  const r = await wp.evaluate(() => { hs.dbg.step(20); hs.dbg.render(); return hs.S.rec.map(x => x.id + ':' + x.rating) })
  await wp.screenshot({ path: ROOT + '/shots/webkit-fart.png' })
  expect(/ボタンでおなら/.test(hint) && r.length === 1 && /bubo:(perfect|safe)/.test(r[0]), hint + ' ' + JSON.stringify(r)); return { hint, r }
})
await t('WebKit: 結果まで通してエラーなし', async () => {
  const r = await wp.evaluate(b => { hs.dbg.seed(8); hs.start(); return eval(b)('skilledR', 3).score }, BOT)
  await wp.evaluate(() => { hs.finishReveal(); hs.dbg.render() }); await wp.waitForTimeout(400); await wp.screenshot({ path: ROOT + '/shots/webkit-result.png' })
  expect(r >= 30 && wp.errs.length === 0, r + ' ' + wp.errs.join('|')); return { score: r }
})
await wb.close()

// ---- fps（GPU 描画で実時間に遊ばせて測る）
if (process.env.FPS) {
  const gb = await launch(chromium, { channel: 'chromium', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  for (const [w, h] of [[390, 844], [1440, 900]]) {
    const g = await open(gb, { viewport: { width: w, height: h } })
    await g.evaluate(() => { hs.start(); hs.beginCount() }); await g.waitForTimeout(6000)
    results.push(`info fps ${w}x${h}: game=${await g.evaluate(() => hs.S.fps)}`)
    await g.close()
  }
  await gb.close()
}
server.kill()
console.log(results.join('\n'))
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
