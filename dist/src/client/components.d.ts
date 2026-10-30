import * as React from 'react';
import type { Kind, Memory } from '../types.js';
import type { SettingsState } from './api.js';
export declare const memoryKindLabels: Record<Kind, string>;
export declare const selfKindLabels: Record<string, string>;
export declare const durabilityLabels: Record<string, string>;
export { moodLabels } from '../mood.js';
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
export declare function Toggle({ label, description, checked, disabled, pending, onChange, }: {
    label: string;
    description?: string;
    checked: boolean;
    disabled?: boolean;
    pending?: boolean;
    onChange: (checked: boolean) => void;
}): React.JSX.Element;
/** Five-cell pixel meter; used for activation (recency decay). */
export declare function PixelMeter({ value, label }: {
    value: number;
    label: string;
}): React.JSX.Element;
export declare function MemoryCard({ memory, state, compact, isNew, index, footer, }: {
    memory: Memory & {
        activation?: number;
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
