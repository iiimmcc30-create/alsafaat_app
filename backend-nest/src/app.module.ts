import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { PostsModule } from './posts/posts.module';
import { StoriesModule } from './stories/stories.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PlansModule } from './plans/plans.module';
import { ButchersModule } from './butchers/butchers.module';
import { ButcherApplicationsModule } from './butcher-applications/butcher-applications.module';
import { LivestreamsModule } from './livestreams/livestreams.module';
import { MessagesModule } from './messages/messages.module';
import { UploadModule } from './upload/upload.module';
import { AdminModule } from './admin/admin.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { FeesModule } from './fees/fees.module';
import { SearchModule } from './search/search.module';
import { HealthModule } from './health/health.module';
import { QueueModule } from './queue/queue.module';
import { GatewaySharedModule } from './gateway/gateway-shared.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    AppConfigModule,
    CommonModule,
    PrismaModule,
    RedisModule,
    QueueModule,
    GatewaySharedModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    PostsModule,
    StoriesModule,
    NotificationsModule,
    PaymentsModule,
    SubscriptionsModule,
    PlansModule,
    ButchersModule,
    ButcherApplicationsModule,
    LivestreamsModule,
    MessagesModule,
    UploadModule,
    AdminModule,
    KnowledgeModule,
    FeesModule,
    SearchModule,
    HealthModule,
    ReportsModule,
  ],
})
export class AppModule {}
