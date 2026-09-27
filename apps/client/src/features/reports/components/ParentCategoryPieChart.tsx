import { useMemo, useState } from "react";
import { getCategoryEmoji } from "@/lib/cashflow/categoryUtils";
import { cn } from "@/lib/utils";

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

const PALETTE = [
  "#10b981", // emerald-500
  "#3b82f6", // blue-500
  "#f59e0b", // amber-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#06b6d4", // cyan-500
  "#f97316", // orange-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
  "#e11d48", // rose-500
  "#84cc16", // lime-500
  "#64748b", // slate-500
];

type Props = {
  parentCategories: ParentCategory[];
  currency?: string;
  typeLabel?: string;
  activeCategoryId?: string | null;
  onSelectCategory?: (categoryId: string | null) => void;
};

export function ParentCategoryPieChart({
  parentCategories,
  currency = "VND",
  typeLabel = "Chi tiêu",
  activeCategoryId,
  onSelectCategory,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Filter out parent categories with zero total amount
  const validCategories = useMemo(
    () => parentCategories.filter((cat) => cat.totalAmount > 0),
    [parentCategories]
  );

  const totalAmount = useMemo(
    () => validCategories.reduce((sum, cat) => sum + cat.totalAmount, 0),
    [validCategories]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(Math.max(0, Math.round(value)));

  // Calculate angles and paths for donut chart
  const slices = useMemo(() => {
    if (totalAmount <= 0) return [];
    let currentAngle = -90; // Start at 12 o'clock

    return validCategories.map((category, index) => {
      const fraction = category.totalAmount / totalAmount;
      const angle = fraction * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const color = PALETTE[index % PALETTE.length];
      const percentage = (fraction * 100).toFixed(1);

      // Donut dimensions
      const cx = 110;
      const cy = 110;
      const rOuter = 92;
      const rInner = 62;

      // Handle single 100% item
      const isFullCircle = angle >= 359.99;

      let pathData = "";
      if (isFullCircle) {
        pathData = [
          `M ${cx} ${cy - rOuter}`,
          `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter}`,
          `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter}`,
          `M ${cx} ${cy - rInner}`,
          `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner}`,
          `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner}`,
          "Z",
        ].join(" ");
      } else {
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        const largeArc = angle > 180 ? 1 : 0;

        const x1Outer = cx + rOuter * Math.cos(startRad);
        const y1Outer = cy + rOuter * Math.sin(startRad);
        const x2Outer = cx + rOuter * Math.cos(endRad);
        const y2Outer = cy + rOuter * Math.sin(endRad);

        const x1Inner = cx + rInner * Math.cos(endRad);
        const y1Inner = cy + rInner * Math.sin(endRad);
        const x2Inner = cx + rInner * Math.cos(startRad);
        const y2Inner = cy + rInner * Math.sin(startRad);

        pathData = [
          `M ${x1Outer} ${y1Outer}`,
          `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
          `L ${x1Inner} ${y1Inner}`,
          `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
          "Z",
        ].join(" ");
      }

      return {
        category,
        pathData,
        color,
        percentage,
        fraction,
        angle,
      };
    });
  }, [validCategories, totalAmount]);

  if (validCategories.length === 0 || totalAmount <= 0) {
    return (
      <div className="flex h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
        <span className="text-3xl mb-2">📊</span>
        <p className="text-sm font-semibold text-slate-700">Chưa có giao dịch phát sinh</p>
        <p className="text-xs text-slate-500 mt-0.5">Không có dữ liệu chi tiêu trong khoảng thời gian này.</p>
      </div>
    );
  }

  const currentHoveredSlice = hoveredId
    ? slices.find((s) => s.category.id === hoveredId)
    : activeCategoryId
    ? slices.find((s) => s.category.id === activeCategoryId)
    : null;

  return (
    <div className="space-y-6">
      {/* Modern Donut Chart with Center KPI */}
      <div className="relative mx-auto flex items-center justify-center">
        <div className="relative h-64 w-64 sm:h-72 sm:w-72">
          <svg viewBox="0 0 220 220" className="h-full w-full drop-shadow-xs">
            {slices.map((slice) => {
              const isTarget =
                (hoveredId && slice.category.id === hoveredId) ||
                (!hoveredId && activeCategoryId && slice.category.id === activeCategoryId);
              const isDimmed =
                (hoveredId && slice.category.id !== hoveredId) ||
                (!hoveredId && activeCategoryId && slice.category.id !== activeCategoryId);

              return (
                <path
                  key={slice.category.id}
                  d={slice.pathData}
                  fill={slice.color}
                  stroke="white"
                  strokeWidth="2.5"
                  className={cn(
                    "cursor-pointer transition-all duration-200",
                    isTarget ? "opacity-100 scale-[1.03] origin-center drop-shadow-md" : "",
                    isDimmed ? "opacity-40" : "hover:opacity-90"
                  )}
                  onMouseEnter={() => setHoveredId(slice.category.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => {
                    const next = activeCategoryId === slice.category.id ? null : slice.category.id;
                    onSelectCategory?.(next);
                  }}
                />
              );
            })}
          </svg>

          {/* Interactive Donut Center Hole */}
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-4 transition-all duration-200"
            style={{ inset: "25%" }}
          >
            {currentHoveredSlice ? (
              <div className="space-y-0.5 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-xl">{getCategoryEmoji(currentHoveredSlice.category.name)}</span>
                <p className="text-[11px] font-medium text-slate-500 truncate max-w-[120px]">
                  {currentHoveredSlice.category.name}
                </p>
                <p className="text-sm font-extrabold text-slate-900 leading-tight">
                  {formatCurrency(currentHoveredSlice.category.totalAmount)}
                </p>
                <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {currentHoveredSlice.percentage}%
                </span>
              </div>
            ) : (
              <div className="space-y-0.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Tổng {typeLabel}
                </p>
                <p className="text-base sm:text-lg font-black text-slate-900 leading-tight tracking-tight">
                  {formatCurrency(totalAmount)}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {validCategories.length} danh mục
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modern Interactive Category Breakdown Legend */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-1">
          <span>Danh mục ({validCategories.length})</span>
          <span>Số tiền & Tỷ trọng</span>
        </div>

        <div className="grid grid-cols-1 gap-2">
          {slices.map((slice) => {
            const isTarget =
              (hoveredId && slice.category.id === hoveredId) ||
              (!hoveredId && activeCategoryId && slice.category.id === activeCategoryId);
            const emoji = getCategoryEmoji(slice.category.name);

            return (
              <div
                key={slice.category.id}
                onMouseEnter={() => setHoveredId(slice.category.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => {
                  const next = activeCategoryId === slice.category.id ? null : slice.category.id;
                  onSelectCategory?.(next);
                }}
                className={cn(
                  "group flex flex-col gap-1.5 rounded-xl border p-2.5 transition-all duration-150 cursor-pointer active:scale-[0.99]",
                  isTarget
                    ? "border-slate-400 bg-slate-50/90 shadow-2xs ring-2 ring-slate-400/20"
                    : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: slice.color }}
                    />
                    <span className="text-sm shrink-0">{emoji}</span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                      {slice.category.name}
                    </span>
                    {slice.category.childCategories.length > 0 && (
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.2 text-[10px] text-slate-500 shrink-0">
                        {slice.category.childCategories.length} con
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs sm:text-sm font-bold text-slate-900">
                      {formatCurrency(slice.category.totalAmount)} <span className="text-[10px] text-slate-400 font-normal">{currency}</span>
                    </span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        backgroundColor: `${slice.color}18`,
                        color: slice.color,
                      }}
                    >
                      {slice.percentage}%
                    </span>
                  </div>
                </div>

                {/* Progress bar line */}
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${slice.percentage}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
