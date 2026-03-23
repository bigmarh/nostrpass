#!/bin/bash
# Placeholder: Create simple colored squares as icons
# Replace these with proper NostrPass branded icons
for size in 16 32 48 128; do
  convert -size ${size}x${size} xc:'#8B5CF6' "icon${size}.png" 2>/dev/null || \
  echo "ImageMagick not found. Please add icon${size}.png manually."
done
