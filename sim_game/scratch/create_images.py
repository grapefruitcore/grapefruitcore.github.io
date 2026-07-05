import os
import sys

# Ensure Pillow is installed
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Installing Pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw, ImageFont

os.makedirs("./static", exist_ok=True)

def create_gradient_avatar(filename, color1, color2, text, text_color):
    # Create a 200x200 image with gradient
    img = Image.new("RGBA", (200, 200))
    draw = ImageDraw.Draw(img)
    
    # Draw linear gradient
    for y in range(200):
        # Interpolate color
        r = int(color1[0] + (color2[0] - color1[0]) * (y / 200.0))
        g = int(color1[1] + (color2[1] - color1[1]) * (y / 200.0))
        b = int(color1[2] + (color2[2] - color1[2]) * (y / 200.0))
        draw.line([(0, y), (200, y)], fill=(r, g, b, 255))
        
    # Draw accent circle outline
    draw.ellipse([5, 5, 195, 195], outline=(255, 255, 255, 30), width=3)
    
    # Add text label (centered)
    # Simple calculation for center if no custom font loaded
    try:
        # Try loading default font
        font = ImageFont.load_default()
        # Scale up drawing text by drawing larger text
        draw.text((100, 100), text, fill=text_color, anchor="mm")
    except Exception:
        # Basic text
        draw.text((85, 90), text, fill=text_color)
        
    img.save(os.path.join("./static", filename))
    print(f"Created {filename}")

# Generate themes
create_gradient_avatar("default_user.png", (0, 120, 255), (130, 0, 255), "USER", (255, 255, 255))
create_gradient_avatar("daine.png", (0, 240, 255), (130, 0, 255), "DAINE", (0, 0, 0))
create_gradient_avatar("popcraze.png", (255, 0, 128), (214, 0, 255), "POP", (255, 255, 255))
create_gradient_avatar("default_npc.png", (60, 60, 80), (100, 100, 120), "NPC", (255, 255, 255))
