import { readFile, writeFile } from "node:fs/promises";
import { fetchBodsData } from "./fetch-bods";
import { validateBusData } from "./validate";
import { createStatusData } from "./status";

const busDataFile = "docs/buses.json";
const statusFile = "docs/status.json";
const servicesFile = "data/services.json";

console.log("Transport for Somerset bus-data collector");

let busData;

try {
  busData = await fetchBodsData();
} catch (error) {
  console.error("ERROR: Unable to retrieve BODS data.");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exit(1);
}

if (!validateBusData(busData)) {
  console.error("ERROR: BODS data failed validation.");
  process.exit(1);
}

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
