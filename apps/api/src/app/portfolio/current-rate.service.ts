import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data.service';
import { resetHours } from '@ghostfolio/common/helper';
import { Injectable } from '@nestjs/common';
import { Big } from 'big.js';
import { isAfter, isBefore, isToday } from 'date-fns';
import { flatten } from 'lodash';

import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { GetValueObject } from './interfaces/get-value-object.interface';
import { GetValueParams } from './interfaces/get-value-params.interface';
import { GetValuesParams } from './interfaces/get-values-params.interface';

@Injectable()
export class CurrentRateService {
  public constructor(
    private readonly dataProviderService: DataProviderService,
    private readonly exchangeRateDataService: ExchangeRateDataService,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly marketDataService: MarketDataService
  ) {}

  public async getValue({
    currency,
    date,
    symbol,
    userCurrency
  }: GetValueParams): Promise<GetValueObject> {
    if (isToday(date)) {
      const dataProviderResult = await this.dataProviderService.get([
        {
          symbol,
          dataSource: this.dataProviderService.getPrimaryDataSource()
        }
      ]);
      return {
        symbol,
        date: resetHours(date),
        marketPrice: dataProviderResult?.[symbol]?.marketPrice ?? 0
      };
    }

    const marketData = await this.marketDataService.get({
      date,
      symbol
    });

    if (marketData) {
      return {
        date: marketData.date,
        marketPrice: this.exchangeRateDataService.toCurrency(
          marketData.marketPrice,
          currency,
          userCurrency
        ),
        symbol: marketData.symbol
      };
    }

    throw new Error(`Value not found for ${symbol} at ${resetHours(date)}`);
  }

  public async getValues({
    currencies,
    dataGatheringItems,
    dateQuery,
    userCurrency
  }: GetValuesParams): Promise<GetValueObject[]> {
    const includeToday =
      (!dateQuery.lt || isBefore(new Date(), dateQuery.lt)) &&
      (!dateQuery.gte || isBefore(dateQuery.gte, new Date())) &&
      (!dateQuery.in || this.containsToday(dateQuery.in));

    const promises: Promise<
      {
        date: Date;
        marketPrice: number;
        symbol: string;
      }[]
    >[] = [];

    const sourceCurrencies = Object.values(currencies);
    const exchangeRates = await this.exchangeRateService.getExchangeRates({
      dateQuery,
      sourceCurrencies,
      destinationCurrency: userCurrency
    });

    if (includeToday) {
      const today = resetHours(new Date());
      promises.push(
        this.dataProviderService
          .get(dataGatheringItems)
          .then((dataResultProvider) => {
            const result = [];
            for (const dataGatheringItem of dataGatheringItems) {
              result.push({
                date: today,
                marketPrice: this.exchangeRateDataService.toCurrency(
                  dataResultProvider?.[dataGatheringItem.symbol]?.marketPrice ??
                    0,
                  dataResultProvider?.[dataGatheringItem.symbol]?.currency,
                  userCurrency
                ),
                symbol: dataGatheringItem.symbol
              });
            }
            return result;
          })
      );
    }

    const symbols = dataGatheringItems.map((dataGatheringItem) => {
      return dataGatheringItem.symbol;
    });

    promises.push(
      this.marketDataService
        .getRange({
          dateQuery,
          symbols
        })
        .then((data) => {
          const result = [];
          let j = 0;
          for (const marketDataItem of data) {
            const currency = currencies[marketDataItem.symbol];
            while (
              j + 1 < exchangeRates.length &&
              !isAfter(exchangeRates[j + 1].date, marketDataItem.date)
            ) {
              j++;
            }
            let exchangeRate: Big;
            if (currency !== userCurrency) {
              exchangeRate = exchangeRates[j]?.exchangeRates[currency];

              for (
                let k = j;
                k >= 0 && !exchangeRates[k]?.exchangeRates[currency];
                k--
              ) {
                exchangeRate = exchangeRates[k]?.exchangeRates[currency];
              }
            } else {
              exchangeRate = new Big(1);
            }
            if (exchangeRate) {
              result.push({
                date: marketDataItem.date,
                marketPrice: exchangeRate
                  .mul(marketDataItem.marketPrice)
                  .toNumber(),
                symbol: marketDataItem.symbol
              });
            }
          }
          return result;
        })
    );

    return flatten(await Promise.all(promises));
  }

  private containsToday(dates: Date[]): boolean {
    for (const date of dates) {
      if (isToday(date)) {
        return true;
      }
    }
    return false;
  }
}
