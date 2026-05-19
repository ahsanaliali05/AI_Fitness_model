import { useEffect, useState } from 'react';
import api from '../api';
import GymMap from '../components/GymMap';
import { FiMapPin, FiLoader, FiSearch } from 'react-icons/fi';

export default function Gyms() {
  const [userLocation, setUserLocation] = useState(null);
  const [gyms, setGyms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchAddress, setSearchAddress] = useState('');
  const [isDemoData, setIsDemoData] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [useManualCoords, setUseManualCoords] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');

  const fetchNearbyGyms = async (lat, lng) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/api/gyms/nearby?lat=${lat}&lng=${lng}&radius=10000`);
      const results = res.data.results || [];
      setGyms(results);
      setIsDemoData(res.data.is_demo || false);
      setMapCenter([lat, lng]);
      if (results.length === 0 && !res.data.is_demo) {
        setError('No gyms found in this area. Try a different location.');
      } else if (res.data.is_demo) {
        setError('Showing sample gyms (real data not available).');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load gyms. Please try again.');
      setGyms([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchAddress.trim()) return;
    setLoading(true);
    setError('');
    try {
      const geoRes = await api.get(`/api/geocode?address=${encodeURIComponent(searchAddress)}`);
      const { lat, lng } = geoRes.data;
      await fetchNearbyGyms(lat, lng);
    } catch (err) {
      setError('Could not find that address. Please try another.');
      setLoading(false);
    }
  };

  const handleManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      setError('Please enter valid latitude and longitude.');
      return;
    }
    setUserLocation([lat, lng]);
    fetchNearbyGyms(lat, lng);
    setUseManualCoords(false);
  };

  // Try to get user location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setError('Geolocation not supported. Please use address search or manual coordinates.');
      return;
    }
    const timeoutId = setTimeout(() => {
      if (!userLocation) {
        setError('Location request timed out. Please use address search or manual coordinates.');
        setLoading(false);
      }
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeoutId);
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        fetchNearbyGyms(latitude, longitude);
      },
      (err) => {
        clearTimeout(timeoutId);
        console.error(err);
        setError('Unable to get your location. Please use address search or manual coordinates.');
        setLoading(false);
      }
    );
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <FiMapPin className="text-green-600" /> Find Gyms Near You
      </h1>

      {/* Search Bar */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1">
            <label className="block text-gray-700 text-sm mb-1">Search by address or city</label>
            <input
              type="text"
              value={searchAddress}
              onChange={(e) => setSearchAddress(e.target.value)}
              placeholder="e.g., New York, NY"
              className="input-field"
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button onClick={handleSearch} className="btn-primary flex items-center gap-2">
            <FiSearch /> Search
          </button>
          <button
            onClick={() => setUseManualCoords(!useManualCoords)}
            className="btn-outline"
          >
            Manual Coords
          </button>
        </div>
        {useManualCoords && (
          <div className="mt-4 flex flex-wrap gap-2 items-center">
            <input
              type="number"
              step="any"
              placeholder="Latitude"
              value={manualLat}
              onChange={(e) => setManualLat(e.target.value)}
              className="input-field w-32"
            />
            <input
              type="number"
              step="any"
              placeholder="Longitude"
              value={manualLng}
              onChange={(e) => setManualLng(e.target.value)}
              className="input-field w-32"
            />
            <button onClick={handleManualLocation} className="btn-primary">Go</button>
          </div>
        )}
      </div>

      {/* Status Messages */}
      <div className="card mb-6">
        <p className="text-gray-600 mb-2">
          Gyms within 10 km of your current location (or searched address).
        </p>
        {loading && (
          <div className="flex items-center gap-2 text-gray-500">
            <FiLoader className="animate-spin" /> Searching for gyms…
          </div>
        )}
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {!loading && !error && gyms.length === 0 && (
          <p className="text-gray-500">No gyms found nearby. Try a different city.</p>
        )}
        {isDemoData && !loading && gyms.length > 0 && (
          <p className="text-yellow-700 text-sm mt-2">⚠️ Showing sample gyms (real data not available).</p>
        )}
      </div>

      {/* Map */}
      <div className="mb-8">
        <GymMap
          userLocation={userLocation}
          gyms={gyms}
          forceCenter={mapCenter || userLocation}
        />
      </div>

      {/* List of gyms */}
      {gyms.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-3">
            {isDemoData ? 'Sample Gyms (Demo)' : 'Nearby Gyms'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gyms.map(gym => (
              <div key={gym.id} className="card p-4">
                <h3 className="font-bold text-gray-800">{gym.name}</h3>
                {gym.address && <p className="text-sm text-gray-600">{gym.address}</p>}
                {gym.phone && <p className="text-sm text-gray-500">📞 {gym.phone}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}