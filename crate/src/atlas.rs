use image::{DynamicImage, ImageFormat, ImageReader, imageops::FilterType};
use serde::Deserialize;
use std::io::Cursor;

#[derive(Deserialize)]
pub struct ExportBlock {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub image_index: usize,
}

#[derive(Deserialize)]
pub struct ExportLayout {
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub blocks: Vec<ExportBlock>,
}

/// Composites multiple images onto a single atlas canvas.
/// `layout_json` describes where each block goes.
/// `images` is a list of raw image bytes (PNG/JPG) corresponding to `image_index` in each block.
/// Returns the composited atlas as PNG bytes.
pub fn composite_atlas(
    layout_json: &str,
    images: &[&[u8]],
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let layout: ExportLayout = serde_json::from_str(layout_json)?;

    // Create empty RGBA canvas
    let mut canvas =
        DynamicImage::new_rgba8(layout.canvas_width, layout.canvas_height).to_rgba8();

    for block in &layout.blocks {
        if block.image_index >= images.len() {
            continue;
        }

        let img_data = images[block.image_index];
        let reader = ImageReader::new(Cursor::new(img_data)).with_guessed_format()?;
        let img = reader.decode()?;

        // Resize to block dimensions
        let resized = img.resize_exact(block.width, block.height, FilterType::Lanczos3);
        let rgba = resized.to_rgba8();

        // Composite onto canvas
        for py in 0..block.height {
            for px in 0..block.width {
                let dst_x = block.x + px;
                let dst_y = block.y + py;
                if dst_x < layout.canvas_width && dst_y < layout.canvas_height {
                    let pixel = rgba.get_pixel(px, py);
                    canvas.put_pixel(dst_x, dst_y, *pixel);
                }
            }
        }
    }

    // Encode to PNG
    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    DynamicImage::ImageRgba8(canvas).write_to(&mut cursor, ImageFormat::Png)?;

    Ok(buf)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_atlas() {
        let layout = r#"{"canvas_width":256,"canvas_height":256,"blocks":[]}"#;
        let result = composite_atlas(layout, &[]);
        assert!(result.is_ok());
        let png = result.unwrap();
        assert!(!png.is_empty());
    }
}
