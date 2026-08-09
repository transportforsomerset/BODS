import type { BusData, Vehicle } from "./types";

export function validateBusData(data: unknown): data is BusData {
  if (!data || typeof data !== "object") {
    return false;
  }

  const value = data as Record<string, unknown>;

  if (value.schema_version !== 1) return false;
  if (typeof value.generated_at !== "string") return false;
  if (typeof value.source !== "string") return false;
  if (typeof value.status !== "string") return false;
  if (!Array.isArray(value.vehicles)) return false;

  return value.vehicles.every(isVehicle);
}

function isVehicle(value: unknown): value is Vehicle {
  if (!value || typeof value !== "object") {
    return false;
  }

  const vehicle = value as Record<string, unknown>;

  return (
    typeof vehicle.vehicle_id === "string" &&
    typeof vehicle.operator === "string" &&
    typeof vehicle.route === "string" &&
    typeof vehicle.destination === "string" &&
    typeof vehicle.latitude === "number" &&
    typeof vehicle.longitude === "number" &&
    typeof vehicle.bearing === "number" &&
    typeof vehicle.recorded_at === "string"
  );
}
