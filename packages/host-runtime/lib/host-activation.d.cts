import type {Environment} from '../index.cjs';
export function activateHost(options:{environment:Environment;applicationId:string;timeoutMs?:number}):Promise<boolean>;
