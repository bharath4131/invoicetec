import os
import http.server
import socketserver

PORT = 8000

class SPADevServerHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Translate the URL path to a local filesystem path
        path = self.translate_path(self.path)
        
        # Check if the requested path corresponds to an actual file on disk
        if not os.path.exists(path) or os.path.isdir(path):
            # If the file doesn't exist (e.g., /dashboard), fallback to index.html for SPA router
            self.path = '/index.html'
            
        return super().do_GET()

if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), SPADevServerHandler) as httpd:
        print(f"SPA Dev Server running at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nStopping server...")
            httpd.server_close()
