import type { NextApiRequest, NextApiResponse } from 'next'
import { prisma } from '../../../lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { sendVerificationEmail } from '../../../lib/email'
import { CARD_IMAGE_BASE_URL } from '../../../lib/constants'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { email, password, name } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Missing email or password' })
  }

  // Password Strength Validation
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/
  if (!passwordRegex.test(password)) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long and contain at least one uppercase letter and one number.' })
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    // Assign random card image
    let imageUrl = '';
    try {
      const cardCount = await prisma.card.count({
        where: { konamiId: { not: null } }
      });
      
      if (cardCount > 0) {
        const skip = Math.floor(Math.random() * cardCount);
        const randomCard = await prisma.card.findFirst({
          where: { konamiId: { not: null } },
          skip: skip,
          select: { konamiId: true }
        });
        
        if (randomCard && randomCard.konamiId) {
          imageUrl = `${CARD_IMAGE_BASE_URL}/${randomCard.konamiId}.jpg`;
        }
      }
    } catch (error) {
      console.error('Error fetching random card for profile image:', error);
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        image: imageUrl
      }
    })

    // Generate Verification Token
    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(new Date().getTime() + 24 * 60 * 60 * 1000) // 24 hours

    await prisma.verificationToken.create({
      data: {
        identifier: email,
        token,
        expires
      }
    })

    // Send email with link
    const emailResult = await sendVerificationEmail(email, token)
    
    if (!emailResult.success) {
      // In a real app, you might want to rollback the user creation or allow them to resend the email
      console.error('Failed to send verification email', emailResult.error)
      return res.status(500).json({ message: 'User created but failed to send verification email.' })
    }

    res.status(201).json({ message: 'User created. Please check your email to verify your account.' })
  } catch (error) {
    console.error('Registration Error:', error)
    res.status(500).json({ message: 'Internal server error', error: (error as any).message })
  }
}
