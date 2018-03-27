import { setUpRecurringPayment } from './recurring-payment';

export { RecurringPaymentOptions } from './recurring-payment';

export const setUpPaymentGenerators = {
    recurring: setUpRecurringPayment,
};
