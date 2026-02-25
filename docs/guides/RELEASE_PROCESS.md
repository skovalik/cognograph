# Release Process

Quick reference for creating signed releases of Cognograph.

---

## 🚀 Quick Release (after setup is complete)

```bash
# 1. Update version in package.json
npm version patch  # or minor, or major

# 2. Update CHANGELOG.md with changes

# 3. Commit changes
git add .
git commit -m "chore: release v1.5.4"

# 4. Create and push tag (triggers CI build)
git tag v1.5.4
git push origin main --tags

# 5. Monitor GitHub Actions
# → https://github.com/skovalik/cognograph/actions

# 6. Review draft release on GitHub
# → https://github.com/skovalik/cognograph/releases

# 7. Test downloads on Windows and macOS

# 8. Publish release when ready
```

---

## 📦 What Gets Built

### Windows
- `Cognograph-1.5.4-Setup.exe` (signed with EV certificate)
- Installer includes:
  - Desktop shortcut
  - Start menu entry
  - Uninstaller
  - File associations (.cognograph files)

### macOS
- `Cognograph-1.5.4.dmg` (signed & notarized)
- Universal binary (x64 + arm64)
- Drag-to-Applications installer
- Gatekeeper approved (no warnings)

### Linux
- `Cognograph-1.5.4.AppImage` (portable, no installation)
- `Cognograph-1.5.4.deb` (for Debian/Ubuntu)

---

## 🧪 Pre-Release Testing Checklist

Before tagging a release:

### Functional Testing
- [ ] Run all tests: `npm test`
- [ ] Type check: `npm run typecheck`
- [ ] Manual smoke test (see TESTING_CHECKLIST.md)

### Build Testing
- [ ] Test local build (unsigned): `npm run build`
- [ ] Test signed build locally (if certificates available)
- [ ] Verify app launches
- [ ] Check app version in About dialog

### Documentation
- [ ] Update CHANGELOG.md
- [ ] Update version in package.json
- [ ] Review README.md for accuracy

---

## 🔍 Verifying Signed Builds

### macOS
```bash
# Download the .dmg from GitHub Release
# Mount and check signature
codesign --verify --deep --strict --verbose=2 /Volumes/Cognograph/Cognograph.app

# Check notarization
spctl -a -vvv -t install /Volumes/Cognograph/Cognograph.app

# Should output: "accepted" and "notarized"
```

### Windows
```powershell
# Download the Setup.exe from GitHub Release
# Check signature
Get-AuthenticodeSignature .\Cognograph-1.5.4-Setup.exe | Format-List

# Should show:
# - Status: Valid
# - SignerCertificate: Your EV certificate
# - TimeStamperCertificate: Present
```

### Expected Results
- **macOS:** No Gatekeeper warnings when opening
- **Windows:** No SmartScreen warnings (after reputation builds)
- **Both:** App shows as verified/trusted in system settings

---

## 🐛 Troubleshooting Release Issues

### Build Fails in CI

**Check GitHub Actions logs:**
1. Go to: https://github.com/skovalik/cognograph/actions
2. Click the failed workflow run
3. Expand the failed step

**Common issues:**

**"Certificate not found" (macOS):**
- Verify `APPLE_CERTIFICATE_BASE64` secret is set correctly
- Check certificate hasn't expired
- Ensure password matches

**"Notarization failed" (macOS):**
- Check `APPLE_APP_SPECIFIC_PASSWORD` is correct
- Verify `APPLE_TEAM_ID` matches your account
- Review notarization logs (printed in CI output)

**"Signing failed" (Windows):**
- Verify `WIN_CSC_LINK` and `WIN_CSC_KEY_PASSWORD` are set
- For DigiCert KeyLocker: check all `SM_*` secrets
- Ensure certificate hasn't expired

### Release Not Created

If builds succeed but release isn't created:
1. Check if tag was pushed (`git ls-remote --tags origin`)
2. Verify workflow triggers on tags (check `.github/workflows/build-release.yml`)
3. Look for errors in "Create GitHub Release" step
4. Manually create release and attach artifacts

### Artifacts Missing

If some platform builds are missing:
1. Check if that OS build succeeded in Actions
2. Review artifact upload step for errors
3. Download artifacts manually from Actions UI
4. Re-run failed jobs if needed

---

## 📊 Post-Release Checklist

After publishing a release:

- [ ] Test downloads on fresh Windows machine
- [ ] Test downloads on fresh macOS machine
- [ ] Verify auto-update works (if enabled)
- [ ] Update website/landing page with new version
- [ ] Announce release (social media, mailing list, etc.)
- [ ] Monitor issue tracker for reports
- [ ] Update documentation if needed

---

## 🔐 Security Notes

### Certificate Expiration
- Windows EV: Typically 1-3 years
- macOS: Typically 5 years
- **Set calendar reminders 30 days before expiration**

### Secret Rotation
- Rotate `APPLE_APP_SPECIFIC_PASSWORD` annually
- Update GitHub secrets when certificates are renewed
- Keep backup of certificates in secure location (encrypted)

### Handling Compromised Certificates

**If certificate is compromised:**
1. **Immediately revoke** via provider portal
2. Remove GitHub secrets
3. Request replacement certificate
4. Update all GitHub secrets
5. Re-release affected versions with new certificate

---

## 📈 Building Reputation

### Windows SmartScreen
- New EV certificates: ~100-1000 downloads to build reputation
- Consistent signing: Always sign all releases
- No skipping versions: Maintain signing continuity
- Report false positives: Use Microsoft SmartScreen feedback

### macOS Gatekeeper
- First notarized build: Immediate trust
- Keep signing certificate valid
- Don't change Apple Developer account

---

## 🔄 Rollback Process

If a release has critical bugs:

```bash
# 1. Mark release as pre-release in GitHub UI
# OR delete the release (keeps tag)

# 2. Fix the bug in code

# 3. Create patch release
npm version patch
git commit -am "fix: critical bug in feature X"
git tag v1.5.5
git push origin main --tags

# 4. Previous release remains available in git history
# Users can install specific versions via direct download
```

---

## 📞 Support Resources

### Certificate Issues
- **DigiCert Support:** https://www.digicert.com/support
- **Apple Developer Support:** https://developer.apple.com/contact/
- **Windows Code Signing:** https://docs.microsoft.com/en-us/windows-hardware/drivers/dashboard/

### Build Issues
- **electron-builder Docs:** https://www.electron.build/
- **GitHub Actions Support:** https://github.com/actions
- **Cognograph Issues:** https://github.com/skovalik/cognograph/issues

---

*Last updated: 2026-02-12*
