import { safeStorage } from 'electron'

const ENC_PREFIX = 'ENC:'

export function encryptPassword(plainText: string): string {
  if (!safeStorage.isEncryptionAvailable()) return plainText
  const encrypted = safeStorage.encryptString(plainText)
  return ENC_PREFIX + encrypted.toString('base64')
}

export function decryptPassword(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored // legacy plaintext passthrough
  if (!safeStorage.isEncryptionAvailable()) return stored
  const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64')
  return safeStorage.decryptString(buf)
}

export function isEncrypted(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX)
}
