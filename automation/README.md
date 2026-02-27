# MREP Automation Deployment Guide

## Prerequisites
1. **Node.js**: Install Node.js (v16 or higher).
2. **Python**: Install Python (v3.9 or higher).

## Setup Instructions

1. **Unzip the Files**:
   Extract `run_automation.zip` to your desired folder on the server.

2. **Install Node.js Dependencies**:
   Open a terminal in the folder and run:
   ```bash
   npm install
   npx playwright install chromium
   ```

3. **Install Python Dependencies**:
   ```bash
   pip install -r requirements.txt
   playwright install
   ```

4. **Configure Environment Variables**:
   Create a `.env` file in the same directory (or rename `.env.example` if provided) and fill in your details:
   ```
   # MREP Integration
   MREP_COMPANY=your_company_code
   MREP_USER=your_username
   MREP_PASS=your_password
   
   # WhatsApp Configuration
   # Comma-separated list for multiple recipients
   WHATSAPP_NUMBER=923001234567,923007654321
   COMPANY_NAME=Swiss Pharma
   
   # Schedule (24h format)
   SCHEDULE_TIME=20:00
   ```

5. **Initialize WhatsApp Session**:
   Run this ONCE manually to scan the QR code:
   ```bash
   node whatsapp_send.cjs
   ```
   Follow the on-screen instructions to link your device.

## Running the Automation
To start the daily scheduler:
```bash
python main.py
```
To run immediately (for testing):
```bash
python main.py --now
```
