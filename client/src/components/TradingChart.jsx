import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, LineChart as LineIcon, RefreshCw } from 'lucide-react';

export default React.memo(function TradingChart({ asset }) {
  const { formatMoney } = useAuth();
  const [candles, setCandles] = useState([]);
  const [chartType, setChartType] = useState('candlestick');
  const [timeframe, setTimeframe] = useState('1m');
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [loading, setLoading] = useState(true);

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 340 });
  const hoverRafRef = useRef(null);

  // Fetch candle data
  useEffect(() => {
    if (!asset) return;

    let isMounted = true;
    async function fetchCandles() {
      try {
        const res = await fetch(`/api/market/candles/${asset.ticker}?timeframe=${timeframe}&limit=60`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setCandles(data.candles || []);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Error fetching candles:', err);
      }
    }

    fetchCandles();
    const interval = setInterval(fetchCandles, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [asset?.ticker, timeframe]);

  // Debounced Resize Observer
  useEffect(() => {
    let resizeTimer = null;

    function updateSize() {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: 340
        });
      }
    }

    function handleResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateSize, 100);
    }

    updateSize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer) clearTimeout(resizeTimer);
    };
  }, []);

  // Throttled mouse enter handler using requestAnimationFrame
  const handleCandleHover = useCallback((c) => {
    if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
    hoverRafRef.current = requestAnimationFrame(() => {
      setHoveredCandle(c);
    });
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverRafRef.current) cancelAnimationFrame(hoverRafRef.current);
    setHoveredCandle(null);
  }, []);

  // Memoized coordinate calculations to eliminate frame-rate drops
  const chartMath = useMemo(() => {
    const allCandles = [...candles];
    if (allCandles.length === 0 && asset) {
      allCandles.push({
        timestamp: Date.now(),
        open: Number(asset.current_price_usd) || 10,
        high: Number(asset.high_24h_usd) || 10,
        low: Number(asset.low_24h_usd) || 10,
        close: Number(asset.current_price_usd) || 10,
        volume: 1000
      });
    }

    const prices = allCandles.flatMap(c => [Number(c.low), Number(c.high)]);
    const minPrice = (Math.min(...prices) || 1) * 0.998;
    const maxPrice = (Math.max(...prices) || 10) * 1.002;
    const priceRange = maxPrice - minPrice || 1;

    const maxVolume = Math.max(...allCandles.map(c => Number(c.volume) || 0), 100);

    const paddingLeft = 10;
    const paddingRight = 65;
    const paddingTop = 20;
    const paddingBottom = 40;
    const chartHeight = dimensions.height - paddingTop - paddingBottom;
    const chartWidth = dimensions.width - paddingLeft - paddingRight;

    const candleWidth = Math.max(4, Math.min(18, (chartWidth / (allCandles.length || 1)) * 0.7));

    const getY = (val) => paddingTop + chartHeight - ((val - minPrice) / priceRange) * chartHeight;
    const getX = (index) => paddingLeft + (index * (chartWidth / (allCandles.length - 1 || 1)));

    const linePoints = allCandles.map((c, i) => `${getX(i)},${getY(Number(c.close))}`).join(' ');
    const areaPoints = `${getX(0)},${paddingTop + chartHeight} ${linePoints} ${getX(allCandles.length - 1)},${paddingTop + chartHeight}`;

    return {
      allCandles,
      minPrice,
      maxPrice,
      priceRange,
      maxVolume,
      paddingLeft,
      paddingRight,
      paddingTop,
      paddingBottom,
      chartHeight,
      chartWidth,
      candleWidth,
      getY,
      getX,
      linePoints,
      areaPoints
    };
  }, [candles, asset, dimensions]);

  if (!asset) return null;

  const {
    allCandles,
    minPrice,
    priceRange,
    maxVolume,
    paddingLeft,
    paddingRight,
    paddingTop,
    chartHeight,
    candleWidth,
    getY,
    getX,
    linePoints,
    areaPoints
  } = chartMath;

  return (
    <div className="flex flex-col h-full rounded-2xl bg-dark-900 border border-white/10 overflow-hidden">
      
      {/* Top Chart Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-dark-950/60">
        <div className="flex items-center gap-2">
          
          <div className="flex rounded-lg bg-dark-850 p-0.5 border border-white/5 text-[11px] font-mono font-medium">
            {['1m', '5m', '15m', '1h', '1D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded transition cursor-pointer ${
                  timeframe === tf ? 'bg-dark-700 text-brand-cyan font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <div className="flex rounded-lg bg-dark-850 p-0.5 border border-white/5 text-[11px]">
            <button
              onClick={() => setChartType('candlestick')}
              title="Candlestick Chart"
              className={`p-1.5 rounded transition cursor-pointer ${
                chartType === 'candlestick' ? 'bg-dark-700 text-brand-cyan' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setChartType('line')}
              title="Area Line Chart"
              className={`p-1.5 rounded transition cursor-pointer ${
                chartType === 'line' ? 'bg-dark-700 text-brand-cyan' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LineIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Live Hover Info */}
        <div className="flex items-center gap-4 text-xs font-mono">
          {hoveredCandle ? (
            <div className="flex items-center gap-3 text-[11px]">
              <span className="text-slate-400">O: <strong className="text-white">${Number(hoveredCandle.open).toFixed(2)}</strong></span>
              <span className="text-slate-400">H: <strong className="text-white">${Number(hoveredCandle.high).toFixed(2)}</strong></span>
              <span className="text-slate-400">L: <strong className="text-white">${Number(hoveredCandle.low).toFixed(2)}</strong></span>
              <span className="text-slate-400">C: <strong className={Number(hoveredCandle.close) >= Number(hoveredCandle.open) ? 'text-brand-green' : 'text-brand-red'}>${Number(hoveredCandle.close).toFixed(2)}</strong></span>
              <span className="text-slate-400">Vol: <strong className="text-brand-cyan">{Number(hoveredCandle.volume).toLocaleString()}</strong></span>
            </div>
          ) : (
            <div className="text-slate-500 text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" /> Live Price Feed
            </div>
          )}
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div ref={containerRef} className="relative flex-1 w-full min-h-[300px] bg-gradient-to-b from-dark-950 to-dark-900 overflow-hidden">
        {loading && candles.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-slate-500 gap-2 text-xs font-mono">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-cyan" /> Loading candlestick telemetry...
          </div>
        ) : (
          <svg
            width="100%"
            height={dimensions.height}
            className="cursor-crosshair select-none"
            onMouseLeave={handleMouseLeave}
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00d8ff" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#00d8ff" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
              const price = minPrice + (priceRange * (1 - pct));
              const y = paddingTop + (chartHeight * pct);
              return (
                <g key={i}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={dimensions.width - paddingRight}
                    y2={y}
                    stroke="rgba(255,255,255,0.05)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={dimensions.width - paddingRight + 6}
                    y={y + 3}
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                  >
                    ${price.toFixed(2)}
                  </text>
                </g>
              );
            })}

            {/* Volume Histogram bars */}
            {allCandles.map((c, i) => {
              const x = getX(i);
              const volHeight = (Number(c.volume) / maxVolume) * 45;
              const y = paddingTop + chartHeight - volHeight;
              const isUp = Number(c.close) >= Number(c.open);

              return (
                <rect
                  key={`vol-${i}`}
                  x={x - candleWidth / 2}
                  y={y}
                  width={candleWidth}
                  height={volHeight}
                  fill={isUp ? 'rgba(0, 245, 155, 0.15)' : 'rgba(255, 59, 105, 0.15)'}
                />
              );
            })}

            {/* Render Candlesticks or Line */}
            {chartType === 'line' ? (
              <>
                <polygon points={areaPoints} fill="url(#chartGradient)" />
                <polyline
                  points={linePoints}
                  fill="none"
                  stroke="#00d8ff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            ) : (
              allCandles.map((c, i) => {
                const x = getX(i);
                const openY = getY(Number(c.open));
                const closeY = getY(Number(c.close));
                const highY = getY(Number(c.high));
                const lowY = getY(Number(c.low));

                const isUp = Number(c.close) >= Number(c.open);
                const candleTop = Math.min(openY, closeY);
                const candleBodyHeight = Math.max(2, Math.abs(closeY - openY));
                const color = isUp ? '#00f59b' : '#ff3b69';

                return (
                  <g
                    key={i}
                    onMouseEnter={() => handleCandleHover(c)}
                    className="transition-opacity hover:opacity-80"
                  >
                    <line
                      x1={x}
                      y1={highY}
                      x2={x}
                      y2={lowY}
                      stroke={color}
                      strokeWidth="1.2"
                    />
                    <rect
                      x={x - candleWidth / 2}
                      y={candleTop}
                      width={candleWidth}
                      height={candleBodyHeight}
                      fill={color}
                      rx="1"
                    />
                  </g>
                );
              })
            )}

            {/* Current Price Dashed Reference Line */}
            {asset && (
              <>
                <line
                  x1={paddingLeft}
                  y1={getY(Number(asset.current_price_usd))}
                  x2={dimensions.width - paddingRight}
                  y2={getY(Number(asset.current_price_usd))}
                  stroke="#00f59b"
                  strokeDasharray="2 2"
                  strokeWidth="1"
                />
                <rect
                  x={dimensions.width - paddingRight + 4}
                  y={getY(Number(asset.current_price_usd)) - 8}
                  width={paddingRight - 6}
                  height="16"
                  fill="#00f59b"
                  rx="3"
                />
                <text
                  x={dimensions.width - paddingRight + 7}
                  y={getY(Number(asset.current_price_usd)) + 4}
                  fill="#07090e"
                  fontSize="9"
                  fontWeight="bold"
                  fontFamily="JetBrains Mono"
                >
                  ${Number(asset.current_price_usd).toFixed(2)}
                </text>
              </>
            )}
          </svg>
        )}
      </div>

    </div>
  );
});
