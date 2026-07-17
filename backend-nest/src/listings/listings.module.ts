import { Module } from '@nestjs/common';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';
import { ListingsRepository } from './repositories/listings.repository';
import { ListingBoostController } from './boost/listing-boost.controller';
import { ListingBoostService } from './boost/listing-boost.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [ListingsController, ListingBoostController],
  providers: [ListingsService, ListingsRepository, ListingBoostService],
  exports: [ListingBoostService],
})
export class ListingsModule {}
