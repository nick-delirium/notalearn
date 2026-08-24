import { mount } from 'svelte'
import App from './App.svelte'
import { swUpdate } from './lib/swUpdate.svelte'
import './app.css'

const target = document.getElementById('app')
if (!target) throw new Error('#app root element not found')
mount(App, { target })

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void registerServiceWorker()
  })
}

async function registerServiceWorker(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker.register('sw.js')

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) {
          swUpdate.ready = true
        }
      })
    })

    // also catch a worker that finished installing before we subscribed
    if (reg.waiting && navigator.serviceWorker.controller) swUpdate.ready = true

    let reloading = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return
      reloading = true
      swUpdate.reloading = true
      location.reload()
    })

    // check for updates hourly
    setInterval(() => void reg.update().catch(() => {}), 60 * 60 * 1000)
  } catch {
    /* SW unavailable (e.g. plain http) — the app works without it */
  }
}

window.addEventListener('sw-reload', () => {
  void navigator.serviceWorker.getRegistration().then((reg) => {
    reg?.waiting?.postMessage('SKIP_WAITING')
  })
})
