import { runGolden, type TestResult } from "./golden";

function main() {
  let results: TestResult[];
  try {
    results = runGolden();
  } catch (err) {
    console.error("\nEval could not run:");
    console.error(err instanceof Error ? err.message : err);
    console.error(
      "\nMake sure the dataset is present at ./data (the 10 CSVs) before running the eval.\n"
    );
    process.exit(1);
    return;
  }

  const pass = results.filter((r) => r.pass).length;
  const fail = results.length - pass;

  console.log("\nInvestor Copilot — deterministic core eval\n");
  for (const r of results) {
    const icon = r.pass ? "PASS" : "FAIL";
    console.log(`  [${icon}] ${r.name}${r.detail ? `  —  ${r.detail}` : ""}`);
  }
  console.log("\n" + "-".repeat(60));
  console.log(`  ${pass}/${results.length} passed, ${fail} failed`);
  console.log("-".repeat(60) + "\n");

  process.exit(fail > 0 ? 1 : 0);
}

main();
