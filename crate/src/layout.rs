use crate::types::{Block, Slot};
use serde::{Deserialize, Serialize};

fn blocks_overlap(a: &Block, b: &Block) -> bool {
    a.x < b.x + b.width
        && a.x + a.width > b.x
        && a.y < b.y + b.height
        && a.y + a.height > b.y
}

pub fn check_collision(blocks: &[Block], new_block: &Block) -> bool {
    blocks
        .iter()
        .any(|b| b.id != new_block.id && blocks_overlap(b, new_block))
}

pub fn check_collision_json(
    blocks_json: &str,
    new_block_json: &str,
) -> Result<bool, Box<dyn std::error::Error>> {
    let blocks: Vec<Block> = serde_json::from_str(blocks_json)?;
    let new_block: Block = serde_json::from_str(new_block_json)?;
    Ok(check_collision(&blocks, &new_block))
}

pub fn get_available_slots(
    blocks: &[Block],
    canvas_w: u32,
    canvas_h: u32,
    min_size: u32,
) -> Vec<Slot> {
    let mut slots = Vec::new();
    let step = min_size;

    let mut y = 0;
    while y < canvas_h {
        let mut x = 0;
        while x < canvas_w {
            let test = Block {
                id: String::new(),
                x,
                y,
                width: step,
                height: step,
            };

            if !check_collision(blocks, &test) {
                let mut max_w = step;
                while x + max_w + step <= canvas_w {
                    let wider = Block {
                        id: String::new(),
                        x,
                        y,
                        width: max_w + step,
                        height: step,
                    };
                    if check_collision(blocks, &wider) {
                        break;
                    }
                    max_w += step;
                }

                let mut max_h = step;
                while y + max_h + step <= canvas_h {
                    let taller = Block {
                        id: String::new(),
                        x,
                        y,
                        width: step,
                        height: max_h + step,
                    };
                    if check_collision(blocks, &taller) {
                        break;
                    }
                    max_h += step;
                }

                slots.push(Slot {
                    x,
                    y,
                    max_width: max_w,
                    max_height: max_h,
                });
            }

            x += step;
        }
        y += step;
    }

    slots
}

pub fn get_available_slots_json(
    blocks_json: &str,
    canvas_w: u32,
    canvas_h: u32,
    min_size: u32,
) -> Result<String, Box<dyn std::error::Error>> {
    let blocks: Vec<Block> = serde_json::from_str(blocks_json)?;
    let slots = get_available_slots(&blocks, canvas_w, canvas_h, min_size);
    Ok(serde_json::to_string(&slots)?)
}

// --- MaxRects Bin Packing ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackItem {
    pub id: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackResult {
    pub id: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub placed: bool,
}

#[derive(Debug, Clone)]
struct Rect {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
}

/// MaxRects bin packing algorithm.
/// Items are snapped to the nearest power-of-two size.
/// Padding is added around each placed block.
pub fn auto_pack(
    items: &[PackItem],
    canvas_w: u32,
    canvas_h: u32,
    padding: u32,
) -> Vec<PackResult> {
    // Sort items by area descending (larger items first)
    let mut sorted: Vec<(usize, &PackItem)> = items.iter().enumerate().collect();
    sorted.sort_by(|a, b| {
        let area_a = a.1.width as u64 * a.1.height as u64;
        let area_b = b.1.width as u64 * b.1.height as u64;
        area_b.cmp(&area_a)
    });

    let mut free_rects = vec![Rect {
        x: 0,
        y: 0,
        width: canvas_w,
        height: canvas_h,
    }];

    let mut results = vec![
        PackResult {
            id: String::new(),
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            placed: false,
        };
        items.len()
    ];

    for (orig_idx, item) in &sorted {
        let padded_w = item.width + padding * 2;
        let padded_h = item.height + padding * 2;

        // Find best free rect (Best Short Side Fit)
        let mut best_rect_idx = None;
        let mut best_short_side = u32::MAX;
        let mut best_x = 0u32;
        let mut best_y = 0u32;

        for (i, rect) in free_rects.iter().enumerate() {
            if padded_w <= rect.width && padded_h <= rect.height {
                let leftover_w = rect.width - padded_w;
                let leftover_h = rect.height - padded_h;
                let short_side = leftover_w.min(leftover_h);

                if short_side < best_short_side {
                    best_short_side = short_side;
                    best_rect_idx = Some(i);
                    best_x = rect.x + padding;
                    best_y = rect.y + padding;
                }
            }
        }

        if let Some(_rect_idx) = best_rect_idx {
            // Place the item
            results[*orig_idx] = PackResult {
                id: item.id.clone(),
                x: best_x,
                y: best_y,
                width: item.width,
                height: item.height,
                placed: true,
            };

            // Split free rects around the placed padded item
            let placed = Rect {
                x: best_x - padding,
                y: best_y - padding,
                width: padded_w,
                height: padded_h,
            };

            let mut new_free = Vec::new();
            for rect in &free_rects {
                // Check if placed rect overlaps this free rect
                if placed.x >= rect.x + rect.width
                    || placed.x + placed.width <= rect.x
                    || placed.y >= rect.y + rect.height
                    || placed.y + placed.height <= rect.y
                {
                    // No overlap, keep as is
                    new_free.push(rect.clone());
                    continue;
                }

                // Split into up to 4 rects around the placed item
                // Left
                if placed.x > rect.x {
                    new_free.push(Rect {
                        x: rect.x,
                        y: rect.y,
                        width: placed.x - rect.x,
                        height: rect.height,
                    });
                }
                // Right
                if placed.x + placed.width < rect.x + rect.width {
                    new_free.push(Rect {
                        x: placed.x + placed.width,
                        y: rect.y,
                        width: (rect.x + rect.width) - (placed.x + placed.width),
                        height: rect.height,
                    });
                }
                // Top
                if placed.y > rect.y {
                    new_free.push(Rect {
                        x: rect.x,
                        y: rect.y,
                        width: rect.width,
                        height: placed.y - rect.y,
                    });
                }
                // Bottom
                if placed.y + placed.height < rect.y + rect.height {
                    new_free.push(Rect {
                        x: rect.x,
                        y: placed.y + placed.height,
                        width: rect.width,
                        height: (rect.y + rect.height) - (placed.y + placed.height),
                    });
                }
            }

            // Remove contained rects (prune)
            free_rects = prune_rects(new_free);
        } else {
            // Could not place
            results[*orig_idx] = PackResult {
                id: item.id.clone(),
                x: 0,
                y: 0,
                width: item.width,
                height: item.height,
                placed: false,
            };
        }
    }

    results
}

/// Remove any rect fully contained by another
fn prune_rects(rects: Vec<Rect>) -> Vec<Rect> {
    let mut pruned = Vec::with_capacity(rects.len());
    for (i, a) in rects.iter().enumerate() {
        let mut contained = false;
        for (j, b) in rects.iter().enumerate() {
            if i != j
                && b.x <= a.x
                && b.y <= a.y
                && b.x + b.width >= a.x + a.width
                && b.y + b.height >= a.y + a.height
            {
                contained = true;
                break;
            }
        }
        if !contained {
            pruned.push(a.clone());
        }
    }
    pruned
}

pub fn auto_pack_json(
    items_json: &str,
    canvas_w: u32,
    canvas_h: u32,
    padding: u32,
) -> Result<String, Box<dyn std::error::Error>> {
    let items: Vec<PackItem> = serde_json::from_str(items_json)?;
    let results = auto_pack(&items, canvas_w, canvas_h, padding);
    Ok(serde_json::to_string(&results)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_collision_empty() {
        let blocks = vec![];
        let new_block = Block {
            id: "a".into(),
            x: 0,
            y: 0,
            width: 256,
            height: 256,
        };
        assert!(!check_collision(&blocks, &new_block));
    }

    #[test]
    fn test_collision_overlap() {
        let blocks = vec![Block {
            id: "a".into(),
            x: 0,
            y: 0,
            width: 256,
            height: 256,
        }];
        let new_block = Block {
            id: "b".into(),
            x: 128,
            y: 128,
            width: 256,
            height: 256,
        };
        assert!(check_collision(&blocks, &new_block));
    }

    #[test]
    fn test_no_collision_adjacent() {
        let blocks = vec![Block {
            id: "a".into(),
            x: 0,
            y: 0,
            width: 256,
            height: 256,
        }];
        let new_block = Block {
            id: "b".into(),
            x: 256,
            y: 0,
            width: 256,
            height: 256,
        };
        assert!(!check_collision(&blocks, &new_block));
    }

    #[test]
    fn test_auto_pack_basic() {
        let items = vec![
            PackItem { id: "a".into(), width: 256, height: 256 },
            PackItem { id: "b".into(), width: 256, height: 256 },
            PackItem { id: "c".into(), width: 512, height: 256 },
        ];
        let results = auto_pack(&items, 1024, 1024, 0);
        assert_eq!(results.len(), 3);
        assert!(results.iter().all(|r| r.placed));

        // Verify no overlaps
        for i in 0..results.len() {
            for j in (i + 1)..results.len() {
                let a = &results[i];
                let b = &results[j];
                let overlap = a.x < b.x + b.width
                    && a.x + a.width > b.x
                    && a.y < b.y + b.height
                    && a.y + a.height > b.y;
                assert!(!overlap, "Blocks {} and {} overlap", a.id, b.id);
            }
        }
    }

    #[test]
    fn test_auto_pack_with_padding() {
        let items = vec![
            PackItem { id: "a".into(), width: 256, height: 256 },
            PackItem { id: "b".into(), width: 256, height: 256 },
        ];
        // 256 + 8*2 = 272 per item, need at least 544 in one dimension
        let results = auto_pack(&items, 1024, 1024, 8);
        assert!(results.iter().all(|r| r.placed));

        let a = &results[0];
        let b = &results[1];
        let gap_x = if a.x < b.x {
            b.x as i32 - (a.x + a.width) as i32
        } else {
            a.x as i32 - (b.x + b.width) as i32
        };
        let gap_y = if a.y < b.y {
            b.y as i32 - (a.y + a.height) as i32
        } else {
            a.y as i32 - (b.y + b.height) as i32
        };
        assert!(
            gap_x >= 16 || gap_y >= 16,
            "Expected gap >= 16px, got x={}, y={}",
            gap_x,
            gap_y
        );
    }

    #[test]
    fn test_auto_pack_overflow() {
        let items = vec![
            PackItem { id: "a".into(), width: 1024, height: 1024 },
            PackItem { id: "b".into(), width: 1024, height: 1024 },
        ];
        let results = auto_pack(&items, 1024, 1024, 0);
        assert!(results[0].placed);
        assert!(!results[1].placed); // Should not fit
    }
}
