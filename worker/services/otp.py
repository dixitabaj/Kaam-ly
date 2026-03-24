
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import random
import time

app = FastAPI()

# ===== Gmail SMTP config =====

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