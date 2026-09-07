# Tablet production layout failure ? 197ab630793e

Source archive SHA256: 197ab630793e7604fde06b80e8b27e20ac82e84c145ff93ef58ced9829da205b. Built preview 8090; isolated persistent session growth-boundaries-prod-tablet. Redburn opened via actual UI; start picked on plan at x0/z2.1, drag look yaw pi. No camera or application state assignment.

- 1024?768: door card bottom570; navigation hint top547.828125. Vertical overlap22.171875px. Button294?44, bottom dock visible. Default side panels leave model364px wide, causing extensive upper toolbar wrapping. Screenshot production-197ab-tablet-landscape-prompt-attempt1.png inspected; runner15-46-05-283Z.
- 768?1024: door card bottom826; hint top821.21875. Vertical overlap4.78125px. Button294?44, inside viewport and hit-test true; bottom dock no overlap. Screenshot production-197ab-tablet-portrait-prompt-attempt1.png inspected; runner15-47-09-887Z throws overlap assertion and exits1.

These are real application layout failures and remain retained. Architect108-command functional journey passed separately; it does not clear this tablet gate. Browser auto-launch attempts without escalation failed before app navigation, and are separate tooling failures.
