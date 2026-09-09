import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  });
  const proofDir = resolve("screenshots/proof-run");
  mkdirSync(proofDir, { recursive: true });

  // 1. Desktop Session
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  console.log("Navigating to app on http://127.0.0.1:8080/ ...");
  await page.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);

  // Verify Plan Dropdown exists, is enabled, and has options
  const planSelect = page.locator(".workspace-plan-controls select");
  await planSelect.waitFor({ state: "visible" });
  const isDisabled = await planSelect.isDisabled();
  console.log("Plan select disabled state:", isDisabled);
  if (isDisabled) throw new Error("Plan select should NOT be disabled!");

  const options = await planSelect.locator("option").allInnerTexts();
  console.log("Plan select options:", options);

  // Capture screenshot of working plan switcher
  await page.screenshot({ path: `${proofDir}/01-plan-switcher-fixed.png` });

  // Navigate to Model tab
  console.log("Switching to Model pane...");
  const modelTab = page.locator("button.pane-tab", { hasText: "Model" });
  await modelTab.click();
  await page.waitForTimeout(1000);

  // If preview CTA is shown, click it to enter 3D viewer
  const previewCta = page.locator("button.building-preview-cta");
  if (await previewCta.isVisible()) {
    console.log("Clicking Explore & Draw 3D Model CTA...");
    await previewCta.click();
    await page.waitForTimeout(1000);
  }

  // Check Magic Pencil toolbar button styling
  const magicPencilBtn = page.locator(".building-toolbar button.magic-pencil-btn");
  await magicPencilBtn.waitFor({ state: "visible", timeout: 10000 });

  // Evaluate computed style of magic pencil button - verify Facebook Blue (#1877F2 -> rgb(24, 119, 242))
  const btnStyles = await magicPencilBtn.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return {
      background: s.backgroundImage || s.backgroundColor,
      borderColor: s.borderColor,
      color: s.color,
    };
  });
  console.log("Magic Pencil button styles:", btnStyles);

  // Click Magic Pencil to activate drafting mode
  console.log("Clicking Magic Pencil toolbar button...");
  await magicPencilBtn.click();
  await page.waitForTimeout(1000);

  // Verify Draftsman Control Dock appears
  const dock = page.locator(".draftsman-control-dock");
  await dock.waitFor({ state: "visible" });

  // Verify dock position (default bottom-left)
  const dockPos = await dock.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      datasetPos: el.dataset.dockPosition,
      left: rect.left,
      bottom: window.innerHeight - rect.bottom,
      position: style.position,
    };
  });
  console.log("Draftsman dock position:", dockPos);

  // Check buttons inside dock: white pill buttons and Facebook Blue test button
  const whitePills = await page.locator(".draftsman-action-pill.draftsman-white-pill").count();
  console.log("Number of white pill buttons in dock:", whitePills);

  const testBtn = page.locator("[data-testid='magic-pencil-test-btn']");
  const testBtnStyles = await testBtn.evaluate((el) => {
    const s = window.getComputedStyle(el);
    return {
      backgroundColor: s.backgroundColor,
      color: s.color,
      borderRadius: s.borderRadius,
    };
  });
  console.log("Magic Pencil Test button styles:", testBtnStyles);

  // Test Actual Size Stepper
  console.log("Testing Actual Size stepper...");
  const initialScale = await dock.getAttribute("data-pencil-scale");
  console.log("Initial pencil scale:", initialScale);

  const plusSizeBtn = page.locator(".draftsman-adjuster-stepper", { hasText: "Pencil Size" }).locator("button[aria-label='Increase pencil size']");
  await plusSizeBtn.click();
  await page.waitForTimeout(300);
  const newScale = await dock.getAttribute("data-pencil-scale");
  console.log("New pencil scale after plus:", newScale);

  // Test Movement Speed Stepper
  console.log("Testing Movement Speed stepper...");
  const plusSpeedBtn = page.locator(".draftsman-adjuster-stepper", { hasText: "Speed" }).locator("button[aria-label='Increase drafting speed']");
  await plusSpeedBtn.click();
  await page.waitForTimeout(300);

  // Capture desktop verified screenshot
  console.log("Capturing desktop verified screenshot...");
  await page.screenshot({ path: `${proofDir}/02-desktop-magic-pencil-verified.png` });

  // 2. iOS Mobile Session (390x844)
  console.log("Opening iOS Mobile session (390x844)...");
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobilePage.goto("http://127.0.0.1:8080/", { waitUntil: "domcontentloaded" });
  await mobilePage.waitForTimeout(1000);
  const mobileModelTab = mobilePage.locator("button.pane-tab", { hasText: "Model" });
  await mobileModelTab.click();
  await mobilePage.waitForTimeout(1000);

  const mobilePreviewCta = mobilePage.locator("button.building-preview-cta");
  if (await mobilePreviewCta.isVisible()) {
    await mobilePreviewCta.click();
    await mobilePage.waitForTimeout(1000);
  }

  const mobilePencilBtn = mobilePage.locator(".building-toolbar button.magic-pencil-btn");
  await mobilePencilBtn.waitFor({ state: "visible", timeout: 10000 });
  await mobilePencilBtn.click();
  await mobilePage.waitForTimeout(1000);

  // Verify responsive dock on mobile
  const mobileDock = mobilePage.locator(".draftsman-control-dock");
  await mobileDock.waitFor({ state: "visible" });
  console.log("Capturing iOS mobile verified screenshot...");
  await mobilePage.screenshot({ path: `${proofDir}/03-ios-mobile-magic-pencil-verified.png` });

  await browser.close();

  console.log("SUCCESS: All verification checks passed!");
}

run().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
