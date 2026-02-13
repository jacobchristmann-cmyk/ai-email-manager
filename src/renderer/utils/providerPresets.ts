export interface ProviderPreset {
  label: string
  value: 'gmail' | 'outlook' | 'imap'
  imapHost: string
  imapPort: number
  smtpHost: string
  smtpPort: number
}

export const providerPresets: ProviderPreset[] = [
  {
    label: 'Gmail',
    value: 'gmail',
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465
  },
  {
    label: 'Outlook / Hotmail',
    value: 'outlook',
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    smtpHost: 'smtp.office365.com',
    smtpPort: 587
  },
  {
    label: 'Eigener IMAP-Server',
    value: 'imap',
    imapHost: '',
    imapPort: 993,
    smtpHost: '',
    smtpPort: 465
  }
]
