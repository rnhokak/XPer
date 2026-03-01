"use client";

import { useMemo } from "react";

type ParentCategory = {
  id: string;
  name: string;
  type: "income" | "expense" | "transfer";
  totalAmount: number;
  childCategories: {
    id: string;
    name: string;
    totalAmount: number;
  }[];
};

// Generate colors for the pie chart
const generateColors = (count: number) => {
  const colors = [];
  const hueStep = 360 / Math.max(count, 1);
  
  for (let i = 0; i < count; i++) {
    // Vary saturation and lightness slightly for better visual appeal
    const hue = i * hueStep;
    const saturation = 70 + Math.sin(i) * 10; // Between 60-80%
    const lightness = 45 + Math.cos(i) * 5; // Between 40-50%
    colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  }
  
  return colors;
};

type Props = {
  parentCategories: ParentCategory[];
};

export function ParentCategoryPieChart({ parentCategories }: Props) {
  // Filter out parent categories with zero total amount
  const validCategories = parentCategories.filter(cat => cat.totalAmount > 0);
  
  if (validCategories.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-md border border-dashed p-8 text-center">
        <p className="text-sm text-muted-foreground">Không có dữ liệu để hiển thị biểu đồ</p>
      </div>
    );
  }

  // Calculate total amount for percentage calculation
  const totalAmount = validCategories.reduce((sum, cat) => sum + cat.totalAmount, 0);
  
  // Generate colors for each category
  const colors = generateColors(validCategories.length);
  
  // Calculate angles and positions for each slice
  const slices = useMemo(() => {
    let currentAngle = 0;
    return validCategories.map((category, index) => {
      const percentage = totalAmount > 0 ? category.totalAmount / totalAmount : 0;
      const angle = percentage * 360;
      
      // Calculate the end angle
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;
      
      // Convert angles to radians
      const startRad = (startAngle * Math.PI) / 180;
      const endRad = (endAngle * Math.PI) / 180;
      
      // Calculate coordinates for the arc
      const x1 = 100 + 80 * Math.cos(startRad);
      const y1 = 100 + 80 * Math.sin(startRad);
      const x2 = 100 + 80 * Math.cos(endRad);
      const y2 = 100 + 80 * Math.sin(endRad);
      
      // Large arc flag: 1 if angle > 180, 0 otherwise
      const largeArcFlag = angle > 180 ? 1 : 0;
      
      // Create the path for this slice
      const pathData = [
        `M 100 100`, // Move to center
        `L ${x1} ${y1}`, // Line to start of arc
        `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`, // Arc to end of slice
        `Z` // Close path back to center
      ].join(' ');
      
      return {
        category,
        pathData,
        color: colors[index],
        percentage: (percentage * 100).toFixed(1),
        angle,
        startAngle
      };
    });
  }, [validCategories, colors, totalAmount]);

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

  return (
    <div className="space-y-4">
      <div className="relative mx-auto h-64 w-64">
        <svg viewBox="0 0 200 200" className="h-full w-full">
          {slices.map((slice, index) => (
            <path
              key={slice.category.id}
              d={slice.pathData}
              fill={slice.color}
              stroke="white"
              strokeWidth="2"
              className="transition-all hover:opacity-90"
            />
          ))}
          {/* Center circle */}
          <circle cx="100" cy="100" r="30" fill="white" />
          <text
            x="100"
            y="100"
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-lg font-bold fill-gray-900"
          >
            {formatCurrency(totalAmount)}
          </text>
        </svg>
      </div>
      
      <div className="mt-4 space-y-2">
        {slices.map((slice, index) => (
          <div key={slice.category.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div 
                className="h-3 w-3 rounded-full" 
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-sm font-medium">{slice.category.name}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium">{formatCurrency(slice.category.totalAmount)}</span>
              <span className="ml-2 text-xs text-muted-foreground">({slice.percentage}%)</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}