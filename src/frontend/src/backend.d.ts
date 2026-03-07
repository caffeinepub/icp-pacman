import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Time = bigint;
export interface ScoreEntry {
    principal: Principal;
    score: bigint;
    timestamp: Time;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getAdminStats(): Promise<{
        countdownTarget: bigint;
        jackpotBalance: bigint;
        totalPlays: bigint;
    }>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCountdownTarget(): Promise<bigint>;
    getJackpotBalance(): Promise<bigint>;
    getLeaderboard(): Promise<Array<ScoreEntry>>;
    getPayoutWallet(): Promise<Principal | null>;
    getTotalPlays(): Promise<bigint>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setCountdown(target: bigint): Promise<void>;
    setPayoutWallet(wallet: Principal): Promise<void>;
    startGame(): Promise<{
        ok: boolean;
        message: string;
    }>;
    submitScore(score: bigint): Promise<void>;
    triggerPayout(): Promise<{
        ok: boolean;
        message: string;
        amount: bigint;
    }>;
}
