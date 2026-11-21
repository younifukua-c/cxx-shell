import type {ProcessRecord,Environment} from '../index.cjs';
export function createMigrationGuard(options:{environment:Pick<Environment,'mode'|'layout'>;applicationName:string;pid?:number;listOwned():{kind:string}[];listProcesses():Promise<ProcessRecord[]>}):()=>Promise<void>;
export function legacyWriters(processes:ProcessRecord[],applicationName:string,pid?:number):ProcessRecord[];
