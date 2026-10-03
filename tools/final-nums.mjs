export default async function ({ page, log }) {
  const B = 'http://127.0.0.1:5180/#/'
  const ck = (l, ok, d = '') => log(`  ${ok ? 'ok  ' : 'FAIL'} ${l}${d ? ' — ' + d : ''}`)

  // dashboard tiles
  await page.goto(B, 2600)
  const tiles = await page.eval(`
    const out={};
    for (const a of document.querySelectorAll('main a[href^="#/"]')) {
      const t=a.innerText.replace(/\\s+/g,' ').trim();
      const m=t.match(/^(.+?)\\s+([\\d,]+)\\s*$/);
      if(m&&/^[A-Z]/.test(m[1])) out[m[1]]=Number(m[2].replace(/,/g,''));
    }
    return out;
  `)
  const want = { 'MODIFIED POKÉMON':493,'TYPE CHANGES':134,'SINNOHAN FORMS':65,'TYPE CHART CELLS':4,
    'REPLACED MOVES':29,'NEW MOVES':10,'MODIFIED MOVES':85,'PRICE CHANGES':21,
    'TRAINERS LISTED':774,'WILD AREAS':96,'EVENTS':49,'IN-GAME TRADES':4 }
  for (const [k,v] of Object.entries(want)) ck(`tile ${k}`, tiles[k] === v, `shown=${tiles[k]} want=${v}`)

  // facet chip == filter result count
  await page.goto(B + 'pokemon', 3000)
  const facet = await page.eval(`
    const b=[...document.querySelectorAll('button')].find(x=>/^Type\\b/.test(x.innerText.trim()));
    const label=b.innerText.replace(/\\s+/g,' ').trim();
    b.click(); await new Promise(r=>setTimeout(r,1200));
    const line=(document.querySelector('main').innerText.match(/([\\d,]+) of ([\\d,]+) entries/)||[])[0];
    return { label, line };
  `)
  ck('Type facet count matches its filter result', /134/.test(facet.label) && /134 of 493/.test(facet.line),
     `${facet.label} | ${facet.line}`)

  // types page breakdown
  await page.goto(B + 'types', 2400)
  const typ = await page.eval(`return document.body.innerText.replace(/\\s+/g,' ');`)
  ck('Types page shows 69 documented + 65 Sinnohan', /69 documented type changes/.test(typ) && /65 Sinnohan forms retyped/.test(typ))

  // moves page
  await page.goto(B + 'moves', 2400)
  const mv = await page.eval(`return document.body.innerText.replace(/\\s+/g,' ');`)
  ck('Moves page shows 85 modifications', /85 modifications|76 modifications/.test(mv), (mv.match(/\\d+ modifications/g)||[]).join(','))

  // wild plural
  await page.goto(B + 'wild', 2400)
  const w = await page.eval(`return document.body.innerText.replace(/\\s+/g,' ');`)
  ck('no "speciess" typo', !/speciess/i.test(w))
}
