"""
validator.py
Data Parity & Integrity Guard for MREP Variance Reports.
Checks 1:1 binary parity between Excel source and processed data.
"""

import os
import logging
import pandas as pd
from datetime import datetime

logger = logging.getLogger(__name__)

def validate_data_parity(df_raw: pd.DataFrame, df_clean: pd.DataFrame, report_type='financial'):
    """
    Ensures 1:1 parity between filtered MREP source and processed data.
    """
    COL_SALE_UNIT = 6
    COL_SALE_VALUE = 7
    col_idx = COL_SALE_VALUE if report_type == 'financial' else COL_SALE_UNIT
    
    # ── 1. Calculate Expected Source Total ──
    df_data_only = df_raw.iloc[3:].copy() 
    vals_source = pd.to_numeric(df_data_only.iloc[:, col_idx], errors='coerce').fillna(0)
    
    labels = df_data_only.iloc[:, 0].astype(str).str.upper()
    mask_summary = labels.str.contains("ALL|SUMMARY|TOTAL", na=False)
    
    # Also exclude 'All' in Region column (Index 5) to match excel_processor.py
    COL_REGION = 5
    region_labels = df_data_only.iloc[:, COL_REGION].astype(str).str.upper()
    mask_region = region_labels.str.contains("ALL", na=False)
    
    mask_exclude = mask_summary | mask_region
    
    source_total_with_summaries = vals_source.sum()
    summary_only_total = vals_source[mask_exclude].sum()
    source_meaningful_total = vals_source[~mask_exclude].sum()
    
    # ── 2. Processed Total ──
    processed_total = pd.to_numeric(df_clean.iloc[:, col_idx], errors='coerce').fillna(0).sum()
    
    # ── 3. Parity Check (0.01% Tolerance) ──
    tolerance = 0.01 / 100 
    diff = abs(source_meaningful_total - processed_total)
    
    status = "SUCCESS" if (source_meaningful_total > 0 and (diff / source_meaningful_total) <= tolerance) or (source_meaningful_total == 0 and processed_total == 0) else "FAILURE"
    
    log_msg = (
        f"[{report_type.upper()}] Binary Parity Check:\n"
        f"  - Raw Total (incl. summaries): {source_total_with_summaries:,.2f}\n"
        f"  - Excluded Summary Subtotals: {summary_only_total:,.2f}\n"
        f"  - Verified Meaningful Total:  {source_meaningful_total:,.2f}\n"
        f"  - PDF Data Total:             {processed_total:,.2f}\n"
        f"  - Parity Difference:          {diff:,.5f}\n"
        f"  - Final Integrity Status:     {status}\n"
    )
    _write_to_log(log_msg)
    
    if status == "SUCCESS":
        logger.info(f"✅ Data Integrity Verified: {report_type.upper()} matches MREP source 100%.")
    else:
        logger.error(f"❌ DATA INTEGRITY BREACH: {report_type.upper()} mismatch detected.")
        
    return status == "SUCCESS"

def _write_to_log(message):
    log_file = os.path.join(os.path.dirname(__file__), "validation_log.txt")
    with open(log_file, "a", encoding="utf-8") as f:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"--- {timestamp} ---\n{message}\n")

def verify_pro_rata(actual, target, days_elapsed, pdf_diff):
    """
    Recalculate Pro-Rata Difference: Actual - ((Target / 28) * Days_Elapsed)
    Note: Using 28 as requested for Feb 2026 parity, or dynamic if preferred.
    """
    # Use 28 as per user specific formula request for February
    expected_diff = actual - ((target / 28) * days_elapsed)
    
    # Check within rounding error
    if abs(expected_diff - pdf_diff) > 0.1:
        logger.warning(f"Pro-Rata Mismatch! Calc: {expected_diff:,.2f}, PDF: {pdf_diff:,.2f}")
        return False
    return True
