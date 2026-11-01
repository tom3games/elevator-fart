// 密室おなら選手権 / ELEVATOR FART
import * as THREE from 'three'

const D = window.HS
const $ = s => document.querySelector(s)
const STEP = 1 / 60, TAIL = 0.5, PRE = 0.12
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, k) => a + (b - a) * k
const ease = k => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k) }
const isTouch = matchMedia('(pointer:coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0)
function mulberry(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
const store = { get(k) { try { return localStorage.getItem(k) } catch (e) { return null } }, set(k, v) { try { localStorage.setItem(k, v) } catch (e) {} } }
const pick = a => a[Math.floor(S.rand() * a.length) % a.length]

// ---------- 状態
const S = {
  lang: store.get('hs.lang') || ((navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en'),
  mode: 'title', time: 0, seed: (Date.now() & 0xffffff) || 1, rand: null,
  st: 0, modeT: 0, evs: [], level: 0, planAt: 0, evN: 0, zone: 0, lives: 3, kickAt: -1, lifeT: -1, tut: 0,
  gauge: 0, strain: 0, flush: 0, holding: false, downAt: 0, toggled: false, ignoreUp: false, everHeld: false,
  snz: null, react: 0, relief: 0, shame: 0, haStep: 0, humT: 0, shake: 0, punch: -1, hop: 0,
  later: [], rec: [], maxDb: 0, photo: false, capT: -1, doCap: false,
  dbgPause: false, fps: 0, resT: 0, result: null, mood: '',
  // 匂い・乗客・誤魔化し
  // air=空気の段階（0=平常 1=ざわざわ 2=犯人探し）、hunt=犯人探しの視線（from が to を疑っている。to==='me' なら自分）
  smell: 0, sniff: 0, air: 0, hunt: null, zawaT: 0, smellBusts: 0, pax: [], rode: [], floor: 1, floorF: 1, door: 0, stop: null,
  ruseLeft: {}, ruseLog: [], lastBad: null, exitT: 0,
}
S.rand = mulberry(S.seed)
const TT = () => D.T[S.lang]
const L2 = pair => pair[S.lang === 'ja' ? 0 : 1]

// ---------- 音（WebAudio だけで鳴らす）
const Snd = {
  ctx: null, muted: store.get('hs.mute') === '1', next: 0, step: 0, track: null, want: null, switchAt: 0, played: {}, fartLog: [], sour: 0, bgmLog: [],
  TEMPO: { title: 116, quiet: 126, happy: 132, sad: 70 },
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return
    try {
      const c = this.ctx = new AC()
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.8
      this.an = c.createAnalyser(); this.an.fftSize = 2048; this.master.connect(this.an); this.an.connect(c.destination)
      this.bgm = c.createGain(); this.bgm.gain.value = 0.0001; this.bgm.connect(this.master)
      // 金属の箱の響き
      this.echo = c.createGain(); const dl = c.createDelay(1); dl.delayTime.value = 0.09; const fb = c.createGain(); fb.gain.value = 0.5
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; const wet = c.createGain(); wet.gain.value = 0.5
      this.echo.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(lp); lp.connect(wet); wet.connect(this.master)
      // 狭い箱の残響（音でバレた時だけ通す）。金属の壁で短く跳ね返る
      const irL = Math.floor(c.sampleRate * 0.42), ir = c.createBuffer(2, irL, c.sampleRate)
      for (let ch = 0; ch < 2; ch++) { const b = ir.getChannelData(ch); for (let i = 0; i < irL; i++) { const tt = i / c.sampleRate; b[i] = (Math.random() * 2 - 1) * Math.exp(-tt / 0.075) * (1 + 0.6 * Math.sin(tt * 2 * Math.PI * 830)) } for (const [d, a] of [[0.006, 0.8], [0.011, -0.6], [0.017, 0.5], [0.023, -0.35]]) b[Math.floor(d * c.sampleRate) + ch * 7] += a }
      this.box = c.createConvolver(); this.box.buffer = ir; const bw = c.createGain(); bw.gain.value = 0.85; this.box.connect(bw); bw.connect(this.master)
      // かき消した時: こもらせて小さく（チャイム等の裏でかすかに）
      this.muf = c.createBiquadFilter(); this.muf.type = 'lowpass'; this.muf.frequency.value = 380; this.muf.Q.value = 0.5; const mg = c.createGain(); mg.gain.value = 0.32; this.muf.connect(mg); mg.connect(this.master)
      this.half = c.createBiquadFilter(); this.half.type = 'lowpass'; this.half.frequency.value = 1100; const hg = c.createGain(); hg.gain.value = 0.62; this.half.connect(hg); hg.connect(this.master)
      const len = c.sampleRate * 2; this.noiseBuf = c.createBuffer(1, len, c.sampleRate)
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      if (this.want) { const w = this.want; this.want = null; this.setTrack(w) }
    } catch (e) { this.ctx = null }
  },
  setMute(m) { this.muted = m; store.set('hs.mute', m ? '1' : '0'); if (this.master) this.master.gain.value = m ? 0 : 0.8 },
  now() { return this.ctx ? this.ctx.currentTime : 0 },
  level() { if (!this.an) return 0; const d = new Float32Array(this.an.fftSize); this.an.getFloatTimeDomainData(d); let m = 0; for (const v of d) m = Math.max(m, Math.abs(v)); return m },
  mtof: m => 440 * Math.pow(2, (m - 69) / 12),
  mark(n) { this.played[n] = (this.played[n] || 0) + 1 },
  tone(f, t0, dur, type = 'square', vol = 0.2, dest, f2) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), g = c.createGain()
    o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.02)
  },
  noise(t0, dur, vol, freq, type = 'highpass', dest, q) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; if (q) f.Q.value = q
    g.gain.setValueAtTime(Math.max(0.0002, vol), t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    s.connect(f); f.connect(g); g.connect(dest || this.master); s.start(t0, Math.random()); s.stop(t0 + dur + 0.02)
  },
  swell(t0, w, p, tail, vol, f1, f2, type = 'lowpass', q = 1) {
    if (!this.ctx) return; const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain()
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.Q.value = q
    f.frequency.setValueAtTime(f1, t0); f.frequency.exponentialRampToValueAtTime(f2, t0 + w + 0.05)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol * 0.28, t0 + w); g.gain.exponentialRampToValueAtTime(vol, t0 + w + 0.06)
    g.gain.setValueAtTime(vol, t0 + w + p); g.gain.exponentialRampToValueAtTime(0.0001, t0 + w + p + tail)
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t0); s.stop(t0 + w + p + tail + 0.05)
  },
  // 声っぽい音（のこぎり波を母音のフィルタに通す）
  voice(f, t0, dur, vol, formant = 900, dest, f2) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), bp = c.createBiquadFilter(), g = c.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
    bp.type = 'bandpass'; bp.frequency.value = formant; bp.Q.value = 3
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.setValueAtTime(vol, t0 + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(bp); bp.connect(g); g.connect(dest || this.master); o.start(t0); o.stop(t0 + dur + 0.02)
  },
  // 震える低音（おならの本体）。rate=ブルブルの速さ
  rumble(t0, dur, vol, f1, f2, rate, dest) {
    if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain()
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f1, t0); o.frequency.linearRampToValueAtTime(f1 * 1.25, t0 + dur * 0.3); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur)
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 4
    lfo.type = 'square'; lfo.frequency.setValueAtTime(rate, t0); lfo.frequency.linearRampToValueAtTime(rate * 0.6, t0 + dur); lg.gain.value = 0.5; am.gain.value = 0.5
    lfo.connect(lg); lg.connect(am.gain)
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02); g.gain.setValueAtTime(vol, t0 + dur * 0.75); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    o.connect(lp); lp.connect(am); am.connect(g); g.connect(dest || this.master)
    o.start(t0); lfo.start(t0); o.stop(t0 + dur + 0.05); lfo.stop(t0 + dur + 0.05)
  },
  setTrack(name) {
    if (this.want === name) return
    this.want = name; if (!this.ctx) return
    const now = this.ctx.currentTime, g = this.bgm.gain
    g.cancelScheduledValues(now); g.setValueAtTime(Math.max(0.0001, g.value), now); g.linearRampToValueAtTime(0.0001, now + 0.25)
    this.switchAt = now + 0.27
  },
  duck(sec) {
    if (!this.ctx) return; const now = this.ctx.currentTime, g = this.bgm.gain
    g.cancelScheduledValues(now); g.setValueAtTime(0.0001, now); g.setValueAtTime(0.0001, now + sec); g.linearRampToValueAtTime(this.vol(), now + sec + 0.6)
  },
  vol() { return this.track === 'quiet' ? 0.32 : 0.26 },
  tick() {
    if (!this.ctx) return; const c = this.ctx
    if (this.switchAt && c.currentTime >= this.switchAt) {
      this.track = this.want; this.step = 0; this.next = c.currentTime + 0.05; this.switchAt = 0
      const g = this.bgm.gain; g.cancelScheduledValues(c.currentTime); g.setValueAtTime(0.0001, c.currentTime); g.linearRampToValueAtTime(this.vol(), c.currentTime + 0.35)
      if (this.track) this.mark('bgm:' + this.track)
    }
    if (!this.track || this.switchAt) return
    const spb = 60 / this.TEMPO[this.track] / 4
    if (this.next < c.currentTime) this.next = c.currentTime + 0.05
    while (this.next < c.currentTime + 0.25) { this['p_' + this.track](this.step, this.next); this.next += spb * this.drag(); this.step++ }
  },
  pluck(n, t, dur = 0.09, vol = 0.07) { this.tone(this.mtof(n), t, dur, 'triangle', vol, this.bgm) },
  // タイトル: 抜き足差し足のつま先ジャズ（Em）
  p_title(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16
    const root = [40, 40, 45, 47][bar]
    if (s % 4 === 0) this.tone(this.mtof(root), t, 0.12, 'triangle', 0.32, this.bgm)
    if (s % 4 === 2) this.tone(this.mtof(root + 7), t, 0.08, 'triangle', 0.16, this.bgm)
    if (s % 2 === 1) this.noise(t, 0.025, 0.03, 7000, 'highpass', this.bgm)
    const m = [[64, -1, 67, -1, 69, -1, 70, 71, -1, -1, 64, -1, -1, -1, -1, -1], [64, -1, 67, -1, 69, -1, 70, 71, -1, -1, 76, -1, 75, -1, -1, -1],
      [69, -1, 72, -1, 74, -1, 75, 76, -1, -1, 69, -1, -1, -1, -1, -1], [71, -1, -1, 70, -1, -1, 69, -1, 67, -1, 64, -1, 63, -1, 64, -1]][bar]
    if (m[s] > 0) { this.pluck(m[s] + 12, t, 0.08, 0.06); this.tone(this.mtof(m[s]), t, 0.1, 'square', 0.018, this.bgm) }
  },
  // プレイ: エレベーターのボサノバ（ギターのコード・ベース・シェイカーとリム・ビブラフォン）
  // 空気がざわつくほど sour（0..1）が上がり、音程が狂ってテンポがよれる。犯人探しで止まって心臓の音だけ
  BOSSA: {
    ch: [[57, 60, 64, 65], [57, 60, 64, 67], [55, 58, 62, 65], [58, 62, 64, 67], [55, 60, 64, 67], [57, 60, 63, 66], [55, 58, 62, 65], [58, 62, 64, 67]],
    root: [41, 41, 43, 36, 45, 38, 43, 36],
    gtr: [[0, 3, 6, 10, 13], [2, 6, 9, 12]],
    mel: [[[0, 76, 4], [6, 74, 3], [10, 72, 6]], [[0, 69, 8], [12, 72, 4]], [[0, 74, 4], [6, 77, 3], [10, 74, 3], [14, 70, 2]], [[0, 72, 9], [10, 70, 2], [12, 69, 4]],
      [[0, 72, 4], [6, 76, 3], [10, 79, 6]], [[0, 78, 4], [6, 75, 3], [10, 72, 6]], [[0, 70, 4], [6, 74, 3], [10, 77, 3], [14, 76, 2]], [[0, 74, 10], [12, 72, 4]]],
  },
  // テンポのよれ（sour が高いほど1拍ごとに伸び縮み）
  drag() { const q = this.track === 'quiet' ? this.sour : 0; return q ? 1 + q * (0.07 * Math.sin(this.step * 0.37) + (Math.random() - 0.5) * 0.1) : 1 },
  // 音程の狂い（セント）。全体のうねり＋音ごとのばらつき
  det() { const q = this.sour; if (!q) return 0; const c = q * (Math.sin(this.step * 0.13) * 32 + (Math.random() - 0.5) * 46); this.detMax = Math.max(this.detMax || 0, Math.abs(c)); return c },
  hz(m) { return this.mtof(m) * Math.pow(2, this.det() / 1200) },
  // ガットギター風: のこぎり＋三角を、閉じていくローパスに通す
  gtr(f, t, vol, dur = 0.55) {
    this.mark('gtr'); if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain()
    o.type = 'sawtooth'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 1.002
    lp.type = 'lowpass'; lp.Q.value = 1.4; lp.frequency.setValueAtTime(2600, t); lp.frequency.exponentialRampToValueAtTime(520, t + 0.22)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(this.bgm); o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02)
  },
  // ビブラフォン風: サイン＋4倍音、ゆるいトレモロ
  vib(f, t, dur, vol) {
    this.mark('vib'); if (!this.ctx) return; const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain(), tr = c.createOscillator(), tg = c.createGain()
    o.frequency.value = f; o2.frequency.value = f * 4; g2.gain.value = 0.12; tr.frequency.value = 5.2; tg.gain.value = vol * 0.25
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    tr.connect(tg); tg.connect(g.gain); o.connect(g); o2.connect(g2); g2.connect(g); g.connect(this.bgm)
    for (const x of [o, o2, tr]) { x.start(t); x.stop(t + dur + 0.02) }
  },
  p_quiet(i, t) {
    const ten = this.tense || 0, q = this.sour || 0, s = i % 16, s32 = i % 32, bar = Math.floor(i / 16) % 8, B = this.BOSSA
    let mode
    if (ten >= 2) {
      // 犯人探し: ボサノバは止まって心臓の音だけ（ドッ…クン）
      mode = 'heart'
      if (s === 0 || s === 3 || s === 8 || s === 11) { const k = s % 8 === 0; this.tone(k ? 62 : 52, t, 0.16, 'sine', k ? 0.5 : 0.36, this.bgm, 38); this.noise(t, 0.05, k ? 0.05 : 0.03, 180, 'lowpass', this.bgm) }
    } else {
      mode = q > 0.05 ? 'sour' : 'bossa'
      // 調子がずれると、ところどころ音が抜ける
      const drop = () => q > 0.05 && Math.random() < q * 0.3
      const ch = B.ch[bar], root = B.root[bar]
      // ベース（親指）: 1拍目に根音、3拍目に5度、その前に食い気味の音
      if (s === 0) this.tone(this.hz(root), t, 0.42, 'sine', 0.24, this.bgm)
      if (s === 6) this.tone(this.hz(root + 7), t, 0.18, 'sine', 0.12, this.bgm)
      if (s === 8) this.tone(this.hz(root + 7), t, 0.4, 'sine', 0.2, this.bgm)
      if (s === 14) this.tone(this.hz(root + (bar % 2 ? 0 : 12)), t, 0.16, 'sine', 0.1, this.bgm)
      // ギターのコード（ボサノバの刻み・2小節で1周）。ジャラッと少しずらして鳴らす
      if (B.gtr[Math.floor(s32 / 16)].includes(s) && !drop()) ch.forEach((n, k) => this.gtr(this.hz(n), t + k * 0.011, 0.028, 0.42 + (s === 0 ? 0.2 : 0)))
      // パーカッション: シェイカー（16分）とリムショット
      this.noise(t, 0.03, [0.016, 0.006, 0.01, 0.006][s % 4], 7200, 'highpass', this.bgm)
      if ([0, 3, 6, 10, 13, 18, 22, 26].includes(s32)) { this.noise(t, 0.025, 0.05, 2200, 'bandpass', this.bgm, 4); this.tone(1700, t, 0.02, 'triangle', 0.02, this.bgm) }
      if (s === 0 || s === 8) this.tone(95, t, 0.12, 'sine', 0.16, this.bgm, 50)
      // メロディ（ビブラフォン）
      const m = B.mel[bar].find(x => x[0] === s)
      if (m && !drop()) this.vib(this.hz(m[1]), t, m[2] * 0.12 + 0.25, 0.05 * (1 - 0.4 * q))
      // ざわざわ: 低い半音のうなりとひそひそ声
      if (ten >= 1) {
        if (s === 0) this.tone(this.mtof(root + 13), t, 1.1, 'sawtooth', 0.01, this.bgm)
        if ((s === 5 || s === 13) && Math.random() < 0.6) this.noise(t, 0.12, 0.03, 3200, 'bandpass', this.bgm, 4)
      }
    }
    if (s === 0) { this.mark('q:' + mode); this.bgmLog.push(mode); if (this.bgmLog.length > 40) this.bgmLog.shift() }
    return mode
  },
  p_happy(i, t) {
    const bar = Math.floor(i / 16) % 4, s = i % 16, root = [48, 45, 41, 43][bar]
    if (s === 0 || s === 8) this.tone(150, t, 0.16, 'sine', 0.6, this.bgm, 45)
    if (s === 4 || s === 12) this.noise(t, 0.08, 0.14, 1500, 'bandpass', this.bgm)
    if (s % 2 === 0) this.noise(t, 0.03, 0.04, 8000, 'highpass', this.bgm)
    if ([0, 6, 10].includes(s)) this.tone(this.mtof(root - 12), t, 0.16, 'triangle', 0.35, this.bgm)
    const m = [[72, 76, 79, 76], [72, 76, 81, 79], [77, 76, 74, 72], [74, 79, 77, 74]][bar]
    if (s % 4 === 0) this.pluck(m[s / 4], t, 0.14, 0.07)
  },
  p_sad(i, t) {
    const bar = Math.floor(i / 12) % 4, s = i % 12
    const ch = [[57, 60, 64], [57, 62, 65], [56, 59, 64], [57, 60, 64]][bar], root = [33, 38, 40, 33][bar]
    if (s === 0) this.tone(this.mtof(root), t, 0.8, 'sine', 0.3, this.bgm)
    if (s === 4 || s === 8) for (const n of ch) this.tone(this.mtof(n), t, 0.4, 'triangle', 0.02, this.bgm)
    const mel = [[76, 74, 72], [74, 72, 69], [71, 69, 68], [69, -1, -1]][bar]
    if (s % 4 === 0) { const n = mel[s / 4]; if (n > 0) this.tone(this.mtof(n), t, 0.5, 'sine', 0.06, this.bgm) }
  },
  // おなかが鳴る
  growl(v = 1) { if (!this.ctx) return; const t = this.now(); this.mark('growl'); this.rumble(t, 0.5, 0.12 * v, 70, 110, 11); this.noise(t, 0.45, 0.06 * v, 260, 'lowpass') },
  // おなら。層は 空気の破裂（ノイズのバースト）＋尻の共鳴（下がりながら震える低音）＋終わりのしぼみ（ぷすっ）
  // kind: suka=すかしっぺ（ほぼ空気のスー…）/ pu=ぷっ / bubo=ブボボボッ（ぶつ切れの連打）
  // how: plain=ふつう / masked=かき消せた（こもって小さく）/ half=半分かき消せた / busted=バレた（狭い箱の残響）
  // 長さ・音程・震え方・ぶつ切れの数は毎回ランダム。直前と似すぎたら振り直す
  fartRoll(kind) {
    const R = Math.random, r = (a, b) => a + R() * (b - a)
    if (kind === 'suka') return { kind, dur: r(0.7, 1.5), f0: r(520, 950), f1: r(260, 520), flap: r(4, 11), flapD: r(0.15, 0.45), chops: 1, vibR: 0, vibD: 0, drop: 0, tail: R() < 0.55 }
    if (kind === 'pu') return { kind, dur: r(0.08, 0.24), f0: r(115, 215), drop: r(0.55, 0.85), vibR: r(7, 18), vibR2: r(5, 20), vibD: r(0.03, 0.11), flap: r(26, 48), flapD: r(0.35, 0.6), chops: R() < 0.3 ? 2 : 1, tail: R() < 0.7 }
    return { kind, dur: r(0.75, 1.45), f0: r(56, 98), drop: r(0.42, 0.75), vibR: r(4, 13), vibR2: r(3, 17), vibD: r(0.05, 0.2), flap: r(17, 36), flapD: r(0.35, 0.65), chops: 3 + Math.floor(R() * 7), tail: R() < 0.85, long: R() < 0.5 }
  },
  fart(kind = 'bubo', how = 'plain', v = 1) {
    if (typeof kind !== 'string') kind = 'bubo'
    let p = this.fartRoll(kind)
    const last = this.fartLog[this.fartLog.length - 1]
    for (let k = 0; k < 4 && last && last.kind === kind && last.chops === p.chops && Math.abs(last.f0 - p.f0) / p.f0 < 0.06 && Math.abs(last.dur - p.dur) / p.dur < 0.12; k++) p = this.fartRoll(kind)
    p.how = how; this.fartLog.push(p); if (this.fartLog.length > 60) this.fartLog.shift()
    this.mark('fart'); this.mark('fart:' + kind); this.mark('fart:' + how); if (how === 'busted') this.mark('echo')
    if (!this.ctx) return p
    const c = this.ctx, t = c.currentTime + 0.005, out = c.createGain(); out.gain.value = v
    if (how === 'masked') out.connect(this.muf)
    else if (how === 'half') out.connect(this.half)
    else { out.connect(this.master); if (how === 'busted') { out.connect(this.box); out.connect(this.echo) } }
    const R = Math.random
    if (kind === 'suka') {
      // ほぼ空気: 帯域ノイズがゆっくり下がり、弱くゆれる
      const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(), am = c.createGain(), lfo = c.createOscillator(), lg = c.createGain()
      s.buffer = this.noiseBuf; s.loop = true; bp.type = 'bandpass'; bp.Q.value = 1.6
      bp.frequency.setValueAtTime(p.f0, t); bp.frequency.exponentialRampToValueAtTime(p.f1, t + p.dur)
      lfo.frequency.setValueAtTime(p.flap, t); lfo.frequency.linearRampToValueAtTime(p.flap * 0.6, t + p.dur); lg.gain.value = p.flapD * 0.5; am.gain.value = 1 - p.flapD * 0.5
      lfo.connect(lg); lg.connect(am.gain)
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.12); g.gain.setValueAtTime(0.06, t + p.dur * 0.6); g.gain.exponentialRampToValueAtTime(0.0001, t + p.dur)
      s.connect(bp); bp.connect(am); am.connect(g); g.connect(out); s.start(t, R()); lfo.start(t); s.stop(t + p.dur + 0.05); lfo.stop(t + p.dur + 0.05)
      if (p.tail) this.noise(t + p.dur * 0.88, 0.07, 0.03, 1900, 'bandpass', out, 3)
      return p
    }
    const big = kind === 'bubo'
    // 空気の破裂
    this.noise(t, 0.04, (big ? 0.5 : 0.28), 560 + R() * 300, 'bandpass', out, 0.9)
    // ぶつ切れ: 長さをばらして並べる（最後だけ長く伸ばすこともある）
    const n = p.chops, w = Array.from({ length: n }, (_, k) => (0.6 + R() * 0.8) * (p.long && k === n - 1 ? 2.2 : 1)), ws = w.reduce((a, b) => a + b, 0)
    let k0 = t; p.segs = []
    for (let k = 0; k < n; k++) {
      const gap = n > 1 ? 0.008 + R() * 0.04 : 0, d = Math.max(0.04, p.dur * w[k] / ws - gap)
      const f = p.f0 * (1 - p.drop * 0.6 * k / Math.max(1, n - 1)) * (0.92 + R() * 0.16)
      const vol = (big ? 0.5 : 0.24) * (k === 0 ? 1 : 0.65 + R() * 0.35)
      this.fartSeg(k0, d, f, f * (1 - p.drop * (0.4 + R() * 0.3)), p, vol, out); p.segs.push(+d.toFixed(3))
      k0 += d + gap
    }
    // 終わりのしぼみ（ぷすっ）
    if (p.tail) { this.noise(k0 - 0.01, 0.06, big ? 0.12 : 0.07, 1700 + R() * 900, 'bandpass', out, 3); this.tone(240 + R() * 120, k0 - 0.01, 0.06, 'sine', big ? 0.08 : 0.05, out, 600 + R() * 300) }
    p.total = +(k0 - t).toFixed(3)
    return p
  },
  // 尻の共鳴 1つ分: 下がる低音にビブラート（速さと深さが途中で変わる）、唇のはためき（AM）をかける
  fartSeg(t, d, f1, f2, p, vol, dest) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), vib = c.createOscillator(), vg = c.createGain(), flap = c.createOscillator(), fg = c.createGain(), am = c.createGain(), lp = c.createBiquadFilter(), g = c.createGain()
    o.type = 'sawtooth'; o2.type = 'square'; const og2 = c.createGain(); og2.gain.value = 0.35
    for (const x of [o, o2]) { x.frequency.setValueAtTime(f1 * 1.1, t); x.frequency.linearRampToValueAtTime(f1, t + d * 0.15); x.frequency.exponentialRampToValueAtTime(Math.max(25, f2), t + d) }
    vib.frequency.setValueAtTime(p.vibR, t); vib.frequency.linearRampToValueAtTime(p.vibR2, t + d)
    vg.gain.setValueAtTime(f1 * p.vibD * 0.4, t); vg.gain.linearRampToValueAtTime(f1 * p.vibD, t + d)
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency)
    flap.type = 'triangle'; flap.frequency.setValueAtTime(p.flap * (0.9 + Math.random() * 0.2), t); flap.frequency.linearRampToValueAtTime(p.flap * 0.65, t + d)
    fg.gain.value = p.flapD * 0.5; am.gain.value = 1 - p.flapD * 0.5; flap.connect(fg); fg.connect(am.gain)
    lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(Math.min(1400, f1 * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(160, f1 * 3.2), t + d)
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.setValueAtTime(vol, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d)
    o.connect(lp); o2.connect(og2); og2.connect(lp); lp.connect(am); am.connect(g); g.connect(dest)
    // 息のざらつき
    this.noise(t, d, vol * 0.25, f1 * 3, 'bandpass', g, 1.2)
    for (const x of [o, o2, vib, flap]) { x.start(t); x.stop(t + d + 0.03) }
  },
  cough() { if (!this.ctx) return; const t = this.now(); this.mark('cough'); for (const d of [0, 0.22]) { this.noise(t + d, 0.16, 0.6, 900, 'bandpass', null, 1.2); this.voice(170, t + d, 0.16, 0.25, 700, null, 120) } },
  event(type, w, p, fake) {
    if (!this.ctx) return; const t = this.now() + 0.01; this.mark('ev:' + type)
    const R = Math.random
    if (fake) { this.mark('fake:' + type); return this.fakeEvent(type, t, w) }
    const s = t + w
    switch (type) {
      case 'chime': {
        this.swell(t, w, 0.05, 0.3, 0.08, 120, 90, 'lowpass', 0.7) // 減速のうなり
        this.tone(1318, s, 1.2, 'sine', 0.42); this.tone(1046, s + 0.42, 1.4, 'sine', 0.42); this.tone(2637, s, 0.6, 'sine', 0.06)
        // アナウンス（声っぽく）
        const vf = [[660, 0.12], [540, 0.12], [900, 0.14], [700, 0.18]]; let k = s + 0.25
        for (const [f, d] of vf) { this.voice(230, k, d, 0.16, f); k += d + 0.02 }
        this.noise(s + 0.5, 0.7, 0.12, 500, 'bandpass', null, 0.8) // ドア
        break
      }
      case 'phone': {
        const n = Math.floor(w / 0.42)
        for (let k = 0; k < n; k++) this.tone(110, t + k * 0.42, 0.24, 'square', 0.015 + 0.05 * k / n)
        const mel = [84, 88, 91, 96, 91, 88]
        for (let k = 0; s + k * 0.075 < s + p + 0.25; k++) this.tone(this.mtof(mel[k % mel.length]), s + k * 0.075, 0.07, 'square', 0.13)
        break
      }
      case 'shake': {
        for (let k = 0; k < 4; k++) this.voice(300 + k * 20, t + w * (0.2 + k * 0.2), 0.35, 0.03 + k * 0.012, 1200, null, 340 + k * 25) // きしみ
        this.tone(70, s, 0.6, 'sine', 0.9, null, 35); this.noise(s, 0.5, 0.8, 900, 'lowpass')
        for (let k = 0; k < 10; k++) this.tone(2200 + R() * 1800, s + R() * (p + 0.3), 0.12, 'triangle', 0.08) // 金属のガチャガチャ
        break
      }
      case 'laugh': {
        for (let k = 0; k < 3; k++) this.voice(140, t + w * 0.25 + k * 0.4, 0.22, 0.05, 600)
        for (let k = 0; s + k * 0.15 < s + p + 0.35; k++) this.voice(k % 2 ? 175 : 160, s + k * 0.15, 0.12, 0.42, k % 2 ? 750 : 900, null, 130)
        break
      }
      case 'baby': {
        for (let k = 0; k < 3; k++) this.voice(420, t + w * 0.3 + k * 0.45, 0.25, 0.04 + 0.02 * k, 1400, null, 380)
        this.voice(520, s, p + 0.45, 0.45, 1500, null, 560); this.voice(1040, s, p + 0.4, 0.08, 2600, null, 1100)
        break
      }
      case 'bark': {
        this.voice(110, t + w * 0.3, w * 0.6, 0.12, 400, null, 95)
        for (let k = 0; s + k * 0.17 < s + p + 0.2; k++) { this.noise(s + k * 0.17, 0.08, 0.4, 700, 'bandpass', null, 1.5); this.voice(420, s + k * 0.17, 0.1, 0.4, 900, null, 230) }
        break
      }
      case 'cart': {
        for (let k = 0; k < 10; k++) this.noise(t + (k / 10) * w, 0.05, 0.03 + 0.05 * k / 10, 1800, 'bandpass', null, 2)
        this.noise(s, 0.8, 0.9, 700, 'lowpass'); this.tone(90, s, 0.5, 'sine', 0.7, null, 45)
        for (let k = 0; k < 8; k++) { const d = R() * (p + 0.3); this.noise(s + d, 0.1, 0.5, 400 + R() * 600, 'bandpass', null, 2); this.tone(140 + R() * 80, s + d, 0.12, 'square', 0.12, null, 70) }
        break
      }
      case 'giggle': {
        for (let k = 0; k < 4; k++) this.voice(380, t + w * 0.3 + k * 0.3, 0.07, 0.04, 1600)
        for (let k = 0; s + k * 0.11 < s + p + 0.35; k++) this.voice(k % 2 ? 470 : 430, s + k * 0.11, 0.09, 0.32, 1700, null, 400)
        break
      }
      case 'music': {
        for (let k = 0; t + k * 0.125 < s; k++) this.noise(t + k * 0.125, 0.02, 0.02 + 0.05 * k * 0.125 / w, 7000, 'highpass')
        for (let k = 0; s + k * 0.2 < s + p + 0.35; k++) { this.tone(130, s + k * 0.2, 0.18, 'sine', 0.95, null, 42); this.noise(s + k * 0.2 + 0.1, 0.04, 0.25, 6000, 'highpass') }
        this.tone(110, s, p + 0.3, 'sawtooth', 0.12, null, 110)
        break
      }
    }
  },
  // 予告だけして来ない音
  fakeEvent(type, t, w) {
    switch (type) {
      case 'chime': this.swell(t, w, 0.05, 0.6, 0.06, 120, 140, 'lowpass', 0.7); this.tone(880, t + w, 0.15, 'sine', 0.05); break
      case 'shake': for (let k = 0; k < 4; k++) this.voice(300 + k * 20, t + w * (0.2 + k * 0.2), 0.35, 0.03 + k * 0.012, 1200, null, 340 + k * 25); break
      default: this.swell(t, w, 0.01, 0.4, 0.1, 400, 700, 'bandpass', 0.6)
    }
  },
  sfx(name, v = 1) {
    if (!this.ctx) return; const t = this.ctx.currentTime; this.mark(name)
    switch (name) {
      case 'tap': this.tone(880, t, 0.06, 'triangle', 0.12 * v); break
      case 'count': this.tone(660, t, 0.08, 'sine', 0.12); break
      case 'go': this.tone(1300, t, 0.3, 'sine', 0.14, null, 1900); break
      case 'hum': this.tone(140, t, 0.45, 'triangle', 0.07, null, 175); this.tone(146, t, 0.45, 'sine', 0.05, null, 150); break
      case 'scratch': this.tone(900, t, 0.14, 'sawtooth', 0.09, null, 180); this.noise(t, 0.14, 0.2, 1500, 'bandpass', null, 3); this.tone(250, t + 0.15, 0.12, 'sawtooth', 0.08, null, 800); break
      case 'gasp': for (let k = 0; k < 7; k++) { const f = 380 + Math.random() * 320; this.tone(f, t + Math.random() * 0.1, 0.28, 'sawtooth', 0.025, null, f * 0.62) } this.noise(t + 0.1, 0.8, 0.12, 700, 'bandpass', null, 0.8); break
      case 'whisper': for (let k = 0; k < 5; k++) this.noise(t + k * 0.11 + Math.random() * 0.05, 0.07, 0.05, 3400 + Math.random() * 1200, 'bandpass', null, 5); break
      case 'gaze': this.tone(160, t, 0.35, 'triangle', 0.09, null, 120); this.tone(240, t + 0.05, 0.3, 'sine', 0.05, null, 170); break
      case 'sniff': for (let k = 0; k < 3; k++) this.noise(t + k * 0.14, 0.09, 0.08, 2600, 'bandpass', null, 2); break
      case 'thud': this.tone(95, t, 0.22, 'sine', 0.5, null, 45); this.noise(t, 0.12, 0.25, 500, 'lowpass'); break
      case 'clink': this.tone(2600, t, 0.18, 'triangle', 0.1); this.tone(3900, t + 0.02, 0.12, 'sine', 0.06); break
      case 'door': this.noise(t, 0.7, 0.1, 500, 'bandpass', null, 0.8); break
      case 'ding': this.tone(1318, t, 0.9, 'sine', 0.2); this.tone(1046, t + 0.35, 1.1, 'sine', 0.2); break
      case 'step': for (let k = 0; k < 4; k++) this.noise(t + k * 0.24, 0.05, 0.06, 900, 'bandpass', null, 2); break
      case 'spray': for (const d of [0, 0.3]) this.noise(t + d, 0.25, 0.25, 5000, 'highpass'); break
      case 'mash': for (let k = 0; k < 9; k++) this.tone(1500, t + k * 0.07, 0.03, 'square', 0.06); break
      case 'stare': this.tone(200, t, 0.6, 'triangle', 0.08, null, 400); break
      case 'safe': this.tone(1046, t, 0.12, 'triangle', 0.13); this.tone(1568, t + 0.08, 0.2, 'triangle', 0.12); break
      case 'perfect': this.noise(t, 0.25, 0.06, 1400, 'bandpass', null, 2); this.tone(1318, t + 0.05, 0.1, 'triangle', 0.12); this.tone(1760, t + 0.12, 0.1, 'triangle', 0.12); this.tone(2637, t + 0.19, 0.25, 'triangle', 0.1); break
      case 'sus': this.tone(500, t, 0.2, 'triangle', 0.1, null, 700); this.tone(700, t + 0.2, 0.25, 'triangle', 0.08, null, 560); break
      case 'pop': this.tone(500, t, 0.08, 'sine', 0.15, null, 1200); break
      case 'stamp': this.tone(120, t, 0.25, 'sine', 0.7, null, 45); this.noise(t, 0.15, 0.35, 900, 'lowpass'); break
      case 'drum': for (let k = 0; k < 44; k++) this.noise(t + k * 0.036, 0.04, 0.05 + k * 0.004, 1800, 'bandpass', null, 0.9); break
      case 'boom': this.tone(80, t, 0.7, 'sine', 0.6, null, 30); this.noise(t, 0.6, 0.25, 1500, 'lowpass'); break
      case 'fanfare': [[72, 0], [76, 0.12], [79, 0.24], [84, 0.38]].forEach(([n, d]) => { this.tone(this.mtof(n), t + d, d > 0.3 ? 0.7 : 0.14, 'square', 0.07); this.tone(this.mtof(n - 12), t + d, d > 0.3 ? 0.7 : 0.14, 'triangle', 0.1) }); break
      case 'wahwah': [[311, 0, 0.42], [294, 0.45, 0.42], [277, 0.9, 0.42], [262, 1.35, 1.1]].forEach(([f, d, l]) => { this.tone(f, t + d, l, 'sawtooth', 0.07, null, f * 0.96); this.tone(f / 2, t + d, l, 'triangle', 0.08) }); break
    }
  },
}

// ---------- 3D の土台
const canvas = $('#gl')
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, isTouch ? 1.6 : 2))
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x2a2233)
const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 60)
const hemi = new THREE.HemisphereLight(0xfff3e0, 0x6a5a50, 1.9)
const sun = new THREE.DirectionalLight(0xffffff, 1.3); sun.position.set(1.5, 4, 5)
const evLight = new THREE.PointLight(0xffffff, 0, 0, 1.2); evLight.position.set(0, 2, -1)
scene.add(hemi, sun, evLight)

const MC = {}
const M = (c, flat = true) => MC[c + ':' + flat] || (MC[c + ':' + flat] = new THREE.MeshLambertMaterial({ color: c, flatShading: flat }))
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), sph: new THREE.SphereGeometry(1, 22, 16), lsph: new THREE.IcosahedronGeometry(1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16), plane: new THREE.PlaneGeometry(1, 1), cone: new THREE.ConeGeometry(1, 1, 12),
}
function mesh(geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, parent) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); if (parent) parent.add(m); return m
}
const box = (w, h, d, c, x, y, z, p) => mesh(G.box, typeof c === 'number' ? M(c) : c, x, y, z, w, h, d, p)
function canvasTex(w, h, draw, rep) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); draw(ctx, w, h)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]) }
  t.userData = { c, ctx }; return t
}

// ---------- エレベーターのかご（3ステージで内装だけ変える）
// 床 x:-1.3..1.3 / z:-2.0..3.3。ドアはカメラの後ろ（z=2.7）。奥の壁の鏡にドアが映る
const CAR = { x: 1.3, zb: -2.0, zf: 3.3, h: 2.6 }
const car = new THREE.Group(); scene.add(car)
// 壁・奥の壁・天井は区画ごとに描き直すテクスチャ（ステンレス → 木目と真鍮 → 大理石と金）
const wallTex = canvasTex(512, 256, () => {}), backTex = canvasTex(256, 256, () => {}), ceilTex = canvasTex(256, 256, () => {})
const wallM = new THREE.MeshPhongMaterial({ map: wallTex, shininess: 60, specular: 0x555555 })
const backM = new THREE.MeshPhongMaterial({ map: backTex, shininess: 40, specular: 0x333333 })
const ceilM = new THREE.MeshLambertMaterial({ map: ceilTex, emissive: 0x6a6a6a, emissiveMap: ceilTex })
const lightM = new THREE.MeshBasicMaterial({ color: 0xfff6e0 })
const floorTex = canvasTex(256, 256, () => {}, [3, 5])
const floorM = new THREE.MeshLambertMaterial({ map: floorTex })
const railM = new THREE.MeshPhongMaterial({ color: 0xd8c48a, shininess: 90, specular: 0xffffff })
// 大理石の筋（決まった種で描く）
function marble(x, w, h, n, col) {
  const r = mulberry(7); x.strokeStyle = col; x.lineCap = 'round'
  for (let i = 0; i < n; i++) { x.lineWidth = 0.6 + r() * 2.2; x.beginPath(); let px = r() * w, py = r() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.3) * w * 0.18; py += (r() - 0.5) * h * 0.2; x.lineTo(px, py) } x.stroke() }
}
function woodGrain(x, w, h, base, seed) {
  const r = mulberry(seed); x.fillStyle = base; x.fillRect(0, 0, w, h)
  for (let y = 0; y < h; y += 2) { x.strokeStyle = r() < 0.5 ? 'rgba(30,14,4,.22)' : 'rgba(150,96,52,.18)'; x.lineWidth = 1 + r() * 1.5; x.beginPath(); const ph = r() * 9, a = 1 + r() * 3; for (let px = 0; px <= w; px += 16) x.lineTo(px, y + Math.sin(px / 40 + ph) * a + Math.sin(px / 9 + ph) * 0.6); x.stroke() }
}
const gold = (x, x0, y0, x1, y1, a = '#b8902f', b = '#f0d27a') => { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, b); g.addColorStop(0.5, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(x0, y0, x1 - x0, y1 - y0) }
// 区画ごとの壁（back=奥の壁）
const WALLS = {
  morning: (x, w, h, back) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfd4dc'); g.addColorStop(1, '#a9afb9'); x.fillStyle = g; x.fillRect(0, 0, w, h)
    const r = mulberry(3); for (let i = 0; i < w; i++) { x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.08})` : `rgba(60,66,76,${0.03 + r() * 0.07})`; x.fillRect(i, 0, 1, h) }
    const n = back ? 2 : 4; for (let i = 1; i < n; i++) { const px = Math.round(w * i / n); x.fillStyle = '#737985'; x.fillRect(px - 1, 0, 2, h); x.fillStyle = '#eef0f3'; x.fillRect(px + 1, 0, 1, h) }
    x.fillStyle = '#8b919c'; x.fillRect(0, h * 0.9, w, h * 0.1); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(0, h * 0.9, w, 2)
  },
  boss: (x, w, h, back) => {
    woodGrain(x, w, h, '#5e3a24', back ? 11 : 5)
    const n = back ? 2 : 4
    for (let i = 0; i < n; i++) { const x0 = w * i / n + 8, x1 = w * (i + 1) / n - 8; x.strokeStyle = 'rgba(20,8,2,.45)'; x.lineWidth = 3; x.strokeRect(x0, h * 0.08, x1 - x0, h * 0.42); x.strokeRect(x0, h * 0.6, x1 - x0, h * 0.26); x.strokeStyle = 'rgba(255,210,150,.18)'; x.lineWidth = 1; x.strokeRect(x0 + 3, h * 0.08 + 3, x1 - x0 - 6, h * 0.42 - 6) }
    gold(x, 0, h * 0.535, w, h * 0.565); gold(x, 0, h * 0.89, w, h); gold(x, 0, 0, w, h * 0.025)
  },
  date: (x, w, h, back) => {
    x.fillStyle = '#f5efe4'; x.fillRect(0, 0, w, h); marble(x, w, h, back ? 9 : 16, 'rgba(150,138,122,.32)'); marble(x, w, h, 4, 'rgba(205,160,70,.35)')
    const n = back ? 2 : 4
    for (let i = 0; i < n; i++) { const x0 = w * i / n + 10, x1 = w * (i + 1) / n - 10; x.strokeStyle = '#c99a2e'; x.lineWidth = 4; x.strokeRect(x0, h * 0.1, x1 - x0, h * 0.74); x.strokeStyle = '#f6e19a'; x.lineWidth = 1; x.strokeRect(x0 + 3, h * 0.1 + 3, x1 - x0 - 6, h * 0.74 - 6) }
    gold(x, 0, 0, w, h * 0.05, '#c99a2e', '#ffe7a0'); gold(x, 0, h * 0.88, w, h, '#c99a2e', '#ffe7a0')
  },
}
const CEILS = {
  morning: (x, w, h) => { x.fillStyle = '#d9dce1'; x.fillRect(0, 0, w, h); x.strokeStyle = '#b4b9c1'; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.moveTo(0, i * h / 4); x.lineTo(w, i * h / 4); x.stroke() } },
  boss: (x, w, h) => { woodGrain(x, w, h, '#3e2516', 9); x.strokeStyle = '#c9a043'; x.lineWidth = 4; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x.strokeRect(i * w / 3 + 10, j * h / 3 + 10, w / 3 - 20, h / 3 - 20) },
  date: (x, w, h) => { gold(x, 0, 0, w, h, '#e6c870', '#fff0c0'); x.strokeStyle = 'rgba(160,110,30,.5)'; x.lineWidth = 3; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(w / 2, h / 2, 30 + i * 36, 0, 7); x.stroke() } },
}
const FLOORS = {
  morning: (x, w, h) => { x.fillStyle = '#5a5550'; x.fillRect(0, 0, w, h); x.fillStyle = '#625d57'; for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32) },
  boss: (x, w, h) => { x.fillStyle = '#7a1f2a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#d8b24a'; x.lineWidth = 6; x.strokeRect(12, 12, w - 24, h - 24); x.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < w; i += 8) x.fillRect(i, 0, 3, h) },
  date: (x, w, h) => {
    // 大理石の市松に金の目地
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { x.fillStyle = (i + j) % 2 ? '#e9dfcf' : '#f6f1e8'; x.fillRect(i * 64, j * 64, 64, 64) }
    marble(x, w, h, 10, 'rgba(140,128,112,.28)')
    x.strokeStyle = '#d4a93a'; x.lineWidth = 3; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke() }
  },
}
;(() => {
  const len = CAR.zf - CAR.zb, zc = (CAR.zf + CAR.zb) / 2
  const fl = mesh(G.plane, floorM, 0, 0, zc, CAR.x * 2, len, 1, car); fl.rotation.x = -Math.PI / 2
  for (const s of [-1, 1]) box(0.06, CAR.h, len, wallM, s * (CAR.x + 0.03), CAR.h / 2, zc, car)
  box(CAR.x * 2 + 0.1, CAR.h, 0.06, backM, 0, CAR.h / 2, CAR.zb - 0.03, car)
  box(CAR.x * 2 + 0.1, 0.06, len, ceilM, 0, CAR.h, zc, car)
  box(CAR.x * 2 + 0.1, CAR.h, 0.06, backM, 0, CAR.h / 2, CAR.zf + 0.03, car)
  // 天井の明かり
  for (const z of [-1.2, 0.2, 1.6]) box(1.2, 0.02, 0.5, lightM, 0, CAR.h - 0.03, z, car)
  // 手すり（丸いパイプと壁から出る腕）
  for (const s of [-1, 1]) { mesh(G.cyl, railM, s * (CAR.x - 0.09), 0.92, zc, 0.024, len - 0.6, 0.024, car).rotation.x = Math.PI / 2; for (const z of [CAR.zb + 0.4, CAR.zf - 0.4]) mesh(G.cyl, railM, s * (CAR.x - 0.045), 0.92, z, 0.012, 0.09, 0.012, car).rotation.z = Math.PI / 2 }
  mesh(G.cyl, railM, 0, 0.92, CAR.zb + 0.09, 0.024, CAR.x * 2 - 0.3, 0.024, car).rotation.z = Math.PI / 2
})()
// 行き先ボタンの盤と点検証のステッカー（左の壁の奥。縦画面でも見える位置。1枚の絵にまとめて軽く）
const panelTex = canvasTex(136, 400, () => {})
const panel = mesh(G.plane, new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, alphaTest: 0.5 }), -CAR.x + 0.034, 1.25, -1.05, 0.3, 0.88, 1, car); panel.rotation.y = Math.PI / 2
function paintPanel(id) {
  const { ctx: x, c } = panelTex.userData, W = c.width, H = c.height, ph = H * 0.74
  x.clearRect(0, 0, W, H)
  const pl = { morning: ['#9aa1ab', '#e2e5ea'], boss: ['#a77f28', '#f0d27a'], date: ['#c99a2e', '#ffe7a0'] }[id]
  const g = x.createLinearGradient(0, 0, W, 0); g.addColorStop(0, pl[0]); g.addColorStop(0.5, pl[1]); g.addColorStop(1, pl[0]); x.fillStyle = g; x.fillRect(4, 0, W - 8, ph)
  x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.strokeRect(5, 1, W - 10, ph - 2)
  const fl = { morning: [1, 18], boss: [20, 38], date: [40, 80] }[id], lit = { morning: [5, 12], boss: [30], date: [56, 72] }[id]
  const nums = []; for (let k = 0; k < 18; k++) nums.push(Math.round(fl[0] + (fl[1] - fl[0]) * k / 17))
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 15px sans-serif'
  nums.forEach((nm, k) => {
    const cx = W * (k % 2 ? 0.68 : 0.32), cy = ph * 0.9 - Math.floor(k / 2) * ph * 0.088, on = lit.includes(nm)
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(cx + 1, cy + 2, 15, 0, 7); x.fill()
    x.fillStyle = on ? '#fff3c4' : '#f4f4f2'; x.beginPath(); x.arc(cx, cy, 14, 0, 7); x.fill()
    x.strokeStyle = on ? '#ff9a2a' : '#7a7f88'; x.lineWidth = on ? 4 : 2; x.stroke()
    x.fillStyle = on ? '#e05a00' : '#2a2d33'; x.fillText(String(nm), cx, cy + 1)
  })
  // 開・閉と非常ベル
  const by = ph * 0.075
  for (const [cx, t] of [[0.25, '◀▶'], [0.5, '▶◀']]) { x.fillStyle = '#f4f4f2'; x.beginPath(); x.arc(W * cx, by, 13, 0, 7); x.fill(); x.fillStyle = '#2a2d33'; x.font = '900 10px sans-serif'; x.fillText(t, W * cx, by + 1) }
  x.fillStyle = '#ffcf1f'; x.beginPath(); x.arc(W * 0.77, by, 13, 0, 7); x.fill(); x.strokeStyle = '#2a2d33'; x.lineWidth = 2; x.stroke(); x.beginPath(); x.arc(W * 0.77, by + 3, 6, Math.PI, 0); x.stroke()
  // 点検証のステッカー
  const sy = H * 0.8, sh = H * 0.18
  x.fillStyle = '#fbfbf6'; x.fillRect(14, sy, W - 28, sh); x.fillStyle = '#2f6fb5'; x.fillRect(14, sy, W - 28, sh * 0.28)
  x.fillStyle = '#fff'; x.font = '900 13px sans-serif'; x.fillText('検査済証', W / 2, sy + sh * 0.15)
  x.fillStyle = '#c0281e'; x.beginPath(); x.arc(W * 0.3, sy + sh * 0.64, sh * 0.2, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '900 11px sans-serif'; x.fillText('合', W * 0.3, sy + sh * 0.65)
  x.fillStyle = '#3a3d44'; x.font = '900 10px sans-serif'; x.textAlign = 'left'; x.fillText('定員 15名', W * 0.46, sy + sh * 0.52); x.fillText('1000kg', W * 0.46, sy + sh * 0.76); x.textAlign = 'center'
  panelTex.needsUpdate = true
}
// 天井の監視カメラ（左奥の角。赤いランプが点滅）
const camG = new THREE.Group(); camG.position.set(-1.02, CAR.h - 0.03, CAR.zb + 0.22); car.add(camG)
mesh(G.cyl, M(0xe9e9e6, false), 0, -0.01, 0, 0.075, 0.03, 0.075, camG)
mesh(G.sph, new THREE.MeshPhongMaterial({ color: 0x14161c, shininess: 140, specular: 0xffffff }), 0, -0.03, 0, 0.062, 0.055, 0.062, camG)
const camLed = mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0x3a0000 }), 0.03, -0.055, 0.045, 0.011, 0.011, 0.011, camG)
const camGlow = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xff2a1a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); camGlow.position.set(0.03, -0.055, 0.05); camGlow.scale.setScalar(0.09); camG.add(camGlow)
// 奥の壁の鏡（毎フレーム描く。ドアと外が映る）
const mirTex = canvasTex(512, 384, () => {})
const mirror = mesh(G.plane, new THREE.MeshBasicMaterial({ map: mirTex }), 0, 1.45, CAR.zb + 0.005, 2.1, 1.55, 1, car)
box(2.2, 0.06, 0.04, railM, 0, 2.25, CAR.zb + 0.02, car); box(2.2, 0.06, 0.04, railM, 0, 0.65, CAR.zb + 0.02, car)
// 階数表示（鏡の上）
const indTex = canvasTex(320, 96, () => {})
const indM = new THREE.MeshBasicMaterial({ map: indTex })
mesh(G.plane, indM, 0, 2.43, CAR.zb + 0.012, 0.66, 0.2, 1, car)
box(0.72, 0.25, 0.016, railM, 0, 2.43, CAR.zb, car)
const lamp = mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0x553311 }), 0.45, 2.43, CAR.zb + 0.02, 0.05, 0.05, 0.02, car)
const halo = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffb030, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); halo.position.set(0, 2.43, CAR.zb + 0.05); car.add(halo)
// LED の数字が光る（にじみ＋芯＋ドットの格子）。上りの矢印は動いている間だけ流れる
let IND_GRID = null, indKey = ''
function drawInd(blink) {
  const { ctx: x, c } = indTex.userData, W = c.width, H = c.height
  const mv0 = !S.stop && S.mode === 'play', key = S.floor + '|' + blink + '|' + mv0 + '|' + (mv0 ? Math.floor((S.time * 40) % 72 / 6) : 0)
  if (key === indKey) return; indKey = key
  x.fillStyle = '#080606'; x.fillRect(0, 0, W, H)
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '900 68px "Courier New", monospace'
  if (!blink) { x.shadowColor = '#ff6a10'; x.shadowBlur = 18; x.fillStyle = '#ff8a2a'; x.fillText(S.floor + 'F', 196, 52); x.shadowBlur = 0; x.fillStyle = '#ffd08a'; x.fillText(S.floor + 'F', 196, 52) }
  const mv = mv0, off = mv ? Math.floor((S.time * 40) % 72 / 6) * 6 : 12
  x.save(); x.beginPath(); x.rect(30, 14, 64, H - 28); x.clip()
  for (const o of [off - 72, off]) { const y = H - 20 - o; x.shadowColor = '#ff6a10'; x.shadowBlur = mv ? 12 : 0; x.fillStyle = mv ? '#ffb040' : '#5a3a20'; x.beginPath(); x.moveTo(40, y + 10); x.lineTo(62, y - 18); x.lineTo(84, y + 10); x.closePath(); x.fill() }
  x.restore(); x.shadowBlur = 0
  if (!IND_GRID) { IND_GRID = document.createElement('canvas'); IND_GRID.width = W; IND_GRID.height = H; const g = IND_GRID.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.42)'; for (let i = 0; i < W; i += 4) g.fillRect(i, 0, 1, H); for (let j = 0; j < H; j += 4) g.fillRect(0, j, W, 1) }
  x.drawImage(IND_GRID, 0, 0)
  indTex.needsUpdate = true
}
const HALL = { morning: ['#e9e3d6', '#2e7d5b'], boss: ['#7a1f2a', '#d8b24a'], date: ['#fff1c9', '#e0457b'] }
function paintMirror(c, W, H) {
  const id = cur.id, g = c.createLinearGradient(0, 0, 0, H)
  const tone = { morning: ['#8d98a6', '#c6cfd9'], boss: ['#4e3b2c', '#8a6e52'], date: ['#d8b6c0', '#f3e2e6'] }[id]
  g.addColorStop(0, tone[0]); g.addColorStop(1, tone[1]); c.fillStyle = g; c.fillRect(0, 0, W, H)
  // 映りこんだドア（開くと外が見える）
  const dw = W * 0.46, dx = (W - dw) / 2, dy = H * 0.1, o = S.door * dw * 0.5
  const [hc, ac] = HALL[id]
  c.fillStyle = hc; c.fillRect(dx, dy, dw, H - dy)
  if (S.door > 0.05) {
    c.fillStyle = ac; c.fillRect(dx + dw * 0.1, dy + H * 0.12, dw * 0.8, H * 0.1)
    c.fillStyle = '#fff'; c.font = `900 ${Math.round(H * 0.07)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(S.floor + 'F', W / 2, dy + H * 0.17)
    c.fillStyle = 'rgba(255,255,240,.35)'; c.fillRect(dx, dy, dw, H - dy)
  }
  c.fillStyle = '#b9bfca'; c.fillRect(dx - o, dy, dw / 2, H - dy); c.fillRect(dx + dw / 2 + o, dy, dw / 2, H - dy)
  c.fillStyle = '#8e95a2'; c.fillRect(dx - o + dw / 2 - 3, dy, 3, H - dy); c.fillRect(dx + dw / 2 + o, dy, 3, H - dy)
  c.strokeStyle = '#6b707c'; c.lineWidth = 8; c.strokeRect(dx - 4, dy - 4, dw + 8, H)
  mirrorPeople(c, W, H)
  c.fillStyle = { morning: 'rgba(200,215,230,.16)', boss: 'rgba(120,80,40,.2)', date: 'rgba(255,220,150,.16)' }[id]; c.fillRect(0, 0, W, H)
  // 鏡の光
  c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.moveTo(W * 0.08, 0); c.lineTo(W * 0.2, 0); c.lineTo(W * 0.05, H); c.lineTo(0, H); c.closePath(); c.fill()
  c.beginPath(); c.moveTo(W * 0.86, 0); c.lineTo(W * 0.9, 0); c.lineTo(W * 0.78, H); c.lineTo(W * 0.74, H); c.closePath(); c.fill()
}
// 鏡に映る背中（自分と乗客）。カメラから見た鏡像の位置に、ぼんやりした頭と肩を描く（本物の反射の代わり）
const _mv = new THREE.Vector3(), MIR = { zm: CAR.zb + 0.005, w: 2.1, h: 1.55, y0: 1.45 - 1.55 / 2 }
function mirrorPeople(c, W, H) {
  const C = camera.position, list = []
  const add = (hx, hy, hz, shirt, hair, sc) => list.push({ hx, hy, hz, shirt, hair, sc })
  P.head.getWorldPosition(_mv); add(_mv.x, _mv.y, _mv.z, 0x4f7fc4, 0x2b1d17, 1.15)
  for (const p of S.pax) { if (!p.n || !p.n.g.visible) continue; const lk = LOOK[p.type]; npcHeadPos(p.n, _mv); add(_mv.x, _mv.y, _mv.z, lk.shirt, lk.hair, p.n.g.scale.y) }
  list.sort((a, b) => b.hz - a.hz)
  const hex = (n, a) => `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`
  for (const o of list) {
    const zv = 2 * MIR.zm - o.hz, k = (C.z - MIR.zm) / (C.z - zv)
    const mx = C.x + (o.hx - C.x) * k, my = C.y + (o.hy - C.y) * k
    const u = (mx + MIR.w / 2) / MIR.w * W, v = (1 - (my - MIR.y0) / MIR.h) * H, px = k / MIR.w * W * o.sc
    // ぼかしの代わりに、少しずつ大きく薄い形を重ねる
    for (const [g, a] of [[1.25, 0.12], [1.1, 0.16], [1, 0.22]]) {
      c.fillStyle = hex(o.shirt, a); c.beginPath(); c.ellipse(u, v + px * 0.42, px * 0.36 * g, px * 0.2 * g, 0, Math.PI, 0); c.fillRect(u - px * 0.36 * g, v + px * 0.42, px * 0.72 * g, H); c.fill()
      c.fillStyle = hex(o.hair, a * 1.3); c.beginPath(); c.ellipse(u, v, px * 0.15 * g, px * 0.17 * g, 0, 0, 7); c.fill()
    }
  }
}
const STAGE_LOOK = {
  morning: { rail: 0xd3d8e0, bg: 0x2a2233, light: 0xf4f8ff, sky: 0xfff3e0, spec: 0x555555, shin: 60 },
  boss: { rail: 0xd8b24a, bg: 0x241a14, light: 0xffe0b0, sky: 0xffe8cc, spec: 0x3a2a1a, shin: 30 },
  date: { rail: 0xf2cf62, bg: 0x33222a, light: 0xfff2cc, sky: 0xfff2dc, spec: 0x777060, shin: 80 },
}

// ---------- プレイヤー（立っている主役）
const SKIN = new THREE.Color(0xf4c7a1), RED = new THREE.Color(0xff3b2c), PURPLE = new THREE.Color(0x8a6a2a), GREEN = new THREE.Color(0x9cc46a)
const P = (() => {
  const root = new THREE.Group(); scene.add(root)
  const skin = new THREE.MeshLambertMaterial({ color: SKIN.clone() })
  const dark = M(0x231a1f, false), white = M(0xffffff, false), hairM = M(0x2b1d17), pants = M(0x2f3a55), shoes = M(0x1b1620)
  const hips = new THREE.Group(); root.add(hips)
  for (const s of [-1, 1]) { mesh(new THREE.CapsuleGeometry(0.085, 0.62, 4, 10), pants, s * 0.12, 0.45, 0, 1, 1, 1, hips); box(0.13, 0.07, 0.24, shoes, s * 0.12, 0.04, 0.04, hips) }
  mesh(G.sph, pants, 0, 0.84, -0.04, 0.24, 0.15, 0.17, hips) // おしり
  const torso = mesh(new THREE.CapsuleGeometry(0.26, 0.34, 6, 14), M(0x4f7fc4), 0, 1.13, 0, 1.32, 1, 0.85, root)
  box(0.06, 0.3, 0.02, M(0xd8141f), 0, 1.22, 0.22, root) // ネクタイ
  mesh(G.cyl, skin, 0, 1.42, 0, 0.075, 0.14, 0.075, root)
  const arms = []
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.36, 1.35, 0); root.add(a)
    mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 10), M(0x4f7fc4), 0, -0.27, 0, 1, 1, 1, a)
    mesh(G.sph, skin, 0, -0.56, 0.02, 0.075, 0.08, 0.075, a); a.rotation.z = s * 0.1; arms.push(a)
  }
  const pivot = new THREE.Group(); pivot.position.set(0, 1.46, 0); root.add(pivot)
  const head = new THREE.Group(); head.position.set(0, 0.24, 0); pivot.add(head)
  mesh(G.sph, skin, 0, 0, 0, 0.3, 0.32, 0.29, head)
  for (const s of [-1, 1]) mesh(G.sph, skin, s * 0.29, -0.01, -0.01, 0.055, 0.075, 0.04, head)
  const hair = mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.02, -0.02, 0.318, 0.34, 0.31, head); hair.rotation.x = -0.42
  for (const [x, rz] of [[-0.14, 0.5], [-0.04, 0.15], [0.07, -0.2], [0.17, -0.55]]) { const f = mesh(new THREE.ConeGeometry(1, 1, 5), hairM, x, 0.2, 0.2, 0.06, 0.13, 0.05, head); f.rotation.set(2.6, 0, rz) }
  const ahoge = new THREE.Group(); ahoge.position.set(0.03, 0.32, 0.02); ahoge.rotation.y = 0.7; head.add(ahoge)
  const ah = mesh(new THREE.TorusGeometry(0.04, 0.011, 6, 12, Math.PI * 1.3), hairM, 0.035, 0.02, 0, 1, 1, 1, ahoge); ah.rotation.z = -0.3
  const eyes = [], pupils = [], squint = [], brows = [], cheeks = [], drops = []
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * 0.105, 0.045, 0.252); head.add(eg)
    mesh(G.sph, white, 0, 0, 0, 0.058, 0.064, 0.035, eg)
    const pu = mesh(G.sph, dark, s * -0.006, -0.004, 0.03, 0.03, 0.033, 0.014, eg)
    mesh(G.sph, white, 0.01, 0.012, 0.012, 0.18, 0.18, 0.2, pu)
    eyes.push(eg); pupils.push(pu)
    const sq = new THREE.Group(); sq.position.set(s * 0.105, 0.045, 0.282); head.add(sq); sq.visible = false
    for (const u of [1, -1]) { const l = box(0.075, 0.016, 0.012, dark, -s * 0.004, u * 0.014, 0, sq); l.rotation.z = s * u * 0.5 }
    squint.push(sq)
    brows.push(box(0.1, 0.022, 0.02, 0x2b1d17, s * 0.105, 0.14, 0.262, head))
    const ck = mesh(G.sph, new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.55 }), s * 0.175, -0.06, 0.226, 0.052, 0.034, 0.016, head); ck.rotation.y = s * 0.6; cheeks.push(ck)
    drops.push(mesh(G.sph, new THREE.MeshLambertMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.9 }), s * 0.262, 0.08, 0.1, 0.02, 0.03, 0.02, head))
  }
  const nose = mesh(G.sph, M(0xf2b08f, false), 0, -0.018, 0.3, 0.06, 0.055, 0.06, head)
  const mouth = mesh(G.sph, M(0x5a1424, false), 0, -0.145, 0.262, 0.06, 0.03, 0.02, head)
  const lips = box(0.11, 0.018, 0.02, 0xd8656a, 0, -0.145, 0.27, head)
  const smile = mesh(new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI), dark, 0, -0.128, 0.268, 1, 1, 1, head); smile.rotation.z = Math.PI
  const vein = new THREE.Group(); vein.position.set(0.14, 0.2, 0.24); vein.rotation.y = 0.45; head.add(vein)
  for (const [x, y, r] of [[-0.018, 0.018, 0.6], [0.018, 0.018, -0.6], [-0.018, -0.018, -0.6], [0.018, -0.018, 0.6]]) { const v = box(0.03, 0.009, 0.01, 0xd8141f, x, y, 0, vein); v.rotation.z = r }
  const glasses = new THREE.Group(); glasses.position.set(0, 0.045, 0.3); head.add(glasses)
  const gm = M(0x1b1620, false)
  for (const s of [-1, 1]) {
    mesh(new THREE.TorusGeometry(0.068, 0.011, 8, 22), gm, s * 0.105, 0, 0, 1, 1, 1, glasses)
    mesh(new THREE.CircleGeometry(0.066, 20), new THREE.MeshBasicMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.18 }), s * 0.105, 0, -0.002, 1, 1, 1, glasses)
    box(0.012, 0.012, 0.25, gm, s * 0.176, 0.01, -0.125, glasses)
  }
  box(0.07, 0.012, 0.012, gm, 0, 0.012, 0, glasses)
  return { root, hips, torso, arms, pivot, head, skin, hair, ahoge, eyes, pupils, squint, brows, cheeks, drops, nose, mouth, lips, smile, vein, glasses, glassesHome: glasses.position.clone() }
})()
const BUTT = new THREE.Vector3(0, 0.84, -0.22)

// ---------- 乗客（人の種類ごとに見た目を変える）
const exTex = (ch, col) => canvasTex(128, 128, (c, w, h) => {
  c.font = '900 110px "Dela Gothic One", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'
  c.lineWidth = 16; c.strokeStyle = '#1b1620'; c.strokeText(ch, w / 2, h / 2 + 6); c.fillStyle = col; c.fillText(ch, w / 2, h / 2 + 6)
})
let TEX_EX = exTex('!', '#ff3d2e'), TEX_Q = exTex('?', '#ffd21f')
const puffTex = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h) })
const stinkTex = canvasTex(64, 128, (c, w, h) => { c.lineCap = 'round'; for (const [col, lw] of [['#4f7d24', 12], ['#b6da6e', 6]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); for (let y = 118; y > 10; y -= 2) { const x = 32 + Math.sin(y / 14) * 14; y === 118 ? c.moveTo(x, y) : c.lineTo(x, y) } c.stroke() } })
const sparkTex = canvasTex(64, 64, (c) => { c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 8 : 30; c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r) } c.closePath(); c.fill() })
const LOOK = {
  coworker: { shirt: 0x4a78b8, collar: 0xffffff, hair: 0x2b1d17, style: 'short', tie: 0x2a4a8a },
  bucho: { shirt: 0x55585f, collar: 0xffffff, hair: 0x6a6a6a, style: 'side', glasses: true, tie: 0x8a1f2a, stache: 0x4a4a4a, scale: 1.04 },
  madam: { shirt: 0x7a3b8a, hair: 0x5a2a1a, style: 'bun', skin: 0xf5cdb0, pearls: true, aura: 0xff8ad8, scale: 1.02 },
  curry: { shirt: 0xf2efe6, hair: 0x2b1d17, style: 'short', hold: 0xf0b020, aura: 0xffd27a },
  yakiniku: { shirt: 0xc8352a, hair: 0x1a1a1a, style: 'short', band: 0xffffff, aura: 0xb0a8a0 },
  nose: { shirt: 0x8a5a2a, hair: 0x3a2a1a, style: 'short', beret: 0x2a2a3a, bigNose: true, stache: 0x3a2a1a },
  headphone: { shirt: 0x3f8f5a, hair: 0x1a1a1a, style: 'side', phones: 0xff3d2e, scale: 0.98 },
  baby: { shirt: 0xd8c4a0, hair: 0x5a3a22, style: 'long', baby: true },
  dog: { shirt: 0xff8a3a, hair: 0x2b1d17, style: 'short', cap: 0x2a5aa0, dog: true },
  jk: { shirt: 0x1f2a44, collar: 0xffffff, hair: 0x1a1a1a, style: 'long', ribbon: 0xd8141f, scale: 0.94 },
  delivery: { shirt: 0x3a5f8f, hair: 0x2b1d17, style: 'short', cap: 0x3a5f8f, cart: true },
  cleaner: { shirt: 0x6a9a6a, hair: 0x8a8a8a, style: 'bun', kerchief: 0xf2e8c0, spray: true, scale: 0.92 },
  ceo: { shirt: 0x1f1f26, collar: 0xffffff, hair: 0xb8b8b8, style: 'bald', tie: 0xd8141f, stache: 0xd8d8d8, scale: 1.08 },
  partner: { shirt: 0xf09ab0, hair: 0x6a3a22, style: 'long', scale: 0.95 },
}
function makeNPC(type) {
  const o = LOOK[type], g = new THREE.Group(), sc = o.scale || 1; g.scale.setScalar(sc)
  const seat = 1.12, skinM = M(o.skin || 0xf1c6a0, false), pants = M(type === 'jk' ? 0x1f2a44 : 0x2c2c34)
  for (const s of [-1, 1]) { mesh(new THREE.CapsuleGeometry(0.075, 0.62, 4, 8), type === 'jk' ? skinM : pants, s * 0.1, 0.44, 0, 1, 1, 1, g); box(0.12, 0.06, 0.2, 0x1b1620, s * 0.1, 0.03, 0.03, g) }
  if (type === 'jk' || type === 'madam' || type === 'partner') mesh(G.cone, M(type === 'jk' ? 0x1f2a44 : o.shirt), 0, 0.72, 0, 0.3, 0.42, 0.24, g) // スカート
  const body = mesh(new THREE.CapsuleGeometry(0.21, 0.3, 4, 10), M(o.shirt), 0, seat, 0, 1.25, 1, 0.85, g)
  if (o.collar) box(0.3, 0.06, 0.1, o.collar, 0, seat + 0.24, 0.1, g)
  if (o.tie) box(0.05, 0.26, 0.02, o.tie, 0, seat + 0.07, 0.19, g)
  if (o.ribbon) box(0.12, 0.05, 0.03, o.ribbon, 0, seat + 0.2, 0.19, g)
  if (o.pearls) for (let i = -3; i <= 3; i++) mesh(G.sph, M(0xffffff, false), i * 0.04, seat + 0.2 - Math.abs(i) * 0.012, 0.18, 0.018, 0.018, 0.018, g)
  for (const s of [-1, 1]) { const a = mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), M(o.shirt), s * 0.3, seat - 0.05, 0.02, 1, 1, 1, g); a.rotation.z = s * 0.12 }
  const pivot = new THREE.Group(); pivot.position.set(0, seat + 0.3, 0); g.add(pivot)
  const head = new THREE.Group(); head.position.set(0, 0.2, 0); pivot.add(head)
  mesh(G.sph, skinM, 0, 0, 0, 0.22, 0.235, 0.21, head)
  const hairM = M(o.hair)
  if (o.style !== 'bald') { const h = mesh(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.02, -0.01, 0.232, 0.25, 0.225, head); h.rotation.x = -0.35 }
  else for (const s of [-1, 1]) box(0.05, 0.1, 0.16, hairM, s * 0.21, 0.02, -0.04, head)
  if (o.style === 'long') box(0.4, 0.34, 0.14, hairM, 0, -0.12, -0.12, head)
  if (o.style === 'bun') mesh(G.lsph, hairM, 0, 0.22, -0.1, 0.1, 0.1, 0.1, head)
  if (o.style === 'side') box(0.44, 0.08, 0.36, hairM, 0, 0.13, 0.02, head).rotation.z = 0.12
  const eyes = [], pupils = []
  for (const s of [-1, 1]) {
    const eg = new THREE.Group(); eg.position.set(s * 0.075, 0.03, 0.185); head.add(eg)
    mesh(G.sph, M(0xffffff, false), 0, 0, 0, 0.04, 0.045, 0.022, eg)
    pupils.push(mesh(G.sph, M(0x231a1f, false), 0, -0.004, 0.02, 0.022, 0.024, 0.01, eg)); eyes.push(eg)
    box(0.07, 0.016, 0.016, o.style === 'bald' ? 0x8a8a8a : o.hair, s * 0.075, 0.105, 0.19, head)
  }
  if (o.glasses) for (const s of [-1, 1]) mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 16), M(0x1b1620, false), s * 0.075, 0.03, 0.212, 1, 1, 1, head)
  const nose = mesh(G.sph, M(o.bigNose ? 0xe8907a : 0xe0a088, false), 0, -0.02, 0.21, o.bigNose ? 0.07 : 0.035, o.bigNose ? 0.06 : 0.03, o.bigNose ? 0.09 : 0.03, head)
  if (o.stache) box(0.12, 0.03, 0.03, o.stache, 0, -0.07, 0.205, head)
  const mouth = box(0.06, 0.014, 0.012, 0x6a2a2a, 0, -0.11, 0.2, head)
  // 鼻をつまむ手（ざわざわの時だけ見える）
  const pinchH = mesh(G.sph, skinM, 0.02, -0.03, 0.27, 0.05, 0.045, 0.045, head); pinchH.visible = false
  if (o.beret) { const b = mesh(G.cyl, M(o.beret), 0.03, 0.2, -0.01, 0.2, 0.05, 0.2, head); b.rotation.z = 0.25 }
  if (o.cap) { mesh(G.cyl, M(o.cap), 0, 0.18, 0, 0.22, 0.1, 0.22, head); box(0.2, 0.02, 0.14, o.cap, 0, 0.14, 0.2, head) }
  if (o.band) mesh(new THREE.TorusGeometry(0.225, 0.025, 6, 20), M(o.band), 0, 0.09, 0, 1, 1, 1, head).rotation.x = Math.PI / 2
  if (o.kerchief) { const k = mesh(G.cone, M(o.kerchief), 0, 0.12, -0.03, 0.25, 0.22, 0.24, head); k.rotation.x = -0.3 }
  if (o.phones) { const p = mesh(new THREE.TorusGeometry(0.235, 0.025, 6, 20, Math.PI), M(0x1b1620), 0, 0.02, 0, 1, 1, 1, head); void p; for (const s of [-1, 1]) mesh(G.cyl, M(o.phones), s * 0.23, 0, 0, 0.07, 0.06, 0.07, head).rotation.z = Math.PI / 2 }
  const n = { type, g, body, pivot, head, eyes, pupils, mouth, nose, seat, yaw: 0, pitch: 0.05, tYaw: 0, tPitch: 0.05, eye: 1, tEye: 1, markT: -1, phase: Math.random() * 6, idlePitch: 0.05, shake: 0, bounce: 0, sniffT: 0, aura: null, talkTo: null, pinchH, pinchT: 0, talkT: 0, denyT: 0 }
  // 持ち物
  if (o.hold) { n.bento = box(0.26, 0.08, 0.18, o.hold, 0, seat - 0.12, 0.26, g); box(0.27, 0.02, 0.19, 0xd8141f, 0, seat - 0.07, 0.26, g) }
  if (o.spray) n.sprayCan = mesh(G.cyl, M(0x3a8ad8), 0.3, seat - 0.2, 0.15, 0.04, 0.2, 0.04, g)
  if (o.baby) {
    const bb = new THREE.Group(); bb.position.set(0, seat - 0.02, 0.24); g.add(bb); n.babyG = bb
    box(0.3, 0.26, 0.12, 0x6a8ac8, 0, -0.04, 0, bb)
    const bh = new THREE.Group(); bh.position.set(0, 0.16, 0.03); bb.add(bh); n.babyHead = bh
    mesh(G.sph, skinM, 0, 0, 0, 0.11, 0.11, 0.1, bh); for (const s of [-1, 1]) mesh(G.sph, M(0x231a1f, false), s * 0.04, 0.01, 0.09, 0.016, 0.018, 0.01, bh)
    mesh(G.sph, M(0xffd21f), 0, 0.1, 0, 0.06, 0.03, 0.06, bh)
  }
  if (o.dog) {
    const d = new THREE.Group(); d.position.set(0.2, 0, 0.42); g.add(d); n.dogG = d
    const fur = M(0xd8a060), furD = M(0x8a5a2a)
    box(0.18, 0.15, 0.36, fur, 0, 0.26, 0, d); for (const [x, z] of [[-0.06, -0.13], [0.06, -0.13], [-0.06, 0.13], [0.06, 0.13]]) box(0.05, 0.2, 0.05, fur, x, 0.1, z, d)
    const dh = new THREE.Group(); dh.position.set(0, 0.42, 0.2); d.add(dh); n.dogHead = dh
    mesh(G.sph, fur, 0, 0, 0, 0.11, 0.1, 0.11, dh); box(0.08, 0.06, 0.1, fur, 0, -0.03, 0.1, dh); mesh(G.sph, M(0x1b1620, false), 0, -0.01, 0.16, 0.025, 0.02, 0.02, dh)
    for (const s of [-1, 1]) { mesh(G.sph, M(0x231a1f, false), s * 0.045, 0.03, 0.09, 0.016, 0.018, 0.01, dh); const e = box(0.05, 0.1, 0.02, furD, s * 0.08, 0.06, -0.02, dh); e.rotation.z = s * 0.4 }
    n.dogTail = box(0.03, 0.03, 0.14, furD, 0, 0.34, -0.22, d); n.dogTail.rotation.x = 0.7
    const leash = mesh(G.cyl, M(0xd8141f), 0.12, 0.65, 0.22, 0.008, 0.6, 0.008, g); leash.rotation.x = -0.6
  }
  if (o.cart) {
    const c = new THREE.Group(); c.position.set(0, 0, -0.5); g.add(c); n.cartG = c
    box(0.42, 0.04, 0.5, 0x5a6a7a, 0, 0.12, 0, c); for (const [x, z] of [[-0.17, -0.2], [0.17, -0.2], [-0.17, 0.2], [0.17, 0.2]]) mesh(G.cyl, M(0x1b1620), x, 0.05, z, 0.04, 0.03, 0.04, c).rotation.z = Math.PI / 2
    box(0.03, 0.8, 0.03, 0x5a6a7a, 0, 0.5, 0.24, c)
    n.boxes = [[0.36, 0.28, 0.4, 0.28], [0.32, 0.24, 0.36, 0.54], [0.26, 0.22, 0.3, 0.77], [0.2, 0.16, 0.22, 0.96]].map(([w, h, d, y], i) => { const b = box(w, h, d, i % 2 ? 0xc89a5a : 0xb8864a, 0, y, -0.02, c); b.userData.home = b.position.clone(); return b })
  }
  if (o.aura) {
    n.aura = []; for (let i = 0; i < 6; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: o.aura === 0xff8ad8 ? sparkTex : puffTex, color: o.aura, transparent: true, opacity: 0.7, depthWrite: false })); sp.scale.setScalar(0.12); g.add(sp); n.aura.push(sp) }
  }
  const mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_EX, depthTest: false, transparent: true }))
  mark.position.set(0.12, seat + 0.95, 0); mark.scale.setScalar(0); mark.renderOrder = 10; g.add(mark); n.mark = mark
  return n
}
const _hp = new THREE.Vector3(), _q = new THREE.Vector3()
function npcHeadPos(n, out) { return n.pivot.getWorldPosition(out).add(_q.set(0, 0.2 * n.g.scale.y, 0)) }
// なすりつけ先の頭（犬・赤ちゃんなら本人でなくそちら）
function blameHead(n, out) { if (n.dogHead) return n.dogHead.getWorldPosition(out); if (n.babyHead) return n.babyHead.getWorldPosition(out); return npcHeadPos(n, out) }
function npcLook(n, p, amt = 1) {
  npcHeadPos(n, _hp); const d = _q.copy(p).sub(_hp)
  const ry = n.g.rotation.y, c = Math.cos(-ry), s = Math.sin(-ry)
  const lx = d.x * c + d.z * s, lz = -d.x * s + d.z * c
  n.tYaw = clamp(Math.atan2(lx, lz), -1.9, 1.9) * amt
  n.tPitch = clamp(Math.atan2(-d.y, Math.hypot(lx, lz)), -0.6, 0.8) * amt + n.idlePitch * (1 - amt)
}
function npcIdle(n) { n.tYaw = 0; n.tPitch = n.idlePitch; n.tEye = 1 }
function npcMark(n, kind) { n.mark.material.map = kind === '?' ? TEX_Q : TEX_EX; n.mark.material.needsUpdate = true; n.markT = 0 }
const POOL = {}
function getNPC(type) {
  const list = POOL[type] || (POOL[type] = [])
  let n = list.find(x => !x.inUse)
  if (!n) { n = makeNPC(type); list.push(n); car.add(n.g) }
  n.inUse = true; n.g.visible = true; n.markT = -1; n.mark.scale.setScalar(0); n.yaw = 0; n.pitch = n.idlePitch; npcIdle(n); n.reacting = 0; n.reactT = undefined; n.pinchT = 0; n.talkT = 0; n.talkTo = null; n.denyT = 0; n.pinchH.visible = false
  if (n.boxes) for (const b of n.boxes) { b.position.copy(b.userData.home); b.rotation.set(0, 0, 0) }
  return n
}
function freeNPC(n) { n.inUse = false; n.g.visible = false }

// ---------- 内装（階が上がると変わる）と主役の持ち物
const PROPS = {}
;(() => {
  const mk = (id, list) => { const grp = new THREE.Group(); car.add(grp); PROPS[id] = { grp, items: list(grp) } }
  mk('morning', g => {
    const bag = box(0.34, 0.26, 0.09, 0x3a2a1a, 0.5, 0.62, 0.06, g); box(0.12, 0.03, 0.03, 0x8a6a3a, 0.5, 0.78, 0.06, g)
    const cup = mesh(G.cyl, M(0xf2efe6), -0.44, 0.84, 0.12, 0.045, 0.12, 0.045, g); mesh(G.cyl, M(0x6a3a1a), -0.44, 0.9, 0.12, 0.047, 0.02, 0.047, cup.parent)
    return [bag, cup]
  })
  mk('boss', g => {
    const folder = box(0.26, 0.34, 0.03, 0x2a4a8a, -0.42, 0.86, 0.16, g); folder.rotation.z = 0.2
    const pen = mesh(G.cyl, M(0xd8b24a), 0.44, 0.84, 0.12, 0.01, 0.16, 0.01, g); pen.rotation.z = 0.5
    return [folder, pen]
  })
  mk('date', g => {
    const bag = box(0.26, 0.3, 0.12, 0xe0457b, 0.48, 0.58, 0.06, g); box(0.2, 0.06, 0.02, 0xffffff, 0.48, 0.62, 0.125, g)
    const fl = new THREE.Group(); fl.position.set(-0.44, 0.86, 0.14); g.add(fl); mesh(G.cyl, M(0x3f7a3a), 0, -0.1, 0, 0.012, 0.22, 0.012, fl)
    for (let k = 0; k < 5; k++) mesh(G.lsph, M([0xff4a6a, 0xffd21f, 0xffffff][k % 3]), Math.cos(k * 1.3) * 0.05, 0.04 + (k % 2) * 0.03, Math.sin(k * 1.3) * 0.05, 0.04, 0.04, 0.04, fl)
    return [bag, fl]
  })
  for (const k in PROPS) PROPS[k].items.forEach(m => { m.userData.home = { p: m.position.clone(), r: m.rotation.clone(), parent: m.parent } })
})()
// 乗客の立ち位置（主役は原点に立つ）。f=前の列（台車の人用）
const SLOTS = [{ x: -0.95, z: 0.3, f: 1 }, { x: 0.95, z: 0.3, f: 1 }, { x: -0.62, z: -0.72 }, { x: 0.05, z: -0.9 }, { x: 0.72, z: -0.72 }, { x: -0.95, z: -1.55 }, { x: -0.3, z: -1.62 }, { x: 0.38, z: -1.62 }, { x: 0.98, z: -1.5 }]
const SLOT_PREF = { partner: [0], ceo: [4, 2], delivery: [1, 0], dog: [3, 2, 4, 6, 7] }
let cur = { id: 'morning' }

function setLook(id) {
  cur = { id }
  const lk = STAGE_LOOK[id]; railM.color.setHex(lk.rail); scene.background.setHex(lk.bg); lightM.color.setHex(lk.light); hemi.color.setHex(lk.sky)
  wallM.specular.setHex(lk.spec); wallM.shininess = lk.shin
  FLOORS[id](floorTex.userData.ctx, 256, 256); floorTex.needsUpdate = true
  for (const [t, f, back] of [[wallTex, WALLS[id], false], [backTex, WALLS[id], true], [ceilTex, CEILS[id]]]) { const { ctx, c } = t.userData; ctx.clearRect(0, 0, c.width, c.height); f(ctx, c.width, c.height, back); t.needsUpdate = true; t.userData.key = id }
  paintPanel(id)
  for (const k in PROPS) PROPS[k].grp.visible = k === id
  resetProps()
}
function setStage(id) { setLook(id); clearPax() }
function resetProps() {
  for (const f of flyers) { if (f.m === P.glasses) continue; scene.remove(f.m) }
  for (const k in PROPS) for (const m of PROPS[k].items) { const h = m.userData.home; h.parent.add(m); m.position.copy(h.p); m.rotation.copy(h.r) }
  flyers.length = 0; reattachGlasses()
}
function reattachGlasses() { P.head.add(P.glasses); P.glasses.position.copy(P.glassesHome); P.glasses.rotation.set(0, 0, 0) }

// ---------- 乗客の出入り
const aboard = () => S.pax.filter(p => p.state === 'idle')
function clearPax() { for (const p of S.pax) freeNPC(p.n); S.pax = [] }
function freeSlots() { return SLOTS.map((s, i) => i).filter(i => !S.pax.some(p => p.slot === i)) }
function slotFor(type) {
  const free = freeSlots(); if (!free.length) return -1
  const pref = SLOT_PREF[type]
  if (pref) { for (const i of pref) if (free.includes(i)) return i; if (type === 'delivery' || type === 'dog') return -1 }
  // 前の列は最後に埋める（主役の顔を隠さない）
  const back = free.filter(i => !SLOTS[i].f)
  return (back.length ? back : free)[Math.floor(S.rand() * (back.length || free.length)) % (back.length || free.length)]
}
function placePax(p) {
  const s = SLOTS[p.slot], n = p.n
  n.g.position.set(s.x, 0, s.z); n.g.rotation.y = 0
  if (n.dogG) n.dogG.position.x = s.x > 0 ? -0.2 : 0.2
}
function addPax(type, boarding) {
  const slot = slotFor(type); if (slot < 0) return null
  const n = getNPC(type), entry = { type, exposure: 0, blamed: false }
  S.rode.push(entry)
  const p = { type, n, slot, state: boarding ? 'board' : 'idle', t: 0, entry, sprayed: false, def: D.pax[type], age: boarding ? 0 : 99 }
  S.pax.push(p); placePax(p)
  if (boarding) { const s = SLOTS[slot]; p.from = new THREE.Vector3(s.x > 0 ? 0.7 : -0.7, 0, CAR.zf - 0.25); p.to = new THREE.Vector3(s.x, 0, s.z); n.g.position.copy(p.from); n.g.rotation.y = Math.PI }
  return p
}
function updatePax(dt) {
  for (let i = S.pax.length - 1; i >= 0; i--) {
    const p = S.pax[i], n = p.n; p.t += dt
    if (p.state === 'board') {
      if (p.t < 0) continue
      if (p.t < 1.2) { const k = ease(p.t / 1.2); n.g.position.lerpVectors(p.from, p.to, k); n.g.rotation.y = Math.PI; n.bounce = 0.5 }
      else if (p.t < 1.5) { n.g.position.copy(p.to); n.g.rotation.y = Math.PI * (1 - ease((p.t - 1.2) / 0.3)); n.bounce = 0 }
      else {
        p.state = 'idle'; n.g.rotation.y = 0; placePax(p)
        // 匂いが残っていたら、乗った人が最初に気づく
        if (S.smell > 0.3 && S.mode === 'play' && !S.hunt) { npcMark(n, '?'); npcLook(n, P.head.getWorldPosition(_hp), 0.6); n.reacting = 1.4; n.reactKind = '?'; fx(L2(pick(p.def.notice)), 'sb', { follow: n, life: 2.0 }); Snd.sfx('sniff') }
        else if ((S.mode === 'play' || S.mode === 'title') && !(S.stop && S.stop.spoke)) { if (S.stop) S.stop.spoke = true; fx(L2(pick(p.def.board)), 'sb', { follow: n, life: 2.0 }) }
      }
    } else if (p.state === 'exit') {
      if (p.t < 0.3) n.g.rotation.y = Math.PI * ease(p.t / 0.3)
      else if (p.t < 1.4) { const s = SLOTS[p.slot]; n.g.position.set(lerp(s.x, s.x > 0 ? 0.7 : -0.7, ease((p.t - 0.3) / 1.1)), 0, lerp(s.z, CAR.zf - 0.1, ease((p.t - 0.3) / 1.1))); n.bounce = 0.5 }
      else { freeNPC(n); S.pax.splice(i, 1) }
    }
    if (p.state === 'idle' && S.mode === 'play') { p.entry.exposure += S.smell * dt; p.age = (p.age || 0) + dt }
  }
}
// ---------- 難しさ（階が上がるほど厳しく）
const diff = () => clamp((S.floorF - 1) / D.run.span, 0, D.run.dMax)
const RP = k => lerp(D.run[k][0], D.run[k][1], diff())
const maxPax = () => Math.round(RP('maxPax'))
const zoneOf = f => { let z = 0; D.zones.forEach((zz, i) => { if (f >= zz.from) z = i }); return z }
function spawnInitial() { for (const t of D.zones[0].init) addPax(t, false) }
// 止まるたびに、降りるのは1人まで・乗るのも1人まで
function doBoarding() {
  const z = D.zones[S.zone]
  const busy = new Set(S.evs.filter(e => e.src && e.ph !== 'done' && e.ph !== 'idle').map(e => e.src))
  const can = aboard().filter(p => !busy.has(p))
  // 前の区画の人が先に降りる（社長・デートの相手もここでは降りる）
  const old = can.filter(p => !z.pool.includes(p.type) && p.type !== z.lead)
  let ex = null
  if (old.length) ex = pick(old)
  else { const c2 = can.filter(p => !p.def.stay); if (c2.length && (aboard().length >= maxPax() || S.rand() < 0.5)) ex = pick(c2) }
  const before = aboard().length
  if (ex) { ex.state = 'exit'; ex.t = 0; S.smell *= 0.7; if (S.hunt && (S.hunt.from === ex || S.hunt.to === ex)) S.hunt.t = 99 }
  void before
  // 区画の先頭の人（社長・デートの相手）は満員でも乗ってくる
  let t = z.lead && !S.pax.some(p => p.type === z.lead) ? z.lead : null
  if (!t && aboard().length < maxPax()) { const cand = z.pool.filter(t => !S.pax.some(p => p.type === t)); if (cand.length) t = pick(cand) }
  if (t) { const p = addPax(t, true); if (p && ex) p.t = -0.6 }
}

// ---------- 大きな音（切れ目なく次々に来る。間隔と予告の長さは階で決まる）
// チャイム（その階に止まる）と、それ以外の音を交互に。ひっかけは fakeFrom 階から
function newEvent() {
  const warn = RP('warn'), peak = RP('peak')
  const fake = S.floorF >= D.run.fakeFrom && S.evN >= 3 && S.rand() < RP('fake')
  let type = S.evN % 2 === 0 ? 'chime' : 'other', src = null
  if (type === 'other') {
    const loud = aboard().filter(p => p.def.sound), ceo = aboard().find(p => p.type === 'ceo'), r = S.rand()
    if (ceo && r < 0.35) { type = 'laugh'; src = ceo }
    else if (loud.length && r < 0.75) { src = pick(loud); type = src.def.sound }
    else { type = S.rand() < 0.5 ? 'shake' : 'phone'; if (type === 'phone') { const c = aboard(); src = c.length ? pick(c) : null } }
  }
  if (fake && type !== 'chime' && type !== 'shake') { type = S.rand() < 0.5 ? 'chime' : 'shake'; src = null }
  S.evN++; S.evLog.push({ f: S.floor, type, fake })
  const w = fake ? warn * 0.85 : warn
  const e = { type, src, ws: S.st, at: S.st + w, warn: w, peak: fake ? 0 : peak, fake, started: false, peaked: false, ph: 'idle', k: 0 }
  S.evs.push(e)
  S.planAt = e.at + (fake ? 0.4 + RP('gap') * 0.6 : peak + TAIL + RP('gap'))
  return e
}
function evLevel(e, st) {
  if (st < e.ws) { e.ph = 'idle'; e.k = 0; return 0 }
  if (st < e.at) { e.ph = 'warn'; e.k = (st - e.ws) / e.warn; return 0.08 + 0.42 * e.k * e.k }
  if (e.fake) { if (st < e.at + 0.4) { e.ph = 'fizzle'; e.k = (st - e.at) / 0.4; return 0.5 * (1 - e.k) } e.ph = 'done'; e.k = 1; return 0 }
  if (st < e.at + e.peak) { e.ph = 'peak'; e.k = (st - e.at) / e.peak; return 1 - 0.45 * Math.pow(Math.abs(2 * e.k - 1), 1.3) }
  if (st < e.at + e.peak + TAIL) { e.ph = 'tail'; e.k = (st - e.at - e.peak) / TAIL; return 0.55 * (1 - e.k) }
  e.ph = 'done'; e.k = 1; return 0
}
const activeEv = type => S.evs.find(e => e.type === type && (e.ph === 'warn' || e.ph === 'peak' || e.ph === 'tail' || e.ph === 'fizzle'))
const IND_POS = new THREE.Vector3(0, 2.43, CAR.zb)
function lookAtOf(e) { if (e.src) return npcHeadPos(e.src.n, new THREE.Vector3()); return e.type === 'shake' ? new THREE.Vector3(0, 2.4, -0.8) : IND_POS.clone() }

// ---------- 飛ぶもの（メガネ・持ち物）と、ガスの煙・匂い
const flyers = []
function fling(m, v, av) {
  m.updateWorldMatrix(true, false); scene.attach(m); flyers.push({ m, v, av, floor: 0.03, t: 0 })
}
// 匂いのモヤ: 緑がかった漫画のもくもく（輪郭あり）。カメラに向けた板を1回の描画にまとめ、伸び縮みでうねらせる
// 消える時は薄くせず、しぼんで消える（漫画っぽく、透けて人が見えにくくならない）
const moyaTex = canvasTex(128, 128, (c) => {
  const B = [[64, 70, 34], [38, 74, 24], [90, 74, 24], [50, 48, 24], [80, 46, 22], [64, 36, 20], [30, 56, 16], [100, 56, 16]]
  c.fillStyle = '#4f7d24'; for (const [x, y, r] of B) { c.beginPath(); c.arc(x, y, r + 5, 0, 7); c.fill() }
  c.fillStyle = '#b6da6e'; for (const [x, y, r] of B) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill() }
  c.fillStyle = '#d6efa0'; for (const [x, y, r] of B.slice(3, 6)) { c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, 7); c.fill() }
  c.strokeStyle = '#6f9a36'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); for (let a = 0; a < 9.5; a += 0.2) { const r = 3 + a * 2.2; c.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r * 0.8) } c.stroke()
})
const MOYA_N = 56
const moya = new THREE.InstancedMesh(G.plane, new THREE.MeshBasicMaterial({ map: moyaTex, transparent: true, opacity: 0.88, depthWrite: false, alphaTest: 0.04 }), MOYA_N)
moya.count = 0; moya.frustumCulled = false; moya.renderOrder = 3; scene.add(moya)
for (let i = 0; i < MOYA_N; i++) moya.setColorAt(i, new THREE.Color(0xffffff))
// 匂いの線（〜〜）も同じやり方で1回の描画に
const LINE_N = 8
const lines = new THREE.InstancedMesh(G.plane, new THREE.MeshBasicMaterial({ map: stinkTex, transparent: true, opacity: 0.9, depthWrite: false, alphaTest: 0.05 }), LINE_N)
lines.count = 0; lines.frustumCulled = false; lines.renderOrder = 3; scene.add(lines)
const lineP = Array.from({ length: LINE_N }, (_, i) => ({ a: i / LINE_N * Math.PI * 2, ph: i * 0.37 % 1, r: 0.42 + (i % 3) * 0.14 }))
const VR = Math.random // 見た目だけの乱数（遊びの乱数 S.rand は使わない）
const moyaP = [], TINT = [0xffffff, 0xe6f7c8, 0xd4ecaa, 0xf2ffd8]
function moyaAdd(o) { moyaP.push({ t: 0, rot: VR() * 6.28, vr: (VR() - 0.5) * 1.6, ph: VR() * 6.28, wob: 2 + VR() * 2.5, tint: TINT[Math.floor(VR() * TINT.length)], ...o }); while (moyaP.length > MOYA_N) moyaP.shift() }
function doPuff(n, big) {
  for (let i = 0; i < n * 7; i++) S.rand() // 以前の煙と同じ回数だけ乱数を進める（見た目の変更で遊びの乱数がずれないように）
  // おしりから後ろへ、もくもくが勢いよく出る
  const k = Math.ceil(n * 0.45)
  // 主役の体に隠れないよう、左右にはみ出して広がる
  for (let i = 0; i < k; i++) { const sd = i % 2 ? 1 : -1; moyaAdd({ p: buttPos().add(new THREE.Vector3(sd * 0.12, (VR() - 0.5) * 0.1, -0.05)), v: new THREE.Vector3(sd * (0.5 + VR() * (big ? 1.4 : 0.6)), (VR() * 0.7 + 0.15) * (big ? 1 : 0.6), -0.15 - VR() * (big ? 0.7 : 0.3)), s: (big ? 0.13 : 0.08) + VR() * 0.05, g: big ? 1.4 : 1.0, life: 1.3 + VR() * 0.9 }) }
}
let ambT = 0
// 犯人探しの視線（疑っている人の目から相手の顔へ、点が流れる）
const dotTex = canvasTex(32, 32, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(16, 16, 12, 0, Math.PI * 2); c.fill(); c.lineWidth = 3; c.strokeStyle = '#1b1620'; c.stroke() })
const gazeDots = []
for (let i = 0; i < 9; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, color: 0xffd21f, transparent: true, opacity: 0, depthTest: false, depthWrite: false })); sp.scale.setScalar(0.05); sp.renderOrder = 9; scene.add(sp); gazeDots.push(sp) }
const _ga = new THREE.Vector3(), _gb = new THREE.Vector3()
function updateGaze() {
  const h = S.hunt, on = S.mode === 'play' && h && h.from && h.to && h.from.state === 'idle'
  if (on) { npcHeadPos(h.from.n, _ga); if (h.to === 'me') P.head.getWorldPosition(_gb); else npcHeadPos(h.to.n, _gb) }
  const op = on ? Math.min(1, h.t / 0.25) : 0, me = on && h.to === 'me'
  gazeDots.forEach((sp, i) => {
    sp.material.opacity = op * 0.95; if (!on) return
    const k = (i / gazeDots.length + S.time * 0.9) % 1
    sp.position.lerpVectors(_ga, _gb, 0.12 + 0.76 * k); sp.material.color.setHex(me ? 0xff3d2e : 0xffd21f); sp.material.depthTest = !me; sp.scale.setScalar(me ? 0.065 : 0.05)
  })
}
// 風（ドアが開いた時）・スプレー
const winds = []
for (let i = 0; i < 8; i++) { const m = box(0.01, 0.01, 0.5, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }), 0, 0, 0, scene); winds.push({ m, x: (Math.random() - 0.5) * 2.2, y: 0.4 + Math.random() * 1.8, z: Math.random() * 4 }) }

// ---------- 画面
const views = ['vTitle', 'vHow', 'vPlay', 'vResult']
function show(id) { for (const v of views) $('#' + v).hidden = v !== id; $('#moreBox').hidden = true }
const ICON = {
  hold: '<path d="M9 11V5a2 2 0 0 1 4 0v6M13 10V8a2 2 0 0 1 4 0v5c0 5-3 8-7 8s-6-3-6-6v-3a2 2 0 0 1 4 0"/>',
  ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M19 5a9 9 0 0 1 0 10M21.5 3a12 12 0 0 1 0 14"/>',
  go: '<path d="M12 2l2 6 6-2-4 5 5 4-6 0 1 6-4-4-4 4 1-6-6 0 5-4-4-5 6 2z"/>',
  nose: '<path d="M12 3c-1 5-4 8-4 12a3 3 0 0 0 3 3h2a3 3 0 0 0 3-3c0-4-3-7-4-12z"/><path d="M4 8c1-1 2 0 3-1M17 7c1 1 2 0 3 1M3 13c1-1 2 0 3-1M18 12c1 1 2 0 3 1"/>',
  pax: '<circle cx="8" cy="7" r="3"/><circle cx="16" cy="7" r="3"/><path d="M3 21v-3a5 5 0 0 1 10 0v3M11 21v-3a5 5 0 0 1 10 0v3"/>',
  trick: '<circle cx="12" cy="12" r="9"/><path d="M8 10h.01M16 10h.01M8 15c2 2 6 2 8 0"/><path d="M15 4l2-2"/>',
  key: '<rect x="2" y="8" width="20" height="9" rx="2"/><path d="M7 13h10"/>',
  touch: '<circle cx="12" cy="8" r="3"/><path d="M12 11v10M8 4a6 6 0 0 1 8 0"/>',
  up: '<path d="M12 20V6M6 12l6-6 6 6"/><path d="M4 3h16"/>',
  chime: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
  phone: '<rect x="8" y="2" width="8" height="20" rx="2"/><path d="M11 18h2M4 8a6 6 0 0 0 0 8M20 8a6 6 0 0 1 0 8"/>',
  shake: '<rect x="7" y="4" width="10" height="16" rx="1"/><path d="M3 8l2 2-2 2 2 2M21 8l-2 2 2 2-2 2"/>',
  laugh: '<circle cx="12" cy="12" r="9"/><path d="M7 13q5 6 10 0zM8 9l2 1M16 9l-2 1"/>',
  baby: '<circle cx="12" cy="10" r="6"/><path d="M9 10h.01M15 10h.01M10 13q2 2 4 0M8 20q4-3 8 0"/>',
  bark: '<path d="M5 9l2-5 3 4h4l3-4 2 5v5a7 7 0 0 1-14 0z"/><path d="M10 13h.01M14 13h.01M11 17h2"/>',
  cart: '<path d="M4 18h12M6 18V6h6v12M12 10h6v8"/><circle cx="7" cy="20" r="1.5"/><circle cx="15" cy="20" r="1.5"/>',
  giggle: '<path d="M4 6h10v7H8l-4 3z"/><path d="M14 9h6v7l-3-2h-3"/>',
  music: '<path d="M4 14v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="13" width="4" height="7" rx="1"/><rect x="17" y="13" width="4" height="7" rx="1"/>',
  air: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/>',
  cover: '<path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z"/><path d="M9 14a3 3 0 0 0 3 3"/>',
  cough: '<circle cx="9" cy="11" r="6"/><path d="M15 9l5-2M15 12h6M15 15l5 2"/><path d="M7 13h4"/>',
  blame: '<path d="M2 12h10M8 8l4 4-4 4"/><circle cx="18" cy="8" r="3"/><path d="M14 20a4 4 0 0 1 8 0"/>',
  say: '<path d="M4 5h16v10H10l-5 4v-4H4z"/><path d="M10 8a2 2 0 1 1 2 2v1M12 13h.01"/>',
  exit: '<path d="M4 3h10v18H4z"/><path d="M11 12h10M17 8l4 4-4 4"/>',
  suka: '<path d="M7 20c-2-3 2-5 0-8s2-5 0-8M12 20c-2-3 2-5 0-8s2-5 0-8M17 20c-2-3 2-5 0-8s2-5 0-8"/>',
  pu: '<circle cx="12" cy="13" r="5"/><path d="M4 7l2 2M20 7l-2 2M12 3v3"/>',
  bubo: '<path d="M6 17a4 4 0 0 1 0-8 5 5 0 0 1 9-2 4 4 0 0 1 4 6 3 3 0 0 1-2 5H8z"/><path d="M2 5l3 2M22 5l-3 2M12 1v3M2 21l3-2M22 21l-3-2"/>',
}
const svg = (k, vb = 24) => `<svg viewBox="0 0 ${vb} ${vb}">${ICON[k] || ''}</svg>`
const MC_FACE = '<circle cx="24" cy="24" r="19" fill="#ffd9b3" stroke="#1b1620" stroke-width="2.5"/><path d="M6 20c1-12 35-12 36 0-6-4-30-4-36 0z" fill="#3a2a22" stroke="#1b1620" stroke-width="2"/><circle cx="17" cy="24" r="2.6" fill="#1b1620"/><circle cx="31" cy="24" r="2.6" fill="#1b1620"/><path d="M18 31q6 7 12 0z" fill="#a8170d" stroke="#1b1620" stroke-width="1.5"/><circle cx="24" cy="27" r="3" fill="#f2a07a"/><rect x="36" y="31" width="6" height="13" rx="3" fill="#1b1620"/><circle cx="39" cy="30" r="5" fill="#9a9aa6" stroke="#1b1620" stroke-width="2"/>'

function applyLang() {
  const T = TT(); document.documentElement.lang = S.lang
  for (const el of document.querySelectorAll('[data-t]')) { const v = T[el.dataset.t]; if (typeof v === 'string') el.innerHTML = v }
  for (const el of document.querySelectorAll('[data-face]')) el.innerHTML = MC_FACE
  $('#langTxt').textContent = S.lang === 'ja' ? 'EN' : 'JP'
  const H = isTouch ? T.holdSP : T.holdPC, R = isTouch ? T.relSP : T.relPC, TP = isTouch ? T.tapSP : T.tapPC
  $('#howSteps').innerHTML = T.howSteps.map(([ic, s]) => `<div class="step">${svg(ic)}<span>${s.replace('{HOLD}', H).replace('{REL}', R).replace('{TAP}', TP)}</span></div>`).join('')
  for (const f of D.farts) { const b = $('#f_' + f.id); b.querySelector('.fn').textContent = f[S.lang]; b.querySelector('.fp').textContent = T.pt.replace('{N}', f.pts); b.setAttribute('aria-label', f[S.lang]) }
  $('#bBlame .rl').textContent = T.ruse.blame
  $('#bMoreX').setAttribute('aria-label', T.close)
  if (!$('#moreBox').hidden) fillMore()
  lastScore = -1
  if (S.mode === 'intro') fillIntro()
  if (S.mode === 'result' && S.result) fillResult(true)
}
// ---------- 擬音・吹き出し（3Dの上に重ねる HTML）
const FX = []
const _w = new THREE.Vector3()
function toScreen(p) { _w.copy(p).project(camera); return { x: (_w.x + 1) / 2 * innerWidth, y: (1 - _w.y) / 2 * innerHeight } }
function fx(text, cls, o = {}) {
  const el = document.createElement('div'); el.className = cls; el.textContent = text; $('#fx').appendChild(el)
  const f = { el, t: 0, life: o.life || 1.3, world: o.world, x: o.x, y: o.y, rot: o.rot || 0, shake: o.shake || 0, size: o.size, dy: o.dy || 0, follow: o.follow, head: o.head }
  if (o.size) el.style.fontSize = o.size + 'px'
  // 画面に出す吹き出し・擬音は同時に2つまで（古いものから消す）
  const live = FX.filter(g => g.t < g.life - 0.15)
  for (let i = 0; i < live.length - 1; i++) live[i].t = Math.max(live[i].t, live[i].life - 0.15)
  FX.push(f); return f
}
function clearFx() { for (const f of FX) f.el.remove(); FX.length = 0 }
function updateFx(dt) {
  const top = (document.querySelector('.hudTop') && !$('#vPlay').hidden) ? $('.hudTop').getBoundingClientRect().bottom + 6 : 50
  const bot = (!$('#vPlay').hidden) ? $('.hudBot').getBoundingClientRect().top - 6 : innerHeight - 6
  const placed = []
  for (let i = 0; i < FX.length; i++) {
    const f = FX[i]; f.t += dt
    if (f.t > f.life) { f.el.remove(); FX.splice(i, 1); i--; continue }
    let x = f.x, y = f.y
    if (f.head) { f.head(_hp); _hp.y += 0.3; const s = toScreen(_hp); x = s.x; y = s.y }
    else if (f.follow) { npcHeadPos(f.follow, _hp); _hp.y += 0.38 * f.follow.g.scale.y; const s = toScreen(_hp); x = s.x; y = s.y }
    else if (f.world) { const s = toScreen(f.world); x = s.x; y = s.y }
    const w = f.el.offsetWidth, h = f.el.offsetHeight
    x = clamp(x, w * 0.6 + 6, innerWidth - w * 0.6 - 6); y = clamp(y + f.dy * f.t, top + h / 2, Math.max(top + h / 2, bot - h / 2))
    // 吹き出し同士・擬音とは重ねない（先に出たものの下にずらす）
    if (/^(ono yel|verdict)/.test(f.el.className)) placed.push({ x, y, w: w * 1.1, h: h * 1.1 })
    else if (f.el.className.startsWith('sb')) {
      for (let k = 0; k < 6; k++) { const hit = placed.find(b => Math.abs(b.x - x) < (b.w + w) / 2 + 4 && Math.abs(b.y - y) < (b.h + h) / 2 + 4); if (!hit) break; y = hit.y + (hit.h + h) / 2 + 6 }
      placed.push({ x, y, w, h })
    }
    const t = f.t, s = t < 0.1 ? t / 0.1 * 1.25 : t < 0.18 ? 1.25 - (t - 0.1) / 0.08 * 0.25 : 1
    const jx = f.shake ? (Math.sin(t * 90) * f.shake) : 0
    f.el.style.transform = `translate(${x + jx}px,${y}px) translate(-50%,-50%) rotate(${f.rot}deg) scale(${s})`
    f.el.style.opacity = String(clamp((f.life - t) / 0.15, 0, 1))
  }
}
const vmin = () => Math.min(innerWidth, innerHeight)
const say = (n, text, life = 1.8) => fx(text, 'sb', { follow: n, life })

// ---------- 進行（1回の乗車が切れ目なく続く。3回バレたら降ろされて終わり）
const FT = Object.fromEntries(D.farts.map(f => [f.id, f]))
const FIDS = D.farts.map(f => f.id)
function startRun() {
  Snd.init(); S.rec = []; S.maxDb = 0; S.photo = false; S.result = null; S.smellBusts = 0; S.rode = []; S.ruseLog = []
  S.ruseLeft = { ...D.ruses }; S.roof = false; S.score = 0; S.lives = D.run.lives; S.kickAt = -1; S.lifeT = -1; S.tut = 0
  S.cd = Object.fromEntries(FIDS.map(k => [k, 0]))
  const pc = $('#rPhoto').getContext('2d'); pc.clearRect(0, 0, 256, 256)
  S.zone = 0; setStage(D.zones[0].id)
  S.evs = []; S.evLog = []; S.evN = 0; S.st = 0; S.planAt = D.run.firstAt; S.floorF = 1; S.floor = 1
  S.gauge = 0.3; S.strain = 0; S.flush = 0; S.snz = null; S.react = 0; S.relief = 0; S.shame = 0; S.punch = -1; S.level = 0; S.hop = 0; S.holding = false
  S.smell = 0; S.sniff = 0; S.air = 0; S.hunt = null; S.zawaT = 0; Snd.tense = 0; Snd.sour = 0; S.door = 0; S.stop = null; S.lastBad = null; S.exitT = 0
  P.root.position.set(0, 0, 0); P.root.rotation.y = 0
  S.capT = -1; S.doCap = false; S.later = []
  spawnInitial()
  clearFx(); S.mode = 'intro'; S.modeT = 0; show('vPlay'); fillIntro(); $('#introCard').hidden = false; $('#count').hidden = true; $('#hint').hidden = true
  Snd.setTrack('quiet'); updateHud()
}
function fillIntro() {
  const T = TT()
  $('#iNo').textContent = T.introNo; $('#iName').textContent = T.introT; $('#iSub').textContent = T.introS
  $('#iCtrl').innerHTML = D.farts.map(f => `<div>${svg(f.id)}<span>${f[S.lang]}<br><b>${T.pt.replace('{N}', f.pts)}</b></span></div>`).join('')
}
function beginCount() {
  if (S.mode !== 'intro') return
  Snd.init(); Snd.sfx('tap'); $('#introCard').hidden = true; S.mode = 'count'; S.modeT = 0; S.cIdx = -1
}

// おならを出す（出したい時に、出したい種類を）。出した種類は少しのあいだ溜まり直す
function canFart(id) { return S.mode === 'play' && FT[id] && S.cd[id] <= 0 && !(S.snz && !S.snz.impact) }
function doFart(id) {
  if (!canFart(id)) return 'no'
  Snd.init(); S.cd[id] = FT[id].cd; S.snz = { t: 0, kind: id, impact: false }
  return 'ok'
}
// まわりの音が足りていれば、その種類はかき消せる
const okNow = id => FT[id].need < 0 || S.level >= FT[id].need
function rateFart(f, L) { return f.need < 0 ? 'safe' : L >= f.need + 0.15 ? 'perfect' : L >= f.need ? 'safe' : L >= f.need - 0.15 ? 'sus' : 'busted' }
function stageShout() { return TT().shout }
const _ht = new THREE.Vector3()
function headTop() { return P.head.getWorldPosition(_ht).clone().add(new THREE.Vector3(0.25, 0.35, 0)) }
function buttPos() { return P.root.localToWorld(BUTT.clone()) }
function verdict(rating, pts) {
  const land = innerWidth > innerHeight * 1.2, txt = TT().rate[rating] + (pts ? ' +' + pts : '')
  fx(txt, 'verdict ' + rating, land ? { x: innerWidth * 0.75, y: innerHeight * 0.3, life: 1.3 } : { x: innerWidth / 2, y: innerHeight * 0.22, life: 1.3 })
}
// 全員がこっちを向く（ヘッドホンの若者は音に気づかない）
function allTurn(kind, sound) {
  aboard().forEach((p, i) => { if (sound && p.type === 'headphone') return; p.n.reactT = 0.05 + i * 0.03; p.n.reactKind = kind; p.n.reactUntil = 2.6; p.n.lookP = null })
}
function loseLife() {
  S.lives = Math.max(0, S.lives - 1); S.lifeT = 0
  if (S.lives <= 0 && S.kickAt < 0) S.kickAt = S.st + 1.8
}
function fartImpact() {
  const s = S.snz, f = FT[s.kind]; s.impact = true
  // 犯人探しで視線が自分に来ている間に出すと、どんなおならでも即バレ
  const caught = gazedNow()
  const L = S.level, rating = caught ? 'caught' : rateFart(f, L), pts = rating === 'busted' || caught ? 0 : f.pts
  const db = Math.round((f.db[0] + S.rand() * (f.db[1] - f.db[0]) + (rating === 'busted' ? 6 : 0)) * 10) / 10
  const rec = { floor: S.floor, t: Math.round(S.st * 100) / 100, L: Math.round(L * 100) / 100, id: f.id, rating, pts, db, kind: f.id, lost: rating === 'busted' || caught, m: pts > 0 ? 1 : 0 }
  S.rec.push(rec); S.score += pts; s.rating = rating; s.db = db
  if (db > S.maxDb) { S.maxDb = db; S.capT = 0 }
  // 匂い（静かなおならほど強い。かき消しても匂いは出る）
  S.smell = Math.min(1.4, S.smell + f.smell); rec.smell = f.smell
  S.lastBad = (rating === 'sus' || rating === 'busted' || caught) ? { rec, t: S.st } : null
  if (S.tut === 1 && f.id === 'bubo' && pts) { S.tut = 2; $('#hint').hidden = true }
  const T = TT(), bp = buttPos(), big = f.id === 'bubo', bad = rating === 'busted' || caught, label = f[S.lang === 'ja' ? 'oj' : 'oe']
  doPuff(big ? 26 : f.id === 'pu' ? 12 : 6, big); S.hop = big ? 1 : 0.4
  // 音: バレたら狭い箱の残響、かき消せたら大きな音の裏でこもって小さく
  Snd.fart(f.id, bad ? 'busted' : f.need < 0 ? 'plain' : rating === 'sus' ? 'half' : 'masked')
  if (bad) {
    loseLife(); Snd.duck(2.2)
    later(0.38, () => Snd.sfx('scratch')); later(0.65, () => Snd.sfx('gasp'))
    fx(label, 'ono red', { world: bp.clone().add(new THREE.Vector3(0.45, 0.1, 0.3)), size: vmin() * (big ? 0.12 : 0.09), life: 1.0, shake: 5, rot: -8, dy: -10 })
    S.react = 1.2; S.shame = 2.2; S.punch = 0; S.shake = 0.06; S.flush = 1
    allTurn('!', true)
    const ab = aboard().filter(p => p.type !== 'headphone'), withBust = ab.filter(p => p.def.bust)
    if (caught) {
      // にらんでいた本人が「やっぱりお前か！！」。犯人が決まったので空気は戻る
      const acc = S.hunt.from; allTurn('!', false); endHunt(false); S.smell *= 0.3; S.sniff = 0; S.air = 0
      later(0.9, () => say(acc.n, T.caught, 1.6))
    } else {
      const a1 = withBust.length ? pick(withBust) : ab[0]
      if (a1) { const line = a1.def.bust ? L2(pick(a1.def.bust)) : pick(stageShout()); later(1.35, () => say(a1.n, line)) }
    }
    if (P.glasses.parent === P.head) { fling(P.glasses, new THREE.Vector3(0.6 + S.rand() * 0.4, 2.3, 1.3), new THREE.Vector3(9, 4, 12)); later(0.6, () => Snd.sfx('clink')) }
    const pr = PROPS[cur.id].items.find(m => m.parent !== scene); if (pr) { fling(pr, new THREE.Vector3(-0.6 - S.rand(), 1.6, 0.9), new THREE.Vector3(6, 2, 8)); later(0.52, () => Snd.sfx('thud')) }
  } else {
    fx(label, big ? 'ono yel' : 'ono small', { world: bp.clone().add(new THREE.Vector3(0.4, 0.05, 0.2)), size: vmin() * (big ? 0.085 : 0.05), life: 1.0, rot: -5, dy: -14, shake: big ? 3 : 0 })
    if (rating === 'sus') {
      Snd.sfx('sus'); S.smell += 0.1
      const near = aboard().filter(p => p.type !== 'headphone').sort((a, b) => Math.hypot(SLOTS[a.slot].x, SLOTS[a.slot].z) - Math.hypot(SLOTS[b.slot].x, SLOTS[b.slot].z)).slice(0, 2)
      near.forEach(p => { p.n.reactT = 0.15; p.n.reactKind = '?'; p.n.reactUntil = 1.6 })
    } else { S.relief = 1.6; Snd.sfx(rating === 'perfect' ? 'perfect' : 'safe') }
  }
  verdict(rating, pts)
}
// 匂いでバレる
function smellBust(why) {
  const T = TT(), rec = { floor: S.floor, t: Math.round(S.st * 100) / 100, m: 0, pts: 0, rating: 'smell', kind: 'smell', lost: true, why }
  S.rec.push(rec); S.smellBusts++; S.lastBad = { rec, t: S.st }; loseLife()
  allTurn('!', false); S.shame = 2.4; S.punch = 0; S.shake = 0.05
  for (const p of aboard()) p.entry.exposure += 1.5
  // 先に出ていた判定・吹き出しは消して、「くさっ！！誰！？」だけを見せる
  for (const f of FX) f.t = Math.max(f.t, f.life - 0.15)
  const sn = aboard().sort((a, b) => b.def.sniff - a.def.sniff)[0]
  if (sn) say(sn.n, T.smellOut, 1.1)
  Snd.sfx('gasp'); Snd.duck(1.6)
  S.sniff = 0; S.smell *= 0.3; endHunt(false); S.air = 0
  if (sn) later(1.1, () => verdict('smell')); else verdict('smell')
}
// 匂いとくんくん度（毎フレーム）。画面には数字を出さず、煙と乗客のしぐさで見せる
// 鼻の利き方: 乗っている中で一番利く鼻と人数、上の階ほど利く。だれもいなければ 0
function sniffMult() { const ab = aboard(); if (!ab.length) return 0; return (0.4 + 0.6 * Math.max(...ab.map(p => p.def.sniff))) * (0.9 + 0.04 * ab.length) * RP('nose') }
function coverNow() { const c = aboard().reduce((a, p) => a + (p.def.cover || 0) * (p.age < 4 ? 1 : 0.12), 0); return { pax: Math.min(1, c), door: S.door > 0.5 ? 1 : 0, who: aboard().find(p => p.def.cover && p.age < 4) } }
// 視線が自分に来ている（来た直後の一瞬は見逃す）
const gazedNow = () => !!(S.hunt && S.hunt.to === 'me' && S.hunt.t >= 0.15)
// 匂いはたまっていく。時間でゆっくり抜け、ドア・カレーや香水の人で早く抜ける
// くんくん度（sniff）= 匂い × 鼻の利き方。これで空気の段階が 平常 → ざわざわ → 犯人探し と変わる。画面には数字を出さず、乗客の様子とセリフだけで見せる
function updateSmell(dt) {
  const cv = coverNow(), A = D.run.air
  S.smell = Math.max(0, S.smell - S.smell * (D.run.fade + 0.55 * cv.pax + 1.6 * cv.door) * dt)
  const want = S.smell * sniffMult() / D.run.bustAt
  S.sniff = clamp(S.sniff + (want - S.sniff) * Math.min(1, dt * 1.6), 0, 1.2)
  const ab = aboard()
  if (S.sniff >= 1 && ab.length) { smellBust('sniff'); return }
  // 清掃員のおばちゃんは、ざわざわし始めたら黙って消臭する
  const cl = ab.find(p => p.def.spray && !p.sprayed)
  if (cl && S.sniff >= A.zawa) { cl.sprayed = true; S.smell = 0; S.sniff = 0; Snd.sfx('spray'); say(cl.n, L2(pick(cl.def.notice)), 2.2); cl.n.reactT = 0.1; cl.n.reactKind = '?'; cl.n.reactUntil = 2.2 }
  // 空気の段階（行きと帰りでしきい値をずらして、行ったり来たりしない）
  let air = S.air
  if (!ab.length) air = 0
  else if (air === 0) air = S.sniff >= A.hunt ? 2 : S.sniff >= A.zawa ? 1 : 0
  else if (air === 1) air = S.sniff >= A.hunt ? 2 : S.sniff < A.calm ? 0 : 1
  else if (S.sniff < A.huntEnd) air = S.sniff < A.calm ? 0 : 1
  if (air !== S.air) setAir(air)
  Snd.tense = S.air
  // ざわざわの間、BGM の音程と調子が少しずつずれていく（平常に戻れば戻る）
  const sourT = S.air === 1 ? clamp(0.3 + 0.7 * (S.sniff - A.calm) / Math.max(0.05, A.hunt - A.calm), 0.25, 1) : S.air === 2 ? 1 : 0
  Snd.sour = clamp(Snd.sour + (sourT - Snd.sour) * Math.min(1, dt * (sourT > Snd.sour ? 0.5 : 1.2)), 0, 1)
  if (Snd.sour < 0.01 && !sourT) Snd.sour = 0
  if (S.air === 1) updateZawa(dt)
  if (S.air === 2) updateHunt(dt)
}
function setAir(air) {
  const was = S.air; S.air = air
  if (air >= 1 && was === 0) { S.zawaT = 0.3; Snd.sfx('whisper') }
  if (air === 2) startHunt()
  if (was === 2 && air < 2) endHunt(true)
  if (air === 0 && was >= 1) {
    // 匂いが抜けて落ち着いた: 乗客も元に戻る
    for (const p of aboard()) { p.n.pinchT = 0; p.n.talkT = 0 }
    const ab = aboard(); if (ab.length && S.mode === 'play') say(pick(ab).n, pick(TT().calm), 1.6)
  }
}
// ざわざわ: ひそひそ話す・顔を見合わせる・鼻をつまむ。吹き出しは一度に1つ
function updateZawa(dt) {
  S.zawaT -= dt; if (S.zawaT > 0) return
  S.zawaT = 2.6 + S.rand() * 1.2
  const ab = aboard().filter(p => !p.n.reacting || p.n.reacting <= 0); if (!ab.length) return
  const a = pick(ab), others = ab.filter(p => p !== a)
  if (others.length) { const b = pick(others); a.n.talkTo = b.n; a.n.talkT = 1.8; b.n.talkTo = a.n; b.n.talkT = 1.4 }
  else a.n.pinchT = 2.2
  const c = pick(ab); if (c !== a || !others.length) c.n.pinchT = 2.2
  say(a.n, pick(TT().zawa), 1.5); Snd.sfx('whisper')
}
// 犯人探し: 乗客が一人ずつ順番に誰かを疑う（視線と「…あなた？」が人から人へ移る）
function startHunt() { for (const f of FX) if (f.el.className === 'sb') f.t = Math.max(f.t, f.life - 0.15); S.hunt = { from: null, to: null, t: 0, dur: 0, n: 0 }; for (const p of aboard()) { p.n.pinchT = 0; p.n.talkT = 0 } nextGaze() }
function endHunt(calm) {
  const h = S.hunt; S.hunt = null
  if (h && h.from && h.from.n) { h.from.n.lookP = null; h.from.n.gaze = 0 }
  for (const p of S.pax) p.n.gaze = 0
  void calm
}
function nextGaze() {
  const h = S.hunt, ab = aboard(); if (!h || !ab.length) return
  const prevTo = h.to
  // 疑われた人が次に誰かを疑う（鎖のように）。自分を疑ったあとは別の人が引き継ぐ
  let from = prevTo && prevTo !== 'me' && ab.includes(prevTo) ? prevTo : pick(ab.filter(p => p !== h.from).length ? ab.filter(p => p !== h.from) : ab)
  const others = ab.filter(p => p !== from)
  let to
  if (prevTo === 'me') to = others.length ? pick(others) : null
  else if (!others.length) to = 'me'
  else {
    // 匂いが強いほど自分が疑われやすい。最初の1人目は必ずほかの人を疑う（気づく間をあげる）
    const pMe = h.n === 0 ? 0 : clamp(0.4 + 0.8 * (S.sniff - D.run.air.hunt), 0.4, 0.75)
    to = S.rand() < pMe ? 'me' : pick(others)
  }
  for (const p of S.pax) p.n.gaze = 0
  h.from = from; h.to = to; h.t = 0; h.n++; h.dur = to === 'me' ? D.run.gazeMe : D.run.gazeOther
  from.n.gaze = 1; if (to && to !== 'me') to.n.gaze = 2
  npcMark(from.n, '?')
  const T = TT()
  if (h.bub) h.bub.t = Math.max(h.bub.t, h.bub.life - 0.15)
  h.bub = say(from.n, to === null ? T.huntNone : to === 'me' ? T.huntQ[0] : pick(T.huntQ), 1.35)
  Snd.sfx(to === 'me' ? 'gaze' : 'whisper')
}
function updateHunt(dt) {
  const h = S.hunt; if (!h) return
  h.t += dt
  if (h.to === 'me') S.flush = Math.max(S.flush, 0.6)
  // 視線が自分に来ている間、出さずに耐えれば、疑いは別の人へ移る
  if (h.t >= h.dur || !h.from || h.from.state !== 'idle') nextGaze()
}

// ---------- なすりつけ（ピンチの時だけ出てくる。回数制限つき）
const blameTarget = () => aboard().filter(p => p.def.blame > 0).sort((a, b) => b.def.blame - a.def.blame)[0]
const recentBad = () => S.lastBad && S.st - S.lastBad.t < 3.5 && !S.lastBad.rec.blamed
const pinch = () => recentBad() || S.air >= 2
function canRuse(k = 'blame') { return S.mode === 'play' && (S.ruseLeft[k] || 0) > 0 && !(S.snz && !S.snz.impact) && !!blameTarget() }
function useRuse(k = 'blame') {
  if (k !== 'blame' || !canRuse(k)) return 'no'
  S.ruseLeft[k]--; Snd.init(); const T = TT(), log = { k, ok: true, t: S.st }; S.ruseLog.push(log)
  const tgt = blameTarget(); log.who = tgt.type; Snd.sfx('stare')
  const recent = recentBad(), sus = recent || S.air >= 1
  // 全員の視線がなすりつけ先へ
  const hp = new THREE.Vector3(); blameHead(tgt.n, hp)
  aboard().forEach(p => { if (p !== tgt) { p.n.lookP = hp.clone(); p.n.reacting = 1.8; p.n.reactKind = '?' } })
  let out
  if (!sus) { later(0.6, () => verdict('blameMiss')); log.ok = false; out = 'miss' }
  else if (S.rand() < tgt.def.blame) {
    if (recent) {
      const r = S.lastBad.rec; r.blamed = true; r.rating = 'blamed'
      if (r.lost) { r.lost = false; S.lives++; if (S.lives > 0) S.kickAt = -1; S.lifeT = 0 }
      if (r.id && !r.pts) { r.pts = FT[r.id].pts; r.m = 1; S.score += r.pts }
    }
    // 疑いを押し付けた: 全員がその人をにらみ、本人は首をぶんぶん振る。匂いもその人のものに
    S.sniff = 0; S.smell *= 0.3; endHunt(false); S.air = 0; tgt.entry.blamed = true; tgt.entry.exposure += 2
    later(0.4, () => { npcMark(tgt.n, '!'); tgt.n.denyT = 1.8; fx(L2(pick(tgt.def.blamed)), 'sb', { head: o => blameHead(tgt.n, o), life: 2.0 }); Snd.sfx('sus') })
    later(0.9, () => verdict('blamed')); out = 'success'
  } else {
    S.rec.push({ floor: S.floor, t: Math.round(S.st * 100) / 100, m: 0, pts: 0, rating: 'blameFail', kind: 'blameFail', lost: true })
    log.ok = false; S.lastBad = null; loseLife(); endHunt(false); S.smell *= 0.4; S.sniff = 0; S.air = 0
    later(0.5, () => { allTurn('!', false); S.shame = 2; say(tgt.n, pick(T.blameFail)); Snd.sfx('gasp') })
    later(0.9, () => verdict('blameFail')); out = 'fail'
  }
  return out
}

function later(sec, fn) { S.later.push({ t: sec, fn }) }
function updateStop(dt) {
  const s = S.stop; if (!s) { S.door = Math.max(0, S.door - dt * 2.4); return }
  s.t += dt
  if (s.t < 0.45) S.door = Math.min(1, S.door + dt / 0.45)
  else if (s.t < 2.2 || s.exitPlayer) S.door = 1
  else S.door = Math.max(0, S.door - dt / 0.4)
  if (!s.did && s.t >= 0.25) {
    s.did = true; Snd.sfx('door')
    if (s.exitPlayer) { const ab = aboard(); if (ab.length && !s.roof) later(0.3, () => say(pick(ab).n, pick(TT().kickLine), 2.0)) }
    else if (S.mode === 'play') {
      // 区画が変わる階では、ドアが開いたところで内装も変わる
      const z = zoneOf(S.floor); if (z !== S.zone) { S.zone = z; setLook(D.zones[z].id) }
      doBoarding()
    }
  }
  if (s.exitPlayer && s.t > 0.5) {
    S.exitT += dt; P.root.rotation.y = Math.PI * ease(S.exitT / 0.3); P.root.position.z = 1.1 * ease((S.exitT - 0.3) / 1.0); P.root.position.x = 0.5 * ease((S.exitT - 0.3) / 1.0)
    if (S.exitT > 1.6 && S.mode === 'kicked') toResult()
  }
  if (s.t > 2.7 && !s.exitPlayer) S.stop = null
}
// 3回目のバレのあと（なすりつけで取り消されなければ）次の階で降ろされる
// 屋上（run.top 階）に着いても終わり。こちらは胸を張って降りる
function startKick(roof) {
  S.mode = 'kicked'; S.modeT = 0; S.exitT = 0; S.roof = !!roof; $('#hint').hidden = true
  S.stop = { t: 0, exitPlayer: true, roof: !!roof }; Snd.sfx('ding'); if (roof) Snd.sfx('fanfare'); else Snd.sfx('mash'); verdict(roof ? 'roof' : 'kicked')
}
function showHint(txt, k) { const h = $('#hint'); if (h.dataset.k !== k || h.hidden || h.textContent !== txt) { h.textContent = txt; h.dataset.k = k; h.hidden = false } }
function updateTutorial() {
  // 最初の1回だけ、実際の画面の上で案内する: ボタンで出す → 大きな音にブボボボッ
  if (S.shame > 0 || S.lastBad) { $('#hint').hidden = true; if (S.tut === 0 && S.st > 4) S.tut = 1; return }
  if (S.tut === 0) { if (S.st < 4) showHint(isTouch ? TT().hintTap : TT().hintTapPC, 'tap'); else $('#hint').hidden = true; if (S.evs.some(e => !e.fake && e.ph === 'warn')) S.tut = 1 }
  if (S.tut === 1) {
    const e = S.evs.find(e => !e.fake && (e.ph === 'warn' || e.ph === 'peak'))
    if (e && e.ph === 'peak') showHint(TT().hintRel, 'rel'); else if (e) showHint(TT().hintWait, 'wait'); else $('#hint').hidden = true
  }
}
function updateGame(dt) {
  S.time += dt; S.modeT += dt
  for (let i = S.later.length - 1; i >= 0; i--) { const l = S.later[i]; l.t -= dt; if (l.t <= 0) { S.later.splice(i, 1); l.fn() } }
  if (S.mode === 'title' || S.mode === 'how') {
    const c = (S.time % 7) / 7
    S.gauge = c < 0.8 ? c / 0.8 * 0.9 : 0.05; S.strain = 0
    if (c > 0.8 && c < 0.83 && !S.snz) { S.snz = { t: 0, kind: 'demo', impact: true, demo: true }; doPuff(10, false); S.hop = 0.4; S.smell = 0.8 }
    S.smell = Math.max(0, S.smell - dt * 0.25)
  } else if (S.mode === 'count') {
    const idx = Math.floor(S.modeT / 0.6)
    if (idx !== S.cIdx && idx < 4) { S.cIdx = idx; const el = $('#count'); el.hidden = false; el.textContent = TT().count[idx]; Snd.sfx(idx < 3 ? 'count' : 'go') }
    if (S.modeT >= 2.4) { $('#count').hidden = true; S.mode = 'play'; S.modeT = 0 }
  } else if (S.mode === 'play' || S.mode === 'kicked') {
    S.st += dt
    if (S.mode === 'play') {
      if (!S.stop) { S.floorF = Math.min(D.run.top, S.floorF + D.run.fpS * dt); S.floor = Math.floor(S.floorF) }
      if (S.floor >= D.run.top && !(S.snz && !S.snz.impact) && !S.stop) { startKick(true); return }
      if (S.st >= S.planAt) newEvent()
    }
    let L = 0
    for (const e of S.evs) {
      if (!e.started && S.st >= e.ws) { e.started = true; Snd.event(e.type, Math.max(0.05, e.at - S.st), e.peak, e.fake) }
      L = Math.max(L, evLevel(e, S.st))
      if (!e.peaked && S.st >= e.at) { e.peaked = true; if (e.fake) onFizzle(e); else onPeak(e) }
    }
    S.evs = S.evs.filter(e => e.ph !== 'done')
    const hp = aboard().find(p => p.def.noise); if (hp) L = Math.max(L, hp.def.noise)
    S.level = L
    for (const k of FIDS) S.cd[k] = Math.max(0, S.cd[k] - dt)
    // 主役の顔: 匂いがたまるほどそわそわ
    S.gauge = 0.25 + 0.5 * S.sniff
    if (S.mode === 'play') {
      updateSmell(dt)
      if (S.tut < 2) updateTutorial(); else if (!$('#hint').hidden) $('#hint').hidden = true
      if (S.lives <= 0 && S.kickAt >= 0 && S.st >= S.kickAt && !(S.snz && !S.snz.impact)) startKick()
    }
  } else if (S.mode === 'result') updateReveal(dt)
  updateStop(dt); updatePax(dt)
  if (S.snz) {
    S.snz.t += dt
    if (!S.snz.impact && S.snz.t >= PRE) fartImpact()
    if (S.snz.t > 1.2) S.snz = null
  }
  if (S.capT >= 0) { S.capT -= dt; if (S.capT < 0) S.doCap = true }
  if (S.lifeT >= 0) { S.lifeT += dt; if (S.lifeT > 0.8) S.lifeT = -1 }
  S.flush = Math.max(0, S.flush - dt * 0.5)
  S.relief = Math.max(0, S.relief - dt); S.shame = Math.max(0, S.shame - dt)
  S.shake = Math.max(0, S.shake - dt * 0.12); S.hop = Math.max(0, S.hop - dt * 2.2)
}
// 大きな音が来た瞬間: 画面全体が揺れ、大きな擬音が出る
function onPeak(e) {
  const lab = D.ev[e.type][S.lang === 'ja' ? 'sj' : 'se'].replace('{F}', S.floor)
  const s = toScreen(lookAtOf(e))
  fx(lab, 'ono yel', { x: clamp(s.x, innerWidth * 0.22, innerWidth * 0.78), y: clamp(s.y, innerHeight * 0.26, innerHeight * 0.38), size: Math.min(vmin() * 0.1, innerWidth * 0.8 / lab.length), life: e.peak + 0.5, rot: (S.rand() - 0.5) * 16, shake: 3 })
  S.shake = Math.max(S.shake, e.type === 'shake' ? 0.07 : 0.045)
  if (e.type === 'chime' && S.mode === 'play' && !S.stop) S.stop = { t: 0 }
  if (e.type === 'cart' && e.src) e.src.n.topple = 0
}
function onFizzle(e) {
  const s = toScreen(lookAtOf(e)), f = TT().fizzle[e.type] || (S.lang === 'ja' ? '…あれ？' : '...huh?')
  fx(f, 'ono small', { x: clamp(s.x, innerWidth * 0.22, innerWidth * 0.78), y: clamp(s.y, innerHeight * 0.26, innerHeight * 0.38), size: vmin() * 0.055, life: 1.1, rot: 5 })
}

// ---------- 結果（大見出しは点数、何階まで行けたかを添える）
function calcResult() {
  const score = S.score, rank = D.ranks.find(r => score >= r.min), db = S.maxDb || 0
  const seen = []; for (const e of S.rode) if (!seen.includes(e.type)) seen.push(e.type)
  const vic = S.rode.slice().sort((a, b) => b.exposure - a.exposure)[0]
  const used = S.ruseLog.length, ok = S.ruseLog.filter(l => l.ok).length
  const n = S.rec.filter(r => r.pts > 0).length, bad = S.rec.filter(r => r.lost).length
  const byType = Object.fromEntries(FIDS.map(k => [k, S.rec.filter(r => r.id === k && r.pts > 0).length]))
  return { score, floor: S.floor, roof: !!S.roof, n, bad, byType, rank, db, cmp: D.dbCmp.find(c => db < c.max) || D.dbCmp[D.dbCmp.length - 1], smell: S.smellBusts, used, ok, top: used ? 'blame' : null, riders: seen, nRiders: S.rode.length, victim: vic && vic.exposure > 0.3 ? vic.type : null }
}
function toResult() {
  S.mode = 'result'; S.resT = 0; S.revealStep = 0; clearFx(); S.later = []; S.stop = null; S.door = 0; $('#hint').hidden = true
  S.result = calcResult()
  S.mood = S.result.score >= D.ranks[2].min ? 'proud' : 'shame'
  setStage('date'); P.root.position.set(0, 0, 0); P.root.rotation.y = 0
  for (const t of ['partner', 'dog', 'nose']) addPax(t, false)
  show('vResult'); fillResult(false)
  Snd.setTrack(null); Snd.sfx('drum')
}
function reachText(db) { const m = Math.pow(10, (db - 50) / 20); return m >= 1000 ? (Math.round(m / 100) / 10) + 'km' : Math.max(1, Math.round(m)) + 'm' }
const paxName = t => D.pax[t][S.lang]
// 結果の3つの小さな数字: バレずに出せた・バレた・なすりつけ
function statText(r) { const T = TT(); return [[T.snuckL, T.unitN.replace('{N}', r.n)], [T.badL, T.times.replace('{N}', r.bad)], [T.blameL, T.times.replace('{N}', r.used) + (r.used ? ' / ' + T.ruseOk.replace('{N}', r.ok) : '')]] }
function paxText(r) {
  const T = TT(), sep = S.lang === 'ja' ? '・' : ', ', names = r.riders.slice(0, 4).map(paxName).join(sep) + (r.riders.length > 4 ? (S.lang === 'ja' ? 'ほか' : ' +more') : '')
  return [`${T.paxT}（${T.paxN.replace('{N}', r.nRiders)}）${names}`.replace('（', S.lang === 'ja' ? '（' : ' (').replace('）', S.lang === 'ja' ? '）' : ') '), `${T.victim}: ${r.victim ? paxName(r.victim) : T.victimNone}`]
}
function fillResult(keep) {
  const T = TT(), r = S.result, L = S.lang
  $('#rRank').textContent = r.rank.t[L]; $('#rRank').style.color = r.rank.col
  $('#rStamp').textContent = r.rank.st[L]; $('#rStamp').style.whiteSpace = 'pre'
  $('#rFloor').textContent = r.roof ? T.floorTop : T.floorTo.replace('{F}', r.floor)
  $('#rDbN').textContent = r.db ? r.db.toFixed(1) + ' dB' : '-'
  $('#rDbC').textContent = r.db ? `${r.cmp.t[L]} / ${T.reach.replace('{R}', reachText(r.db))}` : ''
  $('#rStages').innerHTML = statText(r).map(([a, b], i) => `<div class="${i === 1 && r.bad ? 'bad' : ''}">${a}<b>${b}</b></div>`).join('')
  const [c, d] = paxText(r); $('#rPax').innerHTML = `<span>${c}</span><b>${d}</b>`
  $('#rCmt').textContent = r.rank.c[L] + (r.top ? ' ' + T.extra[r.top] : '')
  if (!keep) { $('#rPct').textContent = '0'; for (const el of document.querySelectorAll('#vResult .reveal')) el.classList.remove('on'); $('#rStamp').classList.remove('on') }
  if (!S.photo) drawNoPhoto()
}
function drawNoPhoto() { const c = $('#rPhoto').getContext('2d'); c.fillStyle = '#ffd9b3'; c.fillRect(0, 0, 256, 256) }
function updateReveal(dt) {
  S.resT += dt; const r = S.result, t = S.resT
  if (t < 1.6) $('#rPct').textContent = String(Math.floor(S.rand() * 300))
  else if (t < 2.6) $('#rPct').textContent = String(Math.round(r.score * ease((t - 1.6) / 1.0)))
  else $('#rPct').textContent = String(r.score)
  const step = (n, at, fn) => { if (S.revealStep < n && t >= at) { S.revealStep = n; fn() } }
  step(1, 2.6, () => { $('#rStamp').classList.add('on'); $('#rRank').classList.add('on'); $('#rFloor').classList.add('on'); Snd.sfx('stamp'); Snd.sfx(S.mood === 'proud' ? 'fanfare' : 'wahwah'); Snd.setTrack(S.mood === 'proud' ? 'happy' : 'sad'); S.shake = 0.03 })
  step(2, 3.2, () => { $('#rDb').classList.add('on'); Snd.sfx('boom') })
  step(3, 3.7, () => { $('#rStages').classList.add('on'); $('#rPax').classList.add('on'); Snd.sfx('tap') })
  step(4, 4.1, () => { for (const id of ['#rMc', '#rBtns1', '#rBtns2', '#bMore']) $(id).classList.add('on') })
}
function finishReveal() { if (S.mode !== 'result') return; S.resT = Math.max(S.resT, 4.2); updateReveal(0) }
// ---------- 結果カード画像
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath() }
function fitText(c, s, maxW, size, font, wt = '') { let f = size; c.font = `${wt}${f}px ${font}`; while (c.measureText(s).width > maxW && f > 14) { f -= 2; c.font = `${wt}${f}px ${font}` } return f }
function drawCard() {
  const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d')
  const T = TT(), r = S.result, L = S.lang, disp = '"Dela Gothic One", "Hiragino Sans", sans-serif', round = '"Zen Maru Gothic", "Hiragino Maru Gothic ProN", sans-serif', hd = L === 'ja' ? round : disp, hw = L === 'ja' ? '900 ' : ''
  const bold = (s, maxW, size, font) => { fitText(x, s, maxW, size, font); x.font = x.font.replace(/^(\d+px)/, '900 $1') }
  x.fillStyle = r.rank.col; x.fillRect(0, 0, W, H)
  x.fillStyle = 'rgba(255,255,255,.08)'; for (let i = -H; i < W; i += 60) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 30, 0); x.lineTo(i + 30 + H, H); x.lineTo(i + H, H); x.fill() }
  roundRect(x, 50, 50, W - 100, H - 100, 44); x.fillStyle = '#fff8ec'; x.fill(); x.lineWidth = 10; x.strokeStyle = '#1b1620'; x.stroke()
  x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#1b1620'
  fitText(x, T.cardTitle, W - 200, 70, hd, hw); x.fillText(T.cardTitle, W / 2, 155)
  x.font = `30px ${disp}`; x.fillStyle = r.rank.col; x.fillText(T.cardSub, W / 2, 198)
  const ph = $('#rPhoto'), px = 110, py = 232, ps = 400
  x.save(); roundRect(x, px, py, ps, ps, 30); x.clip(); x.drawImage(ph, px, py, ps, ps); x.restore()
  roundRect(x, px, py, ps, ps, 30); x.lineWidth = 8; x.strokeStyle = '#1b1620'; x.stroke()
  x.save(); x.translate(px + 18, py + 78); x.rotate(-0.1); x.textAlign = 'left'; x.font = `60px ${disp}`; x.lineWidth = 14; x.strokeStyle = '#1b1620'; x.lineJoin = 'round'; x.strokeText(T.cardFx, 0, 0); x.fillStyle = '#ff3d2e'; x.fillText(T.cardFx, 0, 0); x.restore()
  // 大見出し: 点数
  x.fillStyle = '#1b1620'; x.font = `900 34px ${round}`; x.fillText(T.cardTop, 760, 300)
  { let f = 170, nw, pw; const num = String(r.score)
    for (;;) { x.font = `${f}px ${disp}`; nw = x.measureText(num).width; x.font = `${f * 0.32}px ${disp}`; pw = x.measureText(T.scoreU).width; if (nw + pw + 8 <= 420 || f <= 70) break; f -= 6 }
    const sx = 765 - (nw + pw + 8) / 2; x.textAlign = 'left'; x.fillStyle = '#ff3d2e'; x.font = `${f}px ${disp}`; x.fillText(num, sx, 470); x.font = `${f * 0.32}px ${disp}`; x.fillText(T.scoreU, sx + nw + 8, 470); x.textAlign = 'center' }
  // 何階まで行けたか（添える）
  const ft = r.roof ? T.floorTop : T.floorTo.replace('{F}', r.floor); x.fillStyle = '#1b1620'; bold(ft, 380, 36, round); x.fillText(ft, 765, 530)
  x.save(); x.translate(482, 566); x.rotate(-0.25); x.beginPath(); x.arc(0, 0, 66, 0, 7); x.fillStyle = 'rgba(255,248,236,.9)'; x.fill(); x.lineWidth = 9; x.strokeStyle = '#ff3d2e'; x.stroke(); x.fillStyle = '#ff3d2e'; x.textBaseline = 'middle'
  const sl = r.rank.st[L].split('\n'); x.font = `${hw}${sl.length > 1 ? 36 : 48}px ${hd}`; sl.forEach((s, i) => x.fillText(s, 0, (i - (sl.length - 1) / 2) * 40)); x.restore(); x.textBaseline = 'alphabetic'
  x.fillStyle = r.rank.col; fitText(x, r.rank.t[L], W - 200, 62, hd, hw); x.fillText(r.rank.t[L], W / 2, 705)
  roundRect(x, 110, 735, W - 220, 190, 26); x.fillStyle = '#1b1620'; x.fill()
  x.fillStyle = '#ffd21f'; x.font = `900 30px ${round}`; x.fillText(T.maxDb, W / 2, 782)
  x.fillStyle = '#fff8ec'; x.font = `96px ${disp}`; x.fillText(r.db ? r.db.toFixed(1) + ' dB' : '-', W / 2, 874)
  const cmp = r.db ? `${r.cmp.t[L]} / ${T.reach.replace('{R}', reachText(r.db))}` : ''; bold(cmp, W - 280, 28, round); x.fillText(cmp, W / 2, 912)
  // バレずに・バレた・なすりつけ
  statText(r).forEach(([a, b], i) => {
    const bw = (W - 260) / 3, bx = 110 + i * (bw + 20), by = 950
    roundRect(x, bx, by, bw, 120, 20); x.fillStyle = i === 1 && r.bad ? '#ffe1dc' : '#fff'; x.fill(); x.lineWidth = 5; x.strokeStyle = '#1b1620'; x.stroke()
    x.fillStyle = '#1b1620'; bold(a, bw - 30, 28, round); x.fillText(a, bx + bw / 2, by + 44); fitText(x, b, bw - 24, 44, hd, hw); x.fillText(b, bx + bw / 2, by + 98)
  })
  // 今日の乗客・被害者
  const [pa, pb] = paxText(r)
  x.fillStyle = '#1b1620'; bold(pa, W - 240, 28, round); x.fillText(pa, W / 2, 1130)
  x.fillStyle = '#a8170d'; fitText(x, pb, W - 240, 34, hd, hw); x.fillText(pb, W / 2, 1182)
  x.fillStyle = '#1b1620'; x.font = `900 28px ${round}`; x.fillText(T.cardFoot, W / 2, 1262)
  return c
}
function loadFonts(text) { if (!document.fonts || !document.fonts.load) return Promise.resolve(); return Promise.all(['"Dela Gothic One"', '900 10px "Zen Maru Gothic"'].map(f => document.fonts.load((f.includes('10px') ? f : '40px ' + f), text).catch(() => {}))) }
function cardText() { const T = TT(), r = S.result, L = S.lang; return [T.cardTitle, T.cardSub, T.cardFx, T.cardTop, T.scoreU, T.floorTo, r.rank.t[L], r.rank.st[L], T.maxDb, r.cmp.t[L], T.reach, T.cardFoot, ...statText(r).flat(), ...paxText(r), '0123456789.%dBkm'].join('') }
async function cardURL() { await loadFonts(cardText()); return drawCard().toDataURL('image/png') }
const PUBLIC_URL = 'https://tom3games.github.io/elevator-fart/'
function shareText() { const r = S.result, T = TT(); return T.share.replace('{P}', r.score).replace('{F}', r.floor).replace('{N}', r.n).replace('{R}', r.rank.t[S.lang]).replace('{D}', (r.db || 0).toFixed(1)) }
function xPost() { const text = shareText(); return { text, url: PUBLIC_URL, href: `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(PUBLIC_URL)}` } }
function openX() { if (!S.result) return; Snd.sfx('tap'); window.open(xPost().href, '_blank', 'noopener') }
async function saveCard() {
  Snd.sfx('tap'); await loadFonts(cardText())
  const c = drawCard(), blob = await new Promise(r => c.toBlob(r, 'image/png'))
  if (!blob) return
  try {
    const file = new File([blob], 'elevator-fart.png', { type: 'image/png' })
    if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: shareText() + ' ' + PUBLIC_URL }); return }
  } catch (e) { if (e && e.name === 'AbortError') return }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'elevator-fart.png'; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
// ---------- 見た目の更新（毎フレーム）
const _c = new THREE.Color()
function updatePlayer(dt) {
  const t = S.time, sn = S.snz, hold = S.holding && S.mode === 'play'
  const itch = S.gauge, strain = hold ? S.strain : S.strain * 0.6, flush = S.flush
  let pitch = 0.12 * itch * (hold ? 0.5 : 1) + Math.sin(t * (3 + 6 * itch)) * 0.03 * itch
  let eyeOpen = (1 - 0.4 * itch) * (hold ? 1 - 0.85 * strain : 1), squeeze = hold && strain > 0.5
  let mx = 0.7 + 0.2 * itch, my = 0.3 + 0.6 * itch, lips = hold, smile = false, pupilS = 1
  let browA = hold ? strain * 0.45 : 0.25 * itch, browY = 0.02 * itch
  if (sn) {
    if (!sn.impact || sn.t < PRE) { pitch = lerp(pitch, 0.2, ease(sn.t / PRE)); squeeze = true; lips = true }
    else { const k = sn.t - PRE; squeeze = k < 0.35; eyeOpen = k < 0.35 ? 1 : 1.25; mx = 0.9; my = k < 0.5 ? 1.2 : 0.6; lips = false; pitch = k < 0.1 ? -0.15 : lerp(-0.15, 0, ease((k - 0.1) / 0.6)) }
  }
  if (!sn && S.relief > 0) { eyeOpen = 0.12; smile = true; browA = -0.1; my = 0 }
  if (!sn && S.shame > 0) { eyeOpen = 1.3; pupilS = 0.5; squeeze = false; mx = 0.5; my = 0.55; browA = -0.4; browY = 0.04 }
  if (S.mode === 'result') {
    if (S.mood === 'proud') { eyeOpen = 0.15; smile = true; browA = 0.15; pitch = -0.12; my = 0 } else { eyeOpen = 1.25; pupilS = 0.5; mx = 0.5; my = 0.5; browA = -0.4 }
    squeeze = false; lips = false
  }
  P.pivot.rotation.x = lerp(P.pivot.rotation.x, pitch, sn ? 0.6 : 0.2)
  // おならの瞬間に体がはねる・おしりが震える
  const hop = S.hop, hk = Math.sin(hop * Math.PI)
  if (S.mode !== 'kicked') P.root.position.y = Math.max(0, hk * 0.09 * (hop > 0 ? 1 : 0))
  P.hips.position.x = Math.sin(t * 60) * 0.012 * hop
  P.torso.rotation.z = Math.sin(t * 40) * 0.05 * hop
  const knock = hold ? strain * 0.25 : 0
  P.hips.children[0].rotation.z = knock; P.hips.children[2].rotation.z = -knock // 内股で耐える
  const trem = hold ? strain * strain * 0.012 : 0
  P.head.position.set((Math.random() - 0.5) * trem, 0.24 + (Math.random() - 0.5) * trem, 0)
  P.head.rotation.z = Math.sin(t * 2.1) * 0.03 + (S.mode === 'result' && S.mood === 'proud' ? 0.12 : 0)
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1
    P.eyes[i].visible = !squeeze; P.squint[i].visible = squeeze
    P.eyes[i].scale.set(1, clamp(eyeOpen, 0.08, 1.4), 1)
    P.pupils[i].scale.set(0.03 * pupilS, 0.033 * pupilS, 0.014)
    P.brows[i].rotation.z = s * browA; P.brows[i].position.y = 0.14 + browY
    const puff = 1 + (hold ? 0.9 * strain : 0)
    P.cheeks[i].scale.set(0.052 * puff, 0.034 * puff, 0.016 * puff)
    P.cheeks[i].material.color.setHex(flush > 0.3 || S.shame > 0 ? 0xff4a4a : 0xff9a9a); P.cheeks[i].material.opacity = 0.45 + 0.5 * Math.max(flush, S.shame > 0 ? 0.8 : 0)
    P.drops[i].visible = flush > 0.45 || S.shame > 0; P.drops[i].position.y = 0.1 - ((t * 0.5 + i * 0.5) % 1) * 0.16
    P.arms[i].rotation.x = hold ? -0.35 * strain : 0 // 我慢中はおなかを押さえる
    P.arms[i].rotation.z = s * (hold ? 0.1 + 0.25 * strain : 0.1)
  }
  P.mouth.visible = !lips && !smile && my > 0.05; P.lips.visible = lips; P.smile.visible = smile
  P.mouth.scale.set(0.06 * mx, 0.03 * my, 0.02)
  P.lips.scale.set(0.11 * (1 + 0.25 * strain), 0.018, 0.02)
  const fk = Math.pow(flush, 1.2)
  _c.lerpColors(SKIN, RED, fk); if (flush > 0.85) _c.lerp(GREEN, (flush - 0.85) / 0.15 * (0.5 + 0.5 * Math.sin(t * 20)) * 0.5)
  P.skin.color.copy(_c)
  P.vein.visible = flush > 0.7; P.vein.scale.setScalar(1 + 0.3 * Math.sin(t * 16))
  P.ahoge.rotation.z = Math.sin(t * 9) * 0.25 * (0.3 + itch)
}
function updateNPCs(dt) {
  const hp = P.head.getWorldPosition(new THREE.Vector3())
  const act = S.evs.find(e => (e.ph === 'warn' && e.k > 0.55) || e.ph === 'peak' || (e.ph === 'tail' && e.k < 0.6))
  for (const p of S.pax) {
    const n = p.n; n.phase += dt
    if (n.reactT !== undefined && n.reactT >= 0) {
      n.reactT -= dt
      if (n.reactT < 0) { n.reacting = n.reactUntil; npcMark(n, n.reactKind); n.reactT = undefined; n.tEye = n.reactKind === '!' ? 1.6 : 1.2 }
    }
    if (p.state !== 'idle') { npcIdle(n) }
    else if (n.reacting > 0) { n.reacting -= dt; if (n.lookP) npcLook(n, n.lookP, 1); else npcLook(n, hp, n.reactKind === '!' ? 1 : 0.6); if (n.reacting <= 0) { n.lookP = null; npcIdle(n) } }
    else if (n.denyT > 0) { n.denyT -= dt; n.tYaw = Math.sin(n.phase * 26) * 0.45; n.tPitch = 0.05; n.tEye = 1.5 }
    // 犯人探し: 疑っている人は相手をじっと見る（目を細める）。疑われた人は目を丸くする
    else if (S.mode === 'play' && S.hunt && n.gaze === 1) { if (S.hunt.to === 'me') npcLook(n, hp, 1); else if (S.hunt.to) npcLook(n, npcHeadPos(S.hunt.to.n, new THREE.Vector3()), 1); else { n.tYaw = Math.sin(n.phase * 2) * 0.8; n.tPitch = 0 } n.tEye = 0.45 }
    else if (S.mode === 'play' && S.hunt && n.gaze === 2) { npcLook(n, npcHeadPos(S.hunt.from.n, new THREE.Vector3()), 1); n.tEye = 1.45 }
    else if (n.sniffT > 0) { n.sniffT -= dt; n.tYaw = Math.sin(n.phase * 2.2) * 0.7; n.tPitch = -0.25 + Math.sin(n.phase * 18) * 0.06; n.tEye = 0.8 }
    else if (act && S.mode === 'play' && act.src !== p) { npcLook(n, lookAtOf(act), 0.9); n.tEye = act.ph === 'peak' ? 1.25 : 1 }
    // 犯人探しの間、ほかの人はキョロキョロ見守る
    else if (S.mode === 'play' && S.hunt) { n.tYaw = Math.sin(n.phase * 1.7 + p.slot) * 0.9; n.tPitch = -0.05; n.tEye = 0.7 }
    // ざわざわ: 顔を見合わせてひそひそ・鼻をつまむ・くんくん
    else if (S.mode === 'play' && S.air >= 1 && n.talkT > 0 && n.talkTo) { npcLook(n, npcHeadPos(n.talkTo, new THREE.Vector3()), 1); n.tEye = 0.8 }
    else if (S.mode === 'play' && S.air >= 1 && n.pinchT > 0) { n.tYaw = Math.sin(n.phase * 0.8) * 0.2; n.tPitch = -0.1; n.tEye = 0.35 }
    else if (S.mode === 'play' && S.air >= 1) { n.tYaw = Math.sin(n.phase * 0.7 + p.slot) * 0.5; n.tPitch = -0.28 + Math.sin(n.phase * 18) * 0.07; n.tEye = 0.7 }
    else if (S.mode === 'play' && S.smell > 0.25 && Math.sin(n.phase * 0.9 + p.slot) > 0.4) { n.tYaw = Math.sin(n.phase * 0.7) * 0.3; n.tPitch = -0.2 + Math.sin(n.phase * 18) * 0.05; n.tEye = 0.9 }
    else npcIdle(n)
    if (n.talkT > 0) n.talkT -= dt; if (n.pinchT > 0) n.pinchT -= dt
    n.pinchH.visible = S.mode === 'play' && S.air >= 1 && n.pinchT > 0 && !n.dogG
    if (S.mode === 'result' && S.mood === 'shame') { npcLook(n, hp, 0.8); n.tEye = 1.3 }
    const sp = n.reacting > 0 ? 14 : 6
    n.yaw += (n.tYaw - n.yaw) * Math.min(1, dt * sp); n.pitch += (n.tPitch - n.pitch) * Math.min(1, dt * sp); n.eye += (n.tEye - n.eye) * Math.min(1, dt * 10)
    // 音の主の動き
    const ev = S.evs.find(e => e.src === p && (e.ph === 'warn' || e.ph === 'peak' || e.ph === 'tail'))
    let roll = 0, extraPitch = 0, bounce = n.bounce ? Math.abs(Math.sin(S.time * 12 + n.phase)) * 0.04 * n.bounce : 0
    if (ev) {
      const pk = ev.ph === 'peak' ? 1 : ev.ph === 'warn' ? ev.k * 0.4 : 0.3
      if (ev.type === 'laugh') { extraPitch = ev.ph === 'peak' ? -0.45 + Math.sin(S.time * 30) * 0.08 : 0; roll = 0 }
      if (ev.type === 'giggle' || ev.type === 'phone') roll = Math.sin(S.time * 40) * 0.08 * pk
      if (ev.type === 'music') { extraPitch = Math.sin(S.time * 16) * 0.2 * (0.3 + pk); bounce += Math.abs(Math.sin(S.time * 16)) * 0.04 * pk }
      if (ev.type === 'baby' && n.babyHead) n.babyHead.rotation.z = Math.sin(S.time * 30) * 0.3 * pk
      if (ev.type === 'bark' && n.dogG) { n.dogG.position.y = Math.abs(Math.sin(S.time * 18)) * 0.06 * pk; n.dogHead.rotation.x = -0.3 * pk }
    } else { if (n.babyHead) n.babyHead.rotation.z = Math.sin(n.phase) * 0.1; if (n.dogG) { n.dogG.position.y = 0; n.dogHead.rotation.x = 0 } }
    if (n.type === 'headphone' && !ev) extraPitch = Math.sin(S.time * 9) * 0.08
    if (n.dogTail) n.dogTail.rotation.y = Math.sin(S.time * 14) * 0.6
    if (n.boxes) { const fall = ev && ev.type === 'cart' && ev.ph !== 'warn'; n.boxes.forEach((b, i) => { if (fall) { b.rotation.z = lerp(b.rotation.z, (i % 2 ? 1 : -1) * (0.4 + i * 0.3), 0.2); b.position.x = lerp(b.position.x, (i % 2 ? 1 : -1) * 0.12 * i, 0.2) } else if (ev && ev.ph === 'warn') b.rotation.z = Math.sin(S.time * 10 + i) * 0.08 * ev.k * i; else { b.rotation.z *= 0.9; b.position.x *= 0.9 } }) }
    if (n.aura) n.aura.forEach((sp, i) => { const a = n.phase * 0.8 + i; sp.position.set(Math.cos(a) * 0.32, n.seat + 0.2 + ((n.phase * 0.3 + i / 6) % 1) * 0.7, Math.sin(a) * 0.25); sp.material.opacity = 0.6 * Math.sin(((n.phase * 0.3 + i / 6) % 1) * Math.PI) })
    n.pivot.rotation.set(n.pitch + extraPitch + Math.sin(n.phase * 1.3) * 0.02, n.yaw * 0.75, roll); n.body.rotation.y = n.yaw * 0.25
    n.g.position.y = bounce
    for (const e of n.eyes) e.scale.setScalar(n.eye)
    for (const q of n.pupils) q.scale.set(0.022 / Math.max(1, n.eye * 0.9), 0.024 / Math.max(1, n.eye * 0.9), 0.01)
    n.mouth.scale.set(0.06 * (n.eye > 1.3 ? 0.5 : 1), 0.014 * (n.eye > 1.3 ? 3 : ev && ev.ph === 'peak' ? 4 : 1), 0.012)
    if (n.markT >= 0) { n.markT += dt; const k = n.markT, s = k < 0.12 ? k / 0.12 * 0.42 : k < 0.2 ? 0.42 - (k - 0.12) * 1.2 : k < 1.6 ? 0.32 : Math.max(0, 0.32 - (k - 1.6) * 1.5); n.mark.scale.setScalar(s / n.g.scale.x); if (s <= 0 && k > 1.6) n.markT = -1 }
  }
}
function updateFlyers(dt) {
  for (const f of flyers) {
    f.t += dt; if (f.rest) continue
    f.v.y -= 9.8 * dt; f.m.position.addScaledVector(f.v, dt); f.m.rotation.x += f.av.x * dt; f.m.rotation.y += f.av.y * dt; f.m.rotation.z += f.av.z * dt
    if (f.m.position.z > CAR.zf - 0.2) { f.m.position.z = CAR.zf - 0.2; f.v.z *= -0.4 }
    if (Math.abs(f.m.position.x) > CAR.x - 0.1) { f.m.position.x = Math.sign(f.m.position.x) * (CAR.x - 0.1); f.v.x *= -0.4 }
    if (f.m.position.y < f.floor) { f.m.position.y = f.floor; f.v.y *= -0.35; f.v.x *= 0.6; f.v.z *= 0.6; f.av.multiplyScalar(0.5); if (Math.abs(f.v.y) < 0.4) f.rest = true }
  }
  if (P.glasses.parent !== P.head && S.shame <= 0.15 && S.mode !== 'result') { const i = flyers.findIndex(f => f.m === P.glasses); if (i >= 0) flyers.splice(i, 1); reattachGlasses(); if (S.mode === 'play') Snd.sfx('pop') }
  // 匂いのモヤ: たまっている間は主役の後ろと横にもくもくが湧いて、うねりながら漂う
  const sm = Math.min(1, S.smell), amb = moyaP.filter(p => p.amb).length, want = Math.round(sm * 16)
  ambT -= dt
  if (sm > 0.06 && amb < want && ambT <= 0) {
    ambT = 0.12; const a = -0.42 * Math.PI + VR() * 1.84 * Math.PI, r = 0.3 + VR() * (0.25 + 0.45 * sm)
    moyaAdd({ amb: true, p: new THREE.Vector3(P.root.position.x + Math.cos(a) * r, 0.35 + VR() * 0.55, P.root.position.z - 0.15 - Math.sin(a) * r * 0.8), v: new THREE.Vector3((VR() - 0.5) * 0.12, 0.12 + VR() * 0.12, -0.04 - VR() * 0.08), s: 0.14 + VR() * 0.14 * (0.6 + sm), g: 0.12, life: 2.4 + VR() * 1.6 })
  }
  const q = new THREE.Quaternion(), qz = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1), sc = new THREE.Vector3(), m4 = new THREE.Matrix4(), col = new THREE.Color(); let n = 0
  for (let i = moyaP.length - 1; i >= 0; i--) {
    const p = moyaP[i]; p.t += dt
    if (p.amb && sm < 0.04 && !p.fading && p.life - p.t > 0.45) { p.life = p.t + 0.45; p.fading = true }
    if (p.t > p.life) { moyaP.splice(i, 1); continue }
    p.v.multiplyScalar(1 - (p.amb ? 0.4 : 1.8) * dt); p.v.y += (p.amb ? 0.02 : 0.2) * dt; p.p.addScaledVector(p.v, dt); p.s *= 1 + p.g * dt; p.rot += p.vr * dt
    const pop = Math.min(ease(p.t / 0.22), ease((p.life - p.t) / 0.45)), w = S.time * p.wob + p.ph
    qz.setFromAxisAngle(Z, p.rot + Math.sin(w * 0.5) * 0.35); q.copy(camera.quaternion).multiply(qz)
    sc.set(p.s * pop * (1 + 0.14 * Math.sin(w)), p.s * pop * (1 + 0.14 * Math.cos(w * 1.17)), 1)
    m4.compose(p.p, q, sc); moya.setMatrixAt(n, m4); moya.setColorAt(n, col.setHex(p.tint)); n++
  }
  moya.count = n; moya.instanceMatrix.needsUpdate = true; if (moya.instanceColor) moya.instanceColor.needsUpdate = true
  // 〜〜の線は匂いが濃い時だけ、ふくらんで上って消える
  let ln = 0
  if (sm > 0.25) for (const l of lineP) {
    const k = (S.time * 0.3 + l.ph) % 1, a = l.a + S.time * 0.25, r = l.r + 0.35 * sm
    const pop = Math.sin(k * Math.PI) * clamp((sm - 0.25) * 2.5, 0, 1); if (pop < 0.05) continue
    _q.set(P.root.position.x + Math.cos(a) * r, 0.75 + k * 1.0, P.root.position.z - 0.25 - Math.abs(Math.sin(a)) * r * 0.7)
    sc.set(0.13 * pop, 0.27 * pop, 1); m4.compose(_q, camera.quaternion, sc); lines.setMatrixAt(ln++, m4)
  }
  lines.count = ln; lines.instanceMatrix.needsUpdate = true
  // ドアからの風
  for (const w of winds) { w.z -= dt * 6; if (w.z < CAR.zb + 0.3) w.z = CAR.zf - 0.1; w.m.position.set(w.x, w.y, w.z); w.m.material.opacity = 0.5 * S.door }
}
// カメラ（縦画面と横画面で寄り方を変える）
const camBase = { d: 1.7, fov: 46, ly: 0.12, lx: 0, h: 0.12, x: 0.32 }
function frameCamera() {
  const a = innerWidth / innerHeight
  if (a < 0.62) Object.assign(camBase, { d: 3.1, fov: 60, ly: -0.28, lx: -0.05, h: 0.32, x: 0.45 })
  else if (a < 1) Object.assign(camBase, { d: 3.0, fov: 54, ly: -0.22, lx: -0.04, h: 0.3, x: 0.45 })
  else if (a < 1.9) Object.assign(camBase, { d: 2.9, fov: 48, ly: -0.1, lx: 0.35, h: 0.18, x: 0.45 })
  else Object.assign(camBase, { d: 2.8, fov: 46, ly: -0.1, lx: 0.45, h: 0.16, x: 0.5 })
  camera.fov = camBase.fov; camera.aspect = a; camera.updateProjectionMatrix()
}
const _hc = new THREE.Vector3(), _look = new THREE.Vector3()
function updateCamera(dt) {
  const hy = 1.62
  let d = camBase.d, ox = camBase.x, oy = camBase.h, lx = camBase.lx, ly = camBase.ly
  if (S.mode === 'title' || S.mode === 'how') { ox += Math.sin(S.time * 0.3) * 0.12; d += 0.1 }
  if (S.mode === 'result') { d *= S.mood === 'shame' ? 1.1 : 0.85; lx -= 0.05; ly += innerWidth / innerHeight < 1 ? 0.2 : 0.05 }
  if (S.punch >= 0) {
    S.punch += dt; const k = S.punch
    const z = k < 0.2 ? lerp(1, 0.72, ease(k / 0.2)) : k < 0.55 ? 0.72 : k < 0.95 ? lerp(0.72, 1.1, ease((k - 0.55) / 0.4)) : k < 2.0 ? 1.1 : lerp(1.1, 1, ease((k - 2.0) / 0.6))
    d *= z; oy += (z - 1) * 0.3
    if (k > 2.6) S.punch = -1
  }
  d = Math.min(d, CAR.zf - 0.15)
  const sh = S.shake + (S.level > 0.9 ? 0.008 : 0) + (S.flicker || 0) * 0.01
  _hc.set(ox + (Math.random() - 0.5) * sh, hy + oy + (Math.random() - 0.5) * sh, d)
  camera.position.lerp(_hc, S.punch >= 0 ? 0.35 : Math.min(1, dt * 6))
  _look.set(lx, hy + ly - 0.05, 0); camera.lookAt(_look)
}
let winT = 0, indT = 0
function updateScene(dt) {
  // 揺れの予告で明かりがちらつく・チャイムの前に到着ランプ
  const sk = activeEv('shake'); S.flicker = sk && sk.ph === 'warn' ? (Math.sin(S.time * 37) > 0.6 ? sk.k : 0) : sk && sk.ph === 'peak' ? 1 : 0
  hemi.intensity = 1.9 - 0.9 * (S.flicker || 0); sun.intensity = 1.3 - 0.6 * (S.flicker || 0)
  evLight.color.setHex(0xfff2c0); evLight.position.set(0, 1.6, CAR.zf - 0.3); evLight.intensity = S.door * 2.2
  const ch = activeEv('chime'), blink = ch && ch.ph === 'warn' && ch.k > 0.25 && Math.floor(S.time * 6) % 2 === 0
  lamp.material.color.setHex(ch && (ch.ph === 'warn' || ch.ph === 'peak') ? 0xffa020 : 0x553311)
  const hk = ch && ch.ph === 'warn' ? ch.k : ch && ch.ph === 'peak' ? 1 : 0, hb = 0.5 + 0.5 * Math.sin(S.time * (8 + 22 * hk))
  if (!halo.material.map) { halo.material.map = puffTex; halo.material.needsUpdate = true } halo.material.opacity = hk ? (0.35 + 0.5 * hb) * Math.min(1, hk * 2) : 0; halo.scale.setScalar(0.5 + 1.1 * hk)
  // 監視カメラの赤いランプ（1.2秒ごとに短く点く）
  const led = (S.time % 1.2) < 0.18; camLed.material.color.setHex(led ? 0xff2a1a : 0x3a0000)
  if (!camGlow.material.map) { camGlow.material.map = puffTex; camGlow.material.needsUpdate = true } camGlow.material.opacity = led ? 0.9 : 0
  car.rotation.z = sk && sk.ph === 'peak' ? Math.sin(S.time * 50) * 0.01 : 0
  winT += dt; indT += dt
  if (winT > 1 / 30) { winT = 0; const { ctx, c } = mirTex.userData; paintMirror(ctx, c.width, c.height); mirTex.needsUpdate = true }
  if (indT > 1 / 12) { indT = 0; drawInd(blink) }
  updatePlayer(dt); updateNPCs(dt); updateFlyers(dt); updateCamera(dt); updateGaze()
}

// ---------- HUD（バー・メーターは置かない。点数ひとつ・ハート・おならボタンだけ）
const hud = { score: $('#hScore'), lives: [...document.querySelectorAll('#hLives i')], chip: $('.stChip'), flash: $('#flash'), blame: $('#bBlame'), fb: Object.fromEntries(FIDS.map(k => [k, $('#f_' + k)])) }
let lastScore = -1, lastLives = -1
function updateHud() {
  if (S.mode !== 'play' && S.mode !== 'count' && S.mode !== 'intro' && S.mode !== 'kicked') return
  const T = TT()
  if (S.score !== lastScore) { lastScore = S.score; hud.score.innerHTML = S.lang === 'ja' ? `${S.score}<small>点</small>` : `${S.score}<small> pts</small>` }
  if (S.lives !== lastLives) { lastLives = S.lives; hud.lives.forEach((h, i) => h.classList.toggle('off', i >= S.lives)) }
  hud.chip.classList.toggle('hit', S.lifeT >= 0)
  // 大きな音の瞬間は画面のふちが光る
  const pk = S.evs.some(e => e.ph === 'peak')
  hud.flash.className = pk ? 'now' : ''
  // おならボタン: 溜まり直しはボタン自体が下から満ちていく見た目。かき消せる時は光る
  for (const k of FIDS) {
    const b = hud.fb[k], f = FT[k], c = S.cd ? S.cd[k] / f.cd : 0
    b.style.setProperty('--cd', c.toFixed(3))
    b.classList.toggle('wait', c > 0); b.classList.toggle('go', S.mode === 'play' && c <= 0 && f.need >= 0 && okNow(k))
    b.disabled = S.mode !== 'play' || c > 0
  }
  const show = canRuse() && pinch()
  if (hud.blame.hidden === show) { hud.blame.hidden = !show; if (show) Snd.sfx('pop') }
  hud.blame.querySelector('.rn').textContent = S.ruseLeft.blame ?? 0
}
// ---------- ループ（固定60Hz。performance.now で数える）
let acc = 0, last = performance.now(), frames = 0, fpsT = last
function step() { updateGame(STEP); updateScene(STEP); updateFx(STEP); if (S.doCap) render() }
function render() {
  renderer.render(scene, camera)
  if (S.doCap) { S.doCap = false; capture() }
}
function capture() {
  const p = P.head.getWorldPosition(new THREE.Vector3()); p.y -= 0.04
  const s = toScreen(p), top = toScreen(p.clone().add(new THREE.Vector3(0, 0.36, 0)))
  const r = Math.abs(s.y - top.y) * 1.25, sx = canvas.width / innerWidth
  const pc = $('#rPhoto').getContext('2d')
  try { pc.fillStyle = '#2a2233'; pc.fillRect(0, 0, 256, 256); pc.drawImage(canvas, (s.x - r) * sx, (s.y - r) * sx, 2 * r * sx, 2 * r * sx, 0, 0, 256, 256); S.photo = true } catch (e) {}
}
function loop() {
  requestAnimationFrame(loop)
  const now = performance.now(); let dt = (now - last) / 1000; last = now
  if (dt > 0.25) dt = 0.25
  if (!S.dbgPause) { acc += dt; let n = 0; while (acc >= STEP && n < 8) { step(); acc -= STEP; n++ } if (n >= 8) acc = 0 }
  updateHud(); render(); Snd.tick()
  frames++; if (now - fpsT >= 1000) { S.fps = Math.round(frames * 1000 / (now - fpsT)); frames = 0; fpsT = now }
}

// ---------- 入力（おならボタンをタップ。PC は 1・2・3 キーも）
for (const k of FIDS) $('#f_' + k).addEventListener('pointerdown', e => { e.preventDefault(); doFart(k) })
$('#bBlame').addEventListener('pointerdown', e => { e.preventDefault(); useRuse('blame') })
window.addEventListener('keydown', e => {
  if (e.repeat) return
  if ((e.code === 'Space' || e.code === 'Enter') && S.mode === 'intro') { e.preventDefault(); beginCount(); return }
  const map = { Digit1: 'suka', Digit2: 'pu', Digit3: 'bubo', Numpad1: 'suka', Numpad2: 'pu', Numpad3: 'bubo' }
  if (map[e.code]) doFart(map[e.code])
  if (e.code === 'KeyB' || e.code === 'Digit4') useRuse('blame')
})
$('#bStart').onclick = () => { Snd.init(); Snd.sfx('tap'); startRun() }
$('#bHow').onclick = () => { Snd.init(); Snd.sfx('tap'); S.mode = 'how'; show('vHow') }
$('#bHowBack').onclick = () => { Snd.sfx('tap'); S.mode = 'title'; show('vTitle') }
$('#bGo').onclick = () => beginCount()
$('#bAgain').onclick = () => { Snd.sfx('tap'); startRun() }
$('#bSave').onclick = () => saveCard()
$('#bX').onclick = () => openX()
$('#bTitle').onclick = () => toTitle()
// ほかのバカゲー（新しいタブで開く。サムネは開いた時に初めて読む）
const esc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
function fillMore() {
  const L = S.lang
  $('#moreL').innerHTML = D.others.map(g => `<a href="${esc(g.url)}" target="_blank" rel="noopener"><img src="${esc(g.url)}og.png" alt="" width="1200" height="630" decoding="async"><b>${esc(g[L])}</b><span>${esc(L === 'ja' ? g.dj : g.de)}</span></a>`).join('')
}
function openMore() { Snd.init(); Snd.sfx('tap'); fillMore(); $('#moreBox').hidden = false; $('#bMoreX').focus({ preventScroll: true }) }
function closeMore() { if ($('#moreBox').hidden) return; $('#moreBox').hidden = true; Snd.sfx('tap') }
$('#bMore').onclick = openMore
$('#bMoreT').onclick = openMore
$('#bMoreX').onclick = closeMore
$('#moreBox').addEventListener('click', e => { if (e.target === e.currentTarget) closeMore() })
window.addEventListener('keydown', e => { if (e.code === 'Escape') closeMore() })
$('#vResult').addEventListener('pointerdown', e => { if (!e.target.closest('button')) finishReveal() })
$('#bLang').onclick = () => { S.lang = S.lang === 'ja' ? 'en' : 'ja'; store.set('hs.lang', S.lang); applyLang(); Snd.sfx('tap') }
$('#bMute').onclick = () => { Snd.init(); Snd.setMute(!Snd.muted); syncMute() }
function syncMute() { $('#icOn').hidden = Snd.muted; $('#icOff').hidden = !Snd.muted }
function titleScene() { setStage('morning'); for (const t of ['coworker', 'madam', 'dog', 'headphone', 'bucho', 'nose']) addPax(t, false); P.root.position.set(0, 0, 0); P.root.rotation.y = 0 }
function toTitle() { Snd.sfx('tap'); S.mode = 'title'; S.later = []; clearFx(); S.evs = []; S.level = 0; S.stop = null; S.door = 0; $('#hint').hidden = true; titleScene(); show('vTitle'); Snd.setTrack('title') }
document.addEventListener('visibilitychange', () => { if (!Snd.ctx) return; if (document.hidden) Snd.ctx.suspend(); else Snd.ctx.resume() })
document.addEventListener('pointerdown', () => { if (!Snd.ctx) { Snd.init(); if (S.mode === 'title' || S.mode === 'how') Snd.setTrack('title') } }, { capture: true })
function resize() { renderer.setSize(innerWidth, innerHeight, false); frameCamera() }
window.addEventListener('resize', resize)

// ---------- 起動
resize(); applyLang(); syncMute(); titleScene(); Snd.want = 'title'
for (let i = 0; i < 30; i++) step()
camera.position.copy(_hc)
loop()
loadFonts('!?').then(() => { TEX_EX = exTex('!', '#ff3d2e'); TEX_Q = exTex('?', '#ffd21f') })

window.hs = {
  S, D, Snd, P, camera, renderer, SLOTS, CAR, FT, lampOn: () => lamp.material.color.getHex() !== 0x553311, newEvent, RP,
  start: startRun, beginCount, fart: doFart, canFart, okNow, toResult, finishReveal, toTitle, drawCard, xPost, openX, useRuse, smellBust, calcResult, pinch, gazedNow, nextGaze,
  level: () => S.level, aboard, sniffMult, coverNow, diff,
  interior: () => ({ id: cur.id, wall: wallTex.userData.key, rail: railM.color.getHex(), sky: hemi.color.getHex(), light: lightM.color.getHex() }),
  moyaN: () => moya.count, lineN: () => lines.count, ledOn: () => camLed.material.color.getHex() !== 0x3a0000,
  cardDataURL: cardURL,
  setLang(l) { S.lang = l; applyLang() },
  openMore, closeMore,
  dbg: {
    pause(b = true) { S.dbgPause = b; acc = 0; last = performance.now() },
    step(n = 1) { for (let i = 0; i < n; i++) step(); updateHud() },
    render() { updateHud(); render() },
    seed(n) { S.seed = n; S.rand = mulberry(n) },
    set(o) { Object.assign(S, o) },
    // 次の本物の大きな音の山まで進める（off=山の始まりからの秒）
    toPeak(off = 0.15) { let e, n = 0; while (S.mode === 'play' && n++ < 60 * 60) { e = S.evs.find(x => !x.fake && x.at + off > S.st); if (e) break; step() } while (e && S.mode === 'play' && S.st < e.at + off) step(); updateHud(); return e },
    floor(f) { S.floorF = f; S.floor = Math.floor(f) },
    addPax: (t, b) => addPax(t, b), clearPax,
    layout() {
      const v = new THREE.Vector3(), out = [{ k: 'player', x: P.root.position.x, z: P.root.position.z, r: 0.28 }]
      for (const p of S.pax) { if (p.state !== 'idle') continue; p.n.g.getWorldPosition(v); out.push({ k: p.type, x: v.x, z: v.z, r: 0.27 }); if (p.n.dogG) { p.n.dogG.getWorldPosition(v); out.push({ k: 'dog-animal', x: v.x, z: v.z, r: 0.15 }) } if (p.n.cartG) { p.n.cartG.getWorldPosition(v); out.push({ k: 'cart', x: v.x, z: v.z, r: 0.2 }) } }
      return out
    },
  },
}
window.__hsReady = true
