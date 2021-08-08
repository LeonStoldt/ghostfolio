import { DataProviderModule } from '@ghostfolio/api/services/data-provider/data-provider.module';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data.service';
import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma.module';
import { ExchangeRateService } from '@ghostfolio/api/app/exchange-rate/exchange-rate.service';
import { MarketDataService } from '@ghostfolio/api/app/portfolio/market-data.service';

@Module({
  imports: [DataProviderModule, PrismaModule],
  providers: [ExchangeRateDataService, ExchangeRateService, MarketDataService],
  exports: [ExchangeRateDataService, ExchangeRateService]
})
export class ExchangeRateDataModule {}
