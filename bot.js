// ページの中で動かすボット（verify と同じもの）
// skilled=光ったボタンを見て押す人（反応0.12〜0.25秒）。R付きはピンチで なすりつけ も使う
// aim=予告を見て山を読んで ブボボボッ を押す人（ひっかけに3割かかる）／spam=溜まったら全部押す／suka=すかしっぺだけ／never=何もしない
(mode, bseed = 1) => {
  hs.dbg.pause(); const S = hs.S; let guard = 0
  let a = bseed >>> 0; const R = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  const gauss = () => Math.sqrt(-2 * Math.log(R() + 1e-9)) * Math.cos(2 * Math.PI * R())
  const seen = {}, react = () => 0.12 + R() * 0.13
  while (S.mode !== 'result' && guard++ < 60 * 900) {
    if (S.mode === 'intro') hs.beginCount()
    if (S.mode === 'play') {
      if (mode.startsWith('skilled')) {
        for (const k of ['bubo', 'pu']) {
          if (hs.okNow(k) && hs.canFart(k)) { seen[k] = (seen[k] ?? 0) + 1 / 60; if (seen[k] > (seen[k + 'r'] ??= react())) { hs.fart(k); seen[k] = 0; seen[k + 'r'] = undefined } } else seen[k] = 0
        }
        if (S.door > 0.5 && S.sniff < 0.25 && hs.canFart('suka')) hs.fart('suka')
        if (mode.endsWith('R') && hs.pinch()) hs.useRuse('blame')
      } else if (mode === 'aim') {
        for (const e of S.evs) if (e.off === undefined) e.off = (e.fake && R() > 0.3) ? 99 : e.peak / 2 - 0.12 + gauss() * 0.09
        const e = S.evs.find(e => !e.botDone && S.st >= e.at + e.off)
        if (e) { e.botDone = true; hs.fart('bubo') }
      } else if (mode === 'spam') { for (const k of ['bubo', 'pu', 'suka']) if (hs.canFart(k)) hs.fart(k) }
      else if (mode === 'suka') { if (hs.canFart('suka')) hs.fart('suka') }
    }
    hs.dbg.step(1)
  }
  const r = S.result
  return { rec: S.rec.map(x => x.id + ':' + x.rating + ':' + x.pts), score: r && r.score, floor: r && r.floor, roof: r && r.roof, rank: r && r.rank.t.ja, db: r && r.db, n: r && r.n, bad: r && r.bad, smell: r && r.smell, used: r && r.used, steps: guard }
}
