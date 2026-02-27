
import os
import logging
import subprocess

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_whatsapp")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WHATSAPP_SCRIPT = os.path.join(BASE_DIR, "whatsapp_send.cjs")

def test_send(to_number):
    try:
        logger.info(f"Sending test Heartbeat to {to_number}...")
        result = subprocess.run(
            [
                "node", WHATSAPP_SCRIPT,
                "--to", to_number,
                "--message", "💓 Heartbeat: System validation check. Please confirm if received."
            ],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            timeout=300
        )
        print(result.stdout)
        print(result.stderr)
        if result.returncode == 0:
            logger.info(f"✅ Heartbeat sent to {to_number}")
        else:
            logger.error(f"❌ Failed to send Heartbeat to {to_number}")
    except Exception as e:
        logger.error(f"Error: {e}")

if __name__ == "__main__":
    test_send("923212772720")
    test_send("923218228778")
