import nodemailer from 'nodemailer'
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

export async function sendEmail(
  account: Account,
  to: string,
  subject: string,
  body: string,
  cc?: string,
  bcc?: string
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: account.smtpHost,
    port: account.smtpPort,
    secure: account.smtpPort === 465,
    auth: { user: account.username, pass: account.password }
  })

  await transport.sendMail({
    from: `${account.name} <${account.email}>`,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    text: body
  })

  transport.close()
}
