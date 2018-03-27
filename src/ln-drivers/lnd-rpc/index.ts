import * as _ from 'lodash';
import * as bytebuffer from 'bytebuffer';
import { LNDriver, DecodedInvoice, LNPayment, LNPaymentResult } from './..';
import { LndRPCConnectorConfig, lndRPCConnectorFactory } from './lnd-rpc-connector';

export default class LND implements LNDriver {
    private config: LndRPCConnectorConfig;
    private connector: any;

    constructor(config: LndRPCConnectorConfig) {
        this.config = config;
        this.connector = lndRPCConnectorFactory({
            host: config.host,
            port: config.port,
            password: config.password,
        });
    }

    public async send(payment: LNPayment): Promise<LNPaymentResult> {
        const amountToSend = payment.customAmount ?
            payment.customAmount : payment.decodedInvoice.amount;

        const paymentResult = await this.connector.runCommand('sendPayment', {
            dest: bytebuffer.fromHex(payment.decodedInvoice.destination),
            payment_hash: bytebuffer.fromHex(payment.decodedInvoice.payment_hash),
            amt: amountToSend,
            final_cltv_delta: _.toInteger(payment.decodedInvoice.expiry),
        });
        /*const paymentResult = {
            payment_preimage: String(Math.random()),
            amount: amountToSend,
            payment_error: '',
        };*/

        return {
            payment: {
                destination: payment.decodedInvoice.destination,
                invoice: payment.invoice,
                preimage: paymentResult.payment_preimage/*String(Math.random())*/,
                amount: paymentResult.amount,
                timestamp: Date.now(),
            },
            success: true,
            error: paymentResult.payment_error,
        };
    }

    public async decodeInvoice(invoice: string): Promise<DecodedInvoice> {
        const decodeInvoiceResult = await this.connector.runCommand('decodePayReq', invoice);

        /*const decodeInvoiceResult = {
            destination: '0.9499146919372147',
            payment_hash: String(Math.random()),
            num_satoshis: 10170,
            timestamp: 1000,
            cltv_expiry: 144,
            description: 'panini',
            fallback_addr: 'abcdefgh',
        };*/

        return {
            destination: decodeInvoiceResult.destination,
            payment_hash: decodeInvoiceResult.payment_hash,
            amount: decodeInvoiceResult.num_satoshis,
            timestamp: decodeInvoiceResult.timestamp,
            expiry: decodeInvoiceResult.cltv_expiry,
            description: decodeInvoiceResult.description,
            fallback_address: decodeInvoiceResult.fallback_addr,
        };
    }
}
