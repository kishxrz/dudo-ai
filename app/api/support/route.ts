import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

export async function POST(request: Request) {
  try {
    const { name, email, phone, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Name, email, and message are required.' }, { status: 400 });
    }

    // 1. Save to Firestore support_messages collection (if db is configured)
    let firestoreId = null;
    if (db) {
      try {
        const docRef = await addDoc(collection(db, 'support_messages'), {
          name,
          email,
          phone: phone || '',
          message,
          createdAt: new Date().toISOString(),
        });
        firestoreId = docRef.id;
      } catch (err) {
        console.error('Failed to save to Firestore:', err);
      }
    }

    // 2. Send email via Nodemailer
    const user = process.env.SUPPORT_EMAIL_USER || 'dudosupport@gmail.com';
    const pass = process.env.SUPPORT_EMAIL_PASS;

    if (!pass) {
      console.warn('SUPPORT_EMAIL_PASS is not configured in environment variables. Email sending skipped.');
      return NextResponse.json({
        success: true,
        message: 'Message saved to database, but email notification skipped (missing SMTP password).',
        firestoreId,
      });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"${name}" <${email}>`,
      to: 'dudosupport@gmail.com',
      replyTo: email,
      subject: `Dudo Support - Message from ${name}`,
      text: `You have received a new support message from Dudo:\n\n` +
            `Name: ${name}\n` +
            `Email: ${email}\n` +
            `Phone: ${phone || 'N/A'}\n\n` +
            `Message:\n${message}`,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ success: true, message: 'Message sent successfully!', firestoreId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('Support API Error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
