import LND from './lnd-rpc';

export interface DecodedInvoice {
    destination: string;
    payment_hash: string;
    amount?: number;
    timestamp?: number;
    expiry?: number;
    description?: string;
    fallback_address?: string;
}

export interface WishToReceive {
    invoice: string;
    decodedInvoice: DecodedInvoice;
}

export interface LNPayment extends WishToReceive {
    customAmount?: number;
}

export interface LNPaymentResult {
    payment: {
        destination: string;
        invoice: string;
        preimage: string;
        amount: number;
        timestamp: number
    };
    success: boolean;
    error: any;
}

export abstract class LNDriver {
    public abstract async send(payment: LNPayment): Promise<LNPaymentResult>;

    public abstract async decodeInvoice(invoice: string): Promise<DecodedInvoice>;
}

function getLNDriver(label: string, config: any): LNDriver {
    switch (label) {
        case 'lnd-rpc':
            return new LND(config);
        default:
            throw({error: `LN driver '${label}' not found`});
    }
}

export { getLNDriver };
