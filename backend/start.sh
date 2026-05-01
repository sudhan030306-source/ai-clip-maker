#!/bin/sh
# Set PATH to include all possible nix binary locations
export PATH=/root/.nix-profile/bin:/nix/var/nix/profiles/default/bin:/usr/local/bin:/usr/bin:/bin:$PATH

echo "=== Startup PATH Check ==="
echo "PATH: $PATH"
echo "yt-dlp location: $(which yt-dlp 2>/dev/null || echo 'NOT FOUND')"
echo "ffmpeg location: $(which ffmpeg 2>/dev/null || echo 'NOT FOUND')"
echo "=========================="

exec node src/index.js
