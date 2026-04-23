import type { AdapterEnvironmentTestContext, AdapterEnvironmentTestResult } from "@paperclipai/adapter-utils";
export interface CursorAuthInfo {
    email: string | null;
    displayName: string | null;
    userId: number | null;
}
export declare function cursorConfigPath(cursorHome?: string): string;
export declare function readCursorAuthInfo(cursorHome?: string): Promise<CursorAuthInfo | null>;
export declare function testEnvironment(ctx: AdapterEnvironmentTestContext): Promise<AdapterEnvironmentTestResult>;
//# sourceMappingURL=test.d.ts.map