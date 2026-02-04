import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'

const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const FROM_EMAIL = process.env.AWS_SES_FROM_EMAIL || 'noreply@example.com'

interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: EmailOptions) {
  try {
    const recipients = Array.isArray(to) ? to : [to]

    const command = new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: html,
            Charset: 'UTF-8',
          },
          ...(text && {
            Text: {
              Data: text,
              Charset: 'UTF-8',
            },
          }),
        },
      },
    })

    const response = await sesClient.send(command)
    return response.MessageId
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}

export async function sendMeetingScheduledEmail(
  employeeEmail: string,
  employeeName: string,
  reporterEmail: string,
  reporterName: string,
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

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F37022; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
          .content { background-color: #F5F5F7; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background-color: #F37022; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>One-on-One Meeting Scheduled</h1>
          </div>
          <div class="content">
            <p>Hi ${employeeName},</p>
            <p>A one-on-one meeting has been scheduled with ${reporterName}.</p>
            <p><strong>Date & Time:</strong> ${formattedDate}</p>
            <p>Please prepare your one-on-one form before the meeting.</p>
            <a href="${process.env.NEXTAUTH_URL}/meetings/${meetingId}" class="button">View Meeting</a>
          </div>
        </div>
      </body>
    </html>
  `

  // Send to both parties
  await Promise.all([
    sendEmail({
      to: employeeEmail,
      subject: `One-on-One Meeting Scheduled with ${reporterName}`,
      html,
    }),
    sendEmail({
      to: reporterEmail,
      subject: `One-on-One Meeting Scheduled with ${employeeName}`,
      html: html.replace(`Hi ${employeeName}`, `Hi ${reporterName}`),
    }),
  ])
}

export async function sendTodoAssignedEmail(
  assigneeEmail: string,
  assigneeName: string,
  todoTitle: string,
  todoDescription: string | null,
  dueDate: Date | null,
  createdByName: string,
  todoId: string
) {
  const formattedDueDate = dueDate
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(dueDate)
    : 'No due date'

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F37022; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
          .content { background-color: #F5F5F7; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background-color: #F37022; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New To-Do Assigned</h1>
          </div>
          <div class="content">
            <p>Hi ${assigneeName},</p>
            <p>You have been assigned a new to-do:</p>
            <p><strong>${todoTitle}</strong></p>
            ${todoDescription ? `<p>${todoDescription}</p>` : ''}
            <p><strong>Due Date:</strong> ${formattedDueDate}</p>
            <p><strong>Assigned by:</strong> ${createdByName}</p>
            <a href="${process.env.NEXTAUTH_URL}/todos" class="button">View To-Do</a>
          </div>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: assigneeEmail,
    subject: `New To-Do: ${todoTitle}`,
    html,
  })
}

export async function sendTodoDueReminderEmail(
  assigneeEmail: string,
  assigneeName: string,
  todoTitle: string,
  dueDate: Date,
  todoId: string
) {
  const formattedDueDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dueDate)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F37022; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
          .content { background-color: #F5F5F7; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background-color: #F37022; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>To-Do Due Reminder</h1>
          </div>
          <div class="content">
            <p>Hi ${assigneeName},</p>
            <p>This is a reminder that you have a to-do due soon:</p>
            <p><strong>${todoTitle}</strong></p>
            <p><strong>Due Date:</strong> ${formattedDueDate}</p>
            <a href="${process.env.NEXTAUTH_URL}/todos" class="button">View To-Do</a>
          </div>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: assigneeEmail,
    subject: `Reminder: ${todoTitle} is due soon`,
    html,
  })
}

export async function sendFormSubmittedEmail(
  reporterEmail: string,
  reporterName: string,
  employeeName: string,
  meetingDate: Date,
  meetingId: string
) {
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(meetingDate)

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #F37022; color: white; padding: 20px; border-radius: 12px 12px 0 0; }
          .content { background-color: #F5F5F7; padding: 30px; border-radius: 0 0 12px 12px; }
          .button { display: inline-block; background-color: #F37022; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>One-on-One Form Submitted</h1>
          </div>
          <div class="content">
            <p>Hi ${reporterName},</p>
            <p>${employeeName} has submitted their one-on-one form for the meeting scheduled on ${formattedDate}.</p>
            <p>Please review their responses before the meeting.</p>
            <a href="${process.env.NEXTAUTH_URL}/meetings/${meetingId}" class="button">View Form</a>
          </div>
        </div>
      </body>
    </html>
  `

  await sendEmail({
    to: reporterEmail,
    subject: `${employeeName} has submitted their one-on-one form`,
    html,
  })
}
