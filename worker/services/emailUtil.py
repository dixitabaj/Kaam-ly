import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv
 
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
 
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
LOGIN        = os.getenv("SMTP_LOGIN")
PASSWORD     = os.getenv("SMTP_PASSWORD")
SMTP_SERVER  = os.getenv("SMTP_SERVER", "smtp.gmail.com")
PORT         = int(os.getenv("SMTP_PORT", "587"))
 
 
def send_action_email(
    receiver_email: str,
    title: str,
    body_text: str,
    action: str,
    duration_days: int | None = None,
    admin_note: str | None = None,
):
    """
    Sends a warning or suspension email to a user.
    Uses the same Gmail SMTP config as your OTP emails.
    """
    is_suspend = "suspend" in action
    is_worker  = "worker"  in action
 
    accent_color = "#D94F3D" if is_suspend else "#E8843A"
    icon         = "🚫"     if is_suspend else "⚠️"
    heading      = "Account Suspended" if is_suspend else "Official Warning"
    user_type    = "Worker" if is_worker else "Customer"
 
    duration_html = ""
    if is_suspend and duration_days:
        duration_html = f"""
        <tr>
          <td style="padding: 8px 0; color: #7A6E65; font-size: 14px;">Suspension Duration</td>
          <td style="padding: 8px 0; font-weight: 600; color: #1C1410;">{duration_days} day(s)</td>
        </tr>"""
 
    admin_note_html = ""
    if admin_note:
        admin_note_html = f"""
        <div style="margin-top: 20px; padding: 14px 18px; background: #FFF7ED;
                    border-left: 4px solid {accent_color}; border-radius: 6px;">
          <div style="font-size: 12px; font-weight: 700; color: {accent_color};
                      text-transform: uppercase; margin-bottom: 6px;">Admin Note</div>
          <div style="font-size: 14px; color: #1C1410;">{admin_note}</div>
        </div>"""
 
    html_content = f"""
    <html>
      <body style="margin:0; padding:0; background:#F7F5EF;
                   font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#F7F5EF; padding: 40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0"
                     style="background:#FFFFFF; border-radius:16px;
                            box-shadow:0 4px 24px rgba(0,0,0,0.08); overflow:hidden;">
 
                <!-- Header -->
                <tr>
                  <td style="background:{accent_color}; padding: 32px 40px; text-align:center;">
                    <div style="font-size: 40px; margin-bottom: 12px;">{icon}</div>
                    <div style="font-size: 22px; font-weight: 700; color: white;">
                      {heading}
                    </div>
                    <div style="font-size: 13px; color: rgba(255,255,255,0.8); margin-top: 6px;">
                      Kaamly Admin Action — {user_type} Account
                    </div>
                  </td>
                </tr>
 
                <!-- Body -->
                <tr>
                  <td style="padding: 32px 40px;">
                    <p style="font-size: 15px; color: #1C1410; line-height: 1.6; margin: 0 0 24px;">
                      {body_text}
                    </p>
 
                    <!-- Details table -->
                    <table width="100%" cellpadding="0" cellspacing="0"
                           style="border-top: 1px solid #EDE8DF;">
                      <tr>
                        <td style="padding: 8px 0; color: #7A6E65; font-size: 14px;">Action</td>
                        <td style="padding: 8px 0; font-weight: 600; color: {accent_color};">
                          {action.replace("_", " ").title()}
                        </td>
                      </tr>
                      {duration_html}
                    </table>
 
                    {admin_note_html}
 
                    <!-- CTA -->
                    <div style="margin-top: 28px; text-align: center;">
                      <a href="mailto:support@kaamly.com"
                         style="display:inline-block; padding: 12px 28px;
                                background:{accent_color}; color:white;
                                border-radius:10px; text-decoration:none;
                                font-weight:600; font-size:14px;">
                        Contact Support
                      </a>
                    </div>
                  </td>
                </tr>
 
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background:#F7F5EF;
                              text-align:center; border-top: 1px solid #EDE8DF;">
                    <p style="margin:0; font-size:12px; color:#B0A89E;">
                      This is an automated message from Kaamly. Do not reply to this email.
                    </p>
                  </td>
                </tr>
 
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """
 
    msg = MIMEMultipart("alternative")
    msg["From"]    = SENDER_EMAIL
    msg["To"]      = receiver_email
    msg["Subject"] = f"Kaamly: {title}"
    msg.attach(MIMEText(html_content, "html"))
 
    try:
        server = smtplib.SMTP(SMTP_SERVER, PORT)
        server.starttls()
        server.login(LOGIN, PASSWORD)
        server.sendmail(SENDER_EMAIL, receiver_email, msg.as_string())
        server.quit()
        print(f"[EMAIL] ✅ Sent '{title}' → {receiver_email}")
        return True
    except Exception as e:
        print(f"[EMAIL] ❌ Failed → {receiver_email}: {e}")
        return False
 