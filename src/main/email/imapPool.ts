import { ImapFlow } from 'imapflow'
import type { ImapConfig } from './imapClient'

// ─── Mutex ────────────────────────────────────────────────────────────────────
// Promise-chain mutex: acquire() returns a release function.
// Callers must always call release() (even on error) to avoid deadlock.

class Mutex {
  private _queue: Promise<void> = Promise.resolve()

  acquire(): Promise<() => void> {
    let release!: () => void
    const next = new Promise<void>((resolve) => {
      release = resolve
    })
    const ticket = this._queue.then(() => release)
    this._queue = this._queue.then(() => next)
    return ticket
  }
}

// ─── ImapAccountPool ──────────────────────────────────────────────────────────
// One persistent ImapFlow connection per account, serialised via mutex.

const IDLE_TIMEOUT_MS = 60_000

class ImapAccountPool {
  private _client: ImapFlow | null = null
  private _mutex = new Mutex()
  private _idleTimer: ReturnType<typeof setTimeout> | null = null

  private _clearIdleTimer(): void {
    if (this._idleTimer !== null) {
      clearTimeout(this._idleTimer)
      this._idleTimer = null
    }
  }

  private _resetIdleTimer(): void {
    this._clearIdleTimer()
    this._idleTimer = setTimeout(() => {
      console.log('[imapPool] Idle timeout — closing connection')
      this._disconnect()
    }, IDLE_TIMEOUT_MS)
  }

  private _createClient(config: ImapConfig): ImapFlow {
    const client = new ImapFlow({
      host: config.host,
      port: config.port,
      secure: config.port === 993,
      auth: { user: config.username, pass: config.password },
      logger: false,
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 90000
    })
    client.on('error', (err: Error) => {
      console.error('[imapPool] Connection error:', err.message)
      this._client = null
    })
    client.on('close', () => {
      if (this._client === client) this._client = null
    })
    return client
  }

  private async _ensureConnected(config: ImapConfig): Promise<ImapFlow> {
    if (this._client) return this._client
    console.log(`[imapPool] Connecting to ${config.host}...`)
    const client = this._createClient(config)
    await client.connect()
    this._client = client
    console.log(`[imapPool] Connected to ${config.host}`)
    return client
  }

  private async _disconnect(): Promise<void> {
    this._clearIdleTimer()
    const client = this._client
    this._client = null
    if (client) await client.logout().catch(() => {})
  }

  /**
   * Acquire the mutex, ensure the connection is alive, run fn(client),
   * then release. On any connection error, disconnect and retry once.
   */
  async run<T>(config: ImapConfig, fn: (client: ImapFlow) => Promise<T>): Promise<T> {
    const release = await this._mutex.acquire()
    try {
      this._clearIdleTimer()
      let client = await this._ensureConnected(config)
      try {
        return await fn(client)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const isConnErr = /connection closed|socket|timeout|ECONNRESET|ETIMEDOUT/i.test(msg)
        if (isConnErr) {
          console.warn('[imapPool] Retrying with fresh connection:', msg)
          await this._disconnect()
          client = await this._ensureConnected(config)
          return await fn(client)
        }
        throw err
      }
    } finally {
      this._resetIdleTimer()
      release()
    }
  }

  async close(): Promise<void> {
    const release = await this._mutex.acquire()
    try {
      await this._disconnect()
    } finally {
      release()
    }
  }
}

// ─── Pool registry ────────────────────────────────────────────────────────────

const pools = new Map<string, ImapAccountPool>()

export async function withAccountPool<T>(
  config: ImapConfig,
  accountId: string,
  fn: (client: ImapFlow) => Promise<T>
): Promise<T> {
  if (!pools.has(accountId)) {
    pools.set(accountId, new ImapAccountPool())
  }
  return pools.get(accountId)!.run(config, fn)
}

export async function closeAccountPool(accountId: string): Promise<void> {
  const pool = pools.get(accountId)
  pools.delete(accountId)
  if (pool) await pool.close()
}

export async function closeAllPools(): Promise<void> {
  const entries = [...pools.entries()]
  pools.clear()
  await Promise.allSettled(entries.map(([, pool]) => pool.close()))
}
