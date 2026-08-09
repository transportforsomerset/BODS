import { readFile, writeFile } from "node:fs/promises";
import type { BusData } from "./types";
import { validateBusData } from "./validate";
import { createStatusData } from "./status";

const inputFile = "data/sample-buses.json";
const busDataFile = "data/buses.json";
const statusFile = "data/status.json";

console.log("Transport for Somerset bus-data collector");
console.log(`Reading ${inputFile}...`);

const contents = await readFile(inputFile, "utf8");

let data: unknown;

try {
  data = JSON.parse(contents);
} catch {
  console.error("ERROR: sample-buses.json is not valid JSON.");
  process.exit(1);
}

if (!validateBusData(data)) {
  console.error("ERROR: sample bus data failed validation.");
  process.exit(1);
}

const busData = data as BusData;

// Sample mode simulates a freshly received feed.
if (busData.source === "sample") {
  const now = new Date().toISOString();

  busData.generated_at = now;

  for (const vehicle of busData.vehicles) {
    vehicle.recorded_at = now;
  }
}

busData.data_age_seconds = 0;
busData.vehicle_count = busData.vehicles.length;

console.log("Data validation successful.");
console.log(`Source: ${busData.source}`);
console.log(`Vehicles: ${busData.vehicle_count}`);
console.log(`Generated: ${busData.generated_at}`);

// Write the website-facing bus data.
await writeFile(
  busDataFile,
  `${JSON.stringify(busData, null, 2)}\n`,
  "utf8"
);

console.log(`Wrote ${busDataFile}`);

const statusData = createStatusData(busData);

await writeFile(
  statusFile,
  `${JSON.stringify(statusData, null, 2)}\n`,
  "utf8"
);

console.log("");
console.log("Status:");
console.log(`  Status: ${statusData.status}`);
console.log(`  Age: ${statusData.data_age_seconds} seconds`);
console.log(`  Vehicles: ${statusData.vehicle_count}`);
console.log(`  Message: ${statusData.message}`);

console.log("");
console.log("Routes:");

for (const vehicle of busData.vehicles) {
  console.log(
    `  Route ${vehicle.route}: ${vehicle.origin} → ${vehicle.destination}`
  );
}

console.log("");
console.log("Finished successfully.");
