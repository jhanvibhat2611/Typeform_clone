"""Verify persistence with two separate Uvicorn processes and an explicit SQLite path."""
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from uuid import uuid4

import httpx


class ProcessRestartTest(unittest.TestCase):
    def test_draft_survives_backend_process_restart(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "persistent" / "app.sqlite3"
            environment = {**os.environ, "SQLITE_PATH": str(database)}
            with socket.socket() as port_socket:
                port_socket.bind(("127.0.0.1", 0))
                port = port_socket.getsockname()[1]
            origin = f"http://127.0.0.1:{port}"
            form_id = str(uuid4())
            body = {
                "title": "Restart verification",
                "question": {
                    "id": str(uuid4()), "type": "short_text", "prompt": "Your name?",
                    "description": "This value must survive.", "required": True,
                },
            }
            expected = {"id": form_id, **body}

            # Close the actual server through stdin. On Windows, terminating a venv
            # launcher alone can leave its Python child alive and produce a false restart.
            server_script = """
import sys
import threading
import uvicorn
server = uvicorn.Server(uvicorn.Config('app.main:app', host='127.0.0.1', port=int(sys.argv[1])))
def stop_on_input():
    sys.stdin.readline()
    server.should_exit = True
threading.Thread(target=stop_on_input, daemon=True).start()
server.run()
"""

            for boot in range(2):
                process = subprocess.Popen(
                    [sys.executable, "-c", server_script, str(port)],
                    cwd=Path(__file__).resolve().parents[1], env=environment,
                    stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                )
                try:
                    with httpx.Client(base_url=origin, timeout=2, trust_env=False) as client:
                        deadline = time.monotonic() + 20
                        while True:
                            try:
                                if client.get("/api/health").status_code == 200:
                                    break
                            except httpx.TransportError:
                                pass
                            if process.poll() is not None or time.monotonic() > deadline:
                                self.fail("Uvicorn did not start within 20 seconds")
                            time.sleep(0.1)

                        if boot == 0:
                            saved = client.put(f"/api/forms/{form_id}", json=body)
                            self.assertEqual(saved.status_code, 200, saved.text)
                            self.assertEqual(saved.json(), expected)
                        self.assertEqual(client.get(f"/api/forms/{form_id}").json(), expected)
                        self.assertTrue(database.is_file())
                finally:
                    process.communicate(input=b"stop\n", timeout=10)
                    self.assertEqual(process.returncode, 0)
                with socket.socket() as probe:
                    self.assertNotEqual(probe.connect_ex(("127.0.0.1", port)), 0, "Old server is still listening")


if __name__ == "__main__":
    unittest.main()
