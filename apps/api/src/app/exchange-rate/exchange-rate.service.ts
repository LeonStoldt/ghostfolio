import { Injectable } from '@nestjs/common';
import Big from 'big.js';
import { DateBasedExchangeRate } from './date-based-exchange-rate.interface';
import { MarketDataService } from '@ghostfolio/api/app/portfolio/market-data.service';
import { DateQuery } from '../portfolio/interfaces/date-query.interface';

@Injectable()
export class ExchangeRateService {
  public constructor(private marketDataService: MarketDataService) {}

  public async getExchangeRates({
    dateQuery,
    sourceCurrencies,
    destinationCurrency
  }: {
    dateQuery: DateQuery;
    sourceCurrencies: Currency[];
    destinationCurrency: Currency;
  }): Promise<DateBasedExchangeRate[]> {
    const symbols = [...sourceCurrencies, destinationCurrency].map(
      (currency) => `${Currency.USD}${currency}`
    );
    const exchangeRates = await this.marketDataService.getRange({
      dateQuery,
      symbols
    });

    if (exchangeRates.length === 0) {
      return [];
    }
    const results: DateBasedExchangeRate[] = [];
    let currentDate = exchangeRates[0].date;
    let currentRates: { [symbol: string]: Big } = {};
    for (const exchangeRate of exchangeRates) {
      if (currentDate !== exchangeRate.date) {
        results.push({
          date: currentDate,
          exchangeRates: this.getUserExchangeRates(
            currentRates,
            destinationCurrency,
            sourceCurrencies
          )
        });
        currentDate = exchangeRate.date;
        currentRates = {};
      }
      currentRates[exchangeRate.symbol] = new Big(exchangeRate.marketPrice);
    }
    results.push({
      date: currentDate,
      exchangeRates: this.getUserExchangeRates(
        currentRates,
        destinationCurrency,
        sourceCurrencies
      )
    });
    return results;
  }

  private getUserExchangeRates(
    currentRates: { [symbol: string]: Big },
    destinationCurrency: string,
    sourceCurrencies: string[]
  ): { [currency: string]: Big } {
    const result: { [currency: string]: Big } = {};

    for (const sourceCurrency of sourceCurrencies) {
      let exchangeRate: Big;
      if (sourceCurrency === destinationCurrency) {
        exchangeRate = new Big(1);
      } else if (sourceCurrency === 'USD') {
        exchangeRate = currentRates[`${sourceCurrency}${destinationCurrency}`];
      } else if (destinationCurrency === 'USD') {
        exchangeRate = new Big(1).div(
          currentRates[`${destinationCurrency}${sourceCurrency}`]
        );
      } else {
        if (
          currentRates[`USD${destinationCurrency}`] &&
          currentRates[`USD${sourceCurrency}`]
        ) {
          exchangeRate = currentRates[`USD${destinationCurrency}`].div(
            currentRates[`USD${sourceCurrency}`]
          );
        }
      }
      if (exchangeRate) {
        result[sourceCurrency] = exchangeRate;
      }
    }

    return result;
  }
}
