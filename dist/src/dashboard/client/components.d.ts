import * as React from 'react';
import type { Kind, Memory, Presence } from '../../memory/index.js';
import type { SettingsState } from '../contracts.js';
export declare const memoryKindLabels: Record<Kind, string>;
export declare const selfKindLabels: Record<string, string>;
export { moodLabels } from '../../emotion/index.js';
/** Placeholder names from older versions are shown as "not named yet" rather than as a code-ish label. */
export declare function displayName(name: string | undefined): string;
declare const pixelGlyphs: {
    readonly fish: readonly ["............", "...####.....", "..######..##", ".########.##", "##.#######.#", "##########..", "##########..", ".##########.", "..######..##", "...####...##", "............", "............"];
    readonly overview: readonly ["............", ".####..####.", ".####..####.", ".####..####.", ".####..####.", "............", "............", ".####..####.", ".####..####.", ".####..####.", ".####..####.", "............"];
    readonly memories: readonly ["............", ".#########..", ".#.......#..", ".#.#####.#..", ".#.......#..", ".#.#####.#..", ".#.......#..", ".#.###...#..", ".#.......#..", ".#########..", "..#########.", "............"];
    readonly settings: readonly [".....##.....", "..#.####.#..", ".##########.", "..###..###..", ".###....###.", "####....####", "####....####", ".###....###.", "..###..###..", ".##########.", "..#.####.#..", ".....##....."];
    readonly refresh: readonly ["............", "....####.#..", "..##....##..", ".#.....###..", ".#..........", "#...........", "#...........", ".#.......#..", ".#.......#..", "..##....#...", "....####....", "............"];
    readonly cognition: readonly [".....##.....", "....#..#....", "...#....#...", "..#......#..", ".#........#.", "#....##....#", "#....##....#", ".#........#.", "..#......#..", "...#....#...", "....#..#....", ".....##....."];
    readonly experience: readonly ["............", ".##########.", ".#........#.", ".#.######.#.", ".#........#.", ".#.######.#.", ".#........#.", ".#.####...#.", ".#........#.", ".##########.", "............", "............"];
    readonly resonance: readonly ["............", ".###...###..", "#####.#####.", "###########.", "###########.", ".#########..", "..#######...", "...#####....", "....###.....", ".....#......", "............", "............"];
    readonly self: readonly [".....#......", ".....#......", "....###.....", "....###.....", ".#########..", "...#####....", "....###.....", "....#.#.....", "...#...#....", "..#.....#...", "............", "............"];
    readonly search: readonly ["............", "..####......", ".#....#.....", "#......#....", "#......#....", "#......#....", "#......#....", ".#....#.....", "..#####.....", "......###...", ".......###..", "........##.."];
    readonly download: readonly [".....##.....", ".....##.....", ".....##.....", ".....##.....", "..########..", "...######...", "....####....", ".....##.....", "............", "#..........#", "#..........#", "############"];
    readonly close: readonly ["............", ".##......##.", "..##....##..", "...##..##...", "....####....", ".....##.....", "....####....", "...##..##...", "..##....##..", ".##......##.", "............", "............"];
};
export type PixelGlyph = keyof typeof pixelGlyphs;
export declare function PixelIcon({ name, size, className, }: {
    name: PixelGlyph;
    size?: number;
    className?: string;
}): React.JSX.Element;
export declare function EmptyState({ title, children }: {
    title: string;
    children?: React.ReactNode;
}): React.JSX.Element;
export declare function Toggle({ label, description, checked, disabled, pending, inactive, className, onChange, }: {
    label: string;
    description?: string;
    checked: boolean;
    disabled?: boolean;
    pending?: boolean;
    /** Shown but not in effect, e.g. while the master switch is off. */
    inactive?: boolean;
    className?: string;
    onChange: (checked: boolean) => void;
}): React.JSX.Element;
/**
 * One answer to "will this memory affect a conversation?", in place of the old
 * stated/guessed, precious and clarity marks that each described an internal field.
 */
/**
 * What background organizing is doing. A pending job that already carries an error failed once
 * and waits for its automatic retry; only "failed" needs the user.
 */
export declare function learningActivity(jobs: SettingsState['jobs']): {
    working: number;
    retrying: number;
    failed: number;
    reason: string;
};
export declare const presenceLabels: Record<Presence, {
    label: string;
    hint: string;
}>;
export declare function PresenceTag({ presence }: {
    presence?: Presence;
}): React.JSX.Element | null;
export declare function MemoryCard({ memory, compact, isNew, index, footer, }: {
    memory: Memory & {
        presence?: Presence;
    };
    state: SettingsState;
    compact?: boolean;
    isNew?: boolean;
    index?: number;
    footer?: React.ReactNode;
}): React.JSX.Element;
/**
 * Remembers which memory ids were present on the previous snapshot so newly
 * learned memories can flash once. Nothing is "new" on the first render.
 */
export declare function useNewMemoryIds(state: SettingsState): Set<string>;
