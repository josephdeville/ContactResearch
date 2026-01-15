#!/usr/bin/env python3
"""
Generate Chrome extension icons with GTM branding
"""
from PIL import Image, ImageDraw, ImageFont

def create_icon(size, output_path):
    """Create a square icon with GTM text"""
    # LinkedIn brand blue color
    bg_color = (0, 115, 177)  # #0073b1
    text_color = (255, 255, 255)

    # Create image
    img = Image.new('RGB', (size, size), bg_color)
    draw = ImageDraw.Draw(img)

    # Draw text
    text = "GTM"

    # Try to use a built-in font, fallback to default if not available
    try:
        # Calculate font size based on icon size
        font_size = int(size * 0.35)
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except:
        # Fallback to default font
        font = ImageFont.load_default()

    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Calculate position to center text
    x = (size - text_width) // 2
    y = (size - text_height) // 2 - bbox[1]

    # Draw the text
    draw.text((x, y), text, fill=text_color, font=font)

    # Save the image
    img.save(output_path, 'PNG')
    print(f"Created {output_path} ({size}x{size})")

if __name__ == '__main__':
    # Create icons directory if it doesn't exist
    import os
    os.makedirs('icons', exist_ok=True)

    # Generate all three sizes
    create_icon(16, 'icons/icon16.png')
    create_icon(48, 'icons/icon48.png')
    create_icon(128, 'icons/icon128.png')

    print("\nAll icons generated successfully!")
