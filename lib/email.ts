import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null as any

export async function sendVerificationEmail(email: string, token: string) {
  const verificationLink = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

  try {
    if (!resend) {
      // Dev fallback: if Resend API key is not configured, log the verification link so
      // developers can complete verification locally without sending real email.
      console.warn('Resend API key not configured — logging verification link (dev fallback)')
      console.log('VERIFICATION LINK:', verificationLink)
      return { success: true, data: { debugLink: verificationLink } }
    }

    const data = await resend.emails.send({
      from: 'KDR Revamped <onboarding@resend.dev>', // Change this to your verified domain in production
      to: email,
      subject: 'Verify your KDR Revamped Account',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome to KDR Revamped!</h1>
          <p>Please verify your email address to complete your registration.</p>
          <a href="${verificationLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">
            Verify Email
          </a>
          <p style="margin-top: 24px; color: #666; font-size: 14px;">
            If the button doesn't work, copy and paste this link into your browser:<br>
            <a href="${verificationLink}">${verificationLink}</a>
          </p>
        </div>
      `,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    // Dev fallback: surface the verification link when email provider fails in dev
    if (process.env.NODE_ENV === 'development') {
      console.warn('Email send failed; returning debug link in development')
      return { success: true, data: { debugLink: verificationLink }, error }
    }
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

  try {
    if (!resend) {
      console.warn('Resend API key not configured — logging reset link (dev fallback)')
      console.log('PASSWORD RESET LINK:', resetLink)
      return { success: true, data: { debugLink: resetLink } }
    }

    const data = await resend.emails.send({
      from: 'KDR Revamped <onboarding@resend.dev>',
      to: email,
      subject: 'Reset your KDR Revamped Password',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Reset Your Password</h1>
          <p>You requested a password reset. Click the button below to choose a new password.</p>
          <a href="${resetLink}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">
            Reset Password
          </a>
          <p style="margin-top: 24px; color: #666; font-size: 14px;">
            If you didn't request this, you can safely ignore this email.<br>
            <a href="${resetLink}">${resetLink}</a>
          </p>
        </div>
      `,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Failed to send email:', error);
    if (process.env.NODE_ENV === 'development') {
      console.warn('Email send failed; returning debug link in development')
      return { success: true, data: { debugLink: resetLink }, error }
    }
    return { success: false, error };
  }
}

export async function sendKdrStartedEmail(email: string, kdr: { id: string, name: string, slug?: string }) {
  const kdrUrl = `${process.env.NEXTAUTH_URL}/kdr/${kdr.id}`
  try {
    const data = await resend.emails.send({
      from: 'KDR Revamped <onboarding@resend.dev>',
      to: email,
      subject: `KDR started: ${kdr.name}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Your KDR has started</h1>
          <p>The KDR "${kdr.name}" has been started. Click below to view the KDR and pick a class.</p>
          <a href="${kdrUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">Open KDR</a>
          <p style="margin-top: 24px; color: #666; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:<br><a href="${kdrUrl}">${kdrUrl}</a></p>
        </div>
      `,
    })
    return { success: true, data }
  } catch (error) {
    console.error('Failed to send KDR started email:', error)
    return { success: false, error }
  }
}
