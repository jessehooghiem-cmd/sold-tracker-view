import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabase";

const columns = ["Sold", "In Progress", "Waiting on Parts", "Completed"];

const salesmanColors = {
  Tom: "#1e73d8",
  Jerry: "#2fa84f",
  Matt: "#ff8a1c",
  Carmon: "#7b45c9",
  Other: "#64748b",
};

const safetyLocations = ["Goodwills", "Firby", "Auto Care", "3D Auto"];

const FOUR_DAYS = 4 * 24 * 60 * 60 * 1000;

export default function App() {
  const [vin, setVin] = useState("");
  const [stock, setStock] = useState("");
  const [salesman, setSalesman] = useState("Tom");
  const [decoded, setDecoded] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  useEffect(() => {
  fetchVehicles();
}, []);

async function fetchVehicles() {
  const { data, error } = await supabase
    .from("vehicles")
    .select("*");

  if (!error) {
    setVehicles(data || []);
  }
}
  const [partsPopup, setPartsPopup] = useState(null);
  const [partsText, setPartsText] = useState("");
  const [safetyPopup, setSafetyPopup] = useState(null);
  const [safetyLocation, setSafetyLocation] = useState("Goodwills");

  const activeVehicles = vehicles.filter((vehicle) => {
    if (vehicle.status !== "Completed") return true;
    if (!vehicle.completedDate) return true;

    return Date.now() - new Date(vehicle.completedDate).getTime() < FOUR_DAYS;
  });

  const soldsInQueue = activeVehicles.filter(
    (vehicle) => vehicle.status === "Sold"
  ).length;

  const completedVehicles = vehicles.filter(
    (vehicle) => vehicle.completedDate && vehicle.createdAt
  );

  const averageSafetyTime =
    completedVehicles.length === 0
      ? 0
      : completedVehicles.reduce((total, vehicle) => {
          const started = new Date(vehicle.createdAt).getTime();
          const completed = new Date(vehicle.completedDate).getTime();
          const days = (completed - started) / (1000 * 60 * 60 * 24);
          return total + days;
        }, 0) / completedVehicles.length;

  async function decodeVin() {
    if (vin.length !== 17) {
      alert("Please enter a valid 17-character VIN.");
      return;
    }

    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/${vin}?format=json`
    );

    const data = await res.json();

    const getValue = (name) =>
      data.Results.find((item) => item.Variable === name)?.Value || "";

    setDecoded({
      vin,
      year: getValue("Model Year"),
      make: getValue("Make"),
      model: getValue("Model"),
      trim: getValue("Trim"),
      engine: getValue("Engine Model") || getValue("Displacement (L)"),
      body: getValue("Body Class"),
      drivetrain: getValue("Drive Type"),
      fuel: getValue("Fuel Type - Primary"),
    });
  }

  async function addVehicle() {
    if (!decoded || !stock) {
      alert("Decode a VIN and enter a stock number first.");
      return;
    }

    const now = new Date();

    const newVehicle = {
      id: crypto.randomUUID(),
      year: decoded.year,
      make: decoded.make,
      model: decoded.model,
      stock,
      salesman,
      status: "Sold",
      parts: "",
      safetyLocation: "",
      dateAdded: now.toLocaleDateString("en-CA"),
      createdAt: now.toISOString(),
      completedDate: null,
    };

    const { error } = await supabase
  .from("vehicles")
  .insert([newVehicle]);

if (!error) {
  fetchVehicles();
}
    setVin("");
    setStock("");
    setDecoded(null);
  }

  function onDragStart(e, vehicleId) {
    e.dataTransfer.setData("vehicleId", vehicleId);
  }

  function onDrop(e, status) {
    const vehicleId = e.dataTransfer.getData("vehicleId");
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    if (status === "In Progress") {
      setSafetyPopup(vehicle);
      setSafetyLocation(vehicle.safetyLocation || "Goodwills");
      return;
    }

    if (status === "Waiting on Parts") {
      setPartsPopup(vehicle);
      setPartsText("");
      return;
    }

    setVehicles(
      vehicles.map((v) =>
        v.id === vehicleId
          ? {
              ...v,
              status,
              completedDate:
                status === "Completed" ? new Date().toISOString() : null,
            }
          : v
      )
    );
  }

  function saveSafetyLocation() {
    setVehicles(
      vehicles.map((v) =>
        v.id === safetyPopup.id
          ? {
              ...v,
              status: "In Progress",
              safetyLocation,
              completedDate: null,
            }
          : v
      )
    );

    setSafetyPopup(null);
    setSafetyLocation("Goodwills");
  }

  function saveParts() {
    setVehicles(
      vehicles.map((v) =>
        v.id === partsPopup.id
          ? {
              ...v,
              status: "Waiting on Parts",
              parts: partsText,
              completedDate: null,
            }
          : v
      )
    );

    setPartsPopup(null);
    setPartsText("");
  }

  return (
    <div className="app">
      <header>
        <div className="brand">
          <img src="/goodwills-logo.png" alt="Goodwill's Used Cars" />
          <div className="divider" />
          <h1>Sold Tracker</h1>
        </div>

        <div className="top-actions">
          <span>☁ Synced</span>
          <span>Filter</span>
          <span>⚙</span>
        </div>
      </header>

      <main>
        <aside>
          <h2>Add Vehicle</h2>

          <label>VIN</label>
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value.toUpperCase())}
            maxLength={17}
            placeholder="Enter VIN"
          />

          <button onClick={decodeVin}>Decode VIN</button>

          {decoded && (
            <div className="decoded-box">
              <p><b>Year:</b> {decoded.year}</p>
              <p><b>Make:</b> {decoded.make}</p>
              <p><b>Model:</b> {decoded.model}</p>
              <p><b>Trim:</b> {decoded.trim}</p>
              <p><b>Engine:</b> {decoded.engine}</p>
              <p><b>Body:</b> {decoded.body}</p>
              <p><b>Drive:</b> {decoded.drivetrain}</p>
              <p><b>Fuel:</b> {decoded.fuel}</p>
            </div>
          )}

          <label>Stock Number</label>
          <input
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            placeholder="1001"
          />

          <label>Salesman</label>
          <select value={salesman} onChange={(e) => setSalesman(e.target.value)}>
            <option>Tom</option>
            <option>Jerry</option>
            <option>Matt</option>
            <option>Carmon</option>
            <option>Other</option>
          </select>

          <button onClick={addVehicle}>Add Vehicle</button>

          <div className="legend">
            <h3>Salesman Colors</h3>

            {Object.entries(salesmanColors).map(([name, color]) => (
              <div key={name}>
                <span style={{ backgroundColor: color }}></span>
                {name}
              </div>
            ))}
          </div>

          <div className="stats-box">
            <div className="stat-card">
              <h3>Solds in Queue</h3>
              <p>{soldsInQueue}</p>
            </div>

            <div className="stat-card">
              <h3>Average Safety Time</h3>
              <p>{averageSafetyTime.toFixed(1)} days</p>
            </div>
          </div>
        </aside>

        <section className="board">
          {columns.map((column) => (
            <div
              key={column}
              className="column"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, column)}
            >
              <h2>
                {column}
                <span>{activeVehicles.filter((v) => v.status === column).length}</span>
              </h2>

              {activeVehicles
                .filter((vehicle) => vehicle.status === column)
                .map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="vehicle-card"
                    draggable
                    onDragStart={(e) => onDragStart(e, vehicle.id)}
                    style={{ backgroundColor: salesmanColors[vehicle.salesman] }}
                  >
                    <div className="date-added">{vehicle.dateAdded}</div>

                    <strong>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </strong>

                    <p>Stock: {vehicle.stock}</p>

                    {vehicle.safetyLocation && (
                      <div className="safety-location">
                        Safety Location: {vehicle.safetyLocation}
                      </div>
                    )}

                    {vehicle.parts && (
                      <div className="parts-list">
                        <b>Waiting On:</b>
                        <br />
                        {vehicle.parts}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ))}
        </section>
      </main>

      {safetyPopup && (
        <div className="modal-bg">
          <div className="modal">
            <h2>Safety Location</h2>
            <p>Select where this vehicle is going for safety:</p>

            <select
              value={safetyLocation}
              onChange={(e) => setSafetyLocation(e.target.value)}
            >
              {safetyLocations.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>

            <div className="modal-buttons">
              <button onClick={() => setSafetyPopup(null)}>Cancel</button>
              <button onClick={saveSafetyLocation}>Save</button>
            </div>
          </div>
        </div>
      )}

      {partsPopup && (
        <div className="modal-bg">
          <div className="modal">
            <h2>Waiting on Parts</h2>
            <p>Enter the parts being waited on:</p>

            <textarea
              value={partsText}
              onChange={(e) => setPartsText(e.target.value)}
              placeholder="Front bumper cover&#10;Headlight assembly&#10;Grille"
            />

            <div className="modal-buttons">
              <button onClick={() => setPartsPopup(null)}>Cancel</button>
              <button onClick={saveParts}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}