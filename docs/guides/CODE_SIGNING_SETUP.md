# Code Signing Setup Guide

This guide walks through setting up code signing for Cognograph on Windows and macOS, including CI/CD configuration.

---

## 📋 Overview

**Timeline:**
- Windows: ~2 weeks (certificate validation + setup)
- macOS: ~1 day (instant if individual developer)

**Costs:**
- Windows: ~$300-500/year (EV certificate) + optional ~$500/year (cloud HSM)
- macOS: $99/year (Apple Developer Program)

---

## 🪟 Windows Code Signing

### Step 1: Purchase EV Code Signing Certificate

**Recommended Providers:**
- **DigiCert** (https://www.digicert.com/signing/code-signing-certificates)
  - Includes cloud signing option (KeyLocker)
  - ~$500/year with cloud HSM
- **Sectigo** (https://sectigo.com/ssl-certificates-tls/code-signing)
  - ~$300/year, cloud signing available separately
- **SSL.com** (https://www.ssl.com/certificates/ev-code-signing/)
  - ~$400/year, includes cloud signing

**Why Extended Validation (EV)?**
- Regular certificates trigger Windows SmartScreen warnings
- EV certificates build reputation faster
- Required for immediate trust on Windows 10/11

### Step 2: Business Validation

You'll need:
1. **D-U-N-S Number** (free)
   - Apply at: https://www.dnb.com/duns-number/get-a-duns.html
   - Takes 3-5 business days
2. **Business Registration Documents**
   - Articles of Incorporation
   - Business license
3. **Phone Verification**
   - Certificate Authority will call to verify

**Timeline:** 3-7 business days after submitting documents

### Step 3: Receive Hardware Token

- EV certificates ship on a FIPS 140-2 compliant USB token
- Cannot be exported (security requirement)
- Store securely (this is your signing identity)

### Step 4: Set Up Cloud Signing (for CI/CD)

**Option A: DigiCert KeyLocker** (recommended)
1. Purchase "Software Trust Manager" subscription (~$500/year)
2. Upload your certificate to KeyLocker
3. Generate API credentials
4. Configure in GitHub Secrets (see below)

**Option B: Azure Key Vault**
1. Import your certificate to Azure Key Vault (~$150/year)
2. Configure Azure service principal
3. Use `electron-builder` Azure integration

### Step 5: Configure GitHub Secrets

Go to: `https://github.com/skovalik/cognograph/settings/secrets/actions`

**For standard certificate signing:**
```
WIN_CSC_LINK: <base64-encoded .pfx file>
WIN_CSC_KEY_PASSWORD: <certificate password>
```

**For DigiCert KeyLocker:**
```
SM_API_KEY: <KeyLocker API key>
SM_CLIENT_CERT_FILE_BASE64: <base64-encoded client cert>
SM_CLIENT_CERT_PASSWORD: <client cert password>
SM_CODE_SIGNING_CERT_SHA1_HASH: <cert thumbprint>
```

---

## 🍎 macOS Code Signing

### Step 1: Join Apple Developer Program

1. Go to: https://developer.apple.com/programs/
2. Click "Enroll"
3. Sign in with your Apple ID
4. Choose account type:
   - **Individual** ($99/year, instant approval)
   - **Organization** ($99/year, 1-2 day verification)
5. Complete payment

**Timeline:** Instant (individual) or 1-2 days (organization)

### Step 2: Create Developer ID Certificate

1. Log into: https://developer.apple.com/account/
2. Navigate to: **Certificates, Identifiers & Profiles**
3. Click **Certificates** → **+** (Create Certificate)
4. Select: **Developer ID Application**
5. Follow prompts to create a Certificate Signing Request (CSR):
   - Open **Keychain Access** on Mac
   - Menu: **Keychain Access** → **Certificate Assistant** → **Request a Certificate from a Certificate Authority**
   - Enter: Your email, "Stefan Kovalik", select "Saved to disk"
   - Upload the CSR file to Apple Developer portal
6. Download the certificate (`.cer` file)
7. Double-click to install in Keychain Access

### Step 3: Export Certificate for CI/CD

**On your Mac:**

```bash
# Open Keychain Access
# Navigate to: Login → My Certificates
# Find: "Developer ID Application: Stefan Kovalik"
# Right-click → Export "Developer ID Application..."
# Save as: cognograph-apple-cert.p12
# Set a strong password (you'll need this for GitHub Secrets)
```

**Convert to Base64:**

```bash
# macOS/Linux:
base64 -i cognograph-apple-cert.p12 -o certificate.txt

# Windows PowerShell:
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("cognograph-apple-cert.p12")) | Out-File certificate.txt
```

### Step 4: Get Your Team ID

1. Go to: https://developer.apple.com/account/
2. Click **Membership** in the sidebar
3. Copy your **Team ID** (10-character code like `A1B2C3D4E5`)

### Step 5: Generate App-Specific Password

1. Go to: https://appleid.apple.com/
2. Sign in with your Apple ID
3. Navigate to: **Security** → **App-Specific Passwords**
4. Click **+** to generate a new password
5. Label it: `Cognograph CI`
6. Copy the generated password (format: `xxxx-xxxx-xxxx-xxxx`)

### Step 6: Configure GitHub Secrets

Go to: `https://github.com/skovalik/cognograph/settings/secrets/actions`

Add these secrets:

```
APPLE_CERTIFICATE_BASE64: <contents of certificate.txt from Step 3>
APPLE_CERTIFICATE_PASSWORD: <password you set when exporting .p12>
APPLE_ID: <your Apple ID email>
APPLE_APP_SPECIFIC_PASSWORD: <password from Step 5>
APPLE_TEAM_ID: <Team ID from Step 4>
KEYCHAIN_PASSWORD: <generate a random password for CI keychain>
```

**Generate random keychain password:**
```bash
openssl rand -base64 32
```

---

## 🔧 Local Signing Configuration

### For macOS Development

Update `electron-builder.yml` with your identity:

```yaml
mac:
  identity: "Developer ID Application: Stefan Kovalik (YOUR_TEAM_ID)"
  hardenedRuntime: true
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  notarize:
    teamId: YOUR_TEAM_ID
```

Set environment variables in your shell (~/.zshrc or ~/.bashrc):

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="A1B2C3D4E5"
```

### For Windows Development

If using USB token locally:

```bash
npm run build:win
# electron-builder will automatically find the certificate in the Windows certificate store
```

If using .pfx file:

```bash
# Set environment variables
set CSC_LINK=C:\path\to\certificate.pfx
set CSC_KEY_PASSWORD=your-password

npm run build:win
```

---

## 🚀 Testing the Build Pipeline

### Test Locally (Unsigned)

```bash
# Build for current platform (unsigned)
npm run build

# Build for specific platform
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
```

### Test Locally (Signed)

**macOS:**
```bash
# Ensure environment variables are set
npm run build:mac

# Verify signature
codesign --verify --deep --strict --verbose=2 release/*/Cognograph.app

# Verify notarization
spctl -a -vvv -t install release/*/Cognograph.app
```

**Windows:**
```bash
npm run build:win

# Verify signature (PowerShell)
Get-AuthenticodeSignature release\*\Cognograph-*-Setup.exe
```

### Test CI/CD Pipeline

1. **Push a test tag:**
   ```bash
   git tag v1.5.3-test
   git push origin v1.5.3-test
   ```

2. **Monitor GitHub Actions:**
   - Go to: https://github.com/skovalik/cognograph/actions
   - Watch the "Build & Release" workflow
   - Check for errors in signing steps

3. **Download artifacts:**
   - Artifacts are uploaded even if release creation fails
   - Test the signed builds on target platforms

4. **Clean up test tag:**
   ```bash
   git tag -d v1.5.3-test
   git push origin :refs/tags/v1.5.3-test
   ```

---

## 🐛 Troubleshooting

### macOS Issues

**"No identity found" error:**
```bash
# List available identities
security find-identity -v -p codesigning

# If empty, ensure certificate is installed
# Re-download from Apple Developer portal
```

**Notarization timeout:**
```bash
# Check notarization status
xcrun notarytool history --apple-id YOUR_APPLE_ID --password YOUR_APP_PASSWORD --team-id YOUR_TEAM_ID

# Get detailed logs
xcrun notarytool log SUBMISSION_ID --apple-id YOUR_APPLE_ID --password YOUR_APP_PASSWORD --team-id YOUR_TEAM_ID
```

**"Code object is not signed at all" error:**
- Check that `hardenedRuntime: true` is set
- Ensure entitlements file exists
- Verify certificate is not expired

### Windows Issues

**"Cannot find signing certificate" error:**
```powershell
# Check certificate store
Get-ChildItem -Path Cert:\CurrentUser\My

# Ensure CSC_LINK and CSC_KEY_PASSWORD are set correctly
```

**SmartScreen warnings persist:**
- This is normal for new certificates
- Build reputation by distributing signed builds
- EV certificates reduce this period from months to days

**DigiCert KeyLocker issues:**
- Verify API credentials are correct
- Check cert hash matches the uploaded certificate
- Ensure client certificate is valid

---

## 📚 Additional Resources

### Windows
- [Microsoft: Code Signing Best Practices](https://docs.microsoft.com/en-us/windows-hardware/drivers/dashboard/code-signing-best-practices)
- [electron-builder: Windows Code Signing](https://www.electron.build/code-signing#windows)
- [DigiCert KeyLocker Docs](https://docs.digicert.com/en/software-trust-manager.html)

### macOS
- [Apple: Notarizing macOS Software](https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution)
- [electron-builder: macOS Code Signing](https://www.electron.build/code-signing#macos)
- [Keychain Access Guide](https://support.apple.com/guide/keychain-access/welcome/mac)

### General
- [electron-builder: Code Signing](https://www.electron.build/code-signing)
- [GitHub Actions: Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

## ✅ Checklist

### Windows Setup
- [ ] Purchase EV Code Signing Certificate
- [ ] Complete business validation (D-U-N-S, documents)
- [ ] Receive hardware USB token
- [ ] Set up cloud signing (DigiCert KeyLocker or Azure Key Vault)
- [ ] Add GitHub Secrets (WIN_CSC_LINK, WIN_CSC_KEY_PASSWORD or SM_* variables)
- [ ] Test local build with signing
- [ ] Test CI build with signing

### macOS Setup
- [ ] Join Apple Developer Program ($99/year)
- [ ] Create Developer ID Application certificate
- [ ] Export certificate as .p12 file
- [ ] Get Team ID from Apple Developer portal
- [ ] Generate App-Specific Password
- [ ] Convert certificate to Base64
- [ ] Add GitHub Secrets (APPLE_*)
- [ ] Update electron-builder.yml with identity
- [ ] Test local build with signing + notarization
- [ ] Test CI build with signing + notarization

### CI/CD Setup
- [ ] Create .github/workflows/build-release.yml
- [ ] Configure all GitHub Secrets
- [ ] Test workflow with test tag
- [ ] Verify signed artifacts download correctly
- [ ] Test signed builds on target platforms
- [ ] Document release process for team

---

*Last updated: 2026-02-12*
