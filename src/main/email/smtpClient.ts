import nodemailer from 'nodemailer'
import type { Readable } from 'stream'
import type { Account } from '../../shared/types'

export interface SmtpConfig {
  host: string
  port: number
  username: string
  password: string
}

export async function testSmtpConnection(config: SmtpConfig): Promise<void> {
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.username, pass: config.password }
  })
  await transport.verify()
  transport.close()
}

/** Send an email and return the raw RFC2822 message buffer (for IMAP APPEND to Sent) */
export async function sendEmail(
  account: Account,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string,
  attachments?: { filename: string; path: string }[]
): Promise<Buffer> {
  const mailOptions: nodemailer.SendMailOptions = {
    from: `${account.name} <${account.email}>`,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    text: body,
    attachments: attachments?.map((a) => ({ filename: a.filename, path: a.path }))
  }

  // Send via SMTP
  const smtpTransport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.username, pass: account.password }
  })
  await smtpTransport.sendMail(mailOptions)
  smtpTransport.close()

  // Build raw RFC2822 message for IMAP APPEND using stream transport
  try {
    const streamTransport = nodemailer.createTransport({ streamTransport: true, newline: 'unix' })
    const info = await streamTransport.sendMail(mailOptions)
    const stream = info.message as Readable
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      stream.on('data', (chunk: Buffer) => chunks.push(chunk))
      stream.on('end', () => resolve(Buffer.concat(chunks)))
      stream.on('error', reject)
    })
  } catch {
    return Buffer.alloc(0)
  }
}
