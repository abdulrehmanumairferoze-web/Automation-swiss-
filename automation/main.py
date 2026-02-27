"""
main.py — Fully Automated Excel-to-PDF WhatsApp Reporting System

Orchestrates the full pipeline:
  1. Fetch Excel via MREP portal automation (Playwright)
  2. Process Target vs Achievement data
  3. Generate charts (bar, shortfall, pie)
  4. Create professional PDF report
  5. Send PDF via WhatsApp
  6. Run on daily schedule (configurable)

Usage:
  python main.py            # Start scheduled automation (runs daily)
  python main.py --now      # Run one cycle immediately, then exit
  python main.py --test     # Run with sample data (no download needed)
"""

import os
import sys
import logging
import argparse
from datetime import datetime

import schedule
import time
import pandas as pd
from dotenv import load_dotenv

# ── Setup paths ──
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)

# Load environment
load_dotenv(os.path.join(BASE_DIR, ".env"))

# ── Local modules ──
from excel_processor import fetch_via_mrep, find_latest_excel
# from graph_generator import generate_all_graphs # Unused now
# from pdf_generator import generate_pdf # Unused now
from whatsapp_sender import send_with_retry


# ══════════════════════════════════════════════════════════════
# LOGGING SETUP
# ══════════════════════════════════════════════════════════════
def setup_logging():
    """Configure logging to both console and file."""
    log_dir = os.path.join(BASE_DIR, "logs")
    os.makedirs(log_dir, exist_ok=True)

    log_file = os.path.join(log_dir, f"automation_{datetime.now().strftime('%Y%m%d')}.log")

    # Use UTF-8 for console output on Windows to support emoji
    import io
    stdout_handler = logging.StreamHandler(
        io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    )

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            stdout_handler,
            logging.FileHandler(log_file, encoding="utf-8"),
        ],
    )
    return logging.getLogger("main")


# ══════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════
def load_config() -> dict:
    """Load all configuration from environment variables."""
    config = {
        "excel_url": os.getenv("EXCEL_URL", ""),
        "company_name": os.getenv("COMPANY_NAME", "Company"),
        "report_month": os.getenv("REPORT_MONTH", datetime.now().strftime("%B %Y")),
        "twilio_sid": os.getenv("TWILIO_SID", ""),
        "twilio_token": os.getenv("TWILIO_TOKEN", ""),
        "twilio_from": os.getenv("TWILIO_WHATSAPP_FROM", ""),
        "whatsapp_to": os.getenv("WHATSAPP_NUMBER", ""),
        "schedule_time": os.getenv("SCHEDULE_TIME", "20:00"),
    }
    return config


# ══════════════════════════════════════════════════════════════
# SAMPLE DATA (for --test mode)
# ══════════════════════════════════════════════════════════════
def create_sample_excel() -> str:
    """Create a sample Excel file for testing."""
    os.makedirs("downloads", exist_ok=True)
    filepath = os.path.join("downloads", "sample_report.xlsx")

    data = {
        "Customer Name": [
            "Alpha Pharma", "Beta Medical", "Gamma Health", "Delta Labs",
            "Epsilon Corp", "Zeta Supplies", "Eta Solutions", "Theta Distributors",
            "Iota Trading", "Kappa Wellness",
        ],
        "Target": [50000, 75000, 30000, 45000, 60000, 25000, 80000, 35000, 40000, 55000],
        "Achievement": [48000, 60000, 32000, 30000, 58000, 28000, 72000, 20000, 39000, 50000],
    }

    df = pd.DataFrame(data)
    df.to_excel(filepath, index=False, engine="openpyxl")
    return filepath


# ══════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ══════════════════════════════════════════════════════════════
def run_pipeline(config: dict, test_mode: bool = False):
    """Execute the full automation pipeline."""
    logger = logging.getLogger("main")
    logger.info("=" * 60)
    logger.info("🚀 STARTING AUTOMATION PIPELINE")
    logger.info(f"   Company: {config['company_name']}")
    logger.info(f"   Month:   {config['report_month']}")
    logger.info(f"   Time:    {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 60)

    reports_dir = os.path.join(BASE_DIR, "reports")
    os.makedirs(reports_dir, exist_ok=True)

    try:
        # ── local modules ──
        from excel_processor import (
            load_and_clean_data, get_variance_data, get_date_logic_header, 
            get_executive_summary_data, get_team_target_map
        )
        from pdf_generator import generate_variance_pdf
        from graph_generator import create_gauges_chart, create_top_brands_chart, create_team_performance_chart
        from validator import validate_data_parity
        
        # ── STEP 1: Fetch Excel from MREP Portal ──
        if test_mode:
            logger.info("🧪 TEST MODE: Skipping MREP download, using sample or existing file")
            from excel_processor import find_latest_excel
            try:
                excel_path = find_latest_excel() 
            except:
                logger.warning("No existing excel found for test mode.")
                return False
        else:
            logger.info("📥 Fetching Excel via MREP portal automation...")
            excel_path = fetch_via_mrep()

        # ── STEP 2: Load & Clean Data with Validation Guard ──
        logger.info(f"📊 Processing file: {excel_path}")
        
        # 1. Load Raw for Target Mapping & Validation
        df_raw = pd.read_excel(excel_path, engine="openpyxl", header=None) # No header yet to catch all labels
        
        # 2. Extract Team Targets from Summary Rows (Binary mapping fix)
        team_targets_fin = get_team_target_map(df_raw, 'financial')
        team_targets_unit = get_team_target_map(df_raw, 'unit')
        
        # 3. Clean Data for Actuals (Strict exclusion)
        df_clean = load_and_clean_data(excel_path)
        header_text = get_date_logic_header()
        
        # 4. Binary Parity Check (1:1 Verification)
        if not validate_data_parity(df_raw, df_clean, 'financial'):
            logger.error("🛑 CRITICAL: Data Parity Failure (Value). Generation Aborted.")
            # Trigger Alert (Manual for now, or log it)
            return False
            
        if not validate_data_parity(df_raw, df_clean, 'unit'):
            logger.error("🛑 CRITICAL: Data Parity Failure (Units). Generation Aborted.")
            return False

        # ── STEP 3: Generate Visuals & Reports ──
        logger.info("🎨 Generating Visual Analytics...")
        fin_data = get_variance_data(df_clean, 'financial')
        
        # Generate Executive Summary Stats (Value Based)
        # Pass the raw_targets to fix mapping
        summary_stats = get_executive_summary_data(df_clean, report_type='financial')
        summary_stats["raw_targets"] = team_targets_fin
        
        days_rem = summary_stats.get("days_remaining", 1)
        hero_path = None
        if "all_teams" in summary_stats:
            hero_path = create_team_performance_chart(summary_stats["all_teams"], days_rem, reports_dir)

        gauges_path = None
        if "Teams" in fin_data:
            gauges_path = create_gauges_chart(fin_data["Teams"], reports_dir)
            
        brands_path = None
        if "Brands" in fin_data:
            brands_path = create_top_brands_chart(fin_data["Brands"], reports_dir)

        # ── STEP 4: Generate PDF 1 - Financial Value Variance ──
        logger.info("📄 Generating Sales Value Variance Report...")
        pdf_fin = generate_variance_pdf(
            fin_data, 
            header_text, 
            report_type='financial', 
            gauges_path=gauges_path,
            brand_chart_path=brands_path,
            hero_chart_path=hero_path,
            output_dir=reports_dir,
            summary_data=summary_stats
        )
        
        # ── STEP 5: Generate PDF 2 - Unit Quantity Variance ──
        logger.info("📄 Generating Unit Variance Report...")
        unit_data = get_variance_data(df_clean, 'unit')
        unit_summary_stats = get_executive_summary_data(df_clean, report_type='unit')
        unit_summary_stats["raw_targets"] = team_targets_unit
        
        unit_hero_path = None
        if "all_teams" in unit_summary_stats:
            unit_hero_path = create_team_performance_chart(unit_summary_stats["all_teams"], days_rem, reports_dir)

        if "Teams" in unit_data:
            create_gauges_chart(unit_data["Teams"], reports_dir)
        if "Brands" in unit_data:
            create_top_brands_chart(unit_data["Brands"], reports_dir)
            
        pdf_unit = generate_variance_pdf(
            unit_data, 
            header_text, 
            report_type='unit', 
            gauges_path=os.path.join(reports_dir, "gauges_chart.png"),
            brand_chart_path=os.path.join(reports_dir, "brands_chart.png"),
            hero_chart_path=unit_hero_path,
            output_dir=reports_dir,
            summary_data=unit_summary_stats
        )

        # ── STEP 6: Send WhatsApp (Only if verified) ──
        generated_files = []
        if pdf_fin: generated_files.append(pdf_fin)
        if pdf_unit: generated_files.append(pdf_unit)

        if config["whatsapp_to"] and not test_mode:
            for i, pdf in enumerate(generated_files):
                logger.info(f"📤 Verification Passed. Sending {os.path.basename(pdf)} via WhatsApp...")
                send_with_retry(
                    pdf,
                    config["whatsapp_to"],
                    config["company_name"], config["report_month"],
                )
                # Cooling period to prevent session locking when sending multiple files
                if i < len(generated_files) - 1:
                    logger.info("⏳ Cooling down for 20s before next file...")
                    import time
                    time.sleep(20)

        logger.info("=" * 60)
        logger.info(f"✅ PIPELINE COMPLETE — Generated: {', '.join([os.path.basename(f) for f in generated_files])}")
        logger.info("=" * 60)
        return True

    except Exception as e:
        logger.error(f"❌ PIPELINE FAILED: {e}", exc_info=True)
        return False


# ══════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════
def main():
    logger = setup_logging()
    config = load_config()

    parser = argparse.ArgumentParser(
        description="Automated Excel-to-PDF WhatsApp Reporting System"
    )
    parser.add_argument("--now", action="store_true", help="Run one cycle immediately and exit")
    parser.add_argument("--test", action="store_true", help="Run with sample data (no download, no WhatsApp)")
    args = parser.parse_args()

    if args.test:
        logger.info("🧪 Running in TEST mode with sample data...")
        run_pipeline(config, test_mode=True)
        return

    if args.now:
        logger.info("▶️ Running one cycle NOW...")
        run_pipeline(config, test_mode=False)
        return

    # ── Scheduled mode ──
    schedule_time = config["schedule_time"]
    logger.info(f"⏰ Scheduler started — will run daily at {schedule_time}")
    logger.info("   Press Ctrl+C to stop.\n")

    schedule.every().day.at(schedule_time).do(run_pipeline, config=config)

    # Run forever
    while True:
        schedule.run_pending()
        time.sleep(30)


if __name__ == "__main__":
    main()
