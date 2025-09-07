// Define types for our stock data
interface StockData {
  timestamp: string;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  dividends: number;
  pct_change: number;
  free_cash_flow: number;
  eps: number;
  market_cap: number;
  pe: number;
}

// Define types for our news data (adjust as needed)
interface NewsData {
  explanations: string[];
  references: string[];
  reasons: string[];
  text_summary: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchStockData(
  symbol: string = 'AAPL',
  period: string = '1d',
  interval: string = '60m'
): Promise<StockData[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/stockdata/?stockname=${symbol}&period=${period}&interval=${interval}`
    );
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching stock data:', error);
    throw error;
  }
}

export async function fetchNewsData(
  stockname: string = 'AAPL',
  period: string = 'max',
  interval: string = '1d',
  start?: string,
  end?: string,
  signal?: AbortSignal
): Promise<NewsData> {
  try {
    let url = `${API_URL}/api/news/?stockname=${stockname}&period=${period}&interval=${interval}`;
    if (start) {
      url += `&start="${encodeURIComponent(start)}"`;
    }
    if (end) {
      url += `&end="${encodeURIComponent(end)}"`;
    }
    
    const response = await fetch(url, { signal });
    
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    
    const data = await response.json();
    if (data.complex) {
      try {
        let complexString = data.complex;
        const trimmed = complexString.trim();
        if (trimmed.startsWith("```")) {
          complexString = trimmed.replace(/^```(?:json)?\n/, "");
          complexString = complexString.replace(/\n```$/, "");
        }
        const parsedComplex = JSON.parse(complexString);
        return parsedComplex as NewsData;
      } catch (parseError) {
        console.error('Error parsing complex data:', parseError);
        throw new Error('Invalid news data format');
      }
    }
    throw new Error("Complex news data not found.");
  } catch (error) {
    // Don't log AbortError as it's an expected operation
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error('Error fetching news data:', error);
    }
    throw error; // Re-throw to handle in the component
  }
} 