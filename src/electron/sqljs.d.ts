declare module 'sql.js' {
  export type Database = {
    run(sql: string): void;
    exec(sql: string): Array<{
      values: unknown[][];
    }>;
    prepare(sql: string): {
      bind(params: unknown[]): void;
      step(): boolean;
      getAsObject(): Record<string, unknown>;
      run(params: unknown[]): void;
      free(): void;
    };
    export(): Uint8Array;
  };

  export default function initSqlJs(options: { locateFile: (file: string) => string }): Promise<{
    Database: new (data?: Uint8Array) => Database;
  }>;
}
