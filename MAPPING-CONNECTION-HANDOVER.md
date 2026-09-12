# Mapping ↔ X-Ray connection

## User flow
In X-Ray’s Render / Visualise screen, enter a property address and choose **Open property in map**. Prepare the property’s 3D view and fence layout, keep vertical scale at **Actual**, then select **Send to X-Ray**. The requesting X-Ray window validates the site and displays it. File export/import remains available when the map was not opened from X-Ray.

## Deployment settings
- X-Ray: `VITE_LOOPLET_MAP_URL` = the deployed mapping page URL.
- Mapping: `VITE_XRAY_ORIGINS` = comma-separated exact allowed X-Ray origins, e.g. `https://xray.example.com`. No paths or trailing slash.
- These are public connection settings, not credentials. Configure actual domains before production builds.
- Development defaults to map `http://127.0.0.1:5176/index.html`; mapping accepts local development X-Ray origins. DANS1 tests explicitly used map port 5186 and X-Ray 8080.
- Browser policy must allow the user-initiated mapping window and preserve its opener. A popup-blocked error is shown. If deployment COOP separates the windows, use file transfer until an approved alternative transport is implemented.

## Versioned contract
X-Ray opens map with query parameters `q` (address), `xrayOrigin` (exact requesting origin), and `xrayRequest` (UUID).

Map sends only after the user selects Send to X-Ray:
`{ type: "looplet:site-response", schema: "looplet.site-transfer/v1", requestId, bytes: ArrayBuffer }`.

X-Ray requires the exact window it opened, exact map origin, matching request UUID and schema, and a GLB payload ≤32 MiB. It validates the file, hashes its bytes and binds the import to the current project session. Project changes invalidate the connection.

Reply:
`{ type: "xray:site-ack", requestId, status: "accepted" | "failed" }`.
The map accepts only the exact requesting origin/window/request. Ten seconds without acknowledgement is an error, never a success message. Accepted means the file passed validation; subsequent 3D/render errors remain visible in X-Ray.

GLB scene metadata `extras.loopletSite.schema = "looplet.site/v1"` contains address, WGS84 centre, parcel ring, metre scene axes and offsets, processed terrain samples and provider attribution, fence geometry/settings, camera and caveats. Actual vertical scale is required. Aerial photographs are not redistributed. The datum remains the provider’s datum, not an independently certified level.

## Boundaries of this implementation
This is explicit site exchange between browser windows, not continuous background syncing, a server tile-fetch endpoint, certified structural data, or an imagery licence. AI generation uses X-Ray’s existing configured service; the unavailable-service state was tested without incurring a generation charge. Rendering does not alter measured geometry.

## Source owners
- Mapping: `src/lib/xray-site-link.ts`, `src/components/ui/SiteExport.tsx`, `Parcel3DView.tsx`.
- X-Ray: `src/studio/SiteImport.tsx`, `siteFile.ts`, `RenderStudio.tsx`, `assistant/renderTool.ts`.
- Tests: mapping `scripts/cdp/site-transfer-test.mjs`, `src/lib/xray-site-link.test.ts`; X-Ray `src/studio/siteFile.test.ts`.

Recovery: all changes remain in their working branches, uncommitted and undeployed. Do not overwrite unrelated changes. See `HANDOVER-20260913.md` for the wider work and remaining approval/build checks.
