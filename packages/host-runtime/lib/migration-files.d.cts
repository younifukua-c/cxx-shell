import type {FileSystemPort,MigrationMapping} from '../index.cjs';
export interface FileSnapshot {source:string;destination:string;size:number;digest:string}
export function inventory(mappings:MigrationMapping[],targetRoot:string,fileSystem?:FileSystemPort,exclude?:string[]):Promise<FileSnapshot[]>;
export function copyVerified(item:FileSnapshot,fileSystem?:FileSystemPort):Promise<void>;
export function cleanupFiles(items:FileSnapshot[],sourceRoots:string[],canCleanup?:(source:string)=>boolean|{directory:string},fileSystem?:FileSystemPort):Promise<{path:string;code:string;message:string}[]>;
