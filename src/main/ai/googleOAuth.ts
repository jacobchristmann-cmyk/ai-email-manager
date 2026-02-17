import { BrowserWindow } from 'electron'
import * as http from 'node:http'
import * as url from 'node:url'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/generative-language'

interface OAuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      if (addr && typeof addr === 'object') {
        const port = addr.port
        srv.close(() => resolve(port))
      } else {
        srv.close(() => reject(new Error('Could not find free port')))
      }
    })
    srv.on('error', reject)
  })
}

export async function startGoogleOAuth(
  clientId: string,
  clientSecret: string
): Promise<OAuthTokens> {
  const port = await findFreePort()
  const redirectUri = `http://127.0.0.1:${port}`

  return new Promise((resolve, reject) => {
    let server: http.Server | null = null
    let authWindow: BrowserWindow | null = null

    const cleanup = (): void => {
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.close()
      }
      authWindow = null
      if (server) {
        server.close()
        server = null
      }
    }

    server = http.createServer(async (req, res) => {
      try {
        const parsedUrl = url.parse(req.url || '', true)
        const code = parsedUrl.query.code as string | undefined
        const error = parsedUrl.query.error as string | undefined

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Anmeldung abgebrochen.</h2><p>Du kannst dieses Fenster schliessen.</p></body></html>')
          cleanup()
          reject(new Error(`Google OAuth abgebrochen: ${error}`))
          return
        }

        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Fehler: Kein Autorisierungscode erhalten.</h2></body></html>')
          return
        }

        // Exchange code for tokens
        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code'
          })
        })

        if (!tokenResponse.ok) {
          const text = await tokenResponse.text()
          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end('<html><body><h2>Fehler beim Token-Austausch.</h2></body></html>')
          cleanup()
          reject(new Error(`Token-Austausch fehlgeschlagen: ${text}`))
          return
        }

        const tokenData = (await tokenResponse.json()) as {
          access_token: string
          refresh_token?: string
          expires_in: number
        }

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html><body><h2>Anmeldung erfolgreich!</h2><p>Du kannst dieses Fenster schliessen.</p></body></html>')
        cleanup()

        resolve({
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token || '',
          expiresAt: Date.now() + tokenData.expires_in * 1000
        })
      } catch (err) {
        cleanup()
        reject(err)
      }
    })

    server.listen(port, '127.0.0.1', () => {
      const authUrl = new URL(GOOGLE_AUTH_URL)
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', SCOPE)
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')

      authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        title: 'Google Anmeldung',
        webPreferences: { nodeIntegration: false, contextIsolation: true }
      })

      authWindow.loadURL(authUrl.toString())

      authWindow.on('closed', () => {
        authWindow = null
        // If server still running, user closed the window without completing
        if (server) {
          cleanup()
          reject(new Error('Anmeldefenster wurde geschlossen'))
        }
      })
    })

    server.on('error', (err) => {
      cleanup()
      reject(err)
    })
  })
}

export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: number }> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Token-Erneuerung fehlgeschlagen: ${text}`)
  }

  const data = (await response.json()) as {
    access_token: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000
  }
}
