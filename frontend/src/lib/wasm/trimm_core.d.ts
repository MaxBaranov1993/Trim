/* tslint:disable */
/* eslint-disable */

/**
 * Auto-pack items into a canvas using MaxRects algorithm.
 * `items_json`: JSON array of {id, width, height}
 * Returns JSON array of {id, x, y, width, height, placed}
 */
export function auto_pack(items_json: string, canvas_w: number, canvas_h: number, padding: number): string;

export function check_collision(blocks_json: string, new_block_json: string): boolean;

/**
 * Composite images onto an atlas canvas.
 * `layout_json`: JSON with canvas_width, canvas_height, blocks[{x,y,width,height,image_index}]
 * `image_data_ptrs`: flat array of image byte arrays concatenated, with `image_offsets` marking boundaries.
 *
 * Since wasm-bindgen doesn't support Vec<Vec<u8>>, we pass a single flat buffer
 * and an offsets array to split it.
 */
export function composite_atlas(layout_json: string, flat_images: Uint8Array, offsets_json: string): Uint8Array;

export function generate_thumbnail(data: Uint8Array, max_size: number): Uint8Array;

export function get_available_slots(blocks_json: string, canvas_w: number, canvas_h: number, min_size: number): string;

export function greet(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly auto_pack: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly check_collision: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly composite_atlas: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly generate_thumbnail: (a: number, b: number, c: number) => [number, number, number, number];
    readonly get_available_slots: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly greet: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
