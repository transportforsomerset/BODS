import { readFile, writeFile } from "node:fs/promises";
import type { BusData } from "./types";
import { validateBusData } from "./validate";
import { createStatusData } from "./status";

const busDataFile = "data/buses.json";
const statusFile = "data/status.json";

console.log("Transport for Somerset bus-data collector");
console.log(`Reading ${busDataFile}...`);

const contents = await readFile(busDataFile, "utf8");

let data: unknown;

try {
  data = JSON.parse(contents);
} catch {
  console.error("ERROR: buses.json is not valid JSON.");
  process.exit(1);
}

if (!validateBusData(data)) {
  console.error("ERROR: buses.json failed validation.");
  process.exit(1);
}

const busData = data as BusData;

console.log("Data validation successful.");
console.log(`Source: ${busData.source}`);
console.log(`Vehicles: ${busData.vehicles.length}`);
console.log(`Generated: ${busData.generated_at}`);

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
console.log(`Wrote ${statusFile}`);
console.log("Finished successfully.");
