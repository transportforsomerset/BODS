import { readFile, writeFile } from "node:fs/promises";
import { fetchBodsData } from "./fetch-bods";
import { validateBusData } from "./validate";
import { createStatusData } from "./status";
import { calculateDistanceMetres } from "./movement";
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


console.log("");
console.log("Movement analysis:");

const newHistory: Record<string, VehicleHistory> = {};

for (const vehicle of busData.vehicles) {
  const previous = previousHistory[vehicle.vehicle_id];

  if (!previous) {
    console.log(
      `${vehicle.route} ${vehicle.vehicle_id}: no previous position — recording baseline.`
    );
  } else {
    const distanceMetres = calculateDistanceMetres(
      previous.latitude,
      previous.longitude,
      vehicle.latitude,
      vehicle.longitude
    );

    const previousTime = Date.parse(previous.recorded_at);
    const currentTime = Date.parse(vehicle.recorded_at);
    const elapsedSeconds = (currentTime - previousTime) / 1000;

    if (elapsedSeconds > 0) {
      const speedMps = distanceMetres / elapsedSeconds;

      console.log(
        `${vehicle.route} ${vehicle.vehicle_id}: ` +
          `${distanceMetres.toFixed(1)}m in ${elapsedSeconds.toFixed(0)}s ` +
          `(${speedMps.toFixed(2)} m/s)`
      );
    } else {
      console.log(
        `${vehicle.route} ${vehicle.vehicle_id}: ` +
          `${distanceMetres.toFixed(1)}m — invalid time interval`
      );
    }
  }

  newHistory[vehicle.vehicle_id] = {
    vehicle_id: vehicle.vehicle_id,
    latitude: vehicle.latitude,
    longitude: vehicle.longitude,
    recorded_at: vehicle.recorded_at,
  };
}

await writeFile(
  historyFile,
  `${JSON.stringify(newHistory, null, 2)}\n`,
  "utf8"
);

console.log(`Wrote ${historyFile}`);

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
