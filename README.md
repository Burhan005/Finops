# ZORVEX — See Beyond Spend.

> **Enterprise Cloud Financial Operations (FinOps) & Cost Intelligence SaaS Platform**  
> *Tactile Claymorphism UX • Dual Light/Dark Mode • FastAPI Telemetry Engine • React Router 6 Architecture*

---

## 💎 Brand Identity & Vision
- **Product Name:** ZORVEX
- **Tagline:** “See Beyond Spend.”
- **Category:** Cloud Financial Operations, Cloud Cost Intelligence, & Automated Optimization.
- **Visual Aesthetic:** Refined enterprise claymorphism with dual-shadow tactile surfaces, subtle inset bevels, custom floating calendar controls, and complete Light Mode & Dark Mode experiences. Zero generic blue/black dashboard styling.

---

## 🚀 Key SaaS Features

### 1. Custom Fancy Dropdowns (Zero Default Browser Selects)
- Custom-built accessible `<ClayDropdown>` replacing all standard native selects across all views.
- Smooth open/close animations with rotating chevrons, search filter for long lists, checkmark states, keyboard arrow-key navigation, Escape to close, and outside-click dismiss.

### 2. Advanced Date-Range Floating Calendar (`ClayDateRangePicker`)
- Interactive floating dual/single month calendar panel.
- Start and end date indicators with a visually continuous highlight range.
- Quick dynamic presets: *Latest Day*, *Last 7D*, *Last 14D*, *Last 30D*, *This Month*, *All Telemetry*.
- Timezone-safe inclusive date bounding.

### 3. Daily Delta Analysis & Cost Spikes
- Current Day vs Previous Day comparison.
- Computes Absolute Delta ($\Delta \$ = \text{Current} - \text{Previous}$) and Percentage Delta ($\Delta \%$).
- Zero-baseline handling (graceful N/A display, prevents division by zero).
- Cost direction attribution (📈 Cost Surge, 📉 Reduced, ⚖️ Flat).
- Trailing 14-day velocity context curve.
- Top spiking resources table with Instance IDs (`i-xxxx`), Name Tags, Service, and delta dollar amounts.

### 4. Monthly Comparison Engine
- Month-over-Month variance (e.g. `2025-09` vs `2025-10`).
- Net budget shift, service-by-service comparison cards, and monthly cost surge contributors.

### 5. Multi-Mode Cost Comparison Segmented Control
- Seamless toggle between:
  - **Daily Delta**
  - **Monthly Comparison**
  - **Custom Range**

### 6. FinOps Waste & Remediation Hub
- Automated heuristic analysis for:
  - 💾 Unattached / Idle EBS Volumes
  - ⚡ Stopped / Abandoned Dev EC2 Instances
  - 🛡️ Non-Production RDS Multi-AZ Downgrade opportunities
  - 🌐 NAT Gateway & Inter-AZ Data Transfer optimization
  - 💰 1-Year Compute Savings Plan commitment opportunities
- Copyable AWS CLI commands for immediate remediation.

### 7. Cloud Resource Explorer
- Full index of monitored AWS resources.
- Real-time search by Resource ID, Tag Name, or Service.
- Minimum cost threshold filtering.

### 8. Full URL Routing & Navigation (`react-router-dom`)
- Public: `/login`, `/register`
- Application: `/app/overview`, `/app/comparison`, `/app/recommendations`, `/app/resources`, `/app/settings`
- 404 Error page: `/not-found`
- Deep link and browser Back/Forward history support.

### 9. First-Class Dual Light / Dark Mode
- Centralized semantic tokens:
  - Light: Soft warm linen canvas (`#F5F2EB`), creamy tactile cards (`#FFFDF9`).
  - Dark: Rich warm obsidian (`#181412`), deep tactile clay cards (`#25201C`).
- Persists across sessions in `localStorage` and respects system preferences.

---

## 🛠️ Quick Start

### 1-Click Launch (Windows)
Double-click `start.bat` in the project root:
- Starts Backend on **`http://localhost:8050`** via Nodemon.
- Starts Frontend on **`http://localhost:5173`** via Vite.
- Launches default browser automatically.

### Manual Terminal Commands

#### Terminal 1: Backend (FastAPI + Nodemon)
```powershell
cd backend
npx nodemon
```
> Running on: `http://localhost:8050` | Swagger: `http://localhost:8050/docs`

#### Terminal 2: Frontend (React + Vite)
```powershell
cd frontend
npm run dev
```
> Running on: `http://localhost:5173`

---

## 🧪 Automated Test Suite
Run backend unit and regression tests:
```powershell
cd backend
python -m unittest discover -s tests -v
```
All tests verify parsing, delta mathematics, zero-baseline safety, and recommendation rules.
