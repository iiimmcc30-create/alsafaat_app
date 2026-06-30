// backend/scripts/create-admin.ts
// سكربت تفاعلي لإنشاء مستخدم بصلاحية مدير (ADMIN) في قاعدة البيانات

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function main() {
  console.log('🛡️ --- SAFAT: Create Admin CLI Tool --- 🛡️');

  try {
    const username = await question('Enter admin username: ');
    if (!username || username.trim().length < 3) {
      console.log('❌ Username must be at least 3 characters.');
      rl.close();
      return;
    }

    const email = await question('Enter admin email: ');
    if (!email || !email.includes('@')) {
      console.log('❌ Invalid email address.');
      rl.close();
      return;
    }

    const phone = await question('Enter admin phone number (e.g. +966501234567): ');
    if (!phone || !/^\+\d{9,14}$/.test(phone)) {
      console.log('❌ Phone number must be in international format (e.g., +966501234567).');
      rl.close();
      return;
    }

    const displayName = await question('Enter display name (e.g. Director): ');
    const password = await question('Enter password (min 6 chars): ');
    if (!password || password.length < 6) {
      console.log('❌ Password must be at least 6 characters.');
      rl.close();
      return;
    }

    const countryInput = await question('Enter country code (SA, AE, KW, QA, BH, OM) [SA]: ');
    const country = (countryInput.trim().toUpperCase() || 'SA');

    console.log('\n⏳ Creating admin user in database...');

    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.user.create({
      data: {
        username:      username.trim().toLowerCase(),
        email:         email.trim().toLowerCase(),
        phone:         phone.trim(),
        displayName:   displayName.trim() || 'SAFAT Admin',
        arabicName:    displayName.trim() || 'مدير الصفاة',
        passwordHash,
        role:          'ADMIN',
        country:       country as any,
        verified:      true,
        emailVerified: true,
        subscription: {
          create: {
            planId:    'vip',
            renewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          },
        },
      }
    });

    console.log(`\n🎉 Admin created successfully!`);
    console.log(`ID:       ${admin.id}`);
    console.log(`Username: @${admin.username}`);
    console.log(`Email:    ${admin.email}`);
    console.log(`Phone:    ${admin.phone}`);
    console.log(`Role:     ${admin.role}`);

  } catch (error: any) {
    console.error('❌ Failed to create admin user:', error.message || error);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main();
