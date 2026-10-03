#!/usr/bin/env node
/**
 * tools/browser.mjs — a tiny Chrome DevTools Protocol driver used to verify the
 * *interactive* behaviour of the site (typing in a search field, clicking a
 * result, reading back state). `--dump-dom` cannot do any of that.
 *
 * Uses Node 22's built-in global `WebSocket` and `fetch`: no npm dependencies.
 *
 *   node tools/browser.mjs <url> '<js expression>'          # navigate, evaluate, print
 *   node tools/browser.mjs --script <file.mjs>              # run a driver script
 *
 * A driver script exports `default async ({ page, log }) => { ... }`. `page`
 * exposes `goto`, `eval`, `type`, `click`, `waitFor`, `text`, `screenshot`.
 */

import { spawn } from 'node:child_process'
import { rmSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PORT = Number(process.env.CDP_PORT ?? 9333)
const CHROME = process.env.CHROME_BIN ?? '/usr/bin/google-chrome'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ */
/* Chrome lifecycle                                                    */
/* ------------------------------------------------------------------ */

async function launchChrome() {
  // Chrome insists on a writable HOME/XDG for its crash reporter and profile.
  const home = join(ROOT, '.cache', 'chrome-home')
  const profile = join(ROOT, '.cache', 'chrome-profile')
  mkdirSync(join(home, 'config'), { recursive: true })
  mkdirSync(join(home, 'cache'), { recursive: true })
  mkdirSync(profile, { recursive: true })

  const child = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--disable-crash-reporter',
      '--disable-dev-shm-usage',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--window-size=1440,1000',
      'about:blank',
    ],
    {
      env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, 'config'), XDG_CACHE_HOME: join(home, 'cache') },
      stdio: ['ignore', 'ignore', 'ignore'],
      detached: false,
    },
  )

  // Poll the DevTools endpoint until it answers.
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return child
    } catch {
      /* not up yet */
    }
    await sleep(150)
  }
  child.kill('SIGKILL')
  throw new Error('Chrome DevTools endpoint never came up')
}

/* ------------------------------------------------------------------ */
/* Minimal CDP client                                                  */
/* ------------------------------------------------------------------ */

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    this.events = []
    this.listeners = []
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined) {
        const resolver = this.pending.get(msg.id)
        if (resolver) {
          this.pending.delete(msg.id)
          msg.error ? resolver.reject(new Error(JSON.stringify(msg.error))) : resolver.resolve(msg.result)
        }
      } else {
        this.events.push(msg)
        for (const fn of this.listeners) fn(msg)
      }
    })
  }

  on(fn) {
    this.listeners.push(fn)
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id
    const payload = { id, method, params }
    if (sessionId) payload.sessionId = sessionId
    this.ws.send(JSON.stringify(payload))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.delete(id)) reject(new Error(`CDP timeout: ${method}`))
      }, 30_000)
    })
  }
}

/* ------------------------------------------------------------------ */
/* Page helper                                                         */
/* ------------------------------------------------------------------ */

function makePage(cdp, sessionId) {
  let errors = []

  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails?.exception?.description ?? 'exception')
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
    }
  })

  const send = (method, params) => cdp.send(method, params, sessionId)

  const page = {
    errors,
    clearErrors: () => {
      errors = []
      page.errors = errors
    },

    async goto(url, settle = 1800) {
      await send('Page.navigate', { url })
      await sleep(settle)
    },

    async eval(expression) {
      const res = await send('Runtime.evaluate', {
        expression: `(async () => { ${expression} })()`,
        awaitPromise: true,
        returnByValue: true,
      })
      if (res.exceptionDetails) {
        throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed')
      }
      return res.result.value
    },

    /** Focus an input by CSS selector and type into it via real key events. */
    async type(selector, text) {
      await page.eval(`
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) throw new Error('no element for ' + ${JSON.stringify(selector)});
        el.focus();
        return true;
      `)
      for (const ch of text) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch })
        await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch })
        await sleep(28)
      }
      await sleep(500)
    },

    /**
     * Dispatch a key. `vkey` is the Windows virtual key code (e.g. 75 for K),
     * which CDP requires as an int alongside the `code` string.
     */
    async press(key, code, vkey, modifiers = 0) {
      await send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key,
        code,
        modifiers,
        windowsVirtualKeyCode: vkey,
      })
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers, windowsVirtualKeyCode: vkey })
      await sleep(400)
    },

    /** Click the Nth element matching a selector (0-based). */
    async click(selector, index = 0) {
      const box = await page.eval(`
        const els = [...document.querySelectorAll(${JSON.stringify(selector)})];
        const el = els[${index}];
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, disabled: el.disabled ?? false };
      `)
      if (!box) throw new Error(`no element #${index} for ${selector}`)
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await sleep(600)
      return box
    },

    async waitFor(expression, timeout = 8000) {
      const deadline = Date.now() + timeout
      for (;;) {
        if (await page.eval(`return !!(${expression});`)) return true
        if (Date.now() > deadline) return false
        await sleep(200)
      }
    },

    text(selector) {
      return page.eval(`
        const el = document.querySelector(${JSON.stringify(selector)});
        return el ? el.innerText.replace(/\\s+/g, ' ').trim() : null;
      `)
    },
  }

  return page
}

/* ------------------------------------------------------------------ */
/* Runner                                                              */
/* ------------------------------------------------------------------ */

export async function withPage(fn) {
  const chrome = await launchChrome()
  let cdp
  try {
    const version = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()
    const ws = new WebSocket(version.webSocketDebuggerUrl)
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    cdp = new Cdp(ws)

    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
    await cdp.send('Page.enable', {}, sessionId)
    await cdp.send('Runtime.enable', {}, sessionId)

    const page = makePage(cdp, sessionId)
    return await fn(page, cdp)
  } finally {
    try {
      await cdp?.send('Browser.close')
    } catch {
      /* already gone */
    }
    await sleep(300)
    chrome.kill('SIGKILL')
  }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  const args = process.argv.slice(2)

  if (args[0] === '--script') {
    const mod = await import(pathToFileURL(args[1]).href)
    await withPage(async (page, cdp) => {
      await mod.default({ page, cdp, log: (...a) => console.log(...a) })
    })
  } else {
    const [url, expression] = args
    if (!url) {
      console.error("Usage: node tools/browser.mjs <url> '<js>' | --script <file>")
      process.exit(2)
    }
    await withPage(async (page) => {
      await page.goto(url)
      const value = expression
        ? await page.eval(`return (${expression});`)
        : await page.eval('return document.title;')
      console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
    })
  }

  // A stray temp dir can be left by Chrome's own crash handler; clean ours up.
  try {
    rmSync(join(ROOT, '.cache', 'crashpad'), { recursive: true, force: true })
  } catch {
    /* nothing to do */
  }
  process.exit(0)
}
