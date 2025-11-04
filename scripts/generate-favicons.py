#!/usr/bin/env python3
"""
Generate favicon PNG files from SVG using Python Imaging Library (PIL/Pillow)
If PIL is not available, creates a simple HTML file that can be opened in a browser
to manually save the favicons.
"""

import os
from pathlib import Path

def create_favicon_html():
    """Create an HTML file to manually generate favicons in a browser"""
    html_content = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Favicon Generator - Circle Seven</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
        }
        .favicon-preview {
            display: inline-block;
            margin: 20px;
            text-align: center;
        }
        canvas {
            border: 1px solid #ccc;
            margin: 10px 0;
        }
        button {
            background: #0084b4;
            color: white;
            border: none;
            padding: 10px 20px;
            cursor: pointer;
            border-radius: 4px;
        }
        button:hover {
            background: #005580;
        }
    </style>
</head>
<body>
    <h1>Circle Seven Favicon Generator</h1>
    <p>Right-click each canvas and "Save Image As" to save the favicon files to <code>assets/images/</code></p>

    <div class="favicon-preview">
        <canvas id="favicon-16" width="16" height="16"></canvas>
        <p>favicon-16x16.png</p>
        <button onclick="downloadCanvas('favicon-16', 'favicon-16x16.png')">Download</button>
    </div>

    <div class="favicon-preview">
        <canvas id="favicon-32" width="32" height="32"></canvas>
        <p>favicon-32x32.png</p>
        <button onclick="downloadCanvas('favicon-32', 'favicon-32x32.png')">Download</button>
    </div>

    <div class="favicon-preview">
        <canvas id="favicon-180" width="180" height="180"></canvas>
        <p>apple-touch-icon.png</p>
        <button onclick="downloadCanvas('favicon-180', 'apple-touch-icon.png')">Download</button>
    </div>

    <div class="favicon-preview">
        <canvas id="favicon-192" width="192" height="192"></canvas>
        <p>android-chrome-192x192.png</p>
        <button onclick="downloadCanvas('favicon-192', 'android-chrome-192x192.png')">Download</button>
    </div>

    <div class="favicon-preview">
        <canvas id="favicon-512" width="512" height="512"></canvas>
        <p>android-chrome-512x512.png</p>
        <button onclick="downloadCanvas('favicon-512', 'android-chrome-512x512.png')">Download</button>
    </div>

    <script>
        function drawFavicon(canvasId, size) {
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');

            // Circle background
            ctx.fillStyle = '#0084b4';
            ctx.beginPath();
            ctx.arc(size/2, size/2, size/2 - 2, 0, Math.PI * 2);
            ctx.fill();

            // Circle border
            ctx.strokeStyle = '#005580';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Number 7
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${size * 0.6}px Arial, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('7', size/2, size/2);
        }

        function downloadCanvas(canvasId, filename) {
            const canvas = document.getElementById(canvasId);
            const link = document.createElement('a');
            link.download = filename;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }

        // Draw all favicons
        drawFavicon('favicon-16', 16);
        drawFavicon('favicon-32', 32);
        drawFavicon('favicon-180', 180);
        drawFavicon('favicon-192', 192);
        drawFavicon('favicon-512', 512);
    </script>
</body>
</html>'''

    output_file = Path('favicon-generator.html')
    with open(output_file, 'w') as f:
        f.write(html_content)

    print(f"✓ Created {output_file}")
    print(f"  Open this file in a browser and click the download buttons")
    print(f"  Or right-click each canvas and 'Save Image As...'")
    print(f"  Save the files to: assets/images/")

if __name__ == '__main__':
    create_favicon_html()
