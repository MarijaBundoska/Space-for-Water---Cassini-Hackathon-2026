import tkinter as tk
from tkinter import ttk, messagebox
import requests
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import datetime

from weather_logic import get_flood_risk_data 

class FloodForecastApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CASSINI 2026: Space for Water - Macedonia")
        self.root.geometry("1000x850")

        # --- Variables ---
        self.lat = tk.DoubleVar(value=41.99)
        self.lon = tk.DoubleVar(value=21.43)
        self.k_val = tk.DoubleVar(value=0.5)
        self.risk_val = tk.StringVar(value="Risk: --%")
        
        self.setup_gui()

    def setup_gui(self):
        header = tk.Label(self.root, text="Flash Flood & Drought Forecasting Tool", font=("Arial", 18, "bold"))
        header.pack(pady=10)

        input_frame = tk.LabelFrame(self.root, text="Catchment Information (Macedonia)")
        input_frame.pack(fill="x", padx=20, pady=5)

        tk.Label(input_frame, text="Latitude:").grid(row=0, column=0, padx=5)
        tk.Entry(input_frame, textvariable=self.lat).grid(row=0, column=1)

        tk.Label(input_frame, text="Longitude:").grid(row=0, column=2, padx=5)
        tk.Entry(input_frame, textvariable=self.lon).grid(row=0, column=3)

        tk.Label(input_frame, text="K (Routing):").grid(row=0, column=4, padx=5)
        tk.Entry(input_frame, textvariable=self.k_val).grid(row=0, column=5)

        self.risk_frame = tk.Frame(self.root)
        self.risk_frame.pack(pady=10)
        
        self.risk_label = tk.Label(self.risk_frame, textvariable=self.risk_val, font=("Arial", 24, "bold"), fg="gray")
        self.risk_label.pack()

        btn_frame = tk.Frame(self.root)
        btn_frame.pack(pady=10)

        tk.Button(btn_frame, text="Fetch Data & Calculate Risk", command=self.fetch_data, bg="#2196F3", fg="white", font=("Arial", 10, "bold")).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Run Forecast Simulation", command=self.run_simulation, bg="#4CAF50", fg="white", font=("Arial", 10, "bold")).pack(side="left", padx=5)

        self.fig, self.ax = plt.subplots(figsize=(8, 4))
        self.canvas = FigureCanvasTkAgg(self.fig, master=self.root)
        self.canvas.get_tk_widget().pack(fill="both", expand=True, padx=20)

    def fetch_data(self):
        """Now uses weather_logic.py for risk and local code for the graph."""
        lat, lon = self.lat.get(), self.lon.get()
        
        # Get the Risk Analysis from your other file
        results = get_flood_risk_data(lat, lon)
        
        if results:
            # Update Risk Text
            risk_percent = results['risk']
            self.risk_val.set(f"Flood Risk: {risk_percent}%")
            
            # Update Colors
            if risk_percent > 75: self.risk_label.config(fg="red")
            elif risk_percent > 40: self.risk_label.config(fg="orange")
            else: self.risk_label.config(fg="green")
        
        # Hourly Data for the graph (keeping this here for visual speed)
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&hourly=precipitation&timezone=auto"
        try:
            response = requests.get(url).json()
            self.hourly_data = pd.DataFrame({
                'time': pd.to_datetime(response['hourly']['time']),
                'rain': response['hourly']['precipitation']
            })
            self.plot_rain()
            messagebox.showinfo("Success", f"Data updated for {lat}, {lon}!")
        except Exception as e:
            messagebox.showerror("Error", f"Graph data failed: {e}")

    def plot_rain(self):
        self.ax.clear()
        self.ax.bar(self.hourly_data['time'], self.hourly_data['rain'], color='blue', label='Rainfall (mm)')
        self.ax.set_title("Forecasted Rainfall (Next 7 Days)")
        self.ax.legend()
        self.canvas.draw()

    def run_simulation(self):
        if not hasattr(self, 'hourly_data'):
            messagebox.showwarning("Warning", "Please fetch data first!")
            return

        k = self.k_val.get()
        discharge = [0]
        for rain in self.hourly_data['rain']:
            q = (discharge[-1] * (1-k)) + (rain * k * 2) 
            discharge.append(q)
        
        self.hourly_data['discharge'] = discharge[:-1]

        self.ax.clear()
        ax2 = self.ax.twinx()
        self.ax.bar(self.hourly_data['time'], self.hourly_data['rain'], color='blue', alpha=0.3, label='Rainfall')
        ax2.plot(self.hourly_data['time'], self.hourly_data['discharge'], color='red', label='Simulated Flow (m³/s)')
        self.ax.set_ylabel("Rainfall (mm)")
        ax2.set_ylabel("Discharge (m³/s)")
        self.ax.set_title("Flood Forecast Model: Macedonia")
        self.canvas.draw()

if __name__ == "__main__":
    root = tk.Tk()
    app = FloodForecastApp(root)
    root.mainloop()