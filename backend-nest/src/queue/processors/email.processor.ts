import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { QUEUE_NAMES } from '../constants';
import type { EmailJob } from '../types/queue.types';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  pool: true,
  maxConnections: 3,
});

@Injectable()
@Processor(QUEUE_NAMES.EMAILS, { concurrency: 3 })
export class EmailProcessor extends WorkerHost {
  async process(job: Job<EmailJob>): Promise<void> {
    if (job.name !== 'send') return;

    const { to, subject, template, variables } = job.data;
    const templates: Record<string, string> = {
      welcome: `مرحباً بك في سروح، ${variables.name}! حسابك جاهز.`,
      fee_reminder: `تذكير: لديك رسوم معلقة ${variables.amount} ريال مستحقة بتاريخ ${variables.dueDate}.`,
      order_update: `تحديث طلبك: ${variables.status}`,
      subscription_renew: `تجديد اشتراكك: ${variables.plan} - ${variables.amount} ريال`,
      email_verification: `رمز التحقق: <strong>${variables.code}</strong> (صالح 10 دقائق)`,
    };

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@safat.app',
      to,
      subject,
      html: `<div dir="rtl" style="font-family:sans-serif;max-width:600px;margin:0 auto">${templates[template] || variables.body || subject}</div>`,
    });
  }
}
