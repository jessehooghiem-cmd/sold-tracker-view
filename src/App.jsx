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

const FOUR_DAYS = 4 * 24 * 60 * 60 * 1000;

export default function App() {
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    fetchVehicles();

    const interval = setInterval(() => {
      fetchVehicles();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  async function fetchVehicles() {
    const { data, error } = await supabase
      .from("vehicles")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Fetch error:", error);
      return;
    }

    setVehicles(data || []);
  }

  const activeVehicles = vehicles.filter((vehicle) => {
    if (vehicle.status !== "Completed") return true;
    if (!vehicle.completed_date) return true;

    return Date.now() - new Date(vehicle.completed_date).getTime() < FOUR_DAYS;
  });

  const soldsInQueue = activeVehicles.filter(
    (vehicle) => vehicle.status === "Sold"
  ).length;

  const completedVehicles = vehicles.filter(
    (vehicle) => vehicle.completed_date && vehicle.created_at
  );

  const averageSafetyTime =
    completedVehicles.length === 0
      ? 0
      : completedVehicles.reduce((total, vehicle) => {
          const started = new Date(vehicle.created_at).getTime();
          const completed = new Date(vehicle.completed_date).getTime();
          const days = (completed - started) / (1000 * 60 * 60 * 24);
          return total + days;
        }, 0) / completedVehicles.length;

  return (
    <div className="app">
      <header>
        <div className="brand">
          <img src="/goodwills-logo.png" alt="Goodwill's Used Cars" />
          <div className="divider" />
          <h1>Sold Tracker</h1>
        </div>

        <div className="top-actions">
          <span>☁ View Only</span>
          <span>Auto-refresh: 30s</span>
        </div>
      </header>

      <main>
        <aside>
          <h2>View Only</h2>

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
            <div key={column} className="column">
              <h2>
                {column}
                <span>
                  {activeVehicles.filter((v) => v.status === column).length}
                </span>
              </h2>

              {activeVehicles
                .filter((vehicle) => vehicle.status === column)
                .map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="vehicle-card"
                    style={{
                      backgroundColor: salesmanColors[vehicle.salesman],
                    }}
                  >
                    <div className="date-added">{vehicle.date_added}</div>

                    <strong>
                      {vehicle.year} {vehicle.make} {vehicle.model}
                    </strong>

                    <p>Stock: {vehicle.stock}</p>

                    {vehicle.safety_location && (
                      <div className="safety-location">
                        Safety Location: {vehicle.safety_location}
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
    </div>
  );
}