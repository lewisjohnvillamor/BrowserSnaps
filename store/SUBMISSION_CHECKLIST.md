# BrowserSnaps Chrome Web Store Submission Checklist

## Before uploading

- [ ] Push BrowserSnaps v1.8.0 and confirm the public repository opens without signing in.
- [ ] Open the [public privacy policy](https://github.com/lewisjohnvillamor/BrowserSnaps/blob/main/PRIVACY.md) in a signed-out browser window.
- [ ] Register the Chrome Web Store publisher account.
- [ ] Pay the one-time publisher registration fee shown by Google.
- [ ] Enable two-step verification on the publisher Google account.
- [ ] Verify the publisher email address and monitor it for review messages.
- [ ] Run `npm run validate:store` from the repository root.
- [ ] Confirm every automated test passes.
- [ ] Confirm `dist/BrowserSnaps-v1.8.0-chrome-web-store.zip` is generated.
- [ ] Load the contents of `dist/extension/` as an unpacked extension and complete one final capture test.

## Package tab

- [ ] Create a new Chrome Web Store item.
- [ ] Upload `dist/BrowserSnaps-v1.8.0-chrome-web-store.zip`.
- [ ] Confirm the dashboard reads version 1.8.0.
- [ ] Confirm the manifest is accepted without warnings.

## Store listing tab

- [ ] Copy the name, summary, category, language, description, and URLs from [`LISTING_COPY.md`](LISTING_COPY.md).
- [ ] Upload `assets/screenshot-01-results.png`.
- [ ] Upload `assets/screenshot-02-capture.png`.
- [ ] Upload `assets/screenshot-03-popup.png`.
- [ ] Optionally upload `assets/promo-small-440x280.png` as the small promotional tile.
- [ ] Confirm all screenshots appear sharp and in the intended order.
- [ ] Confirm the support and homepage links work without signing in.

## Privacy practices tab

- [ ] Paste the single-purpose statement from [`LISTING_COPY.md`](LISTING_COPY.md).
- [ ] Paste the justification for `activeTab`.
- [ ] Paste the justification for `scripting`.
- [ ] Paste the justification for `debugger`.
- [ ] Paste the justification for `downloads`.
- [ ] Paste the justification for `offscreen`.
- [ ] Declare that the extension uses no remote code.
- [ ] Declare Web browsing activity because selected page URLs are processed.
- [ ] Declare Website content because visible content is processed into screenshots.
- [ ] State that processing and retention occur locally on the user's device.
- [ ] Confirm that data is not sold, shared, used for advertising, or used for lending decisions.
- [ ] Add the privacy-policy URL in the designated field.
- [ ] Confirm the dashboard disclosures, listing description, extension UI, and privacy policy say the same thing.

## Distribution tab

- [ ] Select Public visibility, or Unlisted for an initial limited rollout.
- [ ] Select the intended regions.
- [ ] Declare no in-app purchases.
- [ ] Declare that the extension does not contain mature content.

## Before submitting for review

- [ ] Install the exact uploaded build, if the dashboard makes a test installation available.
- [ ] Test Current tab capture.
- [ ] Test at least one responsive preset.
- [ ] Test PDF export.
- [ ] Test PNG or ZIP export.
- [ ] Confirm the debugger detaches after success, cancellation, and failure.
- [ ] Confirm the extension displays its local-data disclosure before capture begins.
- [ ] Confirm the in-extension Privacy details page opens.
- [ ] Confirm no page content or screenshot data is transmitted over the network.
- [ ] Submit using staged publishing for the first release, if available.

## After approval

- [ ] Install BrowserSnaps from the approved store listing in a clean Chrome profile.
- [ ] Complete a production capture and export test.
- [ ] Verify the store listing, screenshots, privacy link, and support link.
- [ ] Publish the staged release when the clean-profile test passes.
- [ ] Add the Chrome Web Store installation link to the README.
- [ ] Monitor the publisher email and GitHub issues for user reports.
