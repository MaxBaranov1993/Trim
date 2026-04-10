use image::imageops::FilterType;
use image::ImageReader;
use std::io::Cursor;

pub fn generate_thumbnail(data: &[u8], max_size: u32) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let reader = ImageReader::new(Cursor::new(data))
        .with_guessed_format()?;
    let img = reader.decode()?;

    let thumb = img.resize(max_size, max_size, FilterType::Lanczos3);

    let mut buf = Vec::new();
    let mut cursor = Cursor::new(&mut buf);
    thumb.write_to(&mut cursor, image::ImageFormat::Png)?;

    Ok(buf)
}
