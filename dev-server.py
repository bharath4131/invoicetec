import os
import http.server

PORT = 8000

class SPADevServerHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def translate_path(self, path):
        default_path = super().translate_path(path)
        if not os.path.exists(default_path) or os.path.isdir(default_path):
            return super().translate_path('/index.html')
        return default_path

if __name__ == '__main__':
    server_address = ("", PORT)
    httpd = http.server.ThreadingHTTPServer(server_address, SPADevServerHandler)
    print(f"SPA Dev Server running at http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        httpd.server_close()
