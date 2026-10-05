import { afterEach, describe, expect, it, vi } from 'vitest'
import { onPushNotificationClick, pushConfigured, pushSupport, syncPush } from '@/lib/push'

describe('push', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is disabled without the public Firebase configuration, and never registers a device', async () => {
    expect(pushConfigured).toBe(false)
    expect(await pushSupport()).toBe('unconfigured')
    expect(await syncPush('customer', 1)).toBe(false)
  })

  it('only opens internal pages from a notification click', () => {
    const serviceWorker = new EventTarget()
    vi.stubGlobal('navigator', { ...navigator, serviceWorker })
    const open = vi.fn()
    const stop = onPushNotificationClick(open)

    const click = (link: unknown) => serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'routier237:open', link } }))
    click('/agency/reservations?search=R237-ABC')
    click('https://site-pirate.test')
    click('//site-pirate.test')
    serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'autre', link: '/account' } }))

    expect(open).toHaveBeenCalledTimes(1)
    expect(open).toHaveBeenCalledWith('/agency/reservations?search=R237-ABC')

    stop()
    click('/account')
    expect(open).toHaveBeenCalledTimes(1)
  })
})
