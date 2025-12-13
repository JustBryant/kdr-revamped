import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(email: string, token: string) {
  const verificationLink = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;

  try {
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
    return { success: false, error };
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

  try {
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
    return { success: false, error };
  }
}
