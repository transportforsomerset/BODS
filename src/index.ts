import { readFile } from "node:fs/promises";
import type { BusData } from "./types";
import { validateBusData } from "./validate";

const file = "data/buses.json";

console.log("Transport for Somerset bus-data collector");
console.log(`Reading ${file}...`);

const contents = await readFile(file, "utf8");

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
console.log(`Status: ${busData.status}`);
console.log(`Vehicles: ${busData.vehicle_count}`);
console.log(`Generated: ${busData.generated_at}`);

for (const vehicle of busData.vehicles) {
  console.log(
    `  Route ${vehicle.route}: ${vehicle.origin} → ${vehicle.destination}`
  );
}

console.log("Finished successfully.");
