use wasm_bindgen::prelude::*;

pub mod atlas;
pub mod image_ops;
pub mod layout;
pub mod types;

#[wasm_bindgen]
pub fn greet() -> String {
    "trimm-core WASM loaded".to_string()
}

#[wasm_bindgen]
pub fn generate_thumbnail(data: &[u8], max_size: u32) -> Result<Vec<u8>, JsValue> {
    image_ops::generate_thumbnail(data, max_size)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn check_collision(blocks_json: &str, new_block_json: &str) -> Result<bool, JsValue> {
    layout::check_collision_json(blocks_json, new_block_json)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

#[wasm_bindgen]
pub fn get_available_slots(
    blocks_json: &str,
    canvas_w: u32,
    canvas_h: u32,
    min_size: u32,
) -> Result<String, JsValue> {
    layout::get_available_slots_json(blocks_json, canvas_w, canvas_h, min_size)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Composite images onto an atlas canvas.
/// `layout_json`: JSON with canvas_width, canvas_height, blocks[{x,y,width,height,image_index}]
/// `image_data_ptrs`: flat array of image byte arrays concatenated, with `image_offsets` marking boundaries.
///
/// Since wasm-bindgen doesn't support Vec<Vec<u8>>, we pass a single flat buffer
/// and an offsets array to split it.
#[wasm_bindgen]
pub fn composite_atlas(
    layout_json: &str,
    flat_images: &[u8],
    offsets_json: &str,
) -> Result<Vec<u8>, JsValue> {
    let offsets: Vec<usize> =
        serde_json::from_str(offsets_json).map_err(|e| JsValue::from_str(&e.to_string()))?;

    // Split flat_images into individual image buffers using offsets
    let mut images: Vec<&[u8]> = Vec::new();
    for i in 0..offsets.len() {
        let start = if i == 0 { 0 } else { offsets[i - 1] };
        let end = offsets[i];
        if end <= flat_images.len() {
            images.push(&flat_images[start..end]);
        }
    }

    atlas::composite_atlas(layout_json, &images)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Auto-pack items into a canvas using MaxRects algorithm.
/// `items_json`: JSON array of {id, width, height}
/// Returns JSON array of {id, x, y, width, height, placed}
#[wasm_bindgen]
pub fn auto_pack(
    items_json: &str,
    canvas_w: u32,
    canvas_h: u32,
    padding: u32,
) -> Result<String, JsValue> {
    layout::auto_pack_json(items_json, canvas_w, canvas_h, padding)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}
