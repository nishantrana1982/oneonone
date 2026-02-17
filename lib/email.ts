import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import nodemailer from 'nodemailer'

// --- Transport: SMTP or AWS SES ---

function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST || ''
  const user = process.env.SMTP_USER || ''
  const pass = process.env.SMTP_PASSWORD || ''
  const from = process.env.EMAIL_FROM || ''
  return !!(host && user && pass && from)
}

function getFromEmail(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM
  if (process.env.AWS_SES_FROM_EMAIL) return process.env.AWS_SES_FROM_EMAIL
  throw new Error('EMAIL_FROM or AWS_SES_FROM_EMAIL must be set in environment variables')
}

// Lazy SMTP transporter (only when SMTP is configured)
let smtpTransporter: nodemailer.Transporter | null = null
function getSmtpTransporter(): nodemailer.Transporter {
  if (!smtpTransporter) {
    const port = parseInt(process.env.SMTP_PORT || '587', 10)
    const secure = port === 465
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    })
  }
  return smtpTransporter
}

// Lazy SES client (only when SES is used)
let sesClient: SESClient | null = null
function getSesClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  }
  return sesClient
}

function isSesConfigured(): boolean {
  const from = process.env.AWS_SES_FROM_EMAIL || ''
  const key = process.env.AWS_ACCESS_KEY_ID || ''
  const secret = process.env.AWS_SECRET_ACCESS_KEY || ''
  return !!(from && key && secret)
}

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export class EmailNotConfiguredError extends Error {
  constructor() {
    super('Email not configured: neither SMTP nor AWS SES is set up. Configure SMTP_* or AWS_SES_* in .env')
    this.name = 'EmailNotConfiguredError'
  }
}

export function isEmailConfigured(): boolean {
  return isSmtpConfigured() || isSesConfigured()
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<string | null> {
  const recipients = Array.isArray(to) ? to : [to]
  const from = getFromEmail()

  // Prefer SMTP if configured
  if (isSmtpConfigured()) {
    try {
      const transporter = getSmtpTransporter()
      const info = await transporter.sendMail({
        from,
        to: recipients,
        subject,
        html,
        text: text || undefined,
      })
      console.log(`Email sent via SMTP to ${recipients.join(', ')} [${info.messageId}]`)
      return info.messageId || null
    } catch (error) {
      console.error('SMTP send error:', error)
      throw error
    }
  }

  // Fall back to AWS SES if configured
  if (isSesConfigured()) {
    try {
      const client = getSesClient()
      const command = new SendEmailCommand({
        Source: from,
        Destination: { ToAddresses: recipients },
        Message: {
          Subject: { Data: subject, Charset: 'UTF-8' },
          Body: {
            Html: { Data: html, Charset: 'UTF-8' },
            ...(text && { Text: { Data: text, Charset: 'UTF-8' } }),
          },
        },
      })
      const response = await client.send(command)
      console.log(`Email sent via SES to ${recipients.join(', ')} [${response.MessageId}]`)
      return response.MessageId || null
    } catch (error) {
      console.error('SES send error:', error)
      throw error
    }
  }

  // Neither provider configured — throw so callers know it failed
  throw new EmailNotConfiguredError()
}

// ---------------------------------------------------------------------------
// Shared email layout
// ---------------------------------------------------------------------------

const appName = 'AMI One-on-One'
const baseUrl = () => process.env.NEXTAUTH_URL || 'https://app.example.com'

function emailLayout({
  preheader,
  heading,
  body,
  ctaText,
  ctaUrl,
}: {
  preheader: string
  heading: string
  body: string
  ctaText?: string
  ctaUrl?: string
}): string {
  const cta = ctaText && ctaUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px;">
        <tr>
          <td style="border-radius:8px;background-color:#1D1D1F;">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
              ${ctaText}
            </a>
          </td>
        </tr>
      </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${heading}</title>
  <!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f2f2f7;-webkit-text-size-adjust:none;-ms-text-size-adjust:none;">
  <!-- Preheader (hidden preview text) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f7;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          
          <!-- Logo bar -->
          <tr>
            <td style="padding:28px 32px 20px;border-bottom:1px solid #f0f0f2;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width:36px;height:36px;background-color:#1D1D1F;border-radius:10px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:16px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;line-height:36px;">A</span>
                  </td>
                  <td style="padding-left:12px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;">
                    <span style="font-size:17px;font-weight:700;color:#1D1D1F;">${appName}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:32px 32px 36px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;">
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1D1D1F;line-height:1.3;">${heading}</h1>
              <div style="font-size:15px;line-height:1.7;color:#48484A;">
                ${body}
              </div>
              ${cta}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;border-top:1px solid #f0f0f2;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#AEAEB2;">
                This is an automated notification from ${appName}. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function detailRow(label: string, value: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:6px 0;">
    <tr>
      <td style="padding:10px 14px;background-color:#f8f8fa;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display',system-ui,sans-serif;">
        <span style="font-size:12px;font-weight:600;color:#8E8E93;text-transform:uppercase;letter-spacing:0.5px;">${label}</span><br>
        <span style="font-size:15px;font-weight:500;color:#1D1D1F;">${value}</span>
      </td>
    </tr>
  </table>`
}

// ---------------------------------------------------------------------------
// Email senders
// ---------------------------------------------------------------------------

export async function sendMeetingScheduledEmail(
  employeeEmail: string,
  employeeName: string | null,
  reporterEmail: string,
  reporterName: string | null,
  meetingDate: Date,
  meetingId: string
) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(meetingDate)

  const empName = employeeName || 'Team Member'
  const mgrName = reporterName || 'Your Manager'

  const employeeHtml = emailLayout({
    preheader: `Your one-on-one with ${mgrName} is scheduled for ${formattedDate}`,
    heading: 'Meeting Scheduled',
    body: `
      <p style="margin:0 0 16px;">Hi ${empName},</p>
      <p style="margin:0 0 20px;">A one-on-one meeting has been scheduled. Please review the details below and prepare your check-in form before the meeting.</p>
      ${detailRow('With', mgrName)}
      ${detailRow('Date & Time', formattedDate)}
    `,
    ctaText: 'View Meeting Details',
    ctaUrl: `${baseUrl()}/meetings/${meetingId}`,
  })

  const reporterHtml = emailLayout({
    preheader: `Your one-on-one with ${empName} is scheduled for ${formattedDate}`,
    heading: 'Meeting Scheduled',
    body: `
      <p style="margin:0 0 16px;">Hi ${mgrName},</p>
      <p style="margin:0 0 20px;">A one-on-one meeting has been scheduled with your direct report. Here are the details:</p>
      ${detailRow('With', empName)}
      ${detailRow('Date & Time', formattedDate)}
    `,
    ctaText: 'View Meeting Details',
    ctaUrl: `${baseUrl()}/meetings/${meetingId}`,
  })

  await Promise.all([
    sendEmail({
      to: employeeEmail,
      subject: `Meeting Scheduled – ${mgrName} · ${formattedDate}`,
      html: employeeHtml,
    }),
    sendEmail({
      to: reporterEmail,
      subject: `Meeting Scheduled – ${empName} · ${formattedDate}`,
      html: reporterHtml,
    }),
  ])
}

export async function sendTodoAssignedEmail(
  assigneeEmail: string,
  assigneeName: string | null,
  todoTitle: string,
  todoDescription: string | null,
  dueDate: Date | null,
  createdByName: string | null,
  todoId: string
) {
  const formattedDueDate = dueDate
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(dueDate)
    : 'No due date'

  const name = assigneeName || 'Team Member'
  const creator = createdByName || 'Your Manager'

  const html = emailLayout({
    preheader: `${creator} assigned you a new task: ${todoTitle}`,
    heading: 'New Task Assigned',
    body: `
      <p style="margin:0 0 16px;">Hi ${name},</p>
      <p style="margin:0 0 20px;">A new task has been assigned to you. Please review the details below.</p>
      ${detailRow('Task', todoTitle)}
      ${todoDescription ? detailRow('Description', todoDescription) : ''}
      ${detailRow('Due Date', formattedDueDate)}
      ${detailRow('Assigned By', creator)}
    `,
    ctaText: 'View Tasks',
    ctaUrl: `${baseUrl()}/todos`,
  })

  await sendEmail({
    to: assigneeEmail,
    subject: `New Task – ${todoTitle}`,
    html,
  })
}

export async function sendTodoDueReminderEmail(
  assigneeEmail: string,
  assigneeName: string | null,
  todoTitle: string,
  dueDate: Date,
  todoId: string
) {
  const formattedDueDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dueDate)

  const name = assigneeName || 'Team Member'

  const html = emailLayout({
    preheader: `Reminder: "${todoTitle}" is due on ${formattedDueDate}`,
    heading: 'Task Due Soon',
    body: `
      <p style="margin:0 0 16px;">Hi ${name},</p>
      <p style="margin:0 0 20px;">This is a friendly reminder that one of your tasks is due soon. Please make sure to complete it on time.</p>
      ${detailRow('Task', todoTitle)}
      ${detailRow('Due Date', formattedDueDate)}
    `,
    ctaText: 'View Tasks',
    ctaUrl: `${baseUrl()}/todos`,
  })

  await sendEmail({
    to: assigneeEmail,
    subject: `Reminder – ${todoTitle} due ${formattedDueDate}`,
    html,
  })
}

export async function sendFormSubmittedEmail(
  reporterEmail: string,
  reporterName: string | null,
  employeeName: string | null,
  meetingDate: Date,
  meetingId: string
) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(meetingDate)

  const mgrName = reporterName || 'Manager'
  const empName = employeeName || 'Team Member'

  const html = emailLayout({
    preheader: `${empName} submitted their one-on-one form for ${formattedDate}`,
    heading: 'Check-in Form Submitted',
    body: `
      <p style="margin:0 0 16px;">Hi ${mgrName},</p>
      <p style="margin:0 0 20px;"><strong>${empName}</strong> has submitted their one-on-one check-in form for the meeting on <strong>${formattedDate}</strong>. Please review their responses before the meeting.</p>
      ${detailRow('Submitted By', empName)}
      ${detailRow('Meeting Date', formattedDate)}
    `,
    ctaText: 'Review Form',
    ctaUrl: `${baseUrl()}/meetings/${meetingId}`,
  })

  await sendEmail({
    to: reporterEmail,
    subject: `Form Submitted – ${empName} · ${formattedDate}`,
    html,
  })
}

// ---------------------------------------------------------------------------
// Proposal-based scheduling emails
// ---------------------------------------------------------------------------

function formatDateFull(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/** Email sent to the employee when a reporter proposes a meeting time. */
export async function sendMeetingProposalEmail(
  employeeEmail: string,
  employeeName: string | null,
  reporterName: string | null,
  meetingDate: Date,
  meetingId: string
) {
  const empName = employeeName || 'Team Member'
  const mgrName = reporterName || 'Your Manager'
  const formattedDate = formatDateFull(meetingDate)

  const html = emailLayout({
    preheader: `${mgrName} has proposed a one-on-one meeting for ${formattedDate}`,
    heading: 'Meeting Request',
    body: `
      <p style="margin:0 0 16px;">Hi ${empName},</p>
      <p style="margin:0 0 20px;"><strong>${mgrName}</strong> has proposed a one-on-one meeting with you. Please review the details and either accept the proposed time or suggest an alternative.</p>
      ${detailRow('Proposed By', mgrName)}
      ${detailRow('Date & Time', formattedDate)}
    `,
    ctaText: 'Accept or Suggest New Time',
    ctaUrl: `${baseUrl()}/meetings/${meetingId}`,
  })

  await sendEmail({
    to: employeeEmail,
    subject: `Meeting Request – ${mgrName} · ${formattedDate}`,
    html,
  })
}

/** Email sent to the proposer when the receiver accepts. */
export async function sendMeetingAcceptedEmail(
  proposerEmail: string,
  proposerName: string | null,
  acceptorName: string | null,
  meetingDate: Date,
  meetingId: string
) {
  const pName = proposerName || 'Manager'
  const aName = acceptorName || 'Team Member'
  const formattedDate = formatDateFull(meetingDate)

  const html = emailLayout({
    preheader: `${aName} accepted the one-on-one for ${formattedDate}`,
    heading: 'Meeting Confirmed',
    body: `
      <p style="margin:0 0 16px;">Hi ${pName},</p>
      <p style="margin:0 0 20px;"><strong>${aName}</strong> has accepted the proposed one-on-one meeting. The meeting has been added to your calendar.</p>
      ${detailRow('Accepted By', aName)}
      ${detailRow('Date & Time', formattedDate)}
    `,
    ctaText: 'View Meeting',
    ctaUrl: `${baseUrl()}/meetings/${meetingId}`,
  })

  await sendEmail({
    to: proposerEmail,
    subject: `Meeting Confirmed – ${aName} · ${formattedDate}`,
    html,
  })
}

/** Email sent to the other party when the receiver suggests a new time. */
export async function sendMeetingSuggestionEmail(
  recipientEmail: string,
  recipientName: string | null,
  suggestorName: string | null,
  newDate: Date,
  meetingId: string
) {
  const rName = recipientName || 'Manager'
  const sName = suggestorName || 'Team Member'
  const formattedDate = formatDateFull(newDate)

  const html = emailLayout({
    preheader: `${sName} suggested a new time: ${formattedDate}`,
    heading: 'New Time Suggested',
    body: `
      <p style="margin:0 0 16px;">Hi ${rName},</p>
      <p style="margin:0 0 20px;"><strong>${sName}</strong> has suggested a different time for the one-on-one meeting. Please review and either accept or propose another time.</p>
      ${detailRow('Suggested By', sName)}
      ${detailRow('New Date & Time', formattedDate)}
    `,
    ctaText: 'Accept or Suggest Another Time',
    ctaUrl: `${baseUrl()}/meetings/${meetingId}`,
  })

  await sendEmail({
    to: recipientEmail,
    subject: `New Time Suggested – ${sName} · ${formattedDate}`,
    html,
  })
}
