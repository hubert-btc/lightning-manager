## !! Work in progress - do not use with real money !!

**Lightning Manager** is a npm package to make LN payments defined by custom logic (recurring payments, pay if some condition is met...).

It exports a factory (`lightningManager`), which accepts as arguments a list of configurations for payment generators (`paymentGeneratorConfigs`); each `paymentGeneratorConfig` is a set of instruction to set up a programmatic stream of LN payments.

Payment generators are in the folder `payment-generators`); persistence is handled by database drivers in `db-drivers` and interaction with the LN is handled by LN daemon drivers in `ln-drivers`.

**Here's what's been implemented so far:**

payment-generators:
- `recurringPayments`: generates a stream of regularly recurring payments

ln-driver:
- [lnd](https://github.com/lightningnetwork/lnd) (through its RPC interface)

db-drivers:
- [SQLite](https://www.sqlite.org/index.html)

Feel free to add new kinds of payment generators, as well as new drivers to interact with other databases and LN daemons. I'll try to document proper interface contracts for them to follow, so as to make those additions easier.

## Todo before using on mainnet:
- stricter checks on inputs, perhaps using Joi?
- improve error handling
- error logging
- unit and integration tests (of drivers, payment generators and core logic)