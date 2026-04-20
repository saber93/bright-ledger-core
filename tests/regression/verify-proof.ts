import { inspect } from "node:util";
import { printProofHealthReport, verifyProofHealth } from "./support/proof-health";

async function main() {
  try {
    const report = await verifyProofHealth();
    printProofHealthReport(report);

    if (!report.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("[fail] Proof health verification could not complete.");
    console.error(
      error instanceof Error ? error.message : inspect(error, { depth: 5, breakLength: 120 }),
    );
    process.exitCode = 1;
  }
}

void main();
