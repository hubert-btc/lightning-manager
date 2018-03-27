import SQLiteFactory from './SQLite';

interface DbDriver {
    find: (query: {[any: string]: any}) => Promise<{result: Array<{[any: string]: any}>, error: {[any: string]: any}}>;
    write: (query: {[any: string]: any}) => Promise<{success: boolean, error: {[any: string]: any}}>;
    create: (query: {[any: string]: any}) => Promise<{success: boolean, error: {[any: string]: any}}>;
    delete: (query: {[any: string]: any}) => Promise<{success: boolean, error: {[any: string]: any}}>;
}

export const getDBDriver = (config: {[any: string]: any}, label: string): DbDriver => {
    switch (label) {
        case 'SQLite':
            return SQLiteFactory(config);
        default:
            throw({error: `database '${label}' not found`});
    }
};
