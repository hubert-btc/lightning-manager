import * as _ from 'lodash';

import { getLNDriver, DecodedInvoice, LNPayment } from './ln-drivers';
import { getDBDriver } from './db-drivers';
import { setUpPaymentGenerators, RecurringPaymentOptions } from './payment-generators';

interface PaymentGeneratorConfig {
    type: 'recurring';
    options: RecurringPaymentOptions;
}

export interface PaymentGeneratorOptions {}

export {DecodedInvoice, LNPayment};

export const lightningManager = async (
    paymentGeneratorConfigs: PaymentGeneratorConfig[],
    LNDriverConfig: any,
    LNDriverLabel: string,
    dbDriverConfig: {[any: string]: any},
    dbDriverLabel: string,
    isMainnet?: boolean,
) => {
    const db = getDBDriver(dbDriverConfig, dbDriverLabel);
    const LN = getLNDriver(LNDriverLabel, LNDriverConfig);

    const creationAttemptResult = await db.create({
        tableName: 'payments',
        columns: [
            {
                name: 'destination',
                type: 'varchar(255)',
                notNull: true,
            },
            {
                name: 'invoice',
                type: 'varchar(255)',
            },
            {
                name: 'preimage',
                type: 'varchar(255)',
                notNull: true,
                isPrimaryKey: true,
            },
            {
                name: 'amount',
                type: 'int',
                notNull: true,
            },
            {
                name: 'timestamp',
                type: 'int',
                notNull: true,
            },
            {
                name: 'success',
                type: 'varchar(255)',
                notNull: true,
            },
            {
                name: 'error',
                type: 'varchar(10000)',
            },
        ],
        ifNotExists: true,
    });

    const paymentGenerators = paymentGeneratorConfigs.map((config: PaymentGeneratorConfig): any => {
        return setUpPaymentGenerators[config.type](LN, db, config.options);
    });

    return paymentGenerators;
};

// debug
lightningManager([{
    type: 'recurring',
        options: {
            recurringPayments: [{
                destination: '03193d512b010997885b232ecd6b300917e5288de8785d6d9f619a8952728c78e8',
                url: 'http://localhost:3030/invoice/new',
                period: 90 * 1000,
            }],
            checkInterval: '*/1 * * * *',
        },
    }],
    {
        host: 'localhost',
        port: '10009',
        password: 'testktestk',
    },
    'lnd-rpc', {
        dbPath: './test.db',
    },
    'SQLite',
    false,
);
