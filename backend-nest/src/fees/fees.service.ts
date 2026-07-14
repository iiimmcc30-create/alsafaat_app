import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { COMMISSION_TABLE } from '../lib/commissions';

@Injectable()
export class FeesService {
  constructor(private readonly prisma: PrismaService) {}

  getRules() {
    return { rules: COMMISSION_TABLE };
  }

  async listForUser(userId: string) {
    const fees = await this.prisma.listingFee.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        listing: {
          select: {
            id: true,
            arabicTitle: true,
            category: true,
          },
        },
      },
    });

    return {
      fees: fees.map((f) => ({
        id: f.id,
        listingId: f.listingId,
        price: f.price,
        commission: f.commission,
        status: f.status,
        dueDate: f.dueDate,
        paidAt: f.paidAt,
        transactionId: f.transactionId,
        createdAt: f.createdAt,
        listing: f.listing
          ? {
              arabicTitle: f.listing.arabicTitle,
              category: f.listing.category,
            }
          : null,
      })),
    };
  }
}
