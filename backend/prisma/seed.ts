// prisma/seed.ts — updated with emailVerified field
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding SAFAT database...');

  const adminHash = await bcrypt.hash('Admin@2024!', 12);
  const admin = await prisma.user.upsert({
    where:  { email: 'admin@safat.app' },
    update: {},
    create: {
      username:      'safat_admin',
      email:         'admin@safat.app',
      passwordHash:  adminHash,
      displayName:   'SAFAT Admin',
      arabicName:    'مدير الصفاة',
      verified:      true,
      emailVerified: true,  // FIX: seed users are pre-verified
      role:          'ADMIN',
      country:       'SA',
      subscription: {
        create: {
          planId:    'vip',
          renewDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });

  const demoPass = await bcrypt.hash('Demo@1234', 12);
  const demoUsers = [
    { username: 'falcon_riyadh', email: 'falcon@demo.safat.app', displayName: 'Falcon Riyadh', arabicName: 'صقر الرياض', country: 'SA' },
    { username: 'desert_pearl',  email: 'pearl@demo.safat.app',  displayName: 'Desert Pearl',  arabicName: 'لؤلؤة الصحراء', country: 'AE' },
  ];

  for (const u of demoUsers) {
    await prisma.user.upsert({
      where:  { email: u.email },
      update: {},
      create: {
        ...u,
        country:       u.country as any,
        passwordHash:  demoPass,
        emailVerified: true,
        subscription: {
          create: { planId: 'starter', renewDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
        },
      },
    });
  }

  console.log('✅ Seed complete');
  console.log('Admin: admin@safat.app / Admin@2024!');
  console.log('Demo:  falcon@demo.safat.app / Demo@1234');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
