#!/usr/bin/env python3
"""
SPA Server with History API fallback
Serves index.html for all routes that don't match static files
"""
import http.server
import socketserver
import os
from pathlib import Path

PORT = 8080
DIRECTORY = Path(__file__).parent

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIRECTORY), **kwargs)
    
    def do_GET(self):
        # Parse the path
        path = self.path.split('?')[0]  # Remove query string
        
        # Check if it's a static file request
        static_extensions = {'.html', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'}
        file_path = DIRECTORY / path.lstrip('/')
        
        # If path has extension and file exists, serve it
        if any(path.endswith(ext) for ext in static_extensions) and file_path.is_file():
            return super().do_GET()
        
        # If it's a directory with index.html, serve it
        if file_path.is_dir():
            index_file = file_path / 'index.html'
            if index_file.is_file():
                self.path = path.rstrip('/') + '/index.html'
                return super().do_GET()
        
        # For all other routes (SPA routes), serve index.html
        self.path = '/index.html'
        return super().do_GET()
    
    def end_headers(self):
        # Add CORS headers for development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        # Disable caching for development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

if __name__ == '__main__':
    os.chdir(DIRECTORY)
    with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
        print(f"SPA Server running at http://localhost:{PORT}")
        print("Serving index.html for all non-static routes (History API fallback)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")