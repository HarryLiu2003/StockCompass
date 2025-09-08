"use client"

import * as React from "react"
import { useState, useEffect, useMemo } from "react"
import { Search, CircleUser, ArrowUpCircle, ArrowDownCircle, Radar, X, Loader2, Check, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Slider } from "@/components/ui/slider"
import Image from 'next/image'
import { LineChart, Line, ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceArea } from "recharts"
import { fetchNewsData } from "@/lib/api"
import { createPortal } from "react-dom"

interface NewsData {
  explanations: string[];
  references: string[];
  reasons: string[];
  text_summary: string;
}

interface StockMetadata {
  yearly_pct_change: number;
  longName: string;
  shortName?: string;
  sector?: string;
  industry?: string;
  marketCap?: number;
  currency: string;
  exchangeName: string;
  lastClose: string | Date;
  montly_pct_change: number;
}

interface ChartDataPoint {
  time: string;
  close_price: number;
  volume: number;
  earnings?: number;
  // Add other properties as needed
}

// 1. Create an interface for news items
interface NewsItem {
  title: string;
  description: string;
  url: string;
  date: string;
  // Add other properties as needed
}

function InvestigatePopup({ x, y }: { x: number; y: number; }) {
  return createPortal(
    <div style={{
      position: 'absolute',
      left: x,
      top: y,
      transform: 'translate(-50%, -150%)',
      background: 'hsl(var(--background))',
      border: '1px solid hsl(var(--border))',
      borderRadius: '5px',
      padding: '6px 12px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      zIndex: 1000
    }}>
      <span className="text-sm font-medium text-foreground">Investigate</span>
    </div>,
    document.body
  );
}

export default function Dashboard() {
  // Update the formatDate function to handle UTC dates correctly and add null check
  const formatDate = (date: Date | string | null) => {
    if (!date) return "";
    
    try {
      // Create date object and force UTC handling
      const d = new Date(typeof date === 'string' ? date + 'T00:00:00Z' : date);
      
      // Check if date is valid before formatting
      if (isNaN(d.getTime())) {
        return "";
      }
      
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC'  // Force UTC timezone for display
      });
    } catch (error) {
      console.error('Error formatting date:', error);
      return "";
    }
  };

  // Default to 1Y so we fetch 1-year data on preload
  const [selectedInterval, setSelectedInterval] = useState<string | null>("1Y");
  const [hoveredInterval, setHoveredInterval] = useState<string | null>(null);
  const [stockMetadata, setStockMetadata] = useState<StockMetadata | null>(null);
  const [ticker, setTicker] = useState<string>("NVDA");
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isFetchingMaxData, setIsFetchingMaxData] = useState<boolean>(true);
  const [intervalEndDate, setIntervalEndDate] = useState<Date | null>(null);
  const [intervalStartDate, setIntervalStartDate] = useState<Date | null>(null);
  const [intervalError, setIntervalError] = useState<string>("");
  const [sliderValue, setSliderValue] = useState<number>(100);
  const [eventRanges, setEventRanges] = useState<Array<{ start: string; end: string; type: 'auto' | 'user' }>>([]);
  const [showEventHighlights, setShowEventHighlights] = useState<boolean>(false);
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ x: number, y: number } | null>(null);
  
  // User-defined period selection state
  const [dragStartX, setDragStartX] = useState<string | null>(null);
  const [dragCurrentX, setDragCurrentX] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Transform the ranges to include IDs
  const eventHighlights = React.useMemo(() => 
    eventRanges.map((range, index) => ({
      id: `event${index + 1}`,
      ...range
    })), [eventRanges]
  );

  // Compute if controls (ToggleGroup and Slider) should be disabled until max data is loaded and interval dates are set.
  const controlsDisabled = isFetchingMaxData || !intervalStartDate || !intervalEndDate;

  // NEW: This function fetches data for any ticker: first 1Y, then max, merges, sets state
  async function fetchTickerData(tickerSymbol: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      // 1) Fetch 1Y data
      const response1y = await fetch(`${apiUrl}/api/stockdata/?stockname=${tickerSymbol}&period=1y&interval=1d`);
      const data1y = await response1y.json();
      if (data1y.status_code === 200 && data1y.time_series) {
        setChartData(data1y.time_series);
      }
      // 2) Fetch max data
      const responseMax = await fetch(`${apiUrl}/api/stockdata/?stockname=${tickerSymbol}&period=max&interval=1d`);
      const dataMax = await responseMax.json();
      if (dataMax.status_code === 200 && dataMax.time_series) {
        const combined = [...(data1y.time_series || []), ...dataMax.time_series];
        const dedupedData = combined.reduce<ChartDataPoint[]>((acc, cur) => {
          if (!acc.some((item) => item.time === cur.time)) {
            acc.push(cur);
          }
          return acc;
        }, []);
        dedupedData.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
        setChartData(dedupedData);
        // Now that max data is done, enable the function bar
        setIsFetchingMaxData(false);
      }
    } catch (error) {
      console.error(`Failed to fetch data for ${tickerSymbol}:`, error);
      // In case of error, still set isFetchingMaxData to false
      setIsFetchingMaxData(false);
    }
  }

  // Keep metadata fetch the same, but call it inside a function for clarity
  async function fetchMetadata(tickerSymbol: string) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://stockcompass-production.up.railway.app";
    try {
      const res = await fetch(`${apiUrl}/api/stock_metadata/?stockname=${tickerSymbol}`);
      const data = await res.json();
      if (data.status_code === 200 && data.metadata) {
        setStockMetadata(data.metadata);
      }
    } catch (err) {
      console.error("Failed to fetch stock metadata", err);
    }
  }

  // Unify data fetching in one effect, triggered by `ticker` changes.
  useEffect(() => {
    // Reset toggle group back to "1Y" and slider to the right (100)
    setSelectedInterval("1Y");
    setSliderValue(100);
    // Reset fetching state to true and clear interval dates
    setIsFetchingMaxData(true);
    setIntervalStartDate(null);
    setIntervalEndDate(null);

    // Clear event ranges and close the news panel when ticker changes
    setEventRanges([]);
    setNewsPanelActive(false);

    fetchTickerData(ticker);
    fetchMetadata(ticker);
  }, [ticker]);

  // Recalculate the sliding window (intervalStartDate & intervalEndDate) based on the slider value,
  // selected interval (i.e. window length) and entire available (max period) chartData.
  useEffect(() => {
    if (chartData.length > 0) {
      const firstAvailable = new Date(chartData[0].time);
      const lastAvailable = new Date(chartData[chartData.length - 1].time);

      let windowDays = 0;
      if (selectedInterval === "1Y") {
        windowDays = 365;
      } else if (selectedInterval === "3Y") {
        windowDays = 365 * 3;
      } else if (selectedInterval === "6M") {
        windowDays = 182;
      }
      const windowMs = windowDays * 86400000; // milliseconds in a day

      // The minimum possible end date equals firstAvailable + window (i.e. leftmost slider)
      const minEndTime = firstAvailable.getTime() + windowMs;
      // The maximum possible end date equals the last available date in the merged dataset.
      const maxEndTime = lastAvailable.getTime();

      if (maxEndTime < minEndTime) {
        setIntervalError("Not enough data to display the selected time range.");
        return;
      } else {
        setIntervalError("");
      }

      // Map the slider value (0 to 100) to a currentEndTime in milliseconds.
      const currentEndTimeMs = minEndTime + ((sliderValue / 100) * (maxEndTime - minEndTime));
      const currentEndDate = new Date(currentEndTimeMs);
      const currentStartDate = new Date(currentEndTimeMs - windowMs);

      setIntervalEndDate(currentEndDate);
      setIntervalStartDate(currentStartDate);
    }
  }, [sliderValue, selectedInterval, chartData]);

  const intervals = [
    { id: "fe-mar", label: "Fe-Mar", x1: "Feb", x2: "Mar" },
    { id: "apr-jun", label: "April - June", x1: "Apr", x2: "Jun" }
  ];

  // Add a memoized filtered data set for the chart display
  const displayChartData = React.useMemo(() => {
    // Ensure display only shows data between intervalStartDate and intervalEndDate.
    if (!intervalStartDate || !intervalEndDate) return chartData;
    return chartData.filter(item => {
      const t = new Date(item.time);
      return t >= intervalStartDate && t <= intervalEndDate;
    });
  }, [chartData, intervalStartDate, intervalEndDate]);

  // Add this function to handle button click (similar to Enter key press)
  const handleSearch = (searchValue: string) => {
    const upperSearchValue = searchValue.toUpperCase();
    if (upperSearchValue) {
      setTicker(upperSearchValue);
      // Clear event ranges and close the news panel
      setEventRanges([]);
      setNewsPanelActive(false);
    }
  };

  // Add this helper function near your other utility functions
  const calculatePriceTrend = (data: ChartDataPoint[], startDate: string, endDate: string): "up" | "down" | "neutral" => {
    const periodData = data.filter(
      point => point.time >= startDate && point.time <= endDate
    );

    if (periodData.length < 2) return "neutral";

    const startPrice = periodData[0].close_price;
    const endPrice = periodData[periodData.length - 1].close_price;
    
    return endPrice > startPrice ? "up" : "down";
  };

  // Add this function to fetch unusual ranges
  const fetchUnusualRanges = useMemo(() => async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

      // Clear all selection states when fetching new ranges
      setEventRanges([]);
      setHoveredEvent(null);
      setSelectedEventId(null);
      // Don't clear news panel here - we want to keep showing previous news until new selection

      // Format data with proper date handling
      const requestBody = {
        data: {
          time: displayChartData.map(item => 
            // Keep dates in YYYY-MM-DD format without timezone conversion
            item.time.split('T')[0]
          ),
          price: displayChartData.map(item => Number(item.close_price)),
          volume: displayChartData.map(item => Number(item.volume))
        }
      };

      console.log("Fetching unusual ranges with:", requestBody);

      const response = await fetch(`${apiUrl}/api/unusual_range/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Error: ${response.status} => ${text}`);
      }

      const result = await response.json();
      console.log("Unusual ranges response:", result);

      // Convert each [start, end] to { start, end, type } and store in state
      if (Array.isArray(result.unusual_ranges)) {
        const newRanges = result.unusual_ranges.map(
          (range: [string, string]) => ({
            start: range[0],
            end: range[1],
            type: 'auto' as const
          })
        );
        setEventRanges(newRanges);
      }

      // Always show the highlights after fetching
      setShowEventHighlights(true);

    } catch (error) {
      console.error("Failed to fetch unusual ranges:", error);
      // Optionally reset or handle error UI
      setEventRanges([]);
      setShowEventHighlights(false);
    }
  }, [displayChartData]);

  // 1) Add extra state:
  const [shouldAnalyzeEvents, setShouldAnalyzeEvents] = useState(false);

  // 2) Modify the button click:
  const handleEventAnalyzerClick = () => {
    setHoveredEvent(null);

    // Always set the flag, so if the user's data isn't ready yet,
    // we'll fetch as soon as it becomes ready:
    setShouldAnalyzeEvents(true);
  };

  // 3) useEffect that triggers once chart data arrives or user toggles:
  useEffect(() => {
    // If the user wants to see events AND our chart data is loaded, go fetch:
    if (shouldAnalyzeEvents && displayChartData.length > 0) {
      fetchUnusualRanges();
      setShouldAnalyzeEvents(false);
    }
  }, [shouldAnalyzeEvents, displayChartData, fetchUnusualRanges]);

  // Around line ~76, you have a "controlsDisabled" boolean.
  // You can reuse that or create a new "eventAnalyzerDisabled" condition:
  const eventAnalyzerDisabled = displayChartData.length === 0 || isFetchingMaxData;

  const [newsPanelActive, setNewsPanelActive] = useState<boolean>(false);
  const [_newsPanelDateRange, _setNewsPanelDateRange] = useState<string>("");

  // Add news-related state variables:
  const [newsDetails, setNewsDetails] = useState<NewsData | null>(null);
  const [isNewsLoading, setIsNewsLoading] = useState<boolean>(false);
  
  // AI reasoning steps state
  const [reasoningSteps, setReasoningSteps] = useState<Array<{
    id: string;
    text: string;
    status: 'pending' | 'running' | 'completed' | 'error';
  }>>([]);

  // Add this to your state declarations
  const [clickedEvent, setClickedEvent] = useState<{start: string, end: string} | null>(null);

  // Add this to your state declarations at the top of the component
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Add this near your other state declarations
  const [activeRequest, setActiveRequest] = useState<AbortController | null>(null);

  // Click-and-drag handlers for user-defined periods
  const handleChartMouseDown = (e: { activeLabel?: string }) => {
    if (!e || !e.activeLabel) return;
    
    setIsDragging(true);
    setDragStartX(e.activeLabel);
    setDragCurrentX(e.activeLabel);
  };

  const handleChartMouseMove = (e: { activeLabel?: string }) => {
    if (isDragging && e && e.activeLabel) {
      setDragCurrentX(e.activeLabel);
    }
  };

  const handleChartMouseUp = (e: { activeLabel?: string }) => {
    if (isDragging && dragStartX && e && e.activeLabel) {
      const endX = e.activeLabel;
      
      // Ensure start is before end
      const start = dragStartX <= endX ? dragStartX : endX;
      const end = dragStartX <= endX ? endX : dragStartX;
      
      // Only create period if there's a meaningful range (different dates)
      if (start !== end) {
        const newUserPeriod = {
          start,
          end,
          type: 'user' as const
        };
        
        // Add user-defined period to existing ranges
        setEventRanges(prev => [...prev, newUserPeriod]);
        setShowEventHighlights(true);
      }
    }
    
    // Reset drag state
    setIsDragging(false);
    setDragStartX(null);
    setDragCurrentX(null);
  };

  // Helper function to get current drag selection for display
  const getCurrentDragSelection = () => {
    if (!isDragging || !dragStartX || !dragCurrentX) return null;
    
    const start = dragStartX <= dragCurrentX ? dragStartX : dragCurrentX;
    const end = dragStartX <= dragCurrentX ? dragCurrentX : dragStartX;
    
    return { start, end };
  };

  // Initialize reasoning steps based on actual AI pipeline
  const initializeReasoningSteps = () => {
    const steps = [
      { id: 'serpapi_search', text: 'Searching Google News with SerpAPI for financial articles', status: 'pending' as const },
      { id: 'date_filtering', text: `Filtering articles from ${clickedEvent?.start} to ${clickedEvent?.end}`, status: 'pending' as const },
      { id: 'content_extraction', text: 'Extracting article titles, snippets, and source links', status: 'pending' as const },
      { id: 'financial_filtering', text: 'Identifying financially relevant news events', status: 'pending' as const },
      { id: 'claude_analysis', text: 'Analyzing market impact with Claude Sonnet 4', status: 'pending' as const },
      { id: 'correlation_analysis', text: 'Correlating news events with stock price movements', status: 'pending' as const },
      { id: 'explanation_synthesis', text: 'Generating comprehensive explanations and insights', status: 'pending' as const },
      { id: 'reference_validation', text: 'Validating and organizing source references', status: 'pending' as const }
    ];
    setReasoningSteps(steps);
    return steps;
  };

  // Update reasoning step status
  const updateReasoningStep = (stepId: string, status: 'running' | 'completed' | 'error') => {
    setReasoningSteps(prev => 
      prev.map(step => 
        step.id === stepId ? { ...step, status } : step
      )
    );
  };

  // Enhanced AI reasoning progress with realistic backend timing
  const simulateReasoningProgress = async () => {
    const steps = initializeReasoningSteps();
    
    // Step 1-4: SerpAPI Processing (fast, parallel-ish)
    updateReasoningStep('serpapi_search', 'running');
    await new Promise(resolve => setTimeout(resolve, 2000));
    updateReasoningStep('serpapi_search', 'completed');
    
    updateReasoningStep('date_filtering', 'running');
    await new Promise(resolve => setTimeout(resolve, 600));
    updateReasoningStep('date_filtering', 'completed');
    
    updateReasoningStep('content_extraction', 'running');
    await new Promise(resolve => setTimeout(resolve, 1000));
    updateReasoningStep('content_extraction', 'completed');
    
    updateReasoningStep('financial_filtering', 'running');
    await new Promise(resolve => setTimeout(resolve, 800));
    updateReasoningStep('financial_filtering', 'completed');
    
    // Step 5-8: Claude Analysis (longer, sequential)
    updateReasoningStep('claude_analysis', 'running');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Claude's main processing
    updateReasoningStep('claude_analysis', 'completed');
    
    updateReasoningStep('correlation_analysis', 'running');
    await new Promise(resolve => setTimeout(resolve, 1800));
    updateReasoningStep('correlation_analysis', 'completed');
    
    updateReasoningStep('explanation_synthesis', 'running');
    await new Promise(resolve => setTimeout(resolve, 1500));
    updateReasoningStep('explanation_synthesis', 'completed');
    
    updateReasoningStep('reference_validation', 'running');
    await new Promise(resolve => setTimeout(resolve, 800));
    updateReasoningStep('reference_validation', 'completed');
  };

  // Update the handleEventClick function
  const handleEventClick = (eventId: string) => {
    if (selectedEventId === eventId) {
        return;
    }

    // Cancel any ongoing request first
    if (activeRequest) {
        activeRequest.abort();
        setActiveRequest(null);
    }

    const clickedEvent = eventHighlights.find(event => event.id === eventId);
    if (!clickedEvent) return;

    // Clear previous data and setup new analysis
    setNewsDetails(null);
    setClickedEvent(clickedEvent);
    setSelectedEventId(eventId);
    setNewsPanelActive(true);
    setIsNewsLoading(true);
    setPopupPosition(null);
    setHoveredEvent(null);

    // Start reasoning steps display
    simulateReasoningProgress();

    // Create new AbortController for this request
    const controller = new AbortController();
    setActiveRequest(controller);

    // Fetch news data for the selected event
    fetchNewsData(
        ticker, 
        "max", 
        "1d", 
        clickedEvent.start, 
        clickedEvent.end,
        controller.signal
    )
        .then(fetchedNews => {
            setNewsDetails(fetchedNews);
            setIsNewsLoading(false);
            // Clear reasoning steps when analysis is complete
            setReasoningSteps([]);
        })
        .catch(err => {
            if (err.name !== 'AbortError') {
                console.error("Failed to fetch news data:", err);
                setNewsDetails(null);
                setIsNewsLoading(false);
                // Mark current step as error
                setReasoningSteps(prev => 
                  prev.map(step => 
                    step.status === 'running' ? { ...step, status: 'error' as const } : step
                  )
                );
            }
        })
        .finally(() => {
            setActiveRequest(prev => 
                prev?.signal === controller.signal ? null : prev
            );
        });
  };

  // 2. Update the state definition with proper typing and prefix
  const [_mappedNewsItems, _setMappedNewsItems] = useState<NewsItem[]>([]);

  // Add cleanup effect
  useEffect(() => {
    if (activeRequest) {
      return () => {
        activeRequest.abort();
      };
    }
  }, [activeRequest]);

  return (
    <div className="min-h-screen bg-background flex flex-col h-screen">
      <header className="border-b flex-none">
        <div className="flex h-16 items-center justify-between px-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="text-primary h-6 w-6">
                <Image
                  src="/logo.svg"
                  alt="StockCompass Logo"
                  width={24}
                  height={24}
                  className="text-primary"
                />
              </div>
              <span className="text-xl font-bold text-primary font-kumbh">
                StockCompass
              </span>
            </div>
            <div className="flex items-center gap-3 justify-center w-full max-w-xl mx-auto">
              <Input
                type="text"
                placeholder="Search stocks..."
                className="w-[400px]" // Increased width from 250px to 400px
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch((e.target as HTMLInputElement).value);
                  }
                }}
              />
              <Button 
                type="submit" 
                size="icon"
                onClick={() => {
                  // Get the input value from the Input component
                  const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
                  handleSearch(inputEl.value);
                }}
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <Button size="icon" variant="secondary" className="rounded-full">
            <CircleUser className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 flex p-8 gap-4 h-[calc(100vh-4rem)] overflow-hidden">
        {selectedInterval ? (
          <div className="flex flex-1 gap-5 h-full">
            <div className={`transition-all duration-200 ${newsPanelActive ? 'flex-1' : 'w-full'}`}>
              <Card className="flex flex-col h-full">
                <div className="px-7 py-6 flex justify-between items-start border-b">
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-semibold text-card-foreground">
                      {stockMetadata ? stockMetadata.longName : "Loading..."}
                    </h2>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stockMetadata
                        ? `${stockMetadata.exchangeName} · ${stockMetadata.currency} · Last Closed: ${formatDate(stockMetadata.lastClose)}`
                        : "Last Closed: Loading..."
                      }
                    </p>
                  </div>
                  <div className="flex gap-4">
                    {stockMetadata && (
                      <>
                        <div className={`${stockMetadata.montly_pct_change >= 0 ? "bg-green-100" : "bg-red-100"} px-6 py-4 rounded flex items-center gap-2`}>
                          {stockMetadata.montly_pct_change >= 0 ? (
                            <ArrowUpCircle className="h-4 w-4" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">
                            {`${stockMetadata.montly_pct_change >= 0 ? '+' : ''}${(stockMetadata.montly_pct_change * 100).toFixed(1)}% MoM`}
                          </span>
                        </div>
                        <div className={`${stockMetadata.yearly_pct_change >= 0 ? "bg-green-100" : "bg-red-100"} px-6 py-4 rounded flex items-center gap-2`}>
                          {stockMetadata.yearly_pct_change >= 0 ? (
                            <ArrowUpCircle className="h-4 w-4" />
                          ) : (
                            <ArrowDownCircle className="h-4 w-4" />
                          )}
                          <span className="text-sm font-medium">
                            {`${stockMetadata.yearly_pct_change >= 0 ? '+' : ''}${(stockMetadata.yearly_pct_change * 100).toFixed(1)}% YoY`}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0 border-b">
                  <div className="p-6 flex flex-col flex-1 min-h-0 h-full">
                    <div className="flex-1 min-h-0">
                      <div className="w-full h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={displayChartData}
                            margin={{
                              top: 10,
                              right: 10,
                              left: 10,
                              bottom: 10,
                            }}
                            onMouseDown={handleChartMouseDown}
                            onMouseMove={handleChartMouseMove}
                            onMouseUp={handleChartMouseUp}
                            style={{ 
                              userSelect: isDragging ? 'none' : 'auto',
                              WebkitUserSelect: isDragging ? 'none' : 'auto',
                              MozUserSelect: isDragging ? 'none' : 'auto'
                            } as React.CSSProperties}
                          >
                            <defs>
                              <pattern
                                id="diagonalPatternRed"
                                patternUnits="userSpaceOnUse"
                                width="8"
                                height="8"
                              >
                                <rect width="8" height="8" fill="#ef4444" opacity="0.2" />
                                <path
                                  d="M-2,2 l4,-4
                                     M0,8 l8,-8
                                     M6,10 l4,-4"
                                  style={{
                                    stroke: "#ef4444",
                                    strokeWidth: 1.5,
                                    opacity: 0.9
                                  }}
                                />
                              </pattern>
                              <pattern
                                id="diagonalPatternGreen"
                                patternUnits="userSpaceOnUse"
                                width="8"
                                height="8"
                              >
                                <rect width="8" height="8" fill="#22c55e" opacity="0.2" />
                                <path
                                  d="M-2,2 l4,-4
                                     M0,8 l8,-8
                                     M6,10 l4,-4"
                                  style={{
                                    stroke: "#22c55e",
                                    strokeWidth: 1.5,
                                    opacity: 0.9
                                  }}
                                />
                              </pattern>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                            
                            {/* User drag selection visualization */}
                            {isDragging && getCurrentDragSelection() && (
                              <ReferenceArea
                                x1={getCurrentDragSelection()!.start}
                                x2={getCurrentDragSelection()!.end}
                                fill="#9ca3af"
                                fillOpacity={0.3}
                                stroke="#6b7280"
                                strokeWidth={1}
                                strokeDasharray="3,2"
                              />
                            )}
                            
                            {showEventHighlights && eventHighlights.map((event) => {
                              const isSelected = event.id === selectedEventId;
                              const isHovered = event.id === hoveredEvent;
                              
                              return (
                                <ReferenceArea
                                  key={event.id}
                                  x1={event.start}
                                  x2={event.end}
                                  fill={isSelected ? 
                                    `url(#${calculatePriceTrend(displayChartData, event.start, event.end) === "up" ? "diagonalPatternGreen" : "diagonalPatternRed"})` : 
                                    (calculatePriceTrend(displayChartData, event.start, event.end) === "up" ? "#22c55e66" : "#ef444466")
                                  }
                                  fillOpacity={isSelected ? 1 : (isHovered ? 0.6 : 0.4)}
                                  onClick={() => { if (!isSelected) handleEventClick(event.id); }}
                                  onMouseEnter={(e) => { if (!isSelected) { setHoveredEvent(event.id); setPopupPosition({ x: e.pageX, y: e.pageY }); }}}
                                  onMouseMove={(e) => { if (!isSelected) setPopupPosition({ x: e.pageX, y: e.pageY }); }}
                                  onMouseLeave={() => { if (!isSelected) { setHoveredEvent(null); setPopupPosition(null); }}}
                                  style={{ cursor: isSelected ? 'default' : 'pointer' }}
                                />
                              );
                            })}
                            {intervals.map((interval) => {
                              return (() => {
                                // Determine the starting and ending values for the interval.
                                const startDatum = displayChartData.find(d => d.time === interval.x1);
                                const endDatum = displayChartData.find(d => d.time === interval.x2);
                                const trendColor = (startDatum && endDatum)
                                  ? (endDatum.close_price - startDatum.close_price >= 0 ? "green" : "red")
                                  : "gray";

                                const isSelected = selectedInterval === interval.id;
                                const isHovered = hoveredInterval === interval.id;
                                let fillColor: string;
                                if (isSelected) {
                                  fillColor = trendColor === "green"
                                    ? "url(#diagonalPatternGreen)"
                                    : "url(#diagonalPatternRed)";
                                } else if (isHovered) {
                                  fillColor = trendColor === "green" ? "#22c55e" : "#ef4444";  // Tailwind 500 variants
                                } else {
                                  fillColor = trendColor === "green" ? "#22c55e66" : "#ef444466";  // 0.4 opacity
                                }

                                return (
                                  <ReferenceArea
                                    key={`${interval.x1}-${interval.x2}`}
                                    x1={interval.x1}
                                    x2={interval.x2}
                                    fill={fillColor}
                                    fillOpacity={isSelected ? 1 : 0.5}
                                    onClick={() => {
                                      if (selectedInterval === interval.id) {
                                        setSelectedInterval(null);
                                      } else {
                                        setSelectedInterval(interval.id);
                                      }
                                    }}
                                    onMouseEnter={(e) => { setHoveredInterval(interval.id); setPopupPosition({ x: e.pageX, y: e.pageY }); }}
                                    onMouseMove={(e) => { setPopupPosition({ x: e.pageX, y: e.pageY }); }}
                                    onMouseLeave={() => { setHoveredInterval(null); setPopupPosition(null); }}
                                    className="cursor-pointer transition-colors duration-200 hover:opacity-90"
                                    role="button"
                                    aria-label={`Toggle highlight region ${interval.label}`}
                                  />
                                );
                              })();
                            })}
                            <XAxis
                              dataKey="time"
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickMargin={8}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "var(--radius)",
                              }}
                              labelStyle={{
                                color: "hsl(var(--muted-foreground))",
                                fontSize: "14px",
                                marginBottom: "4px",
                              }}
                              itemStyle={{
                                color: "hsl(var(--foreground))",
                                fontSize: "14px",
                              }}
                              formatter={(value) => [`$${value}`, "Price"]}
                            />
                            <Line
                              type="monotone"
                              dataKey="close_price"
                              stroke="hsl(var(--primary))"
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={true}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-24">
                          <div className="flex-shrink-0">
                            <ToggleGroup
                              type="single"
                              value={selectedInterval ?? ""}
                              disabled={controlsDisabled}
                              className={controlsDisabled ? "opacity-50 cursor-not-allowed" : ""}
                              onValueChange={(value) => { 
                                // Update the selected interval without resetting the sliderValue.
                                setSelectedInterval(value);
                              }}
                            >
                              <ToggleGroupItem disabled={controlsDisabled} value="3Y" aria-label="3 Years">3Y</ToggleGroupItem>
                              <ToggleGroupItem disabled={controlsDisabled} value="1Y" aria-label="1 Year">1Y</ToggleGroupItem>
                              <ToggleGroupItem disabled={controlsDisabled} value="6M" aria-label="6 Months">6M</ToggleGroupItem>
                            </ToggleGroup>
                          </div>

                          <div className="w-[500px] space-y-3.5">
                            <Slider
                              disabled={controlsDisabled}
                              className={controlsDisabled ? "opacity-50 cursor-not-allowed" : ""}
                              value={[sliderValue]}
                              onValueChange={(value: number[]) => { 
                                setSliderValue(value[0]); 
                              }}
                            />
                            <div className={`flex justify-between items-center ${controlsDisabled ? "opacity-50" : ""}`}>
                              <span className="text-sm font-medium">
                                Date Range
                              </span>
                              <span className="text-sm font-medium text-muted-foreground">
                                {intervalStartDate && intervalEndDate 
                                  ? `${formatDate(intervalStartDate)} to ${formatDate(intervalEndDate)}`
                                  : "Loading..."}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button onClick={handleEventAnalyzerClick} disabled={eventAnalyzerDisabled}>
                          Event Analyzer
                          <Radar className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-7 py-6 flex justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-muted-foreground">Prev Close</span>
                      {(() => {
                        const lastItem = displayChartData[displayChartData.length - 1];
                        const prevItem = displayChartData[displayChartData.length - 2];
                        
                        if (!lastItem?.close_price || !prevItem?.close_price) {
                          return <span className="text-sm font-medium text-muted-foreground">N/A</span>;
                        }
                        
                        const pctChange = ((lastItem.close_price - prevItem.close_price) / prevItem.close_price) * 100;
                        const sign = pctChange > 0 ? "+" : "";
                        const colorClass = pctChange > 0 ? "text-green-600" : "text-red-600";
                        return (
                          <span className={`text-sm font-medium ${colorClass}`}>
                            {sign}{pctChange.toFixed(2)}%
                          </span>
                        );
                      })()}
                    </div>
                    {(() => {
                      const lastItem = displayChartData[displayChartData.length - 1];
                      const price = lastItem?.close_price != null
                        ? `$${lastItem.close_price.toFixed(2)}`
                        : <span className="text-3xl font-semibold text-muted-foreground">N/A</span>;
                      return <div className="text-3xl font-semibold">{price}</div>;
                    })()}
                  </div>
                  <Separator orientation="vertical" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Market Cap</div>
                    {(() => {
                      const lastItem = displayChartData[displayChartData.length - 1];
                      if (!lastItem?.close_price || !lastItem?.volume) {
                        return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                      }
                      const marketCap = lastItem.close_price * lastItem.volume;
                      return (
                        <div className="text-3xl font-semibold">
                          {marketCap.toLocaleString("en-US", {
                            style: "currency",
                            currency: "USD",
                            notation: "compact",
                            compactDisplay: "short",
                          })}
                        </div>
                      );
                    })()}
                  </div>
                  <Separator orientation="vertical" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">Share Volume</div>
                    {(() => {
                      const lastTime = displayChartData[displayChartData.length - 1];
                      if (!lastTime || lastTime.volume == null) {
                        return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                      }
                      return (
                        <div className="text-3xl font-semibold">
                          {lastTime.volume.toLocaleString()}
                        </div>
                      );
                    })()}
                  </div>
                  <Separator orientation="vertical" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">P/E (TTM)</div>
                    {(() => {
                      const lastItem = displayChartData[displayChartData.length - 1];
                      // Calculate TTM EPS using the last 4 quarters
                      const ttmEarnings = displayChartData
                        .slice(-252) // Approximate trading days in a year
                        .reduce((sum, item) => sum + (item.earnings || 0), 0);
                      
                      if (!lastItem?.close_price || ttmEarnings === 0) {
                        return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                      }
                      
                      const pe = lastItem.close_price / (ttmEarnings / lastItem.volume);
                      return (
                        <div className="text-3xl font-semibold">{pe.toFixed(2)}</div>
                      );
                    })()}
                  </div>
                  <Separator orientation="vertical" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-muted-foreground">EPS (TTM)</div>
                    {(() => {
                      const lastItem = displayChartData[displayChartData.length - 1];
                      // Calculate TTM EPS
                      const ttmEarnings = displayChartData
                        .slice(-252) // Approximate trading days in a year
                        .reduce((sum, item) => sum + (item.earnings || 0), 0);
                      
                      if (!lastItem?.volume || ttmEarnings === 0) {
                        return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                      }
                      
                      const eps = ttmEarnings / lastItem.volume;
                      return (
                        <div className="text-3xl font-semibold">
                          {eps.toFixed(2)}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </Card>
            </div>

            {newsPanelActive && (
              <div className="w-96 h-full">
                <Card className="h-full flex flex-col">
                  <div className="p-4 border-b flex justify-between items-start">
                    <div>
                      {clickedEvent && (
                        <>
                          <h2 className="text-sm font-medium text-muted-foreground">
                            Volatile Period
                          </h2>
                          <p className="text-lg font-semibold">
                            {formatDate(clickedEvent.start)} - {formatDate(clickedEvent.end)}
                          </p>
                        </>
                      )}
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        // Clear all related states when closing the panel
                        setNewsPanelActive(false);
                        setSelectedEventId(null); // Clear selected event ID
                        setClickedEvent(null);
                        setNewsDetails(null);
                        // If there's an active request, abort it
                        if (activeRequest) {
                          activeRequest.abort();
                          setActiveRequest(null);
                        }
                        setIsNewsLoading(false);
                      }}
                      className="h-8 w-8 -mt-1"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div 
                    className="flex-1 overflow-y-auto p-4" 
                    style={{ '--scrollbar-width': '8px' } as React.CSSProperties}
                  >
                    {isNewsLoading ? (
                      <div className="space-y-4 p-4">
                        <div className="mb-4">
                          <h3 className="text-lg font-semibold mb-2">AI Analysis in Progress</h3>
                          <p className="text-sm text-muted-foreground">
                            Analyzing market volatility with Claude Sonnet 4 and real-time news data
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          {reasoningSteps.map((step, index) => (
                            <div 
                              key={step.id} 
                              className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 ${
                                step.status === 'running' ? 'bg-blue-50 border border-blue-200' : 
                                step.status === 'completed' ? 'bg-green-50 border border-green-200' : 
                                step.status === 'error' ? 'bg-red-50 border border-red-200' : 
                                'bg-gray-50 border border-gray-200'
                              }`}
                            >
                              <div className="flex-shrink-0">
                                {step.status === 'running' && (
                                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                )}
                                {step.status === 'completed' && (
                                  <Check className="w-4 h-4 text-green-600" />
                                )}
                                {step.status === 'error' && (
                                  <AlertCircle className="w-4 h-4 text-red-600" />
                                )}
                                {step.status === 'pending' && (
                                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                                )}
                              </div>
                              
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${
                                  step.status === 'running' ? 'text-blue-700' : 
                                  step.status === 'completed' ? 'text-green-700' : 
                                  step.status === 'error' ? 'text-red-700' : 
                                  'text-gray-500'
                                }`}>
                                  {step.text}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <>
                        {newsDetails?.text_summary && (
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold mb-2">Summary</h3>
                            <p className="text-sm text-muted-foreground">
                              {newsDetails.text_summary}
                            </p>
                          </div>
                        )}
                        {Array.isArray(newsDetails?.explanations) && 
                          newsDetails.explanations.length > 0 && (
                            <div>
                              <h3 className="text-lg font-semibold mb-2">Explanations</h3>
                              {newsDetails.explanations.map((explanation, idx) => (
                                <div key={idx} className="mb-3 p-3 bg-muted rounded-lg">
                                  <p className="text-sm">{explanation}</p>
                                  {newsDetails.references[idx] && (
                                    <div className="mt-2 flex items-center justify-between">
                                      <p className="text-xs text-muted-foreground">
                                        Source: {newsDetails.references[idx].split('/')[2]?.replace('www.', '')}
                                      </p>
                                      <a
                                        href={newsDetails.references[idx]}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline"
                                      >
                                        Read More
                                      </a>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                        )}
                      </>
                    )}
                  </div>
                </Card>
              </div>
            )}
          </div>
        ) : (
          <Card className="w-full flex flex-col">
            <div className="px-7 py-6 flex justify-between items-start border-b">
              <div className="space-y-1.5">
                <h2 className="text-2xl font-semibold text-card-foreground">
                  {stockMetadata ? stockMetadata.longName : "Loading..."}
                </h2>
                <p className="text-sm font-medium text-muted-foreground">
                  {stockMetadata
                    ? `${stockMetadata.exchangeName} · ${stockMetadata.currency} · Last Closed: ${formatDate(stockMetadata.lastClose)}`
                    : "Last Closed: Loading..."
                  }
                </p>
              </div>
              <div className="flex gap-4">
                {stockMetadata && (
                  <>
                    <div className={`${stockMetadata.montly_pct_change >= 0 ? "bg-green-100" : "bg-red-100"} px-6 py-4 rounded flex items-center gap-2`}>
                      {stockMetadata.montly_pct_change >= 0 ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {`${stockMetadata.montly_pct_change >= 0 ? '+' : ''}${(stockMetadata.montly_pct_change * 100).toFixed(1)}% MoM`}
                      </span>
                    </div>
                    <div className={`${stockMetadata.yearly_pct_change >= 0 ? "bg-green-100" : "bg-red-100"} px-6 py-4 rounded flex items-center gap-2`}>
                      {stockMetadata.yearly_pct_change >= 0 ? (
                        <ArrowUpCircle className="h-4 w-4" />
                      ) : (
                        <ArrowDownCircle className="h-4 w-4" />
                      )}
                      <span className="text-sm font-medium">
                        {`${stockMetadata.yearly_pct_change >= 0 ? '+' : ''}${(stockMetadata.yearly_pct_change * 100).toFixed(1)}% YoY`}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 border-b">
              <div className="p-6 flex flex-col flex-1 min-h-0 h-full">
                <div className="flex-1 min-h-0">
                  <div className="w-full h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={displayChartData}
                        margin={{
                          top: 10,
                          right: 10,
                          left: 10,
                          bottom: 10,
                        }}
                        onMouseDown={handleChartMouseDown}
                        onMouseMove={handleChartMouseMove}
                        onMouseUp={handleChartMouseUp}
                        style={{ 
                          userSelect: isDragging ? 'none' : 'auto',
                          WebkitUserSelect: isDragging ? 'none' : 'auto',
                          MozUserSelect: isDragging ? 'none' : 'auto'
                        } as React.CSSProperties}
                      >
                        <defs>
                          <pattern
                            id="diagonalPatternRed"
                            patternUnits="userSpaceOnUse"
                            width="8"
                            height="8"
                          >
                            <rect width="8" height="8" fill="#ef4444" opacity="0.2" />
                            <path
                              d="M-2,2 l4,-4
                                 M0,8 l8,-8
                                 M6,10 l4,-4"
                              style={{
                                stroke: "#ef4444",
                                strokeWidth: 1.5,
                                opacity: 0.9
                              }}
                            />
                          </pattern>
                          <pattern
                            id="diagonalPatternGreen"
                            patternUnits="userSpaceOnUse"
                            width="8"
                            height="8"
                          >
                            <rect width="8" height="8" fill="#22c55e" opacity="0.2" />
                            <path
                              d="M-2,2 l4,-4
                                 M0,8 l8,-8
                                 M6,10 l4,-4"
                              style={{
                                stroke: "#22c55e",
                                strokeWidth: 1.5,
                                opacity: 0.9
                              }}
                            />
                          </pattern>
                        </defs>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        
                        {/* User drag selection visualization */}
                        {isDragging && getCurrentDragSelection() && (
                          <ReferenceArea
                            x1={getCurrentDragSelection()!.start}
                            x2={getCurrentDragSelection()!.end}
                            fill="#9ca3af"
                            fillOpacity={0.3}
                            stroke="#6b7280"
                            strokeWidth={1}
                            strokeDasharray="3,2"
                          />
                        )}
                        
                        {showEventHighlights && eventHighlights.map((event) => {
                          const isSelected = event.id === selectedEventId;
                          const isHovered = event.id === hoveredEvent;
                          
                          return (
                            <ReferenceArea
                              key={event.id}
                              x1={event.start}
                              x2={event.end}
                              fill={isSelected ? 
                                `url(#${calculatePriceTrend(displayChartData, event.start, event.end) === "up" ? "diagonalPatternGreen" : "diagonalPatternRed"})` : 
                                (calculatePriceTrend(displayChartData, event.start, event.end) === "up" ? "#22c55e66" : "#ef444466")
                              }
                              fillOpacity={isSelected ? 1 : (isHovered ? 0.6 : 0.4)}
                              onClick={() => { if (!isSelected) handleEventClick(event.id); }}
                              onMouseEnter={(e) => { if (!isSelected) { setHoveredEvent(event.id); setPopupPosition({ x: e.pageX, y: e.pageY }); }}}
                              onMouseMove={(e) => { if (!isSelected) setPopupPosition({ x: e.pageX, y: e.pageY }); }}
                              onMouseLeave={() => { if (!isSelected) { setHoveredEvent(null); setPopupPosition(null); }}}
                              style={{ cursor: isSelected ? 'default' : 'pointer' }}
                            />
                          );
                        })}
                        {intervals.map((interval) => {
                          return (() => {
                            // Determine the starting and ending values for the interval.
                            const startDatum = displayChartData.find(d => d.time === interval.x1);
                            const endDatum = displayChartData.find(d => d.time === interval.x2);
                            const trendColor = (startDatum && endDatum)
                              ? (endDatum.close_price - startDatum.close_price >= 0 ? "green" : "red")
                              : "gray";

                            const isSelected = selectedInterval === interval.id;
                            const isHovered = hoveredInterval === interval.id;
                            let fillColor: string;
                            if (isSelected) {
                              fillColor = trendColor === "green"
                                ? "url(#diagonalPatternGreen)"
                                : "url(#diagonalPatternRed)";
                            } else if (isHovered) {
                              fillColor = trendColor === "green" ? "#22c55e" : "#ef4444";  // Tailwind 500 variants
                            } else {
                              fillColor = trendColor === "green" ? "#22c55e66" : "#ef444466";  // 0.4 opacity
                            }

                            return (
                              <ReferenceArea
                                key={`${interval.x1}-${interval.x2}`}
                                x1={interval.x1}
                                x2={interval.x2}
                                fill={fillColor}
                                fillOpacity={isSelected ? 1 : 0.5}
                                onClick={() => {
                                  if (selectedInterval === interval.id) {
                                    setSelectedInterval(null);
                                  } else {
                                    setSelectedInterval(interval.id);
                                  }
                                }}
                                onMouseEnter={(e) => { setHoveredInterval(interval.id); setPopupPosition({ x: e.pageX, y: e.pageY }); }}
                                onMouseMove={(e) => { setPopupPosition({ x: e.pageX, y: e.pageY }); }}
                                onMouseLeave={() => { setHoveredInterval(null); setPopupPosition(null); }}
                                className="cursor-pointer transition-colors duration-200 hover:opacity-90"
                                role="button"
                                aria-label={`Toggle highlight region ${interval.label}`}
                              />
                            );
                          })();
                        })}
                        <XAxis
                          dataKey="time"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={8}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "var(--radius)",
                          }}
                          labelStyle={{
                            color: "hsl(var(--muted-foreground))",
                            fontSize: "14px",
                            marginBottom: "4px",
                          }}
                          itemStyle={{
                            color: "hsl(var(--foreground))",
                            fontSize: "14px",
                          }}
                          formatter={(value) => [`$${value}`, "Price"]}
                        />
                        <Line
                          type="monotone"
                          dataKey="close_price"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={true}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-24">
                      <div className="flex-shrink-0">
                        <ToggleGroup
                          type="single"
                          value={selectedInterval ?? ""}
                          disabled={controlsDisabled}
                          className={controlsDisabled ? "opacity-50 cursor-not-allowed" : ""}
                          onValueChange={(value) => { 
                            // Update the selected interval without resetting the sliderValue.
                            setSelectedInterval(value);
                          }}
                        >
                          <ToggleGroupItem disabled={controlsDisabled} value="3Y" aria-label="3 Years">3Y</ToggleGroupItem>
                          <ToggleGroupItem disabled={controlsDisabled} value="1Y" aria-label="1 Year">1Y</ToggleGroupItem>
                          <ToggleGroupItem disabled={controlsDisabled} value="6M" aria-label="6 Months">6M</ToggleGroupItem>
                        </ToggleGroup>
                      </div>

                      <div className="w-[500px] space-y-3.5">
                        <Slider
                          disabled={controlsDisabled}
                          className={controlsDisabled ? "opacity-50 cursor-not-allowed" : ""}
                          value={[sliderValue]}
                          onValueChange={(value: number[]) => { 
                            setSliderValue(value[0]); 
                          }}
                        />
                        <div className={`flex justify-between items-center ${controlsDisabled ? "opacity-50" : ""}`}>
                          <span className="text-sm font-medium">
                            Date Range
                          </span>
                          <span className="text-sm font-medium text-muted-foreground">
                            {intervalStartDate && intervalEndDate 
                              ? `${formatDate(intervalStartDate)} to ${formatDate(intervalEndDate)}`
                              : "Loading..."}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleEventAnalyzerClick} disabled={eventAnalyzerDisabled}>
                      Event Analyzer
                      <Radar className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-7 py-6 flex justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Prev Close</span>
                  {(() => {
                    const lastItem = displayChartData[displayChartData.length - 1];
                    const prevItem = displayChartData[displayChartData.length - 2];
                    
                    if (!lastItem?.close_price || !prevItem?.close_price) {
                      return <span className="text-sm font-medium text-muted-foreground">N/A</span>;
                    }
                    
                    const pctChange = ((lastItem.close_price - prevItem.close_price) / prevItem.close_price) * 100;
                    const sign = pctChange > 0 ? "+" : "";
                    const colorClass = pctChange > 0 ? "text-green-600" : "text-red-600";
                    return (
                      <span className={`text-sm font-medium ${colorClass}`}>
                        {sign}{pctChange.toFixed(2)}%
                      </span>
                    );
                  })()}
                </div>
                {(() => {
                  const lastItem = displayChartData[displayChartData.length - 1];
                  const price = lastItem?.close_price != null
                    ? `$${lastItem.close_price.toFixed(2)}`
                    : <span className="text-3xl font-semibold text-muted-foreground">N/A</span>;
                  return <div className="text-3xl font-semibold">{price}</div>;
                })()}
              </div>
              <Separator orientation="vertical" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Market Cap</div>
                {(() => {
                  const lastItem = displayChartData[displayChartData.length - 1];
                  if (!lastItem?.close_price || !lastItem?.volume) {
                    return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                  }
                  const marketCap = lastItem.close_price * lastItem.volume;
                  return (
                    <div className="text-3xl font-semibold">
                      {marketCap.toLocaleString("en-US", {
                        style: "currency",
                        currency: "USD",
                        notation: "compact",
                        compactDisplay: "short",
                      })}
                    </div>
                  );
                })()}
              </div>
              <Separator orientation="vertical" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">Share Volume</div>
                {(() => {
                  const lastTime = displayChartData[displayChartData.length - 1];
                  if (!lastTime || lastTime.volume == null) {
                    return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                  }
                  return (
                    <div className="text-3xl font-semibold">
                      {lastTime.volume.toLocaleString()}
                    </div>
                  );
                })()}
              </div>
              <Separator orientation="vertical" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">P/E (TTM)</div>
                {(() => {
                  const lastItem = displayChartData[displayChartData.length - 1];
                  // Calculate TTM EPS using the last 4 quarters
                  const ttmEarnings = displayChartData
                    .slice(-252) // Approximate trading days in a year
                    .reduce((sum, item) => sum + (item.earnings || 0), 0);
                  
                  if (!lastItem?.close_price || ttmEarnings === 0) {
                    return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                  }
                  
                  const pe = lastItem.close_price / (ttmEarnings / lastItem.volume);
                  return (
                    <div className="text-3xl font-semibold">{pe.toFixed(2)}</div>
                  );
                })()}
              </div>
              <Separator orientation="vertical" />
              <div className="space-y-1">
                <div className="text-sm font-medium text-muted-foreground">EPS (TTM)</div>
                {(() => {
                  const lastItem = displayChartData[displayChartData.length - 1];
                  // Calculate TTM EPS
                  const ttmEarnings = displayChartData
                    .slice(-252) // Approximate trading days in a year
                    .reduce((sum, item) => sum + (item.earnings || 0), 0);
                  
                  if (!lastItem?.volume || ttmEarnings === 0) {
                    return <div className="text-3xl font-semibold text-muted-foreground">N/A</div>;
                  }
                  
                  const eps = ttmEarnings / lastItem.volume;
                  return (
                    <div className="text-3xl font-semibold">
                      {eps.toFixed(2)}
                    </div>
                  );
                })()}
              </div>
            </div>
            {intervalError && (
              <div className="mt-2 text-red-500 text-sm">
                {intervalError}
              </div>
            )}
          </Card>
        )}
      </main>
      {popupPosition && (hoveredEvent || hoveredInterval) && (
        <InvestigatePopup x={popupPosition.x} y={popupPosition.y} />
      )}
    </div>
  )
}
