/**
 * Pack installation service — loads pack manifest and calls installer.
 */
import type { Db } from "@paperclipai/db";
import type { PackManifest } from "../packs/types.js";
import type { Queue } from "bullmq";
export declare function packInstallService(db: Db, agentQueue: Queue, systemQueue: Queue): {
    loadPackManifest: (packSlug: string) => Promise<PackManifest>;
    listAvailablePacks: () => Promise<Array<{
        slug: string;
        name: string;
        version: string;
        description: string;
        tagline: string;
        estimated_setup_minutes: number;
        value_proposition: string[];
    }>>;
    install: (companyId: string, packSlug: string, variables?: Record<string, string>) => Promise<import("../packs/types.js").InstallPackResult>;
};
//# sourceMappingURL=pack-install-service.d.ts.map