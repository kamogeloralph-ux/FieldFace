import test from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, isWithinGeofence } from "./geofence";

test("geofence includes the exact site coordinate", () => {
  assert.equal(isWithinGeofence(-26.2041, 28.0473, -26.2041, 28.0473, 150).withinGeofence, true);
});

test("distance is symmetric and outside points are flagged", () => {
  const forward = distanceMeters(-26.2041, 28.0473, -26.2051, 28.0473);
  const reverse = distanceMeters(-26.2051, 28.0473, -26.2041, 28.0473);
  assert.ok(Math.abs(forward - reverse) < 0.001);
  assert.equal(isWithinGeofence(-26.2051, 28.0473, -26.2041, 28.0473, 10).withinGeofence, false);
});
