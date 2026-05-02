import nodemailer from 'nodemailer'

type PasswordResetEmailInput = {
  to: string
  name: string
  username?: string
  url: string
}

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is required to send email.`)
  }
  return value
}

function getTransport() {
  const port = Number(process.env.SMTP_PORT ?? 587)

  return nodemailer.createTransport({
    host: requireEnv('SMTP_HOST'),
    port,
    secure: process.env.SMTP_SECURE === 'true' || port === 465,
    auth: {
      user: requireEnv('SMTP_USER'),
      pass: requireEnv('SMTP_PASS'),
    },
  })
}

export async function sendPasswordSetupEmail({ to, name, username, url }: PasswordResetEmailInput) {
  const from = requireEnv('SMTP_FROM')
  const appName = 'FillerLog'

  const linkWithUsername = username ? `${url}&username=${encodeURIComponent(username)}` : url

  await getTransport().sendMail({
    from,
    to,
    subject: `${appName} — Set your password`,
    text: [
      `Hi ${name},`,
      '',
      username ? `Your username is: ${username}` : '',
      '',
      'An admin created a FillerLog account for you.',
      'Set your password using this link:',
      linkWithUsername,
      '',
      'This link expires in 24 hours.',
      'If you did not expect this email, you can ignore it.',
    ]
      .filter((line) => line !== undefined)
      .join('\n'),
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F3;padding:40px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:460px">
        <tr><td align="center" style="padding-bottom:20px">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#80BC17;border-radius:10px;width:36px;height:36px;text-align:center;vertical-align:middle">
              <span style="font-size:18px;font-weight:900;color:#fff;line-height:36px">F</span>
            </td>
            <td style="padding-left:10px;font-size:18px;font-weight:800;color:#111827;letter-spacing:-0.02em;vertical-align:middle">FillerLog</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#fff;border-radius:20px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)">
          <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111827;letter-spacing:-0.02em">Set your password</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#6B7280;line-height:1.6">An admin created a FillerLog account for you.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F3;border-radius:12px;margin-bottom:24px">
            <tr><td style="padding:14px 16px">
              <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#9CA3AF;margin-bottom:6px">Your account</div>
              <div style="font-size:15px;font-weight:700;color:#111827">${name}</div>
              ${username ? `<div style="font-size:13px;color:#6B7280;margin-top:3px">@${username}</div>` : ''}
            </td></tr>
          </table>
          <a href="${linkWithUsername}" style="display:block;background:#80BC17;color:#fff;text-decoration:none;font-weight:700;font-size:15px;text-align:center;padding:14px 24px;border-radius:12px;letter-spacing:-0.01em">Set password</a>
          <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;text-align:center;line-height:1.6">This link expires in 24 hours.<br>If you weren't expecting this, you can safely ignore it.</p>
        </td></tr>
        <tr><td style="padding:16px 0 0">
          <p style="font-size:11px;color:#9CA3AF;text-align:center;word-break:break-all;margin:0">
            If the button doesn't work, copy this link:<br>
            <a href="${linkWithUsername}" style="color:#80BC17">${linkWithUsername}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  })
}
