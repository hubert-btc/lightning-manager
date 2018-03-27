import * as Cron from 'cron';
import * as requestPromise from 'request-promise';
import { DecodedInvoice, LNPayment, PaymentGeneratorOptions } from '../../';

export interface RecurringPaymentOptions extends PaymentGeneratorOptions {
    recurringPayments: RecurringPayment[];
    checkInterval: string | IntervalConfig;
}

export interface LNNode {
    destination: string;
    url: string;
}

export interface WishToSend {
    destination: string;
    amount?: number;
}

export interface Periodic {
    period: number;
}

export type RecurringPayment = LNNode&WishToSend&Periodic;

export interface IntervalConfig {
    intervalNumber: number;
    intervalUnit: 'minute' | 'hour' | 'day';
}

const schedule = (f: () => void, intervalConfig: string | IntervalConfig) => {
    let cronStr = '';

    if (typeof(intervalConfig) === 'string') {
        cronStr = intervalConfig;
    } else {
        cronStr = toCronStr(intervalConfig);
    }

    const job = new Cron.CronJob(cronStr, f);
    job.start();

    return job;
};

const toCronStr = (intervalConfig: IntervalConfig): string => {
    const {intervalNumber, intervalUnit} = intervalConfig;

    let str = '* ';

    if (intervalUnit === 'minute') {
        str += `/${intervalNumber} *`;
    } else if (intervalUnit === 'hour') {
        str += `* /${intervalNumber}`;
    }

    str += ' * * *';

    return str;
};

export const setUpRecurringPayment = (LN: any, db: any, options: RecurringPaymentOptions): any => {
    const {recurringPayments, checkInterval} = options;

    const job = schedule(async () => {
        const duePayments: RecurringPayment[] = (await Promise.all(recurringPayments
            .map((recurringPayment: RecurringPayment): Promise<RecurringPayment> => {

            return new Promise(async (resolve, fail) => {
                const result: {result: Array<{[any: string]: any}>, error: {[any: string]: any}} = await db.find({
                    table: 'payments',
                    fields: ['*'],
                    conditions: {
                        destination: recurringPayment.destination,
                        success: 'true',
                    }, order: [{
                        column: 'timestamp',
                        direction: 'DESC',
                    }],
                    limit: 1,
                });

                if (result.result.length === 0) {
                    resolve(recurringPayment);
                } else {
                    const lastGiftTimestamp: number = parseInt(result.result[0].timestamp, 10);
                    resolve(Date.now() - lastGiftTimestamp > recurringPayment.period ? recurringPayment : null);
                }
            });
        }))).filter((p: RecurringPayment|boolean) => p !== null);

        await Promise.all(duePayments
            .map(async (duePayment: RecurringPayment) => {

                return await new Promise<LNPayment>(async (resolve, fail): Promise<void> => {
                    const payment: LNPayment = await new Promise<LNPayment>(async (resolve1, fail1) => {
                        const getInvoiceResult = await requestPromise.get(duePayment.url);

                        const invoice = JSON.parse(getInvoiceResult).invoice;
                        const decodedInvoice: DecodedInvoice = await LN.decodeInvoice(invoice);

                        if (decodedInvoice.destination !== duePayment.destination) {
                            fail(`Invoice's destination is different`);

                            return;
                        }

                        const actualPayment: LNPayment = {invoice, decodedInvoice};

                        if (decodedInvoice.amount === undefined) {
                            actualPayment.customAmount = duePayment.amount;
                        } else if (duePayment.amount !== undefined && decodedInvoice.amount !== duePayment.amount) {
                            fail(`Invoice's amount is different`);

                            return;
                        }

                        resolve1(actualPayment);

                        return actualPayment;
                    });

                    const sendResult = await LN.send(payment);
                    const toWrite = {
                        invoice: sendResult.payment ? sendResult.payment.invoice : null,
                        destination: sendResult.payment ? sendResult.payment.destination : null,
                        preimage: sendResult.payment ? sendResult.payment.preimage : null,
                        amount: sendResult.payment ? sendResult.payment.amount : null,
                        timestamp: sendResult.payment ? sendResult.payment.timestamp : null,
                        success: String(sendResult.success),
                        error: sendResult.error ? JSON.stringify(sendResult.error) : null,
                    };

                    await db.write({table: 'payments', data: toWrite});
                    resolve();
                });
        }));
    }, checkInterval);

    return job;
};
