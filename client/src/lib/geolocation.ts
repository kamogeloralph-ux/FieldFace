export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("This device/browser doesn't support location services."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || "Could not get your location. Please enable location access.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
