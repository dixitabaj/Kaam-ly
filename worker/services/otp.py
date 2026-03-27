
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import time
import os
from dotenv import load_dotenv

# Load .env — go one level up from current file's directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

app = FastAPI()

# ===== Gmail SMTP config =====
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
LOGIN        = os.getenv("SMTP_LOGIN")
PASSWORD     = os.getenv("SMTP_PASSWORD")
SMTP_SERVER  = os.getenv("SMTP_SERVER", "smtp.gmail.com")
PORT         = int(os.getenv("SMTP_PORT", "587"))

print("SENDER_EMAIL:", SENDER_EMAIL)  # debug
print("SMTP_PASSWORD:", PASSWORD)     

# ===== In-memory OTP storage =====
otp_store = {}

# ===== OTP generation =====
def generate_otp(email: str):
    otp = str(random.randint(1000, 9999))  # fixed: was 1-9999, now always 4 digits
    otp_store[email] = {
        "otp":     otp,
        "expires": time.time() + 300       # 5 minutes
    }
    return otp

# ===== Send OTP email =====
def send_otp_email(receiver_email: str, otp: str):
    message = MIMEMultipart('alternative')
    message['From']    = SENDER_EMAIL
    message['To']      = receiver_email
    message['Subject'] = 'Your OTP Code'

    html_content = f"""
    <html>
      <body>
        <p>Hi,<br>
           Your OTP code is: <strong>{otp}</strong><br>
           This code will expire in 5 minutes.
        </p>
      </body>
    </html>
    """

    message.attach(MIMEText(html_content, "html"))

    server = smtplib.SMTP(SMTP_SERVER, PORT)
    server.starttls()                      # required for Gmail
    server.login(LOGIN, PASSWORD)
    server.sendmail(SENDER_EMAIL, receiver_email, message.as_string())
    server.quit()