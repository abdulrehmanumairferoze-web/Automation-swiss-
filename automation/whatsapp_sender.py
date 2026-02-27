"""
whatsapp_sender.py
Sends PDF reports via WhatsApp using whatsapp-web.js (FREE — no Twilio needed).
Calls the Node.js script whatsapp_send.cjs which handles the actual sending.
"""

import os
import logging
import subprocess
import time

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WHATSAPP_SCRIPT = os.path.join(BASE_DIR, "whatsapp_send.cjs")


def send_whatsapp(pdf_path: str, to_number: str,
                  company_name: str, report_month: str) -> bool:
    """
    Send PDF report via WhatsApp using whatsapp-web.js.
    
    This calls the Node.js script which:
    - Connects to WhatsApp Web (session saved from first QR scan)
    - Sends a text message + PDF attachment
    - Exits automatically after sending
    """
    if not os.path.exists(pdf_path):
        logger.error(f"❌ WhatsApp: PDF not found at {pdf_path}")
        return False

    # Clean phone number (remove whatsapp: prefix if present)
    clean_number = to_number.replace("whatsapp:", "").replace("+", "").strip()
    if not clean_number:
        logger.error("❌ WhatsApp: No phone number configured in .env")
        return False

    message = (
        f"📊 *{company_name} — {report_month}*\n\n"
        f"Your Target vs Achievement report has been generated and is attached below.\n\n"
        f"_Sent automatically by the reporting system._"
    )

    logger.info(f"📤 Sending WhatsApp to {clean_number}...")

    try:
        result = subprocess.run(
            [
                "node", WHATSAPP_SCRIPT,
                "--to", clean_number,
                "--file", os.path.abspath(pdf_path),
                "--message", message,
            ],
            cwd=BASE_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=300,  # Increased to 5 minutes
        )

        # Log the output
        if result.stdout:
            for line in result.stdout.strip().split("\n"):
                logger.info(f"  {line}")
        if result.stderr:
            for line in result.stderr.strip().split("\n"):
                logger.warning(f"  {line}")

        if result.returncode == 0:
            logger.info("✅ WhatsApp: Message sent successfully!")
            return True
        else:
            logger.error(f"❌ WhatsApp: Script exited with code {result.returncode}")
            return False

    except subprocess.TimeoutExpired:
        logger.error("❌ WhatsApp: Timed out after 3 minutes. Is the session authenticated?")
        logger.error("   Run 'node whatsapp_send.cjs' manually first to scan the QR code.")
        return False
    except Exception as e:
        logger.error(f"❌ WhatsApp: Unexpected error: {e}")
        return False


def send_with_retry(pdf_path: str, to_numbers: str,
                    company_name: str, report_month: str,
                    max_retries: int = 3) -> bool:
    """
    Send WhatsApp message with retry logic to one or multiple numbers.
    to_numbers: Can be a single number or comma-separated list.
    """
    if not to_numbers:
        logger.warning("⚠️ No WhatsApp numbers provided.")
        return False

    # Split by comma and clean
    number_list = [n.strip() for n in to_numbers.split(",") if n.strip()]
    
    overall_success = True
    
    for idx, number in enumerate(number_list):
        logger.info(f"📨 Processing recipient: {number}")
        sent = False
        
        for attempt in range(1, max_retries + 1):
            logger.info(f"   Attempt {attempt}/{max_retries}...")
            if send_whatsapp(pdf_path, number, company_name, report_month):
                sent = True
                break
            else:
                logger.warning(f"   Attempt {attempt} failed.")
                if attempt < max_retries:
                    time.sleep(10)  # Wait before retry
        
        if sent:
            logger.info(f"✅ Sent to {number}")
        else:
            logger.error(f"❌ Failed to send to {number} after {max_retries} attempts")
            overall_success = False
            
        # Rate Limiting: Pause between different recipients to prevent WhatsApp ban
        if idx < len(number_list) - 1:
            logger.info("⏳ Rate Limiting: Pausing for 5 seconds before next recipient...")
            time.sleep(5)
            
    return overall_success
