import { DateQuery } from '@ghostfolio/api/app/core/interfaces/date-query.interface';
import { DataProviderService } from '@ghostfolio/api/services/data-provider/data-provider.service';
import { ExchangeRateDataService } from '@ghostfolio/api/services/exchange-rate-data.service';
import { MarketDataService } from '@ghostfolio/api/services/market-data.service';
import { DataSource, MarketData } from '@prisma/client';

import { CurrentRateService } from './current-rate.service';
import { ExchangeRateService } from '../exchange-rate/exchange-rate.service';
import { Big } from 'big.js';

jest.mock('@ghostfolio/api/services/market-data.service', () => {
  return {
    MarketDataService: jest.fn().mockImplementation(() => {
      return {
        get: (date: Date, symbol: string) => {
          return Promise.resolve<MarketData>({
            date,
            symbol,
            createdAt: date,
            dataSource: DataSource.YAHOO,
            id: 'aefcbe3a-ee10-4c4f-9f2d-8ffad7b05584',
            marketPrice: 1847.839966
          });
        },
        getRange: ({
          dateRangeEnd,
          dateRangeStart,
          symbols
        }: {
          dateRangeEnd: Date;
          dateRangeStart: Date;
          symbols: string[];
        }) => {
          return Promise.resolve<MarketData[]>([
            {
              createdAt: dateRangeStart,
              dataSource: DataSource.YAHOO,
              date: dateRangeStart,
              id: '8fa48fde-f397-4b0d-adbc-fb940e830e6d',
              marketPrice: 1841.823902,
              symbol: symbols[0]
            },
            {
              createdAt: dateRangeEnd,
              dataSource: DataSource.YAHOO,
              date: dateRangeEnd,
              id: '082d6893-df27-4c91-8a5d-092e84315b56',
              marketPrice: 1847.839966,
              symbol: symbols[0]
            }
          ]);
        }
      };
    })
  };
});

jest.mock('@ghostfolio/api/services/exchange-rate-data.service', () => {
  return {
    ExchangeRateDataService: jest.fn().mockImplementation(() => {
      return {
        initialize: () => Promise.resolve(),
        toCurrency: (value: number) => {
          return 1 * value;
        }
      };
    })
  };
});

jest.mock('../exchange-rate/exchange-rate.service', () => {
  return {
    ExchangeRateService: jest.fn().mockImplementation(() => {
      return {
        getExchangeRates: ({
          dateQuery,
          sourceCurrencies,
          destinationCurrency
        }: {
          dateQuery: DateQuery;
          sourceCurrencies: Currency[];
          destinationCurrency: Currency;
        }) => {
          return [
            {
              date: new Date(),
              exchangeRates: {
                USD: new Big(1),
                CHF: new Big(1),
                EUR: new Big(1)
              }
            }
          ];
        }
      };
    })
  };
});

describe('CurrentRateService', () => {
  let currentRateService: CurrentRateService;
  let dataProviderService: DataProviderService;
  let exchangeRateDataService: ExchangeRateDataService;
  let marketDataService: MarketDataService;

  beforeAll(async () => {
    dataProviderService = new DataProviderService(null, [], null);
    exchangeRateDataService = new ExchangeRateDataService(null, null);
    marketDataService = new MarketDataService(null);

    await exchangeRateDataService.initialize();

    const exchangeRateService = new ExchangeRateService(null);
    currentRateService = new CurrentRateService(
      dataProviderService,
      exchangeRateDataService,
      marketDataService,
      exchangeRateService
    );
  });

  it('getValue', async () => {
    expect(
      await currentRateService.getValue({
        currency: 'USD',
        date: new Date(Date.UTC(2020, 0, 1, 0, 0, 0)),
        symbol: 'AMZN',
        userCurrency: 'CHF'
      })
    ).toMatchObject({
      marketPrice: 1847.839966
    });
  });

  it('getValues', async () => {
    expect(
      await currentRateService.getValues({
        currencies: { AMZN: 'USD' },
        dataGatheringItems: [{ dataSource: DataSource.YAHOO, symbol: 'AMZN' }],
        dateQuery: {
          lt: new Date(Date.UTC(2020, 0, 2, 0, 0, 0)),
          gte: new Date(Date.UTC(2020, 0, 1, 0, 0, 0))
        },
        userCurrency: 'CHF'
      })
    ).toMatchObject([
      {
        date: undefined,
        marketPrice: 1841.823902,
        symbol: 'AMZN'
      },
      {
        date: undefined,
        marketPrice: 1847.839966,
        symbol: 'AMZN'
      }
    ]);
  });
});
