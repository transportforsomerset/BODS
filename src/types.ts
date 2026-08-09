export interface Vehicle {
  vehicle_id: string;
  operator: string;
  operator_code: string;
  route: string;
  direction: string;
  origin: string;
  destination: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed_mps: number;
  occupancy: string;
  recorded_at: string;
  journey_id: string;
}

export interface BusData {
  schema_version: 1;
  generated_at: string;
  source: "live" | "github" | "pi" | "sample";
  status: "live" | "backup" | "stale" | "sample";
  data_age_seconds: number;
  vehicle_count: number;
  vehicles: Vehicle[];
}
