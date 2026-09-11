# Remove duplicate project card

The user's marked screenshot crosses out the large Current project card on Drawings. Removed that `ProjectDetails` instance from `SheetsPane` in `src/studio/Studio.tsx`. Project details and Rename remain in the Project dialog; Sheet register is now the first content on Drawings.

This follow-up changes one product line:

```diff
 function SheetsPane(...) {
   return (<>
-    <ProjectDetails />
     <SheetManager />
```

DANS1 verification: `dev/result.json` and `production/result.json` each passed 14/14 raw-CDP operations. Checked absence of the card in Drawings, presence of Sheet register, and retained Project dialog/Rename. Desktop 1280×800 and tablet 1024×768 screenshots were visually inspected for both dev and built output. No uncaught runtime exceptions. Isolated browser contexts were disposed.

`completion.json`: typecheck, focused tests and web build passed using the DANS1 build worker, High priority and 16 workers. Build source SHA-256: `09d7372f5f658ea89a8745790767f07353548222a55229c5cecb232437309233`. Studio.tsx local/remote SHA-256 matched: `7686d7f25e38703ccd0946f240e4f809ac377bd347437894643425f7846408ce`.

Remote build: `C:\Users\danie\XRayBuilds\runs\09d7372f5f65`. Proof: `C:\Users\danie\XRayBuilds\navigation-card-20260911`. Cleanup records confirm no test listeners remain. User preview and all prior changes were preserved. No deployment or native release performed.
