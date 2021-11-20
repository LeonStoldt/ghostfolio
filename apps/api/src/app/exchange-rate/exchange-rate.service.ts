import { Injectable } from '@nestjs/common';
import Big from 'big.js';
import { DateBasedExchangeRate } from './date-based-exchange-rate.interface';
import { MarketDataService } from '@ghostfolio/api/app/portfolio/market-data.service';
import { DateQuery } from '../portfolio/interfaces/date-query.interface';
import { isSameDay } from 'date-fns';

@Injectable()
export class ExchangeRateService {
  public constructor(private marketDataService: MarketDataService) {}

  public async getExchangeRates({
    dateQuery,
    sourceCurrencies,
    destinationCurrency
  }: {
    dateQuery: DateQuery;
    sourceCurrencies: string[];
    destinationCurrency: string;
  }): Promise<DateBasedExchangeRate[]> {
    const symbols = [...sourceCurrencies, destinationCurrency]
      .map((currency) => `${currency}USD`)
      .filter((v, i, a) => a.indexOf(v) === i);
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
      if (!isSameDay(currentDate, exchangeRate.date)) {
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
      } else if (
        sourceCurrency === 'USD' &&
        currentRates[`${destinationCurrency}${sourceCurrency}`]
      ) {
        exchangeRate = new Big(1).div(
          currentRates[`${destinationCurrency}${sourceCurrency}`]
        );
      } else if (
        destinationCurrency === 'USD' &&
        currentRates[`${sourceCurrency}${destinationCurrency}`]
      ) {
        exchangeRate = currentRates[`${sourceCurrency}${destinationCurrency}`];
      } else if (
        currentRates[`${destinationCurrency}USD`] &&
        currentRates[`${sourceCurrency}USD`]
      ) {
        exchangeRate = currentRates[`${sourceCurrency}USD`].div(
          currentRates[`${destinationCurrency}USD`]
        );
      }

      if (exchangeRate) {
        result[sourceCurrency] = exchangeRate;
      }
    }

    return result;
  }
}
