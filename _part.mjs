// verify.mjs のうち名前に合うテストだけ回す（開発中の部分確認用）: node _part.mjs <正規表現>
import { readFileSync, writeFileSync } from 'node:fs'
const src = readFileSync(new URL('./verify.mjs', import.meta.url), 'utf8'), re = new RegExp(process.argv[2])
const out = src.replace(/await t\((['`])(.*?)\1,/g, (m, q, name) => re.test(name) || /起動時/.test(name) ? m : `await (async()=>{})(${q}${name}${q},`)
  .replace(/^for \(const \[w, h, name0, en\] of .*$/m, m => process.env.FIT ? m : m.replace(/of \[.*\]\) \{/, 'of []) {'))
writeFileSync(new URL('./_part_run.mjs', import.meta.url), out)
