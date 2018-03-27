import * as sqlite3 from 'sqlite3';
import * as _ from 'lodash';
import * as joi from 'joi';
import * as flatten from 'flat';

interface SelectQueryAsJSON {
    table: string;
    fields: string | string[];
    conditions?: {[any: string]: any};
    order?: Order[];
    limit?: number;
}

interface Order {
    column: string;
    direction: 'ASC' | 'DESC';
}
interface InsertQueryAsJSON {
    table: string;
    data: {[any: string]: any};
}

interface CreateQueryAsJSON {
    tableName: string;
    columns: Column[];
    ifNotExists?: boolean;
}

interface Column {
    name: string;
    type: string;
    notNull?: boolean;
    isPrimaryKey?: boolean;
}

interface DropQueryAsJSON {
    tableName: string;
}

const SelectQueryAsJSONSchema = joi.object().keys({
    table: joi.string().required(),
    fields: joi.array().items(joi.string()).required(),
    conditions: joi.object().optional(),
    order: joi.array().items(joi.object().keys({
        column: joi.string().required(),
        direction: joi.string().required(),
    })).optional(),
    limit: joi.number().optional(),
});

const InsertQueryAsJSONSchema = joi.object().keys({
    table: joi.string().required(),
    data: joi.object().required(),
});

const CreateQueryAsJSONSchema = joi.object().keys({
    tableName: joi.string().required(),
    columns: joi.array().items(joi.object().keys({
        name: joi.string().required(),
        type: joi.string().required(),
        notNull: joi.boolean().optional(),
        isPrimaryKey: joi.boolean().optional(),
    })).required(),
    ifNotExists: joi.boolean().optional(),
});

const DropQueryAsJSONSchema = joi.object().keys({
    tableName: joi.string().required(),
});

const SQLiteFactory = (config: {[any: string]: any}) => {
    const db = new sqlite3.Database(config.dbPath);

    const formatSelectQuery = (query: SelectQueryAsJSON):
    {queryStr: string | null, error: {errorMessage: string, errorData: any} | null} => {
        const queryValidationResult = SelectQueryAsJSONSchema.validate(query);

        if (queryValidationResult.error !== null) {
            return {
                queryStr: null,
                error: {
                    errorMessage: 'JSON SELECT query object is invalid',
                    errorData: queryValidationResult.error,
                },
            };
        }

        let str = 'SELECT ';

        if (_.isArray(query.fields)) {
            str += query.fields.join(',');
        }

        str += ` FROM ${query.table}`;

        if (query.conditions !== undefined && _.keys(query.conditions).length > 0) {
            const whereBits: string[] = [];
            _.forOwn(query.conditions, (value, key) => {
                whereBits.push(`${key} = '${value}'`);
            });

            const where = whereBits.join(' AND ');
            str += ` WHERE ${where}`;
        }

        if (query.order !== undefined && query.order.length > 0) {
            str += ` ORDER BY ${query.order.map((o: Order)  => o.column + ' ' + o.direction).join(', ')}`;
        }

        if (query.limit) {
            str += ` LIMIT ${query.limit}`;
        }

        return {queryStr: str + ';', error: null};
    };

    const formatInsertQuery = (query: InsertQueryAsJSON):
    {queryStr: string | null, error: {errorMessage: string, errorData: any} | null} => {
        const queryValidationResult = InsertQueryAsJSONSchema.validate(query);

        if (queryValidationResult.error !== null) {
            return {
                queryStr: null,
                error: {
                    errorMessage: 'JSON INSERT query object is invalid',
                    errorData: queryValidationResult.error,
                },
            };
        }

        let str = 'INSERT INTO ';

        str += query.table;

        const flattenData = flatten(query.data);

        str += ` (${_.keys(flattenData).join(', ')}) VALUES (${_.values(flattenData).map(v => `"${v}"`).join(', ')})`;

        return {queryStr: str + ';', error: null};
    };

    const formatCreateQuery = (query: CreateQueryAsJSON):
    {queryStr: string | null, error: {errorMessage: string, errorData: any} | null} => {
        const queryValidationResult = CreateQueryAsJSONSchema.validate(query);

        if (queryValidationResult.error !== null) {
            return {
                queryStr: null,
                error: {
                    errorMessage: 'JSON CREATE query object is invalid',
                    errorData: queryValidationResult.error,
                },
            };
        }

        let str = 'CREATE TABLE ';

        if (query.ifNotExists) {
            str += 'if not exists ';
        }

        str += `${query.tableName}`;

        const processedColumns = query.columns.reduce((alreadyProcessedColumns, currentColumn) => {
            let processedColumn = `${currentColumn.name} ${currentColumn.type}`;

            if (currentColumn.notNull) {
                processedColumn += ' NOT NULL';
            }

            alreadyProcessedColumns.columns.push(processedColumn);

            if (currentColumn.isPrimaryKey) {
                alreadyProcessedColumns.primaryKeys.push(currentColumn.name);
            }

            return alreadyProcessedColumns;
        }, {columns: [], primaryKeys: []});

        str += ` (${processedColumns.columns.join(', ')}`;

        if (processedColumns.primaryKeys.length > 0) {
            str += `, PRIMARY KEY (${processedColumns.primaryKeys.join(', ')})`;
        }

        str += ')';

        return {queryStr: str + ';', error: null};
    };

    const formatDropQuery = (query: DropQueryAsJSON):
    {queryStr: string | null, error: {errorMessage: string, errorData: any} | null} => {
        const queryValidationResult = DropQueryAsJSONSchema.validate(query);

        if (queryValidationResult.error !== null) {
            return {
                queryStr: null,
                error: {
                    errorMessage: 'JSON DROP query object is invalid',
                    errorData: queryValidationResult.error,
                },
            };
        }

        let str = 'DROP TABLE ';

        str += `${query.tableName}`;

        return {queryStr: str + ';', error: null};
    };

    return {
        find: async (
            query: SelectQueryAsJSON,
        ): Promise<{result: Array<{[any: string]: any}>, error: {[any: string]: any}}> => {
            const rows: Array<{[any: string]: any}> = await new Promise((resolve, fail) => {
                const formattingResult = formatSelectQuery(query);

                if (formattingResult.error) {
                    return fail(formattingResult.error);
                }

                db.all(formattingResult.queryStr, (err, row: {[any: string]: any}) => {
                    if (err) {
                        fail(err);
                    }

                    resolve(row);
                });
            }) as Array<{[any: string]: any}>;

            return {result: rows, error: null};
        },
        write: async (query: InsertQueryAsJSON): Promise<{success: boolean, error: {[any: string]: any}}> => {
            await new Promise((resolve, fail) => {
                const formattingResult = formatInsertQuery(query);

                if (formattingResult.error) {
                    return fail(formattingResult.error);
                }

                db.run(formattingResult.queryStr, (err: Error | null) => {
                    if (err) {
                        fail(err);
                    }

                    resolve();
                });
            });

            return {success: true, error: null};
        },
        create: async (query: CreateQueryAsJSON): Promise<{success: boolean, error: {[any: string]: any}}> => {
            const formattingResult = formatCreateQuery(query);

            await new Promise((resolve, fail) => {
                db.run(formattingResult.queryStr, (err: Error | null, row: {[any: string]: any}) => {
                    if (err) {
                        fail(err);
                    }

                    resolve(row);
                });
            });

            return {success: true, error: null};
        },
        delete: async (query: DropQueryAsJSON): Promise<{success: boolean, error: {[any: string]: any}}> => {
            const formattingResult = formatDropQuery(query);

            await new Promise((resolve, fail) => {
                db.run(formattingResult.queryStr, (err: Error | null, row: {[any: string]: any}) => {
                    if (err) {
                        fail(err);
                    }

                    resolve(row);
                });
            });

            return {success: true, error: null};
        },
        testIfTableExists: async (query: DropQueryAsJSON): Promise<{success: boolean, error: {[any: string]: any}}> => {
            const queryStr = `SELECT EXISTS(SELECT * FROM ${query.tableName})`;

            await new Promise((resolve, fail) => {
                db.run(queryStr, (err: Error | null, row: {[any: string]: any}) => {
                    if (err) {
                        fail(err);
                    }

                    resolve(row);
                });
            });

            return {success: true, error: null};
        },
    };
};

export default SQLiteFactory;
