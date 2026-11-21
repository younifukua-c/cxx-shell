import type {ProcessRecord} from '../index.cjs';
export function listProcesses():Promise<ProcessRecord[]>;
export function listProcessesSync():ProcessRecord[];
