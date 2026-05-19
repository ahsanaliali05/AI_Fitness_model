import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, 13);
  }, [center, map]);
  return null;
}

export default function GymMap({ userLocation, gyms, forceCenter }) {
  const center = forceCenter || userLocation;
  if (!center) return <div className="text-center py-4">Loading map…</div>;

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: '400px', width: '100%', borderRadius: '0.75rem', zIndex: 0 }}
    >
      <ChangeView center={center} />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* User location marker (if available and not overridden by search) */}
      {userLocation && !forceCenter && (
        <Marker position={userLocation}>
          <Popup>You are here</Popup>
        </Marker>
      )}
      {gyms.map((gym) => (
        <Marker key={gym.id} position={[gym.lat, gym.lng]}>
          <Popup>
            <strong>{gym.name}</strong><br />
            {gym.address && <>{gym.address}<br /></>}
            {gym.phone && <>{gym.phone}<br /></>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}