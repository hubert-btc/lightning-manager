import * as grpc from 'grpc';
import * as fs from 'fs';

export interface LndRPCConnectorConfig {
    host: string;
    port: number;
    password: string;
}

export const lndRPCConnectorFactory = (config: LndRPCConnectorConfig) => {
    let credentials: any = null;
    let lightning: any = null;

    let isInit: boolean = false;
    let isUnlocked: boolean = false;
    let lightningRPCIsInit: boolean = false;

    const url = `${config.host}:${config.port}`;

    const init = () => {
        // to solve issue https://github.com/grpc/grpc/issues/14489
        process.env.GRPC_SSL_CIPHER_SUITES = 'HIGH+ECDSA';

        const lndCert = fs.readFileSync('./ressources/tls.cert');
        credentials = grpc.credentials.createSsl(lndCert);
        isInit = true;
    };

    const unlock = () => {
        const lndrpc = getLndrpc();
        const walletUnlocker = new lndrpc.WalletUnlocker(url, credentials);

        walletUnlocker.unlockWallet({
            wallet_password: Buffer.from(config.password),
        }, (err: any, result: any) => {
            isUnlocked = true;
        });
    };

    const initLightningRPC = () => {
        const lndrpc = getLndrpc();
        lightning = new lndrpc.Lightning(url, credentials);
        lightningRPCIsInit = true;
    };

    const getLndrpc = () => {
        const lndrpcDescriptor = grpc.load('./ressources/rpc.proto');

        return lndrpcDescriptor.lnrpc;
    };

    const prepareForCommand = async () => {
        if (!isInit) {
            await init();
        }

        if (!isUnlocked) {
            await unlock();
        }

        if (!lightningRPCIsInit) {
            await initLightningRPC();
        }
    };

    const runCommand = async (command: string, parameters: any): Promise<any> => {
        await prepareForCommand();

        return new Promise((resolve, fail) => {
            if (lightning[command].responseStream) {
                const call = lightning[command]();

                call.on('data', (data: any) => {
                    resolve(data);
                });

                call.write(parameters);
            } else {
                lightning[command](parameters, (err: any, result: any) => {
                    resolve(result);
                });
            }
        });
    };

    return {
        runCommand,
    };
};
