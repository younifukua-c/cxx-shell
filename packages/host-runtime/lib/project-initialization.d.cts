export interface ProjectIdentity { id: string; name: string; path: string; [key: string]: unknown }
export interface ProjectRequirement { key: string; label: string; description?: string }
export interface ProjectApplicationState { id: string; name: string; status: 'pending'|'running'|'ready'|'needs-configuration'|'failed'|'not-supported'; message: string; code?: string; requirements?: ProjectRequirement[] }
export interface ProjectInitializationState { projectId: string; path: string; applications: ProjectApplicationState[] }
export interface ProjectModule {
 id: string; name: string; enabled: boolean;
 initialize?(project: ProjectIdentity, configuration: Record<string, unknown>, signal: AbortSignal): Promise<{ success?: boolean; status?: 'needs-configuration'|'not-supported'; message?: string; error?: string; code?: string; requirements?: ProjectRequirement[] }|void>;
}
/** 共享项目生命周期；存储由宿主注入，应用不能回滚基础项目或其他应用。 */
export declare function createProjectInitialization(options: {
 load(id: string): ProjectInitializationState|undefined;
 save(id: string, state: ProjectInitializationState): void|Promise<void>;
 listApplications(): ProjectModule[]|Promise<ProjectModule[]>;
 onChange?(state: ProjectInitializationState): void; timeoutMs?: number;
}): { initialize(project: ProjectIdentity, input?: {applicationId?: string; configuration?: Record<string, unknown>}): Promise<ProjectInitializationState>; snapshot(project: ProjectIdentity): ProjectInitializationState; destroy(): void };
