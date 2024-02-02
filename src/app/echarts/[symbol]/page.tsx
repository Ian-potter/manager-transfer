"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import "./index.css";
export default function Echarts({ params }: { params: any }) {
  console.log(params, "params==");
  const { symbol } = params;
  const [eData, setEData] = useState<{ xAxis: number[]; yAxis: number[] }>();
  const [totalData, setTotalData] = useState<{
    xAxis: number[];
    yAxis: number[];
  }>();
  const getData = useCallback(() => {
    fetch(
      `/api/app/market/nft-listings?chainId=tDVV&symbol=${symbol}&skipCount=0&maxResultCount=500`
    )
      .then((res) => res.json())
      .then((res: any) => {
        const items: any[] = res.data.items;
        const xAxis: number[] = [];
        const yAxis: number[] = [];

        let currentPrices = 0;
        items.forEach((item) => {
          let quantity = item.quantity;
          if (currentPrices === item.prices) {
            let lastQuantity = yAxis.at(-1) || 0;
            lastQuantity += quantity;
            yAxis.pop();
            yAxis.push(lastQuantity);
          } else {
            currentPrices = item.prices;
            xAxis.push(item.prices);
            yAxis.push(quantity);
          }
        });
        setEData({
          xAxis,
          yAxis,
        });

        const ty: number[] = [];
        let total1 = 0;
        yAxis.forEach((v, i) => {
          total1 += v;
          ty.push(total1);
        }, 0);
        setTotalData({
          xAxis,
          yAxis: ty,
        });
      });
  }, [symbol]);

  console.log("eData", eData);
  console.log("totalData", totalData);

  useEffect(() => {
    const ids = setInterval(() => {
      getData();
    }, 5000);
    return () => {
      clearInterval(ids);
    };
  }, [getData]);

  const pRef = useRef<echarts.ECharts>();

  useEffect(() => {
    if (!pRef.current)
      pRef.current = echarts.init(document.getElementById("main"));
    if (!eData?.xAxis) pRef.current.showLoading();
    else pRef.current.hideLoading();
    pRef.current.setOption({
      title: {
        text: symbol,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        name: "Price",
        data: eData?.xAxis || [],
      },
      yAxis: {
        // data: eData?.yAxis || [],
        type: "value",
      },
      tooltip: {
        trigger: "axis",
      },
      series: [
        {
          name: "Amout",
          type: "line",
          data: eData?.yAxis,
          areaStyle: {},
        },
      ],
    });
  }, [eData?.xAxis, eData?.yAxis, symbol]);

  const tRef = useRef<echarts.ECharts>();

  useEffect(() => {
    if (!tRef.current)
      tRef.current = echarts.init(document.getElementById("depth-map"));
    if (!totalData?.xAxis) tRef.current.showLoading();
    else tRef.current.hideLoading();
    tRef.current.setOption({
      title: {
        text: symbol,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        name: "Price",
        data: totalData?.xAxis || [],
      },
      yAxis: {
        // data: eData?.yAxis || [],
        type: "value",
      },
      tooltip: {
        trigger: "axis",
      },
      series: [
        {
          name: "Amout",
          type: "line",
          data: totalData?.yAxis,
          areaStyle: {},
        },
      ],
    });
  }, [symbol, totalData?.xAxis, totalData?.yAxis]);

  return (
    <div>
      <div className="detail">
        <div>
          <h2>{symbol}&nbsp;Price -&gt; Amount</h2>
          <div id="main" style={{ height: 600 }}></div>
        </div>
        <div>
          <h2>{symbol}&nbsp; Depth Map</h2>
          <div id="depth-map" style={{ height: 600 }}></div>
        </div>
      </div>
    </div>
  );
}
