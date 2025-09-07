# 📊 StockCompass: AI-Powered Stock Market Literacy Tool

StockCompass is an AI-enhanced financial literacy platform designed to help users understand the fundamental drivers behind stock price fluctuations. By leveraging Generative AI (GenAI), we analyze news sources, financial data, and historical stock movements to provide deeper insights into volatile market events.

---

## 📌 Key Capabilities

- **AI-Powered News Analysis** – Understand why a stock moved by exploring related news and macroeconomic events.  
- **Event-Based Insights** – Detect when unusual volatility occurs and uncover the underlying causes.  
- **Interactive Stock Charts** – Visually analyze historical trends and key market moments.  
- **Financial Metrics Dashboard** – Gain a clear view of earnings, P/E ratios, market cap, and more.  
- **Stock Search & Exploration** – Look up stocks and track how news impacts their performance.

---

## 🏗️ Project Structure

```bash
/backend/  # AI-powered backend (Django & DRF)
├── chatbot/      # AI assistant for stock insights
├── newsdata/     # News source processing & analysis
├── stockdata/    # Stock price data processing
├── stockcompass/ # Core backend application
├── manage.py     # Django management script
├── requirements.txt # Backend dependencies

/frontend/ # Frontend (Next.js & TypeScript)
├── src/
├── app/         # Main application logic
├── components/  # UI (charts, news panels, etc.)
├── lib/         # API and utility functions
├── public/      # Static assets (logos, icons)
├── package.json # Frontend dependencies
├── tailwind.config.ts # Tailwind CSS configuration
├── next.config.ts     # Next.js configuration

.env.example  # Example environment variables
.gitignore    # Files to ignore in Git
```

---

## 🚀 Getting Started

### 1️⃣ Prerequisites

- **Backend**
  - Python 3.8+
  - Django & Django REST Framework  
    ```bash
    pip install -r backend/requirements.txt
    ```
- **Frontend**
  - Node.js 16+
  - Next.js  
    ```bash
    npm install
    ```

### 2️⃣ Setup Instructions

#### Clone the Repository

```bash
git clone https://github.com/GuanzhenQian2004/StockCompass.git
cd StockCompass
```

#### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate    # On Windows use venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

#### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### 3️⃣ Environment Variables

Copy `.env.example` to `.env` in both backend and frontend, then set the API keys and configuration.

#### Example .env for backend:

```bash
API_OPENAI=your_openai_key
API_PER=your_api_key
```

#### Example .env for frontend:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🧪 How It Works

### 🎯 AI-Powered Stock & News Analysis

1. **Detect Volatility** – The system identifies abnormal stock price fluctuations.  
2. **Analyze Market News** – Using Generative AI, it scans and summarizes news sources to determine what caused the movement.  
3. **Provide Actionable Insights** – Users receive time-aligned explanations with historical stock data, helping them understand why a stock moved.
