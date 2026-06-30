// backend/scripts/check-user.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking user database entry...');
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: 'alsafaat' },
        { phone: '+966501234567' }
      ]
    }
  });

  if (!user) {
    console.log('❌ User not found in database.');
    return;
  }

  console.log('✅ User found:');
  console.log('ID:', user.id);
  console.log('Username:', user.username);
  console.log('Email:', user.email);
  console.log('Phone:', user.phone);
  console.log('Role:', user.role);
  console.log('IsActive:', user.isActive);
  console.log('HasPasswordHash:', !!user.passwordHash);

  // Test password verification
  const testPassword = 'alsafat123';
  const match = await bcrypt.compare(testPassword, user.passwordHash || '');
  console.log(`Password test for "${testPassword}":`, match ? '🟢 MATCH' : '🔴 MISMATCH');
}

main().catch(console.error).finally(() => prisma.$disconnect());
