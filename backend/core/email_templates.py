"""
core/email_templates.py
-----------------------
Branded HTML email templates for WorkWise.
All templates are self-contained (inline CSS) for maximum email client compatibility.
"""

BRAND_COLOR = '#0d9488'
DARK_BG     = '#0f172a'


def _base(title: str, body_html: str, company_name: str = 'WorkWise') -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Logo bar -->
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="display:inline-table;">
                <tr>
                  <td style="background:{BRAND_COLOR};border-radius:12px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                    <span style="color:#fff;font-weight:900;font-size:22px;line-height:1;">W</span>
                  </td>
                  <td style="padding-left:10px;font-weight:700;font-size:20px;color:#0f172a;vertical-align:middle;">WorkWise</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#ffffff;border-radius:16px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
              {body_html}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;font-size:12px;color:#94a3b8;">
              Sent by {company_name} via WorkWise &mdash; Kenya&apos;s HR &amp; Finance Platform<br/>
              This email is confidential. Do not forward or share.
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def invite_email_html(
    first_name: str,
    admin_name: str,
    company_name: str,
    role_display: str,
    email: str,
    temp_password: str,
    login_url: str,
) -> tuple[str, str]:
    """
    Returns (subject, html_body) for an invite email.
    """
    subject = f"You've been invited to join {company_name} on WorkWise"
    body = f"""
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">You're invited! 🎉</h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
        <strong style="color:#0f172a;">{admin_name}</strong> has added you to
        <strong style="color:#0f172a;">{company_name}</strong> on WorkWise as
        <strong style="color:{BRAND_COLOR};">{role_display}</strong>.
      </p>

      <!-- Credentials box -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:24px;">
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">Your Login Credentials</p>
            <table cellpadding="0" cellspacing="0" style="margin-top:12px;width:100%;">
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600;width:90px;">Email</td>
                <td style="padding:6px 0;font-size:13px;color:#0f172a;font-weight:700;">{email}</td>
              </tr>
              <tr>
                <td style="padding:6px 0;font-size:13px;color:#64748b;font-weight:600;">Password</td>
                <td style="padding:6px 0;">
                  <code style="font-size:14px;font-weight:700;color:{BRAND_COLOR};background:#f0fdf4;padding:4px 8px;border-radius:6px;border:1px solid #bbf7d0;">{temp_password}</code>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA button -->
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr>
          <td align="center">
            <a href="{login_url}"
               style="display:inline-block;background:{BRAND_COLOR};color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 32px;border-radius:12px;">
              Sign In to WorkWise &rarr;
            </a>
          </td>
        </tr>
      </table>

      <!-- Security note -->
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border:1px solid #fde68a;border-radius:10px;">
        <tr>
          <td style="padding:14px 16px;font-size:13px;color:#854d0e;">
            <strong>Security reminder:</strong> Please change your password after your first login.
            Go to <strong>Settings &rarr; Security &rarr; Change Password</strong>.
          </td>
        </tr>
      </table>
    """
    return subject, _base(subject, body, company_name)


def payslip_email_html(
    employee_name: str,
    company_name: str,
    month_name: str,
    gross_salary: float,
    paye: float,
    nssf: float,
    shif: float,
    ahl: float,
    net_pay: float,
) -> tuple[str, str]:
    """
    Returns (subject, html_body) for a payslip delivery email.
    """
    subject = f"Your {month_name} Payslip — {company_name}"

    def fmt(n: float) -> str:
        return f"KES {n:,.2f}"

    total_deductions = paye + nssf + shif + ahl

    body = f"""
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0f172a;">Your Payslip is Ready</h1>
      <p style="margin:0 0 24px;color:#64748b;font-size:15px;">
        Hi <strong style="color:#0f172a;">{employee_name}</strong>, here is your official pay summary for
        <strong style="color:#0f172a;">{month_name}</strong>.
        Your full payslip PDF is attached.
      </p>

      <!-- Pay summary table -->
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;">
        <tr style="background:#f8fafc;">
          <td colspan="2" style="padding:14px 20px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;">
            Earnings
          </td>
        </tr>
        <tr>
          <td style="padding:10px 20px;font-size:14px;color:#475569;border-top:1px solid #f1f5f9;">Gross Pay</td>
          <td style="padding:10px 20px;font-size:14px;font-weight:700;color:#0f172a;text-align:right;border-top:1px solid #f1f5f9;">{fmt(gross_salary)}</td>
        </tr>
        <tr style="background:#f8fafc;">
          <td colspan="2" style="padding:14px 20px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.08em;border-top:1px solid #e2e8f0;">
            Statutory Deductions
          </td>
        </tr>
        <tr>
          <td style="padding:8px 20px;font-size:13px;color:#64748b;border-top:1px solid #f1f5f9;">PAYE (Income Tax)</td>
          <td style="padding:8px 20px;font-size:13px;color:#ef4444;text-align:right;border-top:1px solid #f1f5f9;">- {fmt(paye)}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;font-size:13px;color:#64748b;border-top:1px solid #f1f5f9;">NSSF</td>
          <td style="padding:8px 20px;font-size:13px;color:#ef4444;text-align:right;border-top:1px solid #f1f5f9;">- {fmt(nssf)}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;font-size:13px;color:#64748b;border-top:1px solid #f1f5f9;">SHIF</td>
          <td style="padding:8px 20px;font-size:13px;color:#ef4444;text-align:right;border-top:1px solid #f1f5f9;">- {fmt(shif)}</td>
        </tr>
        <tr>
          <td style="padding:8px 20px;font-size:13px;color:#64748b;border-top:1px solid #f1f5f9;">Housing Levy (AHL)</td>
          <td style="padding:8px 20px;font-size:13px;color:#ef4444;text-align:right;border-top:1px solid #f1f5f9;">- {fmt(ahl)}</td>
        </tr>
        <tr style="background:#f0fdf4;">
          <td style="padding:14px 20px;font-size:15px;font-weight:800;color:#0f172a;border-top:2px solid #bbf7d0;">
            Net Take-Home Pay
          </td>
          <td style="padding:14px 20px;font-size:18px;font-weight:900;color:{BRAND_COLOR};text-align:right;border-top:2px solid #bbf7d0;">
            {fmt(net_pay)}
          </td>
        </tr>
      </table>

      <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
        This is a system-generated document. Do not reply to this email.
      </p>
    """
    return subject, _base(subject, body, company_name)
