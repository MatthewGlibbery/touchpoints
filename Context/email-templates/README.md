# Email templates

On-brand HTML for Supabase auth emails. Source of truth for what's pasted into the Supabase dashboard.

## Files
- `confirm-signup.html` — first-time signup OTP
- `magic-link.html` — returning sign-in OTP

## How to deploy
1. Open Supabase Dashboard → **Authentication → Email Templates**
2. Select the matching template (`Confirm signup` or `Magic Link`)
3. Paste the HTML; set the subject line:
   - Confirm signup: `Welcome to Touchpoints — confirm your email`
   - Magic Link: `Your Touchpoints sign-in code`
4. Save

## Notes
- Both templates use OTP-only flow (`{{ .Token }}` only, no `{{ .ConfirmationURL }}`) — magic links across mismatched domains get spam-flagged. The app verifies via `verifyOtp({ type: 'email' })`.
- Brand mark is a CSS-drawn rounded square with white "T" — no external image dependencies. To use the actual GitBranch logo, host a PNG/SVG on Supabase Storage and inline `<img src="…" width="36" height="36" alt="Touchpoints">`.
- Fonts match the app: sans `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif`; mono `ui-monospace, Consolas, monospace`.
- Code block styling (orange border + monospace + letterspacing) flexes for any OTP length 6–10.
- Layout is table-based with inline styles only — Gmail/Outlook compatible.

When editing templates in the dashboard, update the corresponding file here so the repo stays in sync.
