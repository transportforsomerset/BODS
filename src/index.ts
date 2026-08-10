import { readFile, writeFile } from "node:fs/promises";
import { fetchBodsData } from "./fetch-bods";
import { validateBusData } from "./validate";
import { createStatusData } from "./status";
import { calculateDistanceMetres } from "./movement";
import { analyseMovement } from "./functions";
import type { VehicleHistory } from "./types";

const busDataFile = "docs/buses.json";
const statusFile = "docs/status.json";
const servicesFile = "data/services.json";
const historyFile = "data/vehicle-history.json";

console.log(`Reading ${servicesFile}...`);

const servicesContents = await readFile(servicesFile, "utf8");

let services: string[];

try {
  const parsedServices: unknown = JSON.parse(servicesContents);

  if (
    !Array.isArray(parsedServices) ||
    !parsedServices.every((service) => typeof service === "string")
  ) {
    throw new Error("services.json must contain an array of strings.");
  }

  services = parsedServices;
} catch (error) {
  console.error(`ERROR: Could not read ${servicesFile}.`);
  console.error(error);
  process.exit(1);
}

const TRACKED_SERVICES = new Set(services);

console.log(`Tracking services: ${services.join(", ")}`);

console.log("Transport for Somerset bus-data collector");


console.log(`Reading ${historyFile}...`);

const historyContents = await readFile(historyFile, "utf8");

let previousHistory: Record<string, VehicleHistory>;

try {
  const parsedHistory: unknown = JSON.parse(historyContents);

  if (
    typeof parsedHistory !== "object" ||
    parsedHistory === null ||
    Array.isArray(parsedHistory)
  ) {
    throw new Error("vehicle-history.json must contain an object.");
  }

  previousHistory = parsedHistory as Record<string, VehicleHistory>;
} catch (error) {
  console.error(`ERROR: Could not read ${historyFile}.`);
  console.error(error);
  process.exit(1);
}

let busData;

try {
  busData = await fetchBodsData(TRACKED_SERVICES);
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

const newHistory = analyseMovement(
  busData.vehicles,
  previousHistory
);

await writeFile(
  historyFile,
  `${JSON.stringify(newHistory, null, 2)}\n`,
  "utf8"
);

console.log(`Wrote ${historyFile}`);

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
