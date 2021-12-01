import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data.service';
import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma.module';

@Module({
  imports: [DataProviderModule, PrismaModule],
  providers: [ExchangeRateDataService, MarketDataService],
  exports: [ExchangeRateDataService]
})
export class ExchangeRateDataModule {}
