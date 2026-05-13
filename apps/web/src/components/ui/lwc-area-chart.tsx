"use client";

/**
 * TradingView lightweight-charts area chart wrapper.
 * Used for any time-series (NetLiq history, AI cost trend, cumulative spend).
 *
 * Data points are { time: 'YYYY-MM-DD', value: number }.
 *
 * NOTE: lightweight-charts is a tiny WebGL-free Canvas library — much smoother
 * than Recharts for dense series, and matches the look the user is targeting.
 */
import { useEffect, useRef } from "react";
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
} from "lightweight-charts";

export type AreaPoint = { time: string; value: number };

export function LwcAreaChart({
  data,
  height = 280,
  topColor = "rgba(255, 56, 56, 0.4)",
  bottomColor = "rgba(255, 56, 56, 0.0)",
  lineColor = "#ff3838",
  priceFormat = (n: number) => `$${n.toFixed(2)}`,
}: {
  data: AreaPoint[];
  height?: number;
  topColor?: string;
  bottomColor?: string;
  lineColor?: string;
  priceFormat?: (v: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "rgba(0,0,0,0)" },
        textColor: "#8d8fa7",
        fontSize: 11,
        fontFamily:
          'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Liberation Mono", Consolas, monospace',
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.03)" },
        horzLines: { color: "rgba(255,255,255,0.03)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.05)",
        scaleMargins: { top: 0.12, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.05)",
        timeVisible: false,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: { color: "rgba(255, 56, 56, 0.35)", width: 1, style: 0 },
        horzLine: { color: "rgba(255, 56, 56, 0.35)", width: 1, style: 0 },
      },
      handleScroll: false,
      handleScale: false,
    });

    chartRef.current = chart;
    seriesRef.current = chart.addSeries(AreaSeries, {
      topColor,
      bottomColor,
      lineColor,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      priceFormat: {
        type: "custom",
        formatter: priceFormat,
        minMove: 0.01,
      },
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // Intentionally only run once — color/format updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply latest data + colors when props change
  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.applyOptions({
      topColor,
      bottomColor,
      lineColor,
      priceFormat: { type: "custom", formatter: priceFormat, minMove: 0.01 },
    });
    seriesRef.current.setData(
      data.map((d) => ({ time: d.time as never, value: d.value }))
    );
    if (data.length > 0) chartRef.current?.timeScale().fitContent();
  }, [data, topColor, bottomColor, lineColor, priceFormat]);

  return <div ref={containerRef} style={{ width: "100%", height }} />;
}
